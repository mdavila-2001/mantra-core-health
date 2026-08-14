# Carriles paralelos · cierre de los puntos abiertos del reclamo del cliente

**Generado:** 2026-08-14, a partir de `ESTADO-PROYECTO-2026-08-14.pdf` (auditoría línea por
línea de ambos repos). **Actualizado el mismo día** con el punto 12, agregado después por el
cliente (subida de imágenes, PDF generalizado, motion graphics, feed y vista pública del
perfil, permisos de acceso a archivos). Este documento reparte todo eso en **10 carriles** para
que **hasta 10 máquinas trabajen en simultáneo**, cada una en su propia rama, en los dos repos,
y puedan pushear sin pisarse.

No repite lo que ya tiene plan propio: **`community`/red social sigue en
[[PENDIENTES-RED-SOCIAL.md]]** (H2/H4/F4/F6 en curso — los carriles 15 y 16 ejecutan porciones
concretas de ese plan, no uno aparte) y **el defecto de registro de paciente sigue en
[[PENDIENTES-BACKEND.md]] (P14)**. Ningún carril de acá reinventa esos dos frentes.

## Los 10 carriles

| # | Archivo | Puntos del reclamo | Repos |
| --- | --- | --- | --- |
| 1 | [`CARRIL-1-catalogo-presupuestos-pdf.md`](CARRIL-1-catalogo-presupuestos-pdf.md) | 2 · PDF, 3 · Catálogo de servicios, 5 · Presupuestos | backend + frontend |
| 2 | [`CARRIL-2-formularios-glosario.md`](CARRIL-2-formularios-glosario.md) | 1 · Formularios por especialidad, 4 · Glosario | backend + frontend |
| 3 | [`CARRIL-3-procedimientos-quirurgicos.md`](CARRIL-3-procedimientos-quirurgicos.md) | 7 · Histórico de procedimientos (cirugía y odontología) | backend + frontend |
| 4 | [`CARRIL-4-laboratorios-imagenologia.md`](CARRIL-4-laboratorios-imagenologia.md) | 10 · Laboratorios e imagenología | backend + frontend |
| 5 | [`CARRIL-5-perfil-consultorios-internacion.md`](CARRIL-5-perfil-consultorios-internacion.md) | 8 · Alta de internación, 9 · Historial laboral del profesional, 11 · Consultorios | backend + frontend |
| 12 | [`CARRIL-12-adjuntos-imagenes-permisos.md`](CARRIL-12-adjuntos-imagenes-permisos.md) | 12a · Subir imágenes, 12g · Permisos de acceso a archivos | backend + frontend |
| 13 | [`CARRIL-13-pdf-generalizado.md`](CARRIL-13-pdf-generalizado.md) | 12b · PDF de prácticamente todos los formularios | frontend (depende del Carril 1) |
| 14 | [`CARRIL-14-motion-graphics.md`](CARRIL-14-motion-graphics.md) | 12c · Motion graphics | frontend |
| 15 | [`CARRIL-15-feed-profesional.md`](CARRIL-15-feed-profesional.md) | 12d · Feed tipo LinkedIn | backend (probable solo verificación) + frontend |
| 16 | [`CARRIL-16-perfil-publico.md`](CARRIL-16-perfil-publico.md) | 12e · Vista pública real del perfil del profesional | backend + frontend |

El punto 6 (cita → atención → receta → ficha) ya está completo — no tiene carril. La numeración
salta del 5 al 12 a propósito: son los cinco carriles nuevos del punto 12 del reclamo, y
conviene que el número de archivo seguir apuntando al punto del reclamo que resuelve, no a un
orden de creación.

**Si tenés menos de 10 máquinas:** los carriles 13 y 14 son los más chicos y los más
postergables sin bloquear nada — arrancá por 1, 2, 3, 4, 5, 12, 15 y 16, y sumá 13/14 cuando haya
máquina libre.

## Por qué se partió así, y no de otra forma

El criterio fue **superficie de archivo**, no "quién sabe más de qué". Cada carril:

- Trae **su propio módulo de dominio en el backend** (ninguno comparte carpeta de módulo
  `src/modules/<x>/` con otro carril).
- Crea **su propia carpeta en `core/data-access/`** y su propia carpeta en `features/`.
- Solo toca un puñado de **archivos compartidos** — están listados explícitamente en cada
  carril, y son siempre **adiciones al final**, nunca reestructuraciones.

## Los archivos compartidos, y el protocolo para no chocar en ellos

Esto ya es la costumbre del repo — la sigue `COORDINACION-AGENTES.md` desde agosto — y acá se
vuelve regla explícita porque **hasta cinco carriles pueden tocar el mismo archivo el mismo
día**:

| Archivo | Quién lo toca | Qué le hace cada uno |
| --- | --- | --- |
| `src/app/core/navigation/navigation.map.ts` | Carriles 1, 2, 4, 15 | Una fila nueva en `APP_SECTIONS`, al final del grupo que corresponda |
| `src/app/app.routes.ts` | Carriles 1, 2, 4, 5, 15, 16 | Una entrada nueva de ruta, al final del bloque que corresponda. El Carril 16 la agrega al bloque **prerenderizado/público**, no al área con sesión — no son la misma lista |
| `src/app/features/clinical-record/patient-chart/patient-chart.ts` (+ `.html`) | Carriles 1, 2, 3, 5, 12 | Un bloque hijo nuevo, con el mismo molde que `medication-block`/`diagnosis-block`: import + una entrada en el ensamblado. **Nunca** tocan la lógica de `registrarEncuentro`/`cerrarEncuentro`. Es el archivo con más presión — cinco carriles lo tocan, coordinen el orden de merge en `COORDINACION-AGENTES.md` |
| `package.json` (frontend) | Carril 1 únicamente | Agrega `jspdf` como dependencia. El Carril 13 la reusa sin agregar nada propio; el Carril 14 construye sobre Web Animations API nativa a propósito, para no sumar una segunda dependencia acá |
| `src/app/core/data-access/community/community.client.ts` (+ `.types.ts`) | Carriles 15, 16 | Cada uno agrega su propio método nuevo (`getFeed()` / `getPublicProfile()`) — no tocan `upsertOwnProfile` ni los métodos de posts existentes |
| `src/modules/profiles/controllers/profiles-practitioners.controller.ts` y su service | Carril 5 | **Ya hay cambios sin commitear ahí, fuera de estos carriles** (rama `pablo/contabilidad-visible` del backend). El Carril 5 arranca **desde ese working tree**, no desde `master` limpio — coordinar antes de tocar |
| `src/modules/community/**` (backend) | Carriles 15, 16, y el trabajo en curso de `PENDIENTES-RED-SOCIAL.md` | Tres frentes en el mismo módulo — confirmen en `COORDINACION-AGENTES.md` quién más está ahí antes de arrancar |

**Protocolo, en los cinco pasos que ya usa el resto del repo:**

1. `git pull --rebase` sobre la base (`dev` en frontend, `master` en backend) antes de tocar
   cualquier archivo de la tabla de arriba.
2. Agregá tu bloque en `COORDINACION-AGENTES.md` **antes** de tocar nada — rama, qué creás
   (no choca), qué tocás de la tabla (y por qué), qué NO tocás. Es la regla que ya rige el
   archivo, con la que arranca cada sesión ahí adentro.
3. El cambio a un archivo compartido es **siempre una fila/entrada nueva agregada al final**,
   nunca edición de una fila ajena ni reordenamiento del arreglo.
4. Guardá ese cambio compartido para el **último commit** de tu rama, justo antes de abrir el
   PR — así la ventana en la que puede chocar con otro carril es la más corta posible.
5. Si aun así hay conflicto al mezclar, va a ser trivial —dos adiciones en líneas distintas del
   mismo arreglo—: aceptá ambas y listo.

## Ramas

Convención: `carril-N/<slug>`, una por repo, arrancando de la base al día (`dev` en frontend,
`master` en backend). Ejemplo del carril 1: `carril-1/catalogo-presupuestos-pdf` en los dos
repos — no hace falta el mismo nombre exacto, pero ayuda a rastrearlas.

## Antes de abrir PR — verificación mínima por carril

**Frontend:** `yarn lint` · `yarn typecheck` · `yarn test` · `yarn build`
**Backend:** `yarn lint` · `yarn typecheck` · `yarn test` · `yarn test:integration`

Si tu carril agregó una sección nueva a `navigation.map.ts`, corré también
`node scripts/check-route-prefixes.mjs` — es el que impide que una ruta nueva colisione con un
prefijo de la API (ver su cabecera para el defecto real que ya causó una vez).

## Una advertencia que cruza varios carriles

Varias tablas que el backend ya tiene modeladas (`billing.service_catalog`,
`billing.budgets`/`budget_lines`, el esquema de `chart.specialty_chart_templates`) están
**sin service ni controller**, y algunos carriles van a descubrir que además les falta una
columna. Este repo **no edita `SQL/` a mano**: el pipeline es `.puml` → `gen_ddl.py` →
`SQL/patches/` → base, y `SQL/` no vive en ninguno de estos dos repositorios git — ver
`PENDIENTES-BACKEND.md` (P14) para el incidente real que costó cuando alguien lo intentó
saltear. Si tu carril necesita una columna o tabla nueva, decilo explícitamente en tu bloque de
`COORDINACION-AGENTES.md` como bloqueador y coordiná con quien tenga acceso a ese modelo —
no lo escribas a mano en ningún patch.
