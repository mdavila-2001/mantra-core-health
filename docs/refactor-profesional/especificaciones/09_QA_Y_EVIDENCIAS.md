# QA, pruebas y evidencias de calidad

## Capas de verificación

| Capa | Pregunta | Evidencia |
|---|---|---|
| Estática | ¿El cambio respeta tipos y reglas aplicables? | Comando real y salida |
| Contrato | ¿Se conservan invariantes y errores? | Pruebas de interfaz/caso de uso |
| Componente | ¿Estados e interacción son correctos? | Casos aislados y revisión |
| Integración | ¿UI, datos y efectos coordinan correctamente? | Escenarios de API/estado |
| End to end | ¿La persona completa la tarea? | Flujo ejecutado y resultado persistido |
| Visual | ¿Se conserva composición y jerarquía? | Comparación revisada por estado y viewport |
| Accesibilidad | ¿Se puede operar y comprender? | Automatización más revisión manual |
| Rendimiento | ¿El cambio respeta presupuestos? | Medición comparable y trazas |

No maximizar el número de pruebas por apariencia de disciplina. Elegir las que detecten regresiones relevantes. Una aserción que repite el nombre de una clase no prueba la utilidad de una pantalla.

## Catálogo mínimo de escenarios

| ID | Escenario | Resultado esperado |
|---|---|---|
| Q01 | Entrar por enlace directo a ruta relevante | Contexto y permisos correctos; recursos cargan |
| Q02 | Completar flujo principal válido | Efecto real confirmado y visible al recargar |
| Q03 | Enviar formulario inválido | Errores asociados y datos conservados |
| Q04 | Doble pulsación durante envío | Un resultado lógico; sin duplicados cuando contrato lo garantiza |
| Q05 | Timeout de escritura | Estado desconocido gestionado sin falso éxito |
| Q06 | Error de lectura y reintento | Recuperación sin perder filtros útiles |
| Q07 | Cero datos y cero resultados filtrados | Estados distintos con acciones apropiadas |
| Q08 | Permiso limitado o retirado | Acciones acordes y backend protegido |
| Q09 | Atrás/adelante, recarga y pestaña nueva | URL y contexto coherentes |
| Q10 | Teclado en menú y modal | Foco predecible, salida y retorno correctos |
| Q11 | Movimiento reducido | Resultado funcional idéntico y sin recorrido innecesario |
| Q12 | Móvil, zoom y texto largo | Sin pérdida de información o acciones |
| Q13 | Cambio rápido de búsqueda | No aparecen resultados obsoletos como actuales |
| Q14 | Cambio de tema cuando aplica | Sin parpadeos graves ni contraste roto |
| Q15 | Ruta antigua tras reubicación | Redirección/acceso compatible definido |
| Q16 | Reversión del incremento | Recuperación sin daño a datos o cambios ajenos |

Asignar escenarios por riesgo. No todas las pantallas necesitan Q04 si no escriben datos. La matriz documenta la aplicabilidad.

## Uso de Playwright

La documentación de [buenas prácticas](https://playwright.dev/docs/best-practices) recomienda probar comportamiento visible y usar locators resistentes basados en atributos de usuario. Este kit propone ejecutar flujos por roles y etiquetas, esperar estados observables y evitar pausas arbitrarias. Los fixtures deben ser controlados y los efectos externos, aislados.

Ejemplo de patrón a adaptar a rutas, etiquetas y contratos reales; no ha sido ejecutado contra tu aplicación:

```ts
import { test, expect } from '@playwright/test';

test('conserva el formulario ante un rechazo de validación', async ({ page }) => {
  await page.route('**/api/projects', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    await route.fulfill({
      status: 422,
      contentType: 'application/json',
      body: JSON.stringify({ errors: { name: 'Este nombre ya existe' } }),
    });
  });
  await page.goto('/projects/new');
  await page.getByLabel('Nombre del proyecto').fill('Proyecto Norte');
  await page.getByRole('button', { name: 'Crear proyecto', exact: true }).click();
  await expect(page.getByLabel('Nombre del proyecto')).toHaveValue('Proyecto Norte');
  await expect(page.getByText('Este nombre ya existe', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Crear proyecto', exact: true })).toBeEnabled();
});
```

Este test aísla la UI ante una respuesta simulada. No prueba persistencia ni validación del servidor; el flujo confirmado requiere otra prueba con un backend de prueba o contrato de integración real. No confundir mock exitoso con integración terminada.

## Regresión visual

Fijar datos, fecha si se muestra, fuente, navegador, sistema y dimensiones relevantes. Para snapshots estáticos, desactivar animaciones o capturar un estado final definido; además probar movimiento por separado. Enmascarar solo contenido inevitablemente variable y documentar la máscara.

Revisar diferencias en alineamiento, jerarquía, recortes, estados, foco y contenido. El [mecanismo de comparaciones visuales](https://playwright.dev/docs/test-snapshots) detecta diferencias respecto de una referencia; no decide si la referencia es un buen diseño. No actualizar masivamente los archivos esperados para eliminar fallos sin inspección.

## Accesibilidad automatizada

Ejecutar la herramienta en estados abiertos: menú, modal, validación y error; no únicamente en la página inicial. Registrar reglas, impacto y decisión. La [guía de accesibilidad de Playwright](https://playwright.dev/docs/accessibility-testing) explica integración y limitaciones; completar con pruebas manuales.

## Evidencia mínima por resultado

Fecha, commit o identificador del incremento, herramienta/versión, comando, entorno, datos, rutas, resultado, enlace al reporte, limitaciones y responsable. Si falla el arranque por una dependencia, registrar ese fallo y lo que sí pudo inspeccionarse. No escribir “todo pasa” cuando una suite no pudo correr.

Una captura debe tener contexto: ruta, rol, viewport, tema y estado. Nombrarla de forma estable y usar datos ficticios o anonimizados para no filtrar información real.

## Política de regresiones

Reproducir, localizar causa, corregir y repetir la prueba que demuestra el fallo junto con los checks afectados. No ampliar indefinidamente la verificación cuando ya se resolvió el riesgo y se cumplen gates. Flakiness requiere diagnóstico: reintentar puede ayudar a identificar variabilidad, pero un éxito tras varios fallos no demuestra estabilidad.

## Aceptación final de QA

Q01–Q16 aplicables trazados a evidencias. Sin defectos P0/P1 conocidos en alcance. Defectos visuales menores no esconden barreras de uso. Resultados no ejecutados diferenciados. El reporte permite que otra persona repita las comprobaciones importantes.
