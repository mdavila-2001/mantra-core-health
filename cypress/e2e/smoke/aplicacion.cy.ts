import { erroresDeConsola } from '../../support/consola';
import type { AuditoriaCsp, RespuestaCruda } from '../../harness/tareas';
import { LoginPage } from '../../support/pages/login.page';
import { NotFoundPage } from '../../support/pages/not-found.page';

/**
 * Humo: ¿está viva la aplicación?
 *
 * Son las pruebas que se corren primero y en cada pull request. No prueban
 * ningún flujo: prueban que **haya algo que probar**. Si esta suite falla, el
 * resto de los fallos no significan nada, y por eso la suite crítica no se
 * ejecuta hasta que ésta pase.
 */
describe('Humo', () => {
  it('la ruta principal responde y pinta la aplicación', () => {
    LoginPage.abrir();

    cy.title().should('contain', 'Mantra Core Health');
  });

  it('el paquete arranca sin errores de consola', () => {
    LoginPage.abrir();

    /**
     * Un error de consola en el arranque casi siempre es un fragmento que no
     * cargó o un `provideAppInitializer` que reventó: la aplicación queda a
     * medias y ninguna otra prueba lo nota, porque la pantalla se pinta igual.
     */
    cy.then(() => {
      const errores = erroresDeConsola();
      expect(
        errores.map((mensaje) => `${mensaje.tipo}: ${mensaje.texto}`),
        'la consola del navegador quedó limpia',
      ).to.deep.equal([]);
    });
  });

  it('la aplicación hidrata: el formulario responde a la escritura', () => {
    LoginPage.abrir();

    // Antes de hidratar, el HTML del servidor se ve igual pero no reacciona.
    // Que el campo acepte texto y lo conserve es la prueba de que el
    // JavaScript tomó el mando.
    LoginPage.escribirIdentificador('prueba@mantra.test');

    cy.porTestId('login-identifier').should('have.value', 'prueba@mantra.test');
    LoginPage.sinError();
  });

  it('una dirección que no existe lo dice, en vez de redirigir en silencio', () => {
    NotFoundPage.abrir();

    NotFoundPage.mensaje().should('match', /no encontramos/i);
  });

  it('la navegación principal existe detrás del login', () => {
    LoginPage.abrir();

    // Sin sesión no hay armazón, y eso también es parte del contrato: el
    // encabezado con la cuenta no puede existir antes de entrar.
    cy.get('header[app-header]').should('not.exist');
    cy.porTestId('login-form').should('be.visible');
  });

  it('el arnés sirve el artefacto de producción, no el servidor de desarrollo', () => {
    cy.abrirEscenario('sesion-simple', '/auth');

    /**
     * `outputHashing: "all"` sella el nombre de cada fragmento con su hash. El
     * servidor de desarrollo sirve `main.js` a secas: si esto dejara de
     * cumplirse, la suite estaría probando algo distinto de lo que se despliega
     * y nadie se enteraría, porque las pruebas seguirían en verde.
     */
    cy.get('script[type="module"][src]')
      .invoke('attr', 'src')
      .should('match', /main-[A-Z0-9]{8}\.js$/i);
  });

  it('las rutas públicas llegan prerenderizadas desde el servidor', () => {
    /**
     * `ngh` es la marca que Angular deja en el HTML cuando lo pintó el servidor
     * y el cliente lo va a hidratar. Se lee de la **respuesta cruda**, no del
     * DOM: en el DOM ya no se distingue un HTML hidratado de uno pintado
     * enteramente en el cliente.
     *
     * Esta prueba existe porque el proyecto ya vivió el caso contrario: con
     * `security.allowedHosts` sin declarar, el servidor rechazaba todos los
     * `Host` y degradaba a renderizado de cliente **sin fallar**. Nadie se
     * enteró hasta que se montó este arnés. Con esto, si vuelve a pasar, falla.
     */
    cy.request('/auth').its('body').should('contain', 'ngh=');
  });

  it('un Host que no está declarado no obtiene renderizado del servidor', () => {
    /**
     * La otra mitad del contrato anterior: el prerenderizado **solo** se entrega
     * a los hosts declarados. Es la defensa contra SSRF de Angular — sin ella,
     * alguien le pide al servidor que renderice con el `Host` que él eligió, y
     * todo lo que el render construya a partir del origen sale apuntando a
     * donde ese alguien quiso.
     *
     * Va por `cy.task` y no por `cy.request` porque `Host` es una cabecera
     * prohibida: `cy.request` la descarta en silencio y la petición saldría con
     * el host real, así que la prueba pasaría sin comprobar nada.
     */
    cy.task<RespuestaCruda>('pedirConHost', { host: 'intruso.example', ruta: '/auth' }).then(
      (respuesta) => {
        expect(respuesta.cuerpo).to.not.contain('ngh=');
      },
    );
  });

  it('el servidor emite las cabeceras de seguridad del despliegue real', () => {
    /**
     * Las cabeceras no se pueden leer desde el navegador, así que se piden con
     * `cy.request`, que va por Node. Se comprueban acá porque **solo existen en
     * el artefacto**: en desarrollo no las pone nadie.
     */
    cy.request('/auth').then((respuesta) => {
      expect(respuesta.headers['content-security-policy']).to.contain("default-src 'self'");
      expect(respuesta.headers['x-content-type-options']).to.equal('nosniff');
      expect(respuesta.headers['x-frame-options']).to.equal('DENY');
    });
  });

  it('la CSP autoriza todos los scripts en línea que el servidor manda', () => {
    /**
     * **Esta prueba reemplaza un mecanismo que Cypress rompe.**
     *
     * Antes, una CSP mal armada se detectaba de rebote: el navegador bloqueaba
     * el script, la aplicación arrancaba a medias y la consola lo gritaba. Pero
     * Cypress **elimina la cabecera CSP** de las respuestas para poder
     * inyectarse en la página, así que el navegador nunca la aplica y ese
     * rebote ya no existe.
     *
     * Acá se comprueba lo mismo directamente y sin depender del navegador: se
     * calculan los hashes de los scripts en línea del documento y se verifica
     * que la cabecera los autorice. Un script cuyo hash no esté declarado —el
     * defecto exacto que rompía el arranque en producción— falla acá y con un
     * mensaje que lo nombra.
     */
    cy.task<AuditoriaCsp>('auditarCsp', { ruta: '/auth' }).then((auditoria) => {
      expect(
        auditoria.hashesDelHtml.length,
        'el documento trae scripts en línea que autorizar',
      ).to.be.greaterThan(0);
      expect(
        auditoria.sinAutorizar,
        `la CSP no autoriza estos scripts en línea: ${auditoria.sinAutorizar.join(', ')}`,
      ).to.deep.equal([]);
    });
  });
});
