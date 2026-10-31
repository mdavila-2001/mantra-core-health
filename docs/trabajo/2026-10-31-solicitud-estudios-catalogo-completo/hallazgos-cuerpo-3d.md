# Hallazgos: selector de región corporal 3D para estudios de imagenología

Fecha: 31/10/2026 · Tipo: investigación de planificación (no hay código de producto en este cambio).
Entregables: este informe y `catalogo/regiones-cuerpo-3d.json` (generado por script; el código va en el §9).

Pedido: al pedir un estudio de **imagenología** el médico elige la parte del cuerpo en el modelo 3D
que ya existe; debajo hay un select; los dos se sincronizan en ambos sentidos.

Validación de este informe: todo lo que dice «verificado» se comprobó leyendo los archivos o
ejecutando el script de §9 con `python3 -I`. **No se ejecutó** ningún navegador, `yarn test` ni
Playwright: nada de lo que sigue es una afirmación visual (`NO_EVIDENCE_NO_DONE`).

---

## 1. Hechos (con ruta:línea)

### 1.1 El visor `app-anatomy-viewer`

Archivo: `src/app/shared/components/organisms/anatomy-viewer/anatomy-viewer.ts` (551 líneas).

| Tema | Hecho | Dónde |
|---|---|---|
| Entradas | `parts` (req.), `modelUrls` (req., un GLB por capa), `layers` (req.), `sex` (`'male'`), `selected: string[]`, `related: string[]`, `label` (req., nombre accesible) | `anatomy-viewer.ts:81-89` |
| Salidas | `picked: string \| null` (sólo el `meshId`, **sin punto 3D**) y `statusChange` (`idle/loading/ready/unsupported/error`) | `anatomy-viewer.ts:91-92`, `:22` |
| API imperativa | `resetView()` público (vuelve a la vista inicial); no hay otra | `anatomy-viewer.ts:130-132` |
| SSR | three.js entra con `import()` dentro de `afterNextRender` (sólo navegador); en el servidor el lienzo es inerte | `anatomy-viewer.ts:110-112`, `:147-151`, doc `:60-65` |
| Sin WebGL 2 | `soportaWebGl` → estado `unsupported` y aviso «Puede elegir las piezas desde la lista» | `anatomy-viewer.ts:141-144`, `:178-184`; `anatomy-viewer.html:25-27` |
| Carga diferida por capa | cada capa es un GLB que se baja la primera vez que se enciende; un fallo no queda cacheado | `anatomy-viewer.ts:286-297`, `:316-346` |
| Estado de carga | sale de TODAS las capas pedidas | `anatomy-viewer.ts:307-314` |
| Resaltado | `pintar()`: elegidas en verde (`--c-success-500`), relacionadas en ocre, el resto se atenúa a opacidad 0,16 **sólo si** una elegida se está dibujando | `anatomy-viewer.ts:40-43`, `:349-391` (foco `:361-364`, atenuado `:381-388`) |
| Mallas sin `AnatomyPart` | se ocultan (`visible = false`) | `anatomy-viewer.ts:368-370` |
| Sexo | «female» oculta lo exclusivo del cuerpo masculino; no agrega nada | `anatomy-viewer.ts:372-374` |
| Encuadre | `encuadrar()` mide la caja de **todas** las mallas cargadas y pone la cámara de frente. **No hay encuadre de un subconjunto**: no se puede enfocar una región desde afuera | `anatomy-viewer.ts:401-419` |
| Cámara movida | mientras la persona no mueve la cámara, el encuadre sigue a lo que se carga | `anatomy-viewer.ts:216-221`, `:340`, `:513` |
| Elegir por rayo | con algo elegido, lo atenuado no tapa el rayo; devuelve sólo `userData.meshId` | `anatomy-viewer.ts:458-471` |
| Clic vs. arrastre | > 5 px es girar; sólo botón principal y un puntero; clic en el vacío emite `null` | `anatomy-viewer.ts:48`, `:473-487` |
| Hover | sólo ratón, con rAF; el rótulo muestra `labelEn` (inglés) | `anatomy-viewer.ts:490-496`, `:167-171`; `anatomy-viewer.html:37-39` |
| Teclado | lienzo `tabindex=0`, `role=application`; flechas giran, `+/-` acercan, Inicio encuadra. **Elegir una pieza con teclado no se puede en el lienzo**: el doc pide una lista al lado | `anatomy-viewer.html:2-11`; `anatomy-viewer.ts:422-456`, doc `:67-72` |
| Región viva | `<p role="status">` siempre en el DOM | `anatomy-viewer.html:13-35` |
| Movimiento reducido | sin inercia con `prefers-reduced-motion` | `anatomy-viewer.ts:249-252`, `:503-505` |
| Tema | relee tokens al cambiar `data-theme`/esquema | `anatomy-viewer.ts:270-275` |
| Rendimiento | dibuja sólo cuando algo cambió (rAF bajo demanda); `pixelRatio ≤ 2` | `anatomy-viewer.ts:240`, `:517-526` |
| Liberación | `forceContextLoss()` porque Chromium corta en ~16 contextos WebGL | `anatomy-viewer.ts:528-550` |
| Tamaño mínimo | `min-block-size: 22rem` | `anatomy-viewer.css:9` |
| Pruebas | Vitest sólo cubre «sin WebGL» y atributos del lienzo; el dibujo se prueba en Playwright | `anatomy-viewer.spec.ts:1-48`; `playwright/atlas-anatomico-3d.spec.ts` |

Los efectos que empujan entradas al motor: `anatomy-viewer.ts:114-126` (`parts` por un lado;
`layers/sex/selected/related` por otro, con `untracked`).

### 1.2 Tipos y cliente del atlas

- `AnatomyPart` = `{ meshId, layer, sex: 'male'|'shared', structureId, shard, side: 'right'|'left'|null, labelEn, match }`
  — `src/app/core/data-access/anatomy-atlas/anatomy-atlas.types.ts:18-30`. Confirma F9 del PLAN: no hay tipo
  de hueso ni región.
- `AnatomyComposites` (estructura compuesta → hijas con malla) — `anatomy-atlas.types.ts:102-107`.
- `AnatomyAtlasClient`: `parts()`, `composites()`, `index()`, `structure()` con `shareReplay` y sin cachear
  fallos; `modelUrl(file)` — `anatomy-atlas.client.ts:134-175` (base `/anatomy-atlas-3d`, `:115`).

### 1.3 Datos en `public/anatomy-atlas-3d/` (verificado)

| Archivo | Tamaño | Contenido |
|---|---|---|
| `catalog/parts.json` | 156 700 B | 930 mallas: muscles 437, skeleton 251, nervous 99, organs 78, vessels 65. `side`: left 387, right 387, null 156 |
| `catalog/composites.json` | 81 702 B | 492 compuestas |
| `catalog/index.json` | 477 417 B | 6 322 estructuras, 32 shards |
| `catalog/structures-00..31.json` | ~210–263 KB c/u | fichas |
| `models/skeleton.glb` | 884 832 B | 251 mallas |
| `models/organs.glb` | 294 924 B | 78 |
| `models/nervous.glb` | 416 868 B | 99 |
| `models/vessels.glb` | 248 532 B | 65 |
| `models/muscles.glb` | 2 340 884 B | 437 |
| `models/LICENSE.txt` | — | BodyParts3D, **CC BY-SA 2.1 JP**, mallas reducidas y cuantizadas |

Hechos sobre las mallas que pesan en el diseño:

- **Las mallas son huesos/órganos enteros**: no hay «extremo distal del fémur». Una articulación
  (rodilla, codo, cadera…) sólo se puede expresar como «los huesos que la forman».
- Los GLB usan `KHR_mesh_quantization`: cada nodo trae `translation` y `scale`, posiciones int16
  normalizadas, sin rotación ni jerarquía (el script lo afirma con `assert`). Entonces la **caja de cada
  malla = translation ± scale**, sin cargar three.js. Eso permitió verificar los encuadres (§4.3).
- **Convenio de lado (verificado)**: `x` media de las mallas `left` = +0,0912 m; `right` = −0,0912 m.
  `side` es el lado del paciente, y el modelo mira a +z: visto de frente, la izquierda del paciente
  queda a la derecha de la pantalla (posición anatómica, igual que una placa).
- **No hay malla de**: mama, tiroides (sólo cartílago tiroides), senos paranasales, cóccix, útero,
  ovarios (el cuerpo es masculino), médula espinal (sólo el canal central), corazón por cavidades
  (está «wall of heart» en la capa **vessels**).
- El globo ocular (`FMA12513`, «eyeball») está en la capa **skeleton** y con `side: null` (una sola malla
  para los dos ojos).
- `composites.json` **es incompleto como región**: «cervical region of vertebral column» trae atlas, axis y
  discos pero **no** C3–C7; «skeleton of manus» trae sólo los carpianos; «knee» sólo la rótula. Por eso
  el mapeo no se apoya en las compuestas sino en reglas sobre `labelEn` + capa (§9), y se usa
  `index.json` sólo para el concepto UBERON de la región.

### 1.4 Quién usa el visor hoy

Sólo el glosario: `src/app/features/glossary/glossary-anatomy-atlas.html:52-61` y
`glossary-anatomy-atlas.ts:112` (imports). Ruta perezosa `glossary/anatomy-atlas`
(`src/app/app.routes.ts:1155-1161`).

- `modelUrls` armadas con `atlas.modelUrl(...)` — `glossary-anatomy-atlas.ts:131-137`.
- Capas por omisión `['skeleton','organs']` — `glossary-anatomy-atlas.logic.ts:26`; señal en `glossary-anatomy-atlas.ts:145`.
- `selected` = mallas de la estructura abierta (incluye compuestas) — `glossary-anatomy-atlas.ts:171-174`.
- `related` — `glossary-anatomy-atlas.ts:182-185`.
- `onPicked(meshId)`: `null` limpia la selección; si no, abre la ficha de `structureId` — `glossary-anatomy-atlas.ts:357-366`.
- Abrir desde la búsqueda enciende las capas de la estructura — `glossary-anatomy-atlas.ts:374-379`.
- Bajo SSR no pide nada: `if (!isPlatformBrowser(...)) return;` — `glossary-anatomy-atlas.ts:253`.
- El estado vive en la URL (`structure`, `mesh`, `sex`). El glosario **nunca enfoca** una pieza: sólo la resalta.

### 1.5 Dónde se montaría

- El campo «Estudio» de la orden: `src/app/features/clinical-record/patient-chart/analysis-order-block/analysis-order-block.html:47-58`.
  La familia se deriva del prefijo del código (`IMG_…` → `IMAGING`):
  `analysis-order-block/study-category.ts:13`, `:29-35`.
- Primitivas a reutilizar: `app-select` (`shared/components/atoms/select/select.ts:96-117`, `SelectOption`
  con `description` en `select.types.ts:10-20`), `app-segmented-control`
  (`molecules/segmented-control/segmented-control.ts:60`), `app-form-field`.
- Existe `app-body-map` (silueta 2D, `organisms/body-map/body-map.ts:162-189`), usada en `symptom-check`.
  Sus zonas son de síntomas, no radiológicas: **no** se recomienda mezclarla.

---

## 2. Diseño: `app-body-region-picker` (organismo)

Ubicación: `src/app/shared/components/organisms/body-region-picker/`. Es presentacional: no sabe de
órdenes ni de la API. Recibe el catálogo ya resuelto y emite un valor.

### 2.1 Contrato (señales)

```ts
export type Laterality = 'LEFT' | 'RIGHT' | 'BILATERAL';

/** Lo único que se guarda: nunca ids de malla (son un detalle del atlas y cambian con su versión). */
export interface BodyRegionValue {
  readonly region: string;                 // CRANEO, MANO, RODILLA… (código del catálogo de imagenología)
  readonly laterality: Laterality | null;  // null si la región no es lateral
}

/** Una fila de regiones-cuerpo-3d.json cruzada con el nombre del catálogo de imagenología. */
export interface BodyRegionDef {
  readonly region: string;
  readonly nombre: string;
  readonly lateral: boolean;
  readonly capaPreferida: AnatomyLayer;
  readonly tipoMalla: 'propia' | 'contenedora' | 'referencia' | 'ninguna';
  readonly alTocar: 'malla' | 'punto' | 'solo_select';
  readonly mallas: { izquierda: readonly string[]; derecha: readonly string[]; centro: readonly string[] };
  readonly encuadre: { modo: 'union' | 'interseccion'; grupos: { izquierda: string[][]; derecha: string[][] } } | null;
}

@Component({ selector: 'app-body-region-picker', changeDetection: OnPush, imports: [AnatomyViewer, Select, SegmentedControl, FormField] })
export class BodyRegionPicker {
  readonly regions   = input.required<readonly BodyRegionDef[]>();
  readonly parts     = input.required<readonly AnatomyPart[]>();
  readonly modelUrls = input.required<Readonly<Record<AnatomyLayer, string>>>();
  /** Modalidad del estudio: decide la capa (§3). */
  readonly modality  = input<ImagingModality | null>(null);
  /** Regiones que admite el estudio elegido; vacío = todas. */
  readonly allowed   = input<readonly string[]>([]);
  readonly sex       = input<AnatomySex>('male');
  readonly disabled  = input(false);

  /** FUENTE DE VERDAD ÚNICA. El 3D y el select se derivan de acá y escriben acá. */
  readonly value = model<BodyRegionValue | null>(null);

  // --- derivados (computed, sin estado propio) ---
  protected readonly def          = computed(() => this.regions().find(r => r.region === this.value()?.region) ?? null);
  protected readonly options      = computed<SelectOption<string>[]>(…);   // filtradas por allowed y sexo, con description «sin modelo 3D» cuando tipoMalla ≠ propia
  protected readonly highlighted  = computed(() => mallasDe(this.def(), this.value()?.laterality));  // → [selected] del visor
  protected readonly focusGroups  = computed(() => gruposDeEncuadre(this.def(), this.value()?.laterality)); // → [focus]
  protected readonly layers       = computed(() => capasPara(this.modality(), this.def()));
  protected readonly announcement = computed(() => textoDeRegion(this.def(), this.value()));       // región viva
}
```

Toda la lógica (`mallasDe`, `regionAlTocar`, `lateralidadAlTocar`, `capasPara`, `gruposDeEncuadre`) va en
`body-region-picker.logic.ts`, puro y probado con Vitest. El componente sólo cablea.

### 2.2 Sincronización en los dos sentidos (sin bucles)

No hay dos estados que sincronizar: hay **un** `model` y dos vistas.

1. **3D → valor.** `(picked)` del visor → `regionAlTocar(meshId, punto?)`:
   - busca en `toque_malla_a_region` del JSON la región por defecto de esa malla;
   - si el visor emite el punto (cambio V2 del §4) y cae dentro de la caja de encuadre de una región
     `al_tocar: "punto"` (articulación), gana la articulación: tocar el fémur cerca de la tibia → RODILLA;
   - si la región está fuera de `allowed`, no cambia el valor y se anuncia «Este estudio no admite …»;
   - `picked(null)` (clic en el vacío) **no borra** el valor: borrar es una acción explícita del select
     («Sin región»). En el glosario `null` sí limpia (`glossary-anatomy-atlas.ts:358-361`); acá un clic
     fallido no debe perder un dato clínico.
2. **Select → valor.** `app-select` con `[(value)]` sobre un `linkedSignal`/setter que escribe en `value`.
3. **Valor → 3D.** `highlighted()` alimenta `[selected]`; `focusGroups()` alimenta el nuevo `[focus]`;
   `layers()` alimenta `[layers]`. El visor ya reacciona con su `effect` (`anatomy-viewer.ts:120-126`).
4. **Valor → select.** El select lee `value().region`.

Como el visor sólo **emite** cuando hay un clic real (no al cambiar `selected`), no hay eco: escribir el
valor desde el select no dispara `picked`.

### 2.3 Lateralidad

- Automática al tocar: `side` de la malla tocada → `left` = `LEFT`, `right` = `RIGHT`
  (lado del paciente; verificado el convenio en §1.3).
- Malla de `side: null` dentro de una región lateral (p. ej. la mandíbula en ATM): conserva la
  lateralidad que había o queda `null` y el control la pide (no se adivina).
- Región no lateral (`lateral: false`): `laterality = null` y el control de lateralidad no se muestra.
- Editable siempre con `app-segmented-control` (Izquierda / Derecha / Bilateral), rotulado
  «Lado del paciente». Bilateral **sólo** se elige a mano: tocar la otra mano con la izquierda ya elegida
  cambia a derecha, no a bilateral (si no, un toque por error duplica el estudio).
- Resaltado por lado: `LEFT` → `izquierda ∪ centro`; `RIGHT` → `derecha ∪ centro`; `BILATERAL` o `null` en
  región lateral → todo.
- Si el estudio elegido ya trae lado en su código (si el catálogo de imagenología lo hiciera), la
  lateralidad queda fija y deshabilitada. Pregunta abierta P3.

### 2.4 Regiones sin malla

`tipo_malla` en el JSON:

| tipo | Qué es | Comportamiento propuesto |
|---|---|---|
| `propia` | las mallas son la región | resaltar + encuadrar; se puede elegir tocando |
| `contenedora` | la región vive dentro de esas mallas (senos → frontal, etmoides, esfenoides, maxilares; órbita → globo, lagrimal, cigomático; oído → temporal + oreja) | sólo desde el select; se **encuadra** el contenedor y se resalta como «relacionada» (ocre, `[related]`), nunca como «elegida», y se dice «Los senos paranasales no tienen modelo 3D: se muestra la zona» |
| `referencia` | no está ni dentro; se señala una vecina (mama → pectoral mayor; tiroides → cartílago tiroides y tráquea) | igual que `contenedora`, con texto «aproximación»; requiere aprobación clínica (P5) |
| `ninguna` | nada que mostrar (útero y anexos: el modelo es masculino) | sólo select; el visor no cambia; el texto lo dice |

Tocar una malla nunca propone una región `contenedora/referencia/ninguna` (`al_tocar: "solo_select"`).

### 2.5 Accesibilidad

- El select es el camino principal y completo (teclado, lector). El lienzo es un complemento: así lo pide
  ya el doc del visor (`anatomy-viewer.ts:67-72`) y su aviso de `unsupported` (`anatomy-viewer.html:25-27`).
- Orden de foco: select → lateralidad → lienzo. El rótulo «Región del cuerpo» va en `app-form-field`.
- Región viva propia del picker (`role="status"`, siempre en el DOM): «Región: Mano, lado izquierdo» cuando el
  cambio llega desde el 3D (el lector no ve el lienzo).
- `label` del visor dinámico: «Modelo 3D para elegir la región; resaltada: Mano izquierda».
- El color no es la única señal: además del verde el resto se atenúa (`anatomy-viewer.ts:381-388`) y el nombre
  está en el select.
- Con `prefers-reduced-motion`, el encuadre salta sin animación (§4).
- La «lista accesible» pedida es el propio `app-select` (modal con buscador y `description`); no hace falta
  una segunda lista que duplique opciones. Si producto la quiere visible, una `radiogroup` agrupada por
  zona (cabeza, columna, tórax…) con las mismas opciones.

### 2.6 Composición (regla 6 del CLAUDE.md)

Va dentro de la tarjeta única de la orden, a lo ancho (`app-form-grid__ancho`), debajo de «Estudio» y sólo
cuando la familia es `IMAGING`. Visor arriba (alto ~22–28rem) y select + lateralidad debajo, como pidió el
usuario. Medir según `docs/components/composition-rules.md` §5 (línea 140).

---

## 3. Qué capa mostrar según la modalidad

Regla: `capas = { capaDeModalidad } ∪ capas_con_mallas(región)` — la región siempre se ve aunque la
modalidad diga otra cosa.

| Modalidad | Capa base | Notas |
|---|---|---|
| RX, TC de hueso, densitometría | `skeleton` | caso dominante (54 de 96 regiones con malla propia tienen `capa_preferida: skeleton`) |
| ECO abdominal / renal / vesical / prostática / testicular, TC abdomen-pelvis | `organs` | |
| TC/RM de encéfalo | `nervous` + `skeleton` (cráneo atenuado) | `ENCEFALO` usa 96 mallas de `nervous` |
| Angio-TC, Doppler | `vessels` | las 19 regiones `vascular` del catálogo: 11 con malla propia (aorta, carótidas, coronarias, ilíacas, renales, mesentéricas, cava, yugular, pulmonar, porta), 5 por referencia, 3 sin nada |
| RM musculoesquelética, ECO de partes blandas | `skeleton` + `muscles` | `muscles.glb` pesa 2,3 MB: encenderla sólo en estas |
| Mamografía, ECO mamaria | `muscles` (referencia) | `MAMA` no tiene malla |

La modalidad tiene que venir del catálogo de imagenología (P2). Mientras no exista, se usa
`capa_preferida` de la región.

---

## 4. Cambios mínimos al visor (retrocompatibles con el glosario)

> **Choque de alcance:** `docs/trabajo/2026-10-31-estudios-muestra-y-region-corporal/PLAN.md:39` deja **fuera**
> «cambios al visor 3D más allá de reutilizarlo». Sin V1 el pedido «cambiar el select enfoca en el 3D» **no
> se puede cumplir** (el visor sólo encuadra el cuerpo entero, `anatomy-viewer.ts:401-419`). Hace falta que
> el responsable del PLAN amplíe el alcance (P1).

Todos son entradas/salidas **opcionales** con valor por omisión que reproduce el comportamiento actual;
el glosario no cambia una línea.

| # | Cambio | Por qué | Esfuerzo |
|---|---|---|---|
| V1 | `focus = input<readonly (readonly string[])[] \| null>(null)`: grupos de `meshId`; un grupo → caja unión; dos o más → **intersección** de las uniones de cada grupo, agrandada a un mínimo (p. ej. 12 cm) | encuadrar la región elegida. Generalizar `encuadrar()` en `encuadrarCaja(caja)` reutilizando el cálculo de distancia de `:406-416`. Un `effect` sobre `focus` lo aplica cuando cambia (aunque la persona haya movido la cámara: es una orden explícita) y también cuando termina de cargar la capa (`:340`). `null` = comportamiento actual | S–M |
| V2 | `pickedAt = output<{ meshId: string; point: readonly [number, number, number] } \| null>()` además de `picked` | resolver articulaciones por el punto tocado (`al_tocar: "punto"`). `mallaEn` ya tiene el `impacto` con `.point` (`:469-470`): devolverlo en vez de tirarlo | S |
| V3 | `hoverLabel = input<((meshId: string) => string \| null) \| null>(null)` | el rótulo flotante hoy dice `labelEn` en inglés (`:167-171`); en la ficha clínica debe decir «Mano izquierda». `null` = como hoy | XS |
| V4 | (opcional) animación del encuadre ≤ 300 ms con `easeOut`, salto directo con `prefers-reduced-motion` | que el cambio desde el select se entienda como «ir a», sin marear | S |

No hace falta un input `highlighted`: `selected` ya resalta y atenúa el resto. Tampoco hace falta tocar
la carga por capas ni el raycast.

Pruebas de V1–V3: la lógica de caja (unión/intersección/mínimo) se extrae a una función pura y se prueba en
Vitest; el resto en Playwright (`playwright/atlas-anatomico-3d.spec.ts` como modelo), un solo navegador,
sin `networkidle`.

---

## 5. El mapeo: `catalogo/regiones-cuerpo-3d.json`

Generado por `gen_regiones_cuerpo_3d.py` (§9) leyendo `catalogo/imagenologia.json` (versión
`2026-10-31`, 156 regiones), `parts.json`, `index.json` y los cinco GLB.
Las claves `region` son **exactamente** los códigos del catálogo: el script falla si usa uno que no existe y
rellena como `ninguna` cualquier región del catálogo sin regla (`sin_regla_por_tipo`, hoy vacío).

Validado con `python3 -I -m json.tool` (OK) y con una comprobación aparte: 156/156 códigos del catálogo
presentes una vez, **0** ids de malla inexistentes en `parts.json`, **0** mallas en un balde de lado que no
coincida con su `side`, y `structureIds` idéntico al conjunto derivado de las mallas en las 156 regiones.
El script terminó con **1 aviso**: `OJO` admite lateralidad en el catálogo pero el atlas tiene un solo
`eyeball` central (`FMA12513`, `side: null`), así que al tocarlo la lateralidad se pide a mano.

Equivalencias aplicadas desde `imagenologia-FUENTES.md` § «Nota para el mapeo 3D»: MACIZO_FACIAL→CARA (+
HUESOS_FACIALES), PIEZAS_DENTARIAS→DIENTES, OIDO_PENASCO→PENASCO (y OIDO como contenedora),
SILLA_TURCA_HIPOFISIS→SILLA_TURCA, SACRO_COXIS→SACRO + COCCIX (cóccix sin malla, referencia al sacro),
COLUMNA_TOTAL→COLUMNA, PARRILLA_COSTAL→COSTILLAS, RENAL→RINON, VESICAL→VEJIGA, TESTICULAR→TESTICULO (+
ESCROTO como referencia), UTERO_ANEXOS→UTERO/UTERO_TROMPAS/ANEXOS_UTERINOS/OVARIO (sin malla),
SACROILIACA→SACROILIACAS.

Forma de cada región (además de lo pedido: `region`, `capa_preferida`, `mallas{izquierda,derecha,centro}`,
`structureIds`, `criterio`, `sin_malla`):

- `nombre`, `padre`, `tipo_catalogo` y `lateral` **copiados del catálogo** (no se redefinen acá);
  `capas_con_mallas`, `tipo_malla`, `al_tocar`, `uberon_region` (concepto UBERON de la región, buscado por
  nombre inglés exacto en `index.json`; `null` si no hay), `solo_cuerpo_masculino`, `encuadre` (`modo`,
  `grupos` por lado y `caja_cm_verificada`).
- Las regiones compuestas (grupos, combinadas, COLUMNA_CERVICODORSAL, ABDOMEN_SUPERIOR, MEDIASTINO…) se
  definen por referencia a otras (`"@CODIGO"` en el script) y heredan sus mallas; `criterio` lo dice
  («mallas de X»).
- A nivel raíz: `cobertura_por_tipo_catalogo`, `sin_regla_por_tipo`, `toque_malla_a_region` (malla →
  región por defecto al tocar: primero regiones `malla`, después agregadas/grupos, al final articulaciones;
  dentro del nivel, la de menos mallas), `convenio_lado`, `avisos`.

`sin_malla` es `true` para todo lo que no es `propia` (las `contenedora/referencia` traen mallas, pero no
son de la región).

### 5.1 Cobertura: 156 regiones del catálogo, 156 con entrada

Por tipo del catálogo → tipo de malla:

| tipo catálogo | total | propia | contenedora | referencia | ninguna |
|---|---|---|---|---|---|
| region | 121 | 96 | 5 | 15 | 5 |
| vascular | 19 | 11 | 0 | 5 | 3 |
| grupo | 9 | 9 | 0 | 0 | 0 |
| combinada | 7 | 7 | 0 | 0 | 0 |
| **total** | **156** | **123** | **5** | **20** | **8** |

Modo de llegada desde el 3D: `malla` 83, `punto` 9 (articulaciones), `solo_select` 64
(grupos, combinadas, agregadas y todo lo que no tiene malla propia). De 930 mallas, **570** proponen una
región al tocarlas; no proponen nada 336 músculos (sólo los de pared abdominal, suelo pélvico, brazo/muslo/pierna
e inguinal entran en regiones), 15 vasos (venas cardíacas, ilíacas, renales, subclavias), 7 órganos
(oreja, epidídimos, conductos deferentes, labio, cartílagos nasales) y 2 nervios ópticos.

Capa preferida de las regiones `region` con malla propia: skeleton 54, organs 32, muscles 5, nervous 3, vessels 2.

**Sin malla propia (33):**

- contenedoras (5): SENOS_PARANASALES, ORBITA, OIDO, CONDUCTO_AUDITIVO_INTERNO, MASTOIDES — se encuadra el hueso que las contiene (temporal, maxilar/frontal/etmoides/esfenoides, lagrimal/cigomático/globo).
- referencias (20): GLANDULAS_SALIVALES, PAROTIDA, SUBMANDIBULAR, TIROIDES, PARATIROIDES, FARINGE, CAVUM, GANGLIOS_CERVICALES, COCCIX, MAMA, AXILA, VIAS_BILIARES, VIA_BILIOPANCREATICA, ESCROTO, PLEXO_BRAQUIAL, ARTERIAS_MIEMBRO_SUPERIOR, VENAS_MIEMBRO_SUPERIOR, ARTERIAS_MIEMBRO_INFERIOR, VENAS_MIEMBRO_INFERIOR, ARTERIA_FEMORAL — se señala una vecina (pectoral mayor para la mama, cartílago tiroides/tráquea para tiroides y paratiroides, masetero/milohioideo para las salivales, sacro para el cóccix, subclavia/ilíaca externa para los vasos de los miembros, testículos para el escroto…).
- ninguna (8): ARTERIAS_INTRACRANEALES, SENOS_VENOSOS_DURALES, ARTERIAS_VERTEBRALES, UTERO, UTERO_TROMPAS, ANEXOS_UTERINOS, OVARIO, PLACENTA — el cuerpo de referencia es masculino y no hay vasos intracraneales ni vertebrales.

Decisiones de prioridad al tocar que conviene revisar con la clínica (P10):

- `temporal bone` → PENASCO (gana a CRANEO por ser más específico); `descending aorta` → AORTA_ABDOMINAL
  (una sola malla cubre toda la aorta descendente; también está en AORTA_TORACICA); `talus/calcaneus` → RETROPIE;
  `scaphoid` → ESCAFOIDES (no CARPO ni MUNECA); `tibia` → TIBIA_PERONE; `hip bone` → PELVIS (grupo);
  `patella` → ROTULA; `maxilla` → MAXILAR.
- CORAZON y ARTERIAS_CORONARIAS traen mallas con lado (músculos papilares, ramas coronarias) aunque el catálogo
  no admite lateralidad: el picker ignora el lado de la malla cuando `lateral` es `false`.
- `middle lobe of lung` (`FMA7383`) viene con `side: null` en el atlas aunque es derecho: PULMONES lo lista en
  `centro`.

### 5.2 Tabla completa

| Región (código del catálogo) | tipo catálogo | tipo malla | al tocar | capa | mallas izq/der/centro | UBERON región |
|---|---|---|---|---|---|---|
| CRANEO | region | propia | malla | skeleton | 2 / 2 / 4 | UBERON:0003129 |
| ENCEFALO | region | propia | malla | nervous | 36 / 36 / 24 | UBERON:0000955 |
| FOSA_POSTERIOR | region | propia | malla | nervous | 0 / 0 / 6 | UBERON:0002028 |
| SILLA_TURCA | region | propia | malla | organs | 0 / 0 / 2 | UBERON:0000007 |
| CARA | region | propia | solo_select | skeleton | 6 / 6 / 3 | UBERON:0001456 |
| HUESOS_FACIALES | region | propia | malla | skeleton | 6 / 6 / 2 | UBERON:0011156 |
| SENOS_PARANASALES | region | **contenedora** | solo_select | skeleton | 1 / 1 / 3 | UBERON:0001825 |
| ORBITA | region | **contenedora** | solo_select | skeleton | 2 / 2 / 1 | UBERON:0004088 |
| OJO | region | propia | malla | skeleton | 0 / 0 / 1 | UBERON:0010230 |
| HUESOS_PROPIOS_NARIZ | region | propia | malla | skeleton | 1 / 1 / 0 | UBERON:0001681 |
| MAXILAR | region | propia | malla | skeleton | 1 / 1 / 0 | UBERON:0002397 |
| MANDIBULA | region | propia | malla | skeleton | 0 / 0 / 1 | UBERON:0001684 |
| CIGOMA | region | propia | malla | skeleton | 1 / 1 / 0 | UBERON:0001683 |
| ATM | region | propia | punto | skeleton | 1 / 1 / 1 | UBERON:0003700 |
| MAXILARES | region | propia | solo_select | skeleton | 1 / 1 / 1 | UBERON:0001708 |
| DIENTES | region | propia | malla | organs | 14 / 14 / 2 | UBERON:0003672 |
| ARCADA_DENTARIA_SUPERIOR | region | propia | malla | organs | 1 / 1 / 1 | UBERON:0001709 |
| ARCADA_DENTARIA_INFERIOR | region | propia | malla | organs | 1 / 1 / 1 | UBERON:0001710 |
| OIDO | region | **contenedora** | solo_select | skeleton | 1 / 1 / 1 | UBERON:0001690 |
| PENASCO | region | propia | malla | skeleton | 1 / 1 / 0 | UBERON:0001678 |
| CONDUCTO_AUDITIVO_INTERNO | region | **contenedora** | solo_select | skeleton | 1 / 1 / 0 | UBERON:0011859 |
| MASTOIDES | region | **contenedora** | solo_select | skeleton | 1 / 1 / 0 | — |
| GLANDULAS_SALIVALES | region | **referencia** | solo_select | muscles | 4 / 4 / 0 | UBERON:0001044 |
| PAROTIDA | region | **referencia** | solo_select | muscles | 2 / 2 / 0 | UBERON:0001831 |
| SUBMANDIBULAR | region | **referencia** | solo_select | muscles | 2 / 2 / 0 | UBERON:0001736 |
| ARTERIAS_INTRACRANEALES | vascular | **ninguna** | solo_select | nervous | 0 / 0 / 0 | — |
| SENOS_VENOSOS_DURALES | vascular | **ninguna** | solo_select | nervous | 0 / 0 / 0 | — |
| TIROIDES | region | **referencia** | solo_select | organs | 0 / 0 / 2 | UBERON:0002046 |
| PARATIROIDES | region | **referencia** | solo_select | organs | 0 / 0 / 2 | UBERON:0001132 |
| LARINGE | region | propia | malla | organs | 0 / 0 / 2 | UBERON:0001737 |
| FARINGE | region | **referencia** | solo_select | organs | 0 / 0 / 2 | — |
| CAVUM | region | **referencia** | solo_select | skeleton | 0 / 0 / 2 | UBERON:0001728 |
| TRAQUEA | region | propia | malla | organs | 0 / 0 / 1 | UBERON:0003126 |
| CAROTIDAS | vascular | propia | malla | vessels | 2 / 2 / 1 | UBERON:0001530 |
| ARTERIAS_VERTEBRALES | vascular | **ninguna** | solo_select | vessels | 0 / 0 / 0 | — |
| VENA_YUGULAR | vascular | propia | malla | vessels | 1 / 1 / 0 | UBERON:0001586 |
| GANGLIOS_CERVICALES | region | **referencia** | solo_select | muscles | 1 / 1 / 0 | UBERON:0002429 |
| COLUMNA_CERVICAL | region | propia | malla | skeleton | 0 / 0 / 13 | UBERON:0006072 |
| COLUMNA_DORSAL | region | propia | malla | skeleton | 0 / 0 / 24 | UBERON:0006073 |
| COLUMNA_LUMBAR | region | propia | malla | skeleton | 0 / 0 / 10 | UBERON:0006074 |
| SACRO | region | propia | malla | skeleton | 0 / 0 / 1 | UBERON:0003690 |
| COCCIX | region | **referencia** | solo_select | skeleton | 0 / 0 / 1 | UBERON:0001350 |
| COLUMNA_CERVICODORSAL | region | propia | solo_select | skeleton | 0 / 0 / 37 | — |
| COLUMNA_DORSOLUMBAR | region | propia | solo_select | skeleton | 0 / 0 / 34 | — |
| COLUMNA_LUMBOSACRA | region | propia | solo_select | skeleton | 0 / 0 / 11 | — |
| SACROILIACAS | region | propia | punto | skeleton | 1 / 1 / 1 | — |
| MEDULA_ESPINAL | region | propia | malla | nervous | 0 / 0 / 1 | UBERON:0002240 |
| PULMONES | region | propia | malla | organs | 2 / 2 / 2 | UBERON:0000170 |
| CORAZON | region | propia | malla | vessels | 2 / 3 / 4 | UBERON:0000948 |
| ARTERIAS_CORONARIAS | vascular | propia | malla | vessels | 4 / 5 / 0 | UBERON:0001621 |
| AORTA_TORACICA | vascular | propia | malla | vessels | 0 / 0 / 3 | UBERON:0001515 |
| ARTERIAS_PULMONARES | vascular | propia | malla | vessels | 0 / 0 / 1 | UBERON:0002012 |
| MEDIASTINO | region | propia | solo_select | vessels | 4 / 5 / 14 | UBERON:0003728 |
| COSTILLAS | region | propia | malla | skeleton | 20 / 20 / 0 | UBERON:0003252 |
| ESTERNON | region | propia | malla | skeleton | 0 / 0 / 3 | UBERON:0000975 |
| ESTERNOCLAVICULAR | region | propia | punto | skeleton | 1 / 1 / 1 | UBERON:0001469 |
| MAMA | region | **referencia** | solo_select | muscles | 3 / 3 / 0 | UBERON:0000310 |
| AXILA | region | **referencia** | solo_select | muscles | 4 / 4 / 0 | UBERON:0009472 |
| ESOFAGO | region | propia | malla | organs | 0 / 0 / 1 | UBERON:0001043 |
| HIGADO | region | propia | malla | organs | 0 / 0 / 1 | UBERON:0002107 |
| VESICULA_BILIAR | region | propia | malla | organs | 0 / 0 / 1 | UBERON:0002110 |
| VIAS_BILIARES | region | **referencia** | solo_select | organs | 0 / 0 / 2 | UBERON:0001173 |
| PANCREAS | region | propia | malla | organs | 0 / 0 / 2 | UBERON:0001264 |
| VIA_BILIOPANCREATICA | region | **referencia** | solo_select | organs | 0 / 0 / 2 | — |
| BAZO | region | propia | malla | organs | 0 / 0 / 1 | UBERON:0002106 |
| RINON | region | propia | malla | organs | 1 / 1 / 0 | — |
| SUPRARRENAL | region | propia | malla | organs | 1 / 1 / 0 | UBERON:0002369 |
| URETER | region | propia | malla | organs | 1 / 1 / 0 | UBERON:0000056 |
| ESTOMAGO | region | propia | malla | organs | 0 / 0 / 1 | UBERON:0000945 |
| DUODENO | region | propia | malla | organs | 0 / 0 / 1 | UBERON:0002114 |
| INTESTINO_DELGADO | region | propia | solo_select | organs | 0 / 0 / 3 | UBERON:0002108 |
| COLON | region | propia | malla | organs | 0 / 0 / 4 | UBERON:0001155 |
| APENDICE | region | propia | malla | organs | 0 / 0 / 1 | — |
| TRACTO_DIGESTIVO_SUPERIOR | region | propia | solo_select | organs | 0 / 0 / 3 | — |
| ABDOMEN_SUPERIOR | region | propia | solo_select | organs | 2 / 2 / 7 | — |
| VIAS_URINARIAS | region | propia | solo_select | organs | 2 / 2 / 2 | UBERON:0001008 |
| AORTA_ABDOMINAL | vascular | propia | malla | vessels | 0 / 0 / 1 | UBERON:0001516 |
| ARTERIAS_RENALES | vascular | propia | malla | vessels | 1 / 1 / 0 | UBERON:0001184 |
| ARTERIAS_MESENTERICAS | vascular | propia | malla | vessels | 1 / 0 / 5 | — |
| VENA_PORTA | vascular | propia | malla | vessels | 0 / 0 / 2 | UBERON:0001639 |
| VENA_CAVA_INFERIOR | vascular | propia | malla | vessels | 0 / 0 / 1 | UBERON:0001072 |
| RETROPERITONEO | region | propia | solo_select | organs | 5 / 5 / 5 | UBERON:0003693 |
| PARED_ABDOMINAL | region | propia | malla | muscles | 5 / 5 / 1 | UBERON:0003697 |
| VEJIGA | region | propia | malla | organs | 0 / 0 / 1 | UBERON:0001255 |
| URETRA | region | propia | malla | organs | 0 / 0 / 1 | UBERON:0000057 |
| VEJIGA_URETRA | region | propia | solo_select | organs | 0 / 0 / 2 | — |
| PROSTATA | region | propia | malla | organs | 0 / 0 / 1 | UBERON:0002367 |
| VESICULAS_SEMINALES | region | propia | malla | organs | 1 / 1 / 0 | UBERON:0000998 |
| TESTICULO | region | propia | malla | organs | 1 / 1 / 0 | UBERON:0000473 |
| ESCROTO | region | **referencia** | solo_select | organs | 2 / 2 / 0 | UBERON:0001300 |
| PENE | region | propia | malla | organs | 0 / 0 / 3 | UBERON:0000989 |
| UTERO | region | **ninguna** | solo_select | organs | 0 / 0 / 0 | UBERON:0000995 |
| UTERO_TROMPAS | region | **ninguna** | solo_select | organs | 0 / 0 / 0 | — |
| ANEXOS_UTERINOS | region | **ninguna** | solo_select | organs | 0 / 0 / 0 | — |
| OVARIO | region | **ninguna** | solo_select | organs | 0 / 0 / 0 | UBERON:0000992 |
| PLACENTA | region | **ninguna** | solo_select | organs | 0 / 0 / 0 | UBERON:0001987 |
| RECTO | region | propia | malla | organs | 0 / 0 / 1 | UBERON:0001052 |
| CANAL_ANAL | region | propia | malla | muscles | 0 / 0 / 1 | UBERON:0000159 |
| SUELO_PELVICO | region | propia | malla | muscles | 4 / 4 / 2 | — |
| REGION_INGUINAL | region | propia | malla | muscles | 1 / 1 / 0 | — |
| ARTERIAS_ILIACAS | vascular | propia | malla | vessels | 3 / 3 / 0 | UBERON:0001191 |
| HOMBRO | region | propia | punto | skeleton | 3 / 3 / 0 | UBERON:0001467 |
| CLAVICULA | region | propia | malla | skeleton | 1 / 1 / 0 | UBERON:0001105 |
| ESCAPULA | region | propia | malla | skeleton | 1 / 1 / 0 | UBERON:0006849 |
| ACROMIOCLAVICULAR | region | propia | punto | skeleton | 2 / 2 / 0 | UBERON:0003692 |
| PLEXO_BRAQUIAL | region | **referencia** | solo_select | muscles | 3 / 3 / 0 | UBERON:0001814 |
| HUMERO | region | propia | malla | skeleton | 1 / 1 / 0 | UBERON:0000976 |
| BRAZO | region | propia | solo_select | skeleton | 8 / 8 / 0 | UBERON:0003822 |
| CODO | region | propia | punto | skeleton | 3 / 3 / 0 | UBERON:0001461 |
| RADIO_CUBITO | region | propia | malla | skeleton | 2 / 2 / 0 | UBERON:0010703 |
| ANTEBRAZO | region | propia | malla | skeleton | 3 / 3 / 0 | UBERON:0002386 |
| CARPO | region | propia | malla | skeleton | 8 / 8 / 0 | UBERON:0009880 |
| ESCAFOIDES | region | propia | malla | skeleton | 1 / 1 / 0 | UBERON:0001427 |
| MUNECA | region | propia | malla | skeleton | 10 / 10 / 0 | UBERON:0004452 |
| METACARPO | region | propia | malla | skeleton | 5 / 5 / 0 | — |
| DEDOS_MANO | region | propia | malla | skeleton | 14 / 14 / 0 | UBERON:0002389 |
| PULGAR | region | propia | malla | skeleton | 3 / 3 / 0 | UBERON:0001463 |
| MANO | region | propia | malla | skeleton | 27 / 27 / 0 | UBERON:0002398 |
| ARTERIAS_MIEMBRO_SUPERIOR | vascular | **referencia** | solo_select | vessels | 1 / 1 / 0 | — |
| VENAS_MIEMBRO_SUPERIOR | vascular | **referencia** | solo_select | vessels | 1 / 1 / 0 | — |
| CADERA | region | propia | punto | skeleton | 2 / 2 / 0 | UBERON:0001464 |
| FEMUR | region | propia | malla | skeleton | 1 / 1 / 0 | UBERON:0000981 |
| MUSLO | region | propia | solo_select | skeleton | 16 / 16 / 0 | UBERON:0000376 |
| ROTULA | region | propia | malla | skeleton | 1 / 1 / 0 | UBERON:0002446 |
| RODILLA | region | propia | punto | skeleton | 4 / 4 / 0 | UBERON:0001465 |
| TIBIA_PERONE | region | propia | malla | skeleton | 2 / 2 / 0 | — |
| PIERNA | region | propia | solo_select | skeleton | 17 / 17 / 0 | UBERON:0003823 |
| TENDON_AQUILES | region | propia | malla | muscles | 1 / 1 / 0 | UBERON:0003701 |
| TOBILLO | region | propia | punto | skeleton | 3 / 3 / 0 | UBERON:0001488 |
| CALCANEO | region | propia | malla | skeleton | 1 / 1 / 0 | UBERON:0001450 |
| TARSO | region | propia | malla | skeleton | 7 / 7 / 0 | UBERON:0009879 |
| RETROPIE | region | propia | malla | skeleton | 2 / 2 / 0 | — |
| METATARSO | region | propia | malla | skeleton | 5 / 5 / 0 | — |
| DEDOS_PIE | region | propia | malla | skeleton | 14 / 14 / 0 | UBERON:0001466 |
| SESAMOIDEOS_PIE | region | propia | malla | skeleton | 1 / 1 / 0 | UBERON:0008000 |
| ANTEPIE | region | propia | malla | skeleton | 20 / 20 / 0 | — |
| PIE | region | propia | malla | skeleton | 28 / 28 / 0 | UBERON:0002387 |
| ARTERIAS_MIEMBRO_INFERIOR | vascular | **referencia** | solo_select | vessels | 1 / 1 / 0 | — |
| VENAS_MIEMBRO_INFERIOR | vascular | **referencia** | solo_select | vessels | 1 / 1 / 0 | — |
| ARTERIA_FEMORAL | vascular | **referencia** | solo_select | vessels | 1 / 1 / 0 | UBERON:0002060 |
| CABEZA | grupo | propia | solo_select | skeleton | 44 / 44 / 31 | UBERON:0000033 |
| CUELLO | grupo | propia | solo_select | skeleton | 3 / 3 / 18 | UBERON:0000974 |
| COLUMNA | grupo | propia | solo_select | skeleton | 0 / 0 / 48 | UBERON:0001130 |
| TORAX | grupo | propia | solo_select | skeleton | 26 / 27 / 42 | UBERON:0001443 |
| ABDOMEN | grupo | propia | solo_select | organs | 8 / 8 / 17 | UBERON:0000916 |
| PELVIS | grupo | propia | solo_select | skeleton | 4 / 4 / 4 | UBERON:0002355 |
| MIEMBRO_SUPERIOR | grupo | propia | solo_select | skeleton | 32 / 32 / 0 | UBERON:0002102 |
| MIEMBRO_INFERIOR | grupo | propia | solo_select | skeleton | 32 / 32 / 0 | UBERON:0002103 |
| CUERPO_ENTERO | grupo | propia | solo_select | skeleton | 95 / 95 / 61 | UBERON:0013702 |
| CABEZA_CUELLO | combinada | propia | solo_select | skeleton | 47 / 47 / 49 | — |
| CUELLO_TORAX | combinada | propia | solo_select | skeleton | 29 / 30 / 57 | — |
| TORAX_ABDOMEN | combinada | propia | solo_select | skeleton | 34 / 35 / 58 | — |
| ABDOMEN_PELVIS | combinada | propia | solo_select | skeleton | 12 / 12 / 21 | — |
| TORAX_ABDOMEN_PELVIS | combinada | propia | solo_select | skeleton | 38 / 39 / 62 | — |
| CUELLO_TORAX_ABDOMEN_PELVIS | combinada | propia | solo_select | skeleton | 41 / 42 / 77 | — |
| PELVIS_MIEMBROS_INFERIORES | combinada | propia | solo_select | skeleton | 36 / 36 / 4 | — |

### 5.3 Encuadre de articulaciones (verificado con las cajas del GLB)

Intersección de las cajas de los huesos que forman la articulación (tamaño x × y × z en cm, lado izquierdo):

| Región | grupos (mallas izquierdas) | caja |
|---|---|---|
| ATM | FMA52739 ∩ FMA52748 | 3,9 × 2,9 × 4,1 |
| SACROILIACAS | FMA16587 ∩ FMA16202 | 5,8 × 14,5 × 8,1 |
| ESTERNOCLAVICULAR | FMA13323 ∩ FMA7486 | 1,7 × 1,5 × 1,8 |
| HOMBRO | FMA13396 ∩ FMA23131 | 2,8 × 14,5 × 5,0 |
| ACROMIOCLAVICULAR | FMA13396 ∩ FMA13323 | 9,1 × 2,8 × 5,2 |
| CODO | FMA23131 ∩ FMA23468 | 4,4 × 2,4 × 5,0 |
| CADERA | FMA16587 ∩ FMA24475 | 10,0 × 8,3 × 7,4 |
| RODILLA | FMA24475 ∩ FMA24478 | 7,6 × 0,4 × 6,2 |
| TOBILLO | FMA24478 ∩ FMA24483 | 4,1 × 1,0 × 5,3 |
| MUNECA (unión) | 8 carpianos | 5,0 × 3,1 × 2,8 |

Ninguna vacía, pero rodilla, tobillo y esternoclavicular son láminas finas: V1 debe agrandar la caja a un
mínimo. Hombro y acromioclavicular salen anchas porque la caja de la escápula lo es; son aproximaciones por
cajas alineadas a los ejes, no geometría real.

---

## 6. Rendimiento y SSR

- Peso: con `skeleton` sólo, 865 KB de GLB + 153 KB de `parts.json` la primera vez; `organs` +288 KB;
  `muscles` +2,3 MB (encender sólo si la modalidad lo pide). Todo con `shareReplay`, una vez por sesión
  (`anatomy-atlas.client.ts:139-148`), y el navegador lo cachea como estático.
- three.js ya está fuera del bundle inicial (`import()` en `anatomy-viewer.ts:147-151`). La clase
  `AnatomyViewer` es chica y puede importarse estáticamente, pero conviene montar el picker con
  `@defer (on viewport)` dentro del bloque de la orden y sólo si la familia es `IMAGING`: la ficha del
  paciente no paga WebGL si no se pide un estudio de imagen.
- SSR: el visor ya es inerte en servidor; el picker no debe pedir `parts.json` ni el JSON de regiones en el
  servidor (mismo patrón que `glossary-anatomy-atlas.ts:253`). Con `@defer`, el servidor pinta el
  placeholder; el select puede renderizarse en servidor porque sólo depende del catálogo.
- `regiones-cuerpo-3d.json` pesa 59 KB con las cajas y los grupos de verificación. Para ejecución conviene
  una versión recortada (región → mallas por lado + grupos de encuadre + `toque`) o calcularla en el cliente.
  Decidir dónde vive: `public/anatomy-atlas-3d/catalog/` junto al resto (recomendado: viaja con las mallas
  y se regenera con ellas) o un fixture TS.
- Contextos WebGL: un picker = un contexto; el visor ya hace `forceContextLoss()` al destruirse
  (`anatomy-viewer.ts:546-549`). No montar un picker por estudio en una lista: uno solo, el del estudio que
  se está pidiendo.
- Sin WebGL 2: el select sigue funcionando y el aviso existente lo dice (`anatomy-viewer.html:25-27`).

---

## 7. Riesgos

1. **Alcance**: el PLAN excluye cambios al visor (`PLAN.md:39`); sin V1 no hay «enfocar». Bloqueante.
2. **Huesos enteros**: en RODILLA se resaltan fémur y tibia completos. Se compensa con el encuadre, pero
   visualmente «resalta la pierna entera». Alternativa: resaltar sólo la rótula y relacionar el resto.
3. **Prioridad de toque**: tocar la diáfisis del fémur da FEMUR; sin V2 no hay forma de llegar a CADERA o
   RODILLA tocando (sólo por select). Con V2, depende de la caja de la articulación.
4. **Aproximaciones clínicas** (senos, órbita, oído, mama, tiroides): mostrar algo vecino puede leerse como
   «la región es eso». Requiere texto explícito y aprobación clínica.
5. **Cuerpo único masculino**: PROSTATA, VESICULAS_SEMINALES, TESTICULO, ESCROTO y PENE desaparecen del modelo con `sex='female'`
   (`anatomy-viewer.ts:374`); UTERO, UTERO_TROMPAS, ANEXOS_UTERINOS, OVARIO y PLACENTA no existen. Hay que decidir qué hace el select según el sexo del
   paciente (P6).
6. **Códigos del catálogo**: las claves son los 156 códigos de `imagenologia.json`, que
   `imagenologia-FUENTES.md` declara estables. Si el catálogo cambia, el script falla ante un código
   desconocido y rellena como `ninguna` cualquier región nueva sin regla; hay que volver a correrlo.
7. **Licencia CC BY-SA**: la ficha clínica mostrará las mallas; el glosario muestra las fuentes. Confirmar
   que el picker también lleve la atribución (P7).
8. **Persistencia**: guardar `meshId` sería atar la orden a una versión del atlas. Se guarda región +
   lateralidad (y, si el back lo quiere, `uberon_region`). Los value sets de lateralidad ya existen para
   diagnóstico (`diagnosis-block/diagnosis-targets.ts:21-22`, `clinical.conditions.laterality_concept_id`);
   reutilizarlos es decisión del API (PLAN, desconocido 4).
9. **Rendimiento en equipos de consultorio**: el esqueleto entero en una tarjeta de la ficha puede costar en
   equipos sin GPU. Medir con Playwright y trazas antes de decidir el `@defer`.
10. **Etiquetas en inglés**: el hover muestra `labelEn` hasta que exista V3.

---

## 8. Preguntas abiertas

- **P1.** ¿Se amplía el alcance del PLAN para V1 (`focus`) y V2 (`pickedAt`)? Sin V1 el pedido no se cumple.
- **P2.** ¿El catálogo de imagenología trae modalidad por estudio (RX/ECO/TC/RM/…)? Decide la capa.
- **P3.** ¿El estudio fija la región? (p. ej. `IMG_RX_TORAX` ya dice tórax.) Propuesta: si el estudio
  trae una sola región, el picker la muestra elegida y bloqueada y sólo pide lateralidad; si trae varias
  (`allowed`), limita el select; si no trae ninguna, todas.
- **P4.** ¿Regiones por punto (articulaciones) o sólo por select en la primera versión?
- **P10.** ¿Valida la clínica las prioridades de toque y las referencias del §5.1 (temporal→PENASCO, aorta
  descendente→AORTA_ABDOMINAL, salivales→masetero, etc.)?
- **P5.** ¿Aprueba la clínica mostrar aproximaciones (contenedoras/referencias), o esas regiones van sin 3D?
- **P6.** Paciente de sexo femenino: ¿se ocultan PROSTATA, TESTICULO, ESCROTO y PENE del select? ¿Se muestran UTERO, OVARIO y ANEXOS_UTERINOS sin 3D?
- **P7.** ¿Cómo se muestra la atribución CC BY-SA en la ficha clínica?
- **P8.** ¿Un estudio puede llevar varias regiones (p. ej. «manos y pies»)? El valor propuesto es una sola
  región; múltiple cambiaría el contrato a una lista.
- **P9.** ¿Dónde vive el JSON en ejecución: `public/anatomy-atlas-3d/catalog/` o fixture TS?

---

## 9. Script generador (copia exacta)

Guardado en
`/tmp/claude-0/-home-user/17c5888e-e1ea-5dce-bc8b-38a3a096a53a/scratchpad/gen_regiones_cuerpo_3d.py`.
Se ejecutó así:

```bash
python3 -I gen_regiones_cuerpo_3d.py /home/user/mantra-core-health \
  /home/user/mantra-core-health/docs/trabajo/2026-10-31-solicitud-estudios-catalogo-completo/catalogo/regiones-cuerpo-3d.json
# regiones=156 de 156 del catálogo; mallas_con_region=570 de 930; avisos=1
# cobertura {"region": {"propia": 96, "contenedora": 5, "referencia": 15, "ninguna": 5}, "vascular": {"ninguna": 3, "propia": 11, "referencia": 5}, "grupo": {"propia": 9}, "combinada": {"propia": 7}}
# sin regla {}
# AVISO OJO: admite lateralidad pero todas sus mallas son centrales
python3 -I -m json.tool .../catalogo/regiones-cuerpo-3d.json > /dev/null   # JSON_OK
```

Como no hay ids escritos a mano, un cambio en el atlas (otra versión de BodyParts3D) o en el catálogo se
absorbe volviendo a correrlo; si una regla deja de encontrar mallas, un encuadre queda vacío o un código
no existe, sale en `avisos` o el script falla.

```python
#!/usr/bin/env python3
"""Genera regiones-cuerpo-3d.json: región del catálogo de imagenología -> mallas del atlas 3D.

Lee SOLO archivos reales (nada de ids escritos a mano):
  docs/.../catalogo/imagenologia.json              (regiones[]: codigo, nombre, padre, tipo, admite_lateralidad)
  public/anatomy-atlas-3d/catalog/parts.json       (meshId, layer, side, structureId, labelEn, sex)
  public/anatomy-atlas-3d/catalog/index.json       (structureId UBERON del concepto de región)
  public/anatomy-atlas-3d/models/*.glb             (caja de cada malla: translation ± scale, KHR_mesh_quantization)

Cada región se define por reglas (capa + regex sobre labelEn, con exclusiones) o por referencia
a otras regiones ya definidas ("@CODIGO"). Las claves `region` son EXACTAMENTE códigos del
catálogo: el script falla si una no existe, y toda región del catálogo sin regla sale como
`tipo_malla: "ninguna"` y se lista en `sin_regla_por_tipo`.

Uso: python3 -I gen_regiones_cuerpo_3d.py <raiz-del-repo> <salida.json>
"""
import json
import re
import struct
import sys
from pathlib import Path

RAIZ = Path(sys.argv[1])
SALIDA = Path(sys.argv[2])
CAT = RAIZ / "public/anatomy-atlas-3d/catalog"
MOD = RAIZ / "public/anatomy-atlas-3d/models"
CATALOGO = RAIZ / "docs/trabajo/2026-10-31-solicitud-estudios-catalogo-completo/catalogo/imagenologia.json"

partes = json.loads((CAT / "parts.json").read_text())
indice = json.loads((CAT / "index.json").read_text())
catalogo = json.loads(CATALOGO.read_text())
uberon_por_nombre_en = {e[2].lower(): e[0] for e in indice["entries"]}
region_catalogo = {r["codigo"]: r for r in catalogo["regiones"]}

# ---- cajas de las mallas, leídas del GLB --------------------------------------------
cajas = {}
for glb in sorted(MOD.glob("*.glb")):
    datos = glb.read_bytes()
    largo = struct.unpack("<I", datos[12:16])[0]
    gltf = json.loads(datos[20 : 20 + largo])
    for nodo in gltf["nodes"]:
        if "mesh" not in nodo:
            continue
        # Posiciones int16 normalizadas en [-1, 1]: la caja es translation ± scale
        # (sólo vale si no hay rotación ni jerarquía; se comprueba).
        assert "rotation" not in nodo and "children" not in nodo, nodo["name"]
        t, s = nodo["translation"], nodo["scale"]
        cajas[nodo["name"]] = ([t[i] - s[i] for i in range(3)], [t[i] + s[i] for i in range(3)])

faltan_caja = [p["meshId"] for p in partes if p["meshId"] not in cajas]
assert not faltan_caja, faltan_caja


def union(ids):
    ids = [i for i in ids if i in cajas]
    if not ids:
        return None
    mn = [min(cajas[i][0][k] for i in ids) for k in range(3)]
    mx = [max(cajas[i][1][k] for i in ids) for k in range(3)]
    return mn, mx


def interseccion(a, b):
    if a is None or b is None:
        return None
    mn = [max(a[0][k], b[0][k]) for k in range(3)]
    mx = [min(a[1][k], b[1][k]) for k in range(3)]
    return (mn, mx) if all(mn[k] < mx[k] for k in range(3)) else None


# ---- reglas -------------------------------------------------------------------------
# tipo_malla: "propia" (las mallas SON la región), "contenedora" (la región no tiene malla
# pero vive dentro de estas: los senos dentro de sus huesos), "referencia" (no tiene malla
# ni está dentro; se señala una vecina para orientar), "ninguna".
# Una regla es (capa, incluir, excluir) o "@CODIGO" (todas las mallas de esa región).
S, M, O, V, N = "skeleton", "muscles", "organs", "vessels", "nervous"
VERT_C = r"^(atlas|axis|(third|fourth|fifth|sixth|seventh) cervical vertebra)$"
DISCO_C = r"^intervertebral disk of (axis|\w+ cervical vertebra)$"
VERT_T = r"^\w+ thoracic vertebra$"
DISCO_T = r"^intervertebral disk of \w+ thoracic vertebra$"
VERT_L = r"^\w+ lumbar vertebra$"
DISCO_L = r"^intervertebral disk of \w+ lumbar vertebra$"
CARPO = r"(scaphoid|lunate|triquetral|pisiform|trapezium|trapezoid|capitate|hamate)$"
METACARPO = r"metacarpal bone$"
FALANGES_MANO = r"phalanx of (left|right) (thumb|index finger|middle finger|ring finger|little finger)$"
TARSO = r"(talus|calcaneus|cuboid bone|cuneiform bone|navicular bone of (left|right) foot)$"
METATARSO = r"metatarsal bone$"
FALANGES_PIE = r"phalanx of (left|right) (big|second|third|fourth|little) toe$"
SESAMOIDEO_PIE = r"^sesamoid bone of (left|right) foot$"
COSTILLA = r"(\w+ rib|costal cartilage)$"
ESTERNON = r"^(manubrium|body of sternum|xiphoid process)$"
NEURO = r"(frontal bone|parietal bone|occipital bone|temporal bone|sphenoid bone|ethmoid)$"
FACIAL = r"(maxilla|zygomatic bone|nasal bone|lacrimal bone|palatine bone|vomer|inferior nasal concha|mandible)$"
DIENTES = r"secondary (\w+ )?(incisor|canine|premolar|molar) tooth$"
PULMON = r"lobe of (left |right )?lung$"
MUSC_BRAZO = r"(biceps brachii|triceps brachii|brachialis|coracobrachialis)$"
MUSC_MUSLO = r"(rectus femoris|vastus \w+|biceps femoris|semitendinosus|semimembranosus|adductor (longus|brevis|magnus|minimus)|gracilis|sartorius|pectineus)$"
MUSC_PIERNA = r"(gastrocnemius|soleus|plantaris|tibialis (anterior|posterior)|fibularis \w+|extensor digitorum longus|extensor hallucis longus|flexor digitorum longus|flexor hallucis longus|popliteus)$"
SUELO_PELVICO = r"^(left |right )?(coccygeus|iliococcygeus|pubococcygeus|puborectalis|external anal sphincter|tendinous arch of levator ani)$"
PARED_ABD = r"^(left |right )?(rectus abdominis|external oblique|internal oblique|transversus abdominis|pyramidalis|linea alba)$"

# (codigo_del_catalogo, capa_preferida, tipo_malla, reglas, encuadre)
REGIONES = [
    # ---- CABEZA ----
    ("CRANEO", S, "propia", [(S, NEURO, None)], None),
    ("ENCEFALO", N, "propia", [(N, r".", r"spinal cord|optic nerve")], None),
    ("FOSA_POSTERIOR", N, "propia",
     [(N, r"^(cerebellum|pons|medulla oblongata|fourth ventricle|midbrain, nsn|peduncle of midbrain)$", None)], None),
    ("SILLA_TURCA", O, "propia", [(O, r"^pituitary gland$", None), (S, r"^sphenoid bone$", None)], None),
    ("CARA", S, "propia", [(S, FACIAL, None), (S, r"^eyeball$", None)], None),
    ("HUESOS_FACIALES", S, "propia", [(S, FACIAL, None)], None),
    ("SENOS_PARANASALES", S, "contenedora",
     [(S, r"^(frontal bone|ethmoid|sphenoid bone|(left|right) maxilla)$", None)], None),
    ("ORBITA", S, "contenedora", [(S, r"^(eyeball|(left|right) (lacrimal bone|zygomatic bone))$", None)], None),
    ("OJO", S, "propia", [(S, r"^eyeball$", None)], None),
    ("HUESOS_PROPIOS_NARIZ", S, "propia", [(S, r"nasal bone$", None)], None),
    ("MAXILAR", S, "propia", [(S, r"maxilla$", None)], None),
    ("MANDIBULA", S, "propia", [(S, r"^mandible$", None)], None),
    ("CIGOMA", S, "propia", [(S, r"zygomatic bone$", None)], None),
    ("ATM", S, "propia", [(S, r"temporal bone$|^mandible$", None)],
     ("interseccion", [r"temporal bone$", r"^mandible$"])),
    ("MAXILARES", S, "propia", [(S, r"maxilla$|^mandible$", None)], None),
    ("DIENTES", O, "propia", [(O, DIENTES, None), (S, r"^gingiva of (upper|lower) jaw$", None)], None),
    ("ARCADA_DENTARIA_SUPERIOR", O, "propia",
     [(O, r"upper " + DIENTES[:-1] + "$", None), (S, r"^gingiva of upper jaw$", None)], None),
    ("ARCADA_DENTARIA_INFERIOR", O, "propia",
     [(O, r"lower " + DIENTES[:-1] + "$", None), (S, r"^gingiva of lower jaw$", None)], None),
    ("OIDO", S, "contenedora", [(S, r"temporal bone$", None), (O, r"^ear$", None)], None),
    ("PENASCO", S, "propia", [(S, r"temporal bone$", None)], None),
    ("CONDUCTO_AUDITIVO_INTERNO", S, "contenedora", [(S, r"temporal bone$", None)], None),
    ("MASTOIDES", S, "contenedora", [(S, r"temporal bone$", None)], None),
    ("GLANDULAS_SALIVALES", M, "referencia",
     [(M, r"part of (left|right) masseter$|^(left|right) mylohyoid$|^anterior belly of (left|right) digastric$", None)], None),
    ("PAROTIDA", M, "referencia", [(M, r"part of (left|right) masseter$", None)], None),
    ("SUBMANDIBULAR", M, "referencia", [(M, r"^(left|right) mylohyoid$|^anterior belly of (left|right) digastric$", None)], None),
    ("ARTERIAS_INTRACRANEALES", N, "ninguna", [], None),
    ("SENOS_VENOSOS_DURALES", N, "ninguna", [], None),
    # ---- CUELLO ----
    ("TIROIDES", O, "referencia", [(O, r"^(thyroid cartilage|trachea)$", None)], None),
    ("PARATIROIDES", O, "referencia", [(O, r"^(thyroid cartilage|trachea)$", None)], None),
    ("LARINGE", O, "propia", [(O, r"^thyroid cartilage$", None), (S, r"^hyoid bone$", None)], None),
    ("FARINGE", O, "referencia", [(S, r"^hyoid bone$", None), (O, r"^esophagus$", None)], None),
    ("CAVUM", S, "referencia", [(S, r"^(sphenoid bone|vomer)$", None)], None),
    ("TRAQUEA", O, "propia", [(O, r"^trachea$", None)], None),
    ("CAROTIDAS", V, "propia",
     [(V, r"common carotid artery$|^brachiocephalic artery, nsn$|subclavian artery$", None)], None),
    ("ARTERIAS_VERTEBRALES", V, "ninguna", [], None),
    ("VENA_YUGULAR", V, "propia", [(V, r"internal jugular vein$", None)], None),
    ("GANGLIOS_CERVICALES", M, "referencia", [(M, r"^(left|right) sternocleidomastoid$", None)], None),
    # ---- COLUMNA ----
    ("COLUMNA_CERVICAL", S, "propia", [(S, VERT_C, None), (S, DISCO_C, None)], None),
    ("COLUMNA_DORSAL", S, "propia", [(S, VERT_T, None), (S, DISCO_T, None)], None),
    ("COLUMNA_LUMBAR", S, "propia", [(S, VERT_L, None), (S, DISCO_L, None)], None),
    ("SACRO", S, "propia", [(S, r"^sacrum$", None)], None),
    ("COCCIX", S, "referencia", [(S, r"^sacrum$", None)], None),
    ("COLUMNA_CERVICODORSAL", S, "propia", ["@COLUMNA_CERVICAL", "@COLUMNA_DORSAL"], None),
    ("COLUMNA_DORSOLUMBAR", S, "propia", ["@COLUMNA_DORSAL", "@COLUMNA_LUMBAR"], None),
    ("COLUMNA_LUMBOSACRA", S, "propia", ["@COLUMNA_LUMBAR", "@SACRO"], None),
    ("SACROILIACAS", S, "propia", [(S, r"hip bone$|^sacrum$", None)],
     ("interseccion", [r"hip bone$", r"^sacrum$"])),
    ("MEDULA_ESPINAL", N, "propia", [(N, r"^central canal of spinal cord$", None)], None),
    # ---- TORAX ----
    ("PULMONES", O, "propia", [(O, PULMON, None), (O, r"^bronchus$", None)], None),
    ("CORAZON", V, "propia",
     [(V, r"^(wall of heart|mitral valve|tricuspid valve|pulmonary valve)$|papillary muscle of (left|right) ventricle", None)], None),
    ("ARTERIAS_CORONARIAS", V, "propia", [(V, r"coronary artery", None)], None),
    ("AORTA_TORACICA", V, "propia", [(V, r"^(ascending aorta|arch of aorta|descending aorta)$", None)], None),
    ("ARTERIAS_PULMONARES", V, "propia", [(V, r"^pulmonary artery$", None)], None),
    ("MEDIASTINO", V, "propia",
     ["@CORAZON", "@AORTA_TORACICA", "@ARTERIAS_PULMONARES",
      (V, r"^(superior vena cava|pulmonary vein)$|brachiocephalic vein$|^brachiocephalic artery, nsn$", None),
      (O, r"^(trachea|esophagus|bronchus)$|lobe of thymus$", None)], None),
    ("COSTILLAS", S, "propia", [(S, COSTILLA, None)], None),
    ("ESTERNON", S, "propia", [(S, ESTERNON, None)], None),
    ("ESTERNOCLAVICULAR", S, "propia", [(S, r"clavicle$|^manubrium$", None)],
     ("interseccion", [r"clavicle$", r"^manubrium$"])),
    ("MAMA", M, "referencia", [(M, r"part of (left|right) pectoralis major$", None)], None),
    ("AXILA", M, "referencia",
     [(M, r"^(left|right) (pectoralis minor|subscapularis|teres major|latissimus dorsi)$", None)], None),
    ("ESOFAGO", O, "propia", [(O, r"^esophagus$", None)], None),
    # ---- ABDOMEN ----
    ("HIGADO", O, "propia", [(O, r"^liver$", None)], None),
    ("VESICULA_BILIAR", O, "propia", [(O, r"^gallbladder$", None)], None),
    ("VIAS_BILIARES", O, "referencia", [(O, r"^(gallbladder|liver)$", None)], None),
    ("PANCREAS", O, "propia", [(O, r"^(pancreas, nsn|pancreatic duct)$", None)], None),
    ("VIA_BILIOPANCREATICA", O, "referencia", [(O, r"^(gallbladder|pancreatic duct)$", None)], None),
    ("BAZO", O, "propia", [(O, r"^spleen$", None)], None),
    ("RINON", O, "propia", [(O, r"kidney$", None)], None),
    ("SUPRARRENAL", O, "propia", [(O, r"adrenal gland$", None)], None),
    ("URETER", O, "propia", [(O, r"ureter$", None)], None),
    ("ESTOMAGO", O, "propia", [(O, r"^stomach$", None)], None),
    ("DUODENO", O, "propia", [(O, r"^duodenum$", None)], None),
    ("INTESTINO_DELGADO", O, "propia", [(O, r"^(duodenum|jejunum|ileum)$", None)], None),
    ("COLON", O, "propia", [(O, r"^colon, nsn$|taenia$", None)], None),
    ("APENDICE", O, "propia", [(O, r"^appendix$", None)], None),
    ("TRACTO_DIGESTIVO_SUPERIOR", O, "propia", [(O, r"^(esophagus|stomach|duodenum)$", None)], None),
    ("ABDOMEN_SUPERIOR", O, "propia",
     ["@HIGADO", "@VESICULA_BILIAR", "@PANCREAS", "@BAZO", "@ESTOMAGO", "@DUODENO", "@RINON", "@SUPRARRENAL"], None),
    ("VIAS_URINARIAS", O, "propia", ["@RINON", "@URETER", (O, r"^(urinary bladder|urethra)$", None)], None),
    ("AORTA_ABDOMINAL", V, "propia", [(V, r"^descending aorta$", None)], None),
    ("ARTERIAS_RENALES", V, "propia", [(V, r"renal artery$", None)], None),
    ("ARTERIAS_MESENTERICAS", V, "propia",
     [(V, r"^(celiac artery|superior mesenteric artery|inferior mesenteric artery|common hepatic artery|splenic artery|left gastric artery)$", None)], None),
    ("VENA_PORTA", V, "propia", [(V, r"^(splenic vein|superior mesenteric vein)$", None)], None),
    ("VENA_CAVA_INFERIOR", V, "propia", [(V, r"^inferior vena cava$", None)], None),
    ("RETROPERITONEO", O, "propia",
     ["@RINON", "@SUPRARRENAL", "@URETER", "@PANCREAS", "@DUODENO", "@AORTA_ABDOMINAL", "@VENA_CAVA_INFERIOR",
      (M, r"^(left|right) (psoas major|quadratus lumborum)$", None)], None),
    ("PARED_ABDOMINAL", M, "propia", [(M, PARED_ABD, None)], None),
    # ---- PELVIS ----
    ("VEJIGA", O, "propia", [(O, r"^urinary bladder$", None)], None),
    ("URETRA", O, "propia", [(O, r"^urethra$", None)], None),
    ("VEJIGA_URETRA", O, "propia", ["@VEJIGA", "@URETRA"], None),
    ("PROSTATA", O, "propia", [(O, r"^prostate$", None)], None),
    ("VESICULAS_SEMINALES", O, "propia", [(O, r"seminal vesicle$", None)], None),
    ("TESTICULO", O, "propia", [(O, r"testis$", None)], None),
    ("ESCROTO", O, "referencia", [(O, r"(testis|epididymis)$", None)], None),
    ("PENE", O, "propia", [(O, r"^(corpus cavernosum of penis|corpus spongiosum of penis, nsn|glans penis)$", None)], None),
    ("UTERO", O, "ninguna", [], None),
    ("UTERO_TROMPAS", O, "ninguna", [], None),
    ("ANEXOS_UTERINOS", O, "ninguna", [], None),
    ("OVARIO", O, "ninguna", [], None),
    ("PLACENTA", O, "ninguna", [], None),
    ("RECTO", O, "propia", [(O, r"^rectum$", None)], None),
    ("CANAL_ANAL", M, "propia", [(M, r"^external anal sphincter$", None)], None),
    ("SUELO_PELVICO", M, "propia", [(M, SUELO_PELVICO, None)], None),
    ("REGION_INGUINAL", M, "propia", [(M, r"inguinal ligament$", None)], None),
    ("ARTERIAS_ILIACAS", V, "propia", [(V, r"iliac artery$", None)], None),
    # ---- MIEMBRO SUPERIOR ----
    ("HOMBRO", S, "propia", [(S, r"(scapula|clavicle|humerus)$", None)],
     ("interseccion", [r"scapula$", r"humerus$"])),
    ("CLAVICULA", S, "propia", [(S, r"clavicle$", None)], None),
    ("ESCAPULA", S, "propia", [(S, r"scapula$", None)], None),
    ("ACROMIOCLAVICULAR", S, "propia", [(S, r"(scapula|clavicle)$", None)],
     ("interseccion", [r"scapula$", r"clavicle$"])),
    ("PLEXO_BRAQUIAL", M, "referencia",
     [(M, r"^(left|right) scalenus (anterior|medius)$", None), (S, r"clavicle$", None)], None),
    ("HUMERO", S, "propia", [(S, r"humerus$", None)], None),
    ("BRAZO", S, "propia", [(S, r"humerus$", None), (M, MUSC_BRAZO, None)], None),
    ("CODO", S, "propia", [(S, r"(humerus|radius|ulna)$", None)],
     ("interseccion", [r"humerus$", r"ulna$"])),
    ("RADIO_CUBITO", S, "propia", [(S, r"(radius|ulna)$", None)], None),
    ("ANTEBRAZO", S, "propia", [(S, r"(radius|ulna)$|interosseous membrane of (left|right) forearm$", None)], None),
    ("CARPO", S, "propia", [(S, CARPO, None)], None),
    ("ESCAFOIDES", S, "propia", [(S, r"scaphoid$", None)], None),
    ("MUNECA", S, "propia", [(S, CARPO, None), (S, r"(radius|ulna)$", None)], ("union", [CARPO])),
    ("METACARPO", S, "propia", [(S, METACARPO, None)], None),
    ("DEDOS_MANO", S, "propia", [(S, FALANGES_MANO, None)], None),
    ("PULGAR", S, "propia", [(S, r"phalanx of (left|right) thumb$|first metacarpal bone$", None)], None),
    ("MANO", S, "propia", [(S, CARPO, None), (S, METACARPO, None), (S, FALANGES_MANO, None)], None),
    ("ARTERIAS_MIEMBRO_SUPERIOR", V, "referencia", [(V, r"subclavian artery$", None)], None),
    ("VENAS_MIEMBRO_SUPERIOR", V, "referencia", [(V, r"subclavian vein$", None)], None),
    # ---- MIEMBRO INFERIOR ----
    ("CADERA", S, "propia", [(S, r"(hip bone|femur)$", None)], ("interseccion", [r"hip bone$", r"femur$"])),
    ("FEMUR", S, "propia", [(S, r"femur$", None)], None),
    ("MUSLO", S, "propia", [(S, r"femur$", None), (M, MUSC_MUSLO, None)], None),
    ("ROTULA", S, "propia", [(S, r"patella$", None)], None),
    ("RODILLA", S, "propia", [(S, r"(femur|tibia|fibula|patella)$", None)],
     ("interseccion", [r"femur$", r"tibia$"])),
    ("TIBIA_PERONE", S, "propia", [(S, r"(tibia|fibula)$", None)], None),
    ("PIERNA", S, "propia",
     [(S, r"(tibia|fibula)$|interosseous membrane of (left|right) leg$", None), (M, MUSC_PIERNA, None)], None),
    ("TENDON_AQUILES", M, "propia", [(M, r"calcaneal tendon$", None)], None),
    ("TOBILLO", S, "propia", [(S, r"(tibia|fibula|talus)$", None)], ("interseccion", [r"tibia$", r"talus$"])),
    ("CALCANEO", S, "propia", [(S, r"calcaneus$", None)], None),
    ("TARSO", S, "propia", [(S, TARSO, None)], None),
    ("RETROPIE", S, "propia", [(S, r"(talus|calcaneus)$", None)], None),
    ("METATARSO", S, "propia", [(S, METATARSO, None)], None),
    ("DEDOS_PIE", S, "propia", [(S, FALANGES_PIE, None)], None),
    ("SESAMOIDEOS_PIE", S, "propia", [(S, SESAMOIDEO_PIE, None)], None),
    ("ANTEPIE", S, "propia", [(S, METATARSO, None), (S, FALANGES_PIE, None), (S, SESAMOIDEO_PIE, None)], None),
    ("PIE", S, "propia",
     [(S, TARSO, None), (S, METATARSO, None), (S, FALANGES_PIE, None), (S, SESAMOIDEO_PIE, None),
      (S, r"long plantar ligament$", None)], None),
    ("ARTERIAS_MIEMBRO_INFERIOR", V, "referencia", [(V, r"external iliac artery$", None)], None),
    ("VENAS_MIEMBRO_INFERIOR", V, "referencia", [(V, r"external iliac vein$", None)], None),
    ("ARTERIA_FEMORAL", V, "referencia", [(V, r"external iliac artery$", None)], None),
    # ---- GRUPOS (sólo select) ----
    ("CABEZA", S, "propia", ["@CRANEO", "@HUESOS_FACIALES", "@ENCEFALO", "@OJO"], None),
    ("CUELLO", S, "propia", ["@COLUMNA_CERVICAL", "@LARINGE", "@TRAQUEA", "@ESOFAGO", "@CAROTIDAS", "@VENA_YUGULAR"], None),
    ("COLUMNA", S, "propia", ["@COLUMNA_CERVICAL", "@COLUMNA_DORSAL", "@COLUMNA_LUMBAR", "@SACRO"], None),
    ("TORAX", S, "propia", ["@COSTILLAS", "@ESTERNON", "@COLUMNA_DORSAL", "@PULMONES", "@MEDIASTINO"], None),
    ("ABDOMEN", O, "propia",
     ["@ABDOMEN_SUPERIOR", "@INTESTINO_DELGADO", "@COLON", "@APENDICE", "@URETER", "@AORTA_ABDOMINAL",
      "@VENA_CAVA_INFERIOR", "@PARED_ABDOMINAL"], None),
    ("PELVIS", S, "propia",
     [(S, r"hip bone$|^sacrum$", None), "@VEJIGA", "@RECTO", "@PROSTATA", "@ARTERIAS_ILIACAS"], None),
    ("MIEMBRO_SUPERIOR", S, "propia",
     ["@CLAVICULA", "@ESCAPULA", "@HUMERO", "@RADIO_CUBITO", "@MANO"], None),
    ("MIEMBRO_INFERIOR", S, "propia", ["@FEMUR", "@ROTULA", "@TIBIA_PERONE", "@PIE"], None),
    ("CUERPO_ENTERO", S, "propia", [(S, r".", None)], None),
    # ---- COMBINADAS (sólo select) ----
    ("CABEZA_CUELLO", S, "propia", ["@CABEZA", "@CUELLO"], None),
    ("CUELLO_TORAX", S, "propia", ["@CUELLO", "@TORAX"], None),
    ("TORAX_ABDOMEN", S, "propia", ["@TORAX", "@ABDOMEN"], None),
    ("ABDOMEN_PELVIS", S, "propia", ["@ABDOMEN", "@PELVIS"], None),
    ("TORAX_ABDOMEN_PELVIS", S, "propia", ["@TORAX", "@ABDOMEN", "@PELVIS"], None),
    ("CUELLO_TORAX_ABDOMEN_PELVIS", S, "propia", ["@CUELLO", "@TORAX", "@ABDOMEN", "@PELVIS"], None),
    ("PELVIS_MIEMBROS_INFERIORES", S, "propia", ["@PELVIS", "@MIEMBRO_INFERIOR"], None),
]

# El concepto UBERON de la región, buscado por su nombre inglés exacto en index.json.
NOMBRE_UBERON = {
    "CRANEO": "skull", "ENCEFALO": "brain", "FOSA_POSTERIOR": "hindbrain", "SILLA_TURCA": "pituitary gland",
    "CARA": "face", "HUESOS_FACIALES": "facial skeleton", "SENOS_PARANASALES": "paranasal sinus",
    "ORBITA": "orbital region", "OJO": "eyeball of camera-type eye", "HUESOS_PROPIOS_NARIZ": "nasal bone",
    "MAXILAR": "maxilla", "MANDIBULA": "mandible", "CIGOMA": "jugal bone", "ATM": "temporomandibular joint",
    "MAXILARES": "jaw skeleton", "DIENTES": "dentition", "ARCADA_DENTARIA_SUPERIOR": "upper jaw region",
    "ARCADA_DENTARIA_INFERIOR": "lower jaw region", "OIDO": "ear", "PENASCO": "temporal bone",
    "CONDUCTO_AUDITIVO_INTERNO": "internal acoustic meatus", "MASTOIDES": "mastoid process",
    "GLANDULAS_SALIVALES": "saliva-secreting gland", "PAROTIDA": "parotid gland",
    "SUBMANDIBULAR": "submandibular gland", "TIROIDES": "thyroid gland", "PARATIROIDES": "parathyroid gland",
    "LARINGE": "larynx", "FARINGE": "pharynx", "CAVUM": "nasopharynx", "TRAQUEA": "trachea",
    "CAROTIDAS": "common carotid artery plus branches", "VENA_YUGULAR": "internal jugular vein",
    "GANGLIOS_CERVICALES": "cervical lymph node", "COLUMNA_CERVICAL": "cervical region of vertebral column",
    "COLUMNA_DORSAL": "thoracic region of vertebral column", "COLUMNA_LUMBAR": "lumbar region of vertebral column",
    "SACRO": "fused sacrum", "COCCIX": "coccyx", "SACROILIACAS": "sacroiliac joint", "MEDULA_ESPINAL": "spinal cord",
    "COLUMNA": "vertebral column", "PULMONES": "pair of lungs", "MEDIASTINO": "mediastinum", "CORAZON": "heart",
    "ARTERIAS_CORONARIAS": "coronary artery", "AORTA_TORACICA": "thoracic aorta",
    "ARTERIAS_PULMONARES": "pulmonary artery", "COSTILLAS": "thoracic rib cage", "ESTERNON": "sternum",
    "ESTERNOCLAVICULAR": "sternoclavicular joint", "MAMA": "breast", "AXILA": "axilla", "ESOFAGO": "esophagus",
    "HIGADO": "liver", "VESICULA_BILIAR": "gallbladder", "VIAS_BILIARES": "biliary tree", "PANCREAS": "pancreas",
    "BAZO": "spleen", "RINON": "kidney", "SUPRARRENAL": "adrenal gland", "URETER": "ureter",
    "VIAS_URINARIAS": "renal system", "ESTOMAGO": "stomach", "DUODENO": "duodenum",
    "INTESTINO_DELGADO": "small intestine", "COLON": "colon", "APENDICE": "appendix",
    "RETROPERITONEO": "retroperitoneal space", "PARED_ABDOMINAL": "abdominal wall",
    "AORTA_ABDOMINAL": "abdominal aorta", "ARTERIAS_RENALES": "renal artery",
    "VENA_PORTA": "hepatic portal vein", "VENA_CAVA_INFERIOR": "inferior vena cava", "VEJIGA": "urinary bladder",
    "URETRA": "urethra", "PROSTATA": "prostate gland", "VESICULAS_SEMINALES": "seminal vesicle", "UTERO": "uterus",
    "ANEXOS_UTERINOS": "uterine adnexa", "OVARIO": "ovary", "ESCROTO": "scrotum", "TESTICULO": "testis",
    "PENE": "penis", "RECTO": "rectum", "CANAL_ANAL": "anal canal", "SUELO_PELVICO": "pelvic floor",
    "REGION_INGUINAL": "inguinal region", "ARTERIAS_ILIACAS": "common iliac artery", "PLACENTA": "placenta",
    "HOMBRO": "shoulder", "CLAVICULA": "clavicle bone", "ESCAPULA": "scapula",
    "ACROMIOCLAVICULAR": "acromioclavicular joint", "PLEXO_BRAQUIAL": "brachial nerve plexus",
    "BRAZO": "forelimb stylopod", "HUMERO": "humerus", "CODO": "elbow", "ANTEBRAZO": "forelimb zeugopod",
    "RADIO_CUBITO": "forelimb zeugopod skeleton", "MUNECA": "carpal region", "CARPO": "carpal skeleton",
    "ESCAFOIDES": "radiale", "MANO": "manus", "METACARPO": "metacarpus", "DEDOS_MANO": "manual digit",
    "PULGAR": "manual digit 1", "CADERA": "hip", "MUSLO": "hindlimb stylopod", "FEMUR": "femur",
    "RODILLA": "knee", "ROTULA": "patella", "PIERNA": "hindlimb zeugopod", "TIBIA_PERONE": "hindlimb zeugopod skeleton",
    "TENDON_AQUILES": "calcaneal tendon", "TOBILLO": "ankle joint", "PIE": "pes", "CALCANEO": "calcaneus",
    "TARSO": "tarsal skeleton", "METATARSO": "metatarsus", "DEDOS_PIE": "pedal digit",
    "SESAMOIDEOS_PIE": "sesamoid bone of pes", "ARTERIA_FEMORAL": "femoral artery",
    "CABEZA": "head", "CUELLO": "neck", "TORAX": "chest", "ABDOMEN": "abdomen", "PELVIS": "pelvic region of trunk",
    "MIEMBRO_SUPERIOR": "forelimb", "MIEMBRO_INFERIOR": "hindlimb", "CUERPO_ENTERO": "body proper",
}

LADO = {"left": "izquierda", "right": "derecha", None: "centro"}

# Cómo se llega a la región desde el modelo:
#   "malla": tocar una de sus mallas la propone (si la malla está en varias, gana la región
#            con menos mallas: la más específica);
#   "punto": articulaciones; se proponen si el punto tocado cae en su caja de encuadre
#            (necesita que el visor emita el punto, ver hallazgos §4);
#   "solo_select": grupos, combinadas, agregadas o sin malla propia; sólo desde el select.
AGREGADAS = {
    "COLUMNA_CERVICODORSAL", "COLUMNA_DORSOLUMBAR", "COLUMNA_LUMBOSACRA", "MEDIASTINO", "ABDOMEN_SUPERIOR",
    "VIAS_URINARIAS", "TRACTO_DIGESTIVO_SUPERIOR", "RETROPERITONEO", "VEJIGA_URETRA", "MAXILARES",
    "INTESTINO_DELGADO", "CARA", "MUSLO", "BRAZO", "PIERNA",
}


def modo_de_toque(codigo, tipo, encuadre):
    if tipo != "propia" or codigo in AGREGADAS or region_catalogo[codigo]["tipo"] in ("grupo", "combinada"):
        return "solo_select"
    if encuadre is not None and encuadre[0] == "interseccion":
        return "punto"
    return "malla"


def elegir(capa, incluir, excluir):
    rx, rx_no = re.compile(incluir, re.I), re.compile(excluir, re.I) if excluir else None
    return [p for p in partes if p["layer"] == capa and rx.search(p["labelEn"])
            and not (rx_no and rx_no.search(p["labelEn"]))]


# ---- validación contra el catálogo --------------------------------------------------
codigos_regla = [r[0] for r in REGIONES]
assert len(codigos_regla) == len(set(codigos_regla)), "código repetido en REGIONES"
desconocidos = [c for c in codigos_regla if c not in region_catalogo]
assert not desconocidos, f"códigos que no están en imagenologia.json: {desconocidos}"
for c in NOMBRE_UBERON:
    assert c in region_catalogo, c

con_regla = set(codigos_regla)
sin_regla_por_tipo = {}
for r in catalogo["regiones"]:
    if r["codigo"] not in con_regla:
        sin_regla_por_tipo.setdefault(r["tipo"], []).append(r["codigo"])
        REGIONES.append((r["codigo"], S, "ninguna", [], None))

# ---- generación -----------------------------------------------------------------------
salida, avisos, malla_a_regiones, elegidas_por_codigo = [], [], {}, {}
for codigo, capa, tipo, reglas, encuadre in REGIONES:
    cat = region_catalogo[codigo]
    al_tocar = modo_de_toque(codigo, tipo, encuadre)
    elegidas = {}
    for regla in reglas:
        if isinstance(regla, str) and regla.startswith("@"):
            ref = regla[1:]
            assert ref in elegidas_por_codigo, f"{codigo}: {ref} tiene que definirse antes"
            encontradas = list(elegidas_por_codigo[ref].values())
        else:
            capa_r, inc, exc = regla
            encontradas = elegir(capa_r, inc, exc)
            if not encontradas:
                avisos.append(f"{codigo}: la regla {capa_r} /{inc}/ no encontró mallas")
        for p in encontradas:
            elegidas[p["meshId"]] = p
    elegidas_por_codigo[codigo] = elegidas
    if tipo != "ninguna" and not elegidas:
        avisos.append(f"{codigo}: tipo {tipo} sin mallas")

    mallas = {"izquierda": [], "derecha": [], "centro": []}
    for p in sorted(elegidas.values(), key=lambda p: p["meshId"]):
        mallas[LADO[p["side"]]].append(p["meshId"])
        if tipo == "propia":
            # Al tocar, una articulación ("punto") sólo gana por el punto tocado (visor V2);
            # como región por defecto de la malla va detrás de las agregadas: tocar el coxal
            # propone PELVIS, no SACROILIACAS.
            nivel = {"malla": 0, "solo_select": 1, "punto": 2}[al_tocar]
            malla_a_regiones.setdefault(p["meshId"], []).append((nivel, len(elegidas), codigo))
    capas = sorted({p["layer"] for p in elegidas.values()})
    solo_masculino = sorted(p["meshId"] for p in elegidas.values() if p["sex"] == "male")
    if cat["admite_lateralidad"] and elegidas and not mallas["izquierda"] and not mallas["derecha"]:
        avisos.append(f"{codigo}: admite lateralidad pero todas sus mallas son centrales")

    enc = None
    if encuadre is not None:
        modo, grupos_rx = encuadre
        enc = {"modo": modo, "grupos": {}, "caja_cm_verificada": {}}
        for lado_en, lado_es in (("left", "izquierda"), ("right", "derecha")):
            grupos = []
            for rx in grupos_rx:
                r = re.compile(rx, re.I)
                grupos.append(sorted(p["meshId"] for p in elegidas.values()
                                     if r.search(p["labelEn"]) and p["side"] in (lado_en, None)))
            caja = union(grupos[0])
            for g in grupos[1:]:
                caja = interseccion(caja, union(g)) if modo == "interseccion" else caja
            if caja is None:
                avisos.append(f"{codigo} {lado_es}: el encuadre por {modo} quedó vacío")
            enc["grupos"][lado_es] = grupos
            enc["caja_cm_verificada"][lado_es] = (
                None if caja is None else [round((caja[1][k] - caja[0][k]) * 100, 1) for k in range(3)])

    uberon = uberon_por_nombre_en.get(NOMBRE_UBERON.get(codigo, "").lower())
    criterio = "; ".join(
        f"mallas de {r[1:]}" if isinstance(r, str) else
        f"capa={r[0]} labelEn~/{r[1]}/" + (f" excepto /{r[2]}/" if r[2] else "") for r in reglas)
    salida.append({
        "region": codigo,
        "nombre": cat["nombre"],
        "padre": cat["padre"],
        "tipo_catalogo": cat["tipo"],
        "lateral": cat["admite_lateralidad"],
        "capa_preferida": capa,
        "capas_con_mallas": capas,
        "tipo_malla": tipo,
        "al_tocar": al_tocar,
        "sin_malla": tipo != "propia",
        "uberon_region": uberon,
        "mallas": mallas,
        "solo_cuerpo_masculino": solo_masculino,
        "structureIds": sorted({p["structureId"] for p in elegidas.values()}),
        "encuadre": enc,
        "criterio": criterio or "sin regla: el atlas no tiene ninguna malla de esta región",
    })

# Malla -> región por defecto al tocar: primero las regiones "malla", después las agregadas
# y los grupos, al final las articulaciones; dentro del mismo nivel, la de menos mallas.
toque = {m: min(rs)[2] for m, rs in sorted(malla_a_regiones.items())}

# Comprobación del convenio de lado: la izquierda del paciente debería estar en +x.
xs = {s: [sum(cajas[p["meshId"]][k][0] for k in (0, 1)) / 2 for p in partes if p["side"] == s]
      for s in ("left", "right")}
convenio = {s: round(sum(v) / len(v), 4) for s, v in xs.items()}

por_tipo_malla = {}
for r in salida:
    por_tipo_malla.setdefault(r["tipo_catalogo"], {}).setdefault(r["tipo_malla"], 0)
    por_tipo_malla[r["tipo_catalogo"]][r["tipo_malla"]] += 1

doc = {
    "generado_por": "gen_regiones_cuerpo_3d.py (ver hallazgos-cuerpo-3d.md §9)",
    "catalogo": {"archivo": "catalogo/imagenologia.json", "version": catalogo.get("version"),
                 "regiones": len(catalogo["regiones"])},
    "fuentes": ["public/anatomy-atlas-3d/catalog/parts.json", "public/anatomy-atlas-3d/catalog/index.json",
                "public/anatomy-atlas-3d/models/*.glb"],
    "convenio_lado": {"x_media_left_m": convenio["left"], "x_media_right_m": convenio["right"],
                      "nota": "side del atlas = lado del paciente; left está en +x del modelo"},
    "cobertura_por_tipo_catalogo": por_tipo_malla,
    "sin_regla_por_tipo": sin_regla_por_tipo,
    "regiones": salida,
    "toque_malla_a_region": toque,
    "avisos": avisos,
}
SALIDA.write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n")

print(f"regiones={len(salida)} de {len(catalogo['regiones'])} del catálogo; "
      f"mallas_con_region={len(toque)} de {len(partes)}; avisos={len(avisos)}")
print("cobertura", json.dumps(por_tipo_malla, ensure_ascii=False))
print("sin regla", json.dumps(sin_regla_por_tipo, ensure_ascii=False))
for a in avisos:
    print("AVISO", a)
for r in salida:
    n = sum(len(v) for v in r["mallas"].values())
    caja = r["encuadre"]["caja_cm_verificada"] if r["encuadre"] else ""
    print(f"{r['region']:28} {r['tipo_catalogo']:9} {r['tipo_malla']:11} {r['al_tocar']:11} n={n:3} "
          f"izq={len(r['mallas']['izquierda']):2} der={len(r['mallas']['derecha']):2} "
          f"cen={len(r['mallas']['centro']):2} uberon={r['uberon_region']} {caja}")
print("convenio", convenio)
```
