import { MockRouter } from '../mock-router';
import { activarAceptacionDeDemostracion, registrarAgenda } from './scheduling.handlers';
import { registrarServiciosDeAgenda } from './service-offerings.handlers';
import { registrarArchivos } from './files.handlers';
import { registrarAuth } from './auth.handlers';
import { registrarClinica } from './clinical.handlers';
import { registrarComunidad } from './community.handlers';
import { registrarDiagnostico } from './diagnostics.handlers';
import { registrarCentros } from './centros.handlers';
import { registerDiagnosisVerification } from './diagnosis-verification.handlers';
import { registerMedicalNotes } from './medical-notes.handlers';
import { registrarDirectorio } from './directory.handlers';
import { registerHealthcareServices } from './healthcare-services.handlers';
import { registerRoleAssignments } from './role-assignments.handlers';
import { registrarEncuestas } from './surveys-forms.handlers';
import { registrarFarmacia } from './pharmacy.handlers';
import { registrarFinanzas } from './finance.handlers';
import { registrarFacturacionSimulada } from './billing-simulated.handlers';
import { registrarContabilidadSimple } from './simple-accounting.handlers';
import { registrarIdentidad } from './identity.handlers';
import { registrarLaboratorioFarmaceutico } from './pharma-lab.handlers';
import { registrarPortalDeLaboratorio } from './lab-portal.handlers';
import { registerLoyalty } from './loyalty.handlers';
import { registrarModulosAdministrativos } from './admin-modules.handlers';
import { registrarNotificaciones } from './notifications.handlers';
import { registrarFirmaYSello } from './firma-y-sello.handlers';
import { registrarPerfiles } from './profiles.handlers';
import { registrarPracticas } from './practice.handlers';
import { registrarProcedimientos } from './procedures.handlers';
import { registrarPublico } from './public.handlers';
import { registrarAnaliticaDeSeguros } from './insurance-analytics.handlers';
import { registerInsuranceCampaigns } from './insurance-campaigns.handlers';
import { registerInsurancePortability } from './insurance-portability.handlers';
import { registerInsurerReceivedClaims } from './insurer-received-claims.handlers';
import { registerInsurerPatients } from './insurer-patients.handlers';
import { registrarSeguros } from './insurance.handlers';
import { registrarTerminologia } from './terminology.handlers';
import { registrarVarios } from './misc.handlers';
import { registrarPortalAdministrativo } from './admin-portal.handlers';
import { registrarAltaDeMedicoAsistida } from './assisted-practitioner.handlers';
import { registrarFlujos } from './flows.handlers';
import { registrarTrafico } from './ops-traffic.handlers';
import { registerPromotions } from './promotions.handlers';
import { registerPatientSpending } from './patient-spending.handlers';
import { registerMedicalCenters } from './medical-centers.handlers';
import { registerOrganizationPracticeHandlers } from './medical-center-onboarding.handlers';
import { registerReceivedServices } from './received-services.handlers';

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
  registrarFirmaYSello(router);
  registrarAgenda(router);
  activarAceptacionDeDemostracion();
  registrarServiciosDeAgenda(router);
  // Centros médicos · procedimientos por sede. Antes de `registrarPracticas`:
  // las dos atienden `/practices/…` y, ante patrones equivalentes, gana el
  // registrado primero.
  registerHealthcareServices(router);
  registerRoleAssignments(router);
  registrarPracticas(router);
  registrarClinica(router);
  registerReceivedServices(router);
  registerMedicalNotes(router);
  registerDiagnosisVerification(router);
  registrarComunidad(router);
  registrarPublico(router);
  registrarArchivos(router);
  registrarNotificaciones(router);
  registrarDirectorio(router);
  registrarIdentidad(router);
  registrarSeguros(router);
  registrarAnaliticaDeSeguros(router);
  registerInsurerReceivedClaims(router);
  registerInsurerPatients(router);
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
  // Después de diagnóstico: usa sus unidades y la agenda que les abre.
  registrarCentros(router);
  registrarPortalDeLaboratorio(router);
  registrarProcedimientos(router);
  registrarLaboratorioFarmaceutico(router);
  registerLoyalty(router);
  registrarVarios(router);
  registrarPortalAdministrativo(router);
  registrarTrafico(router);
  registrarFlujos(router);
  registrarAltaDeMedicoAsistida(router);
  registerPromotions(router);
  registerPatientSpending(router);
  registerMedicalCenters(router);
  registerOrganizationPracticeHandlers(router);
  return router;
}
