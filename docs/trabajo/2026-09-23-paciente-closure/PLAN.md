# Plan local — cierre funcional de Paciente (frontend)

- Fecha: 2026-09-23 · Repo: `mantra-core-health` · Rama: `justin/patient-closure-h1` · base `dev` (`4fd9f9f9ef26a0a166a5d724bd97bdf4e3d30ec8`).
- Fuente funcional única: [plan maestro](../../../../MetaPrompts/PLAN_PACIENTE_01_METAPROMPT_17b41ce468a1_2026-09-23/PATIENT_PLAN_01_METAPROMPT_2026-09-23.md); [metaprompt literal](../../../../MetaPrompts/PLAN_PACIENTE_01_METAPROMPT_17b41ce468a1_2026-09-23/SOURCE.md), SHA-256 `17b41ce468a147a4a4e97cc3b028869bed4088fe314845e3e8bf3f28f7f2b9b5`. El maestro contiene los 71 IDs, criterios CA/DoD, límites y decisiones. No derivar alcance de otros metaprompts.
- Estado actualizado 2026-09-24: PARCIAL. H0.S2.M2 real aprobado; copagos 5/5 a 1440/390 px y route health recorrido, con hallazgos. El resultado consolidado está en [REPORTE.md](../../../../MetaPrompts/PLAN_PACIENTE_01_METAPROMPT_17b41ce468a1_2026-09-23/REPORTE.md). No se cerró ningún criterio fuente completo.
- Resultado observable: el portal Paciente consume contratos existentes para identidad, perfil, agenda, documentos/resultados y pedidos/coberturas sin duplicar fuente de verdad ni inventar respuestas externas.
- Kill-test: paciente sintético registra y edita una ubicación, recibe una orden de médico sintético, cierra sesión y vuelve a leer el mismo paciente/dato/autor desde API y BD.

## Alcance

- IN: tareas FE M2 de H1–H6 y verificación FE de H7 según el maestro; pruebas de cliente/componente y journeys contra API/BD únicamente si el entorno es desechable.
- OUT: `.env`, `proxy.conf.json`, modelo, servicios API/Móvil compartidos, integraciones externas no contratadas, cobro/delivery, cambios a pruebas ajenas y trabajo visual de correcciones 31–40.
- Decisiones: D02, D03, D04, D05, D06, D07, D08, D10 y D11 del maestro quedan explícitas; no inventar Google/SEGIP, acuerdos de aseguradora, firma clínica ni autorización jurídica.

## Hitos y microtareas

- H0 (línea base/contratos): baseline FE 578/579 archivos y 7.308/7.310 pruebas, dos fallas visibles en `shell-layout`; H0.S2.M2 completada con API/BD desechables y lectura SQL.
- H1 (alta/perfil), H2 (representación), H3 (agenda), H4 (documentos/avisos), H5 (pedidos sin cobertura), H6 (cobertura): para cada subtarea, ejecutar sus M2 individualmente después de M1 API y antes de M3 persistida. El CA y DoD exactos son los del maestro; no sustituir persistencia por mocks.
- H7: ejecutar negativos, visual/accesibilidad, exclusiones y regresión tal como están detallados en el maestro. No declarar `HECHO` sin salida de comando, y para Playwright sin inspección/capturas.

| Unidad | Criterio de aceptación | DoD local | Estado inicial |
|---|---|---|---|
| H0.S1.M2 | Dado el SHA FE aislado, cuando corre la suite completa, queda conteo exacto. | `corepack yarn test --watch=false`; conservar stdout completo. | HECHO (baseline, con 1 archivo/2 casos fallidos) |
| H0.S2.M2 | Dado paciente sintético, conserva ubicación, orden y autor entre sesiones. | Playwright real + consulta SQL de sólo lectura. | HECHO; 1/1; evidencia en REPORTE maestro |
| H1–H6 M2 | Dada una respuesta de API conforme al DTO actual, cuando el paciente completa la acción, se muestran campos/estados/manejo de error del criterio origen. | Agregar/verificar el spec dirigido por subtarea, ejecutar `corepack yarn test --watch=false --include=<spec>` y gates FE. | TODO |
| H7.S2.M1 | Dadas las vistas del flujo, cuando se recorren en los anchos definidos en el maestro, funcionan foco/labels/estados visuales. | Playwright real con servidor/API autorizados, capturas revisadas y reporte. | PARCIAL; 390/1440 revisados; escritorio requiere revisar panel superpuesto y falta 768 |
| H7.S4.M1–M2 | Dada la rama final, cuando corren gates/regresión, conteos no empeoran y rutas se mantienen. | typecheck, lint, build, suite completa y route-health; salida guardada. | PARCIAL; FE lint y 28 hallazgos de rutas pendientes |

## Reglas de ejecución

TDD por microtarea: primero prueba que reproduzca la brecha; nunca `skip`/`only` ni debilitar aserciones; cambio mínimo; test dirigido; typecheck/lint; revisión del diff. Sólo usar el stack `patient-copays-17b41ce4` confirmado y otros entornos cuya base se compruebe aislada antes del reset; nunca la DB local compartida.
