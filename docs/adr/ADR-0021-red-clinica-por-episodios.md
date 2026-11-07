# ADR-0021: El «Recorrido» del expediente es una red clínica por episodios

## Estado

**Aceptado** — Franja 2 de la red clínica del paciente (2026-11-06). Las
decisiones de producto las cerró el usuario; este ADR fija la **regla de
agrupación**, que es lo que la interfaz no puede decidir sola.

## Contexto

El «Recorrido» dibujaba un carril por tipo de registro (atenciones,
observaciones, diagnósticos…) y una columna por atención, con dos clases de
línea (`encounterId` e `indicationConditionId`). Respondía «qué se registró
en cada consulta», pero no «qué le pasó a la persona, problema por
problema»: una hipertensión y un reflujo compartían carriles, y para seguir
un problema había que saltar entre ellos.

La Franja 1 agrega al contrato los vínculos que faltaban
(`reasonConditionId`, `targetEncounterId`, `replacedByConditionId`; ver
`CONTRATO-RED-CLINICA.md`). Con ellos se puede agrupar por problema.

## Decisión

Un **hilo por episodio clínico**, con el tiempo en horizontal y alineado
entre hilos. Un episodio es un problema clínico. La asignación es una función
pura (`agruparEnEpisodios`, en `recorrido-clinico/red-clinica.model.ts`) con
esta regla:

1. **Cadenas de diagnósticos.** Dos diagnósticos son el mismo problema si
   comparten concepto (el mismo diagnóstico registrado otra vez; el
   presuntivo que se confirma es el mismo registro) o si uno descartado
   apunta al otro por `replacedByConditionId`. El id del episodio es el del
   diagnóstico más antiguo de la cadena: no cambia cuando el problema suma
   uno nuevo.
2. **Vínculos fuertes** — arrastran al registro al episodio de su
   diagnóstico, aunque se haya registrado en otra atención: receta
   (`indicationConditionId`), estudio (`reasonConditionId`), resultado
   (`serviceRequestId` → su estudio), receta que reemplaza a otra
   (`replacedByRequestId`, en los dos sentidos), plan (`conditionId`) y la
   evidencia de una confirmación o descarte (`verification.basedOn`).
3. **Atenciones.** Una atención pertenece a todos los episodios de lo que se
   registró en ella (o de la evidencia que aportó). **Se dibuja una sola vez**,
   en el episodio con más registros suyos; empate: el que empezó antes;
   empate: el id. Desde ahí su tronco llega a los registros que viven en los
   otros hilos, y el resumen de cada uno de esos episodios la cuenta como
   **compartida**. El nodo lleva una marca «También en: …» y lo dice en su
   nombre accesible.
4. **Lo que sólo cuelga de una atención** —observaciones, notas, documentos,
   derivaciones (`sourceEncounterId`), estudios sin motivo— va al episodio
   donde se dibuja esa atención. La atención de destino de una derivación
   (`targetEncounterId`), las reconsultas (`followUpOf`, a la cita origen o, si
   no llegó, a su atención) y la internación (`episodeId` de sus atenciones)
   siguen a su origen si no tienen episodio propio.
5. Lo que no cuelga de ningún diagnóstico va al hilo **«Atenciones sin
   diagnóstico asociado»**, siempre el último.

Los episodios se ordenan por fecha de inicio.

### Vínculos inferidos

Dos, y siempre marcados (línea punteada en otro tono, la palabra «inferido»
sobre la línea, en la leyenda y en el nombre accesible del nodo):

- `inferido-misma-atencion`: un estudio sin `reasonConditionId` pedido en una
  atención donde se registró **exactamente un** presuntivo. Con dos, no se
  infiere nada.
- `inferido-mismo-dia`: una cita sin vínculo guardado y **una sola** atención
  el mismo día; nunca para citas canceladas, rechazadas o ausentes. La cita
  se ubica en la columna de esa atención (es la misma visita).

Un inferido nunca reemplaza a un vínculo real ni se dibuja por el tronco de
la atención (ahí quedaría tapado por los reales).

### Divulgación progresiva

- **Nivel 1**: todo plegado; cada episodio es una franja con nombre (el
  diagnóstico vigente más reciente), estado, rango de fechas, conteos e
  hitos sobre el eje (rombo lleno: confirmado; hueco: presuntivo; tachado:
  descartado). Las columnas sin nada desplegado son angostas (76 px en
  vez de 248): la historia plegada ocupa una fracción del ancho. Con la
  historia de demostración (47 momentos en 18 meses) igual no entra en una
  pantalla de 1440 px: abre por el final y se desplaza.
- **Nivel 2**: el episodio desplegado muestra sus registros en sus columnas.
- **Nivel 3**: observaciones, notas, planes y documentos de cada momento
  van tras un «+N»; los diagnósticos descartados, en un marcador compacto que
  se abre.

## Consecuencias

- La geometría (`red-clinica.geometria.ts`) reemplaza a la de carriles por
  tipo. Sus reglas —líneas que no pisan tarjetas, que no comparten tramo, que
  no caen sobre la punta de otra flecha— se prueban igual que antes, ahora
  también sobre historias generadas.
- El filtro por tipo del expediente se aplica a la red como `visibles`: los
  episodios se arman con todo; ocultar los diagnósticos deja de dibujarlos,
  no deshace los problemas.
- La red lee además citas, derivaciones, estudios y procedimientos con los
  servicios existentes, al entrar a la vista. Cada lectura falla por su
  cuenta y la pantalla dice cuál falta, con reintento e id de petición.
- Puntos de extensión para la Franja 3 (panel de detalle, filtros, alertas):
  `elegido` (output con el id real del registro), `resaltados` y `visibles`
  (inputs de ids reales; vacíos, sin efecto).
- Sin sugerencias de diagnóstico: la red sólo dibuja lo registrado y lo
  inferido marcado.

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Componentes conexos del grafo completo | Una atención con dos problemas los fundiría en uno: la atención es una articulación, no un pegamento |
| Duplicar la atención compartida en cada hilo | Dos nodos para un mismo registro; el foco y el camino iluminado se vuelven ambiguos |
| Inferir episodios por cercanía temporal | Es una afirmación clínica que el contrato no respalda |
| Librería de grafos (dagre, elk) | Disposición jerárquica, no temporal; el eje del tiempo alineado entre hilos y el canal por hilo son propios |
