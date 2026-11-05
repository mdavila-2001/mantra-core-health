import type { Routes } from '@angular/router';
import {
  pantallaDeContextoSanitario,
  pantallaDeGeolocalizacion,
  pantallaDeVerificacionIdentidad,
} from './operacion.helpers';

/**
 * Pantallas de operación de aseguramiento de identidad, contexto sanitario y geolocalización.
 */
export const RUTAS_OPERACIONES_CONTEXTO: Routes = [
  pantallaDeVerificacionIdentidad('authorities/new', 'Registrar autoridad de identidad', () =>
    import('../features/identity-assurance/authority-form/authority-form').then(
      (m) => m.AuthorityForm,
    ),
  ),
  pantallaDeVerificacionIdentidad(
    'authorities/endpoint',
    'Publicar endpoint de autoridad',
    () =>
      import('../features/identity-assurance/authority-endpoint-form/authority-endpoint-form').then(
        (m) => m.AuthorityEndpointForm,
      ),
  ),
  pantallaDeVerificacionIdentidad('policies/new', 'Crear política de verificación', () =>
    import('../features/identity-assurance/verification-policy-form/verification-policy-form').then(
      (m) => m.VerificationPolicyForm,
    ),
  ),
  pantallaDeVerificacionIdentidad('queue', 'Cola de revisión de identidad', () =>
    import('../features/identity-assurance/case-queue/case-queue').then((m) => m.CaseQueue),
  ),
  pantallaDeVerificacionIdentidad('cases/new', 'Abrir caso de verificación', () =>
    import('../features/identity-assurance/case-open-form/case-open-form').then(
      (m) => m.CaseOpenForm,
    ),
  ),
  pantallaDeVerificacionIdentidad('cases/evidence', 'Aportar evidencia a un caso', () =>
    import('../features/identity-assurance/case-evidence-form/case-evidence-form').then(
      (m) => m.CaseEvidenceForm,
    ),
  ),
  pantallaDeVerificacionIdentidad('cases/checks', 'Planificar checks del caso', () =>
    import('../features/identity-assurance/check-plan-form/check-plan-form').then(
      (m) => m.CheckPlanForm,
    ),
  ),
  pantallaDeVerificacionIdentidad('cases/expire-sweep', 'Barrer casos vencidos', () =>
    import('../features/identity-assurance/case-expire-sweep/case-expire-sweep').then(
      (m) => m.CaseExpireSweep,
    ),
  ),
  pantallaDeVerificacionIdentidad('cases/:caseId', 'Expediente de identidad', () =>
    import('../features/identity-assurance/case-detail/case-detail').then((m) => m.CaseDetail),
  ),
  pantallaDeVerificacionIdentidad(
    'checks/attempt',
    'Registrar intento contra la autoridad',
    () =>
      import('../features/identity-assurance/check-attempt-form/check-attempt-form').then(
        (m) => m.CheckAttemptForm,
      ),
  ),
  pantallaDeVerificacionIdentidad('checks/result', 'Registrar resultado del check', () =>
    import('../features/identity-assurance/check-result-form/check-result-form').then(
      (m) => m.CheckResultForm,
    ),
  ),
  pantallaDeVerificacionIdentidad('checks/fraud-signal', 'Registrar señal de fraude', () =>
    import('../features/identity-assurance/fraud-signal-form/fraud-signal-form').then(
      (m) => m.FraudSignalForm,
    ),
  ),
  pantallaDeVerificacionIdentidad('review/escalate', 'Escalar a revisión manual', () =>
    import('../features/identity-assurance/manual-review-form/manual-review-form').then(
      (m) => m.ManualReviewForm,
    ),
  ),
  pantallaDeVerificacionIdentidad('review/decision', 'Decidir revisión manual', () =>
    import('../features/identity-assurance/review-decision-form/review-decision-form').then(
      (m) => m.ReviewDecisionForm,
    ),
  ),
  pantallaDeVerificacionIdentidad('assertions/issue', 'Emitir aserción', () =>
    import('../features/identity-assurance/assertion-issue-form/assertion-issue-form').then(
      (m) => m.AssertionIssueForm,
    ),
  ),
  pantallaDeVerificacionIdentidad('assertions/revoke', 'Revocar aserción', () =>
    import('../features/identity-assurance/assertion-revoke-form/assertion-revoke-form').then(
      (m) => m.AssertionRevokeForm,
    ),
  ),
  pantallaDeContextoSanitario('contexts/resolve', 'Contexto vigente', () =>
    import('../features/health-context/context-resolve/context-resolve').then(
      (m) => m.ContextResolve,
    ),
  ),
  pantallaDeContextoSanitario('contexts/new', 'Nuevo contexto de país', () =>
    import('../features/health-context/context-form/context-form').then((m) => m.ContextForm),
  ),
  pantallaDeContextoSanitario('agents/new', 'Nuevo agente', () =>
    import('../features/health-context/agent-form/agent-form').then((m) => m.AgentForm),
  ),
  pantallaDeContextoSanitario('sources/new', 'Nueva fuente', () =>
    import('../features/health-context/source-form/source-form').then((m) => m.SourceForm),
  ),
  pantallaDeContextoSanitario('schedules/new', 'Nueva agenda de recolección', () =>
    import('../features/health-context/schedule-form/schedule-form').then((m) => m.ScheduleForm),
  ),
  pantallaDeContextoSanitario('collection-runs/new', 'Iniciar corrida', () =>
    import('../features/health-context/collection-run-form/collection-run-form').then(
      (m) => m.CollectionRunForm,
    ),
  ),
  pantallaDeContextoSanitario('observations/new', 'Registrar observación', () =>
    import('../features/health-context/observation-form/observation-form').then(
      (m) => m.ObservationForm,
    ),
  ),
  pantallaDeContextoSanitario('versions/new', 'Redactar versión', () =>
    import('../features/health-context/version-form/version-form').then((m) => m.VersionForm),
  ),
  pantallaDeContextoSanitario('quality-reviews/new', 'Registrar revisión de calidad', () =>
    import('../features/health-context/quality-review-form/quality-review-form').then(
      (m) => m.QualityReviewForm,
    ),
  ),
  pantallaDeContextoSanitario('versions/publish', 'Publicar versión', () =>
    import('../features/health-context/version-publish/version-publish').then(
      (m) => m.VersionPublish,
    ),
  ),
  pantallaDeContextoSanitario('versions/supersede', 'Retirar versión', () =>
    import('../features/health-context/version-supersede/version-supersede').then(
      (m) => m.VersionSupersede,
    ),
  ),
  pantallaDeContextoSanitario('collection-runs/finish', 'Cerrar corrida', () =>
    import('../features/health-context/collection-run-finish/collection-run-finish').then(
      (m) => m.CollectionRunFinish,
    ),
  ),
  pantallaDeGeolocalizacion('subjects/new', 'Nuevo sujeto rastreado', () =>
    import('../features/geo/tracked-subject-form/tracked-subject-form').then(
      (m) => m.TrackedSubjectForm,
    ),
  ),
  pantallaDeGeolocalizacion('sessions/new', 'Abrir sesión de rastreo', () =>
    import('../features/geo/tracking-session-form/tracking-session-form').then(
      (m) => m.TrackingSessionForm,
    ),
  ),
  pantallaDeGeolocalizacion('trips/new', 'Iniciar viaje', () =>
    import('../features/geo/trip-form/trip-form').then((m) => m.TripForm),
  ),
  pantallaDeGeolocalizacion('subjects/pings', 'Ingerir posiciones', () =>
    import('../features/geo/ping-ingest/ping-ingest').then((m) => m.PingIngest),
  ),
  pantallaDeGeolocalizacion('geofences/new', 'Nueva geocerca', () =>
    import('../features/geo/geofence-form/geofence-form').then((m) => m.GeofenceForm),
  ),
  pantallaDeGeolocalizacion('geofence-events/new', 'Registrar cruce de geocerca', () =>
    import('../features/geo/geofence-event-form/geofence-event-form').then(
      (m) => m.GeofenceEventForm,
    ),
  ),
  pantallaDeGeolocalizacion('subjects/revoke-consent', 'Revocar consentimiento', () =>
    import('../features/geo/consent-revocation/consent-revocation').then(
      (m) => m.ConsentRevocation,
    ),
  ),
  pantallaDeGeolocalizacion('sessions/close', 'Cerrar sesión de rastreo', () =>
    import('../features/geo/tracking-session-close/tracking-session-close').then(
      (m) => m.TrackingSessionClose,
    ),
  ),
  pantallaDeGeolocalizacion('trips/close', 'Cerrar viaje', () =>
    import('../features/geo/trip-close/trip-close').then((m) => m.TripClose),
  ),
  pantallaDeGeolocalizacion('subjects/last-position', 'Última posición', () =>
    import('../features/geo/last-position/last-position').then((m) => m.LastPosition),
  ),
  pantallaDeGeolocalizacion('subjects/last-position/:trackedSubjectId', 'Última posición', () =>
    import('../features/geo/last-position/last-position').then((m) => m.LastPosition),
  ),
];
