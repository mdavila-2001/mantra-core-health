# Capacidades

Lo que la aplicación permite hacer hoy, lo que tiene a medio camino y lo que no
existe. **Nada de esta página es aspiracional.**

---

## Implementadas y con pantalla

| # | Capacidad | Ruta | Prueba |
|---|---|---|---|
| 1 | Registrarse como paciente con documento | `/auth/registro` | ✅ |
| 2 | Registrarse como profesional con correo, matrícula y colegio | `/auth/registro` | ✅ |
| 3 | Iniciar sesión con correo o documento | `/auth` | ✅ |
| 4 | Aportar código de segundo factor | `/auth` | ✅ |
| 5 | Elegir organización cuando hay varias | `/auth/organizacion` | ✅ |
| 6 | Verificar el correo desde el enlace | `/auth/verificar` | ✅ |
| 7 | Pedir la recuperación de contraseña | `/auth/recuperar` | ✅ |
| 8 | Fijar la contraseña nueva con el token del correo | `/auth/nueva-clave` | ✅ |
| 9 | Mantener la sesión entre recargas | — (arranque) | ✅ |
| 10 | Cerrar sesión | Armazón | ✅ |
| 11 | Cambiar de organización | Armazón | ❌ `ShellLayout` sin prueba |
| 12 | Ver el estado de la sesión y la conexión | `/panel` | ❌ `Dashboard` sin prueba |
| 13 | Cambiar el tema (claro/oscuro/sistema) | Vitrina | ✅ |
| 14 | Explorar el sistema de diseño | `/design-system` | ✅ |

**Catorce capacidades reales.** Doce con prueba automatizada.

## A medio camino: capa de datos sin pantalla

Once operaciones escritas, probadas y **sin interfaz que las use**:

| Capacidad | Cliente | Qué falta |
|---|---|---|
| Verificar identidad (paciente) | `IdentityClient` | La pantalla |
| Verificar identidad (profesional) | `IdentityClient` | La pantalla |
| Verificar matrícula | `IdentityClient` | La pantalla |
| Consultar el estado de una verificación | `IdentityClient` | La pantalla |
| Subir un archivo de evidencia | `FilesClient` + `app-file-input` | La pantalla |
| Dar de alta un perfil de paciente (por personal) | `ProfilesClient` | La pantalla |
| Dar de alta un perfil de profesional | `ProfilesClient` | La pantalla |
| Vincular una cuenta a una persona | `ProfilesClient` | La pantalla |
| Leer opciones de un conjunto de valores | `TerminologyClient` | El formulario que las use |
| Activar una cuenta creada por otro | `IamClient.activate` | La pantalla |
| Dar de alta un usuario (administrador) | `IamClient.createUser` | La pantalla |

**No es código muerto**: todo tiene prueba. Es la mitad de un flujo cuya otra
mitad no se escribió.

### La cadena más completa

La verificación de identidad está **entera** salvo la pantalla:

```text
FilesClient.upload(evidencia, 'DOCUMENT', 'PHI')  →  { id }
      ↓
IdentityClient.requestPatientIdentityVerification({ evidenceFileId: id })
      ↓
IdentityClient.getVerificationCase(caseId)
```

Y `errorToViewState` ya sabe mandar ahí cuando la API responde
`IDENTITY_VERIFICATION_REQUIRED` — **aunque la ruta apunte a la API y no al
router**, que es la brecha `HIGH` registrada.

## Lo que no existe

| Capacidad | Estado |
|---|---|
| Historia clínica | **No** — aunque el reclamo del registro la promete |
| Turnos / agenda | **No** — ídem |
| Estudios y resultados | **No** — ídem |
| Órdenes médicas | No |
| Facturación | No |
| Directorio de profesionales navegable | Solo la lectura cruda en el panel |
| Perfil del usuario | No |
| Cambiar la contraseña **con** sesión | No. Solo la recuperación sin sesión |
| Cerrar sesión en todos los dispositivos | La API tiene `logout-all`; el cliente no lo usa **a propósito** |
| Descargar archivos | **No.** Hay subida, no bajada |
| Registro de organizaciones | No, aunque la ruta está en la lista de públicas |
| Notificaciones | No |
| Búsqueda | No |
| Exportación | No |
| Modo sin conexión | No |
| Internacionalización | No |

### La promesa que la interfaz todavía no cumple

Los reclamos de las pantallas dicen:

> *«Llevá tu historia clínica, tus turnos y tus estudios siempre con vos.»*
> *«Entrá y encontrá tu historia clínica, tus turnos y tus estudios en un solo
> lugar.»*

**Ninguna de las tres existe.** No es un defecto —el proyecto está en
construcción— pero conviene que quede escrito: alguien que se registre hoy no
encuentra nada de eso.

Los siete íconos del menú (`home`, `patients`, `calendar`, `orders`, `results`,
`billing`, `settings`) anticipan las secciones; **dos están en uso**.

## Capacidades transversales que sí están resueltas

Es lo que hace que las 81 secciones se puedan escribir rápido:

| Capacidad | Dónde |
|---|---|
| Nueve estados de interfaz, con sus reglas | `ViewState<T>` + `ViewStateHost` |
| Traducción de todo error de la API a un estado | `errorToViewState` |
| Sesión con refresco único y persistencia | `core/auth/` + `core/http/` |
| Multi-organización | `X-Tenant-Id` |
| Nombre accesible garantizado en formularios | `FORM_CONTROL_CONTEXT` |
| Armazón con salto, anuncio de ruta y foco | `app-shell` |
| Sistema de diseño con dos temas y 188 tokens | `styles.css` + `core/tokens/` |
| Tabla de datos con estados y cursor | `app-data-table` |
| Avisos y diálogos accesibles | `ToastService`, `app-dialog` |

**Nueve piezas transversales para catorce capacidades de producto.** La
proporción se invierte a medida que las secciones se escriban, que es
exactamente el objetivo.

## Cobertura de esta documentación

| Elemento | Documentado |
|---|---|
| Capacidades con pantalla | **14/14 (100 %)** |
| Capacidades sin pantalla | **11/11 (100 %)** |
| Rutas | 11/11 |
| Operaciones de API | 20/20 |
