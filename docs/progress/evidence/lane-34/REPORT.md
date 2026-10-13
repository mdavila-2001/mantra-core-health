# REPORT — Carril 34 · CORR-04

## Veredicto: VERIFIED para la auditoría visual; regresión integral pendiente

La auditoría final de producción SSR pasó **464/464 celdas**, con cero errores de consola y cero celdas rojas. Se capturó por separado cada actor: médica, paciente y administración. Se revisaron visualmente muestras representativas en móvil, escritorio, tema claro y oscuro. Las matrices y fotos citadas abajo son las salidas de esta corrida.

El claim queda en `VERIFIED`. La suite completa conserva tres fallos ajenos a este cambio, el lint global continúa rojo y el barrido route-health requiere una API local que no está disponible. No declaro `REGRESSION_VERIFIED` ni cierro la Definition of Done integral mientras esas verificaciones estén pendientes.

## Inventario y cobertura

El generador produce 82 vistas auditables desde el mapa de navegación. Excluye dos secciones que redirigen sin renderizar una vista (`/my-account/loyalty` y `/administration/pharmacy-profile`) y rutas parametrizadas sin datos de fixture. El inventario final por actor:

| Actor | Rutas | Celdas finales | Celdas rojas | Matriz |
|---|---:|---:|---:|---|
| Médica (`PRACTITIONER`/`CLINICIAN`) | 35 | 140 | 0 | [MATRIZ-visual.md](MATRIZ-visual.md) |
| Paciente (`PATIENT`) | 34 | 136 | 0 | [paciente/MATRIZ-visual.md](paciente/MATRIZ-visual.md) |
| Administración (`SECURITY_ADMIN`) | 47 | 188 | 0 | [administrador/MATRIZ-visual.md](administrador/MATRIZ-visual.md) |

Cada celda mide una ruta a 375, 768 o 1440 px en claro, o a 1440 px en oscuro. Las matrices finales comprueban fondo blanco en tema claro, centrado con diferencia máxima de 2 px, ancho mínimo de 85 % donde aplica, ausencia de scroll horizontal y consola limpia. El ancho de las altas públicas en oscuro se marca «no aplica» para conservar la composición de dos columnas. Las altas se miden dentro de `.auth-split__panel` en contexto público.

El inventario usa la cuenta de administración del simulador `admin@alovida.mock` (`SECURITY_ADMIN`). Excluye `/administration/content-packs` (`SUPERADMIN`) y `/administration/pharmacy-branches` (tenant `PHARMACY`).

## Línea base y comparación

La línea base médica del 13 de octubre contiene 140 celdas; la del paciente, 136. Ambas se tomaron en modo desarrollo y registraron mensajes CSP en cinco rutas públicas de alta por el bloqueo de scripts inline. La captura final se hizo con el build SSR de producción: las tres matrices finales no registran errores CSP ni mensajes de consola. No se cambió ni relajó la política CSP.

La matriz previa de administración disponible es del 6 de octubre y se conserva sin presentarla como captura equivalente del 13 de octubre. La matriz final nueva cubre las 188 celdas administrativas.

## Fotos

Las matrices finales enlazan 464 capturas PNG. Las celdas medidas están referenciadas directamente desde cada matriz y sus archivos superan el mínimo de tamaño del auditor. Se revisaron las hojas de contacto de la corrida y muestras de `/messaging`, `/schedule`, `/auth/register/practitioner` y `/administration/medical-organization`, en tamaños móvil/escritorio y tema claro/oscuro.

## Comandos y salida

- `node scripts/corr-rutas.mjs` → inventario 82; médica 35; paciente 34; administración 47.
- `corepack yarn typecheck` → PASS.
- `corepack yarn eslint scripts/audit-design-views.mjs scripts/corr-rutas.mjs playwright/corr-evidencia.spec.ts playwright/support/simulador.ts` → PASS.
- `git diff --check` → PASS.
- `corepack yarn build` → PASS, con avisos existentes de CommonJS y prerender.
- `CORR_USUARIO=medica E2E_BASE_URL=http://localhost:4202 scripts/corr-evidencia.sh 34` → PASS, 140/140.
- `CORR_USUARIO=paciente E2E_BASE_URL=http://localhost:4202 scripts/corr-evidencia.sh 34` → PASS, 136/136.
- `CORR_USUARIO=administrador E2E_BASE_URL=http://localhost:4202 scripts/corr-evidencia.sh 34` → PASS, 188/188.
- `corepack yarn lint` → FAIL; 276 errores distribuidos por el repositorio. El ESLint dirigido a los cuatro archivos JS/TS modificados pasa.
- `corepack yarn test --watch=false` → 745 archivos pasan y 3 fallan; 10.374 pruebas pasan y 3 fallan (10.377 total). Fallos: `clinical.handlers.spec.ts` (`buildPrescriptionPdf(...).output`), `insurance-analytics.handlers.spec.ts` (fixture de primas) y `pdf-logo.spec.ts` (estado compartido). Ninguno pertenece a archivos tocados por este carril; no se quitaron ni debilitaron aserciones.
- `corepack yarn pw playwright/carril-19-route-health.spec.ts --workers=1` → bloqueado en la precondición porque la API local `http://localhost:3005` no responde. No se modificó ni levantó backend.
- `python3 -S .claude/hooks/claim.py --lane 34 --level VERIFIED --allow-downgrade ...` → claim `VERIFIED`.
- `python3 -S scripts/atlas/fable-proof-check.py --lane 34` → no pasa: el helper exige `REGRESSION_VERIFIED`, nivel no respaldado mientras sigan abiertos los gates indicados.

## Cambios de auditoría

- El generador reconoce listas de roles compartidas, restricciones por tenant y secciones que sólo redirigen; conserva inventario global y listas por actor.
- El auditor comprueba la ruta cargada, separa resultados por rol, usa viewports fijos y captura altas públicas sin sesión autenticada.
- El simulador usa la cuenta real `admin@alovida.mock` para administración.
- Se actualizaron ficha, prompt e instrucciones de evidencia para reflejar el mapa, las decisiones de propietario y la sintaxis vigente.

## Autorrevisión de código

**APROBADO** para el alcance de auditoría. Typecheck, ESLint dirigido y `git diff --check` pasan. No se modificaron API, modelo, `.env` ni configuración de proxy; no se desactivaron verificaciones ni se quitaron aserciones. Las fallas globales y la API ausente quedan reportadas como gates abiertos.

## Riesgos residuales

- Cerrar la Definition of Done integral requiere una suite completa sin fallos, lint global corregido y route-health con la API disponible.
- El chequeo Fable no admite el claim visual `VERIFIED`; no se elevó el nivel para forzar un cierre.
- La comparación visual final de administración no dispone de una línea base del mismo día y del mismo entorno SSR.
