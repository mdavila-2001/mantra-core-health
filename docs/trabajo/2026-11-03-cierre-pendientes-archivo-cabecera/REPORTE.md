# Cierre de pendientes de #1895 y #1897

Qué quedó abierto en esos dos PRs (ya mergeados en `dev`) y qué se pudo cerrar.
Entorno de las pruebas: maqueta `start:demo` (sin API real), Chromium, 2026-11-03.

## Cerrado

### 1. Recorridos Playwright que entraban por la carpeta

Se ejecutaron los 5 (antes solo 1). Entrar al expediente por el enlace de la fila **funciona en todos**:
llegan a la ficha, a la consulta y al encuentro. Lo que fallaba era ajeno a ese cambio y se corrigió o se declara.

| Spec | Resultado | Qué había |
|---|---|---|
| `clinica-c3-enfermedades-activas` | pasa | — |
| `clinica-c5-receta` | **pasa** | Selector del spec desfasado: `app-select` ya no es un `<select>` nativo (se agregó `support/desplegable.ts`); el regex `confirmado el` ya no calza con «· Confirmado»; el conteo absoluto de vínculos ignoraba la semilla; «Vincular» vive en el menú ⋮. Además la rama del diagnóstico confirmado **nunca corría** (leía las opciones con la lista cerrada y obtenía `[]`): ahora es obligatoria. |
| `task-27-error-flow-evidence` | 3 de 4 pasan | «interacciones fallidas…» pasa tras adaptar su helper al nuevo selector. **Rojo, sin tocar:** «el cockpit contable muestra el error…» espera el texto crudo `Simulado: fallo del servidor` y la pantalla ya no lo muestra; no pasa por el expediente. |
| `carril-insurance-antifraud-duplicates` | 6 de 7 pasan | El campo «Tipo» ya no existe (ahora sale del estudio, a propósito): se quitó ese paso y se comprueba la pista «Tipo: …». Los 4 de reclamos necesitan `PW_REPORTING_MOCK=1` (el login cae en `/portal-selector`). **Rojo, sin tocar:** «en 390×844… objetivo táctil» mide **39 px** y exige 44 (defecto real, ver abajo). |
| `infra-f5-integracion` | 3 cadenas pasan | Las 3 «Cadenas de integración» (las que usan el expediente) pasan. El grupo F5b·F5d·F5f falla en su 2ª prueba («Algo salió mal» no aparece) y, al ser `serial`, las otras 8 no corrieron: **no se corrieron**. |

### 2. «Revisar disponibilidad» de la guía

Verificado en navegador (paciente → `/directory` → «Todos los médicos» → «Revisar disponibilidad»):
la URL queda en `/directory/<id>#horarios` y «Sedes y horarios» queda a **315 px** del borde con la ventana de 720 px
(la página bajó 1442 px). Capturas: `evidencia/6-guia-revisar-disponibilidad.png`, `evidencia/7-ficha-horarios-desde-guia.png`.

### 3. El aviso del 409 distingue «pendiente» de «activo»

La API **sí los distingue**, solo que en el texto: ambos eran `ConflictException` sin `reason`, y el contrato dice que se
ramifica por `reason`, nunca por `message`. Cambio en dos partes:

- **Front (este PR):** `request-access` lee `reason`: `CARE_RELATIONSHIP_ALREADY_ACTIVE` → «Ya tiene un vínculo activo»;
  `CARE_RELATIONSHIP_REQUEST_PENDING` → «Ya pidió la vinculación»; sin `reason` (API sin actualizar) → el aviso genérico de hoy.
  Specs: 3 casos nuevos (los dos `reason` y que un reintento borre el aviso).
- **API (parche aparte, sin PR):** agrega `CARE_RELATIONSHIP_REQUEST_PENDING` al catálogo de `authz` y pasa el `reason` en los
  dos `throw` de `requestCareRelationship`. Probado en la API: servicio + contrato de errores HTTP, 64 pruebas en verde; sin el
  cambio, las 2 aserciones nuevas fallan (`Received: undefined`). **Hasta que ese parche se despliegue, la pantalla muestra el aviso genérico.**

### 4. `ng test` no compilaba en `dev`

Compila. Eran 3 specs:

- `core/data-access/adt/bed-compatibility.spec.ts` y `inpatient-indicators.spec.ts`: copias huérfanas de specs que ya viven,
  actualizados, en `core/mock/rules/` (la lógica se movió). El de cama es idéntico byte a byte; el de indicadores tiene los mismos
  títulos. **Se borraron los dos**; no se pierde cobertura.
- `support-access.provisioning.handlers.spec.ts`: un usuario de respaldo inventado que ya no cumple `MockUser`. Ahora falla con
  un mensaje claro si falta el usuario sembrado.

## Suite completa

`ng test` en un solo proceso se queda sin memoria en este contenedor (~10 GB), así que se corrió en 7 bloques que juntos cubren
los 1591 archivos de spec: **21 180 pruebas, 344 fallidas en 35 archivos**. Ninguno es de lo tocado aquí; los grandes son
`agenda.spec` (136), `appointments.spec` (104) y `practitioners-directory.spec` (42), por `listBookableOrganizations` y
`/scheduling/bookable-organizations`, de #1899. Antes de este cambio no había línea base: la suite ni compilaba.
Mis specs (request-access, tarjeta de cabecera, ficha del médico, clinical-record, support-access): 7 archivos, 76 pruebas, verde.
`tsc` (app y playwright) y `eslint` limpios sobre lo tocado.

## Sigue abierto

- **Prueba contra la API real (HTTP + base de datos): no se hizo.** Exige Postgres, Mongo, Redis y los workers, y el parche de
  la API no está desplegado en ningún lado. Se probó la API a nivel de servicio y de filtro de errores.
- **«Reservar cita» llega a los horarios, no a una hora.** Reservar necesita un `slotId` (`/agenda/book/:slotId?recurso&desde&hasta`):
  llegar a «el primer cupo» exige decidir cuál y consultar disponibilidad desde la tarjeta. Decisión de producto, sin tomar.
- Los 2 recorridos rojos propios de `carril-insurance` y `task-27`, y las 8 pruebas de `infra-f5` que no corrieron (arriba).
- Hallazgos de producto: objetivo táctil de 39 px en el diálogo de estudio duplicado a 390 px; la pista de tipo dice «Otro
  estudio» para «Hemograma completo», que la lista muestra como Laboratorio.

## Para tener en cuenta

Correr estos specs **sobrescribe capturas versionadas** de otros trabajos (`docs/progress/evidence/`,
`docs/refactor-profesional/trabajo/evidencias/`); se restauraron con `git checkout` antes de commitear.
