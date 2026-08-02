import { describe, expect, test } from 'vitest';
import { By, Key } from 'selenium-webdriver';

import { usarNavegador } from '../../core/test.lifecycle';
import { describir, problemasGraves, recorridoDeTeclado } from '../../helpers/a11y.helper';
import { iniciarSesion } from '../../helpers/auth.helper';
import { LoginPage } from '../../pages/login.page';
import { RegisterPage } from '../../pages/register.page';

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
 * hace fallar la prueba. Y si la excepción desaparece del sistema de diseño,
 * hay que borrarla de acá — el guardián de eso es `check-contrast.mjs`, que
 * avisa cuando una excepción deja de hacer falta.
 */
const DEUDA_DECLARADA = new Set(['color-contrast']);

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
 * Solo bloquean los problemas `critical` y `serious`. Los menores se anotan
 * como deuda en `docs/` y no hacen fallar la suite: un umbral que nadie puede
 * dejar en verde se termina desactivando.
 */
describe('Regresión · accesibilidad', () => {
  const navegador = usarNavegador();

  test('el login no tiene problemas graves de accesibilidad', async () => {
    const login = new LoginPage(navegador());
    await login.abrir();
    await login.esperarCargada();

    const problemas = await problemasGraves(navegador());

    expect(problemas, describir(problemas)).toEqual([]);
  });

  test('el panel no tiene problemas graves de accesibilidad', async () => {
    await iniciarSesion(navegador());

    const problemas = (await problemasGraves(navegador())).filter(
      (problema) => !DEUDA_DECLARADA.has(problema.id),
    );

    expect(problemas, describir(problemas)).toEqual([]);
  });

  test('cada campo del login tiene su etiqueta y cada botón su nombre', async () => {
    const login = new LoginPage(navegador());
    await login.abrir();

    const problemas = await problemasGraves(navegador(), {
      reglas: ['label', 'button-name', 'link-name', 'aria-required-attr'],
    });

    expect(problemas, describir(problemas)).toEqual([]);
  });

  test('se puede llegar al botón de entrar solo con el tabulador', async () => {
    const login = new LoginPage(navegador());
    await login.abrir();

    // El primer foco lo pone la propia página; a partir de ahí, tabulador.
    await navegador().actions().sendKeys(Key.TAB).perform();
    const recorrido = await recorridoDeTeclado(navegador(), 14);

    expect(recorrido.join(' | ')).toMatch(/login-submit|entrar/i);
  });

  test('el formulario se envía con Enter desde el campo de contraseña', async () => {
    const login = new LoginPage(navegador());
    await login.abrir('credenciales-invalidas');

    await login.escribirIdentificador('ana@mantra.test');
    await login.escribirPassword('lo-que-sea');
    await navegador().findElement(By.css('[data-testid="login-password"]')).sendKeys(Key.ENTER);

    // Que llegue el error del servidor prueba que Enter envió: sin `type=submit`
    // funcionando, no habría pasado nada.
    expect(await login.esperarError()).toMatch(/credenciales/i);
  });

  test('la pantalla de registro conserva las etiquetas al cambiar de tipo de cuenta', async () => {
    const registro = new RegisterPage(navegador());
    await registro.abrir();

    await registro.elegirProfesional();

    // Cambiar el formulario entero es justo donde se pierde la asociación entre
    // etiqueta y campo: los identificadores se regeneran.
    const problemas = await problemasGraves(navegador(), { reglas: ['label', 'button-name'] });
    expect(problemas, describir(problemas)).toEqual([]);
  });
});
