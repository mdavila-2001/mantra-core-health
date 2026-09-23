# Plan — Correcciones de receta en mockup

- Fecha: 2026-09-21 · Repositorio: `mantra-core-health` · Base: `mockup` · Rama: `justin/correcciones-receta-mockup`
- Resultado observable: la médica registra una receta sin descarga, demo ni favoritos; escribe libremente dosis y motivo; las opciones finitas usan selects; la frecuencia manual sigue disponible.
- Fuente: `AlovidaPromptManager/repartos/2026-09-20/PromptNoche/Justin/Noche-CorreccionesDoctor.Receta/RecetaLimpiaMotivoDosisYPosologia.md`.
- Kill-test: si al abrir la receta hay una petición a `prescription-favorites`, un botón de descarga o un control Unidad, H2/H4 no están hechos.

## Alcance

- IN: `medication-block/**`, y retirar `prescription-favorites/**` sólo si el scan confirma cero consumidores de producción.
- OUT: `consultation/**`, `core/mock/**`, `shared/**`, API y datos clínicos de frecuencia inventados.
- Ambigüedades: C-20 dependía de que Ender publique y documente una clave de propiedad. #559 publicó `default_frequency`; la receta la consume sin inventar valores y conserva el texto manual.

## H1 — Línea de base
**CA:** Dado el worktree, cuando se inicia el lote, entonces existe un SHA, baseline y evidencia de la superficie previa.  
**DoD:** `corepack yarn test --include=src/app/features/clinical-record/patient-chart/medication-block/medication-block.spec.ts --watch=false` ejecutado.  
**Estado:** HECHO

### H1.S1 — Preparación
**CA:** La rama sale de `mockup` y el entorno tiene dependencias instaladas. **DoD:** `git status --short --branch` y `corepack yarn --version`. **Estado:** HECHO

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H1.S1.M1 | Crear worktree y rama | Rama aislada desde mockup | `git worktree list` | HECHO |
| H1.S1.M2 | Instalar dependencias inmutables | Yarn puede resolver scripts | `corepack yarn install --immutable` | HECHO |

## H2 — Retirar caminos no clínicos
**CA:** La receta no ofrece descarga, demo ni favoritos y no consulta favoritos.  
**DoD:** spec dirigido RED→GREEN y scan sin consumidores.  
**Estado:** HECHO

### H2.S1 — UI y dependencias
**CA:** Los tres caminos desaparecen sin alterar firma ni emisión. **DoD:** test de DOM y red. **Estado:** HECHO

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H2.S1.M1 | Retirar descarga | No existe emisor en el bloque | spec dirigido | HECHO |
| H2.S1.M2 | Retirar demo | No existe barra de presets | spec dirigido | HECHO |
| H2.S1.M3 | Retirar favoritos | No hay UI ni GET de favoritos | spec dirigido | HECHO |

## H3 — Motivo y opcionalidad
**CA:** Se puede registrar motivo libre y el campo “para qué” no bloquea la receta.  
**DoD:** cuerpos de petición dirigidos en verde.  
**Estado:** HECHO

### H3.S1 — Contrato de indicación
**CA:** El cuerpo conserva diagnóstico o motivo cuando existen y omite ambos cuando no. **DoD:** spec dirigido. **Estado:** HECHO

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H3.S1.M1 | Habilitar motivo libre | Campo sin diagnóstico previo | spec dirigido | HECHO |
| H3.S1.M2 | Hacer opcional “para qué” | Cuerpo válido sin indicación | spec dirigido | HECHO |

## H4 — Dosis en texto
**CA:** La dosis siempre es texto y la unidad no viaja ni se edita.  
**DoD:** spec con catálogo y sin catálogo en verde.  
**Estado:** HECHO

### H4.S1 — Forma de la receta
**CA:** `doseText` conserva literalmente el valor escrito. **DoD:** inspección de request. **Estado:** HECHO

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H4.S1.M1 | Mostrar dosis siempre | Campo accesible en ambos casos | spec dirigido | HECHO |
| H4.S1.M2 | Retirar unidad | Sin control ni `unitConceptId` | spec dirigido | HECHO |

## H5 — Frecuencia de catálogo
**CA:** Una propiedad publicada completa la frecuencia; sin contrato publicado la entrada manual sigue funcionando.  
**DoD:** tres niveles (válido, ausente, malformado) o bloqueo con evidencia.  
**Estado:** HECHO

### H5.S1 — Contrato externo
**CA:** La clave proviene de Ender, no se infiere. **DoD:** búsqueda y registro. **Estado:** HECHO

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H5.S1.M1 | Localizar clave publicada | Existe propiedad documentada o bloqueo exacto | `rg` en repos y prompt | HECHO |
| H5.S1.M2 | Aplicar sólo contrato publicado | La frecuencia se completa desde `default_frequency` y respeta el texto manual | spec dirigido y reporte | HECHO |

## H6 — Selects, acciones y cierre
**CA:** Las opciones finitas usan selects y el cambio termina con gates, navegador y reporte.  
**DoD:** tests, lint, typecheck, build, arquitectura y evidencia de navegador.  
**Estado:** HECHO

### H6.S1 — Controles existentes
**CA:** Frecuencia y duración eliminan chips de elección sin retirar texto manual. **DoD:** spec dirigido. **Estado:** HECHO

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H6.S1.M1 | Convertir opciones a select | Controles existentes reutilizados | spec dirigido | HECHO |
| H6.S1.M2 | Verificar acciones de lista | Sin duplicar shared | spec dirigido | HECHO |

## Riesgos y bloqueos previstos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| C-20 sin contrato de Ender | No se puede autocompletar frecuencia | Mantener frecuencia manual y registrar bloqueo |
| Descarga alternativa en `consultation/**` | C-15 no puede acreditar ubicación alternativa | Retirar sólo el emisor propio y declarar el límite |
| Menú estándar depende de Itzan | C-06 no se puede aplicar sin tocar shared | Reusar si está disponible; si no, registrar bloqueo |

## Evidencia

- `corepack yarn stock:generate`: regeneró el índice local requerido por el runner antes de compilar.
- `corepack yarn test --include=src/app/features/clinical-record/patient-chart/medication-block/medication-block.spec.ts --watch=false`: 48/48 en verde.
- `corepack yarn lint`, `corepack yarn typecheck` y `corepack yarn build`: en verde; el build conserva advertencias de presupuesto y componentes ajenos.
- Chromium, mockup, cuenta Médica: `playwright/mockup-barrido.spec.ts --grep "Médica"` en verde (ficha clínica incluida, sin errores de consola ni peticiones fallidas). El servidor local se detuvo al finalizar.
- Suite completa: 6.799/6.828 pruebas en verde; 29 fallos preexistentes y ajenos en registro profesional, contabilidad, resumen, perfil profesional y dashboard.
- C-20 quedó bloqueado en el corte original porque Ender todavía no había publicado una clave de frecuencia. `default_frequency` se publicó después en #559; la receta la consume desde la ficha de terminología sin inferir valores, descarta respuestas tardías y conserva cualquier texto manual existente. La prueba dirigida actual da 55/55 en verde.
