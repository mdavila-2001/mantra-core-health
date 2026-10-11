# Inventario inicial — Carril 40 (CORR-10)

Inspección del estado de `origin/mockup`, 2026-10-11. La decisión de alcance se registra en `docs/progress/DECISIONS.md`.

## Ya retirado en la base

- No existe `features/account/my-profile/public-profile-settings/`; tampoco hay referencias a `public-profile-settings` o “Guardar vitrina” en `src/app`.
- No existe `features/account/my-profile/public-profile-preview/` ni ruta `/my-account/preview`. La matriz de evidencia ya navega a esa URL con resultado esperado “no encontrado”.
- No hay botón “Ver cómo me ven”; la spec de `practitioner-profile-view` ya comprueba su ausencia.
- El editor de `/my-account/edit` no contiene campos de vitrina como slug, nombre público, titular público, presentación pública, portada o aceptación de reseñas.
- Sí conserva el título profesional, la biografía y el logo del consultorio: forman parte de la ficha profesional y del membrete de PDF. Se retiró la frase “Cómo le ven las personas que consultan su perfil”, que presentaba el editor como configuración de una vista pública.

## Ajustes de CORR-10

- `practitioner-profile-view.html` tenía una segunda acción “Configurar mi perfil” que duplicaba el acceso “Editar perfil” de la cabecera. Se retiró la acción duplicada y se conserva el acceso general.
- `practitioner-profile-edit.html` tenía un texto que describía la pantalla como la vista que ve el público; se retiró. El bloque de logo se conserva porque el mismo logo se usa en los PDF.
- Se conserva “Mis artículos” dentro de esa misma sección, conforme a la decisión de alcance.
- `app.routes.ts` titula la ruta como “Editar perfil” y describe el acceso actual desde la cabecera.

## Usos conservados por decisión de alcance

- `my-account/articles` y `features/account/my-profile/medical-articles/` continúan activos. La pantalla crea una vitrina mínima con `VitrinaMinima` cuando hace falta y asocia artículos a esa vitrina.
- “Mis artículos” aparece en la vista de perfil, la pestaña del perfil y el acceso desde el feed.
- `CommunityClient.getOwnProfile` y `upsertOwnProfile` sirven los artículos y la creación de vitrina mínima.
- `practitioner-profile.ts` puede propagar a una vitrina existente la foto fijada en el perfil; no crea una vitrina implícitamente.

## Elementos preservados

- `features/public-profile/`, `public-directory.client.ts`, `/directory` y las rutas de fichas individuales siguen implementando la vista pública que usa el paciente.
