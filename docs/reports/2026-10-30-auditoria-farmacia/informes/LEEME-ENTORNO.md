# Entorno de auditoría (VM propia, todo local)
- API origin/dev: http://localhost:3000 (RATE_LIMIT_DISABLED=true). SSR front: http://localhost:4000. Simulador ERP: http://localhost:4100.
- Código: ~/auditoria/wt/mantra-core-health-api y ~/auditoria/wt/mantra-core-health (origin/dev, solo lectura para auditar). Modelo: /home/user/mantra-core-health-model.
- Contrato: ~/auditoria/2026-10-29-farmacia/carriles/CONTRATO.md y carriles/*/lane-*/requirements.md. Pedido: ~/auditoria/2026-10-30-auditoria-farmacia/notas/pedido-propietario.md
- Cuentas (clave Audit.Local.2026): admin.farmacia-chavez@alovida.test (farmacia, pharmacyId 1a82de64-bb90-42cd-9ac0-221e313d76bf, sede 864f4eb5-6196-496e-8d5c-2ddd5f1e4cbf, producto 01e96d54-d92d-465b-b13e-1890425840de), dr.andres@alovida.test (médico), paciente.lucia@alovida.test (paciente). Admin: admin@alovida.test / Audit.Admin.2026.
- Estado y llamadas ya hechas: scratchpad q6-state.json, q6.py (helpers de login/llamada). Scratchpad: /tmp/claude-0/-home-user/a3997150-d93c-5870-9eb9-02a4fa558d1f/scratchpad
- Playwright: require('playwright') + chromium.launch() sin opciones. Nunca esperar networkidle. Capturas a ~/auditoria/evidencia/<carril>/.
- Postgres solo para LEER evidencia: docker exec mantra-redesa-postgres-1 psql -U mantra -d mantra_redesa_health. Datos nuevos SOLO por la API, con prefijo propio en códigos/correos (@alovida.test).
