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
| RX, TC de hueso, densitometría | `skeleton` | caso dominante (36 de 48 regiones tienen `capa_preferida: skeleton`) |
| ECO abdominal / renal / vesical / prostática / testicular, TC abdomen-pelvis | `organs` | |
| TC/RM de encéfalo | `nervous` + `skeleton` (cráneo atenuado) | `ENCEFALO` usa 96 mallas de `nervous` |
| Angio-TC, Doppler | `vessels` | hoy no hay regiones vasculares en la lista tentativa |
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

Generado por `gen_regiones_cuerpo_3d.py` (§9) leyendo `parts.json`, `index.json` y los cinco GLB.
Validado con `python3 -I -m json.tool` (OK) y con una comprobación aparte: **0** ids de malla que no
existan en `parts.json`, **0** mallas en un balde de lado que no coincida con su `side`, y `structureIds`
idéntico al conjunto derivado de las mallas en las 48 regiones. El script terminó con **0 avisos**
(ninguna regla vacía, ningún encuadre vacío).

Forma de cada región (además de lo pedido: `region`, `capa_preferida`, `mallas{izquierda,derecha,centro}`,
`structureIds`, `criterio`, `sin_malla`):

- `nombre`, `lateral`, `capas_con_mallas`, `tipo_malla`, `al_tocar`, `uberon_region` (concepto UBERON de la
  región, buscado por nombre inglés exacto en `index.json`; `null` si no hay), `solo_cuerpo_masculino`,
  `encuadre` (`modo`, `grupos` por lado y `caja_cm_verificada`).
- A nivel raíz: `toque_malla_a_region` (malla → región por defecto al tocar: primero regiones `malla`,
  después `punto`, después agregadas; dentro del nivel, la de menos mallas), `convenio_lado`, `avisos`.

`sin_malla` es `true` para todo lo que no es `propia` (las `contenedora/referencia` traen mallas, pero no
son de la región).

### 5.1 Cobertura (48 regiones tentativas)

| Región | tipo | al tocar | capa | mallas izq/der/centro | UBERON región |
|---|---|---|---|---|---|
| CRANEO | propia | malla | skeleton | 2 / 2 / 4 | UBERON:0003129 |
| SENOS_PARANASALES | **contenedora** | solo_select | skeleton | 1 / 1 / 3 | UBERON:0001825 |
| ORBITA | **contenedora** | solo_select | skeleton | 2 / 2 / 1 | UBERON:0004088 |
| MACIZO_FACIAL | propia | malla | skeleton | 6 / 6 / 1 | UBERON:0001456 |
| HUESOS_PROPIOS_NARIZ | propia | malla | skeleton | 1 / 1 / 0 | UBERON:0001681 |
| MANDIBULA | propia | malla | skeleton | 0 / 0 / 1 | UBERON:0001684 |
| PIEZAS_DENTARIAS | propia | malla | organs | 14 / 14 / 2 | UBERON:0003672 |
| ATM | propia | punto | skeleton | 1 / 1 / 1 | UBERON:0003700 |
| OIDO_PENASCO | **contenedora** | solo_select | skeleton | 1 / 1 / 1 | UBERON:0001690 |
| SILLA_TURCA_HIPOFISIS | propia | malla | organs | 0 / 0 / 2 | UBERON:0000007 |
| ENCEFALO | propia | malla | nervous | 36 / 36 / 24 | UBERON:0000955 |
| CUELLO | propia | malla | organs | 2 / 2 / 3 | UBERON:0000974 |
| TIROIDES | **referencia** | solo_select | organs | 0 / 0 / 2 | UBERON:0002046 |
| COLUMNA_CERVICAL | propia | malla | skeleton | 0 / 0 / 13 | UBERON:0006072 |
| COLUMNA_DORSAL | propia | malla | skeleton | 0 / 0 / 24 | UBERON:0006073 |
| COLUMNA_LUMBAR | propia | malla | skeleton | 0 / 0 / 10 | UBERON:0006074 |
| COLUMNA_LUMBOSACRA | propia | solo_select | skeleton | 0 / 0 / 11 | — |
| SACRO_COXIS | propia (sin cóccix) | malla | skeleton | 0 / 0 / 1 | UBERON:0003690 |
| COLUMNA_TOTAL | propia | solo_select | skeleton | 0 / 0 / 48 | UBERON:0001130 |
| TORAX | propia | malla | skeleton | 22 / 22 / 6 | UBERON:0001443 |
| PARRILLA_COSTAL | propia | malla | skeleton | 20 / 20 / 0 | UBERON:0003252 |
| ESTERNON | propia | malla | skeleton | 0 / 0 / 3 | UBERON:0000975 |
| CLAVICULA | propia | malla | skeleton | 1 / 1 / 0 | UBERON:0001105 |
| MAMA | **referencia** | solo_select | muscles | 3 / 3 / 0 | UBERON:0000310 |
| CORAZON | propia | malla | vessels | 0 / 0 / 4 | UBERON:0000948 |
| ABDOMEN | propia | malla | organs | 2 / 2 / 15 | UBERON:0000916 |
| ABDOMEN_SUPERIOR | propia | solo_select | organs | 0 / 0 / 5 | — |
| RENAL | propia | malla | organs | 1 / 1 / 0 | — |
| VIAS_URINARIAS | propia | solo_select | organs | 2 / 2 / 2 | UBERON:0001008 |
| VESICAL | propia | malla | organs | 0 / 0 / 1 | UBERON:0001255 |
| PROSTATA | propia (sólo masculino) | malla | organs | 0 / 0 / 1 | UBERON:0002367 |
| TESTICULAR | propia (sólo masculino) | malla | organs | 2 / 2 / 0 | UBERON:0000473 |
| UTERO_ANEXOS | **ninguna** | solo_select | organs | 0 / 0 / 0 | UBERON:0000995 |
| PELVIS | propia | malla | skeleton | 1 / 1 / 3 | UBERON:0002355 |
| SACROILIACA | propia | punto | skeleton | 1 / 1 / 1 | — |
| HOMBRO | propia | punto | skeleton | 3 / 3 / 0 | UBERON:0001467 |
| HUMERO | propia | malla | skeleton | 1 / 1 / 0 | UBERON:0000976 |
| CODO | propia | punto | skeleton | 3 / 3 / 0 | UBERON:0001461 |
| ANTEBRAZO | propia | malla | skeleton | 3 / 3 / 0 | UBERON:0002386 |
| MUNECA | propia | malla | skeleton | 10 / 10 / 0 | UBERON:0004452 |
| MANO | propia | malla | skeleton | 27 / 27 / 0 | UBERON:0002398 |
| CADERA | propia | punto | skeleton | 2 / 2 / 0 | UBERON:0001464 |
| FEMUR | propia | malla | skeleton | 1 / 1 / 0 | UBERON:0000981 |
| RODILLA | propia | punto | skeleton | 4 / 4 / 0 | UBERON:0001465 |
| PIERNA | propia | malla | skeleton | 3 / 3 / 0 | UBERON:0003823 |
| TOBILLO | propia | punto | skeleton | 3 / 3 / 0 | UBERON:0001488 |
| PIE | propia | malla | skeleton | 28 / 28 / 0 | UBERON:0002387 |
| CALCANEO | propia | malla | skeleton | 1 / 1 / 0 | UBERON:0001450 |

Resumen: **41 con malla propia**, 3 contenedoras (senos, órbita, oído), 2 referencias (mama, tiroides),
1 sin nada (útero y anexos). 7 articulaciones se resuelven por punto. De 930 mallas, **419** proponen
una región al tocarlas; las demás (437 músculos, 57 vasos, 3 nerviosas, 2 óseas: hioides y globo ocular;
y las 10 genitales/glándulas sin región: pene, conductos deferentes, vesículas seminales, timo, labio,
cartílagos nasales, oreja) no proponen nada y el toque se ignora con un aviso.

Ejemplo real (MANO): 27 mallas por lado = 8 carpianos + 5 metacarpianos + 14 falanges (pulgar sin falange
media), todas con `side` coherente; p. ej. `FMA24436` «left scaphoid», `FMA24465` «left first metacarpal
bone», `FMA65470` «proximal phalanx of left thumb».

### 5.2 Encuadre de articulaciones (verificado con las cajas del GLB)

Intersección de las cajas de los huesos que forman la articulación (tamaño x/y/z en cm, lado izquierdo):

| Región | grupos | caja |
|---|---|---|
| ATM | temporal ∩ mandíbula | 3,9 × 2,9 × 4,1 |
| HOMBRO | escápula ∩ húmero | 2,8 × 14,5 × 5,0 |
| CODO | húmero ∩ cúbito | 4,4 × 2,4 × 5,0 |
| CADERA | coxal ∩ fémur | 10,0 × 8,3 × 7,4 |
| SACROILIACA | coxal ∩ sacro | 5,8 × 14,5 × 8,1 |
| RODILLA | fémur ∩ tibia | 7,6 × **0,4** × 6,2 |
| TOBILLO | tibia ∩ astrágalo | 4,1 × 1,0 × 5,3 |
| MUNECA | unión de los carpianos | 5,0 × 3,1 × 2,8 |

Ninguna vacía, pero rodilla y tobillo son láminas finas: V1 debe agrandar la caja a un mínimo. La del
hombro es alta porque la caja de la escápula lo es; se ve bien igual, pero es una aproximación por cajas
alineadas a los ejes, no geometría real.

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
5. **Cuerpo único masculino**: PROSTATA/TESTICULAR desaparecen del modelo con `sex='female'`
   (`anatomy-viewer.ts:374`); UTERO_ANEXOS no existe. Hay que decidir qué hace el select según el sexo del
   paciente (P6).
6. **Códigos tentativos**: los 48 códigos son de este informe. Cuando exista
   `catalogo/imagenologia.json` hay que alinear códigos y nombres y volver a correr el script; una región
   del catálogo que no esté en el mapeo debe salir como `ninguna`, no fallar.
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
- **P5.** ¿Aprueba la clínica mostrar aproximaciones (contenedoras/referencias), o esas regiones van sin 3D?
- **P6.** Paciente de sexo femenino: ¿se ocultan PROSTATA/TESTICULAR del select? ¿Se muestra UTERO_ANEXOS sin 3D?
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
# regiones=48 mallas_con_region=419 de 930 avisos=0
python3 -I -m json.tool .../catalogo/regiones-cuerpo-3d.json > /dev/null   # JSON_OK
```

Como no hay ids escritos a mano, un cambio en el atlas (otra versión de BodyParts3D) se absorbe volviendo a
correrlo; si una regla deja de encontrar mallas o un encuadre queda vacío, sale en `avisos`.

```python
#!/usr/bin/env python3
"""Genera regiones-cuerpo-3d.json: región radiológica -> mallas del atlas 3D.

Lee SOLO los archivos reales del atlas (nada de ids escritos a mano):
  public/anatomy-atlas-3d/catalog/parts.json   (meshId, layer, side, structureId, labelEn, sex)
  public/anatomy-atlas-3d/catalog/index.json   (para el structureId UBERON del concepto de región)
  public/anatomy-atlas-3d/models/*.glb         (caja de cada malla: translation ± scale, KHR_mesh_quantization)

Cada región se define por reglas (capa + regex sobre labelEn, con exclusiones). Las cajas
se usan para comprobar que el encuadre de cada articulación (intersección de los huesos
que la forman) no queda vacío.

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

partes = json.loads((CAT / "parts.json").read_text())
indice = json.loads((CAT / "index.json").read_text())
uberon_por_nombre_en = {e[2].lower(): e[0] for e in indice["entries"]}

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
S, M, O, V, N = "skeleton", "muscles", "organs", "vessels", "nervous"
VERT_C = r"^(atlas|axis|(third|fourth|fifth|sixth|seventh) cervical vertebra)$"
DISCO_C = r"^intervertebral disk of (axis|\w+ cervical vertebra)$"
VERT_T = r"^\w+ thoracic vertebra$"
DISCO_T = r"^intervertebral disk of \w+ thoracic vertebra$"
VERT_L = r"^\w+ lumbar vertebra$"
DISCO_L = r"^intervertebral disk of \w+ lumbar vertebra$"
CARPO = r"(scaphoid|lunate|triquetral|pisiform|trapezium|trapezoid|capitate|hamate)$"
MANO = r"(metacarpal bone|phalanx of (left|right) (thumb|index finger|middle finger|ring finger|little finger))$"
TARSO = r"(talus|calcaneus|cuboid bone|cuneiform bone|navicular bone of (left|right) foot)$"
PIE = r"(metatarsal bone|phalanx of (left|right) (big|second|third|fourth|little) toe|sesamoid bone of (left|right) foot|long plantar ligament)$"
COSTILLA = r"(\w+ rib|costal cartilage)$"
ESTERNON = r"^(manubrium|body of sternum|xiphoid process)$"
NEURO = r"(frontal bone|parietal bone|occipital bone|temporal bone|sphenoid bone|ethmoid)$"
FACIAL = r"(maxilla|zygomatic bone|nasal bone|lacrimal bone|palatine bone|vomer|inferior nasal concha|mandible)$"

REGIONES = [
    # código, nombre, lateral, capa_preferida, tipo, reglas[(capa, incluir, excluir)], encuadre
    ("CRANEO", "Cráneo", False, S, "propia", [(S, NEURO, None)], None),
    ("SENOS_PARANASALES", "Senos paranasales", False, S, "contenedora",
     [(S, r"^(frontal bone|ethmoid|sphenoid bone|(left|right) maxilla)$", None)], None),
    ("ORBITA", "Órbita", True, S, "contenedora",
     [(S, r"^(eyeball|(left|right) (lacrimal bone|zygomatic bone))$", None)], None),
    ("MACIZO_FACIAL", "Macizo facial", False, S, "propia", [(S, FACIAL, r"^mandible$")], None),
    ("HUESOS_PROPIOS_NARIZ", "Huesos propios de la nariz", False, S, "propia", [(S, r"nasal bone$", None)], None),
    ("MANDIBULA", "Mandíbula", False, S, "propia", [(S, r"^mandible$", None)], None),
    ("PIEZAS_DENTARIAS", "Piezas dentarias (panorámica)", False, O, "propia",
     [(O, r"secondary \w+ tooth$|secondary (\w+ )?(incisor|canine|premolar|molar) tooth$", None),
      (S, r"^gingiva of (upper|lower) jaw$", None)], None),
    ("ATM", "Articulación temporomandibular", True, S, "propia",
     [(S, r"temporal bone$|^mandible$", None)],
     ("interseccion", [r"temporal bone$", r"^mandible$"])),
    ("OIDO_PENASCO", "Oído / peñasco del temporal", True, S, "contenedora",
     [(S, r"temporal bone$", None), (O, r"^ear$", None)], None),
    ("SILLA_TURCA_HIPOFISIS", "Silla turca / hipófisis", False, O, "propia",
     [(O, r"^pituitary gland$", None), (S, r"^sphenoid bone$", None)], None),
    ("ENCEFALO", "Encéfalo", False, N, "propia", [(N, r".", r"spinal cord|optic nerve")], None),
    ("CUELLO", "Cuello (partes blandas)", False, O, "propia",
     [(O, r"^(thyroid cartilage|trachea|esophagus)$", None),
      (V, r"(common carotid artery|internal jugular vein)$", None)], None),
    ("TIROIDES", "Tiroides", False, O, "referencia", [(O, r"^(thyroid cartilage|trachea)$", None)], None),
    ("COLUMNA_CERVICAL", "Columna cervical", False, S, "propia", [(S, VERT_C, None), (S, DISCO_C, None)], None),
    ("COLUMNA_DORSAL", "Columna dorsal", False, S, "propia", [(S, VERT_T, None), (S, DISCO_T, None)], None),
    ("COLUMNA_LUMBAR", "Columna lumbar", False, S, "propia", [(S, VERT_L, None), (S, DISCO_L, None)], None),
    ("COLUMNA_LUMBOSACRA", "Columna lumbosacra", False, S, "propia",
     [(S, VERT_L, None), (S, DISCO_L, None), (S, r"^sacrum$", None)], None),
    ("SACRO_COXIS", "Sacro y cóccix", False, S, "propia", [(S, r"^sacrum$", None)], None),
    ("COLUMNA_TOTAL", "Columna total", False, S, "propia",
     [(S, VERT_C, None), (S, DISCO_C, None), (S, VERT_T, None), (S, DISCO_T, None),
      (S, VERT_L, None), (S, DISCO_L, None), (S, r"^sacrum$", None)], None),
    ("TORAX", "Tórax", False, S, "propia",
     [(S, COSTILLA, None), (S, ESTERNON, None),
      (O, r"lobe of (left |right )?lung$|^(trachea|bronchus)$", None)], None),
    ("PARRILLA_COSTAL", "Parrilla costal", True, S, "propia", [(S, COSTILLA, None)], None),
    ("ESTERNON", "Esternón", False, S, "propia", [(S, ESTERNON, None)], None),
    ("CLAVICULA", "Clavícula", True, S, "propia", [(S, r"clavicle$", None)], None),
    ("MAMA", "Mama", True, M, "referencia", [(M, r"part of (left|right) pectoralis major$", None)], None),
    ("CORAZON", "Corazón", False, V, "propia",
     [(V, r"^(wall of heart|mitral valve|tricuspid valve|pulmonary valve)$", None)], None),
    ("ABDOMEN", "Abdomen", False, O, "propia",
     [(O, r"^(liver|gallbladder|spleen|stomach|duodenum|jejunum|ileum|appendix|colon, nsn|pancreas, nsn|pancreatic duct|rectum|(free|mesocolic|omental) taenia)$", None),
      (O, r"(kidney|adrenal gland)$", None)], None),
    ("ABDOMEN_SUPERIOR", "Abdomen superior (hígado, vía biliar, páncreas, bazo)", False, O, "propia",
     [(O, r"^(liver|gallbladder|spleen|pancreas, nsn|pancreatic duct)$", None)], None),
    ("RENAL", "Riñón", True, O, "propia", [(O, r"kidney$", None)], None),
    ("VIAS_URINARIAS", "Vías urinarias (riñones, uréteres, vejiga)", False, O, "propia",
     [(O, r"(kidney|ureter)$|^urinary bladder$|^urethra$", None)], None),
    ("VESICAL", "Vejiga", False, O, "propia", [(O, r"^urinary bladder$", None)], None),
    ("PROSTATA", "Próstata", False, O, "propia", [(O, r"^prostate$", None)], None),
    ("TESTICULAR", "Testículo / escroto", True, O, "propia", [(O, r"(testis|epididymis)$", None)], None),
    ("UTERO_ANEXOS", "Útero y anexos", False, O, "ninguna", [], None),
    ("PELVIS", "Pelvis", False, S, "propia",
     [(S, r"hip bone$|^sacrum$", None), (O, r"^(urinary bladder|rectum)$", None)], None),
    ("SACROILIACA", "Articulación sacroilíaca", True, S, "propia",
     [(S, r"hip bone$|^sacrum$", None)], ("interseccion", [r"hip bone$", r"^sacrum$"])),
    ("HOMBRO", "Hombro", True, S, "propia",
     [(S, r"(scapula|clavicle|humerus)$", None)], ("interseccion", [r"scapula$", r"humerus$"])),
    ("HUMERO", "Húmero / brazo", True, S, "propia", [(S, r"humerus$", None)], None),
    ("CODO", "Codo", True, S, "propia",
     [(S, r"(humerus|radius|ulna)$", None)], ("interseccion", [r"humerus$", r"ulna$"])),
    ("ANTEBRAZO", "Antebrazo", True, S, "propia",
     [(S, r"(radius|ulna)$|interosseous membrane of (left|right) forearm$", None)], None),
    ("MUNECA", "Muñeca", True, S, "propia",
     [(S, CARPO, None), (S, r"(radius|ulna)$", None)], ("union", [CARPO])),
    ("MANO", "Mano", True, S, "propia", [(S, CARPO, None), (S, MANO, None)], None),
    ("CADERA", "Cadera", True, S, "propia",
     [(S, r"(hip bone|femur)$", None)], ("interseccion", [r"hip bone$", r"femur$"])),
    ("FEMUR", "Fémur / muslo", True, S, "propia", [(S, r"femur$", None)], None),
    ("RODILLA", "Rodilla", True, S, "propia",
     [(S, r"(femur|tibia|fibula|patella)$", None)], ("interseccion", [r"femur$", r"tibia$"])),
    ("PIERNA", "Pierna", True, S, "propia",
     [(S, r"(tibia|fibula)$|interosseous membrane of (left|right) leg$", None)], None),
    ("TOBILLO", "Tobillo", True, S, "propia",
     [(S, r"(tibia|fibula|talus)$", None)], ("interseccion", [r"tibia$", r"talus$"])),
    ("PIE", "Pie", True, S, "propia", [(S, TARSO, None), (S, PIE, None)], None),
    ("CALCANEO", "Calcáneo", True, S, "propia", [(S, r"calcaneus$", None)], None),
]

# El concepto UBERON de la región, buscado por su nombre inglés exacto en index.json.
NOMBRE_UBERON = {
    "CRANEO": "skull", "SENOS_PARANASALES": "paranasal sinus", "ORBITA": "orbital region",
    "MACIZO_FACIAL": "face", "MANDIBULA": "mandible", "ATM": "temporomandibular joint",
    "ENCEFALO": "brain", "CUELLO": "neck", "TIROIDES": "thyroid gland",
    "COLUMNA_CERVICAL": "cervical region of vertebral column",
    "COLUMNA_DORSAL": "thoracic region of vertebral column",
    "COLUMNA_LUMBAR": "lumbar region of vertebral column", "COLUMNA_TOTAL": "vertebral column",
    "SACRO_COXIS": "fused sacrum", "TORAX": "chest", "PARRILLA_COSTAL": "thoracic rib cage",
    "ESTERNON": "sternum", "CLAVICULA": "clavicle bone", "MAMA": "breast", "CORAZON": "heart",
    "ABDOMEN": "abdomen", "RENAL": "kidney", "VESICAL": "urinary bladder", "PROSTATA": "prostate gland",
    "TESTICULAR": "testis", "UTERO_ANEXOS": "uterus", "PELVIS": "pelvic region of trunk", "VIAS_URINARIAS": "renal system", "SACROILIACA": "sacroiliac joint",
    "HOMBRO": "shoulder", "HUMERO": "humerus", "CODO": "elbow", "ANTEBRAZO": "forelimb zeugopod",
    "MUNECA": "carpal region", "MANO": "manus", "CADERA": "hip", "FEMUR": "femur", "RODILLA": "knee",
    "PIERNA": "hindlimb zeugopod", "TOBILLO": "ankle joint", "PIE": "pes", "CALCANEO": "calcaneus",
    "SILLA_TURCA_HIPOFISIS": "pituitary gland", "OIDO_PENASCO": "ear",
    "HUESOS_PROPIOS_NARIZ": "nasal bone", "PIEZAS_DENTARIAS": "dentition",
}

LADO = {"left": "izquierda", "right": "derecha", None: "centro"}


def elegir(capa, incluir, excluir):
    rx, rx_no = re.compile(incluir, re.I), re.compile(excluir, re.I) if excluir else None
    return [p for p in partes if p["layer"] == capa and rx.search(p["labelEn"])
            and not (rx_no and rx_no.search(p["labelEn"]))]


salida, avisos, malla_a_regiones = [], [], {}
# Cómo se llega a la región desde el modelo:
#   "malla": tocar una de sus mallas la propone (si la malla está en varias, gana la región
#            con menos mallas: la más específica);
#   "punto": articulaciones; se proponen si el punto tocado cae en su caja de encuadre
#            (necesita que el visor emita el punto, ver hallazgos §4);
#   "solo_select": agregadas o sin malla propia; sólo desde el select.
AGREGADAS = {"COLUMNA_LUMBOSACRA", "COLUMNA_TOTAL", "ABDOMEN_SUPERIOR", "VIAS_URINARIAS"}


def modo_de_toque(codigo, tipo, encuadre):
    if tipo != "propia" or codigo in AGREGADAS:
        return "solo_select"
    if encuadre is not None and encuadre[0] == "interseccion":
        return "punto"
    return "malla"


for codigo, nombre, lateral, capa, tipo, reglas, encuadre in REGIONES:
    al_tocar = modo_de_toque(codigo, tipo, encuadre)
    elegidas = {}
    for capa_r, inc, exc in reglas:
        encontradas = elegir(capa_r, inc, exc)
        if not encontradas:
            avisos.append(f"{codigo}: la regla {capa_r} /{inc}/ no encontró mallas")
        for p in encontradas:
            elegidas[p["meshId"]] = p
    mallas = {"izquierda": [], "derecha": [], "centro": []}
    for p in sorted(elegidas.values(), key=lambda p: p["meshId"]):
        mallas[LADO[p["side"]]].append(p["meshId"])
        if tipo == "propia":
            nivel = {"malla": 0, "punto": 1, "solo_select": 2}[al_tocar]
            malla_a_regiones.setdefault(p["meshId"], []).append((nivel, len(elegidas), codigo))
    capas = sorted({p["layer"] for p in elegidas.values()})
    solo_masculino = sorted(p["meshId"] for p in elegidas.values() if p["sex"] == "male")

    enc = None
    if encuadre is not None:
        modo, grupos_rx = encuadre
        enc = {"modo": modo, "grupos": {}}
        for lado_en, lado_es in (("left", "izquierda"), ("right", "derecha")):
            grupos = []
            for rx in grupos_rx:
                r = re.compile(rx, re.I)
                ids = sorted(p["meshId"] for p in elegidas.values()
                             if r.search(p["labelEn"]) and p["side"] in (lado_en, None))
                grupos.append(ids)
            caja = union(grupos[0])
            for g in grupos[1:]:
                caja = interseccion(caja, union(g)) if modo == "interseccion" else caja
            if caja is None:
                avisos.append(f"{codigo} {lado_es}: el encuadre por {modo} quedó vacío")
            enc["grupos"][lado_es] = grupos
            enc.setdefault("caja_cm_verificada", {})[lado_es] = (
                None if caja is None else [round((caja[1][k] - caja[0][k]) * 100, 1) for k in range(3)])

    uberon = uberon_por_nombre_en.get(NOMBRE_UBERON.get(codigo, "").lower())
    criterio = "; ".join(f"capa={c} labelEn~/{i}/" + (f" excepto /{e}/" if e else "") for c, i, e in reglas)
    salida.append({
        "region": codigo,
        "nombre": nombre,
        "lateral": lateral,
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

# Malla -> región por defecto al tocar: primero las regiones "malla", después las "punto",
# después las agregadas; dentro del mismo nivel, la más específica (menos mallas).
toque = {m: min(rs)[2] for m, rs in sorted(malla_a_regiones.items())}

# Comprobación del convenio de lado: la izquierda del paciente debería estar en +x.
xs = {s: [sum(cajas[p["meshId"]][k][0] for k in (0, 1)) / 2 for p in partes if p["side"] == s]
      for s in ("left", "right")}
convenio = {s: round(sum(v) / len(v), 4) for s, v in xs.items()}

doc = {
    "generado_por": "gen_regiones_cuerpo_3d.py (ver hallazgos-cuerpo-3d.md)",
    "fuentes": ["public/anatomy-atlas-3d/catalog/parts.json", "public/anatomy-atlas-3d/catalog/index.json",
                "public/anatomy-atlas-3d/models/*.glb"],
    "estado": "BORRADOR: lista de regiones tentativa hasta que exista catalogo/imagenologia.json",
    "convenio_lado": {"x_media_left_m": convenio["left"], "x_media_right_m": convenio["right"],
                      "nota": "side del atlas = lado del paciente; left está en +x del modelo"},
    "regiones": salida,
    "toque_malla_a_region": toque,
    "avisos": avisos,
}
SALIDA.write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n")

print(f"regiones={len(salida)} mallas_con_region={len(toque)} de {len(partes)} avisos={len(avisos)}")
for a in avisos:
    print("AVISO", a)
for r in salida:
    n = sum(len(v) for v in r["mallas"].values())
    caja = r["encuadre"]["caja_cm_verificada"] if r["encuadre"] else ""
    print(f"{r['region']:22} {r['tipo_malla']:11} n={n:3} izq={len(r['mallas']['izquierda']):2} "
          f"der={len(r['mallas']['derecha']):2} cen={len(r['mallas']['centro']):2} uberon={r['uberon_region']} {caja}")
print("convenio", convenio)
```
