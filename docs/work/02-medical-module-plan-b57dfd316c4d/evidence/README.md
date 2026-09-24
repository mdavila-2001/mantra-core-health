# Evidencia del plan Médico

## CORR-08 · edición de especialidad

PR borrador [#612](https://github.com/mdavila-2001/mantra-core-health/pull/612), rama `justin/mockup-corr-38-editar-perfil-medico-como-alta`. El carril tiene 8/8 celdas verdes en antes y después para fondo claro, centrado, ancho, scroll horizontal y consola. Se abrieron las capturas del editor a 375, 768 y 1440 px, claro y oscuro. La comparación del diálogo muestra el switch antes y su ausencia después; el test fija que el PATCH parcial sólo envía el concepto de especialidad. Una copia del paquete completo (reporte, matrices y 18 capturas) está archivada en `evidence/corr38/`.

El paquete completo del carril, con matrices, reporte y capturas, vive en el PR bajo `docs/progress/evidence/lane-38/`. La ficha externa fue reconciliada con la base actual en D-19/D-20; MT-38-01 y el DoD integral de CORR-08 continúan pendientes. Esta evidencia visual no eleva ningún criterio del plan médico a HECHO.

## Evidencia de módulo previa

El filtro médico específico aprobó 381 pruebas en 7 archivos con dobles, sin ejecutar suites MyProfile de Paciente. La repetición completa posterior a CORR-08 aprobó 7.376 pruebas en 583 archivos. Estos resultados acreditan pruebas unitarias/componentes, no API→DB→recarga.

Route-health volvió a fallar en `beforeAll` porque la API de localhost:3005 no está saludable; no generó fotos de ese recorrido. El verificador `scripts/atlas/fable-proof-check.py` no existe en esta base.

Una integración aislada de registro profesional aprobó 8/8 en DB desechable con semillas parciales; no ejecutó DDL canónica ni un journey end-to-end. No se guardaron datos personales reales; los fixtures del perfil inspeccionado son de la cuenta sintética de prueba.

## H2 · Dirección laboral y varias sedes propias

[`h2-work-address-sites/REPORT.md`](h2-work-address-sites/REPORT.md) registra las pruebas FE/API de lectura y edición separadas de dirección/GPS laboral y el alta de una segunda sede propia. Son pruebas unitarias con dobles HTTP, no un viaje de navegador a API/DB; no hay captura visual válida de esta continuación porque el sistema devolvió `ENOSPC` al escribir los artefactos temporales. Por eso L0180, L0184, L0185 y L0200 siguen `A MEDIAS / TESTED`.

## H1 · Editor, tipos documentales y acceso entre actores

El smoke móvil más reciente probó Chromium → API real → PostgreSQL 18 desechable para una profesional sintética. Capturas del alta, tres especialidades, las credenciales cargadas desde el perfil, diálogo de edición y estado tras recargar, junto con la especificación Playwright reproducible, están en [`h1-real-api/extended-smoke/editor/`](h1-real-api/extended-smoke/editor/). El recorrido verificó 11 credenciales con 11 PDFs únicos (tres DEGREE, dos DIPLOMA, dos MASTER, dos DOCTORATE, dos SPECIALTY), tres especialidades, edición/descarga propia y un segundo actor sin acceso al UUID ajeno. El escenario MED-E01 sigue A MEDIAS por requisitos personales y de catálogo; 10 criterios individuales quedaron HECHO/VERIFIED.
