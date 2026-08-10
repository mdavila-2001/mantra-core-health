# Pruebas de extremo a extremo

Todo lo que se prueba con un navegador de verdad corre con **Cypress**, desde
`cypress/`. La guía operativa —comandos, variables, cómo se escribe una prueba—
está en [`cypress/README.md`](../../cypress/README.md); acá va el porqué.

## Por qué existen

Hay journeys que **jsdom no puede cubrir**, y no es cuestión de esfuerzo: hacen
falta un router real, un `F5` de verdad y un navegador que ejecute la hidratación.

- Que el guard redirija al login sin sesión.
- Que la sesión **sobreviva a una recarga** — el journey que más fácil se rompe:
  un cambio en el orden de los `provideAppInitializer` lo tumba sin que ninguna
  prueba unitaria se entere.
- Que el `<dialog>` nativo cierre con `Escape` **devolviendo «no»**. En jsdom
  `showModal()` ni siquiera está implementado.
- Que el prerenderizado llegue del servidor y que las cabeceras de seguridad
  existan. Solo están en el artefacto construido.

## De dos suites a una

Antes convivían **Playwright** (journeys y regresión visual) y **Selenium**
(funcional, responsive y accesibilidad). La justificación era que cubrían cosas
distintas, y en parte era cierta — pero la regresión visual que sostenía el
argumento **nunca se implementó**: `toHaveScreenshot` aparecía en la
configuración de Playwright y en la documentación, en ninguna prueba. La
diferencia real era el corredor, no la cobertura.

Todo está en Cypress ahora, sin perder una sola prueba. Lo que sí cambió y hay
que saber está en la sección de compromisos, más abajo.

## Los tres frentes

| Suite | Qué responde | Red | Comando |
| --- | --- | --- | --- |
| Funcional | ¿La aplicación **funciona**? | Simulada del lado del servidor | `yarn test:e2e` |
| Recorrido visual | ¿Cómo se **ve** cada pantalla? | Simulada en el navegador | `yarn recorrido` |
| Recorrido real | ¿Funciona con **permisos de verdad**? | Ninguna: API viva | `yarn recorrido:real` |

Las dos últimas quedan fuera de la corrida por defecto: una captura cientos de
imágenes y la otra necesita el backend levantado.

## Contra qué se prueba

Contra el **artefacto de producción**, servido por el propio arnés
(`cypress/harness/`) con la API simulada delante. Probar contra `ng serve`
dejaría fuera justo lo que más fácil se rompe: el prerenderizado y las cabeceras
de seguridad solo existen en el build.

La API va simulada porque lo que estas pruebas verifican es **navegación, estado,
formularios y persistencia**, no el contrato — eso es otra capa y otra
herramienta (`scripts/check-api-contract-drift.mjs`). Con la red simulada el
resultado es el mismo en cada corrida; una suite E2E que falla al azar se termina
ignorando, que es peor que no tenerla.

Qué responde la API en cada caso lo decide un **escenario** que la prueba pide
por cookie. Los once están declarados en
`cypress/support/fixtures/escenarios.ts` y el inventario generado los lista con
su descripción.

## Los compromisos del cambio

Tres cosas que Cypress hace distinto y que hubo que resolver. Están acá porque
son las que se olvidan y después confunden:

1. **Cypress elimina la cabecera CSP** para poder inyectarse en la página. Antes,
   una CSP mal armada se detectaba de rebote —el navegador bloqueaba el script y
   la consola lo gritaba—; ahora el navegador nunca la aplica. En su lugar, la
   prueba de humo calcula los hashes de los scripts en línea del documento y
   verifica que la cabecera los autorice: el mismo defecto, atrapado antes y con
   un mensaje que lo nombra.
2. **Las teclas van por CDP.** El `<dialog>` nativo solo cierra con un `Escape`
   de confianza, y un evento sintético no lo cierra: la prueba pasaría sin haber
   cerrado nada. Se despachan con `Cypress.automation`, que Cypress ya expone —
   sin agregar dependencias. Eso ata la suite a navegadores Chromium, que es la
   misma restricción que tenía Selenium.
3. **Un `dist/` construido a mano no sirve.** El arnés construye con
   `PUBLIC_API_BASE_URL` vacío para que la aplicación pida al mismo origen; un
   `yarn build` normal toma la URL del `.env` y produce un paquete que le habla
   al backend real. El arnés deja una marca y solo reutiliza el `dist/` si es
   suya, porque el fallo contrario no menciona la causa por ningún lado.

## Lo que no cubren

- **Contrato de la API.** Lo cubre la verificación de deriva.
- **Regresión visual por píxeles.** No existe hoy, y tampoco existía antes.
  Cypress no la trae de fábrica; si se quiere, hay que elegir un plugin.
- **Carga y rendimiento.** Otra herramienta.
