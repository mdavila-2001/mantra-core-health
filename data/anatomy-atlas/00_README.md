# Taxonomía Anatómica Netter para IA — v2 AUDITADA

Esta versión reemplaza la primera entrega para fines de entrenamiento serio. Se reconstruyó el índice con OCR de mayor resolución, se añadió consenso entre extracciones, se ampliaron definiciones y se eliminó la estrategia de repetir plantillas para alcanzar tamaño.

## Contenido principal

- `01_auditoria/`: hallazgos de integridad y métricas de la v1/v2.
- `02_ontologia/`: entidades, relaciones y niveles de confianza.
- `03_regiones/`: 8 regiones y 65 subregiones con definiciones ampliadas.
- `04_laminas_definiciones_largas/`: 548 láminas con explicación anatómica extensa, contexto y guardrails.
- `05_entidades_definiciones_largas/`: 3,161 entradas indexadas (anatómicas, clínicas o procedimentales según clasificación) con definiciones largas y evidencia OCR.
- `06_indice_ocr_consenso/`: índice reconstruido y cotejado entre dos OCR.
- `07_grafo/`: relaciones seguras estructura→lámina→subregión→región.
- `08_clinica_explicita/`: clínica puntual, separada de anatomía fuente y actualizada con fuentes web.
- `09_normalizacion/`: política FIPAT/TAH, alias y epónimos.
- `11_raw_ocr/`: 138 columnas OCR nuevas conservadas para auditoría.
- `12_dataset_entrenamiento_gold/`: 164,372 ejemplos únicos por entidad/tarea.
- `13_dataset_silver/`: entradas de consenso medio para tareas de incertidumbre.
- `14_machine_readable_md/`: tablas Markdown para parsers.
- `15_quality_tests/`: conteos y controles.

## Principio clave

**Tamaño no equivale a calidad.** Esta versión sigue superando 100 MB, pero el volumen se construye con definiciones y tareas diferenciadas. El corpus conserva procedencia para que una IA pueda aprender no solo términos anatómicos, sino también cuándo una afirmación está respaldada y cuándo debe abstenerse.
