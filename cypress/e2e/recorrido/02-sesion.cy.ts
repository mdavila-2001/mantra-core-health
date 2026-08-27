import { VIEWPORTS } from '../../support/viewports';
import {
  CLAIMS_ADMIN,
  iniciarSesionEnRecorrido,
  simularApiTotal,
} from '../../support/recorrido/api-total';
import { capturar, esperarEstable, reiniciarContadores } from '../../support/recorrido/evidencia';
import { EVITAR_POR_DEFECTO, recorrer } from '../../support/recorrido/explorador';

/**
 * El área con sesión: el armazón y las pantallas que cuelgan de él.
 *
 * Todas comparten la misma preparación —entrar— así que el `beforeEach` la hace
 * una vez. La sesión lleva rol `SECURITY_ADMIN` para que el menú aparezca
 * entero: con el rol de paciente, la mitad de las secciones no se dibujan y el
 * recorrido no las vería.
 */
describe('Recorrido · área con sesión', () => {
  beforeEach(() => {
    reiniciarContadores();
    simularApiTotal({ claims: { ...CLAIMS_ADMIN, tenants: ['t-1'] } });
    iniciarSesionEnRecorrido();
  });

  it('panel', () => {
    recorrer(
      { ruta: '/dashboard', carpeta: '12-panel', titulo: 'Panel' },
      { evitar: EVITAR_POR_DEFECTO },
    );
  });

  it('mi perfil', () => {
    recorrer(
      { ruta: '/my-account', carpeta: '13-mi-perfil', titulo: 'Mi perfil' },
      { evitar: EVITAR_POR_DEFECTO },
    );
  });

  it('verificar identidad', () => {
    recorrer(
      {
        ruta: '/my-account/identity/verify',
        carpeta: '14-verificar-identidad',
        titulo: 'Verificar identidad',
      },
      { evitar: EVITAR_POR_DEFECTO },
    );
  });

  /**
   * Las secciones que el registro declara como `planificada`.
   *
   * Todas pintan el mismo placeholder, pero **no se ven iguales**: el rótulo, el
   * resumen y la ruta de navegación salen de la sección. Capturarlas una por una
   * es lo que permite revisar que cada una diga lo suyo.
   */
  for (const [ruta, nombre] of [
    ['/administration/organizations', 'organizaciones'],
    // Salieron de esta lista tres secciones, y las tres por el mismo motivo:
    // dejaron de ser un cartel cuando su lectura existió (terminología, agenda
    // y archivo clínico). Sus recorridos viven con administración y atención.
    ['/billing', 'facturacion'],
  ] as const) {
    it(`sección planificada · ${nombre}`, () => {
      recorrer(
        { ruta, carpeta: `15-planificada-${nombre}`, titulo: `Sección · ${nombre}` },
        // Alcanza para el placeholder **y** para los enlaces del menú lateral,
        // que están en todas estas pantallas. Recorrerlos otra vez acá es
        // redundante —el Panel ya los recorre enteros— pero un tope que corta
        // deja una nota que se lee como «falta cobertura», y esa lectura es peor
        // que las capturas de más.
        { evitar: EVITAR_POR_DEFECTO, maxAcciones: 25 },
      );
    });
  }
});

/**
 * Los estados del armazón que no se alcanzan navegando: hay que abrir algo.
 *
 * El explorador los alcanzaría de a uno —abre el menú, captura, sigue— pero no
 * capturaría la secuencia: abrir el menú **y después** elegir. Estas pruebas la
 * arman a mano porque es un camino, no un control suelto.
 */
describe('Recorrido · armazón', () => {
  beforeEach(() => {
    reiniciarContadores();
  });

  it('menú de cuenta y cierre de sesión', () => {
    simularApiTotal({ claims: { ...CLAIMS_ADMIN, tenants: ['t-1'] } });
    iniciarSesionEnRecorrido();

    const pantalla = { carpeta: '16-menu-cuenta', titulo: 'Menú de cuenta' };

    esperarEstable();
    capturar(pantalla, 'panel con el menú cerrado');

    cy.porTestId('header-cuenta').click();
    esperarEstable();
    capturar(pantalla, 'menú de cuenta abierto');

    cy.porTestId('header-cerrar-sesion').click();
    cy.location('pathname').should('match', /\/auth$/);
    esperarEstable();
    capturar(pantalla, 'después de cerrar sesión');
  });

  it('selector de organización', () => {
    simularApiTotal({ claims: CLAIMS_ADMIN });

    cy.visit('/auth');
    cy.esperarAplicacionLista();
    cy.porTestId('login-identifier').clear().type('ana@mantra.test');
    cy.porTestId('login-password').clear().type('secreto-de-prueba');
    cy.porTestId('login-submit').click();

    const pantalla = { carpeta: '17-organizaciones', titulo: 'Cambio de organización' };

    // Con dos organizaciones el login desemboca en la pantalla de elección.
    cy.location('pathname').should('match', /\/auth\/organizacion$/);
    esperarEstable();
    capturar(pantalla, 'elección de organización');

    cy.porTestId('tenant-opcion').contains('Clínica Norte').click();
    cy.location('pathname').should('match', /\/panel$/);
    esperarEstable();
    capturar(pantalla, 'panel con Clínica Norte activa');

    cy.porTestId('header-organizacion').click();
    esperarEstable();
    capturar(pantalla, 'selector de organización desplegado');
  });

  it('menú lateral en móvil', () => {
    simularApiTotal({ claims: { ...CLAIMS_ADMIN, tenants: ['t-1'] } });
    iniciarSesionEnRecorrido();

    const pantalla = { carpeta: '18-nav-movil', titulo: 'Navegación en móvil' };

    // El nav pasa a cajón por debajo del punto de corte: en escritorio es una
    // columna fija y el botón de menú ni siquiera se dibuja.
    cy.viewport(VIEWPORTS.movil.ancho, VIEWPORTS.movil.alto);
    cy.visit('/dashboard');
    esperarEstable();
    capturar(pantalla, 'panel en móvil con el cajón cerrado');

    cy.porTestId('header-menu').click();
    esperarEstable();
    capturar(pantalla, 'cajón de navegación abierto');
  });

  it('el guard manda al login sin sesión', () => {
    simularApiTotal();

    const pantalla = { carpeta: '19-guard', titulo: 'Guard de sesión' };

    cy.visit('/dashboard');
    cy.location('pathname').should('match', /\/auth$/);
    esperarEstable();
    capturar(pantalla, 'sin sesión, /panel redirige al login');
  });

  it('identidad sin verificar no tapa el perfil', () => {
    simularApiTotal({
      claims: { ...CLAIMS_ADMIN, tenants: ['t-1'] },
      identidadSinVerificar: true,
    });
    iniciarSesionEnRecorrido();

    // La carpeta conserva su nombre: el informe del recorrido la referencia por
    // ahí, y lo que cambió es lo que la pantalla muestra, no de qué habla.
    const pantalla = { carpeta: '20-identidad-requerida', titulo: 'Identidad sin verificar' };

    cy.visit('/my-account');
    esperarEstable();

    // F-34: sus datos están y no hay muro. Mientras el producto no ofrezca la
    // verificación tampoco se nombra el trámite —ni la fila del código ni la
    // invitación—: anunciar que falta algo que no se puede hacer deja a la
    // persona buscando una puerta que no está.
    cy.contains('dd', 'Ana Salas').should('be.visible');
    cy.contains('Pendiente de verificación').should('not.exist');
    cy.contains('a', 'Verificá tu identidad para ver tu código de paciente').should('not.exist');
    cy.contains('cuando tu identidad esté verificada').should('not.exist');

    capturar(pantalla, 'mi perfil con identidad sin verificar');
  });

  it('el panel con el directorio caído', () => {
    simularApiTotal({
      claims: { ...CLAIMS_ADMIN, tenants: ['t-1'] },
      directorioRoto: true,
    });
    iniciarSesionEnRecorrido();

    const pantalla = { carpeta: '21-panel-error', titulo: 'Panel · directorio caído' };

    cy.visit('/dashboard');
    esperarEstable();
    capturar(pantalla, 'panel con el directorio en error');
  });
});
