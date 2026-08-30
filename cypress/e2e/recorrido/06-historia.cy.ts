import {
  CLAIMS_ADMIN,
  iniciarSesionEnRecorrido,
  simularApiTotal,
} from '../../support/recorrido/api-total';
import { capturar, esperarEstable, reiniciarContadores } from '../../support/recorrido/evidencia';

/**
 * **Mi historia clínica** — el archivo del paciente, visto por su titular.
 *
 * Va en su propio archivo y no con el resto del área con sesión porque pide un
 * claim que las otras no necesitan: sin `pid` la cuenta no tiene perfil de
 * paciente y la pantalla responde con su propia salida, que es otro estado.
 */
describe('Recorrido · mi historia clínica', () => {
  beforeEach(() => {
    reiniciarContadores();
    simularApiTotal({ claims: { ...CLAIMS_ADMIN, tenants: ['t-1'], pid: 'p-001' } });
    iniciarSesionEnRecorrido();
  });

  it('muestra atenciones y recetas, sin listar diagnósticos ni formularios', () => {
    const pantalla = { carpeta: '45-mi-historia', titulo: 'Mi historia clínica' };

    cy.visit('/my-account/medical-record');
    esperarEstable();
    capturar(pantalla, 'historia del paciente');

    // Los dos bloques que el archivo del paciente ofrece.
    cy.contains('h2', 'Atenciones').should('exist');
    cy.contains('h2', 'Recetas').should('exist');

    // El resumen simulado trae condiciones, así que la ausencia es real: no se
    // listan porque la pantalla dejó de listarlas, no por falta de datos. El
    // diagnóstico se sigue leyendo dentro de la atención que lo registró.
    cy.contains('h2', 'Diagnósticos').should('not.exist');
    cy.contains('h2', 'Formularios clínicos').should('not.exist');
  });
});
