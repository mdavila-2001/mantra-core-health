# Carril 14 · Motion graphics

**Punto del reclamo:** 12c (mensaje del 2026-08-14: "tiene que añadir motion graphics").
**Repos:** frontend únicamente. **Rama sugerida:** `carril-14/motion-graphics`.
**Coordinación:** ver `CARRILES-2026-08-14-README.md` antes de tocar cualquier archivo
compartido, y postear tu bloque en `COORDINACION-AGENTES.md` antes de empezar.

## Alcance — léelo como una decisión, no como un hecho

"Motion graphics" es una palabra que puede significar cualquier cosa entre "una transición
suave" y "un video animado de marca". Este carril lo acota a lo que un sistema de diseño puede
sostener sin volverse un problema de accesibilidad o de rendimiento: **un sistema de movimiento
reusable** (tokens de duración/curva + un directive de entrada) aplicado con criterio, no efectos
sueltos pantalla por pantalla. Si el cliente quería algo más específico (una animación de marca
en la portada, por ejemplo), es una conversación de producto antes que de código — dejá
constancia en tu bloque de `COORDINACION-AGENTES.md` si hace falta esa aclaración antes de
avanzar más allá del sistema base.

**Regla no negociable:** todo lo que animés respeta `prefers-reduced-motion`. El repo ya tiene el
patrón en media docena de componentes (`tabs.css`, `accordion-panel.css`,
`view-state-gallery.css`) — seguilo, no lo reinventes.

## Backend

Ninguno. Es un carril 100% frontend.

## Frontend (`mantra-core-health`)

**Archivos nuevos (no chocan con nada):**

```
src/app/shared/motion/motion-tokens.ts             duraciones y curvas, como valores nombrados
src/app/shared/motion/reveal-on-scroll.directive.ts + .spec.ts   entrada al hacer scroll
src/app/shared/motion/stagger-list.directive.ts     + .spec.ts   listas que aparecen en cascada
```

Construilo sobre la **Web Animations API** nativa o CSS puro — **no agregues una librería de
animación** (`framer-motion`, `gsap`, etc.). Dos razones: evita una segunda dependencia nueva en
`package.json` (que es del Carril 1 en exclusiva, ver la tabla de archivos compartidos del
README) y mantiene el bundle liviano — Angular ya trae `@angular/animations` si hace falta algo
más que CSS.

**Referencia de aplicación — elegí una superficie que hoy no toca ningún otro carril:**
`src/app/features/dashboard/` (`dashboard.ts`, `.html`, `.css`) es estable, ya existe, y ningún
otro carril de este plan lo declara como suyo. Aplicá ahí el sistema de movimiento (entrada de
las tarjetas de estado, transición al cargar datos) como demostración real, no como galería
aislada.

**Archivos existentes que tocás:**

| Archivo | Qué agregás |
|---|---|
| `src/app/features/dashboard/dashboard.ts` (+ `.html` + `.css`) | adopta `reveal-on-scroll`/`stagger-list` en las tarjetas del panel |

**Lo que NO tocás:** ninguna pantalla de los otros nueve carriles. El sistema queda documentado
(un ejemplo de uso claro en el propio código, con comentario corto si hace falta explicar una
curva no obvia) para que el Carril 15 (feed) y el Carril 16 (perfil público) lo adopten después
en sus propias pantallas nuevas — no lo hagas vos por ellos, van a estar en construcción al mismo
tiempo que este carril.

## Definición de hecho

- Existen tokens de movimiento nombrados (no números mágicos sueltos) y al menos dos directivas
  reusables.
- El dashboard demuestra el sistema con un movimiento real, no cosmético — entra con la carga de
  datos, no de forma gratuita.
- Con `prefers-reduced-motion: reduce` activo, nada de esto anima — verificado a mano, no solo
  supuesto.
- `yarn lint` · `yarn typecheck` · `yarn test` · `yarn build`.
