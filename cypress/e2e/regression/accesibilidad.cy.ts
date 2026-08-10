import type { ProblemaA11y } from '../../support/commands';
import { iniciarSesion } from '../../support/helpers/auth';
import { LoginPage } from '../../support/pages/login.page';
import { RegisterPage } from '../../support/pages/register.page';

/**
 * Reglas cuyo incumplimiento el sistema de diseño ya declara y acepta.
 *
 * `color-contrast` sobre `--text-muted` es la **excepción E1** que
 * `scripts/check-contrast.mjs` enumera y verifica: no es un hallazgo nuevo, es
 * una decisión tomada y medida. Hacer fallar esta suite por ella significaría
 * que nadie la puede dejar en verde, y una suite que no se puede dejar en verde
 * se termina desactivando.
 *
 * Lo que sí protege esta lista: cualquier problema grave **distinto** de éstos
 * hace fallar la prueba. Y si la excepción desaparece del sistema de diseño, hay
 * que borrarla de acá — el guardián de eso es `check-contrast.mjs`, que avisa
 * cuando una excepción deja de hacer falta.
 */
const DEUDA_DECLARADA = new Set(['color-contrast']);

/** Resumen legible para el mensaje de un fallo. */
function describir(problemas: readonly ProblemaA11y[]): string {
  return problemas
    .map((p) => `· [${p.impacto}] ${p.id}: ${p.descripcion} → ${p.elementos.join(', ')}`)
    .join('\n');
}

/**
 * Accesibilidad de lo que ya está en pantalla.
 *
 * **No es una auditoría.** Es la red que atrapa los defectos que solo existen
 * con la pantalla montada de verdad: un botón que perdió su nombre accesible al
 * quedarse sin texto, un campo que dejó de estar asociado a su etiqueta porque
 * cambió un identificador, un menú que no se puede cerrar con el teclado. Las
 * pruebas unitarias de los componentes no los ven porque ahí cada componente
 * está solo.
 *
 * Solo bloquean los problemas `critical` y `serious`. Los menores se anotan como
 * deuda en `docs/` y no hacen fallar la suite: un umbral que nadie puede dejar
 * en verde se termina desactivando.
 */
describe('Regresión · accesibilidad', () => {
  it('el login no tiene problemas graves de accesibilidad', () => {
    LoginPage.abrir();

    cy.problemasGraves().then((problemas) => {
      expect(problemas, describir(problemas)).to.deep.equal([]);
    });
  });

  it('el panel no tiene problemas graves de accesibilidad', () => {
    iniciarSesion();

    cy.problemasGraves().then((todos) => {
      const problemas = todos.filter((problema) => !DEUDA_DECLARADA.has(problema.id));
      expect(problemas, describir(problemas)).to.deep.equal([]);
    });
  });

  it('cada campo del login tiene su etiqueta y cada botón su nombre', () => {
    LoginPage.abrir();

    cy.problemasGraves({
      reglas: ['label', 'button-name', 'link-name', 'aria-required-attr'],
    }).then((problemas) => {
      expect(problemas, describir(problemas)).to.deep.equal([]);
    });
  });

  it('se puede llegar al botón de entrar solo con el tabulador', () => {
    LoginPage.abrir();

    /**
     * El recorrido usa pulsaciones **reales** vía CDP: Cypress no sabe enviar
     * el tabulador, y emularlo moviendo el foco con `focus()` probaría otra
     * cosa —saltearía las trampas de foco, que son justo lo que puede dejar un
     * control inalcanzable—.
     */
    cy.tecla('Tab');
    cy.recorridoDeTeclado(14).then((recorrido) => {
      expect(recorrido.join(' | ')).to.match(/login-submit|entrar/i);
    });
  });

  it('el formulario se envía con Enter desde el campo de contraseña', () => {
    LoginPage.abrir('credenciales-invalidas');

    LoginPage.escribirIdentificador('ana@mantra.test');
    LoginPage.escribirPassword('lo-que-sea');
    LoginPage.enviarConEnter();

    // Que llegue el error del servidor prueba que Enter envió: sin
    // `type=submit` funcionando, no habría pasado nada.
    LoginPage.esperarError().should('match', /credenciales/i);
  });

  it('la pantalla de registro conserva las etiquetas al cambiar de tipo de cuenta', () => {
    RegisterPage.abrir();

    RegisterPage.elegirProfesional();

    // Cambiar el formulario entero es justo donde se pierde la asociación entre
    // etiqueta y campo: los identificadores se regeneran.
    cy.problemasGraves({ reglas: ['label', 'button-name'] }).then((problemas) => {
      expect(problemas, describir(problemas)).to.deep.equal([]);
    });
  });
});
