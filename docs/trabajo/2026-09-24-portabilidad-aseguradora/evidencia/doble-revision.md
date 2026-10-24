# Doble revisión de capturas — portabilidad de póliza y siniestralidad

Capturas producidas por la corrida verde de `playwright/carril-insurance-portability.spec.ts`
(10/10, ver `playwright-portabilidad.txt`), 2026-09-24.

## Pasada 1 — verificación contra el criterio de aceptación

| Captura | Qué verifica | Resultado |
|---|---|---|
| `portabilidad-lista-1440.png` | CA-01: diálogo en estado `ready` tras confirmar con BUNDLE por defecto — sello SHA-256, botones «Copiar hash», «Descargar PDF», «Descargar JSON», enlace de verificación. Sin desborde horizontal. | Todo presente, sin desborde. |
| `portabilidad-lista-390.png` | Lo mismo en móvil (390×844): el diálogo se apila en una columna legible, sin overflow. | Correcto. |
| `portabilidad-dependiente-1440.png` | CA-02: actuando por un dependiente, la tarjeta muestra la alerta «La portabilidad es un trámite personal: se exporta tu propio historial, no el de la persona que estás mirando ahora.» y el diálogo exporta igual (14 registros de 3 pólizas — los del TITULAR, no de «Valentina»). | Alerta visible; datos del titular, no del dependiente. |
| `portabilidad-dependiente-390.png` | Lo mismo en móvil. | Correcto. |

Las cuatro capturas fueron tomadas en el momento exacto en que el test las pidió (después de
`expect(...).toBeVisible()` sobre el sello), no reconstruidas a mano.

## Pasada 2 — adversarial (regla 35, `critical-double-review` §3)

1. **¿Falta algún estado?** No: las cuatro cubren el estado `ready` con y sin representación de
   dependiente, en los dos anchos configurados por el proyecto (1440/390). El estado `loading` y
   `error` no tienen captura en este lote — no los pide la microtarea S3.M5, y ya están cubiertos
   por specs unitarios (`portability-export-dialog.spec.ts`).
2. **¿El copy contradice lo que el certificado realmente entrega?** No — dice «exportación de la
   información disponible», «huella SHA-256», sin prometer «oficial» ni «firma digital» (corregido
   en M6 con el cherry-pick de `c1578610`).
3. **¿Hay PHI real expuesto?** No: todo el contenido es del fixture sintético de la maqueta
   (`PACIENTE` = Ana Lucía Pérez, datos de demostración documentados en `personas.ts`).
4. **¿El botón "Copiar hash" se ve del tamaño prometido?** No es verificable a simple vista en un
   PNG; lo que sí es evidencia dura es que el propio E2E midió su `boundingBox().height` y el de
   los tres botones de descarga contra el umbral 44/40 px y pasó (ver M4, `objetivosListos` en el
   spec).
5. **¿Se ve el sello de otro certificado por error (contaminación entre tests)?** No: los cuatro
   hashes mostrados son distintos entre sí, consistente con que `mode: 'serial'` genera un
   certificado nuevo por test.
6. **¿Hay ruido visual ajeno al carril (toasts, banners)?** En `portabilidad-dependiente-1440.png`
   se alcanza a ver el borde de un toast de "registrado con éxito" del alta del dependiente,
   arriba a la derecha, aún desvaneciéndose. No tapa ni contradice nada del diálogo; MENOR,
   cosmético, no bloquea.
7. **¿El diálogo respeta el ancho sin desbordar?** Sí en las cuatro; el propio test lo assert
   explícitamente (`document.documentElement.scrollWidth <= innerWidth`) antes de cada captura.
8. **¿La alerta de "trámite personal" podría confundirse con un error?** No: tono `info` (no
   `error`/`warning`), coherente con lo que dice.
9. **¿Falta contraste o legibilidad?** A la resolución capturada no se aprecian problemas de
   contraste; no se corrió un auditor de contraste automatizado en esta pasada (fuera del alcance
   declarado de S3.M5, que es sobre el contenido y el layout, no un gate de accesibilidad aparte).
10. **¿Alguna captura debería rechazarse?** No.

## Veredicto por pantalla

| Captura | Nota |
|---|---|
| `portabilidad-lista-1440.png` | APROBADA |
| `portabilidad-lista-390.png` | APROBADA |
| `portabilidad-dependiente-1440.png` | ACEPTABLE CON RESERVAS (MENOR: resto de un toast ajeno visible en la esquina, cosmético) |
| `portabilidad-dependiente-390.png` | APROBADA |

Ninguna pantalla queda `RECHAZADA`. La entrega procede.
