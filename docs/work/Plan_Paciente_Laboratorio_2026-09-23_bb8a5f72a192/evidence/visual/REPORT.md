# Revisión visual — aviso de demostración en rutas de Paciente

**Base revisada:** `mockup` SHA `a43ad2b311e1a69ff708fba5cef1e5a2100bbbc2`, incluida la implementación de PR #598 / commit `9d3f4b54`. El cambio de UI es previo a esta rama; esta rama aporta regresión/evidencia.

| Antes, 375 px | Estado actual, 375 px |
|---|---|
| [Aviso largo junto al control de tema](corr-34-demo-banner-before-375.png) | [Aviso corto debajo del encabezado](corr-34-demo-banner-current-mockup-375.png) |

El estado actual muestra «Demo» alineado a la derecha debajo de la barra superior. La captura previa muestra el rótulo largo en la misma franja del control de tema. Las capturas de viewport actuales de 320, 375, 390 y 768 px muestran separación visible; 1024, 1440 y 1920 conservan el rótulo completo en escritorio.

La regresión `playwright/mock-banner-responsive.spec.ts` pasó en cinco rutas con siete viewports (35 combinaciones): título esperado por ruta, aviso visible, nombre accesible «Datos de prueba», rótulo visible correspondiente al breakpoint, apertura/cierre e intersección geométrica cero con el control de tema. Las siete capturas actuales están en [test-viewports](corr-34-responsive-current-mockup/test-viewports/).

El auditor oficial en copia aislada verificó cinco rutas activas en 375/768/1440 claro y 1440 oscuro: 20 celdas PASS, cero errores de consola/HTTP 5xx, fondo claro blanco, centrado ≤2 px, ancho ≥85 % y sin scroll horizontal. Las [20 fotos se abrieron manualmente](corr-34-responsive-current-mockup/MATRIZ-visual.md). Ocho imágenes 1440 `fullPage` de vistas de cuenta dibujan la navegación fija sobre contenido largo; se dejan visibles como limitación del formato de captura y no se usan para puntuar el layout.

El set excluye `/my-account/loyalty`, redirigida actualmente a `/my-account`; incluye `/my-account/promotions`, cuyo vacío se refiere a campañas de farmacia. Esta revisión sólo cubre el aviso responsive y no certifica los hitos funcionales H1–H6 ni el cierre global de CORR-34. Ver [log reproducible](corr-34-responsive-current-mockup/RUN-LOG.md).
