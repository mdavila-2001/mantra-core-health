# Reporte — Paciente en el circuito de Laboratorio

## Estado: parcial — regresión visual y evidencia actualizadas; H1–H6 sin certificación funcional

La rama está sobre `mockup` SHA `a43ad2b311e1a69ff708fba5cef1e5a2100bbbc2`. El aviso compacto móvil ya llegó a esa base mediante PR #598 / commit `9d3f4b54`; esta rama aporta sólo una prueba de regresión y su evidencia. No hay cambios propios de UI, API, modelo ni configuración.

La regresión cubre cinco rutas actuales (`/laboratory-directory`, `/my-account/appointments`, `/my-account/diagnostic-orders`, `/my-account/diagnostic-results`, `/my-account/promotions`) en 320, 375, 390, 768, 1024, 1440 y 1920 px. Confirma el título de cada ruta, el nombre accesible y rótulo visible del aviso, abrir/cerrar y cero intersección con el control de tema: 35 combinaciones aprobadas. Se dejó fuera `/my-account/loyalty`, que en este `mockup` redirige a `/my-account` según el comentario N-03/Q-17 de `src/app/app.routes.ts`; una auditoría temporal confirmó el desvío a «Mi perfil», y su salida se descartó.

El auditor oficial, ejecutado en una copia física aislada de esta base con el manifiesto del carril filtrado a las cinco rutas actuales, midió 20 celdas y obtuvo cero rojos. Las [20 capturas](evidence/visual/corr-34-responsive-current-mockup/MATRIZ-visual.md) se abrieron manualmente. La navegación fija cubre parte del contenido en las ocho capturas 1440 `fullPage` de las cuatro rutas de cuenta; se documenta como limitación del formato de captura. Para revisar el aviso se usan las siete capturas de viewport bajo `test-viewports/`.

Las capturas actuales muestran `Demo` debajo del encabezado en pantallas angostas; el nombre accesible conserva «Datos de prueba». El texto completo reaparece en anchos mayores. La [comparación visual](evidence/visual/REPORT.md) enlaza una captura anterior al arreglo y una captura actual. La resolución del banner llegó en upstream y no se atribuye a este diff.

## Verificación

- `E2E_BASE_URL=http://127.0.0.1:4300 corepack yarn pw playwright/mock-banner-responsive.spec.ts --workers=1`: PASS, 35 combinaciones.
- `E2E_BASE_URL=http://127.0.0.1:4300 CORR_USUARIO=paciente scripts/corr-evidencia.sh 34 --auditoria`: PASS, 20/20 en copia aislada; [matriz y log](evidence/visual/corr-34-responsive-current-mockup/).
- `corepack yarn typecheck`: PASS.
- `corepack yarn build`: PASS, con avisos Angular conocidos de CommonJS/deprecación.
- `corepack yarn eslint playwright/mock-banner-responsive.spec.ts`: PASS.
- Los tres rojos históricos nombrados por `AGENTS.md` pasaron en sus specs dirigidas: `aviso-de-demora.spec.ts` (55), `identity-verification.spec.ts` (20) y `shell-layout.spec.ts` (55). No se omitió ni debilitó ninguno.
- `corepack yarn lint`: FAIL, 246 errores del estado base, fuera del diff.
- `corepack yarn test --watch=false`: 7.322 PASS, 1 FAIL/7.323. El único rojo está en `src/app/core/mock/handlers/insurance-analytics.handlers.spec.ts`, sobre conteo de coberturas sin prima; no se cambió ni debilitó.
- `corepack yarn pw playwright/carril-19-route-health.spec.ts --workers=1`: falla en `beforeAll` porque la API no responde en `localhost:3005/health`; los otros tres barridos no corren.

La auditoría global anterior de 54 rutas y 216 celdas se hizo sobre la base antigua `b7785e362a7ccfbbd0665b1863eab92b65ea4137`; es histórica, no se repitió sobre el `HEAD` actual y sus fotos globales no se declaran revisadas.

## Alcance funcional pendiente

H1 oferta, H2 disponibilidad/reserva/preparación, H3 cobertura, H4 resultados/factura, H5 beneficios y H6 persistencia multiusuario no quedan certificados por la maqueta. `AGENTS.md` restringe esta ejecución a lo visual y prohíbe tocar API/modelo/`.env`/`proxy.conf.json`; los acuerdos comerciales y dependencias de otros módulos tampoco están disponibles. En esta base, «Promociones» sólo habla de farmacias y la pantalla de Puntos ya no tiene ruta activa. La evidencia actual no afirma disponibilidad de horarios de laboratorio, pólizas reales, entrega de notificaciones, factura externa, canje ni persistencia.

No se escribió `docs/progress/evidence/lane-34/REPORT.md`: el archivo y la matriz global quedaron protegidos por el incidente previo. La revisión se mantiene bajo el ID único del plan. El archivo ajeno `docs/trabajo/2026-09-22-ender-simulador-cabecera/evidencia/antes/latencia-observada-raw.txt` apareció modificado durante esta ejecución y se preserva sin incluirlo en la rama.
