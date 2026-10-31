# Plan — Órdenes compactas de laboratorio e imagenología (web) + paridad móvil

- Fecha: 2026-10-31 · Repos afectados: mantra-core-health (web), mantra_core_health_mobile (Flutter, hoy solo sistema de diseño) · Predecesor: ninguno
- Resultado observable: la cuenta de laboratorio/imagenología ve UNA pantalla «Órdenes» con cuatro estados y cuatro acciones, y el menú ya no tiene «Recepción de muestras», «Cola de trabajo» ni «Resultados».
- Kill-test: abrir `/administration/laboratory` con tenant `DIAGNOSTIC_CENTER` y ver alguno de los tres ítems tachados, o no poder recibir → procesar → subir → descargar desde una sola pantalla.

## Pedido del usuario (31/10/2026, literal resumido)
- Estados de la orden: BORRADOR → RECIBIDA → PROCESADA | CANCELADA | RECHAZADA → SUBIDOS (resultados descargables).
- Acciones, y nada más: recibir · marcar como procesada · subir resultados · descargar. «Compacto».
- Quitar del menú: Recepción de muestras, Cola de trabajo, Resultados (capturado en la imagen del usuario).
- Marketplace de servicios: «el mismo estándar que en lo demás» (ficha/formulario centrado, a lo ancho, UNA tarjeta con pestañas — CLAUDE.md §6).
- Igual en la app móvil.

## Decisiones confirmadas por el usuario (31/10/2026)
- Alcance: laboratorio + imagenología (cuenta DIAGNOSTIC_CENTER).
- Ciclo: BORRADOR → RECIBIDA → PROCESADA → SUBIDOS; CANCELADA y RECHAZADA son salidas de RECIBIDA; descarga en SUBIDOS.
- Prioridad: H1 primero, luego H2.

## Hechos (descubrimiento, con ruta)
- Menú del laboratorio: `src/app/core/navigation/navigation.map.ts` ~1941-2060 (reception, queue, results, prices, branches).
- Recepción: `src/app/features/lab-reception/` (797 líneas; recibir muestra + acesión + cadena de custodia).
- Resultados: `src/app/features/laboratory/results/` (subida por partes, visor).
- Cola: `/diagnostics/work-orders` → `features/diagnostics/diagnostics.ts`.
- Spec del menú que fija el orden actual: `src/app/core/navigation/navigation.laboratory.spec.ts` (`MENU_DEL_LABORATORIO`).
- `lab-portal.types.ts`: los endpoints `/diagnostics/lab/…` los responde sólo el simulador (P52), la API real no los tiene.
- App Flutter: 25 archivos, solo design system + home; sin signup/login/flujos. No hay Flutter SDK en este entorno.

## Alcance
- IN: menú del laboratorio/imagenología; pantalla «Órdenes»; estados y acciones; redirects de las rutas viejas; pruebas; capturas 3 viewports.
- OUT: farmacia (su flujo de pedidos no se toca; confirmado 31/10); cambios de esquema en la API.
- Base: la rama se rebasó sobre `origin/dev` (salió de `master`, 413 commits atrás).
- Ambigüedades registradas:
  1. ¿Aplica también a farmacia («aceptar pedido»)? Supuesto: NO. Confirmar con el usuario.
  2. «Marketplace de servicios … ya sabes cómo lo quiero»: el estándar no está escrito en esta sesión. Supuesto: composición-rules §5 (una tarjeta con pestañas, centrada, ancho completo). Confirmar con el usuario qué pantalla exacta.
  3. «SUBIDOS» se lee como estado terminal tras PROCESADA (resultados subidos y descargables). CANCELADA/RECHAZADA son salidas alternativas de RECIBIDA. La API real no tiene este ciclo (P52): se simula en el mock y se declara.
  4. «Descargar» corre sobre el archivo subido; hoy el visor está en Resultados.

## H1 — Menú compacto y pantalla «Órdenes»
**CA:** Dado un usuario de un `DIAGNOSTIC_CENTER`, cuando abre el menú, entonces ve Resumen, Órdenes, Precios y Sucursales; y las rutas viejas redirigen a Órdenes.
**DoD:** `yarn tsc -p tsconfig.app.json --noEmit` · `yarn eslint` de lo tocado · `yarn ng test` dirigido · E2E Playwright del laboratorio · capturas 390/768/1440 con doble revisión.
**Estado:** A MEDIAS (M4)

### H1.S1 — Órdenes
| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Estado |
|---|---|---|---|---|
| H1.S1.M1 | Quitar recepción, cola y resultados del menú y redirigir sus rutas a Órdenes | el menú del laboratorio tiene 4 ítems; las rutas viejas redirigen | `ng test navigation` → PASS | HECHO |
| H1.S1.M2 | Pantalla «Órdenes»: una tarjeta con pestañas por estado, conteos, búsqueda y estados vacío/error | cada pestaña filtra y cuenta | `ng test laboratory-orders` → PASS | HECHO |
| H1.S1.M3 | Cuatro acciones por fila (recibir, procesada, subir, descargar) con 409 ante un paso fuera de orden | cada acción cambia el estado y persiste tras recargar | `ng test lab-portal.handlers` + Playwright `hito2 · laboratorio` | HECHO |
| H1.S1.M4 | Evidencia visual en 3 viewports con doble revisión independiente | sin pantalla RECHAZADA sobre el juego final | `evidencia/doble-revision.md` | A MEDIAS |

## H2 — Marketplace de servicios con el estándar de composición
Confirmado 31/10: máximo alcance — `/my-services`, directorio de laboratorios (`/laboratory-directory` y su ficha) y catálogo de farmacia, con el estándar de composición-rules §5.
| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H2.S1.M1 | Alinear `/my-services`, directorio de laboratorios y catálogo de farmacia | Sin empezar | — | TODO |

## H3 — Paridad en la app móvil Flutter
La app no tiene signup/login ni los flujos de los tres roles; es un proyecto aparte.
| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H3.S1.M1 | Signup, login y flujos de laboratorio, imagenología y farmacia en Flutter | Sin empezar | — | TODO |

## Riesgos
| Riesgo | Impacto | Mitigación |
|---|---|---|
| La API real no tiene el ciclo de órdenes | La UI quedaría contra simulador | Declararlo; coordinar contrato con la API antes del PR |
| Dos PRs exigidos (dev y test) | Entrega | Cherry-pick a rama desde `test` |
