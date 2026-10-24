# Incidente con la salida compartida de lane 34

La copia `lane-34-global-partial-before-recovery.md` preserva la matriz parcial (cuatro celdas) que sustituyó accidentalmente a la matriz global. La matriz global anterior tenía 31.552 bytes; no se encontró en git ni en un respaldo local. La salida parcial medía 1.249 bytes.

El wrapper `scripts/corr-evidencia.sh` cambió al directorio real del frontend; por eso el uso de un enlace/sandbox no aisló `../docs/progress/evidence/lane-34/`. Después se regeneraron fotos con `--antes`. Quedaron afectados 20 archivos preexistentes: cuatro variantes para cada ruta `laboratory-directory`, `my-account/appointments`, `my-account/diagnostic-orders`, `my-account/diagnostic-results` y `my-account/loyalty`.

La matriz `MATRIZ-visual-antes.md` se reconstruyó con el texto observado y su tamaño (267 bytes); no se pudo conservar el `mtime`. Las fotos previas no son recuperables. El reporte del plan registra el incidente; no uses el contenido parcial como auditoría completa.
