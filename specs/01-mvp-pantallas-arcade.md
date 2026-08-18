# SPEC 01 — Pantallas visuales del MVP de Arcade Vault

> **Status:** Completed
> **Date:** 2026-08-17
> **Objective:** Migrar a Next.js App Router las cinco pantallas del prototipo estático (`references/resources/templates/`) — Biblioteca, Detalle, Reproductor, Autenticación y Salón de la Fama — como maqueta visual completa, con datos simulados y sin lógica de juego real.

## Por qué existe este spec

El repo ya tiene un prototipo funcional en React puro (CDN + Babel, sin build) bajo `references/resources/templates/`. Ese prototipo usa hash routing en una sola página y `localStorage` para sesión/puntajes. Este spec define cómo se traduce ese prototipo a la app real de Next.js 16 (App Router, rutas reales, Server/Client Components), qué se conserva tal cual (el diseño visual y las animaciones decorativas) y qué se deja fuera (persistencia, backend, juego real).

## Scope

**In:**

- Las 5 pantallas del prototipo, migradas 1:1 en su diseño visual:
  - **Biblioteca** (`biblioteca.jsx`) → `/` — grilla de juegos con buscador y chips de categoría funcionando.
  - **Detalle** (`detalle.jsx`) → `/juego/[id]` — info del juego + tabla de mejores puntuaciones.
  - **Reproductor** (`reproductor.jsx`) → `/juego/[id]/jugar` — HUD, pantalla CRT animada, pausa/fin, modal de fin de partida.
  - **Autenticación** (`auth.jsx`) → `/auth` — tabs iniciar sesión / crear cuenta, botón invitado, botones sociales decorativos.
  - **Salón de la Fama** (`salon.jsx`) → `/salon` — tabs por juego, podio top 3, tabla completa.
- Nav (`nav.jsx`) y footer persistentes en el layout raíz, con estado activo según la ruta y menú hamburguesa en mobile.
- Migración de los datos simulados (`data.jsx`: `GAMES`, `CATS`, `PLAYERS`, `seededScores`) a un módulo TypeScript tipado.
- Sesión de usuario simulada en memoria (nombre visible en el Nav y en "tu mejor marca" del Salón) mientras dure la navegación cliente.
- La simulación decorativa del Reproductor (puntaje que sube solo con un temporizador, nivel, vidas, pausa, modal de fin con guardado ficticio) — es una maqueta animada, no un motor de juego.
- Reemplazo de `app/page.tsx` (actualmente una versión parcial y estática de la Biblioteca) por la implementación completa e interactiva.

**Out of scope (para futuros specs):**

- Cualquier juego real jugable (colisiones, física, input de teclado/mouse controlando una partida).
- Backend, base de datos o API — todo dato sigue siendo mock estático o generado en el cliente.
- Persistencia de sesión o puntuaciones entre recargas de página (ni `localStorage` ni cookies).
- Autenticación real (validación de credenciales, OAuth con Google/GitHub).
- Cualquier pantalla o flujo que no exista en `references/resources/templates/`.

## Data model

```ts
// lib/games.ts
export type GameCategory = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";

export interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: GameCategory;
  cover: string; // clase CSS de portada, p.ej. "cover-bricks"
  color: "cyan" | "magenta" | "yellow" | "green";
  best: number;
  plays: string; // p.ej. "12.4K"
}

export const GAMES: Game[]; // 8 juegos, migrados 1:1 de data.jsx (incluye `long` y `plays`, ausentes en el page.tsx actual)
export const CATS: string[]; // ["TODOS", "ARCADE", "PUZZLE", "SHOOTER", "VERSUS"]
export const PLAYERS: string[]; // nombres usados por seededScores

export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string; // "DD/MM/AAAA"
}

export function seededScores(seed: number, count?: number): ScoreRow[]; // generador determinista, migrado tal cual de data.jsx
```

```ts
// lib/session.tsx
export interface SessionUser {
  name: string;
}
// Context en memoria (sin localStorage): { user: SessionUser | null; login(u: SessionUser | null): void; signOut(): void }
```

Convenciones:

- Los `id` de juego son slugs kebab-case (`bloque-buster`, `caida`, …) y son la clave de ruta en `/juego/[id]`.
- `seededScores` es determinista: mismo `seed` → misma tabla. Se usa `id` del juego para derivar el `seed`, igual que en el prototipo.

## Implementation plan

1. Crear `lib/games.ts` con los tipos y los datos (`GAMES`, `CATS`, `PLAYERS`, `seededScores`) migrados de `data.jsx`, incluyendo los campos `long` y `plays` que faltan en el `app/page.tsx` actual. El build sigue funcionando (el módulo aún no se usa).
2. Crear `lib/session.tsx` con `SessionProvider` y el hook `useSession()` (Context de React en memoria, sin `localStorage`).
3. Crear `components/Nav.tsx` (Client Component) migrado de `nav.jsx`, usando `usePathname()` de `next/navigation`, `Link` de `next/link` y `useSession()` para mostrar "Iniciar Sesión" o el nombre del usuario.
4. Editar `app/layout.tsx`: envolver `{children}` con `<SessionProvider>`, renderizar `<Nav />` y el footer (movidos desde `app/page.tsx`) dentro de `<main className="av-main">`. `next build` sigue compilando.
5. Crear `components/GameCard.tsx` (Client Component, con el efecto _tilt_ al mover el mouse) migrado de `GameCard` en `biblioteca.jsx`.
6. Reescribir `app/page.tsx` (Biblioteca): usa `lib/games.ts` y `GameCard`, con buscador y chips de categoría controlados (`useState`) que filtran la grilla en tiempo real; cada tarjeta enlaza a `/juego/[id]`.
7. Crear `app/juego/[id]/page.tsx` (Detalle, Server Component con `params` async según `PageProps<'/juego/[id]'>`): info del juego, tags, stats y tabla "Mejores puntuaciones" vía `seededScores`; botón "JUGAR AHORA" a `/juego/[id]/jugar` y "VOLVER AL VAULT" a `/`. Si el `id` no existe, `notFound()`.
8. Crear `app/juego/[id]/jugar/page.tsx` (Reproductor, Client Component) migrado de `reproductor.jsx`: HUD (jugador, puntuación, vidas, nivel), pantalla CRT animada, pausa/fin, modal de fin de partida con input de iniciales y guardado ficticio (estado local del componente, sin persistencia real), reinicio y salida a Detalle.
9. Crear `app/auth/page.tsx` (Autenticación, Client Component) migrado de `auth.jsx`: tabs "INICIAR SESIÓN"/"CREAR CUENTA", botón "JUGAR COMO INVITADO", botones sociales decorativos (sin funcionalidad real); al enviar cualquiera de las tres opciones llama a `useSession().login(...)` y navega a `/`.
10. Crear `app/salon/page.tsx` (Salón de la Fama, Client Component) migrado de `salon.jsx`: tabs por juego, podio top 3, tabla completa vía `seededScores`, fila "TU MEJOR MARCA" visible solo si `useSession().user` no es `null`.
11. Limpieza final: revisar `app/globals.css` (sin duplicar `@import "tailwindcss"`, sin clases o referencias muertas del prototipo tipo `#root`), confirmar que ninguna pantalla usa `localStorage`, y que `npm run build` no tiene errores ni warnings de tipos.

## Acceptance criteria

- [x] `/` muestra la Biblioteca; el buscador y los chips de categoría filtran la grilla en tiempo real.
- [x] Cada tarjeta de juego navega a `/juego/[id]` al hacer clic (en toda la tarjeta y en el botón "JUGAR").
- [x] `/juego/[id]` muestra info del juego, tags, stats (`plays`, `best`) y la tabla "Mejores puntuaciones" generada con `seededScores`.
- [x] El botón "JUGAR AHORA" en Detalle navega a `/juego/[id]/jugar`.
- [x] `/juego/[id]/jugar` muestra el HUD y la pantalla CRT animada; la puntuación sube sola mientras no está en pausa ni terminado el juego.
- [x] "PAUSA"/"REANUDAR" detiene y reanuda el incremento de puntuación.
- [x] "FIN" abre el modal de fin de partida con la puntuación final.
- [x] Guardar la puntuación en el modal muestra "PUNTUACIÓN GUARDADA" sin escribir en `localStorage` ni ningún otro storage persistente.
- [x] "JUGAR DE NUEVO" reinicia puntuación, vidas, nivel y cierra el modal.
- [x] `/auth` permite alternar entre "INICIAR SESIÓN" y "CREAR CUENTA"; enviar el formulario, o entrar como invitado, redirige a `/` en los tres casos.
- [x] Tras iniciar sesión, el Nav muestra el nombre del usuario en vez de "Iniciar Sesión"; al recargar la página (F5) vuelve a mostrar "Iniciar Sesión" (sin persistencia).
- [x] `/salon` muestra tabs por juego, podio (top 3) y tabla completa; con sesión activa se ve la fila "TU MEJOR MARCA EN {JUEGO}".
- [x] El Nav resalta el enlace activo según la ruta actual y el menú hamburguesa funciona en mobile (<840px).
- [x] Ninguna pantalla implementa lógica real de un juego: toda la "jugabilidad" del Reproductor es decorativa/simulada (temporizador falso, sin input del jugador controlando nada).
- [x] `npm run build` compila sin errores.

## Decisions

- **Sí:** rutas reales de Next.js App Router (`/`, `/juego/[id]`, `/juego/[id]/jugar`, `/auth`, `/salon`) en vez del hash routing del prototipo. Razón: es lo idiomático en Next.js 16 y habilita back/forward y deep-linking nativos.
- **No:** hash routing tipo SPA (`app.jsx`). Se descarta por no encajar con App Router.
- **Sí:** mantener la simulación decorativa del Reproductor (puntaje automático, HUD, modal de fin). Razón: confirmado por el usuario — no es un juego real, es una maqueta animada.
- **No:** persistencia en `localStorage` de sesión o puntajes. Razón: decisión explícita del usuario — MVP puramente visual, sin estado entre recargas.
- **Sí:** `lib/session.tsx` con React Context en memoria para el nombre de usuario. Razón: Nav y Salón necesitan saber si "hay sesión" sin backend ni storage; se resetea en cada recarga por diseño.
- **Sí:** mantener `app/globals.css` con el CSS del prototipo tal cual (ya portado), sin reescribir a utilidades de Tailwind. Razón: decisión explícita del usuario, menor riesgo de romper el look neón/pixel ya validado.
- **No:** datos desde un backend/API real. Se reutilizan los mismos mocks del prototipo (`GAMES`, `CATS`, `PLAYERS`, `seededScores`).

## What is **not** in this spec

- Lógica real de ningún juego (colisiones, física, input del jugador controlando una partida).
- Backend, base de datos o API.
- Persistencia de sesión o puntuaciones entre recargas de página.
- Autenticación real (OAuth, validación de credenciales).
- Editor de niveles, multijugador, o cualquier pantalla que no exista en `references/resources/templates/`.

Cada uno de esos, si se necesita, va en su propio spec.
