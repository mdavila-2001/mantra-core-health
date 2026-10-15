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

# Decisión de trabajo del carril 35

## 2026-10-15 — Ruta vigente y evidencia de estados

- La ruta registrada en `app.routes.ts` es `/notification-center`; `/notifications` y sus parámetros de estado no son rutas de producto. Se corrige la ficha para usar la ruta real.
- Las evidencias Todas, Sin leer y Vacío se obtienen con controles visibles: abrir cada pestaña y, para Vacío, marcar la bandeja como leída antes de abrir Sin leer. El capturador agrega `evidenceState` sólo como selector interno del escenario; la pantalla lo ignora. No se inventa un endpoint de fixtures ni se modifica el comportamiento del producto para la prueba.
- Las fotos son capturas del viewport que se mide (375, 768, 1440 claro y 1440 oscuro), no capturas `fullPage`; se prioriza que la imagen represente el primer pantallazo evaluado por la regla visual.

