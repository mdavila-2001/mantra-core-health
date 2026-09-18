# Tokens, temas y decisiones visuales compartidas

## Modelo

Tres niveles bastan inicialmente: valores base, roles semánticos y excepciones de componente justificadas. Ejemplo: `palette.blue.700` → `color.action.primary` → `button.primary.background`. El consumidor habitual usa el rol semántico. Un cambio de tema modifica la asignación de roles sin reescribir cada componente.

El [formato publicado DTCG 2025.10](https://www.designtokens.org/tr/2025.10/format/) define una forma de intercambio de tokens. Es una especificación de un Community Group, no una Recomendación W3C. Adoptarla si las herramientas del proyecto la soportan; variables CSS organizadas también pueden ser suficientes. No implementar contra el borrador cambiante del repositorio como si fuera la versión publicada.

## Catálogo inicial propuesto

Todos los números de esta sección son decisiones iniciales del kit, pendientes de validación en la app.

| Familia | Propuesta | Regla de uso |
|---|---|---|
| Espaciado | 4, 8, 12, 16, 24, 32, 48, 64 px equivalentes | Elegir relaciones, evitar valores aislados sin razón |
| Texto | 12, 14, 16, 20, 24, 32, 40 px equivalentes | Roles en rem; texto principal inicial 16 px |
| Interlineado | 1,2 títulos; 1,45–1,6 cuerpo | Probar idiomas, zoom y contenido real |
| Radios | 6, 10, 14, 20 px; pill solo donde tiene sentido | Coherencia entre superficies anidadas |
| Controles | Alturas iniciales 40–44 px; objetivo táctil frecuente 44 px | Distinto del mínimo normativo de 24 CSS px con excepciones |
| Ancho de lectura | Aproximación 60–75 caracteres | Ajustar tipografía y audiencia |
| Movimiento | 100, 160, 220, 300 ms | Asignar por función y distancia; no por componente arbitrario |
| Capas | base, sticky, dropdown, overlay, modal, toast | Registro único; overlays no superponen avisos críticos indebidamente |

## Roles de color necesarios

`surface.canvas`, `surface.panel`, `surface.elevated`, `text.primary`, `text.secondary`, `text.onAction`, `border.default`, `border.strong`, `action.primary`, `action.hover`, `focus.ring`, `state.success`, `state.warning`, `state.error`, `state.info`, `selection.background`.

Añadir pares foreground/background a los estados. Un verde de éxito útil sobre blanco puede fallar sobre una superficie oscura. Un borde decorativo no tiene el mismo requisito que un borde necesario para identificar un campo.

## Ejemplo CSS de partida

Ejemplo ilustrativo para una app web; debe integrarse con el sistema real, comprobar contraste y probar su resultado. No es un tema certificado.

```css
:root {
  color-scheme: light;
  --surface-canvas: #f5f5f7;
  --surface-panel: #ffffff;
  --text-primary: #1d1d1f;
  --text-secondary: #55555d;
  --action-primary: #005ac2;
  --text-on-action: #ffffff;
  --focus-ring: #005ac2;
  --space-2: 0.5rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --radius-control: 0.625rem;
  --motion-feedback: 100ms;
  --motion-enter: 220ms;
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
}
[data-theme="dark"] {
  color-scheme: dark;
  --surface-canvas: #121214;
  --surface-panel: #202024;
  --text-primary: #f5f5f7;
  --text-secondary: #b8b8c0;
  --action-primary: #9cc9ff;
  --text-on-action: #082343;
  --focus-ring: #9cc9ff;
}
```

## Inventario y migración de valores

1. Extraer colores, medidas, duraciones, fuentes y z-index de las rutas piloto.
2. Agrupar valores por intención. Dos grises visualmente cercanos pueden representar funciones distintas; no deduplicar solo por distancia cromática.
3. Mapear cada uso a un rol. Resolver valores huérfanos mediante una decisión documentada.
4. Aplicar tokens en componentes compartidos y luego en pantallas. Comparar antes/después para detectar dependencia oculta de estilos globales.
5. Bloquear nuevas excepciones silenciosas mediante revisión o reglas que respeten valores legítimos —por ejemplo, dimensiones del contenido o datos de visualizaciones—.
6. Retirar aliases antiguos cuando no tengan consumidores. Mantener changelog cuando cambie una semántica pública.

## Tema y persistencia

Precedencia propuesta: elección explícita de la persona → preferencia del sistema → valor inicial del producto. Conservar la elección usando el mecanismo existente. En aplicaciones con renderizado en servidor, evitar que el primer render muestre un tema distinto y cause parpadeo; resolverlo con las capacidades reales del framework, no con un acceso inseguro al navegador durante SSR.

Definir cómo cambian gráficos e imágenes entre temas. No persistir datos sensibles junto con preferencias visuales. Probar inicio sin almacenamiento disponible y cambios de preferencia durante una sesión.

## Criterios de aceptación

Los roles están documentados y tienen propietario. Los pares de color relevantes se verifican, incluidos estados de foco y hover. Los componentes piloto consumen roles semánticos. No hay cadenas circulares de aliases. Una modificación de token tiene alcance comprensible y no cambia una regla de negocio. Si se usa DTCG, validar su estructura con una herramienta compatible fijada en el proyecto.
