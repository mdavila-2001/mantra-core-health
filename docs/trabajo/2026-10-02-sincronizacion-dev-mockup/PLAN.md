# Plan — Sincronización, Homologación y Registro de Procesos (v3.0 Actualizado)

- **Fecha:** 2026-10-02 · **Repositorios:** `mantra-core-health`, `mantra-core-health-api`, `mantra-core-health-model`, `AlovidaPromptManager`
- **Estado de Ramas al 02/10/2026 (Live):**
  - **Frontend (`mantra-core-health`):** `dev` actualizado a `ad5623a7` (PR #831 **MERGEADO**). Contiene los 85 commits de `mockup`, vademécum LINAME 2022-2024 (482 medicamentos), directorio oficial de Bolivia (15.292 centros), precios de referencia INLASA/FONASA, motor de promociones (14 mecánicas), importador masivo de sucursales, logos, firma/sello y `mockBackend: false` blindado. `typecheck` pasa limpio en 0.
  - **Backend API (`mantra-core-health-api`):** `dev` en `954e1167` (PR #532 catálogos oficiales, PR #530 Hito 4 aseguradoras/dependientes, PR #529 servicios dinámicos, PR #531 dependencias).
  - **Modelo Canónico (`mantra-core-health-model`):** `dev` en `b148fe6` (PR #42 directorio en BOOT, PR #40 catálogo universal). Pendiente: `servicios-dinamicos-model` (v4.2.40).
- **Insumo Estratégico:** Registro de Procesos y Auditoría Funcional (Google Doc `1CVKaI0Zh22oJH-FrYOSWPJXKidC29Fhdk2TOBbBFdtM`).
- **Resultado observable:** 
  1. Hito 1 (Modelo): v4.2.40 mergeado en `dev`.
  2. Hito 2 (Frontend Base): **Completado y verificado en `dev`** (PR #831 mergeado, typecheck 0).
  3. Hito 3 (Correcciones UX/UI Críticas del Registro de Procesos): Especialidades retiradas de la pestaña Credenciales en la vista del perfil (quedando solo en Datos Personales); botón cancelar con retorno a `/account/profile`; disciplina de tablas en Trayectoria y Credenciales; layout de Credenciales bajo heurísticas UX.
  4. Hito 4 (Backend API Endpoints): Endpoints de logos, firma/sello, `my-claims` y sucursales.
  5. Hito 5 (Cierre de Brechas Funcionales del Registro de Procesos): SEGIP 896 profesiones, GPS interactivo Leaflet y tutores/dependientes.
- **Kill-test:**
  1. `powershell -Command "Select-String 'mockBackend:\s*true' mantra-core-health/src/environments/environment.ts"` devuelve coincidencia (debe ser `false`).
  2. `corepack yarn --cwd mantra-core-health typecheck` falla ($\neq 0$).
  3. En `practitioner-profile-view.html` la pestaña "Credenciales" todavía contiene la sub-lista o pestaña de "Especialidades".
  4. El botón "Cancelar edición" en el perfil médico no retorna a `/account/profile` al pulsarse.

---

## 1. Matriz de Estado: Lo Aceptado vs Registro de Procesos (Google Doc)

| Módulo / Requisito | Estado en Google Doc | Estado Real en Código (`dev` / ramas) | Veredicto | Acción Planificada |
|---|---|---|:---:|---|
| **P1.1 CI con extensión departamental** | COMPLETO | Frontend y backend con catálogo departamental | **AL DÍA** | Verificado |
| **P1.2 Fecha nacimiento y edad auto** | COMPLETO | Cálculo reactivo en frontend y backend | **AL DÍA** | Verificado |
| **P1.3 Ocupación SEGIP (896 opciones + libre)** | INCOMPLETO | API tiene 64 ocupaciones; falta dataset SEGIP 896 | **PENDIENTE** | Hito 5.1 |
| **P1.4 Enlace tutor / dependiente** | INCOMPLETO | API tiene modelo H4 (PR #530); falta flujo SMS/link | **PARCIAL** | Hito 5.3 |
| **P1.5 Selector GPS Domicilio y Trabajo** | INCOMPLETO | Rama `marcelo/feat-patient-leaflet-gps-addresses` lista | **EN RAMA** | Hito 5.2 |
| **P1.6 Facturación NIT y Razón Social** | COMPLETO | Entidades y campos de alta y perfil completos | **AL DÍA** | Verificado |
| **P1.7 Requerimientos post-consulta (Receta)** | Avanzado | Vademécum LINAME 482 y directorio de 15.292 centros | **AL DÍA** | Verificado |
| **M2.1 Nombre en 3 partes y CI con extensión** | COMPLETO | Formularios y backend alineados | **AL DÍA** | Verificado |
| **M2.2 Especialidades en Datos Personales** | ERROR DOC #4 | En edición se movió; **en vista sigue en Credenciales** | **REGRESIÓN UI** | **Hito 3.1 (Inmediato)** |
| **M2.3 Botón Cancelar Edición en Perfil** | ERROR DOC #3 | Botón resetea form pero no vuelve al perfil | **DEFECTO UX** | **Hito 3.2 (Inmediato)** |
| **M2.4 Tablas, búsqueda y paginación (Trayectoria)** | ERROR DOC #1 | `layout="tabla"` lo tiene; la vista usa `timeline` plano | **MEJORA UX** | **Hito 3.3 (Inmediato)** |
| **M2.5 Tablas, búsqueda y paginación (Credenciales)** | ERROR DOC #2 | Edición tiene tablas; la vista es lista sin buscador | **MEJORA UX** | **Hito 3.4 (Inmediato)** |
| **M2.6 Layout Credenciales con 5 Heurísticas UX** | ERROR DOC #5 | Rediseño de credenciales, títulos y respaldos | **MEJORA UX** | **Hito 3.5 (Inmediato)** |
| **M2.7 Títulos universitarios (2 carreras, posgrados)** | API lista, UI falta | `tabla-formacion` y alta de títulos ya en front (`dev`) | **AL DÍA** | Verificado |
| **M2.8 Datos societarios y fiscales del médico** | INCOMPLETO | Catálogo fiscal de 8 tipos en API; UI falta | **PARCIAL** | Hito 4 |
| **F3.1 Bandeja de recepción de órdenes de farmacia** | INCOMPLETO | `pharmacy-inbox` con triaje de 6 filtros mergeado en PR #831 | **AL DÍA** | Verificado |
| **F3.2 Motor de promociones y descuentos** | En diseño | Motor de 14 mecánicas (PR #821) mergeado en `dev` | **AL DÍA** | Verificado |
| **L4.1 Precios de referencia de Laboratorio** | INCOMPLETO | Catálogo INLASA con precios en Bs mergeado en PR #826/#532 | **AL DÍA** | Verificado |
| **I5.1 Precios de referencia de Imagenología** | INCOMPLETO | Arancel FONASA 2026 convertido a Bs en PR #826/#532 | **AL DÍA** | Verificado |
| **A6.1 Reporte de siniestralidad de aseguradora** | PENDIENTE | `person-loss-report` incorporado a `dev` en PR #831 | **AL DÍA** | Verificado |
| **A6.2 Aprobación automática de solicitudes (C3)** | INCOMPLETO | Dictámenes de cobertura y dependientes en PR #530 | **AL DÍA** | Verificado |

---

## 2. Plan de Hitos de Implementación

### Hito 1 — Nivelación de Modelo Canónico (`mantra-core-health-model`)
**CA:** `dev` en `mantra-core-health-model` incorpora el patch v4.2.40 (`origin/justin/servicios-dinamicos-model`) sin alterar migraciones previas.  
**DoD:** `git merge` limpia con exit 0 y patch v4.2.40 verificado.  
**Estado:** TODO  

| ID | Microtarea | Criterio de Aceptación (Binario) | Definition of Done (Comando) | Estado |
|---|---|---|---|:---:|
| H1.1 | Merge de rama de servicios dinámicos | HEAD de `dev` contiene commits de v4.2.40 | `git -C mantra-core-health-model merge origin/justin/servicios-dinamicos-model -m "merge: servicios dinamicos modelo v4.2.40"` $\rightarrow$ Exit 0 | TODO |
| H1.2 | Validación de DDL y patches | Patch `v4240` presente en `SQL/patches/` | `git -C mantra-core-health-model log -n 1 --stat` $\rightarrow$ Exit 0 | TODO |

---

### Hito 2 — Unificación Frontend Base (`mockup` $\rightarrow$ `dev`)
**CA:** `mantra-core-health` en `dev` cuenta con todos los 85 commits de `mockup`, mantiene `mockBackend: false`, compila con SSR y pasa typecheck con 0 errores.  
**DoD:** Commit `ad5623a7` (PR #831) incorporado en local `dev`, `corepack yarn typecheck` finaliza con código 0.  
**Estado:** **COMPLETADO (VERIFICADO)**  

| ID | Microtarea | Criterio de Aceptación (Binario) | Definition of Done (Comando) | Estado |
|---|---|---|---|:---:|
| H2.1 | Fast-forward local `dev` a `origin/dev` | Local `dev` en `ad5623a7` | `git -C mantra-core-health merge --ff-only origin/dev` $\rightarrow$ Exit 0 | DONE |
| H2.2 | Blindaje de `mockBackend: false` | `src/environments/environment.ts` declara `mockBackend: false` | `powershell Select-String 'mockBackend:\s*false' src/environments/environment.ts` $\rightarrow$ Match | DONE |
| H2.3 | Verificación de compilación estática | TypeScript 5.9.3 typecheck global finaliza sin errores | `corepack yarn --cwd mantra-core-health typecheck` $\rightarrow$ Exit 0 | DONE |

---

### Hito 3 — Correcciones Críticas UX/UI y Errores del Registro de Procesos
**CA:** Se corrigen los 5 errores específicos reportados al final del documento de procesos:
1. Especialidades retiradas de la pestaña Credenciales en `practitioner-profile-view.html`.
2. Botón "Cancelar edición" en `practitioner-profile-edit` navega a `/account/profile`.
3. Disciplina de tablas, búsqueda y paginación en Trayectoria (`work-history`).
4. Disciplina de tablas en Credenciales (`credentials-panel`).
5. Layout y jerarquía visual de Credenciales cumpliendo las 5 heurísticas de Nielsen.  
**DoD:** Specs de perfil médico en verde, typecheck 0, verificación de navegación y visualización.  
**Estado:** TODO  

| ID | Microtarea | Criterio de Aceptación (Binario) | Definition of Done (Comando) | Estado |
|---|---|---|---|:---:|
| H3.1 | Retirar Especialidades de Credenciales en Vista | En `practitioner-profile-view.html` la pestaña Credenciales ya no contiene Especialidades | `Select-String -Path ...practitioner-profile-view.html -Pattern "Especialidades \("` $\rightarrow$ No matches en Credenciales | TODO |
| H3.2 | Cancelar Edición con navegación de retorno | El botón Cancelar Edición ejecuta `router.navigate(['/account/profile'])` tras confirmar descarte | Spec dirigida prueba redirección al cancelar | TODO |
| H3.3 | Disciplina de tablas en Trayectoria | Búsqueda por institución/cargo y paginación operables en tabla de historial | Tests de `work-history.spec.ts` pasan | TODO |
| H3.4 | Disciplina de tablas en Credenciales | Paginación y búsqueda operativa en matrículas y títulos | Tests de `practitioner-profile-edit.spec.ts` pasan | TODO |
| H3.5 | Layout y Heurísticas UX en Credenciales | Visualización jerárquica: estado del sistema, consistencia de sellos y badges, sin scroll lateral | Typecheck 0 y visual proof | TODO |

---

### Hito 4 — Endpoints Críticos Backend API (`mantra-core-health-api`)
**CA:** `mantra-core-health-api` implementa los contratos que evitan 404/501 en el frontend:
1. `GET /tenants/:id/logo` y `PUT /tenants/:id/logo`.
2. `GET /practitioners/me/sites/:id/logo` y `PUT /practitioners/me/sites/:id/logo`.
3. `GET/PUT /profiles/practitioners/me/signature-assets` (firma y sello).
4. `GET /insurance/my-claims` (mis reclamaciones).
5. `PATCH /tenants/:id/branches/:id` (edición de sucursal).  
**DoD:** Endpoints documentados en OpenAPI, controladores y servicios con tests de integración en verde.  
**Estado:** TODO  

| ID | Microtarea | Criterio de Aceptación (Binario) | Definition of Done (Comando) | Estado |
|---|---|---|---|:---:|
| H4.1 | Controladores y servicios de Logo (Organización y Consultorio) | Endpoints de subida y consulta de logo en MinIO con 200/201 | Tests dirigidos de logo pasan con exit 0 | TODO |
| H4.2 | Firma y Sello del Profesional | Almacenamiento seguro de activos de firma y sello | Spec de signature assets pasa | TODO |
| H4.3 | Consulta de reclamaciones del asegurado | `GET /insurance/my-claims` devuelve lista paginada | Spec de insurance claims pasa | TODO |
| H4.4 | Edición parcial de sucursales | `PATCH /tenants/:id/branches/:id` actualiza datos sin recrear | Spec de branches pasa | TODO |

---

### Hito 5 — Cierre de Brechas Funcionales del Registro de Procesos
**CA:** Se incorporan los requerimientos de negocio de mediano plazo del documento:
1. Catálogo SEGIP de 896 ocupaciones con autocompletado y texto libre.
2. Selector interactivo de mapa Leaflet para domicilio y trabajo (merge de `marcelo/feat-patient-leaflet-gps-addresses`).
3. Sincronización y confirmación de tutor↔dependiente.  
**DoD:** Integración validada end-to-end con base de datos y UI.  
**Estado:** TODO  

| ID | Microtarea | Criterio de Aceptación (Binario) | Definition of Done (Comando) | Estado |
|---|---|---|---|:---:|
| H5.1 | Integrar catálogo SEGIP 896 profesiones | Selector con búsqueda fuzzy de 896 ocupaciones bolivianas y opción personalizada | Spec de ocupación pasa | TODO |
| H5.2 | Integrar mapa interactivo Leaflet GPS | Captura visual y precisa de coordenadas GPS de domicilio y trabajo | Spec de leaflet addresses pasa | TODO |
| H5.3 | Enlace y activación Tutor-Dependiente | Flujo de invitación y vinculación con verificación SMS/link | Spec de dependientes pasa | TODO |

---

## 3. Matriz de Riesgos y Reglas de Disciplina

1. **Blindaje de Entornos:** `mockBackend: false` en `dev` es INNEGOCIABLE.
2. **Pérdida de datos PHI:** Ningún dato sensible en URLs ni logs.
3. **Escalera de Evidencia:** Todo hito avanza únicamente tras comprobar el comando literal correspondiente (`RUNS` $\rightarrow$ `TESTED` $\rightarrow$ `VERIFIED`).
