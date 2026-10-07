# Plan — Video de la aseguradora: registro, alta con documentos y login de Alianza antes del recorrido

- **Fecha:** 2026-10-07
- **Repos afectados:** `mantra-core-health` (rama base `mockup`)
- **Rama:** `marcelo/video-registro-login-alianza-mockup` (creada con `--no-track` desde `origin/mockup`)
- **Predecesor:** [2026-10-05-video-aprobar-rechazar](../2026-10-05-video-aprobar-rechazar/PLAN.md) y [2026-10-05-video-aseguradora-alianza](../2026-10-05-video-aseguradora-alianza/PLAN.md)
- **Resultado observable:** un MP4 continuo que arranca en la pantalla de inicio de sesión, pasa por el **registro público de la aseguradora** (`/auth/register/organization`, 8 páginas, con los 6 PDF del alta subidos de forma simulada), llega a la confirmación, inicia sesión con la cuenta recién creada y sigue con el recorrido que ya existe (Mi perfil → Mis productos → Solicitudes recibidas con aprobar y rechazar → Siniestralidad «Por persona» → Directorio).
- **Kill-test:** el video no muestra el formulario real de registro de la aseguradora con los documentos subidos, o el login no usa el correo y la contraseña que se escribieron en el registro, o «Mi perfil» muestra datos distintos de los que se registraron.

## Alcance

- **IN:**
  - `tools/video-aseguradora/grabar.mjs`, `datos-alianza.mjs` y `README.md`.
  - Documentos PDF ficticios para el alta, generados por el script (en memoria, sin archivos en el repo).
- **OUT:**
  - El app y el simulador: no se toca ningún componente, handler ni fixture. El registro, la subida y el login usan los componentes y handlers que ya existen en `mockup` (`register-organization`, `/iam/auth/upload-registration-document`, `/iam/auth/login`).
  - `dev` y `test`: no aplican (usan la API real).
  - Verificación de correo y aprobación de la organización por la plataforma: el alta real deja la organización en `PENDING_VERIFICATION`; el video no muestra ese paso.
- **Solo para el video** (igual que antes): correos `@mail.com`, sin los botones «Datos de prueba» / «Ver componentes», cursor visible.
- **Ambigüedades registradas:**
  - **«Maquetar la subida de archivos».** Supuesto: la subida va por la pantalla real (zona de arrastre → selector de archivos → barra de avance → archivo listo) con PDF ficticios generados por el script, y el handler simulado existente los acepta. No se inventa una pantalla nueva. **Confirmar con:** el usuario.
  - **Login con la cuenta recién creada.** El simulador no crea usuarios al registrar: `buscarUsuario` resuelve el login por la parte local del correo (`aseguradora@…` → cuenta de la aseguradora de prueba). Supuesto: el dueño se registra como `aseguradora@mail.com`, y el login entra con ese mismo correo. **Confirmar con:** el usuario.
  - **NIT y sigla.** «Mi perfil» muestra el NIT (y el «Registro ante el regulador») y la sigla de la cuenta de prueba. Para que coincidan con lo escrito en el registro, el script usa un NIT numérico ficticio en vez de `APS-0015` y la sigla `ALIANZA` (de la que la pantalla deriva el código `ALIANZA`, el mismo que ya llevan los datos sembrados). **Confirmar con:** el usuario.

## H1 — El video empieza en el registro y el login

**CA:** Dado el MP4 final, cuando se reproduce, entonces: (1) se ve la pantalla de inicio de sesión y se entra a «Registrá tu organización · Aseguradoras»; (2) se completan las 8 páginas con los datos de Alianza y se suben, uno a uno, los cinco documentos legales y el poder notariado; (3) «Crear cuenta» termina en la confirmación del alta; (4) «Ir a iniciar sesión» lleva al login, donde se escribe el correo y la contraseña del registro y se entra; (5) desde la sesión recién abierta se llega a «Mi perfil», que muestra la razón social, el NIT, la sigla y la dirección que se registraron; (6) el recorrido siguiente es el de siempre.

**DoD:** `node tools/video-aseguradora/grabar.mjs` → salida 0 con sus controles limpios · `ffprobe` (h264, 1920×1080) · capturas de cada pantalla del alta · doble revisión crítica · PR mergeable.
**Estado:** HECHO
(Los checks de CI del PR #982 nunca arrancaron: ver «Pendiente» del REPORTE.)

### H1.S1 — Datos y documentos del alta

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H1.S1.M1 | Datos del alta de Alianza en `datos-alianza.mjs` (empresa, NIT, dirección, representante legal, tres gerencias, dueño) | Todos ficticios; correos `@mail.com`; coinciden con lo que muestra «Mi perfil» | `node -e` importa el módulo y lista los campos | HECHO |
| H1.S1.M2 | Seis PDF ficticios generados en memoria (constitución, NIT, SEPREC, licencia, SEDES, poder) | Cada uno es un PDF válido (cabecera `%PDF`, `%%EOF`) y dice «Documento de ejemplo» | `node -e` escribe uno y `file`/lectura de los bytes lo confirma | HECHO |

### H1.S2 — El recorrido del alta en el script

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H1.S2.M1 | Del login a «Registrá tu organización» y las páginas 1 a 2 (empresa y datos) | Captura de cada página con lo escrito visible | corrida + capturas | HECHO |
| H1.S2.M2 | Páginas 3 y 4: documentos legales subidos con el selector de archivos | Los cinco muestran «nombre.pdf · tamaño ✓» | captura | HECHO |
| H1.S2.M3 | Páginas 5 a 7: representante legal con poder, directorio ejecutivo, cuenta del dueño | Las tres gerencias completas; el poder subido | captura | HECHO |
| H1.S2.M4 | «Crear cuenta» → confirmación → «Ir a iniciar sesión» → login → «Mi perfil» por clic | Entra con el correo del registro; «Mi perfil» muestra los datos registrados | captura + salida 0 | HECHO |
| H1.S2.M5 | El recorrido existente sigue igual con sus marcas | Las marcas de los 5 pasos y las dos decisiones siguen en `marcas.json` | `marcas.json` | HECHO |

### H1.S3 — Verificación y entrega

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H1.S3.M1 | Video regenerado | h264, 1920×1080, salida 0, sin «Andina», sin `.mock`, sin `pageerror`, sin «sin manejador» | `ffprobe` + salida del script | HECHO |
| H1.S3.M2 | Doble revisión crítica de las capturas nuevas | Ninguna pantalla RECHAZADA | `evidencia/doble-revision.md` | HECHO |
| H1.S3.M3 | README del script actualizado | Explica el alta, la subida simulada y el supuesto del login | archivo en disco | HECHO |
| H1.S3.M4 | Commit local y entrega | Un commit con trailer; PR solo con el visto bueno | `git log -1` | HECHO |
| H1.S3.M5 | REPORTE.md | Con las tres secciones | archivo en disco | HECHO |

## Riesgos

| Riesgo | Mitigación |
|---|---|
| El mapa de la casa matriz pide teselas a internet y puede verse en blanco | Mirarlo en la captura; si queda feo, no se toca el mapa (es opcional) o se sirven teselas con `page.route`, que sí ve la red real |
| Los desplegables (`app-select`) no son `<select>` nativos | Explorar el DOM real antes de escribir el script; apuntar por rol/etiqueta |
| El selector de archivos nativo no sale en la grabación headless | Escuchar `filechooser` tras el clic en la zona de arrastre: se ve el clic y el avance de la subida |
| Recargar la página borraría el estado del alta | No hay `goto` entre el registro y «Mi perfil»; se navega solo por clics |
| `ng serve` recompila tras el cambio de rama | Esperar a que compile; el script falla si el sello del build no coincide |
