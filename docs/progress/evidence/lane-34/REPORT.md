# REPORT — Carril 34 · CORR-04

## Veredicto: VERIFIED para la auditoría visual sobre la maqueta del 2026-10-22; la regresión de rutas con datos reales queda fuera de esta rama

La auditoría se repitió sobre `mockup` en `7135f1e56`, con el build SSR de producción: **492/492 celdas**,
cero celdas rojas y cero errores de consola en los tres actores. La corrida anterior (464/464, 13 de
octubre) medía una maqueta 258 commits más vieja.

La regresión unitaria no suma rojos atribuibles a este cambio. El barrido route-health no se corrió en
esta rama: comprueba cada ruta con los datos reales de cada rol, y `mockup` trabaja sólo con el
simulador. Ver «Cierre del 2026-10-25».

## Qué cambió en esta pasada

1. **Inventario por rol en checkouts con CRLF.** `scripts/corr-rutas.mjs` separaba las entradas de
   `navigation.map.ts` con una expresión que espera `\n`. En un checkout con fin de línea CRLF no
   encontraba ninguna entrada, así que el filtro de roles caía en el catálogo genérico y le asignaba
   a la médica 64 rutas (todo el portal de farmacia, aseguradora y laboratorio) en lugar de 36. El
   generador ahora normaliza el fin de línea al leer. Con LF y con CRLF da lo mismo: inventario 90;
   médica 36; paciente 35; administración 52.
2. **`/my-account/identity` conserva la superficie oscura en tema oscuro.** Una regla de
   `src/styles/alovida.css` forzaba el tema claro en esa vista (`body:has(app-identity-hub)`), y era la
   única ruta de la aplicación con el contenido blanco junto al armazón oscuro. Se retiró para cumplir
   la decisión del propietario del 2026-10-05 que rige este carril: fondo blanco en tema claro y
   superficie oscura equivalente en tema oscuro, que es la paleta normativa de
   `SALUD/Arquitectura/identidad-visual.md`. La captura en oscuro se revisó a mano: texto, radios y
   zona de carga mantienen el contraste.

3. **Rutas de las fotos en la matriz.** El auditor escribía la columna «Foto» quitando el prefijo con
   `/`, y en Windows la ruta se arma con `\`: la matriz quedaba con la ruta absoluta de la máquina que
   la generó. Ahora usa `path.relative` y escribe la ruta con `/`.

## Inventario y cobertura

| Actor | Rutas | Celdas | Celdas rojas | Matriz |
|---|---:|---:|---:|---|
| Médica (`PRACTITIONER`/`CLINICIAN`) | 36 | 144 | 0 | [MATRIZ-visual.md](MATRIZ-visual.md) |
| Paciente (`PATIENT`) | 35 | 140 | 0 | [paciente/MATRIZ-visual.md](paciente/MATRIZ-visual.md) |
| Administración (`SECURITY_ADMIN`) | 52 | 208 | 0 | [administrador/MATRIZ-visual.md](administrador/MATRIZ-visual.md) |

Rutas nuevas desde la corrida anterior, todas declaradas en el mapa de navegación vigente:
`/administration/medical-organization` (médica y administración), `/psychological-help` (paciente),
`/administration/clinical-forms`, `/administration/geolocation`, `/administration/medical-laboratory` y
`/administration/services-catalog` (administración).

Cada celda mide una ruta a 375, 768 o 1440 px en claro, o a 1440 px en oscuro: fondo blanco en claro,
superficie oscura conservada en oscuro, centrado con diferencia de 2 px como máximo, ancho mínimo de
85 % donde aplica, sin scroll horizontal y consola limpia. Las fotos de `fotos/despues/` se
regeneraron completas en esta corrida; la línea base de `fotos/antes/` no se tocó.

## Comandos y salida

- `node scripts/corr-rutas.mjs` → inventario 90; médica 36; paciente 35; administración 52.
- `scripts/corr-evidencia.sh 34` por actor (`CORR_USUARIO=medica|paciente|administrador`) → PASS:
  144/144, 140/140, 208/208.
- `corepack yarn typecheck` → PASS.
- `corepack yarn build` → PASS, con los avisos existentes de CommonJS.
- `corepack yarn eslint scripts/corr-rutas.mjs` → PASS.
- `node scripts/check-contrast.mjs` y `node scripts/check-route-prefixes.mjs` → PASS.
- `node scripts/check-tokens.mjs`, `check-css-tokens.mjs` y `check-architecture.mjs` → FAIL, con salida
  idéntica en `mockup` sin este cambio: rojos previos.
- `corepack yarn test --watch=false` → 77 pruebas en rojo sobre 11 011; sobre `mockup` sin este cambio,
  75. Las que difieren entre las dos corridas son pruebas de PDF, temporizadores y estado compartido
  (`clinical.handlers`, `lab-orden-entrante`, `representacion-grafica`, `pdf-logo`,
  `insurance-analytics.handlers`, `practitioner-detail`) que fallan en una corrida o en la otra. Las
  cuatro que sólo fallaron en esta rama pasan aisladas (43/43). Ninguna toca el CSS ni el generador.
- `corepack yarn lint` → rojo previo en todo el repositorio; el archivo JS tocado pasa ESLint.
- `playwright/carril-19-route-health.spec.ts` → no corrido en esta rama (ver «Cierre del 2026-10-25»).

## Riesgos residuales

- Las fotos se tomaron sobre `7135f1e56`. Después entró #1165, que cambia el CSS de los directorios
  (`directory-page`, `filter-bar`, `result-card`); las seis rutas de directorios no se volvieron a
  medir sobre ese cambio.
- El carril 36 verifica `/my-account/identity` con su propio criterio de fondo blanco también en
  oscuro; con este cambio esa medición del carril 36 deja de pasar y tiene que alinearse a la
  decisión del 2026-10-05.
- La suite completa, el lint global y los chequeos de tokens y arquitectura siguen en rojo por causas
  previas a este carril.

## Cierre del 2026-10-25

| Requisito | Estado | Con qué queda cubierto |
|---|---|---|
| REQ-34-001 · auditoría inicial completa | CUMPLE | `MATRIZ-visual-antes.md` de cada actor y `fotos/antes/` |
| REQ-34-002 · blanco puro en claro, superficie oscura en oscuro | CUMPLE | La matriz mide las dos reglas en cada celda; `/my-account/identity` conserva el oscuro |
| REQ-34-003 · cada pantalla en rojo pasa en 3 anchos | CUMPLE | 492/492 celdas en verde a 375, 768 y 1440 px |
| REQ-34-004 · auditoría final y regresión | CUMPLE | Auditoría final y regresión de rutas con datos reales de los tres roles y sin sesión, en `dev`. Ver abajo |

**Regresión de rutas.** `carril-19-route-health.spec.ts` comprueba que cada ruta responde con los
datos reales de cada rol: entra con cuentas verdaderas y lee lo que devuelve el servicio de datos.
`mockup` no tiene ese servicio —todo lo contesta el simulador—, así que el barrido se corrió el
2026-10-25 sobre `dev`, con datos reales:

- **Administración:** 171 aperturas; 140 `ok`, 4 `denegada` (el guard rechaza lo que el rol no
  alcanza), 11 `no navega` (portal de farmacia y directorios, que llevan a otra pantalla) y 16
  `error de consola`, todos respuestas del servicio a una cuenta que no es médica, aseguradora ni
  farmacia, o transiciones de vista interrumpidas. Ninguno es de fondo, ancho ni tema.
- **Vistas sin sesión:** 126 aperturas; 19 `ok`. Las 90 `no navega` son el catálogo del barrido, que
  abría las direcciones en castellano y la aplicación las llevaba a su nombre en inglés (el catálogo ya se regeneró con las rutas en inglés); las 17
  `error de consola` son transiciones de vista interrumpidas.
- **Médica y paciente** (2026-10-26, con cuentas de prueba creadas por el servicio): 176 aperturas por rol. Médica: 89 `ok`, 36 `denegada`, 14 `no navega` y 37 `error de consola`. Paciente: 71, 52, 13 y 40.
  - Al volver a medir una por una las rutas marcadas, con la red quieta, desaparecen las transiciones de vista interrumpidas, y los «no navega» resultan ser guards que llevan a `/dashboard` o `/my-account`: pantallas que dependen del tipo de cuenta o de organización y que el menú de ese rol no ofrece.
  - Lo que queda es del servicio: `/my-account/spending` (paciente) pide un recurso que el servicio no expone (404) y la pantalla igual se dibuja; `/my-account/access-requests` (médica) responde 403 por rol.
  - Ningún rojo es del front.

La misma auditoría, con el auditor corregido para checkouts de Windows, se repitió en `dev` y `test`,
cada una con su propia matriz.
