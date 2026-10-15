# REPORT — Carril 33 · CORR-03

## Veredicto: FAIL

### Seguimiento 2026-10-15 — tabla de vinculaciones en 375 px

Este seguimiento añade ajuste responsive en la pestaña «Mis vinculaciones»: Organización, Estado y Acciones siguen como columnas principales; Rol/cargo y Desde se pliegan al detalle móvil del organismo `app-data-table`. Los nombres y el texto del estado pueden partir línea, los encabezados se permiten envolver y Acciones queda fija al borde final si la tabla desborda.

**La captura actual queda pendiente.** El `PASS` de 375 px en la matriz siguiente corresponde a la pasada anterior del 2026-10-13; no verifica este cambio. No se ejecutó Playwright ni se atribuye un PASS visual a este seguimiento. Las pruebas de componente sólo confirman configuración, contenido y presencia de la acción.

Verificaciones de este seguimiento:

- `corepack yarn test --watch=false --include='src/app/features/admin/medical-organization/memberships-tab/memberships-tab.spec.ts'` → 1 archivo, 10 pruebas PASS.
- `corepack yarn typecheck` → PASS.
- `corepack yarn eslint src/app/features/admin/medical-organization/memberships-tab/memberships-tab.ts src/app/features/admin/medical-organization/memberships-tab/memberships-tab.html src/app/features/admin/medical-organization/memberships-tab/memberships-tab.spec.ts` → PASS.
- No se ejecutaron Playwright, suite completa ni build en este seguimiento.

La transferencia a la pestaña «Mis vinculaciones», el formulario de solicitud, la tabla y el estado vacío funcionan. Las nueve capturas claras pasan las mediciones. Las tres capturas oscuras fallan porque el fondo global conserva la superficie clara; ese defecto transversal corresponde a CORR-34 y requiere recapturar este carril después de corregirlo.

## Rutas

| Ruta | 375 | 768 | 1440 | oscuro | fondo | centrado | ancho | scroll | consola |
|---|---|---|---|---|---|---|---|---|---|
| `/my-organizations` → `/administration/medical-organization?tab=memberships` | PASS | PASS | PASS | FAIL | 9/9 claro | PASS | ≥85 % | PASS | 0 errores |
| `/administration/medical-organization?tab=memberships` | PASS | PASS | PASS | FAIL | 9/9 claro | PASS | ≥85 % | PASS | 0 errores |
| `/administration/medical-organization?tab=memberships&empty=1` | PASS | PASS | PASS | FAIL | 9/9 claro | PASS | ≥85 % | PASS | 0 errores |

La matriz Playwright registra 12 celdas: 9 claras pasan todos los criterios y 3 oscuras fallan solo en la superficie de fondo. En móviles se guarda la página completa para que la foto muestre la tabla, manteniendo el ancho de viewport medido; a 1440 px se encuadra la fila de la tabla.

## Fotos (rutas relativas)

- Línea base: `fotos/antes/mis-organizaciones-redirige-{375,768,1440}-claro.png`, `fotos/antes/mis-organizaciones-redirige-1440-oscuro.png`, `fotos/antes/vinculaciones-en-el-panel-{375,768,1440}-claro.png`, `fotos/antes/vinculaciones-en-el-panel-1440-oscuro.png`.
- Después: `fotos/despues/redirige-a-organizacion-medica-{375,768,1440}-claro.png`, `fotos/despues/redirige-a-organizacion-medica-1440-oscuro.png`, `fotos/despues/vinculaciones-tabla-{375,768,1440}-claro.png`, `fotos/despues/vinculaciones-tabla-1440-oscuro.png`, `fotos/despues/vinculaciones-vacio-{375,768,1440}-claro.png`, `fotos/despues/vinculaciones-vacio-1440-oscuro.png`.

## Comandos y salida (literal, recortada)

- `corepack yarn typecheck` — PASS.
- ESLint dirigido a los archivos modificados — PASS.
- `corepack yarn test --watch=false --include=...` (tabs, medical-organization y navegación) — PASS, 12 archivos y 211 pruebas.
- `corepack yarn build` — PASS.
- `node scripts/check-route-prefixes.mjs` — PASS, 269 rutas.
- `E2E_BASE_URL=http://localhost:4200 CORR_USUARIO=medica scripts/corr-evidencia.sh 33` — 9 celdas claras PASS; 3 celdas oscuras FAIL por el fondo global. No hubo errores de consola ni respuestas 5xx.
- `corepack yarn test --watch=false` — 10,639 pruebas pasan y 71 fallan en 6 archivos; no se modificaron esas suites ni se debilitaron aserciones.
- `corepack yarn pw playwright/carril-19-route-health.spec.ts --workers=1` — FAIL antes del barrido: `http://localhost:3005/health` no respondió; 3 roles no corrieron.
- `corepack yarn lint` — FAIL por 268 errores en archivos ajenos a este carril; ESLint dirigido a los archivos tocados pasa.

## Bugs encontrados / corregidos

- `/my-organizations` redirigía al panel de organización sin seleccionar el destino de vinculaciones. Ahora conserva el query `tab=memberships`.
- La tabla de vinculaciones se integró como pestaña del módulo de organización. Presenta organización, rol/cargo, fecha, estado con badge y acción según el estado; las solicitudes siguen usando los clientes existentes.
- En móvil, la selección directa de la última pestaña podía dejar su etiqueta fuera de la franja visible. Se ajustó el desplazamiento de `app-tabs` y se añadió una aserción de scroll.
- En el seguimiento del 2026-10-15, `app-data-table` activa `fitContainer` y `wrapHeaders`; Organización, Estado y Acciones mantienen prioridad móvil 1, y Acciones usa `sticky: 'end'`. El spec confirma que el nombre largo, el estado pendiente y el botón accesible siguen en la tabla. Falta la captura de 375 px para comprobar el layout en navegador.
- Dos expectativas de navegación estaban desactualizadas respecto de la sección de ayuda psicológica que ya está declarada; se actualizaron conservando y añadiendo comprobaciones.
- El fondo oscuro global permanece como hallazgo de CORR-34; no se escondió ni se declara resuelto en este carril.

## Riesgos residuales

- Bloqueo visual compartido de CORR-34: hace fallar el tema oscuro en las tres rutas.
- La celda 375 px de «Mis vinculaciones» es evidencia histórica del 2026-10-13; no cubre el ajuste responsive de este seguimiento. Repetir la captura con el servidor disponible antes de confirmar lectura completa sin recorte horizontal.
- La suite completa presenta 71 fallos; sin una corrida basal equivalente no se atribuyen al cambio ni se declaran preexistentes.
- La prueba de salud de rutas requiere la API en `localhost:3005`; el barrido quedó sin ejecutar por falta de ese servicio.

## Decisiones

- Se conserva el criterio de la instrucción del 2026-09-20 C-01/C-02: no se vuelven a añadir enlaces sueltos a Mi perfil; la pestaña se encuentra desde Tus accesos y desde el alias histórico.
- No se crea claim de regresión ni se declara el carril cerrado mientras queden fotos rojas y regresiones integrales pendientes.
