# Evidencias

Entorno: macOS · Node 24.19 · Yarn 4 (corepack) · `ng serve` en `http://localhost:4310`, rama
`justin/refac-ux-profesional` (worktree `wt-refac-ux`) · backend simulado · Chromium.
Fecha: 2026-09-17/18.

## Comandos y resultados

| Comando | Resultado | Nota |
|---|---|---|
| `corepack yarn lint` | exit 0 | tras corregir H-18 |
| `corepack yarn typecheck` | exit 0 | app + cypress + e2e |
| `corepack yarn build` | exit 0 · inicial 332,81 kB transferido (base 332,73) · 22 avisos de presupuesto (base: los mismos 22 archivos) | |
| `corepack yarn test --watch=false` | 517/520 archivos verdes; **10 pruebas rojas preexistentes** | mismas 10/145 con `src/` de `1f8e8bfd` (H-13, H-17) |
| `ng test --include=…/appointments.spec.ts` | 68/68 | 63 previas + 5 nuevas |
| `ng test --include=…/upcoming-and-past.spec.ts` | 7/7 | nueva |
| `ng test --include=…/alovida-runtime.service.spec.ts` | 53/53 | 2 nuevas; **rojas antes del arreglo** |
| `ng test --include=…/data-table.spec.ts` | 25/25 | 3 nuevas |
| `ng test --include='src/app/shared/**/*.spec.ts'` | 106 archivos · 1 327 pruebas | tras normalizar movimiento |
| `E2E_BASE_URL=http://localhost:4310 yarn pw <spec del refactor> --workers=1` | **9/9** (18–19 s) | dos corridas |
| Kill-test H-01 (código base + mismo E2E) | **falla** con la base, **pasa** con el arreglo | |

## Segunda tanda — candidato `e7261cb4`

| Comando | Resultado |
|---|---|
| `yarn lint` · `yarn typecheck` · `yarn build` | 0 · 0 · 0 (22 avisos = base) |
| `yarn test` | **6 346 ✅** · 10 ❌ preexistentes (las mismas H-13/H-17) |
| E2E del refactor (`--workers=1`) | **11/11** |
| SSR de producción (`serve:ssr`, :4311) | CSP con el hash del render; 0 errores de consola en `/posts`, `/auth`, `/directory` |

| Qué | Antes | Después |
|---|---|---|
| Panel médica: «Ver mi agenda de hoy» (top, 1440 / 390) | dentro de «Tus accesos», debajo de las cifras | 104 / 186 px; cifras a 973 px |
| Filtros de «Mis citas» a 1280 | «Hasta» sola en 2.ª fila | una fila |
| «Descargar Archivo 1» (nombre accesible) | idéntico en cada tarjeta | «… de Hemograma completo» |
| «Reservar hora» en «Mis órdenes» | deshabilitado · «Próximamente» | enlace a `?resource=lab`, foco en «Agendar una cita» |
| Transición del menú (marco) | 0,16 s `ease` | 0,12 s `--curva`; 0,01 ms reducido |

## Mediciones en navegador

| Qué | Antes | Después |
|---|---|---|
| «Pedir una cita» (top, 1440 / 390) | no existía; la sección estaba al pie de una página de 2 920 / 3 676 px de alto | 104 / 186 px |
| Primera cita próxima (top, 1440 / 390) | debajo del historial | 407 / 495 px |
| Controles de filtro recortados (1440) | 3 (estado, desde, hasta; observado en captura) | 0 (medido) |
| Filtros a 768 | no medido en la base | 2 + 2 (medido); con 18rem durante el piloto eran 3 + 1 |
| Consultas: px ocultos (1440 / 1280) | 65 / — | 0 / 49 con sombra |
| Nombres accesibles con uuid en `/schedule` (390) | «Ver el detalle de 79a07372-…» | 0; «Ver el detalle de Diego Quiñónez Fonseca» |
| `NotFoundError` a 390 px (médica) | ≥ 20 | 0 |
| «Viernes 18 De Septiembre» | sí | «Viernes 18 de septiembre» |

## Capturas

- `capturas/antes/` — punto de partida (5).
- `capturas/despues/` — verificación manual (8).
- `capturas/e2e/` — generadas por la prueba E2E (6).

## Avisos de presupuesto (idénticos en base y candidato)

Los 22 archivos sobre 4 kB son los mismos en ambos builds. Cinco los toca este refactor y crecen
entre 0,02 y 0,32 kB por los `var(--dur-*)`: `schedule-grid`, `register-practitioner`,
`field-editor`, `date-picker`, `tree-select`. `appointments.css` llegó a 4,04 kB durante el
piloto y se recortó por debajo del umbral (`68d26516`).

## Expediente: vista «Tabla» y «Recorrido» — 2026-10-28

Entorno: contenedor Linux · Node 22 · Yarn 4.18 (corepack) · `ng serve --port 4300` · backend
simulado · Chromium (Playwright) · cuenta `medica@alovida.mock`, paciente `pid-paciente`.

| Comando / prueba | Resultado |
|---|---|
| `yarn typecheck` | 0 errores |
| `eslint src/app/features/clinical-record/patient-chart` | 0 errores (el `yarn lint` global trae 256 errores preexistentes en specs ajenos, iguales sin este cambio) |
| `yarn build` | completo |
| `ng test --include='…/patient-chart/**/*.spec.ts'` | 20 archivos · 376 pruebas verdes (27 nuevas en `recorrido-clinico/`) |
| `yarn test` completo | **no se ejecutó** |
| Navegador 1440 / 768 / 390 | desborde horizontal de la página: 0 px en los tres; el recorrido desplaza dentro de su lienzo |
| Clic en un nodo | abre el mismo modal de detalle que la tabla (`expediente-detalle`) |
| Foco/puntero en «Enalapril» | ilumina Ambulatorio → Hipertensión arterial → Enalapril y atenúa el resto |
| Grupo «+6 observaciones» | se abre (`aria-expanded=true`) y se vuelve a agrupar |
| Tema oscuro | colores sólo de tokens `--st-*` / `--bg-*`; legible |

Capturas: `capturas/recorrido-clinico/`. Revisión independiente (`visual-reviewer`,
`frontend-reviewer`): **pendiente** — quien implementa no aprueba.

## Infraestructura F1 (web) — 2026-10-30

Entorno: contenedor Linux · Node 22.22 · Yarn 4.18 (corepack) · `ng serve --port 4371` · backend simulado ·
Chromium 1243 del sistema (`PW_CHROMIUM_PATH`, sin red para `playwright install`) · cuenta
`superadmin@alovida.mock`, tenant «Hospital San Lucas». Rama `infra-f1-web`.

| Comando / prueba | Resultado |
|---|---|
| `yarn lint` | exit 1 · **256 errores, los mismos 256 de la base** (`8c695ed5`); 0 en archivos tocados |
| `yarn typecheck` | exit 0 |
| `yarn build` | exit 0 · ningún CSS nuevo pasa el presupuesto de 4 kB |
| `ng test` de lo tocado (infraestructura, consola, `app-tree`, maqueta, view-state-host) | 11 archivos · todos verdes |
| `yarn test` completo | 596/600 archivos · 7 630/7 634 pruebas · 4 rojas **ajenas**: `fichas-estandar`, `appointment-calendar` (fecha), `pestanas-del-perfil-medico` — rojas también en la base —, e `insurance-analytics.handlers` — verde aislada en la rama y en la base: depende del orden de la corrida |
| `check-client-prefixes` / `check-route-prefixes` | los 23 endpoints nuevos ruteados (proxy, docker, nginx); 1 rojo previo ajeno (`CommunityClient`) · 242 rutas sin colisión |
| `check-architecture` | rojo previo ajeno (3 ciclos en fixtures/agenda, 1 capa, 1 red); nada de F1 |
| `E2E_BASE_URL=… yarn pw infra-f1-infraestructura --workers=1` | **6/6** (2,7 min) · 1440 / 768 / 390 |

Mediciones del navegador (`evidencias/infra-f1/resultados.json`):

| Qué | 1440 | 768 | 390 |
|---|---|---|---|
| Desborde horizontal en árbol, ficha (5 pestañas) y Establecimiento | 0 | 0 | 0 |
| Regla 6, ficha: holgura izq./der. y ancho vs. `.app-main__inner` | 0 / 0 · 100 % | 0 / 0 · 100 % | 0 / 0 · 100 % |
| `aria-level` de «Cama 301-A» (6.º nivel) | 6 | 6 | 6 |
| Alta: POST `/sites/:id/care-spaces` → 201 → persistido en `mock.infra.espacios` → F5 → la ficha lo muestra | sí | sí | sí |
| Edición: PATCH `/care-spaces/:id` con `If-Match: 1` → 200 → F5 → nombre nuevo | sí | sí | sí |
| Errores de consola fuera del CSP de `/auth` (previo) | 0 | 0 | 0 |

La cadena se lee del registro de escrituras de la maqueta (`sessionStorage['mock:registrar']`, nuevo y apagado
por defecto): la maqueta responde dentro de Angular y Playwright no ve red. **Contra la API real no se ejecutó**
(otra franja).

Capturas (`evidencias/infra-f1/`, 66): árbol físico expandido y organizativo; ficha en sus 5 pestañas; alta (pasos
1 y 2, creada tras recarga), edición; alta masiva con vista previa y códigos repetidos; importación con errores de
forma, dry-run con errores por línea y confirmada; retiro bloqueado con la lista y su próxima acción;
Establecimiento con brechas y habilitación vencida; S3, S5, S6, S9 con `mock-fallo` y S9 de la consola una sola vez.

Hallazgo previo, no de F1: en las capturas de página completa a 1440/768 el riel de navegación se dibuja encima
del borde izquierdo del contenido; pasa igual en `capturas/recorrido-clinico/recorrido-1440.png` (anterior).

Revisión independiente (`visual-reviewer`, `frontend-reviewer`, `regression-auditor`): **pendiente**.
