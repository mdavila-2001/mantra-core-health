# Plan — El perfil del médico como lo pidió el doctor: sin «principal», sin datos del trabajo, y tres tablas editadas en modal

- Fecha: 2026-09-23 · Repos afectados: `mantra-core-health` (frontend) · Predecesor: `2026-09-20-correcciones-doctor-perfil-disenio` (PR #571 fusionado en `mockup`)
- Encargo: `repartos/2026-09-22/PromptNoche/Itzan/Noche-PerfilMedico.ConfigurarTuPerfil/PerfilSinPrincipalSinTrabajoYTablasConModal.md` (D-01, D-02, D-03, D-06, D-07, D-08, D-09, D-10, N-03)
- Corte: `origin/mockup` @ `b7785e36` (movido el 2026-09-23 por decisión de Itzan desde `05d83cb8`, que fue el corte inicial; el encargo citaba `b655e844…`). Motivo: entre ambos entró `b05f2116` (PR #582) con `confirmarCambios`/`confirmarDescarte`, la pieza D-08 que H3/H4 esperaban de Marcelo — se cierra contra la pieza real, no contra un doble. Comprobado con `git log --oneline b7785e36..origin/mockup` → vacío.
- Ramas: `itzan/perfil-medico-nucleo` (H1–H4) y `itzan/perfil-medico-configurar-tu-perfil` (H5, H7); las dos salen del mismo corte. H6 y H8 se asignan al cierre.
- Resultado observable: con `medica@alovida.mock`, la ficha no muestra «Estado de la práctica» ni datos del trabajo, ninguna especialidad se distingue como principal, y en el editor los títulos, especialidades y matrículas se agregan y corrigen en un modal con adjunto, guardar por cambios y confirmación, sobre tablas con buscador y paginación; tocar el mapa vacía la dirección; con `paciente@alovida.mock`, `/my-account` tiene cinco pestañas y la quinta es la billetera.
- Kill-test: el del encargo §2 — «Estado de la práctica» legible, una insignia distinta, «Correo de trabajo» en Contacto, «Agregar formación» en línea, «Guardar» habilitado sin cambios, guardar sin «¿Confirmás estos cambios?», o una dirección que sobrevive al toque del mapa: cualquiera de esas demuestra que NO está hecho.

## Alcance

- IN: el del encargo §3 — baseline y capturas previas · retiro de «Estado de la práctica» · retiro de la noción «principal» en insignia, rejilla, editor, alta y tipos del front · «Contacto» sin datos del trabajo y «Correo de acceso» en Datos personales · `CAMPOS_DEL_ALTA_SIN_PESTANA` con los tres campos · Trayectoria y Credenciales en modal con adjunto, guardar por cambios, dos confirmaciones, institución con código, historial montado · barra, paginación en cliente y scroll vertical en las tres tablas · `output` del `ubicacion-picker` al tocar el mapa y su aplicación en los ocho formularios · retiro de «Listo, guardamos…» conservando el anuncio accesible · veredicto por cada `iconOnly` propio · «Mis puntos» como quinta pestaña · el `PATCH` del simulador que acepta `fileId` · specs dirigidos · capturas por viewport y tema · `REPORTE.md` y `evidencia/`.
- OUT: el del encargo §3 — cualquier archivo fuera de los reservados (`work-history/**`, `data-table`, `filter-bar`, `pagination`, `row-actions`, `docs/adr/**` de Pablo; `content-dialog`, `dialog`, `symptom-check`, `patient-home` de Marcelo; directorios de Justin; `mock-backend.interceptor.ts`, `fixtures/**`, `scheduling.handlers.ts`, `core/navigation/**`, `shell-layout/**`, `header/**`, `app.routes.ts` y los tres barrels de Ender) · la API · debilitar `pestanas-del-perfil-medico.spec.ts` · cambiar el comportamiento por omisión de `paginated-form`, `date-picker` o `back-link` · borrar `PrincipalElegida` del simulador · inventar un campo de archivo para especialidades en el contrato · cambiar un requisito de datos del alta · `HECHO` sin DoD corrido.
- Ambigüedades registradas: ver la tabla al final (Q-1, Q-2, Q-3, Q-4, Q-8, Q-9, Q-17, Q-20, Q-I1, Q-I2), con el supuesto tomado y a quién confirmar.

## Hallazgos del descubrimiento (2026-09-23)

| Hecho | Fuente |
|---|---|
| El servidor de desarrollo es `yarn dev`; `yarn start` sirve el bundle SSR compilado | `package.json:14,16` |
| `yarn typecheck` no verifica plantillas; sólo `yarn build` | `package.json:25` |
| La ficha del médico se delega entera a `<app-practitioner-profile />`; de ahí para abajo es la del paciente | `my-profile.html:48-54` |
| Los importadores de `pestanas-del-perfil` (paciente) y `pestanas-del-perfil-medico` son conjuntos disjuntos | `rg -l` sobre `src/app` |
| Aviso preexistente ajeno en el build: `NG8113` en `features/symptom-check/symptom-check.ts:96` (Marcelo) — se anota, no se toca | log del arranque, 2026-09-23 |
| El CI del front corre en runners self-hosted, caídos desde el 22/09 | `.github/workflows/ci.yml:45,181,269` |

## Estados

Los seis de la regla 20: `TODO` · `EN CURSO` · `HECHO` · `A MEDIAS` · `BLOQUEADO` · `DESCARTADO`. El avance sale de `plan_status.py` (regla 50).


Los seis estados permitidos son exactamente: `TODO`, `EN CURSO`, `HECHO`, `A MEDIAS`, `BLOQUEADO` y
`DESCARTADO`. **`A MEDIAS` es legítimo; disfrazarlo de `HECHO` no.**

### H1 — Corte, baseline y capturas previas

**Prioridad:** `BLOQUEANTE`

**CA:** Dado tu entorno, cuando alguien pregunta contra qué versión trabajaste y cómo se veía y se
comportaba el perfil antes, entonces hay SHA, capturas y tres comportamientos observados — no un recuerdo.
**DoD:** salidas del baseline en `evidencia/antes/`, seis capturas descritas, y la tabla de comportamiento previo.
**Estado:** HECHO

#### H1.S1 — Corte y baseline

**CA:** Dado un rojo posterior, cuando alguien pregunta si lo rompiste vos, entonces la respuesta sale de un archivo.
**DoD:** salidas con su código de salida, pegadas; cada rojo previo clasificado.
**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Estado |
|---|---|---|---|---|
| H1.S1.M1 | Fijar corte y rama | Hay SHA y rama en `PLAN.md` | `git fetch origin && git rev-parse origin/mockup && git branch --show-current` → `evidencia/antes/corte.txt` (rama `itzan/perfil-medico-nucleo` en `b7785e36`; `HEAD..origin/mockup` vacío. Se creó en `05d83cb8` y se movió con `reset --hard` sobre árbol limpio cuando Itzan movió el corte) | HECHO |
| H1.S1.M2 | Baseline de `lint` y `typecheck` | Hay salida y exit code | `yarn lint; echo "exit=$?"; yarn typecheck; echo "exit=$?"` → `evidencia/antes/lint.txt` (exit 1, 243 errores, todos `@angular-eslint/prefer-on-push-component-change-detection`, 194 archivos) y `typecheck.txt` (exit 0; hizo falta `yarn env:generate` antes — el script `typecheck` no genera `env.generated.ts` y un checkout limpio no lo trae) | HECHO |
| H1.S1.M3 | Baseline de `test` | Hay conteo de fallos previos | `yarn test --watch=false` → `evidencia/antes/test.txt`: `Test Files 7 failed \| 570 passed (577)` · `Tests 155 failed \| 7066 passed (7221)` · 427 s · exit=1. Corrió con otras corridas en paralelo (`environment 17729s`) | HECHO |
| H1.S1.M4 | Clasificar cada rojo previo | Cada uno con su clase de la regla 80.4 | tabla en `PLAN.md` (abajo, «Rojos previos del baseline»): los 7 archivos clasificados, 6 de ellos por reproducción aislada (`evidencia/antes/aislado-*.txt`, cada uno con su hora en la primera línea) y 1 por lectura del error | HECHO |

**Rojos previos del baseline (H1.S1.M4)** — 7 archivos, 155 tests, sobre `b7785e36` sin ningún cambio propio. **Los 7 son `ENVIRONMENT`.** Mecanismo de los seis por carga: en la suite completa (577 archivos, `environment 17729s`, con otras corridas en paralelo) un test pasa su tope de tiempo, su código asíncrono sigue corriendo con el `TestBed` ya instanciado y el `beforeEach` siguiente muere con «Cannot configure the test module…» (71 veces en `test.txt`), o se cae en cascada el resto del archivo. Corridos solos, los seis pasan enteros. **Para la regresión de cierre (H8)**: estos siete no cuentan como rojo nuevo si vuelven a fallar en la suite completa, **siempre que** vuelvan a pasar aislados; cualquier otro rojo es propio hasta demostrar lo contrario.

| Spec | Fallos en la suite | Error literal | Aislado | Clase (80.4) |
|---|---|---|---|---|
| `core/mock/fixtures/fichas-estandar.spec.ts` | 1 | `ENOENT: scandir '…/mantra-core-health-api/src/common/seed/data/clinical-forms'` | no hace falta: el spec (L33-35) busca la API como carpeta hermana del repo, y falla en cualquier checkout que no la tenga al lado | `ENVIRONMENT` (por lectura del error). No se toca el spec |
| `features/auth/register-practitioner/register-practitioner.spec.ts` | 1 | `Test timed out in 20000ms` (L1973, «resuelve los cinco tipos canónicos de credencial desde el backend simulado») | **bajo carga** 14:41 → `1 failed \| 94 passed (95)` (`aislado-register-practitioner.txt`; con otras corridas en paralelo) · **sin carga** 16:57 → `95 passed (95)`, exit 0 (`aislado-register-practitioner-2.txt`) | `ENVIRONMENT`. Mismo código y mismo spec: sólo cambió la carga. **Corrige** la clasificación anterior de esta tabla, que decía «reproducido aislado sin carga»: a las 14:41 había otras corridas en paralelo. Fragilidad anotada (no se arregla, no es de este carril): el test depende del reloj —el simulador demora cada respuesta entre 120 y 300 ms al azar (`mock-backend.interceptor.ts:258`) y su tope es 20 s para un arranque que su propio comentario mide en ~10,4 s— |
| `features/auth/register-organization/register-organization.spec.ts` | 1 | `Test timed out in 5000ms` (L701) | `57 passed (57)`, exit 0 (`aislado-register-organization.txt`) | `ENVIRONMENT` |
| `features/insurance/insurance-analytics/insurance-analytics.spec.ts` | 1 | `Test timed out in 5000ms` (L273, axe) | 16:44 → `10 passed (10)`, exit 0 (`aislado-insurance-analytics.txt`) | `ENVIRONMENT`. Ajeno: se anota, no se arregla |
| `features/account/my-profile/my-profile.spec.ts` | 69 | `Cannot configure the test module when the test module has already been instantiated` ×n + timeouts | 16:49 → `35 passed (35)`, exit 0 (`aislado-my-profile.txt`) | `ENVIRONMENT` (cascada). Es el spec que H7 toca en la otra rama (allí da 39/39) |
| `features/agenda/agenda-create/agenda-create.spec.ts` | 128 | ídem | 16:52 → `64 passed (64)`, exit 0 (`aislado-agenda-create.txt`) | `ENVIRONMENT` (cascada). Ajeno |
| `features/clinical-record/patient-chart/patient-chart.spec.ts` | 104 | ídem + `Test timed out` | 16:54 → `52 passed (52)`, exit 0 (`aislado-patient-chart.txt`) | `ENVIRONMENT` (cascada). Ajeno |

#### H1.S2 — Capturas y comportamiento previo, ejercitado

**CA:** Dado el perfil, cuando alguien pregunte cómo se veía y qué hacía antes, entonces hay capturas de
la ficha y del editor y tres respuestas observadas, no leídas del código.
**DoD:** seis capturas con su línea + tabla de tres filas en `evidencia/antes/comportamiento.md`.
**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Estado |
|---|---|---|---|---|
| H1.S2.M1 | Capturar la ficha (Datos personales, Contacto) y el editor (Trayectoria, Credenciales) en escritorio y móvil, miradas | Seis capturas con una línea cada una | `yarn node evidencia/antes/capturas-antes.mjs <url de la app>` → `evidencia/antes/capturas/` (8 de M1 + 12 de M2–M4; las 20 miradas en `capturas/INSPECCION.md`, una línea cada una). Observación previa: a 390 px «Agregar título/matrícula» queda antes de la zona de adjuntar y las tablas se cortan a la derecha | HECHO |
| H1.S2.M2 | Ejercitar: abrir «Editar» sobre un título y mirar si «Guardar cambios» está habilitado sin tocar nada | Un sí o un no observado | **SÍ** en los tres modales (título, especialidad, matrícula): `comportamiento.md` fila 1 + `05*.png`. Hizo falta agregar un título pendiente desde el formulario: los dos del mock están verificados y así no ofrecen «Editar» (`practitioner-profile-edit.html:842`) | HECHO |
| H1.S2.M3 | Ejercitar: pulsar «Retirar» en las tres tablas y anotar si aparece confirmación | Tres observaciones | **Los tres confirman** con diálogo propio (Cancelar / Retirar): `comportamiento.md` fila 2 + `06-retirar-*.png`. Cancelados; filas intactas | HECHO |
| H1.S2.M4 | Ejercitar: dónde se ve la insignia «principal» hoy (ficha, directorio `/directory`, perfil público) | Lista de pantallas con captura | Ficha **sí** (Datos personales) · editor **sí** (badge «Principal») · guía detalle **sí** (como paciente: la ruta tiene guard de rol, `app.routes.ts:617`) · guía lista: portada por especialidad, no aplica · perfil público **no** (chips sin marca). `comportamiento.md` fila 3 + `07-principal-*.png` | HECHO |
| H1.S2.M5 | Revisar consola y red antes de tocar | Lista de errores previos, o «ninguno» | `evidencia/antes/consola-red.txt` (+ `-paciente.txt`): consola **ninguno**; red: 6 mosaicos de OpenStreetMap `ERR_ABORTED` al cambiar de pestaña (mapa de Contacto), nada de la app. Aparte: el perfil público muestra «No pudimos traer las opiniones» sin error en red ni consola | HECHO |

### H2 — Datos personales y Contacto: tres quitas y un traslado (D-01, D-02, D-03)

**Prioridad:** `ALTA`

**CA:** Dado el perfil del médico, cuando se lo mira, entonces no hay «Estado de la práctica», ninguna
especialidad se distingue como principal en ningún lugar, y «Contacto» no muestra datos del trabajo — con
el correo de acceso visible en sólo lectura y los specs en verde sin debilitarlos.
**Desde el 24/09 (#645 de `mockup`, adoptado por decisión de Itzan):** el correo de trabajo se corrige en «Contacto» y es obligatorio; D-03 queda para el celular y el fijo del trabajo. El «correo de acceso» de sólo lectura salió: mostraba `perfil.email`, que el contrato de lectura documenta como alias del correo de trabajo (`profiles.types.ts:374`, `:383-388`), no la cuenta.
**DoD:** specs en verde (`practitioner-profile-view`, `practitioner-profile-edit`, `specialty-badge-grid`,
`pestanas-del-perfil-medico`); capturas ×3 viewports ×2 temas.
**Estado:** HECHO

#### H2.S1 — D-02: quitar «Estado de la práctica»

**CA:** Dada la ficha, cuando se abre Datos personales, entonces la fila no existe, y nada más se rompió.
**DoD:** spec en verde; captura.
**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Estado |
|---|---|---|---|---|
| H2.S1.M1 | Medir quién usa `estadoDePractica` antes de tocar | Lista de usos | `git grep -n 'estadoDePractica' origin/mockup -- 'src/app/**/*.ts' 'src/app/**/*.html'` → `evidencia/h2/estado-de-practica.txt`: la fila (`practitioner-profile-view.html:231`), el pie del sello de la portada (L799), el tipo de la vista, `practitioner-profile.ts:420` y el detalle de la guía (`practitioner-detail.ts:191`), que monta la misma vista | HECHO |
| H2.S1.M2 | Quitar la fila de `practitioner-profile-view.html:221-224` | No se dibuja | `git grep -c 'Estado de la práctica' -- src/app` → 0 → 0 archivos (la fila se reemplazó por un comentario con fecha y motivo que no repite el rótulo) | HECHO |
| H2.S1.M3 | Retirar lo que la calculaba **sólo si** M1 dio cero usos restantes; si no, anotar | Sin código muerto o anotado | diff + nota en `PLAN.md` → **no se retira nada**: M1 dejó usos vivos (pie del sello, detalle de la guía, tipo); el dato sigue en el contrato (Q-2) y el pie queda como Q-I7 | HECHO |
| H2.S1.M4 | Spec de la vista en verde; captura | Verde + captura mirada | `npx ng test --include=src/app/features/account/my-profile/practitioner-profile/**/*.spec.ts --watch=false` · spec en verde: `evidencia/h2/specs-h2-ficha.txt` 124/124 · captura: `h2-ficha-datos-personales-*` (3 viewports × 2 temas), sin «Estado de la práctica», mirada en `evidencia/h2/capturas/INSPECCION.md` | HECHO |

#### H2.S2 — D-01: todas las especialidades por igual

**CA:** Dada cualquier pantalla que muestre especialidades, cuando se la mira, entonces todas las
insignias se ven iguales, no hay «Marcar como principal», la tabla no ordena por principal, y el alta no
pregunta cuál es la principal.
**DoD:** specs en verde; capturas de ficha, editor, `/directory` y perfil público.
**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Estado |
|---|---|---|---|---|
| H2.S2.M1 | Inventario medido de todo lo que lee `principal`/`isPrimary` en el front | Lista con ruta:línea | `git grep -n -E 'principal\|isPrimary' origin/mockup -- 'src/app/**/*.ts' 'src/app/**/*.html' ':!*.spec.ts'` → `evidencia/h2/principal.txt` · clasificado en `evidencia/h2/principal-clasificado.md` (de 300 líneas, 12 sitios son de especialidad; 4 ajenos anotados) | HECHO |
| H2.S2.M2 | `specialty-badge`: el tono deja de depender de `principal`; el input queda documentado como sin efecto (o se retira si M1 lo permite) | Todas las insignias con el mismo tono | spec de la insignia · **se retira el input** (M1: sólo dos enlaces, ambos en archivos de H2); host con clase fija `tone--secondary`; spec reescrito: un solo tono en cuatro variantes y el input `principal` ausente (`reflectComponentType`) · `evidencia/h2/specs-h2.txt` (13 archivos; este sin cambios posteriores, verde) | HECHO |
| H2.S2.M3 | `specialty-badge-grid`: sin ordenar por principal; el comentario «La principal va primera» se reemplaza con la fecha y el motivo (D-01) | El orden es el de entrada | spec de la rejilla · sin `sort`; `SpecialtyBadgeItem.principal` retirado; spec: orden de entrada aun con el dato marcado · `evidencia/h2/specs-h2.txt` (13 archivos; este sin cambios posteriores, verde) | HECHO |
| H2.S2.M4 | Editor: retirar `marcarComoPrincipal`, `marcandoPrincipal`, el gesto de la columna «Tipo», el orden «la principal primero» y el `caption`; decidir si «Tipo» queda como dato (certificada) o se quita | Sin gesto; columnas coherentes | `git grep -c 'principal' -- src/app/features/account/my-profile/practitioner-profile-edit/` → 0 (o sólo comentarios de historia) · **«Tipo» se quita** (sólo decía Principal/Adicional y ofrecía el gesto; la certificación no se agrega como columna nueva); se van `marcarComoPrincipal`, `marcandoPrincipal`, `celdaRol`, el `sort`, `rol`/`esPrincipal`/`vigente` de la fila y el import de `Badge`; spec: tres pruebas nuevas (orden de entrada con la principal al final, sin columna ni gesto, tabla dibujada sin «principal») · `evidencia/h2/grep-dod-h2.txt` (sólo comentarios de historia) · `evidencia/h2/specs-h2-editor.txt` 80/80 | HECHO |
| H2.S2.M5 | Alta: retirar el select «Especialidad principal (opcional)» de `register-practitioner.ts:1967` y ajustar `CAMPO_DEL_ALTA_EN_PESTANA`/`CAMPOS_DEL_ALTA_SIN_PESTANA` con el motivo | El alta no pregunta; `specialtyPrimary` sale también del mapa y el spec de pestañas queda en verde sin tocarlo (Q-I6) | `npx ng test --include=src/app/features/account/my-profile/pestanas-del-perfil-medico.spec.ts --watch=false` · el control, el campo y `controlesDeEspecialidad` salen; `especialidadesElegidas()` lee sólo las casillas (la primera con valor queda principal para el backend, declarado en el código, Q-I6); rótulos «Especialidad 1, 2…» y botón «+ Agregar una especialidad» si no hay ninguna; `specialtyPrimary` sale del mapa de pestañas; spec: los casos del select pasan a las casillas + prueba nueva «no pregunta cuál es la principal» · pestañas: `evidencia/h2/specs-h2.txt` (13 archivos; este sin cambios posteriores, verde) · `evidencia/h2/specs-h2-alta.txt` 95/95 | HECHO |
| H2.S2.M6 | Tipos del front: `PractitionerListSpecialty.isPrimary` y `PractitionerSpecialty.isPrimary` quedan sin uso — **no se borran del wire**; comentario con la deuda (Q-1) | Nada lee `isPrimary` para pintar u ordenar | `git grep -n 'isPrimary' -- src/app ':!*.spec.ts'` sólo en tipos/simulador · deuda comentada en `profiles.types.ts` (tres campos) y `profiles.client.ts` (`setOwnPrimarySpecialty`, sin consumidor). **Además** `principal` sale del modelo de vista (`EspecialidadVisible`) y `especialidadPrincipal` pasa a «la primera vigente» en ficha y guía: era el último lector que pintaba. Quedan: el cuerpo que manda el editor al agregar (escribe `false`, no lee) y la historia clínica (`specialty-form-block.ts:1076`, ajena, anotada) · `evidencia/h2/isprimary-despues.txt` · `evidencia/h2/specs-h2-ficha.txt` 124/124 y `specs-h2-detalle.txt` 8/8 (la primera vigente) | HECHO |
| H2.S2.M7 | Simulador: `PrincipalElegida` y el `PATCH …/primary` quedan; se anota en el reporte que ya no tienen consumidor | Anotado | nota en `REPORTE.md` · anotado en `REPORTE.md` (Riesgos residuales) | HECHO |
| H2.S2.M8 | Capturas: ficha, editor, `/directory` (una especialidad), perfil público — todas las insignias iguales | 4 capturas miradas | `evidencia/h2/capturas/` · ficha, editor (Credenciales), perfil público, y como paciente el detalle y la portada del directorio: insignias con un solo tono y ninguna marca de principal, miradas en `evidencia/h2/capturas/INSPECCION.md`. El listado de una especialidad no dibuja insignias ni menciona «principal» (0 coincidencias); sin captura propia | HECHO |
| H2.S2.M9 | **Agregada (regla 00 §3.3), hallada en M1:** la ficha tenía otras dos marcas de «Principal» fuera de la insignia: el `app-badge` de la lista de especialidades de la ficha ajena (`practitioner-profile-view.html:1340`) y el renglón de la tarjeta de la especialidad (`credentials-panel.ts:83`) | Ninguna pestaña de ninguna de las dos fichas (propia y ajena) dice «principal» ni pinta una insignia en `tone--primary` | spec de la vista (prueba nueva que recorre todas las pestañas con un perfil que trae la principal marcada) + `credentials-panel.spec.ts` (prueba nueva) · `evidencia/h2/specs-h2-ficha.txt` 124/124 (vista y `credentials-panel`) | HECHO |

#### H2.S3 — D-03: «Contacto» sin datos del trabajo

**CA:** Dada la pestaña Contacto, cuando se la mira o se la edita, entonces no hay correo, celular ni
fijo del trabajo; el correo de acceso se lee en Datos personales en sólo lectura; y el spec de pestañas
sigue verde porque los tres campos están declarados sin pestaña con su motivo.
**Desde el 24/09 (#645):** el correo de trabajo vuelve a «Contacto» como campo editable y obligatorio, y sale de `CAMPOS_DEL_ALTA_SIN_PESTANA` (quedan el celular y el fijo del trabajo); el correo de acceso de «Datos personales» se retiró de la ficha y del editor.
**DoD:** specs en verde; capturas.
**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Estado |
|---|---|---|---|---|
| H2.S3.M1 | Ejercitar qué muestra Contacto hoy con `medica@` (qué datos tiene sembrados) | Captura anotada | `evidencia/h2/` · ya ejercitado en H1.S2: `evidencia/antes/capturas/02-ficha-contacto-escritorio.png` (correo de trabajo y personal, tres teléfonos, municipio, domicilio con «Ver en el mapa»), línea en `capturas/INSPECCION.md` | HECHO |
| H2.S3.M2 | Ficha: quitar las tres filas (`practitioner-profile-view.html:266, 299, 310`) | No se dibujan | `git grep -c 'del trabajo' -- …/practitioner-profile-view.html` → 0 · también en el segundo diseño de la ficha (vista previa): fuera «Celular del trabajo» y «Fijo del trabajo», y «Correo» pasa a «Correo de acceso»; `celularTrabajo`/`fijoTrabajo` salen del modelo de vista y del mapeo · `evidencia/h2/grep-dod-h2.txt` → 0 · `specs-h2-ficha.txt` 124/124 | HECHO |
| H2.S3.M3 | Editor: quitar «Celular del trabajo» y «Fijo del trabajo» (L286-310) y la sección «Tu correo de trabajo» (L311-322) | No se dibujan | `git grep -c 'trabajo' -- …/practitioner-profile-edit.html` sólo en comentarios de historia · se van los dos controles, su `reset`, su validación y su diff: el PATCH ya no puede mandarlos · `evidencia/h2/grep-dod-h2.txt` (sólo comentarios de historia) · `specs-h2-editor.txt` 80/80 | HECHO |
| H2.S3.M4 | «Correo de acceso» en Datos personales (ficha y editor), sólo lectura, con la misma nota «se cambia por su propio trámite» | Se lee en las dos pantallas | captura ×2 · muestra `perfil.email`, el campo de acceso de la cuenta en el contrato de lectura (ver el riesgo de los correos en `REPORTE.md`) · `h2-ficha-datos-personales-*` y `h2-editor-datos-personales-*`, miradas en `evidencia/h2/capturas/INSPECCION.md` · **24/09: superada por el #645 (decisión de Itzan).** El dato que mostraba como «correo de acceso» es el correo de trabajo (`email` es su alias en el contrato de lectura), que ahora se corrige en «Contacto»; se retiró de la ficha y del editor | DESCARTADO |
| H2.S3.M5 | `CAMPOS_DEL_ALTA_SIN_PESTANA` gana `workMobilePhone`, `workLandline` y `email` con el motivo (D-03, fecha) y se quitan de `CAMPO_DEL_ALTA_EN_PESTANA` | El spec de pestañas en verde, con L64 actualizado a las cinco claves y el motivo de las tres nuevas afirmado (Q-I3) | `npx ng test --include=…/pestanas-del-perfil-medico.spec.ts --watch=false` · L64 a cinco claves + motivo afirmado de las tres nuevas (Q-I3) · `evidencia/h2/specs-h2.txt` (13 archivos; este sin cambios posteriores, verde) · **24/09 (#645):** `email` vuelve a `CAMPO_DEL_ALTA_EN_PESTANA` en «Contacto»; las ausencias son seis y el spec las fija enteras | HECHO |
| H2.S3.M6 | El `PATCH /profiles/practitioners/me` sigue mandando sólo lo que se edita: verificar que no viaja `workMobilePhone` vacío que borre el dato | Observado en la Red | captura de la petición · cubierto también por spec (cuerpo exacto `{ mobilePhone }` con los tres del trabajo cargados) · visto en la Red: `evidencia/h2/red-patch.txt`, cuerpo `{"mobilePhone":"+591 71234567"}`, ninguna clave del trabajo | HECHO |
| H2.S3.M7 | Specs de la vista y del editor en verde | Verde | comando de spec · `evidencia/h2/specs-h2-ficha.txt` 124/124 · `specs-h2-editor.txt` 80/80 · `specs-h2-mi-perfil.txt` 35/35 | HECHO |
| H2.S3.M8 | Capturas ×3 viewports ×2 temas de Contacto y Datos personales | 12 capturas miradas | `evidencia/h2/capturas/` · las 12 `h2-ficha-{datos-personales,contacto}-{escritorio,tableta,movil}-{claro,oscuro}.png`, miradas en `evidencia/h2/capturas/INSPECCION.md` | HECHO |

### H3 — Trayectoria: tabla, modal, adjunto y lugares donde trabajé (D-04, D-08, D-09)

**Prioridad:** `ALTA`

**CA:** Dado el editor → Trayectoria, cuando se agrega o corrige un título, entonces se hace en un modal
con el diploma adjuntable (también al corregir), «Guardar» se habilita por cambios y pide confirmación, la
institución del catálogo se ve con su código, y «Lugares donde trabajé» está en la misma pestaña como tabla.
**Desde el 24/09 (#644 de `mockup`, adoptado por decisión de Itzan):** los títulos viven en «Credenciales», debajo de las matrículas, con la misma tabla, barra, filtro, paginación, acciones y modal; «Trayectoria» monta sólo el historial laboral. El CA se lee con esa ubicación.
**DoD:** ejercitado con captura; specs en verde; el simulador persiste el `fileId` al corregir.
**Estado:** HECHO

#### H3.S1 — El alta pasa a un modal (D-04)

**CA:** Dada la pestaña, cuando se pulsa «Agregar título» (a la derecha de la barra), entonces se abre un
`app-content-dialog` con los campos de hoy, y el formulario en línea ya no existe.
**DoD:** spec; captura; el archivo viaja como hoy.
**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Estado |
|---|---|---|---|---|
| H3.S1.M1 | Mover «Agregar formación» (hoy `practitioner-profile-edit.html:370-472`; era L390-492) a un `app-content-dialog size="md"` abierto por un botón «Agregar título» (ícono + texto) proyectado en el hueco `[filter-bar-action]` de la barra, que llegó con `9858520f`. Se hace junto con la barra de Trayectoria (H4.S3.M1–M2), que es la que da ese hueco | El formulario no se dibuja en línea | captura · código y spec en verde (el formulario ya no se dibuja en la pestaña; «Agregar título» en el hueco de la barra abre el modal): `evidencia/h3/specs-h3s1.txt` 102/102; falta la captura · visto en navegador: en Trayectoria no hay formulario en línea y «Agregar título» abre el modal (`evidencia/h4/comportamiento-h3h4.txt`, `evidencia/h3/capturas/h3-alta-titulo-modal-escritorio-claro.png` (y sus otras nueve combinaciones)); consola y red limpias (`evidencia/h4/consola-red-h3h4.txt`) | HECHO |
| H3.S1.M2 | El diploma sigue viajando en el alta (`fileId`; hoy `.ts:1339-1347` y el simulador en `profiles.handlers.ts:996-1012`); verificar en el simulador «agregar → recargar → sigue ahí con archivo» | Observado | captura + `profiles.handlers.ts` sin cambios para el alta · visto: alta con diploma → tras recargar la fila sigue con «Descargar» (`evidencia/h3/capturas/h3-alta-titulo-tras-recargar.png`); antes de recargar la descarga trae exactamente el archivo subido. Tras recargar el simulador devuelve `{}` porque guarda los bytes sólo en memoria (`files.handlers.ts:32`, `:219`; `mock-store.ts:197`): ajeno, declarado en el reporte. `profiles.handlers.ts` sin cambios para el alta | HECHO |
| H3.S1.M3 | Institución con su código del catálogo visible en el select y en la tabla (Q-8); «¿Cuál?» sigue para fuera de catálogo. El catálogo no tiene campo de código: la sigla vive dentro del texto de la opción (`core/profesion/instituciones-educativas.ts:35`), así que se agrega el dato al catálogo y se muestra en la columna (`.ts:741`) | Se lee el código | captura · hecho **sin tocar el catálogo**, que no está entre los archivos reservados del encargo: la sigla se toma de la etiqueta de la opción, la misma que ya muestra el desplegable (`codigoDeInstitucion` / `institucionConCodigo` en `practitioner-profile-edit.logic.ts`), así que el desplegable y la tabla no pueden decir dos siglas distintas; lo escrito a mano se muestra tal cual. Specs 138/138 (6 nuevas; `evidencia/h3/specs-h3s1m3-editor.txt`); mutación: con la columna sin sigla fallan las 2 del editor (`mutacion-h3s1m3.txt`); tipos app y spec 0, eslint 0, arquitectura igual que antes (`typecheck-h3s1m3.txt`, `typecheck-spec-h3s1m3.txt`, `eslint-h3s1m3.txt`, `arquitectura-h3s1m3.txt`); compilación sin errores (`build-dev-h3s1m3.txt`). Visto: a 1440, «Universidad Mayor de San Andrés (UMSA)» en la fila ya cargada y en la recién agregada tras recargar, y «Colegio Médico de Bolivia» tal cual (`evidencia/h4/comportamiento-h3h4.txt`, `evidencia/h3/capturas/h3-alta-titulo-tras-recargar.png`); a 375 en el detalle de la fila (`evidencia/h3/institucion-375.txt`); a 390, la sigla adelante en el desplegable (`capturas/h3-alta-titulo-institucion-movil-oscuro.png`) | HECHO |
| H3.S1.M4 | Confirmación al agregar («¿Confirmás estos datos?») con `confirmarCambios` real de `molecules/dialog` (`dialog-service.ts:72`; sin doble). La regla 2 del ADR-0015 exime el alta; se confirma igual porque lo pide este encargo (Q-I8) | Aparece | captura · `confirmarCambios` con «¿Confirmás estos datos?»; sin confirmar no viaja nada y lo escrito queda (spec); falta la captura · visto: «¿Confirmás estos datos?» al agregar (`evidencia/h3/capturas/h3-alta-titulo-confirmacion.png`); `Escape` con datos pregunta si se descarta y «Seguir editando» conserva lo escrito (`evidencia/h3/capturas/h3-alta-titulo-descarte.png`) | HECHO |
| H3.S1.M5 | Spec del alta en modal | Verde | `npx ng test --include=…/practitioner-profile-edit.spec.ts --watch=false` · `evidencia/h3/specs-h3s1.txt`: 102/102 (13 pruebas nuevas en el editor: modal, confirmación, cierre con y sin datos, fallo que conserva lo escrito; 9 de `practitioner-profile-edit.logic.spec.ts`) · typecheck 0 · eslint 0 | HECHO |

#### H3.S2 — Corregir con adjunto, guardar por cambios y confirmación (D-08)

**CA:** Dado «Editar» sobre un título pendiente, cuando se abre, entonces los campos vienen llenos, hay
`app-file-input` para reemplazar el diploma, «Guardar» está deshabilitado hasta cambiar algo, al guardar
pregunta «¿Confirmás estos cambios?», y cancelar con cambios pregunta si se descartan.
**DoD:** los cinco comportamientos observados; spec; `PATCH` simulado acepta `fileId`.
**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Estado |
|---|---|---|---|---|
| H3.S2.M1 | `app-file-input` en el `@case ('formacion')` del modal (hoy `.html:920-960`; era L978-1017), con el archivo actual indicado y «Reemplazar» | Se puede elegir uno nuevo | captura · código y spec: selector en el caso formación, con rótulo «Reemplazar el diploma» cuando ya hay uno (`archivoActual`); `evidencia/h3/specs-h3s2.txt` 110/110; falta la captura · visto: «Reemplazar el diploma (opcional)» con el archivo actual indicado (`evidencia/h3/capturas/h3-corregir-titulo-sin-cambios.png`) | HECHO |
| H3.S2.M2 | El editor sube el diploma nuevo y manda `fileId` en la corrección (`peticionDeEdicion`, `.ts:1648-1656`). El tipo (`OwnCredentialChanges.fileId`, `profiles.types.ts:270`) y el `PATCH` del simulador (`profiles.handlers.ts:1024-1030`, lectura en L130-137) ya lo aceptan y lo persisten, así que no se tocan. **Doble declarado**: la API real no tiene este `PATCH` (HALL-E3) | Corregir → recargar → «Descargar» baja el nuevo | captura + nota · el editor sube el archivo y manda `fileId` en la corrección; si la subida falla no corrige nada (spec); falta verlo persistir tras recargar · visto: tras corregir, la descarga trae el diploma nuevo y no el original; el número corregido sigue tras recargar (`evidencia/h4/comportamiento-h3h4.txt`) | HECHO |
| H3.S2.M3 | «Guardar cambios» habilitado sólo si el borrador difiere del original (`computed`, sin `effect`) | Abrir y guardar sin tocar → deshabilitado | spec + captura · `hayCambiosEnEdicion` (huella al abrir contra la de ahora, `computed`, sin `effect`); abrir sin tocar → apagado, volver al original → apagado (spec); falta la captura · visto: «Guardar cambios» apagado sin cambios y encendido con uno (`evidencia/h3/capturas/h3-corregir-titulo-sin-cambios.png`) | HECHO |
| H3.S2.M4 | Confirmación al guardar con `confirmarCambios` real de `molecules/dialog` (PR #582, en el corte; sin doble) | Aparece; «Cancelar» vuelve con el foco en Guardar | captura ×2 · `confirmarCambios` antes del PATCH; sin confirmar no viaja nada y el diálogo sigue abierto (spec); faltan las capturas · visto: «¿Confirmás estos cambios?»; «Seguir editando» devuelve el foco a «Guardar cambios» (`evidencia/h3/capturas/h3-corregir-titulo-confirmacion.png`) | HECHO |
| H3.S2.M5 | Cancelar o `Escape` con cambios → `confirmarDescarte` real de `molecules/dialog` a través de `closeGuard` del modal (`content-dialog.ts:144`, la forma que documenta el propio modal); sin cambios cierra directo | Dos caminos observados | captura ×2 · `closeGuard` = `guardaDeEdicion`: sin cambios cierra, con cambios `confirmarDescarte`, guardando no cierra (spec); «Cancelar» pasa por la guarda; faltan las capturas · visto: `Escape` sin cambios cierra directo; con cambios pregunta, y «Descartar» deja la fila como estaba (`evidencia/h3/capturas/h3-corregir-titulo-descarte.png`) | HECHO |
| H3.S2.M6 | Verificar que «Retirar» confirma (H1.S2.M3); si no, agregarlo con `dialogs.confirm` | Observado | captura · ya lo hacía antes del corte: «Retirar» llama a `retirarFila` (`.ts:1495-1524`), que confirma con `dialogs.confirm`; observado en H1.S2.M3 (`evidencia/antes/comportamiento.md`, las tres tablas) | HECHO |
| H3.S2.M7 | Spec: campos llenos, adjunto, dirty, confirmación, descarte | Verde | comando de spec · `evidencia/h3/specs-h3s2.txt`: 110/110 (8 pruebas nuevas de corrección: apagado sin cambios, archivo actual, confirmación, fileId, subida fallida, matrícula con respaldo, guarda con y sin cambios, no cierra guardando) · typecheck 0 · eslint 0 | HECHO |

#### H3.S3 — «Lugares donde trabajé» en la misma pestaña

**CA:** Dada la pestaña Trayectoria del editor, cuando se abre, entonces debajo de los títulos está el
historial laboral como tabla con la disciplina (llegó de Pablo con `9858520f`; hoy edita sólo en memoria, ver H3.S3.M1),
montado sólo cuando guarde de verdad.
**DoD:** montado; spec de pestañas sin cambios; captura.
**Desde el 24/09 (#644):** el historial queda solo en «Trayectoria» y los títulos pasan a «Credenciales»; `CAMPO_DEL_ALTA_EN_PESTANA` manda los campos del título a «Credenciales» (cambio del #644, no de este carril).
**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Estado |
|---|---|---|---|---|
| H3.S3.M1 | Montar `<app-work-history secciones="historial" layout="tabla">` (existe con ese nombre: `work-history.ts:170,197`, `9858520f`) en la pestaña Trayectoria del editor, con `@if (pestana() === …)` como las otras. **Bloqueada:** en modo tabla, «Editar» y «Retirar» cambian sólo la memoria del componente y se pierden al recargar (`work-history.ts:1523-1545`), aunque el cliente y el simulador ya tienen `updateAffiliation`/`removeAffiliation`. `work-history/**` es de Pablo (OUT del encargo). Se destraba cuando Pablo lo conecte o cuando Itzan decida montarlo igual | Se ve | captura · se destraba con H3.S4.M4 (Pablo encargó la conexión a este carril, 23/09) · montado bajo los títulos con `@if (pestana() === pestanaEditor.trayectoria)`; 2 pruebas de plantilla escritas (monta con `historial`/`tabla` debajo de los títulos; con otra pestaña no se monta), sin correr todavía; falta la captura · visto: el historial va en Trayectoria después de los títulos, en tabla y con su propia barra (`evidencia/h3/capturas/h3-trayectoria-escritorio-claro.png`) | HECHO |
| H3.S3.M2 | Si el layout de tabla no llegó: montar la línea de tiempo existente, y registrar en el reporte que la tabla llega de Pablo | Declarado | nota en `PLAN.md` y `REPORTE.md` · sin objeto: el layout de tabla llegó con `9858520f` | DESCARTADO |
| H3.S3.M3 | `CAMPO_DEL_ALTA_EN_PESTANA` sin cambios para los campos del título (hoy `pestanas-del-perfil-medico.ts:204-209`: `professionalTitle` en Datos personales; el resto de `professionalTitle*` en Trayectoria) | Spec verde | comando de spec · `pestanas-del-perfil-medico.ts` y su spec sin cambios; en verde con el editor (`evidencia/h4/specs-h4-editor.txt`: 3 archivos · 143/143) | HECHO |
| H3.S3.M4 | Captura ×2 viewports | Miradas | `evidencia/h3/capturas/` · 1440 claro y 375 oscuro, miradas: `evidencia/h3/capturas/h3-trayectoria-escritorio-claro.png`, `evidencia/h3/capturas/h3-trayectoria-movil-oscuro.png`. A 375 la página se pasa 5 px por el encabezado de la app, en todas las pestañas: ajeno (`evidencia/h4/desborde-375.txt`) | HECHO |

#### H3.S4 — Correcciones en las piezas de Pablo (él las encargó a este carril, 23/09)

**Origen:** Pablo aprobó las tres correcciones que se le propusieron y las encargó a este carril. Levanta la exclusión del encargo sobre `organisms/filter-bar/**` y `work-history/**` **sólo** para este alcance.
**CA:** Dadas dos barras de filtro en una misma pestaña, cuando se busca en una, entonces la otra no cambia; y dado el historial laboral en modo tabla, cuando se corrige o se retira un vínculo, entonces el cambio sigue ahí al recargar, y descartar usa el mismo texto que las demás tablas.
**DoD:** specs de la barra, del historial y del editor en verde; consumidores de la barra sin cambios; captura.
**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Estado |
|---|---|---|---|---|
| H3.S4.M1 | `app-filter-bar` gana `searchParam = input(SEARCH_PARAM)`: lee (`filter-bar.ts:163`), escribe (:252), limpia (:265) y emite (:287) bajo esa clave. Con `q` por omisión, quien ya la usa no cambia | Dos barras con claves distintas no se cruzan; sin la entrada, todo igual | spec de `filter-bar` · `evidencia/h3/specs-h3s4-filter-bar.txt`: 17/17 (4 nuevas); mutación: con la barra vieja fallan las 3 de convivencia (`q` por omisión pasa igual) | HECHO |
| H3.S4.M2 | Radio de la barra: sus 10 consumidores (`rg -l '<app-filter-bar' src/app`; el ADR-0015 contaba 8) siguen igual | Specs de los consumidores en verde + vistos en navegador | comando de spec + captura · specs de los consumidores en verde: `evidencia/h3/specs-h3s4-consumidores-barra.txt` 11 archivos · 219/219 (más editor 112/112 y historial 104/104); falta verlos en navegador · vistos en navegador los 13 consumidores, cada uno con su cuenta: 13/13 muestran la barra con clave `q` y la búsqueda escribe `q=`; consola limpia (`evidencia/h3/consumidores-barra.txt`, `consumidores-barra-consola.txt`, `evidencia/h3/capturas/h3-barra-*.png`) | HECHO |
| H3.S4.M3 | La barra de títulos del editor usa su propia clave (`qTitulos`) para no cruzarse con la del historial en la misma pestaña; la lectura inicial y el olvido al cambiar de pestaña usan esa clave | Buscar en títulos no filtra el historial | spec del editor · `evidencia/h3/specs-h3s4-editor.txt`: 112/112 (la `q` del historial no filtra títulos; la plantilla pasa `qTitulos`; cambiar de pestaña también olvida `q`) | HECHO |
| H3.S4.M4 | Historial en modo tabla: «Editar» guarda el cargo con `updateAffiliation` y «Retirar» borra con `removeAffiliation` (`profiles.client.ts:704,721`), como ya hace la línea de tiempo (`work-history.ts:882,925`); se va el doble en memoria (`:1546-1551`, `:1760-1789`) | Corregir o retirar → recargar → sigue así | spec + captura tras recargar · spec: `PATCH` del cargo sólo si cambió, `DELETE` reusando `retirarVinculo`, errores visibles (`evidencia/h3/specs-h3s4-work-history.txt` 104/104); falta la captura tras recargar · visto: «Corregir el vínculo» con guardar apagado sin cambios, confirmación, y el cargo sigue tras recargar; «Retirar» confirma y tras recargar la fila no vuelve (3→2) (`evidencia/h3/capturas/h3-historial-corregir.png`, `evidencia/h3/capturas/h3-historial-retirar-confirmacion.png`, `evidencia/h3/capturas/h3-historial-tras-recargar-cargo.png`) | HECHO |
| H3.S4.M5 | Adjunto del historial en modo tabla: el contrato de afiliaciones no tiene archivo (ni `UpdatePractitionerAffiliation`, `profiles.types.ts:679`, ni el DTO de la API) y hoy el vínculo vive sólo en memoria. Ver Q-I10 | Decisión escrita e implementada | `PLAN.md` + `REPORTE.md` · decidido (Q-I10, opción a): sin adjunto. Escrito: fuera la columna «Adjunto», el selector de archivo del modal «Corregir el vínculo», la subida y el mapa en memoria (`work-history.ts`, `.html`); los tres tests del adjunto pasan a dos: ni la tabla ni la corrección ofrecen adjunto, y sin cambiar el cargo no se confirma ni sale el `PATCH`. Verde: historial 95/95 (eran 96 sin el diálogo del QR: salen los 3 tests del adjunto y entran 2; `evidencia/h3/specs-h3s4m5-historial.txt`), editor 132/132 (`specs-h3s4m5-editor.txt`), pestañas del perfil 11/11 (`specs-h3s4m5-pestanas.txt`); tipos 0 (`typecheck-h3s4m5.txt`), eslint 0 (`eslint-h3s4m5.txt`), compilación de desarrollo sin errores (`build-dev-h3s4m5.txt`). Visto en el navegador: el historial muestra «Institución · Período · Acciones», «Corregir el vínculo» trae sólo «Cargo» (0 selectores de archivo) y el cargo corregido sigue tras recargar; consola y red 0 (`evidencia/h4/comportamiento-h3h4.txt`, `evidencia/h3/capturas/h3-historial-corregir.png`, `h3-historial-tras-recargar-cargo.png`) | HECHO |
| H3.S4.M6 | Descartar en el historial usa `confirmarDescarte()` (`dialog-service.ts:92`) en los tres sitios con texto propio (`work-history.ts:704,1052,1702`) | Mismo texto que las tablas del editor | spec del historial · los 3 descartes aseveran `CONFIRMAR_DESCARTE` con el `DialogService` real (spec 104/104) | HECHO |
| H3.S4.M7 | Specs del historial al día sin debilitarlos: lo que aseveraba el doble en memoria pasa a aseverar la llamada al cliente | Verde | comando de spec · 104/104; mutación contra el componente viejo: 9 rojos, justo los comportamientos nuevos (3 textos de descarte, PATCH, DELETE, errores); typecheck app+spec 0 (`typecheck-h3s4.txt`, `typecheck-spec-h3s4.txt`); eslint 0 en los 10 archivos (`lint-h3s4.txt`; incluye `OnPush` en los 4 hosts heredados del spec de la barra, que ya estaban en rojo en HEAD) | HECHO |

### H4 — Credenciales, y la barra + paginación de las tres tablas (D-08, D-10)

**Prioridad:** `ALTA`

**CA:** Dado el editor → Credenciales, cuando se agrega o corrige una especialidad o una matrícula,
entonces sigue la misma disciplina que los títulos (modal, adjunto donde el contrato lo permite, guardar
por cambios, dos confirmaciones); y las tres tablas del editor tienen buscador multicampo, filtro por
estado, «Añadir» a la derecha, scroll vertical sin lateral y paginación con selects abajo a la derecha.
**DoD:** ejercitado con captura; specs en verde; Q-9 registrada con la salida elegida.
**Estado:** HECHO

#### H4.S1 — Especialidades

**CA:** Dada la tabla de especialidades, cuando se agrega o corrige, entonces es en modal con
confirmación, y el respaldo se ofrece por el camino que el contrato admite.
**DoD:** spec; capturas; decisión Q-9 escrita.
**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Estado |
|---|---|---|---|---|
| H4.S1.M1 | Alta en modal: «Agregar especialidad» (ícono + texto) a la derecha; el formulario en línea (hoy `.html:501-598`; era L521-624) desaparece, las casillas sumables se conservan dentro del modal | Sin formulario en línea | captura · escrito: el formulario en línea salió de Credenciales; `alta-especialidad-dialogo` se abre desde «Agregar especialidad» en la barra de su tabla (`qEspecialidades`), con las casillas sumables adentro y confirmación antes del POST; spec escrito, sin correr; falta captura · visto: Credenciales sin formulario en línea; las casillas sumables viven en el modal y «Quitar» muestra su texto (`evidencia/h4/capturas/h4-alta-especialidad-casillas.png`) | HECHO |
| H4.S1.M2 | Respaldo: decidir y escribir Q-9 — (a) vincular a un título cargado (`supportingCredentialId`, que el contrato tiene) o (b) `fileId` sólo en el simulador como doble declarado; implementar la elegida. Hoy `supportingCredentialId` existe sólo en el alta (`profiles.types.ts:94`); no está en la corrección (L274-277) ni en la lectura, así que con (a) el vínculo no se puede mostrar ni corregir al editar | Decisión escrita con motivo | `PLAN.md` + nota en `REPORTE.md` · **Q-9 decidida por Itzan (23/09): (a)**. En el alta se elige un título ya cargado como respaldo y viaja como `supportingCredentialId`; sólo se ofrecen títulos VERIFICADOS, porque la API rechaza uno pendiente con 422 («La credencial de soporte no está verificada», `profiles-practitioners.service.ts:1843` en `dev`). El vínculo no se muestra ni se corrige después: ni la lectura ni la corrección lo traen · visto: el respaldo ofrece sólo el título verificado; las dos especialidades siguen tras recargar (`evidencia/h4/capturas/h4-alta-especialidad-confirmacion.png`, `evidencia/h4/comportamiento-h3h4.txt`) | HECHO |
| H4.S1.M3 | Editar: campos llenos, guardar por cambios, confirmación (`confirmarCambios`) y descarte con cambios (`confirmarDescarte`), ambos reales de `molecules/dialog` (PR #582) | Observado | capturas · la corrección usa el modal compartido (H3.S2): campos llenos, guardar por cambios, `confirmarCambios` y `confirmarDescarte`; falta observarlo · visto: «Guardar cambios» apagado sin cambios y `Escape` sin cambios cierra directo (`evidencia/h4/capturas/h4-corregir-especialidad.png`) | HECHO |
| H4.S1.M4 | Retirar con confirmación verificada | Observado | captura · ya lo hacía antes del corte: «Retirar» de especialidades (`.ts:1537-1545`) pasa por `retirarFila`, que confirma; observado en H1.S2.M3 | HECHO |
| H4.S1.M5 | Spec | Verde | comando de spec · 9 pruebas nuevas (modal, confirmación, respaldo sólo verificados, `supportingCredentialId` en cada envío, guarda, plantilla, barra) y 3 del alta pasadas a `async`; sin correr todavía · verde: `evidencia/h4/specs-h4-editor.txt` 143/143; typecheck app+spec 0 y eslint 0 (`typecheck-h4.txt`, `typecheck-spec-h4.txt`, `lint-h4.txt`) | HECHO |
| H4.S1.M6 | Capturas ×2 viewports | Miradas | `evidencia/h4/capturas/` · 1440 claro y 375 oscuro, miradas: `evidencia/h4/capturas/h4-alta-especialidad-modal-escritorio-claro.png`, `evidencia/h4/capturas/h4-alta-especialidad-modal-movil-oscuro.png`, `evidencia/h4/capturas/h4-especialidades-escritorio-claro.png`, `evidencia/h4/capturas/h4-especialidades-movil-oscuro.png` (desde el 24/09 las especialidades viven en «Datos personales»; el tope de cuatro, en `evidencia/h4/capturas/h4-especialidades-tope.png`) | HECHO |

#### H4.S2 — Matrículas

**CA:** Dada la tabla de matrículas, cuando se agrega o corrige, entonces es en modal con el respaldo
adjuntable (también al corregir), guardar por cambios y confirmación.
**DoD:** spec; capturas; el simulador persiste el `fileId` al corregir.
**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Estado |
|---|---|---|---|---|
| H4.S2.M1 | Alta en modal: «Agregar matrícula» a la derecha; el formulario en línea (hoy `.html:615-692`; era L640-718) desaparece | Sin formulario en línea | captura · escrito: el formulario en línea salió de Credenciales y vive en `alta-matricula-dialogo`, abierto desde «Agregar matrícula» en la barra de su tabla (mismos campos, movidos tal cual); spec escrito, sin correr; falta captura · visto: sin formulario en línea; «Agregar matrícula» abre el modal (`evidencia/h4/capturas/h4-alta-matricula-modal-escritorio-claro.png`) | HECHO |
| H4.S2.M2 | Editar con `app-file-input` (reemplazar el carnet) en el modal (`.html:978-996`) y mandar `fileId` en la corrección (`.ts:1668-1677`). El tipo (`OwnLicenseChanges.fileId`, `profiles.types.ts:288`) y el simulador (`profiles.handlers.ts:1069-1075`) ya lo aceptan, así que no se tocan — doble declarado | Corregir → recargar → «Descargar» baja el nuevo | captura + nota · mismo modal: selector «Reemplazar el respaldo» en el caso matrícula y `fileId` en su PATCH (spec); falta verlo persistir y la captura · visto: número lleno y «Reemplazar el respaldo»; tras corregir y antes de recargar, la descarga trae el carnet nuevo y no el original; tras recargar, la fila sigue con «Descargar», pero el simulador devuelve `{}` en cualquier descarga, igual que en H3.S1.M2 (ver «Riesgos residuales» del reporte; `evidencia/h4/comportamiento-h3h4.txt`, `evidencia/h4/capturas/h4-corregir-matricula-con-archivo.png`, `evidencia/h4/capturas/h4-matricula-tras-recargar.png`) | HECHO |
| H4.S2.M3 | Guardar por cambios, confirmación (`confirmarCambios`), descarte (`confirmarDescarte`) —reales de `molecules/dialog`, PR #582— y retirar con su confirmación propia (existe hoy, H1.S2.M3) | Observado | capturas · alta: `confirmarCambios` («¿Confirmás estos datos?») antes del POST y `closeGuard` con `confirmarDescarte`; la corrección ya los tenía por el modal compartido (H3.S2); falta observarlo · visto: «¿Confirmás estos datos?» al agregar (`evidencia/h4/capturas/h4-alta-matricula-confirmacion.png`); `Escape` sin nada escrito cierra directo; retirar ya confirmaba (H1.S2.M3) | HECHO |
| H4.S2.M4 | Spec | Verde | comando de spec · 9 pruebas nuevas (modal, confirmación, guarda, plantilla, barra) y las 5 del alta pasadas a `async` con confirmación; sin correr todavía · verde: `evidencia/h4/specs-h4-editor.txt` 143/143 | HECHO |
| H4.S2.M5 | Capturas ×2 viewports | Miradas | `evidencia/h4/capturas/` · 1440 claro y 375 oscuro, miradas: `evidencia/h4/capturas/h4-alta-matricula-modal-escritorio-claro.png`, `evidencia/h4/capturas/h4-alta-matricula-modal-movil-oscuro.png`, `evidencia/h4/capturas/h4-busqueda-matriculas.png` | HECHO |

#### H4.S3 — Barra, paginación y scroll en las tres tablas

**CA:** Dada cualquiera de las tres tablas, cuando tiene filas, entonces arriba hay buscador multicampo
(normalizado) y filtro por estado (pendiente/verificado), «Añadir» a la derecha, la tabla no desplaza a lo
ancho y desplaza a lo alto con alto máximo, y abajo a la derecha hay Anterior/Siguiente con texto, número,
y selects de página y de tamaño.
**DoD:** specs; capturas ×3 viewports ×2 temas; sin scroll lateral medido.
**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Estado |
|---|---|---|---|---|
| H4.S3.M1 | `app-filter-bar` sobre cada tabla: buscador por tipo + número + institución (títulos), especialidad (especialidades), número + autoridad (matrículas), normalizando acentos y mayúsculas; filtro «Estado». La barra emite un solo término (`q`): el filtrado multicampo lo hace esta pantalla con su propio normalizador (el de `work-history` es privado, `work-history.ts:1942`, y ese archivo es de Pablo). Las matrículas no traen un sí/no de verificada: el filtro sale de `stateConceptId` (`profiles.types.ts:238`) | Buscar «umsa» encuentra «UMSA» | spec + captura · tramo títulos hecho: búsqueda en tipo, número e institución (`practitioner-profile-edit.logic.ts`), filtro `estadoTitulo`, búsqueda inicial leída de la URL y olvidada al cambiar de pestaña; especialidades y matrículas esperan el parámetro de búsqueda propio por barra (pedido a Pablo) · matrículas: barra con buscador por número y autoridad bajo `qMatriculas`; el filtro por estado falta, porque la matrícula no trae «verificada» como el título, sólo `stateConceptId` · cerrado: las especialidades filtran por su sí/no de verificada (`verified`), con las mismas opciones que los títulos; las matrículas ofrecen los estados que traen y filtran por el concepto, con la etiqueta de la tabla, sin inventar una equivalencia a «verificada». Cada filtro con su clave en la URL (`estadoEspecialidad`, `estadoMatricula`), que se olvida al cambiar de pestaña. Visto: especialidades 3 → 1 pendiente → 2 verificadas; matrículas 3 → 2 «Activo» → 1 «Pendiente», con el chip «Estado: Pendiente» (`evidencia/h4/comportamiento-h4s3.txt`, `capturas/h4s3-matriculas-filtro-estado.png`) | HECHO |
| H4.S3.M2 | Botón de alta proyectado en el hueco `[filter-bar-action]` de cada barra (`9858520f`): «Agregar título», «Agregar especialidad», «Agregar matrícula» | A la derecha en 1440, debajo en 375 | captura ×2 · «Agregar título» proyectado; faltan los de especialidades y matrículas · «Agregar matrícula» ya proyectado en su barra · visto: los tres botones a la derecha del buscador en 1440 y debajo en 375 (`evidencia/h4/capturas/h4-especialidades-escritorio-claro.png` y `h4-especialidades-movil-oscuro.png` en «Datos personales», `evidencia/h4/capturas/h4-credenciales-escritorio-claro.png` y `h4-credenciales-movil-oscuro.png` en Credenciales, `evidencia/h3/capturas/h3-trayectoria-movil-oscuro.png`) | HECHO |
| H4.S3.M3 | Paginación en cliente con `app-pagination`, abajo a la derecha. El paginador ya trae texto y salto de página (`9858520f`); se le pasan 10 por página (su valor por omisión es 20, `pagination.types.ts:23`) y se alinea a la derecha en el CSS del editor | Con 12 títulos se ven 2 páginas | captura · 10 por página en las tres tablas (`FILAS_POR_PAGINA`), en cliente como el historial; buscar o filtrar vuelve a la primera, y una página que ya no existe muestra la última (`filasDeLaPagina`). Visto con 12 títulos: «1–10 de 12» con 10 filas, «Siguiente» → «11–12 de 12» con 2, buscar desde la página 2 → «1–10 de 10», «20 por página» → 12 filas; el paginador termina en el borde derecho de su sección en los 18 casos (3 anchos × 2 temas × 3 tablas) (`evidencia/h4/comportamiento-h4s3.txt`, `capturas/h4s3-titulos-pagina-2.png`) | HECHO |
| H4.S3.M4 | Alto máximo con scroll vertical, sin lateral, con el `maxHeight` de `data-table` (`9858520f`). Ojo: con alto máximo la tabla pliega las columnas secundarias al detalle también en escritorio (`data-table.css:293`, `.data-table--constrained`). Se mide antes, y si Institución y Emisión (D-09, Q-8) dejan de verse en la fila, no se activa y se declara (Q-I9) | A 375/1440 `scrollWidth` ≤ `clientWidth` | medición pegada · `maxHeight="420px"` en las tres tablas, como el historial (Q-I9, medido abajo). A 375 las tres se desplazaban a lo ancho aun con las acciones de fila (títulos 411/301, especialidades 350/301, matrículas 425/301): en el teléfono la fila lleva el identificador y las acciones, y el resto pasa al detalle (prioridad 2). Medido después: 1440 → 1070/1070, 768 → 678/678, 375 → 301/301 en las tres, y con 12 títulos la tabla desplaza a lo alto (`evidencia/h4/anchos-h4s3.txt`, `comportamiento-h4s3.txt`). La página a 375 estaba en 380/375 por el encabezado de la app (heredado); tras integrar `mockup` (#604, N-01) da 375/375 en Trayectoria, Credenciales y Datos personales (`evidencia/cierre/desborde-375.txt`) | HECHO |
| H4.S3.M5 | Specs de las tres | Verde | comando de spec · 154/154, 16 nuevas (5 de la lógica: estados presentes, filtro por concepto, páginas; 11 del editor: 12 títulos en dos páginas, vuelta a la primera al buscar, filtros de especialidades y matrículas, lectura de la URL, olvido al cambiar de pestaña, acciones por fila, disparador con tres y botones con dos, despacho y acciones apagadas en curso) (`evidencia/h4/specs-h4s3-editor.txt`); mutación con tres cambios —página sin cortar, filtro de especialidades sin filtrar, «Editar» en lo verificado—: 7 rojos, los de cada cambio (`mutacion-h4s3.txt`); tipos app y spec 0, eslint 0, arquitectura igual que antes (`typecheck-h4s3.txt`, `typecheck-spec-h4s3.txt`, `eslint-h4s3.txt`, `arquitectura-h4s3.txt`) | HECHO |
| H4.S3.M6 | Capturas ×3 viewports ×2 temas de las tres tablas, miradas | 18 capturas con su línea | `evidencia/h4/capturas/` · 18 miradas, `h4s3-<tabla>-<ancho>-<tema>.png` para títulos, especialidades y matrículas en 1440, 768 y 375, claro y oscuro, cada una con su línea de medida en `comportamiento-h4s3.txt`; más tres: la página 2, el desplegable de acciones y el filtro de matrículas. Guion: `evidencia/h4/capturas-h4s3.mjs` | HECHO |
| H4.S3.M7 | **Agregada (regla 00 §3.3), hallada al medir contra `mockup`:** acciones de fila con `app-row-actions` donde hay más de dos (ADR-0012 §2); hoy títulos y matrículas muestran hasta tres botones sueltos (`.html:785-903`). El encargo la nombra entre las piezas de Pablo que se montan (L93, L229) | Con más de dos acciones la fila muestra un solo disparador que abre el menú, cada opción con ícono y texto; con dos o menos, botones como hoy | spec + captura · `app-row-actions` en las tres tablas; la lista sale de `accionesDeFormacion` / `accionesDeEspecialidad` / `accionesDeMatricula` y la forma la decide el componente. Visto: título pendiente con diploma → un disparador «Acciones» con Editar · Descargar · Retirar, y «Editar» abre el modal de corrección; pendiente sin diploma → Editar y Retirar en la fila; verificado → «Descargar» y la nota; especialidad → Editar y Retirar; matrícula con carnet → disparador (`evidencia/h4/comportamiento-h4s3.txt`, `capturas/h4s3-titulos-menu-acciones.png`). La pasada de H3/H4 se rehízo por las acciones nuevas: sin fallos, consola y red 0 (`comportamiento-h3h4.txt`). **Falta «ícono y texto» en «Descargar»** (N4-05/N4-06, `evidencia/doble-revision-nucleo.md`): va sólo con texto porque el set cerrado de íconos (`atoms/nav-icon`, compartido y fuera de la reserva) no tiene uno de descarga. Sumarlo o aceptar esa opción sin ícono es decisión de Itzan. Lo verificado de especialidades y matrículas ya no ofrece «Editar» ni «Retirar» (N4-02, decisión de Itzan del 24/09), como los títulos | A MEDIAS |

### H5 — El mapa vacía la dirección, y el texto sobrante se va (D-06, D-07)

**Prioridad:** `ALTA`

**CA:** Dado cualquier formulario tuyo con mapa, cuando se toca el mapa, entonces el campo de dirección
queda vacío y se anuncia qué hacer; y «Listo, guardamos…» no se ve, pero el lector de pantalla sigue
recibiendo la confirmación.
**DoD:** spec del selector (3 niveles); capturas en el editor médico, el editor paciente y dos altas;
specs/E2E de los `data-testid` actualizados.
**Estado:** EN CURSO

#### H5.S1 — El selector emite al tocar el mapa

**CA:** Dado `app-ubicacion-picker`, cuando se fija un punto tocando el mapa, entonces emite un evento
que el padre puede escuchar; usar la ubicación del navegador o quitar el punto no lo emiten (o sí, y está
decidido y escrito).
**DoD:** spec con los tres niveles; comentario de cabecera actualizado.
**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Estado |
|---|---|---|---|---|
| H5.S1.M1 | `output` nuevo (nombre coherente con `confirmado`; p. ej. «`puntoElegido`») emitido en `fijarPunto` (`ubicacion-picker.ts:331-345`) | Emite con el punto | spec | HECHO |
| H5.S1.M2 | Decidir y escribir si «Usar mi ubicación» y «mover el pin» también emiten (el texto del doctor dice «toca una dirección en el mapa») | Decisión en el comentario | `grep -n 'D-06' ubicacion-picker.ts` | HECHO |
| H5.S1.M3 | Spec de tres niveles: correcto (toque emite), límite (toque sobre el pin existente), inválido (sin mapa abierto no emite) | Verde | `npx ng test --include=src/app/features/auth/registro-compartido/ubicacion-picker/*.spec.ts --watch=false` | HECHO |

#### H5.S2 — Aplicación en tus formularios

**CA:** Dado cada formulario tuyo con mapa, cuando se toca el mapa, entonces «Dirección» queda vacía y
un texto junto al campo dice «Volvé a escribir la dirección para este punto».
**DoD:** ocho instancias observadas o declaradas; capturas de cuatro.
**Estado:** EN CURSO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Estado |
|---|---|---|---|---|
| H5.S2.M1 | Editor médico → Contacto: vaciar `direccion` al evento y anunciar | Observado | captura | TODO |
| H5.S2.M2 | Editor paciente (`patient-profile-edit.html`) | Observado | captura | HECHO |
| H5.S2.M3 | `register-patient.html`: las **dos copias en línea** (domicilio y trabajo) vacían su campo en `fijarPunto` equivalente | Observado | captura | HECHO |
| H5.S2.M4 | Las otras cuatro altas que montan `app-ubicacion-picker` (`register-practitioner`, `register-organization`, `register-laboratory`, `register-imaging-center`) | Observado o declarado `A MEDIAS` con cuáles faltan | capturas o nota | A MEDIAS |
| H5.S2.M5 | Spec de al menos dos padres (editor médico y alta de paciente) | Verde | comando de spec | A MEDIAS |
| H5.S2.M6 | **No prevista (00 §3.3, agregada 24/09 por la segunda pasada de capturas, regla 35):** en las altas con dirección obligatoria (aseguradora, central de laboratorio y de imagenología), el campo que el mapa vacía se pone en rojo al instante y sigue en rojo tras confirmar el punto (H5-01); en la aseguradora el aviso queda a ~200 px del campo, con «Nombre comercial» en medio (H5-02). Esas tres pantallas quedaron `RECHAZADA` | Dado un alta con dirección obligatoria, cuando se toca el mapa, entonces el campo vacío no se marca en error hasta que la persona lo toque o intente avanzar, y el aviso se lee junto al campo | Decisión de producto primero (Itzan; el #606 lo dejó como observación 1). Después: spec de cada alta + captura mirada dos veces · **Decidido por Itzan (24/09):** el campo que vacía el mapa no se pone en rojo hasta que la persona lo toque o intente avanzar, y en la aseguradora el aviso pasa a estar junto al campo. Cómo: el vaciado deja el campo como no tocado (el error del formulario por páginas sólo sale con el campo tocado, `mensaje-de-error.ts:30`; tocarlo o pulsar «Siguiente» lo marca, `paginated-form.ts:648`), y en la aseguradora el mapa pasa a ir inmediatamente después de «Dirección», que es como ya están la central de laboratorio y la de imagenología. Verificación: spec de cada alta (rojo antes del arreglo, verde después) + `node playwright/mapa-vacia-direccion.mjs <url> corregida aseguradora,laboratorio,imagenologia` + segunda pasada de las capturas · **24/09:** specs nuevos en rojo sin el arreglo (4 en las tres altas, `evidencia/h5/specs-h5s2m6-rojo-sin-arreglo.txt`; 3 en la aseguradora con el caso de varias zonas, `specs-h5s2m6-rojo-multizona.txt`) y en verde con él, 114/114 (`specs-h5s2m6-verde.txt`) · navegador 85/85 en 1440 claro, 390 claro y 1440 oscuro, y 23/23 de la aseguradora en 1920, 1024 y 768 (`navegador-h5s2m6-*.txt`), consola y red limpias · 72 capturas con la primera pasada (`docs/frontend/evidence/mapa-vacia-direccion-2026-09-23/README.md`) · segunda pasada en tres rondas (6 a 8 de `evidencia/doble-revision.md`): H5-01 y H5-02 `CERRADO`, las tres altas `ACEPTABLE CON RESERVAS` · lint, tipos y tipos de Cypress 0 sobre el árbol final (`cierre-h5s2m6-*.txt`) | HECHO |

#### H5.S3 — «Listo, guardamos…» (D-07)

**CA:** Dadas las tres apariciones, cuando se confirma la dirección, entonces no se ve el texto, el lector
recibe la confirmación por una región sólo para lectores, y specs y barrido siguen en verde.
**DoD:** `git grep 'Listo, guardamos'` sin plantillas; specs/E2E actualizados.
**Estado:** EN CURSO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Estado |
|---|---|---|---|---|
| H5.S3.M1 | Medir quién usa los `data-testid` `ids().confirmada`, `registro-direccion-confirmada`, `registration-work-location-confirmed` | Lista | `git grep -n -E 'direccion-confirmada\|location-confirmed\|confirmada' origin/mockup -- 'src/**/*.spec.ts' 'playwright/**' 'cypress/**'` | HECHO |
| H5.S3.M2 | Quitar el texto visible en las tres, conservando `appAnuncio` en un `<p class="solo-lectores">` con la confirmación | Texto no visible; anuncio presente | `git grep -c 'Listo, guardamos' -- src/app` → 0 en `.html` visible | HECHO |
| H5.S3.M3 | Actualizar los specs/E2E de M1 sin debilitar lo que comprueban (que la confirmación ocurrió) | Verde | comandos de spec + barrido | HECHO |

### H6 — D-05 en tus archivos

**Prioridad:** `MEDIA`

**CA:** Dado cada `iconOnly` de tus diez archivos (37), cuando se lo mira, entonces tiene texto o la
excepción del ADR-0012 §3 escrita al lado con `aria-label` y `appTooltip`.
**DoD:** 37 veredictos aplicados; specs; capturas.
**Estado:** TODO

#### H6.S1 — Veredicto y aplicación

**CA:** Dada la tabla de Pablo (H5) filtrada por tus archivos, cuando se la lee, entonces cada fila está aplicada.
**DoD:** las 5 microtareas en `HECHO`.
**Estado:** TODO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Estado |
|---|---|---|---|---|
| H6.S1.M1 | Tus 37: `register-patient` 8, `paginated-form` 7, `date-picker` 7, `back-link` 4, `ubicacion-picker` 3, `register-practitioner` 3, `practitioner-profile-edit` 2, `practitioner-profile-view` 1, `patient-profile-edit` 1, `my-profile` 1 — veredicto por fila | 37 filas | `evidencia/h6/iconos.md` · **tramo configurar-tu-perfil: 31/31 con veredicto.** El 23/09 eran 23 excepciones y 8 a texto; el 24/09 la segunda pasada de capturas movió a texto los nueve botones que quitan la ubicación de un mapa (H6-02): **14 excepciones y 17 a texto**. Faltan las 6 de la rama núcleo | A MEDIAS |
| H6.S1.M2 | Convertir los que no son excepción (texto + ícono) | Cero sin veredicto aplicado | `git grep -n iconOnly -- <tus archivos>` con motivo al lado · **tramo configurar-tu-perfil hecho**: «Editar» (`07cc1ac1`), el calendario (`4ee3cfc4`) y, el 24/09, los botones del mapa (H6.S1.M8). `iconOnly` en 0 en `my-profile.html`, `date-picker.html` y `ubicacion-picker.html`; en `register-patient.html` quedan la navegación del formulario y «Quitar el nombre», que son excepción (`evidencia/h6/grep-iconOnly-con-motivo.txt`). Specs 234/234 (`evidencia/h6/specs-h6-m7-m8.txt`). Falta el tramo núcleo | A MEDIAS |
| H6.S1.M3 | Escribir la excepción al lado de los que sí lo son (cerrar, quitar, siguiente paso) con `aria-label` + `appTooltip` | Cada excepción con motivo y fecha | idem · **tramo configurar-tu-perfil hecho** (`0528499e`): cada una de las 14 excepciones con su línea «Excepción ADR-0012 §3 (D-05, 23/09)» arriba (`evidencia/h6/grep-iconOnly-con-motivo.txt`); los nueve botones del mapa ya no son excepción y su línea dice por qué (H6.S1.M8). Falta el tramo núcleo | A MEDIAS |
| H6.S1.M4 | `paginated-form` (52 consumidores): **sin cambio de comportamiento**; probar 5 consumidores ajenos si tocaste su plantilla | 5 capturas comparadas | `evidencia/h6/` · se tocó con dos comentarios: `node playwright/d05-iconos.mjs antes` (en la rama del #606) y `despues` · **23/09 23:58: botonera idéntica en 6 pantallas** (5 ajenas: alta de profesional, organización, laboratorio, centro de imagen y vitrina; más el alta del paciente) y 0 comentarios de la justificación en el DOM, 12/12 · **24/09, rebasada sobre `mockup` `b11dfdd3`: otra vez 12/12** (`evidencia/h6/pasada-despues.txt`). Desvío: se compara el DOM normalizado y ya hidratado, no capturas (más estricto). `docs/frontend/evidence/d05-iconos-2026-09-23/dom-formulario-por-paginas-{antes,despues}.json` | HECHO |
| H6.S1.M5 | Specs y capturas | Verde; miradas | comandos · 23/09: specs 331/331 + date-picker 49/49 (`evidencia/h6/specs-h6.txt`, `spec-date-picker-m6.txt`). **24/09, sobre el árbol final:** specs de los cuatro archivos tocados por las correcciones 234/234 (`specs-h6-m7-m8.txt`); `node playwright/d05-iconos.mjs antes` → 3/3 y `despues` → **216/216**, consola y red limpias (`pasada-{antes,despues}.txt`); 29 capturas de referencia y 39 del cambio, con la primera pasada en `docs/frontend/evidence/d05-iconos-2026-09-23/README.md` y la segunda en `evidencia/doble-revision.md`: todas las pantallas de H6 `ACEPTABLE CON RESERVAS`, sin `MAYOR` del cambio | HECHO |
| H6.S1.M6 | (Nueva, 23/09) A 375 px las flechas de «siguiente» del calendario caen a un tercer renglón pegadas a la izquierda, debajo de las de «anterior» | Dado el calendario a cualquier ancho, cuando se lo abre, entonces las flechas de «anterior» quedan en la mitad izquierda del panel y las de «siguiente» en la derecha, en el mismo orden de teclado | `node playwright/d05-iconos.mjs despues` con la comprobación de mitades · `date-picker.spec.ts` en verde · 23/09: regla `.nav-controls + .nav-controls { margin-inline-start: auto }`, hoy en `f848809a`. **24/09:** mitades en verde en las ocho celdas y en la vitrina (`evidencia/h6/pasada-despues.txt`, 216/216); date-picker en verde dentro de 234/234. Con H6.S1.M7 las cuatro flechas ya entran en un renglón, y esta regla queda para anchos por debajo de los medidos | HECHO |
| H6.S1.M7 | **No prevista (00 §3.3, agregada 24/09 por la segunda pasada de capturas, regla 35, H6-01):** con nombre, los dos grupos de flechas del mes no entran en un renglón por debajo de ~390 px y el panel crece en escalera (a 360 el encabezado pasa de 112 a ~199 px). La pantalla quedó `RECHAZADA` | Dado el calendario abierto entre 360 y 1920 px (CA corregido el 24/09: decía 320, que no se midió), cuando se lo mira, entonces las cuatro flechas del mes van en un solo renglón, «anterior» a la izquierda y «siguiente» a la derecha | `node playwright/d05-iconos.mjs despues` con la comprobación «las cuatro flechas en un renglón» en todas las celdas (360 incluida) · `date-picker.spec.ts` en verde · captura de 360 mirada dos veces · **24/09: `.nav-controls > [app-button] { padding-inline: var(--sp-2) }` en `date-picker.css`; «un renglón» en verde en las ocho celdas y en la vitrina (`evidencia/h6/pasada-despues.txt`, 216/216); date-picker en verde dentro de 234/234; `despues-calendario-dias-360-claro.png` mirada en las dos pasadas: H6-01 `CERRADO`** | HECHO |
| H6.S1.M8 | **No prevista (00 §3.3, agregada 24/09 por la segunda pasada, H6-02):** el botón de quitar la ubicación del mapa (`ubicacion-picker.html`, tres estados) se había declarado excepción «quitar un elemento», pero no hay lista y el aro con un menos queda junto al «−» del zoom del mapa (`organisms/map/map.css:164`): se lee como «alejar». Pasa a ícono + «Quitar la ubicación», con el `aria-label` completo. **Ampliada el 24/09 (segunda pasada repetida, H6-02, H6-11 y H6-12):** el alta del paciente tiene su propia copia del mapa con seis botones iguales (`register-patient.html`), que siguen el mismo veredicto; «Quitar» a secas pasa a «Quitar la ubicación», que es el comienzo del nombre accesible; y con el mapa abierto y sin punto el botón sólo cierra el mapa, así que ahí dice «Cerrar el mapa» | Dado un mapa de dirección abierto, cuando se lo mira, entonces con punto el botón dice «Quitar la ubicación» y sin punto «Cerrar el mapa», con su ícono y sin ser de sólo ícono (CA corregido el 24/09 por H6-12: decía «Quitar la ubicación» en los tres estados) | specs de `ubicacion-picker` y `register-patient` en verde · `git grep -n iconOnly` → 0 en `ubicacion-picker.html` y sólo la navegación y «Quitar el nombre» en `register-patient.html` · capturas de los estados del mapa en el editor y en el alta, miradas dos veces · **24/09: specs 234/234 (`evidencia/h6/specs-h6-m7-m8.txt`); `evidencia/h6/grep-iconOnly-con-motivo.txt`; el guion comprueba texto, ícono y nombre en seis estados × 2 viewports (216/216); segunda pasada: H6-02, H6-11 y H6-12 `CERRADO`, pantallas del mapa `ACEPTABLE CON RESERVAS` (queda H6-13, `MENOR`: en el mapa compartido, «Cerrar el mapa» no dice de qué mapa)** | HECHO |
| H6.S1.M9 | **No prevista (00 §3.3, agregada 24/09 por la segunda pasada, H6-E1):** el calendario lo montan 22 plantillas y la evidencia mostraba una sola, en modo fecha. Falta verlo en otro consumidor y en modo fecha y hora | Dado el calendario en un consumidor distinto del editor del paciente y en modo fecha y hora, cuando se lo abre, entonces las flechas y «Cerrar» se ven con nombre, en un renglón y sin desborde | captura de cada uno en 1440 y 390, mirada dos veces, en `docs/frontend/evidence/d05-iconos-2026-09-23/` · **24/09: la vitrina en modo fecha y hora, en 1440, 390 y 360: «Cerrar», flechas con nombre en un renglón y sin desborde, en verde (`pasada-despues.txt`); miradas en las dos pasadas. H6-E1 bajó a `MENOR` (falta el calendario dentro de otro diálogo, declarado en «No cubierto»)** | HECHO |
| H6.S1.M10 | **No prevista (00 §3.3, agregada 24/09, regla 35.2):** entregar el PR de H6 mergeable | Dado el PR de H6, cuando se lo consulta, entonces `mergeable` es `MERGEABLE`, no es draft, `mergeStateStatus` es `CLEAN` (o `BLOCKED` sólo por la revisión humana) y ningún check falla | `gh pr view <n> --json number,url,isDraft,mergeable,mergeStateStatus,reviewDecision,baseRefName,headRefName` + `gh pr checks <n>` → `evidencia/pr-<n>-mergeable.txt` · **24/09: [PR #613](https://github.com/mdavila-2001/mantra-core-health/pull/613) contra `mockup`: `MERGEABLE`, sin draft, pero `UNSTABLE`: sus tres checks (`verificar`, `dependencias`, `e2e`) están pendientes, sin fallar. Todas las corridas del CI del repo, de cualquier rama y también de `dev`, siguen en «queued» sin arrancar: clase `EXTERNAL`. Los pasos del CI se corrieron a mano sobre el árbol final (`evidencia/h6/cierre-*`). Lo destraba que el CI vuelva a tener quién lo ejecute; después, volver a consultar** · **24/09 15:27 UTC: Pablo lo fusionó como squash `04fd526c` de la punta `c36afcb4`, con la corrida del CI todavía en cola. No llegó a `CLEAN`: ningún check falló, pero ninguno corrió. Cuando corra, `verificar` va a caer en «Lint» por 246 errores que `mockup` ya tenía antes del #613 (`evidencia/lint-con-el-lock.txt`). Sección «Fusión» de `evidencia/pr-613-mergeable.txt`** | A MEDIAS |

### H7 — «Mis puntos» como quinta pestaña del paciente (N-03)

**Prioridad:** `MEDIA`

**CA:** Dado `/my-account` con `paciente@alovida.mock`, cuando se abre, entonces hay cinco pestañas y
«Mis puntos» muestra la billetera sin cabecera duplicada; `/my-account/loyalty` sigue llegando (Ender).
**DoD:** spec de pestañas; captura; pedido a Ender anotado en los dos dailies.
**Estado:** TODO

#### H7.S1 — La pestaña

**CA:** Dada la ficha del paciente, cuando se elige «Mis puntos», entonces se ve el saldo, canjear y el
comprobante como hoy, dentro de la tarjeta.
**DoD:** las 5 microtareas en `HECHO`.
**Estado:** TODO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Estado |
|---|---|---|---|---|
| H7.S1.M1 | `Loyalty` gana un input (p. ej. `embebido`) que omite `app-page-header` y breadcrumbs; por omisión, como hoy | La ruta propia no cambia | spec | HECHO |
| H7.S1.M2 | `PESTANAS_DEL_PERFIL` gana «Mis puntos» (índice 4) y `PESTANA.puntos`; la ficha monta `<app-loyalty embebido />` en la quinta pestaña; el editor **no** la necesita (decidir y anotar si la muestra deshabilitada o no la muestra). **Decisión 23/09:** el editor la muestra **deshabilitada** — la constante compartida existe para que las posiciones no cambien entre lectura y edición (`pestanas-del-perfil.ts:4-11`), y `app-tabs` ya cae a la primera habilitada cuando la elegida está apagada (`tabs.ts:72-84`) | Cinco pestañas en la ficha | captura · **24/09, ronda 1 de la segunda pasada: `RECHAZADA`** por H7-01 («Mis puntos» del menú lateral llevaba a la pantalla aparte). **Recapturada (H7.S1.M7):** en `mockup` ese renglón ya no está en el menú (`navigation.map.ts:1363`), así que H7-01 no ocurre; la ficha, la pestaña elegida con un clic y el editor quedaron `ACEPTABLE CON RESERVAS` en las rondas 2 a 4 (sólo `MENOR`) · `evidencia/h7/navegador-recaptura.txt` 61/61 · `evidencia/doble-revision.md` | HECHO |
| H7.S1.M3 | Pedir a Ender por el daily: retirar el renglón «Mis puntos» del menú y redirigir `/my-account/loyalty` → `/my-account?pestana=puntos` (o el mecanismo que tenga `my-profile` para abrir una pestaña por URL). **23/09:** anotado en el daily de Itzan (§6 y §7, con el mecanismo `?pestana=puntos`); el daily de Ender es su archivo y su PR — ya trae la fila que espera este pedido (su §6) y su H4.S2.M2 lo contempla; escribir ahí lo decide Itzan. **Decisión de Itzan 23/09:** el pedido va como `.md` aparte que él le entrega a Ender; el daily de Ender lo completa Ender con ese insumo | Pedido anotado en los dos dailies | daily | HECHO |
| H7.S1.M4 | Spec de pestañas del paciente y de la ficha | Verde | `npx ng test --include=src/app/features/account/my-profile/my-profile.spec.ts --watch=false` | HECHO |
| H7.S1.M5 | Captura ×2 viewports ×2 temas | Miradas | `docs/frontend/evidence/mis-puntos-quinta-pestana-2026-09-23/` · **24/09, ronda 1 de la segunda pasada:** `despues-editor-1440-claro.png` salió con la barra lateral a mitad de su animación y la primera pasada la dio por buena (H7-04); faltaban 390, 1024 y 1920. **Rehecha en H7.S1.M7:** 24 capturas en los cinco viewports del repo y los dos temas, miradas en las dos pasadas; la barra sale entera en todas | HECHO |
| H7.S1.M7 | **No prevista (00 §3.3, agregada 24/09):** volver a capturar la ficha y el editor con «Mis puntos» sin animación a mitad de foto, en los cinco viewports del repo, y pasar las dos revisiones sobre las capturas nuevas | Dado el editor y la pestaña, cuando se capturan, entonces la barra lateral está quieta y entera en cada celda | `node playwright/mis-puntos-quinta-pestana.mjs <url de la app> despues` + `evidencia/doble-revision.md` · **24/09: 61/61, consola y red limpias (`evidencia/h7/navegador-recaptura.txt`); 24 capturas sin `fullPage` (se agranda la ventana y se espera a que no quede ninguna animación con fin), puntero fuera de la tira; primera pasada en el README y segunda pasada en tres rondas: H7-04 y H7R-E1 `CERRADO`** | HECHO |
| H7.S1.M6 | **No prevista (00 §3.3, agregada 23/09):** la ficha abre la pestaña que nombra `?pestana=<clave de PESTANA>` al entrar; sin el parámetro o con una clave desconocida, la primera como hoy. Sin esto el redirect `/my-account/loyalty → /my-account?pestana=puntos` de H7.S1.M3 caería en «Datos personales»: `my-profile.ts` no lee la ruta (`rg ActivatedRoute` → 0) | Dado `/my-account?pestana=puntos` con paciente, la quinta pestaña está seleccionada; con `?pestana=zzz`, la primera | spec en `my-profile.spec.ts` · **24/09, segunda pasada: pantalla `RECHAZADA` (H7R-02, `MAYOR`)**: la pestaña sí queda seleccionada (también en el navegador, 1440 y 390), pero a 390 queda fuera de la parte visible de la tira, porque la tira sólo se corre cuando la persona elige (`shared/components/molecules/tabs/tabs.ts:88-95`). La molécula es compartida y no es de este carril | A MEDIAS |

### H8 — Regresión, gates y cierre

**Prioridad:** `ALTA`

**CA:** Dado el cierre, cuando alguien que no vio tu turno lee el reporte, entonces sabe qué quedó
demostrado, qué quedó a medias con las cuatro respuestas, qué se cerró contra un doble y qué no se cubrió.
**DoD:** baseline repetido y comparado, barrido con `--workers=1`, capturas miradas, teclado completo,
`REPORTE.md` escrito.
**Estado:** TODO

#### H8.S1 — Regresión

**CA:** Dado tu cambio, cuando corrés los comandos del baseline, entonces ningún rojo es nuevo; y las
pantallas que montan la insignia están comprobadas.
**DoD:** salidas comparadas.
**Estado:** TODO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Estado |
|---|---|---|---|---|
| H8.S1.M1 | `lint` y `typecheck` | Sin rojos nuevos | diff contra `evidencia/antes/` | TODO |
| H8.S1.M2 | `test` completo | Sin rojos nuevos | diff contra baseline | TODO |
| H8.S1.M3 | El simulador entero con cada cuenta | Nada lanza ni devuelve 500 | `npx ng test --include=src/app/core/mock/mock-backend.spec.ts --watch=false` | TODO |
| H8.S1.M4 | Barrido de pantallas, serial | Ninguna ruta rompe | `E2E_BASE_URL=<url de la app> npx playwright test playwright/mockup-barrido.spec.ts --workers=1` | TODO |
| H8.S1.M5 | Barrido de clics sobre `/my-account`, `/my-account/edit` y una alta | Sin excepciones ni 5xx | `… playwright/mockup-click-sweep.spec.ts --workers=1` | TODO |

#### H8.S2 — Cierre honesto

**CA:** Dado el reporte, cuando se lee la primera línea, entonces está el avance calculado; y ninguna
palabra es más fuerte que la evidencia.
**DoD:** `REPORTE.md` con sus tres secciones y el avance arriba; peldaño por área; «contra el doble» declarado.
**Estado:** TODO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Estado |
|---|---|---|---|---|
| H8.S2.M1 | Capturas finales por viewport y tema, miradas | Con su línea | `evidencia/h8/` | TODO |
| H8.S2.M2 | Teclado completo en los tres modales: abrir, recorrer, adjuntar, guardar, confirmar, volver al disparador | Descripción por paso | `evidencia/h8/teclado.md` | TODO |
| H8.S2.M3 | Declarar qué quedó `VERIFIED` **contra el doble** (todo lo que edita o retira en el simulador) y la brecha para `dev` (HALL-E3, E7) | Lista | sección «Contra el doble» en `REPORTE.md` | TODO |
| H8.S2.M4 | Declarar el peldaño por área (regla 30) | Hay peldaño por área | sección en `REPORTE.md` | TODO |
| H8.S2.M5 | Escribir `REPORTE.md` con el avance primero y enumerar procesos que quedaron corriendo | `head -3` muestra el avance; lista o «ninguno» | `head -3 REPORTE.md` | TODO |


## Riesgos y bloqueos previstos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| `specialty-badge`/`specialty-badge-grid` los montan ficha, directorio y perfil público | quitar el tono «principal» cambia tres pantallas | H2.S2.M8 captura las cuatro pantallas |
| `pestanas-del-perfil-medico.spec.ts` falla si un campo del alta queda sin pestaña | D-03 y D-01 sacan cuatro campos | `CAMPOS_DEL_ALTA_SIN_PESTANA` con motivo; el spec no se toca |
| `paginated-form` tiene 52 consumidores | D-05 ahí puede romper ajenos | sólo texto o excepción; muestra de 5 consumidores (H6.S1.M4) |
| El editor médico lo tocan H2, H3, H4, la primera microtarea de H5.S2 y H6 | conflictos entre ramas | las dos microtareas del mapa que tocan el editor médico y el alta del médico (H5.S2, primera y cuarta) se hacen después de que H2 esté en el remoto; quien fusiona segundo rebasa |
| Pablo (paginador, barra, historial-tabla) o Marcelo (confirmación) no publican a tiempo | H3/H4 dependen | regla 65: montar lo que existe (`app-pagination`, `dialogs.confirm`) y declarar contra qué se cerró |
| La maqueta no tiene backend para editar/retirar credenciales (HALL-E3) | nada persiste fuera del simulador | cerrar `VERIFIED` contra el doble, declarado (H8.S2.M3) |
| CI del front sin runners | ningún verde remoto | baseline y regresión local con salidas pegadas |

## Ambigüedades registradas

| ID | Ambigüedad | Supuesto con el que trabajás | Quién puede resolverla | Qué bloquea |
|---|---|---|---|---|
| Q-1 | «todas por igual»: ¿sólo la UI, o también el alta y el contrato? | UI y alta sí; contrato `isPrimary` no se toca; deuda anotada | Doctor + Pablo | H2.S2.M5-M7 |
| Q-2 | «Estado de la práctica quitar»: ¿la fila o el dato? | La fila; el dato sigue en el contrato | Doctor | H2.S1.M3 |
| Q-3 | «ni correo de trabajo, ni teléfono ni nada»: ¿lo del trabajo, o toda la pestaña? ¿Dónde queda el correo de acceso? | Lo del trabajo; el correo de acceso en Datos personales, sólo lectura. **24/09:** Itzan adoptó el #645: el correo de trabajo se corrige en «Contacto» y D-03 queda para los teléfonos | Doctor | H2.S3.M4 |
| Q-4 | «ponerse en blanco»: ¿vaciar el campo, o «estado limpio»? | Vaciar, con anuncio junto al campo; si era la otra lectura, es una línea | Doctor | H5.S2 |
| Q-8 | «el ID de la institución»: ¿id de catálogo o número del diploma? | La institución del catálogo con su código visible; «Número / título» se conserva | Doctor | H3.S1.M3 |
| Q-9 | Adjunto en especialidades sin `file_id` en el contrato | **Decidida (a)** por Itzan el 23/09: vínculo a un título verificado (`supportingCredentialId`), sólo en el alta | Pablo (contrato) + doctor | H4.S1 |
| Q-17 | La ruta `/my-account/loyalty` y el renglón del menú | Se conservan y Ender redirige/retira; vos montás la pestaña | Pablo, Ender | H7.S1.M3 |
| Q-20 | «lugares donde trabajé» en la pestaña del editor | Como tabla (Pablo la publica); la línea de tiempo queda en la ficha | Doctor | H3.S3 |
| Q-I1 | ¿«Guardar cambios» debe habilitarse por cambios aunque el formulario sea inválido? | No: por cambios **y** válido; ambos se muestran (botón deshabilitado + error por campo) | Doctor | H3.S2.M3 |
| Q-I2 | ¿Qué pasa con el archivo viejo al reemplazar el diploma en el simulador? | Se reemplaza el `fileId`; el viejo no se borra del store simulado; anotado | Pablo | H3.S2.M2 |
| Q-I3 | H2.S3.M5 pide que el spec de pestañas «pase sin tocarlo», pero `pestanas-del-perfil-medico.spec.ts:64` fija el conjunto **exacto** de ausencias (`['password','sexAtBirth']`): sumar `workMobilePhone`, `workLandline` y `email` lo pone rojo sí o sí | Se actualiza el conjunto esperado de L64 a las cinco claves y se agregan, como en L65-66, aserciones del motivo de las tres nuevas (D-03). No lo debilita: es la fricción que pide su propio comentario (L54-60: «sumar un campo acá exige tocar esta prueba y escribir el motivo»). Desvío anotado en `REPORTE.md` | Pablo | H2.S3.M5 |
| Q-I6 | H2.S2.M5: al retirar el select «Especialidad principal», ¿`specialtyPrimary` desaparece del alta o sobrevive sin pantalla? Hoy alimenta `especialidadesElegidas()` (`register-practitioner.ts:2454`), cuya **primera** el backend guarda como principal | Desaparece: la clave sale del alta y de `CAMPO_DEL_ALTA_EN_PESTANA` (`pestanas-del-perfil-medico.ts:226`); el spec mira las dos direcciones (L68-80) y no hace falta tocarlo. Efecto que se declara: la primera especialidad agregada pasa a ser la principal para el backend, sin que nadie la elija (coherente con Q-1: el contrato `isPrimary` no se toca). Si el control tuviera que sobrevivir, va a `CAMPOS_DEL_ALTA_SIN_PESTANA` con motivo y L64 cambia como en Q-I3 | Pablo | H2.S2.M5 |
| Q-I7 | D-02: además de la fila de Datos personales, el mismo dato se lee sin rótulo en el **pie del sello** de la portada (`practitioner-profile-view.html:799`, «Verificado · En ejercicio»), en la ficha y en el detalle de la guía | Se quita sólo la fila (el encargo dice «D-02 — una fila» y su prueba de cierre busca el rótulo); el pie del sello queda. Si el doctor lo quiere fuera también, es una línea | Doctor | nada (H2.S1 se cierra con la fila) |
| Q-I8 | H3.S1.M4 pide confirmar al agregar un título, pero la regla 2 del ADR-0015 exime el alta de confirmación (y en `work-history` se confirma al agregar un vínculo, `work-history.ts:727`, pero no una sede, L1240-1244) | Se confirma al agregar porque lo pide este encargo, que es más específico que el ADR; lo mismo en especialidades y matrículas por la «misma disciplina» de H4 | Pablo | nada |
| Q-I9 | El `maxHeight` de `data-table` pliega las columnas secundarias al detalle también en escritorio (`data-table.css:293`), y D-09 y Q-8 quieren la institución y la emisión visibles en la fila de títulos | Se mide con los datos reales; si esas columnas dejan de verse en la fila, no se activa el alto máximo en esa tabla y se declara · **medido el 24/09: hoy el alto máximo no pliega nada en escritorio.** La regla `.data-table--constrained .data-table__secondary` (`data-table.css:293-303`) compila con el atributo de contenido del componente, y la clase la lleva el host, que tiene el de host: nunca aplica. Con `maxHeight` real, el historial conserva visibles sus 4 celdas secundarias a 1440 (`evidencia/h4/constrained-1440.txt`), y los títulos, sus seis columnas (`anchos-h4s3.txt`). Se activó en las tres tablas; si ese selector se corrige, Institución y Emisión de los títulos pasarían al detalle en escritorio y esto se revisa | Pablo | H4.S3.M4 |
| Q-I10 | El historial en modo tabla adjunta un archivo al vínculo, pero el contrato de afiliaciones no tiene archivo (ni el cliente ni la API); hoy el vínculo vive en memoria y se pierde al recargar | **Decidido por Itzan (24/09): (a)**, se quita el adjunto hasta que el contrato lo tenga. Antes se verificó que no hay dónde guardarlo en ninguna capa: `profiles.practitioner_affiliations` no tiene columna de archivo (`SQL/05_profiles/02_tables.sql:210-229` del modelo), ni el DTO ni la entidad de la API (`src/modules/profiles/dto/affiliation.dto.ts`, `entities/practitioner_affiliations.entity.ts`), y el vínculo genérico `common.file_links` sólo acepta como dueño `USER`, `PATIENT`, `TENANT`, `CONDITION` o `PROCEDURE` (`src/modules/common/dto/enums.ts:8-16`). Para que vuelva, la API tendría que sumar un dueño de tipo afiliación a `file_links` o un `file_id` a la tabla | Itzan + Pablo (contrato) | nada (H3.S4.M5 se cierra con la quita) |
| Q-I11 | D-05: las flechas «Atrás»/«Siguiente» del formulario por páginas, que encienden las altas (`[iconOnlyNav]="true"`), ¿siguen como excepción? Q-19 dice que «el paginador deja de ser excepción», pero nombra al paginador de listas (`molecules/pagination`, de Pablo) | Siguen como excepción del ADR-0012 §3 (pasar de página), con su justificación escrita al lado. Tienen `aria-label` y globo, y la última página nunca es ícono. Si el doctor las quiere con texto, alcanza con quitar `[iconOnlyNav]` en cada alta: el texto es el modo por defecto del motor | Doctor + Pablo | nada (H6.S1.M3 se cierra con la excepción escrita) |
| Q-I12 | D-05 en el calendario: sus flechas y su «Cerrar» son de significado universal, pero la excepción exige un globo **visible**, y el globo se cuelga del `<body>` (`tooltip.ts:131`) mientras el calendario es un `<dialog>` modal (`date-picker.ts:521`): queda debajo | Pasan a ícono + texto (§1 del ADR); la navegación del calendario ocupa dos renglones (el mes arriba y las flechas abajo). Si el átomo del globo llega a funcionar dentro de un modal, podrían volver a la excepción | Pablo (dueño del ADR y del patrón) | nada (H6.S1.M2 se cierra con el texto) |
