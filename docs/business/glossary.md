# Glosario

Términos que aparecen en el código, en la interfaz y en la conversación con el
equipo de la API. **Cuando el término de la interfaz difiere del técnico, se dice
cuál va en cada sitio.**

---

## Dominio

| Término | Qué es | En la interfaz se dice |
|---|---|---|
| **ALOVIDA** | El ecosistema de salud al que pertenece la aplicación | — |
| **ALOVIDA** | El sistema de diseño, v1.0 | — |
| **M34** | El modelo canónico. Declara 81 secciones, 9 estados de interfaz y 14 proyecciones materializadas | — |
| **PHI** | *Protected Health Information*. Información de salud protegida | «datos clínicos» |
| **Tenant** | Organización a la que pertenece un usuario | **«organización»** |
| **Practitioner** | Profesional de salud | «profesional» |
| **Patient** | Paciente | «paciente» |
| **Person** | Registro del directorio, distinto de la cuenta de acceso | — |
| **Account link** | Vínculo entre una persona y una cuenta | — |
| **Matrícula** (`licenseNumber`) | Habilitación profesional | «matrícula» |
| **Nº de colegio** (`credentialNumber`) | Credencial del colegio profesional | «número de colegio» |
| **Value set** | Conjunto de valores de terminología | — |
| **Concept ID** | Identificador estable de un concepto. **Lo que se manda**; `display` es solo para mostrar | — |
| **Expansión** | La lista de opciones vigentes de un conjunto de valores | — |
| **Proyección materializada** | Vista precalculada del servidor. **Puede estar atrasada** → S7 | «datos que pueden estar atrasados» |

> **«Tenant» nunca aparece en la interfaz.** Se dice «organización». El término
> técnico vive en el código (`tenants[]`, `X-Tenant-Id`) y el de producto en las
> pantallas.

### Qué nunca ve el paciente

La regla que hace de una pantalla del paciente una pantalla **suya**, y no la de un
administrador con otro rol. Cada vez que faltó, volvió como captura de la analista
(H-05, H-07, F-01, F-03, F-12, F-16, F-17). Un dato que la viola **se esconde por
rol o se quita de la vista, nunca se borra del DTO**: a un administrador puede
servirle.

| Nunca en la vista del paciente | Ejemplo real | Qué se muestra en su lugar |
|---|---|---|
| Identificadores internos: uuid, `profileId`, `personId`, ids de fila | «Perfil 87b6…» al pie de la ficha del profesional (F-12) | Nada. Si hay que reclamar, el dato vive en la consola de administración |
| Códigos de sistema: `SCREAMING_SNAKE`, códigos generados (`MED-…`, `HRD-…`, `HEALTH_PRACTITIONER_PROFILES_015`) | «Código: MED-05152397-1» en cada tarjeta de la Guía (F-01) | Nombre, título profesional, especialidad |
| Roles, en código o en lista | «USER · PATIENT» en el menú de la cuenta (H-07) | Palabras: «Paciente» (`core/auth/role-labels.ts`) |
| «Tenant», «organización activa», «estado del sistema», «secciones disponibles» | «Organizaciones: 1 — Tu única organización» en el panel (F-16/F-17) | La organización se nombra por su nombre cuando hace falta; el vocabulario de administración, no |
| Herramientas de trabajo del profesional o del administrador: glosario, consolas, catálogos técnicos, vitrina de diseño | «Atención › Glosario» en el menú del paciente (F-03) | No se ofrecen: `roles` en `navigation.map.ts` y el guard de sección lo hacen cumplir, hijas incluidas |
| Prosa que explica la implementación: «salen de tu token», «cruza el proxy» | tarjeta «Tu sesión» del panel (H-07) | Lo que la persona puede hacer y con quién |

Cómo se comprueba: entrar como paciente y recorrer sus pantallas buscando
uuids, mayúsculas con guion bajo, «Código», «Roles», «Organización» y «sistema».
Es la lista que Justin convierte en E2E (J5).

## Los nueve estados del M34

| Código | `status` | Qué significa | Campo obligatorio |
|---|---|---|---|
| **S1** | `route-auth-pending` | La ruta resuelve permiso. **No se piden datos todavía** | — |
| **S2** | `loading` | Autorización resuelta, datos en camino | — |
| **S3** | `empty` | Sin resultados | **`nextAction`** |
| — | `ready` | Camino feliz | `data` |
| **S4** | `validation` | Validación, conflicto o límite de peticiones | `issues` |
| **S5** | `forbidden` | Prohibido sobre un recurso que **sí** se puede saber que existe | — |
| **S6** | `not-found` | No encontrado, **sin filtrar existencia** | — |
| **S7** | `stale` | Datos posiblemente atrasados | **`asOf`** |
| **S8** | `offline` | La petición **no llegó** | — |
| **S9** | `error` | Fallo inesperado | **`requestId`** |

`ready` **no tiene código S**: la lista enumera los estados que exigen un
tratamiento visual propio, y mostrar el contenido es el resto del tiempo.

## Códigos de error de la API

Copiados de `src/common/errors/error-codes.ts` del backend:

| Código | Estado | Nota |
|---|---|---|
| `VALIDATION_FAILED` | S4 | Los mensajes por campo salen de `details.messages` |
| `UNAUTHENTICATED` | S9 — **salvo en el login**, donde es S4 | |
| `FORBIDDEN` | S5 **sin acción** | **El muro** |
| `IDENTITY_VERIFICATION_REQUIRED` | S5 **con acción** | **La puerta** |
| `NOT_FOUND` | S6 | Se descartan `message` y `details` |
| `CONFLICT` | S4 | |
| `PRECONDITION_FAILED` | S4 | |
| `CONCURRENCY_CONFLICT` | S4 | «alguien cambió esto mientras lo editabas» |
| `PAYLOAD_TOO_LARGE` | S4 | «El archivo es demasiado grande» |
| `RATE_LIMITED` | S4 | Lee `Retry-After` |
| `DEPENDENCY_UNAVAILABLE` | S9 | «un servicio no está disponible» |
| `INTERNAL` | S9 | |

**Se ramifica por `code`, nunca por `message`.**

## Arquitectura

| Término | Qué es |
|---|---|
| **`core/`** | Infraestructura sin interfaz: sesión, HTTP, estados, tokens |
| **`shared/`** | Interfaz reutilizable: 48 componentes en tres niveles |
| **`features/`** | Pantallas |
| **Átomo / molécula / organismo** | Los tres niveles de atomic design. **El nivel es la carpeta**, no un decorador |
| **Barril** | `shared/index.ts`, la API pública de `shared/`. Hoy **no lo importa nadie** |
| **`ViewStateHost`** | El organismo que pinta los nueve estados, una vez para todo el proyecto |
| **`FORM_CONTROL_CONTEXT`** | El contrato de accesibilidad entre un campo y su control |
| **Fan-in** | Cuántos archivos importan a uno. **Lo que cuesta cambiarlo** |
| **Radio de firma** | `28px 4px 28px 4px`. Un elemento por pantalla, nunca en botones ni entradas |
| **Excepciones E1–E4** | Las excepciones WCAG declaradas por el sistema de diseño, con su medición |

## Sesión

| Término | Qué es |
|---|---|
| **Access token** | JWT de acceso. **Memoria**, minutos |
| **Refresh token** | Canjea por un par nuevo. **`localStorage`**, se rota entero |
| **`sub`** | Identificador del usuario. **El único claim obligatorio** |
| **`sid`** | Identificador de sesión, para cerrarla del lado del servidor |
| **`tenants[]`** | Organizaciones del usuario |
| **`tenantNames{}`** | Su nombre legible, «para no mostrar uuid crudos» |
| **`X-Tenant-Id`** | Cabecera con la organización activa. **Se omite si no está resuelta** |
| **`requestId`** | Identificador de correlación. En la interfaz: **«código de soporte»** |

## Herramientas y build

| Término | Qué es |
|---|---|
| **PnP** (Plug'n'Play) | El modo de instalación de Yarn 4. **No hay `node_modules`** |
| **Prerenderizado** | HTML generado en el build. **4 rutas** |
| **Hidratación** | Angular toma el HTML del servidor y lo hace interactivo |
| **`outputHashing`** | Hash en el nombre de cada archivo. Permite cachear un año |
| **Presupuesto** | Límite de tamaño de `angular.json`. Hoy avisa a 500 kB |
| **`env.generated.ts`** | Puente entre `.env` y el paquete. **Generado, no versionado** |
| **Manifiesto** (`MANIFEST`) | La lista blanca de variables que cruzan al navegador |

## Términos que **no** significan lo que parecen

| Término | Lo que **no** es |
|---|---|
| **`--st-error-*`** | **No es severidad clínica.** Es semántica de producto (`identidad-visual.md` 11.3) |
| **`--st-primary-*`** | **No es un estado.** Es un chip de marca con la misma receta tonal |
| **`--border-default`** | **No delimita controles.** Es un divisor decorativo. El de controles es `--border-strong` |
| **`isDevMode()`** | **No es una bandera de funcionalidad.** Es el modo de compilación |
| **Bandera de funcionalidad** | **No es autorización.** La autoridad es la API |
| **`generatedAt`** | **No es cuándo se calculó el dato.** Es cuándo se armó la respuesta. El dato es `refreshedAt` |
| **Cobertura global (≈56 %)** | **No es la métrica del proyecto.** Los umbrales son por área |

**La primera es la más importante en este dominio**: que un token se llame
`error` no significa que un resultado clínico crítico se pinte con él. Son dos
vocabularios distintos.
