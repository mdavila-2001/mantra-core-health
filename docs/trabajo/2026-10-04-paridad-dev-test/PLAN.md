# Plan — Paridad funcional Dev/Test

- Fecha: 2026-10-04 · Repo: frontend · Destinos: dev y test.
- Resultado: ambos destinos conservan las funcionalidades de las ramas actuales.
- Kill-test: un destino carece de los cambios del otro o el código no compila.

## Alcance
Integración de las ramas actuales, conflictos semánticos y preservación de correcciones locales ya publicadas. Sin reseed ni restauración de datos. Despliegue después de validar el artefacto.

## H1 — Código reconciliado
**CA:** Dadas ambas ramas, cuando se integran, entonces se conservan las funcionalidades exclusivas de cada una.
**DoD:** merge de tres vías con base remota, revisión de conflictos, git diff --check.
**Estado:** HECHO
### H1.S1 — Preparar integración
**CA:** No quedan marcadores de conflicto y se conservan contratos y tests relevantes.
**DoD:** inspección del diff y comparación de árboles.
**Estado:** HECHO
| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H1.S1.M1 | Integrar código | Cuando se comparan las ramas, se conservan ambos conjuntos funcionales | git merge-tree con base obtenida de GitHub; conflictos revisados | HECHO |

## H2 — Validación y despliegue
**CA:** Cuando se construye y prueba el artefacto final, entonces los checks pasan y se observa la versión ejecutada.
**DoD:** CI, builds y verificación de despliegue.
**Estado:** BLOQUEADO
### H2.S1 — Validar y ejecutar
**CA:** Builds/tests verdes y versión observada en servidor.
**DoD:** CI del SHA final, identificación de imagen y sondas HTTP.
**Estado:** BLOQUEADO
| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H2.S1.M1 | Validar compilación y tests | El runner termina con salida 0 | CI del commit final; no hay Node/Docker accesibles en esta sesión | BLOQUEADO |
| H2.S1.M2 | Desplegar | El servidor ejecuta el artefacto validado | Build y recreación dirigida; versión y salud | BLOQUEADO |
