import { registrarCalidadYPrivacidad } from './governance-data.handlers';
import { registrarEditorDeCatalogos } from './catalog-editor.handlers';
import { registrarVisibilidad } from './ui-visibility.handlers';
import { registrarMutabilidad } from './mutability.handlers';
import { registrarPiezasVivas } from './runtime-pieces.handlers';
import { registrarCargaMasivaDeCatalogo } from './catalog-bulk.handlers';
import { registrarPoliticasGobierno } from './governance-policies.handlers';
import { MockRouter } from '../mock-router';
import { activarAceptacionDeDemostracion, registrarAgenda } from './scheduling.handlers';
import { registerBookingApproval } from './booking-approval.handlers';
import { registrarServiciosDeAgenda } from './service-offerings.handlers';
import { registrarHorarioFlexible } from './flexible-hours.handlers';
import { registerPaymentReceipts } from './payment-receipts.handlers';
import { registrarArchivos } from './files.handlers';
import { registrarAuth } from './auth.handlers';
import { registrarPersonalDeApoyo } from './support-staff.handlers';
import { registrarClinica } from './clinical.handlers';
import { registerReferralIssue } from './referral-issue.handlers';
import { registerReferralLifecycle } from './referral-lifecycle.handlers';
import { registerReferrals } from './referrals.handlers';
import { registerProcedureCenters } from './procedure-centers.handlers';
import { registrarComunidad } from './community.handlers';
import { registrarConsentimientos } from './consent.handlers';
import { registrarDiagnostico } from './diagnostics.handlers';
import { registrarDetalleDeEstudio } from './study-detail.handlers';
import { registrarCentros } from './centros.handlers';
import { registerCenterBookings } from './center-bookings.handlers';
import { registerLabPortalApiParity } from './lab-portal-api-parity.handlers';
import { registerLabCatalog } from './lab-catalog.handlers';
import { registerDiagnosisVerification } from './diagnosis-verification.handlers';
import { registerMedicalNotes } from './medical-notes.handlers';
import { registrarDirectorio } from './directory.handlers';
import { registerBranchLocationPreview } from './directory.branch-location';
import { registrarInvitacionesDeOrganizacion } from './directory-invitations.handlers';
import { registerHealthcareServices } from './healthcare-services.handlers';
import { registerRoleAssignments } from './role-assignments.handlers';
import { registrarEncuestas } from './surveys-forms.handlers';
import { registerSurveyCatalog } from './surveys-catalog.handlers';
import { registerServiceSurveyAssignments } from './surveys-service-assignments.handlers';
import { registrarFarmacia } from './pharmacy.handlers';
import { registrarFinanzas } from './finance.handlers';
import { registrarFacturacionSimulada } from './billing-simulated.handlers';
import { registrarContabilidadSimple } from './simple-accounting.handlers';
import { registrarIdentidad } from './identity.handlers';
import { registrarInfraestructura } from './infrastructure.handlers';
import { registerInfrastructureOps } from './infrastructure-ops.handlers';
import { registerAdt } from './adt.handlers';
import { registrarLaboratorioFarmaceutico } from './pharma-lab.handlers';
import { ordenDeRespuesta, registrarOrdenesDeLaboratorio } from './lab-orders.handlers';
import { registrarOrdenesDelCentro } from './lab-order-intake.handlers';
import { registerLabOrderFromQr } from './lab-order-qr.handlers';
import { registrarDerivaciones } from './lab-referral.handlers';
import {
  destinoDeOrden,
  laboratorioDe,
  registrarPortalDeLaboratorio,
  resultadosDeLaboratorio,
} from './lab-portal.handlers';
import { registerLoyalty } from './loyalty.handlers';
import { registrarModulosAdministrativos } from './admin-modules.handlers';
import { registrarNotificaciones } from './notifications.handlers';
import { registerSignatureAndSeal } from './signature-and-seal.handlers';
import { registrarPerfiles } from './profiles.handlers';
import { registrarLibretaDeDirecciones } from './address-book.handlers';
import { registerPrimaryPractitioner } from './primary-practitioner.handlers';
import { registrarPracticas } from './practice.handlers';
import { registrarProcedimientos } from './procedures.handlers';
import { registerOperatingRooms } from './operating-rooms.handlers';
import { registerSpaceBilling } from './space-billing.handlers';
import { registerInfraF5Ops } from './infra-f5-ops.handlers';
import { registerSampleCollection } from './sample-collection.handlers';
import { registerInfraAccounting } from './infra-accounting.handlers';
import { registerSiteAccess } from './site-access.handlers';
import { registerTreatmentInformedConsents } from './treatment-informed-consents.handlers';
import { registrarPublico } from './public.handlers';
import { registrarAnaliticaDeSeguros } from './insurance-analytics.handlers';
import { registerInsuranceCampaigns } from './insurance-campaigns.handlers';
import { registerInsurancePortability } from './insurance-portability.handlers';
import { registerInsurerReceivedClaims } from './insurer-received-claims.handlers';
import { registrarSeguros } from './insurance.handlers';
import { registerPractitionerInsurerRequests } from './practitioner-insurer-requests.handlers';
import { registrarPacientesDeAseguradora } from './insurer-patients.handlers';
import { registrarTerminologia } from './terminology.handlers';
import { registrarVarios } from './misc.handlers';
import { registerAuthz } from './authz.handlers';
import { registerAccessRequests } from './access-requests.handlers';
import { registrarPortalAdministrativo } from './admin-portal.handlers';
import { registrarCatalogoDeModulos } from './authz-modules-catalog.handlers';
import { registerPermissionsAdmin } from './permissions-admin.handlers';
import { registerGovernance } from './governance.handlers';
import { registrarAltaDeMedicoAsistida } from './assisted-practitioner.handlers';
import { registrarFlujos } from './flows.handlers';
import { registrarTrafico } from './ops-traffic.handlers';
import { registrarSondaDeVida } from './ops-liveness.handlers';
import { registrarConsentimientoDeTracking } from './telemetry-consent.handlers';
import { registrarSondaCatalogo } from './catalog-fit.handlers';
import { registrarHerramientas } from './ops-tools.handlers';
import { registrarDispositivos } from './analytics-devices.handlers';
import { registrarMisDispositivos } from './my-devices.handlers';
import { registrarDinero } from './analytics-money.handlers';
import { registerPromotions } from './promotions.handlers';
import { registerPatientSpending } from './patient-spending.handlers';
import { registerPortalInventory } from './portal-inventory.handlers';
import { registerReceivedServices } from './received-services.handlers';
import { registerMedicalGroups } from './medical-groups.handlers';
import { registerMedicalCenters } from './medical-centers.handlers';
import { registerOrganizationPracticeHandlers } from './medical-center-onboarding.handlers';
import { registerRegistrationLogo } from './registration-logo.handlers';
import { registrarAdmisiones } from './admissions.handlers';
import { registerOwnAdmissionSubmit } from './own-admission-submit.handlers';
import { registrarCargasMasivas } from './bulk-imports.handlers';
import { registerPrescriptionShares } from './prescription-shares.handlers';
import { registerPharmacyMedicationAvailability } from './pharmacy-medication-availability.handlers';
import { registerPharmacyPrescriptionShares } from './pharmacy-prescription-shares.handlers';
import { registrarInsights } from './insights.handlers';
import { registrarInsightsWorkspace } from './insights-workspace.handlers';
import { registrarReporteria } from './reporting.handlers';
import { registrarApoyo } from './support-access.handlers';

/**
 * Arma la tabla de rutas del backend simulado. Cada dominio registra las
 * suyas; gana el patrón más específico y, ante dos patrones equivalentes,
 * el registrado primero. Cada ruta debe tener un único dueño.
 */
export function crearRouterSimulado(): MockRouter {
  const router = new MockRouter();
  registrarAuth(router);
  // El alta de la secretaria (`/iam/auth/register-support-staff`).
  registrarPersonalDeApoyo(router);
  registrarTerminologia(router);
  registrarPerfiles(router);
  registrarLibretaDeDirecciones(router);
  registerPrimaryPractitioner(router);
  registerSignatureAndSeal(router);
  registrarAgenda(router);
  registerBookingApproval(router);
  activarAceptacionDeDemostracion();
  registrarServiciosDeAgenda(router);
  // Centros médicos · procedimientos por sede. Antes de `registrarPracticas`:
  // las dos atienden `/practices/…` y, ante patrones equivalentes, gana el
  // registrado primero.
  registerHealthcareServices(router);
  registerRoleAssignments(router);
  registrarHorarioFlexible(router);
  registerPaymentReceipts(router);
  // Centros médicos · procedimientos por sede. Antes de `registrarPracticas`:
  // ante patrones equivalentes gana el registrado primero.
  registerHealthcareServices(router);
  registerRoleAssignments(router);
  registrarPracticas(router);
  registrarInfraestructura(router);
  registerInfrastructureOps(router);
  registerAdt(router);
  registrarClinica(router);
  // FAR-01 · el enlace para compartir una receta (`/clinical/prescription-shares`, `/public/prescription-shares`).
  registerPrescriptionShares(router);
  registerPharmacyPrescriptionShares(router);
  registerReferrals(router);
  registerReferralIssue(router);
  registerReferralLifecycle(router);
  registerReceivedServices(router);
  registerProcedureCenters(router);
  registerMedicalNotes(router);
  registerDiagnosisVerification(router);
  registrarComunidad(router);
  registrarPublico(router);
  registrarArchivos(router);
  registrarNotificaciones(router);
  registrarDirectorio(router);
  registerBranchLocationPreview(router);
  registrarInvitacionesDeOrganizacion(router);
  registrarIdentidad(router);
  registrarSeguros(router);
  registerPractitionerInsurerRequests(router);
  registrarAnaliticaDeSeguros(router);
  registerInsurerReceivedClaims(router);
  registrarPacientesDeAseguradora(router);
  registerInsurancePortability(router);
  registerInsuranceCampaigns(router);
  registrarEncuestas(router);
  registerSurveyCatalog(router);
  registerServiceSurveyAssignments(router);
  registrarFinanzas(router);
  // FACT-SIAT-MOCK · `/billing/simulated/*`, sin colisión con
  // `/billing/service-catalog`, que es de `registrarPracticas`.
  registrarFacturacionSimulada(router);
  registrarContabilidadSimple(router);
  registrarModulosAdministrativos(router);
  registrarFarmacia(router);
  registerPharmacyMedicationAvailability(router);
  registrarDiagnostico(router);
  const dependenciasDeOrdenes = { laboratorioDe, destinoDeOrden, archivos: resultadosDeLaboratorio };
  registrarOrdenesDeLaboratorio(router, dependenciasDeOrdenes);
  registerLabOrderFromQr(router, dependenciasDeOrdenes);
  registrarOrdenesDelCentro(router, {
    laboratorioDe,
    responder: (orderId) => ordenDeRespuesta(orderId, dependenciasDeOrdenes),
  });
  // Después de diagnóstico: usa sus unidades y la agenda que les abre.
  registrarCentros(router);
  registerCenterBookings(router);
  registrarPortalDeLaboratorio(router);
  registerLabPortalApiParity(router);
  registerLabCatalog(router);
  registrarDerivaciones(router);
  registrarProcedimientos(router);
  // F4 · quirófanos: salas, bloques, utilización y el día del caso.
  registerOperatingRooms(router);
  // F5e · tarifas de espacios y cargos de día-cama.
  registerSpaceBilling(router);
  // F5a/F5c · equipos en sala y botiquín por unidad.
  registerInfraF5Ops(router);
  // F5b · puntos de toma de muestra.
  registerSampleCollection(router);
  // F5f · activos y centros de costo por espacio y unidad.
  registerInfraAccounting(router);
  // Sedes y acciones del actor (§0.3), para elegir sede en F4/F5.
  registerSiteAccess(router);
  registerTreatmentInformedConsents(router);
  registrarLaboratorioFarmaceutico(router);
  registerLoyalty(router);
  registrarVarios(router);
  registerAuthz(router);
  registerAccessRequests(router);
  registrarConsentimientos(router);
  registrarPortalAdministrativo(router);
  registerGovernance(router);
  registerPermissionsAdmin(router);
  registrarCatalogoDeModulos(router);
  registrarTrafico(router);
  registrarSondaDeVida(router);
  registrarConsentimientoDeTracking(router);
  registrarSondaCatalogo(router);
  registrarHerramientas(router);
  registrarDispositivos(router);
  registrarMisDispositivos(router);
  registrarDinero(router);
  registrarFlujos(router);
  registrarAltaDeMedicoAsistida(router);
  registrarAdmisiones(router);
  registerOwnAdmissionSubmit(router);
  registrarReporteria(router);
  registrarInsights(router);
  registrarInsightsWorkspace(router);
  registrarCargasMasivas(router);
  registrarPoliticasGobierno(router);
  registrarPiezasVivas(router);
  registrarCargaMasivaDeCatalogo(router);
  registrarMutabilidad(router);
  registrarVisibilidad(router);
  registrarCalidadYPrivacidad(router);
  registrarEditorDeCatalogos(router);
  registerPromotions(router);
  registerPatientSpending(router);
  registerPortalInventory(router);
  registerMedicalGroups(router);
  registerMedicalCenters(router);
  registerOrganizationPracticeHandlers(router);
  // El detalle de la orden de estudios (muestra / región): envuelve rutas de diagnóstico y de terminología ya registradas.
  registrarDetalleDeEstudio(router);
  // La pre-carga del logo del consultorio en el alta del médico.
  registerRegistrationLogo(router);
  // Personal de apoyo (secretaria y otros roles). Al final: envuelve rutas que
  // ya tienen dueño (reservas, chat, delegaciones) para atender lo del hospital.
  registrarApoyo(router);
  return router;
}
