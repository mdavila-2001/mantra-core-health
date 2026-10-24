# Doble revisión de capturas — Tarea 2 (WhatsApp / Call Center de aseguradora)

Regla 35.1. Corrida: `playwright/carril-insurance-whatsapp.spec.ts --workers=1` (12/12 PASS,
`evidencia/playwright-whatsapp-completo.txt`), contra `ng serve` real (`:4200`) y el contenedor
`mantra-redesa-api-1` reconstruido (`:3000`). 5 capturas, dos superficies (detalle de reclamo y
tarjeta de cobertura), light mode (único tema disponible en esta corrida — ver "No cubierto").

## Pasada 1 — Verificación

| Captura | Contraste CA | Veredicto |
|---|---|---|
| `contacto-detalle-390.png` | Botón «Chatear por WhatsApp» y «Llamar al call center · 800-10-0103» visibles, apilados, sin desborde; `Escribir a siniestros` debajo | APROBADA |
| `contacto-detalle-768.png` | Mismos dos botones en fila, sin desborde, texto completo sin truncar | APROBADA |
| `contacto-detalle-1440.png` | Layout de escritorio con nav lateral; botones en fila; disposición de la aseguradora y cláusula 12.3 visibles sin solaparse con los botones | APROBADA |
| `contacto-tarjeta-390.png` | 3 tarjetas de cobertura (Vigente/Vencida/Futura); cada una muestra exactamente los canales que le corresponden (ver hallazgo abajo) | APROBADA |
| `contacto-tarjeta-1440.png` | Igual contenido en escritorio; anillo de foco verde visible sobre el enlace de WhatsApp (residuo de la interacción de teclado del test, evidencia real de foco visible) | APROBADA |

**Hallazgo confirmado visualmente (no solo por assertion):** la asimetría de canales por
cobertura se ve correcta en pantalla — «Seguros Andina» (vigente) muestra WhatsApp y Call center
800-10-0101; la cobertura Vencida muestra solo WhatsApp («Call center: No informado»); la futura
muestra solo Call center («WhatsApp: No informado»). Coincide exactamente con `profiles.handlers.ts`.

## Pasada 2 — Adversarial (crítica ultra estricta)

1. **¿Algo se corta en los bordes?** No, en ninguna de las 5.
2. **¿Algún control se ve inerte/deshabilitado sin querer?** No; los dos botones tienen relleno y
   borde normales, no aparentan `disabled`.
3. **¿Contraste suficiente?** WhatsApp (fondo azul oscuro, texto blanco) y call center (borde +
   texto oscuro sobre blanco) legibles a simple vista en las 5 capturas.
4. **¿Solapamiento entre tarjetas o filas?** No se observa en `contacto-tarjeta-390.png`; el
   espaciado entre las 3 tarjetas de cobertura es consistente.
5. **¿El anillo de foco corresponde al área táctil real de 44×44, o solo al texto visible?**
   No se puede confirmar con certeza solo mirando el PNG comprimido — el anillo en
   `contacto-tarjeta-1440.png` se ve ajustado al texto «WhatsApp ↗», no visiblemente extendido a
   un cuadro de 44 px. **Esto no es una brecha del CA**: el `boundingBox()` del propio E2E
   (`H1.S3.M7`) midió el elemento real ≥ 44×44 y pasó — la caja invisible del `min-width`/
   `min-height` existe aunque el anillo de foco del navegador no la dibuje ensanchada.
6. **¿El PHI del dictamen (cláusula, ECG) se filtra al botón de WhatsApp?** No: esos datos son
   contenido legítimo de la pantalla del dictamen, no del texto que viaja en la URL (eso ya lo
   verificó el spec por separado, `decodeURIComponent`).
7. **¿Tipografía/espaciado consistentes entre anchos?** Sí, mismos títulos, mismo tamaño de badge.
8. **¿Modo oscuro?** **No capturado.** Ver «No cubierto».
9. **¿Algo genérico o "hecho por IA" que no encaje con el resto del sistema?** No; los dos
   botones usan el mismo átomo (`app-button`) y la misma tarjeta ya existente, solo cambió el
   talle y se agregaron `data-testid`.
10. **¿Las badges "Datos de prueba"/"Ver componentes" de `contacto-tarjeta-1440.png` son mías?**
    No — son un overlay de desarrollo preexistente y ajeno a esta tarea (se ve también antes del
    diff, no lo introduje).

## Nota final por pantalla

| Captura | Nota |
|---|---|
| `contacto-detalle-390.png` | APROBADA |
| `contacto-detalle-768.png` | APROBADA |
| `contacto-detalle-1440.png` | APROBADA |
| `contacto-tarjeta-390.png` | APROBADA |
| `contacto-tarjeta-1440.png` | APROBADA |

Ninguna pantalla `RECHAZADA`.

## No cubierto

- **Modo oscuro**: no se capturó ninguna captura en tema oscuro. El cambio no toca colores
  (`size="sm"→"md"`, `min-width`, testids, handler de teclado), así que el riesgo es bajo, pero
  no está verificado visualmente. Queda como riesgo residual declarado, no como supuesto de "está
  bien".
- **Viewports 1024×768 y 1920×1080** del `visual-quality-gate` del repo: omitidos con
  justificación en el plan (microcambio en una barra `flex-wrap`, cubierto por 390/768/1440).
