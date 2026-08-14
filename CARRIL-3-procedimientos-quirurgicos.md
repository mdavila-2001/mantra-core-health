# Carril 3 · Histórico de procedimientos (cirujanos y odontólogos), equipos y notas

**Punto del reclamo:** 7. **Repos:** backend + frontend, los dos.
**Rama sugerida:** `carril-3/procedimientos-quirurgicos` en ambos.
**Coordinación:** ver `CARRILES-2026-08-14-README.md` antes de tocar cualquier archivo
compartido, y postear tu bloque en `COORDINACION-AGENTES.md` antes de empezar.

## Lo que ya existe, y por qué no alcanza (evidencia de la auditoría)

- El backend tiene un módulo perioperatorio **grande y real**: `procedures_perioperative`, con
  **37 entidades** (`procedure_cases`, `operative_steps`, `operative_findings`,
  `implant_identifiers`, `instrument_sets`, `anesthesia_events`, `pacu_stays`, entre otras) y
  **28 endpoints** en un único controller
  (`redesa-api/src/modules/procedures_perioperative/controllers/periop.controller.ts:102-449`):
  `procedure-cases`, `.../diagnoses`, `.../team-members`, `.../findings`, `.../implants`,
  `.../specimens`, etc. Esto cubre la parte quirúrgica de punta a punta del lado del backend.
- El frontend no tiene **nada**: `grep -rli "procedure.case\|perioperative\|surgical\|odont"`
  sobre `src/app` no devuelve ningún archivo relevante (los únicos resultados eran texto suelto
  en pantallas `redsat`, sin relación real).
- **Odontología no existe en ningún lado del sistema** — ni entidad, ni concepto, ni pantalla,
  ni siquiera en el módulo perioperatorio (que está pensado para cirugía).

## Backend (`mantra-core-health-redesa-api`)

**Parte quirúrgica — probablemente no necesites escribir backend nuevo.** El trabajo acá es
sobre todo de **lectura**: confirmá con el equipo de backend (o vos mismo, si tenés el repo) que
los 28 endpoints existentes soportan lo que la UI va a necesitar — en particular, paginación y
filtro por `patientId` en `GET procedure-cases`. Si falta ese filtro, es la única extensión de
backend que este carril debería necesitar para la parte quirúrgica:

```
src/modules/procedures_perioperative/controllers/periop.controller.ts   (agregar query param, no reescribir)
```

**Parte odontológica — acá sí hay backend nuevo que construir**, porque no existe absolutamente
nada:

```
src/modules/procedures_perioperative/entities/dental_procedures.entity.ts   (o módulo propio, a definir)
src/modules/procedures_perioperative/controllers/dental.controller.ts       + .spec.ts
src/modules/procedures_perioperative/services/dental.service.ts             + .spec.ts
src/modules/procedures_perioperative/dto/dental.dto.ts
```

Mínimo viable: un procedimiento odontológico registrado contra un paciente, con pieza/cuadrante,
nota clínica y profesional que lo realizó — no hace falta un odontograma completo para cerrar el
punto del reclamo, solo el histórico que el cliente pidió.

**Esto necesita tabla nueva.** Seguí la advertencia del README de carriles: no se edita `SQL/`
a mano — es `.puml` → `gen_ddl.py` → `SQL/patches/` → base, y ese pipeline no vive en este repo.
Marcalo como bloqueador en `COORDINACION-AGENTES.md` en cuanto arranques, para que quien tenga
acceso al modelo lo sepa desde el día uno y no sea la última sorpresa del carril.

**Archivos existentes que tocás:** solo dentro de `src/modules/procedures_perioperative/`.
Ningún otro carril toca este módulo.

## Frontend (`mantra-core-health`)

**Archivos nuevos (no chocan con nada):**

```
src/app/core/data-access/procedures/procedures.client.ts        + .types.ts + .spec.ts
src/app/features/clinical-record/patient-chart/procedures-block/procedures-block.ts + .html + .css + .spec.ts
```

Un solo bloque cubre los dos casos (quirúrgico y odontológico) con una vista de línea de tiempo:
caso → pasos → hallazgos → implantes/equipos → notas. Si la parte odontológica del backend no
está lista cuando llegues a esa parte del frontend, construí igual la pantalla y dejala detrás
de un estado vacío explícito ("sin datos odontológicos todavía") en vez de bloquear el resto del
carril — es el mismo criterio que ya usa el repo para secciones cuyo `GET` no existe todavía
(`availability: 'planificada'` en `navigation.map.ts`).

**Archivos existentes que tocás (siguiendo el protocolo del README):**

| Archivo | Qué agregás |
|---|---|
| `src/app/features/clinical-record/patient-chart/patient-chart.ts` (+ `.html`) | import de `procedures-block` + una entrada en el ensamblado de bloques, al final, en tu último commit |

No necesitás tocar `navigation.map.ts` ni `app.routes.ts`: este bloque vive **dentro** de la
ficha del paciente, no como sección nueva del menú — es el carril con menos fricción en archivos
compartidos, aprovechalo para llegar primero a ese punto de integración.

**Lo que NO tocás:** `medication-block/`, `diagnosis-block/`, `specialty-form-block/` (es del
carril 2), `budget-block/` (es del carril 1), la lógica de
`registrarEncuentro()`/`cerrarEncuentro()`, y todo `redsat/`.

## Definición de hecho

- Desde la ficha de un paciente que tuvo una cirugía registrada en el backend, se ve su
  histórico de procedimientos con equipo, hallazgos e implantes.
- Existe al menos un flujo de registro odontológico end-to-end (crear → ver en el histórico),
  aunque sea mínimo.
- `yarn lint` · `yarn typecheck` · `yarn test` · `yarn build` en frontend; `yarn lint` ·
  `yarn typecheck` · `yarn test` · `yarn test:integration` en backend.
