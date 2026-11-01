import type { Routes } from '@angular/router';
import { RUTAS_DE_GOBIERNO } from '../app.routes.governance';
import {
  pantallaDeEquipoDeApoyo,
  pantallaDeMiEquipo,
  pantallaDeMisAccesos,
  pantallaDeOperacion,
} from './operacion.helpers';

/**
 * Pantallas de operación clínica: agenda, catálogo de servicios, espacios médicos,
 * intervenciones quirúrgicas y equipo de apoyo.
 */
export const RUTAS_OPERACIONES_CLINICAS: Routes = [
  pantallaDeOperacion('schedule', 'new', 'Publicar mi agenda', () =>
    import('../features/agenda/agenda-create/agenda-create').then((m) => m.AgendaCreate),
  ),
  pantallaDeOperacion('schedule', 'edit', 'Cambiar mi horario', () =>
    import('../features/agenda/agenda-create/agenda-create').then((m) => m.AgendaCreate),
  ),
  pantallaDeOperacion('schedule', 'blocks', 'Bloqueos de agenda', () =>
    import('../features/agenda/blocks/blocks').then((m) => m.Blocks),
  ),
  pantallaDeOperacion('administration/services-catalog', 'import', 'Importar del arancel', () =>
    import('../features/admin/services-catalog/procedure-import/procedure-import').then(
      (m) => m.ProcedureImport,
    ),
  ),
  pantallaDeOperacion(
    'administration/services-catalog',
    'procedure-offers',
    'Procedimientos por sede',
    () =>
      import('../features/admin/services-catalog/procedure-offers/procedure-offers').then(
        (m) => m.ProcedureOffers,
      ),
  ),
  pantallaDeOperacion('my-services', 'import', 'Importar producto', () =>
    import('../features/admin/services-catalog/procedure-import/procedure-import').then(
      (m) => m.ProcedureImport,
    ),
  ),
  pantallaDeOperacion('administration/medical-organization', 'spaces/new', 'Registrar un espacio', () =>
    import('../features/admin/medical-organization/espacio/space-form').then((m) => m.SpaceForm),
  ),
  pantallaDeOperacion('administration/medical-organization', 'spaces/bulk', 'Alta masiva de espacios', () =>
    import('../features/admin/medical-organization/espacio/space-bulk').then((m) => m.SpaceBulk),
  ),
  pantallaDeOperacion('administration/medical-organization', 'spaces/import', 'Importar espacios', () =>
    import('../features/admin/medical-organization/espacio/space-import').then((m) => m.SpaceImport),
  ),
  pantallaDeOperacion('administration/medical-organization', 'spaces/:id/edit', 'Editar un espacio', () =>
    import('../features/admin/medical-organization/espacio/space-form').then((m) => m.SpaceForm),
  ),
  pantallaDeOperacion('administration/medical-organization', 'spaces/:id', 'Ficha del espacio', () =>
    import('../features/admin/medical-organization/espacio/space-detail').then((m) => m.SpaceDetail),
  ),
  pantallaDeOperacion('interventions', 'new', 'Programar una intervención', () =>
    import('../features/interventions/schedule-case/schedule-case').then((m) => m.ScheduleCase),
  ),
  pantallaDeOperacion('interventions', 'operating-rooms', 'Agenda de quirófanos', () =>
    import('../features/interventions/or-schedule/or-schedule').then((m) => m.OrSchedule),
  ),
  pantallaDeOperacion('interventions', 'blocks', 'Bloques de quirófano', () =>
    import('../features/interventions/or-blocks/or-blocks').then((m) => m.OrBlocks),
  ),
  pantallaDeOperacion('interventions', 'utilization', 'Utilización de quirófanos', () =>
    import('../features/interventions/or-utilization/or-utilization').then((m) => m.OrUtilizationPage),
  ),
  pantallaDeOperacion('interventions', ':caseId', 'Ficha de la intervención', () =>
    import('../features/interventions/case-detail/case-detail').then((m) => m.CaseDetail),
  ),
  pantallaDeOperacion('administration/medical-laboratory', 'equipment/:id', 'Ficha del equipo', () =>
    import('../features/admin/medical-laboratory/equipment-detail/equipment-detail').then((m) => m.EquipmentDetail),
  ),
  pantallaDeOperacion('administration/accounting', 'infrastructure', 'Activos y centros de costo', () =>
    import('../features/accounting/infrastructure/infrastructure-accounting').then((m) => m.InfrastructureAccounting),
  ),
  pantallaDeOperacion('administration/services-catalog', 'bed-day-charges', 'Cargos de día-cama', () =>
    import('../features/admin/services-catalog/bed-day-charges/bed-day-charges').then((m) => m.BedDayCharges),
  ),
  pantallaDeOperacion('schedule', 'appointment/new', 'Agendar una cita', () =>
    import('../features/agenda/appointment-new/appointment-new').then((m) => m.AppointmentNew),
  ),
  pantallaDeEquipoDeApoyo('reply-templates', 'Respuestas preparadas', () =>
    import('../features/support-access/reply-templates/reply-templates').then((m) => m.ReplyTemplates),
  ),
  ...RUTAS_DE_GOBIERNO,
  pantallaDeEquipoDeApoyo(':engagementId', 'Permisos de una persona de apoyo', () =>
    import('../features/support-access/permissions-editor/permissions-editor').then(
      (m) => m.PermissionsEditor,
    ),
  ),
  pantallaDeMiEquipo('activity', 'Actividad de mi equipo', () =>
    import('../features/support-access/support-activity/support-activity').then((m) => m.SupportActivity),
  ),
  pantallaDeOperacion('my-account/security', 'mfa', 'Verificación en dos pasos', () =>
    import('../features/account/mfa-enrollment/mfa-enrollment').then((m) => m.MfaEnrollment),
  ),
  pantallaDeOperacion('my-account/security', 'organization-invitations', 'Invitaciones de organizaciones', () =>
    import('../features/account/organization-invitations/organization-invitations').then((m) => m.OrganizationInvitations),
  ),
  pantallaDeMisAccesos('activity', 'Mi actividad', () =>
    import('../features/support-access/support-activity/support-activity').then((m) => m.SupportActivity),
  ),
];
