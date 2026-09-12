# PLANTILLA CANÓNICA: PROMPT DE EJECUCIÓN DE SUBTAREA (MODO PLANIFICACIÓN)
## Estándar Oficial para Tareas de Backend en `mantra-core-health-api`

> **PROPÓSITO DE ESTA PLANTILLA:** Esta guía establece la estructura obligatoria que debe tener todo prompt de ejecución entregado al asistente o desarrollador en **Modo Planificación (Planning Mode)**. Cada sección garantiza que no queden cabos sueltos a nivel de negocio, arquitectura, pruebas QA ni procedimiento de entrega mediante Git y Pull Requests.

---

```markdown
# TASK PROMPT: Subtarea [X.Y] — [Título Descriptivo de la Subtarea]

> **MODO DE EJECUCIÓN:** Este prompt está diseñado para ejecutarse en **Modo Planificación (Planning Mode)**.
> El agente/desarrollador debe iniciar en fase de investigación sin alterar código fuente, generar un `implementation_plan.md` exhaustivo, esperar la aprobación explícita del usuario, ejecutar los cambios con rigor atómico, verificar la solución mediante pruebas unitarias e integración con garantía QA, y documentar el resultado final en `walkthrough.md`.

---

## 1. Contexto de Negocio y Justificación Técnica

### A. Contexto de Negocio y Requerimiento de Usuario
- [Explicación clara del proceso en Bolivia o requerimiento del cliente].
- [Mención de la necesidad asistencial o administrativa].

### B. El cambio en Frontend (`mantra-core-health`, rama `mockup`)
- [Referencia al PR o commit de frontend, ej. PR #390, #404, etc.].
- [Descripción de qué pantalla cambió, qué campos nuevos se piden o qué validadores se activaron].

### C. La brecha técnica en Backend (`mantra-core-health-api`)
- [Detalle exacto de por qué la API actual rechaza o ignora el payload, ej. forbidNonWhitelisted 400, columna faltante, validación ausente].
- [Identificación de servicios o infraestructura existente que ya se puede reutilizar].

---

## 2. Flujo de Git y Procedimiento de Entrega

Debes ejecutar estrictamente el siguiente procedimiento en la terminal del proyecto:

1. **Preparación y verificación del espacio de trabajo:**
   - Situarse en el repositorio backend: `d:\Trabajos Secundarios\Mantra Core Technologies\mantra-core-health-api`.
   - Confirmar que el working tree esté limpio:
     ```bash
     git status
     ```
   - Actualizar y situarse en la rama base `dev`:
     ```bash
     git fetch origin dev
     git checkout dev
     git pull origin dev
     ```

2. **Creación de la rama de trabajo con nomenclatura obligatoria:**
   - **Formato exigido:** `(nombre-del-dev)/(feature-o-fix)-(dato-de-la-tarea)`
   - *Ejemplo con tu nombre:*
     ```bash
     git checkout -b <tu-nombre>/[feat|fix]-[nombre-corto-de-la-tarea]
     ```
     *(ejemplo real: `marcelo/feat-departamento-emision-obligatorio` o `marcelo/feat-alta-centro-imagenologia`)*

3. **Estrategia de Commits Atómicos y Convencionales:**
   - Realizar commits incrementales respetando Conventional Commits:
     - `feat([modulo]): [descripcion clara del cambio en dto/entidad]`
     - `feat([modulo]): [descripcion del cambio en servicio/repositorio]`
     - `test([modulo]): [descripcion de las pruebas unitarias y de integracion agregadas]`

4. **Publicación y Apertura de Pull Request:**
   - Pushear la rama al remoto `origin`:
     ```bash
     git push -u origin <tu-nombre>/[feat|fix]-[nombre-corto-de-la-tarea]
     ```
   - Crear el Pull Request hacia la rama `dev` mediante `gh pr create`, asignando a `jsaldias39` y `PabloArauzCaballero` como revisores:
     ```bash
     gh pr create --base dev --title "feat([modulo]): [titulo conciso del PR]" --body "## Resumen de Cambios
     - [Punto clave 1]
     - [Punto clave 2]
     - Pruebas unitarias e integración en verde con garantía QA.
     - Paridad estricta con el frontend (mockup)." --reviewer jsaldias39,PabloArauzCaballero
     ```

---

## 3. Requerimientos Técnicos y Archivos a Modificar

### A. DTOs de Entrada y Salida
- **Archivo:** `src/modules/[modulo]/dto/[nombre].dto.ts`
- **Modificaciones:**
  - Decoradores class-validator (`@IsString`, `@IsUUID`, `@ValidateIf`, etc.).
  - Decoradores OpenAPI/Swagger (`@ApiProperty`, `@ApiPropertyOptional`).
  - Snippets de código exactos requeridos.

### B. Servicios y Casos de Uso
- **Archivo:** `src/modules/[modulo]/services/[nombre].service.ts`
- **Modificaciones:**
  - Inyección de dependencias necesarias.
  - Lógica dentro de la transacción `em.transactional(async (tx) => { ... })`.
  - Manejo de excepciones tipadas (`ConflictException 409`, `PreconditionFailedException 412/422`, `BadRequestException 400`).

### C. Repositorios y Entidades (si aplica)
- **Archivo:** `src/modules/[modulo]/repositories/[nombre].repository.ts`
- **Modificaciones:**
  - Métodos de consulta o persistencia atómica.

---

## 4. Garantía de Calidad y Pruebas Requeridas (QA Guarantee)

Se exige la adición y ejecución de pruebas automatizadas en Jest para garantizar cero regresiones:

### Pruebas Unitarias (`src/modules/[modulo]/services/[nombre].service.spec.ts`)
1. **Caso 1: Flujo Exitoso (Happy Path)**
   - Validación del caso nominal con datos completos.
   - Verificación de código de respuesta HTTP esperado (`200 OK` / `201 Created`).
2. **Caso 2: Validaciones de Entrada y Excepciones de Negocio**
   - Comprobación de que la omisión de campos requeridos arroje el código HTTP exacto (`400 Bad Request`).
   - Comprobación de conceptos no pertenecientes al catálogo (`422` o `412`).
3. **Caso 3: Conflictos de Unicidad o Restricciones**
   - Simulación de duplicidad con lanzamiento de `ConflictException (409)`.

### Comandos de Validación QA:
```bash
# 1. Ejecutar las pruebas unitarias del servicio
yarn test src/modules/[modulo]/services/[nombre].service.spec.ts

# 2. Ejecutar pruebas de regresión del módulo
yarn test src/modules/[modulo]

# 3. Verificación de tipado estricto sin errores TypeScript
yarn typecheck
```

---

## 5. Definition of Done (DoD) y Criterios de Aceptación

### Definition of Done (DoD)
- [ ] DTO validado con tipado estricto y decoradores de `class-validator`.
- [ ] Servicio implementa la lógica transaccional ACID sin persistir datos huérfanos.
- [ ] Respuestas HTTP se apegan al modelo de errores estándar (`400`, `409`, `412`, `422`).
- [ ] Pruebas unitarias pasan al 100% de éxito en Jest.
- [ ] `yarn typecheck` pasa con 0 errores de compilación.
- [ ] Rama con formato `(nombre-del-dev)/(feature-o-fix)-(dato-de-la-tarea)` creada desde `dev`.
- [ ] PR abierto hacia `dev` con revisores `jsaldias39,PabloArauzCaballero`.

### Criterios de Aceptación (GIVEN / WHEN / THEN)

#### Escenario 1: Flujo Exitoso Nominal
- **GIVEN** [condición inicial de datos y usuario autenticado].
- **WHEN** se invoca [endpoint HTTP con el payload válido].
- **THEN** la API responde [código HTTP y estructura del body].

#### Escenario 2: Rechazo por Validación de Esquema
- **GIVEN** [payload que carece de campo obligatorio o tiene formato inválido].
- **WHEN** se envía la petición.
- **THEN** la API responde `400 Bad Request` indicando la regla infringida.

#### Escenario 3: Rechazo por Regla Semántica o Conflicto
- **GIVEN** [estado previo que genera colisión o dato ajeno al catálogo].
- **WHEN** se ejecuta la operación.
- **THEN** la API responde [409 Conflict o 422 Unprocessable Entity] con mensaje explicativo.
```

---

## 6. Ejemplo Canónico de Referencia

Para consultar un ejemplo completo aplicado a esta plantilla, revisar el archivo:
👉 [`PROMPT_SUBTAREA_1_4_DEPARTAMENTO_EMISION.md`](file:///C:/Users/Usuario/.gemini/antigravity-ide/brain/a03dcc71-c895-4a75-ad01-86307bdf85e4/PROMPT_SUBTAREA_1_4_DEPARTAMENTO_EMISION.md)
*(Abarca la obligatoriedad de extensión departamental en cédulas bolivianas, validación contra `VS_BO_DEPARTMENT`, protocolo Git y pruebas Jest).*
