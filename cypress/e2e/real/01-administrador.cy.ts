import { capturar, reiniciarContadores } from '../../support/recorrido/evidencia';
import { admin, apiViva } from '../../support/real/actores';
import { aparece, entrar, estable, irA, recorrer } from '../../support/real/sesion';
import { describirHallazgos, Vigilante } from '../../support/real/vigilante';

/**
 * **Administrador** — la cuenta que la API siembra con `BOOTSTRAP_ADMIN_*`.
 *
 * Es la única sesión que alcanza el sistema entero: su rol `SUPERADMIN` es
 * comodín en el `RolesGuard` del backend, así que ve todas las secciones y
 * ninguna lectura debería devolverle un error de permisos. Eso la vuelve el
 * mejor detector de defectos reales: casi cualquier error acá es del producto.
 *
 * ## Por qué es **una** prueba y no seis
 *
 * `POST /iam/auth/login` está limitado a diez por minuto y por IP —defensa
 * contra fuerza bruta, no un estorbo—. Con una prueba por sección, los cuatro
 * actores gastaban veinte ingresos en un minuto y la suite se rompía sola
 * contra una protección que funciona.
 *
 * Un recorrido es, además, exactamente eso: un recorrido. Partirlo en pruebas
 * sueltas tampoco daba independencia real.
 */
describe('Recorrido real · administrador', () => {
  before(() => {
    apiViva().should(
      'equal',
      true,
      // El mensaje va acá porque un backend caído es la causa más común de que
      // esta suite no arranque, y sin decirlo el fallo parece del frontend.
    );
  });

  beforeEach(() => {
    reiniciarContadores();
  });

  it('recorre el sistema entero sin errores', () => {
    const vigilante = new Vigilante('administrador');
    const cuenta = admin();

    entrar({ ...cuenta, nombre: 'Administrador', datos: {} });

    /* -- Punto de partida ------------------------------------------------- */

    recorrer(vigilante, { ruta: '/dashboard', carpeta: 'admin-01-panel', titulo: 'Panel' });
    recorrer(vigilante, {
      ruta: '/my-account',
      carpeta: 'admin-02-mi-cuenta',
      titulo: 'Mi perfil',
    });
    recorrer(vigilante, {
      ruta: '/my-account/identity/verify',
      carpeta: 'admin-03-identidad',
      titulo: 'Verificar identidad',
    });

    /* -- Padrón de pacientes ---------------------------------------------- */

    recorrer(vigilante, {
      ruta: '/administration/patients',
      carpeta: 'admin-04-pacientes',
      titulo: 'Pacientes',
    });

    // La ficha se abre desde una fila, que es como se llega de verdad. Con el
    // padrón vacío no hay fila que tocar y se sigue, en vez de fabricar un
    // identificador que no existe.
    aparece('table tbody tr a', 'admin-04-pacientes', 'la ficha de un paciente del padrón').then(
      (hayFila) => {
        if (!hayFila) {
          return;
        }
        vigilante.en('Ficha de paciente');
        cy.get('table tbody tr a').first().click();
        estable();
        capturar(
          { carpeta: 'admin-05-ficha-paciente', titulo: 'Ficha de paciente' },
          'desde-el-listado',
        );
        cy.get('h1').first().invoke('text').should('match', /\S/);
      },
    );

    recorrer(vigilante, {
      ruta: '/administration/patients/new',
      carpeta: 'admin-06-alta-paciente',
      titulo: 'Nuevo paciente',
    });
    recorrer(vigilante, {
      ruta: '/administration/patients/assisted-registration',
      carpeta: 'admin-07-alta-asistida',
      titulo: 'Alta asistida',
    });

    /* -- Catálogos y cuentas ---------------------------------------------- */

    recorrer(vigilante, {
      ruta: '/administration/terminology',
      carpeta: 'admin-08-terminologia',
      titulo: 'Terminología',
    });

    // El buscador contra el catálogo real: es la mitad del endpoint que el
    // cliente no usaba, y la que enciende la sección.
    cy.porEtiqueta(/search conceptos/i).clear().type('cholera');
    estable();
    capturar({ carpeta: 'admin-08-terminologia', titulo: 'Terminología' }, 'buscando-cholera');

    recorrer(vigilante, {
      ruta: '/administration/users',
      carpeta: 'admin-09-usuarios',
      titulo: 'Usuarios',
    });

    /* -- Agenda: la sección que dejó de ser un cartel ---------------------- */

    recorrer(vigilante, { ruta: '/schedule', carpeta: 'admin-10-agenda', titulo: 'Agenda' });

    /**
     * El selector tiene que **mostrar** el recurso que se está mirando.
     *
     * Un desplegable que dice «Seleccionar opción» con una agenda cargada debajo
     * es la pantalla contradiciéndose, y fue un defecto real del `app-select`:
     * aplicaba la selección con un `[value]` que corría antes de que existieran
     * las opciones. El vacío es el índice del placeholder oculto.
     */
    cy.document({ log: false }).then((doc) => {
      /**
       * El desplegable **de recurso**, no cualquiera.
       *
       * La pantalla tiene más de un `<select>` —el de la ventana de fechas es
       * otro— y buscar «el primero» hacía que la comprobación mirara el
       * equivocado: contaba las opciones del filtro de rango, concluía que había
       * recursos y después afirmaba sobre un desplegable que efectivamente
       * estaba vacío. Se resuelve por la etiqueta, que es lo que identifica al
       * control para quien lo usa.
       */
      const etiqueta = [...doc.querySelectorAll('label')].find((el) =>
        (el.textContent ?? '').trim().startsWith('Recurso'),
      );
      const destino = etiqueta?.getAttribute('for');
      const selector = destino == null ? null : doc.getElementById(destino);

      // El placeholder oculto también es una `<option>`: con una sola, no hay
      // ningún recurso que el desplegable pueda estar mostrando.
      const hayRecursos = selector !== null && selector.querySelectorAll('option').length > 1;

      if (!hayRecursos) {
        /**
         * Sin recursos agendables no hay nada que comprobar, y afirmarlo igual
         * sería exigir que el desplegable muestre algo que no existe.
         *
         * Pasa de verdad: el tenant del administrador de arranque se siembra
         * **vacío**, así que en una base recién levantada esta comprobación no
         * tiene datos. Se anota en vez de saltarse en silencio, porque «no se
         * pudo comprobar» y «se comprobó y está bien» no son lo mismo.
         */
        cy.task('anotarOmision', {
          pantalla: 'admin-10-agenda',
          motivo:
            'No se comprobó que el selector muestre el recurso activo: este tenant no tiene ' +
            'recursos agendables, así que el desplegable sólo trae su placeholder.',
        });
        return;
      }

      cy.porEtiqueta('Recurso').should('not.have.value', '');
    });

    // La pestaña de cupos: el panel inactivo no existe en el DOM, así que sin
    // este clic la evidencia no mostraría la mitad de la pantalla.
    aparece('[role="tab"]', 'admin-10-agenda', 'la pestaña de cupos').then((hayPestanas) => {
      if (!hayPestanas) {
        return;
      }
      cy.get('[role="tab"]').contains(/cupos/i).click();
      estable();
      capturar({ carpeta: 'admin-10-agenda', titulo: 'Agenda' }, 'pestana-cupos');
    });

    // La ventana de treinta días, que es la que más le pide al backend.
    vigilante.en('Agenda · 30 días');
    irA('/schedule?rango=mes');
    estable();
    capturar({ carpeta: 'admin-10-agenda', titulo: 'Agenda' }, 'ventana-30-dias');

    /* -- Archivo clínico y expediente -------------------------------------- */

    recorrer(vigilante, {
      ruta: '/medical-records',
      carpeta: 'admin-11-archivo-clinico',
      titulo: 'Archivo clínico',
    });

    aparece('a:contains("Ver expediente")', 'admin-11-archivo-clinico', 'el expediente de un paciente').then(
      (hayExpediente) => {
        if (!hayExpediente) {
          return;
        }
        vigilante.en('Expediente clínico');
        cy.contains('a', /ver expediente/i).first().click();
        estable();
        capturar(
          { carpeta: 'admin-12-expediente', titulo: 'Expediente clínico' },
          'desde-el-listado',
        );

        // Las ocho pestañas, una por una: cada panel se dibuja sólo cuando está
        // activo, así que una sola captura no probaría ninguna de las otras siete.
        cy.get('[role="tab"]').then(($pestanas) => {
          const rotulos = $pestanas.toArray().map((nodo) => (nodo.textContent ?? '').trim());
          rotulos.forEach((rotulo, indice) => {
            cy.get('[role="tab"]').eq(indice).click();
            estable();
            capturar(
              { carpeta: 'admin-12-expediente', titulo: 'Expediente clínico' },
              rotulo === '' ? `pestana-${indice}` : rotulo,
            );
          });
        });
      },
    );

    /* -- Lo que sigue planificado ------------------------------------------ */

    for (const [ruta, carpeta, titulo] of [
      ['/administration/organizations', 'admin-13-organizaciones', 'Organizaciones'],
      ['/billing', 'admin-14-facturacion', 'Facturación'],
    ] as const) {
      recorrer(vigilante, { ruta, carpeta, titulo });
    }

    cy.then(() => {
      vigilante.recoger();
      expect(vigilante.hallazgos, describirHallazgos(vigilante.hallazgos)).to.deep.equal([]);
    });
  });
});
