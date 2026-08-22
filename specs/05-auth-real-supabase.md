# SPEC 05 — Autenticación real con Supabase

> **Status:** Implemented
> **Depends on:** SPEC 01, SPEC 04
> **Date:** 2026-08-21
> **Objective:** Reemplazar el auth simulado en memoria de `/auth` y `lib/session.tsx` por autenticación real de Supabase con email y contraseña (registro con confirmación por correo, inicio de sesión y cierre de sesión), manteniendo el botón "JUGAR COMO INVITADO" sin sesión de Supabase.

## Por qué existe este spec

El spec 01 implementó la sesión como un Context de React en memoria: `login()` acepta cualquier cosa y `signOut()` la borra, sin backend ni persistencia. El spec 04 dejó instalada toda la plomería de Supabase (`lib/supabase/client.ts`, `lib/supabase/server.ts`, `proxy.ts` refrescando la sesión) pero deliberadamente **no la conectó a ninguna pantalla** — `/auth` sigue siendo 100% simulado y el esquema `public` sigue con 0 tablas.

Este spec cierra ese círculo: conecta `/auth` a Supabase Auth e introduce la primera tabla del proyecto, `public.profiles`, que guarda el username que el Nav y el Salón de la Fama ya muestran (Supabase Auth solo entrega el email, no un nombre de jugador). Es también el primer spec del proyecto que define políticas de RLS, y esas políticas se eligen mirando hacia adelante: el Salón de la Fama va a necesitar leer nombres de otros jugadores.

## Scope

**In:**

- Migración SQL en el proyecto Supabase (`zxztagilsjxctrdwktms`) que crea `public.profiles`, habilita RLS con sus políticas, y crea el trigger `handle_new_user()` que inserta el perfil al registrarse.
- `app/auth/page.tsx` reescrito: el tab **INICIAR SESIÓN** pide correo + contraseña y llama a `signInWithPassword`; el tab **CREAR CUENTA** pide usuario + correo + contraseña y llama a `signUp` pasando el username en `options.data`.
- Estados de envío y de error dentro de la `auth-card`, con estética terminal reutilizando las clases `terminal-success` / `term-bar` / `term-body` que ya existen en `app/globals.css` (introducidas por el spec 02 para `/about`).
- Tras un registro exitoso, la tarjeta muestra un aviso `[OK]` de "revisá tu correo", sin loguear al usuario.
- `app/auth/confirm/route.ts`: route handler que verifica el token del correo (`verifyOtp`), deja la sesión en cookies y redirige a `/auth/bienvenida`.
- `app/auth/bienvenida/page.tsx`: pantalla nueva estilo terminal con `[OK] CUENTA ACTIVADA` y un botón para entrar al Vault. También cubre el caso de token inválido o expirado.
- `lib/session.tsx` reescrito por dentro: conserva `SessionProvider` y `useSession()` como API pública, pero la sesión sale de Supabase (`onAuthStateChange` + lectura del perfil) en vez de `useState`.
- Modo invitado: `JUGAR COMO INVITADO` **no llama a Supabase**; guarda una marca en `localStorage` (`av:guest`) y navega a `/`. El Nav muestra `INVITADO ▾`.
- `components/Nav.tsx` sin cambios de código: `signOut()` limpia tanto la marca de invitado como la sesión de Supabase.
- `app/salon/page.tsx`: un solo cambio — la fila `TU MEJOR MARCA` sigue exigiendo sesión real (un invitado no la ve), igual que hoy.
- Configuración en el dashboard de Supabase: "Confirm email" **habilitado**, y la URL de redirección de confirmación apuntando a `/auth/confirm`.
- Variable de entorno nueva: `NEXT_PUBLIC_SITE_URL`, usada para construir el `emailRedirectTo` del registro.

**Out of scope (para futuros specs):**

- OAuth real con Google y GitHub. Los botones `◆ GOOGLE` y `▣ GITHUB` siguen siendo decorativos, exactamente como hoy.
- Recuperación de contraseña ("olvidé mi contraseña", `resetPasswordForEmail`).
- Pantalla de cuenta o perfil editable (cambiar username, avatar, email o contraseña).
- Rutas protegidas. Ninguna ruta pasa a exigir sesión: invitados y visitantes siguen navegando y jugando todo.
- Persistencia de puntuaciones reales. `seededScores` en `/salon` sigue siendo data simulada; la tabla de scores va en su propio spec.
- Convertir un invitado en usuario registrado conservando su progreso.
- Columnas `avatar_url` / `display_name` en `profiles`.
- Dominio propio verificado para los correos de confirmación. Se usa el remitente de prueba de Resend (`onboarding@resend.dev`), sin dominio propio.
- ~~SMTP propio~~ — **excepción descubierta durante la implementación:** Supabase bloquea la edición del código fuente de las plantillas de correo (`Confirm signup`) mientras el proyecto use su SMTP por defecto. Sin poder editar la plantilla no se puede agregar `{{ .TokenHash }}`, y sin eso el route handler `/auth/confirm` (paso 9, patrón `verifyOtp` + `token_hash`) no funciona. Se configura SMTP propio con Resend únicamente para desbloquear la edición de la plantilla — ver Decisions.
- Reenviar el correo de confirmación desde la UI.

## Data model

### Tabla nueva: `public.profiles`

```sql
create table public.profiles (
  id         uuid primary key
               references auth.users(id)
               on delete cascade,
  username   text not null unique,
  created_at timestamptz not null default now()
);
```

`username` es `unique`: dos jugadores no pueden compartir nombre en el Salón de la Fama. Si el nombre está tomado, el `signUp` falla y la tarjeta muestra el error.

### Políticas de RLS sobre `profiles`

RLS habilitado. Cuatro decisiones explícitas:

| Operación | Política                                                                              |
| --------- | ------------------------------------------------------------------------------------- |
| `select`  | `using (true)` — lectura pública, incluidos anónimos (el Salón de la Fama es público) |
| `insert`  | Sin política: la fila la crea el trigger `handle_new_user()` con `security definer`   |
| `update`  | `using (auth.uid() = id)` — cada usuario solo edita su propia fila                    |
| `delete`  | Sin política: nadie borra perfiles desde el cliente                                   |

### Trigger de creación de perfil

```sql
-- Se dispara after insert on auth.users, security definer.
-- Copia el username desde raw_user_meta_data->>'username' a public.profiles.
create function public.handle_new_user() returns trigger ...
```

El username llega ahí porque el registro lo pasa así:

```ts
supabase.auth.signUp({
  email,
  password,
  options: {
    data: { username },
    emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm`,
  },
});
```

### Formas nuevas en el cliente

```ts
// lib/session.tsx — la API pública no cambia de forma para los consumidores
export interface SessionUser {
  name: string; // username de profiles, o "INVITADO" en modo invitado
}

interface SessionContextValue {
  user: SessionUser | null;
  isGuest: boolean; // true solo en modo invitado (sin sesión de Supabase)
  status: "loading" | "ready";
  playAsGuest: () => void;
  signOut: () => Promise<void>;
}
```

`login()` desaparece de la API: la sesión ya no se inyecta a mano, la produce Supabase. `status: "loading"` cubre el primer render antes de que se resuelva la sesión, para que el Nav no parpadee entre "Iniciar Sesión" y el nombre del usuario.

```ts
// app/auth/page.tsx — estado del formulario
type AuthStatus = "idle" | "sending" | "error" | "check-email";
```

### Clave de `localStorage` (modo invitado)

```
av:guest = "1"
```

Se escribe al pulsar `JUGAR COMO INVITADO` y se borra en `signOut()` y al iniciar sesión de verdad.

### Variable de entorno nueva (`.env.local`, no versionada)

```
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## Implementation plan

1. Aplicar la migración SQL en Supabase vía `mcp__supabase__apply_migration`: crear `public.profiles` con el esquema de arriba. Verificar con `mcp__supabase__list_tables` que la tabla existe.
2. Segunda migración: habilitar RLS en `profiles` y crear las políticas de `select` (pública) y `update` (`auth.uid() = id`). Verificar con `mcp__supabase__get_advisors` que no queda ningún aviso de seguridad de tipo "RLS disabled".
3. Tercera migración: crear la función `public.handle_new_user()` (`security definer`, `set search_path = ''`) y el trigger `after insert on auth.users` que inserta en `profiles` leyendo `new.raw_user_meta_data->>'username'`.
4. Configurar el dashboard de Supabase: "Confirm email" habilitado en Authentication → Providers → Email, y `http://localhost:3000/auth/confirm` agregado a las Redirect URLs permitidas. Agregar `NEXT_PUBLIC_SITE_URL=http://localhost:3000` a `.env.local`. **Prerequisito técnico agregado durante la implementación:** configurar SMTP propio con Resend en Authentication → Emails → SMTP Settings (host `smtp.resend.com`, puerto 465, usuario `resend`, contraseña el `RESEND_API_KEY` existente, remitente `onboarding@resend.dev`) — es la única forma de desbloquear la edición de plantillas en este proyecto. Recién con el SMTP propio activo, editar la plantilla "Confirm signup" en Authentication → Email Templates → Source, cambiando `{{ .ConfirmationURL }}` por `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`.
5. Reescribir `lib/session.tsx`: `SessionProvider` instancia el cliente de browser (`lib/supabase/client.ts`), lee la sesión inicial con `getUser()`, se suscribe a `onAuthStateChange`, consulta `profiles` para obtener el `username`, y expone `{ user, isGuest, status, playAsGuest, signOut }`. Al montar, si no hay sesión de Supabase y `localStorage.getItem("av:guest") === "1"`, expone `user = { name: "INVITADO" }` con `isGuest = true`. `npm run build` sigue compilando; `/auth` todavía no está migrado y falla al tipar `login` — se arregla en el paso siguiente, que va en el mismo commit.
6. Reescribir el formulario de `app/auth/page.tsx`: el tab `in` pide correo + contraseña; el tab `up` pide usuario + correo + contraseña. Validación mínima en cliente: campos no vacíos y contraseña de 6 o más caracteres. `onSubmit` pasa a `async` y llama a `signInWithPassword` o `signUp` según el tab.
7. Agregar los estados de la tarjeta: botón deshabilitado con `ENTRANDO…` / `CREANDO…` mientras `status === "sending"`; bloque terminal con `[FAIL] …` cuando `status === "error"`, reutilizando `terminal-success` / `term-bar` / `term-body`; bloque `[OK] Revisá tu correo para activar la cuenta.` cuando `status === "check-email"` tras un `signUp` exitoso. Traducir los errores de Supabase a mensajes en español (credenciales inválidas, correo ya registrado, usuario ya en uso).
8. Cambiar `playAsGuest` en `app/auth/page.tsx` para que llame a `useSession().playAsGuest()` (escribe `av:guest` en `localStorage`) y navegue a `/`. Verificar manualmente que el Nav muestra `INVITADO ▾` y que al pulsarlo se limpia la marca.
9. Crear `app/auth/confirm/route.ts`: lee `token_hash` y `type` de los search params, llama a `supabase.auth.verifyOtp(...)` con el cliente de server (`lib/supabase/server.ts`), y redirige a `/auth/bienvenida` en caso de éxito o a `/auth/bienvenida?error=1` si el token es inválido o expiró. Antes de escribirlo, leer la guía de route handlers y de `redirect` en `node_modules/next/dist/docs/` (Next 16, ver AGENTS.md) y consultar `mcp__supabase__search_docs` por el patrón oficial de confirmación de email con `@supabase/ssr`.
10. Crear `app/auth/bienvenida/page.tsx`: pantalla estilo terminal con `[OK] CUENTA ACTIVADA` y un botón `ENTRAR AL VAULT` que lleva a `/`. Si llega `?error=1`, muestra `[FAIL] El enlace es inválido o expiró.` con un enlace a `/auth`.
11. Editar `app/salon/page.tsx`: la condición de la fila `TU MEJOR MARCA` pasa de `user &&` a `user && !isGuest`, para que un invitado siga sin verla (comportamiento idéntico al actual).
12. Prueba manual del flujo completo: crear una cuenta nueva → ver el aviso `[OK]` → recibir el correo → clic en el enlace → aterrizar en `/auth/bienvenida` logueado → el Nav muestra el username → cerrar sesión → volver a iniciar sesión con las mismas credenciales.
13. Prueba manual de los casos degradados: contraseña incorrecta, correo ya registrado, username ya tomado, y enlace de confirmación reusado o expirado.
14. Confirmar que `npm run build` compila sin errores ni warnings de tipos.

## Acceptance criteria

- [x] `public.profiles` existe con las columnas `id`, `username`, `created_at`, con `username` marcado `unique` y `id` referenciando `auth.users(id)` con `on delete cascade`.
- [x] RLS está habilitado en `profiles` y `mcp__supabase__get_advisors` no reporta avisos de seguridad sobre esa tabla.
- [x] Un usuario anónimo (sin sesión) puede leer filas de `profiles`; un usuario autenticado solo puede hacer `update` sobre su propia fila.
- [x] Registrarse desde el tab CREAR CUENTA crea una fila en `auth.users` **y** su fila correspondiente en `profiles` con el username escrito en el formulario.
- [x] Tras un registro exitoso el usuario **no** queda logueado: la tarjeta muestra el bloque `[OK]` de "revisá tu correo".
- [x] El correo de confirmación llega y su enlace lleva a `/auth/bienvenida` con la sesión ya iniciada (el Nav muestra el username, no "Iniciar Sesión").
- [x] Un enlace de confirmación inválido o expirado muestra `[FAIL]` en `/auth/bienvenida`, sin iniciar sesión.
- [x] Iniciar sesión con correo y contraseña correctos deja al usuario logueado y lo lleva a `/`; el Nav muestra su username.
- [x] Iniciar sesión con contraseña incorrecta muestra un bloque `[FAIL]` en la tarjeta y **no** inicia sesión.
- [x] Registrarse con un correo ya usado, o con un username ya tomado, muestra un bloque `[FAIL]` con un mensaje en español que distingue ambos casos.
- [x] Mientras la petición está en curso el botón de envío está deshabilitado y muestra `ENTRANDO…` o `CREANDO…`.
- [x] Enviar cualquiera de los dos formularios con un campo vacío, o con contraseña de menos de 6 caracteres, no llama a Supabase.
- [x] La sesión sobrevive a un refresh de página (F5) y a cerrar y reabrir la pestaña.
- [x] El botón del Nav cierra la sesión al primer clic y deja al usuario en estado no autenticado.
- [x] `JUGAR COMO INVITADO` no crea ningún usuario en Supabase, navega a `/`, y el Nav muestra `INVITADO ▾`.
- [x] La marca de invitado sobrevive a un refresh y desaparece al pulsar `INVITADO ▾` o al iniciar sesión de verdad.
- [x] Un invitado **no** ve la fila `TU MEJOR MARCA` en `/salon`; un usuario autenticado sí.
- [x] Ninguna ruta redirige a `/auth` por falta de sesión: `/`, `/biblioteca`, `/about`, `/juego/[id]`, `/juego/[id]/jugar` y `/salon` siguen accesibles sin iniciar sesión.
- [x] Los botones `◆ GOOGLE` y `▣ GITHUB` siguen visibles y sin funcionalidad, sin lanzar errores en consola.
- [x] `npm run build` compila sin errores.

## Decisions

- **Sí:** tabla `public.profiles` con trigger `handle_new_user()`. Razón: confirmado por el usuario. Supabase Auth solo entrega el email, y el Nav, `/salon` y `/juego/[id]/jugar` ya muestran un nombre de jugador. Se eligió tabla en vez de `user_metadata` porque el Salón de la Fama va a necesitar leer nombres de **otros** usuarios, y `user_metadata` solo es legible por su dueño.
- **Sí:** `username` con constraint `unique`. Razón: confirmado por el usuario — dos `PLAYER1` indistinguibles en el Salón de la Fama es un problema, y agregar `unique` más tarde con datos duplicados ya cargados es doloroso.
- **Sí:** RLS con lectura pública sobre `profiles`. Razón: confirmado por el usuario — el Salón de la Fama es público y mostrará nombres de otros jugadores. La escritura queda restringida al dueño.
- **No:** columnas `avatar_url` / `display_name`. Razón: este spec no las usa; se agregan cuando exista una pantalla de perfil editable.
- **Sí:** inicio de sesión con correo + contraseña. Razón: confirmado por el usuario — es el flujo nativo de `signInWithPassword`, sin tabla intermedia ni lookup previo que además expondría qué usernames existen.
- **Sí:** confirmación de correo obligatoria. Razón: confirmado por el usuario. Revierte la dirección anticipada en el spec 04 ("sin confirmación obligatoria de email"), a cambio de que no se puedan registrar correos que no existen.
- **Sí (excepción sobre el scope original):** SMTP propio con Resend para los correos de Auth, revirtiendo el "No: SMTP propio" con el que se aprobó este spec. Razón: confirmado por el usuario tras descubrir en pantalla, durante la implementación del paso 9, que Supabase deshabilita la edición del código fuente de las plantillas de correo mientras el proyecto use su SMTP por defecto. El paso 9 ya estaba implementado siguiendo el patrón oficial de Supabase para SSR (`verifyOtp` + `token_hash`, consultado vía `search_docs`), que requiere poder editar la plantilla `Confirm signup` para agregar `{{ .TokenHash }}`. La alternativa (cambiar `/auth/confirm` a una page cliente que lea el fragmento de URL del flujo implícito) hubiera revertido la decisión explícita de que sea un route handler; se prefirió mantener el route handler y levantar la restricción de SMTP.
- **Sí:** `/auth/confirm` como route handler que redirige a una pantalla `/auth/bienvenida`. Razón: confirmado por el usuario — un route handler y una page no pueden convivir en el mismo segmento de ruta, así que la verificación del token y la pantalla de bienvenida viven en segmentos separados.
- **Sí:** modo invitado con marca en `localStorage`, sin sesión de Supabase. Razón: confirmado por el usuario — el estado de invitado persiste entre visitas sin crear usuarios anónimos reales en la base de datos ni habilitar el provider anónimo.
- **No:** `signInAnonymously()` de Supabase. Razón: confirmado por el usuario — crearía filas de usuario reales para cada visitante casual, y este spec no tiene nada que persistir todavía para ellos.
- **Sí:** un invitado **no** ve `TU MEJOR MARCA` en `/salon`. Razón: preserva el comportamiento exacto de hoy (`login(null)` dejaba `user` en `null`); un invitado no tiene marcas que mostrar. Es el único cambio de código en `app/salon/page.tsx`.
- **Sí:** `lib/session.tsx` conserva `SessionProvider` / `useSession()` como API pública. Razón: confirmado por el usuario — `Nav.tsx` y `/juego/[id]/jugar` no cambian, el reemplazo es quirúrgico y queda contenido en un archivo.
- **Sí:** `signOut()` limpia la marca de invitado **y** la sesión de Supabase. Razón: permite que `Nav.tsx` siga con un único botón y sin lógica condicional nueva.
- **No:** eliminar el Context y leer la sesión en cada consumidor. Razón: obligaría a tocar `Nav.tsx`, `/salon` y `/juego/[id]/jugar`, convirtiendo el spec en una refactorización mayor.
- **Sí:** errores en bloque terminal `[FAIL]` dentro de la `auth-card`. Razón: confirmado por el usuario — reutiliza las clases `terminal-success` / `term-bar` / `term-body` que el spec 02 ya introdujo para `/about`, sin CSS nuevo.
- **Sí:** validación mínima en cliente (campos no vacíos, contraseña de 6+). Razón: confirmado por el usuario — 6 es el mínimo por defecto de Supabase; duplicar más reglas entre cliente y servidor genera dos fuentes de verdad que se desincronizan.
- **Sí:** cierre de sesión directo al primer clic. Razón: confirmado por el usuario, es el comportamiento actual y no requiere agregar un dropdown al Nav.
- **No:** OAuth con Google y GitHub. Razón: confirmado por el usuario — cada provider exige credenciales en su consola más configuración en el dashboard de Supabase, y este spec ya trae tabla, RLS, trigger y confirmación por correo. Los botones quedan decorativos, igual que hoy.
- **No:** recuperación de contraseña. Razón: no fue solicitada; es un cuarto flujo de auth con su propia ruta de callback.
- **No:** rutas protegidas. Razón: confirmado por el usuario — todo sigue público, lo que mantiene coherente el botón de invitado (un invitado puede jugar).

## Risks

| Riesgo                                                                                                                                                                                                      | Mitigación                                                                                                                                                                                                                                                                      |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Si `handle_new_user()` falla (username duplicado), Postgres aborta toda la transacción de `auth.users`: el `signUp` devuelve un error genérico y el usuario no se crea.                                     | Es el comportamiento deseado (no queremos usuarios sin perfil), pero el mensaje de Supabase es opaco. El paso 7 traduce ese error a `[FAIL] Ese nombre de usuario ya está en uso.` y el paso 13 lo prueba a mano.                                                               |
| Una función `security definer` sin `set search_path = ''` es un vector de escalada de privilegios y Supabase la reporta como aviso de seguridad.                                                            | El paso 3 la crea con `set search_path = ''` y referencias calificadas; el paso 2 verifica con `mcp__supabase__get_advisors` que no queden avisos.                                                                                                                              |
| Resend en su plan gratuito tiene límite de 100 emails/día y 3000/mes, y el remitente de prueba `onboarding@resend.dev` (sin dominio verificado) puede tener restricciones sobre a quién se le puede enviar. | Suficiente para desarrollo y pruebas manuales. Si el envío falla o se agota el límite durante el paso 12, confirmar cuentas manualmente desde el dashboard de Supabase (Authentication → Users). Dominio propio verificado queda para un spec futuro si el volumen lo requiere. |
| `NEXT_PUBLIC_SITE_URL` apunta a `localhost:3000`; al desplegar, los enlaces de confirmación seguirán apuntando a localhost si no se actualiza la variable y las Redirect URLs.                              | La variable existe precisamente para no hardcodear el host. Al desplegar hay que actualizarla y agregar la URL de producción a las Redirect URLs del dashboard.                                                                                                                 |
| `localStorage` no está disponible durante el render en servidor ni en modo privado estricto; leerlo sin guarda rompe la hidratación o lanza una excepción.                                                  | El paso 5 lee `av:guest` solo dentro de un efecto en el cliente, con `try/catch`. Sin la marca, el usuario simplemente ve el CTA de "Iniciar Sesión" — degradación limpia.                                                                                                      |
| El primer render no sabe todavía si hay sesión, y el Nav parpadea entre "Iniciar Sesión" y el nombre del usuario.                                                                                           | `useSession()` expone `status: "loading" \| "ready"` (paso 5) para que los consumidores puedan evitar el parpadeo.                                                                                                                                                              |

## What is **not** in this spec

- OAuth real con Google y GitHub (los botones siguen decorativos).
- Recuperación de contraseña.
- Pantalla de cuenta o perfil editable.
- Rutas protegidas por sesión.
- Persistencia de puntuaciones reales — `seededScores` sigue simulado.
- Convertir un invitado en usuario registrado conservando su progreso.
- SMTP o dominio propio para los correos de confirmación.
- Reenvío del correo de confirmación desde la UI.

Cada uno de esos, si se necesita, va en su propio spec.
