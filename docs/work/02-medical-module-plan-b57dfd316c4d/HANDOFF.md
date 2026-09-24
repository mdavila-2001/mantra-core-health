# Handoff — ejecución del plan Médico

- Plan único: 02-medical-module-plan-b57dfd316c4d.
- Fuente normativa congelada: 02_METAPROMPT_MEDICO.md, SHA-256 b57dfd316c4d642eb5e1db49257397b8fd2864b511317282ae4b70ff1262a656.
- Estado integral: 0/98 criterios IN alcanzan el DoD end-to-end; matriz: 70 A MEDIAS, 11 TODO, 17 BLOQUEADOS, 2 DESCARTADOS.
- Frontend: rama justin/medical-module-cierre, worktree wt-medical-module-closure. Base actual origin/mockup b11dfdd382dd787fab33d5894979ccc2c4d5a96a. Los cambios de esta rama son documentales, no de producto.
- API: rama justin/medical-module-cierre-api, worktree wt-medical-module-api; base origin/dev 7541797cd93dfe3cde50c8a7fd3bf404cc709f12. Solo auditoría y pruebas; no se editó producto API ni modelo.
- Frontend verificado en esta continuación: typecheck exit 0; filtro médico específico 7 archivos y 381 pruebas aprobadas; sin suites de perfil Paciente; suite completa 583 archivos y 7.375 pruebas aprobadas; lint exit 1 con 246 errores @angular-eslint/prefer-on-push-component-change-detection.
- Los rojos históricos nombrados por AGENTS.md (aviso-de-demora, identity-verification, shell-layout) pasan dentro de la suite completa actual; se conservaron sus registros históricos y ninguna prueba se omitió o debilitó.
- Inspección visual Playwright del perfil médico en mock, viewport 1440×1000: body blanco, app-main__inner 1200 px y app-card 1120 px (93,3 %, centrada con márgenes iguales de 40 px). Es una sola ruta auditada; no es evidencia antes/después de corrección y no marca criterio HECHO.
- MED-05 queda A MEDIAS / TESTED: creación/listado de sedes y GPS cubiertos por pruebas frontend con dobles; integración/persistencia real pendiente.
- MED-06 pasa de TODO a A MEDIAS para razón social y NIT (taxHolderName/taxId) porque ficha/editor y tests con dobles existen. Los otros 11 criterios fiscales siguen TODO; ninguno de los dos campos se certifica API→DB→recarga.
- API: typecheck/lint/OpenAPI aprobados; 21 suites unitarias/505 pruebas aprobadas; integración aislada de registro profesional 8/8 en base desechable con semillas parciales. Suite completa agotó heap de 6 GB; el lote de integración tuvo ECONNREFUSED 127.0.0.1:55433.
- DDL canónica: init detenido por patch de aseguradoras que exige 17 catálogos antes del seeder. La copia temporal no canónica y la carga parcial del modelo no cierran integración.
- Docker local dejó de responder después de pruebas; no reiniciar mientras pueda afectar servicios compartidos.
- E2E carril-19 quedó bloqueado en beforeAll por API local no saludable; no se guardaron fotos de ese recorrido. No se modificó la interfaz, no existe antes/después ni se asignó una ficha TAREA-31..40 a un hito H1..H8 por inferencia.
- Las ramas justin/medical-module-cierre y justin/medical-module-cierre-api están publicadas en sus origin; no se abrió PR, no se mergeó ni desplegó.

## Para continuar

1. Resolver con el responsable del modelo/DDL el orden del catálogo canónico; levantar un entorno Docker desechable estable con datos sintéticos y sin leer .env administrado.
2. Recuperar API/DB saludable y ejecutar journeys MED-E01–E17 desde interfaz hasta persistencia/recarga y segundo actor; conservar fallos reales.
3. Cerrar las ambigüedades externas de DECISIONS.md y contratos de CONTRACTS.md con sus propietarios; no simular SEGIP, TOUS, sala, cobertura, pagos ni lotes.
4. Para cualquier cambio visual, usar una ficha 31–40 que aplique literalmente, correr scripts/corr-evidencia.sh NN antes/después con --workers=1, hacer typecheck/lint/spec dirigido y documentar fotos inspeccionadas. No mapear Hn a NN arbitrariamente.
5. Repetir E2E/regresión solo cuando API/DB requerida esté disponible o si aparece un diff nuevo; no debilitar tests ni marcar HECHO sin aceptación integral y evidencia.
6. Mantener separado el trabajo de Paciente; no editar sus ramas/worktrees ni duplicar sus flujos de identidad.

La instrucción del usuario autoriza ejecutar el plan y publicar la rama. El AGENTS.md del workspace sigue acotando producto frontend a visual y excluye API/modelo, .env y proxy.conf.json. Esta rama deja el estado exacto para continuar; no es una declaración de plan completado.
