# Plan — Video demo del módulo aseguradora como Alianza Seguros (rama `mockup`)

- Fecha: 2026-10-05 · Repos afectados: `mantra-core-health` (rama base `mockup`) · Predecesor: PR #955 en `dev` (directorio de pacientes de la aseguradora)
- Rama: `marcelo/video-aseguradora-alianza-mockup`
- Resultado observable: un MP4 1080p que recorre, con los componentes reales de `mockup` y la sesión de aseguradora presentada como **Alianza Seguros y Reaseguros S.A.**, las pantallas Mi perfil → Mis productos → Solicitudes recibidas → Siniestralidad (pestaña «Por persona») → Directorio de pacientes; y en `mockup` el directorio de pacientes de la aseguradora funciona con datos maquetados.
- Kill-test: buscar «Andina» en los cuadros extraídos del video, o abrir `/administration/insurance-patients` en `mockup` sin el script y ver un error o la respuesta genérica `[mock] sin manejador`.

## Alcance
- IN:
  - Portar desde `dev` la pantalla `src/app/features/insurance/insurance-patients/`, su ruta, su entrada de menú y sus métodos de `insurance.client.ts` (commits `a635ad30`, `e14817ad`, `fea045a7`), sin la documentación ni la evidencia de ese trabajo.
  - Handler simulado `src/app/core/mock/handlers/insurer-patients.handlers.ts` con su spec.
  - Script `tools/video-aseguradora/` (`grabar.mjs`, `datos-alianza.mjs`, `README.md`).
- OUT:
  - La cuenta, el handler y los fixtures de Seguros Andina: los datos de Alianza viven solo en el script del video, por decisión del usuario.
  - `playwright/insurer-patient-directory*.spec.ts` de `dev`: usan `page.route`, que en `mockup` no intercepta nada porque el backend simulado responde en memoria.
  - Auto Alianza y TU Hogar: la pantalla muestra «Prima mensual» sin moneda y la analítica suma primas, así que una prima anual en dólares quedaría mal.
  - El desfase de códigos de sexo de la maqueta (`GEN-F`/`GEN-M` frente a `GENDER_*`): se anota, no se toca.
- Ambigüedades registradas:
  - **Precios sin fuente.** Silver, Mundisalud y Asistencia Familiar Integral no tienen cuota pública. **Supuesto:** cuota referencial (Bs 380, 1.250 y 65), marcada `fuente: 'referencial'` en el script y en el reporte. **Confirmar con:** el usuario o el área comercial.
  - **Título de la pantalla.** El usuario la llama «Directorio de clientes», pero el componente real se titula «Directorio de Pacientes» (menú «Pacientes de la aseguradora»). **Supuesto:** se muestra tal cual. **Confirmar con:** el usuario.
  - **Mundisalud.** **Supuesto:** Mundisalud es el producto y «Salud Mundial Plus» su plan.

## H1 — El directorio de pacientes existe y funciona en `mockup`
**CA:** Dado `mockup` con el backend simulado, cuando la aseguradora entra a «Pacientes de la aseguradora», entonces ve el contador y la tabla de sus pacientes, puede buscar y paginar, y no aparece `[mock] sin manejador`.
**DoD:** `yarn lint` y `yarn typecheck` con salida 0 · specs dirigidos en verde · captura del navegador.
**Estado:** HECHO

### H1.S1 — Port del componente desde `dev`
| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H1.S1.M1 | Cherry-pick de los tres commits, sin `docs/` ni el spec de Playwright | Los archivos de la pantalla, la ruta, el menú y el cliente están en la rama | `git status` / `git diff --stat mockup` | HECHO |
| H1.S1.M2 | Typecheck del port | Compila sin errores | `yarn typecheck` → salida 0 | HECHO |
| H1.S1.M3 | Specs portados en verde | Pasan componente, cliente y navegación | `ng test --include …` → todos pasan | HECHO |

### H1.S2 — Handler simulado
| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H1.S2.M1 | `POST /insurance/patients/search` con filtros y paginación, persistido en `mock.insurance.patients` | Devuelve `{items,total,limit,nextCursor}` solo a la aseguradora; cualquier otro recibe 403 | spec del handler en verde | HECHO |
| H1.S2.M2 | `GET /insurance/patients/options` | Devuelve `{insurers}` | spec | HECHO |
| H1.S2.M3 | `POST /insurance/patients/conversation` | Devuelve `{conversationId}`, o un 412 controlado | spec | HECHO |
| H1.S2.M4 | Pantalla sin el script | Tabla con datos de Andina, consola limpia | captura + log de consola | HECHO |

## H2 — Video de Alianza
**CA:** Dado el app en `mockup`, cuando se corre el script, entonces se genera un MP4 h264 1080p de 80 a 100 s que recorre las 5 pantallas en orden; en ningún cuadro aparece «Andina»; las cuotas de Emisión Rápida son exactamente Bs 90/120/180/250.
**DoD:** salida de `node tools/video-aseguradora/grabar.mjs` · `ffprobe` · un cuadro extraído por pantalla · doble revisión crítica.
**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H2.S1.M1 | `datos-alianza.mjs` | Produce el catálogo, las solicitudes y los pacientes con la forma exacta que espera la maqueta | `node -e` que lo importa e imprime los conteos | HECHO |
| H2.S1.M2 | Siembra en `sessionStorage` y capa de respuesta | Encabezado y Mi perfil dicen Alianza; no aparece «Andina» | el chequeo por pantalla del script pasa | HECHO |
| H2.S1.M3 | Recorrido, cursor y marcas | Las 5 pantallas en orden y `marcas.json` | salida del script | HECHO |
| H2.S1.M4 | Conversión a MP4 | h264, 1920×1080 | `ffprobe` | HECHO |
| H2.S2.M1 | Doble revisión crítica de los cuadros | Ninguna pantalla RECHAZADA | notas en el REPORTE | HECHO |

## H3 — Entrega
| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H3.S1.M1 | PR a `mockup` | No draft, mergeable, checks en verde | `gh pr view --json isDraft,mergeable,mergeStateStatus` + `gh pr checks` | A MEDIAS |
| H3.S1.M2 | REPORTE.md | Las tres secciones, la evidencia y «No cubierto» | archivo en disco | HECHO |

## Riesgos y bloqueos previstos
| Riesgo | Impacto | Mitigación |
|---|---|---|
| `platformAccessRoles` cambia menús de administrador en `mockup` | Los specs de navegación fallan | Correr todos los specs de navegación y del shell |
| `sessionStorage` descartado por desfase de `build` | El video muestra datos de Andina | Leer el commit de `env.generated.ts` y fallar si aparece «Andina» |
| WebM de Playwright con texto borroso | El video no se lee bien | Plan B `--captura cdp` |
| La mensajería no abre para una cuenta de organización | Clic en «Escribir» roto | No hacer clic en el video; el handler devuelve 412 |
