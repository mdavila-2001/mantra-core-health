# Reporte — Video de la aseguradora con registro, subida de documentos y login de Alianza

- **Fecha:** 2026-10-07
- **Plan:** [PLAN.md](./PLAN.md)
- **Ramas:** `marcelo/video-registro-login-alianza-mockup` (el trabajo, PR #982) y `marcelo/video-registro-login-reporte-final` (este cierre del reporte). Las dos se crearon con `--no-track` desde `origin/mockup`, tras `git pull origin mockup`.
- **Peldaño de evidencia alcanzado:** **VERIFIED**. El video y las capturas salen de una corrida real contra el app de `mockup`, con doble revisión. No se corrió la suite de tests (ver «No cubierto»).
- **Avance:** 12 de 12 microtareas HECHO (100 %). Fuera de las microtareas queda un punto BLOQUEADO: los checks de CI del PR #982 nunca arrancaron (ver «Pendiente»).

## Completado

| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.S1.M1 | Datos del alta de Alianza: empresa, NIT, dirección, representante legal, tres gerencias y administrador, todos ficticios y con correos `@mail.com` | `node tools/video-aseguradora/grabar.mjs` | `datos-alta.mjs` importado por el script sin errores |
| H1.S1.M2 | Seis PDF ficticios generados en memoria, válidos y con peso creíble | `node -e` sobre `pdfDeEjemplo` | cabecera `%PDF-` y cierre `%%EOF`; 101 a 432 KB |
| H1.S2.M1 | Del login a «Registrá tu organización» y pasos 1 y 2 del alta | corrida completa | capturas `02` y `03` |
| H1.S2.M2 | Pasos 3 y 4: cinco documentos subidos por la zona de arrastre real | ídem | capturas `04` y `05`, cada uno con su peso y su marca |
| H1.S2.M3 | Pasos 5 a 8: representante legal con poder, tres gerencias y cuenta del administrador | ídem | capturas `06` a `09` |
| H1.S2.M4 | «Crear cuenta» → «Tu cuenta está lista» → «Ir a iniciar sesión» → login con lo registrado → «Mi perfil» por clic, sin recargar | ídem | capturas `10` a `12`; «Mi perfil» muestra NIT `1020347028`, sigla y código `ALIANZA` |
| H1.S2.M5 | El recorrido que ya existía sigue igual, con sus marcas | ídem | `marcas.json` con los cinco pasos y las dos decisiones |
| H1.S3.M1 | Video regenerado | `ffprobe` | h264 · 1920×1080 · 188,56 s; salida 0 y controles limpios |
| H1.S3.M2 | Doble revisión | [evidencia/doble-revision.md](./evidencia/doble-revision.md) | ninguna pantalla RECHAZADA |
| H1.S3.M3 | README actualizado | — | secciones «El alta y el login» y limitaciones nuevas |
| H1.S3.M4 | Commit, push de la rama y PR #982 a `mockup`, fuera de draft. El usuario lo mergeó | `git log -1` · `gh pr view 982` | commit `a743a417` con trailer; PR `MERGED` en `60ba66c9` (2026-10-07 17:44:48 UTC); antes del merge era mergeable y no draft |
| H1.S3.M5 | Este reporte | — | en disco |

## A medias

Ninguna. H1.S3.M4 estaba aquí y se cerró (ver «Completado»).

## Pendiente

| ID | Estado | Qué lo destraba |
|---|---|---|
| Checks de CI del PR #982 (`dependencias`, `e2e`, `verificar`) | BLOQUEADO | Que el CI de GitHub vuelva a ejecutar: los tres jobs siguen `queued` desde las 17:40 UTC y la ejecución del PR #977 también, desde las 17:15. Causa ajena a este trabajo; el PR se mergeó sin que los checks corrieran |
| Revert o no de `dceaff41` y `c3a928a5` | Abierto desde el 2026-10-05 | Que el usuario diga si los commits que quedaron en `mockup` sin PR se dejan o se revierten. Con el merge de #982 encima, revertirlos es más enredado |

## Evidencia

```
$ node tools/video-aseguradora/grabar.mjs
Marcas (s): inicio-de-sesion=0.4 · registro-aseguradora=6.3 · documentos-legales=17.94 · representante-legal=32.78 · directorio-ejecutivo=42.97 · cuenta-del-dueno=58.13 · alta-confirmada=64.32 · login=68.44 · mi-perfil=84.6 · mis-productos=92.78 · solicitudes-recibidas=125.75 · aprobar=130.63 · rechazar=145.82 · siniestralidad-por-persona=167.12 · directorio=175.92 · fin=186.36
Controles: sin «Andina», sin dominios .mock, sin errores de página ni rutas sin manejador.
exit=0

$ ffprobe …mp4
codec_name=h264  width=1920  height=1080  duration=188.560000

$ npx eslint tools/video-aseguradora
eslint exit=0

$ node tools/video-aseguradora/grabar.mjs --hasta perfil   (8 corridas seguidas)
8 de 8 llegaron a «Mi perfil»; en una el primer clic se perdió y el reintento lo cubrió (registro a 15,6 s en vez de 6,4 s).
```

```
$ gh pr view 982 --json number,state,isDraft,mergeable,mergeStateStatus,mergedAt   (después del merge)
{"isDraft":false,"mergeStateStatus":"UNKNOWN","mergeable":"UNKNOWN","mergedAt":"2026-10-07T17:44:48Z","number":982,"state":"MERGED"}

$ gh pr view 982 --json …   (antes del merge, recién creado)
{"baseRefName":"mockup","headRefName":"marcelo/video-registro-login-alianza-mockup","isDraft":false,"mergeStateStatus":"UNSTABLE","mergeable":"MERGEABLE","number":982}

$ gh pr checks 982
dependencias  pending  0  …/actions/runs/37660899417/…
e2e           pending  0  …/actions/runs/37660899417/…
verificar     pending  0  …/actions/runs/37660899417/…

$ gh run view 37660899417 --json status,jobs
status: queued · los tres jobs: status "queued", conclusion "" (creados 17:40:30 UTC, sin arrancar a las 17:46 UTC)

$ git ls-remote origin mockup   (tras el push de la rama, antes del merge)
ec86d301…  mockup   (sin cambios: el push fue solo de la rama)
```

## No cubierto

- **Checks de CI del PR #982:** nunca se ejecutaron (jobs en cola), así que no hay evidencia de verde en CI. La verificación de este trabajo es la corrida local del script, `ffprobe` y `eslint`.
- **Suite de tests.** Este trabajo no toca código del app ni del simulador, solo `tools/video-aseguradora/` y documentación; no se corrió `yarn test`.
- **Barra de avance de la subida** (0,6 s simulados) y **errores de validación** del alta: no aparecen en el video.
- **Mapa de la casa matriz** (opcional) y país multizona.
- **Verificación del correo y aprobación de la organización:** el alta real deja la organización pendiente de aprobación; el video no lo muestra.
- **Tema oscuro y otros tamaños de ventana.**
- **`dev` y `test`:** no se tocaron ni se probaron; usan la API real y esto no aplica.

## Desvíos del plan

- Los datos del alta quedaron en un archivo nuevo, `tools/video-aseguradora/datos-alta.mjs`, y no dentro de `datos-alianza.mjs` como decía el plan: ese archivo ya tenía 477 líneas.
- Se agregó la opción `--hasta perfil` al script, para ensayar el alta sin grabar todo. No estaba en el plan.
- La primera grabación completa duró **11 min 21 s** y se descartó. Causa: con la grabación activa cada paso de `mouse.move` tarda unos 250 ms en estas pantallas. Se cambió a un solo movimiento real y un cursor dibujado que se desliza con una transición CSS. El alta con login pasó de 225 s a unos 84 s.
- Se agregó un reintento del primer clic (login → registro) y la espera a que Angular termine de arrancar. El clic se perdía a veces: la tarjeta del login se inclina con el mouse y el nodo puede reemplazarse entre apretar y soltar. No se tocó el app.
- Cambios de datos del video que afectan lo ya aprobado: la sigla pasó de `ASR` a `ALIANZA` y el NIT/registro de `APS-0015` a `1020347028`, para que «Mi perfil» coincida con lo escrito en el registro.

## Riesgos residuales

- El login con «la cuenta recién creada» funciona porque `buscarUsuario` del simulador resuelve `aseguradora@…` como la cuenta de prueba. Si alguien cambia esa regla del simulador, el login del video fallaría con 401.
- El primer clic del video puede perderse de forma intermitente; el reintento lo cubre y alarga el video unos 9 s en ese caso. Se nota en `marcas.json`: `registro-aseguradora` mayor que ~9 s.
- «Mi perfil» muestra el NIT también como «Registro ante el regulador», porque la pantalla usa el mismo campo para los dos.

## Decisiones y ambigüedades

- **«Maquetar la subida de archivos».** Supuesto tomado: la subida va por la pantalla real, con PDF ficticios generados en memoria y el handler simulado que ya existe. No se inventó una pantalla. **Confirmar con:** el usuario.
- **Login con la cuenta recién creada.** Supuesto: el administrador se registra como `aseguradora@mail.com` y entra con ese correo. **Confirmar con:** el usuario.
- **NIT y sigla.** Supuesto: un NIT numérico ficticio y la sigla `ALIANZA`. **Confirmar con:** el usuario.
- **Commits en `mockup` sin PR (2026-10-05).** Siguen abiertos; la rama de este trabajo nació desde ese `mockup` actualizado.
- **Merge sin checks de CI (2026-10-07).** El usuario mergeó el PR #982 mientras los checks seguían en cola. No se esperó a un verde que no iba a llegar mientras el CI siga detenido. **Confirmar con:** quien administre el CI de GitHub.
