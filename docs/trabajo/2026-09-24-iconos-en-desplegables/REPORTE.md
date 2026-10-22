# Reporte — Ícono en toda opción de desplegable

> **AVANCE: 4 / 5 — 80,0 %.**

- Fecha: 2026-09-24 · Plan: [PLAN.md](./PLAN.md) · Rama: `ender/simulador-cabecera-2026-09-22` (sin commit)
- Peldaño de evidencia alcanzado: `TESTED` (+ medición en navegador de la vitrina; sin captura de la agenda real)

## Completado
| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.S1.M1 | 15 íconos nuevos en el set (`eye`, `eye-off`, `check`, `check-circle`, `close`, `arrive`, `logout`, `paperclip`, `refresh`, `share`, `qr`, `print`, `download`, `merge`, `clock`) | `yarn typecheck` | PASS, exit 0 |
| H1.S1.M2 | `icon` obligatorio en `RowAction`, `PageHeaderAction` y `PostPreferenceEntry`; las plantillas lo dibujan siempre | `yarn typecheck` + `tsc -p tsconfig.spec.json` | PASS, exit 0 |
| H1.S1.M3 | Ícono en los menús escritos a mano: pago de la agenda, «Acciones» del expediente, recetas, cuenta, selector de organización, vitrina | barrido de `<app-menu-item>` sin `slot="icon"` | sólo quedan los de OUT |
| H1.S1.M4 | Specs de lo tocado + prueba nueva «ninguna opción del desplegable queda sin su ícono» | `ng test --include …` | 50 archivos, 1060 pruebas en verde — `evidencia/pruebas.txt` |

## A medias
### H1.S1.M5 — Prueba visual
- Qué anda: en la vitrina (`/design-system`), las 4 opciones del menú miden 37 px y su ícono 16 px (`evidencia/medicion-dom.txt`).
- Qué no anda: no hay captura del menú real de la agenda; las capturas de la vitrina salieron en blanco (3 intentos) y el banco de componentes interpreta mal un arreglo editado a mano.
- Qué falta exactamente: levantar la API, entrar como médica, abrir «Acciones» de una solicitud y capturar en claro/oscuro y en móvil/tablet/escritorio.
- Dónde quedó: el código compila y pasa las pruebas; nada sin guardar.

## Pendiente
| ID | Estado | Qué lo destraba |
|---|---|---|
| ninguna | — | — |

## Evidencia
Ver `evidencia/pruebas.txt` y `evidencia/medicion-dom.txt`.

## No cubierto
- La vista real de la agenda, el expediente y la cuenta con sesión (sin API).
- Tema oscuro y anchos de móvil y tablet.

## Desvíos del plan
- Se agregaron el menú de recetas, el selector de organización y la vitrina, que aparecieron en el barrido.
- Bug hallado y corregido: en el menú de recetas y en la vitrina, un `<svg slot="icon">` suelto no recibe tamaño (el CSS de `menu-item` sólo dimensiona un `svg` *dentro* del slot); en la vitrina medía 153 px. Se migró a `app-nav-icon`.

## Riesgos residuales
- `yarn lint` global sigue en rojo con 243 errores preexistentes (host de specs sin `OnPush`); ninguno nuevo.

## Decisiones y ambigüedades
- El set de íconos se amplió sin consultar a su responsable, porque el propietario lo pidió explícitamente. A confirmar con quien lleva el set: nombres y dibujos.
- Quedan fuera los escalones ocultos del breadcrumb (navegación) y el rótulo deshabilitado con el nombre en el menú de cuenta (no es una opción).
- En el selector de organización, la activa lleva `check` y las demás `building`.
