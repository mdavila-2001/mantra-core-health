# Alta de profesional · títulos y adjuntos — qué falta para `dev`

**Fecha:** 2026-09-07 · **Actualizado:** 2026-09-09 (universidad, lugar de estudio y segunda
profesión) · **Rama con lo visual:** `mockup` · **Estado:** pantalla lista, sin conectar

---

## Titular

**El backend ya está construido, entero.** Tabla, tipos de título sembrados, endpoint para
que el profesional agregue sus títulos, campo para el archivo adjunto y endpoint de
verificación administrativa: **todo existe hoy en `dev`**. Lo que falta es **cablear el
front** y tomar **dos decisiones de producto**.

Esto es importante decirlo primero porque la reacción natural sería estimar «modelo +
API + front» y eso sería construir de nuevo lo que ya está. Todo lo de abajo está
verificado contra la base viva y el código, no deducido.

---

## 1. Lo que ya existe (no lo vuelvan a crear)

### La tabla

`profiles.professional_credentials` — una fila por título o matrícula, **N por
profesional**, con historial propio en `audit.professional_credentials_history`.

| Columna | Para qué sirve acá |
|---|---|
| `practitioner_profile_id` | de quién es |
| `credential_type_concept_id` | **qué tipo de título es** |
| `number` | el número (matrícula, registro, o el del diploma) |
| `issuing_institution_text` · `issuing_authority_tenant_id` · `issuing_country_concept_id` | quién lo emitió |
| `issue_date` · `expiry_date` | fechas |
| **`file_id`** | **el archivo adjunto**, FK a `common.files` |
| `state_concept_id` | el estado de la credencial |
| `verified_by_user_id` · `verified_at` · `verification_source_uri` | **quién la verificó y cuándo** |

En la base viva hay **75 filas** … y **0 con `file_id`**: la columna está, nadie la usa
todavía. Ese es exactamente el hueco que abre este trabajo.

### Los tipos de título, ya sembrados

Los cuatro que pidió el cliente ya son conceptos de terminología. No hay que inventar
ningún enum ni sembrar nada:

| Pedido | Concepto que ya existe |
|---|---|
| Título profesional universitario | `profiles:CREDENTIAL_TYPE_DEGREE` |
| Título de Diplomado | `profiles:CREDENTIAL_TYPE_DIPLOMA` |
| Título de Maestría | `profiles:CREDENTIAL_TYPE_MASTER` |
| Título de Doctorado | `profiles:CREDENTIAL_TYPE_DOCTORATE` |
| _(bonus)_ Especialidad | `profiles:CREDENTIAL_TYPE_SPECIALTY` |

Hoy las 75 filas vivas son **todas** `_DEGREE`: el alta archiva ahí lo que carga, sin
distinguir tipo.

### Los endpoints

| Qué | Ruta | Notas |
|---|---|---|
| El profesional agrega un título propio | `POST /profiles/practitioners/me/credentials` | `AddOwnCredentialDto` |
| Un administrativo lo verifica | `POST /profiles/practitioners/credentials/:credentialId/verify` | **`@Roles('SECURITY_ADMIN')`** |
| Subir el archivo | `POST /common/files/upload` (multipart) y `POST /common/files` | controlador `common-files.controller.ts`, con versiones y descarga |

Y `AddOwnCredentialDto` **ya acepta el archivo**:

```
credentialTypeConceptId!  (uuid, obligatorio)
number!                   (obligatorio)
issuingInstitutionText?   (opcional)
issueDate?                (opcional)
fileId?                   (opcional) — "Archivo del diploma (debe haberlo subido el mismo usuario)"
```

O sea: **el contrato para «un título con su archivo adjunto» ya está publicado y
funcionando.** Nadie lo está llamando desde el front.

---

## 2. Lo que hicimos en `mockup` (sólo pantalla)

El wizard de alta pasó de 10 a **12 pasos**, con este orden:

```
1 nombre · 2 documento · 3 sexo y nacimiento · 4 contacto privado (correo de acceso)
5 contacto de trabajo · 6 dónde vivís · 7 TÍTULO PROFESIONAL + foto + diploma
8 habilitación (matrícula/SEDES) · 9 respaldos de la habilitación
10 los demás títulos · 11 especialidades · 12 contraseña
```

Tres pasos cambiaron o nacieron:

| Paso | Clave | Qué muestra |
|---|---|---|
| 7 | `practice` | **Título profesional, ahora obligatorio**, con su **diploma opcional** adjunto ahí mismo |
| 9 | `credential-files` | Un adjunto para la **matrícula** y otro para el **registro del SEDES**, cada uno al lado del número que respalda |
| 10 | `academic-titles` | Los **cuatro tipos**, cada uno con «+ Agregar», y cada fila con nombre + su propio archivo |

### Por qué el título profesional se movió al paso 7

No es cosmético. **De él dependen dos cosas que se preguntan después:**

- el **colegio** que se ofrece en la habilitación (paso 8) — el registro de procesos lo pide
  explícito: «Al seleccionar la profesión del Doctor tiene que de manera automática cambiar
  … el REGISTRO DEL COLEGIO MEDICO O COLEGIO DE ODONTOLOGO»;
- la **lista de especialidades** (paso 11) — un odontólogo no elige entre las 36 del catálogo.

Mientras se preguntaba al final, esas dos se elegían a ciegas y después se «acomodaban
solas», que es justo lo que hace dudar de si algo se perdió. Ahora el orden sigue la
dependencia real.

### La ocupación se quitó del alta de profesional

**Era el campo equivocado.** «Ocupación» es un dato de la *persona*
(`profiles.persons.occupation_concept_id`) y su catálogo son oficios generales —Agricultor,
Chofer, Comerciante—: un médico terminaba declarándose «Comerciante». Lo que dice **qué
clase de profesional es** es el **título**, que ya tiene su propia lista cerrada de doce y
su columna.

Consecuencias que hay que tener presentes en `dev`:

- **En el alta de paciente la ocupación se queda**, y ahí sí corresponde. El catálogo
  `VS_BO_OCCUPATION` es compartido: **no lo toquen pensando sólo en el médico**.
- Un profesional dado de alta por este camino deja `persons.occupation_concept_id` **en
  nulo**. Si algún listado o informe lo daba por lleno, ahora no lo va a estar.
- El componente dejó de pedir ese catálogo: **son tres lecturas al arrancar, no cuatro**
  (departamentos, municipios y especialidades). Hay una prueba que lo fija.

Reglas de pantalla que hay que conservar al conectar:

- Todos los títulos son **opcionales**: el alta se completa sin cargar ninguno.
- De cada tipo se puede cargar **más de uno** (hay médicos con dos carreras).
- **Cada archivo pertenece a un título concreto.** Quitar un título se lleva su archivo y
  no toca el de al lado. Hay pruebas que lo fijan.
- **PDF, JPG o PNG, hasta 5 MB.** Lo que no cumple se rechaza con mensaje, no en silencio.
- El adjunto de la matrícula se muestra **al lado de su número** (`MP-12345`), para que
  quien verifica no tenga que abrirlo para saber de cuál es.

Archivos: `src/app/features/auth/register-practitioner/` (`.ts`, `.html`, `.css`, `.spec.ts`).

En `mockup` **nada de esto viaja**: hay una prueba que lo fija explícitamente, para que el
día que se conecte, falle y alguien la actualice a propósito.

---

## 3. Lo que falta de verdad

### 3.1 Cablear el front (el grueso, y es sólo front)

1. Subir cada archivo con `POST /common/files/upload` y quedarse con el `fileId`.
2. Por cada título cargado, `POST /profiles/practitioners/me/credentials` con su
   `credentialTypeConceptId`, su `number`, su `issuingInstitutionText` y su `fileId`.
3. Ídem para los respaldos de matrícula y SEDES, con el tipo que corresponda.

**El mapeo pantalla → modelo, campo por campo:**

| Lo que se ve | Dónde va | Con qué tipo |
|---|---|---|
| Título profesional (paso 7, **obligatorio**) | `professionalTitle` del alta, como hoy | — |
| Diploma del título (paso 7, opcional) | una credencial con `fileId` | `profiles:CREDENTIAL_TYPE_DEGREE` |
| Matrícula profesional + su archivo | la credencial de la matrícula, hoy ya se crea | el tipo que ya usa el alta |
| Registro del SEDES + su archivo | otra credencial | ídem |
| **Universidad del título (paso 7)** | `issuingInstitutionText` de esa credencial | — |
| **País de estudio (paso 7)** | `issuingCountryConceptId` — **el DTO no lo expone todavía**, ver §3.7 | — |
| **Ciudad de estudio (paso 7)** | **no tiene columna**, ver §3.7 | — |
| Otra profesión (repetible) | una credencial por fila, con su universidad, país, ciudad y archivo | `..._DEGREE` |
| Diplomado (repetible) | una credencial por fila | `..._DIPLOMA` |
| Maestría (repetible) | una credencial por fila | `..._MASTER` |
| Doctorado (repetible) | una credencial por fila | `..._DOCTORATE` |

**Ojo con una ambigüedad que hay que resolver antes de escribir el código:** el diploma del
paso 7 y el «título universitario» repetible del paso 10 son **el mismo tipo**
(`_DEGREE`). Hay dos lecturas posibles y hay que elegir una a propósito:

- **el paso 7 crea la credencial principal** y el paso 10 sirve para la *segunda* carrera
  («yo conozco médicos con 2 carreras profesionales», dice el registro de procesos); o
- **el paso 7 sólo adjunta** el diploma de la credencial que ya crea el alta, y todo el
  resto vive en el paso 10.

La pantalla actual soporta las dos. La diferencia se ve al leer el perfil: en la primera
hay dos filas `_DEGREE`, en la segunda una.

**Ojo con dos trampas conocidas del front**, las dos ya mordieron:

- **`iam.client.ts` arma el cuerpo del alta campo por campo.** Lo que el contrato declare
  y esa lista no repita **no viaja, y nadie avisa**. Pasó con la modalidad (PR #241) y con
  el correo de trabajo esta semana.
- **La API valida con `forbidNonWhitelisted`**: un campo que el DTO no declara no se
  ignora, **rechaza la petición entera** con 422.

### 3.2 Decisión de producto nº 1 — ¿durante el alta o después?

Los endpoints de credenciales son **`/me/`**: piden estar autenticado. El alta pública
todavía no tiene sesión. Dos caminos:

- **A — cargar los títulos después del alta**, desde «Mi perfil», con la misma pantalla.
  Es lo que los endpoints ya soportan **sin tocar nada del backend**. El profesional
  termina el registro y completa su ficha después.
- **B — permitir la carga durante el alta.** Exige que subir archivos y crear credenciales
  sea posible **sin sesión** (o con un token de alta), y eso es cambiar seguridad en una
  superficie pública. No es un import: es una decisión de arquitectura.

**Recomendación:** A. Es gratis, ya funciona, y el pedido no dice que tenga que ser
durante el alta — dice que el profesional pueda cargarlos y que un administrativo los
verifique.

### 3.3 Decisión de producto nº 2 — quién verifica

La verificación existe y hoy exige **`SECURITY_ADMIN`**. Hay que confirmar si ese es el
rol que el cliente entiende por «los administrativos». Si se necesita otro, **cuidado**:
está medido que `role-mapping.ts` declara un `RoleCode` **cerrado de seis** y descarta en
silencio lo que no conoce; agregar un rol nuevo es tocar ese mapa, no sólo el decorador.
Ya pasó con seguros y contabilidad, que quedaron alcanzables sólo por `SUPERADMIN`.

### 3.4 Quién puede VER un título subido

`common.files` entrega el contenido a quien lo subió o a un rol de revisión. Que un
**paciente** vea el título de su médico es una decisión de acceso **que no está tomada**.
Este trabajo abre la carga; no resuelve quién lo mira.

### 3.5 Pantalla de administración

No la buscamos. El endpoint de verificación existe; falta confirmar si hay UI que lo
llame. Si no la hay, es alcance propio y no parte de esto.

---

### 3.7 Universidad, lugar de estudio y la segunda profesión (09/09/2026)

El propietario pidió tres cosas más sobre esta misma pantalla, y las tres están **en
pantalla y ninguna viaja**, igual que el resto de este documento:

1. **Elegir la universidad** del título con el que ejerce.
2. **El lugar de estudio: país y ciudad.**
3. **Más de una profesión** — «hay doctores que aparte de ser doctores han estudiado otra
   profesión» —, cada una opcional y con su universidad, su lugar de estudio y su diploma.

Cómo quedó:

- El paso 7 («Tu título profesional y foto») ganó un bloque **Universidad · País de estudio ·
  Ciudad de estudio**, los tres opcionales, entre el título y su diploma. Son un campo
  proyectado (`professionalTitleEducation`) porque la página ya estaba en el tope de cuatro.
- El paso 10 («Tus títulos») ya permitía cargar varios de cada tipo; ahora **cada fila** lleva
  las mismas tres casillas además del nombre y el archivo.
- El primer tipo dejó de llamarse «Título profesional universitario» y es **«Otra
  profesión»**: es el lugar de la segunda carrera. La profesión con la que ejerce ya se
  eligió, obligatoria, en el paso 7 — rotularlo por el tipo de diploma escondía para qué está.

**Los tres campos son de texto libre, y es una decisión, no una omisión:**

| Campo | Por qué texto |
|---|---|
| Universidad | El modelo ya la guarda así a propósito (`issuingInstitutionText`: «las universidades del exterior no están en ningún catálogo nuestro»). **No hay padrón de universidades en ninguna de las cuatro capas** y la regla de datos del proyecto pide no hardcodear uno sin dataset ni estrategia de importación. |
| País | La columna sí es un concepto (`issuing_country_concept_id`), pero hoy existen **dos** en toda la aplicación —`COUNTRY_BO` y `COUNTRY_PE` (`src/common/constants/concepts.ts`)— y **`VS_COUNTRY` no tiene miembros sembrados**. Un desplegable cerrado ofrecería dos opciones y dejaría afuera a quien estudió en Cuba, Argentina o España. |
| Ciudad | **`profiles.professional_credentials` no tiene columna de ciudad.** Ver abajo. |

#### Lo que falta del lado del modelo, y es lo único de esto que NO es sólo front

- **País:** la columna existe; lo que falta es **sembrar `VS_COUNTRY`** y **exponer
  `issuingCountryConceptId` en `AddOwnCredentialDto`**, que hoy no lo declara. Con eso el
  campo pasa de texto a combobox sin tocar la pantalla más que en el origen de las opciones.
- **Ciudad:** **no hay dónde guardarla.** Es cambio de modelo, por el camino obligatorio
  (`.puml` → `gen_ddl.py` → `SQL/` → base → ORM; ADR-0021). Dos salidas posibles, y hay que
  elegir a propósito: una columna `issuing_city_text` al lado de `issuing_institution_text`,
  o `issuing_administrative_area_concept_id` si se quiere que sea catálogo. **La API no
  escribe DDL: esto empieza en `mantra-core-health-model/`, no acá.**

Hasta que eso pase, la ciudad se pregunta y **se pierde al enviar**. Está fijado por prueba
(`nada de esto viaja en el alta todavía`), que también comprueba que los tres campos nuevos
no se cuelen en el cuerpo: la API valida con `forbidNonWhitelisted` y un campo de más
**rechaza el alta entera con 422**, no lo ignora.

### 3.6 Dos decisiones más, chicas, que dejó abiertas lo visual

- **El título profesional obligatorio** hoy vive en `professionalTitle`, una columna de
  texto con lista cerrada de doce. El registro de procesos lo trata como la profesión que
  manda sobre matrícula y colegio. Si alguna vez pasa a ser `*_concept_id` —lo natural—,
  es cambio de modelo, no de pantalla.
- **La ambigüedad `_DEGREE`** de §3.1: quién crea la credencial principal.

## 4. Orden sugerido

1. Responder **3.2** (A o B) y **3.3** (qué rol verifica). Sin eso no arranca nada.
2. Conectar el front contra los endpoints que ya existen (§3.1).
3. Confirmar/crear la pantalla de administración para verificar (§3.5).
4. Recién si aparece algo que el contrato actual no cubra, tocar el modelo — **y ahí sí**
   por el camino obligatorio: `.puml` → `gen_ddl.py` → `SQL/` → base → ORM (ADR-0021).
   La API **no** escribe DDL.

---

## 5. Estado de lo ya hecho

Sobre `mockup`, al momento de escribir esto:

- `corepack yarn typecheck` → **exit 0**
- Spec del alta de profesional: **62 en verde**, con 9 pruebas nuevas sobre esto (varios
  del mismo tipo, adjunto pegado a su título, quitar uno sin tocar el otro, formato
  inválido, peso máximo, respaldos independientes, que nada viaja todavía, el título
  obligatorio y su diploma opcional). Se **retiraron** las 8 de ocupación, que dejaron de
  aplicar
- Regresión `src/app/features/auth/**`: **262 en verde**
- Verificado a ojo en el navegador, paso por paso

**No verificado:** nada contra la API real — en `mockup` no hay backend.

### De paso, un defecto preexistente que se corrigió

El CSS de este formulario usaba **nueve variables que no existen** en el sistema de
tokens (`--color-primary`, `--radius-sm/md`, `--color-border`, `--color-surface`,
`--color-text-muted`, `--font-sm/xs/medium`, `--color-danger`). Por eso el botón de
«Subir foto de perfil» se veía como texto plano. Reemplazadas por las reales
(`--brand-primary`, `--r-sm/md`, `--border-default`, `--bg-surface`, `--text-muted`,
`--fs-body/caption`, `--text-danger`). **Vale la pena grepear esas variables en el resto
del front**: si están acá, es probable que estén en otras pantallas.
