# 👥 PLAN DE REPARTO DE TAREAS: ENDER e ITZAN
### Mantra Core Technologies — Roadmap Backend (`mantra-core-health-api`)

Este documento establece la **distribución oficial y coordinada del trabajo técnico** entre los desarrolladores **Ender** e **Itzan**, asegurando que ambos puedan avanzar en paralelo sin pisarse código, manteniendo las convenciones estrictas de Git, la garantía QA y el flujo de revisión con `jsaldias39` y `PabloArauzCaballero`.

---

## 🧭 1. Especialización Técnica y Dominio de Dominio

Para maximizar la eficiencia y evitar bloqueos en la base de datos o colisiones en TypeORM, se dividen los módulos por afinidad funcional:

| Desarrollador | Enfoque de Dominio Principal | Módulos Arquitectónicos Asignados |
|---|---|---|
| **Ender** | **IAM, Perfiles, Identidad, Directorios y Archivos** | `iam`, `profiles`, `directory`, `common.files`, `verifications (FT-32)` |
| **Itzan** | **Operación Clínica, Agendas, Encuentros y Finanzas** | `scheduling`, `charts`, `clinical`, `insurance`, `quotations` |

---

## 📊 2. Matriz General de Asignación de Tareas

```mermaid
graph TD
    subgraph SPRINT_1["Fase 1: Alta, Credenciales y Turnos Inmediatos"]
        E1["Ender: Subtarea 1.6<br/>Universidad y Títulos Múltiples (PR #401)"]
        I1["Itzan: Subtarea 3.3<br/>Turnos de Mostrador WALK_IN (PR #400)"]
    end

    subgraph SPRINT_2["Fase 2: Vitrinas Públicas y Expediente Clínico"]
        E2["Ender: Hito 2<br/>Sedes en Ficha Pública (P16) + Foto (P17)"]
        I2["Itzan: Hito 4 & 3<br/>Notas Clínicas (P18) + Plantillas Citas (P15/P13)"]
    end

    subgraph SPRINT_3["Fase 3: Seguridad de Archivos y Coberturas"]
        E3["Ender: Hito 5<br/>Descarga Segura FT-32 (P0) + Previews (P5)"]
        I3["Itzan: Hito 6<br/>Seguros de Salud + Simulador de Cotizaciones"]
    end

    subgraph SPRINT_4["Fase 4: Consistencia y Gobernanza"]
        E4["Ender: Subtarea 7.2<br/>Purga y Anonimización de Evidencias"]
        I4["Itzan: Subtarea 7.1<br/>Prevención ACID de Homónimos"]
    end

    E1 --> E2 --> E3 --> E4
    I1 --> I2 --> I3 --> I4
```

---

## 👨‍💻 3. Ficha de Trabajo: ENDER

### Perfil y Responsabilidad:
Ender lidera la capa de **Identidad, Acreditación Profesional, Directorios Públicos y Seguridad de Documentos/Archivos**.

### Protocolo Git para Ender:
- **Rama Base:** `dev`
- **Nomenclatura Obligatoria:** `ender/(feature-o-fix)-(dato-de-la-tarea)`
- **Flujo de Terminal:**
  ```bash
  git checkout dev
  git pull origin dev
  git checkout -b ender/<tipo>-<nombre-tarea>
  # Desarrollo y pruebas unitarias...
  git push -u origin ender/<tipo>-<nombre-tarea>
  gh pr create --base dev --title "..." --body "..." --reviewer jsaldias39,PabloArauzCaballero
  ```

### Tareas Asignadas a Ender:

| # | Subtarea | Título / Objetivo | Rama de Trabajo Exigida | Estado | Prompt Listo |
|:---:|:---:|---|---|:---:|:---:|
| **1** | **1.6** | **Universidad, Lugar de Estudio y Títulos Múltiples (Médico y Paciente)**<br>Ingesta en `RegisterPractitionerDto` y persistencia en `profiles.professional_credentials`. | `ender/1.6-universidad-titulos` | 🟣 **FUSIONADA EN DEV (PR #382)** | ✅ `PROMPT_SUBTAREA_1_6_UNIVERSIDAD_TITULOS.md` |
| **2** | **2.1** | **Exposición de Sedes de Atención en Ficha Pública (`P16`)**<br>Exponer `practiceLocations` en `PublicProfileDetailDto` para `/p/:slug`. | `ender/feat-public-profile-practice-locations` | 🚀 **Prioridad Inmediata** | En roadmap |
| **3** | **2.2** | **Asociación de Foto de Perfil en Edición Profesional (`P17`)**<br>Admitir `photoFileId` en `PATCH /profiles/practitioners/me`. | `ender/feat-practitioner-photo-update` | Fase 2 | En roadmap |
| **4** | **2.3** | **Filtro Territorial en Dos Pasos (Depto -> Municipio)**<br>Filtro en cascada para directorio de organizaciones y prestadores. | `ender/feat-territorial-filter-two-step` | Fase 2 | En roadmap |
| **5** | **5.1** | **Autorización de Descarga en Chat y Evidencias FT-32 (`P0`)**<br>Presigned URLs y token efímero seguro para descarga de documentos médicos. | `ender/feat-ft32-chat-attachment-download-auth` | Fase 3 | En roadmap |
| **6** | **5.2** | **Metadatos Enriquecidos y Previews de Adjuntos (`P5`)**<br>Extracción de mime-type, tamaño, páginas y previsualizaciones drag-and-drop. | `ender/feat-attachment-metadata-previews` | Fase 3 | En roadmap |
| **7** | **5.3** | **🆕 Preferencias de Chat y Respuesta Automática de Profesionales (PR #433)**<br>`GET/PUT /profiles/practitioners/me/chat-preferences` para autorespuesta y descansos. | `ender/feat-chat-auto-reply-preferences` | Fase 3 | En roadmap |
| **8** | **7.2** | **Retención, Anonimización y Purga de Evidencias**<br>Soft-delete y limpieza periódica de documentos de identidad rechazados. | `ender/feat-identity-evidence-purge-policy` | Fase 4 | En roadmap |

---

## 👨‍💻 4. Ficha de Trabajo: ITZAN

### Perfil y Responsabilidad:
Itzan lidera la capa de **Agendas Médicas, Creación de Citas, Expediente/Notas Clínicas, Contabilidad, Seguros y Transaccionalidad ACID**.

### Protocolo Git para Itzan:
- **Rama Base:** `dev`
- **Nomenclatura Obligatoria:** `itzan/(feature-o-fix)-(dato-de-la-tarea)`
- **Flujo de Terminal:**
  ```bash
  git checkout dev
  git pull origin dev
  git checkout -b itzan/<tipo>-<nombre-tarea>
  # Desarrollo y pruebas unitarias...
  git push -u origin itzan/<tipo>-<nombre-tarea>
  gh pr create --base dev --title "..." --body "..." --reviewer jsaldias39,PabloArauzCaballero
  ```

### Tareas Asignadas a Itzan:

| # | Subtarea | Título / Objetivo | Rama de Trabajo Exigida | Estado | Prompt Listo |
|:---:|:---:|---|---|:---:|:---:|
| **1** | **3.3** | **Turnos de Mostrador y Atención Directa (`WALK_IN`, PR #400 / P22)**<br>Permitir generación de turnos inmediatos sin reserva web previa. | `itzan/feat-scheduling-walk-in-appointments` | 🟣 **FUSIONADA EN DEV (PR #384)** | ✅ Completado |
| **2** | **3.1** | **Retiro de Plantillas de Horarios y Liberación Segura (`P15`)**<br>`DELETE /scheduling/templates/:id` respondiendo `409 Conflict` si hay reservas activas. | Commit `3a431e30` / `fde22f2f` | 🟣 **FUSIONADA EN DEV** | ✅ 9/9 tests en verde |
| **3** | **3.2** | **Creación Atómica de Citas Clínicas (`P13`)**<br>`SchedulingConfirmationService` con flush y control de solapamiento de slots. | Commit `9a6fb9dd` (`crearCitaClinica`) | 🟣 **FUSIONADA EN DEV** | ✅ Verificado en DB |
| **4** | **4.1** | **Lectura y Paginación Cursor de Notas Clínicas (`P18`)**<br>`GET /charts/notes` con paginación cursor para navegación fluida de evoluciones. | `itzan/feat-chart-notes-collection-read` | 🚀 **Prioridad Inmediata** | En roadmap |
| **5** | **4.2/4.3**| **Enlace Cita-Encuentro y Exposición de `encounterId` / `appointmentId`**<br>Garantizar correlación unívoca entre la cita y el acto médico diagnóstico. | `itzan/feat-clinical-encounter-appointment-link` | Fase 2 | En roadmap |
| **6** | **4.4** | **🆕 Plan de Cuidados y Firma en Expediente (PR #430)**<br>Persistencia estructurada de `carePlan` y firma PDF de sesión en `charts.notes`. | `itzan/feat-clinical-care-plan-progress-notes` | Fase 2 | En roadmap |
| **7** | **6.1/6.2**| **Seguros de Salud y Simulador de Financiamiento/Cotizaciones**<br>Entidades `insurance.policy_coverages` y endpoint `POST /quotations/simulate`. | `itzan/feat-insurance-quotation-simulator` | Fase 3 | En roadmap |
| **8** | **6.3** | **🆕 Endpoints de Lectura para Cockpit Contable SAP (PR #433)**<br>`GET /accounting/fiscal-years`, `open-items`, `dimensions` y `document-flow`. | `itzan/feat-accounting-cockpit-read-models` | Fase 3 | En roadmap |
| **9** | **7.1** | **Prevención Atómica de Cédulas Homónimas y Rollback**<br>Manejo de concurrencia e integridad transaccional en autorregistro de personas. | `itzan/feat-patient-homonym-prevention-acid` | Fase 4 | En roadmap |

---

## ⚡ 5. Siguientes Pasos Inmediatos (Sprint Activo)

### Instrucciones para Ender:
1. Con la Subtarea 1.6 cerrada en el PR #382, arrancar con la **Subtarea 2.1: Exposición de Sedes de Atención en Ficha Pública (`P16`)**.
2. Crear rama: `git checkout -b ender/feat-public-profile-practice-locations`.
3. Reviewers: `jsaldias39,PabloArauzCaballero`.

### Instrucciones para Itzan:
1. Con las Subtareas 3.1, 3.2 y 3.3 cerradas (¡Hito 3 completo!), arrancar con la **Subtarea 4.1: Lectura de Colección de Notas Clínicas de Evolución (`GET /charts/notes`, P18)** en el módulo `src/modules/chart/`.
2. Crear rama: `git checkout -b itzan/feat-chart-notes-collection-read`.
3. Reviewers: `jsaldias39,PabloArauzCaballero`.

---

## 🛡️ 6. Reglas de Convivencia y Garantía QA

1. **Revisores Obligatorios en todos los PRs:** Ningún PR puede fusionarse sin la aprobación de `jsaldias39` (Justin Saldias) o `PabloArauzCaballero` (Pablo Arauz).
2. **Cero Rompimiento de Tests:** Antes de pushear a su remoto, cada dev debe correr:
   ```bash
   npm run test
   ```
3. **No Colisión de Entidades:** Si una tarea requiere alterar una entidad cruzada (como `profiles.persons`), deben coordinarse mediante un contrato de interfaz o DTO antes de tocar el esquema.
4. **Modo Planificación Obligatorio:** Todo desarrollo debe arrancar con un plan técnico aprobado para evitar retrabajo.
