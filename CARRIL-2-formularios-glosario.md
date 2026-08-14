# Carril 2 · Formularios clínicos por especialidad y glosario accesible

**Puntos del reclamo:** 1 (formularios por especialidad, configurables por doctor), 4 (glosario
de terminología médica accesible por **cada** profesional). **Repos:** backend + frontend, los
dos. **Rama sugerida:** `carril-2/formularios-glosario` en ambos.
**Coordinación:** ver `CARRILES-2026-08-14-README.md` antes de tocar cualquier archivo
compartido, y postear tu bloque en `COORDINACION-AGENTES.md` antes de empezar.

## Por qué estos dos van juntos

Los dos son, en el fondo, "ponerle una puerta de profesional a algo que hoy solo mira un
administrador": las plantillas por especialidad las configura un admin pero las **usa** un
médico en consulta, y el glosario existe pero solo lo ve `SECURITY_ADMIN`. Comparten el mismo
gesto de producto — abrir una puerta nueva sobre módulos ya modelados — y ninguno de los dos
toca `patient-chart.ts` para lo mismo que el otro, así que conviven bien en un carril.

## Lo que ya existe, y por qué no alcanza (evidencia de la auditoría)

**Punto 1 — formularios:**
- El módulo `forms` (backend) es un motor de formularios dinámicos completo: definiciones de
  campos, sets, asignaciones, instancias, valores — controllers reales en
  `redesa-api/src/modules/forms/controllers/*.ts`. El frontend **no tiene ningún cliente**:
  `grep -rn "FormsClient\|'/forms" src/app` → 0 resultados.
- `chart.specialty_chart_templates` solo tiene `POST /charts/templates/:templateId/assignments`
  (`chart-templates.controller.ts:21-40`) — **asigna** una plantilla que ya existe, pero no hay
  forma de crear, listar ni leer su esquema. Ni el backend puede decir "estas son las plantillas
  por especialidad" hoy.

**Punto 4 — glosario:**
- `TerminologyCatalog` (`src/app/features/admin/terminology/terminology-catalog.ts`) es real:
  llama `GET /terminology/concepts?q=` con paginación y estados de carga/error. El problema es
  a quién se le muestra.
- `navigation.map.ts:189-197` lo restringe a `roles: ['SECURITY_ADMIN']`. El propio comentario
  del código admite el porqué: "resolver un `*ConceptId` es una tarea de configuración, no de
  atención" — es decir, hoy es un buscador técnico de UUIDs, no un glosario en lenguaje llano
  para consulta clínica.

## Backend (`mantra-core-health-redesa-api`)

**Módulo `chart`** — completar el CRUD de plantillas que hoy solo asigna:

```
src/modules/chart/controllers/chart-templates.controller.ts    (extender, no reescribir)
src/modules/chart/services/chart-templates.service.ts          (extender)
src/modules/chart/dto/                                          (DTOs de creación/lectura nuevos)
```

Agregá `POST /charts/templates` (crear plantilla con su esquema de campos, por especialidad),
`GET /charts/templates?specialtyId=` (listar), `GET /charts/templates/:id` (leer esquema). Mismo
patrón de `@Roles('SECURITY_ADMIN')` que ya tiene `assignTemplate`.

**Antes de tocar la entidad**, confirmá si `specialty_chart_templates` ya tiene una columna para
el esquema de campos (JSON) o si hace falta agregarla. Si falta, **no la agregues a mano** —
seguí la advertencia del README de carriles y avisá el bloqueo en `COORDINACION-AGENTES.md`.

**Módulo `forms`** — probablemente no necesite cambios (ya está completo del lado del backend);
tu trabajo ahí es de lectura para escribir el cliente del frontend, no de escritura de código.
Si al integrar encontrás que falta un endpoint de listado filtrado por especialidad/doctor,
agregalo siguiendo el estilo de los controllers existentes en
`src/modules/forms/controllers/`.

**Archivos existentes que tocás:** solo dentro de `src/modules/chart/` y, si hace falta,
`src/modules/forms/`. Ningún otro carril toca estos dos módulos.

## Frontend (`mantra-core-health`)

**Archivos nuevos (no chocan con nada):**

```
src/app/core/data-access/forms/forms.client.ts                    + .types.ts + .spec.ts
src/app/core/data-access/chart-templates/chart-templates.client.ts + .types.ts + .spec.ts
src/app/features/admin/clinical-forms/clinical-forms.ts           + .html + .css + .spec.ts
src/app/features/clinical-record/patient-chart/specialty-form-block/specialty-form-block.ts + .html + .css + .spec.ts
src/app/features/glossary/glossary.ts                             + .html + .css + .spec.ts
```

- `clinical-forms` (admin): un doctor con rol de admin de especialidad arma/edita la plantilla
  de su especialidad usando el motor de `forms`.
- `specialty-form-block`: **sibling nuevo** dentro de `patient-chart/`, junto a
  `medication-block`/`diagnosis-block` — no los edites, solo agregá el tuyo al lado. Renderiza
  el formulario dinámico asignado a la especialidad del encuentro activo.
- `glossary`: pantalla **nueva y separada** de `terminology-catalog.ts` — no edites ese archivo
  (es del admin, sigue siendo suyo). La tuya reusa `TerminologyClient` (ya existe, no lo
  toques tampoco) pero con una UI pensada para consulta clínica en lenguaje llano: buscador
  simple, sin exponer `conceptId` crudo.

**Archivos existentes que tocás (siguiendo el protocolo del README):**

| Archivo | Qué agregás |
|---|---|
| `src/app/core/navigation/navigation.map.ts` | dos filas nuevas: `administration/clinical-forms` (grupo Administración, rol del admin de especialidad) y `glossary` (grupo **Atención**, **sin roles** — el cliente pidió explícitamente que sea accesible por cada profesional, no solo por admin) |
| `src/app/app.routes.ts` | rutas de las dos secciones nuevas |
| `src/app/features/clinical-record/patient-chart/patient-chart.ts` (+ `.html`) | import de `specialty-form-block` + una entrada en el ensamblado de bloques, al final, en tu último commit |

**Lo que NO tocás:** `terminology-catalog.ts` ni `terminology.client.ts` (son del admin, están
completos y funcionan — vos solo los *consumís* desde `glossary`), `medication-block/`,
`diagnosis-block/`, la lógica de `registrarEncuentro()`/`cerrarEncuentro()`, y todo `redsat/`
(incluye `redsat/terminologia`, que es maqueta sin lógica — no es tu punto de partida).

## Definición de hecho

- Un admin de especialidad crea una plantilla con campos propios; un doctor de esa especialidad
  la ve y la completa dentro de un encuentro activo, y queda guardada en la ficha.
- Cualquier profesional de salud (no solo `SECURITY_ADMIN`) encuentra la sección Glosario en su
  menú y puede buscar un término sin ver un UUID en pantalla.
- `yarn lint` · `yarn typecheck` · `yarn test` · `yarn build` en frontend; `yarn lint` ·
  `yarn typecheck` · `yarn test` · `yarn test:integration` en backend.
