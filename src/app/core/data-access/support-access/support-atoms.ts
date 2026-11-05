/* ============================================================================
    Catálogo de **permisos atómicos** del personal de apoyo (73), con sus metadatos.

    Espejo de `CONTRATO-GOBIERNO.md` §2.2 y de `PERMISSION_ATOMS` del backend
    (`delegated_access/domain/support-permission-catalog.ts`). La API es la fuente de
    verdad (`GET /org/permission-catalog`); esta tabla existe para el mock, para los
    rótulos del editor mientras carga el catálogo y para las pruebas de contrato.

    Los 15 códigos antiguos (`schedule.view`, …) siguen vigentes como **alias**: cada uno
    se expande, al leer, a los átomos de su paquete (§2.3).
   ========================================================================== */

/** Los 73 códigos de átomo, en el orden canónico del catálogo. */
export const SUPPORT_ATOM_CODES = [
  'agenda.appointment.view',
  'agenda.appointment.view.patient_name',
  'agenda.appointment.view.patient_phone',
  'agenda.appointment.view.patient_document',
  'agenda.appointment.view.reason',
  'agenda.appointment.view.insurance',
  'agenda.appointment.view.price',
  'agenda.appointment.create',
  'agenda.appointment.create.overbook',
  'agenda.appointment.reschedule',
  'agenda.appointment.cancel',
  'agenda.appointment.confirm',
  'agenda.appointment.check_in',
  'agenda.appointment.no_show',
  'agenda.appointment.walk_in',
  'agenda.waitlist.manage',
  'agenda.reminder.send',
  'agenda.block.create',
  'agenda.block.remove',
  'agenda.hours.edit',
  'patients.search.exact',
  'patients.profile.view_basic',
  'patients.profile.view.phone_full',
  'patients.profile.view.document_full',
  'patients.coverage.view',
  'patients.profile.register',
  'patients.guardian.record',
  'patients.profile.edit_contact',
  'patients.profile.edit_verified',
  'patients.profile.merge_request',
  'patients.clinical.request_temporary_access',
  'messages.inbox.view',
  'messages.conversation.reply_on_behalf',
  'messages.conversation.assign',
  'messages.conversation.resolve',
  'messages.note.create_internal',
  'messages.template.use',
  'messages.template.manage',
  'messages.attachment.send',
  'messages.broadcast.send',
  'billing.invoice.view',
  'billing.payment.collect',
  'billing.receipt.issue',
  'billing.receipt.void',
  'billing.payment.refund',
  'billing.discount.apply',
  'billing.cashbox.close',
  'reports.agenda.view',
  'reports.agenda.export',
  'reports.billing.view',
  'reports.billing.export',
  'team.members.view',
  'team.invitations.create',
  'team.requests.decide',
  'team.grants.assign',
  'team.grants.revoke',
  'team.engagement.recertify',
  'team.engagement.suspend',
  'team.engagement.reactivate',
  'team.engagement.end',
  'team.handover.execute',
  'team.campaigns.review',
  'team.campaigns.manage',
  'team.sod.exception.request',
  'team.templates.manage',
  'team.guardrails.manage',
  'team.sod.manage',
  'team.sessionpolicy.manage',
  'audit.activity.view_team',
  'audit.activity.view_org',
  'audit.activity.export',
  'audit.decisions.explain',
  'audit.reports.governance.view',
] as const;

/** Código de un permiso atómico. */
export type SupportAtom = (typeof SUPPORT_ATOM_CODES)[number];

/** Sensibilidad (`authz:SENSITIVITY_*`): pesa 1, 2, 5 y 10 en el puntaje de privilegios. */
export type AtomSensitivity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export const ATOM_SENSITIVITY_WEIGHT: Readonly<Record<AtomSensitivity, number>> = { LOW: 1, MEDIUM: 2, HIGH: 5, CRITICAL: 10 };
export const ATOM_SENSITIVITY_LABELS: Readonly<Record<AtomSensitivity, string>> = { LOW: 'Baja', MEDIUM: 'Media', HIGH: 'Alta', CRITICAL: 'Crítica' };

/** Quién aprueba (cuatro ojos) un permiso que lo exige. */
export type AtomApprovalMode = 'DOCTOR' | 'SECOND_APPROVER';
export type AtomPurpose = 'TREATMENT' | 'PAYMENT' | 'OPERATIONS';
export type AtomLegalBasis = 'TREATMENT' | 'CONSENT' | 'LEGAL_OBLIGATION' | 'HEALTHCARE_OPERATIONS';

/** Categorías de la pantalla (`authz.permission_categories`). */
export const ATOM_CATEGORY_CODES = ['SUPPORT_AGENDA', 'SUPPORT_PATIENTS', 'SUPPORT_MESSAGING', 'SUPPORT_BILLING', 'SUPPORT_REPORTS', 'SUPPORT_TEAM', 'SUPPORT_AUDIT'] as const;
export type AtomCategoryCode = (typeof ATOM_CATEGORY_CODES)[number];
export const ATOM_CATEGORY_LABELS: Readonly<Record<AtomCategoryCode, string>> = {
  SUPPORT_AGENDA: 'Agenda',
  SUPPORT_PATIENTS: 'Pacientes',
  SUPPORT_MESSAGING: 'Mensajería',
  SUPPORT_BILLING: 'Facturación y caja',
  SUPPORT_REPORTS: 'Reportes',
  SUPPORT_TEAM: 'Equipo de apoyo',
  SUPPORT_AUDIT: 'Auditoría y explicación',
};

/** Un permiso atómico con sus metadatos (la misma forma que `GET /org/permission-catalog` → `atoms[]`). */
export interface PermissionAtomMeta {
  readonly code: SupportAtom;
  readonly name: string;
  readonly category: AtomCategoryCode;
  readonly sensitivity: AtomSensitivity;
  readonly requiresReason: boolean;
  readonly requiresStepUp: boolean;
  readonly approvalMode: AtomApprovalMode | null;
  readonly purposeOfUse: AtomPurpose;
  readonly legalBasis: AtomLegalBasis;
  readonly touchesClinicalData: boolean;
  readonly isFieldLevel: boolean;
  readonly supportAssignable: boolean;
  readonly isDangerous: boolean;
}

type AtomRow = readonly [SupportAtom, string, AtomSensitivity, 0 | 1, 0 | 1, AtomApprovalMode | null, AtomPurpose, AtomLegalBasis, 0 | 1, 0 | 1, 0 | 1];

const CATEGORY_BY_MODULE: Readonly<Record<string, AtomCategoryCode>> = {
  agenda: 'SUPPORT_AGENDA',
  patients: 'SUPPORT_PATIENTS',
  messages: 'SUPPORT_MESSAGING',
  billing: 'SUPPORT_BILLING',
  reports: 'SUPPORT_REPORTS',
  team: 'SUPPORT_TEAM',
  audit: 'SUPPORT_AUDIT',
};

// prettier-ignore
const ATOM_ROWS: readonly AtomRow[] = [
  ['agenda.appointment.view', 'Ver la agenda (horarios y estado de las citas)', 'LOW', 0, 0, null, 'TREATMENT', 'TREATMENT', 0, 0, 1],
  ['agenda.appointment.view.patient_name', 'Ver el nombre del paciente en la cita', 'MEDIUM', 0, 0, null, 'TREATMENT', 'TREATMENT', 0, 1, 1],
  ['agenda.appointment.view.patient_phone', 'Ver el teléfono del paciente en la cita', 'MEDIUM', 0, 0, null, 'TREATMENT', 'TREATMENT', 0, 1, 1],
  ['agenda.appointment.view.patient_document', 'Ver el documento del paciente en la cita', 'HIGH', 0, 0, null, 'TREATMENT', 'TREATMENT', 0, 1, 1],
  ['agenda.appointment.view.reason', 'Ver el motivo de consulta', 'HIGH', 0, 0, null, 'TREATMENT', 'TREATMENT', 1, 1, 1],
  ['agenda.appointment.view.insurance', 'Ver la aseguradora del paciente en la cita', 'MEDIUM', 0, 0, null, 'PAYMENT', 'TREATMENT', 0, 1, 1],
  ['agenda.appointment.view.price', 'Ver el precio de la cita', 'LOW', 0, 0, null, 'PAYMENT', 'TREATMENT', 0, 1, 1],
  ['agenda.appointment.create', 'Crear citas', 'MEDIUM', 0, 0, null, 'TREATMENT', 'TREATMENT', 0, 0, 1],
  ['agenda.appointment.create.overbook', 'Crear citas con sobrecupo', 'HIGH', 1, 0, 'DOCTOR', 'TREATMENT', 'TREATMENT', 0, 0, 1],
  ['agenda.appointment.reschedule', 'Reprogramar citas', 'MEDIUM', 1, 0, null, 'TREATMENT', 'TREATMENT', 0, 0, 1],
  ['agenda.appointment.cancel', 'Cancelar citas', 'MEDIUM', 1, 0, null, 'TREATMENT', 'TREATMENT', 0, 0, 1],
  ['agenda.appointment.confirm', 'Confirmar citas', 'LOW', 0, 0, null, 'TREATMENT', 'TREATMENT', 0, 0, 1],
  ['agenda.appointment.check_in', 'Registrar la llegada del paciente', 'LOW', 0, 0, null, 'TREATMENT', 'TREATMENT', 0, 0, 1],
  ['agenda.appointment.no_show', 'Marcar al paciente como ausente', 'MEDIUM', 0, 0, null, 'TREATMENT', 'TREATMENT', 0, 0, 1],
  ['agenda.appointment.walk_in', 'Atender a un paciente sin cita previa', 'MEDIUM', 0, 0, null, 'TREATMENT', 'TREATMENT', 0, 0, 1],
  ['agenda.waitlist.manage', 'Gestionar la lista de espera', 'LOW', 0, 0, null, 'TREATMENT', 'TREATMENT', 0, 0, 1],
  ['agenda.reminder.send', 'Enviar recordatorios de cita', 'LOW', 0, 0, null, 'TREATMENT', 'TREATMENT', 0, 0, 1],
  ['agenda.block.create', 'Bloquear horarios de la agenda', 'MEDIUM', 1, 0, null, 'OPERATIONS', 'HEALTHCARE_OPERATIONS', 0, 0, 1],
  ['agenda.block.remove', 'Quitar bloqueos de la agenda', 'MEDIUM', 0, 0, null, 'OPERATIONS', 'HEALTHCARE_OPERATIONS', 0, 0, 1],
  ['agenda.hours.edit', 'Cambiar los horarios de atención del doctor', 'HIGH', 1, 1, 'DOCTOR', 'OPERATIONS', 'HEALTHCARE_OPERATIONS', 0, 0, 1],
  ['patients.search.exact', 'Buscar pacientes (búsqueda exacta)', 'MEDIUM', 0, 0, null, 'TREATMENT', 'TREATMENT', 0, 0, 1],
  ['patients.profile.view_basic', 'Ver la ficha básica del paciente (nombre, edad, contacto parcial)', 'MEDIUM', 0, 0, null, 'TREATMENT', 'TREATMENT', 0, 0, 1],
  ['patients.profile.view.phone_full', 'Ver el teléfono completo del paciente', 'MEDIUM', 0, 0, null, 'TREATMENT', 'TREATMENT', 0, 1, 1],
  ['patients.profile.view.document_full', 'Ver el documento completo del paciente', 'HIGH', 1, 0, null, 'TREATMENT', 'TREATMENT', 0, 1, 1],
  ['patients.coverage.view', 'Ver la cobertura o seguro vigente del paciente', 'MEDIUM', 0, 0, null, 'PAYMENT', 'TREATMENT', 0, 0, 1],
  ['patients.profile.register', 'Registrar pacientes nuevos', 'MEDIUM', 0, 0, null, 'TREATMENT', 'TREATMENT', 0, 0, 1],
  ['patients.guardian.record', 'Anotar al representante de un menor (queda pendiente de verificación)', 'MEDIUM', 0, 0, null, 'TREATMENT', 'TREATMENT', 0, 0, 1],
  ['patients.profile.edit_contact', 'Corregir datos de contacto del paciente', 'MEDIUM', 1, 0, null, 'TREATMENT', 'TREATMENT', 0, 0, 1],
  ['patients.profile.edit_verified', 'Corregir datos verificados (nombre, documento, nacimiento)', 'CRITICAL', 1, 1, 'SECOND_APPROVER', 'TREATMENT', 'LEGAL_OBLIGATION', 0, 0, 1],
  ['patients.profile.merge_request', 'Pedir la fusión de fichas duplicadas', 'HIGH', 1, 0, 'SECOND_APPROVER', 'TREATMENT', 'TREATMENT', 0, 0, 1],
  ['patients.clinical.request_temporary_access', 'Pedir acceso clínico temporal a un paciente', 'HIGH', 1, 1, 'DOCTOR', 'TREATMENT', 'CONSENT', 1, 0, 1],
  ['messages.inbox.view', 'Ver la bandeja de mensajes del doctor', 'MEDIUM', 0, 0, null, 'TREATMENT', 'TREATMENT', 0, 0, 1],
  ['messages.conversation.reply_on_behalf', 'Responder mensajes administrativos en nombre del doctor', 'MEDIUM', 0, 0, null, 'TREATMENT', 'TREATMENT', 0, 0, 1],
  ['messages.conversation.assign', 'Asignar conversaciones a una persona del equipo', 'LOW', 0, 0, null, 'OPERATIONS', 'HEALTHCARE_OPERATIONS', 0, 0, 1],
  ['messages.conversation.resolve', 'Marcar conversaciones como resueltas', 'LOW', 0, 0, null, 'OPERATIONS', 'HEALTHCARE_OPERATIONS', 0, 0, 1],
  ['messages.note.create_internal', 'Escribir notas internas del equipo', 'LOW', 0, 0, null, 'OPERATIONS', 'HEALTHCARE_OPERATIONS', 0, 0, 1],
  ['messages.template.use', 'Usar respuestas preparadas', 'LOW', 0, 0, null, 'OPERATIONS', 'HEALTHCARE_OPERATIONS', 0, 0, 1],
  ['messages.template.manage', 'Administrar respuestas preparadas', 'MEDIUM', 0, 0, null, 'OPERATIONS', 'HEALTHCARE_OPERATIONS', 0, 0, 1],
  ['messages.attachment.send', 'Enviar archivos adjuntos a pacientes', 'HIGH', 0, 0, null, 'TREATMENT', 'TREATMENT', 0, 0, 1],
  ['messages.broadcast.send', 'Enviar mensajes masivos a pacientes', 'HIGH', 1, 0, 'SECOND_APPROVER', 'OPERATIONS', 'HEALTHCARE_OPERATIONS', 0, 0, 1],
  ['billing.invoice.view', 'Ver cobros y comprobantes emitidos', 'MEDIUM', 0, 0, null, 'PAYMENT', 'LEGAL_OBLIGATION', 0, 0, 1],
  ['billing.payment.collect', 'Cobrar la atención', 'HIGH', 0, 0, null, 'PAYMENT', 'LEGAL_OBLIGATION', 0, 0, 1],
  ['billing.receipt.issue', 'Emitir comprobantes', 'HIGH', 0, 0, null, 'PAYMENT', 'LEGAL_OBLIGATION', 0, 0, 1],
  ['billing.receipt.void', 'Anular comprobantes', 'CRITICAL', 1, 1, 'SECOND_APPROVER', 'PAYMENT', 'LEGAL_OBLIGATION', 0, 0, 1],
  ['billing.payment.refund', 'Devolver pagos', 'CRITICAL', 1, 1, 'SECOND_APPROVER', 'PAYMENT', 'LEGAL_OBLIGATION', 0, 0, 1],
  ['billing.discount.apply', 'Aplicar descuentos', 'HIGH', 1, 0, null, 'PAYMENT', 'LEGAL_OBLIGATION', 0, 0, 1],
  ['billing.cashbox.close', 'Cerrar la caja del día', 'HIGH', 0, 1, null, 'PAYMENT', 'LEGAL_OBLIGATION', 0, 0, 1],
  ['reports.agenda.view', 'Ver reportes de agenda (sin datos de pacientes)', 'LOW', 0, 0, null, 'OPERATIONS', 'HEALTHCARE_OPERATIONS', 0, 0, 1],
  ['reports.agenda.export', 'Exportar listados de agenda con pacientes', 'HIGH', 1, 1, null, 'OPERATIONS', 'HEALTHCARE_OPERATIONS', 0, 0, 1],
  ['reports.billing.view', 'Ver reportes de caja', 'MEDIUM', 0, 0, null, 'PAYMENT', 'LEGAL_OBLIGATION', 0, 0, 1],
  ['reports.billing.export', 'Exportar reportes de caja', 'HIGH', 1, 1, null, 'PAYMENT', 'LEGAL_OBLIGATION', 0, 0, 1],
  ['team.members.view', 'Ver al equipo de apoyo y sus permisos', 'MEDIUM', 0, 0, null, 'OPERATIONS', 'HEALTHCARE_OPERATIONS', 0, 0, 1],
  ['team.invitations.create', 'Invitar personas al equipo (código o QR)', 'HIGH', 1, 0, null, 'OPERATIONS', 'HEALTHCARE_OPERATIONS', 0, 0, 1],
  ['team.requests.decide', 'Resolver solicitudes de acceso del equipo', 'HIGH', 1, 0, null, 'OPERATIONS', 'HEALTHCARE_OPERATIONS', 0, 0, 1],
  ['team.grants.assign', 'Otorgar permisos al equipo (dentro de su techo)', 'HIGH', 1, 1, null, 'OPERATIONS', 'HEALTHCARE_OPERATIONS', 0, 0, 1],
  ['team.grants.revoke', 'Quitar permisos del equipo', 'HIGH', 1, 0, null, 'OPERATIONS', 'HEALTHCARE_OPERATIONS', 0, 0, 1],
  ['team.engagement.recertify', 'Confirmar vínculos del equipo (recertificar)', 'MEDIUM', 0, 0, null, 'OPERATIONS', 'HEALTHCARE_OPERATIONS', 0, 0, 1],
  ['team.engagement.suspend', 'Suspender a una persona del equipo', 'HIGH', 1, 0, null, 'OPERATIONS', 'HEALTHCARE_OPERATIONS', 0, 0, 1],
  ['team.engagement.reactivate', 'Pedir la reactivación de una persona suspendida', 'HIGH', 1, 0, 'SECOND_APPROVER', 'OPERATIONS', 'HEALTHCARE_OPERATIONS', 0, 0, 1],
  ['team.engagement.end', 'Dar de baja a una persona del equipo', 'HIGH', 1, 0, null, 'OPERATIONS', 'HEALTHCARE_OPERATIONS', 0, 0, 1],
  ['team.handover.execute', 'Reasignar el trabajo de quien se va', 'HIGH', 1, 0, null, 'OPERATIONS', 'HEALTHCARE_OPERATIONS', 0, 0, 1],
  ['team.campaigns.review', 'Revisar accesos en campañas de certificación', 'MEDIUM', 0, 0, null, 'OPERATIONS', 'HEALTHCARE_OPERATIONS', 0, 0, 1],
  ['team.campaigns.manage', 'Crear y lanzar campañas de certificación', 'HIGH', 1, 0, null, 'OPERATIONS', 'HEALTHCARE_OPERATIONS', 0, 0, 1],
  ['team.sod.exception.request', 'Pedir una excepción de separación de funciones', 'HIGH', 1, 0, 'SECOND_APPROVER', 'OPERATIONS', 'HEALTHCARE_OPERATIONS', 0, 0, 1],
  ['team.templates.manage', 'Administrar plantillas de rol de la organización', 'HIGH', 1, 1, null, 'OPERATIONS', 'HEALTHCARE_OPERATIONS', 0, 0, 0],
  ['team.guardrails.manage', 'Administrar reglas y techos de la organización', 'CRITICAL', 1, 1, null, 'OPERATIONS', 'HEALTHCARE_OPERATIONS', 0, 0, 0],
  ['team.sod.manage', 'Administrar reglas de separación de funciones', 'CRITICAL', 1, 1, null, 'OPERATIONS', 'HEALTHCARE_OPERATIONS', 0, 0, 0],
  ['team.sessionpolicy.manage', 'Administrar políticas de sesión y reglas de red', 'CRITICAL', 1, 1, null, 'OPERATIONS', 'HEALTHCARE_OPERATIONS', 0, 0, 0],
  ['audit.activity.view_team', 'Ver la actividad del equipo', 'MEDIUM', 0, 0, null, 'OPERATIONS', 'HEALTHCARE_OPERATIONS', 0, 0, 1],
  ['audit.activity.view_org', 'Ver la actividad de toda la organización', 'HIGH', 0, 0, null, 'OPERATIONS', 'HEALTHCARE_OPERATIONS', 0, 0, 1],
  ['audit.activity.export', 'Exportar la actividad', 'HIGH', 1, 1, null, 'OPERATIONS', 'HEALTHCARE_OPERATIONS', 0, 0, 1],
  ['audit.decisions.explain', 'Explicar y simular permisos', 'MEDIUM', 0, 0, null, 'OPERATIONS', 'HEALTHCARE_OPERATIONS', 0, 0, 1],
  ['audit.reports.governance.view', 'Ver los tableros de gobierno de accesos', 'HIGH', 0, 0, null, 'OPERATIONS', 'HEALTHCARE_OPERATIONS', 0, 0, 1],
];

function toMeta(row: AtomRow): PermissionAtomMeta {
  const [code, name, sensitivity, reason, stepUp, approvalMode, purposeOfUse, legalBasis, clinical, field, assignable] = row;
  return {
    code,
    name,
    category: CATEGORY_BY_MODULE[code.split('.')[0]!]!,
    sensitivity,
    requiresReason: reason === 1,
    requiresStepUp: stepUp === 1,
    approvalMode,
    purposeOfUse,
    legalBasis,
    touchesClinicalData: clinical === 1,
    isFieldLevel: field === 1,
    supportAssignable: assignable === 1,
    isDangerous: sensitivity === 'HIGH' || sensitivity === 'CRITICAL',
  };
}

/** Los 73 átomos con sus metadatos, en el orden canónico. */
export const SUPPORT_ATOMS: readonly PermissionAtomMeta[] = ATOM_ROWS.map(toMeta);

const BY_CODE: ReadonlyMap<string, PermissionAtomMeta> = new Map(SUPPORT_ATOMS.map((a) => [a.code, a]));

/** ¿Es `value` el código de un átomo del catálogo? */
export function isSupportAtom(value: unknown): value is SupportAtom {
  return typeof value === 'string' && BY_CODE.has(value);
}

/** Metadatos de un átomo; `undefined` si el código no es del catálogo. */
export function atomMeta(code: string): PermissionAtomMeta | undefined {
  return BY_CODE.get(code);
}

/** Átomos de una categoría, en orden canónico. */
export function atomsOfCategory(category: AtomCategoryCode): readonly PermissionAtomMeta[] {
  return SUPPORT_ATOMS.filter((a) => a.category === category);
}

/** Los 15 códigos antiguos como alias: cada uno se expande a los átomos de su paquete (§2.3). */
export const LEGACY_ALIAS_ATOMS: Readonly<Record<string, readonly SupportAtom[]>> = {
  'schedule.view': ['agenda.appointment.view', 'agenda.appointment.view.patient_name'],
  'schedule.create': ['agenda.appointment.create', 'patients.search.exact', 'patients.profile.view_basic'],
  'schedule.reschedule': ['agenda.appointment.reschedule', 'patients.search.exact', 'patients.profile.view_basic'],
  'schedule.cancel': ['agenda.appointment.cancel'],
  'schedule.confirm': ['agenda.appointment.confirm'],
  'schedule.check_in': ['agenda.appointment.check_in', 'patients.search.exact', 'patients.profile.view_basic'],
  'schedule.walk_in': ['agenda.appointment.walk_in', 'patients.search.exact', 'patients.profile.view_basic'],
  'schedule.waitlist': ['agenda.waitlist.manage'],
  'schedule.send_reminders': ['agenda.reminder.send'],
  'schedule.block_time': ['agenda.block.create', 'agenda.block.remove'],
  'schedule.edit_hours': ['agenda.hours.edit'],
  'billing.collect': ['billing.payment.collect'],
  'billing.issue_receipt': ['billing.receipt.issue'],
  'patient.register': ['patients.profile.register', 'patients.guardian.record', 'patients.search.exact', 'patients.profile.view_basic'],
  'messages.reply_on_behalf': ['messages.inbox.view', 'messages.conversation.reply_on_behalf', 'messages.conversation.assign', 'messages.note.create_internal', 'messages.template.use'],
};

/** Átomo que se exige cuando un llamador antiguo pregunta con el código heredado. */
export const LEGACY_ALIAS_PRIMARY: Readonly<Record<string, SupportAtom>> = {
  'schedule.view': 'agenda.appointment.view',
  'schedule.create': 'agenda.appointment.create',
  'schedule.reschedule': 'agenda.appointment.reschedule',
  'schedule.cancel': 'agenda.appointment.cancel',
  'schedule.confirm': 'agenda.appointment.confirm',
  'schedule.check_in': 'agenda.appointment.check_in',
  'schedule.walk_in': 'agenda.appointment.walk_in',
  'schedule.waitlist': 'agenda.waitlist.manage',
  'schedule.send_reminders': 'agenda.reminder.send',
  'schedule.block_time': 'agenda.block.create',
  'schedule.edit_hours': 'agenda.hours.edit',
  'billing.collect': 'billing.payment.collect',
  'billing.issue_receipt': 'billing.receipt.issue',
  'patient.register': 'patients.profile.register',
  'messages.reply_on_behalf': 'messages.conversation.reply_on_behalf',
};

/** Átomos de un código: el alias se expande; un átomo se devuelve solo; lo desconocido, vacío. */
export function expandSupportAction(code: string): readonly SupportAtom[] {
  const alias = LEGACY_ALIAS_ATOMS[code];
  if (alias !== undefined) return alias;
  return isSupportAtom(code) ? [code] : [];
}

/** Átomo que se exige para una acción (átomo o alias); `undefined` si no es del catálogo. */
export function primaryAtomOfAction(code: string): SupportAtom | undefined {
  if (isSupportAtom(code)) return code;
  return LEGACY_ALIAS_PRIMARY[code];
}

/** Cuántos puntos pesa un conjunto de átomos en el puntaje de privilegios (suma de pesos de sensibilidad). */
export function privilegeWeightOf(atoms: readonly string[]): number {
  let total = 0;
  for (const code of new Set(atoms)) {
    const meta = BY_CODE.get(code);
    if (meta !== undefined) total += ATOM_SENSITIVITY_WEIGHT[meta.sensitivity];
  }
  return total;
}
