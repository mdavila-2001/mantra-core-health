import { MockRouter } from '../mock-router';
import { registrarAgenda } from './scheduling.handlers';
import { registrarArchivos } from './files.handlers';
import { registrarAuth } from './auth.handlers';
import { registrarClinica } from './clinical.handlers';
import { registrarComunidad } from './community.handlers';
import { registrarDiagnostico } from './diagnostics.handlers';
import { registrarDirectorio } from './directory.handlers';
import { registrarEncuestas } from './surveys-forms.handlers';
import { registrarFarmacia } from './pharmacy.handlers';
import { registrarFinanzas } from './finance.handlers';
import { registrarIdentidad } from './identity.handlers';
import { registrarLaboratorioFarmaceutico } from './pharma-lab.handlers';
import { registrarModulosAdministrativos } from './admin-modules.handlers';
import { registrarNotificaciones } from './notifications.handlers';
import { registrarPerfiles } from './profiles.handlers';
import { registrarPracticas } from './practice.handlers';
import { registrarProcedimientos } from './procedures.handlers';
import { registrarPublico } from './public.handlers';
import { registrarAnaliticaDeSeguros } from './insurance-analytics.handlers';
import { registerInsuranceCampaigns } from './insurance-campaigns.handlers';
import { registerInsurancePortability } from './insurance-portability.handlers';
import { registrarSeguros } from './insurance.handlers';
import { registrarTerminologia } from './terminology.handlers';
import { registrarVarios } from './misc.handlers';
import { registrarPortalAdministrativo } from './admin-portal.handlers';

/**
 * Arma la tabla de rutas del backend simulado. Cada dominio registra las
 * suyas; ante dos patrones equivalentes gana el registrado **después**, así
 * que los dominios más específicos van al final.
 */
export function crearRouterSimulado(): MockRouter {
  const router = new MockRouter();
  registrarAuth(router);
  registrarTerminologia(router);
  registrarPerfiles(router);
  registrarAgenda(router);
  registrarPracticas(router);
  registrarClinica(router);
  registrarComunidad(router);
  registrarPublico(router);
  registrarArchivos(router);
  registrarNotificaciones(router);
  registrarDirectorio(router);
  registrarIdentidad(router);
  registrarSeguros(router);
  registrarAnaliticaDeSeguros(router);
  registerInsurancePortability(router);
  registerInsuranceCampaigns(router);
  registrarEncuestas(router);
  registrarFinanzas(router);
  registrarModulosAdministrativos(router);
  registrarFarmacia(router);
  registrarDiagnostico(router);
  registrarProcedimientos(router);
  registrarLaboratorioFarmaceutico(router);
  registrarVarios(router);
  registrarPortalAdministrativo(router);
  return router;
}
