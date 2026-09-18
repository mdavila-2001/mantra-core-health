# Matriz de movimiento — fase 07

## Interacciones del piloto «Mis citas»

| Control | Respuesta | ¿Movimiento? | Propiedad · duración · curva | Reducido | Teclado |
|---|---|---|---|---|---|
| «Pedir una cita» | desplaza a «Agendar una cita» y le da el foco | sí: scroll suave | `scrollIntoView({behavior:'smooth'})` | `behavior:'auto'` (salto) | Enter/Espacio; foco visible con el anillo global |
| «Más filtros» | muestra/oculta estado y fechas; `aria-expanded` | no (cambio instantáneo) | — | igual | Enter/Espacio |
| Lista / Calendario | cambia de vista (URL) | transición del control segmentado | color/fondo · `--mov-rapido` (= `--dur-fast`) · `--curva` | 0,01 ms | sin cambios respecto del control existente |
| Buscar / Estado / Fechas | filtra la misma colección | transición de borde del campo | `--dur-fast` | 0,01 ms | nativo |
| «Cancelar» | diálogo de confirmación existente; spinner del botón | spinner del sistema | — | spinner ralentizado (regla del átomo) | nativo |
| Hover de fila de tabla | fondo `--bg-inset` | no | — | — | — |
| Sombra de scroll de tabla | aparece en el borde con contenido oculto | sigue al scroll, no al tiempo | `animation-timeline: scroll(self inline)` | se conserva (no es movimiento) | desplazar con Tab/flechas actualiza la sombra |

Ninguna acción espera a una animación: los cambios de estado son síncronos y las transiciones
sólo acompañan.

## Normalización del sistema

| Antes | Después | Alcance |
|---|---|---|
| `0.15s ease`, `.16s ease`, `120ms ease`, `150ms ease` | `var(--dur-fast) var(--ease-standard)` | 93 reemplazos en 35 hojas de `src/app/**` |
| `0.2s ease`, `0.2s cubic-bezier(.4,0,.2,1)` | `var(--dur-base) var(--ease-standard)` | incluidos arriba |
| `--mov-rapido/medio/lento` = 110/190/320 ms | alias de `--dur-fast/base/slow` = 120/200/320 ms | `styles/alovida.css` |
| `motion.md`: «no hay tokens de movimiento» | tabla de tokens reales | `docs/design-system/motion.md` |

Quedan con literales: `styles/alovida.css` (23 líneas del marco portado, con su curva propia)
— fuera del alcance de esta iteración.

## Verificación

- Runtime: `--mov-rapido` computa 120 ms; el control segmentado 0,12 s; con
  `prefers-reduced-motion: reduce` todas 0,01 ms (bloque global de `styles.css`).
- Sombra: 0/1 al inicio con desborde, 1/1 a mitad, 0/0 sin desborde, 0/1 con movimiento
  reducido (medido con `getComputedStyle` sobre las propiedades registradas).
- Sin perfilado de rendimiento de pintura: los cambios son de duración, no de propiedades
  animadas. Registrado como no ejecutado en `QA_FINAL.md`.
