# Animación de carga al subir imágenes y al paginar

Pedido del usuario (03/11/2026): que se vea la animación de carga al subir imágenes y al paginar,
en toda la app web.

## Qué cambió

- **Primitivas**: `app-pagination [loading]` (spinner junto al rango, números atenuados, controles
  bloqueados sin perder el foco), `app-file-input [uploading]` + `uploadingLabel` (velo con spinner
  y `role="status"`), `app-specialty-browser [loadingMore]`, `app-practice-logo [uploading]` y
  `app-signature-or-seal [uploading]` (velo visual). `app-data-table`: el botón de cursor pulsado gira
  hasta que llega cualquier estado o cursor nuevo; nunca queda trabado.
- **Esqueleto**: usa los velos del tema (`--bg-active` / `--bg-hover`); antes era casi invisible en
  modo claro. Con movimiento reducido queda un bloque quieto pero visible.
- **Pantallas**: se recorrieron todas las carpetas de `features/` y se conectó la petición en vuelo
  de cada subida y de cada paginación con su animación. Las que ya la tenían se dejaron igual.
- **Arreglo de paso**: en `groups` (pestaña «Histórico») el botón «Siguiente» no pedía nada; ahora
  pide la página siguiente y mantiene las filas cargadas a la vista.

## Evidencia de navegador

`ng serve --configuration development,demo`, Chromium 1280×860. Los scripts `shots*.cjs`
multiplican ×30 la latencia del simulador justo antes de la acción, para fotografiar el estado.

| Captura | Qué prueba |
|---|---|
| `evidencia/1-glosario-paginando.png` | Paginación del glosario: spinner junto al rango y números atenuados mientras llega la página 2 |
| `evidencia/2-glosario-esqueleto.png` | El esqueleto de la tabla se ve en modo claro |
| `evidencia/3-perfil-medico-subiendo-foto.png` | Foto del médico: velo y spinner sobre el retrato |
| `evidencia/4-perfil-paciente-subiendo-foto.png` | Foto del paciente: velo sobre el avatar y botón «Cambiar foto» con `aria-busy="true"` |
| `evidencia/5-edicion-logo-subiendo.png` | Logo del consultorio: velo «Subiendo el logo…» en la zona y spinner en la vista previa |
| `evidencia/6-edicion-logo-subido.png` | Tras la respuesta el velo desaparece y la vista previa muestra el logo nuevo |

En los cuatro recorridos el script comprobó además que el indicador desaparece cuando llega la
respuesta.

## Lo que no se ejecutó

- Modo oscuro y móvil no se capturaron.
- La suite completa no entra en la memoria del contenedor de una sola vez; se corrió en tandas.
  Las fallas que aparecen son las mismas que en `dev` sin este cambio (se comprobó corriendo los
  mismos archivos sobre `origin/dev`).
