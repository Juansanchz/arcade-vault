# SPEC 04 — Setup base del cliente de Supabase

> **Status:** Implemented
> **Date:** 2026-08-21
> **Objective:** Instalar y configurar el cliente de Supabase (`@supabase/ssr`) en la app de Next.js, con helpers de browser y de server más `proxy.ts` para refrescar la sesión, sin conectarlo todavía a ninguna pantalla ni tabla.

## Por qué existe este spec

El proyecto de Supabase ya está creado y conectado vía MCP, pero el repo no tiene ninguna dependencia ni cliente de Supabase instalado, y el esquema `public` no tiene tablas. Antes de reemplazar el auth simulado (`lib/session.tsx`, `/auth`, ver spec 01) o de persistir datos reales (puntuaciones, perfiles), hace falta la infraestructura base: instalar el SDK, configurar las variables de entorno, y dejar listos los clientes de browser/server con el patrón oficial de Supabase para Next.js App Router (`@supabase/ssr`). Este spec es deliberadamente angosto — solo deja la plomería lista, sin tocar ninguna pantalla existente.

## Scope

**In:**

- Instalar las dependencias `@supabase/ssr` y `@supabase/supabase-js`.
- Variables de entorno nuevas en `.env.local` (no versionado, ya cubierto por `.env*` en `.gitignore`): `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`, documentadas en este spec.
- `lib/supabase/client.ts`: cliente de Supabase para Client Components, vía `createBrowserClient` de `@supabase/ssr`.
- `lib/supabase/server.ts`: cliente de Supabase para Server Components/route handlers, vía `createServerClient` de `@supabase/ssr`, leyendo/escribiendo cookies con la API async de Next 16 (`cookies()` de `next/headers`).
- `proxy.ts` en la raíz del repo: exporta `proxy()` (no `middleware()` — Next 16 renombró el archivo/función, ver AGENTS.md) y refresca la sesión de Supabase en cada request, con un `matcher` que excluye assets estáticos.
- Una verificación real de que el cliente puede hablar con el proyecto Supabase (URL y key válidas), hecha con un script temporal que se borra al cerrar el spec.

**Out of scope (para futuros specs):**

- Conectar este setup a cualquier pantalla existente: `/auth` y `lib/session.tsx` siguen siendo 100% simulados, sin cambios de comportamiento.
- Crear tablas en la base de datos. El esquema `public` sigue con 0 tablas al finalizar este spec.
- Generar tipos TypeScript del esquema (`mcp__supabase__generate_typescript_types`) — no tiene sentido sin tablas.
- Providers OAuth (Google/GitHub) configurados en el dashboard de Supabase.
- `SUPABASE_SERVICE_ROLE_KEY` o cualquier operación privilegiada de servidor.
- Row Level Security, políticas, o cualquier decisión de modelo de datos — se define en el spec que introduzca la primera tabla.
- Persistencia de puntuaciones/juegos, reemplazo de `seededScores`, o cualquier otra pantalla conectada a datos reales.

## Data model

Este spec no crea tablas ni introduce modelo de datos persistente (el esquema `public` sigue con 0 tablas). Sí introduce dos módulos de cliente, sin tipos de dominio propios:

```ts
// lib/supabase/client.ts
export function createClient(): SupabaseClient; // createBrowserClient de @supabase/ssr, para Client Components
```

```ts
// lib/supabase/server.ts
export async function createClient(): Promise<SupabaseClient>; // createServerClient de @supabase/ssr, basado en cookies() async (Next 16)
```

Variables de entorno (`.env.local`, no versionadas):

```
NEXT_PUBLIC_SUPABASE_URL=https://zxztagilsjxctrdwktms.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable/anon key del proyecto, desde el dashboard de Supabase → Settings → API>
```

La URL corresponde al proyecto Supabase ya conectado por MCP. La anon key no se hardcodea en este spec (aunque está pensada para exponerse en el cliente, se sigue el mismo patrón que `RESEND_API_KEY` en spec 03: el usuario la completa desde su propio dashboard).

## Implementation plan

1. Instalar las dependencias: `npm install @supabase/ssr @supabase/supabase-js`. `npm run build` sigue compilando (aún sin consumidores).
2. Agregar a `.env.local` (crear si no existe) `NEXT_PUBLIC_SUPABASE_URL=https://zxztagilsjxctrdwktms.supabase.co` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=` (el usuario completa el valor desde el dashboard de Supabase).
3. Crear `lib/supabase/client.ts` con `createClient()` usando `createBrowserClient` de `@supabase/ssr` y las env vars `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
4. Crear `lib/supabase/server.ts` con `createClient()` async usando `createServerClient` de `@supabase/ssr`, leyendo/escribiendo cookies vía `cookies()` de `next/headers`. Antes de escribirlo, leer la documentación de Cookies/Server Components en `node_modules/next/dist/docs/` (Next 16 usa `cookies()` totalmente async, ver AGENTS.md/CLAUDE.md), y si hace falta, consultar `mcp__supabase__search_docs` por la guía oficial de `@supabase/ssr` para Next.js App Router.
5. Crear `proxy.ts` en la raíz: exporta `proxy()` (no `middleware()`) que instancia el cliente de server de Supabase, llama a un método liviano que fuerza el refresco de sesión (p.ej. `supabase.auth.getClaims()`), y propaga las cookies actualizadas en la respuesta, siguiendo el patrón oficial de Supabase para Next.js App Router.
6. Configurar el `matcher` de `proxy.ts` para excluir `_next/static`, `_next/image`, `favicon.ico` y otros assets estáticos, evitando ejecutar el refresh de sesión en cada request de asset.
7. Verificación real de conexión: crear un script temporal `scripts/check-supabase.ts` que instancia el cliente de server y llama a `supabase.auth.getSession()`, confirmando que responde sin error de credenciales (URL o key inválida). Ejecutarlo con `npx tsx scripts/check-supabase.ts`, confirmar el resultado, y borrar el script antes de cerrar el spec.
8. Confirmar que `npm run build` compila sin errores ni warnings de tipos, y que ninguna pantalla existente (`/`, `/biblioteca`, `/about`, `/auth`, `/juego/[id]`, `/juego/[id]/jugar`, `/salon`) cambió de comportamiento.

## Acceptance criteria

- [ ] `@supabase/ssr` y `@supabase/supabase-js` están en `package.json`.
- [ ] `.env.local` contiene `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`, no versionadas.
- [ ] `lib/supabase/client.ts` exporta un cliente de browser funcional.
- [ ] `lib/supabase/server.ts` exporta un cliente de server basado en cookies, compatible con la API async de Next 16.
- [ ] `proxy.ts` existe en la raíz, exporta `proxy()` (no `middleware()`), y refresca la sesión de Supabase en cada request sin romper ninguna ruta existente.
- [ ] El script de verificación de conexión confirma que la app puede hablar con el proyecto Supabase sin error de credenciales, y se elimina antes de cerrar el spec.
- [ ] Ninguna pantalla existente (`/`, `/biblioteca`, `/about`, `/auth`, `/juego/[id]`, `/juego/[id]/jugar`, `/salon`) cambia de comportamiento visual ni funcional.
- [ ] `npm run build` compila sin errores.
- [ ] El esquema `public` del proyecto Supabase sigue con 0 tablas al finalizar este spec.

## Decisions

- **Sí:** patrón completo `@supabase/ssr` (cliente de browser + cliente de server + `proxy.ts`) en vez de un cliente simple con `@supabase/supabase-js` a secas. Razón: confirmado por el usuario — evita re-arquitecturar cuando un spec futuro conecte auth real.
- **Sí:** usar el proyecto Supabase ya conectado (`zxztagilsjxctrdwktms`). Razón: confirmado por el usuario, ya está provisionado y accesible por MCP.
- **Sí:** verificación real de conexión (script que llama a Supabase) como criterio de aceptación, no solo que compile. Razón: confirmado por el usuario — un build verde no garantiza que la URL/key sean válidas.
- **No:** conectar este setup a `/auth` o `lib/session.tsx`. Razón: confirmado por el usuario — alcance explícitamente acotado a "solo setup base"; el auth real (email/password, sin confirmación obligatoria de email, invitado se mantiene simulado) queda definido como dirección para un spec futuro, pero no se implementa acá.
- **No:** crear tablas ni generar tipos TypeScript del esquema. Razón: no hay modelo de datos definido todavía; se hace en el spec que lo introduzca.
- **No:** `SUPABASE_SERVICE_ROLE_KEY`. Razón: no hay operaciones privilegiadas de servidor en este spec.
- **No:** providers OAuth (Google/GitHub) configurados. Razón: fuera de alcance de "solo setup base"; se decide junto con el spec de auth real.

## Risks

| Riesgo                                                                                                                                   | Mitigación                                                                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Next 16 cambió `cookies()` a async y `middleware.ts` → `proxy.ts`; asumir APIs de Next 14/15 rompería el build o el refresco de sesión.  | Leer la documentación en `node_modules/next/dist/docs/` antes de escribir `server.ts` y `proxy.ts` (pasos 4–5), tal como indica AGENTS.md. |
| `proxy.ts` mal configurado podría interceptar rutas existentes (assets, `/api/contact` de Resend) y degradar el rendimiento o romperlas. | El `matcher` excluye explícitamente assets estáticos; probar manualmente las rutas existentes (paso 8) antes de cerrar el spec.            |
| Anon key inválida o proyecto mal configurado pasa desapercibido si solo se verifica que el build compila.                                | El script de verificación (paso 7) hace una llamada real a Supabase antes de dar el spec por cerrado.                                      |

## What is **not** in this spec

- Conectar `/auth` o `lib/session.tsx` a Supabase Auth (login/registro real).
- Crear tablas, políticas de RLS, o cualquier modelo de datos persistente.
- Generación de tipos TypeScript del esquema.
- Providers OAuth (Google/GitHub).
- `SUPABASE_SERVICE_ROLE_KEY` u operaciones privilegiadas de servidor.
- Persistencia de puntuaciones, perfiles, o cualquier pantalla conectada a datos reales.

Cada uno de esos, si se necesita, va en su propio spec.
