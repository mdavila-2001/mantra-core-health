# Reporte — Directorio de pacientes

- Fecha: 2026-10-05 · Plan: [PLAN.md](./PLAN.md).
- Ramas: marcelo/insurer-patient-directory-dev y marcelo/insurer-patient-directory-test.
- Entorno: Windows, Chromium y AppModule/PostgreSQL sintéticos reales aislados en Docker.
- Versión de código validado: dev484bb11d / testfef6aba2; dos capturas adicionales ejercitadas en corrida real final. Los commits posteriores de cierre sólo agregan pruebas/evidencia/documentación.
- Peldaño: VERIFIED para el directorio y chat; no REGRESSION_VERIFIED global. Entrega A MEDIAS.
- Avance: 10 / 13 (76.92 %), contado por microtareas HECHO.

## Completado

| ID | Qué se logró | Comando / evidencia | Resultado |
|---|---|---|---|
| H1.S1.M1 | Base dev incorporada por merge y build PASS | git merge-base --is-ancestor origin/<base> marcelo/insurer-patient-directory-<base> | exit0 |
| H1.S1.M2 | Base test incorporada por merge y build PASS | git merge-base --is-ancestor origin/<base> marcelo/insurer-patient-directory-<base> | exit0 |
| H2.S1.M1 | Cobertura vigente, alcance autorizado, conteo exacto y paginación SQL | reporte API; frontend-browser-real.txt; frontend-browser-real-test-api.txt | PASS |
| H2.S1.M2 | Conversación interna reutilizada; acceso revalidado y persistencia comprobada | reporte API; frontend-browser-real.txt; frontend-browser-real-test-api.txt | PASS |
| H2.S1.M3 | POST y DTO mínimo publicados en OpenAPI; contrato dirigido comprobado | reporte API; frontend-browser-real.txt; frontend-browser-real-test-api.txt | PASS |
| H2.S2.M1 | Cliente POST, body mínimo y ausencia de filtros en URL | frontend-dev-regression-current.txt; frontend-test-regression.txt; frontend-browser-final-pass.txt | PASS |
| H2.S2.M2 | Debounce/cancelación, filtros, estados, reintento y contador | frontend-dev-regression-current.txt; frontend-test-regression.txt; frontend-browser-final-pass.txt | PASS |
| H2.S2.M3 | Siete columnas, tarjetas y mensajería primaria | frontend-dev-regression-current.txt; frontend-test-regression.txt; frontend-browser-final-pass.txt | PASS |
| H3.S1.M2 | Recorrido real en ambas variantes; kill-test y reutilización persistida PASS | reporte API; frontend-browser-real.txt; frontend-browser-real-test-api.txt | PASS |
| H3.S1.M3 | 28 capturas finales revisadas dos veces, segunda independiente/adversarial | doble-revision.md; revision-visual-p2.md | PASS |

## A medias

### H3.S1.M1 — Gates globales
- Qué anda: frontend dev/test build producción, types, lint y regresión218/214 PASS; API dev types/build/lint PASS; API test types/build/lint dirigido PASS, unit70/74 y SQL9 por variante PASS.
- Qué no anda: BASELINE-LINT-TEST: 53 errores Prettier en cinco archivos idénticos a origin/test; BASELINE-OPENAPI: dos operaciones públicas heredadas sin security. BASELINE-CLAIMS-DEV: aserción de roles de reclamos incompatible con su controller; ambos archivos idénticos a origin/dev. CI antiguo API dev falló por ese caso.
- Qué falta exactamente: propietarios de las bases deben corregir esos gates ajenos al directorio; repetir gates globales tras integrar sus correcciones. No se relajan permisos ni aserciones.
- Dónde quedó: evidencia API api-test-baseline-gate-failures.txt, api-test-lint-final.txt, api-test-openapi-lint-rechecked.txt, api-dev-claims-baseline-regression.txt y ci-docs-baseline-failure.txt.

### H3.S1.M4 — Propagación
- Qué anda: cambios comunes del directorio aplicados en dev/test, conservando sus bases y dependencias; tipos/build y pruebas dirigidas PASS en ambas. Helper de mocks sólo en test.
- Qué no anda: el DoD pide gates globales PASS; persisten los fallos de base anteriores.
- Qué falta exactamente: corregir las bases y revalidar gates, sin trasladar funcionalidades generales entre variantes.
- Dónde quedó: ramas existentes, sin merge a integración.

### H3.S1.M5 — Entrega de PR
- Qué anda: cuatro PR publicados por pedido del usuario; actualización API primero y frontend después, sin force ni merge. Estado literal en evidencia/pr-<n>-mergeable.txt.
- Qué no anda: CI frontend pendiente por runner self-hosted marcelo-wsl-front offline; API dev tiene fallo histórico de reclamos; globales heredados aún rojos. No se afirma entrega mergeable completa.
- Qué falta exactamente: reactivar runner frontend y corregir gates heredados; comprobar checks tras el último push y revisión humana antes de merge.
- Dónde quedó: frontend955/956 y API567/568, con reportes y referencias cruzadas.

## Pendiente

| ID | Estado | Qué lo destraba |
|---|---|---|
| H3.S1.M1 | A MEDIAS | Correcciones de base de lint, OpenAPI y permisos/prueba de reclamos |
| H3.S1.M4 | A MEDIAS | Gates globales tras incorporar dichas correcciones |
| H3.S1.M5 | A MEDIAS | Runner operativo, checks terminales y revisión humana |

## Evidencia

Las salidas siguientes son fragmentos literales de logs conservados; los comandos completos constan en esos archivos. API y navegador real no usan mocks; los14 casos @ui-mock sí interceptan HTTP para comprobar exclusivamente interfaz.

### frontend-dev-typecheck-current.txt

[Salida completa](./evidencia/frontend-dev-typecheck-current.txt)

```text
EXIT_CODE=0
```

### frontend-dev-lint-current.txt

[Salida completa](./evidencia/frontend-dev-lint-current.txt)

```text
EXIT_CODE=0
```

### frontend-dev-regression-current.txt

[Salida completa](./evidencia/frontend-dev-regression-current.txt)

```text
 Test Files  11 passed (11)
      Tests  218 passed (218)
EXIT_CODE=0
```

### frontend-test-typecheck.txt

[Salida completa](./evidencia/frontend-test-typecheck.txt)

```text
EXIT_CODE=0
```

### frontend-test-lint.txt

[Salida completa](./evidencia/frontend-test-lint.txt)

```text
EXIT_CODE=0
```

### frontend-test-regression.txt

[Salida completa](./evidencia/frontend-test-regression.txt)

```text
 Test Files  11 passed (11)
      Tests  214 passed (214)
EXIT_CODE=0
```

### frontend-push-dev-final.txt

[Salida completa](./evidencia/frontend-push-dev-final.txt)

```text
EXIT_CODE=0
```

### frontend-push-test-final.txt

[Salida completa](./evidencia/frontend-push-test-final.txt)

```text
EXIT_CODE=0
```

### frontend-browser-final-pass.txt

[Salida completa](./evidencia/frontend-browser-final-pass.txt)

```text
  14 passed (39.9s)
EXIT_CODE=0
```

### frontend-browser-real.txt

[Salida completa](./evidencia/frontend-browser-real.txt)

```text
  1 passed (4.9s)
EXIT_CODE=0
```

### frontend-browser-real-test-api.txt

[Salida completa](./evidencia/frontend-browser-real-test-api.txt)

```text
  1 passed (5.6s)
EXIT_CODE=0
```

## No cubierto

No se ejecutó localmente la suite total del producto. CI antiguo API dev sí la ejecutó: 9948 PASS y una falla de reclamos, una prueba omitida preexistente; no es evidencia del último commit. Otros navegadores, lector de pantalla, zoom y contraste numérico no ejercitados. No se envió un mensaje: apertura, recarga, compositor y reutilización sí comprobados. Exportador OTEL desactivado en QA; supresión SQL comprobada con unit/contexto y SDK, sin captura real de spans. Sin datos de producción ni despliegue.

## Desvíos del plan

Bases avanzaron durante QA y se integraron mediante merge limpio. Se corrigió Seguro oculto a1024 con sidebar usando ancho del contenedor y recapturas. Test de chat seleccionaba tabla oculta; selector adaptado sin debilitar requisito. Vacío filtrado estabilizado con viewport explícito/reducedMotion. Primer SQL falló por bootstrap de formularios clínicos; QA usa opción nativa de seeds core, sin ampliar timeout. Segunda corrida falló por fixture sin tenant y se corrigió el request según contrato. Navegador real inicialmente seleccionaba el valor interno Angular; corregido por etiqueta visible. Error TypeScript reducedMotion resuelto mediante API real page.emulateMedia. Logs FAIL se conservan. Hubo una llamada lint que retornó sessionID antes de confirmar fin al iniciar integración; cierre PASS comprobado inmediatamente, desviación registrada.

## Riesgos residuales

CI externo y gates de base bloquean cierre global. Reserva visual MENOR: cola del placeholder del buscador cortada a1024, label accesible completo y control funcional.28 capturas finales inspeccionadas por P1 y P2 independiente, sin MAYOR/BLOQUEANTE; directorio ACEPTABLE CON RESERVAS, estados y dos reales APROBADOS. Captura histórica de fallo inspeccionada en ambas pasadas fue borrada por limpieza de Playwright; no se usa como evidencia positiva ni se simula su recuperación. Diferencia218/214 responde a pruebas propias de las bases, sin borrar tests.

## Decisiones y ambigüedades

INSURANCE_OPERATOR restringido a su aseguradora; cobertura vigente para aseguradoras, padrón global administrativo autorizado mediante opt-in limitado al directorio. POST y allowlist eliminan filtros de URLs y campos ajenos. Logs HTTP reales27 por variante sin query/body/auth; supresión SQL limitada a consultas sensibles. Push y PR anticipados solicitados por usuario; no merge/deploy ni solicitudes de review a terceros. Configuración local y cache auth ignorados, no versionados. Stack sintético propio cerrado con compose down sin-v; tres volúmenes conservados y Docker Desktop intacto. Ninguna ambigüedad adicional.
