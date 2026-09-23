# ADR-0015: Toda tabla con acciones de edición sigue la misma disciplina — modal, confirmación, barra, paginación y sin scroll lateral

## Estado

**Aceptado** — 2026-09-22 (con corte propio reconsultado el 2026-09-23, `origin/mockup@8ae7283a`).
Extiende [ADR-0012](ADR-0012-botones-con-texto-y-acciones-de-fila.md) (acciones de fila) y
[ADR-0013](ADR-0013-opciones-en-select.md) (elegir de una lista → `select`); no reemplaza ninguna
de las dos.

## Contexto

El doctor lo pidió como guía de trabajo permanente, no como un pedido puntual (D-04, D-08 de
`docs/requisitos/CORRECCIONES-DOCTOR-Y-PACIENTE-2026-09-22.md`): *"TOMALO COMO GUIA DE TRABAJO A
PARTIR DE AHORA"* y *"siempre"*. Eso convierte el pedido en una regla de la casa, no en un ítem de
alcance de un carril.

Medición sobre el corte propio (`origin/mockup@8ae7283a`, 2026-09-23):

```text
$ git grep -l '<app-data-table' origin/mockup -- 'src/app/**/*.html' | wc -l
30
$ git grep -n 'dialogs.confirm(' origin/mockup -- 'src/app/**/*.ts' ':!*.spec.ts' | wc -l
41  (40 sitios de llamada reales; 1 es el ejemplo del comentario de `dialog-service.ts`)
```

**Ninguna de las 40 llamadas reales confirma un guardado de formulario** — todas confirman retiro,
descarte, cierre o una decisión de flujo (inventario completo en
`docs/trabajo/2026-09-22-pablo-disciplina-tablas/evidencia/antes/confirmaciones.md`). La pieza
`confirmarCambios()` que la regla 3 de abajo necesita **no existe todavía**:

```text
$ git grep -c 'confirmarCambios' origin/mockup -- 'src/app/shared/components/molecules/dialog/*.ts'
(0 coincidencias)
```

Verificado en navegador (no sólo leído), contra la cuenta `medica@alovida.mock` en «Dónde atiendo»
(`docs/trabajo/2026-09-22-pablo-disciplina-tablas/evidencia/antes/capturas/`):

- «Acciones → Editar» sobre el consultorio propio **inyecta el formulario «Corregir tu consultorio»
  dentro del `tabpanel`, debajo del `<ul>` de sedes** — no en un modal. Éste es exactamente D-04.
- «Dejar de atender» **sí** abre un diálogo de confirmación («Dejar de atender acá», Cancelar /
  Retirar). Guardar, en cambio, no pide nada — sólo hay un botón «Guardar los cambios» sin
  confirmación previa.

## Fuerzas y restricciones

- Un formulario que nace de una fila de tabla compite por espacio con la propia tabla: si se
  inyecta en línea, empuja las filas de abajo y dificulta ver qué se estaba editando (D-04).
- Guardar sin confirmación es reversible en la mayoría de los casos, pero **el consultorio propio
  es único por persona** (`POST /practitioners/me/sites` "crea —o reutiliza—"): un guardado
  accidental sin confirmación corrige el único registro que existe, sin aviso.
- `data-table` tiene **30** consumidores, `filter-bar` **8**, `pagination` **3** — medidos sobre el
  corte propio. Ningún cambio a estas piezas puede tocar su comportamiento por omisión (regla 95.1).
- `data-table` pagina por cursor (`CONTRATO-data-table.md` §"Contrato de paginación"), documentado
  dos veces en el propio código porque **un cursor no conoce el total**. `app-pagination` sí conoce
  el total (`totalItems` es `input.required`). Las dos piezas resuelven paginación de forma
  distinta a propósito — no son intercambiables sin perder esa garantía.
- El 18/09/2026 alguien fijó `sticky: 'end'` en `data-table.types.ts:24-27` porque una tabla más
  ancha que la pantalla escondía las acciones detrás de un scroll lateral que nadie descubría. Ese
  motivo era correcto entonces y el código que lo resolvió sigue sirviendo — lo que cambia es que
  el doctor ahora pide que **no haya** scroll lateral en absoluto.

## Decisión

### Regla 0 — D-04, la regla madre: todo formulario que nace de una acción de tabla va en un modal

Alta, edición o cualquier formulario que se abre desde una fila o desde el encabezado de una tabla
(«Añadir», «Editar», «Corregir») se monta en `app-content-dialog`, nunca en línea debajo de la
lista. La tabla no cambia de alto ni empuja contenido cuando se abre un formulario de sus filas.

**Pieza:** `app-content-dialog` (Marcelo). **Excepción:** ninguna — es la regla que las otras siete
instrumentan.

### Regla 1 — Editar abre el modal con los campos ya llenos

El modal de edición nace con el borrador inicializado desde el registro que se está editando, campo
por campo. Nunca arranca vacío para después completarse.

**Pieza:** el formulario dentro del `app-content-dialog`, con un borrador (`signal`/`computed`)
sembrado desde la fila. **Excepción:** ninguna.

### Regla 2 — Guardar se habilita sólo cuando algo cambió

El botón de guardar de un modal de edición arranca deshabilitado y se habilita cuando el borrador
difiere del original — nunca sólo por validez. Abrir «Editar» y guardar sin tocar nada no hace
nada.

**Pieza:** un `computed` que compara borrador contra original (regla `angular-signals-state`: sin
`effect`, porque no hay un side-effect que sincronizar, hay una comparación). **Excepción:** el
formulario de alta (no hay «original» contra qué comparar): ahí manda la validez, como hoy.

### Regla 3 — Guardar pide «¿Confirmás estos cambios?»

Antes de persistir una edición, se confirma con un diálogo de confirmación
(`dialogs.confirm({ title: '¿Confirmás estos cambios?', … })`). Cancelar vuelve al modal sin perder
el borrador, con el foco en el botón Guardar.

**Pieza:** `confirmarCambios()`, que Marcelo publica sobre `DialogService` (hoy no existe — ver
Contexto). **Excepción declarada mientras no llegue:** se llama a `dialogs.confirm()` tal como
existe hoy, con el mismo título y textos, y se declara en el reporte que se está usando el
mecanismo genérico en vez del dedicado (regla 65 — aislar y simular).

### Regla 4 — Eliminar o retirar pide confirmación

Ya es el comportamiento medido hoy en 40 de 40 sitios reales de `dialogs.confirm(` — esta regla lo
fija como obligatorio hacia adelante, no lo cambia. Ningún alta de esta disciplina reduce esa
cobertura.

**Pieza:** `dialogs.confirm()`, como hoy. **Excepción:** ninguna.

### Regla 5 — Barra arriba: buscador multicampo, filtros por value set, «Añadir» a la derecha

Encima de la tabla va `app-filter-bar` con: un buscador con debounce de 300 ms que el consumidor
resuelve contra los campos que declare (multicampo, normalizado por acentos y mayúsculas); filtros
por value set cerrado (ADR-0013: elegir de una lista → `select`, salvo que el propio ADR-0013 pida
chips); y, al final de la fila de controles, el botón de alta — proyectado, alineado a la derecha
en escritorio y debajo del resto en móvil.

**Pieza:** `app-filter-bar`, con una proyección nueva para la acción (hoy no existe — ver H3.S3 del
plan). **Excepción:** una tabla sin alta posible (sólo lectura) omite el hueco de la acción; sigue
llevando buscador y filtros si el listado los necesita.

### Regla 6 — Scroll sólo vertical

Una tabla que no entra en su caja se desplaza **verticalmente**, nunca lateralmente. Lo que no
entra a lo ancho se pliega a la fila de detalle por prioridad — el mecanismo que `data-table` ya
usa en móvil (`MOBILE_DETAIL_PRIORITY`, `data-table.ts:50-51`), extendido a escritorio cuando la
opción de alto máximo está activa.

**La razón del 18/09/2026 no se borra, se acota.** `sticky: 'end'` seguía siendo necesario cuando
la tabla **tenía** scroll lateral, para que las acciones no quedaran escondidas detrás de un
desplazamiento que nadie descubría. Con scroll lateral **eliminado** por esta regla, `sticky: 'end'`
queda sin efecto práctico — no hace falta fijar una columna al borde de un desplazamiento que ya no
existe. El comentario de `data-table.types.ts:24-27` pasa a citar las dos fechas y las dos razones,
sin borrar la primera.

**Pieza:** `data-table`, input nuevo de alto máximo (H3.S2), opt-in y apagado por omisión.
**Excepción:** ninguna tabla que adopte el patrón nuevo debería necesitar scroll lateral; una que
lo necesitara señalaría un problema de diseño de columnas, no un caso a soportar.

### Regla 7 — Paginación abajo a la derecha, con número y selects

Debajo de la tabla, alineado a la derecha: botones Anterior/Siguiente **con texto** (no sólo
ícono — D-05, ver ADR-0012 §3, la excepción exige `aria-label` + globo y acá directamente sobra
texto visible), números de página, y dos `app-select`: uno para saltar a una página y otro para el
tamaño de página.

**Pieza y decisión de fondo — ver "Paginación: cliente vs. cursor" más abajo.**

## Paginación: cliente vs. cursor (Q-5)

Dos familias de listado conviven en el producto, y no se resuelven igual:

1. **Listas locales**, todo el conjunto ya está en memoria del cliente (por ejemplo, «Dónde
   atiendo»: como mucho unas pocas sedes por persona). Ahí `app-pagination` en cliente cumple la
   regla 7 entera: conoce el total, puede mostrar números y selects.
2. **Listas por cursor de la API**, donde el backend no entrega el total a propósito (para no
   contar la tabla entera en cada página — `data-table.types.ts:49-56`). Ahí sigue paginando el
   cursor del organismo `data-table`, con Anterior/Siguiente — **sin números ni select de página**,
   porque no hay un total del que salgan.

**Esta ADR no reemplaza la paginación por cursor.** Decide *cuándo* se usa cada una: local y
acotado → `app-pagination`; remoto y por cursor → el paginador interno de `data-table`. Las
pantallas que hoy usan `data-table` con cursor (30 consumidores medidos) siguen exactamente igual;
lo que cambia es que un consumidor **nuevo** con datos locales usa `app-pagination`, no reinventa
un paginador propio.

## Consecuencias

**A favor**

- Un solo lugar (`app-content-dialog` + `dialogs.confirm`) resuelve alta, edición y confirmación en
  cualquier tabla del producto — coherente con lo que ya existe para retiro/descarte.
- La tabla deja de crecer o empujar contenido cuando se edita una fila.
- `app-pagination` gana lo que le faltaba (texto en Anterior/Siguiente, select de página) sin tocar
  el paginador por cursor que 30 pantallas ya usan.

**En contra**

- `confirmarCambios()` no existe todavía (Marcelo la publica); mientras tanto se simula con
  `dialogs.confirm()` genérico, declarado (regla 65).
- El buscador multicampo y la proyección de la acción en `filter-bar` son piezas nuevas: hasta que
  se publiquen (H3.S3), ningún consumidor puede adoptar la regla 5 completa.
- Dos paginadores (`app-pagination` y el cursor de `data-table`) exigen que cada consumidor nuevo
  elija correctamente cuál le corresponde — no hay una única pieza que decida por él.

**Neutro**

- Ningún átomo, molécula ni organismo existente cambia su comportamiento por omisión. Todo lo que
  esta ADR agrega es opt-in (regla 95.1).

## Cómo se aplica

```html
<!-- Barra: buscador + filtros + acción a la derecha (regla 5) -->
<app-filter-bar [filters]="filtros" (filtersChanged)="recargar($event)">
  <button filter-bar-action app-button variant="primary" (clicked)="abrirAlta()">
    <svg app-icon>…</svg>
    Agregar
  </button>
</app-filter-bar>

<!-- Tabla: alto máximo, sin scroll lateral (regla 6) -->
<app-data-table
  [state]="estado()"
  [columns]="columnas"
  [trackBy]="porId"
  maxHeight="480px"
/>

<!-- Paginación local, abajo a la derecha (regla 7) -->
<app-pagination [totalItems]="total()" [(page)]="pagina" [(pageSize)]="tamano" />

<!-- Editar: modal con campos llenos, guardar por cambios, confirmación (reglas 0-3) -->
<app-content-dialog heading="Corregir tu consultorio" [open]="editando()">
  <!-- campos sembrados desde la fila -->
  <button app-button [disabled]="!hayCambios()" (clicked)="confirmarYGuardar()">
    Guardar los cambios
  </button>
</app-content-dialog>
```

## Verificación

Un cambio cumple esta decisión cuando:

1. Ningún formulario que nace de una acción de tabla se dibuja fuera de un `app-content-dialog`.
2. Abrir «Editar» y cerrar sin tocar nada no ofrece guardar habilitado.
3. Guardar con cambios pide confirmación antes de persistir.
4. Ninguno de los 30 consumidores de `data-table`, 8 de `filter-bar` ni 3 de `app-pagination` que
   no adoptó el patrón nuevo cambia de comportamiento — comprobado a mano con captura, no sólo leído.
5. Una tabla con la opción de alto máximo activa no tiene scroll lateral en ningún viewport medido.

## Referencias

- Fuente del pedido: `docs/requisitos/CORRECCIONES-DOCTOR-Y-PACIENTE-2026-09-22.md` — D-04, D-05,
  D-06, D-08, D-09.
- Verificación previa: `docs/verificacion/VERIFICACION-CONTRA-CODIGO-2026-09-22.md` — §1, §2, §3, §4.
- Evidencia propia de esta noche: `docs/trabajo/2026-09-22-pablo-disciplina-tablas/evidencia/antes/`.
- Extiende: [ADR-0012](ADR-0012-botones-con-texto-y-acciones-de-fila.md),
  [ADR-0013](ADR-0013-opciones-en-select.md).
- Contrato del organismo: [`CONTRATO-data-table.md`](CONTRATO-data-table.md).
- Decisión de scroll que se acota (no se borra): `src/app/shared/components/organisms/data-table/data-table.types.ts:24-27`
  (2026-09-18, conservada con su motivo).
