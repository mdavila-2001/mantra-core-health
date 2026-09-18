# Ficha y decisiones de movimiento

## Campos

ID, cambio explicado, disparador, origen/destino, elemento, propiedades, duración/curva, momento de acción funcional, interrupción, foco, movimiento reducido, fallback, coste observado y evidencia.

## Propuestas iniciales

| Tipo | Punto de partida |
|---|---|
| Respuesta local | 100–160 ms o inmediata |
| Menú | 120–180 ms con movimiento corto opcional |
| Modal | 180–240 ms sin retrasar gestión de foco |
| Panel | 220–300 ms si la distancia lo justifica |
| Operación remota | Duración real; progreso honesto |

Son propuestas de esta skill. Ajustarlas al producto. En movimiento reducido eliminar viajes y rebotes y conservar estado informativo estable.

## Caso de presión

En una tabla de 500 filas para Android económico, evitar animaciones de entrada por fila. Dar feedback a selección, orden y acción; revisar paginación o virtualización según necesidades. Perfilar efectos de barras fijas y overlays. La variante reducida conserva selección y progreso.

## Comprobaciones

Cerrar mientras abre; pulsar dos acciones seguidas; salir de ruta durante carga; teclado; táctil; preferencia reducida; navegador sin efecto avanzado. El estado final debe coincidir en todos los casos.

Fuentes técnicas: [MDN, prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion) y [web.dev, rendimiento de animación](https://web.dev/articles/animations-guide). Verificar capacidades según versiones reales.
