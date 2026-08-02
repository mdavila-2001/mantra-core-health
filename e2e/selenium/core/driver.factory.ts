import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { Builder, logging, type WebDriver } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';

import { configuracion, type ConfiguracionE2e, type Viewport } from '../config/environment';

/**
 * Fábrica única de WebDriver.
 *
 * Todo lo que configura un navegador de prueba está acá y en ningún otro lado:
 * si una prueba necesitara un navegador distinto, el cambio se hace en un
 * archivo y lo heredan las cuarenta. Un `new Builder()` suelto en una spec es
 * exactamente cómo empieza la deriva entre pruebas que se supone comparables.
 *
 * ## Sobre el driver
 *
 * No se instala ni se versiona ningún chromedriver: **Selenium Manager**, que
 * viene dentro de `selenium-webdriver`, resuelve el binario que corresponde al
 * Chrome instalado y lo cachea. Es lo que evita el mantenimiento manual que
 * rompe estas suites cada vez que el navegador se actualiza solo.
 */

/** Carpeta de descargas de la corrida: aislada y previsible. */
function carpetaDescargas(config: ConfiguracionE2e): string {
  const ruta = resolve(process.cwd(), config.artefactos, config.runId, 'descargas');
  mkdirSync(ruta, { recursive: true });
  return ruta;
}

function opcionesChrome(config: ConfiguracionE2e, viewport: Viewport): chrome.Options {
  const opciones = new chrome.Options();

  if (config.headless) {
    // `--headless=new` es el headless real de Chrome moderno: mismo motor de
    // render que el visible. El viejo pintaba distinto y las pruebas de
    // maquetado decían cosas que en un navegador de verdad no pasaban.
    opciones.addArguments('--headless=new');
  }

  opciones.addArguments(
    `--window-size=${viewport.ancho},${viewport.alto}`,
    // Sin esto, Chrome no arranca dentro de un contenedor sin privilegios.
    '--no-sandbox',
    // `/dev/shm` de un contenedor por defecto son 64 MB: Chrome se cae a mitad
    // de una prueba con un error que no menciona la memoria por ningún lado.
    '--disable-dev-shm-usage',
    '--disable-gpu',
    // La primera ejecución de un perfil nuevo abre pestañas y diálogos que
    // roban el foco y tapan la aplicación.
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-search-engine-choice-screen',
    // Las notificaciones y los diálogos de contraseña son modales nativos: el
    // WebDriver no los ve y la prueba se queda esperando un elemento tapado.
    '--disable-notifications',
    '--disable-features=PasswordLeakDetection,AutofillServerCommunication',
    // Idioma fijo: la aplicación está en español y los formatos de fecha y
    // número que se comparan tienen que ser los mismos en cada máquina.
    '--lang=es-BO',
  );

  /**
   * Sin fuentes web. **No es una preferencia: sin esto la suite no corre.**
   *
   * Con las fuentes de `@fontsource` cargando, el renderizador deja de
   * responderle a ChromeDriver en cuanto termina el DOM y **todos** los
   * comandos posteriores vencen con «Timed out receiving message from
   * renderer». No es un problema de esperas ni de la aplicación: el mismo
   * artefacto, en el mismo Chrome, se carga bien lanzado a mano y bien desde
   * Playwright —que no usa ChromeDriver—. Se aisló probando el artefacto con
   * las fuentes servidas y con las mismas peticiones devolviendo 404: sin
   * fuentes, verde; con fuentes, cuelgue reproducible.
   *
   * Lo que se pierde es la tipografía: el texto se mide con las fuentes del
   * sistema. Para estas pruebas da igual —afirman sobre el DOM, no sobre
   * píxeles— y la regresión visual, que sí depende de la tipografía, la cubre
   * la suite de Playwright, que no sufre esto.
   *
   * `E2E_REMOTE_FONTS=true` las vuelve a habilitar para comprobar si una
   * versión futura de Chrome lo arregla.
   */
  if (process.env['E2E_REMOTE_FONTS'] !== 'true') {
    opciones.addArguments('--disable-remote-fonts');
  }

  opciones.setUserPreferences({
    'download.default_directory': carpetaDescargas(config),
    'download.prompt_for_download': false,
    'profile.default_content_setting_values.notifications': 2,
    credentials_enable_service: false,
    'profile.password_manager_enabled': false,
    intl: { accept_languages: 'es-BO,es' },
  });

  // Los mensajes de la consola del navegador son la mitad de la explicación de
  // un fallo: sin esto, `getLogs` devuelve una lista vacía.
  const preferencias = new logging.Preferences();
  preferencias.setLevel(logging.Type.BROWSER, logging.Level.ALL);
  opciones.setLoggingPrefs(preferencias);

  if (config.navegador === 'chromium') {
    // En imágenes de contenedor el binario es `chromium`, no `google-chrome`.
    // `CHROME_BIN` es la convención que ya usan los CI que traen Chromium.
    const binario = process.env['CHROME_BIN'] ?? '/usr/bin/chromium';
    opciones.setChromeBinaryPath(binario);
  }

  return opciones;
}

export interface OpcionesDriver {
  /** Resolución de la ventana. Por defecto, la de la configuración. */
  readonly viewport?: Viewport;
}

/**
 * Construye un navegador listo para usar: tamaño fijo, tiempos configurados y
 * sin la espera implícita de Selenium.
 *
 * La espera implícita queda en **cero a propósito**. Mezclarla con esperas
 * explícitas produce tiempos impredecibles —cada `findElement` se cuelga hasta
 * el techo implícito antes de que la condición explícita pueda evaluarse— y
 * convierte un fallo de un segundo en uno de treinta.
 */
export async function crearDriver(opciones: OpcionesDriver = {}): Promise<WebDriver> {
  const config = configuracion();
  const viewport = opciones.viewport ?? config.viewport;

  const driver = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(opcionesChrome(config, viewport))
    .build();

  await driver.manage().setTimeouts({
    implicit: 0,
    pageLoad: config.timeoutMs * 4,
    script: config.timeoutMs * 2,
  });

  // En headless el argumento de tamaño alcanza; en modo visible el gestor de
  // ventanas puede ignorarlo, así que se fija también por protocolo.
  if (!config.headless) {
    await driver.manage().window().setRect({ width: viewport.ancho, height: viewport.alto });
  }

  return driver;
}

/**
 * Cierra el navegador pase lo que pase.
 *
 * Un `quit()` que lanza —porque la sesión ya murió, porque el proceso se fue—
 * no puede hacer fallar una prueba que ya terminó, ni dejar un Chrome huérfano
 * comiendo memoria en el agente de CI.
 */
export async function cerrarDriver(driver: WebDriver | null): Promise<void> {
  if (driver === null) {
    return;
  }
  try {
    await driver.quit();
  } catch {
    // El navegador ya no está: no hay nada que cerrar ni nada que reportar.
  }
}
