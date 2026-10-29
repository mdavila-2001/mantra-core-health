---
name: alovida-ui-componentes
description: Cómo se organizan y reutilizan los componentes en ALOVIDA — átomos/moléculas/organismos de `src/app/shared/components` en Angular y `lib/shared/` en Flutter, contenedor vs presentacional, entradas con señales, y descubrir antes de crear. Usar antes de escribir cualquier componente nuevo en el front o la app, al revisar un PR que agrega uno, o cuando dos componentes hacen casi lo mismo.
---

# Componentes en ALOVIDA

Portada de `atlas-ui-componentes` (allí RN/Next; aquí Angular standalone con señales y Flutter).
Referencia viva: `docs/components/catalog.md`, `composition-rules.md`, `forms.md`, `props-and-events.md`
y el skill del front `project-design-system`.

## 1. Primero buscar. Casi siempre ya existe

Front (`src/app/shared/components/`, barril `src/app/shared/index.ts`, selectores `app-*`):
- **atoms**: `button`, `input`, `select`, `textarea`, `checkbox`, `radio`, `switch`, `badge`, `chip`,
  `avatar`, `spinner`, `skeleton`, `progress`, `tooltip`, `link`, `divider`, `back-link`, iconos por dominio.
- **molecules**: `form-field`, `card`, `dialog`, `tabs`, `toast`, `alert`, `accordion`, `empty-state`,
  `concept-select`, `reference-combobox`, `phone-input`, `search-field`, `pagination`, `stepper`,
  `segmented-control`, `row-actions`, `menu`, `breadcrumb`, `fact-list`, `file-input`…
- **organisms**: `data-table`, `filter-bar`, `page-header`, `form-section`, `form-actions`,
  `paginated-form`, `view-state-host`, `shell`, `side-nav`, `header`, `date-picker`, `content-dialog`,
  `directory-page`, `encounter-timeline`, `tree-select`, `tutorial-overlay`…

Flutter (`lib/shared/`, barril `shared.dart`): `atoms/` (avatar, badge, button, checkbox, chip, input,
radio, select, skeleton, switch…), `molecules/` (alert, card, empty_state, form_field, date_picker,
concept_picker, triage_badge…), `organisms/` (app_bar, bottom_nav, bottom_sheet, dialog, search_bar,
timeline), `tone/mantra_tone.dart`, `form_control/`. Prefijo `Mantra*`.

**Si algo "casi" sirve, se parametriza; no se copia.** Grep antes de crear; el inventario se regenera con
`node scripts/generate-component-index.mjs` (`component-stock`).

## 2. Capas (check-architecture.mjs las vigila)

- Dirección: features → shared → core (`shared/` NUNCA importa de `features/`; excepción declarada: `core/dev/`). Las peticiones HTTP
  solo viven en `core/data-access/`. Hoy hay 1 ciclo y 6 imports contra la dirección (ver informe).
- Lo que no aparece en `shared/index.ts` es interno: no se importa desde fuera.
- **Los organismos reciben, no averiguan**: reciben datos por `input()`; el contenedor de `features/`
  consulta y decide qué pasa al pulsar.

## 3. Contrato de un componente Angular

- Standalone, `ChangeDetectionStrategy.OnPush`, entradas `input()`/`input.required()`, salidas
  `output()`, estado con `signal()`/`computed()`; plantilla con `@if/@for` (con `track`).
- Entradas semánticas (`tone`, `variant`, `size`), nunca `color` ni `margin`.
- Campo ↔ control: `app-form-field` provee `controlId/labelId/describedBy`; el control consume y
  declara `controlLabelable` (`composition-rules.md` §2). Los ids son estables entre servidor y cliente (SSR).
- Estados no opcionales: toda vista con datos usa `ViewState<T>` (los nueve estados M34,
  `docs/adr/ADR-0005-view-state-m34.md`; S3 exige próxima acción) vía `app-view-state-host`.
- **Cambiar la firma de un componente compartido es un barrido.** Nunca `input.required` para "forzar"
  una regla: obliga a editar todos los usos a la vez. Buscar todos los sitios de llamada primero.
- Accesibilidad es contrato: `shared/components/a11y-gate.spec.ts` y `a11y.spec.ts`; en Flutter
  `test/a11y_contract_test.dart` (ninguna pieza entra muda a `Semantics`).

## 4. Reglas de UI obligatorias (skill `alovida-ui`)

Campos con icono a la izquierda (parámetro requerido, no opcional), formularios ≥ 2 columnas salvo
`/auth`, pestañas centradas a ancho completo, cero cards laterales, catalogables en `select` desde el
catálogo de la API (nunca listas a mano en la plantilla). Un cambio sobre un registro existente que pide
datos va en modal (`composition-rules.md` §6).

## 5. Un componente nuevo, paso a paso

1. Buscar (grep en `shared/components` y `features/`); si casi existe, parametrizar.
2. Escribirlo con tokens (`alovida-estilo-front`), sin literales.
3. Definir estados (vacío, cargando, error, sin permiso) antes del feliz.
4. Nombre/rol accesible, foco, área táctil.
5. Spec junto al `.ts` (`ng test --include=<spec>` para acotar). Exportar en el barril solo si es reutilizable.
6. Capturas claro/oscuro, 390 y 1440; `yarn gates:diseno`.

## Checklist
- [ ] Busqué antes de crear.
- [ ] Props semánticas; sin estilos entrantes.
- [ ] Vacío/cargando/error/sin permiso presentes.
- [ ] Accesible y con spec; barril actualizado si aplica.
- [ ] Si cambié una firma compartida, revisé TODOS los usos.
