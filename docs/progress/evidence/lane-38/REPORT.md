# REPORT — Carril 38 · CORR-08

## Veredicto: FAIL — evidencia visual aprobada; DoD completo del carril pendiente

El cambio retira el switch «Certificada por el colegio o consejo» del diálogo de edición de especialidad y deja de mandar `boardCertified` al editar una especialidad. También extrae las páginas y definiciones del alta a `practitioner-fields.ts`, comparte el validador telefónico y usa los mismos metadatos de obligatoriedad en la edición. Los PATCH y la cancelación se limitan a la pestaña activa; hay cobertura para las tres pestañas.

El editor con tarjeta y pestañas ya existía en la base `mockup` usada para esta rama. El cambio conserva sus controles propios por señales, en vez de reconstruirlos en un `FormGroup` paginado: ese último punto de MT-38-02 sigue pendiente y está documentado como brecha. Por eso no se declara cerrado todo CORR-08.

## Rutas y evidencia visual

Las rutas antiguas de la ficha fueron sustituidas por las rutas vigentes del editor:

| Ruta | 375 | 768 | 1440 claro | 1440 oscuro | Medición |
|---|---|---|---|---|---|
| `/my-account/edit` | [antes](fotos/antes/practitioner-profile-editor-375-claro.png) · [después](fotos/despues/practitioner-profile-editor-375-claro.png) | [antes](fotos/antes/practitioner-profile-editor-768-claro.png) · [después](fotos/despues/practitioner-profile-editor-768-claro.png) | [antes](fotos/antes/practitioner-profile-editor-1440-claro.png) · [después](fotos/despues/practitioner-profile-editor-1440-claro.png) | [antes](fotos/antes/practitioner-profile-editor-1440-oscuro.png) · [después](fotos/despues/practitioner-profile-editor-1440-oscuro.png) | PASS |
| `/my-account/edit?pestana=5` | [antes](fotos/antes/edit-specialties-no-switches-375-claro.png) · [después](fotos/despues/edit-specialties-no-switches-375-claro.png) | [antes](fotos/antes/edit-specialties-no-switches-768-claro.png) · [después](fotos/despues/edit-specialties-no-switches-768-claro.png) | [antes](fotos/antes/edit-specialties-no-switches-1440-claro.png) · [después](fotos/despues/edit-specialties-no-switches-1440-claro.png) | [antes](fotos/antes/edit-specialties-no-switches-1440-oscuro.png) · [después](fotos/despues/edit-specialties-no-switches-1440-oscuro.png) | PASS |

La captura adicional del control corregido compara el diálogo real abierto: [antes, switch visible](fotos/antes/specialty-edit-dialog-1440-claro.png) · [después, switch ausente](fotos/despues/specialty-edit-dialog-1440-claro.png). La cuenta demo sólo trae especialidades verificadas, que no ofrecen la acción «Editar»; para documentar este estado visual, el harness abre el diálogo real sobre la primera fila cargada, aplica la detección de cambios de Angular y comprueba el selector de especialidad visible y cero `app-switch`. Esta preparación no reemplaza la cobertura de la ruta de usuario, que se verifica en el spec de componente.

| Fase | Celdas | Rojas | Fondo claro | Centrado | Ancho ≥85 % | Scroll horizontal | Consola |
|---|---:|---:|---|---|---|---|---|
| Antes | 8 | 0 | PASS | PASS | PASS | PASS | PASS |
| Después | 8 | 0 | PASS | PASS | PASS | PASS | PASS |

Los fondos oscuros se revisaron visualmente; la matriz no puntúa el criterio de fondo blanco para esas dos celdas. La captura del contenido largo amplía el alto de viewport manteniendo el ancho probado, para que la navegación fija no se superponga a los campos.

Matrices: [antes](MATRIZ-visual-antes.md) · [después](MATRIZ-visual.md).

## Comandos y salida

- `E2E_BASE_URL=http://127.0.0.1:4202 CORR_USUARIO=medica scripts/corr-evidencia.sh 38 --antes` — PASS, 8 celdas, 0 rojas.
- `E2E_BASE_URL=http://127.0.0.1:4201 CORR_USUARIO=medica scripts/corr-evidencia.sh 38` — PASS, 8 celdas, 0 rojas.
- `corepack yarn typecheck` — PASS.
- `corepack yarn eslint src/app/features/account/my-profile/practitioner-profile-edit/practitioner-profile-edit.html src/app/features/account/my-profile/practitioner-profile-edit/practitioner-profile-edit.ts src/app/features/account/my-profile/practitioner-profile-edit/practitioner-profile-edit.spec.ts playwright/corr-evidencia.spec.ts` — PASS.
- `corepack yarn lint` — FAIL preexistente del repositorio: 246 errores `@angular-eslint/prefer-on-push-component-change-detection`, distribuidos por el árbol; los archivos de producto tocados pasan el eslint dirigido.
- `corepack yarn ng build` — PASS en la verificación del cambio; conserva avisos preexistentes de CommonJS/prerender.
- `corepack yarn ng test --watch=false --include=src/app/features/account/my-profile/practitioner-profile-edit/practitioner-profile-edit.spec.ts` — PASS, 1 archivo / 81 pruebas.
- `corepack yarn ng test --watch=false` — PASS en la repetición completa posterior al cambio, 583 archivos / 7,376 pruebas. Una corrida anterior tuvo un fallo aislado ajeno (`insurance-portability.handlers.spec.ts`, 22 frente a 14); la repetición completa quedó verde. No se cambió ni debilitó ese spec.
- `corepack yarn pw playwright/carril-19-route-health.spec.ts --workers=1` — BLOQUEADO antes del barrido: API en `http://localhost:3005` no disponible; 1 fallo de precondición y 3 pruebas sin ejecutar.
- `python3 -S scripts/atlas/fable-proof-check.py --lane 38` — NO DISPONIBLE en esta base: el archivo no existe en `mockup`.

### Reanudación — 2026-10-15

- `corepack yarn test --watch=false --include=src/app/features/auth/register-practitioner/register-practitioner.spec.ts --include=src/app/features/auth/registro-compartido/practitioner-fields.spec.ts --include=src/app/features/account/my-profile/practitioner-profile-edit/practitioner-profile-edit.spec.ts` — PASS, 3 archivos / 346 pruebas.
- `corepack yarn test --watch=false --include=src/app/features/account/my-profile/pestanas-del-perfil-medico.spec.ts --include=src/app/features/account/my-profile/practitioner-profile-edit/practitioner-profile-edit.spec.ts --include=src/app/features/auth/registro-compartido/practitioner-fields.spec.ts` — PASS, 3 archivos / 233 pruebas. El spec del mapa de campos ahora lee la definición compartida sin cargar Angular y detecta los nuevos campos del consultorio.
- `corepack yarn test --watch=false` — FAIL, 8 archivos fallidos / 770 aprobados; 73 pruebas fallidas / 10.667 aprobadas. Las tres pruebas dirigidas de esta corrección pasan.
- `corepack yarn typecheck` — PASS.
- `corepack yarn eslint src/app/features/account/my-profile/pestanas-del-perfil-medico.spec.ts src/app/features/account/my-profile/pestanas-del-perfil-medico.ts src/app/features/account/my-profile/practitioner-profile-edit/practitioner-profile-edit.ts src/app/features/account/my-profile/practitioner-profile-edit/practitioner-profile-edit.spec.ts src/app/features/auth/register-practitioner/register-practitioner.ts src/app/features/auth/registro-compartido/practitioner-fields.ts src/app/features/auth/registro-compartido/practitioner-fields.spec.ts` — PASS.
- `corepack yarn eslint` dirigido a los cinco archivos modificados — PASS.
- `E2E_BASE_URL=http://localhost:4200 CORR_USUARIO=medica scripts/corr-evidencia.sh 38` — PASS, 8 celdas, 0 rojas, `--workers=1`. Se inspeccionaron las ocho capturas de después y la captura adicional del diálogo. La matriz reporta PASS en fondo, centrado, ancho, scroll horizontal y consola.
- `corepack yarn lint` — FAIL, 268 errores globales distribuidos por el repositorio; el lint dirigido a los archivos modificados sí pasa.
- `corepack yarn build` — PASS después de la última actualización del mapa de campos; mantiene avisos existentes de CommonJS y prerender.
- `corepack yarn pw playwright/carril-19-route-health.spec.ts --workers=1` — no se volvió a ejecutar; el reporte previo registra bloqueo por API localhost:3005 no disponible.

### Revisión de código y correcciones — 2026-10-15

- La revisión encontró dos brechas: la plantilla no consumía las etiquetas/obligatoriedad del alta y el chequeo de campos requeridos sólo miraba valores incluidos en el PATCH. Se corrigieron ambas.
- El editor ahora obtiene del alta etiquetas y marcadores requeridos para nombre, apellidos, nacimiento, título, celular y correo personal. Fecha de nacimiento usa también los límites compartidos. Celular y correo personal usan validadores exportados por `practitioner-fields.ts`, consumidos tanto por el alta como por la edición.
- Antes de guardar, se comprueban los requeridos con el estado actual de la pestaña activa, aunque el campo no haya cambiado. El filtro del PATCH sigue limitando el cuerpo a esa pestaña.
- `corepack yarn test --watch=false --include=src/app/features/auth/register-practitioner/register-practitioner.spec.ts --include=src/app/features/auth/registro-compartido/practitioner-fields.spec.ts --include=src/app/features/account/my-profile/practitioner-profile-edit/practitioner-profile-edit.spec.ts` — PASS, 3 archivos / 351 pruebas.
- `corepack yarn typecheck` — PASS.
- ESLint dirigido a los archivos TS/HTML/spec tocados y `git diff --check` — PASS.
- Las ocho capturas y la captura adicional del diálogo se regeneraron el 15/10/2026 después de los marcadores de obligatoriedad; se revisaron visualmente antes de actualizar este reporte.
- No se repitieron build ni suite global en esta revisión. Continúan aplicando los bloqueos de regresión y route-health documentados arriba.

## Revisión de código

Autorrevisión secuencial sobre el diff según `.claude/agents/corr-revisor-codigo.md`:

- **Alcance / sólo visual:** PASS; archivos de producto dentro de auth y editor médico; sin cambios en API, modelo, `.env`, proxy ni archivos del plan de Paciente.
- **Aceptación:** PASS para definiciones/validadores compartidos, PATCH por pestaña y eliminación del switch de certificación.
- **Organismos / §6:** PASS; se conserva la tarjeta con pestañas y los controles `app-form-field` existentes, sin maquetación nueva ni CSS propio.
- **Tokens / modo oscuro:** PASS; no se añadieron colores, tamaños ni reglas CSS; se revisaron las capturas claras y oscuras.
- **Tests:** PASS; 351 pruebas dirigidas, sin `skip`, `xit`, `todo`, aserciones eliminadas ni tolerancias ampliadas.
- **Convención y accesibilidad:** PASS; símbolos, archivos y rutas añadidos en inglés, textos de pantalla en castellano; los campos requeridos usan `app-form-field` con controles etiquetados.
- **Rutas:** PASS; no se agregó ruta de aplicación.
- **Comandos:** PASS; typecheck y ESLint dirigido pasan. La suite global y route-health conservan los bloqueos documentados arriba.

La revisión externa anterior rechazó el diff con una lectura de la ficha que luego se corrigió. D-21 establece que los campos compartidos reutilizan definiciones y validadores, conservando controles tipados para PATCH parcial y campos propios del perfil. Autorrevisión del diff actual bajo la ficha corregida: **APROBADO**. La suite global repetida y sus fallos están documentados arriba; no se alteraron ni debilitaron tests.

## Bugs encontrados / corregidos

- La edición de una especialidad exponía el switch de certificación de junta y enviaba `boardCertified` aunque la persona sólo modificara el nombre/concepto de la especialidad. Se eliminó el control y se dejó de mandar ese campo en el PATCH.

## Riesgos residuales

- La acción de fila «Marcar como principal» continúa disponible para una especialidad adicional. No es un switch del formulario y queda documentada en D-19.
- El editor conserva señales y controles especializados, y usa `practitionerField()` para las definiciones que comparte con el alta. La ficha se ajustó para no exigir un `FormGroup` completo que forzaría el flujo de inscripción sobre PATCH parciales. La autorrevisión actual usa el criterio D-21 registrado arriba.
- No se acredita el recorrido API de salud ni el chequeo Fable mientras falten sus dependencias en este checkout.

## Decisiones

- D-19: se usa `/my-account/edit?pestana=5` para abrir Credenciales; ambas rutas de captura apuntan al editor vigente.
- D-20: la tarjeta y pestañas del editor ya están en la base actual. No se duplica el flujo; MT-38-01 se ejecutó en el worktree de esta corrección y la ficha refleja la inspección de la base.
- Reanudación 2026-10-15: MT-38-01 se ejecutó en el worktree de esta corrección. Se corrigió la lectura de MT-38-02 en TAREA-38 y se registró D-21; la autorrevisión actual pasa con ese criterio. El test de rechazo entre pestañas conserva su cobertura de enrutamiento de errores del servidor, y otro test nuevo fija que guardar una pestaña no envíe cambios de otra. Se agregó `officeContactPhone` a la pestaña del consultorio tras reactivar el fusible del mapa. La suite global repitió con 73 fallos / 10.667 aprobaciones.
