# Franja 2 — La red clínica por episodios (vista «Recorrido»)

> Quien implementa no aprueba (`NO_SELF_APPROVAL`): esto describe lo hecho y lo
> medido; la aprobación es de la revisión independiente.

## Qué cambió

La vista «Recorrido» (`patient-chart/recorrido-clinico/`) pasó de «un carril
por tipo × una columna por atención, con dos clases de línea» a una **red
clínica por episodios**:

- Tiempo en horizontal, alineado entre hilos; **un hilo por episodio** y al
  final «Atenciones sin diagnóstico asociado».
- **Divulgación por niveles**. Nivel 1, todo plegado: franja-resumen con
  nombre, estado, rango de fechas, conteos e hitos sobre el eje. Nivel 2, al
  desplegar: los registros del episodio con sus vínculos. Nivel 3: el
  detalle (observaciones, notas, planes, documentos) tras un «+N» por momento.
  «Expandir todo» / «Contraer todo». Estado en señales (`desplegados`,
  `abiertos`). Al desplegar un episodio, el lienzo va a su primer momento.
- **Descartados plegados por defecto**: marcador compacto «Descartado · X»
  (`aria-expanded=false`) que se abre en el mismo botón; abierto, la tarjeta
  (nombre tachado) y un control «Ocultar el descartado» (`aria-expanded=true`).
- **Vínculos reales**: línea sólida con flecha y su motivo en la leyenda (la
  leyenda lista sólo los motivos presentes). El vínculo «se registró en esa
  atención» es el tronco de siempre. **Inferidos**: punteado en otro tono, la
  palabra «inferido» sobre la línea, en la leyenda y en el nombre accesible.
- Clic en un registro: abre el mismo detalle que antes (`abrir`) y emite
  `elegido`.
- Sin sugerencias de diagnóstico. Tabla y Secciones sin cambios.

## La regla de episodios

En `docs/adr/ADR-0021-red-clinica-por-episodios.md`. Resumen:

1. Cadena de diagnósticos: mismo concepto, o descartado → `replacedByConditionId`.
2. Vínculos fuertes (arrastran al registro al episodio de su diagnóstico):
   `indicationConditionId`, `reasonConditionId`, informe → su orden,
   `replacedByRequestId` (los dos sentidos), `conditionId` del plan,
   `verification.basedOn`.
3. **Una atención que toca dos episodios se dibuja una vez**, en el que tiene
   más registros suyos (empate: el que empezó antes; luego el id). Su tronco
   llega a los registros de los otros hilos, que la cuentan como compartida;
   el nodo lleva una marca con «También en: …» (título y nombre accesible).
4. Lo que sólo cuelga de una atención va donde se dibuja la atención. La
   atención de destino (`targetEncounterId`), las reconsultas (`followUpOf`) y
   la internación (`episodeId` de sus atenciones) siguen a su origen.
5. Lo demás, al hilo «Atenciones sin diagnóstico asociado».

Inferidos: estudio sin `reasonConditionId` pedido en una atención con
**exactamente un** presuntivo; cita sin vínculo y **una sola** atención el
mismo día (nunca canceladas, rechazadas ni ausentes).

## Arquitectura

| Archivo | Qué |
|---|---|
| `recorrido-clinico/red-clinica.model.ts` | Entrada propia (`RegistroDeLaRed`, `VinculoDeLaRed`), `inferirVinculos`, `agruparEnEpisodios`, `relacionesDe`. Puro. |
| `recorrido-clinico/red-clinica.geometria.ts` | `ubicarRed`: columnas anchas/angostas, hilos, canal por hilo, carriles por pasillo, troncos y enlaces. Puro. |
| `recorrido-clinico/red-clinica.adaptador.ts` | `construirRed`: de los tipos de `core/data-access` (recortados con `Pick`, ya con los campos de la Franja 1) a la red. |
| `recorrido-clinico/recorrido-clinico.{ts,html,css}` | El componente (mismo selector). SVG propio, sin librerías nuevas. |
| `recorrido-clinico/recorrido-clinico.model.ts` | Queda lo compartido con la tabla: tipos del filtro, `describirIntervalo`, `conectadosA` (ahora respeta la `clave` de la arista). La geometría de carriles se eliminó. |
| `recorrido-clinico/historial-del-expediente.ts` | Queda lo de la tabla; `aristasDelHistorial` lo reemplaza el adaptador. |
| `patient-chart.ts/html` | Al entrar a «Recorrido» lee citas (`SchedulingClient.searchBookings`, `includeCancelled`), derivaciones (`ReferralsClient.listByPatient`), estudios (`DiagnosticsClient.getPatientDiagnostics`) y procedimientos (`ProceduresClient.listDentalProcedures` + catálogo), cada uno con su `ViewState`. Mientras leen: aviso `role=status`. Si alguno falla: `app-alert` «El recorrido está incompleto» con qué falta, «Reintentar» y el id de petición (S9); la red se dibuja con lo que hay. El filtro por tipo pasa a la red como `visibles`. |

## Puntos de extensión para la Franja 3

En `RecorridoClinico` (`recorrido-clinico.ts`):

- `elegido = output<NodoElegido>()` → `{ id, clase, episodio }`. `id` es el
  **id real del registro** (condition, encounter, service request, report,
  referral, booking, medication request, observation, note, care plan,
  care episode, document, dental procedure).
- `resaltados = input<readonly string[]>([])` — ids reales a resaltar
  (alertas): contorno en el nodo, filete en el hilo, «resaltado» en el nombre
  accesible. Vacío: sin efecto.
- `visibles = input<readonly string[]>([])` — ids reales a dibujar (filtro).
  Vacío: todos. Los episodios se arman con todo: filtrar no deshace
  problemas. `patient-chart` ya lo usa para el filtro por tipo; la Franja 3
  debería intersecar su filtro con ése.

Sólo los controles llevan id propio (`grupo:<episodio>|<columna>`,
`plegar:<id>`) y nunca salen por `elegido`.

## Decisiones que conviene revisar

- **Columnas angostas** (76 px) donde ningún hilo desplegado tiene
  registros. Con la historia de demostración (47 momentos en 18 meses) la red
  plegada igual no entra en 1440 px: abre por el final; al desplegar un
  episodio el lienzo va a su primer momento.
- **Canal por hilo**: los enlaces entre columnas no contiguas cruzan por una
  banda sin tarjetas bajo la cabecera del hilo de destino. Con el episodio
  tiroideo desplegado el canal lleva muchas líneas paralelas: legible pero
  denso (ver `1440-*-1b-un-episodio.png`).
- **Inferido nunca por el tronco** (quedaría tapado por las ramas reales).
- **Hitos plegados**: rombo lleno confirmado, rombo hueco presuntivo, rombo
  discontinuo descartado, punto atención o cita. Nunca sólo el color.
- **Arranca todo plegado** (nivel 1).

## Comandos y resultados

Corridos desde el clon de trabajo, con el candado `ng-test.lock`.

| Comando | Resultado |
|---|---|
| `corepack yarn ng test --watch=false --include='src/app/features/clinical-record/patient-chart/**/*.spec.ts'` | 43 archivos, **817 pruebas en verde** (una corrida previa con la máquina cargada dio timeouts en specs ajenos y en las historias generadas: éstas llevan ahora un tope de 30 s) |
| `corepack yarn typecheck` | EXIT 0 |
| `corepack yarn lint` | EXIT 0 |
| `corepack yarn build` (con la Franja 1 integrada) | EXIT 0, sin errores. Aviso de presupuesto: `recorrido-clinico.css` 12,3 kB contra 4 kB (el CSS anterior también lo excedía). |
| `corepack yarn vitest run` de los specs puros (`red-clinica.*.spec.ts`) | 81 pruebas en verde, incluidas 16 historias generadas contra las reglas del trazado |

Pruebas que se reemplazaron (`NO_TEST_WEAKENING`): las de `ubicarRecorrido`
(carriles por tipo) y `aristasDelHistorial` se eliminaron con esas funciones;
sus promesas —nodos sin superposición, líneas de borde a borde que no
comparten tramo, no pasan por otra tarjeta ni pisan otra punta, grupos «+N»
que reciben las líneas de sus ocultos, pasillo que se ensancha, receta hacia
atrás, sin fecha al final, plano vacío, día con atención oculta, sólo
vínculos con los dos extremos, nada desde un motivo escrito a mano— se exigen
ahora en `red-clinica.geometria.spec.ts` y `red-clinica.adaptador.spec.ts`.
En `patient-chart.spec.ts` la prueba de las aristas pasó a `vinculosDeLaRed`
(motivo `registrado-en`) y la de nodos despliega antes de contar (la red abre
plegada, a propósito); se agregó una prueba de las lecturas nuevas y de su
aviso de falla.

## Evidencia de navegador

`ng serve --configuration development,demo --port 4310` desde el clon,
medica@alovida.mock, expediente de `pid-paciente` con la historia de la
Franja 1, vista «Recorrido». Chromium headless, deviceScaleFactor 2, sin
`networkidle`. Mediciones crudas en `mediciones.md`.

| Captura | Qué muestra |
|---|---|
| `{1440,768,390}-{claro,oscuro}-1-plegado.png` | Nivel 1: 7 episodios plegados con hitos |
| `{1440,768}-{claro,oscuro}-1b-un-episodio.png` | Hipotiroidismo desplegado; el lienzo saltó a su inicio (scrollLeft 2216 → 13) |
| `{1440,768,390}-{claro,oscuro}-2-desplegado.png` | «Expandir todo»: 82 nodos, 79 líneas, 6 inferidos |
| `1440-{claro,oscuro}-2b-desplegado-inicio.png` | Todo desplegado, desde «Lo más antiguo» |
| `1440-{claro,oscuro}-3-descartado-abierto.png` | Anemia ferropénica abierta, con «Ocultar el descartado» |
| `1440-{claro,oscuro}-4-inferido.png` | Vínculo inferido con su etiqueta |
| `1440-{claro,oscuro}-5-camino.png` | Foco de teclado en una receta: 18 líneas iluminadas, el resto atenuado |
| `1440-claro-6-teclado.png` | Enter en un episodio (`aria-expanded=true`), Tab al primer registro |
| `390-{claro,oscuro}-3-vertical-episodio.png` | Bajo 650 px: lista por episodio, vínculos en texto |

Medido: sin desborde horizontal de página en 1440, 768 y 390; sin errores de
página ni de consola; con `reducedMotion: 'reduce'` la transición del chevron
queda en ~0 s; al cargar, el lienzo abre al final (scrollLeft = máximo).

## Lo que NO se ejecutó o queda pendiente

- 1024×768 y 1920×1080 no se capturaron (se pidieron 1440, 768 y 390).
- Los datos de demostración no traen un estudio sin `reasonConditionId` junto
  a un presuntivo único, así que el inferido «misma atención» sólo está
  probado en Vitest; en pantalla se ven los «mismo día» (cita → atención).
- `replacedByRequestId`: la red lo lee si viene en el resumen; la API todavía
  no lo publica (lo agrega el coordinador). En el simulador sí viene.
- Revisión visual independiente, `visual-reviewer` y puntuación del
  `visual-quality-gate`: no ejecutados (no me autoapruebo).
- Presupuesto de CSS del componente excedido (12,3 kB / 4 kB).
