# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: consulta-rejilla.spec.ts >> Consulta · rejilla de registro >> todo lo que se registra está en la rejilla y abre en modal
- Location: playwright\consulta-rejilla.spec.ts:49:7

# Error details

```
Test timeout of 300000ms exceeded.
```

```
Error: locator.fill: Test timeout of 300000ms exceeded.
Call log:
  - waiting for getByRole('textbox', { name: 'Buscar por nombre o código' })

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - generic [ref=e3]:
    - link "Saltar al contenido" [ref=e4] [cursor=pointer]:
      - /url: "#contenido-principal"
    - status [ref=e5]: Archivo clínico cargada
    - generic [ref=e6]:
      - navigation "Navegación principal" [ref=e7]:
        - generic [ref=e8]:
          - link "AloVida — ir al panel" [ref=e9] [cursor=pointer]:
            - /url: /dashboard
            - generic [ref=e10]: AloVida
          - button "Recoger el menú" [expanded] [ref=e11] [cursor=pointer]
        - generic [ref=e15]:
          - link "Mi perfil" [ref=e16] [cursor=pointer]:
            - /url: /my-account
          - link "Notificaciones" [ref=e22] [cursor=pointer]:
            - /url: /notification-center
        - link "Directorios" [ref=e29] [cursor=pointer]:
          - /url: /directories
        - generic [ref=e36]:
          - link "Consultas médicas" [ref=e37] [cursor=pointer]:
            - /url: /schedule
          - link "Archivo clínico" [ref=e44] [cursor=pointer]:
            - /url: /medical-records
          - link "Notas médicas" [ref=e49] [cursor=pointer]:
            - /url: /progress-notes
          - link "Glosario" [ref=e56] [cursor=pointer]:
            - /url: /glossary
          - link "Formularios" [ref=e62] [cursor=pointer]:
            - /url: /form-builder
          - link "Mis servicios" [ref=e69] [cursor=pointer]:
            - /url: /my-services
          - link "Cotizaciones" [ref=e75] [cursor=pointer]:
            - /url: /my-quotations
        - link "Contabilidad" [ref=e81] [cursor=pointer]:
          - /url: /administration/accounting
      - generic [ref=e86]:
        - banner [ref=e87]:
          - link "Volver" [ref=e89] [cursor=pointer]:
            - /url: /dashboard
          - generic [ref=e93]:
            - button "Notificaciones. Tenés 8 sin leer" [ref=e96] [cursor=pointer]:
              - status "8 notificaciones sin leer" [ref=e100]: "8"
            - 'button "Organización activa: Mi consultorio" [ref=e102] [cursor=pointer]':
              - generic [ref=e107]: Mi consultorio
            - switch "Cambiar a modo oscuro" [ref=e110] [cursor=pointer]
            - link "Tutoriales" [ref=e118] [cursor=pointer]:
              - /url: /tutorials
            - link "Chats, 4 mensajes sin leer" [ref=e123] [cursor=pointer]:
              - /url: /messaging
              - status [ref=e127]: "4"
            - link "Ajustes" [ref=e128] [cursor=pointer]:
              - /url: /settings
            - generic [ref=e132]:
              - button "Cuenta de Dra. Valeria Rojas Mendoza" [ref=e133]: DV
              - generic [ref=e134]: Sesión de Dra. Valeria Rojas Mendoza
        - main [ref=e135]:
          - generic [ref=e136]:
            - generic "Archivo clínico" [ref=e137]:
              - navigation "Ruta de navegación" [ref=e139]:
                - list [ref=e140]:
                  - listitem [ref=e141]:
                    - link "Panel" [ref=e142] [cursor=pointer]:
                      - /url: /dashboard
                  - listitem [ref=e143]: /
                  - listitem [ref=e144]:
                    - generic [ref=e145]: Atención
                  - listitem [ref=e146]: /
                  - listitem [ref=e147]:
                    - generic [ref=e148]: Archivo clínico
              - generic [ref=e150]:
                - heading "Archivo clínico" [level=1] [ref=e151]
                - paragraph [ref=e152]: Elegí a la persona cuyo expediente querés consultar.
            - generic [ref=e153]:
              - form "Buscar a la persona" [ref=e154]:
                - generic [ref=e155]:
                  - generic [ref=e157]:
                    - generic [ref=e158]: Nombre o código
                    - textbox "Nombre o código" [ref=e173]:
                      - /placeholder: Nombre o código de paciente
                    - paragraph [ref=e174]: Filtra la lista mientras escribís.
                  - generic [ref=e176]:
                    - generic [ref=e177]: Documento de identidad
                    - textbox "Documento de identidad" [ref=e188]:
                      - /placeholder: Número de carnet
                    - paragraph [ref=e189]: El número exacto del carnet.
                - button "Buscar por documento" [ref=e191] [cursor=pointer]
              - generic "Todavía no hay nada acá" [ref=e194]:
                - paragraph [ref=e201]: Todavía no hay nada acá
                - paragraph [ref=e202]: Buscá por nombre, código o documento para ver a una persona.
                - generic [ref=e203]: Escribí un nombre, un código o un documento arriba
  - complementary "Modo de demostración" [ref=e207]:
    - generic [ref=e208]:
      - button "Datos de prueba" [ref=e209] [cursor=pointer]
      - link "Ver componentes" [ref=e210] [cursor=pointer]:
        - /url: /design-system/stock
```

# Test source

```ts
  1   | import { mkdirSync } from 'node:fs';
  2   | import { join } from 'node:path';
  3   | 
  4   | import { expect, test, type Page } from '@playwright/test';
  5   | 
  6   | import type { Actor } from './support/actores';
  7   | import { entrar, estable, irA } from './support/sesion';
  8   | 
  9   | /**
  10  |  * La consulta: una rejilla con todo lo que se puede registrar.
  11  |  *
  12  |  * Lo que sólo un navegador puede afirmar:
  13  |  *
  14  |  * 1. **Las nueve casillas están a la vista**, sin pestañas que abrir.
  15  |  * 2. **El encuentro se abre desde la misma pantalla** y queda «en curso».
  16  |  * 3. **Cada casilla abre su formulario en modal** y el modal se cierra.
  17  |  * 4. **La página no scrollea de costado**, ni a 1440 ni a 390 px.
  18  |  */
  19  | 
  20  | const SALIDA = join('docs', 'frontend', 'evidence', 'consulta-rejilla');
  21  | 
  22  | const MEDICA: Actor = {
  23  |   rol: 'doctora',
  24  |   identificador: 'medica@alovida.mock',
  25  |   clave: 'mock',
  26  |   nombre: 'Médica',
  27  | };
  28  | 
  29  | const CASILLAS: readonly { readonly clave: string; readonly modal: string }[] = [
  30  |   { clave: 'diagnosticos', modal: 'Nuevo diagnóstico' },
  31  |   { clave: 'alergias', modal: 'Nueva alergia' },
  32  |   { clave: 'medicacion', modal: 'Prescribir medicación' },
  33  |   { clave: 'observaciones', modal: 'Registrar una observación' },
  34  |   { clave: 'notas', modal: 'Escribir una nota clínica' },
  35  |   { clave: 'planes', modal: 'Abrir un plan de cuidados' },
  36  |   { clave: 'documentos', modal: 'Registrar un documento' },
  37  |   { clave: 'formulario', modal: 'Llenar un formulario clínico' },
  38  |   { clave: 'internacion', modal: 'Registrar una internación' },
  39  | ];
  40  | 
  41  | async function desbordeHorizontal(page: Page): Promise<number> {
  42  |   return page.evaluate(() => {
  43  |     const d = document.documentElement;
  44  |     return Math.max(0, d.scrollWidth - d.clientWidth);
  45  |   });
  46  | }
  47  | 
  48  | test.describe('Consulta · rejilla de registro', () => {
  49  |   test('todo lo que se registra está en la rejilla y abre en modal', async ({ page }) => {
  50  |     test.setTimeout(5 * 60_000);
  51  |     mkdirSync(SALIDA, { recursive: true });
  52  | 
  53  |     await entrar(page, MEDICA);
  54  |     await irA(page, '/medical-records');
  55  |     await estable(page);
  56  | 
  57  |     // El archivo no lista a nadie hasta que se busca: Enter dispara la búsqueda
  58  |     // sin esperar la demora del tipeo.
  59  |     const buscador = page.getByRole('textbox', { name: 'Buscar por nombre o código' });
> 60  |     await buscador.fill('Ana');
      |                    ^ Error: locator.fill: Test timeout of 300000ms exceeded.
  61  |     await buscador.press('Enter');
  62  |     await page.getByRole('link', { name: 'Ver expediente' }).first().click();
  63  |     await page.waitForURL(/\/medical-records\/[^/]+$/, { timeout: 60_000 });
  64  |     await estable(page);
  65  | 
  66  |     await page.goto(`${page.url()}/consultation`, { waitUntil: 'commit' });
  67  |     await page.waitForURL(/\/medical-records\/[^/]+\/consultation$/, { timeout: 60_000 });
  68  |     await estable(page);
  69  | 
  70  |     /* ---- 1. las nueve casillas ------------------------------------------- */
  71  | 
  72  |     await expect(page.getByTestId('consulta-rejilla')).toBeVisible();
  73  |     await expect(page.locator('[data-testid^="consulta-casilla-"]')).toHaveCount(9);
  74  |     expect(await desbordeHorizontal(page)).toBe(0);
  75  |     // Del tamaño de la ventana y no `fullPage`: la captura cosida dibuja el menú
  76  |     // lateral fijo encima del contenido, que no es lo que ve una persona.
  77  |     await page.screenshot({ path: join(SALIDA, 'consulta-1440.png') });
  78  | 
  79  |     /* ---- 2. el encuentro se abre acá ------------------------------------- */
  80  | 
  81  |     const abrir = page.getByTestId('consulta-abrir-encuentro');
  82  |     if ((await abrir.count()) > 0) {
  83  |       await abrir.click();
  84  |     }
  85  |     await expect(page.getByTestId('encuentros-en-curso')).toBeVisible({ timeout: 30_000 });
  86  |     await expect(page.getByTestId('consulta-cerrar-encuentro').first()).toBeVisible();
  87  |     await page.screenshot({ path: join(SALIDA, 'consulta-en-curso-1440.png') });
  88  | 
  89  |     /* ---- 3. cada casilla abre su modal ----------------------------------- */
  90  | 
  91  |     for (const casilla of CASILLAS) {
  92  |       await page.getByTestId(`consulta-casilla-${casilla.clave}`).click();
  93  |       const modal = page.getByRole('dialog');
  94  |       await expect(modal).toBeVisible();
  95  |       await expect(modal.getByRole('heading', { name: casilla.modal, exact: true })).toBeVisible();
  96  |       if (casilla.clave === 'diagnosticos') {
  97  |         await page.screenshot({ path: join(SALIDA, 'consulta-modal-diagnostico.png') });
  98  |       }
  99  |       await page.keyboard.press('Escape');
  100 |       await expect(modal).toHaveCount(0);
  101 |     }
  102 | 
  103 |     /* ---- 4. angosto ------------------------------------------------------ */
  104 | 
  105 |     await page.setViewportSize({ width: 390, height: 844 });
  106 |     await estable(page);
  107 |     // El recorrido de los modales dejó la página scrolleada, y el menú lateral
  108 |     // tarda en salir de pantalla al achicar: sin esperar las dos cosas la
  109 |     // captura muestra la transición, no la pantalla.
  110 |     await page.evaluate(() => window.scrollTo(0, 0));
  111 |     await expect(
  112 |       page.getByRole('navigation', { name: 'Navegación principal' }),
  113 |     ).not.toBeInViewport();
  114 |     expect(await desbordeHorizontal(page)).toBe(0);
  115 |     await page.screenshot({ path: join(SALIDA, 'consulta-390.png') });
  116 |   });
  117 | });
  118 | 
```