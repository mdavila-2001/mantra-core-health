# Reporte — Test del sector 17 al día con su activación

> **AVANCE: 1 / 1 — 100 %.**

- Fecha: 2026-10-28 · Rama: `claude/lucid-volta-46naf7` (desde `dev` en `d49b53479`)
- Peldaño de evidencia: `TESTED` (cambio sólo de prueba; no hay superficie de UI).

## Contexto

`b41707d7b` (#1498) activó el sector 17 (Hospitales/Clínicas) en el simulador SIAT y
actualizó `invoice-xml.spec.ts`, pero no `siat-simulated.adapter.spec.ts`, que seguía
esperando el rechazo 940 («El NIT No Tiene Habilitado El Documento Sector»). Desde ese merge
`dev` tenía esta prueba en rojo:

```text
FAIL  siat-simulated.adapter.spec.ts > … > sector 17 (preparado, no activo · CA-1) → 940; sector desconocido → 931
AssertionError: expected [ 939 ] to include 940
```

El simulador hace lo correcto: el sector 17 está activo y el NIT de prueba lo tiene
habilitado, así que la solicitud pasa la validación y la factura (de compraventa) se mide
contra el XSD de Hospitales/Clínicas: 939, «no cumple el XSD».

## Completado

| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.S1.M1 | La prueba refleja el sector 17 activo y conserva la rama 940: (a) NIT con el 17 habilitado → `[939]`; (b) NIT sin el 17 habilitado → `[940]`; sector desconocido → 931 | `ng test --include src/app/core/mock/siat-sim` | 4 archivos, 52 pruebas en verde |

## A medias

Ninguna.

## Pendiente

Ninguna.

## Evidencia

```text
$ npx ng test --watch=false --include src/app/core/mock/siat-sim
 Test Files  4 passed (4)
      Tests  52 passed (52)

# Prueba de que el caso 940 detecta algo: se quitó del simulador el chequeo de
# `sectoresHabilitados` (cambio temporal, revertido con git checkout):
       × sector 17 sin habilitar en el NIT → 940; sector desconocido → 931
      Tests  1 failed | 22 passed (23)

$ npx eslint src/app/core/mock/siat-sim/siat-simulated.adapter.spec.ts   → exit 0
$ yarn typecheck                                                          → exit 0
```

## No cubierto

- La suite completa no se corrió de una vez: en este contenedor `ng test` se queda sin
  memoria. En la corrida previa por tandas sobre `dev` (`7c9b41257`) esta era la única
  prueba roja (12 953 / 12 954).
- No hay prueba de una factura válida del sector 17 aceptada de punta a punta (908) en
  `siat-simulated.adapter.spec.ts`: armarla exige el detalle completo de Hospitales/Clínicas
  y queda fuera de este arreglo.

## Desvíos del plan

Ninguno.

## Riesgos residuales

Ninguno nuevo.

## Decisiones y ambigüedades

- Se tomó como correcto el comportamiento del simulador (sector 17 activo, decisión de #1498)
  y se ajustó la prueba, por indicación del propietario.
