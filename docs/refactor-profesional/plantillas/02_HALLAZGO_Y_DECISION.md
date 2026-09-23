# Contratos de hallazgos y decisiones

## Ficha de hallazgo

ID; título observable; ruta/rol/estado; pasos de reproducción; resultado actual; consecuencia para la tarea; evidencia; severidad P0–P3; confianza; causa confirmada o hipótesis; corrección propuesta; criterio de aceptación; dependencia; fase; estado.

Ejemplo ilustrativo: “El error de nombre duplicado vacía el formulario”. La aceptación sería “tras respuesta de validación, el nombre permanece y el error se asocia al campo”. No sería “mejorar la experiencia de errores”.

## Ficha de reubicación

Función y alcance; ubicación actual; lugar propuesto; tarea y rol; evidencia o hipótesis; frecuencia conocida; alternativa evaluada; permisos; URL/enlaces afectados; compatibilidad transitoria; mensaje de orientación si hace falta; protocolo de descubribilidad; decisión; reversión.

## ADR breve

1. Contexto y problema concreto.
2. Opciones realmente viables y costes.
3. Decisión adoptada y razón.
4. Consecuencias positivas y compromisos.
5. Evidencia que la respalda y límites de confianza.
6. Condiciones que obligan a revisarla.
7. Archivos/contratos afectados y forma de revertir.

## Ejemplo de decisión técnica

**Problema ilustrativo:** un botón guarda mediante un cliente global y aplica políticas de validación que otras pantallas duplican.

**Decisión posible:** conservar el botón presentacional y mover el caso de uso al módulo de la funcionalidad; inyectar un adaptador donde exista variación real.

**Consecuencia:** el botón se reutiliza sin conocer la API; la validación de negocio permanece cercana a sus consumidores. Se acepta una interfaz adicional porque protege una dependencia concreta. Si el nuevo módulo solo reenvía argumentos sin ocultar ninguna complejidad, se simplifica.
