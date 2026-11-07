# Reporte — Crear una orden en Laboratorio e Imagenología (tres vías), sobre `dev`

> **AVANCE: 8 / 10 microtareas en HECHO — 80,0 %.** Dos quedan A MEDIAS (H1.M3 lector real, H1.M5 chat sin E2E). Peldaño: `VERIFIED` en el simulador; no `REGRESSION_VERIFIED`.

- Fecha: 2026-11-07 · Plan: [PLAN.md](./PLAN.md) · Rama: `claude/funny-babbage-lzd4zz` (base: `origin/dev` al 2026-11-07)
- Responsable: justin

## Completado
| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.M1 | Lookup + alta (contrato real) + from-qr en el simulador | `ng test lab-orders-intake.handlers` | PASS (correcto/límite/inválido) |
| H1.M2 | «Orden propia»: documento → paciente → estudio → alta | `ng test own-order-tab` + Playwright | PASS, persiste tras recargar |
| H1.M4 | `?nueva=1`, identidad del centro, chip de origen | `ng test laboratory-orders-page order-origin` + Playwright | PASS |
| H2.M1 | Derivar → aceptar/rechazar; el centro solo ve lo aceptado | `ng test lab-referral.handlers` | PASS |
| H2.M2 | QR en «Mis órdenes»; aceptar/rechazar | `ng test diagnostic-orders.referral order-qr-dialog` + Playwright | PASS |
| H2.M3 | «Derivar a un centro» con tarjetas, buscador y logo | `ng test study-referral order-referral-dialog` + Playwright | PASS |

Totales: `ng test` dirigido **221 archivos, 2567 pruebas PASS**. Playwright `crear-orden-laboratorio.spec.ts` **3/3 PASS** (QR→laboratorio; orden propia + 3 viewports + oscuro; médico→paciente→laboratorio). Capturas en `evidencia/`.

## A medias
### H1.M3 — Lector de QR
- Qué anda: código a mano (E2E), pegado, soltar/subir imagen y cámara con un doble del lector (unit). Usa el `readQrFromSource` de `dev` (BarcodeDetector + `jsqr`).
- Qué no anda / no se probó: lectura **real** de un QR por cámara o imagen en un navegador (el Chromium del entorno no tiene cámara).
- Qué falta: probar en un navegador real con cámara y con una imagen de QR.
- Dónde quedó: `shared/utils/qr/qr-reader.ts`, `features/laboratory/orders/new-order/qr-order-tab.ts`; compila y pasa pruebas.

### H1.M5 — «Usar para una orden» en el chat
- Qué anda: el servicio y el botón del visor (unit). Qué no: sin recorrido E2E (hace falta un chat con una foto de QR). Falta: ese E2E.

## Pendiente
| Qué | Estado | Qué lo destraba |
|---|---|---|
| API real de las vías 1 y 2 (`from-qr`, derivación) y código QR firmado con vencimiento | TODO | Equipo de API |
| Doble revisión visual independiente de las capturas finales (regla 35) | TODO | Un revisor; la de la primera versión dio NO APROBADO y se corrigió, sin re-revisión |

## Evidencia
```text
yarn tsc -p tsconfig.app.json --noEmit  → sin salida
yarn ng test (221 archivos dirigidos)   → Test Files 221 passed · Tests 2567 passed
playwright crear-orden-laboratorio.spec.ts (chromium, 1 worker) → 3 passed
node scripts/check-max-lines|check-colores-sueltos|check-css-tokens → sin hallazgos en archivos tocados
```

## No cubierto
- Cámara/imagen reales; Firefox/Safari; oscuro fuera de 390 px; teclado/lector de pantalla de los diálogos nuevos; suite completa (`yarn test`) y `yarn pw` completo.
- App móvil: no se tocó.

## Desvíos del plan
- Reconstruido sobre `dev` (ver PLAN). Sin PR a `test` (rama dada de baja).
- Se restauró en `diagnostic-orders.actions.ts` la condición `fila.bookable` de «Reservar hora»: `dev` la había perdido en un merge y dos pruebas de `dev` (`diagnostic-orders.spec.ts`) fallaban.
- Para no hacer crecer archivos congelados se extrajeron `toStudyRow` (ficha del médico), `rowActionsOf` (Mis órdenes) y los tipos de duplicación de estudios a archivos propios; se quitó un `void PATIENTS` redundante.

## Riesgos residuales
- Dos funciones solo simuladas: contra la API real, `from-qr` y la derivación devuelven el error de `simulatorOnly`.
- En el catálogo demo los códigos de estudio no traen el prefijo `LAB_/IMG_`: el centro elige «Laboratorio/Imagenología» a mano cuando el código no lo dice.
- El demo no tiene logos: se ven iniciales; el centro sube el suyo desde el perfil de su organización.

## Decisiones y ambigüedades
- Alcance front+simulador, QR generado por el paciente y aceptación desde «Mis órdenes»: confirmado por el usuario (06/11/2026). «Subir desde la mensajería con un clic» se leyó como «Usar para una orden» en el visor del chat: confirmar.
