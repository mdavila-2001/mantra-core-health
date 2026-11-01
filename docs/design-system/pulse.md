# ALOVIDA Pulse

Guía de diseño reutilizable para todo módulo nuevo. Pulse es una **capa**, no un
rediseño: no cambia un color, una tipografía ni un token de `styles.css`. Compone
lo que ya existe en tres ideas, y su código vive en `src/styles/pulse.css`.

> El logotipo de ALOVIDA es una línea de pulso. Pulse parte de ahí: **lo que está
> vivo late, lo que se toca responde, y nada más se mueve.**

---

## 1. Las tres ideas

| Idea | Qué es | Utilidad |
|---|---|---|
| **Latido** | Un estado real (en curso, sin leer, ahora) lo anuncia un anillo que late **tres veces** y se posa | `pulse-ring` / `.pulse-live` |
| **Elevación** | Lo pulsable se levanta 2 px al apuntarlo y se hunde al pulsarlo | `.pulse-lift`, `.pulse-press` |
| **Momento** | **Una** entrada autorada por pantalla; lo único que supera 320 ms | `pulse-draw`, `pulse-arrive` |

### Latido

- Se dispara por un **dato real**, nunca por decoración: la cita en curso, el
  contador sin leer, el reloj de la jornada.
- Tres latidos (dos en contadores) y se posa. **Nunca en bucle**: `motion.md` §4
  reserva los bucles para la carga.
- El color del anillo es el del estado (`--pulse-aura`), no uno nuevo. Para
  cambiarlo: `--pulse-aura: color-mix(in srgb, var(--st-warning-bd) 80%, transparent)`.
- Si el elemento ya tiene un `box-shadow` propio (una franja `inset`, una
  elevación), **no** apliques `pulse-ring` a él: ponlo en un `::after` con
  `position: absolute; inset: 0; border-radius: inherit; pointer-events: none`.
  Un `box-shadow` animado reemplaza al de la pieza durante la animación.

### Elevación

- `transform: translateY(-2px)` + `--pulse-lift`, con `--dur-base` y `--pulse-ease`.
- **Sólo con puntero fino** (`@media (hover: hover) and (pointer: fine)`): en
  táctil el hover se queda pegado tras el toque y la pieza parece rota.
- `:active` la devuelve a su sitio con `--shadow-sm` en `--dur-fast`: el dedo
  «hunde» la pieza. Respuesta en 120 ms = inmediata.
- Una sola declaración de elevación por pieza: nada de borde **y** sombra ancha.

### Momento

- Una por pantalla. En el dashboard es la cinta de la jornada, que se descubre de
  izquierda a derecha (`pulse-draw`, 480 ms). En mensajería es la llegada de una
  burbuja ajena (`pulse-arrive`, 320 ms).
- Corre **una vez por navegación**; no se repite al hacer scroll ni al refrescar
  datos.
- Lo que llega al abrir la pantalla (historial, listados cargados) **no** anima
  como llegada: sólo lo que aparece con la pantalla ya lista.

---

## 2. Qué NO se anima

1. **El contenido clínico.** Un valor, una dosis, un resultado, una cifra: jamás.
   Se anima el continente y el estado, no el dato (`motion.md` §5).
2. Los contadores: late el aro, no el número.
3. Nada esencial detrás de una animación: todo arranca visible (`fill: both` /
   `backwards`) o el estado sin animar es el estado final.
4. Nada de `width`, `height`, `top`, `margin`. Sólo `transform`, `opacity`,
   `clip-path` y `box-shadow`.
5. `--ease-spring` sigue reservada para confirmar un gesto del dedo, nunca datos.

## 3. Movimiento reducido

Con `prefers-reduced-motion: reduce`:

- La regla global de `styles.css` ya baja las duraciones a 0,01 ms.
- Pulse **además** quita el desplazamiento, la escala y el anillo (`animation:
  none`), porque a 0,01 ms todavía queda un cuadro intermedio.
- Se **conserva** lo que confirma un estado: color, borde, fondo.
- Toda utilidad o animación nueva lleva su bloque `@media (prefers-reduced-motion:
  reduce)` junto a la regla que lo mueve.

## 4. Tokens añadidos

| Token | Valor | Para qué |
|---|---|---|
| `--pulse-ease` | `cubic-bezier(0.16, 1, 0.3, 1)` | llegadas y elevación: arranca decidida, se posa sin rebote |
| `--pulse-dur-moment` | `480ms` | el momento autorado, único valor sobre `--dur-slow` |
| `--pulse-aura` | aqua / aqua-400 en oscuro | color del anillo del latido |
| `--pulse-lift` | sombra tintada de petróleo (negra en oscuro) | elevación al apuntar |
| `--pulse-lift-distance` | `-2px` | cuánto se levanta |

## 5. Receta para un módulo nuevo

1. Identifica **el estado vivo** del módulo (¿qué cambia solo?): ése late.
2. Identifica **lo pulsable**: eso se levanta y se hunde.
3. Elige **el momento** (uno). Si dudas, no pongas ninguno.
4. Reutiliza `appStaggerList` para listas que aparecen como lista (máx. 8
   hijos animados) antes de escribir un keyframe.
5. Verifica en navegador en 390 / 768 / 1440, claro y oscuro, y con movimiento
   reducido emulado.

## 6. Dónde está aplicado

| Pantalla | Latido | Elevación | Momento |
|---|---|---|---|
| Dashboard · «Hoy» | cita en curso, punto «en curso» | tarjeta «ahora» | cinta de la jornada |
| Agenda · vista Día | cita en curso | tarjeta de cita | lista en cascada |
| Mensajería | contador sin leer | botones del composer | burbuja ajena que llega |

Detalle de decisiones y evidencia: `docs/pulse/README.md`.

---

## 7. Respuesta — la cuarta idea (09/10/2026)

Lo que se toca contesta, y contesta **igual en toda la aplicación**. Código en
la sección «PULSE · INTERACCIÓN» de `src/styles/pulse.css`.

| Gesto | Regla | Tokens |
|---|---|---|
| **Apuntar** | El hover llega en `--dur-fast`. Si levanta o mueve algo, va dentro de `@media (hover: hover) and (pointer: fine)`: en táctil se queda pegado | `--pulse-hover-tint`, `--pulse-lift` |
| **Pulsar** | Hunde **al instante** (transición de bajada `0s`) y vuelve con `--ease-spring`. Pieza chica: `scale(--pulse-press-scale)`; pieza grande (fila, tarjeta): apenas `scale(0.995)` o un tinte | `--pulse-press-scale` (0,97), `--pulse-press-tint` |
| **Aparecer** | Superficie flotante: `--dur-base` + `--pulse-ease`. Menú y calendario nacen de su ancla (`pulse-pop`) | `--pulse-ease` |
| **Irse** | Más corta que la entrada y acelerando: `--pulse-dur-exit` (140 ms) + `--pulse-ease-exit`. Nunca de golpe | `pulse-leave`, `pulse-fade-out` |
| **Paginar** | El contenido nuevo entra desde el lado hacia el que se avanzó; la marca de la página actual se desliza hasta el número elegido | `[data-page-turn]` |

### Cómo se aplica

- **Base de todo lo pulsable.** `:where(button, a[href], [role=tab]…)` declara la
  transición de color/fondo/borde/sombra/transform con especificidad cero:
  ninguna regla de componente pierde, pero un hover que cambia de color ya no
  salta. Cubre las `<button>` sueltas que nunca declararon la suya.
- **Salida de un modal o aviso.** `playExitAnimation(el, 'pulse-leaving', done)`
  (`shared/motion/exit-animation.ts`) pone la clase, espera a que termine la
  animación y recién entonces cierra. Con movimiento reducido o sin
  `getAnimations` cierra en el acto, en el mismo turno. En listas con `@for`,
  `animate.leave` de Angular hace lo mismo (los avisos).
- **Pieza pulsable a mano** sin componente propio: clase `.pulse-tap`.
- **Tabla con cursor** (`app-data-table`): el `<tbody>` gira hacia el sentido
  pedido **sólo cuando llegan las filas nuevas**; abrir la tabla o refrescar
  no gira.

### Dónde está aplicado

| Pieza | Apuntar | Pulsar | Aparecer / irse |
|---|---|---|---|
| `app-button` | se levanta 1 px (sólo puntero fino) | se hunde 1 px + 1,5 %, vuelve con resorte | — |
| `app-card` interactiva, `result-card`, `rejilla-de-tarjetas` | elevación Pulse | se hunde a `shadow-sm` | — |
| `app-chip` seleccionable, `segmented-control` | borde / fondo | escala 0,97 | — |
| `app-tabs`, `side-nav`, `menu-item` | fondo | tinte de pulsación | subrayado crece con `--pulse-ease` |
| Fila navegable de `app-data-table` | guía de marca a la izquierda | tinte de pulsación | giro de página |
| `app-pagination` | — | — | marca deslizante, rango con fundido |
| `app-dialog`, `app-content-dialog` | — | — | entra 200 ms, sale 140 ms (panel y velo) |
| `app-menu` | — | — | `pulse-pop` desde el ancla |
| `app-toast` | — | — | entra con `--pulse-ease`, sale por donde vino |

### Homogeneidad

- Duraciones y curvas: cero literales en `transition`/`animation` de menos de
  400 ms. 0,18 s, 150 ms, `ease`… pasaron a `--dur-*` / `--ease-*`.
- Tipografía: los tamaños sueltos que coincidían o casi coincidían con la escala
  (12 px, 0,875 rem, 0,9 rem…) son `--fs-*`; `font-weight: 650` no existe en
  el sistema y pasó a 600.
