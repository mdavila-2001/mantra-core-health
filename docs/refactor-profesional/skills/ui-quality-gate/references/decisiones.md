# Criterios y reporte de calidad

## Evidencia

Fecha, versión, herramienta, comando/recorrido, datos, entorno, esperado, observado, archivo existente y limitación. El resultado corresponde al candidato actual.

## Riesgos prioritarios

Pérdida de datos, falso éxito, permiso roto, tarea principal bloqueada, barrera de teclado, estado sin recuperación y regresión de rendimiento que impide uso razonable. Los detalles cosméticos no compensan estos defectos.

## Selección de pruebas

Cambios visuales simples: inspección y comparación proporcional. Cambios de interacción: escenarios de teclado, estados y comportamiento. Cambios de contrato: invariantes, errores y efectos. Cambios de infraestructura: integración y recuperación pertinentes. No crear tests que solo repiten clases CSS.

## Matriz de verificación

Flujo válido; validación; error y reintento; resultado desconocido; permisos; móvil; texto largo; foco; movimiento reducido; rutas profundas; persistencia; reversión. Aplicar según el incremento y justificar exclusiones.

## Reporte de cierre

Resultado para el usuario; cambios; pruebas reales; diferencias visuales revisadas; accesibilidad; rendimiento; limitaciones; estado del gate; siguiente acción. Una prueba no ejecutada se registra así, incluso si el código parece correcto.

Referencias: [Playwright, buenas prácticas](https://playwright.dev/docs/best-practices), [comparación visual](https://playwright.dev/docs/test-snapshots) y [accesibilidad](https://playwright.dev/docs/accessibility-testing). Los checks específicos se adaptan al proyecto.
