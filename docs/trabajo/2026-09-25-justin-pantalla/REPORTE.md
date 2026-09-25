> **AVANCE: 56 / 68 — 82,4 %.**

# Reporte — Carga masiva: pantalla, cliente y doble del simulador

- Fecha: 2026-09-25 · Turno noche · Plan: [PLAN.md](./PLAN.md)
- Rama: `justin/carga-masiva-pantalla-2026-09-25` · Base: `origin/mockup` @ `bf2c3545`
- **Peldaño de evidencia alcanzado: `TESTED` (peldaño 4)**, con un matiz por área:
  - doble del simulador · cliente · pantalla → `TESTED` **contra el doble**, 132 pruebas dirigidas en verde;
  - prueba visual → **`UNKNOWN` (peldaño 0)**: no se abrió un navegador en toda la corrida;
  - contra la API real → **`UNKNOWN`**: el endpoint de §2 todavía no existe en la rama de Itzan.
- **No se alcanzó `VERIFIED`** y no se dice que nada «funcione»: nadie ejercitó esta pantalla en un
  navegador. Lo que hay es comportamiento ejercitado en pruebas contra un doble declarado.

Desglose de los 68: **49 HECHO** en las tablas del plan + **7** de cierre (H6.S2.M1–M7) = **56
HECHO** · **7 BLOQUEADO** · **2 A MEDIAS** · **3 DESCARTADO**. `A MEDIAS` y `BLOQUEADO` cuentan como
no hechas.

## Completado

| ID | Qué se logró (observable) | Comando de verificación | Resultado |
|---|---|---|---|
| H1.S1.M1–M5 | Corte y baseline clasificado | `git rev-parse HEAD`, `yarn typecheck`, `yarn lint`, `yarn test --include` | PASS · `evidencia/antes/` |
| H1.S2.M1–M2 | Ruta (`app.routes.ts:763`) y cuenta admin sintética (`admin@alovida.mock`) localizadas | `grep` | PASS · §Hallazgos del plan |
| H2.S1.M1–M7 | **El doble responde §2 en los tres niveles decidiendo por nombre de archivo**, y sirve la plantilla con su `Content-Disposition` | spec dirigido del manejador | **25/25 PASS** (4 preexistentes + 21 nuevas) · `evidencia/h2/spec-doble.txt` |
| H2.S1.M7 | Publicado temprano para Marcelo | `git log origin/<rama> -1` | Commit `8926f5af`, push **04:00:55 -0400** |
| — | El doble no rompió el barrido del simulador | spec dirigido de `mock-backend` | **31/31 PASS** · `evidencia/h2/mock-backend.txt` |
| H3.S1.M1–M7 | `importConceptsFile(…, {dryRun, profile})` y `downloadImportTemplate(profile, format)`, con sus tipos | spec dirigido del cliente | **37/37 PASS** (eran 26) · `evidencia/h3/` |
| H4.S1.M1–M8 | Paso 1 y paso 2: perfil, sistema, versión, las dos plantillas, `accept` ensanchado a CSV/XLSX, y cambiar el archivo limpia el resultado | spec dirigido de la pantalla | **39/39 PASS** (eran 5) · `evidencia/h4/spec-pantalla.txt` |
| H4.S2.M1–M12 | Validar sin guardar, informe, vista previa, errores con columna, importar con su candado, resumen, CSV de errores, «Cargar otro», mapeo de errores y los 9 estados M34 | idem | PASS |
| H4.S3.M1, M2, M4, M5, M6 | Nombres accesibles, región viva, foco al resultado, microcopy, **cero literales de color** y `lint`/`typecheck` sin rojos nuevos | `grep` de literales, `yarn lint`, `yarn typecheck` | PASS · `evidencia/h4/tokens.txt`, `typecheck-lint.txt` |
| H5.S1.M6 | El diff no toca ningún archivo de otros | `git diff origin/mockup --stat` filtrado | **salida vacía** · `evidencia/h5/diff-ajeno.txt` |
| H6.S1.M1, M4 | Se miró la rama de Itzan **una vez** y se contrastó su §1 contra el doble | `git -C ../mantra-core-health-api log` | PASS · `evidencia/h6/api.txt` |
| H6.S2.M1–M7 | Rebase al día, PR abierto contra `mockup`, estado consultado, procesos declarados, reporte y daily | `gh pr view` / `gh pr checks` | ver §Evidencia y `evidencia/pr/` |

### Los tres candados del contrato, uno por uno

1. **No se importa sin validar** (Q-8). `puedeImportar` es un `computed` sobre el informe: sin
   validación, con errores, o tras cambiar archivo / versión / perfil, se apaga solo. Cuatro pruebas.
2. **Sin doble envío.** Dos clics seguidos en «Validar» y en «Importar» producen **una** petición
   (`http.expectOne` falla si hubiera dos). Dos pruebas.
3. **Datos preservados ante fallo.** Red (status 0), 413, 422 y 500: el archivo y las tres
   selecciones siguen, y el motivo queda anclado en la sección 3. Seis pruebas.

## A medias

### H4.S3.M3 — Recorrido de teclado
- **Qué anda:** el recorrido está escrito paso por paso en `evidencia/h4/teclado.md`, y sus puntos
  clave están **verificados por aserción**: el botón deshabilitado sigue siendo alcanzable
  (`aria-disabled="true"`, no el atributo nativo), el informe vive dentro de `aria-live="polite"`,
  tiene `tabindex="-1"` y `document.activeElement` es él después de validar; el resumen recibe el
  foco tras importar.
- **Qué no anda:** nada roto. Lo que falta es la **observación**: nadie tabuló por la pantalla real
  ni la escuchó con un lector.
- **Qué falta exactamente:** abrir `/administration/terminology/import` con `yarn dev` y la cuenta
  `admin@alovida.mock`, recorrer los 11 pasos de la tabla de `teclado.md` y anotar los que están
  marcados `[derivado]` (sobre todo el 6, el Enter sobre la zona de arrastre); y pasar NVDA o
  VoiceOver sobre el informe para confirmar que se anuncia al aparecer.
- **Dónde quedó:** `evidencia/h4/teclado.md`, en la rama, con la distinción `[spec]` / `[derivado]`
  escrita en el propio documento. El código compila y sus 39 pruebas pasan.

### H5.S1.M3 — Sin scroll horizontal a 375
- **Qué anda:** el CSS es **mobile-first** (2 `min-width`, cero `max-width`), la rejilla de campos
  arranca en una columna, los botones llevan `flex-wrap: wrap` y la caja de la tabla lleva
  `min-inline-size: 0` —que es justamente lo que evita que una definición larga estire la rejilla—.
- **Qué no anda:** nada observado, porque no se observó.
- **Qué falta exactamente:** abrir la pantalla a 375 px en los cuatro estados (vacío, validando, con
  errores, éxito) y evaluar `document.documentElement.scrollWidth <= innerWidth` en cada uno.
- **Dónde quedó:** `version-import.css`, en la rama. Es una afirmación **de lectura de código**, que
  la regla 30 no admite como verificación: por eso esta microtarea no es `HECHO`.

## Pendiente

| ID | Estado | Qué lo destraba |
|---|---|---|
| H1.S2.M3, M4, M5 | `BLOQUEADO` | Un navegador. La corrida prohíbe levantar cualquier servidor: hay **cuatro carriles en paralelo** en esta máquina (regla 70.1.4–70.1.6). No hay capturas «antes» ni lista de errores de consola previa. |
| H4.S3.M7 | `BLOQUEADO` | Ídem: recorrer la ruta contra `yarn dev` con `ok-50.csv`, `con-errores.xlsx`, `no-es-nada.pdf` y `error-red.csv`. |
| H5.S1.M1, M2, M4 | `BLOQUEADO` | Ídem: las **24 capturas** (3 viewports × 2 temas × 4 estados), su primera pasada y el contraste en oscuro. **Peldaño visual = `UNKNOWN`.** La segunda pasada adversarial no es mía (regla 35.1.6): es de Marcelo. |
| H5.S1.M5 | `DESCARTADO` | La suite entera está prohibida en esta corrida; la corre el operador, centralizada, al final. |
| H6.S1.M2, M3 | `DESCARTADO` | La rama de Itzan **existe** (`e57c0126`, 03:45) pero trae **sólo el contrato de fila §1**: cero apariciones de `dryRun`, `import-template` e `IMPORT_FORMAT_UNSUPPORTED` en toda la rama. El endpoint HTTP que esta pantalla consume no está escrito, así que levantar Postgres y la API no habría dado nada que recorrer. Evidencia en `evidencia/h6/api.txt`. |

## Contra el doble

**Todo lo que este carril declara verificado, lo está contra el doble del simulador, no contra la
API real.** Lo digo con todas las letras porque el peldaño depende de eso.

### Verificado contra el doble

| Qué | Con qué |
|---|---|
| Los tres niveles de §2 decididos por nombre de archivo, con sus códigos y estados | 21 pruebas del manejador |
| `aborted` ⇔ `errors > 0` ⇔ `inserted = 0` (Q-2) | spec del manejador y de la pantalla |
| `batchId` nulo en dry-run, sin registrar lote (Q-4) | spec del manejador y del cliente |
| Un código ya existente se **omite**, no se actualiza (Q-7): segunda carga → 0 insertadas, 50 omitidas | spec del manejador |
| El `FormData` lleva `file`, `dryRun` y `profile` como texto | 11 pruebas del cliente |
| La plantilla se pide como blob y su nombre sale del `Content-Disposition` | spec del cliente |
| «Importar» deshabilitado hasta validar con 0 errores; sin doble envío; nada se pierde ante fallo | 34 pruebas nuevas de la pantalla |
| El CSV de errores llega a `CsvExportService` con el motivo crudo, que es quien neutraliza `= + - @` | spec de la pantalla |

### Pendiente de verificar contra la API real de Itzan

1. **El estado HTTP del dry-run** (Q-J1). El doble responde 200 y el contrato admite 200 o 201. El
   cliente **no ramifica por el status**, así que la diferencia no debería importar — pero es una
   afirmación que nadie ejerció contra la API.
2. **Los valores de `preview` y `errorSamples`**: el doble los deriva del nombre del archivo; el
   parseador real los saca del contenido. Que el **contrato de campos** coincida está verificado;
   que los números coincidan con los fixtures de verdad, no.
3. **La plantilla XLSX.** El doble sirve el **mismo texto CSV** con el tipo y el nombre de un libro,
   porque armar un `.xlsx` de verdad exige una dependencia y este carril tiene prohibido agregarla.
   Lo que el doble reproduce entero es la **forma** de la respuesta. El libro real lo sirve
   `import-template.service.ts` de la API, que todavía no existe.
4. **El S8 «la petición no llegó».** Un manejador del simulador **no puede** emitirlo: el estado 0
   sólo lo produce `emitirFallo` del interceptor, y lo dispara la sesión. `error-red.csv` devuelve
   por eso un **503 con `correlationId`** (S9), que es el fallo más cercano que sí puede emitir. El
   S8 de la pantalla **sí** está verificado, en su propio spec, con `HttpTestingController` y estado
   0 real. Para verlo en el navegador hay que declarar el fallo en `sessionStorage`, con la clave
   `mock:fallos` y el patrón `/import-file` en modo `red` — la receta literal está en la cabecera
   del manejador.
5. **El 401/403 real.** El doble los emite mirando `user.roles`; la autorización de verdad la hace
   el decorador de roles del controlador.

Contraste que **sí** se pudo hacer contra la rama de Itzan (su §1 publicado): `FormatoDeArchivo`,
los identificadores de perfil y el carácter **opcional** de `columna` coinciden con el doble.
Detalle en `evidencia/h6/api.txt`.

## Evidencia

```text
$ corepack yarn test --watch=false --include=<terminology.handlers.spec.ts>
 Test Files  1 passed (1)
      Tests  25 passed (25)

$ corepack yarn test --watch=false --include=<terminology.client.spec.ts>
 Test Files  1 passed (1)
      Tests  37 passed (37)

$ corepack yarn test --watch=false --include=<version-import.spec.ts>
 Test Files  1 passed (1)
      Tests  39 passed (39)

$ corepack yarn test --watch=false --include=<mock-backend.spec.ts>
 Test Files  1 passed (1)
      Tests  31 passed (31)

$ corepack yarn typecheck
exit=0

$ corepack yarn lint
6 problems (6 errors, 0 warnings)   <- los MISMOS 6 del baseline, 0 en archivos de este carril

$ git diff origin/mockup --stat | grep -E "file-input|app.routes|navigation|playwright|alovida/terminologia"
(salida vacía)
```

Índice de `evidencia/`: `antes/` (baseline: typecheck, lint, los dos specs) · `h2/` (doble +
barrido del simulador) · `h3/` (cliente + typecheck) · `h4/` (pantalla, tokens, typecheck+lint,
recorrido de teclado) · `h5/` (diff contra archivos de otros) · `h6/` (rama de Itzan y veredicto) ·
`pr/` (estado del PR).

**Total de pruebas dirigidas: 132 en verde** (25 + 37 + 39 + 31). Baseline de esos mismos archivos:
4 + 26 + 5 + 31 = 66. **Ninguna prueba se borró, se saltó ni se debilitó.**

## No cubierto

- **Nada se abrió en un navegador.** Sin capturas, sin consola, sin red, sin scroll a 375 medido,
  sin contraste en modo oscuro, sin el Enter sobre la zona de arrastre. Es la brecha más grande de
  esta entrega y la razón de que el peldaño visual sea `UNKNOWN`.
- **La suite entera no se corrió.** Sólo cuatro specs dirigidos. Un componente que importe algo que
  yo haya movido podría estar en rojo sin que yo lo sepa — aunque `typecheck` en 0 y el hecho de que
  ningún símbolo público cambiara de nombre lo hacen poco probable.
- **Playwright: cero.** Es el carril de Marcelo.
- **La descarga en sí.** Que el navegador **guarde** la plantilla y el CSV de errores no se observó:
  el spec comprueba que la petición sale bien formada y que el CSV llega a `CsvExportService` con
  las filas correctas, pero `blobToDataUrl` usa `FileReader` (asíncrono) y el guardado real no se
  ejerció.
- **El lector de pantalla.** El `aria-live` está puesto y probado *por estructura*, no *por
  locución*.

## Desvíos del plan

1. **Secciones, no pestañas.** `CLAUDE.md` §6 y `composition-rules.md` §5 piden «UNA tarjeta **con
   pestañas**». Se cumple la tarjeta única, centrada, a lo ancho y sin tope propio —que es lo que la
   regla vino a arreglar— pero las tres partes van como **secciones en orden**: es un flujo
   secuencial, el paso 3 no tiene nada que mostrar hasta que los otros dos están resueltos, y una
   pestaña que se puede abrir vacía invita a empezar por el final. Es además lo que pide el prompt,
   literal. **A confirmar con Pablo.**
2. **`ConceptImportResult.batchId` pasó de `string` a `string | null`.** §2 lo declara
   «uuid o null» y dice que es nulo en dry-run: dejarlo `string` sería un tipo que miente. Un `grep`
   de `batchId` sobre `src/app` confirma que **no hay ningún consumidor** fuera de mis archivos y de
   los specs. Los otros seis campos nuevos van opcionales, como pedía la instrucción.
3. **La vista previa se muestra siempre después de validar**, también cuando el archivo abortó (con
   su estado vacío que orienta). El plan la ponía como alternativa de la tabla de errores; se separó
   porque H4.S2.M4 exige el estado vacío de la vista previa y H4.S2.M5 exige que la de errores
   **no exista** si hay 0.
4. **`yarn install` no se corrió**: el operador declaró el entorno ya preparado y lo prohibió.
   `node scripts/generate-env.mjs` sí hizo falta una vez, porque el script `typecheck` no lo invoca
   (el de `test` sí) y sin él daba 4 errores TS2307 por `env.generated`.

## Defecto propio, encontrado y corregido

**Borré un spec ajeno y lo restauré.** `src/app/core/mock/handlers/terminology.handlers.spec.ts` ya
existía en `origin/mockup` con 71 líneas y **4 pruebas** de las propiedades de un concepto (C-20).
Lo creé con `Write` dando por hecho que no estaba y lo pisé entero; el commit `8926f5af` lo dejó con
mis 21 pruebas y sin las 4 de antes. Es exactamente lo que prohíbe la regla 00 §4.1. Lo destapó
`git diff origin/mockup --stat`, que mostraba el archivo como **modificado con borrados** en vez de
nuevo. Corregido antes del PR: se recuperó el original con `git show origin/mockup:<ruta>`, mi
`describe` quedó **anidado debajo**, y el archivo tiene ahora **25** pruebas. Comprobación dura: el
diff de ese archivo contra `origin/mockup` filtrado por líneas borradas sale **vacío**.

## Riesgos residuales y deuda

| Riesgo | Impacto | Estado |
|---|---|---|
| La pantalla nunca se vio | Alto. Un defecto de layout, de contraste o de scroll a 375 pasaría entero | Declarado; peldaño visual `UNKNOWN` |
| Los códigos `IMPORT_*` no están en `API_ERROR_CODES` | Medio. Hoy los lee la pantalla del cuerpo crudo; cualquier otro consumidor los verá como error genérico | **Q-J4**: que Pablo o Itzan los agreguen a `core/http/api-error.ts` al integrar. Fuera de mi alcance |
| El doble no puede emitir el S8 | Bajo | Documentado en el propio manejador, con la receta de `mock:fallos` |
| La plantilla XLSX del doble no es un libro real | Bajo | Declarado en el código y acá |
| 6 errores de `lint` preexistentes | Bajo, ajeno | 4 en `playwright/**` (Marcelo) y 2 de función vacía en specs de seguros. **No los toqué** (regla 00 §3.2) |

## Decisiones y ambigüedades

| ID | Supuesto tomado | A quién confirmar |
|---|---|---|
| Q-5 | La vista previa la devuelve el servidor; el front no parsea nada | Pablo |
| Q-8 | Desde la interfaz no se importa sin validar | Pablo |
| Q-9 | **Una sola opción de perfil** («Conceptos»). No hubo daily de Marcelo en esta corrida que confirmara `designaciones`, y ofrecer una opción que el servidor va a rechazar es peor que no ofrecerla. El select existe igual, y el texto de ayuda ya sabe describir los dos perfiles | Marcelo |
| Q-J1 | El doble responde 200 en dry-run; el cliente **no ramifica por status** | Itzan |
| Q-J2 | **Hay precedente en el repo**: `blobToDataUrl` + `FileDownloader.trigger`, como `downloadCertificatePdf`. Se copió, no se inventó | Pablo |
| Q-J3 | Tras importar se muestra **sólo** el resumen: el informe y la vista previa desaparecen | Pablo |
| Q-J4 | Los `IMPORT_*` se leen del cuerpo crudo del `HttpErrorResponse`, **sin tocar** `core/http/api-error.ts`, que es de otro carril | Pablo / Itzan |
| Q-J5 | `error-red` da 503 `DEPENDENCY_UNAVAILABLE` con `correlationId`; el S8 real se provoca con `mock:fallos` | Pablo |
| — | Secciones en vez de pestañas (ver Desvíos §1) | Pablo |

## Procesos corriendo al cerrar

**Ninguno.** No se levantó ningún `ng serve`, ninguna API, ningún contenedor ni ningún navegador en
toda la corrida. Lo único que se ejecutó fueron `yarn test --include` dirigidos, `yarn typecheck` y
`yarn lint`, todos en primer plano y todos terminados.
