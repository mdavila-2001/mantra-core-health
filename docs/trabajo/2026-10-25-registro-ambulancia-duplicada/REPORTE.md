# Reporte — Registro de paciente: «Servicio de ambulancia» sin duplicados

- Fecha: 2026-10-25 · Plan: [PLAN.md](./PLAN.md) · Rama(s): `leonardo/fix-registro-ambulancia-duplicada-dev`, `leonardo/fix-registro-ambulancia-duplicada-test`
- Peldaño de evidencia alcanzado: **`VERIFIED`** en el navegador, contra `ng serve` en modo demo (camino real hasta el paso 3, DOM y accesibilidad observados). **No** `REGRESSION_VERIFIED`: la suite completa no se corrió con este cambio y los checks de GitHub no existen (ver «No cubierto»).
- Avance: 5 / 5 microtareas (100 %) — H1.S1.M1 a M5.

## Completado

| ID | Qué se logró | Comando / observación | Resultado |
|---|---|---|---|
| H1.S1.M1 | Causa localizada: el motor envuelve cada campo `custom` en un `app-form-field` (`paginated-form.html:47`) y la plantilla lo envolvía de nuevo | lectura de `paginated-form.html` y `register-patient.html` | confirmada por el revisor y por el DOM |
| H1.S1.M2 | El campo se declara con `label: ''`; el `app-form-field` de la plantilla (que cablea el selector) se conserva | `git diff` (2 archivos) | aplicado |
| H1.S1.M3 | Prueba de regresión de duplicado y de accesibilidad | `yarn ng test --watch=false --include …/register-patient.spec.ts` | con arreglo 143/143; **sin arreglo** falla con `expected 2 to be 1` |
| H1.S1.M4 | Verificado en la pantalla real | `evidencia/a11y-navegador-despues.txt`, `evidencia/ambulancia-despues.png` | título 1, ayuda 1, `label for` = id del selector, `aria-describedby` con hint y description, 1 combobox con nombre «Servicio de ambulancia» |
| H1.S1.M5 | `lint`, `typecheck` y el spec en la base de `dev` y en la de `test` | `yarn lint` = 0 · `yarn typecheck` = 0 · spec `dev` 143/143 · spec `test` 140/140 | verde |

## A medias

Ninguna.

## Pendiente

Ninguna dentro de este arreglo. Fuera de él, ver «Riesgos residuales».

## Evidencia

```text
dev  / con arreglo  : Test Files 1 passed · Tests 143 passed (143)        evidencia/con-arreglo-dev-base.txt
test / con arreglo  : Test Files 1 passed · Tests 140 passed (140)        evidencia/con-arreglo-test-base.txt
dev  / sin arreglo  : Tests 1 failed | 142 passed — AssertionError: expected 2 to be 1   evidencia/sin-arreglo-dev-base.txt
navegador (después) : TEXTO {"titulo":1,"ayuda":1}
                      control id mch-field-52-control · label for mch-field-52-control
                      aria-describedby "mch-field-52-hint mch-field-52-description"
                      combobox_con_nombre_Servicio_de_ambulancia: 1
navegador (antes)   : dos <label> «Servicio de ambulancia»; el externo con for="mch-field-51-control", un id que no existe (etiqueta huérfana)
```

## No cubierto

- No se corrió la suite completa con este cambio; sólo el spec del registro (el cambio es de una pantalla).
- No se auditó con axe ni con un lector de pantalla; la accesibilidad se verificó leyendo el DOM.
- No hay checks de GitHub (el CI propio del repo está caído, `CLAUDE.md`): la mergeabilidad se informa con `gh pr view`.
- Producción (Coolify/Contabo) sólo mostrará el arreglo tras el despliegue del PR; no se probó allí.

## Desvíos del plan

- **La primera versión del arreglo introdujo una regresión de accesibilidad.** Quitaba el `app-form-field` de la plantilla; el `app-select` recibe `label`, `id` y `aria-describedby` únicamente por inyección del `app-form-field` que tiene encima, y una plantilla declarada fuera del motor no recibe el del motor. Resultado en el navegador: 0 comboboxes con nombre y sin `aria-describedby`. Lo detectó un revisor independiente leyendo el código; se confirmó en el DOM y se rehízo con la convención del propio formulario (`label: ''`). La prueba de la primera versión sólo contaba textos y no lo habría detectado: la actual comprueba `label[for]` y `aria-describedby`.
- El plan se escribió después de localizar la causa y antes de subir el cambio, no antes de tocar código (§2.1).

## Riesgos residuales

- Los campos `custom` con `label: ''` dependen de que el motor no pinte una etiqueta vacía; es el patrón ya en uso (`name`, `additionalPhones`, `additionalEmergencyContacts`) y no se vio ningún hueco en la captura.
- Un revisor señaló que `billing`, `transaction-dialog`, `insurance-*`, `name-fields` y `register-practitioner` no se clasificaron: podrían tener el mismo patrón en otras pantallas. No se tocaron (§1.3, diff mínimo); queda anotado.

## Decisiones y ambigüedades

- Se eligió declarar el campo sin textos en el `.ts` y conservar el `app-form-field` de la plantilla, en vez de modificar el motor compartido `paginated-form` para inyectar el contexto (`ngTemplateOutletInjector`). Motivo: menor superficie (no toca un organismo compartido por otras pantallas). Quien mantenga `paginated-form` podría preferir la otra vía; confirmarlo con esa persona.
