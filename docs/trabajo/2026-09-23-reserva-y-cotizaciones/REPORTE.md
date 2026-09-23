> **AVANCE: 20 / 51 — 39 %.**

# Reporte — reserva y cotizaciones del paciente

## Completado

- El directorio de profesionales activa navegación única de manera opt-in: la tarjeta es la única dueña de la navegación normal, anuncia carga, bloquea una segunda activación y se libera al finalizar, cancelar o fallar el router. Ctrl/Cmd/Shift-clic conserva el enlace nativo.
- Un cupo en proceso de apertura muestra carga y bloquea los demás cupos hasta que `Router.navigate()` termina.
- La lógica de Cotizaciones normaliza búsqueda, filtra verticales, ordena distancias y deja los precios no publicados al final. Conserva la procedencia y no convierte UMA a bolivianos.
- Evidencia focalizada: `result-card` 7/7, disponibilidad 13/13 y lógica de cotizaciones 3/3; `yarn typecheck` exit 0.
- Suite completa: 7.106/7.108 pruebas pasaron. Los dos fallos ajenos se detallan abajo.

## A medias

- Medición de red/capturas/E2E: la medición autenticada se intentó con un servidor local y Playwright, pero el submit no produjo una respuesta observable de `/iam/auth/login` en 30 s; no se declaran números ni capturas como evidencia. El detalle está en `evidencia/antes/red-flujo-reserva.md`.
- Carga por sede y reducción a una lectura por profesional: las lecturas existentes ya se disparan en paralelo por sede; no existe filtro por profesional en el cliente/contrato disponible.
- Pantalla de Cotizaciones: sólo se construyó su dominio puro. No se creó una pantalla desconectada de la navegación ni datos sintéticos que pudieran parecer precios reales.

## Pendiente y bloqueos

- Ender debe publicar la ruta lazy y renglón «Cotizaciones» en los archivos reservados `app.routes.ts` y navegación.
- No hay precio publicado con procedencia para análisis, imagenología ni servicios médicos; UMA no tiene conversión a BOB declarada.
- No se encontró contrato que permita inventar una orden de servicio médico del paciente.
- Para completar H1.S2 hace falta un login local observable o una sesión autenticada reproducible; sin ella no se puede medir honestamente el directorio → ficha → cupos.
- La suite completa tiene dos regresiones fuera de este alcance: `insurance-analytics.handlers.spec.ts` espera `coveragesWithoutPremiumCount = 0` y recibe `1`; `register-practitioner.spec.ts` excede 5 s al resolver credenciales canónicas contra el mock backend.

## Peldaño de evidencia

- Directorio y reserva: `TESTED` (pruebas focalizadas y typecheck).
- Cotizaciones: `TESTED` para su dominio puro; integración visual/ruta: `DISCOVERED`.

## Revisión previa al PR

- Se corrigió una colisión real entre el manejador de la tarjeta y `RouterLink`: ambos navegaban ante dos clics. Las pruebas de regresión verifican una sola llamada y que Ctrl-clic no deja el estado de carga activo.
- `yarn lint` sigue fallando por 245 componentes de la base que no declaran `OnPush`; los dos anfitriones de prueba introducidos aquí sí lo declaran.

## Procesos

Ninguno debe quedar corriendo al cierre; la comprobación final se registra antes del PR.
