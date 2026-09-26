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


---

## H2 · 2026-09-26 · PROPUESTA · M7 (BR-07 · BR-08 · BR-09)

Decisiones abiertas de los tres prompts. Ninguna detuvo el hito: cada una se resolvió por el criterio
**más seguro** (no cambia semántica para otros clientes, no toca el modelo, no inventa catálogos) y
queda escrita para que el propietario la confirme o la revierta. Los pedidos al modelo y a M1 están en
`docs/progress/evidence/lane-M7-h2/REPORT.md`.

| ID | Pregunta | Criterio elegido | Por qué |
|---|---|---|---|
| D-BR07-1 | Correo del médico sin institucional (ID-12) | **A**: el front manda `personalEmail === email`; la API, con `workEmail` ausente y `personalEmail` igual a `email`, no crea contacto WORK | no cambia lo que persiste el alta asistida ni el alta administrativa (opción B tocaba ambos flujos); un cliente que no manda `personalEmail` sigue igual (probado) |
| D-BR07-2 | `boardCertified` en la corrección de especialidad | **se acepta** en `PATCH me/specialties/:id` | el tipo del front ya lo declara y omitirlo daba 400; la columna existe; `isPrimary` sigue afuera (400) |
| D-BR07-3 | ¿La CI se corrige desde el perfil? (P28) | **A**: se corrigen sexo al nacer y departamento emisor; el número queda de solo lectura | no toca el modelo ni la cadena CI → matrícula verificada; el departamento se valida contra `VS_BO_DEPARTMENT` (422) |
| D-BR07-4 | Métricas de calidad (ID-14) | **A**: el front no las dibuja sin datos y dice que no hay; el simulador deja de fabricarlas | no se inventan fórmulas que el modelo no respalde; la opción B (calcular en la API) queda como TODO con cada fórmula por definir |
| D-BR07-5 | Borrar una matrícula con historial de auditoría | **no se borra: 422** (se mira la historia y los casos abiertos antes; nunca se captura un `23503`) | la FK `audit.jurisdiction_authorizations_history` no tiene `ON DELETE`; retirar con `valid_to` cambiaría lo que el resumen lista |
| D-BR08-1 | Ciudad del título | **pedido a M1** (`issuing_city_text` en `professional_credentials`, 4 capas); mientras tanto **C transitoria**: el campo sigue visible con el aviso «todavía no se guarda» que ya tenía la pantalla | quitarlo (B) reescribe 29 pruebas y contradice el pedido del dueño; el aviso ya existía. No se agregó `issuingCityText` a ningún DTO sin columna |
| D-BR08-2 | Empresa «Otra» (ID-11) | **A**: el front no manda el concepto con «Otra» | una línea, misma regla que la ocupación; evita chocar con el PR #454 |
| D-BR08-3 | País del título | **B**: no se expone `issuingCountryConceptId` | `VS_COUNTRY` no tiene miembros y no hay lista con fuente aprobada; sembrar una inventada está prohibido. Pedido a M1: sembrar `VS_COUNTRY` con fuente citada (ISO 3166) |
| D-BR08-4 | Universidad del título principal sin número | se une a la fila universitaria **con número** de «Tus títulos»; sin una fila que la lleve el alta se frena y lo dice | una credencial exige número (NOT NULL); mandar un número inventado o descartar la universidad en silencio están descartados |
| D-BR09-1 | Radioprotección (sin clave en el DTO) | **C**: sale del formulario del alta | ofrecer un PDF que se tira es peor que no pedirlo; necesita un rol de documento nuevo (modelo, M1) y se pide luego desde el panel |
| D-BR09-2 | Sucursales en el alta (CL-42) | **B**: el front avisa que se cargan tras la verificación y no viajan | `POST /diagnostic-units/:id/sites` es `SECURITY_ADMIN` (BR-06): crearlas en el alta daría algo que el dueño no puede administrar |
| D-BR09-3 | Alta del hospital (CV-03) | **camino decidido, pantalla diferida**: `register-organization` con `tenantType: HOSPITAL` (la API ya lo acepta); la materialización en `orgext` y la activación las hace la plataforma | `orgext` no tiene lecturas ni alta pública y `CreateHospitalDto` exige `practiceId`; queda como tarjeta |
| D-BR09-4 | Modalidad de laboratorio | se agrega `MODALITY_LABORATORY` a la lista cerrada de modalidades y se publican tres enumeraciones (`diagnostic-unit-type`, `diagnostic-modality`, `tenant-country`) | sin la modalidad la validación existente (422) rechazaba a todo laboratorio; sin enumeraciones públicas el front tendría que hardcodear uuid. Sin DDL: las materializa el seed |
| D-BR09-5 | Jurisdicción del alta | `JURISDICTION_NATIONAL` | es la única con alcance nacional del catálogo; SEDES existe sólo para Santa Cruz. Falta un value set de jurisdicciones por departamento |
| D-BR09-6 | Dueño y representante en una sola pantalla | `owner.displayName` (forma sin partes que la API acepta) y `legalRepresentative.fullName`; el formulario pide además el documento del representante | el formulario tiene un solo nombre completo: no se inventa dónde cortarlo |

**Quién confirma:** el propietario del producto (D-BR07-4, D-BR08-1, D-BR09-2/3), y quien mantiene el
modelo (D-BR08-1/3, D-BR09-1).
