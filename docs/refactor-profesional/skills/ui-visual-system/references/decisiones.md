# Criterios visuales

## Decisiones mínimas

| Tema | Pregunta |
|---|---|
| Densidad | ¿La persona lee, compara o procesa muchas filas? |
| Jerarquía | ¿Se reconoce contexto y acción principal? |
| Material | ¿La profundidad explica una capa o solo decora? |
| Tipografía | ¿Los roles conservan legibilidad con zoom y texto largo? |
| Color | ¿Cada color tiene función y alternativa no cromática? |

Roles iniciales: canvas, panel, elevated, primary/secondary text, action, on-action, border, focus y pares foreground/background para estados. Cada componente usa roles, no valores aislados por preferencia.

## Propuesta inicial, ajustable

Espaciado basado en 4/8/12/16/24/32; cuerpo cercano a 1rem; radios por familia de control y superficie; fondo opaco; una familia de acento. Estos valores no son una receta de Apple. Ajustarlos con el producto y medir pares de color.

## Fallos a detectar

Tarjetas dentro de tarjetas sin necesidad; toda acción con el mismo peso; contenido auxiliar ilegible; glass que pierde contraste al desplazarse el fondo; modo oscuro generado por inversión; iconos de familias incompatibles; botones cuyo texto no cabe.

## Entrega verificable

Capturas por viewport y estado, reglas aplicadas y excepciones justificadas. Si el resultado es un mockup, declararlo y dejar comportamiento pendiente.

Referencias: [Apple, diseño y materiales](https://developer.apple.com/videos/play/wwdc2025/219/) y [DTCG, formato publicado](https://www.designtokens.org/tr/2025.10/format/). La implementación web es una adaptación del producto.
