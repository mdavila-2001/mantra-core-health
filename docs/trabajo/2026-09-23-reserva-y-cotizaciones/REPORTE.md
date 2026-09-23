> **AVANCE: 20 / 51 — 39 %.**

# Reporte — reserva y cotizaciones del paciente

## Completado

- El directorio de profesionales activa navegación única de manera opt-in: la tarjeta anuncia carga, bloquea una segunda activación y se libera al finalizar, cancelar o fallar el router.
- Un cupo en proceso de apertura muestra carga y bloquea los demás cupos hasta que `Router.navigate()` termina.
- La lógica de Cotizaciones normaliza búsqueda, filtra verticales, ordena distancias y deja los precios no publicados al final. Conserva la procedencia y no convierte UMA a bolivianos.
- Evidencia focalizada: `result-card` 6/6, disponibilidad 13/13 y lógica de cotizaciones 3/3; `yarn typecheck` exit 0.

## A medias

- Medición de red/capturas/E2E: no ejecutadas. La tarea requería una ruta completa autenticada y la pantalla de Cotizaciones aún no tiene ruta ni entrada de menú publicadas.
- Carga por sede y reducción a una lectura por profesional: las lecturas existentes ya se disparan en paralelo por sede; no existe filtro por profesional en el cliente/contrato disponible.
- Pantalla de Cotizaciones: sólo se construyó su dominio puro. No se creó una pantalla desconectada de la navegación ni datos sintéticos que pudieran parecer precios reales.

## Pendiente y bloqueos

- Ender debe publicar la ruta lazy y renglón «Cotizaciones» en los archivos reservados `app.routes.ts` y navegación.
- No hay precio publicado con procedencia para análisis, imagenología ni servicios médicos; UMA no tiene conversión a BOB declarada.
- No se encontró contrato que permita inventar una orden de servicio médico del paciente.

## Peldaño de evidencia

- Directorio y reserva: `TESTED` (pruebas focalizadas y typecheck).
- Cotizaciones: `TESTED` para su dominio puro; integración visual/ruta: `DISCOVERED`.

## Procesos

Ninguno debe quedar corriendo al cierre; la comprobación final se registra antes del PR.
