# ADR-0022: El recorrido guiado narra con plantillas sobre los registros; cada frase se rastrea a un registro y lo inferido se dice como tal

## Estado

**Propuesto** — 2026-11-06, Franja 4 de la red clínica del paciente
(`docs/trabajo/2026-11-06-red-clinica-paciente/`). Pendiente de revisión: quien lo implementó no lo aprueba.
Convive con el ADR de la red por episodios de la Franja 2 (número anterior a este).

## Contexto

El «Recorrido» del expediente del médico pasa a ser una red por episodios, y se le suma un **recorrido guiado**: anterior /
reproducir-pausa / siguiente, que revela la historia en orden cronológico con una narración en español clínico («El 3 feb
2026 consultó en Medicina general por cefalea de dos semanas. Se planteó migraña como diagnóstico presuntivo…»).

Una narración clínica que inventa es peor que no tenerla: quien diagnostica la va a leer como hecho. Hacía falta fijar qué
puede decir y qué no.

## Decisión

1. **Sin IA.** La narración sale de plantillas en `recorrido-guiado.model.ts`, funciones puras sobre los tipos de
   `core/data-access/`. Mismos datos ⇒ mismo texto.
2. **Cada frase se rastrea.** `FraseDelPaso.fuentes` lleva los ids reales de los registros que la sostienen; una frase sin
   fuente no se escribe. Las pruebas comprueban que toda fuente existe en la entrada.
3. **Vínculo real ⇒ causa; vínculo inferido ⇒ coincidencia.** Sólo los campos del contrato se narran como causa:
   `reasonConditionId` («para confirmar o descartar migraña»), `indicationConditionId` («para tratar»),
   `replacedByConditionId` («en su lugar se confirmó»), `followUpOf` («vuelve a la cita del…»), `targetEncounterId`
   («llegó por la derivación del…»), `replacedByRequestId`/`replacesRequestId` («reemplaza a…»), `basedOn` de la
   verificación («con base en el resultado de…»). Dos registros que sólo comparten atención se dicen «en la misma
   atención» y la frase queda `inferida: true`. Lo que sólo comparte el día se dice «Ese mismo día».
4. **El estado se narra en su momento.** Una orden pedida antes de la decisión sobre su diagnóstico es «para confirmar o
   descartar»; pedida después de confirmarlo, «para el seguimiento». Un diagnóstico decidido otro día tiene dos pasos (se
   planteó / se descartó); decidido el mismo día, una frase.
5. **Faltar se dice.** «No se registró el motivo», «la orden no indica para qué diagnóstico», «un diagnóstico sin nombre
   disponible», «otro diagnóstico, que no está en esta lectura». Nunca se rellena con algo parecido.
6. **Ningún identificador llega al texto.** Una etiqueta que devuelve un uuid o un código de catálogo se trata como
   desconocida, y una última pasada borra cualquier uuid que venga dentro de un texto libre. Tampoco se narra el número de
   caso quirúrgico.
7. **Agrupado por día UTC**, con el mismo criterio que `fechaClinica` (`account/medical-record/history-view-model.ts`):
   lo creado en una atención toma la fecha de la atención; lo demás, la suya. Dentro del día, la hora de la atención ordena
   y, a igual hora, el orden de razonamiento (llega, reconsulta, se atiende, se diagnostica, resultado, decisión, se pide, se
   trata, se deriva). Lo sin fecha va al final, en un paso que lo dice.
8. **El control no reproduce solo con `prefers-reduced-motion: reduce`**: «Reproducir» queda deshabilitado y lo explica;
   se avanza a mano. Cualquier interacción con la red (`interaccionEnLaRed`) pausa.

## Consecuencias

- Agregar un tipo de registro al recorrido es agregar una plantilla con sus fuentes y su prueba, no reescribir texto.
- La narración es tan buena como los vínculos del contrato: donde falta un vínculo, el recorrido lo dice en vez de
  suponerlo. Es intencional.
- Las etiquetas de concepto las resuelve quien monta el control (`LectorDelRecorrido`); el modelo no pide terminología.
