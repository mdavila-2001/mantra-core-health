# Contrato — `ContentDialog` (`app-content-dialog`)

> Escrito para que puedas migrar un diálogo escrito a mano **sin abrir `content-dialog.ts`**.
> Fuente: `src/app/shared/components/organisms/content-dialog/content-dialog.ts` (260 líneas),
> `.html` (74), `.css` (263), `.spec.ts`. Corte: `origin/mockup` @ `d40b5631`.
> Autor: Marcelo, noche 2026-09-21. Destinatario inmediato: Justin (sus dos diálogos crudos en
> `features/alovida/buscar/{hospitales-listado/facility-directions-dialog,
> medicamentos-listado/pharmacy-availability-dialog}`).

## 0. Identidad

| Campo | Valor |
|---|---|
| Ruta | `src/app/shared/components/organisms/content-dialog/` |
| Símbolo exportado | `ContentDialog` (también `ContentDialogSize`, tipo) |
| Selector | `app-content-dialog` (elemento) |
| Nivel atómico | Organismo |
| Ámbito | Compartido, `shared/components` |
| Versión de contrato | 1 (este documento; no hay versiones previas escritas) |

## 1. Las diez filas del §8 (contrato de composición)

| Elemento | Respuesta |
|---|---|
| **Propósito** | Marco modal genérico: título, descripción opcional, cuerpo con scroll, pie opcional de acciones, apertura/cierre, foco y la política de descarte. **Queda fuera**: guardar remoto y las reglas del formulario que vive adentro — eso es del consumidor. |
| **Partes obligatorias** | `heading` (`input.required<string>()`, línea 92). El cuerpo (`<ng-content />` por defecto) es obligatorio en la práctica — un diálogo sin contenido no tiene sentido, pero el organismo no lo impone en tiempo de compilación. |
| **Partes opcionales** | `description`, `closeLabel` (default `'Cerrar'`), `size` (default `'md'`), `dismissible` (default `true`), pie proyectado con `[dialog-actions]`. |
| **Cardinalidad** | Un título, una descripción como máximo, un cuerpo (con scroll interno), 0..1 pie de acciones. **Una sola instancia de `ContentDialog` puede estar abierta a la vez** en la práctica del repo — no hay anidamiento de `content-dialog` dentro de `content-dialog` (sí se apila `DialogService` encima, ver §5). |
| **Orden** | Título → descripción (si hay) → cuerpo con scroll → pie fijo (si hay `dialog-actions`). El pie NO scrollea con el cuerpo. |
| **Propiedad** | El organismo crea el `<dialog>` nativo, el botón de cerrar (`autofocus`) y el fondo (`::backdrop`). El consumidor aporta el cuerpo y las acciones vía proyección; nunca construye su propio `<dialog>`. |
| **Extensión** | Proyección (`<ng-content>` + slot nombrado `[dialog-actions]`) y `size` (`'sm' \| 'md' \| 'lg' \| 'xl'`). No hay `ng-template` con contexto tipado — no lo necesita: el consumidor decide qué proyectar, no el organismo qué repetir por fila. |
| **Eventos** | Ver §3. |
| **Invariantes** | Ver §4. |
| **Verificación** | `content-dialog.spec.ts` (12 casos: apertura, foco inicial, cierre con retorno de foco, `Escape`, fondo vs. panel, pie proyectado, ancho, los tres gestos con `dismissible=false`); escenario del banco `features/component-stock/escenarios/content-dialog.escenarios.ts` (variantes `descartable`, `con-cambios`, `sm`, `xl` — `con-cambios` es la referencia viva de la política de descarte). |

## 2. Las diez áreas del §10

| Área | Contenido |
|---|---|
| **Entradas** | `heading: string` (requerido, sin default) · `description: string \| null = null` · `closeLabel: string = 'Cerrar'` · `size: 'sm'\|'md'\|'lg'\|'xl' = 'md'` · `dismissible: boolean = true`. Ninguna se transforma; ninguna valida formato (son texto o un literal cerrado por tipo). |
| **Salidas** | `opened: void` — se emite tras `showModal()`, sólo la escuchan hoy los 2 diálogos con mapa (Leaflet necesita el layout ya montado). `dismissAttempt: void` — se emite **únicamente** cuando `dismissible() === false` y alguno de los tres gestos de cierre se dispara; el consumidor decide qué hacer (confirmar, ignorar). `closed: void` — se emite siempre que el diálogo efectivamente cierra, sea por gesto (con `dismissible=true`) o por llamado programático a `close()`. |
| **Composición** | Un único hijo lógico: el contenido proyectado (`<ng-content>` por defecto) más, opcionalmente, un grupo de botones marcado `dialog-actions`. Sin `ng-template`, sin contexto por fila. |
| **Estado** | El organismo **no tiene input `open`**: el consumidor lo monta y desmonta con `@if` (o equivalente), y eso *es* la apertura. El propio componente sólo administra estado interno: `cerrado` (idempotencia de `close()`), `bloqueado`/`overflowPrevio` (scroll lock) y `origen` (el `Element` que tenía el foco al construirse, para restaurarlo). Nada de esto es observable desde afuera. |
| **Apariencia** | `size` cambia el ancho máximo del panel (token CSS, ver `content-dialog.css`). El resto es tema global (tokens de superficie, sombra, borde). El contenedor (consumidor) no debe fijar anchos por fuera de `size`. |
| **Errores** | El organismo no tiene estado de error propio — no hace red ni valida datos. Un input inválido (p. ej. `size` fuera del union) es error de tipos, detectado en compilación, no en runtime. |
| **Compatibilidad** | Sin versiones previas de este contrato. Cambiar la firma de `dismissible`/`dismissAttempt` (p. ej. pasar de `boolean` a un objeto de razón) rompería a los 11 consumidores que ya vinculan `dismissible` — cualquier cambio así necesita adaptador temporal declarado y plazo de retiro. |
| **Evidencia** | `content-dialog.spec.ts` (12 casos) + escenario del banco (4 variantes) + este documento contrastado a mano contra 3 consumidores ajenos (§7). |

## 3. Los tres caminos de cierre (§10.3) — **la parte que hay que copiar bien**

Los tres gestos —botón de cerrar, `Escape`, clic en el fondo— pasan **todos** por un único método,
`solicitarCierre()` (`content-dialog.ts:171-177`):

```ts
protected solicitarCierre(): void {
  if (!this.dismissible()) {
    this.dismissAttempt.emit();
    return;
  }
  this.close();
}
```

| Camino | Disparador | Con `dismissible=true` (default) | Con `dismissible=false` |
|---|---|---|---|
| Botón «Cerrar» | `(clicked)="solicitarCierre()"` | Cierra (`close()`) | Emite `dismissAttempt`, **no cierra** |
| `Escape` | El navegador dispara `cancel` sobre el `<dialog>`; se escucha con `(cancel)`, `preventDefault()` y se llama a `solicitarCierre()` | Cierra | Emite `dismissAttempt`, **no cierra** |
| Clic en el fondo | El `<dialog>` ocupa toda la pantalla; un clic fuera de `.content-dialog__panel` es clic sobre el propio `<dialog>` (el `::backdrop`) | Cierra | Emite `dismissAttempt`, **no cierra** |

**Por qué el botón también pregunta**: si el botón cerrara directo mientras `Escape` pregunta, la
confirmación sería una formalidad que se esquiva con el ratón (comentario del propio código,
`content-dialog.ts:165-170`).

**Qué hace el consumidor con `dismissAttempt`** (patrón ya usado por `attachment-dialog.ts:155-177`,
`work-history`, `tarjeta-del-dia` y el escenario del banco):

```ts
protected readonly dialog = viewChild(ContentDialog);          // nunca .required — el template lo
                                                                 // consulta en el mismo pase en que se crea
protected readonly puedeCerrarSolo = computed(() => !this.hayCambiosPendientes());

protected async alIntentarCerrar(): Promise<void> {
  if (this.puedeCerrarSolo()) { this.dialog()?.close(); return; }   // nada que descartar: cierra directo
  const descartar = await this.dialogs.confirm({
    title: '¿Descartar lo escrito?',
    message: 'Todavía no se guardó. Si cerrás, se pierde.',
    confirmLabel: 'Descartar', cancelLabel: 'Seguir editando', destructive: true,
  });
  if (descartar) this.dialog()?.close();
}
```

```html
<app-content-dialog heading="…" [dismissible]="puedeCerrarSolo()" (dismissAttempt)="alIntentarCerrar()" (closed)="…">
```

**Cerrar programáticamente NUNCA debe ser `set(null)` sin pasar por `close()`.** Si el host destruye
el `@if` directamente, `ngOnDestroy()` sólo libera el scroll lock (`content-dialog.ts:149-151`): no
emite `closed` ni restaura el foco. Todo cierre —por guardado, por confirmación, por lo que sea— llama
a `dialog()?.close()` primero.

## 4. Invariantes (combinaciones inválidas)

1. **`dismissible=false` sin manejar `(dismissAttempt)`** = un modal que nadie puede cerrar. Ningún
   consumidor debe hacer esto; si `dismissible` puede ser `false`, `(dismissAttempt)` es obligatorio.
2. **`dismissible` como predicado de cambios reales, nunca un literal `false` fijo** salvo que el
   diálogo sea deliberadamente bloqueante (no hay ningún caso así en el repo hoy).
3. **No hay ruta interna alternativa de cierre.** Todo cierre —gesto del usuario o acción del
   consumidor tras guardar/confirmar— pasa por `close()` (público, idempotente). Nunca se destruye el
   `@if` para saltarse la pregunta.
4. **`dialog-actions` sólo lleva acciones**, no contenido de lectura — el pie no scrollea con el
   cuerpo, así que texto largo ahí queda cortado.
5. **No anidar `content-dialog` dentro de `content-dialog`.** Sí es válido apilar un diálogo de
   `DialogService` (confirmación) *encima* de un `content-dialog` abierto — es el patrón que usa
   `attachment-dialog` y el propio `patient-chart` (`confirmWithReason`, línea ~1360). `Escape` sólo
   alcanza al `<dialog>` superior, así que un `Escape` durante la confirmación nunca se filtra al
   diálogo de abajo.
6. **Restauración de foco**: el organismo captura `document.activeElement` en su **constructor**
   (`content-dialog.ts:145`). Si tu botón abridor no tiene el foco en ese instante —por ejemplo, un
   `click` en Safari/Firefox-macOS, que no enfocan `<button>` al hacer clic con mouse—, el foco no
   vuelve a él al cerrar; sí vuelve siempre con apertura por teclado.

## 5. Criterio binario de «respeta la política de descarte»

Un consumidor **respeta la política** cuando:

> `(!contenidoEditable) || (dismissible está ligado a un predicado real de cambios pendientes && (dismissAttempt) está manejado con una confirmación)`

Un diálogo de **sólo lectura** (nada editable adentro: detalle, confirmación de datos, mapa) respeta
la política por default con `dismissible` en su valor por defecto (`true`) — no hay nada que perder.

## 6. Medición sobre los 29 consumidores (`origin/mockup` @ `d40b5631`)

Comando: `git grep -l '<app-content-dialog' -- 'src/app/**/*.html' | wc -l` → **29** archivos
(33 instancias: `patient-chart.html` y `access-tree.html` tienen 3 cada uno).
`git grep -c 'dismissAttempt' -- 'src/app/**/*.html'` → **7** ocurrencias en **5** archivos.

| # | Consumidor | ¿Editable? | `[dismissible]` | `(dismissAttempt)` | ¿Respeta la política? |
|---|---|---|---|---|---|
| 1 | `account/dependents/dependent-form-dialog.html` | Sí | Sí | No | **No** — bindea `dismissible` pero no maneja `dismissAttempt`: viola la invariante 1 |
| 2 | `account/my-profile/insurance-portability-card/portability-export-dialog/…` | Sí | Sí | Sí | **Sí** |
| 3 | `account/my-profile/practitioner-profile-edit/…` | Sí | No | No | **No** |
| 4 | `account/my-profile/work-history/site-bank-qr-dialog/…` | No (sólo QR) | No | No | Sí (nada que perder) |
| 5 | `account/my-profile/work-history/work-history.html` | Sí | Sí | Sí | **Sí** |
| 6 | `admin/data-catalog/object-detail/annotation-dialog.html` | Sí | Sí | No | **No** |
| 7 | `admin/qa-lab/qa-lab.html` | Sí | No | No | **No** |
| 8 | `admin/web-analytics/web-analytics.html` | No | No | No | Sí |
| 9 | `agenda/agenda-create/agenda-create.html` | Sí | No | No | **No** |
| 10 | `agenda/my-agenda/my-agenda.html` | Sí | No | No | **No** |
| 11 | `agenda/my-agenda/tarjeta-del-dia/…` | Sí | Sí | Sí (×2) | **Sí** |
| 12 | `agenda/walk-in/walk-in-form.html` | Sí | No | No | **No** |
| 13 | `alovida/buscar/hospitales-listado/facility-directions-dialog/…` | No (sólo mapa) | No | No | Sí (`opened` sí bindeado, para Leaflet) |
| 14 | `alovida/buscar/medicamentos-listado/pharmacy-availability-dialog/…` | No | No | No | Sí |
| 15 | `clinical-record/consultation/consultation.html` | Sí | No | No | **No** |
| 16 | `clinical-record/patient-chart/diagnostics-block/duplicate-study-warning-dialog/…` | Sí | Sí | Sí | **Sí** |
| 17 | `clinical-record/patient-chart/patient-chart.html` (×3) | Sí (alta y estado) / No (detalle) | No | No | **No** — H3 de este mismo carril lo corrige |
| 18 | `dashboard/access-tree/access-tree.html` (×3) | No (árbol de lectura) | No | No | Sí |
| 19 | `identity-assurance/verification-cases/verification-cases.html` | Sí | No | No | **No** |
| 20 | `insurance/insurance-catalog/approval-rules-dialog.html` | Sí | Sí | No | **No** |
| 21 | `insurance/insurance-catalog/benefit-form-dialog.html` | Sí | Sí | No | **No** |
| 22 | `insurance/insurance-catalog/plan-form-dialog.html` | Sí | Sí | No | **No** |
| 23 | `insurance/insurance-catalog/plan-premium-dialog.html` | Sí | Sí | No | **No** |
| 24 | `insurance/insurance-claims/insurance-claims.html` | Sí | No | No | **No** |
| 25 | `my-services/my-services.html` | Sí | No | No | **No** |
| 26 | `progress-notes/progress-notes.html` | Sí | No | No | **No** |
| 27 | `public-profile/public-post-reactions/public-post-reactions.html` | No | No | No | Sí |
| 28 | `public-profile/rate-encounter-dialog/rate-encounter-dialog.html` | Sí | No | No | **No** |
| 29 | `shared/components/organisms/attachment-dialog/attachment-dialog.html` | Sí | Sí | Sí | **Sí** |

**Totales: 8/29 respetan la política hoy (incluye 5 no-editables + 3 editables correctamente
vinculados). 15/29 son editables sin protección. 1/29 (dependent-form-dialog) viola la invariante 1 —
bindea `dismissible` pero no atiende `dismissAttempt`, así que ese modal probablemente no se puede
cerrar nunca con datos escritos.** Esta tabla es de sólo lectura contra el código de otros dueños: no
se toca ninguno de estos archivos desde este carril salvo `patient-chart.html` (línea 17, mío) y
`content-dialog`/`attachment-dialog` (organismos, no consumidores).

## 7. Prueba a mano — 3 consumidores ajenos, 3 caminos cada uno

Ver `evidencia/h2/` para las 9 observaciones y capturas. Consumidores elegidos (uno que vincula, uno
que no, uno mixto), todos alcanzables con la cuenta `medica@alovida.mock`:
`agenda/my-agenda/tarjeta-del-dia` (vincula), `account/my-profile/work-history` (vincula),
`progress-notes` (no vincula — sirve para confirmar que hoy pierde datos silenciosamente, igual que el
expediente antes de H3).

## 8. Receta de migración para un diálogo escrito a mano (para Justin)

1. Reemplazar el `<div role="dialog">`/`<dialog>` propio por `<app-content-dialog heading="…">`.
2. Mover el contenido tal cual al cuerpo (proyección por defecto).
3. Mover los botones de acción al slot `dialog-actions`.
4. Reemplazar el cierre manual (`(click)="cerrar()"`, tu propio `Escape`/backdrop) por `(closed)="…"`
   — ya no hace falta escuchar `Escape` ni el fondo a mano, el organismo lo hace.
5. Si el contenido es editable: agregar `[dismissible]` con un `computed` de cambios pendientes y
   `(dismissAttempt)` con el patrón de §3. Si es de sólo lectura (como tus dos, que son mapas): no
   hace falta nada de esto, el default alcanza.
6. Verificar con teclado: `Tab` no debe salir del panel, `Escape` debe hacer lo mismo que el botón.

## Qué falta / no cubierto

- No se abrió cada uno de los 29 consumidores en el navegador; la tabla del §6 es estática (lectura de
  `.html`), salvo los 3 de §7 que sí se recorrieron a mano.
- El criterio "¿editable?" es lectura del markup (presencia de `input`/`select`/`textarea`/bloques de
  formulario), no ejecución.
