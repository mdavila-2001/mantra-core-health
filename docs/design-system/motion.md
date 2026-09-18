# Movimiento

Poco, y con una regla global que lo apaga cuando corresponde.

---

## La regla que sí existe

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

**Global, en `styles.css`, con `!important`.** Cubre todo el proyecto de una vez:
ningún componente tiene que acordarse.

`0.01ms` en vez de `0`: mantiene los eventos `transitionend` y `animationend`
disparándose, así que cualquier lógica que los espere sigue funcionando. Poner
`0` los mata en algunos navegadores y deja código colgado.

`animation-iteration-count: 1` corta los bucles infinitos —como el del spinner—
en vez de dejarlos girando a velocidad imperceptible.

## Qué se mueve

| Elemento | Movimiento |
|---|---|
| `app-spinner` | Rotación continua |
| `app-skeleton` | Pulso o barrido |
| `app-progress` | Avance de la barra |
| `app-dialog` | Aparición, la del `<dialog>` nativo |
| `app-side-nav` en modo cajón | Deslizamiento |
| `app-toast` | Entrada y salida |
| `app-tooltip` | Aparición tras `TOOLTIP_HOVER_DELAY_MS` |
| Estados de foco, hover y activo | Transiciones cortas |

Y nada más. **No hay animaciones de transición entre rutas**, ni movimiento
decorativo, ni desplazamiento con paralaje.

## Tokens de movimiento

Existen y son **una sola escala**, en `src/styles.css` (espejo Flutter: `MantraMotion`):

| Token | Valor | Para qué |
|---|---|---|
| `--dur-fast` | 120 ms | eco de un clic: hover, foco, color de un control |
| `--dur-base` | 200 ms | un cambio de estado que la vista tiene que seguir |
| `--dur-slow` | 320 ms | algo que entra o sale de la pantalla (cajón) |
| `--ease-standard` | `cubic-bezier(0.2, 0, 0.2, 1)` | entradas y salidas normales |
| `--ease-out` | `cubic-bezier(0, 0, 0.2, 1)` | algo que aparece y se posa |
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | sólo para confirmar un gesto, nunca para datos |

Normalizado el 2026-09-18 (refactor UX, fase 07): las 93 transiciones de
`src/app/**` que escribían `0.15s ease`, `0.2s ease`, `120ms ease`… pasaron a
`var(--dur-fast|base) var(--ease-standard)`, y los `--mov-*` del marco ALOVIDA
(`styles/alovida.css`, que eran 110/190/320 ms) son ahora **alias** de
`--dur-*`. Una transición nueva usa estos tokens; un literal nuevo es deuda.

El detalle de la migración y la matriz de transiciones del piloto están en
`docs/refactor-profesional/trabajo/MATRIZ_MOVIMIENTO.md`.

## El retardo del tooltip

```ts
export const TOOLTIP_HOVER_DELAY_MS = …;
```

Es la única constante de tiempo **exportada y tipada** del sistema, y por una
razón: un tooltip que aparece al instante convierte cualquier paseo del ratón por
la interfaz en una sucesión de globos.

Que esté exportada permite que la prueba del tooltip la use en vez de repetir el
número.

## Reglas al animar algo nuevo

1. **Solo `transform` y `opacity`.** Animar `width`, `height`, `top` o `margin`
   fuerza recálculo de layout en cada cuadro.
2. **Nada por encima de ~320 ms.** Una interfaz que se hace esperar se siente
   lenta aunque sea rápida.
3. **Nada esencial detrás de una animación.** Con `prefers-reduced-motion` la
   duración baja a 0,01 ms: si el contenido *aparece* por la animación, con la
   preferencia activa aparece de golpe — y eso está bien, pero tiene que
   aparecer.
4. **Los bucles infinitos solo para carga.** Y siempre con
   `animation-iteration-count` cortable, que la regla global ya cubre.
5. **Nada de movimiento en el contenido clínico.** Un valor que se desliza al
   actualizarse es un valor que se lee mal.

## Verificación

| Comprobación | Estado |
|---|---|
| La regla global existe | ✅ verificable en `styles.css` |
| Cada componente la respeta | ✅ por construcción: la regla es global y con `!important` |
| Prueba automatizada de movimiento reducido | **No existe** |
| Regresión visual con la preferencia activa | **No existe** |

Cómo comprobarlo a mano:

```text
macOS    Preferencias del Sistema › Accesibilidad › Pantalla › Reducir movimiento
Windows  Configuración › Accesibilidad › Efectos visuales › Efectos de animación
DevTools Rendering › Emulate CSS media feature prefers-reduced-motion
```

Con la preferencia activa, la vitrina (`/design-system`) debe verse **completa y
estática**: nada debe quedar invisible por depender de una animación para
aparecer.
