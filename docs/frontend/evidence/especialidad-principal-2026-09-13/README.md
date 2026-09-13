# Cambiar cuál es la especialidad principal — 2026-09-13

Evidencia del cierre del bloqueo «Cambiar cuál es la especialidad principal no tiene dónde
hacerse», anotado el 2026-09-10 al quitar los interruptores sueltos de «Agregar una
especialidad». La cadena son dos cambios: el camino en la API
(`PATCH …/me/specialties/:id/primary`, PR #399) y este gesto en la fila.

## Qué se hizo, contra la maqueta

Cuenta `medica@alovida.mock`, `/my-account/edit` → pestaña **Credenciales**, tabla «Tus
especialidades cargadas»: clic en **Marcar como principal** en la fila de Medicina Interna.

| Archivo | Qué muestra |
|---|---|
| `1440-antes.png` | Cardiología **Principal**, Medicina Interna con el botón. |
| `1440-despues.png` | Medicina Interna **Principal** y primera; Cardiología pasa a ofrecer el botón. |
| `390-telefono.png` | Teléfono 390×844: la columna «Tipo» sobrevive al plegado, así que la acción se ve sin desplegar la fila. |

El orden de las filas cambia solo: la tabla ordena por principal, y la recarga del perfil
después del cambio la trae al frente. Eso es lo que hace visible que el cambio se guardó y no
es estado de pantalla.
