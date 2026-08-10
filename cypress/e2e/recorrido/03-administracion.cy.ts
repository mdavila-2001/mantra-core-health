import {
  CLAIMS_ADMIN,
  iniciarSesionEnRecorrido,
  simularApiTotal,
} from '../../support/recorrido/api-total';
import { capturar, esperarEstable, reiniciarContadores } from '../../support/recorrido/evidencia';
import { EVITAR_POR_DEFECTO, recorrer } from '../../support/recorrido/explorador';

/**
 * Las pantallas de administración: las únicas con datos de verdad.
 *
 * Piden rol `SECURITY_ADMIN` —el menú no las ofrece sin él— y son las que más
 * estados tienen: listado con datos, listado vacío, ficha, y tres formularios de
 * alta con sus validaciones.
 */
describe('Recorrido · administración', () => {
  beforeEach(() => {
    reiniciarContadores();
  });

  it('listado de pacientes', () => {
    simularApiTotal({ claims: { ...CLAIMS_ADMIN, tenants: ['t-1'] } });
    iniciarSesionEnRecorrido();

    recorrer(
      {
        ruta: '/administracion/pacientes',
        carpeta: '22-pacientes-listado',
        titulo: 'Pacientes · listado',
      },
      { evitar: EVITAR_POR_DEFECTO, maxAcciones: 30 },
    );
  });

  it('listado de pacientes sin resultados', () => {
    simularApiTotal({ claims: { ...CLAIMS_ADMIN, tenants: ['t-1'] }, sinPacientes: true });
    iniciarSesionEnRecorrido();

    // El estado vacío es una pantalla propia —con su ilustración y su acción de
    // salida— y no se alcanza con datos cargados: hay que pedirle a la API que
    // no devuelva ninguno.
    recorrer(
      {
        ruta: '/administracion/pacientes',
        carpeta: '23-pacientes-vacio',
        titulo: 'Pacientes · sin resultados',
      },
      { evitar: EVITAR_POR_DEFECTO, maxAcciones: 25 },
    );
  });

  it('ficha de paciente', () => {
    simularApiTotal({ claims: { ...CLAIMS_ADMIN, tenants: ['t-1'] } });
    iniciarSesionEnRecorrido();

    recorrer(
      {
        ruta: '/administracion/pacientes/p-001',
        carpeta: '24-paciente-ficha',
        titulo: 'Pacientes · ficha',
      },
      { evitar: EVITAR_POR_DEFECTO, maxAcciones: 20 },
    );
  });

  it('alta de paciente', () => {
    simularApiTotal({ claims: { ...CLAIMS_ADMIN, tenants: ['t-1'] } });
    iniciarSesionEnRecorrido();

    recorrer(
      {
        ruta: '/administracion/pacientes/nuevo',
        carpeta: '25-paciente-alta',
        titulo: 'Pacientes · alta',
      },
      { evitar: EVITAR_POR_DEFECTO, maxAcciones: 30 },
    );
  });

  it('alta de paciente · envío completo', () => {
    simularApiTotal({ claims: { ...CLAIMS_ADMIN, tenants: ['t-1'] } });
    iniciarSesionEnRecorrido();

    const pantalla = { carpeta: '26-paciente-alta-envio', titulo: 'Pacientes · alta enviada' };

    cy.visit('/administracion/pacientes/nuevo');
    esperarEstable();

    // El explorador toca los controles de a uno y nunca llega a mandar el
    // formulario completo: un envío válido es una secuencia, no un clic.
    cy.contains('button', 'Registrar paciente').click();
    esperarEstable();
    capturar(pantalla, 'envío vacío con los errores de validación');

    // `testId` termina como `data-testid` **del `<input>`**, no de un envoltorio.
    cy.get('input[data-testid="alta-paciente-codigo"]').clear().type('PAC-00099');
    cy.get('input[data-testid="alta-paciente-nombre"]').clear().type('Fernanda Ortiz Lima');
    esperarEstable();
    capturar(pantalla, 'formulario completado');

    cy.contains('button', 'Registrar paciente').click();
    esperarEstable();
    capturar(pantalla, 'después de guardar');
  });

  it('alta asistida', () => {
    simularApiTotal({ claims: { ...CLAIMS_ADMIN, tenants: ['t-1'] } });
    iniciarSesionEnRecorrido();

    recorrer(
      {
        ruta: '/administracion/pacientes/alta-asistida',
        carpeta: '27-alta-asistida',
        titulo: 'Pacientes · alta asistida',
      },
      { evitar: EVITAR_POR_DEFECTO, maxAcciones: 30 },
    );
  });

  it('alta de usuarios', () => {
    simularApiTotal({ claims: { ...CLAIMS_ADMIN, tenants: ['t-1'] } });
    iniciarSesionEnRecorrido();

    recorrer(
      { ruta: '/administracion/usuarios', carpeta: '28-usuarios-alta', titulo: 'Usuarios · alta' },
      { evitar: EVITAR_POR_DEFECTO, maxAcciones: 35 },
    );
  });

  it('búsqueda en el listado de pacientes', () => {
    simularApiTotal({ claims: { ...CLAIMS_ADMIN, tenants: ['t-1'] } });
    iniciarSesionEnRecorrido();

    const pantalla = { carpeta: '29-pacientes-busqueda', titulo: 'Pacientes · búsqueda' };

    cy.visit('/administracion/pacientes');
    esperarEstable();
    capturar(pantalla, 'listado antes de buscar');

    // El campo es `type="text"`, no `search` —el átomo dibujaría su propio botón
    // de limpiar, que no avisa ni devuelve el foco— así que no se lo localiza
    // por rol. Su nombre accesible sale de una etiqueta `sr-only`.
    cy.porEtiqueta('Buscar pacientes').clear().type('Peña');
    esperarEstable();
    capturar(pantalla, 'texto escrito en el buscador');

    cy.porEtiqueta('Buscar pacientes').type('{enter}');
    esperarEstable();
    capturar(pantalla, 'resultados de la búsqueda');
  });

  it('catálogo de terminología', () => {
    simularApiTotal({ claims: { ...CLAIMS_ADMIN, tenants: ['t-1'] } });
    iniciarSesionEnRecorrido();

    recorrer(
      {
        ruta: '/administracion/terminologia',
        carpeta: '30-terminologia',
        titulo: 'Terminología · catálogo',
      },
      { evitar: EVITAR_POR_DEFECTO, maxAcciones: 25 },
    );
  });

  it('búsqueda en el catálogo de terminología', () => {
    simularApiTotal({ claims: { ...CLAIMS_ADMIN, tenants: ['t-1'] } });
    iniciarSesionEnRecorrido();

    const pantalla = { carpeta: '31-terminologia-busqueda', titulo: 'Terminología · búsqueda' };

    cy.visit('/administracion/terminologia');
    esperarEstable();
    capturar(pantalla, 'catálogo completo');

    cy.porEtiqueta('Buscar conceptos').clear().type('femenino');
    esperarEstable();
    capturar(pantalla, 'texto escrito en el buscador');

    cy.porEtiqueta('Buscar conceptos').type('{enter}');
    esperarEstable();
    capturar(pantalla, 'resultados de la búsqueda');
  });
});
