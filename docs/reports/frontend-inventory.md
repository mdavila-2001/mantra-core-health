# Inventario funcional del frontend

**Fase 2 del plan documental.** La fotografía de lo que el usuario puede ver y
hacer, con sus cifras. Las tablas exhaustivas se regeneran desde el código y
viven en [`generated/`](generated/route-inventory.md).

---

## Cifras

| Elemento | Cantidad |
|---|---:|
| Archivos en `src/` | 336 |
| Archivos TypeScript | 211 |
| Importaciones internas | 587 |
| **Dependencias externas en ejecución** | **10** |
| Rutas declaradas | 11 |
| **Pantallas navegables** | **8** |
| Componentes | 61 |
| — átomos / moléculas / organismos | 15 / 19 / 14 |
| — pantallas y galerías | 11 |
| Servicios inyectables | 15 |
| Clientes de API | 6 |
| **Operaciones HTTP** | **20** |
| — con pantalla que las use | 9 |
| Guards / interceptores | 1 / 1 |
| Archivos de prueba | 71 |
| **Pruebas** | **804** |
| Tokens de diseño | 188 |
| Estados de interfaz contractuales | 9 |

## Rutas

| URL | Pantalla | Acceso | Render | Datos |
|---|---|---|---|---|
| `/` | `ShellLayout` (layout) | `authGuard` | Cliente | — |
| `/dashboard` | `Dashboard` | `authGuard` | Cliente | `GET /public/directory` |
| `/auth` | `Login` | Pública | **Prerender** | `POST login` |
| `/auth/register` | `RegisterPatient` | Pública | **Prerender** | 2 registros |
| `/auth/organization` | `TenantSelection` | Pública* | Cliente | — (token) |
| `/auth/verify-email` | `VerifyEmail` | Pública | Cliente | `POST verify-email` |
| `/auth/forgot-password` | `ForgotPassword` | Pública | **Prerender** | `POST forgot-password` |
| `/auth/reset-password` | `ResetPassword` | Pública | Cliente | `POST reset-password` |
| `/design-system` | `DesignSystemSample` | Pública | **Prerender** | — |
| `''` (hija) | → `/dashboard` | `authGuard` | — | — |
| `**` | → `/` | Pública | Cliente | — |

\* Sin guard: alcanzable sin sesión, y entonces muestra una lista vacía.

**Cobertura documental: 11/11 (100 %).** Fichas en
[`docs/routes/`](../routes/route-catalog.md).

## Pantallas y sus estados

| Pantalla | Estados que produce | Usa `ViewStateHost` |
|---|---|---|
| Login | `ready` · S2 · S4 · S8 · S9 | **No** — `app-alert` propio |
| Registro | `ready` · S2 · S4 · S8 · S9 · confirmación | **No** |
| Elegir organización | lista / lista vacía | **No** — no hace peticiones |
| Verificar correo | 4 estados propios | **No** |
| Recuperar | `ready` · S2 · S4 · S8 · S9 · acuse | **No** |
| Nueva contraseña | `ready` · S2 · S4 · S8 · S9 · confirmación · sin token | **No** |
| **Panel** | **S2 · S3 · S7 · `ready` · S8 · S9** | **Sí** |
| Vitrina | los de cada componente exhibido | Parcial (`ViewStateGallery`) |

**Solo el panel usa el organismo de estados**, y es lo que explica que sea la
única pantalla que hereda la región viva y el foco en S4. Es el origen de la
familia de hallazgos A11Y-01/03/04.

## Componentes compartidos

| Nivel | Cantidad | Con prueba | Reutilización destacada |
|---|---:|---:|---|
| Átomos | 15 | 14 | `AppButton` (25), `Input` (11), `Link` (9) |
| Moléculas | 19 | 15 | `FormField` (11), `Alert` (8), `Menu` (8) |
| Organismos | 14 | 12 | `Shell`, `DataTable`, `ViewStateHost` |

**Los cinco sin prueba propia entre átomos y moléculas son subcomponentes** que
solo existen dentro de su padre. Por eso `shared/` está al 94 %.

Detalle en [el inventario generado](generated/component-inventory.md).

## Servicios

| Servicio | Ámbito | Prueba |
|---|---|---|
| `SessionStore`, `AuthService`, `ThemeService`, `Breakpoints`, `ToastService` | root | ✅ |
| `IamClient`, `IdentityClient`, `ProfilesClient`, `TerminologyClient`, `FilesClient` | root | ✅ |
| `RefreshTokenStorage`, `TokenRefreshService`, `PublicClient`, `DialogService`, `ShellService` | root | **❌** |

Los cinco sin `.spec.ts` están cubiertos indirectamente (cobertura de `core/`:
87 %). **`TokenRefreshService` es el que más merece una propia**: su garantía de
una sola petición en vuelo es exactamente lo que una prueba fija.

## Superficie de red

| Cliente | Operaciones | Con consumidor |
|---|---:|---:|
| `IamClient` | 11 | 8 |
| `PublicClient` | 1 | 1 |
| `IdentityClient` | 4 | **0** |
| `ProfilesClient` | 3 | **0** |
| `TerminologyClient` | 1 | **0** |
| `FilesClient` | 1 | **0** |
| **Total** | **20** | **9** |

**Cero peticiones fuera de `core/data-access/`** — verificado por
`check-architecture.mjs`.

Las once sin consumidor **no son código muerto**: todas tienen prueba, y son la
mitad de un flujo cuya interfaz no se escribió.

## Estado de interfaz por capacidad

| Capacidad | Interfaz | Datos | Prueba |
|---|---|---|---|
| Autenticación completa | ✅ | ✅ | ✅ |
| Multi-organización | ✅ | ✅ | ⚠️ parcial |
| Recuperación de contraseña | ✅ | ✅ | ✅ |
| Verificación de correo | ✅ | ✅ | ✅ |
| Panel | ✅ | ✅ | **❌** |
| Sistema de diseño | ✅ | n/a | ✅ |
| **Verificación de identidad** | **❌** | ✅ | ✅ |
| **Altas por personal** | **❌** | ✅ | ✅ |
| **Terminología en formularios** | **❌** | ✅ | ✅ |
| **Subida de archivos** | ⚠️ componente sí, pantalla no | ✅ | ✅ |
| **Todo lo clínico** | **❌** | **❌** | — |

## Lo implementado frente a lo planificado

| | Cantidad |
|---|---:|
| Secciones del modelo M34 | **81** |
| Pantallas implementadas | **8** |
| Íconos de navegación declarados | 7 |
| Ítems de menú en uso | **2** |

> *«Las 81 secciones del modelo se van agregando a medida que sus pantallas se
> escriben — un ítem que lleva a una ruta vacía es peor que no tenerlo.»*

**Esta documentación cubre el 100 % de lo implementado.** Lo planificado y no
construido no se documenta como si existiera.

## Criterio de salida de la Fase 2

| Requisito | Estado |
|---|---|
| Inventario del 100 % de rutas registradas | ✅ 11/11 |
| Diferencia lo implementado, lo inaccesible, lo obsoleto y lo planificado | ✅ |
| Pantallas con actor, acciones, estados y endpoints | ✅ [fichas de ruta](../routes/route-catalog.md) |
| Componentes compartidos inventariados **sin moverlos ni refactorizarlos** | ✅ Cero archivos de `src/` modificados |
| Journeys documentados | ✅ [recorridos](../business/user-journeys.md) |
