# Decisiones pendientes del propietario

Registro de las decisiones de producto que ningún carril resuelve por conveniencia (regla 00
§1.7 de `AlovidaPromptManager`). Cada entrada dice qué se necesita saber, quién la puede
resolver y qué queda apagado o con el supuesto más seguro mientras tanto.

## D-C — Qué servicio atiende el triage por IA

- **Registrada:** 2026-09-26, carril M5 (`justin/test-m5-build-real`), H3.S2.
- **Pregunta concreta:** ¿qué servicio atiende `POST /v1/triage/analyze` (síntomas → especialidad),
  con qué base legal para procesar texto clínico del paciente, y dónde corre? Las tres opciones que
  el prompt de enrutado (`AlovidaPromptManager/.../BR-03-enrutado-produccion-y-triage-ia.md`) deja
  planteadas:
  - **A.** Servicio propio (`AlovidaAIService`) en la red interna del despliegue.
  - **B.** Proxy autenticado dentro de la API (`POST /triage/analyze`, JWT + `@Throttle` +
    auditoría sin el texto).
  - **C.** Apagado hasta decidir.
- **Por qué bloquea:** hoy el cliente manda **texto clínico sin autenticar a una IP pública
  escrita en el repositorio** (`173.249.39.237.sslip.io`) y el dictado de voz sale a Google — choca
  con la regla 90.2.4 (PHI nunca a un tercero no acordado).
- **Supuesto tomado mientras tanto (Opción C):** en este carril, `deploy/api-locations.conf`
  responde `/ai/*` con `503 DEPENDENCY_UNAVAILABLE` en JSON — **nunca** el `index.html` del SSR — y
  la IP salió del repositorio (`proxy.conf.mjs` ya no trae un default; ver `git grep` en el reporte
  del carril). No se tocó `triage-ia.client.ts` ni la pantalla de síntomas: quedan fuera del
  alcance de este carril (`src/app/features/**` no está en su IN).
- **A quién confirmarle:** el propietario del producto.
- **Qué desbloquea:** elegir A o B habilita escribir el `location ^~ /ai/` real (y, si es B, el
  módulo `triage_proxy` en la API) y el aviso de consentimiento previo al dictado/envío
  (`features/symptom-check/`, fuera del alcance de este carril).
