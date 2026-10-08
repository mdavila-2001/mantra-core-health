# ALOVIDA Pulse — auditoría, dirección, plan y evidencia

Rama `pablo/alovida-pulse-2026-10-08` (sobre `origin/dev` `4807572a`).
Guía reutilizable para módulos futuros: [`docs/design-system/pulse.md`](../design-system/pulse.md).

> Estado: **fase 1 (tres pilotos) implementada y verificada en navegador.**
> Las fases 2 y 3 son plan, no código. Ver §6 y §8 para lo que **no** se hizo.

---

## 1. Auditoría del estado actual

Hecha sobre el código y sobre las pantallas renderizadas (demo con backend
simulado, cuenta `medica@alovida.mock`, 1440 px, claro y oscuro).

### Lo que ya está bien (y se conserva)

- **Tokens disciplinados**: rampas 50–900, tema claro/oscuro por roles, escala
  de movimiento de tres duraciones y tres curvas, anillo de foco sólido que
  pasa 3:1. No hay nada que reemplazar.
- **Estados con doble canal** (color + palabra/forma): la leyenda de la cinta
  repite cada tono en texto; los sellos de estado llevan icono.
- **Interacciones ya resueltas** en piezas maduras: el árbol de accesos se
  levanta al apuntar, la cita «Ahora» tiene tarjeta entera clicable, los
  botones tienen `:hover` y `:active`.
- **Infraestructura de movimiento propia**: `appStaggerList`,
  `appRevealOnScroll`, `pointer-scene`, tokens tipados en `motion-tokens.ts`,
  regla global de movimiento reducido.
- **Contrato de estados M34** (`ViewState<T>`): cargando, vacío, error, parcial
  tienen forma propia.

### Dónde se queda corta la plataforma

| # | Hallazgo | Evidencia |
|---|---|---|
| A1 | **Plana en profundidad**: todo lo que no es la franja «Hoy» comparte la misma sombra o ninguna; al apuntar, lo pulsable responde distinto según el módulo (el árbol de accesos se levanta; la cita de la agenda sólo cambia de sombra; el chat sólo cambia de fondo). | `access-tree.css` vs `day-view.css` vs `conversation-list.css` |
| A2 | **Sin «vivo»**: lo que ocurre ahora (cita en curso, mensaje nuevo, sin leer) se distingue por color estático. Un tablero clínico es el lugar donde el tiempo real importa y no se nota. | capturas «antes» |
| A3 | **La cinta de la jornada dice «cuánto» pero no «cuándo»**: sólo tiene la hora de los extremos; hay que restar para saber qué hora es en la tira. | `dashboard-1440-claro.png` (antes) |
| A4 | **Bucle infinito del reloj** (`cinta-pulso … infinite`) contradice `motion.md` §4 (bucles sólo para carga). | `agenda-de-hoy.css` |
| A5 | **Estados vacíos sin carácter** (mensajería: icono gris sobre beige). | `mensajeria-1440-claro.png` (antes) |
| A6 | **Cada módulo inventa su curva y su duración de «llegada»**: `ease-out` genérico, `0.46s`, `var(--dur-base)`. | `alovida.css` `.entrando`, `access-tree.css`, `stagger-list` |
| A7 | **Sin continuidad entre rutas** (decisión consciente de `motion.md`). | — |
| A8 | **Falta prueba automatizada de movimiento reducido** (lo dice la propia doc). | `motion.md` § Verificación |

### Lo que NO es un problema (y no se toca)

Color, tipografía, radio de firma, estructura de formularios y pestañas (reglas
`alovida-ui`), contratos, autenticación y permisos.

---

## 2. Dirección artística: ALOVIDA Pulse

**Idea:** el logotipo es una línea de pulso. Pulse la vuelve sistema:
**lo que está vivo late, lo que se toca responde, y nada más se mueve.**

No es una paleta nueva ni una capa de adornos: es una disciplina de tres
mecanismos (latido, elevación, momento) aplicada sobre los tokens existentes.
Por qué así y no «más vibrante» a base de color o gradientes:

- Software médico: la confianza viene de la **previsibilidad** (impeccable
  *Operate*: «el movimiento comunica estado, no decoración»). Un gradiente
  vibrante no aporta información; un anillo que late sobre la cita *en curso*, sí.
- La identidad ya limita el ámbar a un punto por pantalla. Pulse respeta eso: el
  latido de la cita en curso **es** ese punto.
- «Vibrante» se consigue con **respuesta**: 120 ms al pulsar, 200 ms al apuntar,
  y un único momento de 480 ms por pantalla. Es lo que hace que una interfaz se
  sienta viva sin ruido.

### Sistema de movimiento

Ver tabla completa en [`pulse.md`](../design-system/pulse.md). Resumen:

| | Duración | Curva | Disparador |
|---|---|---|---|
| Respuesta al dedo | 120 ms (`--dur-fast`) | `--ease-standard` | `:active` |
| Elevación | 200 ms (`--dur-base`) | `--pulse-ease` | `:hover` (puntero fino) |
| Llegada | 320 ms (`--dur-slow`) | `--pulse-ease` | un dato nuevo con la pantalla lista |
| Latido | 1,6 s × 3 | `--pulse-ease` | un estado real |
| Momento | 480 ms (`--pulse-dur-moment`) | `--pulse-ease` | una vez por pantalla |

### Modificaciones propuestas a `motion.md`

`motion.md` se actualizó en esta rama (sección «Excepciones documentadas de
Pulse»). Ninguna regla se borra; se añaden dos excepciones **acotadas**:

1. **Regla 2 («nada por encima de ~320 ms»)** → excepción: *un* momento por
   pantalla, ≤ 480 ms, sobre una región **no clínica**.
2. **Regla 4 («bucles infinitos sólo para carga»)** → se mantiene. El latido de
   estado **no** es bucle: son tres repeticiones y se posa. (El bucle infinito
   previo del reloj de la cinta, hallazgo A4, **no se tocó**: queda como deuda
   decidida por el propietario del módulo.)

**Sin modificar:** regla 1 (sólo `transform`/`opacity`; Pulse añade `clip-path` y
`box-shadow`, que no disparan layout) y regla 5 (nada de movimiento en contenido
clínico).

---

## 3. Plan por fases y archivos

### Fase 1 — tres pilotos ✅ (esta rama)

| Archivo | Cambio |
|---|---|
| `src/styles/pulse.css` *(nuevo)* | tokens `--pulse-*`, keyframes `pulse-ring/draw/arrive`, utilidades `.pulse-live/lift/press/arrive`, bloque de movimiento reducido |
| `angular.json` | registra `pulse.css` en `styles` |
| `dashboard/agenda-de-hoy/agenda-de-hoy.{css,html,ts}` | cinta que se descubre (momento), muescas horarias, etiqueta de hora actual, latido de la cita en curso y de su punto de leyenda, elevación de la tarjeta «ahora», lista en cascada |
| `agenda/my-agenda/day-view/day-view.{css,html,ts}` | elevación/hundimiento de la cita, latido de la cita en curso (`data-en-curso`), cascada |
| `messaging/thread/thread.{ts,html}` | señal `llegadas` + `marcarLlegadas()`: sólo la burbuja **ajena** que llega con el hilo abierto entra con `pulse-arrive` |
| `messaging/thread/composer/composer.css` | hundimiento 92 % al pulsar enviar / icono |
| `messaging/conversation-list/conversation-list.css` | latido del contador sin leer, `:active` de la fila |
| `messaging/messaging.{html,css}` | estado vacío con el trazo del logotipo dibujado una vez |
| `docs/design-system/pulse.md`, `docs/design-system/motion.md` | guía y excepciones |

### Fase 2 — propuesta (no implementada)

Orden sugerido, de menor a mayor riesgo, todo con la receta de `pulse.md` §5:

1. `app-card` interactivo y `app-button` → `.pulse-lift` / `.pulse-press` como
   primitiva (hoy cada módulo lo reescribe: hallazgo A1/A6).
2. Notificaciones: latido al llegar (el `notifications.store` ya expone señales).
3. Agenda semana/mes: cita en curso con latido; transición Día↔Semana↔Mes
   con View Transitions si se decide levantar la regla de «sin transición entre
   rutas» (requiere decisión explícita).
4. Esqueletos: unificar el barrido (`skeleton.css`) con `--pulse-ease`.

### Fase 3 — propuesta (no implementada)

- Prueba automatizada de movimiento reducido (hallazgo A8).
- Ilustraciones funcionales de estados vacíos con el trazo del logotipo.
- Decidir (con el propietario) el bucle infinito del reloj de la cinta (A4).

---

## 4. Decisiones y su porqué

| Decisión | Razón |
|---|---|
| Latido de **3 repeticiones**, no bucle | `motion.md` §4; un bucle sobre una pantalla que se queda abierta toda la jornada es ruido |
| Anillo en `::after`, no `box-shadow` del elemento | un `box-shadow` animado pisa la franja `inset` de «en curso» durante la animación |
| Elevación sólo con `(hover: hover) and (pointer: fine)` | en táctil el hover queda pegado tras el toque |
| Historial del chat **no anima**; sólo lo que llega después | animar 50 burbujas al abrir es una cortina; lo que llega en vivo es lo que hay que notar |
| Burbujas **propias** no animan | su clave pasa de temporal a definitiva al confirmarse y se reanimarían dos veces; el envío ya se siente inmediato (se pinta antes del acuse) |
| Etiqueta de hora actual en 24 h con `date` | `horaCorta` devolvía «02:56 p. m.» y la escala usa 24 h: inconsistente (se detectó en la verificación) |
| `margin-block-start` de la cinta 24 → 32 px | la etiqueta sobresale; estaba a 0 px del botón de cabecera |
| No se tocó el árbol de accesos | su elevación ya cumple la receta; cambiarlo sería churn |
| Los números **no** se animan (conteo ascendente, etc.) | contenido clínico/operativo: regla 5 |

---

## 5. Evidencia visual

Capturas en `docs/pulse/evidencia/` (`antes/` y `despues/`, 1440 px).

| Pantalla | Antes | Después |
|---|---|---|
| Dashboard | `antes/dashboard-1440-claro.png` | `despues/dashboard-1440-claro.png` — muescas horarias, etiqueta «HH:mm» sobre el reloj, más aire sobre la cinta |
| Agenda (Día) | `antes/agenda-1440-claro.png` | `despues/agenda-1440-claro-hover.png` — segunda cita levantada con sombra tintada |
| Mensajería | `antes/mensajeria-1440-claro.png` | `despues/mensajeria-1440-claro.png` — trazo del logotipo en el estado vacío |

**Honestidad sobre las capturas:** Pulse es sobre todo movimiento y respuesta; una
captura fija no lo muestra. Para eso se midió el comportamiento real en el
navegador (§7).

---

## 6. Lo que no se hizo / límites

- **Viewports medidos:** 1440 claro y oscuro (dashboard), 1440 claro (agenda y
  mensajería), **390** claro en los tres. **No** se midió 768 ni el modo oscuro
  de agenda y mensajería (comparten tokens; no se verificó a ojo).
- **Llegada de mensaje en vivo en navegador:** el simulador no empuja mensajes
  por socket; se verificó con prueba unitaria (§7), no a ojo.
- **No se corrió la suite completa** (`yarn test`, ~5.000 pruebas) **ni
  `yarn pw`** (Playwright contra la API real): el equipo estuvo a load 200+
  durante la sesión. Sí se corrieron las 195 pruebas (12 archivos, incluye `thread.spec.ts`) de los tres módulos
  tocados, `tsc` y `eslint` (§7). **Tampoco se corrió `ng build` de
  producción**: los presupuestos de estilos por componente (`anyComponentStyle`,
  aviso 4 kB / error 12 kB) no se midieron; la adición fue de ~1,5 kB sobre
  `agenda-de-hoy.css`, que ya era el mayor.
- **Detector de impeccable:** 3 avisos `side-tab`, **preexistentes** (borde
  lateral de 4 px que codifica el estado de la cita en `day-view.css`; cita
  citada en `composer.css`). No se tocaron: son decisión de identidad vigente.
- **PRODUCT.md / DESIGN.md** de impeccable no existen: se trabajó sobre el
  sistema incumbente. Conviene `/impeccable init` después.
- Ningún contrato de API, autenticación, permisos ni flujo clínico se tocó.
- **Cierre del PR:** la rama está commiteada localmente; **no se empujó ni se
  abrió PR**. El merge a `dev` exige revisión humana (`CLAUDE.md`).

---

## 7. Verificación

Ver el estado final en la descripción del PR. Resultados medidos en navegador
(`localhost:4310`, configuración `demo`):

| Comprobación | Resultado |
|---|---|
| `pulse.css` cargado | ✅ keyframe `pulse-ring` presente en las hojas |
| Cinta: barrido | ✅ `clip-path` 0 → 62 % → 89 % → 98 % → 100 % en ~480 ms, exponencial |
| Cita en curso (dashboard) | ✅ `pulse-ring` activo sobre `.ahora--en-curso::after` y sobre el punto de leyenda |
| Cita en curso (agenda) | ✅ `data-en-curso` y `pulse-ring` activos |
| Elevación en hover (agenda) | ✅ `transform: translateY(-2px)` + sombra `--pulse-lift` |
| Etiqueta del reloj | ✅ «14:58», 24 h, sin solape con el botón (8 px) |
| Chat: historial al abrir | ✅ 5 burbujas, 0 con `pulse-arrive`, 0 animaciones |
| Chat: enviar | ✅ 5 → 6 burbujas, la propia no se anima, sin doble entrada |
| Chat: contador sin leer | ✅ `pulse-ring` activo |
| Movimiento reducido (emulado) | ✅ 0 animaciones activas; `clip-path: none`; lista y tarjeta visibles al 100 % |
| 390 px · dashboard / agenda / mensajería | ✅ sin scroll horizontal (`scrollWidth` = `clientWidth` = 375); etiqueta del reloj dentro de la franja |
| Consola | ✅ 0 errores (1 aviso preexistente) |
| Prueba unitaria `Pulse: el historial no anima…` | ✅ historial 0 llegadas → ajena entra con `pulse-arrive` → propia no |
| `thread.spec.ts` | ✅ 42/42 |
| Specs de `dashboard/`, `day-view/` y `messaging/` | ✅ 12 archivos, 195/195 |
| `tsc -p tsconfig.app.json --noEmit` | ✅ sin errores |
| `eslint` sobre los archivos tocados | ✅ sin hallazgos |
