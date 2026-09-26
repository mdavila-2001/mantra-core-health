# ADR-0016: El encuentro como eje del contrato clínico

## Estado

Aceptado para el simulador de `mockup`, 2026-09-25. C0 define contratos; no acredita implementación en la API real.

## Contexto

La consulta ya recibe un paciente y un encuentro abierto. Notas, órdenes, diagnósticos y recetas conservan ese vínculo para reconstruir lo ocurrido entre profesional y paciente. La reconsulta es otra reserva vinculada a la cita original, no una nota ni un estado de esa cita.

## Decisión

- Reutilizar `Encounter` y `encounterId`; no crear otra entidad de consulta. Pasar el encuentro abierto a los bloques conservando compatibilidad desde el expediente.
- Nota médica: `ChartNote` y pares opcionales `MedicalNoteEntry { label, value }`. C1 implementará filas y validaciones (P39).
- Orden de análisis: `AnalysisCategory = LAB | IMAGING | OTHER` y `basedOnNoteIds`. C2 implementará almacenamiento, lectura y validación (P40).
- Diagnóstico presuntivo, confirmado y rechazado: una misma `Condition`. La verificación añade resultado, autor, fecha, motivo y evidencia de nota u orden/informe. C3 implementará el comando (P41); C0 devuelve un 404 explícito.
- Centralizar clasificación en `diagnosisStateOf`: rechazado prevalece; no confirmado está en estudio; confirmado y clínicamente activo sin resolución ni vencimiento es enfermedad activa; el resto es histórico. Fin igual a ahora sigue vigente. C6 agrupa rechazados con históricos sin perder registros.
- Conservar `FollowUpOrigin` y las extensiones de lectura de C4. `followUpOf` enlaza reserva y encuentro originales (P42).
- Rejilla: Nota médica, Orden de análisis, Diagnóstico, Reconsulta, Receta, Alergia, Medición, Plan de cuidados, Documento, Formulario clínico, Internación y Pagos.

## Compatibilidad

Los nuevos campos son opcionales. Las rutas de notas se trasladan a `medical-notes.handlers.ts` y el alta de órdenes a `diagnostics.handlers.ts`, manteniendo respuestas, persistencia y deduplicación de avisos.

La base ya contiene Reconsulta y análisis funcionales. Por decisión del propietario se conservan y conectan; solamente Nota médica es stub «En construcción (C1)». El rename `AnalysisOrderBlock` no cambia contratos HTTP.

No se cambia esquema ni autorización del backend. C1–C4 completan P39–P42 y C8 consolida pendientes. La entrega va por rama y PR a `mockup`; «integrado» solo se declara cuando el merge exista.

## Consecuencias y riesgos

Los contratos publicados por SHA se congelan para los carriles dependientes. Cambios incompatibles requieren coordinación explícita y pruebas de consumidores. Propiedades opcionales no prueban persistencia: C0 preserva la existente. Pruebas con fixtures sintéticas no acreditan la API real.

## Evidencia y revisión

- [Plan C0](../trabajo/2026-09-25-encuentro-clinico/c0/PLAN.md).
- [Glosario](../business/glossary.md).
- [Guardián Playwright](../testing/pw-guard.md).
- Código: `core/data-access/{clinical,chart-notes,diagnostics,scheduling}`, `shared/clinical/diagnosis-state`, `features/clinical-record/consultation`.

Revisar al implementar P39–P42 en backend, antes de promover el contrato a `dev`.
