# Hito 2 - reporte de integracion

Estado de ejecucion: EN CURSO. Este reporte se actualiza con cada gate; no certifica cierre.

## Completado

| ID | Resultado | Comando | Evidencia |
|---|---|---|---|
| H2.S1.M1-M3 | Worktree aislado desde dev, referencias y plan versionados antes del codigo | git rev-parse; git log | 01-input-refs.txt; d9eabb8b |
| H2.S1.M4 | Contratos reales diferenciados de demo | Inspeccion de fuentes H1 y consumidores | MATRIZ.md, 53 enlaces locales validos |
| H2.S2.M1 | Merge mockup con 113 conflictos resueltos individualmente | git merge; corepack yarn typecheck | b11d57f7; 06-typecheck.txt exit 0 |
| H2.S3.M1 | Tipos de app/Cypress/Playwright integrados | corepack yarn typecheck | 11-typecheck-integrated.txt exit 0; previo a nuevas suites de navegador |
| H2.S2.M4 | Entornos reales sin datos fabricados y demo explicita | node scripts/check-real-api-config.mjs | PASS: API real por defecto, demo explicita y production-api con SSR. |

## A medias

- H2.S2.M2-M9: resoluciones y adaptaciones escritas, segundo merge aun no registrado. Compila la aplicacion; faltan pruebas unitarias/plantillas/regresion y revision de validaciones de alta. Codigo en la rama aislada y decisiones en evidencia/merge-decisions.jsonl.
- H2.S3.M7: las tres suites solicitadas estan en ejecucion. No hay resultado aprobado todavia. Salida en evidencia/12-directed-requested.txt.

## Pendiente

- Completar builds, presupuestos, lint, cobertura y gates individualmente.
- Ejecutar Chromium serial con capturas 390/1440 y revision independiente.
- Ejercitar SSR construido y API real disponible; los contratos ausentes de H1 bloquean su certificacion real.
- Reporte final, commits, publicacion y PR hacia dev con ambos reviewers, mergeabilidad y checks remotos.

## Evidencia

Los archivos bajo evidencia/ son salidas del comando indicado en su nombre o decisiones de merge. Los fallos iniciales se conservan junto a la comprobacion posterior, no se presentan como resultado final.

- Instalacion inicial reproducible: corepack yarn install --immutable, exit 0. Advertencias peer/build scripts registradas en 03-install.txt.
- Typecheck inicial fallo por duplicados y ruta retirada: 05-typecheck-initial.txt. Corregido, exit 0 en 06-typecheck.txt.
- Typecheck tras test fallo por diagnosticUnitId duplicado y ValidationIssue.message: 09-typecheck-integrated.txt. Corregido, exit 0 en 11-typecheck-integrated.txt.

## No cubierto

Ningun flujo de navegador ni persistencia en API real ha sido certificado todavia en esta integracion. H1 PR #520 sigue siendo la fuente de codigo; su DDL/runtime no cuentan con evidencia completada. Ver MATRIZ.md por endpoint.

## Desvios y riesgos residuales

- Conflictos reales: 113 en mockup y 42 en test. No se aplico seleccion global de rama.
- Se eliminaron solamente miembros identicos duplicados y se respeto la retirada documentada de progress-notes por C1; la nota vive en la consulta.
- P39: filas estructuradas se serializan a objectiveText para el contrato real existente; demo conserva entries. Persistencia real pendiente.
- La regla de receta con diagnostico confirmado del mock no esta implementada por H1. Su 400 no prueba paridad con la API.
- Los historicos divergentes se preservan con su procedencia en evidencia/historical-dev y historical-test; no se sustituyen sus resultados por afirmaciones nuevas.
- La API real no publica varios portales/acciones de laboratorio, contabilidad y aseguradora. Un verde demo no elimina esos pendientes.
- La revision humana precede cualquier merge del PR. Esta entrega no promueve dev a test/mockup.

## Checkpoint unitario intermedio

`13-directed-integrated.txt`: 11 archivos; 7 aprobados y 4 fallidos; 153 pruebas aprobadas y 7 fallidas (dos suites adicionales no arrancaron por vi.mock relativo incompatible con Angular). PatientChart, Menu, mock-backend, los dos entornos y ruta farmacia aprobaron. Altas demo recibieron 422 por validaciones antiguas. Se repararon ambas causas sin reducir aserciones; repeticion en 14-directed-integrated.txt.

La revision independiente encontro y se corrigio tambien el escenario de enmienda que enviaba patientProfileId (no pertenece al DTO de versiones), y la emision doble de diagnosticUnitId en el mock. La identificacion del representante sigue exigida en contratos antiguos, con excepcion declarada para formas demo posteriores.

Instalacion: los tres SHA ya usaban node-modules. El diagnostico PnP del plan era incorrecto; preferencia consultada, ver PLAN. No se presenta la instalacion inicial aprobada como validacion PnP.
