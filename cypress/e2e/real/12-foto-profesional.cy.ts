import type { Interception } from 'cypress/types/net-stubbing';

import { Header } from '../../support/components/header.component';
import { apiViva, crearMedico, type Actor } from '../../support/real/actores';
import { RUTAS } from '../../support/real/rutas';
import { entrar, estable, irA } from '../../support/real/sesion';

/** Una respuesta que atravesó la red y no salió del interceptor simulado. */
function exigirRespuestaReal(llamada: Interception, nombre: string, statusEsperado: number) {
  const respuesta = llamada.response;
  expect(respuesta, `${nombre}: respuesta HTTP`).not.to.equal(undefined);
  expect(respuesta!.statusCode, `${nombre}: status`).to.equal(statusEsperado);
  expect(respuesta!.headers, `${nombre}: sin x-mock-backend`).not.to.have.property(
    'x-mock-backend',
  );
  return respuesta!;
}

/** El retrato propio ya resuelto por `/common/files/:id/content`. */
function fotoVisible(): Cypress.Chainable<string> {
  return cy
    .porTestId('perfil-foto')
    .closest('label')
    .find<HTMLImageElement>('app-avatar img.avatar__image')
    .should(($imagen) => {
      const imagen = $imagen[0];
      expect(imagen?.complete, 'imagen decodificada').to.equal(true);
      expect(imagen?.naturalWidth, 'ancho real').to.be.greaterThan(0);
      expect(imagen?.naturalHeight, 'alto real').to.be.greaterThan(0);
    })
    .invoke('attr', 'src')
    .should('match', /^data:image\/png;base64,/)
    .then((src) => String(src));
}

/** Registra las cuatro llamadas que prueban el journey, con alias por etapa. */
function observar(etapa: string, profileId: string): void {
  cy.intercept('POST', '**/common/files/upload').as(`subir-${etapa}`);
  cy.intercept('PUT', `**/profiles/practitioners/${profileId}/photo`).as(`actualizar-${etapa}`);
  cy.intercept('GET', '**/profiles/practitioners/me/summary').as(`leer-${etapa}`);
  cy.intercept('GET', '**/common/files/*/content').as(`contenido-${etapa}`);
}

describe('2.2 · foto del perfil profesional contra API real', () => {
  let medico: Actor;

  before(() => {
    apiViva().should('equal', true);
    crearMedico().then((actor) => {
      medico = actor;
    });
  });

  it('persiste la foto tras relectura, refresh y un login nuevo', () => {
    let fileId = '';
    let fotoGuardada = '';
    const profileId = medico.datos['practitionerProfileId'];

    expect(profileId, 'perfil profesional del actor').not.to.equal('');
    observar('inicial', profileId);

    entrar(medico);
    irA(RUTAS.miCuenta);
    cy.wait('@leer-inicial').then((llamada) => {
      exigirRespuestaReal(llamada, 'lectura inicial', 200);
    });
    estable();

    cy.fixture('foto-profesional-2.2.base64.txt', 'utf8').then((base64: string) => {
      cy.porTestId('perfil-foto').selectFile(
        {
          contents: Cypress.Buffer.from(base64.trim(), 'base64'),
          fileName: 'foto-profesional-2.2.png',
          mimeType: 'image/png',
        },
        { force: true },
      );
    });

    cy.wait('@subir-inicial').then((llamada) => {
      const respuesta = exigirRespuestaReal(llamada, 'upload', 201);
      const cuerpo = respuesta.body as Record<string, unknown>;
      expect(cuerpo['id'], 'fileId del upload').to.be.a('string').and.not.equal('');
      fileId = String(cuerpo['id']);
    });

    cy.wait('@actualizar-inicial').then((llamada) => {
      const respuesta = exigirRespuestaReal(llamada, 'update de foto', 200);
      expect(llamada.request.body, 'fileId enviado al perfil').to.deep.equal({ fileId });
      expect((respuesta.body as Record<string, unknown>)['photoFileId']).to.equal(fileId);
    });

    cy.wait('@contenido-inicial').then((llamada) => {
      const respuesta = exigirRespuestaReal(llamada, 'contenido de la foto', 200);
      expect(respuesta.headers['content-type'], 'MIME servido').to.include('image/png');
      expect(llamada.request.url, 'contenido del fileId').to.include(
        `/common/files/${fileId}/content`,
      );
    });
    fotoVisible().then((src) => {
      fotoGuardada = src;
    });

    observar('refresh', profileId);
    cy.reload();
    cy.esperarAplicacionLista();
    cy.wait('@leer-refresh').then((llamada) => {
      const respuesta = exigirRespuestaReal(llamada, 'relectura tras refresh', 200);
      expect((respuesta.body as Record<string, unknown>)['photoFileId']).to.equal(fileId);
    });
    cy.wait('@contenido-refresh').then((llamada) => {
      exigirRespuestaReal(llamada, 'contenido tras refresh', 200);
    });
    estable();
    fotoVisible().should((src) => expect(src, 'misma foto tras refresh').to.equal(fotoGuardada));

    cy.intercept('POST', '**/iam/auth/logout').as('logout-real');
    Header.cerrarSesion();
    cy.wait('@logout-real').then((llamada) => {
      exigirRespuestaReal(llamada, 'logout', 200);
    });
    cy.location('pathname').should('equal', RUTAS.ingreso);

    observar('login-nuevo', profileId);
    entrar(medico);
    irA(RUTAS.miCuenta);
    cy.wait('@leer-login-nuevo').then((llamada) => {
      const respuesta = llamada.response;
      expect(respuesta, 'relectura tras login nuevo: respuesta HTTP').not.to.equal(undefined);
      expect(
        respuesta!.headers,
        'relectura tras login nuevo: sin x-mock-backend',
      ).not.to.have.property('x-mock-backend');
      expect(
        respuesta!.statusCode,
        'relectura tras login nuevo: 200 o revalidación ETag',
      ).to.be.oneOf([200, 304]);

      if (respuesta!.statusCode === 200) {
        expect((respuesta!.body as Record<string, unknown>)['photoFileId']).to.equal(fileId);
      } else {
        expect(llamada.request.headers, 'relectura condicionada con ETag').to.have.property(
          'if-none-match',
        );
      }
    });
    cy.wait('@contenido-login-nuevo').then((llamada) => {
      exigirRespuestaReal(llamada, 'contenido tras login nuevo', 200);
      expect(llamada.request.url, 'contenido tras login nuevo del mismo fileId').to.include(
        `/common/files/${fileId}/content`,
      );
    });
    estable();
    fotoVisible().should((src) =>
      expect(src, 'misma foto tras login nuevo').to.equal(fotoGuardada),
    );

    cy.task(
      'registrar',
      '2.2 · MOCKS_ENABLED=false · MOCK_BACKEND_ENABLED=false · REAL_API_REACHED=yes · ' +
        'upload=201 · update=200 · read(refresh/login)=200 · content=200',
    );
  });
});
