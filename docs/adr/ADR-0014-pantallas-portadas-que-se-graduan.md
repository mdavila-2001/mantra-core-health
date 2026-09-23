# ADR-0014: Las pantallas portadas NO se migran — y qué hacer el día que una tenga que graduarse

## Estado

**Aceptado** — 2026-09-21. Nace de la ambigüedad **Q-A** del reparto de la refactorización frontend:
*¿qué pasa con una pantalla de `features/alovida/**` que se migra a mano, cuando alguien vuelva a
correr el generador?*

**La pregunta traía un supuesto equivocado adentro**, y esta ADR lo corrige primero: esas pantallas
**no hay que migrarlas**. Lo que sigue documenta por qué, y deja escrito el mecanismo para el día que
una sí tenga que graduarse — porque la pregunta va a volver.

## Contexto

Medición sobre el corte `5a0776c66b005ad4d2d6722321e933cd7adea621`.

### 1 · El punto de partida: 70 tablas escritas a mano

De las 81 plantillas de `features/**` con `<table>` a mano, **70 están en `features/alovida/`** —
31 en `accesos` y `personas`, 39 en los otros cinco segmentos. Replican las clases del sistema de
diseño (`class="app-page-header" app-page-header=""`) sin instanciar ningún componente: esos
atributos **no enganchan nada**, porque `page-header`, `filter-bar`, `search-field` e `input` tienen
selector de **elemento**, y `button[app-button]` sólo matchea un `<button>`, no una `<a>`.

Leído así, parece deuda de adopción. **No lo es.**

### 2 · El producto ya declara qué son esas pantallas, en un componente hecho para eso

`src/app/features/alovida/shell/alovida-design-notice.ts` pinta, en los dos marcos de la maqueta, un
aviso que **no se puede cerrar**:

> **Referencia de diseño, no la aplicación.** Esta pantalla viene de la bóveda con datos de ejemplo:
> lo que se ve acá no se guarda en ningún lado y los filtros y botones no consultan la API. La
> pantalla que sí funciona es **Pacientes**.

Su propia documentación (líneas 33-60) dice por qué existe y qué se decidió:

> `features/alovida/` tiene 126 pantallas portadas desde la bóveda con marcado estático: filas
> escritas a mano, enlaces `data-sin-destino`, y —en el marco de sesión— una identidad de mentira
> sobre rutas que **no pasan por `authGuard`**. Renderizan perfectamente y no persisten nada.
>
> Eso es exactamente lo que la **corrección #7 del 15/08/2026** prohíbe: pantallas que aparentan
> funcionar. Y el **carril 01 pide marcarlas, no borrarlas** — son **el entregable del diseñador y la
> fuente contra la que se rehidratan las vistas reales** (corrección #8).

### 3 · Y declara, módulo por módulo, cuál es la pantalla real

`alovida-design-notice.ts:24-29`:

```ts
const PANTALLA_REAL = {
  buscar:       { ruta: '/directory',                        rotulo: 'Directorio de médicos' },
  directorio:   { ruta: '/administration/organizations',     rotulo: 'Organizaciones' },
  personas:     { ruta: '/administration/patients',          rotulo: 'Pacientes' },
  terminologia: { ruta: '/administration/terminology',       rotulo: 'Terminología' },
  accesos:      { ruta: '/administration/delegated-access',  rotulo: 'Acceso delegado' },
};
```

Con el comentario: *«Sólo figuran los módulos cuya pantalla real ya está construida y conectada —
inventar un destino para los que no la tienen sería repetir el defecto que este aviso viene a
corregir.»*

### 4 · Las pantallas reales **ya adoptan** el organismo canónico

Medición sobre esas rutas (`evidencia/h2/adopcion-pantallas-reales.txt`):

| Módulo | Pantalla real | `<app-data-table` | `<app-page-header` | `<table` crudo |
|---|---|---|---|---|
| `directorio` | `admin/organizations/organization-list` | **1** | 1 | **0** |
| `personas` | `admin/patients/patient-list` | **1** | 1 | **0** |
| `terminologia` | `admin/terminology/terminology-catalog` | **1** | 2 | **0** |
| `accesos` | `delegated-access/delegated-access-home` | 0 | 1 | **0** |
| `buscar` | `/directory` | no resuelto automáticamente | — | — |

**Ninguna de las pantallas reales tiene una tabla escrita a mano.** Tres de cuatro ya montan
`DataTable`. La cuarta es un hub, no un listado.

## Decisión

### 1 · Las pantallas portadas de `features/alovida/**` NO se migran a componentes canónicos

Migrarlas destruiría el entregable del diseñador y la fuente de rehidratación que la corrección #8
declara, para conseguir **cero** valor de producto: son, por decisión explícita y visible en
pantalla, *«referencia de diseño, no la aplicación»*.

Las 70 tablas escritas a mano **no son deuda de adopción**. Son una maqueta marcada como tal.

### 2 · El trabajo de adopción se mide y se hace sobre las pantallas REALES

El denominador correcto no es «70 tablas de la maqueta», sino «las pantallas conectadas que todavía
no montan el organismo que les corresponde».

### 3 · El día que una portada tenga que graduarse, se hace así — y no de otra forma

Porque la pregunta va a volver, y porque la respuesta no es evidente:

1. **El componente se muda fuera de los siete segmentos regenerados**, a
   `src/app/features/alovida/pantallas/<slug>/`, hermano de `shell/`. Motivo, medido:
   `port-vistas-alovida.mjs:275-284` hace `rmSync(..., { recursive: true, force: true })` sobre
   `accesos`, `buscar`, `datos-compartidos`, `directorio`, `inicio`, `personas` y `terminologia`.
   **No sobrescribe: borra.** Un archivo nuevo creado a mano ahí adentro tampoco sobrevive.
   `shell/` sobrevive hoy exactamente por eso: no es un segmento.
2. **Su ruta se declara en `src/app/app.routes.ts`, antes de `ALOVIDA_ROUTES`** — nunca en
   `alovida.routes.ts`, que también es generado y está en la lista de borrado (línea 281). Es el
   mecanismo que el repo **ya usa y ya tiene probado** para `/search`; `app.routes.ts:1232-1240` lo
   explica: *«porque `alovida.routes.ts` es un archivo generado: escribirlas ahí las borra la próxima
   vez que alguien porte una vista… Hay una prueba que resuelve las dos formas y falla si eso deja de
   ser cierto.»*
3. **Se quita su vista del vault** en la misma entrega, o la próxima corrida del generador deja un
   componente muerto e inalcanzable detrás de la ruta graduada.

### 4 · Y antes de graduar una, hay que decidir que deja de ser referencia

Graduar una pantalla la saca del alcance del aviso de `alovida-design-notice`. Eso **contradice la
corrección #8 vigente**, así que no lo decide quien migra: es decisión de producto y se registra.

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| **Migrar las 70 tablas de la maqueta a `DataTable`** | Destruye el entregable del diseñador y la fuente de rehidratación (corrección #8), contradice la corrección #7 y el carril 01 —*«marcarlas, no borrarlas»*—, y no entrega valor de producto: esas pantallas ya declaran que no son la aplicación |
| **Que el generador emita componentes canónicos** | Convertiría la maqueta en algo indistinguible del producto, que es el defecto que la corrección #7 prohíbe. Además sólo corre en una máquina: `VAULT` y `FRONT` son rutas absolutas (líneas 30-32) |
| **Agregar una lista de exclusión al generador** | Innecesaria: la carpeta hermana da el mismo resultado sin tocar un archivo de otro dueño, y una lista hay que mantenerla |
| **Congelar el generador** | Deja sin fuente a las pantallas que todavía no tienen equivalente real |
| **Editar `alovida.routes.ts` a mano** | Es generado y está en la lista de borrado |

## Consecuencias

1. **El carril «tabla canónica» del reparto del 2026-09-21 cambia de objetivo.** Migrar las 31
   pantallas de `accesos` y `personas` queda `DESCARTADO` con este motivo. Lo mismo para las 39 de
   `terminologia`, `datos-compartidos`, `buscar`, `directorio` e `inicio`.
2. **El archivo de coordinación, si alguna vez se gradúa una pantalla, es `src/app/app.routes.ts`** —
   no `alovida.routes.ts`, que es generado. *(Esto corrige el supuesto que traía el reparto.)*
3. **`maqueta portada: 119` de `yarn audit:vistas` no es un indicador de deuda**: es el recuento del
   entregable de diseño. Usarlo como meta a bajar sería medir mal.
4. **Queda abierto lo que sí es deuda real** y este ADR no resuelve: las pantallas conectadas que no
   usan `view-state-host` ni `filter-bar` —por ejemplo `admin/patients/patient-list` monta
   `DataTable` pero **no** `ViewStateHost`—, y `delegated-access-home`, que no monta `DataTable`.
   Eso vive en `features/admin/**` y `features/delegated-access/**`, que **no tienen dueño** en la
   oleada del 2026-09-21.
5. **Riesgo residual:** este ADR se apoya en las correcciones #7 y #8 y en el carril 01 tal como los
   **cita el comentario de `alovida-design-notice.ts`**. No se leyeron los documentos originales de
   esas correcciones: no están en este repositorio. Si alguno dijera otra cosa, esta decisión hay que
   revisarla.

## Evidencia

```text
$ sed -n '12,60p' src/app/features/alovida/shell/alovida-design-notice.ts   # el aviso y su porqué
$ sed -n '275,284p' scripts/port-vistas-alovida.mjs                          # rmSync recursivo, 7 segmentos
$ sed -n '1232,1240p' src/app/app.routes.ts                                  # el precedente, con su prueba
$ ls src/app/features/alovida/                                               # shell/ sobrevive
$ yarn audit:vistas                     # conectada 148 · maqueta portada 119 · presentacional 10
$ yarn stock:generate                   # 537 componentes · 295 pantallas · 138 maquetas
```

Captura del aviso, en pantalla y a 1440 px, en
`repartos/2026-09-21/PromptNoche/Pablo/Refactor-TablaCanonica.AccesosYPersonas/evidencia/antes/capturas/`.
