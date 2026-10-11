# Decisión de trabajo del carril 40

## 2026-10-11 — Alcance de CORR-10

- Se conserva `features/public-profile/` y la ficha pública de médicos del directorio.
- Se conserva “Mis artículos” y su ruta `/my-account/articles`.
- Motivo: ante “continúa” sin una opción explícita, se sigue el alcance menos destructivo de la ficha y se preservan ambos elementos. La selección del propietario sigue sin confirmarse.
- No se retiran el cliente ni los métodos compartidos de la vitrina: artículos, creación de vitrina mínima y propagación de la foto del perfil dependen de ellos.
- En la edición se conserva el título y la biografía profesionales, que también componen la ficha del directorio. El logo del consultorio permanece por su uso en membretes de PDF; se quitó la frase que presentaba el editor como una vista para el público.

