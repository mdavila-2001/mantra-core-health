# Reporte — Baseline comparable de Directorio y Reserva

> **AVANCE: 11 / 12 microtareas HECHO (91,7 %).** La restante (`H1.S2.M5`, publicar la tabla a
> Ender) se entrega en el PR de PromptManager, porque el daily de equipo no vive en este repositorio.

- Fecha: 2026-09-24 · Plan: [PLAN.md](./PLAN.md) · Rama: `justin/baseline-historico-reserva-2026-09-23`.
- Peldaño de evidencia (regla 30): `VERIFIED` local, con 10 muestras por corte y escenario y las dos
  pasadas de revisión de capturas, la segunda por un agente distinto del que implementó.
  **No** se declara despliegue remoto.

## Los dos cortes, con su nombre correcto

| | SHA | Qué es |
|---|---|---|
| antes | `b7785e36` | el corte sobre el que se abrió el PR #583 |
| después | `a43ad2b3` | la **punta de `origin/mockup`** al momento de medir |

**El corte «después» no es el PR #583.** Entre los dos hay **30 commits**, de los cuales **8 son
merges de pull request** (más 2 merges de integración, `e65bc4f5` y `300045e3`):

```text
a43ad2b3  #599  pablo/noche-disciplina-tablas
cd1e69f3  #598  ender/simulador-cabecera
337a0716  #594  pablo/noche-disciplina-tablas
1d721b73  #592  ender/simulador-cabecera
fe24f91b  #590  pablo/inicio-paciente-silueta-voz-y-confirmacion
fc8adc4e  #584  ender/simulador-cabecera
5dc38c90  #583  justin/verificar-cotizaciones-navegador
723ddb40  #572  pablo/rescate-carril-c
```

Por eso **nada de este reporte se adjudica a un PR en particular**. En concreto: la diferencia de
barra lateral y cabecera que se ve en todas las capturas viene de los tres `ender/simulador-cabecera`
(#584, #592, #598), no del carril de Directorio. El plan original decía comparar contra `4c9e419f`;
se midió contra la punta, y eso se declara acá en vez de dejarlo implícito.

## Qué cierra este trabajo

El daily de equipo del 2026-09-22 tiene la fila «Medición del flujo de reserva (peticiones, tiempos)»
en `A MEDIAS`, con el motivo «faltan baseline y recorrido», y el reporte de gates del 2026-09-23 la
repite como pendiente: «línea base histórica comparable y recorrido instrumentado repetido».
Esto es esa línea base.

## Por qué el listado va filtrado a una profesional sintética

Sin filtrar, la primera pantalla de Cardiología son diez médicos de
`src/app/core/mock/fixtures/insurer-network.generated.ts`, con nombre completo y dirección de
consultorio. La cabecera de ese archivo lo dice sin rodeos:

> «763 médicos · 1282 consultorios … **Son médicos reales**: fabricarles una nota o unos horarios
> sería afirmar algo sobre alguien que existe.»

Sirven para que la maqueta tenga volumen. No para quedar pegados en una carpeta de evidencia que se
versiona y se revisa. Así que el recorrido medido filtra el listado por **`Valeria Rojas Mendoza`**,
que es una persona **sintética** escrita a mano en `fixtures/personas.ts` (índice 0) y, además, la
única cardióloga con agenda publicada en los dos cortes. La aserción que lo sostiene no cuenta
tarjetas —son dos, la misma persona bajo sus dos especialidades— sino que **no quede nadie más**:

```ts
await expect(tarjeta.filter({ hasNotText: PROFESIONAL_SINTETICA })).toHaveCount(0);
```

La única captura que sí sale de un médico de la red es `07-sin-horarios-1440.png`, y encuadra
**sólo** el bloque «Sedes y horarios»: el nombre queda deliberadamente fuera. Lo que esa captura
tiene que probar es el estado vacío, no de quién es la ficha. Que además sea **la misma ficha en la
misma posición en los dos cortes** no depende de creerle al encuadre: la revisión adversarial midió
el par y el resto de la imagen es idéntico píxel a píxel
([`doble-revision.md`](evidencia/doble-revision.md)).

## Completado

| ID | Qué se logró (observable) | Comando de verificación | Resultado |
|---|---|---|---|
| H1.S1.M1 | El spec pasa el lint del repositorio | `npx eslint playwright/baseline-comparable-reserva.spec.ts` | exit `0` |
| H1.S1.M2 | El corte de entrega typechequea, y el chequeo incluye `playwright/tsconfig.json`, donde vive el spec | `corepack yarn typecheck` | exit `0` |
| H1.S1.M3 | Los cuatro archivos que el reporte de gates del 23/09 daba en rojo **pasan enteros en el corte anterior** | los 4 con `corepack yarn test --watch=false` en `b7785e36` | `Test Files 4 passed (4)` · `Tests 137 passed (137)` |
| H1.S1.M4 | En el corte actual sólo uno de esos cuatro falla, y falla **por contención de recursos**, no por el cambio | los mismos 4 en `a43ad2b3`, y después el que falla, aislado | juntos: `1 failed \| 3 passed` · aislado: `Test Files 1 passed (1)` · `Tests 10 passed (10)` |
| H1.S2.M1 | Recorrido normal medido en los dos cortes, hasta los cupos a la vista | escenario **A**, 10 muestras por corte | mediana `1428 ms` → `1108 ms` |
| H1.S2.M2 | Camino por defecto, que termina sin horarios, medido en los dos cortes con la **misma** fixture | escenario **B**, 10 muestras por corte | mediana `1460 ms` → `892 ms` |
| H1.S2.M3 | Cuatro activaciones seguidas de una tarjeta producen **una** navegación, en los dos cortes | aserción dura del spec (`toBe(1)`) | pasa en `antes` y en `despues` |
| H1.S2.M4 | Catorce capturas comparables, 1440×900 y 390×844, sin médicos reales y con el estado asentado **aseverado**, no confiado a un flag | `evidencia/antes/`, `evidencia/despues/` | 7 pares |
| H3.S1.M1 | Evidencia publicada: spec, 20 muestras, resumen agregado, capturas y doble revisión | este reporte y `evidencia/` | completo |
| H3.S1.M2 | PR hacia `mockup`, sin auto-merge | `gh pr view` | ver [`evidencia/pr-mergeable.txt`](evidencia/pr-mergeable.txt) |
| H3.S1.M3 | Resumen en PromptManager hacia `main`, sin auto-merge | PR aparte | ver [`evidencia/pr-mergeable.txt`](evidencia/pr-mergeable.txt) |

## La medición

Dos escenarios, diez muestras por corte cada uno. Cada muestra tiene su archivo bajo
`evidencia/<corte>/muestras/` y `evidencia/<corte>/muestras-sin-horarios/`; el agregado está en
[`evidencia/resumen.json`](evidencia/resumen.json).

**No se publica ninguna corrida suelta como titular.** La primera versión de esta evidencia lo hacía,
y daba −36 % donde por medianas era −18 %: una corrida contra otra no prueba nada cuando los rangos
se solapan.

### A · Directorio → Cardiología → profesional sintética → cupos a la vista

Incluye las cuatro activaciones seguidas de la misma tarjeta.

| Corte | n | mín | **mediana** | máx | rango | media |
|---|---|---|---|---|---|---|
| antes `b7785e36` | 10 | 1285 ms | **1428 ms** | 1566 ms | 281 ms | 1428 ms |
| después `a43ad2b3` | 10 | 914 ms | **1108 ms** | 1448 ms | 534 ms | 1151 ms |

Diferencia de medianas: **−320 ms (−22 %)**. Los rangos **se solapan**, y **1 de 10** muestras del
corte actual (1448 ms) supera la mediana del anterior. Es el escenario más débil de los dos: la
separación está en las medianas, no en las muestras.

### B · Directorio → primera especialidad → primer resultado → «Todavía no publicó horarios»

El camino que un paciente toma por defecto.

| Corte | n | mín | **mediana** | máx | rango | media |
|---|---|---|---|---|---|---|
| antes `b7785e36` | 10 | 1300 ms | **1460 ms** | 1673 ms | 373 ms | 1454 ms |
| después `a43ad2b3` | 10 | 803 ms | **892 ms** | 1133 ms | 330 ms | 937 ms |

Diferencia de medianas: **−568 ms (−39 %)**. Acá los rangos **no se solapan**: la muestra más lenta
del corte actual (1133 ms) es más rápida que la más rápida del anterior (1300 ms), y **0 de 10**
superan la mediana vieja. Es la comparación más firme de las dos.

### Cómo hay que leer estos números

- **Los dos escenarios no son igual de firmes.** En el camino por defecto las 20 muestras se separan
  sin solaparse; en el de cupos los rangos se solapan y una muestra nueva supera la mediana vieja,
  así que ahí lo único que se afirma es la separación de medianas, no que cualquier corrida suelta
  vaya a ser más rápida.
- **La mejora no es del carril de Directorio.** Entre los dos cortes también entró la tabla de
  latencia determinista del simulador: `/scheduling/slots` pasó de `120 + random(0..179)` a `40` ms
  fijos y `/profiles` a `90`. Ése es el cambio que toca justo la ruta caliente de «elegir médico».
  Separarlo del resto pide un tercer corte que no se hizo, así que no se adjudica.
- **Nada de esto es tráfico de red.** El simulador es un interceptor en memoria: las solicitudes
  observadas tras las cuatro activaciones son **todas** `chunk-*.js` del servidor de desarrollo más
  `/@ng/component`. **Cero peticiones de negocio observables**, en los dos cortes.

### Invariantes que dieron igual en los dos cortes

| Qué | antes | después |
|---|---|---|
| Navegaciones tras cuatro activaciones | 1 | 1 |
| Peticiones de negocio observables | 0 | 0 |
| Sedes de la profesional | 2 | 2 |
| Cupos visibles | 15 | 15 |
| Etiqueta del primer cupo | `vie 25 · 08:30–09:00` | `vie 25 · 08:30–09:00` |
| Mensaje del camino por defecto | «Todavía no publicó horarios» | «Todavía no publicó horarios» |

Los cinco últimos son la prueba de que la fixture es equivalente entre cortes. Sin eso, comparar
tiempos no querría decir nada.

## Hallazgos

### Del producto

| ID | Hallazgo | Consecuencia |
|---|---|---|
| P-1 | **El camino por defecto no llega a un cupo en ninguno de los dos cortes.** La primera tarjeta de la primera especialidad es un médico de la red de aseguradoras, y ésos no tienen agenda **a propósito** (`fixtures/agenda.ts`: «fabricárselos sería ofrecer turnos que no existen») | El DoD «hasta cupos» no se cumple por el camino que un paciente toma solo. Queda como decisión de producto, no se toca la fixture desde este carril |
| P-2 | En el corte **anterior**, a 390 px la píldora «Datos de prueba» se superpone a la cabecera: tapa entera la campana de notificaciones y media mitad del conmutador de tema. En el corte actual es un chip «Demo» debajo de la cabecera | Es un defecto real del corte anterior, capturado con fidelidad. Ya está corregido en `mockup`; se registra para que quede el antes y el después |
| P-3 | En el listado, tres cifras conviven sin explicarse: el contador dice «2 médicos», el grupo dice «Cardiología 1» y la portada dice «Cardiología · 50 médicos». Sin filtro eran «56», «Cardiología 50» y «50 médicos» | **Idéntico en los dos cortes**, así que no rompe la comparación. No se inventa la causa: queda anotado para que lo mire quien tenga el listado |
| P-4 | «Mis puntos» desaparece de la navegación entre cortes; «Tutoriales» y «Chats» sobreviven como iconos de cabecera | Es intencional: el daily de equipo del 2026-09-22 (§4-bis, fila de Ender H4.S2) dice «renglón retirado (`fueraDelMenuPara: [ANY_ROLE]`), `/my-account/loyalty` redirige a `/my-account`». Se confirma acá, no se reporta como pérdida |

### Del instrumento que se heredó

Cinco defectos, todos encontrados **auditándolo antes de creerle**, todos corregidos en el spec.

| ID | Hallazgo | Consecuencia |
|---|---|---|
| I-1 | El cronómetro paraba en `getByRole('button').first()` del bloque de disponibilidad, que es **«Semana anterior»** y está pintado desde el primer frame | Medía hasta antes de que llegaran los cupos. Ahora espera un cupo o el estado vacío |
| I-2 | `estable()` (`playwright/support/sesion.ts:142`) espera `networkidle`, que con `ng serve` no llega, y abandona **en silencio** a los 15 s | El `CLAUDE.md` del repo ya lo advierte. El spec espera contenido real |
| I-3 | El proyecto `chromium` extiende `devices['Desktop Chrome']`, cuyo viewport 1280×720 **pisa** el 1440×900 del config | Los archivos `-1440` guardaban 1280 px: el nombre mentía. Corregido con `setViewportSize` |
| I-4 | `fullPage: true` con la barra lateral `position: fixed` la pinta una sola vez arriba, encima del resto de la página | Capturas ilegibles. Las 14 son del viewport |
| I-5 | `page.screenshot()` **no** congela animaciones —a diferencia de `toHaveScreenshot()`— y `toBeVisible()` se cumple en el primer fotograma. Con `app-empty-state` entrando en 240 ms, el mismo componente salió a 74 % de opacidad en un corte y a 40 % en el otro, con el subtítulo a **1,93:1** de contraste | Dos instantes de la misma transición disfrazados de diferencia entre cortes |
| I-6 | **`animations: 'disabled'` no alcanzó.** Con el flag puesto en las catorce capturas, una siguió saliendo a 66,5 % de opacidad y 2 px arriba de su sitio, con el subtítulo a 3,37:1. El mecanismo por el que se escapa del flag no se verificó y no se inventa | La salida no es confiar en el flag: antes de disparar se espera a que terminen **todas las animaciones finitas** de la página, y en el estado vacío se **asevera** opacidad 1 y desplazamiento vertical 0. Si volviera a dispararse en vuelo, ahora falla la prueba en vez de viajar dentro de un PNG |

### Sobre lo que el daily afirmaba

| ID | Hallazgo |
|---|---|
| D-1 | El daily del 22/09 dice «el recorrido hasta un cupo midió 1.468 ms». **No se reproduce**: la muestra vieja no declara escenario ni cantidad de corridas, y con este instrumento el mismo recorrido da 1163 ms de mediana en el corte actual y 1691 en el anterior |
| D-2 | El daily adjudica al PR #583 que cuatro toques produzcan una sola navegación. **Ya se cumplía en `b7785e36`**: no es un delta de #583 |

El delta visual que **sí** corresponde al carril de Directorio está en `02` y `05`: la acción
«Revisar disponibilidad» aparece en la tarjeta de resultado del corte actual y no existe en el
anterior. Esta es la **única** atribución del documento, y se apoya en que el commit `4c9e419f`,
dentro del PR #583, se titula literalmente «fix: mostrar disponibilidad en tarjetas de directorio».

## A medias

- **H1.S2.M5 — publicar la tabla a Ender.**
  1. *Qué anda:* la tabla está completa, con 10 muestras por corte y escenario, y es reproducible.
  2. *Qué no anda:* la fila del daily de equipo sigue diciendo `A MEDIAS` hasta que se mergee.
  3. *Qué falta:* que se mergee el PR de `AlovidaPromptManager` que la publica; el daily vive en
     ese repositorio y este PR no puede tocarlo.
  4. *Dónde quedó:* rama `justin/cerrar-baseline-comparable-reserva-2026-09-24` de PromptManager.
     El código de este repositorio compila y pasa lint y typecheck.

## Pendiente

| Qué | Estado | Qué falta para cerrarlo |
|---|---|---|
| Atribuir la mejora de tiempo a un cambio concreto | `A MEDIAS` | Un tercer corte con el Directorio nuevo y la latencia vieja. No se hizo: por eso no se afirma la atribución |
| Que el camino por defecto del Directorio llegue a un cupo (P-1) | `DECISION_REQUIRED` | Decisión de producto: si un paciente que entra a Cardiología debe caer primero en médicos sin agenda |
| Las tres cifras del listado (P-3) | seguimiento | Dueño del listado. No se inventa la causa |
| El rojo de `insurance-analytics` bajo carga | seguimiento | Es un `Test timed out in 5000ms` con dos servidores de desarrollo corriendo; aislado pasa 10/10 |

## No cubierto

- **No se ejecutaron `yarn lint` ni `yarn test` completos en este trabajo.** El lint global (243
  avisos de `prefer-on-push-component-change-detection`) y la suite total están medidos y clasificados
  en el reporte de gates del 2026-09-23; repetirlos acá no agregaba información, y este cambio no
  toca `src/`.
- **No se tocó código de producto.** El diff son dos cosas: un spec de Playwright nuevo y la carpeta
  de evidencia. Ninguna ruta, componente, contrato ni fixture cambió.
- **No se re-capturó contra `4c9e419f`.** La decisión fue declarar el SHA real y no adjudicar nada al
  PR #583, en vez de fabricar una comparación de un solo PR que la evidencia no sostiene.
- **No hay validación remota.** Todo es local, contra dos `ng serve` en `4200` y `4210`.
- **No se afirma integración con API real.** El backend de las dos corridas es el simulador en memoria.

## Cómo reproducirlo

```bash
# corte anterior, en su propio worktree
git worktree add ../antes b7785e36
cd ../antes && corepack yarn dev --port 4210

# corte actual
corepack yarn dev --port 4200

# una muestra de los dos escenarios, por corte
BASELINE_CORTE=despues E2E_BASE_URL=http://localhost:4200 \
  corepack yarn exec playwright test playwright/baseline-comparable-reserva.spec.ts --workers=1
BASELINE_CORTE=antes E2E_BASE_URL=http://localhost:4210 \
  corepack yarn exec playwright test playwright/baseline-comparable-reserva.spec.ts --workers=1
```

Cada corrida escribe `medicion.json` y `medicion-sin-horarios.json` en `evidencia/<corte>/` y
sobrescribe las capturas. Esas dos mediciones sueltas **no se versionan**: hay un
`evidencia/.gitignore` que las deja fuera, justamente para que seguir estas instrucciones no
reintroduzca la corrida única que este reporte se prohíbe publicar. Lo que se publica son las 10
muestras de cada escenario y el `resumen.json`.

## Evidencia

```text
$ corepack yarn typecheck
exit 0

$ npx eslint playwright/baseline-comparable-reserva.spec.ts
exit 0

$ corepack yarn test --watch=false   (los 4 archivos rojos del reporte de gates, en b7785e36)
 Test Files  4 passed (4)
      Tests  137 passed (137)

$ corepack yarn test --watch=false   (los mismos 4, en a43ad2b3)
 Test Files  1 failed | 3 passed (4)
      Tests  1 failed | 141 passed (142)
 FAIL  insurance-analytics.spec.ts > el tablero no tiene violaciones mecánicas de accesibilidad
 Error: Test timed out in 5000ms.

$ corepack yarn test --watch=false --include=.../insurance-analytics.spec.ts   (aislado, a43ad2b3)
 Test Files  1 passed (1)
      Tests  10 passed (10)

$ BASELINE_CORTE=despues E2E_BASE_URL=http://localhost:4200 \
    corepack yarn exec playwright test playwright/baseline-comparable-reserva.spec.ts --workers=1
 2 passed
```

- Agregado de las 40 muestras: [`evidencia/resumen.json`](evidencia/resumen.json).
- Revisión de capturas, dos pasadas: [`evidencia/doble-revision.md`](evidencia/doble-revision.md).
- Estado del PR: [`evidencia/pr-mergeable.txt`](evidencia/pr-mergeable.txt).
