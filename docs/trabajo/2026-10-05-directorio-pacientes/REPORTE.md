> **AVANCE: 4 / 12 — 33,3 %.**

# Reporte parcial — Directorio de pacientes

Fecha: 2026-10-05. Plan: [PLAN.md](./PLAN.md). Ramas: marcelo/insurer-patient-directory-dev y marcelo/insurer-patient-directory-test.
Estado: A MEDIAS. Publicación anticipada en PR borrador solicitada por el usuario; pruebas restantes continúan después del push.

## Completado
| ID | Resultado | Verificación |
|---|---|---|
| H1.S1.M1 | Base dev incorporada en ambos repositorios | git merge-base --is-ancestor: exit0, evidencia/h1-bases.txt |
| H1.S1.M2 | Base test incorporada en ambos repositorios | git merge-base --is-ancestor: exit0, evidencia/h1-bases.txt |
| H2.S2.M1 | Cliente POST mínimo y sin filtros en URL | frontend-regression-pass.txt: 218 passed en 11 suites, incluye cliente |
| H2.S2.M2 | Cancelación, debounce, filtros y estados | misma regresión, incluye 24 tests del directorio |

## A medias
- H2.S1.M1/M2/M3: consulta, acceso, chat y DTO escritos. 39 unit anteriores PASS; última ejecución de autorización: 3 failed, 67 passed. Se corrigió la rama faltante del interceptor; falta reejecutar y generar OpenAPI. Archivos en src/modules/insurance y src/common, rama dev; compilación final API pendiente.
- H2.S2.M3: tabla y tarjetas escritas. Build frontend final exit0 y prueba Chrome 390px PASS. Falta matriz completa y revisión independiente. Archivos insurance-patients; compilación frontend verificada.
- H3.S1.M1: frontend lint/typecheck/build y 218 pruebas PASS; API typecheck anterior PASS. Falta API final y comprobación de variantes test después de propagación.
- H3.S1.M2/M3: integración real escrita pero sin ejecutar; primera captura móvil revisada, segunda revisión pendiente. Falta stack sintético Docker, persistencia, kill-test y matriz visual.
- H3.S1.M4: propagación de correcciones a test durante esta publicación; faltan gates de esa variante. No se mergea a integración.

## Pendiente
Ninguna microtarea descartada. Continúa la verificación indicada en A medias.

## Evidencia
Evidencia literal en la carpeta evidencia/ de cada repositorio. Frontend: frontend-regression-pass.txt, frontend-build-final.txt, frontend-build-runtime.txt, frontend-lint.txt, frontend-browser-inner.txt y capturas directory-390. API: api-unit-privacy-final.txt, api-unit-auth-final.txt, nota-api.md y h1-bases.txt. El fallo final API no queda invalidado hasta una reejecución PASS.

## No cubierto
SQL real, aislamiento en ejecución, revocación de membresía/cobertura, reutilización persistida de conversación, navegador con API real, matriz responsive completa, segunda revisión visual y gates finales test.

## Desvíos del plan
Push y PR borrador antes de concluir QA por instrucción explícita del usuario. AppModule permite DOTENV_CONFIG_PATH para aislar QA local; valor predeterminado sigue .env. Autorización global requiere metadata opt-in de tenant únicamente en directorio.

## Riesgos residuales
PR no listo para merge: API final sin reejecutar tras fallo; OpenAPI pendiente. Docker operativo, stack aislado aún no iniciado. No afirmar conformidad total ni mergeabilidad hasta gates finales. Configuración local y tokens sintéticos no se versionan.

## Decisiones y ambigüedades
Conservar INSURANCE_OPERATOR limitado a aseguradora. Publicar borradores y continuar pruebas; ningún despliegue ni merge automático. Ninguna ambigüedad adicional.
