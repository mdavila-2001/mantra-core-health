# Plan — Limpieza del sidebar de Superadministración

- Fecha: 2026-10-17 · Repos afectados: mantra-core-health · Predecesor: 2026-10-17-superadmin
- Resultado observable: Quien inicia sesión con rol `SUPERADMIN` (o `admin@alovidasalud.com`) ve un sidebar depurado: Mi perfil y Notificaciones fijados arriba; el dominio «Administración» con las secciones administrativas de plataforma (Pacientes, Usuarios, Organizaciones, Identidad y accesos, Catálogos y contenido, Territorio, Red de salud) y SIN Mi organización, Mis productos ni elementos de aseguradora; el dominio «Superadministración» con Observabilidad y Plataforma; y ningún grupo clínico (Atención), general (Directorios, Grupos y foros), paciente (Mi cuenta) ni facturación ni herramientas de desarrollo.
- Kill-test: Con sesión `SUPERADMIN`, el menú lateral contiene `/directories`, `/schedule`, `/billing`, `/administration/my-organization` o `/administration/insurance` → FAIL.

## Alcance
- IN:
  1. Configurar `fueraDelMenuPara` con `'SUPERADMIN'` en las secciones no administrativas/circuladas:
     - General: `directories`, `groups`.
     - Atención: `schedule`, `medical-records`, `diagnostics`, `interventions`, `lab-visits`, `my-visits`, `glossary`, `my-services`, `my-quotations`, `questionnaires`.
     - Facturación: `billing`, `accounting`.
     - Mi cuenta: `my-account/dependents`, `my-account/appointments`, `my-account/medical-record`, `my-account/diagnostic-results`, `my-account/diagnostic-orders`, `my-account/cotizaciones`, `my-account/pharmacy`.
  2. Configurar `fueraDelMenuPara` con `'SUPERADMIN'` en las secciones de administración no aplicables a superadmin:
     - `administration/my-organization` (Mi organización)
     - `administration/insurance` (Mis productos)
     - `administration/brokers` (Brokers)
     - `administration/insurance-claims` (Solicitudes de seguro)
     - `administration/received-claims` (Solicitudes recibidas)
     - `administration/insurance-patients` (Pacientes de la aseguradora)
     - `administration/insurance-analytics` (Siniestralidad y analítica)
     - `administration/insurance-campaigns` (Campañas preventivas)
  3. En `shell-layout.ts`, excluir `SUPERADMIN` de la vitrina de `Herramientas` (`/design-system`).
  4. Pruebas unitarias de navegación (`navigation.service.spec.ts`) verificando el contenido exacto del menú para `SUPERADMIN`.
  5. Verificación de gates de compilación y pruebas.
- OUT:
  - Cambiar permisos en backend o guards de rutas donde superadmin conserva acceso de emergencia.
  - Modificar menú para otros roles (médico, paciente, aseguradora, etc.).
- Ambigüedades registradas:
  - Ninguna: las 4 capturas detallan exactamente los ítems circulados y tachados con X.

## H1 — Limpieza y restricciones en el registro de navegación y shell
**CA:** Dado un usuario con rol `SUPERADMIN`, cuando consulta el menú lateral, entonces ve únicamente sus accesos fijados (`Mi perfil`, `Notificaciones`), el grupo `Administración` (sin aseguradora ni mi organización) y el grupo `Superadministración`.
**DoD:** `yarn test --include='src/app/core/navigation/navigation.service.spec.ts'` exit 0 con pruebas específicas del menú de superadmin.
**Estado:** HECHO

### H1.S1 — Configuración en navigation.map.ts y shell-layout.ts
**CA:** Las secciones circuladas y de aseguradora tienen `'SUPERADMIN'` en `fueraDelMenuPara`, y `shell-layout` no agrega `Herramientas` para `SUPERADMIN`.
**DoD:** `yarn typecheck` exit 0 y tests unitarios en verde.
**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Estado |
|---|---|---|---|---|
| H1.S1.M1 | Añadir `'SUPERADMIN'` a `fueraDelMenuPara` en `navigation.map.ts` para ítems circulados y de aseguradora | Las secciones marcadas no aparecen en el menú para superadmin | `yarn test --include='src/app/core/navigation/navigation.map.spec.ts'` → exit 0 | HECHO |
| H1.S1.M2 | En `shell-layout.ts`, excluir `'SUPERADMIN'` de `Herramientas` | `SUPERADMIN` no ve `Herramientas` en el menú | `yarn test --include='src/app/features/shell-layout/shell-layout.spec.ts'` → exit 0 | HECHO |
| H1.S1.M3 | Agregar pruebas en `navigation.service.spec.ts` verificando la lista exacta de rutas para `SUPERADMIN` | El menú de `SUPERADMIN` tiene exactamente las rutas autorizadas | `yarn test --include='src/app/core/navigation/navigation.service.spec.ts'` → exit 0 | HECHO |

## H2 — Menú plano/desagrupado para superadministración
**CA:** Dado un usuario con rol `SUPERADMIN`, cuando consulta el menú lateral, entonces todos sus grupos de navegación se presentan aplanados (`grupo.aplanado === true`), mostrándose todas las opciones directamente sin desplegables (`<details>`).
**DoD:** `yarn test --include='src/app/core/navigation/navigation.service.spec.ts'` exit 0 con pruebas de `aplanado` para `SUPERADMIN`.
**Estado:** HECHO

### H2.S1 — Aplanar grupos para SUPERADMIN
**CA:** `seAplanaElGrupo` retorna `true` cuando `roles` incluye `'SUPERADMIN'`.
**DoD:** `yarn typecheck` exit 0 y tests unitarios en verde.
**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Estado |
|---|---|---|---|---|
| H2.S1.M1 | Extender `seAplanaElGrupo` en `navigation.subgroups.ts` para aceptar `roles` y retornar `true` si contiene `'SUPERADMIN'` | `seAplanaElGrupo` retorna `true` para `SUPERADMIN` | `yarn test --include='src/app/core/navigation/navigation.subgroups.spec.ts'` → exit 0 | HECHO |
| H2.S1.M2 | Pasar `roles` en `navigation.service.ts` y actualizar pruebas de `aplanado` en `navigation.service.spec.ts` | El menú de `SUPERADMIN` tiene todos sus grupos con `aplanado === true` | `yarn test --include='src/app/core/navigation/navigation.service.spec.ts'` → exit 0 | HECHO |

## Riesgos y bloqueos previstos
| Riesgo | Impacto | Mitigación |
|---|---|---|
| Regresión en menús de otros roles | Alto | Las modificaciones son específicas al rol `SUPERADMIN` agregándolo a `fueraDelMenuPara` y en la condición de `roles.includes('SUPERADMIN')` |
| Pruebas preexistentes esperando que superadmin vea todo | Medio | Actualizar pruebas que asumían que superadmin veía rutas de paciente/médico en el menú lateral |
| Pruebas preexistentes esperando que superadmin vea Administración plegada | Bajo | Actualizar la prueba de `navigation.service.spec.ts` que usaba SUPERADMIN para verificar desplegables |
