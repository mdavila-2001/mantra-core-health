# Auditoría oficial dirigida — base `mockup` actual

- Fecha de la matriz: 2026-09-24 03:31 UTC.
- ID de plan: `Plan_Paciente_Laboratorio_2026-09-23_bb8a5f72a192`.
- Rama auditada: `justin/mockup-corr-34-fondo-blanco-ancho-completo`.
- Base y `HEAD`: `a43ad2b311e1a69ff708fba5cef1e5a2100bbbc2` (`origin/mockup`).
- Código de UI: incluye el arreglo del aviso móvil de PR #598 / commit `9d3f4b54`; esta rama no cambia el componente.
- Comando: `E2E_BASE_URL=http://127.0.0.1:4300 CORR_USUARIO=paciente scripts/corr-evidencia.sh 34 --auditoria`.
- Aislamiento: copia física temporal en `/private/tmp/mch-plan-paciente-corr34-current-20260924/project`; los archivos del auditor y el spec se copiaron sin cambios. Sólo se filtró `playwright/corr-rutas.json` en esa copia para no escribir el destino global del carril y medir estas rutas actuales: `/laboratory-directory`, `/my-account/appointments`, `/my-account/diagnostic-orders`, `/my-account/diagnostic-results` y `/my-account/promotions`.
- Salida: `1 passed (37.6s)`, 20 celdas, 0 rojos. Todas las 20 imágenes se abrieron manualmente; la [matriz](MATRIZ-visual.md) registra PASS en los cinco criterios medidos.
- Revisión visual: 375/768/1440 claro y 1440 oscuro. Las ocho capturas 1440 `fullPage` de las cuatro rutas de cuenta muestran el menú fijo por encima de contenido largo; se conservan como diagnóstico del formato de captura y no se usan para afirmar que el layout de página larga está visualmente cerrado. Las capturas de viewport de la regresión comprueban el aviso y sus controles sin ese artefacto.
- Ajuste de rutas: `/my-account/loyalty` se excluyó porque el `mockup` actual lo redirige intencionalmente a `/my-account` (N-03/Q-17, documentado en `src/app/app.routes.ts`). Una primera salida que lo incluía se descartó por rotular «Mi perfil» como fidelidad; el set aceptado usa `/my-account/promotions`.
- Límite: esta corrida verifica composición, no H1–H6 funcionales ni integración; la maqueta usa datos simulados.
- SHA-256 de `MATRIZ-visual.md`: `5f754c2ad719fc3c4b42cb55125798521d7082d44014782c4d14a0b2a0a13286`.
