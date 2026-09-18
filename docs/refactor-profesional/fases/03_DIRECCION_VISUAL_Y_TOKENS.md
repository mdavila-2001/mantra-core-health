# Fase 03 — dirección visual y sistema de tokens

> El diseño se prueba con contenido y estados reales. Los tokens son decisiones compartidas, no un inventario de números arbitrarios.

**Objetivo:** definir una identidad consistente antes de propagar estilos. **Arquitectura:** valores base, roles semánticos y composición contextual. **Stack:** estilos existentes. **Spec:** [especificación objetivo](../ESPECIFICACION_OBJETIVO.md).

## Entradas y archivos

Consumir mapa UX, identidad existente, contenido representativo y baseline. Crear `trabajo/DIRECCION_VISUAL.md` y catálogo de tokens. Mapear los archivos reales de estilos antes de cambiarlos. Leer [dirección visual](../especificaciones/02_DIRECCION_VISUAL.md) y [tokens](../especificaciones/03_TOKENS_Y_THEMING.md).

## F03.1 — fijar dirección

- [ ] Elegir densidad y lenguaje adecuados a tareas y audiencia conocidas.
- [ ] Definir qué elementos de identidad se conservan y cuáles se ajustan.
- [ ] Especificar tipografía, jerarquía, retícula, ritmo, materiales y uso del acento.
- [ ] Justificar cualquier translucidez o efecto por su función.

**Aceptación:** la dirección explica decisiones y límites; no se reduce a “Apple, minimalista, premium”.

## F03.2 — extraer y normalizar tokens

- [ ] Inventariar valores del piloto; mapearlos a roles semánticos.
- [ ] Definir espaciado, tamaños, radios, color, elevación, capas y movimiento inicial.
- [ ] Resolver valores duplicados o contradictorios.
- [ ] Elegir formato compatible con herramientas existentes; verificar aliases.

**Aceptación:** un consumidor sabe qué token usar sin elegir un color por intuición. Excepciones tienen razón documentada.

## F03.3 — construir pantalla patrón

- [ ] Aplicar la dirección en el flujo piloto o prototipo local pertinente.
- [ ] Usar datos realistas y mostrar estados normal, vacío, error y ocupado.
- [ ] Comprobar móvil, ancho intermedio, escritorio y contenido extremo.
- [ ] Revisar alineamientos, peso de acciones, lectura y profundidad.

**Aceptación:** los componentes funcionan juntos y la dirección conserva comprensión. Si solo existe una imagen, marcar comportamiento todavía no implementado.

## F03.4 — comprobar contraste y tema

- [ ] Medir texto, controles, foco y estados sobre fondos reales.
- [ ] Diseñar tema oscuro solo si está en alcance, con equivalencias semánticas.
- [ ] Probar fallback opaco de las superficies translúcidas.
- [ ] Comprobar zoom y cambio de tamaño de fuente.

**Aceptación:** fallos de legibilidad corregidos antes de migrar más rutas. El éxito en fondo uniforme no prueba legibilidad sobre contenido dinámico.

## F03.5 — publicar contrato visual interno

- [ ] Documentar reglas con ejemplos del proyecto y antiejemplos relevantes.
- [ ] Señalar tokens estables frente a decisiones todavía experimentales.
- [ ] Vincular archivos reales de implementación y capturas a cada grupo de decisiones.
- [ ] Entregar a fase 05 los estilos que soportará el primer conjunto de componentes.

**Gate:** pantalla patrón revisada y tokens suficientes para el piloto. **Recuperación:** limitar cambios globales si afectan rutas no migradas; usar adaptación temporal delimitada y retirar al completar la migración. Evitar resolver una regresión acumulando CSS de mayor especificidad sin revisar su causa.
