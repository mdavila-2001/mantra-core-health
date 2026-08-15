# Inventario de vistas del diseñador — carril 01

> Entregable de `lanes/01_REPO_AUDIT_DESIGN_RECOVERY.md`.
> La **tabla** se genera y vive en
> [`docs/reports/generated/design-view-inventory.md`](docs/reports/generated/design-view-inventory.md).
> Este documento es la **interpretación**: qué se encontró, qué se hizo y qué
> queda. Regenerar la tabla: `yarn audit:vistas` (o `--check` para fallar ante
> deriva).

---

## Lo primero que hay que saber: hay dos aplicaciones en el mismo repositorio

El repositorio sirve **dos árboles de rutas distintos** bajo el mismo dominio, y
esa es la causa de la mitad de la confusión sobre "qué está hecho":

| | Aplicación real | Vistas portadas de la bóveda |
|---|---|---|
| Dónde vive | `src/app/features/*` (menos `redsat/`) | `src/app/features/redsat/` |
| Cómo se declara | `app.routes.ts` + `core/navigation/navigation.map.ts` | `redsat.routes.ts` (**generado**) |
| Rutas | 25 secciones + 30 pantallas hijas/de operación | **138 rutas, 126 pantallas** |
| Guard | `authGuard` en el padre | **ninguno** |
| Datos | clientes de `core/data-access` | marcado estático escrito a mano |
| Quién la escribe | el equipo | `scripts/port-vistas-redsat.mjs`, desde la bóveda |

Las de `redsat/` **son las vistas del diseñador** a las que se refiere la
corrección #8 («usar las vistas del diseñador ya existentes»). No son pantallas a
medio hacer: son el entregable de diseño, portado a Angular para que se pueda
mirar en el navegador y para que las pantallas reales se rehidraten contra él.

**No se borran.** Lo que había que arreglar era otra cosa.

---

## Hallazgos

### H-1 · Las 126 maquetas eran indistinguibles del producto — **corregido**

`redsat/` renderiza perfectamente y no persiste nada:

- filas y tarjetas escritas a mano en el `.html`;
- enlaces marcados `data-sin-destino` que no navegan;
- y, en el marco de sesión, **una identidad inventada** —«Rocío Salazar ·
  Administración de seguridad», «Clínica Los Olivos · La Paz», 3 avisos sin
  leer— sobre rutas que **no pasan por `authGuard`**: cualquiera sin sesión
  llega a `/personas/pacientes-listado` y ve lo que parece un padrón real.

Eso es exactamente lo que prohíbe la corrección #7 («pantallas que aparentan
funcionar sin persistencia real»), y lo que el carril 01 manda **marcar**.

**Qué se hizo** — `features/redsat/shell/redsat-design-notice.ts`, montado en los
dos marcos (`redsat-shell`, `redsat-public-shell`):

- un aviso permanente y no descartable, arriba del contenido, que dice que la
  pantalla es una referencia de diseño y que nada de lo que se ve se guarda;
- cuando el módulo tiene pantalla real construida, el aviso **enlaza a ella**
  (`/personas/…` → Pacientes, `/buscar/…` → Guía de profesionales, etc.);
  cuando no la tiene, no inventa un destino;
- la identidad del encabezado pasa a declararse «(ejemplo)», que es lo que entra
  en una captura de pantalla.

Una sola pieza cubre las 126, y el generador no la pisa porque vive en el marco,
no en las pantallas.

### H-2 · `features/redsat/organizaciones/` es código muerto duplicado

26 archivos, 324 KB, 13 componentes que son copia exacta de
`features/redsat/directorio/`. Sobra de cuando el segmento se renombró
`organizaciones` → `directorio`.

Evidencia de no uso, no impresión:

- `redsat.routes.ts` importa **siempre** de `@features/redsat/directorio/…`
  (11 coincidencias, ninguna de `organizaciones/`);
- `vistas.manifest.json` no declara ni una vista con esa importación;
- `grep -rn "redsat/organizaciones" src/` en `.ts`, `.html` y `.json`: cero.

→ Se elimina en el **carril 19**, que es el que barre basura. Acá queda el
registro y la evidencia.

### H-3 · `features/diagnostics/diagnostics.routes.ts` no lo usa nadie

Exporta `DIAGNOSTICS_ROUTE = '/diagnostics'` y no hay una sola referencia en todo
`src/`. Es el patrón de las otras secciones (`clinical-record.routes.ts`,
`agenda.routes.ts`) aplicado donde todavía no hizo falta.

→ También al carril 19.

### H-4 · `/directory` no declara roles: el doctor ve la Guía de profesionales

`navigation.map.ts` declara la sección `directory` **sin `roles`**, y en el
registro eso significa «cualquier sesión». La captura baseline de la doctora lo
muestra: la Guía aparece en su menú lateral y en «Tus accesos».

La corrección #2 dice que la Guía es **solo para pacientes**.

→ Es el encargo del **carril 02**, que sigue. Acá queda medido, con evidencia en
`artifacts/playwright/baseline/doctora/01-panel.png`.

### H-5 · Deuda declarada que se deja donde está

| Dónde | Qué | Por qué no se toca acá |
|---|---|---|
| `admin/organizations/organization-new.html:67` | `TODO(IT3)`: los tipos de organización salen del DTO, no de dynamic-enums | Es un dato real del contrato, no un mock. Dominio de organizaciones, no de este carril. |
| `redsat/` (126 pantallas) | marcado estático | Es el entregable del diseñador. Cablearlas es el trabajo de los carriles de dominio (03, 05, 06…), no de una auditoría. |

---

## Lo que **no** se encontró

Vale decirlo porque el carril pregunta por ello explícitamente:

- **No hay imports colgados** (`scanModuleGraph().dangling`: 0).
- **No hay rutas de menú sin pantalla declarada.** Es estructural, no suerte:
  `rutasDeSecciones()` construye las rutas hijas **desde** `APP_SECTIONS`, así
  que un ítem de menú que apunte a una ruta inexistente no se puede escribir.
- **No hay componentes marcados `v2`, `final`, `premium`, `figma`** ni ninguna de
  las variantes que el carril manda buscar: la convención del repo es una
  carpeta por pantalla y el port vive todo bajo `redsat/`.
- **No hay `faker` ni lorem ipsum en runtime.**

---

## Recuento (de la tabla generada)

| Estado | Pantallas |
|---|---|
| `maqueta portada` | 126 |
| `conectada` | 45 |
| `presentacional` | 6 |
| `conectada con deuda` | 3 |
| `placeholder` | 1 |

Las 6 `presentacional` son los paneles de operación de M29, M40, M27, M44 y M13:
módulos cuyo backend **es sólo de comando, sin `GET` de colección**. No listan
porque no hay nada que listar, y eso está documentado sección por sección en
`navigation.map.ts`. No son pantallas rotas.

El único `placeholder` es `/billing`, declarada `planificada` a propósito.

---

## Evidencia

- Baseline por rol, capturado con **Playwright sobre Chromium**:
  `artifacts/playwright/baseline/{paciente,doctora,administrador,maquetas}/`.
  Se regenera con `yarn pw:baseline`.
- Tabla completa: `docs/reports/generated/design-view-inventory.md`.
- Pruebas del marcador: `features/redsat/shell/redsat-shell.spec.ts` (17 casos,
  6 nuevos) y `playwright/carril-01-baseline.spec.ts`.
