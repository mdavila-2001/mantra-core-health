# Defectos reportados durante el turno

> Regla 50: un defecto se reporta **apenas aparece**, no al cierre. Regla 80.4.2: se **reproduce**
> antes de clasificarlo. Regla del reparto: **quien lo encuentra no lo arregla** si el archivo es
> de otro.
>
> Turno: línea B (Marcelo), noche del 2026-09-20 · corte `68dcb562`.

---

## ~~D-01 · El selector de «qué se midió» ofrece estados administrativos~~ — **RETIRADO**

> [!important] Este defecto **no existe**. Lo reporté mal y el navegador lo desmintió.
>
> **Qué afirmé:** que `clinical.observations.code_concept_id` no tenía patrón en la tabla `ENUMS`
> del simulador y caía al fallback `VS_RECORD_STATUS`, así que el desplegable ofrecería
> «Activo, Inactivo, Pendiente…».
>
> **Qué es verdad:** los cuatro mapeos **existen**, en `misc.handlers.ts`, filas 55-58 de `ENUMS`
> — exactamente los cuatro que yo «proponía agregar»:
>
> ```ts
> [/observations\.code_concept_id/, 'VS_OBSERVATION_CODE', 'Medición'],
> [/observations\.quantity_unit_concept_id/, 'VS_OBSERVATION_UNIT', 'Unidad'],
> [/observations\.category_concept_id/, 'VS_OBSERVATION_CATEGORY', 'Categoría'],
> [/observations\.interpretation_concept_id/, 'VS_OBSERVATION_INTERPRETATION', 'Interpretación'],
> ```
>
> **Cómo se destapó:** la corrida de Playwright imprimió lo que el desplegable ofrece de verdad:
>
> ```
> OPCIONES DE CABECERA OFRECIDAS: ["Elegí qué medir"," Presión arterial sistólica ",
>  " Presión arterial diastólica "," Frecuencia cardíaca "," Temperatura corporal "," Peso ",
>  " Talla "," Índice de masa corporal "," Glucemia en ayunas "," Saturación de oxígeno ",
>  " Hemoglobina glicosilada "]
> ```
>
> **El error de método:** clasifiqué a partir de un `grep` que volvió vacío, sin ejecutar nada. La
> regla 80.4.2 pide **reproducir antes de clasificar** y no lo hice. Un `grep` que no encuentra algo
> demuestra que mi patrón no casó, **no** que la cosa no esté. Queda acá en vez de borrarse, porque
> un defecto retirado en silencio es indistinguible de uno que nunca se revisó.
>
> **Nada que hacer. No se le pidió nada a Ender por esto.**

<details>
<summary>El reporte original, conservado para que se pueda auditar el error</summary>

| Campo | Valor |
|---|---|
| **Dueño** | **Ender** — `src/app/core/mock/handlers/misc.handlers.ts` es suyo |
| **Clase** | `PRODUCT_BUG` (en la maqueta) — **equivocada** |
| **Encontrado** | 2026-09-21, haciendo el discovery de C-14 |
| **Preexistente** | **Sí.** No lo introduce este carril; afecta a `observation-block` desde antes |
| **Severidad** | Alta para recorrer: el paso «el médico registra una observación» no se puede completar con sentido |

### Qué pasa

`ConceptSelect` pide las opciones a `GET /system-context/dynamic-enums?target=…`. El manejador del
simulador (`misc.handlers.ts:307`) busca el `target` en una tabla de patrones y, **si ninguno casa,
cae a `VS_RECORD_STATUS`**:

```ts
const [, valueSet, name] = ENUMS.find(([patron]) => patron.test(target)) ?? [
  null,
  'VS_RECORD_STATUS',
  'Estado',
];
```

**No hay ningún patrón para `clinical.observations.*`.** Verificado:

```
$ grep -n "observations\." src/app/core/mock/handlers/misc.handlers.ts
(sin resultados)
```

Resultado: el campo «Qué se midió» de la casilla **Observación** ofrece el catálogo equivocado.

| Debería ofrecer (`VS_OBSERVATION_CODE`) | Ofrece hoy (`VS_RECORD_STATUS`) |
|---|---|
| Presión arterial sistólica · Presión arterial diastólica · Frecuencia cardíaca · Temperatura corporal · Peso · Talla · Índice de masa corporal · Glucemia en ayunas · Saturación de oxígeno · Hemoglobina glicosilada | Activo · Inactivo · Pendiente · Verificado · Sin verificar · Rechazado · Revocado |

### Por qué es grave, y por qué no se ve

**Un catálogo equivocado se ve como un catálogo, no como un error.** La pantalla no avisa nada: el
desplegable carga, tiene opciones y se puede elegir una. Lo que queda guardado es una observación
cuyo «qué se midió» es «Pendiente».

Y esto **ya pasó antes, con el mismo mecanismo**. El comentario de `misc.handlers.ts:38-52` lo
cuenta para el diagnóstico: sin patrón, «Elegí un diagnóstico» ofrecía «Activo, Inactivo,
Pendiente…», los cinco casos de demostración salían «aplicados parcialmente» y nadie veía por qué.
Se arregló con **una línea**. La de observaciones nunca se agregó.

### Pasos para reproducirlo

1. `yarn start`, entrar como `medica@alovida.mock`.
2. Abrir una consulta de un paciente e iniciar el encuentro.
3. Abrir la casilla **Observación**.
4. Desplegar «Qué se midió».
5. **Observado:** Activo, Inactivo, Pendiente, Verificado… **Esperado:** Presión arterial, Peso, Talla…

### Qué lo arregla

Una línea en la tabla `ENUMS`, con el mismo patrón que ya usan los otros catálogos clínicos
(la tabla en el patrón, porque `code_concept_id` existe en media docena de tablas):

```ts
[/observations\.code_concept_id/, 'VS_OBSERVATION_CODE', 'Medición'],
```

Y por el mismo motivo conviene revisar los otros tres del mismo bloque, que también caen al
fallback y cuyos conjuntos **ya existen en los fixtures**:

```ts
[/observations\.quantity_unit_concept_id/, 'VS_OBSERVATION_UNIT', 'Unidad'],
[/observations\.category_concept_id/, 'VS_OBSERVATION_CATEGORY', 'Categoría'],
[/observations\.interpretation_concept_id/, 'VS_OBSERVATION_INTERPRETATION', 'Interpretación'],
```

**No se aplicó desde este carril**: `core/mock/**` está reservado a Ender y la regla del reparto
dice que quien necesite un cambio ahí lo pide, no lo escribe.

### Qué bloquea de C-14, y qué no

**No bloquea la cuadrícula.** El mecanismo —elegir la cabecera de un catálogo, cargar la fila,
releerla, una por sesión— es independiente de qué conceptos traiga el catálogo, y está cubierto
por las pruebas de `note-grid.spec.ts`, que sirven el catálogo desde un doble declarado
(regla 65). Lo que queda pendiente de verificar contra lo real es **el contenido del
desplegable**, que va a ser el correcto en cuanto entre esa línea.
</details>

---

## D-02 · La hoja de internación se guarda sin decir que es una internación

| Campo | Valor |
|---|---|
| **Dueño** | **Dueño del modelo** — no se puede cerrar desde el frontend |
| **Clase** | `PRODUCT_BUG` |
| **Encontrado** | 2026-09-21, haciendo la matriz de C-23 |
| **Preexistente** | Sí |
| **Sólo en la API real** | Sí. La maqueta aplica `datos.typeConceptId ?? TIPO_EPISODIO` (`clinical.handlers.ts:264`), así que ahí no se ve |

`clinical.care_episodes` tiene `type_concept_id` (`care_episodes.entity.ts:40`), el DTO lo acepta
(`care-episode.dto.ts:40-46`), el cliente lo tipa (`clinical.types.ts:261`) y el servicio lo guarda
tal cual **sin aplicar ningún valor por omisión** (`care-episodes.service.ts:63`).

El formulario **nunca lo manda**, así que toda internación del sistema queda con
`type_concept_id = NULL` — teniendo `EP_HOSPITALIZATION` sembrado desde siempre
(`clinical.concepts.ts:18-21`). El episodio no registra qué clase de episodio es.

**No se puede cerrar desde acá, y no por falta de tiempo.** Mandar el tipo exige elegirlo de un
catálogo, y **no existe ningún conjunto de valores de tipo de episodio**: en la API hay un concepto
suelto y en la maqueta un uuid suelto (`TIPO_EPISODIO`, `fixtures/clinica.ts:151`), ninguno de los
dos dentro de un `VS_*`. La única forma de mandarlo hoy sería escribir el uuid a mano en el
frontend, que es lo que la regla de terminología prohíbe — y lo que el propio `ConceptSelect`
explica en su documentación: «un `*_concept_id` tecleado a mano es un dato inválido que el backend
va a rechazar, o —peor— un uuid de otro conjunto que va a aceptar».

**Queda como propuesta de modelo**, con el value set y el binding, en
[`matriz-internacion.md`](./matriz-internacion.md) §4.1. Es el cambio más barato de toda la matriz
y el que más devuelve: no toca ninguna tabla.
