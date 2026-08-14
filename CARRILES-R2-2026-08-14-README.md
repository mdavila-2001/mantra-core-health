# Carriles · segunda ronda del reclamo (2026-08-14, 16:07–16:09)

**Generado:** 2026-08-14, a partir de los seis puntos que el cliente mandó por WhatsApp esa
tarde, **después** de la ronda de carriles anterior (`CARRILES-2026-08-14-README.md`). No la
reemplaza: aquélla sigue viva. Ésta es la lista de **lo que se entregó y volvió rebotado**, más
dos cosas que directamente no estaban.

Los seis puntos, textuales, sin reinterpretar:

1. Sacar del perfil de paciente **Muro profesional**, o cambiarle el enfoque: debe mostrar una
   **guía telefónica de todos los doctores agrupados por especialidad**, y al hacer clic, el
   perfil completo del doctor.
2. **Crear agenda** tiene que arreglarse **por fases, sí o sí**. No todo de una: como una barra
   de avance.
3. **Datos de prueba de los laboratorios.** Debe haber una **pestaña de laboratorios** con el
   perfil de cada uno detalladísimo, y aparte **agrupado por categorías**.
4. **No se modificó el perfil del doctor. Está pésimo.**
5. **No están los formularios**: bajar de internet la versión general base de cada formulario
   estándar por especialidad, y debe quedar **catalogado**.
6. **El glosario está pésimo**, no tiene nada de lo que se pidió: **no hay etiquetas**, no hay
   nada. **Aclarado después, el mismo día:** el glosario **se traduce a castellano**, y **debe ser
   con etiquetas como se describió, no una tabla simplona**.

## Cómo se usa este paquete

Son **siete archivos `.md` y nada más** —este índice y seis carriles—, versionados en el repo del
frontend. Están escritos para repartirse: **un carril por computadora, hasta seis en paralelo**,
cada una en su propia rama, en los dos repos, sin pisarse. Cada archivo se lee solo: trae su punto
del reclamo textual, la evidencia de qué hay hoy con archivo y línea, qué agrega en backend, qué
en frontend, qué archivos compartidos toca y su definición de hecho. La máquina que agarra un
carril **no necesita leer los otros cinco** — sólo este índice, y sólo por la tabla de archivos
compartidos y el único orden obligatorio.

## Un carril por punto, y en el mismo orden

La ronda anterior agrupó puntos por superficie de archivo. Ésta **no**: son seis carriles, uno
por punto, con el número del punto en el nombre. El reclamo de fondo de esta tanda es que se
respondió otra cosa distinta de la que se pidió, así que la trazabilidad punto ↔ carril ↔ PR se
mantiene uno a uno, sin agrupar. El prefijo `R2` los distingue de los `CARRIL-N` de la primera
ronda, que siguen abiertos y no se tocan.

| # | Archivo | Punto | Repos | Bloqueado por backend |
| --- | --- | --- | --- | --- |
| R2-1 | [`CARRIL-R2-1-guia-de-doctores.md`](CARRIL-R2-1-guia-de-doctores.md) | 1 · Guía de doctores por especialidad | backend + frontend | **Sí** — no existe listado de profesionales |
| R2-2 | [`CARRIL-R2-2-alta-de-agenda-por-fases.md`](CARRIL-R2-2-alta-de-agenda-por-fases.md) | 2 · Crear agenda por fases | frontend (backend ya está) | No |
| R2-3 | [`CARRIL-R2-3-directorio-laboratorios.md`](CARRIL-R2-3-directorio-laboratorios.md) | 3 · Laboratorios: pestaña, perfil, categorías, datos de prueba | backend + frontend | **Sí** — `diagnostic_units` no tiene ni un `GET` |
| R2-4 | [`CARRIL-R2-4-perfil-del-doctor.md`](CARRIL-R2-4-perfil-del-doctor.md) | 4 · Perfil del doctor | frontend | No |
| R2-5 | [`CARRIL-R2-5-formularios-estandar.md`](CARRIL-R2-5-formularios-estandar.md) | 5 · Formularios estándar por especialidad, catalogados | backend + frontend + contenido | Parcial |
| R2-6 | [`CARRIL-R2-6-glosario-etiquetas.md`](CARRIL-R2-6-glosario-etiquetas.md) | 6 · Glosario con etiquetas, en castellano | backend + frontend + contenido | Parcial — la búsqueda no acepta idioma |

## Lo que hay que leer antes de escribir una línea

Tres de los seis puntos rebotaron porque **se entregó la mitad del pedido**. El patrón es el
mismo en los tres, y está documentado con evidencia dentro de cada carril:

- El **glosario** (punto 6) se entregó como buscador de texto plano con dos columnas
  (`glossary.ts:98-101`). El pedido incluía **etiquetas**: agrupar, filtrar, navegar por
  categoría. Un `<input>` sobre una tabla no es eso — y el cliente lo repitió por escrito: «con
  etiquetas, **no una tabla simplona**». Además tiene que leerse **en castellano**, que es un
  problema de datos y de API, no de rótulos de interfaz.
- El **perfil del doctor** (punto 4) existe y lee datos reales, pero es una lista de tarjetas
  apiladas. El cliente lo llamó pésimo dos rondas seguidas.
- Los **formularios** (punto 5) se entregaron como *motor* (armá tu plantilla) cuando lo que se
  pidió fue *contenido* (los formularios estándar, ya cargados, catalogados por especialidad).
  El motor está bien hecho y no se tira: le falta lo que va adentro.

**Regla de esta ronda:** ningún carril se da por hecho contra su propio criterio. Se da por hecho
contra la frase del cliente, copiada al pie de su carril. Si al terminar la frase no se cumple
literal, el carril no está hecho — aunque el código esté impecable.

## Los archivos compartidos, y quién los toca

Mismo protocolo de siempre (`COORDINACION-AGENTES.md`), con una excepción nueva marcada abajo:

| Archivo | Quién lo toca | Qué le hace |
| --- | --- | --- |
| `src/app/core/navigation/navigation.map.ts` | R2-1, R2-3 | R2-3 agrega una fila nueva al final del grupo Atención. **R2-1 es la excepción de la ronda:** tiene que *editar* la fila existente `feed` (líneas 73-84), no agregar una. Es la única edición de fila ajena autorizada, y es **exclusiva de R2-1** — ningún otro carril toca esa fila ni ese archivo el mismo día sin avisar |
| `src/app/app.routes.ts` | R2-1, R2-2, R2-3 | Una entrada nueva al final del bloque que corresponda. R2-1 además repunta la ruta `feed` |
| `src/app/features/account/my-profile/practitioner-profile/` | **R2-4 lo posee; R2-1 lo consume** | Ver «El único orden obligatorio» abajo |
| `src/app/core/data-access/terminology/terminology.client.ts` | R2-6 (y R2-3 si necesita rótulos de categoría) | Cada uno agrega su método nuevo al final. No se tocan `readExpansion`, `searchConcepts` ni `readConceptLabels` |
| `src/modules/terminology/**` (backend) | R2-6 | Exclusivo. Le agrega **idioma preferido** a `GET /terminology/concepts`, que es una lectura que consume medio frontend (agenda, perfil profesional, diagnósticos, ficha clínica). El cambio es **retrocompatible o no va**: sin el parámetro, la respuesta es idéntica a la de hoy |
| `src/common/seed/` (backend) | R2-3, R2-5, R2-6 | R2-3 y R2-5 agregan **cada uno su propio archivo** `*-seed.service.ts` y lo registran en `seed.module.ts` — una línea al final del arreglo de providers, en el último commit de la rama. **R2-6 es el único que edita archivos existentes ahí** (`terminology-seed.service.ts`, `module-concepts.ts`, para las designaciones en castellano): si los tres corren el mismo día, R2-6 avisa primero |
| `src/modules/profiles/**` (backend) | R2-1 | Exclusivo. **Ojo:** la ronda anterior anotó que `profiles-practitioners.controller.ts` puede tener cambios sin commitear de la rama `pablo/contabilidad-visible`. Verificar el working tree **antes** de arrancar |

### El único orden obligatorio de toda la ronda

**R2-4 mergea antes que R2-1.** Los dos necesitan la misma pieza —la vista completa del perfil de
un doctor— y sería absurdo escribirla dos veces con dos criterios distintos. Entonces:

- **R2-4** rehace esa vista y la deja como **componente presentacional puro** (recibe el perfil
  por `input()`, no inyecta el cliente ni sabe de dónde salió el dato).
- **R2-1** la **importa tal cual** para pintar el perfil al que se llega desde la guía. No la
  copia, no la bifurca, no la retoca.

Si R2-1 arranca antes de que R2-4 esté mergeado, trabaja contra el contrato de `input()` acordado
en `COORDINACION-AGENTES.md` y rebasea después. Lo que **no** puede pasar es que terminemos con
dos perfiles de doctor distintos: es exactamente el tipo de cosa que generó el punto 4.

Los demás carriles son independientes entre sí y pueden arrancar todos el mismo minuto.

## Ramas

`carril-r2-N/<slug>`, una por repo, desde la base al día (`dev` en frontend, `master` en
backend). Ejemplo: `carril-r2-3/directorio-laboratorios`.

## Antes de abrir PR

**Frontend:** `yarn lint` · `yarn typecheck` · `yarn test` · `yarn build`
**Backend:** `yarn lint` · `yarn typecheck` · `yarn test` · `yarn test:integration`

Si tocaste `navigation.map.ts`, corré además `node scripts/check-route-prefixes.mjs`.

## La advertencia de siempre, que esta ronda vuelve a tocar

Dos carriles (R2-1 y R2-3) van a chocar contra el modelo de datos. **`SQL/` no se edita a mano**:
el pipeline es `.puml` → `gen_ddl.py` → `SQL/patches/` → base, y `SQL/` no vive en ninguno de los
dos repos git — ver `PENDIENTES-BACKEND.md` (P14) para el incidente que costó cuando alguien lo
intentó saltear. Si tu carril necesita una columna, una tabla o **una vista materializada**,
declaralo como bloqueador en tu bloque de `COORDINACION-AGENTES.md` y coordiná con quien tenga
acceso al modelo. No lo escribas a mano en ningún patch.

Los **datos de prueba** son distintos y sí van en este repo: se cargan con un
`*-seed.service.ts` en `src/common/seed/` — la infraestructura ya existe y tiene su
`README.md` ahí adentro. Ningún `INSERT` suelto.
