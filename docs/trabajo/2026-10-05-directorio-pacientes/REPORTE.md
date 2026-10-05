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
- Qué anda: frontend dev/test build producción, types, lint y regresión218/214 PASS; API dev types/build PASS; lint global final dev con cuatro errores de formato heredados; API test types/build/lint dirigido PASS, unit70/74 y SQL9 por variante PASS.
- Qué no anda: BASELINE-LINT-TEST: 53 errores Prettier en cinco archivos idénticos a origin/test; BASELINE-OPENAPI: test conserva dos operaciones públicas sin security; dev final conserva tres, incluida upload-registration-signature-image, todas idénticas a origin/dev. BASELINE-LINT-DEV: cuatro errores Prettier en concepts.service.ts idéntico a origin/dev. BASELINE-CLAIMS-DEV: aserción de roles de reclamos incompatible con su controller; ambos archivos idénticos a origin/dev. CI antiguo API dev falló por ese caso.
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
- Dónde quedó: frontend960/956 y API572/573 (anteriores955/567/568 mergeados externamente), con reportes y referencias cruzadas.

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

INSURANCE_OPERATOR restringido a su aseguradora; cobertura vigente para aseguradoras, padrón global administrativo autorizado mediante opt-in limitado al directorio. POST y allowlist eliminan filtros de URLs y campos ajenos. Logs HTTP reales27 por variante sin query/body/auth; supresión SQL limitada a consultas sensibles. Push y PR anticipados solicitados por usuario. API567/568 y frontend955 se mergearon desde fuera de esta sesión el2026-10-05 entre17:05Z y17:07Z; no lo hizo este agente. Se abrieron API572/573 y frontend960 para los cambios posteriores; frontend956 sigue abierto. Se incorporaron esas nuevas bases por merge limpio. Sin merge/deploy ni solicitudes de review a terceros por este agente. Configuración local y cache auth ignorados, no versionados. Stack sintético propio cerrado con compose down sin-v; tres volúmenes conservados y Docker Desktop intacto. Ninguna ambigüedad adicional.

## Actualización tras merges externos

- API dev base75383cce y test6a6d3442 incorporadas. Nuevos cambios de base: documentación, catálogos/formularios clínicos y perfiles/tutores/terminología en dev. Código de autorización, consulta y comunidad del directorio sin cambios. Frontend dev baseea9b72b9 incorporada sin cambiar contenido respecto a la instantánea validada; test base5ab13bbb incorporada por fast-forward sin diferencias de contenido respecto a17d0f205.
- Frontend956 se mergeó externamente el2026-10-05T17:25:00Z con head17d0f205: incluye la última prueba real y28 capturas. El seguimiento frontend abierto es960; los cambios funcionales de test ya están incorporados. El reporte adicional de cierre se publica en dev; no se abre un PR de test sólo para duplicar este estado documental.
- Conflicto OpenAPI dev: se leyó el contenido entrante, se conservaron todos sus paths/schemas ajenos y se regeneró sólo el directorio desde el controller real; comparación estructural no-directory PASS. No se eligió un archivo entero ignorando la otra funcionalidad.
- Compatibilidad final API: dev e9708dc9 types/build y70 unit PASS; test d125415b types/build y74 unit PASS. Lint global final dev4 FAIL/test53 FAIL; OpenAPI global final dev3 FAIL/test2 FAIL, todos de base demostrados. Lint dev anterior PASS corresponde a la base previa, no al código final.
- La integración real anterior sigue referida a sus SHAs explícitos; no se presenta como reejecutada después. Los formularios clínicos nuevos no forman parte de la fixture QA con SEED_CONTENT_ON_BOOT=false. Tutores y búsqueda general de terminología no se ejercitaron en este alcance.

## Estado de PR consultado después de publicar código y QA

- Frontend960 — OPEN, isDraft=false, MERGEABLE, UNSTABLE; dependencias/e2e/verificar pending. Consultado2026-10-05T17:51:58Z tras push0037e10a. [Salida literal](./evidencia/pr-960-mergeable.txt).
- Frontend956 — MERGED externamente, head17d0f205; checks históricos pendientes. Consultado2026-10-05T17:52:01Z. [Salida literal](./evidencia/pr-956-mergeable.txt). UNKNOWN en mergeable corresponde al PR cerrado, no a un PR abierto entregado como listo.
- API572 — OPEN, MERGEABLE, BLOCKED por review pendiente y CI docs pending; API573 — OPEN, MERGEABLE, CLEAN, sin checks configurados. Gates globales locales heredados siguen FAIL.
- Runner marcelo-wsl-front offline demostrado en ci-runner-status.txt. No se usa una espera indefinida de checks mientras no existe runner operativo; pruebas locales y stack real se ejercitaron de forma aislada.
- Entrega A MEDIAS; no se mergea ni se despliega por este agente. La publicación siguiente sólo versiona esta evidencia; se vuelve a consultar tras el último push en el cierre.
## Última base frontend incorporada

- origin/dev avanzó aa9453c0e (tutores/perfil) después de la consulta de PR anterior. Merge limpio35f187f7; directorio, cliente y specs sin diferencias respecto a la versión validada. Sin cambios de dependencias.
- frontend-dev-finalbase-typecheck.txt y frontend-dev-finalbase-lint.txt: EXIT_CODE=0. frontend-dev-finalbase-unit.txt: 11 suites/218 tests PASS,27.80s. El push ejecuta el hook de build de producción; su resultado se añade a evidencia al finalizar.
- Estos cambios de tutores/perfil no se ejercitan funcionalmente en esta tarea. Las pruebas reales conservan sus SHAs originales y no se presentan como reejecutadas sobre esta última base.

## Build final frontend y publicación

- Push24b5be17 ejecutó el hook de producción sin bypass sobre la basea9453c0e: PASS. [Salida completa](./evidencia/frontend-dev-finalbase-push-build.txt).

```text
COMMAND: git push origin marcelo/insurer-patient-directory-dev (native production build hook)
Application bundle generation complete. [92.493 seconds] - 2026-10-05T18:02:26.004Z
pre-push: la construcción pasó. Empujando.
EXIT_CODE=0
```

- El commit posterior sólo versiona la evidencia y no cambia código; se consulta nuevamente PR960 tras ese push. La entrega global continúa A MEDIAS por gates heredados y CI/revisión.

## Estado externo final observado

- API572 se mergeó externamente2026-10-05T18:05:27Z, headf2ae8e94, mergea9091f6c; API573 se mergeó externamente18:05:39Z, heada1360f74, merge0843cc86. Ramas locales/remotas actualizadas por fast-forward, sin cambios de contenido.
- CI API572 finalmente FAIL por los mismos cuatro errores Prettier de concepts.service.ts ya demostrados idénticos a la base. [Fragmento literal](./evidencia/ci-api-final-lint-baseline.txt). No falló una prueba del directorio en esa corrida: el gate lint detuvo el workflow.
- Frontend956 ya mergeado externamente; seguimiento frontend960 continúa abierto con CI pendiente por runner offline. La entrega global sigue A MEDIAS aunque otros actores hayan realizado merges.
- No se abren nuevos PR sólo para reescribir el estado histórico de reportes ya mergeados. Este cierre conserva sus fechas/SHAs y agrega los hechos posteriores.
