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

# Decisión de trabajo del carril 38

## 2026-10-15 — Interfaz compartida del alta y edición

- MT-38-02 se interpreta por el resultado observable y no exige un `FormGroup` completo. `practitionerFields()` pagina el alta y describe sus controles; el editor usa PATCH parciales por pestaña, señales tipadas y componentes especializados, y además contiene datos que el alta no pregunta (facturación, ubicación y datos propios de edición). Forzar el grupo paginado al editor duplicaría los campos especiales y podría enviar o restaurar valores fuera de la pestaña activa.
- La opción recomendada es compartir con `practitionerField()` las definiciones y validadores de los campos comunes, y conservar en el editor sus controles y estado por pestaña. La ficha TAREA-38 se ajustó con esta interpretación. El criterio funcional se mantiene: misma validación para campos compartidos y PATCH limitado a la pestaña editada.
- La auditoría anterior rechazó el diff bajo el texto literal del `FormGroup`; el diff actual se revisa de nuevo con el criterio corregido. El carril sigue abierto hasta pasar regresión y route-health.

