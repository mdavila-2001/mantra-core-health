# Niveles de confianza v2

- `gold_manual`: título de lámina corregido/verificado manualmente frente al material visible.
- `gold_ocr_title`: título claro recuperado del encabezado de una lámina y alineado por número canónico.
- `gold_toc`: relación derivada directamente de los rangos de la tabla de contenidos.
- `consensus_high`: dos pasadas OCR independientes del índice coinciden estrechamente en etiqueta y referencias.
- `consensus_medium`: coincidencia suficiente pero con alguna discrepancia; usar como silver.
- `new_ocr_only`: aparece solo en la nueva pasada; se conserva para auditoría, no para entrenamiento gold.
- `web_curated`: dato externo y actualizado, separado de Netter.
