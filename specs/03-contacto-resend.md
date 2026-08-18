# SPEC 03 — Envío real del formulario de contacto con Resend

> **Status:** Implemented
> **Depends on:** SPEC 02
> **Date:** 2026-08-18
> **Objective:** Reemplazar el envío simulado del formulario de contacto en `/about` por un envío real de correo mediante Resend, usando un route handler server-side que recibe los datos y dispara el email al equipo.

## Por qué existe este spec

Spec 02 implementó el formulario de contacto de `/about` como una simulación 100% client-side: al enviar, siempre se muestra la pantalla de éxito estilo terminal, sin llamada de red real (ver spec 02, sección "Decisions": _"formulario de contacto simulado 100% client-side, sin backend ni persistencia"_). Este spec revierte esa decisión puntual: ahora el formulario debe enviar un correo real usando Resend, manteniendo la estética terminal existente pero conectándola a un resultado real (éxito o fallo).

## Scope

**In:**

- `app/api/contact/route.ts`: route handler (`POST`) que recibe `{ name, email, msg }`, valida los campos en el servidor, y usa el SDK de `resend` para enviar un correo.
- El correo se envía **solo al equipo**, a la dirección fija definida en `CONTACT_TO_EMAIL` (variable de entorno). No se envía confirmación automática al usuario.
- El correo usa como remitente `onboarding@resend.dev` (sandbox de Resend, sin dominio propio verificado) y como `reply-to` el email que el usuario escribió en el formulario, para poder responderle directo.
- Asunto del correo: `Nuevo mensaje de contacto — {nombre}`. Cuerpo: nombre, email y mensaje del usuario.
- `app/about/page.tsx`: el `onSubmit` pasa a ser asíncrono. Mantiene la validación de campos vacíos existente (shake) sin cambios. Si los campos son válidos, hace `fetch('/api/contact', ...)`:
  - Mientras espera la respuesta: botón deshabilitado con texto `ENVIANDO…` (nuevo estado `sending`).
  - Si la API responde OK: se muestra la pantalla de éxito estilo terminal ya existente (sin cambios visuales).
  - Si la API responde con error (o el `fetch` falla): se muestra un nuevo estado de error dentro del mismo panel terminal, con línea `[FAIL]` y un botón para reintentar (vuelve al formulario con los datos que el usuario ya había escrito, sin perderlos).
- Nueva dependencia `resend` en `package.json`.
- Variables de entorno nuevas, documentadas en este spec: `RESEND_API_KEY`, `CONTACT_TO_EMAIL`. Se guardan en `.env.local` (ya cubierto por el patrón `.env*` en `.gitignore`, no se commitean). El valor real de `CONTACT_TO_EMAIL` para desarrollo es `juansnchez12@gmail.com`.

**Out of scope (para futuros specs):**

- Confirmación automática por correo al usuario que llenó el formulario.
- Dominio propio verificado en Resend / remitente personalizado (`contacto@arcadevault.dev` o similar). Se usa el sandbox `onboarding@resend.dev`, con la limitación conocida de que en modo sandbox Resend solo entrega a la dirección con la que se creó la cuenta de Resend.
- Rate limiting, protección anti-spam (honeypot, captcha, etc.) o cualquier límite de envíos.
- Persistencia de los mensajes recibidos (base de datos, logs estructurados, panel de administración).
- Cualquier otro formulario o flujo de email fuera del formulario de contacto de `/about`.

## Data model

Este feature no introduce estructuras de datos persistentes nuevas. Sí introduce dos formas nuevas:

```ts
// app/api/contact/route.ts — payload esperado en el POST
interface ContactRequestBody {
  name: string;
  email: string;
  msg: string;
}
```

```ts
// app/about/page.tsx — nuevo estado de envío del formulario
type SendStatus = "idle" | "sending" | "sent" | "error";
```

`sent` reemplaza al actual `sent: string | null` como bandera de estado (el nombre del usuario sigue guardándose aparte para el mensaje de éxito, sin cambios ahí).

Variables de entorno (`.env.local`, no versionadas):

```
RESEND_API_KEY=<api key de la cuenta de Resend>
CONTACT_TO_EMAIL=juansnchez12@gmail.com
```

## Implementation plan

1. Instalar la dependencia: `npm install resend`. `npm run build` sigue compilando (aún sin consumidores).
2. Crear `.env.local` en la raíz del repo (no versionado) con `RESEND_API_KEY` y `CONTACT_TO_EMAIL=juansnchez12@gmail.com`. El usuario debe completar `RESEND_API_KEY` con su propia API key de Resend.
3. Crear `app/api/contact/route.ts`: exporta `POST`, lee el body JSON, valida server-side que `name`, `email` y `msg` no estén vacíos (si falta alguno, responde 400). Antes de escribir el handler, leer la guía de route handlers en `node_modules/next/dist/docs/` (Next 16 usa App Router async APIs, ver AGENTS.md/CLAUDE.md del repo).
4. Dentro del handler, instanciar `Resend` con `process.env.RESEND_API_KEY` y llamar a `resend.emails.send({...})` con `from: "onboarding@resend.dev"`, `to: process.env.CONTACT_TO_EMAIL`, `reply_to: email`, `subject`, y el cuerpo con nombre/email/mensaje. Si Resend responde error, el route handler responde 500; si todo sale bien, responde 200.
5. Editar `app/about/page.tsx`: reemplazar el `useState<string | null>` de `sent` por el nuevo `SendStatus` (`idle` | `sending` | `sent` | `error`), guardando el nombre enviado en una variable aparte para el mensaje de éxito. `onSubmit` pasa a ser `async`, mantiene la validación de shake existente, y en caso de campos válidos hace `fetch('/api/contact', { method: 'POST', body: JSON.stringify(form) })` actualizando el estado a `sending` → `sent` o `error` según la respuesta.
6. Actualizar el JSX del formulario: botón deshabilitado con texto `ENVIANDO…` cuando `status === "sending"`; mantener el panel de éxito actual cuando `status === "sent"`; agregar un nuevo bloque dentro del mismo `terminal-success` (reutilizando las clases `term-bar`/`term-body` existentes) para `status === "error"`, con línea `[FAIL] No se pudo entregar el mensaje.` y un botón `REINTENTAR` que vuelve el estado a `idle` sin borrar lo que el usuario ya escribió.
7. Prueba manual: enviar el formulario con `RESEND_API_KEY` válida y verificar que llega el correo a `CONTACT_TO_EMAIL` con el contenido correcto y `reply-to` al email del usuario. Simular un fallo (p.ej. `RESEND_API_KEY` inválida) y verificar que se muestra el estado de error, no el de éxito.
8. Confirmar que `npm run build` compila sin errores ni warnings de tipos.

## Acceptance criteria

- [x] Enviar el formulario de `/about` con algún campo vacío sigue disparando la animación de shake, sin llamar a la API (comportamiento sin cambios respecto a spec 02).
- [x] Enviar el formulario con los 3 campos completos hace una petición `POST` real a `/api/contact`.
- [x] Mientras la petición está en curso, el botón de envío muestra `ENVIANDO…` y está deshabilitado.
- [x] Si Resend envía el correo exitosamente, se muestra la pantalla de éxito estilo terminal existente, y el correo llega a `CONTACT_TO_EMAIL` con nombre, email y mensaje del usuario, con `reply-to` igual al email del usuario.
- [x] Si el envío falla (API key inválida, error de Resend, o el `fetch` falla), se muestra un estado de error dentro del panel terminal con línea `[FAIL]`, sin mostrar la pantalla de éxito.
- [x] Desde el estado de error, el botón `REINTENTAR` vuelve al formulario sin perder lo que el usuario ya había escrito.
- [x] `RESEND_API_KEY` y `CONTACT_TO_EMAIL` no aparecen hardcodeadas en el código ni se commitean (`.env.local` sigue ignorado por `.gitignore`).
- [x] `npm run build` compila sin errores.

## Decisions

- **Sí:** correo solo al equipo, sin confirmación automática al usuario. Razón: confirmado por el usuario, es el caso de uso mínimo de un formulario de contacto.
- **No:** confirmación automática al usuario que escribió el formulario. Razón: confirmado por el usuario — se puede agregar en otro spec si hace falta.
- **Sí:** remitente `onboarding@resend.dev` (sandbox de Resend). Razón: confirmado por el usuario — no hay dominio propio verificado en Resend todavía; evita configurar DNS para este spec.
- **Sí:** `reply-to` = email del usuario. Razón: confirmado por el usuario, permite responder directo desde el cliente de correo del equipo.
- **Sí:** `CONTACT_TO_EMAIL=juansnchez12@gmail.com` como valor de desarrollo. Razón: confirmado por el usuario. Nota: en modo sandbox de Resend, esta debe ser la misma dirección con la que se creó la cuenta de Resend, o los envíos fallarán (ver Riesgos).
- **Sí:** estado de error explícito y distinto del de éxito cuando falla el envío. Razón: confirmado por el usuario — mostrar éxito falso rompe la confianza del usuario en el formulario.
- **Sí:** botón con estado `ENVIANDO…` durante la petición. Razón: confirmado por el usuario, evita doble envío y da feedback visual.
- **No:** rate limiting o protección anti-spam. Razón: fuera de alcance para este spec, no fue solicitado.
- **No:** persistencia de los mensajes (base de datos, logs). Razón: fuera de alcance, el correo es la única entrega del mensaje.
- **Sí:** variables de entorno en `.env.local` en vez de hardcodear valores. Razón: patrón estándar de Next.js para secretos; `.env*` ya está en `.gitignore`.

## Risks

| Riesgo                                                                                                                                                                                                                       | Mitigación                                                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Modo sandbox de Resend (`onboarding@resend.dev`) solo entrega correos a la dirección con la que se creó la cuenta de Resend. Si `CONTACT_TO_EMAIL` no coincide con esa cuenta, el envío falla silenciosamente en producción. | Documentado en este spec y en `.env.local`. Verificar en la prueba manual (paso 7) que el correo efectivamente llega antes de dar el spec por cerrado. Migrar a dominio propio verificado es un spec futuro si se necesita enviar a otras direcciones. |
| `RESEND_API_KEY` ausente o inválida en producción.                                                                                                                                                                           | El route handler responde 500 y el formulario muestra el estado de error con opción de reintentar, en vez de fallar en silencio o mostrar éxito falso.                                                                                                 |

## What is **not** in this spec

- Confirmación automática por correo al usuario del formulario.
- Dominio propio verificado en Resend / remitente personalizado distinto de `onboarding@resend.dev`.
- Rate limiting, anti-spam, captcha o límites de envío.
- Persistencia de los mensajes de contacto (base de datos, panel de administración, logs estructurados).
- Cualquier otro formulario o flujo de email fuera de `/about`.

Cada uno de esos, si se necesita, va en su propio spec.
