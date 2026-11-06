# Franja 4 — Recorrido guiado de la red clínica

Rama `worktree-agent-aaf17dadbc3d1baa0`, worktree
`/home/user/mantra-core-health/.claude/worktrees/agent-aaf17dadbc3d1baa0`, basada en
`claude/charming-cerf-q7sgmk` (75b8378f) con la Franja 1 mergeada (525d4d322).
Quien lo implementó **no lo aprueba**: falta revisión independiente.

## Qué hay

| Archivo (bajo `src/app/features/`) | Qué es |
|---|---|
| `clinical-record/patient-chart/recorrido-guiado/recorrido-guiado.model.ts` | `armarRecorridoGuiado`, `seguirEpisodio`; re-exporta tipos y `fechaCorta`/`diaUtc`/`legible`/`enumerar` |
| `…/recorrido-guiado.types.ts` | Contrato de entrada y salida |
| `…/recorrido-guiado.texto.ts` | Fechas UTC y barreras de texto (sin uuid ni códigos de catálogo) |
| `…/recorrido-guiado.sucesos.ts` | Suceso, índices, nombres legibles, veredicto |
| `…/recorrido-guiado.sucesos-clinicos.ts` | Plantillas: internación, atención, diagnóstico y verificación, orden, informe, receta |
| `…/recorrido-guiado.sucesos-de-circuito.ts` | Plantillas: derivación (emisión, llegada, rechazo, contrarreferencia), citas y reconsultas, procedimientos |
| `…/recorrido-guiado.ts/.html/.css` | `app-recorrido-guiado`, el control |
| `…/recorrido-guiado.model.spec.ts`, `…/recorrido-guiado.spec.ts` | Pruebas del modelo y del control |
| `component-stock/scenarios/recorrido-guiado.scenarios.ts`, `recorrido-guiado.simulador.ts`, línea en `scenarios.ts` | Escenarios del stock: historia, episodio, vacío, simulador |
| `docs/adr/ADR-0022-narracion-del-recorrido-guiado.md` | Reglas de narración |

**ADR 0022.** El primer número libre era 0021 (lo toma la Franja 2); éste es el siguiente. `docs/adr/index.md` no se
tocó para no chocar con la Franja 2: falta sumar la fila al integrar.

## Contrato para integrar (Franja 2)

```ts
import { armarRecorridoGuiado } from './recorrido-guiado/recorrido-guiado.model';
import { RecorridoGuiado, type PasoActualDelRecorrido } from './recorrido-guiado/recorrido-guiado';

const pasos = armarRecorridoGuiado(
  // RegistrosDelRecorrido: todo opcional, tipos de core/data-access tal cual
  { atenciones, citas, derivaciones, diagnosticos, ordenes, informes, recetas, internaciones, procedimientos },
  // LectorDelRecorrido
  {
    etiqueta: (conceptId) => etiquetas.get(conceptId)?.display, // TerminologyClient.readConceptLabels
    codigo: (conceptId) => etiquetas.get(conceptId)?.code,       // veredicto cuando no hay decisión de C3
    servicioDeAtencion: (encounter) => undefined,                // opcional: «Medicina general»
    profesional: (profileId) => undefined,                       // opcional
  },
  ahora, // opcional (default new Date()): «tiene» / «tenía agendada»
);
```

```html
<app-recorrido-guiado
  [pasos]="pasos()"
  [episodio]="idsDelEpisodio()"
  [nombreDelEpisodio]="'Hipotiroidismo'"
  [interaccionEnLaRed]="nodoElegido()"
  (pasoActual)="alPaso($event)"
/>
```

- `episodio`: `readonly string[] | null`, opcional; recorre sólo los pasos que tocan esos ids.
- `interaccionEnLaRed`: cualquier valor; **cada cambio pausa** la reproducción.
- `PasoDelRecorrido`: `clave` (día UTC `AAAA-MM-DD` o `sin-fecha`), `fecha`, `fechaTexto`, `titulo`, `narracion`,
  `frases[]` (`texto`, `fuentes` = ids reales, `inferida`), `enfocar[]`, `revelados[]` (acumulado).
- `pasoActual` emite `{ indice, total, paso, enfocar, revelados }` al montar y en cada cambio.
- Los ids son los ids reales de los registros (encounter, condition, service request, diagnostic report,
  medication request, referral, booking, care episode, surgical case): los mismos que la red usa como nodo.
- Método público `pausar()`.

## Decisiones

- **Agrupado por día UTC** (el criterio de `fechaClinica`, replicado porque no se exporta). Lo creado en una
  atención toma la fecha de la atención; decisiones, resultados, altas y llegadas, la suya.
- **Vínculo real = causa; coincidencia = coincidencia.** Sólo los campos del contrato se narran como «para…», «en su
  lugar…», «vuelve a la cita del…», «llegó por la derivación del…». Compartir atención sin campo se dice «en la misma
  atención» (`inferida: true`); compartir sólo el día, «Ese mismo día».
- **El estado se narra en su momento**: una orden pedida antes de decidir su diagnóstico es «para confirmar o
  descartar»; después de confirmarlo, «para el seguimiento».
- **Sin concordancias adivinadas**: «Se registró X como diagnóstico confirmado», «(orden del …)», «Reemplaza a la
  receta de X del …»; los nombres del catálogo no traen género.
- Una cita común el mismo día que una atención se calla (es la misma visita); varias iguales se cuentan
  («tenía tres citas de Teleconsulta»).
- `reasonConditionId`, `replacedByConditionId` y `targetEncounterId` se leen de los tipos reales de la Franja 1.
  `replacedByRequestId`/`replacesRequestId` siguen con acceso tolerante: `MedicationRequest` todavía no los declara.
- Sin reproducción automática con `prefers-reduced-motion: reduce`: «Reproducir» deshabilitado y explicado.
- Por debajo de 650 px **del componente** (container query; `--bp-sm`) la barra se pega abajo, los botones quedan con
  ícono (el nombre sigue para lectores) y la velocidad baja a su propia fila.
- La evidencia está en el **stock de componentes**
  (`/design-system/stock/features/clinical-record/patient-chart/recorrido-guiado/recorrido-guiado`, que sólo existe
  con `mockBackend`). Se retira sin rastro borrando `recorrido-guiado.scenarios.ts`, `recorrido-guiado.simulador.ts`
  y su línea en `scenarios.ts`.

## Comandos (06/11/2026, con `ng-test.lock`)

| Comando | Resultado |
|---|---|
| `corepack yarn ng test --watch=false --include='…/recorrido-guiado/**/*.spec.ts' --include='src/app/features/component-stock/**/*.spec.ts'` | 3 archivos, **106/106** en verde |
| `corepack yarn lint` | rc 0 (repo completo, antes de los dos últimos commits); `eslint` sobre los archivos tocados después: rc 0 |
| `corepack yarn typecheck` | rc 0 |
| `corepack yarn build` | rc 0; el único aviso de presupuesto es de `recorrido-clinico.css` (no es de esta franja) |
| `node scripts/check-max-lines.mjs`, `check-css-tokens`, `check-colores-sueltos`, `check-usted`, `check-english-identifiers` | sin hallazgos en los archivos de esta franja |

## Evidencia de navegador

`ng serve --configuration development,demo --port 4330` propio, con `navegador.lock`; Playwright, `deviceScaleFactor: 2`,
página a 1440 px, tema por `localStorage` (`mantra-core-health.theme`) y `colorScheme`. El stock monta el componente
dentro de un iframe del tamaño del dispositivo: ese iframe es el viewport real del componente. Registro con las
mediciones y la narración de cada paso: `registro-capturas.txt` (29 aserciones `ok`, 0 fallas, 0 errores de consola).

| Captura | Qué muestra |
|---|---|
| `1280-{claro,oscuro}-paso1.png`, `…-paso3-con-red.png`, `…-paso5.png` | Marco Portátil: pasos 1, 3 (con la red de demostración: enfocados y revelados) y 5 |
| `390-{claro,oscuro}-paso1.png`, `…-paso3-con-red.png`, `…-paso5.png`, `…-marco-completo.png` | Marco Móvil 390×844: barra compacta pegada abajo, sin desborde |
| `1280-claro-teclado-foco.png` | Foco visible tras `←` |
| `1280-claro-reproduciendo.png` | «Pausar» tras avanzar solo un paso (velocidad rápida, 4 s) |
| `1280-claro-episodio.png`, `1280-claro-vacio.png` | Siguiendo un episodio («Siguiendo: Sinusitis aguda», 2 pasos); vacío |
| `1280-claro-movimiento-reducido.png` | `reducedMotion: 'reduce'`: «Reproducir» deshabilitado y el aviso |
| `1280-claro-simulador-paso{1,3,18,34}.png`, `390-oscuro-simulador-paso{1,3,18,34}.png` | Historia de `pid-paciente` de la Franja 1 leída por los clientes reales con la sesión de medica@alovida.mock: 34 pasos |

Comprobado en el navegador: sin desborde horizontal (1130/1130 y 388/388), siguiente/anterior, salto por la línea de
progreso, flecha izquierda, reproducción real de un paso, pausa al tocar la red, episodio, movimiento reducido, y que
ninguna de las 34 narraciones del simulador muestra un uuid ni `undefined`/`null`/`NaN`.

Sin sesión, la variante del simulador recibe 403 «No tiene cita hoy ni vínculo vigente con esta persona»: autoriza
la API; con la sesión de la médica se lee todo.

## Lo que NO se ejecutó / pendientes

- No está montado en el expediente: lo integra la Franja 2 o el coordinador. La evidencia es del stock.
- No hay capturas con el componente a 1440 px: el stock ofrece marcos de 1280 (Portátil) y 390 (Móvil).
- Ni `yarn test` completo (4985 pruebas) ni `yarn pw`: sólo las suites tocadas.
- `servicioDeAtencion` no se resolvió en la variante del simulador: las atenciones dicen «Tuvo una atención
  (ambulatorio)». Al integrar conviene pasar el servicio o la especialidad si el expediente los tiene.
- Dato de la Franja 1: las tres recetas de levotiroxina usan el concepto «Levotiroxina 50 mcg comprimidos» con dosis
  25/50/75 mcg, y la narración lo repite tal cual.
- La narración no combina diagnósticos en una frase («Se plantearon X e Y…»): una frase por diagnóstico.
- En tema oscuro el segmento actual y los revelados de la línea de progreso tienen tonos parecidos; el actual se
  distingue por el grosor y por `aria-current`. Revisión visual pendiente.
