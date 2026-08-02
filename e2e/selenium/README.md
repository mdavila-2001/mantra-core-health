# Pruebas de extremo a extremo con Selenium

Suite de aceptación funcional del frontend. Conduce un Chrome de verdad contra
el **artefacto de producción**, con la API simulada del lado del servidor.

- **83 pruebas** en 14 archivos, ~2 min en paralelo de 2.
- **Cero pausas fijas.** Todas las esperas son por condición verificable.
- **Un navegador nuevo por prueba**, con perfil limpio y cerrado pase lo que pase.
- **Evidencias automáticas** en cada fallo: captura, HTML, consola del navegador,
  JUnit y un reporte navegable.

---

## Por qué existe si ya hay Playwright

Las dos suites cubren cosas distintas y **ninguna sustituye a la otra**:

| | Playwright (`e2e/*.spec.ts`) | Selenium (`e2e/selenium/`) |
|---|---|---|
| Qué verifica | Contrato **visual** y 7 journeys de sesión | Comportamiento **funcional** |
| Red | Interceptada desde el navegador | API simulada del lado del servidor |
| Cubre además | Regresión visual por píxeles | Formularios, navegación, responsive, accesibilidad, modales, avisos y tabla |
| Corre en CI | job `e2e` | job `selenium` |

Reemplazar una por la otra habría significado tirar cobertura sin ganar nada.
Corren en paralelo y son independientes.

---

## Requisitos

- Node.js 24 (el que fija el pipeline) y Yarn 4 en modo PnP.
- **Google Chrome instalado.** No hace falta ningún chromedriver: Selenium
  Manager —incluido en `selenium-webdriver`— resuelve y cachea el binario que
  corresponde a la versión de Chrome que haya.

Dependencias añadidas al proyecto: `selenium-webdriver` y
`@types/selenium-webdriver`. El corredor es **Vitest**, que el repositorio ya
usaba; `axe-core`, para la accesibilidad, también estaba.

---

## Ejecución

```bash
yarn test:e2e              # las 54 pruebas
yarn test:e2e:smoke        # humo: ¿está viva la aplicación?
yarn test:e2e:critical     # humo + autenticación + navegación + formularios
yarn test:e2e:regression   # regresión: estados de vista y accesibilidad
yarn test:e2e:responsive   # escritorio, tableta y móvil
yarn test:e2e:headed       # con ventana visible y sin paralelismo
yarn test:e2e:headless     # explícito, para un entorno sin pantalla
yarn test:e2e:report       # regenera el reporte HTML de la última corrida
```

Para filtrar por nombre, todo lo que sobra se pasa a Vitest:

```bash
yarn test:e2e:smoke -t "hidrata"
```

La primera corrida **construye el artefacto** (unos 60 s). Mientras se escriben
pruebas y el código de la aplicación no cambia:

```bash
E2E_SKIP_BUILD=true yarn test:e2e
```

Nunca en CI: un `dist/` viejo hace pasar pruebas sobre código que ya no existe.

---

## Variables de entorno

Todas tienen valor por defecto; la suite corre sin configurar nada. La
plantilla completa y comentada está en [`.env.e2e.example`](../../.env.e2e.example).

| Variable | Por defecto | Para qué |
|---|---|---|
| `E2E_BASE_URL` | *(vacío)* | Vacío: la suite construye y sirve. Con valor: prueba contra ese servidor y no levanta nada. |
| `E2E_PORT` | `4175` | Puerto del arnés. No es el 4173 de Playwright: las dos suites tienen que poder correr a la vez. |
| `E2E_BROWSER` | `chrome` | `chromium` usa `CHROME_BIN` o `/usr/bin/chromium`. |
| `E2E_HEADLESS` | `true` | `false` abre ventana. |
| `E2E_TIMEOUT` | `15000` | Techo de las esperas explícitas. |
| `E2E_WORKERS` | `2` | Archivos en paralelo. `1` para depurar. |
| `E2E_SKIP_BUILD` | `false` | Reutiliza `dist/`. |
| `E2E_SCREENSHOT_ON_FAILURE` | `true` | Captura en cada fallo. |
| `E2E_ARTIFACTS_DIR` | `artifacts/selenium` | Raíz de las evidencias. |
| `E2E_REMOTE_FONTS` | `false` | Ver «Fuentes web», abajo. |
| `E2E_ALLOW_REMOTE` | `false` | Barrera para apuntar fuera de la máquina local. |
| `E2E_TEST_USER_EMAIL` / `_PASSWORD` / `_NATIONAL_ID` | *(vacías)* | Solo para un entorno de ensayo real. **Nunca en el repositorio.** |

---

## Arquitectura

```text
e2e/selenium/
├── config/environment.ts      Configuración leída del entorno, ya validada
├── core/
│   ├── driver.factory.ts      La única forma de crear un navegador
│   ├── wait.helpers.ts        Esperas por condición: ni una pausa fija
│   ├── base.page.ts           Base de los Page Objects
│   ├── base.component.ts      Base de los componentes compartidos
│   ├── test.lifecycle.ts      Navegador por prueba, evidencia y cierre
│   └── evidence.ts            Captura, HTML, consola y detalle del fallo
├── harness/
│   ├── servidor.ts            Artefacto de producción + API simulada
│   ├── api-simulada.ts        Los endpoints que la aplicación usa
│   └── global-setup.ts        Arranca y apaga el arnés una sola vez
├── pages/                     Un Page Object por pantalla
├── components/                Encabezado y navegación lateral
├── fixtures/                  Escenarios de la API y datos de prueba
├── helpers/                   Sesión, accesibilidad y resoluciones
├── specs/
│   ├── smoke/                 ¿Está viva la aplicación? ¿Es el artefacto? ¿Prerenderiza?
│   ├── authentication/        Login y vida de la sesión
│   ├── navigation/            Menú, historial, rutas inexistentes, fragmento diferido
│   ├── forms/                 Registro, recuperación, verificación de correo y nueva clave
│   ├── responsive/            Escritorio, tableta y móvil
│   └── regression/            Estados de vista, accesibilidad, modales, avisos y tabla
├── vitest.config.ts
└── tsconfig.json
```

### El arnés

Un solo proceso Express que monta, **en este orden**:

1. La API simulada (`/iam/*`, `/public/*`).
2. Un 404 explícito para cualquier otro prefijo de API sin simular.
3. El manejador del artefacto construido (`dist/.../server/server.mjs`).

El orden importa: si el renderizador de Angular viera `/iam/auth/login`,
devolvería el HTML de la aplicación con estado 200 y el cliente fallaría al
interpretarlo como JSON, con un error que no menciona la causa.

Se prueba contra el artefacto —y no contra `ng serve`— porque el
prerenderizado y las cabeceras de seguridad **solo existen ahí**. Una CSP que
bloqueara un script dejaría la aplicación sin arrancar en producción y no en
las pruebas.

### Escenarios: cómo una prueba decide qué responde la API

El arnés expone `GET /__e2e__/escenario?id=…&destino=…`, que deja una cookie con
el nombre del escenario y redirige. La cookie es **por perfil de navegador**, y
cada prueba levanta el suyo: dos pruebas en paralelo pueden pedirle respuestas
opuestas al mismo proceso sin pisarse.

```ts
const login = new LoginPage(navegador());
await login.abrir('credenciales-invalidas');   // el login responderá 401
```

Los escenarios están en [`fixtures/escenarios.ts`](fixtures/escenarios.ts):
`sesion-simple`, `multi-organizacion`, `sin-organizacion`,
`credenciales-invalidas`, `refresco-vencido`, `directorio-poblado`,
`directorio-caido`, `registro-duplicado`, `token-vencido`,
`clave-cambiada-con-sesiones`, `api-lenta`.

### Pantallas con token en la dirección

`/auth/verificar` y `/auth/nueva-clave` leen su token del *query string* al
construirse, así que hay que **llegar navegando a la dirección completa**, tal
como quien abre el enlace del correo. Los Page Objects lo encapsulan:

```ts
await new VerifyEmailPage(driver).abrirConToken('token-de-prueba');
await new ResetPasswordPage(driver).abrirConToken('token-vencido', 'token-vencido');
```

### Estrategia de datos

- La API está simulada: **no hay base de datos que limpiar** y el resultado es
  el mismo en cada corrida.
- Los datos de alta se generan únicos por corrida (`nuevoPaciente()`), así que
  la suite se puede ejecutar dos veces seguidas sin colisiones.
- `verificarEntornoSeguro()` aborta con `NODE_ENV=production` o si `E2E_BASE_URL`
  apunta fuera de la máquina local sin `E2E_ALLOW_REMOTE=true`. Estas pruebas
  escriben, y contra un entorno real eso es daño, no una prueba.

---

## Selectores

Prioridad, de mayor a menor:

1. `data-testid` — lo que se agregó a la aplicación, y es poco: 30 atributos en
   9 plantillas, ninguno con efecto en la presentación ni en la lógica.
2. Roles y atributos accesibles (`role="alert"`, `aria-current="page"`).
3. `type`, `name` y otros atributos semánticos.
4. Clases del sistema de diseño (`.form-field-error`) cuando identifican un
   contrato estable del sistema, no una decoración.

Prohibido: XPath absoluto, `nth-child` posicional, clases generadas y cualquier
cosa acoplada a la forma interna del DOM.

**El átomo `app-input` acepta `testId`**, porque el `<input>` real vive dentro
del componente: un `data-testid` escrito sobre `<app-input>` se queda en el host
y no llega al campo que la prueba tiene que escribir.

```html
<app-input formControlName="identifier" testId="login-identifier" />
```

---

## Cómo agregar una prueba

1. **¿Hay Page Object para esa pantalla?** Si no, creá uno en `pages/`
   extendiendo `BasePage`: declara `ruta`, `marca` (algo que solo existe cuando
   la pantalla está pintada) y **acciones de negocio**, nunca `findElement`
   hacia afuera.
2. **¿Faltan selectores?** Agregá `data-testid` en la plantilla. Mínimo y
   semántico.
3. **¿Hace falta un estado de API que no existe?** Agregá un escenario a
   `fixtures/escenarios.ts` con su descripción.
4. Escribí la prueba en la carpeta de `specs/` que corresponda:

```ts
import { describe, expect, test } from 'vitest';
import { usarNavegador } from '../../core/test.lifecycle';
import { LoginPage } from '../../pages/login.page';

describe('Mi pantalla', () => {
  const navegador = usarNavegador();

  test('hace lo que promete', async () => {
    const login = new LoginPage(navegador());
    await login.abrir('sesion-simple');

    await login.entrar(PACIENTE);

    await login.esperarSalidaDelLogin();
  });
});
```

5. Corré `yarn tsc -p e2e/selenium/tsconfig.json --noEmit` y la suite.

**Nunca uses una pausa.** Si algo no está listo, la espera correcta está en
`core/wait.helpers.ts`; si falta una, agregala ahí.

---

## Evidencias y reportes

Cada corrida escribe en `artifacts/selenium/<marca-de-tiempo>/`:

```text
artifacts/selenium/2026-08-02T06-44-24-231Z/
├── capturas/       PNG de cada prueba fallida
├── html/           El DOM en el instante del fallo
├── consola/        Registros del navegador
├── fallos/         Prueba, fecha, URL, error y stack en texto plano
├── descargas/      Descargas del navegador, aisladas por corrida
├── junit.xml       Para el pipeline
├── resultados.json Salida cruda de Vitest
└── reporte.html    Reporte navegable, con las capturas incrustadas
```

Todo el árbol está en `.gitignore`. El reporte se genera **también cuando la
suite falla**, que es justo cuando hace falta mirarlo.

```bash
open artifacts/selenium/*/reporte.html
```

---

## CI/CD

El job `selenium` de [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml):

1. Instala con lockfile (`--immutable`) y genera el entorno público.
2. **Type-check de la suite** — un Page Object roto falla en segundos.
3. **Humo** — construye el artefacto y comprueba que la aplicación arranca.
4. **Suite crítica** — reutiliza el artefacto del paso anterior.
5. **Regresión completa** — solo en `master` o por ejecución manual.
6. Publica `artifacts/selenium/` **siempre**, en verde y en rojo.

Sin `continue-on-error` en ninguna etapa: si el humo o la crítica fallan, el
pipeline falla.

---

## Solución de problemas

**«Timed out receiving message from renderer».**
Es el cuelgue que produce la carga de fuentes web bajo ChromeDriver; por eso la
fábrica pasa `--disable-remote-fonts`. Si aparece igual, comprobá que
`E2E_REMOTE_FONTS` no esté en `true`.

**«El puerto 4175 está ocupado».**
Quedó un arnés de una corrida anterior: `lsof -ti tcp:4175 | xargs kill -9`, o
usá otro puerto con `E2E_PORT`.

**«No existe dist/… ¿Falló la construcción?».**
Corriste con `E2E_SKIP_BUILD=true` sin haber construido nunca. Quitá la variable.

**La suite tarda una eternidad la primera vez.**
Es la construcción del artefacto. Con `E2E_SKIP_BUILD=true` se reutiliza.

**«El elemento nunca dejó de moverse».**
El elemento al que se apunta sigue animándose. Antes esta espera miraba *todas*
las animaciones del documento y no terminaba nunca en pantallas con un spinner
o un esqueleto; ahora mira solo la posición del elemento. Si aparece, es que
algo se mueve de verdad.

**Una prueba falla solo en CI.**
Descargá el artefacto `selenium-artifacts` de la ejecución: la captura y el HTML
del instante del fallo suelen bastar para entenderlo sin reproducirlo.

**Quiero ver qué pasa.**
`yarn test:e2e:headed -t "parte del nombre"`.

---

## Fuentes web

La fábrica arranca Chrome con `--disable-remote-fonts` **por necesidad, no por
gusto**: con las fuentes de `@fontsource` cargando, el renderizador deja de
responderle a ChromeDriver en cuanto termina el DOM y todos los comandos
posteriores vencen. Se aisló sirviendo el mismo artefacto con las fuentes
servidas y con esas mismas peticiones devolviendo 404: sin fuentes, verde; con
fuentes, cuelgue reproducible. El mismo artefacto, en el mismo Chrome, funciona
lanzado a mano y desde Playwright —que no usa ChromeDriver—.

Lo que se pierde es la tipografía: el texto se mide con las fuentes del sistema.
Para estas pruebas da igual —afirman sobre el DOM, no sobre píxeles— y la
regresión visual, que sí depende de la tipografía, la cubre Playwright.

`E2E_REMOTE_FONTS=true` las vuelve a habilitar, para comprobar si una versión
futura de Chrome lo arregla.

---

## Limitaciones conocidas

- **La API está simulada.** Esta suite no verifica el contrato con el backend;
  de eso se ocupa `scripts/check-api-contract-drift.mjs`.
- **Un solo navegador.** Chrome/Chromium. Añadir Firefox o WebKit es cambiar la
  fábrica en un archivo, pero hoy nadie lo pidió y multiplicaría el tiempo.
- **Sin regresión visual.** Es deliberado: ya la cubre Playwright, y con las
  fuentes deshabilitadas cualquier comparación de píxeles sería falsa.
- **Sin Docker propio.** El pipeline ya trae Chrome en el agente y el arnés no
  necesita ningún servicio externo; agregar una imagen sería complejidad sin
  contrapartida. Si algún día hace falta, el punto de entrada es
  `harness/servidor.ts`, que no supone nada del entorno.

---

## Lo que se prueba sobre la vitrina, y por qué

El diálogo de confirmación, los avisos y la tabla de datos **todavía no los usa
ninguna pantalla de producto**: su única instancia con datos vive en
`/design-system`. Se prueban ahí igual, y a propósito — son los mismos
componentes que van a heredar las pantallas clínicas, y fijar su contrato ahora
sale mucho más barato que descubrirlo con la pantalla a medio hacer.

Dos matices que el artefacto impone:

- **El diálogo va sobre el `<dialog>` nativo.** `showModal()` no existe en
  jsdom, así que el fondo, la inertización y el cierre con `Escape` **no los
  puede probar ninguna prueba unitaria**. Es el hueco exacto que llena Selenium.
- **Los avisos son presentacionales.** El panel que los lanzaba vive tras un
  `@defer (when isDev)` y su fragmento no se descarga en producción, así que no
  hay cola viva que probar. Lo que sí se fija es su contrato de accesibilidad:
  un error interrumpe (`role="alert"`), el resto espera turno (`role="status"`).
  Cuando exista una pantalla que emita avisos de verdad, acá se agrega el
  journey completo.

## Deuda detectada

- **Contraste de `--text-muted`.** `axe-core` lo marca como `serious` en el menú
  lateral. Es la **excepción E1** que el sistema de diseño ya declara y que
  `scripts/check-contrast.mjs` verifica; la suite la deja pasar con nombre y
  apellido, en `specs/regression/accesibilidad.spec.ts`. Cualquier otro problema
  grave sí hace fallar.
- **`security.allowedHosts` estaba vacío.** Con esa lista vacía, el servidor de
  Angular rechazaba *todos* los `Host` y respondía con renderizado de cliente en
  vez de SSR — en cualquier entorno, incluida producción. Se declararon los
  hosts en `angular.json` —lo que se sabe al construir— y el dominio público de
  cada entorno se declara en tiempo de ejecución con `SSR_ALLOWED_HOSTS`, sin
  reconstruir el artefacto. Dos pruebas de humo lo vigilan por los dos lados:
  que un host declarado **sí** reciba el prerenderizado (`ngh`) y que uno
  ajeno **no**.
