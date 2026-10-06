# REPORT — Carril 34 · CORR-04

## Veredicto: FAIL

Todas las mediciones visuales aplicables pasan en las 460 celdas cargadas y revisadas. El ancho de las altas públicas en oscuro queda como «no aplica» para conservar la escena oscura de dos columnas. El auditor conserva 20 fallas de consola por rol: la política CSP bloquea dos scripts inline en cinco altas públicas. La ficha exige consola sin errores, por eso el carril no queda cerrado.

La auditoría se corrió en `justin/mockup-corr-34-cierre-global-20261005`, basada en `mockup` (`525859e9`). El propietario confirmó fondo blanco sólo en claro, conservar superficies oscuras, cubrir médica y paciente, y auditar administración con la cuenta disponible.

## Inventario y cobertura

El generador produce 81 vistas auditables desde el mapa de navegación. Excluye las dos secciones registradas que redirigen sin renderizar una vista (`/my-account/loyalty` y `/administration/pharmacy-profile`), además de rutas parametrizadas sin datos de fixture. Las ocho vistas públicas agregadas son `/posts` y las siete altas.

| Actor auditado | Rutas | Celdas | Resultado de métricas visuales | Rojos de consola | Matriz |
|---|---:|---:|---|---:|---|
| Médica (`PRACTITIONER`/`CLINICIAN`) | 35 | 140 | 140/140 PASS | 20 CSP | [MATRIZ-visual.md](MATRIZ-visual.md) |
| Paciente (`PATIENT`) | 34 | 136 | 136/136 PASS | 20 CSP | [paciente/MATRIZ-visual.md](paciente/MATRIZ-visual.md) |
| Administración (`SECURITY_ADMIN`) | 46 | 184 | 184/184 PASS | 20 CSP | [administrador/MATRIZ-visual.md](administrador/MATRIZ-visual.md) |

Cada celda es una ruta en 375, 768 o 1440 px en claro, o 1440 px en oscuro. En las tres matrices: fondo claro blanco, centrado dentro de 2 px, ancho mínimo del 85 % donde aplica y sin scroll horizontal. En oscuro se conserva la superficie existente; el ancho de las altas públicas no se fuerza porque alteraría esa composición. Las altas se miden sobre `.auth-split__panel` en contexto público independiente.

Los rojos CSP se repiten en `/auth/register`, `/auth/register/patient`, `/auth/register/practitioner`, `/auth/register/organization` y `/auth/register/laboratory` en los cuatro tamaños/temas; cada celda reporta dos mensajes. Las altas de centro de imágenes y farmacia no los emiten. No se silenció el error ni se agregó una excepción al auditor. La política de seguridad del servidor queda fuera del alcance visual de este carril.

La cuenta de administración del simulador es `admin@alovida.mock` con rol `SECURITY_ADMIN`. Por eso no se cuentan como vistas disponibles para este actor `/administration/content-packs` (`SUPERADMIN`) ni `/administration/pharmacy-branches` (tenant `PHARMACY`). La primera pasada las intentó abrir y registró redirecciones; se corrigió el filtro por rol/tenant y se repitió el inventario completo. Una pasada superpuesta también tuvo `ERR_NETWORK_CHANGED` en `/dashboard` oscuro; la repetición final de administración no tuvo rutas sin cargar ni errores de red.

## Fotos

Las tres matrices finales enlazan 460 PNG: 140 de médica, 136 de paciente y 184 de administración. Todos los archivos referenciados existen y superan 8 kB. Revisé las 460 capturas agrupadas en 13 hojas de contacto: contenido centrado, fondo claro blanco, pantallas oscuras conservadas y formularios públicos en los tres anchos.

Las carpetas conservan capturas anteriores de inventarios ya descartados. Se consideran evidencia vigente únicamente los archivos enlazados desde las matrices finales.

## Comandos y salida

- `node scripts/corr-rutas.mjs` → `Carril 34: inventario 81; médica 35; paciente 34; administración 46`.
- `corepack yarn typecheck` → PASS.
- `corepack yarn eslint scripts/audit-design-views.mjs scripts/corr-rutas.mjs playwright/corr-evidencia.spec.ts playwright/support/simulador.ts` → PASS.
- `git diff --check` → PASS.
- `corepack yarn build` → PASS, con advertencias existentes de dependencias CommonJS y `prerender` ignorado por `outputMode`.
- `CORR_USUARIO=medica scripts/corr-evidencia.sh 34 --auditoria` → 140 celdas; falla el gate únicamente por 20 mensajes CSP.
- `CORR_USUARIO=paciente scripts/corr-evidencia.sh 34` → 136 celdas; falla el gate únicamente por 20 mensajes CSP.
- `CORR_USUARIO=administrador scripts/corr-evidencia.sh 34 --auditoria` → 184 celdas; falla el gate únicamente por 20 mensajes CSP.
- `corepack yarn lint` → FAIL: 276 errores distribuidos por el repositorio. El ESLint dirigido a los cuatro archivos JS/TS modificados pasó.
- `corepack yarn test --watch=false` (repetición final) → 733 archivos PASS, 3 FAIL; 10.167 pruebas PASS, 3 FAIL (10.170 total).
  - `src/app/features/accounting/resumen/resumen.spec.ts`: esperaba 6 ventanas únicas y obtuvo 5.
  - `src/app/features/dashboard/access-tree/access-tree.spec.ts`: apareció `/administration/received-claims` en la lista esperada de la aseguradora.
  - `src/app/features/account/pharmacy/cart/cart-page.spec.ts`: el estado/cantidad del carrito compartido no coincidió con el caso vacío.
  Ninguno de esos archivos está modificado por CORR-34; no se debilitaron ni borraron aserciones. La prueba dirigida de `clinical.handlers.spec.ts` pasó 22/22 después de una corrida completa anterior que mostró un resultado distinto.
- `corepack yarn pw playwright/carril-19-route-health.spec.ts --workers=1` → FAIL antes del barrido: `la API tiene que estar viva para el barrido`. La API local no estaba disponible; no se levantó ni modificó backend.
- `python3 -S .claude/hooks/claim.py --lane 34 --level VERIFIED --allow-downgrade ...` → nivel `VERIFIED`; se reemplazó el claim `REGRESSION_VERIFIED` heredado del PR #457, que no describía esta corrección.
- `python3 -S scripts/atlas/fable-proof-check.py --lane 34` → FAIL correcto: `Claim level=VERIFIED != REGRESSION_VERIFIED`.

## Cambios de auditoría

- El generador deja de tomar rutas históricas escritas en comentarios, reconoce listas de roles compartidas, aplica restricciones de tenant y excluye secciones que sólo redirigen. Conserva por separado inventario global y listas por actor.
- El auditor comprueba que la ruta solicitada sea la que quedó cargada, separa las salidas por rol y usa viewport fijo para cada foto. Las altas públicas se miden sin la sesión autenticada.
- El simulador asigna `CORR_USUARIO=administrador` a la cuenta real `admin@alovida.mock`.
- Se actualizó la ficha, el prompt y las instrucciones `.md` de evidencia, microtareas y pruebas para documentar las decisiones del propietario, la sintaxis vigente y el inventario de 81 vistas.
- El checkout también contiene cambios visuales del espacio de trabajo en `shell-layout.css` y `register-pharmacy.html`; no hice más cambios de UI durante esta continuación porque las mediciones visuales ya pasaban.

## Autorrevisión de código

**VEREDICTO: APROBADO para el alcance de auditoría.**

- Alcance: los cambios del generador, auditor, fixture de rol e inventarios respaldan las pasadas por actor. Los cambios del inventario de diseño son derivados de los metadatos de roles que consume el generador.
- Visual y dark mode: no se alteraron modelo, API, `.env` ni proxy; las medidas claras/oscuras pasan sin modificar ni omitir aserciones.
- Organismos, tokens, accesibilidad y rutas de producto: no se añadió una vista ni CSS en esta continuación; las rutas se derivan de las restricciones vigentes.
- Identificadores nuevos en inglés; textos de pantalla existentes en castellano.
- Evidencia: typecheck y ESLint dirigido pasan. El spec de evidencia llega a todas las celdas y conserva CSP en rojo; suite unitaria, lint global y route-health quedan reportados arriba.

## Riesgos y trabajo pendiente

- Corregir el desajuste CSP de las altas en el flujo de servidor/SSR y repetir las tres matrices para cerrar la consola.
- Resolver las tres fallas unitarias de la repetición final, los 276 errores de lint y disponer de API local para route-health. Estos gates impiden marcar Definition of Done.
- No hay línea base «antes» válida tras la invalidación previa de evidencia; no se reconstruyó ni se presentó una captura posterior como si fuera anterior.
- El Claim Ladder queda en `VERIFIED`, no `REGRESSION_VERIFIED`; el proof-check permanece rojo hasta que la regresión y los gates requeridos pasen.
- `docs/progress/evidence/lane-34/` mantiene capturas de corridas anteriores; para revisión usar sólo los PNG referenciados en las matrices finales.
- No se creó ni mergeó PR porque los gates de la ficha no están verdes.
