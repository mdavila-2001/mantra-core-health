/* ============================================================================
    Datos sintéticos del **Hospital Piloto extendido** (CONTRATO-GOBIERNO §10) que no necesitan
    lógica: las 11 reglas SoD de plataforma, los ajustes de gobierno y las banderas de pacientes.
    Archivo de datos (`*.data.ts`): exento de `check-max-lines`.
   ========================================================================== */
import type { GovernanceSettings, SodRule } from '../../data-access/access-governance/governance-rules.types';

/** Las 11 reglas SoD de plataforma (`delegated_access/domain/support-sod.ts`). Solo lectura: el mock las devuelve con `platform: true`. */
export const REGLAS_SOD_DE_PLATAFORMA: readonly SodRule[] = [
  { code: 'SOD-BILL-01', name: 'Cobrar y anular', atomsA: ['billing.payment.collect'], atomsB: ['billing.receipt.void'], scope: 'PERSON', action: 'BLOCK', isHard: true, maxExceptionDays: null, rationale: 'Quien cobra no debe poder anular el comprobante de lo que cobró.', platform: true },
  { code: 'SOD-BILL-02', name: 'Cobrar y devolver', atomsA: ['billing.payment.collect'], atomsB: ['billing.payment.refund'], scope: 'PERSON', action: 'BLOCK', isHard: true, maxExceptionDays: null, rationale: 'Quien cobra no debe poder devolver el dinero que cobró.', platform: true },
  { code: 'SOD-BILL-03', name: 'Crear citas y emitir comprobantes', atomsA: ['agenda.appointment.create', 'agenda.appointment.walk_in'], atomsB: ['billing.receipt.issue'], scope: 'PERSON', action: 'REQUIRE_APPROVAL', isHard: false, maxExceptionDays: 90, rationale: 'Crear una atención y facturarla en una sola persona permite cobros ficticios; en consultorios pequeños se admite con excepción.', platform: true },
  { code: 'SOD-BILL-04', name: 'Descontar y cobrar', atomsA: ['billing.discount.apply'], atomsB: ['billing.payment.collect'], scope: 'PERSON', action: 'WARN', isHard: false, maxExceptionDays: null, rationale: 'Quien aplica descuentos y también cobra puede quedarse con la diferencia: se advierte y aparece en el tablero.', platform: true },
  { code: 'SOD-BILL-05', name: 'Emitir y anular el mismo comprobante', atomsA: ['billing.receipt.issue'], atomsB: ['billing.receipt.void'], scope: 'TRANSACTION', action: 'BLOCK', isHard: true, maxExceptionDays: null, rationale: 'Una misma persona no puede emitir y anular un mismo comprobante.', platform: true },
  { code: 'SOD-PAT-01', name: 'Registrar pacientes y corregir datos verificados', atomsA: ['patients.profile.register', 'patients.guardian.record'], atomsB: ['patients.profile.edit_verified'], scope: 'PERSON', action: 'BLOCK', isHard: true, maxExceptionDays: null, rationale: 'Quien registra una identidad no debe poder corregirla después de verificada.', platform: true },
  { code: 'SOD-PAT-02', name: 'Registrar y fusionar fichas', atomsA: ['patients.profile.register'], atomsB: ['patients.profile.merge_request'], scope: 'PERSON', action: 'REQUIRE_APPROVAL', isHard: false, maxExceptionDays: 90, rationale: 'Registrar y fusionar fichas en una sola persona facilita ocultar duplicados.', platform: true },
  { code: 'SOD-GOV-01', name: 'Solicitar y aprobar (acceso)', atomsA: ['@request'], atomsB: ['@decide'], scope: 'TRANSACTION', action: 'BLOCK', isHard: true, maxExceptionDays: null, rationale: 'Nadie aprueba su propia solicitud de acceso.', platform: true },
  { code: 'SOD-GOV-02', name: 'Otorgar y certificar', atomsA: ['team.grants.assign'], atomsB: ['team.campaigns.review'], scope: 'TRANSACTION', action: 'BLOCK', isHard: true, maxExceptionDays: null, rationale: 'Quien otorgó o aprobó una concesión no la certifica en la campaña.', platform: true },
  { code: 'SOD-GOV-03', name: 'Administrar el equipo y manejar caja', atomsA: ['team.grants.assign', 'team.requests.decide'], atomsB: ['billing.payment.collect', 'billing.receipt.issue'], scope: 'PERSON', action: 'REQUIRE_APPROVAL', isHard: false, maxExceptionDays: 90, rationale: 'Quien reparte permisos no debería manejar dinero con los suyos.', platform: true },
  { code: 'SOD-AUD-01', name: 'Auditar y operar', atomsA: ['audit.activity.view_org', 'audit.activity.export', 'audit.reports.governance.view'], atomsB: ['billing.payment.collect', 'billing.receipt.void', 'agenda.appointment.cancel', 'patients.profile.edit_verified'], scope: 'PERSON', action: 'REQUIRE_APPROVAL', isHard: false, maxExceptionDays: 90, rationale: 'Quien audita no debería operar lo que audita.', platform: true },
];

/** Ajustes de gobierno del piloto (§10.3). */
export const AJUSTES_DE_GOBIERNO_DEL_PILOTO: GovernanceSettings = {
  onboardingRequired: true,
  onboardingRequiredSince: '2026-11-02',
  inactivityDays: 45,
  unusedDays: 60,
  autoSuspendInactiveDays: null,
  reviewCadenceMonths: 6,
  maxSodExceptionDays: 90,
  creepThreshold: 15,
  fourEyesActionTtlMinutes: 60,
  suspensionReviewAfterDays: 60,
};

/** Los valores por omisión de la API cuando la organización no guardó ajustes propios. */
export const AJUSTES_DE_GOBIERNO_POR_OMISION: GovernanceSettings = {
  onboardingRequired: false,
  onboardingRequiredSince: null,
  inactivityDays: 45,
  unusedDays: 60,
  autoSuspendInactiveDays: null,
  reviewCadenceMonths: 6,
  maxSodExceptionDays: 90,
  creepThreshold: 15,
  fourEyesActionTtlMinutes: 60,
  suspensionReviewAfterDays: 60,
};
