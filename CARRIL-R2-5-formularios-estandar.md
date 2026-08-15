# Carril R2-5 · Los formularios estándar por especialidad, catalogados

**Punto del reclamo, textual:**

> NO ESTAN LOS FORMULARIOS: DESCARGAR DE INTERNET LA VERSION GENERAL BASE DE CADA FORMULARIO
> ESTANDAR POR ESPECIALIDAD Y DEBE ESTAR CATALOGADO.

**Repos:** backend + frontend + **contenido**. **Rama:** `carril-r2-5/formularios-estandar`.
**Coordinación:** postear el bloque en `COORDINACION-AGENTES.md` antes de tocar nada.

## Por qué rebotó: se entregó el molde y no la masa

La ronda anterior (Carril 2, punto 1) entregó el **motor**: un admin arma la plantilla de campos
de su especialidad y un doctor la completa dentro del encuentro. Está hecho y funciona:

- `src/app/features/admin/clinical-forms/` — la pantalla de administración.
- `core/data-access/chart-templates/chart-templates.client.ts` — `listTemplates(specialtyConceptId?)`
  (`:28`), `getTemplate(id)` (`:40`), `createTemplate(input)` (`:45`).
- `navigation.map.ts:314-323` — la sección «Formularios clínicos», rol `SECURITY_ADMIN`.

**El cliente no pidió un motor. Pidió los formularios.** Dice «no están», y tiene razón: la lista
de plantillas arranca vacía y alguien tiene que sentarse a tipear cada campo de cada formulario de
cada especialidad antes de que exista uno solo. Nadie va a hacer eso, y por eso está vacío.

Lo que falta es **contenido cargado y catalogado**. El motor se conserva entero — no se toca una
línea de lo que hace hoy.

## Y hay una cosa que decir de entrada sobre «descargar de internet»

**Muchos formularios clínicos estándar tienen derechos de autor.** Algunos son de uso libre y
citable (PHQ-9, GAD-7, la mayoría de lo publicado por OMS/OPS y por los ministerios de salud);
otros son propiedad de sociedades científicas o de editoriales y **no se pueden incorporar a un
producto comercial sin licencia**, aunque el PDF se baje gratis de la web.

**Cómo se resuelve, sin frenar el carril:**

1. Se priorizan fuentes **de dominio público o con licencia abierta**: ministerio de salud del
   país de la organización, OPS/OMS, CDC, formularios oficiales de historia clínica.
2. **Cada formulario del catálogo guarda su procedencia**: título original, organismo, URL y
   licencia. Es un campo del catálogo, no una nota en un chat. Sin eso no entra.
3. Los que sean claramente propietarios se dejan **listados como pendientes de licencia** en el PR,
   no se cargan por las dudas. El cliente decide si consigue la licencia o si se reemplaza por un
   equivalente libre.

No es una traba burocrática: es lo que evita que el producto salga con material que después haya
que sacar.

## De dónde salen los formularios: el catálogo ya tiene dónde vivir

**No hace falta modelo nuevo.** `chart.specialty_chart_templates` es exactamente esto: una
plantilla de campos **por especialidad**, con esquema, y el backend ya expone alta, listado
filtrado por especialidad y lectura del esquema (Carril 2). El «catalogado» que pide el cliente es
ese listado por especialidad, con contenido adentro.

**Ojo con `forms`:** el módulo tiene cinco controllers y **ni un solo `@Get`**
(`forms-definition-sets`, `forms-fields`, `forms-instances`, `forms-values`, `forms-assignments`
— todos `@Post`/`@Put`/`@Patch`). Es motor de instancias, no catálogo navegable. **Este carril se
apoya en `chart/templates`, no en `forms`.** Si al integrar hace falta una lectura de `forms`,
se agrega siguiendo el estilo de sus controllers, pero no es el camino principal.

## El trabajo, en tres partes

### 1 · Contenido: bajar, transcribir, fichar

Es la parte más grande y **no es de programación**. Por cada especialidad que atienda la
organización, la **versión general base** del formulario estándar: el que un médico de esa
especialidad reconoce como «la ficha de siempre», no una variante local.

Mínimo, para que el catálogo se vea completo el día de la demo:

- **Transversales** (todas las especialidades): anamnesis / historia clínica general, examen
  físico, consentimiento informado, epicrisis / resumen de egreso.
- **Por especialidad**, la de cada una: cardiología, pediatría (con curvas de crecimiento),
  ginecología y obstetricia (control prenatal), traumatología, oftalmología, odontología
  (odontograma), psiquiatría / salud mental, dermatología, medicina interna.

De cada uno se produce **un archivo de definición versionado en el repo**, no un PDF:

```
src/common/seed/data/clinical-forms/<especialidad>/<formulario>.json
```

con el esquema de campos que `POST /charts/templates` acepta, más la ficha de catálogo: título,
especialidad, versión, **organismo de origen, URL de origen y licencia**, y fecha de descarga.
El PDF original **no se versiona** en el repo; se guarda donde el equipo guarde los adjuntos y se
referencia por URL.

**El PDF no se «importa»: se transcribe a campos.** Un formulario clínico que se guarda como
imagen no es un formulario, es un adjunto — y el motor que ya existe captura valores estructurados
por campo. Transcribir es el trabajo.

### 2 · Backend: sembrar el catálogo

**Archivo nuevo:** `src/common/seed/clinical-forms-seed.service.ts`, registrado en
`src/common/seed/seed.module.ts` (una línea al final del arreglo de providers, en el último commit
de la rama — `src/common/seed/` lo comparte con R2-3, ver el README de carriles).

Lee los `.json` de arriba y crea las plantillas por especialidad. **Idempotente**: correrlo dos
veces no duplica, y una plantilla ya editada por la organización **no se pisa** — se detecta por
la clave de origen y se saltea. Seguí el molde de `terminology-seed.service.ts`; el `README.md`
de esa carpeta explica el contrato.

Si `specialty_chart_templates` no tiene columna para la procedencia (organismo, URL, licencia,
versión de origen), **no la agregues a mano**: declaralo como bloqueador en
`COORDINACION-AGENTES.md` y ver la advertencia de `SQL/` en el README de carriles. Mientras tanto,
la procedencia viaja dentro del propio esquema JSON de la plantilla, en una clave reservada — y
eso se dice en el PR, no se deja implícito.

Las especialidades tienen que existir como conceptos en terminología antes de poder asignarles
plantilla. Si faltan, se siembran en el mismo servicio.

### 3 · Frontend: que se vea que están y se puedan usar

**Archivos nuevos:**

```
src/app/features/admin/clinical-forms/forms-catalog.ts + .html + .css + .spec.ts
```

El catálogo navegable: **agrupado por especialidad**, con la especialidad como encabezado, y por
cada formulario su título, versión, origen y un vistazo del esquema. Desde ahí, dos acciones:
**usar la plantilla tal cual** o **duplicarla para adaptarla** — que es el motor de Carril 2, ya
construido, ahora con algo adentro que duplicar.

**Archivos existentes que tocás:** `src/app/features/admin/clinical-forms/clinical-forms.ts` +
`.html` — le agregás la entrada al catálogo. **La pantalla de armado no se reescribe**: sigue
haciendo lo que hace.

`navigation.map.ts` **no se toca**: la sección «Formularios clínicos» ya existe y el catálogo va
adentro.

**Lo que NO tocás:** el `specialty-form-block/` de la ficha clínica (es el consumidor, funciona),
`patient-chart.ts`, `forms.client.ts`, y el módulo `forms` del backend salvo que se demuestre que
hace falta.

## Definición de hecho

- Un admin entra a Formularios clínicos y **ve formularios**, agrupados por especialidad, sin
  haber cargado ninguno a mano.
- Cada formulario dice **de dónde salió** —organismo, URL, licencia— y esa ficha está en el
  catálogo, no en un chat.
- Un doctor de una especialidad abre un encuentro y la plantilla estándar de su especialidad está
  disponible para completar.
- El seed corrido dos veces no duplica, y no pisa una plantilla que la organización ya editó.
- Los formularios que quedaron afuera por licencia están **listados en el PR**, con cuál sería su
  reemplazo libre. No se omiten en silencio.
- `yarn lint` · `yarn typecheck` · `yarn test` · `yarn build` en frontend;
  `yarn lint` · `yarn typecheck` · `yarn test` · `yarn test:integration` en backend.
