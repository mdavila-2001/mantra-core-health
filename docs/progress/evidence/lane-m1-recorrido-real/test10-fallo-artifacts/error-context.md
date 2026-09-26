# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: carril-m1-recorrido-real-vps.spec.ts >> M1 · recorrido real contra el VPS de preproducción >> la sesión real navega al panel sin que el simulador la intercepte
- Location: playwright/carril-m1-recorrido-real-vps.spec.ts:146:7

# Error details

```
TimeoutError: page.waitForURL: Timeout 60000ms exceeded.
=========================== logs ===========================
waiting for navigation until "load"
============================================================
```

# Page snapshot

```yaml
- generic [ref=e2]:
  - generic [ref=e5]:
    - complementary [ref=e6]:
      - generic [ref=e7]:
        - paragraph [ref=e8]:
          - generic [ref=e9]: AloVida
        - heading [level=2] [ref=e10]: Tu salud, conectada
        - paragraph [ref=e11]: Entrá y encontrá tu historia clínica, tus turnos y tus estudios en un solo lugar.
    - main [ref=e12]:
      - group "Tema de la interfaz" [ref=e14]:
        - button "Claro" [ref=e15] [cursor=pointer]
        - button "Oscuro" [ref=e19] [cursor=pointer]
        - button "Sistema" [pressed] [ref=e22] [cursor=pointer]
      - generic [ref=e28]:
        - generic [ref=e29]:
          - heading "Iniciar sesión" [level=1] [ref=e30]
          - paragraph [ref=e31]: Ingresá con tu correo o tu documento de identidad.
        - alert [active] [ref=e32]:
          - generic [ref=e38]:
            - generic [ref=e39]: "Error:"
            - generic [ref=e40]: Las credenciales no son válidas.
        - generic [ref=e41]:
          - generic [ref=e43]:
            - generic [ref=e44]:
              - text: Correo o documento
              - generic [ref=e45]: "*"
              - generic [ref=e46]: (obligatorio)
            - textbox "Correo o documento (obligatorio)" [ref=e55]:
              - /placeholder: correo@ejemplo.com o 1234567
              - text: c14-real-med-4194575492@example.test
          - generic [ref=e57]:
            - generic [ref=e58]:
              - text: Contraseña
              - generic [ref=e59]: "*"
              - generic [ref=e60]: (obligatorio)
            - generic [ref=e64]:
              - textbox "Contraseña (obligatorio)" [ref=e69]:
                - /placeholder: Tu contraseña
                - text: S3cret-passw0rd
              - button "Mostrar contraseña" [ref=e70] [cursor=pointer]
          - button "Entrar" [ref=e74] [cursor=pointer]
        - generic [ref=e75]:
          - paragraph [ref=e76]:
            - link "¿Olvidaste tu contraseña?" [ref=e77] [cursor=pointer]:
              - /url: /auth/forgot-password
          - link "Creá tu cuenta Paciente o profesional" [ref=e78] [cursor=pointer]:
            - /url: /auth/register
            - generic [ref=e83]:
              - generic [ref=e84]: Creá tu cuenta
              - generic [ref=e85]: Paciente o profesional
          - link "Registrá tu organización Aseguradoras" [ref=e88] [cursor=pointer]:
            - /url: /auth/register/organization
            - generic [ref=e93]:
              - generic [ref=e94]: Registrá tu organización
              - generic [ref=e95]: Aseguradoras
  - complementary "Modo de demostración" [ref=e98]:
    - generic [ref=e99]:
      - button "Datos de prueba" [ref=e100] [cursor=pointer]
      - link "Ver componentes" [ref=e101] [cursor=pointer]:
        - /url: /design-system/stock
```

# Test source

```ts
  5   | /**
  6   |  * Moverse por la aplicación con una sesión real.
  7   |  *
  8   |  * Las tres restricciones que dan forma a este archivo son del backend y no se
  9   |  * pueden aflojar desde el frontend, así que la suite se acomoda a ellas. Están
  10  |  * documentadas una por una donde importan.
  11  |  */
  12  | 
  13  | /**
  14  |  * Espera a que Angular haya hidratado.
  15  |  *
  16  |  * La aplicación se sirve con render del servidor: el HTML del formulario existe
  17  |  * **antes** de que el JavaScript responda. Escribir o hacer clic en esa ventana
  18  |  * no hace nada —o peor, dispara el envío nativo del formulario— y la prueba
  19  |  * falla por una carrera que se lee como un defecto del producto.
  20  |  *
  21  |  * `<app-root>` con hijos + documento completo es la misma señal que usa la
  22  |  * suite de Cypress; el doble `requestAnimationFrame` agrega la garantía de que
  23  |  * además ya se pintó.
  24  |  */
  25  | export async function esperarAplicacionLista(page: Page): Promise<void> {
  26  |   await page.waitForLoadState('load');
  27  |   await expect(page.locator('app-root')).not.toBeEmpty({ timeout: 30_000 });
  28  |   await page.evaluate(
  29  |     () =>
  30  |       new Promise<void>((listo) => {
  31  |         requestAnimationFrame(() => requestAnimationFrame(() => listo()));
  32  |       }),
  33  |   );
  34  | }
  35  | 
  36  | /**
  37  |  * Escribe en un campo y comprueba que llegó entero.
  38  |  *
  39  |  * Misma carrera de hidratación: se midieron pérdidas de los **primeros**
  40  |  * caracteres, que producen un `401` con las credenciales correctas — la peor
  41  |  * forma de fallar, porque acusa al dato. Se escribe, se relee, y si no coincide
  42  |  * se rehace una vez; la aserción final deja a la vista un problema distinto en
  43  |  * lugar de reintentar para siempre.
  44  |  */
  45  | async function escribir(page: Page, testId: string, texto: string): Promise<void> {
  46  |   const campo = page.getByTestId(testId);
  47  |   await campo.fill(texto);
  48  |   if ((await campo.inputValue()) !== texto) {
  49  |     await campo.fill(texto);
  50  |   }
  51  |   await expect(campo).toHaveValue(texto);
  52  | }
  53  | 
  54  | /**
  55  |  * Entra por la pantalla de ingreso, como una persona.
  56  |  *
  57  |  * No se inyecta un token en el almacenamiento: la sesión sólo persiste el
  58  |  * refresh token y `AuthService` lo canjea al arrancar, así que una sesión
  59  |  * fabricada a mano no recorre el mismo camino que una real — y el objetivo del
  60  |  * barrido es justamente ver lo que ve una persona.
  61  |  */
  62  | export async function entrar(page: Page, actor: Actor): Promise<void> {
  63  |   // `POST /iam/auth/login` admite **diez por minuto y por IP**. Tres specs con
  64  |   // tres actores cada una llegan al techo si se corren seguidas, y el `429` que
  65  |   // vuelve no se distingue de un fallo del producto: la pantalla se queda en
  66  |   // `/auth` y lo único que se ve es un `waitForURL` agotado a los 60 s.
  67  |   //
  68  |   // Se reintenta una vez tras esperar a que se libere el cubo. Una sola vez, y
  69  |   // sólo ante `429`: reintentar credenciales rechazadas escondería el fallo real
  70  |   // y gastaría los intentos que quedan contra `ACCOUNT_LOCK_THRESHOLD`.
  71  |   let limitado = false;
  72  |   const anotarLimite = (respuesta: { url(): string; status(): number }): void => {
  73  |     if (respuesta.url().includes('/iam/auth/login') && respuesta.status() === 429) {
  74  |       limitado = true;
  75  |     }
  76  |   };
  77  |   page.on('response', anotarLimite);
  78  | 
  79  |   try {
  80  |     await intentarIngreso(page, actor);
  81  |   } catch (fallo) {
  82  |     if (!limitado) throw fallo;
  83  |     // El cubo es de un minuto: se espera un poco más que eso y se vuelve.
  84  |     await page.waitForTimeout(65_000);
  85  |     await intentarIngreso(page, actor);
  86  |   } finally {
  87  |     page.off('response', anotarLimite);
  88  |   }
  89  | 
  90  |   await esperarAplicacionLista(page);
  91  | }
  92  | 
  93  | /** Un intento de ingreso completo, desde la pantalla hasta el panel. */
  94  | async function intentarIngreso(page: Page, actor: Actor): Promise<void> {
  95  |   await page.goto('/auth');
  96  |   await esperarAplicacionLista(page);
  97  | 
  98  |   await escribir(page, 'login-identifier', actor.identificador);
  99  |   await escribir(page, 'login-password', actor.clave);
  100 |   await page.getByTestId('login-submit').click();
  101 | 
  102 |   // Dos destinos legítimos: el panel, o la elección de organización cuando la
  103 |   // sesión pertenece a más de una. Esperar sólo el panel dejaría la suite roja
  104 |   // para cualquiera con dos organizaciones, que es normal.
> 105 |   await page.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 60_000 });
      |              ^ TimeoutError: page.waitForURL: Timeout 60000ms exceeded.
  106 | 
  107 |   if (page.url().includes('/auth/organization')) {
  108 |     await page.getByTestId('tenant-opcion').first().click();
  109 |     await page.waitForURL(/\/dashboard/, { timeout: 60_000 });
  110 |   }
  111 | }
  112 | 
  113 | /**
  114 |  * Va a una ruta **sin recargar la página**, que es lo que hace el menú.
  115 |  *
  116 |  * ## Por qué no `page.goto`
  117 |  *
  118 |  * Cada carga completa cuesta un canje de refresh token —`AuthService` lo hace
  119 |  * al arrancar— y `POST /iam/auth/token/refresh` está limitado a **diez por
  120 |  * minuto y por IP**. Un barrido de treinta rutas con `goto` agota el cupo en la
  121 |  * ruta once, el `429` se trata como sesión caída, y la suite se rompe contra una
  122 |  * protección que funciona bien.
  123 |  *
  124 |  * Además es más fiel: nadie recorre una aplicación reescribiendo la dirección.
  125 |  * Se navega por el router, como el menú.
  126 |  */
  127 | export async function irA(page: Page, ruta: string): Promise<void> {
  128 |   await page.evaluate((destino) => {
  129 |     window.history.pushState({}, '', destino);
  130 |     window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
  131 |   }, ruta);
  132 | }
  133 | 
  134 | /**
  135 |  * Espera a que la pantalla deje de moverse.
  136 |  *
  137 |  * Las pantallas encadenan lecturas —la agenda pide recursos y después citas—,
  138 |  * así que «la red está quieta» es la única señal honesta de que terminaron. Se
  139 |  * usa un techo corto y se sigue si no llega: una pantalla que nunca deja de
  140 |  * pedir es un hallazgo del barrido, no un motivo para abortarlo.
  141 |  */
  142 | export async function estable(page: Page): Promise<void> {
  143 |   try {
  144 |     await page.waitForLoadState('networkidle', { timeout: 15_000 });
  145 |   } catch {
  146 |     // Deliberado: la inestabilidad se reporta como estado de la ruta.
  147 |   }
  148 |   await expect(page.locator('app-root')).not.toBeEmpty();
  149 | }
  150 | 
```