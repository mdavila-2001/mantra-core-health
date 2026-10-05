# Reporte — Video demo del módulo aseguradora como Alianza Seguros (rama `mockup`)

- Fecha: 2026-10-05 · Plan: [PLAN.md](./PLAN.md) · Rama: `marcelo/video-aseguradora-alianza-mockup` → PR a `mockup`
- Peldaño de evidencia alcanzado: **VERIFIED**. El directorio en `mockup` y el video están verificados en el navegador, con la doble revisión hecha. La regresión completa corrió: tiene 4 rojos, ninguno introducido por este PR (ver Evidencia), y el CI del PR sigue en curso.
- Avance: 15 / 16 microtareas HECHO, 1 A MEDIAS (93,75 %).

## Completado

| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.S1.M1 | Se trajo de `dev` la pantalla del directorio de pacientes, con su ruta, su entrada de menú y sus métodos de cliente (`a635ad30`, `e14817ad`, `fea045a7`), sin los docs de ese trabajo ni el spec de `page.route` | `git diff --stat dev HEAD -- src/app/features/insurance/insurance-patients` | sin diferencias: el componente es idéntico al de `dev` |
| H1.S1.M2 | El port compila | `yarn typecheck` | salida 0 |
| H1.S1.M3 | Specs del port, la navegación, el shell y el cliente | `ng test --include …` (5 globs) | `Test Files 15 passed (15)` · `Tests 331 passed (331)` |
| H1.S2.M1–M3 | Handler simulado de `search`, `options` y `conversation` | `ng test --include insurer-patients.handlers.spec.ts` | `Tests 9 passed (9)` |
| H1.S2.M4 | Directorio en `mockup` puro, sin el script | script de Playwright (ver Evidencia) | «60 resultados encontrados», 25 filas, captura `h1-directorio-mockup-sin-script.png` |
| H2.S1.M1 | `datos-alianza.mjs` | `node -e import(...)` | 7 planes (ER 90/120/180/250 oficiales; Silver 380, Salud Mundial Plus 1250, AFI 65 referenciales) · 77 solicitudes · 21 personas · sin «Andina» ni `.mock` |
| H2.S1.M2–M3 | Siembra, capa de respuesta y recorrido continuo | `node tools/video-aseguradora/grabar.mjs` | salida 0 · «Controles: sin «Andina», sin dominios .mock, sin errores de página ni rutas sin manejador» |
| H2.S1.M4 | MP4 | `ffprobe` | h264 · 1920×1080 · 78,96 s |
| H2.S2.M1 | Doble revisión crítica | [evidencia/doble-revision.md](./evidencia/doble-revision.md) | ninguna pantalla RECHAZADA (2 APROBADA, 3 ACEPTABLE CON RESERVAS) |
| — | Lint del script y de los archivos tocados | `npx eslint tools/video-aseguradora` · `npx eslint <archivos del port y del handler>` | salida 0 · solo 2 errores, en `navigation-history.service.spec.ts`, que no se tocó |

## A medias

### H3.S1.M1 — PR a `mockup`
- **Qué anda:** la rama queda pusheada y el PR se abre fuera de draft.
- **Qué no anda:** al escribir este reporte todavía no hay salida de `gh pr checks`.
- **Qué falta exactamente:** confirmar después del push `mergeable`, `mergeStateStatus` y que los checks estén en verde.
- **Dónde quedó:** en el PR; el estado se pega en la conversación de entrega.

## Pendiente

| ID | Estado | Qué lo destraba |
|---|---|---|
| ninguno | — | — |

## Evidencia

```
$ yarn typecheck
exit=0

$ ng test --watch=false --include <insurance-patients, core/navigation, data-access/insurance, shell-layout, dashboard/access-tree>
 Test Files  15 passed (15)
      Tests  331 passed (331)

$ ng test --watch=false --include src/app/core/mock/handlers/insurer-patients.handlers.spec.ts
      Tests  9 passed (9)

# access-tree.spec ya estaba en rojo en mockup, ANTES de este trabajo (árbol de mockup restaurado):
 FAIL  access-tree.spec.ts > AccessTree > la aseguradora ve exactamente dos zonas: Chats, y las cuatro de seguros
      Tests  1 failed | 102 passed (103)

# directorio en mockup sin el script
contador: 60 resultados encontrados
filas: 25

$ node tools/video-aseguradora/grabar.mjs
Video: …\artifacts\video-aseguradora\alianza-aseguradora-1080p.mp4
Marcas (s): mi-perfil=0.4 · mis-productos=9.27 · solicitudes-recibidas=42.14 · siniestralidad-por-persona=56.93 · directorio=66.11 · fin=76.61
Controles: sin «Andina», sin dominios .mock, sin errores de página ni rutas sin manejador.

# regresión completa en la rama (evidencia/regresion-yarn-test.txt)
$ yarn test --watch=false
 Test Files  4 failed | 744 passed (748)
      Tests  4 failed | 10373 passed (10377)

# los mismos 4 specs, re-corridos en la rama y en mockup puro (evidencia/regresion-rojos-en-mockup-base.txt)
# rama:   Tests 3 failed | 56 passed (59)   (fichas-estandar, pestanas-del-perfil-medico, resumen contable)
# mockup: Tests 3 failed | 56 passed (59)   (los mismos tres)  → previos a este PR
# clinical.handlers.spec (PDF de receta) falló en la suite completa y pasó al re-correrlo: intermitente

$ ffprobe …mp4
codec_name=h264  width=1920  height=1080  duration=78.960000
```

En la carpeta [evidencia/](./evidencia/) están:
- `h1-specs-port.txt`, `h1-handler-spec.txt` y `h1-specs-en-mockup-base.txt`: salidas de los tests;
- `01`–`05-*.png`: una captura por pantalla, de la misma corrida que el video;
- `marcas.json`: el segundo en que empieza cada pantalla;
- `doble-revision.md`: las dos pasadas de revisión.

El MP4 queda en `artifacts/` (lo ignora git) y se entregó por fuera del repo.

## No cubierto

- **`yarn lint` del repo entero:** se corrió eslint solo sobre los archivos tocados.
- **E2E de Playwright del menú** (`playwright/aseguradora-menu-pestanas.spec.ts`): se actualizó la lista que espera, pero no se ejecutó.
- **«Enviar Mensaje» en el video:** no se pulsa. Con las personas del video, el simulador respondería 412.
- **El directorio fuera de escritorio:** no se probó en tema oscuro ni en móvil.

## Desvíos del plan

- **Cherry-pick:** se rehicieron dos commits locales. El primer intento duplicó `insurance.types.ts` (1780 líneas). Se reconstruyó desde la versión correcta y se volvió a commitear antes de cualquier push.
- **`access-tree.spec`:** se actualizó a la lista real del menú. Ya fallaba en `mockup`: esperaba 4 accesos y no contaba «Solicitudes recibidas».
- **Pedidos del usuario durante el trabajo, aplicados solo al video y sin tocar el repo:**
  - los correos `@….mock` salen como `@mail.com`;
  - se ocultan los botones «Datos de prueba» y «Ver componentes».
- **«Enviar Mensaje»:** la capa de respuesta lo marca disponible para las personas del video. Lo detectó la primera pasada de la revisión: el botón salía apagado en todas las filas.

## Riesgos residuales

- **Rojos previos de `mockup`, fuera de alcance y sin tocar:** `fichas-estandar.spec`, `pestanas-del-perfil-medico.spec` y `resumen.spec` (contabilidad). Además, `clinical.handlers.spec` (el PDF de la receta) es intermitente.

- **El video combina el nombre real de Alianza Seguros con datos inventados:**
  - las cuotas de Silver, Salud Mundial Plus y Asistencia Familiar Integral;
  - las personas, los médicos, los montos, el NIT y la dirección.

  Si se muestra fuera del equipo, hay que aclarar que es una maqueta.
- **El sello de `sessionStorage` depende del commit que compiló `ng serve`.** Si el servidor se levantó con otro commit, el simulador descarta la siembra. En ese caso el script falla con «aparece «Andina»», no en silencio.
- **Errores de CSP en consola:** hay dos, por scripts en línea, y aparecen en `/auth` sin sesión. Existían antes de este trabajo y no se tocaron.

## Decisiones y ambigüedades

- **Datos de Alianza:** viven solo en el script, por decisión del usuario. La cuenta y los handlers de Andina no cambian.
- **Cuotas sin fuente:** Silver Bs 380, Salud Mundial Plus Bs 1.250 y Asistencia Familiar Integral Bs 65 son **referenciales**. **Confirmar con:** el usuario o el área comercial.
- **«Directorio de clientes»:** el componente real se titula «Directorio de Pacientes» y se mostró tal cual. **Confirmar con:** el usuario.
- **Mundisalud:** se tomó como el producto y «Salud Mundial Plus» como su plan.
- **Auto Alianza y TU Hogar:** quedaron fuera. La pantalla muestra la prima mensual sin moneda y la analítica suma primas.
- **Logo:** no se usa la marca real de Alianza; «Mi perfil» muestra «Sin logo».
