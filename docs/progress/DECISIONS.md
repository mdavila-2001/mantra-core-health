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

## D-22 · CORR-09 se alinea con el editor vigente de `mockup` (2026-10-15)

La ficha de CORR-09 describía un estado anterior: matrícula sin adjunto y sin títulos en edición. La base vigente ya contiene el módulo compartido `credenciales-del-medico.ts`, tablas, diálogos de alta para matrícula y título y `app-file-input`. Los specs del editor comprueban la selección, la subida con `FilesClient`, la asociación del `fileId`, el fallo de subida y el rechazo por tamaño.

La aclaración vieja «los archivos no viajan a la API» contradice ese comportamiento y los comentarios de dueño fechados el 13/09/2026. La pantalla usa los endpoints ya existentes; este carril no cambia backend, contrato, modelo, DDL ni seeds. No se extrae `credentials-editor`: dividir una pestaña que ya funciona sería un refactor interno sin resultado observable y contradice la exclusión de refactors adyacentes. Se actualizó `tareas/TAREA-39-matriculas-y-adjuntos-en-editar.md` para reflejar el estado y las pruebas reales.

La evidencia visual de CORR-39 verifica presentación, no la disponibilidad del servidor; la integración de subida queda respaldada por los specs con HTTP simulado. La regresión global, route-health y Fable siguen siendo gates separados y no se declaran aprobados.
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
# Decisión de trabajo del carril 38

## 2026-10-15 — Interfaz compartida del alta y edición

- MT-38-02 se interpreta por el resultado observable y no exige un `FormGroup` completo. `practitionerFields()` pagina el alta y describe sus controles; el editor usa PATCH parciales por pestaña, señales tipadas y componentes especializados, y además contiene datos que el alta no pregunta (facturación, ubicación y datos propios de edición). Forzar el grupo paginado al editor duplicaría los campos especiales y podría enviar o restaurar valores fuera de la pestaña activa.
- La opción recomendada es compartir con `practitionerField()` las definiciones y validadores de los campos comunes, y conservar en el editor sus controles y estado por pestaña. La ficha TAREA-38 se ajustó con esta interpretación. El criterio funcional se mantiene: misma validación para campos compartidos y PATCH limitado a la pestaña editada.
- La auditoría anterior rechazó el diff bajo el texto literal del `FormGroup`; el diff actual se revisa de nuevo con el criterio corregido. El carril sigue abierto hasta pasar regresión y route-health.

## 2026-10-15 — Alinear la ficha con C-02 y el estado vigente

- La ficha inicial pedía duplicar lista/formulario dentro de una tarjeta con pestañas y navegar desde el perfil a `?tab=new`/`?edit=<id>`. C-02 del 2026-09-20 pidió que el consultorio propio se gestione dentro de la pestaña «Dónde atiendo» y que se retiren esos enlaces sueltos; gana esa instrucción posterior, ya implementada y fotografiada.
- `MyPractice` queda como un contenedor delgado que monta `WorkHistory(secciones="consultorios")`. El mismo flujo conserva lista, alta, edición y acciones de lugares desde Administración y perfil. No se duplica CRUD ni se añade una tarjeta/pestaña que compita con el control compartido.
- `administration/my-organization` se mantiene para quienes administran una organización/tenant, oculto para `PRACTITIONER`; redirigirlo a la pantalla personal rompería ese uso.
- Se actualiza `tareas/TAREA-32-mi-consultorio-propio.md` para retirar los criterios superados y dejar como fuente de verificación el spec compartido de WorkHistory, la navegación y las capturas Playwright.
# Decisión de trabajo del carril 35

## 2026-10-15 — Ruta vigente y evidencia de estados

- La ruta registrada en `app.routes.ts` es `/notification-center`; `/notifications` y sus parámetros de estado no son rutas de producto. Se corrige la ficha para usar la ruta real.
- Las evidencias Todas, Sin leer y Vacío se obtienen con controles visibles: abrir cada pestaña y, para Vacío, marcar la bandeja como leída antes de abrir Sin leer. El capturador agrega `evidenceState` sólo como selector interno del escenario; la pantalla lo ignora. No se inventa un endpoint de fixtures ni se modifica el comportamiento del producto para la prueba.
- Las fotos son capturas del viewport que se mide (375, 768, 1440 claro y 1440 oscuro), no capturas `fullPage`; se prioriza que la imagen represente el primer pantallazo evaluado por la regla visual.
