# Doble revisión crítica: aprobar y rechazar en el video

- **Video:** `artifacts/video-aseguradora/alianza-aseguradora-1080p.mp4`. Es h264, 1920×1080, de 128,72 s y en una sola toma continua.
- **Capturas:** son de la misma corrida que el video.
- **Alcance de esta revisión:** solo las celdas nuevas del paso 3. Las demás pantallas no cambiaron y se revisaron en [la doble revisión anterior](../../2026-10-05-video-aseguradora-alianza/evidencia/doble-revision.md).

| Viewport | Tema | Estado | Captura |
|---|---|---|---|
| 1920×1080 | claro | Confirmación de aprobación | `03-confirmar-aprobacion.png` |
| 1920×1080 | claro | Solicitud aprobada, con factura | `04-solicitud-aprobada.png` |
| 1920×1080 | claro | Confirmación de rechazo, con el motivo escrito | `05-confirmar-rechazo.png` |
| 1920×1080 | claro | Solicitud rechazada | `06-solicitud-rechazada.png` |

## Pasada 1: verificación

- **P1, `03-confirmar-aprobacion`: OK.** El diálogo se titula «Aprobar la solicitud CLM-2026-2016». Avisa que la decisión es irreversible y que emite una factura por 182.21 BOB. Muestra el resumen de paciente, servicio, prestador y monto, y los botones «Volver» y «Aprobar y facturar».
- **P1, `04-solicitud-aprobada`: OK.** Estado y resultado «Aprobada», monto aprobado 182.21 BOB, decidido por «Alianza Seguros». Factura FAC-004230 vigente, con la acción «Anular factura».
  - Esta captura se revisó en la corrida anterior, que era idéntica salvo por las capturas nuevas.
  - En la corrida final el script esperó a `received-claim-invoices` y pasó.
- **P1, `05-confirmar-rechazo`: OK.** El diálogo se titula «Rechazar la solicitud CLM-2026-2077». Muestra la advertencia y el motivo «El servicio no está cubierto por el plan contratado.» (52/500), y el botón «Rechazar» en estilo destructivo.
- **P1, `06-solicitud-rechazada`: OK.** Resultado «Rechazada», monto aprobado 0.00 BOB y el motivo escrito. En la factura dice «Rechazada: no se emite factura.»
  - Se revisó igual que la anterior.
  - En la corrida final el script esperó ese texto y pasó.

## Pasada 2: adversarial

**Diálogos de confirmación (`03`, `05`)**

1. Lo primero que se ve mal: no encontré nada.
2. Texto cortado: no hay; el detalle de atrás queda tapado a propósito por el velo.
3. Terminado: sí.
4. Coherencia: es el `DialogService` real.
5. Tema oscuro: no aplica, porque el video es claro.
6. Estados: el motivo vacío lo bloquea el diálogo, pero el video no muestra ese error. No hace falta para la demo.
7. Jerarquía: hay una sola acción primaria y el rechazo se marca como destructivo.
8. Datos: todos ficticios.
9. Muestra lo pedido: sí, aprobar y rechazar.
10. Por qué lo rechazaría: no encontré motivo.

**Nota: APROBADA.**

**Dictámenes (`04`, `06`)**

1. Lo primero que se ve mal: «Decidido por» dice «Alianza Seguros», el nombre de la organización y no de una persona. Es lo que hace el simulador con una cuenta de organización: firma con el nombre de la cuenta. **MENOR**, registrado.
2. Texto cortado: no hay.
3. Terminado: sí.
4. Coherencia: sí.
5. Tema oscuro: no aplica.
6. Estados: «El dictamen es definitivo» está visible.
7. Jerarquía: correcta.
8. Datos: ficticios.
9. Muestra lo pedido: sí.
10. Por qué lo rechazaría: solo por el punto 1, que es menor.

**Nota: ACEPTABLE CON RESERVAS.**

## Notas finales

| Pantalla | Nota |
|---|---|
| Confirmar aprobación | APROBADA |
| Solicitud aprobada | ACEPTABLE CON RESERVAS |
| Confirmar rechazo | APROBADA |
| Solicitud rechazada | ACEPTABLE CON RESERVAS |

## No cubierto

- «Aprobar parcialmente»: se ve como opción, pero no se ejecuta.
- El error de motivo vacío en el rechazo.
