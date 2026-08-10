import { paciente, pacienteConDocumento } from '../../support/fixtures/usuarios';
import { DashboardPage } from '../../support/pages/dashboard.page';
import { LoginPage } from '../../support/pages/login.page';
import { TenantSelectionPage } from '../../support/pages/tenant-selection.page';

/**
 * Inicio de sesión.
 *
 * La pantalla tiene **un solo campo de identificador** porque el backend acepta
 * correo *o* documento y nunca ambos; la arroba decide cuál es. Que los dos
 * caminos funcionen es lo primero que se prueba: es el punto por donde entra
 * absolutamente todo el mundo.
 */
describe('Autenticación · inicio de sesión', () => {
  it('con una sola organización se entra directo al panel', () => {
    LoginPage.abrir('sesion-simple');

    LoginPage.entrar(paciente());

    cy.location('pathname').should('match', /\/panel$/);
    DashboardPage.esperarTitulo('Panel');
  });

  it('el documento de identidad también es un identificador válido', () => {
    LoginPage.abrir('sesion-simple');

    // Sin arroba, la pantalla tiene que mandarlo como documento. Si mandara un
    // correo mal formado, el backend respondería 400 y no habría sesión.
    LoginPage.entrar(pacienteConDocumento());

    cy.location('pathname').should('match', /\/panel$/);
  });

  it('con varias organizaciones hay que elegir antes de entrar', () => {
    LoginPage.abrir('multi-organizacion');

    LoginPage.entrar(paciente());

    // La elección es una pantalla propia porque cambia **qué datos se ven**:
    // mezclarla con las credenciales invita a pasarla por alto.
    TenantSelectionPage.esperarCargada();
    TenantSelectionPage.organizacionesOfrecidas().should('deep.equal', [
      'Clínica Norte',
      'Centro Sur',
    ]);

    TenantSelectionPage.elegir('Centro Sur');
    cy.location('pathname').should('match', /\/panel$/);
  });

  it('credenciales inválidas muestran un mensaje accionable, no uno genérico', () => {
    LoginPage.abrir('credenciales-invalidas');

    LoginPage.entrar(paciente());

    /**
     * En cualquier otra pantalla `UNAUTHENTICATED` significa «la sesión venció».
     * Acá significa «lo que acabás de escribir no sirve», y decir lo primero
     * mandaría a la persona a iniciar sesión… donde ya está.
     */
    LoginPage.esperarError().should('match', /credenciales/i);
    cy.location('pathname').should('match', /\/auth$/);
  });

  it('los campos obligatorios se avisan sin llamar a la API', () => {
    LoginPage.abrir('credenciales-invalidas');

    // Sin escribir nada: si el formulario dejara enviar, el escenario haría
    // fallar la petición y el mensaje sería el del servidor, no el del campo.
    LoginPage.enviarFormulario();

    LoginPage.mensajesDeValidacion(2).then((mensajes) => {
      expect(mensajes.length).to.be.at.least(2);
      expect(mensajes.join(' ')).to.match(/ingresá/i);
    });
    LoginPage.sinError();
  });

  it('la contraseña se puede revelar y volver a ocultar', () => {
    LoginPage.abrir();
    LoginPage.escribirPassword('secreto');

    LoginPage.esperarTipoDelCampoPassword('password');

    LoginPage.alternarVisibilidadPassword();
    LoginPage.esperarTipoDelCampoPassword('text');

    LoginPage.alternarVisibilidadPassword();
    LoginPage.esperarTipoDelCampoPassword('password');
  });

  it('mientras la API responde, el botón queda ocupado y no admite un segundo envío', () => {
    LoginPage.abrir('api-lenta');

    LoginPage.escribirIdentificador(paciente().identificador);
    LoginPage.escribirPassword(paciente().password);
    LoginPage.enviarFormulario();

    // El estado ocupado no es cosmético: es lo que impide que dos clics
    // seguidos abran dos sesiones y dejen una huérfana del lado del servidor.
    LoginPage.esperarEnviando();

    LoginPage.esperarSalidaDelLogin();
    cy.location('pathname').should('match', /\/panel$/);
  });
});
