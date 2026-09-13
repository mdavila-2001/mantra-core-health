# El respaldo de la matrícula — 2026-09-13

Evidencia del cierre del bloqueo «Las matrículas no pueden llevar adjunto», que estaba anotado
desde el 2026-09-10. La cadena son tres cambios: la columna en el modelo (PR #20), el `fileId`
en el contrato de la API (PR #398) y esto — que el archivo elegido deje de tirarse.

## Qué se hizo, contra la maqueta

Cuenta `medica@alovida.mock`, `/my-account/edit` → pestaña **Credenciales**:

1. Nº de matrícula `MP-99123`, autoridad «Colegio de la profesión».
2. Respaldo: un PDF elegido desde el dispositivo.
3. «Agregar matrícula».

La matrícula aparece en «Tus matrículas cargadas» como **Pendiente**. Antes de este cambio el
PDF se aceptaba igual y se descartaba al guardar, sin que nada lo dijera.

| Archivo | Qué muestra |
|---|---|
| `1440-matricula-con-respaldo.png` | Escritorio 1440×900. Fondo blanco, formulario a tres columnas, la matrícula ya cargada al pie. |
| `390-telefono.png` | Teléfono 390×844. Una columna, el orden de los campos y la barra de acción en su lugar. |

Las dos son capturas de **viewport**, no de página completa: `app-form-actions` es
`position: sticky`, y una captura de página completa la dibuja fuera de su sitio —parece un
defecto de orden que en la pantalla real no existe—.
