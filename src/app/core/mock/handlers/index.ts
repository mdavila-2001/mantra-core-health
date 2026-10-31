import { MockRouter } from '../mock-router';
import { activarAceptacionDeDemostracion, registrarAgenda } from './scheduling.handlers';
import { registrarServiciosDeAgenda } from './service-offerings.handlers';
import { registrarHorarioFlexible } from './flexible-hours.handlers';
import { registerPaymentReceipts } from './payment-receipts.handlers';
import { registrarArchivos } from './files.handlers';
import { registrarAuth } from './auth.handlers';
import { registrarClinica } from './clinical.handlers';
import { registerReferralLifecycle } from './referral-lifecycle.handlers';
import { registerReferrals } from './referrals.handlers';
import { registerProcedureCenters } from './procedure-centers.handlers';
import { registrarComunidad } from './community.handlers';
import { registrarConsentimientos } from './consent.handlers';
import { registrarDiagnostico } from './diagnostics.handlers';
import { registrarCentros } from './centros.handlers';
import { registerDiagnosisVerification } from './diagnosis-verification.handlers';
import { registerMedicalNotes } from './medical-notes.handlers';
import { registrarDirectorio } from './directory.handlers';
import { registrarInvitacionesDeOrganizacion } from './directory-invitations.handlers';
import { registerHealthcareServices } from './healthcare-services.handlers';
import { registerRoleAssignments } from './role-assignments.handlers';
import { registrarEncuestas } from './surveys-forms.handlers';
import { registrarFarmacia } from './pharmacy.handlers';
import { registrarFinanzas } from './finance.handlers';
import { registrarFacturacionSimulada } from './billing-simulated.handlers';
import { registrarContabilidadSimple } from './simple-accounting.handlers';
import { registrarIdentidad } from './identity.handlers';
import { registrarInfraestructura } from './infrastructure.handlers';
import { registrarLaboratorioFarmaceutico } from './pharma-lab.handlers';
import { registrarOrdenesDeLaboratorio } from './lab-orders.handlers';
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
import { registrarPortalAdministrativo } from './admin-portal.handlers';
import { registerGovernance } from './governance.handlers';
import { registrarAltaDeMedicoAsistida } from './assisted-practitioner.handlers';
import { registrarFlujos } from './flows.handlers';
import { registrarTrafico } from './ops-traffic.handlers';
import { registrarSondaDeVida } from './ops-liveness.handlers';
import { registrarHerramientas } from './ops-tools.handlers';
import { registrarDispositivos } from './analytics-devices.handlers';
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
import { registrarCargasMasivas } from './bulk-imports.handlers';
import { registerPrescriptionShares } from './prescription-shares.handlers';
import { registerPharmacyPrescriptionShares } from './pharmacy-prescription-shares.handlers';
import { registrarInsights } from './insights.handlers';
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
  registrarTerminologia(router);
  registrarPerfiles(router);
  registrarLibretaDeDirecciones(router);
  registerPrimaryPractitioner(router);
  registerSignatureAndSeal(router);
  registrarAgenda(router);
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
  registrarClinica(router);
  // FAR-01 · el enlace para compartir una receta (`/clinical/prescription-shares`, `/public/prescription-shares`).
  registerPrescriptionShares(router);
  registerPharmacyPrescriptionShares(router);
  registerReferrals(router);
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
  registrarFinanzas(router);
  // FACT-SIAT-MOCK · `/billing/simulated/*`, sin colisión con
  // `/billing/service-catalog`, que es de `registrarPracticas`.
  registrarFacturacionSimulada(router);
  registrarContabilidadSimple(router);
  registrarModulosAdministrativos(router);
  registrarFarmacia(router);
  registrarDiagnostico(router);
  registrarOrdenesDeLaboratorio(router, {
    laboratorioDe,
    destinoDeOrden,
    archivos: resultadosDeLaboratorio,
  });
  // Después de diagnóstico: usa sus unidades y la agenda que les abre.
  registrarCentros(router);
  registrarPortalDeLaboratorio(router);
  registrarProcedimientos(router);
  registerTreatmentInformedConsents(router);
  registrarLaboratorioFarmaceutico(router);
  registerLoyalty(router);
  registrarVarios(router);
  registrarConsentimientos(router);
  registrarPortalAdministrativo(router);
  registerGovernance(router);
  registrarTrafico(router);
  registrarSondaDeVida(router);
  registrarHerramientas(router);
  registrarDispositivos(router);
  registrarDinero(router);
  registrarFlujos(router);
  registrarAltaDeMedicoAsistida(router);
  registrarAdmisiones(router);
  registrarReporteria(router);
  registrarInsights(router);
  registrarCargasMasivas(router);
  registerPromotions(router);
  registerPatientSpending(router);
  registerPortalInventory(router);
  registerMedicalGroups(router);
  registerMedicalCenters(router);
  registerOrganizationPracticeHandlers(router);
  // La pre-carga del logo del consultorio en el alta del médico.
  registerRegistrationLogo(router);
  // Personal de apoyo (secretaria y otros roles). Al final: envuelve rutas que
  // ya tienen dueño (reservas, chat, delegaciones) para atender lo del hospital.
  registrarApoyo(router);
  return router;
}
