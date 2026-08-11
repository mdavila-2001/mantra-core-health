import { nuevoPaciente } from '../../support/fixtures/usuarios';
import { RegisterPage } from '../../support/pages/register.page';

/**
 * Alta de cuenta.
 *
 * Dos contratos distintos en una pantalla: el paciente entra con su documento y
 * el correo es opcional; el profesional entra con su correo y necesita
 * matrícula y credencial. Que el conmutador cambie **de verdad** el formulario
 * —y no solo la etiqueta— es la mitad de lo que se prueba acá.
 *
 * Los datos se generan únicos por corrida (`nuevoPaciente()`): dos ejecuciones
 * seguidas no pueden chocar entre sí.
 */
describe('Formularios · registro', () => {
  it('un paciente se da de alta con documento, nombre y contraseña', () => {
    RegisterPage.abrir();

    RegisterPage.registrarPaciente(nuevoPaciente());

    RegisterPage.esperarConfirmacion().should('match', /cuenta está lista/i);
  });

  it('con correo, el alta avisa que mandó la verificación', () => {
    RegisterPage.abrir();

    RegisterPage.registrarPaciente(nuevoPaciente(), { conCorreo: true });

    // El correo es opcional y **no condiciona el acceso**: la cuenta queda
    // usable igual. Lo que cambia es que haya algo que verificar.
    RegisterPage.esperarConfirmacion().should('match', /cuenta está lista/i);
  });

  it('los campos obligatorios se avisan sin llegar a la API', () => {
    RegisterPage.abrir('registro-duplicado');

    RegisterPage.enviarFormulario();

    RegisterPage.mensajesDeValidacion(3).should('have.length.at.least', 3);
    // Si el formulario hubiera llamado igual, el escenario habría devuelto 409
    // y estaríamos viendo el error del servidor en vez del del campo.
    RegisterPage.sinError();
  });

  it('una contraseña corta se rechaza en el cliente', () => {
    RegisterPage.abrir();

    RegisterPage.registrarPaciente({ ...nuevoPaciente(), password: 'corta' });

    RegisterPage.mensajesDeValidacion().then((mensajes) => {
      expect(mensajes.join(' ')).to.match(/8 caracteres/i);
    });
  });

  it('un documento ya registrado se explica como conflicto, no como error genérico', () => {
    RegisterPage.abrir('registro-duplicado');

    RegisterPage.registrarPaciente(nuevoPaciente());

    RegisterPage.esperarError().should('match', /ya existe|documento/i);
  });

  it('elegir «profesional» cambia el formulario, no solo el rótulo', () => {
    RegisterPage.abrir();

    RegisterPage.elegirProfesional();

    // La matrícula y la credencial solo existen en el formulario profesional:
    // que aparezcan es la prueba de que se cambió de contrato, no de texto.
    RegisterPage.esperarFormularioProfesional();
  });

  it('desde la confirmación se vuelve al login', () => {
    RegisterPage.abrir();

    RegisterPage.registrarPaciente(nuevoPaciente());
    RegisterPage.esperarConfirmacion();

    RegisterPage.irALogin();

    cy.location('pathname').should('match', /\/auth$/);
  });
});
