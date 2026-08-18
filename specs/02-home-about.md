# SPEC 02 — Pantallas Home y Acerca de

> **Status:** Implemented
> **Date:** 2026-08-18
> **Depends on:** SPEC 01
> **Objective:** Migrar a Next.js App Router las pantallas Home y Acerca de del prototipo estático (`references/resources/templates/home-about/`), moviendo la Biblioteca actual de `/` a `/biblioteca`, agregando un Nav y footer compartidos en el layout raíz, y extrayendo los datos de juegos a `lib/games.ts`.

## Por qué existe este spec

`app/page.tsx` hoy contiene una versión estática de la Biblioteca (parte de spec 01, aún sin la interactividad completa que ese spec define). El prototipo completo en `references/resources/templates/home-about/` muestra que **Inicio (Home)** es una pantalla distinta de Biblioteca — una landing con hero, secciones de features, preview de juegos, stats, actividad en vivo y pricing — y que existe además una pantalla **Acerca de (About)** con misión, highlights y formulario de contacto simulado. Este spec migra esas dos pantallas, reubica la Biblioteca a su propia ruta, y centraliza Nav/footer en el layout para no duplicarlos por página.

## Scope

**In:**

- **Home** (`home.jsx`) → `/` — hero con siluetas flotantes animadas, sección "¿Por qué Arcade Vault?", preview de 6 juegos, bloque de stats, "Actividad en vivo" (ticker de puntuaciones + top jugadores con datos ilustrativos), sección de pricing con FAQ, y CTA final.
- **Acerca de** (`about.jsx`) → `/about` — hero de misión, 3 highlights, divisor decorativo animado, y formulario de contacto (nombre/email/mensaje) con validación básica y estado de éxito simulado tipo terminal.
- Mover el contenido actual de Biblioteca de `app/page.tsx` a `app/biblioteca/page.tsx`, sin cambiar su comportamiento (sigue siendo visual/estático, sin buscador ni chips funcionales — eso es alcance de spec 01, no de este spec).
- `components/Nav.tsx` (Client Component) migrado de `nav.jsx`, compartido vía `app/layout.tsx`: logo, links **Inicio / Biblioteca / Acerca de** con estado activo por ruta, coin-counter decorativo, menú hamburguesa mobile.
- Footer compartido movido a `app/layout.tsx` (mismo contenido que hoy vive inline en `app/page.tsx`).
- `lib/games.ts`: tipos (`GameCategory`, `Game`) y datos (`GAMES`, `CATS`) migrados de los arrays inline actuales de `app/page.tsx`, reusados por Home (preview) y Biblioteca (grid).
- Ampliar `app/globals.css` con los bloques `HOME PAGE`, `ABOUT PAGE`, `ACTIVITY` y `PRICING` de `references/resources/templates/home-about/styles.css` (las demás secciones ya existen en el CSS actual).

**Out of scope (para futuros specs):**

- Pantallas Detalle (`/juego/[id]`), Reproductor (`/juego/[id]/jugar`), Autenticación (`/auth`) y Salón de la Fama (`/salon`) — siguen definidas en spec 01 pero no se tocan aquí.
- Buscador y chips de categoría funcionales en Biblioteca (filtrado en tiempo real) — se mueve la pantalla tal cual está hoy (sin esa interactividad).
- Sesión de usuario, `lib/session.tsx`, backend o cualquier persistencia.
- Envío real del formulario de contacto (email, API, etc.).
- Cualquier pantalla que no exista en `references/resources/templates/home-about/`.

## Data model

```ts
// lib/games.ts
export type GameCategory = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";

export interface Game {
  id: string;
  title: string;
  short: string;
  cat: GameCategory;
  cover: string; // clase CSS de portada, p.ej. "cover-bricks"
  color: "cyan" | "magenta" | "yellow" | "green";
  best: number;
}

export const GAMES: Game[]; // los 8 juegos ya definidos hoy en app/page.tsx, migrados tal cual
export const CATS: string[]; // ["TODOS", "ARCADE", "PUZZLE", "SHOOTER", "VERSUS"]
```

Los datos ilustrativos exclusivos de Home (ticker de "actividad reciente" y "top jugadores hoy") **no** entran en `lib/games.ts`: son arrays estáticos locales dentro de `app/page.tsx`, igual que en `home.jsx`.

## Implementation plan

1. Crear `lib/games.ts` con `GameCategory`, `Game`, `GAMES` (migrados de los arrays inline actuales de `app/page.tsx`) y `CATS`. Aún sin consumidores nuevos; `npm run build` sigue compilando.
2. Ampliar `app/globals.css` agregando los bloques `HOME PAGE`, `ABOUT PAGE`, `ACTIVITY` y `PRICING` copiados de `references/resources/templates/home-about/styles.css` (sin duplicar reglas ya presentes como `.fade-in`, `.reveal`, `.spinner`, y sin la sección `GAMEPAD` que no usan ni Home ni About).
3. Crear `components/Nav.tsx` (Client Component) migrado de `nav.jsx`: logo → `Link` a `/`, links **Inicio** (`/`), **Biblioteca** (`/biblioteca`), **Acerca de** (`/about`) con estado activo vía `usePathname()`, coin-counter decorativo, hamburguesa + panel deslizante en mobile (<840px). Sin link de Salón de la Fama ni botón de sesión/auth (esas rutas no existen todavía).
4. Editar `app/layout.tsx`: renderizar `<Nav />` y el footer (migrado tal cual desde el `app/page.tsx` actual) alrededor de `<main className="av-main">{children}</main>`.
5. Crear `app/biblioteca/page.tsx` con el contenido actual de Biblioteca (hero, buscador, chips, grid de tarjetas), importando `GAMES` y `CATS` desde `lib/games.ts` en vez de los arrays inline; sin nav ni footer propios (los provee el layout).
6. Reescribir `app/page.tsx` como Home (Client Component, por el `IntersectionObserver` del reveal-on-scroll), migrado de `home.jsx`: hero con siluetas flotantes, sección "¿Por qué Arcade Vault?", preview de juegos (`GAMES.slice(0, 6)` de `lib/games.ts`), stats, "Actividad en vivo" (ticker + top jugadores con datos locales hardcodeados), pricing con FAQ, CTA final. "EXPLORAR JUEGOS", "VER TODOS LOS JUEGOS →" y el CTA final "INSERTAR MONEDA →" navegan a `/biblioteca` vía `Link`. "CREAR CUENTA", "EMPEZAR GRATIS →", "VER SALÓN →" y el click en las mini-tarjetas de preview de juegos se muestran sin `href`/`onClick` (no navegan a ningún lado, ya que `/auth`, `/salon` y `/juego/[id]` no existen).
7. Crear `app/about/page.tsx` (Client Component) migrado de `about.jsx`: hero de misión, 3 highlights, divisor decorativo animado, formulario de contacto con validación básica (shake si falta algún campo) y estado de éxito simulado estilo terminal — sin llamadas de red, sin `localStorage`.
8. Limpieza final: confirmar que `/`, `/biblioteca` y `/about` no tienen nav ni footer duplicados, que ningún componente usa `localStorage`, y que `npm run build` compila sin errores ni warnings de tipos.

## Acceptance criteria

- [ ] `/` muestra la pantalla Home completa: hero, "¿Por qué Arcade Vault?", preview de juegos, stats, actividad en vivo y pricing.
- [ ] "EXPLORAR JUEGOS" (hero) y "VER TODOS LOS JUEGOS →" en Home navegan a `/biblioteca`.
- [ ] El CTA final "INSERTAR MONEDA →" en Home navega a `/biblioteca`.
- [ ] "CREAR CUENTA", "EMPEZAR GRATIS →", "VER SALÓN →" y las mini-tarjetas de preview de juegos en Home no navegan a ningún lado (sin 404s).
- [ ] `/biblioteca` muestra la misma grilla de juegos que antes vivía en `/`, ahora usando los datos de `lib/games.ts`.
- [ ] `/about` muestra la misión, los 3 highlights, el divisor animado y el formulario de contacto.
- [ ] Enviar el formulario de contacto con algún campo vacío dispara la animación de shake y no muestra el estado de éxito.
- [ ] Enviar el formulario de contacto con los 3 campos completos muestra la pantalla de éxito estilo terminal, sin llamadas de red ni `localStorage`.
- [ ] El Nav aparece (vía layout) en `/`, `/biblioteca` y `/about`, resalta el link activo según la ruta, y solo muestra Inicio/Biblioteca/Acerca de (sin Salón de la Fama ni botón de sesión).
- [ ] El menú hamburguesa del Nav funciona en mobile (<840px) en las 3 rutas.
- [ ] Las animaciones "reveal on scroll" funcionan en las secciones de Home y en la sección de contacto de About.
- [ ] `npm run build` compila sin errores.

## Decisions

- **Sí:** Home pasa a vivir en `/`, Biblioteca se mueve a `/biblioteca`. Razón: confirmado por el usuario — coincide con `nav.jsx` del prototipo, donde Inicio y Biblioteca son rutas separadas.
- **Sí:** Acerca de vive en `/about`. Razón: coincide con el nombre de ruta usado en el prototipo.
- **No:** mostrar en el Nav el link de Salón de la Fama o el botón de sesión/auth. Razón: esas rutas no existen todavía (spec 01 las define pero no las implementó); se agregan cuando tengan su propio spec implementado.
- **No:** dejar que los CTAs internos de Home que apuntarían a `/juego/[id]`, `/auth` o `/salon` naveguen y den 404. Razón: decisión explícita del usuario — misma política que el Nav, se muestran sin acción hasta que esas rutas existan.
- **Sí:** formulario de contacto simulado 100% client-side, sin backend ni persistencia. Razón: confirmado por el usuario, consistente con la decisión de spec 01 de no usar backend ni `localStorage` en el MVP.
- **Sí:** extraer `lib/games.ts` ahora en vez de esperar al spec de Detalle. Razón: confirmado por el usuario — Home necesita el preview de juegos y esto evita duplicar el array entre Home y Biblioteca.
- **Sí:** Nav y footer compartidos vía `app/layout.tsx` en vez de duplicados por página. Razón: confirmado por el usuario, evita repetir markup en Home, Biblioteca y About.
- **No:** tocar la interactividad de buscador/chips de Biblioteca. Razón: no es el objetivo de este spec; se mueve la pantalla tal cual está, la interactividad sigue siendo alcance de spec 01.
- **No:** `lib/session.tsx` / Context de sesión. Razón: fuera de alcance — no hay pantalla de Auth todavía, no hay estado de sesión que mostrar en el Nav.

## What is **not** in this spec

- Pantallas Detalle (`/juego/[id]`), Reproductor (`/juego/[id]/jugar`), Autenticación (`/auth`) y Salón de la Fama (`/salon`).
- Buscador y chips de categoría funcionales en Biblioteca.
- Sesión de usuario, backend, persistencia o envío real del formulario de contacto.
- Cualquier pantalla que no exista en `references/resources/templates/home-about/`.

Cada uno de esos, si se necesita, va en su propio spec.
