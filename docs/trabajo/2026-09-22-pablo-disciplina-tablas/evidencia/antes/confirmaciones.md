# Inventario de `dialogs.confirm(` (H1.S2.M2)

Comando: `git grep -n 'dialogs.confirm(' origin/mockup -- 'src/app/**/*.ts' ':!*.spec.ts'` (corte `8ae7283a`)

**41 coincidencias, 40 sitios de llamada reales** (1 es un ejemplo en el comentario de cabecera de
`dialog-service.ts:20`, no una llamada). El reparto citaba «26»: ese número está desactualizado
respecto del corte propio (regla de evidencia — gana el comportamiento real del proyecto, prioridad
#2, sobre la hipótesis del reparto, prioridad #6).

| # | Archivo:línea | Título mostrado | Qué confirma |
|---|---|---|---|
| 1 | `account/appointments/appointments.ts:1299` | «Anotarte en la lista de espera» | alta en lista de espera |
| 2 | `account/diagnostic-results/diagnostic-results.ts:350` | «Dejar de compartir» | revocar acceso |
| 3 | `account/my-profile/practitioner-profile-edit/practitioner-profile-edit.ts:1581` | título dinámico (`titulo`) | retiro de un dato del perfil |
| 4 | `account/my-profile/practitioner-profile/practitioner-profile.ts:303` | «Retirar este título» | retiro de título académico |
| 5 | **`account/my-profile/work-history/work-history.ts:896`** | «Dejar de atender acá» | retiro de consultorio (**mío**) |
| 6 | `account/pharmacy-orders/order-detail/order-detail.ts:335` | «Cancelar el pedido» | cancelación de pedido |
| 7 | `admin/data-catalog/object-detail/catalog-object-detail.ts:230` | «Aprobar la ficha» | aprobación de catálogo |
| 8 | `admin/medical-laboratory/medical-laboratory.ts:710` | «Publicar la unidad» | publicación |
| 9 | `admin/medical-laboratory/medical-laboratory.ts:827` | «Quitar ${estudio.name}» | eliminación de estudio |
| 10 | `admin/patients/patient-merge/patient-merge.ts:223` | «Confirmar la fusión» | fusión de pacientes |
| 11 | `admin/qa-lab/plan-detail/qa-plan-detail.ts:143` | «Cancelar el plan» | cancelación de plan QA |
| 12 | `agenda/agenda-create/agenda-create.ts:922` | «Limpiar el formulario» | descarte de formulario |
| 13 | `agenda/agenda-create/agenda-create.ts:1178` | título condicional (`esCambio()`) | descarte de cambios |
| 14 | `agenda/agenda.ts:1937` | «Solicitud de consulta» | decisión sobre solicitud |
| 15 | `agenda/agenda.ts:1953` | «Detalle de la cita» | navegación/detalle |
| 16 | `agenda/agenda.ts:2141` | «Historial de ${cita.paciente}» | ver historial |
| 17 | `agenda/agenda.ts:2246` | «Ya tenés una consulta en curso» | aviso de conflicto |
| 18 | `agenda/agenda.ts:2311` | título condicional (cita cerrada/no atendida) | aviso de estado |
| 19 | `agenda/agenda.ts:2703` | «Solicitud de seguro ${solicitud.numero}» | decisión sobre solicitud de seguro |
| 20 | `agenda/blocks/blocks.ts:369` | «Quitar este bloqueo» | eliminación de bloqueo |
| 21 | `agenda/my-agenda/my-agenda.ts:1040` | «Agregar un horario fuera de tu horario de atención» | alta de horario excepcional |
| 22 | `agenda/my-agenda/my-agenda.ts:1309` | «Detalle del rato ocupado» | ver detalle |
| 23 | `agenda/my-agenda/my-agenda.ts:1335` | «Detalle de la cita» | navegación/detalle |
| 24 | `agenda/my-agenda/my-agenda.ts:1540` | «Cerrar este rato» | cierre de bloque horario |
| 25 | `agenda/my-agenda/my-agenda.ts:1790` | «Retirar este horario» | retiro de horario |
| 26 | `clinical-record/consultation/consultation.ts:693` | «¿Cerrar el encuentro?» | cierre de consulta |
| 27 | `clinical-record/patient-chart/admission-block/admission-block.ts:244` | «¿Dar de alta la internación?» | alta de internación |
| 28 | `clinical-record/patient-chart/medication-block/medication-block.ts:1009` | «¿Emitir la receta?» | emisión de receta |
| 29 | `clinical-record/patient-chart/medication-block/medication-block.ts:1097` | título en variable | acción sobre medicación |
| 30 | `clinical-record/patient-chart/patient-chart.ts:728` | «¿Descartar lo escrito?» | descarte de borrador |
| 31 | `clinical-record/patient-chart/patient-chart.ts:1087` | «¿Descartar el cambio de estado?» | descarte de cambio |
| 32 | `delegated-access/expiry-sweep/expiry-sweep.ts:55` | «¿Ejecutar el barrido de expiración?» | ejecución de barrido |
| 33 | `design-system-sample/design-system-sample.ts:380` | «Anular la orden de laboratorio» | ejemplo de galería |
| 34 | `design-system-sample/design-system-sample.ts:391` | «Guardar la evolución» | ejemplo de galería |
| 35 | `identity-assurance/case-expire-sweep/case-expire-sweep.ts:54` | «¿Barrer los casos vencidos?» | ejecución de barrido |
| 36 | `insurance/insurance-claim-detail/insurance-claim-detail.ts:237` | «Reclamar esta solicitud» | reclamo de solicitud |
| 37 | `shared/components/organisms/attachment-dialog/attachment-dialog.ts:166` | «¿Descartar los archivos elegidos?» | descarte de adjuntos |
| 38 | `shared/components/organisms/form-actions/form-actions.ts:92` | título dinámico (`confirmTitle()`) | confirmación genérica de formulario (pieza compartida) |
| 39 | `shared/components/organisms/paginated-form/paginated-form.ts:618` | título dinámico (`confirmTitle()`) | confirmación genérica de formulario paginado (pieza compartida) |
| 40 | `shared/components/organisms/tutorial-overlay/tutorial-overlay.ts:221` | «Dejar el tutorial» | salida de tutorial |

Excluido de la cuenta: `shared/components/molecules/dialog/dialog-service.ts:20` — es el ejemplo en
el comentario JSDoc de la propia pieza, no una llamada real.

**Relevante para D-08 (guardar pide confirmación):** ninguna de las 40 llamadas de arriba confirma
un **guardado** de formulario; todas confirman retiro, descarte, cierre o una decisión de flujo. La
pieza `confirmarCambios()` que el ADR-0015 va a pedirle a Marcelo (H2.S1) **no existe todavía** en
el código — se verifica su ausencia con:
`git grep -c 'confirmarCambios' origin/mockup -- 'src/app/shared/components/molecules/dialog/*.ts'` → 0.
