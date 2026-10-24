# Doble revisión crítica (Regla 35) — campañas preventivas de la aseguradora

Suite: `playwright/carril-insurance-campaigns.spec.ts` · salida en [`playwright-campaigns.txt`](playwright-campaigns.txt) (21 de 21, tres anchos). Capturas `campanas-01` a `campanas-07` en esta carpeta, con sufijos `-escritorio` (1440), `-tablet` (768) y `-movil` (390).

## Primera pasada (quien implementó)

Con las aserciones en verde a la primera, se abrieron las capturas y se encontró lo que ninguna aserción detectaba:

1. La columna «Tipo» mostraba códigos de la API en inglés (`LABORATORY`, `DIAGNOSTIC_IMAGING`).
2. En escritorio los selectores de rol y tipo del aliado quedaban aplastados, sin texto visible.
3. En móvil la tabla cortaba «Estado» y dejaba «Acciones» fuera de vista.
4. Las capturas de escritorio salían con el contenido corrido bajo el menú lateral.

**Veredicto: RECHAZADA.** Se corrigió (etiqueta de tipo en castellano, bloque de aliados a ancho completo, vigencia como columna solo en pantallas anchas) y se recapturó.

## Segunda pasada (agente independiente, no participó en la implementación)

Sobre el lote recapturado. Revisó las 21 imágenes con las 10 preguntas de `critical-double-review` §3.

| Hallazgo | Severidad | Resolución |
|---|---|---|
| Aviso de agendar mostraba el código crudo `CMP-CARDIO-2026` | MAYOR | El aviso usa el título de la campaña (parámetro `campaignTitle`); el código queda solo como respaldo |
| Aviso enterrado al final de «Mis citas», tras las listas | MAYOR | Va arriba de todo; el E2E exige que esté en el viewport |
| «Pausar» ofrecido en una campaña ya vencida | MAYOR | Una activa vencida solo ofrece «Finalizar» (prueba unitaria y E2E) |
| Selectores del aliado cortados a 768 px | MAYOR | La grilla de 4 columnas empieza en 1024 px |
| Capturas de escritorio recortadas bajo el menú y barra pegajosa a mitad de página | evidencia | Se apagan animaciones y lo `sticky` pasa a `static` solo para la captura |
| Tabla móvil sin datos clave y con columnas que robaban ancho | MAYOR | Tipo, copago y fecha final bajo el título en pantallas angostas |
| Fila «Vencida» y estados solo distinguibles por tono | MENOR | El estado siempre lleva texto |

Tras corregir, otro agente independiente revisó de nuevo las 21 capturas.

| Captura | Veredicto |
|---|---|
| 04 filtro, escritorio y tablet | APROBADA |
| 01 a 03 y 05 a 07, todos los anchos, y 04 móvil | ACEPTABLE CON RESERVAS, salvo 06 |
| 06 agendar, tres anchos | RECHAZADA: el aviso quedó pegado al encabezado «Mis citas» |

Defectos abiertos que reportó y qué se hizo:

| Defecto | Severidad | Resolución |
|---|---|---|
| Aviso de agendar sin separación del encabezado | MAYOR | Corregido: margen propio (`turnos__campana`) |
| Tabla móvil con «Estado» y «Acciones» robando ancho al título | MAYOR | Corregido: el estado pasa a la celda del título y desaparece esa columna |
| «Quitar» del aliado sin caja y bajo 44 px | MENOR | Corregido: variante con borde |
| Dos campañas con el mismo título en la consola | MENOR | Corregido: la campaña del E2E lleva «(E2E)» en el título |
| Tooltip de hover residual en la captura 05 móvil | MENOR | Corregido: se mueve el puntero y se quita el foco antes de capturar |
| Flecha «▼» sin etiqueta en tablet y móvil | MENOR | **Abierto:** es el desplegable del componente de tabla compartido, anterior a esta tarea |
| Contraste de etiquetas grises (`--text-secondary`) | MENOR | **Abierto:** se subió el token de las etiquetas del widget; no se midió con herramienta |
| Etiqueta de campo de aliado desalineada al aparecer un error; tema oscuro y estado vacío del filtro sin capturar | MENOR | **Abierto** |
| Píldoras «Datos de prueba», «Demo» y el toast de creación tapando filas | ruido | Elementos del entorno de la maqueta, fuera de esta tarea |

## Recaptura tras la última corrección

Se repitió la suite completa (21 de 21) y se abrieron las capturas 02 móvil y 06 escritorio: el aviso ya tiene separación y la tabla móvil muestra estado, título, tipo, copago y fecha final. **Esta última recaptura la verificó quien implementó, no el revisor independiente.** La Regla 35 pide repetir ambas pasadas tras cada corrección; una tercera pasada independiente no se hizo.

## Veredicto final

**ACEPTABLE CON RESERVAS.** Los criterios de negocio se ven cumplidos en las tres resoluciones: la afiliada solo ve `CMP-CARDIO-2026`, la consola solo lista campañas de Seguros Andina, no hay texto en inglés ni identificadores internos, y no hay desborde horizontal. Las reservas abiertas están en la tabla de arriba. Por no haber una tercera pasada independiente, el nivel visual queda en `VERIFIED_FUNCTIONAL_ONLY` hasta que alguien la haga.
