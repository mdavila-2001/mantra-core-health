# Revisión dirigida de HTML dinámico (O3-5 · hallazgo M-4)

Fecha: 31/10/2026. Alcance: los 15 resultados de

```bash
git grep -nE '(innerHTML|bypassSecurityTrust)' -- 'src/**/*.ts' 'src/**/*.html' ':!*.spec.ts'
```

sobre `origin/dev` (`8791ecc1`). Cada punto tiene una prueba Vitest con carga hostil.
Ocho de los quince son código que escribe o lee `innerHTML`, o que marca una URL
como confiable. Los otros siete son comentarios que afirman «esto no pasa por
`innerHTML`». Una afirmación así también se prueba: la prueba fija que el texto de
terceros siga llegando como texto.

## Cómo se detecta una ejecución

El corredor (Vitest 4 + jsdom, `runScripts: "dangerously"`) **sí ejecuta** los
manejadores inline (`onclick`, `ontoggle`…). Lo que no sirve es un doble de
`window.alert`: jsdom corre el manejador en su propio contexto y llama a **su**
`alert`, nunca al doble (lo medimos con una sonda; el doble no recibió ninguna de las
llamadas). Por eso las cargas no usan `alert(1)`: escriben una marca en el DOM
(`document.documentElement.dataset.xss=1`), que se ve desde cualquier contexto.
`ejecutado()` dispara `error`, `load`, `toggle`, `focus`, `mouseover` y
`animationstart` sobre cada elemento (y `click` sobre los que tienen un `on*`) y
mira la marca. Cada `afterEach` vuelve a mirarla después de una tarea, para atrapar
los manejadores asincrónicos. Un **control positivo**
(`rich-text-editor.xss.spec.ts`, «el detector SÍ ve un manejador inline que corre»)
prueba que el detector no es ciego.

Cargas usadas (según el punto): `<img src=x onerror=…>`, `<script>`,
`<svg onload>`, `<svg><script>`, `javascript:` (también en mayúsculas mezcladas y con
espacios delante), `data:text/html`, `vbscript:`, `<iframe>`, `<object>`, `<embed>`,
`<details ontoggle>`, `<form action>`/`formaction`, `<base href>`, `<meta refresh>`,
mXSS por `<math><mtext><mglyph><style>` y `<noscript>`, `<template>`,
`data:image/svg+xml`, `</script>` dentro de JSON, PNG políglota (firma + `<script>`),
HTML que se declara PDF o imagen, y nombres de archivo con `"><img …>`.

## Tabla punto → prueba → resultado

| # | Punto | Tipo | Prueba | Resultado |
|---|---|---|---|---|
| 1 | `core/alovida/alovida-runtime.service.ts:1132` | `innerHTML` de constante (ícono del cajón) | `alovida-runtime.service.xss.spec.ts`: «el botón del cajón lleva sólo su ícono constante» e «un id de nav hostil viaja como atributo» | ✅ Sólo `svg`/`path`, sin `on*` ni texto. El texto hostil de la página sigue siendo texto. Un `id` con comillas queda en `aria-controls` sin agregar atributos. |
| 2 | `core/alovida/alovida-runtime.service.ts:1347` | `innerHTML` de constante (lupa) | `alovida-runtime.service.xss.spec.ts`: «la lupa del buscador lleva sólo su ícono constante» | ✅ |
| 3 | `features/admin/admissions/admission-detail/admission-document-viewer.ts:144` | `bypassSecurityTrustUrl` (`safeUrl`) | `admission-document-viewer.xss.spec.ts`: «una URL `javascript:` de la API nunca llega al DOM» y «un PNG políglota se muestra sólo como imagen tipada» | ✅ Todo `src`/`href` es `blob:` creado por el visor. El tipo sale de la firma (`image/png`), no de la cabecera `text/html`. |
| 4 | `…/admission-document-viewer.ts:148` | `bypassSecurityTrustUrl` (`safeDownload`) | `admission-document-viewer.xss.spec.ts`: «HTML hostil con nombre hostil sólo se ofrece como descarga opaca» | ✅ La descarga es `application/octet-stream` y el nombre sale sin `"`. No aparecen `img`, `script` ni `iframe`. |
| 5 | `features/agenda/payment-receipts/payment-receipt-viewer/payment-receipt-viewer.ts:82` | `bypassSecurityTrustResourceUrl` en `<iframe>` **sin `sandbox`** | `payment-receipt-viewer.xss.spec.ts`: 6 URL hostiles (`javascript:`, `JaVaScRiPt:`, `data:text/html`, `https:`, `//`, `" blob:"`); HTML declarado PDF; `text/html`; SVG | ✅ Al marco sólo llega una `blob:`. Un HTML que la lista declara PDF entra tipado `application/pdf`. `text/html` y SVG quedan sólo como descarga `octet-stream`. |
| 6 | `features/alovida/shell/alovida-shell.html:166` | comentario (íconos literales en plantilla) | `alovida-shell.xss.spec.ts`: «cada ícono del nav es un SVG de trazos inerte» y «los rótulos del nav son texto» | ✅ |
| 7 | `features/laboratory/results/laboratory-results.ts:538` | `bypassSecurityTrustResourceUrl` (PDF en `<iframe>`) | `laboratory-results.spec.ts`, bloque «cargas hostiles»: 4 pruebas | ✅ Un «PDF» con bytes HTML y `<script>` entra tipado `application/pdf`. Un TEXT hostil se ve en `<pre>` como texto. Un nombre o paciente hostil sale como texto. Un SVG sólo va en `<img>`. |
| 8 | `features/public-profile/public-post-card/public-post-card.ts:302` | comentario (enlaces sin `innerHTML`) | `public-post-card.xss.spec.ts`: 5 cargas en el cuerpo; esquemas peligrosos; URL con `"><img/src=x/onerror=…>` | ✅ El marcado queda literal y sólo se generan enlaces `https?:`. Una URL con comillas no agrega atributos. |
| 9 | `features/public-profile/public-profile.ts:194` | comentario (JSON-LD por DOM, no `[innerHTML]`) | `public-profile.xss.spec.ts`: 4 pruebas sobre `jsonLdDePerfil` + `serializarJsonLd`, serializado como en el SSR | ✅ No queda ningún `<` en el JSON: `</script>` no cierra la etiqueta y el SSR emite **un** `<script>`. `JSON.parse` devuelve el dato original. Un avatar `javascript:` viaja sólo como dato. |
| 10 | `shared/components/atoms/input/input.html:3` | comentario (íconos proyectados, no `[innerHTML]`) | `input.xss.spec.ts`: 3 pruebas | ✅ Valor, placeholder, etiqueta y `testId` hostiles quedan como propiedad o atributo. La lupa es constante. Lo proyectado es el nodo del padre. |
| 11 | `shared/components/molecules/rich-text-editor/rich-text-editor.ts:509` | **lee** `innerHTML` de la hoja (`recoger`) | `rich-text-editor.xss.spec.ts` › «:509»: 19 cargas + «lo que emite `edited` es lo saneado» | ✅ Lo publicado no trae elementos ni atributos peligrosos, y pintado en el DOM vivo no ejecuta nada. |
| 12 | `…/rich-text-editor.ts:536` | comentario de `volcar` | cubierto por el punto 13 | ✅ |
| 13 | `…/rich-text-editor.ts:545` | **escribe** `innerHTML` (`volcar`, al montar y con `load()`) | `rich-text-editor.xss.spec.ts` › «:545»: 19 cargas al montar + 19 con `load()` | ✅ El DOM de la hoja queda inerte, y la marca sigue sin aparecer después de una tarea. |
| 14 | `…/rich-text-editor.ts:599` | serializa el saneado (`documento.body.innerHTML`) | `rich-text-editor.xss.spec.ts` › «:599»: 19 cargas de idempotencia (sin mXSS), enlaces de artículo, `<script>`/`<style>` con contenido | ✅ `sanear(sanear(x)) === sanear(x)`. En la barra de artículo un enlace sólo conserva `https?:` y ningún otro atributo. |
| 15 | `shared/components/organisms/article-body/article-body.ts:57` | comentario («Sin `innerHTML`») | `article-body.xss.spec.ts`: marcado en intro, títulos y listas; 4 enlaces con esquema peligroso; enlace válido; imagen hostil | ✅ Todo sale como texto. Un enlace `javascript:`, `data:` o `vbscript:` no se vuelve `<a>`. Una URL de imagen `javascript:` no queda ejecutable. |

**Fallas reales encontradas: ninguna.** No se tocó código de producción.

## Observaciones (no son fallas, quedan dichas)

- **`<noscript>` mal cerrado en el editor:** el resto del contenido queda dentro de
  `<noscript>`, que se descarta entero con su contenido (`DESCARTAR_CON_CONTENIDO`).
  Se pierde el texto que sigue y no se ejecuta nada. La prueba lo deja asentado.
- **SVG dentro del editor:** los elementos SVG conservan las minúsculas en
  `tagName`, así que un `<svg><script>` no entra en `DESCARTAR_CON_CONTENIDO` y se
  **aplana**: el texto del script queda a la vista, como texto. Es inerte. Si se
  quiere que desaparezca, la comparación debería ser sin distinguir mayúsculas.
  Es un cambio de presentación, no de seguridad, y no se hizo.
- **El `<iframe>` del comprobante va sin `sandbox`** (el visor de PDF de Chrome no
  dibuja con él). Hoy es seguro porque sólo recibe `blob:` re-tipadas con un tipo de
  la lista blanca (`PAYMENT_RECEIPT_MIME_TYPES`). Si alguien agrega `text/html` o
  `image/svg+xml` a esa lista, el marco correría con el origen de la aplicación. La
  prueba del SVG lo cubre.

## Cómo reproducir

Correr sólo estos specs con un `tsconfig` acotado: el builder de Angular tipa los
mil y pico de specs aunque se use `--include`, y en una máquina compartida eso hizo
que el kernel matara el proceso por memoria (OOM). El archivo
`tsconfig.spec.local.json` es temporal y no se versiona:

```bash
node -e 'require("fs").writeFileSync("tsconfig.spec.local.json", JSON.stringify({extends:"./tsconfig.spec.json",include:["src/**/*.d.ts","src/test-setup.ts","src/**/*.xss.spec.ts","src/app/features/laboratory/results/laboratory-results.spec.ts"]}))'
yarn ng test --watch=false --ts-config tsconfig.spec.local.json \
  --include 'src/**/*.xss.spec.ts' \
  --include src/app/features/laboratory/results/laboratory-results.spec.ts
rm tsconfig.spec.local.json
```
