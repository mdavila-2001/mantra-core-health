# Inventario de consumidores de `<app-data-table>` (H1.S2.M1)

Comando: `git grep -l '<app-data-table' origin/mockup -- 'src/app/**/*.html'` (corte `8ae7283a`)

30 archivos. Columna «Barra» = tiene `<app-filter-bar>` en la misma plantilla. Columna «Paginación»
= tiene `<app-pagination>` en la misma plantilla (el organismo pagina por cursor internamente; ver
`CONTRATO-data-table.md` §10.2 — ninguno de los 30 lo complementa hoy con el paginador externo).
Columna «Dueño» = sólo se asigna cuando la ficha de reparto lo declara explícitamente; el resto se
marca «sin dueño declarado» (regla 00 §1.1: no se inventa una asignación que no está por escrito).

| # | Ruta | Barra | Paginación | Dueño |
|---|---|---|---|---|
| 1 | `src/app/features/account/my-profile/practitioner-profile-edit/practitioner-profile-edit.html` | no | no | Itzan (declarado en la ficha del reparto: "las tres tablas de Configurar tu perfil") |
| 2 | `src/app/features/accounting/accounting.html` | no | no | sin dueño declarado |
| 3 | `src/app/features/admin/clinical-forms/clinical-forms.html` | no | no | sin dueño declarado |
| 4 | `src/app/features/admin/data-catalog/data-catalog.html` | no | no | sin dueño declarado |
| 5 | `src/app/features/admin/medical-laboratory/medical-laboratory.html` | no | no | sin dueño declarado |
| 6 | `src/app/features/admin/medical-organization/medical-organization.html` | no | no | sin dueño declarado |
| 7 | `src/app/features/admin/organizations/organization-detail/organization-detail.html` | no | no | sin dueño declarado |
| 8 | `src/app/features/admin/organizations/organization-list/organization-list.html` | no | no | sin dueño declarado |
| 9 | `src/app/features/admin/patients/patient-list/patient-list.html` | sí | no | sin dueño declarado |
| 10 | `src/app/features/admin/services-catalog/services-catalog.html` | no | no | sin dueño declarado |
| 11 | `src/app/features/admin/terminology/terminology-catalog.html` | no | no | sin dueño declarado |
| 12 | `src/app/features/agenda/agenda.html` | no | no | sin dueño declarado |
| 13 | `src/app/features/clinical-record/clinical-record.html` | no | no | sin dueño declarado |
| 14 | `src/app/features/clinical-record/patient-chart/patient-chart.html` | no | no | sin dueño declarado |
| 15 | `src/app/features/design-system-sample/organisms-gallery/organisms-gallery.html` | sí | no | sin dueño declarado |
| 16 | `src/app/features/diagnostics/diagnostics.html` | no | no | sin dueño declarado |
| 17 | `src/app/features/health-context/context-resolve/context-resolve.html` | no | no | sin dueño declarado |
| 18 | `src/app/features/identity-assurance/case-queue/case-queue.html` | no | no | sin dueño declarado |
| 19 | `src/app/features/identity-assurance/verification-cases/verification-cases.html` | no | no | sin dueño declarado |
| 20 | `src/app/features/insurance/broker-detail/broker-detail.html` | no | no | sin dueño declarado |
| 21 | `src/app/features/insurance/insurance-analytics/insurance-analytics.html` | no | no | sin dueño declarado |
| 22 | `src/app/features/insurance/insurance-claims/insurance-claims.html` | no | no | sin dueño declarado |
| 23 | `src/app/features/interventions/interventions.html` | no | no | sin dueño declarado |
| 24 | `src/app/features/organizations/my-organizations.html` | no | no | sin dueño declarado |
| 25 | `src/app/features/pharma-lab/doctor-visits/doctor-visits.html` | no | no | sin dueño declarado |
| 26 | `src/app/features/pharma-lab/pharma-lab-home/pharma-lab-home.html` | no | no | sin dueño declarado |
| 27 | `src/app/features/pharma-lab/visitor-visits/visitor-visits.html` | no | no | sin dueño declarado |
| 28 | `src/app/features/progress-notes/progress-notes.html` | sí | no | sin dueño declarado |
| 29 | `src/app/features/quotations/quotation-form/quotation-form.html` | no | no | sin dueño declarado |
| 30 | `src/app/features/quotations/quotation-list/quotation-list.html` | no | no | sin dueño declarado |

**Nota (Q-18, ya registrada en el reparto):** la disciplina de esta noche se aplica a «Dónde
atiendo» (fila propia, ver `work-history` — no instancia `app-data-table` hoy, se migra en H4.S1) y
a las tres tablas del perfil (fila 1, de Itzan). Las 29 filas restantes quedan inventariadas con
dueño propuesto, sin migrar esta noche (fuera de alcance, regla 00 §3).
