# `data-access/terminology` — pendiente, a la espera del endpoint

Esta carpeta queda **vacía a propósito**. La tarea J5 pedía crear el cliente de
`GET /terminology/value-sets/:id/$expand` **sólo si el endpoint ya existía**, y
verificado contra la API el 2026-07-31: **no existe todavía**.

Lo que sí hay en el backend es otra cosa, y no sirve como reemplazo:

```
POST /terminology/ValueSet/:id/$expand    (terminology-fhir.controller.ts:66)
```

Es la operación con nombre al estilo FHIR (UC-03-08): distinto verbo, distinta
ruta y distinto contrato. Usarla en su lugar sería inventar una equivalencia que
nadie declaró.

El endpoint de lectura paginado por cursor es la tarea **P3 de Pablo**
(tarjeta 6). Cuando lo entregue:

1. crear `terminology.types.ts` y `terminology.client.ts` siguiendo el patrón de
   los otros clientes de `data-access/`;
2. paginar por cursor, no por número de página — es el contrato del M30
   («cursor pagination with deterministic tie-breakers»);
3. los códigos son valores estables de la API y las etiquetas son metadatos de
   presentación: no ramificar por etiqueta.

**No crear el cliente antes de que el endpoint exista.** El contrato lo fija la
API, no la suposición del frontend.
