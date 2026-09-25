> **AVANCE: 24 / 29 — 82,8 %.**

# Reporte — Cierre de la tanda del 2026-09-25 (Justin): los cinco carriles, observados

- Fecha: 2026-09-25 · Plan: [PLAN.md](./PLAN.md) · Rama: `justin/cierre-tanda-2026-09-25`
- Base: `origin/mockup` @ `9b8bc46e`
- **Peldaño alcanzado: `VERIFIED`** en todo lo visual y en los recorridos — se ejerció en un
  navegador real contra `yarn dev` en el 4230, y las afirmaciones llevan número medido. **No es
  `REGRESSION_VERIFIED`**: la suite completa queda en rojo por causas ajenas (abajo), y la segunda
  pasada crítica de las capturas no puede ser propia (regla 35.1.6).

El desglose sale de las 29 microtareas que los cinco carriles dejaron abiertas. **24 quedaron
`HECHO`**, 2 siguen `BLOQUEADO` por carriles que nunca se entregaron, 1 es `EXTERNAL`, 1 espera
revisor y 1 es un **defecto abierto que esta corrida destapó**.

## Lo que esta corrida cambió, en una línea

La tanda cerró con todo lo visual en `UNKNOWN`. Ahora hay **26 capturas**, **contraste y Regla 8
medidos con números**, tres specs de Playwright que nunca se habían ejecutado **ejecutados**, la
suite completa corrida y clasificada — y **cuatro defectos que sólo aparecen mirando**, uno de
ellos propio y ya corregido.

## Estado por carril

| Carril | Antes | Ahora | Qué faltaba |
|---|---|---|---|
| A · Farmacia | 33 / 41 | **39 / 41** | 1 `EXTERNAL` (checks del CI) · **1 defecto abierto** (el carrito) |
| B · Carga masiva | 60 / 68 | **66 / 68** | 1 `BLOQUEADO` (API real) · 1 parcial (lector de pantalla) |
| C4 · Reconsulta | 10 / 12 | **11 / 12** | 1 espera segunda pasada crítica |
| C6 · Historia | 6 / 9 | **8 / 9** | 1 `BLOQUEADO` (su spec exige API viva) |
| C8 · Integración | 7 / 10 | **9 / 10** | 1 espera segunda pasada crítica |

## Los cuatro defectos que aparecieron al mirar

### 1. «Agregar la receta al carrito» no agrega nada — Carril A, abierto

El recorrido `H5.S2.M2`, aislado en su propia prueba:

```text
[HALLAZGO/carrito] botón: «Agregar la receta al carrito» · aria-disabled=false
[HALLAZGO/carrito] ¿apareció el diálogo de conflicto de sede? false
[HALLAZGO/carrito] aviso tras agregar: «(ninguno)»
[HALLAZGO/carrito] insignia de la cabecera: (no existe en el DOM)
[HALLAZGO/carrito] líneas en el carrito tras agregar: 0
[HALLAZGO/carrito] el carrito dice: «… Tu carrito está vacío …»
```

El botón está habilitado, el clic no abre diálogo ni deja aviso, y `/my-account/pharmacy/cart`
queda **vacío**. Captura: `evidencia/capturas/HALLAZGO-carrito-tras-agregar.png`.

**Esto es exactamente lo que el reporte del carril declaró sin cubrir:** «que "Agregar" suba el
badge de la cabecera se afirma sobre el store (`unitCount` sube), no sobre la cabecera: ese
componente es de Pablo y no se montó». Los 46 unitarios de `where-to-buy.spec.ts` siguen en verde
porque miran el store; el navegador mira la pantalla. **No se arregló**: el carrito y la cabecera
son de Pablo (Ola 0), y la regla 00 §3.2 prohíbe entrar ahí desde este carril. Queda con dueño.

### 2. Los sellos de reconsulta suben solos — C4, abierto

Contando los sellos de «Mis citas» en cuatro cargas seguidas de la misma sesión:

```text
[HALLAZGO] sellos de reconsulta en 4 cargas seguidas de «Mis citas»: 2, 3, 4, 5
[HALLAZGO] ¿crece en cada carga, sin que nadie agende? true
```

Uno más por cada lectura, sin que nadie agende. La captura `C4-mis-citas-375-light.png` lo muestra
en pantalla: **dos citas idénticas** «Lunes 28 sept · Valeria Rojas Mendoza · Reconsulta · Control
de presión arterial». Importa más allá de la maqueta: la reconsulta es una **cita real** —ese era
el punto de C4— y si se siembra por lectura, el paciente ve citas que nadie agendó. El sembrado
vive en `core/mock/`, que es de otro carril: **se reporta, no se toca**. Fijado en una prueba
(`playwright/justin-cierre-tanda.spec.ts`, «los sellos de reconsulta suben solos al recargar»).

### 3. Contraste por debajo de AA en la pantalla de carga masiva — Carril B, **corregido**

`axe` marcó `color-contrast` de impacto **serious** en dos nodos `.carga__nota`:

```text
Element has insufficient color contrast of 4.27 (foreground #787b7b, background #ffffff,
font size 9.0pt (12px)). Expected contrast ratio of 4.5:1
```

El número no es un descuido de la pantalla: es la **excepción E1** que `styles.css:204` declara
para `--text-muted` («3,86–4,27: excepción E1 — solo terciario»). Pero esa misma línea pone la
condición: **solo terciario**. Estas notas dicen cómo armar el archivo y cuál es el tope de tamaño
— son la instrucción del paso, no adorno. Se pasaron a `--text-secondary` (7,24 AAA), **sin tocar
el token compartido**, que vive en 96 archivos y no es de este carril.

```text
$ npx playwright test playwright/carga-masiva.spec.ts --grep "accesibilidad"
  1 passed (12.3s)          # antes: 1 failed
$ corepack yarn test --include='…/version-import.spec.ts'
      Tests  39 passed (39)
```

### 4. El docblock del spec de C8 contradecía a su propio reporte — **corregido**

`playwright/clinica-c8-recorrido-completo.spec.ts` seguía diciendo «**No se ejecutó** … el peldaño
de este archivo es `WRITTEN`, nunca `TESTED`», cuando el commit `4de2effe` lo había corrido **6 de
6**. Era el texto escrito antes de correrlo, que el commit no actualizó. Quien abriera el archivo
para saber si podía citarlo leía lo contrario de la verdad. Reescrito, con la nota de qué decía
antes y por qué.

## Lo medido (no afirmado)

### Contraste del tema oscuro — `B/H5.S1.M4`, cerrado

```text
body background en oscuro = rgb(8, 22, 28)
contraste título de la tarjeta (h1)  = 13.69:1  · CUMPLE (AA 4,5:1)
contraste texto de ayuda (p)         = 14.33:1  · CUMPLE
contraste etiqueta de campo (label)  = 13.3:1   · CUMPLE
```

Era la última microtarea que decía «el tema oscuro se aplica, pero **ninguna relación de contraste
se midió**». Ya está medida, y con holgura.

### Regla 8 en «Mi historia» — `C6.H4.M2`, cerrado

```text
Regla 8 en light · izq=40px der=40px · |izq-der|=0px (umbral ≤2) · 1120px de 1200px = 93.3% (≥85%)
Regla 8 en dark  · izq=40px der=40px · |izq-der|=0px (umbral ≤2) · 1120px de 1200px = 93.3% (≥85%)
```

**Se mide `.historia`, no la tarjeta.** La primera medición apuntó a `app-card` y dio 276 px de
diferencia entre holguras — que es, exactamente, el aside de 18rem más el hueco. La pantalla es una
rejilla de dos columnas y la regla prohíbe **una columna vacía**, no un aside con contenido. Lo que
tiene que estar centrado y a lo ancho es la rejilla, y lo está.

### El NDJSON — `B/H1.S2.M4`, cerrado

```text
el campo declara accept=.csv,.xlsx,.ndjson,.jsonl,.json,text/csv,…
con el modelo elegido y el NDJSON puesto: «Validar» aria-disabled=false
tras validar: ¿hay informe? true
```

La pantalla **sí** admite NDJSON. La primera corrida de esta prueba concluyó lo contrario porque no
elegía perfil, sistema y versión: «Validar» estaba deshabilitado **por el formulario**, no por el
formato. Medir ahí habría publicado un defecto que no existe.

### El recorrido de teclado — `B/H4.S3.M3`

El orden real del foco, 18 tabulaciones desde el principio del documento, está en
`evidencia/mediciones.txt`. Lo que importa de la microtarea:

```text
«Importar» con aria-disabled=true · recibe foco: true
```

El botón deshabilitado **sigue siendo alcanzable**, que es justo para lo que el proyecto usa
`aria-disabled` en vez del atributo nativo. Las 18 tabulaciones recorren la navegación lateral
entera antes de llegar al formulario: no es un defecto, es lo que hay, y ahora está escrito.

## Los specs que nunca se habían ejecutado, ejecutados

| Spec | Resultado | Lectura |
|---|---|---|
| `clinica-c4-reconsulta.spec.ts` | **6 de 10** (10,7 min) | Los 3 que arrancan en `consulta-casilla-reconsulta` fallan: `FollowUpBlock` existe y **ninguna plantilla lo monta** — el cableado era de C1, que no se entregó. El 4.º es real: el sello **no aparece en «Consultas médicas»**, la agenda de la médica, aunque sí en «Mis citas» |
| `carga-masiva.spec.ts` | **11 de 11** tras el arreglo | Cierra `H4.S3.M7`: `no-es-nada.pdf` y `error-red.csv` recorridos en navegador |
| `clinica-c6-historia-paciente.spec.ts` | **6 saltados** | **La causa no era `pw-guard`**: su `beforeAll` hace `test.skip(!apiViva(api))`. Está escrito contra la **API real**, no contra el simulador. Sigue `BLOQUEADO`, pero ahora con la causa correcta |
| `mockup-barrido` + `mockup-click-sweep` | **8 de 9** | Cierra `C8.H2.M3`. El único hallazgo, `/my-account/profile/edit · «Cancelar» → sin manejador GET /loyalty/me`, es ajeno: coincide con el `/loyalty` que `check-api-prefixes` ya reportaba en el corte base |

## Los gates, corridos y clasificados — `C8.H2.M1`, `A/H6.S1.M1`, `B/H5.S1.M5`

| Gate | Resultado | Clase |
|---|---|---|
| `corepack yarn build` | **exit 0** | — |
| `corepack yarn typecheck` | **exit 0**, 0 errores | — |
| `corepack yarn test` (suite entera) | **53 fallos / 7 950** | **ninguno de Justin** — ver abajo |
| `corepack yarn lint` | 19 errores en 5 archivos | ninguno en archivos de estos carriles |
| 9 × `check-*.mjs` + `generate-inventory --check` | 6 en rojo | **los 6 ya fallan en el corte base `bf2c3545`** |

**La suite completa está en rojo, y ninguno de los 53 fallos es atribuible a estos carriles.** La
clasificación entera, con la bisección que la sostiene, está en
[`evidencia/clasificacion-suite.md`](./evidencia/clasificacion-suite.md):

- **38** de `pharmacy-inbox` / `inbox-order` → PR **#671** (Ola 0 de Pablo)
- **10** de `patient-home` → PR **#670** (`feature/sintomas-silueta-y-sexo`)
- **1** de `access-tree` → commit `8c7d7721`, el renombre «Evoluciones» → «Notas médicas» de C7
- **1** de `shell-layout` → ya falla en el corte base
- **3** pasan al correrlos aislados → contaminación entre archivos de vitest

La bisección corrió **el mismo subconjunto** en siete cortes: verde hasta `#669`, rompe en `#670`,
suma en `#671`. Entre `#669` y el primer PR de Justin de la noche (`#673`) no hay ningún commit de
estos carriles.

## El desborde a 375 px, localizado

Cuatro pantallas de tres carriles medían `scrollWidth = 403` contra `innerWidth = 375`. Parecía un
defecto de cada pantalla. `scripts/sonda-desborde-375.mjs` —que descarta los elementos que un
ancestro recorta— lo nombra:

```text
control · panel     375  375  false  (ninguno sin recortar)
A · mis recetas     403  375   true  div.app-header__derecha ← header.app-header
A · tienda          403  375   true  div.app-header__derecha ← header.app-header
C6 · mi historia    403  375   true  div.app-header__derecha ← header.app-header
C4 · mis citas      403  375   true  div.app-header__derecha ← header.app-header
```

Es **el armazón**, no el CSS de estos carriles: `/dashboard`, que ninguno tocó, no desborda. Por eso
el spec de cierre **mide y anota** el número en cada pantalla y cada ancho, pero no asevera: hacerlo
convertiría a estos carriles en rehenes de un defecto ajeno y el rojo enseñaría a ignorarse.

## Doble revisión crítica de las capturas (regla 35.1)

**Primera pasada: hecha, sobre las 26 capturas.** Lo que salió de mirarlas está arriba —el carrito
vacío y las citas duplicadas se vieron en la captura antes que en un número—. El tema oscuro se
comprobó midiendo el fondo del cuerpo (`rgb(8, 22, 28)`), no de vista: sin eso, seis capturas
«oscuras» podrían haber sido seis claras.

**Segunda pasada: PENDIENTE, y no puede ser propia** (regla 35.1.6). Es lo único que separa a C4 y
C8 de su última microtarea.

## Lo que sigue bloqueado, y por quién

| Qué | Carril | De quién depende |
|---|---|---|
| Los 3 casos de C4 que arrancan en la consulta | C4 | **C1** — `FollowUpBlock` está escrito y ninguna plantilla lo monta |
| `clinica-c6-historia-paciente.spec.ts` | C6 | Una **API viva**: su `beforeAll` se salta sin backend. No es el `pw-guard` |
| Ejercer la carga masiva contra la API real | B | El endpoint **ya existe** en `origin/itzan/carga-masiva-motor-2026-09-25` (`terminology-import-template.controller.ts`), **sin mergear**. El bloqueo cambió: antes no estaba escrito |
| Checks del CI en verde | A, B | El CI del repo sigue caído (`CLAUDE.md` del repo lo declara) |
| El lector de pantalla sobre el informe | B | No hay NVDA ni VoiceOver en este entorno |

## Lo que NO se hizo, a propósito

- **No se escribió `scripts/pw-guard.mjs`.** Era artefacto de C0. Se corrió el servidor a mano, que
  es la alternativa que los propios reportes anotan.
- **No se montó la casilla de reconsulta.** Es `consultation/**`, de C1. Montarla habría hecho pasar
  tres casos de C4 tomando el carril de otro.
- **No se arregló ningún rojo ajeno** — ni los 53 de la suite, ni los 19 de lint, ni los 6 gates, ni
  el carrito, ni el sembrado de reconsultas. Están reportados con su causa y su corte.
- **No se tocó `--text-muted`.** Vive en 96 archivos y su valor es una excepción aceptada del
  sistema de diseño.

## Procesos al cerrar

**Ninguno.** El servidor de desarrollo del 4230 se levantó para esta corrida y se cerró al terminar.
