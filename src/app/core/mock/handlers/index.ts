import { MockRouter } from '../mock-router';
import { registrarAgenda } from './scheduling.handlers';
import { registrarServiciosDeAgenda } from './service-offerings.handlers';
import { registrarArchivos } from './files.handlers';
import { registrarAuth } from './auth.handlers';
import { registrarClinica } from './clinical.handlers';
import { registrarComunidad } from './community.handlers';
import { registrarDiagnostico } from './diagnostics.handlers';
import { registerDiagnosisVerification } from './diagnosis-verification.handlers';
import { registerMedicalNotes } from './medical-notes.handlers';
import { registrarDirectorio } from './directory.handlers';
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
import { registrarSeguros } from './insurance.handlers';
import { registrarTerminologia } from './terminology.handlers';
import { registrarVarios } from './misc.handlers';
import { registrarPortalAdministrativo } from './admin-portal.handlers';
import { registerPromotions } from './promotions.handlers';
import { registerPatientSpending } from './patient-spending.handlers';

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
  registrarServiciosDeAgenda(router);
  registrarPracticas(router);
  registrarClinica(router);
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
  registrarPortalDeLaboratorio(router);
  registrarProcedimientos(router);
  registrarLaboratorioFarmaceutico(router);
  registerLoyalty(router);
  registrarVarios(router);
  registrarPortalAdministrativo(router);
  registerPromotions(router);
  registerPatientSpending(router);
  return router;
}
