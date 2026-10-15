# Decisión de trabajo del carril 40

## 2026-10-13 — Confirmación de alcance CORR-10

- El propietario confirmó que se conserva `features/public-profile/` y la ficha pública de médicos del directorio.
- El propietario confirmó que se conserva “Mis artículos” y su ruta `/my-account/articles`.
- No se retiran el cliente ni los métodos compartidos de la vitrina: artículos, creación de vitrina mínima y propagación de la foto del perfil dependen de ellos.
- En la edición se conserva el título y la biografía profesionales, que también componen la ficha del directorio. El logo del consultorio permanece por su uso en membretes de PDF; se quitó la frase que presentaba el editor como una vista para el público.

# Decisión de trabajo del carril 32

## 2026-10-13 — Nombre de la tarjeta y pantalla

- El propietario confirmó que CORR-32 se refiere a la tarjeta/ruta que originalmente decía «Tu organización».
- El propietario eligió restablecer el nombre «Mi consultorio propio», aunque `origin/mockup` ya la había renombrado a «Mis organizaciones» el 19/09/2026.
- Se conserva el listado existente de consultorios propios y lugares afiliados; se conserva el uso del mismo formulario desde «Mi perfil» para crear y editar, como ordena la ficha.
- `organization-panel` no se elimina: sigue siendo la pantalla de administración para roles de organización/tenant.

# Decisión de trabajo del carril 36

## 2026-10-14 — Cierre de CORR-06

- `origin/mockup` ya contenía la pantalla unificada y el mapeo de estados a conceptos; esta rama completa los criterios pendientes de CORR-36.
- Los casos mock de la doctora demo muestran estados verificado, abierto y rechazado, con fechas calculadas respecto al reloj de Playwright fijado en 2026.
- El detalle se conserva dentro de un diálogo y en la URL con `?tab=cases&case=<id>`; los enlaces históricos redirigen a la pantalla unificada.
- La regla de evidencia de fondo blanco aplica también al tema oscuro en este carril, siguiendo las instrucciones entregadas para el workspace. El chequeo específico se corrigió sin alterar otros carriles.
- La línea base de suite completa se obtuvo sobre `c36a0188f`: 74 fallos; la rama termina con 73. Los fallos residuales y los bloqueos de API/Fable se documentan en `docs/progress/evidence/lane-36/REPORT.md`.

# Decisión de trabajo del carril 37

## 2026-10-15 — Conservar el orden vigente y completar el contacto de sede

- La ficha `TAREA-37` proponía seis pestañas basadas en los pasos del alta. La inspección de `/my-account` mostró que la base ya tiene una tarjeta con siete pestañas, producto de solicitudes posteriores de facturación, consultorio, trayectoria y actividad. Se conserva el orden actual de `PESTANAS_DEL_PERFIL_MEDICO` para no descartar esas solicitudes.
- El propietario indicó que en todas las decisiones se elija la opción más recomendada. Para esta discrepancia, la recomendación es preservar las siete pestañas vigentes y actualizar la ficha vieja, no volver a un agrupamiento que oculta secciones.
- El contrato del alta agrega el teléfono como `PracticeSite.contactPhone`; se incluye en el mapa a «Dónde atiendo» y en la lectura de la sede mediante un enlace `tel:`. No se modifica contrato ni servicio.
