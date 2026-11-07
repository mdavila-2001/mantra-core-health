# Reporte — Crear una orden en Laboratorio e Imagenología (tres vías), sobre `dev`

> **AVANCE: 5 / 10 microtareas en HECHO — 50,0 %.** Dos A MEDIAS (H1.M3 lector real, H1.M5 chat sin E2E) y una DESCARTADA (H1.M2, ya la entrega `dev`). Falta además la doble revisión independiente. Peldaño: `VERIFIED` en el simulador; no `REGRESSION_VERIFIED`.

- Fecha: 2026-11-07 · Plan: [PLAN.md](./PLAN.md) · Rama: `claude/funny-babbage-lzd4zz` (base: `origin/dev` al 2026-11-07)
- Responsable: justin

## Completado
| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.M1 | `from-qr` en el simulador | `ng test lab-order-qr.handlers` | PASS (correcto/límite/inválido) |
| H1.M4 | Identidad del centro, botón y diálogo «Orden con QR del paciente», chip de origen | `ng test laboratory-orders-page order-origin` + Playwright | PASS, la orden queda en «Borrador» y persiste tras recargar |
| H2.M1 | Derivar → aceptar/rechazar; el centro solo ve lo aceptado | `ng test lab-referral.handlers` | PASS |
| H2.M2 | QR en «Mis órdenes»; aceptar/rechazar | `ng test diagnostic-orders.referral order-qr-dialog` + Playwright | PASS |
| H2.M3 | «Derivar a un centro» con tarjetas, buscador y logo | `ng test study-referral order-referral-dialog` + Playwright | PASS |

Totales: ver «Evidencia» (salidas literales de esta corrida). Capturas en `evidencia/`.

## Descartada
- H1.M2 «Orden propia»: la vía 3 (orden creada por el propio centro) ya existe en `dev` como «Nueva orden» (`order-intake/lab-order-intake-dialog`, contra el contrato real de la API). Se retiró mi versión duplicada. El E2E comprueba que ese diálogo abre; **no** se probó su flujo de punta a punta (es de la otra sesión).

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
yarn eslint <51 archivos .ts cambiados respecto de dev>                → sin salida (0 errores)
yarn tsc -p tsconfig.app.json --noEmit                                  → TSC_EXIT=0
NODE_OPTIONS=--max-old-space-size=8192 yarn ng test --watch=false (laboratory, diagnostic-orders,
  analysis-order-block, messaging/thread, core/mock/handlers, core/data-access, organization-identity, qr)
                                                                       → Test Files 1 failed | 352 passed (353) · Tests 1 failed | 4338 passed (4339)
  El único fallo: diagnostic-coverage.handlers.spec.ts «aceptado: con su único estudio de imagen pendiente…»
  (expected [ …(2) ] to deeply equal [ Array(1) ]). Reproducido idéntico en un worktree limpio de origin/dev
  (sin mis cambios): PRODUCT_BUG/DATA preexistente de dev, no tocado. Lo ve el dueño de ese seed.
playwright crear-orden-laboratorio.spec.ts (chromium, 1 worker)         → 3 passed
node scripts/check-colores-sueltos|check-css-tokens                     → sin hallazgos en archivos tocados
node scripts/check-max-lines                                            → analysis-order-block.ts 703 (techo 693; dev 705): ver «Desvíos»
```
Una corrida anterior del E2E del médico falló una vez sin causa registrada y pasó en las tres siguientes (incluida la de la puerta); se declara como no explicada.

## No cubierto
- Cámara/imagen reales; Firefox/Safari; oscuro fuera de 390 px; teclado/lector de pantalla de los diálogos nuevos; suite completa (`yarn test`) y `yarn pw` completo.
- App móvil: no se tocó.

## Desvíos del plan
- Reconstruido sobre `dev` (ver PLAN). Sin PR a `test` (rama dada de baja).
- Se restauró en `diagnostic-orders.actions.ts` la condición `fila.bookable` de «Reservar hora»: `dev` la había perdido en un merge y dos pruebas de `dev` (`diagnostic-orders.spec.ts`) fallaban.
- `analysis-order-block.ts` queda en 703 líneas contra un techo congelado de 693: `dev` ya llegaba a 705 (el gate `check-max-lines` falla en `dev` sin mis cambios); mi cambio lo deja 2 líneas por debajo de `dev`, no lo arregla.
- Para no hacer crecer archivos congelados se extrajeron `toStudyRow` (ficha del médico), `rowActionsOf` (Mis órdenes) y los tipos de duplicación de estudios a archivos propios; se quitó un `void PATIENTS` redundante.

## Riesgos residuales
- Dos funciones solo simuladas: contra la API real, `from-qr` y la derivación devuelven el error de `simulatorOnly`.
- En el catálogo demo los códigos de estudio no traen el prefijo `LAB_/IMG_`: el centro elige «Laboratorio/Imagenología» a mano cuando el código no lo dice.
- El demo no tiene logos: se ven iniciales; el centro sube el suyo desde el perfil de su organización.

## Decisiones y ambigüedades
- Alcance front+simulador, QR generado por el paciente y aceptación desde «Mis órdenes»: confirmado por el usuario (06/11/2026). «Subir desde la mensajería con un clic» se leyó como «Usar para una orden» en el visor del chat: confirmar.
