# Movimiento

Físico y con motivo: lo que se abre, se arrastra o cambia de lugar llega con
inercia, y una regla global lo apaga cuando corresponde.

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

Desde el Carril F (2026-10-12) también: la **transición entre rutas** (View
Transitions, ver abajo), los overlays (`app-select`, `app-tree-select`,
`app-menu`, `app-date-picker`, `app-dialog`) con muelle desde el control que los
abre, el botón con carga y éxito, y interruptor, casilla y radio.
**No hay** movimiento decorativo ni paralaje.

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

### Muelles

Para lo que **se abre, se arrastra o cambia de lugar**. Son curvas `linear()` de un
muelle amortiguado real (x″ + 2ζω·x′ + ω²·x = 0), muestreadas con
los puntos en `styles.css`. Cada curva trae su duración:
**se usan siempre en pareja** — un muelle estirado deja de ser ese muelle.

| Token | ζ | Duración (`-dur`) | Rebote | Para qué |
|---|---:|---:|---|---|
| `--spring-rapido` | 1,00 | 260 ms | ninguno | menús, chips, interruptores, casillas |
| `--spring-suave` | 0,85 | 380 ms | 0,6 % | diálogos, hojas, popovers |
| `--spring-rebote` | 0,60 | 460 ms | 9 % | sólo confirmar (el check del botón); nunca datos |

```css
transition: transform var(--spring-suave-dur) var(--spring-suave),
            opacity var(--dur-base) var(--ease-out);
```

Sin soporte de `linear()` los tres caen a un `cubic-bezier` (bloque
`@supports not` al final de `styles.css`). Son el equivalente web de `MantraMotion`
en la app móvil: **mismos nombres y mismos ζ/duración**; al alinear, se copian estos
valores, no se reinterpretan.

### Materiales

Barra superior, menús y diálogos son **vidrio sobre el contenido**. Tres grosores,
clases `.material-fino|regular|grueso` (tinte por tema + desenfoque + trazo fino):

| Clase | Tinte claro / oscuro | Desenfoque | Para |
|---|---|---|---|
| `.material-fino` | blanco 62 % / petróleo-800 62 % | 10 px, saturación 1,5 | barra superior |
| `.material-regular` | 78 % | 22 px, 1,7 | menús, popovers |
| `.material-grueso` | 90 % | 34 px, 1,8 | diálogos |

Sin `backdrop-filter`, o con `prefers-reduced-transparency`, el fondo es
`--material-respaldo` (opaco). **El texto nunca depende del desenfoque**: el contraste
se mide sobre el respaldo.

### Barra superior

Cambia al desplazarse, **sólo con CSS** (`shell-layout.css`): una animación atada al
scroll de la página (`animation-timeline: scroll(root block)`, rango 0–48 px) lleva la
barra de la franja plana al material `fino`. Medido en navegador: a 0 px fondo opaco y
sin trazo; a 24 px, tinte 81 % y desenfoque 5 px; a 384 px, tinte 62 %, desenfoque 10 px
y trazo fino. Firefox, que aún no tiene la API, ve la barra siempre en vidrio. Sin
`backdrop-filter` o con `prefers-reduced-transparency`, respaldo opaco.

### Paneles que nacen del control

`app-dialog`, `app-content-dialog`, `app-select`, `app-tree-select` y `app-date-picker`
llevan `.panel-muelle` en su panel: muelle `suave` desde `--origen-x/y` (el centro del
control que los abrió; `shared/motion/panel-motion.ts`) y una salida de 140 ms hacia el
mismo origen. Sin animación posible (jsdom, movimiento reducido) cierran en el acto.
`app-menu` usa el muelle `rápido`, crece desde el borde del disparador y es material
`regular`.

### Componentes con muelle (medido en navegador, 2026-10-12)

| Pieza | Qué hace | Medido |
|---|---|---|
| `button[app-button]` | Se hunde a `scale(0.97)` al presionar; vuelve con el muelle `rápido`. Con `isSuccess` la etiqueta se transforma en un check que se dibuja (`rebote`) | `matrix(0.97…)` presionado; check a escala 1,048 a 120 ms |
| `app-switch` | La perilla viaja con el muelle `rápido` (260 ms) y se estira al presionar | 5,1 px de 16 a 70 ms |
| `app-checkbox`, `app-radio` | El tilde se dibuja y el punto nace con el muelle `rápido`; la caja se hunde al presionar | — |
| `app-form-field` (error) | Entra creciendo desde alto 0 con el muelle `suave` (`interpolate-size`); no salta | 0 → 10,7 → 16,3 → 17 px (0 / 80 / 160 / 380 ms) |

El esqueleto (`app-skeleton`) ya traía el barrido de brillo y el vacío (`app-empty-state`)
ya traía su ilustración lineal con entrada propia: no se tocaron.

### Transición entre rutas

View Transitions API (`withViewTransitions` del router) con respaldo: sin la API, o con
`prefers-reduced-motion`, la ruta cambia sin animación. Es un fundido corto de
`--dur-base`; nunca desplazamiento del contenido clínico.

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
2. **Nada por encima de ~320 ms**, salvo los muelles `suave` (380) y `rebote` (460),
   cuya duración ES la curva. Una interfaz que se hace esperar se siente lenta
   aunque sea rápida.
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
