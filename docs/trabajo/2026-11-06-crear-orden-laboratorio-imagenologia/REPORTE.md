# Reporte — Crear una orden en Laboratorio e Imagenología (tres vías)

> **AVANCE: 6 / 6 microtareas en HECHO — 100 %, con una microtarea con reserva (H1.S1.M2, ver A medias) y la doble revisión visual sin aprobar.** Peldaño: `VERIFIED` (simulador) — no `REGRESSION_VERIFIED`.

- Fecha: 2026-11-06 · Plan: [PLAN.md](./PLAN.md) · Rama: `claude/funny-babbage-lzd4zz` (solo `mantra-core-health`)
- Alcance acordado con el usuario: **front + simulador**. La API real no tiene `/diagnostics/lab/*` ni la derivación: nada de esto corre contra API real.

## Completado
| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.S1.M1 | Simulador + cliente: pacientes, alta propia, alta por QR (idempotente; 400/404/409/403) | `ng test lab-orders-create.handlers lab-order-qr` | PASS (3 niveles: correcto, límite, inválido) |
| H1.S1.M3 | «Nueva orden» (una tarjeta con pestañas), botón, chip y línea de origen | `ng test laboratory-orders` + E2E | PASS · persiste tras recargar |
| H2.S1.M1 | Derivación: médico deriva → paciente decide → recién al aceptar entra al centro | `ng test referral.handlers` | PASS (rechazo y 409 incluidos) |
| H2.S1.M2 | «Mis órdenes»: QR de la orden (mostrar/copiar/descargar) y aceptar/rechazar | `ng test diagnostic-orders order-qr-dialog` + E2E | PASS |
| H2.S1.M3 | Ficha del médico: «Derivar a un centro» con tarjetas, buscador y logo | `ng test analysis-order-block order-referral-dialog` + E2E | PASS |
| H3.M1 (pedido 2) | Identidad de organización (logo o iniciales) en el encabezado del laboratorio, derivar y «Mis órdenes» | `ng test organization-identity` | PASS |

Totales: `ng test` dirigido **39 archivos, 532 pruebas PASS**; `tsc -p tsconfig.app.json` y `eslint src` sin salida (OK). E2E `playwright/crear-orden-laboratorio.spec.ts`: **3/3 PASS** (QR → laboratorio; orden propia + 3 viewports + oscuro; médico → paciente → laboratorio). Capturas en `evidencia/` (19 archivos, 390/768/1440).

## A medias
### H1.S1.M2 — Lector de QR (cámara, imagen, pegado, chat)
- Qué anda: entrada manual del código, pegado (Ctrl+V texto/imagen) y arrastrar/subir imagen están probados con un doble del lector; «Usar para una orden» en el visor de fotos del chat también (unit). El código manual se ejerció de punta a punta en navegador.
- Qué no anda: **la lectura real de un QR desde cámara o imagen no se probó** (el Chromium del entorno no trae `BarcodeDetector`; la pantalla lo detecta y ofrece solo el código).
- Qué falta exactamente: probar en Chrome real (Android/escritorio con `BarcodeDetector`) y decidir si se suma `jsqr` para Firefox/Safari.
- Dónde quedó: `shared/utils/qr/read-qr.ts`, compila, pruebas verdes.

### Doble revisión visual (regla 35)
- Primera pasada del implementador + segunda pasada de un revisor independiente (`visual-reviewer`): veredicto **NO APROBADO** (5 MAYORES). Corregido después: chip de origen, logo grande en el encabezado, «Derivar» verificado habilitado antes de capturar, 02/10/11 recapturadas con datos, la fila y sin aviso encima, captura oscura, tinta fija en el logo.
- **Sin re-revisión independiente de las capturas corregidas** → ninguna pantalla se declara `APROBADA`.
- Pendiente de la revisión: logo también dentro del diálogo QR del paciente y en las filas de la tabla; oscuro en 768/1440; capturas con logo real cargado y con logo roto; estados cargando/error de red; hero de cabecera como en «Mis órdenes».

## Pendiente
| ID | Estado | Qué lo destraba |
|---|---|---|
| API real (`/diagnostics/lab/orders*`, derivación) | TODO | Equipo de API; contrato en PLAN.md |
| Código QR firmado y con vencimiento | TODO | API real: hoy es `ALOVIDA-ORDEN:v1:<id>` sin firma |
| Dos PRs (a `dev` y a `test`) | TODO | No se abrieron: no se pidió en esta sesión |

## Evidencia
```text
yarn ng test (39 archivos dirigidos)   → Test Files 39 passed · Tests 532 passed
yarn tsc -p tsconfig.app.json --noEmit → sin salida
yarn eslint src playwright/crear-orden-laboratorio.spec.ts → sin salida
playwright crear-orden-laboratorio.spec.ts (chromium, 1 worker) → 3 passed
```
Capturas: `evidencia/01…13-*.png`.

## No cubierto
- Lectura real de QR por cámara/imagen; navegadores distintos de Chromium; tema oscuro fuera de 390 px; teclado/lector de pantalla de los diálogos nuevos; estados cargando/error de red de las pantallas nuevas.
- Suite completa (`yarn test`, 4985 pruebas) y `yarn pw` completo: **no se corrieron**.
- App móvil Flutter: no se tocó.

## Desvíos del plan
- La derivación se muestra en la ficha del médico y no en un menú nuevo; «Nueva orden» es la misma ruta con `?nueva=1` (no se tocó el menú compacto del laboratorio).
- Sólo se dirige/deriva una orden pendiente o activa (409 si no): regla agregada al ver que se derivaba una completada.
- Pedido 2 del usuario («más bonito, con logo»): se agregó `app-organization-identity` y se rediseñaron las tarjetas.

## Riesgos residuales
- **Dos corridas amplias de `core/mock/**` fallaron 3 pruebas cada una en archivos ajenos y distintos** (`support-access.session`, luego `community-reviewable-care`); cada archivo pasa en aislamiento. Intento de comparar contra la base fracasó (worktree mal armado). Clase: `UNKNOWN` — sin evidencia de que sea mío ni de que no lo sea.
- `check-max-lines` ya estaba en rojo en `thread.ts`, `diagnostics.handlers.ts`, `lab-portal.handlers.ts` y `analysis-order-block.ts`; mis cambios suman +8, +14, 0 y +13 líneas a esos archivos (techos preexistentes ya superados).
- El logo se lee por organización con `GET /tenants/:id/logo`; en la maqueta un centro publicado sin organización responde «sin logo» (ajuste en `directory.handlers.ts`).
- El demo no tiene logos cargados: se ven iniciales; el laboratorio sube el suyo desde el perfil de su organización.
- Error de consola `AbortError: Transition was skipped` al entrar como paciente (navegaciones del login que se pisan): visto en `/my-account/diagnostic-orders`, no en las pantallas nuevas; filtrado en la prueba.

## Decisiones y ambigüedades
- Alcance front+simulador, QR generado por el paciente y aceptación desde «Mis órdenes»: confirmado por el usuario (06/11/2026).
- «Subir desde la mensajería con un clic»: se leyó como la acción «Usar para una orden» en el visor de fotos del chat (solo cuentas de laboratorio). Confirmar con el usuario.
- `jsqr`: no se sumó dependencia. Confirmar.
