## Qué

La pantalla de **importar terminología** pasa a ser una carga masiva en tres pasos, se ensancha el
cliente de import y el doble del simulador responde el contrato §2 en sus tres niveles.

1. **Qué vas a cargar** — perfil, sistema, versión y la **plantilla descargable** (CSV o XLSX).
2. **El archivo** — el mismo `app-file-input` de siempre, con `accept` ensanchado a CSV y XLSX.
3. **Resultado** — «Validar sin guardar» manda `dryRun=true`; el servidor devuelve cuántas filas
   leyó, la vista previa y los problemas **con su fila y su columna**, sin escribir nada.
   «Importar» se habilita **sólo** tras una validación con 0 errores.

## Por qué

Antes se mandaba un NDJSON de una: no había forma de saber qué traía el archivo antes de escribirlo,
y un catálogo que entra a medias no se deshace con un botón. La plantilla ataca el modo de fallo más
común de una carga masiva — un encabezado que el importador no reconoce.

## Cómo probarlo contra el simulador

Con `yarn dev` y la cuenta `admin@alovida.mock` (`SECURITY_ADMIN`), en
`/administration/terminology/import`. El doble **decide por el nombre del archivo**:

| Archivo | Qué responde |
|---|---|
| `ok-50.csv` | 50 leídas, 0 errores, vista previa de 20 filas `ZZ-`. La **segunda** importación real da 0 insertadas y 50 omitidas |
| `con-errores.xlsx` | Aborta: 5 errores en las filas 5/9/14/20/33 con su columna, y «Importar» sigue deshabilitado |
| `grande-10k.xlsx` | 413 |
| `no-es-nada.pdf` | 422 `IMPORT_FORMAT_UNSUPPORTED` |
| `vacio-solo-encabezado.csv` | 422 `IMPORT_EMPTY_FILE` |
| `error-red.csv` | 503 con identificador de correlación |

## Lo que no se ve en el diff

- **Ante cualquier fallo no se pierde nada**: el archivo y las tres selecciones siguen donde
  estaban, y el motivo queda anclado en la sección 3, no sólo en un aviso que se va solo.
- **El foco salta al informe** tras validar y al resumen tras importar, con un `effect` sobre la
  consulta de vista y **no** dentro del `subscribe`: ahí el bloque todavía no existe —lo dibuja un
  `@if` del render siguiente— y el foco se perdía en silencio. Lo destaparon las dos pruebas de foco.
- **El CSV de errores lo arma `CsvExportService`**, que ya neutraliza la inyección de fórmulas
  (`= + - @` → `'`) y escapa según RFC 4180. No se reimplementó nada ni se agregó ninguna dependencia.
- Los **14 `data-testid` del contrato** están puestos con esos nombres exactos, **una sola vez cada
  uno**, y hay una prueba que los cuenta uno por uno para que nadie los renombre sin enterarse.

## Verificado — **contra el doble del simulador**, no contra la API real

**132 pruebas dirigidas en verde**: 25 del manejador (4 preexistentes + 21 nuevas) · 37 del cliente
(eran 26) · 39 de la pantalla (eran 5) · 31 del barrido del simulador.
`yarn typecheck` en **0**. `yarn lint` con los **mismos 6 errores del baseline** y ninguno nuevo.
Ninguna prueba se borró, se saltó ni se debilitó.

**La rama de Itzan existe (`e57c0126`) pero trae sólo el contrato de fila §1**: cero apariciones de
`dryRun`, `import-template` e `IMPORT_FORMAT_UNSUPPORTED`. El endpoint HTTP que esta pantalla
consume todavía no está escrito, así que **nada de esto se ejerció contra la API real**.

## Riesgo · lo que NO se verificó

- **Peldaño visual: `UNKNOWN`.** No se abrió un navegador en toda la corrida (cuatro carriles en
  paralelo, regla 70): **no hay capturas**, ni consola, ni red, ni la medición de scroll a 375.
  La prueba visual y su doble revisión quedan para el carril de calidad.
- **La suite entera no se corrió**, sólo los cuatro specs dirigidos.
- Los códigos `IMPORT_*` **no están** en `API_ERROR_CODES`: la pantalla los lee del cuerpo crudo sin
  tocar `core/http/api-error.ts`, que es de otro carril. **Al integrar, agregarlos ahí.**

## Alcance

El diff toca **sólo** los archivos reservados a este carril. Comprobado:
`git diff origin/mockup --stat | grep -E "file-input|app.routes|navigation|playwright|alovida/terminologia"`
sale **vacío**.

Plan, reporte y evidencia en `docs/trabajo/2026-09-25-justin-pantalla/`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
