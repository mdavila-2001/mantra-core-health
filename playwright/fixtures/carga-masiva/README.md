# Fixtures E2E de la carga masiva

Sintéticos, declarados. **Copia** de los generados en
`mantra-core-health-api/test/fixtures/terminology-import/` (mismo `sha256sum`), salvo
`error-red.csv` y `grande.csv`, propios de esta suite:

| Archivo | Origen | Uso en el E2E |
|---|---|---|
| `ok-50.csv` | copia de la API | flujo feliz |
| `con-errores.csv` | copia de la API | 5 filas con problemas, `carga-importar` deshabilitado |
| `vacio-solo-encabezado.csv` | copia de la API | «no tiene filas» → `IMPORT_EMPTY_FILE` |
| `no-es-nada.pdf` | copia de la API | mensaje legible, sin stacktrace |
| `error-red.csv` | propio, 3 filas válidas | valida que un fallo de red preserva el nombre del archivo y los selects |
| `grande.csv` | generado por script, **no commiteado** (`.gitignore`) | 11 MiB, para el caso de archivo mayor al tope |

Sin gemelos `.xlsx`: no hay dependencia XLSX instalada esta noche (ver
`docs/trabajo/2026-09-25-marcelo-calidad/decision-dependencia.md` del repo de la API).

`grande.csv` se regenera con:

```bash
node -e "const fs=require('fs');const fila='ZZ-999999,Concepto de relleno,Definicion sintetica\n';const header='code,display,definition\n';const target=11*1024*1024;let out=header;while(Buffer.byteLength(out,'utf8')<target)out+=fila;fs.writeFileSync('playwright/fixtures/carga-masiva/grande.csv',out);"
```
