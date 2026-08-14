# Carril 4 · Registro de laboratorios e imagenología

**Punto del reclamo:** 10. **Repos:** backend + frontend, los dos.
**Rama sugerida:** `carril-4/laboratorios-imagenologia` en ambos.
**Coordinación:** ver `CARRILES-2026-08-14-README.md` antes de tocar cualquier archivo
compartido, y postear tu bloque en `COORDINACION-AGENTES.md` antes de empezar.

## Lo que ya existe, y por qué no alcanza (evidencia de la auditoría)

- El backend tiene el módulo `diagnostics` con **4 controllers reales y 20 endpoints**:
  `diagnostics-lab.controller.ts` (5), `diagnostics-imaging.controller.ts` (6),
  `diagnostics-reports.controller.ts` (4), `diagnostics-specimens.controller.ts` (5), todos en
  `redesa-api/src/modules/diagnostics/controllers/`. Además existe `diagnostic_units`
  (equipamiento, sitios y acreditaciones de las unidades diagnósticas).
- El frontend no tiene nada: `grep -rli "laboratorio|imagenolog|diagnostics|imaging|specimen"`
  sobre `src/app/core/data-access` y `src/app/features` (excluyendo `redsat/`, que es maqueta)
  → 0 resultados reales.
- El cliente pidió explícitamente que funcione **"tal cual como cualquier cita médica pero
  digital"** — es decir, no alcanza con un formulario suelto: tiene que tener el mismo patrón de
  solicitud → agenda/registro → resultado que ya tiene el flujo de `scheduling`.

## Backend (`mantra-core-health-redesa-api`)

Con 4 controllers y 20 endpoints ya construidos, **es probable que este carril sea casi
enteramente frontend**. Tu primer paso de backend es de verificación, no de escritura:

1. Leé los 4 controllers y confirmá qué le falta a cada endpoint para que el frontend arme el
   flujo completo — en particular:
   - ¿`diagnostics-lab`/`diagnostics-imaging` aceptan crear una **orden** vinculada a un
     `encounterId` o `patientId`? Si el alta de orden no existe todavía (solo lectura), es la
     extensión de backend de este carril.
   - ¿`diagnostics-reports` tiene un `GET` filtrable por paciente, para mostrar el histórico de
     resultados en la ficha?
2. Si falta alguno de esos dos, extendé:

```
src/modules/diagnostics/controllers/diagnostics-lab.controller.ts       (extender, no reescribir)
src/modules/diagnostics/controllers/diagnostics-imaging.controller.ts   (extender, no reescribir)
src/modules/diagnostics/controllers/diagnostics-reports.controller.ts   (extender, no reescribir)
```

Si necesitás una columna nueva para vincular orden ↔ encuentro y no existe, no la agregues a
mano — es el mismo caso de la advertencia del README de carriles: avisá el bloqueo en
`COORDINACION-AGENTES.md`.

**Archivos existentes que tocás:** solo dentro de `src/modules/diagnostics/`. Ningún otro
carril toca este módulo.

## Frontend (`mantra-core-health`)

**Archivos nuevos (no chocan con nada):**

```
src/app/core/data-access/diagnostics/diagnostics.client.ts       + .types.ts + .spec.ts
src/app/features/diagnostics/diagnostics.ts                      + .html + .css + .spec.ts
src/app/features/diagnostics/diagnostics-order/diagnostics-order.ts + .html + .css + .spec.ts
```

Mirá `src/app/features/agenda/agenda.ts` y `booking-new.ts` como referencia directa de patrón —
el cliente pidió textualmente que esto funcione "como cualquier cita médica", así que reusar esa
forma (no el código, el patrón: solicitar → confirmar → ver resultado) es lo que hace que la
pantalla se sienta consistente con el resto del producto.

**Archivos existentes que tocás (siguiendo el protocolo del README):**

| Archivo | Qué agregás |
|---|---|
| `src/app/core/navigation/navigation.map.ts` | una fila nueva, grupo **Atención** (mismo grupo que Agenda y Archivo clínico), roles reales que confirmes contra los `@Roles` del backend |
| `src/app/app.routes.ts` | ruta de la sección nueva |
| `src/app/features/clinical-record/patient-chart/patient-chart.ts` (+ `.html`) | import de un bloque de histórico de diagnóstico + una entrada en el ensamblado, al final, en tu último commit |

**Lo que NO tocás:** `agenda.ts`/`booking-new.ts` (los leés como referencia, no los editás),
`medication-block/`, `diagnosis-block/` (ojo: es distinto de tu `diagnostics/` — no es el mismo
archivo ni el mismo dominio, no lo confundas ni lo toques), `specialty-form-block/` (carril 2),
`budget-block/` (carril 1), `procedures-block/` (carril 3), y todo `redsat/`.

## Definición de hecho

- Se puede solicitar un laboratorio o estudio de imagenología para un paciente con el mismo
  nivel de fricción que reservar una cita.
- El resultado, cuando existe, se ve desde la ficha del paciente.
- `yarn lint` · `yarn typecheck` · `yarn test` · `yarn build` en frontend; `yarn lint` ·
  `yarn typecheck` · `yarn test` · `yarn test:integration` en backend.
