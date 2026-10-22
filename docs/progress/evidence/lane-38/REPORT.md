# REPORT — Carril 38 · CORR-08

## Veredicto: FAIL — subcambio verificado; DoD completo del carril pendiente

El cambio de esta rama elimina el switch «Certificada por el colegio o consejo» del diálogo de edición de especialidad. Al guardar una especialidad se envía únicamente `specialtyConceptId`, así que se conserva el valor de certificación preexistente.

El editor de perfil con tarjeta única, pestañas y formularios por sección ya existía en la base `mockup` usada para esta rama (`b11dfdd3`). No se reimplementó en este diff. La ficha todavía lista como pendiente compartir las definiciones de alta/edición, y requiere una actualización documentada porque su descripción del estado anterior no coincide con la base actual. Por esto el PR no declara cerrado todo CORR-08.

## Rutas y evidencia visual

Las rutas antiguas de la ficha fueron sustituidas por las rutas vigentes del editor:

| Ruta | 375 | 768 | 1440 claro | 1440 oscuro | Medición |
|---|---|---|---|---|---|
| `/my-account/edit` | [antes](fotos/antes/practitioner-profile-editor-375-claro.png) · [después](fotos/despues/practitioner-profile-editor-375-claro.png) | [antes](fotos/antes/practitioner-profile-editor-768-claro.png) · [después](fotos/despues/practitioner-profile-editor-768-claro.png) | [antes](fotos/antes/practitioner-profile-editor-1440-claro.png) · [después](fotos/despues/practitioner-profile-editor-1440-claro.png) | [antes](fotos/antes/practitioner-profile-editor-1440-oscuro.png) · [después](fotos/despues/practitioner-profile-editor-1440-oscuro.png) | PASS |
| `/my-account/edit?pestana=5` | [antes](fotos/antes/edit-specialties-no-switches-375-claro.png) · [después](fotos/despues/edit-specialties-no-switches-375-claro.png) | [antes](fotos/antes/edit-specialties-no-switches-768-claro.png) · [después](fotos/despues/edit-specialties-no-switches-768-claro.png) | [antes](fotos/antes/edit-specialties-no-switches-1440-claro.png) · [después](fotos/despues/edit-specialties-no-switches-1440-claro.png) | [antes](fotos/antes/edit-specialties-no-switches-1440-oscuro.png) · [después](fotos/despues/edit-specialties-no-switches-1440-oscuro.png) | PASS |

La captura adicional del control corregido compara el diálogo real abierto: [antes, switch visible](fotos/antes/specialty-edit-dialog-1440-claro.png) · [después, switch ausente](fotos/despues/specialty-edit-dialog-1440-claro.png). Se comprobó en DOM que la base tiene un `app-switch` y el cambio tiene cero; también se abrió y miró cada captura obligatoria.

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

## Revisión de código

Autorrevisión secuencial sobre el diff según `.claude/agents/corr-revisor-codigo.md`:

- Alcance limitado al formulario de edición de especialidad y a las rutas/capturas del carril.
- No se tocaron API, modelo, `.env`, proxy ni archivos del plan de Paciente.
- El test comprueba contenido ausente y cuerpo exacto del PATCH; no se quitó ninguna aserción ni se usó `skip`.
- Sin CSS ni tokens nuevos; sin ruta de aplicación nueva.
- Identificadores/cámaras de evidencia nuevos en inglés; texto visible del producto permanece en castellano.
- Salida de typecheck, lint global/dirigido y spec registrada arriba.

**Resultado del diff acotado: APROBADO.** La aprobación cubre este cambio y no acredita el DoD integral de la ficha.

## Bugs encontrados / corregidos

- La edición de una especialidad exponía el switch de certificación de junta y enviaba `boardCertified` aunque la persona sólo modificara el nombre/concepto de la especialidad. Se eliminó el control y se dejó de mandar ese campo en el PATCH.

## Riesgos residuales

- La acción de fila «Marcar como principal» continúa disponible para una especialidad adicional. No es un switch del formulario y queda documentada en D-19.
- El extractor compartido de definiciones/validadores de alta y edición que pide MT-38-01 no forma parte de este cambio. La diferencia entre el `FormGroup` paginado de inscripción y la edición parcial basada en señales/PATCH requiere una decisión de diseño registrada antes de alterar ese contrato.
- No se acredita el recorrido API de salud ni el chequeo Fable mientras falten sus dependencias en este checkout.

## Decisiones

- D-19: se usa `/my-account/edit?pestana=5` para abrir Credenciales; ambas rutas de captura apuntan al editor vigente.
- D-20: la tarjeta y pestañas del editor ya están en la base actual. No se duplica el flujo; se conserva como pendiente el extractor compartido de MT-38-01 y se actualiza la ficha con la inspección de la base.
