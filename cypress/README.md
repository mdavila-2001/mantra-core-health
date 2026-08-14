# Suite de extremo a extremo (Cypress)

Todo lo que se prueba con un navegador de verdad vive acá. Reemplaza a las dos
suites anteriores —Selenium para lo funcional, Playwright para los journeys y
los recorridos— sin perder ninguna de sus pruebas.

## Los tres frentes, y por qué están separados

| Carpeta | Qué responde | Red | Corre con |
| --- | --- | --- | --- |
| `e2e/{smoke,authentication,forms,navigation,regression,responsive}/` | ¿La aplicación **funciona**? | Simulada del lado del servidor | `yarn test:e2e` |
| `e2e/recorrido/` | ¿Cómo se **ve** cada pantalla? | Simulada en el navegador | `yarn recorrido` |
| `e2e/real/` | ¿Funciona con **permisos de verdad**? | Ninguna: API viva | `yarn recorrido:real` |

Las dos últimas quedan fuera de la corrida por defecto: el recorrido captura
cientos de imágenes y tarda minutos, y la suite real necesita el backend
levantado. Arrastrarlas a `yarn test:e2e` haría fallar la suite en cualquier
máquina sin API, que es justo lo que la simulación existe para evitar.

## Comandos

```bash
yarn test:e2e            # la suite funcional completa
yarn test:e2e:smoke      # solo humo — si esto falla, el resto no significa nada
yarn test:e2e:critical   # humo + autenticación + navegación + formularios
yarn test:e2e:regression # modales, tabla, avisos, directorio y accesibilidad
yarn test:e2e:responsive # escritorio, tableta y móvil
yarn e2e:open            # el modo interactivo, para escribir pruebas

yarn recorrido           # el recorrido visual + su reporte HTML
yarn recorrido:real      # el recorrido contra la API viva (requiere backend)
yarn recorrido:report    # regenera el reporte sin volver a capturar
```

Las variables están documentadas una por una en [`.env.e2e.example`](../.env.e2e.example).

## El arnés

`cypress/harness/` levanta, dentro del propio proceso de Cypress, **el artefacto
de producción** con una API simulada delante.

No es un capricho: cuatro rutas se prerenderizan solo en el build y las cabeceras
de seguridad las emite solo el servidor de producción. Probar contra `ng serve`
dejaría fuera lo que más fácil se rompe.

Dos cosas que hay que saber antes de tocarlo:

- **El artefacto se construye con `PUBLIC_API_BASE_URL` vacío**, para que la
  aplicación pida al mismo origen y la API simulada la atienda. Un `yarn build` a
  mano toma la URL del `.env` —que suele apuntar al backend real— y produce un
  paquete con el que la simulación no ve una sola petición: el login no entra y
  **toda la suite falla sin decir por qué**. Por eso el arnés deja una marca en
  `dist/mantra-core-health/.arnes-e2e` y solo reutiliza el `dist/` si es suya.
- **El escenario viaja en una cookie.** `cy.abrirEscenario('directorio-caido',
  '/dashboard')` pasa por `/__e2e__/escenario`, que la deja y redirige: así la
  elección ocurre en una sola navegación y la API ya sabe qué responder cuando la
  aplicación arranca. Los once escenarios están en
  [`support/fixtures/escenarios.ts`](support/fixtures/escenarios.ts).

## Cómo se escribe una prueba

Las specs **no conocen selectores**. Hablan de acciones de negocio y afirman
sobre lo que la pantalla dice:

```ts
import { paciente } from '../../support/fixtures/usuarios';
import { LoginPage } from '../../support/pages/login.page';

it('credenciales inválidas muestran un mensaje accionable', () => {
  LoginPage.abrir('credenciales-invalidas');
  LoginPage.entrar(paciente());

  LoginPage.esperarError().should('match', /credenciales/i);
});
```

Los Page Objects son **objetos de funciones**, no clases: en Cypress el sujeto es
`cy`, que es global, así que una clase sería un envoltorio vacío.

### Sobre las esperas

**No hay una sola pausa fija en toda la suite**, y no hace falta: Cypress
reintenta cada aserción hasta `defaultCommandTimeout`. La espera es una
consecuencia de afirmar, no algo que se escriba. Si aparece inestabilidad, se
afirma sobre la condición que falta — no se sube un número.

La única excepción está documentada en `cy.esperarAplicacionLista()`: un respaldo
por tiempo para el doble `requestAnimationFrame`, que en headless no dispara si
el navegador deja de pintar.

## Lo que hubo que resolver a mano

Cuatro cosas que Cypress no da de fábrica y cuya solución está en la suite:

1. **Teclas reales** (`support/teclado.ts`). El `<dialog>` nativo solo cierra con
   un `Escape` de confianza, y Cypress no sabe enviar el tabulador. Se despachan
   por CDP con `Cypress.automation`, que Cypress ya expone — sin agregar
   `cypress-real-events`. Solo funciona en navegadores Chromium, que es la misma
   restricción que tenía la suite anterior.
2. **La CSP** (`e2e/smoke/aplicacion.cy.ts`). Cypress **elimina la cabecera** para
   poder inyectarse en la página, así que el navegador nunca la aplica y una CSP
   rota daría verde. En su lugar se calculan los hashes de los scripts en línea y
   se verifica que la cabecera los autorice: el mismo defecto, atrapado antes.
3. **`axe-core`** se inyecta desde disco vía `cy.task`, no importándolo: el
   empaquetador lo envuelve y lo envuelto no se puede evaluar en la página
   (`exports is not defined`).
4. **El `Host` a medida** va por `cy.task`, porque `cy.request` descarta esa
   cabecera en silencio y la prueba pasaría sin comprobar nada.

## Contra qué se sirve cada suite (y por qué no es lo mismo)

| Suite | Servidor | API que ve el navegador |
| --- | --- | --- |
| Funcional | El arnés, con el artefacto de producción | La **simulada**, misma origen |
| Recorrido visual | El arnés, con el artefacto de producción | La **simulada**, más `cy.intercept` |
| Recorrido real | `ng serve` con `proxy.conf.json` | La **viva**, en `E2E_API_URL` |

La última fila es la que se equivoca fácil, y ya se equivocó una vez: si la suite
real se sirve desde el arnés, la aplicación pide al mismo origen y **le contesta
el simulador**. Los actores se crean de verdad contra el backend, pero la
pantalla que los usa recibe respuestas inventadas: da verde y no significa nada.
El síntoma con el que se descubrió fue un administrador «entrando» al panel con
credenciales que la API real rechazaba con `401`.

Por eso `scripts/run-recorrido-real.mjs` levanta `ng serve` —que tiene el proxy
hacia el backend— y le pasa `E2E_BASE_URL` a Cypress, lo que **desactiva el
arnés**. Si al correrla ves líneas `[e2e] Endpoint no simulado: …`, el arnés está
en el medio y la corrida no vale.

## Antes de correr `recorrido:real`: sembrar el administrador

Dos de las cuatro specs entran con una cuenta de administración, y **el backend
no la crea solo**: `BootstrapAdminSeedService` es opt-in y no hace nada sin
`BOOTSTRAP_ADMIN_EMAIL` y `BOOTSTRAP_ADMIN_PASSWORD`. En una base recién
levantada esa cuenta no existe, y el síntoma es un `401` en el login que se lee
como «las credenciales están mal» cuando en realidad no hay ninguna cuenta.

Se siembra con el comando del propio backend, que es idempotente:

```bash
cd ../mantra-core-health-api
yarn build && yarn postman:bootstrap
```

Deja `admin@redesa.test` / `S3cret-passw0rd` —los mismos valores que documenta el
`.env.example` de la API— que son los que esta suite trae por defecto. Con otras,
exportá `E2E_ADMIN_EMAIL` y `E2E_ADMIN_PASSWORD`.

> Ojo: `yarn build` en el backend pisa el `dist/` que `yarn start:dev` esté
> usando y le tira el proceso abajo. Sembrá primero y levantá la API después.

## Deuda conocida

- El recorrido de la vitrina de diseño es la prueba más larga de todas (más de
  doscientos controles sobre una pantalla de veinte mil píxeles de alto). Su tope
  de acciones existe para eso, y cuando corta **queda anotado** en
  `omisiones.jsonl` y el reporte lo muestra.
- El tenant del administrador de arranque se siembra **sin recursos
  agendables**, así que la comprobación de que el selector de recurso muestre el
  activo no tiene datos y se salta dejando su nota. Con un tenant poblado, la
  comprobación corre.
