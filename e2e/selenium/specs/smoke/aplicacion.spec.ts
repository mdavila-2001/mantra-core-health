import { describe, expect, test } from 'vitest';
import { By } from 'selenium-webdriver';

import { usarNavegador } from '../../core/test.lifecycle';
import { esperarAplicacionLista } from '../../core/wait.helpers';
import { configuracion } from '../../config/environment';
import { LoginPage } from '../../pages/login.page';
import { NotFoundPage } from '../../pages/not-found.page';

/**
 * Humo: ¿está viva la aplicación?
 *
 * Son las pruebas que se corren primero y en cada pull request. No prueban
 * ningún flujo: prueban que **haya algo que probar**. Si esta suite falla, el
 * resto de los fallos no significan nada, y por eso la suite crítica no se
 * ejecuta hasta que ésta pase.
 */
describe('Humo', () => {
  const navegador = usarNavegador();

  test('la ruta principal responde y pinta la aplicación', async () => {
    const login = new LoginPage(navegador());
    await login.abrir();

    await login.esperarCargada();
    expect(await login.titulo()).toContain('Mantra Core Health');
  });

  test('el artefacto sirve sus recursos y el paquete arranca sin errores de consola', async () => {
    const driver = navegador();
    const login = new LoginPage(driver);
    await login.abrir();
    await login.esperarCargada();

    /**
     * La consola vacía no es cosmética: la CSP del artefacto declara los hashes
     * de sus scripts en línea, y si alguno no cuadrara el navegador lo
     * bloquearía **y solo lo diría acá**. La aplicación arrancaría a medias sin
     * que ninguna otra prueba lo notara.
     */
    const registros = await driver.manage().logs().get('browser');
    const graves = registros.filter((entrada) => entrada.level.value >= 1000);

    expect(graves.map((entrada) => entrada.message)).toEqual([]);
  });

  test('la aplicación hidrata: el formulario responde a la escritura', async () => {
    const login = new LoginPage(navegador());
    await login.abrir();

    // Antes de hidratar, el HTML del servidor se ve igual pero no reacciona.
    // Que el campo acepte texto es la prueba de que el JavaScript tomó el mando.
    await login.escribirIdentificador('prueba@mantra.test');

    expect(await login.mensajeDeError()).toBeNull();
  });

  test('una dirección que no existe lo dice, en vez de redirigir en silencio', async () => {
    const noEncontrada = new NotFoundPage(navegador());
    await noEncontrada.abrir();

    await noEncontrada.esperarCargada();
    expect(await noEncontrada.mensaje()).toMatch(/no encontramos/i);
  });

  test('la navegación principal existe detrás del login', async () => {
    const driver = navegador();
    const login = new LoginPage(driver);
    await login.abrir();

    // Sin sesión no hay armazón, y eso también es parte del contrato: el
    // encabezado con la cuenta no puede existir antes de entrar.
    expect(await driver.findElements(By.css('header[app-header]'))).toHaveLength(0);
    expect(await login.estaVisible()).toBe(true);
  });

  test('el arnés sirve el artefacto de producción, no el servidor de desarrollo', async () => {
    const driver = navegador();
    await driver.get(`${configuracion().baseUrl}/auth`);
    await esperarAplicacionLista(driver);

    /**
     * `outputHashing: "all"` sella el nombre de cada fragmento con su hash. El
     * servidor de desarrollo sirve `main.js` a secas: si esto dejara de
     * cumplirse, la suite estaría probando algo distinto de lo que se despliega
     * y nadie se enteraría, porque las pruebas seguirían en verde.
     */
    const script = await driver.findElement(By.css('script[type="module"][src]'));
    expect(await script.getAttribute('src')).toMatch(/main-[A-Z0-9]{8}\.js$/i);
  });

  test('las rutas públicas llegan prerenderizadas desde el servidor', async () => {
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
    const respuesta = await fetch(`${configuracion().baseUrl}/auth`);
    const html = await respuesta.text();

    expect(html).toContain('ngh=');
  });

  test('el servidor emite las cabeceras de seguridad del despliegue real', async () => {
    /**
     * Las cabeceras no se pueden leer desde el navegador, así que se piden
     * desde Node. Se comprueban acá porque **solo existen en el artefacto**: en
     * desarrollo no las pone nadie, y una CSP que bloqueara un script dejaría
     * la aplicación sin arrancar en producción y no en las pruebas.
     */
    const respuesta = await fetch(`${configuracion().baseUrl}/auth`);

    expect(respuesta.headers.get('content-security-policy')).toContain("default-src 'self'");
    expect(respuesta.headers.get('x-content-type-options')).toBe('nosniff');
    expect(respuesta.headers.get('x-frame-options')).toBe('DENY');
  });
});
