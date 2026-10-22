# TASK PROMPT: Subtarea 1.2 — Domicilio Personal del Profesional en el Alta Médica (Calle y Coordenadas GPS)

> **Instrucciones para el Agente:**
> Ejecuta esta tarea en **Modo Planificación (Planning Mode)**. 
> Investiga los archivos especificados, elabora tu `implementation_plan.md` con las firmas exactas, solicita la aprobación del usuario antes de modificar código y, una vez aprobado, implementa, ejecuta la batería de pruebas y crea el Pull Request siguiendo estrictamente el flujo Git definido.

---

## 1. Contexto de Negocio y Diagnóstico del Bloqueo
En el frontend (`mantra-core-health`, rama `mockup`), a través de los commits `91975649` y `32bdcde8` (PR #391/#392), se habilitó el selector de mapa interactivo en el formulario de alta médica (`register-practitioner.ts`). El formulario envía los siguientes campos en `POST /iam/auth/register-practitioner`:
- `homeAddressLines?: string` (Calle, número y referencias escritas por la persona)
- `homeLatitude?: number` (Latitud geográfica, rango -90 a 90)
- `homeLongitude?: number` (Longitud geográfica, rango -180 a 180)

**El problema en el backend (`mantra-core-health-api`):**
1. En `main.ts`, el `ValidationPipe` global tiene habilitado `forbidNonWhitelisted: true`.
2. `RegisterPractitionerDto` (`src/modules/iam/dto/register-practitioner.dto.ts`) actualmente solo declara `residenceMunicipalityConceptId`.
3. Cuando un profesional completa su domicilio o marca su ubicación en el mapa, la API rechaza la solicitud completa con:
   ```json
   {
     "code": "VALIDATION_FAILED",
     "message": "Error de validación",
     "details": {
       "violations": [
         { "property": "homeAddressLines", "message": "property homeAddressLines should not exist" },
         { "property": "homeLatitude", "message": "property homeLatitude should not exist" },
         { "property": "homeLongitude", "message": "property homeLongitude should not exist" }
       ]
     }
   }
   ```
4. Adicionalmente, en `IamPractitionerSelfRegistrationService` (`src/modules/iam/services/iam-practitioner-self-registration.service.ts`), la llamada a `createResidenceAddress(...)` omite `lines`, `latitude` y `longitude`, registrando únicamente el municipio.

Este bloqueo está catalogado como **P19** en `PENDIENTES-BACKEND.md`.

---

## 2. Flujo de Git y Nomenclatura Obligatoria de Rama
Debes seguir rigurosamente este procedimiento de control de versiones:

1. **Sincronización con `dev`:**
   - Asegurarte de estar en el repositorio `mantra-core-health-api`.
   - Verificar estado limpio (`git status`).
   - Actualizar y colocarte sobre la última versión de `dev`:
     ```bash
     git fetch origin dev
     git checkout dev
     git pull origin dev
     ```

2. **Creación de rama con nomenclatura requerida:**
   - Nomenclatura obligatoria: `(dev)/(feature-o-fix)-(dato-de-la-tarea)`
   - Ejecutar:
     ```bash
     git checkout -b dev/feat-iam-practitioner-home-address
     ```

3. **Commits convencionales (Conventional Commits):**
   - Realizar commits atómicos y descriptivos:
     - `feat(iam): aceptar domicilio con calle y coordenadas en el autorregistro de profesional (P19)`
     - `test(iam): validar persistencia y restricciones de domicilio en registro medico`

4. **Publicación y Creación de Pull Request:**
   - Enviar la rama al repositorio remoto origin:
     ```bash
     git push -u origin dev/feat-iam-practitioner-home-address
     ```
   - Crear el Pull Request hacia `dev` mediante GitHub CLI (`gh`), asignando a los revisores obligatorios:
     ```bash
     gh pr create --base dev --title "feat(iam): aceptar domicilio con calle y coordenadas en el autorregistro de profesional (P19)" --body "## Resumen de Cambios
     - Se añaden homeAddressLines, homeLatitude y homeLongitude a RegisterPractitionerDto con validación de coordenadas emparejadas (@ValidateIf).
     - IamPractitionerSelfRegistrationService pasa estos tres campos a createResidenceAddress para su persistencia en common.addresses con use=HOME.
     - Pruebas unitarias e integración en verde.
     - Resuelve P19 de PENDIENTES-BACKEND.md (commits 91975649 y 32bdcde8 de front)." --reviewer jsaldias39,PabloArauzCaballero
     ```

---

## 3. Requerimientos Técnicos y Archivos Afectados

### A. DTO y Validaciones
- **Archivo:** `src/modules/iam/dto/register-practitioner.dto.ts`
- **Requerimiento:**
  - Importar decoradores `IsNumber`, `Min`, `Max` de `class-validator`.
  - Agregar los tres campos manteniendo paridad exacta con `RegisterPatientDto`:
    ```typescript
    /**
     * Calle y número del domicilio personal, tal como la persona lo escribe.
     */
    @ApiPropertyOptional({
      maxLength: 500,
      description: 'Calle y número del domicilio particular',
    })
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(500)
    homeAddressLines?: string;

    /**
     * Latitud del domicilio personal (-90 a 90).
     * Exige homeLongitude: el par de coordenadas viaja junto o no viaja.
     */
    @ApiPropertyOptional({ minimum: -90, maximum: 90 })
    @ValidateIf(
      (dto: RegisterPractitionerDto) =>
        dto.homeLatitude !== undefined || dto.homeLongitude !== undefined,
    )
    @IsNumber()
    @Min(-90)
    @Max(90)
    homeLatitude?: number;

    /**
     * Longitud del domicilio personal (-180 a 180).
     * Exige homeLatitude: el par de coordenadas viaja junto o no viaja.
     */
    @ApiPropertyOptional({ minimum: -180, maximum: 180 })
    @ValidateIf(
      (dto: RegisterPractitionerDto) =>
        dto.homeLatitude !== undefined || dto.homeLongitude !== undefined,
    )
    @IsNumber()
    @Min(-180)
    @Max(180)
    homeLongitude?: number;
    ```

### B. Servicio de Registro Médico
- **Archivo:** `src/modules/iam/services/iam-practitioner-self-registration.service.ts`
- **Requerimiento:**
  - Ubicar la invocación de `createResidenceAddress(...)` (aproximadamente en la línea 625).
  - Pasar los nuevos campos de `dto` dentro del objeto `data` (siguiendo el patrón existente en `iam-patient-self-registration.service.ts:364`):
    ```typescript
    await createResidenceAddress(
      this.addressesRepo,
      tx,
      this.catalogConceptsRepo,
      {
        personId: person.id,
        municipalityConceptId: dto.residenceMunicipalityConceptId,
        lines: dto.homeAddressLines,
        latitude: dto.homeLatitude,
        longitude: dto.homeLongitude,
        actorUserId: user.id,
      },
    );
    ```
  - La función `createResidenceAddress` (`src/modules/common/services/residence-address.ts`) ya maneja la conversión de números a formato numérico de base de datos, valida el municipio contra `VS_BO_MUNICIPALITY` y persiste en `common.addresses` con `use_concept_id = CONCEPTS.ADDR_USE_HOME`.

---

## 4. Criterios de Aceptación (BDD: GIVEN / WHEN / THEN)

### Escenario 1: Registro médico exitoso con domicilio completo (calle y coordenadas)
- **GIVEN** una solicitud válida de registro médico que incluye:
  ```json
  "residenceMunicipalityConceptId": "<UUID_MUNICIPIO_VALIDO>",
  "homeAddressLines": "Barrio Equipetrol, Calle 7 Este #12",
  "homeLatitude": -17.7689,
  "homeLongitude": -63.1956
  ```
- **WHEN** se envía `POST /iam/auth/register-practitioner`.
- **THEN** la API responde con estado `201 Created`.
- **AND** en la tabla `common.addresses` se inserta un registro con:
  - `owner_type_concept_id = CONCEPTS.OWNER_PATIENT` (o persona de la cuenta)
  - `owner_id = person.id`
  - `use_concept_id = CONCEPTS.ADDR_USE_HOME`
  - `lines = "Barrio Equipetrol, Calle 7 Este #12"`
  - `latitude = -17.7689`
  - `longitude = -63.1956`
  - `municipality_concept_id = <UUID_MUNICIPIO_VALIDO>`

### Escenario 2: Registro médico con solo municipio (retrocompatibilidad)
- **GIVEN** una solicitud de registro médico con `residenceMunicipalityConceptId`, pero omitiendo `homeAddressLines`, `homeLatitude` y `homeLongitude`.
- **WHEN** se envía `POST /iam/auth/register-practitioner`.
- **THEN** la API responde `201 Created` y en `common.addresses` se guarda la dirección únicamente con el municipio y departamento derivado.

### Escenario 3: Registro médico sin domicilio (opcionalidad)
- **GIVEN** una solicitud de registro médico que omite por completo los datos de residencia.
- **WHEN** se envía `POST /iam/auth/register-practitioner`.
- **THEN** la API responde `201 Created` sin crear filas vacías en `common.addresses`.

### Escenario 4: Rechazo por coordenada geográfica incompleta
- **GIVEN** una solicitud de registro que incluye `homeLatitude: -17.7689` pero omite `homeLongitude`.
- **WHEN** se envía `POST /iam/auth/register-practitioner`.
- **THEN** la API responde con código `400 Bad Request` y `VALIDATION_FAILED` indicando que `homeLongitude` es requerido cuando `homeLatitude` está presente.

---

## 5. Garantía de Calidad (QA) y Definition of Done (DoD)

### Definition of Done (DoD):
- [ ] `RegisterPractitionerDto` compila y valida `homeAddressLines`, `homeLatitude` y `homeLongitude` con `@ValidateIf`.
- [ ] `IamPractitionerSelfRegistrationService` envía los tres campos a `createResidenceAddress`.
- [ ] Pruebas unitarias en `src/modules/iam/services/iam-practitioner-self-registration.service.spec.ts`:
  - Prueba que verifica que `createResidenceAddress` recibe `lines`, `latitude` y `longitude`.
  - Prueba que verifica el comportamiento cuando se omite el domicilio.
- [ ] Pruebas de integración en `test/integration/practitioner-registration.int-spec.ts`:
  - Envío de payload con domicilio completo retornando `201`.
  - Envío de payload con latitud sin longitud retornando `400`.
- [ ] Ejecución satisfactoria de verificaciones estáticas del repositorio:
  - `yarn typecheck` (o `npx tsc --noEmit`)
  - `yarn lint`
  - `yarn test`
- [ ] Rama `dev/feat-iam-practitioner-home-address` enviada a `origin` y PR creado contra `dev` con revisores `jsaldias39` y `PabloArauzCaballero`.
