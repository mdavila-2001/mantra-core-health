# CM-10 — «Mis órdenes» con Procedimientos

Capturas de `/my-account/diagnostic-orders?tab=PROCEDURE` en la maqueta (`mockup`), con
`paciente@alovida.mock`. Tomadas con el Chromium de Playwright contra `ng serve`.

| Archivo | Viewport | Tema |
|---|---|---|
| `procedimientos-390x844-light.png` · `-dark.png` | 390×844 | claro · oscuro |
| `procedimientos-768x1024-light.png` | 768×1024 | claro |
| `procedimientos-1024x768-light.png` | 1024×768 | claro |
| `procedimientos-1440x900-light.png` · `-dark.png` | 1440×900 | claro · oscuro |
| `procedimientos-1920x1080-light.png` | 1920×1080 | claro |
| `todas-1440x900-light.png` | 1440×900 | claro (pestaña «Todas») |

Medido en cada captura: pestañas «Todas (6) · Laboratorio (2) · Imagenología (1) · Procedimientos (3) · Otros (0)»;
ningún uuid en el texto de la pantalla; sin desborde horizontal de la página; sin errores de página.

La fila de la endoscopia muestra «Su médico sugirió un centro», «Sede sugerida: Centro Médico Sur — Sede Central»
y «Es una recomendación: puede elegir otro centro.»; la de la colonoscopia, «Puede elegir dónde hacérselo».

«Procedimientos (3)» y no 2: además de las dos órdenes de CM-10, la maqueta ya traía un electrocardiograma con
categoría `SRQ-PROCEDURE`, que antes caía en «Otros» y ahora, correctamente, en «Procedimientos».

En 390 px la tabla de «Mis órdenes» desplaza sus columnas dentro de su propio contenedor (también en Laboratorio,
sin cambios de este carril), así que las líneas del ejecutor se leen desplazando la tabla.

No cubierto: emitir una orden «Lo hago yo» con la médica y verla del lado de la paciente exige el selector de CM-08,
que no está en esta rama. El alta con los campos del ejecutor está cubierta por pruebas de handler
(`diagnostics.handlers.spec.ts`).
