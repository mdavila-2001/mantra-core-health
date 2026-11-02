# Cobertura de la catalogación

> Generado por `src/common/seed/catalog/catalogacion-cobertura.cli.ts` (no se edita a mano). Cada cifra lleva
> numerador y denominador; lo que no tiene fuente se cuenta como brecha, no se rellena.
> **Peldaño de evidencia:** `TESTED` para el plan y la lógica (doble en memoria). La escritura real en
> PostgreSQL **no se ejecutó** (no hay base disponible): ver «No cubierto».

## Etiquetas de calidad de una explicación

- `CURADA`: texto propio de esa tabla/columna/campo (comentario del modelo, JSDoc de la entidad, nota propia de la bóveda). **No** implica revisada: nada está aprobado.
- `PLANTILLA`: la misma frase, quitado lo que varía, en 3 objetos o más, o un molde de generador. Relleno: no se siembra como descripción.
- `AUTO_DETECTADA`: la armó una regla determinista o una herramienta con datos con fuente (estructura del DDL, `created_at`/`tenant_id`/…, `summary` del contrato).
- `VACIA`: sin fuente. Brecha visible; nunca relleno.

## Tablas

| Medida | Numerador | Denominador | % |
|---|---:|---:|---:|
| Tablas con propósito CURADO (modelo o bóveda propia) | 1146 | 1313 | 87,3 % |
| …con el propósito rescatado de una nota propia de la bóveda (el del modelo es plantilla o falta) | 0 | 1313 | 0,0 % |
| Tablas con propósito CURADO y razón de existir propia | 29 | 1313 | 2,2 % |
| Tablas con grano de fila respondido (no existe fuente) | 0 | 1313 | 0,0 % |
| Tablas con dominio de negocio | 1251 | 1313 | 95,3 % |
| Tablas tocadas por al menos un endpoint | 965 | 1313 | 73,5 % |
| Tablas con entidad del ORM | 1248 | 1313 | 95,0 % |
| Tablas con todas sus columnas descritas | 29 | 1313 | 2,2 % |

| Calidad del propósito de la tabla | CURADA | PLANTILLA | AUTO_DETECTADA | VACIA |
|---|---:|---:|---:|---:|
| Propósito | 1146 | 113 | 0 | 54 |

## Columnas

| Medida | Numerador | Denominador | % |
|---|---:|---:|---:|
| Columnas descritas (CURADA o AUTO_DETECTADA) | 6786 | 18263 | 37,2 % |
| Columnas con descripción propia (CURADA) | 616 | 18263 | 3,4 % |
| Columnas con propuesta de sensibilidad del clasificador | 191 | 18263 | 1,1 % |
| Columnas con explicación de sistema (estructural) | 18263 | 18263 | 100,0 % |

| Calidad de la explicación de NEGOCIO | CURADA | PLANTILLA | AUTO_DETECTADA | VACIA |
|---|---:|---:|---:|---:|
| Columnas | 616 | 25 | 6170 | 11452 |

## Operaciones (endpoints)

| Medida | Numerador | Denominador | % |
|---|---:|---:|---:|
| Operaciones con DTO de petición | 1038 | 1709 | 60,7 % |
| Operaciones que mutan, con DTO de petición | 1038 | 1191 | 87,2 % |
| Operaciones con DTO de respuesta | 1490 | 1709 | 87,2 % |
| Operaciones con tablas afectadas (o declaradas sin tablas) | 1709 | 1709 | 100,0 % |
| Vínculos operación→tabla con confianza DIRECTA | 9851 | 12123 | 81,3 % |
| Operaciones asignadas a un flujo | 1709 | 1709 | 100,0 % |

| Calidad | CURADA | PLANTILLA | AUTO_DETECTADA | VACIA |
|---|---:|---:|---:|---:|
| Explicación de negocio de la operación | 0 | 0 | 1679 | 30 |
| Explicación de sistema de la operación | 0 | 0 | 1709 | 0 |
| Descripción de campos del cuerpo (petición) | 3833 | 571 | 0 | 2584 |
| Descripción de campos de la respuesta | 3191 | 5870 | 0 | 6319 |

## Inventario frente al código

- Controllers en `src`: 315; decoradores `@Get/@Post/@Put/@Patch/@Delete`: 1691.
- Operaciones inventariadas: 1709. Las dos cifras no tienen por qué coincidir (un decorador puede declarar varias rutas o ninguna operación HTTP pública); la verificación oficial es `yarn inventario:verificar` (adjunta abajo).

## Esquemas

| Medida | Numerador | Denominador | % |
|---|---:|---:|---:|
| Esquemas con descripción de negocio (bóveda, módulo) | 59 | 67 | 88,1 % |

La explicación de sistema de un esquema (`schema-descriptions.generated.ts`) es AUTO_DETECTADA: se arma con métricas del módulo. No hay tabla en el modelo para persistir fichas por esquema, así que se sirven desde ese archivo generado.

## Siembra (plan contra el doble en memoria; NO es una base viva)

Procedencia: inventario `inventario/` + dataset de la bóveda (sha256 `444e8dfe4edf9e79158c00b6badab0470777dcf23ab371ad4d8f1a812bfd0c0a`, 59 tablas con texto propio) + reglas del clasificador. Versión catalogacion-seed/v1.

| Paso | Planificado | Insertado 1.ª corrida | Insertado 2.ª corrida |
|---|---:|---:|---:|
| system_ops.data_domains | 11 | 11 | 0 |
| system_ops.data_classifications | 9 | 9 | 0 |
| catalog_glossary_terms | 66 | 66 | 0 |
| catalog_glossary_term_revisions | 66 | 66 | 0 |
| catalog_lineage_edges (endpoint→tabla) | 11558 | 11558 | 0 |
| catalog_annotations (tablas + columnas) | 8265 | 8265 | 0 |
| catalog_annotation_revisions | 8265 | 8265 | 0 |
| catalog_evidence_items | 2511 | 2511 | 0 |
| catalog_objects.domain_id (enlace) | 1251 | 1251 | 0 |

- Fichas de tabla: {"DRAFT":1146,"AUTO_DETECTED":167}; fichas de columna: {"AUTO_DETECTED":6223,"DRAFT":616,"NEEDS_REVIEW":113}. **Ninguna APPROVED.**
- Vínculos operación→tabla no sembrados por apuntar a una tabla fuera del catálogo: 283.
- Términos de glosario descartados por duplicados exactos: 0; términos: 66.
- El linaje se siembra con `is_official = false`: «oficial» es una aprobación de una persona.

## Salida adjunta: yarn inventario:verificar (tras regenerar)

```text
--- corepack yarn inventario:verificar
Inventario al día: 1709 operaciones en 76 módulos.
Flujos al día: 78 procesos, 1709 árboles.
Catálogo al día: 1313 tablas en 61 schemas.
exit=0
```

## Salida adjunta: jest dirigido (seed/catalog + catalogacion)

```text
Test Suites: 3 passed, 3 total
Tests:       27 passed, 27 total
```

## Salida adjunta: vault-table-notes.json --check

```text
vault-table-notes.json al día
```

