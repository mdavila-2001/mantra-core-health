# Reporte — Cabecera fusionada y rediseñada

- Fecha: 2026-10-27 · Rama: `claude/serene-ptolemy-l17o2g` (desde `dev`)
- Pedido del propietario, sobre una captura de la cabecera del paciente:
  1. Fusionar: Tutoriales → Ajustes · Mis facturas → Mis gastos · Promociones → Carrito.
     Emergencia, tachada, sale de la cabecera.
  2. Mejorar la cabecera de forma notoria. Los botones de demo («Datos de prueba» /
     «Ver componentes») tapaban la portada del panel.

## Qué cambió

| Antes | Ahora |
|---|---|
| Emergencia en la cabecera | Encabeza el menú lateral, antes de cualquier destino. Con la barra recogida queda el ícono de teléfono (el nombre accesible sigue diciendo «Emergencia»). |
| Tutoriales en la cabecera | Pestaña «Tutoriales» en Ajustes, con el enlace al centro de tutoriales. |
| Mis facturas + Mis gastos (paciente) | Un único «Mis gastos» (nombre accesible «Mis gastos y facturas»); la pantalla ofrece «Ver mis facturas». Las cuentas que no son paciente conservan «Mis facturas» en la cabecera: no tienen «Mis gastos». |
| Promociones + Carrito | Un único «Carrito»; «Mi carrito» ofrece «Ver promociones». |
| Nueve rótulos sueltos de anchos distintos y la Red social con otro dibujo | Los destinos en **una sola barra** (≥ 1280 px, rediseño del paciente y del médico), con la pantalla actual destacada (`routerLinkActive` + `aria-current="page"`). Campana, tema y cuenta van aparte, después de un filete. |
| Aviso de demo arriba a la derecha, sobre el contenido | En escritorio, abajo a la izquierda, dentro del ancho del menú lateral. |

El tutorial de bienvenida se actualizó: el paso de Emergencia apunta a `nav-emergencia`,
el de ayuda a `header-ajustes`.

## Completado

| Qué | Comando | Resultado |
|---|---|---|
| Typecheck | `yarn typecheck` | EXIT 0 |
| Lint de lo tocado | `npx eslint <archivos tocados>` | EXIT 0 |
| Pruebas dirigidas | `ng test --include` shell-layout, settings, spending, cart-page, panic-button, tutorials | 10 archivos, 190 pruebas, todas en verde |
| Prueba visual | Playwright contra `ng serve --configuration demo`, sesión de paciente | Capturas en `evidencia/`; consola sin errores |

Pruebas: las que fijaban Tutoriales, Promociones y «Mis facturas» del paciente en la
cabecera se reescribieron al contrato nuevo (pedido explícito, no se debilitó nada), y se
agregaron pruebas para Emergencia en el menú, el modo compacto del botón, la pestaña
Tutoriales, «Ver mis facturas» y «Ver promociones».

## A medias

ninguna

## Pendiente

| Qué | Estado | Qué lo destraba |
|---|---|---|
| Revisión independiente (`NO_SELF_APPROVAL`) | TODO | Revisión humana del PR |
| Llevar el cambio a `mockup` | TODO | Merge en `dev` y la propagación de siempre |

## Evidencia

`evidencia/`: panel en escritorio oscuro y claro, Ajustes (pestaña Tutoriales), Mis gastos
(«Ver mis facturas»), carrito («Ver promociones»), barra recogida (Emergencia como ícono),
tablet y teléfono.

## No cubierto

- No se corrió la suite completa (`yarn test`, unas 5000 pruebas) ni Playwright `yarn pw`.
- Cuentas de médico y de administración: no se capturaron (sólo cubiertas por pruebas unitarias).
- Tutorial de bienvenida: no se recorrió de punta a punta en navegador.

## Riesgos y decisiones

- **Emergencia en el teléfono (resuelto, propietario 27/10/2026):** donde el menú es un cajón
  (≤ 900 px) Emergencia vuelve a la cabecera como ícono circular rojo, a un toque. Medido con
  Playwright: 360, 390 y 900 px visible y sin desborde horizontal; en 1440 px oculto (ya está en
  el menú). Capturas `evidencia/em-*.png`, incluido el diálogo de números abierto desde el ícono.
- **Aviso de demo (resuelto, propietario 27/10/2026):** deja de flotar en todos los anchos y va
  al final de la página, alineado a la derecha. Cualquier posición fija tapaba algo: la portada
  arriba, el menú lateral abajo a la izquierda (lo detectó `mock-banner-safe-zone.spec.ts`, que
  falló con la primera versión de este trabajo), el campo de síntomas o el del chat abajo.
  `npx playwright test mock-banner-safe-zone mock-banner-responsive` → 2 passed (sin solapes con
  contenido ni con elementos fijos, axe limpio, claro y oscuro, 7 anchos de 320 a 1920).
  Capturas `evidencia/demo-*.png`. Para verlo hay que desplazarse hasta el final.
- **Prueba arreglada (TEST_BUG previo):** `mock-banner-safe-zone.spec.ts` fijaba el tema claro en
  cada carga con `addInitScript`, así que cada `goto` deshacía el interruptor y su última
  aserción («vuelve a claro») nunca podía cumplirse. Reproducido a mano (con el script: tras el
  `goto` el tema vuelve a claro; sin él, el interruptor anda). Ahora fija claro sólo si no hay
  tema guardado; el requisito no se debilitó.
- **Entorno:** el Playwright del proyecto pide un Chromium distinto del instalado en este
  contenedor; se corrió con una configuración temporal (fuera del repo) que apunta al instalado.
- **«Mi perfil» encendido en Mis gastos (resuelto, propietario 27/10/2026):** el menú marca el
  renglón cuyo prefijo es el más largo, y «Mi perfil» es `/my-account`. Ahora, si la pantalla es
  un atajo de la cabecera (`/my-account/spending`, `invoices`, `requests`, `promotions`), el menú
  no marca nada: ya la marca la cabecera. El carrito sigue marcando «Farmacia». Verificado en
  navegador (paciente): spending → menú `[]`, cabecera «Mis gastos y facturas»; cart → menú
  «Farmacia», cabecera «Carrito»; `/my-account` → «Mi perfil». Captura
  `evidencia/activo-spending.png`. En `/my-account/invoices` la cabecera marca «Mis gastos»
  (propietario, 27/10/2026): es el mismo atajo desde la fusión. Verificado en navegador
  (`evidencia/activo-invoices.png`); en Mis solicitudes «Mis gastos» no se marca.
- Consola durante la verificación: un 404 de `glossary-data/manifest.json`, ajeno a este cambio
  (los datos del glosario se generan aparte y no están en este entorno local).
