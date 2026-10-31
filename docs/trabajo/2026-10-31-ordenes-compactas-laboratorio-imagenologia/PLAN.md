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
- OUT: farmacia (su flujo de pedidos no se toca hasta confirmar); cambios de esquema en la API.
- Ambigüedades registradas:
  1. ¿Aplica también a farmacia («aceptar pedido»)? Supuesto: NO. Confirmar con el usuario.
  2. «Marketplace de servicios … ya sabes cómo lo quiero»: el estándar no está escrito en esta sesión. Supuesto: composición-rules §5 (una tarjeta con pestañas, centrada, ancho completo). Confirmar con el usuario qué pantalla exacta.
  3. «SUBIDOS» se lee como estado terminal tras PROCESADA (resultados subidos y descargables). CANCELADA/RECHAZADA son salidas alternativas de RECIBIDA. La API real no tiene este ciclo (P52): se simula en el mock y se declara.
  4. «Descargar» corre sobre el archivo subido; hoy el visor está en Resultados.

## H1 — Menú compacto y pantalla «Órdenes»
**CA:** Dado un usuario de un `DIAGNOSTIC_CENTER`, cuando abre el menú, entonces ve Resumen, Órdenes, Precios, Horarios y equipos, Sucursales; y las rutas viejas redirigen a Órdenes.
**DoD:** `yarn lint` · `yarn typecheck` · `yarn test` dirigido (navigation + órdenes) · capturas 390/768/1440 con doble revisión.
**Estado:** TODO

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H1.S1.M1 | Quitar reception/queue/results del menú y redirigir | el menú tiene 5 ítems de laboratorio | `yarn test navigation.laboratory` | TODO |
| H1.S1.M2 | Pantalla «Órdenes» con 4 estados y filtro por estado | lista las órdenes con su insignia | spec del componente | TODO |
| H1.S1.M3 | Acciones recibir / procesada / subir / descargar | cada acción cambia el estado y persiste al recargar (mock) | spec + Playwright | TODO |
| H1.S1.M4 | Evidencia visual 3 viewports + doble revisión | notas por pantalla sin RECHAZADA | `evidencia/doble-revision.md` | TODO |

## H2 — Marketplace de servicios con el estándar de composición
Pendiente de confirmar la pantalla (ambigüedad 2). **Estado:** BLOQUEADO por decisión de producto.

## H3 — Paridad en la app móvil Flutter
Pendiente: la app no tiene los flujos base (signup/login). **Estado:** TODO, fuera de este turno.

## Riesgos
| Riesgo | Impacto | Mitigación |
|---|---|---|
| La API real no tiene el ciclo de órdenes | La UI quedaría contra simulador | Declararlo; coordinar contrato con la API antes del PR |
| Dos PRs exigidos (dev y test) | Entrega | Cherry-pick a rama desde `test` |
