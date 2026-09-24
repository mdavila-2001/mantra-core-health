# Mapa de endpoints simulados — para Pablo, Justin y Marcelo (H1.S3)

Corte: `ender/noche-2026-09-20-contratos-panel` desde `origin/mockup` @ `68dcb562`. Contrato real
citado contra `origin/dev` de `mantra-core-health-api` @ `c2c071a4`.

## Para Pablo (excepciones, tipos de bloqueo, cupos, actividad)

| Necesita | Ruta simulada | Manejador | Equivalente real |
|---|---|---|---|
| Tipos de bloqueo (lista cerrada de 7) | `GET /scheduling/exception-types` | `scheduling.handlers.ts:557` | `GET /scheduling/exception-types`, `EXCEPTION_TYPES` en `scheduling-catalog.dto.ts:735` |
| Crear excepción (bloqueo u horario extra) | `POST /scheduling/resources/:id/exceptions` | `scheduling.handlers.ts:571` | Mismo path real. **Esta noche se agregó el rechazo de tipo inválido y de franja inválida (422)** — antes el doble era más permisivo que la API |
| Editar excepción | `PATCH /scheduling/exceptions/:id` | `scheduling.handlers.ts:603` | Mismo path real. También rechaza tipo inválido ahora |
| Listar excepciones de un recurso | `GET /scheduling/resources/:id/exceptions` | `scheduling.handlers.ts:561` | Mismo path real. **No trae `exceptionType`** (lo saca a propósito el manejador) — usar `reasonLabel` |
| Cerrar cupos por bloqueo | `POST /scheduling/resources/:id/close-slots` | `scheduling.handlers.ts:526` | Mismo path real |
| Tipos de actividad (otras atenciones) | `GET /scheduling/activity-types` | `scheduling.handlers.ts:547` | `ACTIVITY_TYPES` en `scheduling-catalog.dto.ts:921` |
| Cupos / disponibilidad | `GET /scheduling/slots` | `scheduling.handlers.ts:148` | Mismo path real. **`cupos` NO persiste entre F5** (hallazgo H1.S2.M3) |

## Para Justin (ficha de concepto y sus propiedades)

| Necesita | Ruta simulada | Manejador | Equivalente real |
|---|---|---|---|
| Ficha de un concepto (medicamento) | `GET /terminology/concepts/:id` | `terminology.handlers.ts:209` | Mismo path real. **Esta noche se agregó `properties`** (no existía) |
| Propiedades del concepto | `ficha.properties` (mapa código→valor) | ídem | `ConceptDetailDto.properties` en `search-concepts.dto.ts` |
| Frecuencia por defecto (clave nueva) | `ficha.properties.default_frequency` (string) | `fixtures/conceptos.ts` (`declararPropiedades`) | **No existe en la API real** — extensión declarada del simulador (regla 65), ver `evidencia/h4-tres-niveles.txt` |
| Leerla sin romper si falta/está mal formada | `valorDeTexto(ficha.properties, 'default_frequency')` | `core/data-access/terminology/terminology.types.ts` | — (sólo del simulador/data-access) |
| `dose_forms` / `strengths` | **NO publicados todavía** en ningún concepto del simulador | — | Sí existen en el vademécum real (`vademecum.dataset.json`), pero el simulador no los carga — fuera del alcance de esta noche (H4 sólo pedía la frecuencia) |

## Para Marcelo (notas, episodios, formularios — su cuadrícula)

| Necesita | Qué existe | Qué NO existe |
|---|---|---|
| Notas libres de un paciente | `GET/POST /charts/patients/:id/chart` (`clinical.handlers.ts:240`) — ya filtra por `puedeLeer()` | — |
| Episodios de cuidado | `careEpisodes` dentro de `GET /clinical/patients/:id/summary` (`clinical.handlers.ts:222`) | Un endpoint propio para escribir una fila estructurada de cuadrícula (formulario tabular) — **no se buscó a fondo esta noche por estar fuera de mi alcance**; el candidato más cercano es el módulo `forms`/`surveys`, que Marcelo tiene que evaluar él mismo |
| Dónde persistir su cuadrícula | — | **Si su formato no es una nota de texto libre, hoy no hay dónde guardarlo en el simulador.** Esto es exactamente el hallazgo que ordena su lote (según su propio encargo); no lo resolví por mí, lo dejo señalado |

## Otros hallazgos de esta noche que afectan a los cuatro

- `puedeLeer()` (`clinical.handlers.ts:43-51`) ya bloquea correctamente al visitador (`MEDICAL_VISITOR`)
  de cualquier pantalla clínica — verificado en runtime (H3.S3), no sólo leído.
- `reservaVisible()` (`scheduling.handlers.ts:48`) tiene un fallback permisivo para cualquier
  usuario sin `patientProfileId` ni `practitionerProfileId` (incluye admin/superadmin por diseño,
  pero también cualquier rol futuro con esa misma forma). No se tocó esta noche — es una decisión
  de diseño existente, no un bug de mi lote — pero queda registrado por si alguien agrega un rol
  nuevo sin perfil que no debería ver toda la agenda.
- El spec de seguridad del simulador entero sigue en verde tras los cuatro cambios de esta noche:
  `mock-backend.spec.ts` 21/21, y con los 3 specs nuevos (scheduling, pharma-lab, terminology) el
  total es 48/48 — ver `evidencia/h4-tres-niveles.txt`.
