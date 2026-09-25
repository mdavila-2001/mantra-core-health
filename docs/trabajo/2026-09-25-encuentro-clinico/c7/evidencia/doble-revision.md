# Doble revisión crítica — «Notas médicas» (C7.H3.M2, tema claro)

Fuente: capturas de `playwright/clinica-c7-notas-medicas-pdf.spec.ts` (PASS, corrido contra
`ng serve --port 4217` sobre `claude/clinica-c7-nombres`, 2026-09-25). Sólo tema **claro** — el tema
oscuro no se capturó (ver "Pendiente" abajo).

## Primera pasada — verificación contra criterio de aceptación

| Viewport | Heading dice «Notas médicas» | Botón «Exportar a PDF» visible y sin recorte | Sin desborde horizontal | Barra (buscador+filtros+período) usable | Nota |
|---|---|---|---|---|---|
| 390×844 (móvil) | Sí | Sí | Sí (aserción del spec: `desborde ≤ 1px`, PASS) | Sí, apilada verticalmente | — |
| 768×1024 (tablet vertical) | Sí | Sí | Sí | Sí | — |
| 1024×768 (tablet horizontal) | Sí | Sí | Sí | Sí, en una fila | Menú lateral ya expandido, sin recortes |
| 1440×900 (escritorio) | Sí | Sí | Sí | Sí | Columna «Nota» y botón «Ver nota» ya con el rótulo nuevo |
| 1920×1080 (escritorio grande) | Sí | Sí | Sí | Sí | — |

Tabla completa (captura de `notas-medicas-1440x900-escritorio.png`, full page): columnas FECHA,
PACIENTE, MOTIVO, ESTADO, TIPO DE CITA, CANAL, NOTA — «Evolución» ya no aparece en ningún lado.
`app-pagination` funcionando con datos reales: «Página 1», «1-10 de 86», «10 por página»,
«Siguiente». En móvil (`notas-medicas-390x844-movil.png`) la tabla colapsa a las columnas de
prioridad 1 (Fecha, Paciente, Estado, Nota) y la paginación se apila debajo, con números de página
1..9 y «Anterior»/«Siguiente» con texto.

## Segunda pasada — adversarial, ultra crítica

Postura: rechazar si hay algo que objetar.

1. **¿El full-page de escritorio (`notas-medicas-1440x900-escritorio.png`) muestra el menú lateral
   duplicado/superpuesto?** Sí, es un artefacto conocido y documentado por el propio spec
   (`consulta-rejilla.spec.ts` lo explica: la captura *cosida* de `fullPage: true` dibuja el menú
   `sticky` encima del contenido al hacer scroll). No es un defecto del componente — la captura de
   juicio real de este spec es la de `cabecera-*` (clip, sin ese artefacto), que sale limpia en los
   5 viewports. **No bloqueante**, pero se deja escrito para que nadie lo confunda con un bug.
2. **¿La paginación nueva rompe algo en móvil?** No: los números de página no desbordan, el
   `desborde` del spec (que mide contra `document.documentElement`, no sólo la cabecera) dio `≤1px`
   en los 5 viewports — incluida la pantalla con la tabla y la paginación completas, porque el
   `boton.click()` de descarga se ejecuta después de haber recorrido los 5 viewports con la tabla ya
   pintada.
3. **¿«Nota» como encabezado de columna es ambiguo (nota clínica vs. nota de precio, etc.)?** En
   este contexto (pantalla «Notas médicas», con «Ver nota» como acción) no hay otra lectura posible
   dentro de la pantalla.
4. **¿El resumen «86 atenciones en los últimos 30 días» sigue diciendo «atenciones» en vez de
   «notas»?** Sí. Es intencional y documentado (ver `PLAN.md` H2.M3): no se logró «una fila por
   nota» por falta del endpoint de colección, así que el resumen sigue siendo honesto con lo que
   realmente hay en cada fila (una atención, no una nota). No es una inconsistencia — es la métrica
   correcta para lo que la pantalla muestra hoy.
5. **¿Contraste de los chips de estado?** «Completada» (verde claro), «Llegó y no se cerró»
   (durazno), «En curso» (celeste) — mismos tokens que ya usaba la pantalla antes de este carril, no
   tocados por C7.

**Veredicto por pantalla:** «Notas médicas», tema claro, 5 viewports → **APROBADA**. Ningún hallazgo
`BLOQUEANTE` ni `MAYOR`; los dos `MENOR` (artefacto de captura cosida, resumen en "atenciones")
están explicados y no requieren corrección.

## Pendiente

- **Tema oscuro**, los 5 viewports: no se capturó. `clinica-c7-notas-medicas-pdf.spec.ts` no
  alterna tema; haría falta un test nuevo o una corrida manual con `data-theme="dark"`. Queda para
  el próximo pase (H3.M2 sigue `A MEDIAS`).
- **`observation-block`** («Medición», modal «Registrar una medición») y el envoltorio
  `free-note-block`→`measurement-grid` dentro de una consulta real: no se pudieron capturar esta
  noche porque `consulta-rejilla.spec.ts` — el único spec que llega a esa pantalla — falla antes,
  en un paso ajeno a C7 (`/medical-records`, locator desactualizado en `clinical-record.html`, ver
  `PLAN.md` H3.M1 y `evidencia/playwright/consulta-rejilla-fallo/`). Sin ese bloqueo destrabado no
  hay forma de llegar a esas dos pantallas por E2E esta noche.
