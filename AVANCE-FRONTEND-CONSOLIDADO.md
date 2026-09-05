# Avance del frontend — documento consolidado

**Proyecto:** mantra-core-health (Angular 21.2, standalone + signals + SSR)
**Fecha:** 2026-08-01
**Rama al momento de escribir:** `refactor/auditoria-atomic-design`

Este documento reúne en un solo lugar lo que hoy está repartido en `ESTADO-FRONTEND.md`,
`AVANCE-FRONTEND-2026-08-01.md`, `PENDIENTES-BACKEND.md`, `COORDINACION-AGENTES.md` y
`docs/auditoria/`. No los reemplaza: cada uno conserva el detalle fino de su tema.

---

## 0 · Advertencia: el estado de este preciso momento

**El proyecto no compila ahora mismo, y es un estado transitorio esperado, no una regresión.**

- Hay un **merge sin commitear en curso** (`MERGE_HEAD` presente): se está integrando `origin/dev`
  dentro de `refactor/auditoria-atomic-design`.
- Ese merge mueve **309 archivos, +25 490 líneas**.
- El dev server levanta pero el bundle falla con errores de resolución de imports que **cambian de
  un minuto a otro** (`form-control.context`, luego `radio-group`, luego `avatar.types`): son
  archivos en pleno movimiento entre `atoms/`, `molecules/` y `organisms/`.

Todas las métricas de más abajo corresponden a **cada línea de trabajo antes del merge**. Después
del merge no hay ninguna cifra verificada todavía.

---

## 1 · Lo más importante: hay dos líneas de trabajo y se están fusionando ahora

No es un merge mecánico. Las dos ramas **partieron del mismo commit y evolucionaron sin verse**.

```
ca3a245  ← merge-base: el ancestro común de las dos líneas
   │
   ├─ 24 commits ──▶ origin/dev (26e3dd9)          LÍNEA A · producto
   │                 auth, pantallas, sesión, errores
   │
   └─  3 commits ──▶ refactor/auditoria-… (099b3bd) LÍNEA B · arquitectura
                     atomic design, alias, barriles, ESLint
```

| | **Línea A — producto** | **Línea B — arquitectura** |
|---|---|---|
| Rama | `origin/dev` | `refactor/auditoria-atomic-design` |
| Commits desde el ancestro | 24 | 3 |
| Qué hizo | Ciclo de autenticación completo, 7 pantallas, capa HTTP, modelo de errores | Reparó el build, reclasificó el design system, alias e ESLint |
| Pruebas al cierre | **778** en 68 archivos | **211** en 22 archivos |
| Documentado en | `ESTADO-FRONTEND.md`, `AVANCE-FRONTEND-2026-08-01.md` | `docs/auditoria/01`, `docs/auditoria/02` |

**Por qué chocan:** la línea B **movió y renombró media estructura** de `shared/` (componentes que
cambiaron de nivel atómico, tipos que cambiaron de archivo, alias `@shared` nuevos). La línea A
construyó todo un sistema de autenticación **sobre las rutas viejas**, sin saber que se moverían.
De ahí los errores de import de ahora.

**Además, dentro de la propia línea A hubo un segundo tenedor** (documentado en
`AVANCE-FRONTEND-2026-08-01.md` §2): dos implementaciones independientes de login, recuperación de
contraseña, `AuthService`, guard y modelo de errores — una del agente de Pablo en `origin/dev`, otra
en `justin/avance-2026-08-01`. Ambas funcionan y ambas tienen pruebas. Esa reconciliación **es una
decisión de qué implementación queda en cada pieza**, no un conflicto textual.

---

## 2 · Lo construido — funcionalidad (línea A)

### El ciclo de autenticación, verificado contra la API viva

No solo con specs: ejecutado contra `localhost:3000` con la base reconstruida.

```
POST /iam/auth/register-patient       → 201 · PAT-0ac04878-…
POST /iam/auth/register-practitioner  → 201 · PRC-5e2c73e0-…
POST /iam/auth/login (correo real)    → 200 con tokens
POST /iam/auth/login (clave mala)     → 401
POST /iam/auth/forgot-password        → 202, mismo cuerpo exista o no la cuenta
GET  localhost:4200/auth              → 200, SSR del login real
```

### Pantallas

| Ruta | Qué es |
|---|---|
| `/auth` | Login: un campo que acepta correo o documento, MFA opcional, enlaces a registro y recuperación |
| `/auth/registro` | Registro dual paciente / profesional (dos formularios: los obligatorios no se solapan) |
| `/auth/recuperar` | Pide el enlace de recuperación; el acuse no revela si la cuenta existe |
| `/auth/nueva-clave?token=…` | Fija contraseña nueva; informa cuántas sesiones se cerraron |
| `/auth/verificar?token=…` | Landing del correo de verificación; un token vencido no se presenta como alarma |
| `/auth/organizacion` | Selector de organización cuando el token trae varios tenants, con nombres legibles |
| `/` (panel) | Saluda por nombre, muestra organización y roles del token, cierra sesión contra el servidor |
| `/design-system` | La vitrina, a propósito sin sesión |

### Infraestructura de sesión

- **Interceptor de autenticación** — `Bearer` + `X-Tenant-Id`, **refresco único en vuelo** (dos 401
  simultáneos disparan un solo refresh), reintento que no recursa, rutas públicas exceptuadas.
- **`AuthService` + 3 guards** — sesión con signals. El access token **no se persiste** (vive
  minutos; guardarlo solo agranda la ventana de XSS); el refresh token sí, porque sin él recargar
  sería volver a escribir la contraseña.
- **La regla que gobierna los guards:** nadie pregunta «¿hay sesión?» antes de que la restauración
  termine. Los tres hacen `await auth.ensureRestored()` sobre una promesa compartida. Sin eso, cada
  F5 expulsaba al login de forma intermitente.
- **El logout revoca del lado del servidor** (`POST /iam/auth/logout`) y limpia localmente **pase lo
  que pase**: si la red falla, la persona igual quiso salir. Verificado: tras cerrar sesión, reusar
  el refresh token da 401.

### Modelo de errores

`api-error.ts` + `error-to-view-state.ts` ramifican sobre **`error.code`**, nunca sobre el mensaje ni
sobre el status HTTP solo. El backend declara ese enum como contrato explícito.

Los dos 403 son estados opuestos y se distinguen por un campo estable:

- `FORBIDDEN` → muro sin acción.
- `IDENTITY_VERIFICATION_REQUIRED` → puerta, con ruta al flujo de verificación.
  Excepto el subcaso `no-person-linked`, donde el trámite **no se ofrece**: verificar la identidad de
  alguien que todavía no está vinculado a la cuenta es un callejón con cartel de salida.

`NOT_FOUND` descarta mensaje y detalles a propósito, para no filtrar existencia de recursos.

### Detalles que salieron de probar, no de leer

- **`autocomplete` en el átomo `Input`** — el navegador guardaba el número de credencial como nombre
  de usuario. Ahora cada campo declara su pista, con la distinción fina de que el correo es
  `username` en el alta de profesional (es su credencial) y `email` en la de paciente (es contacto).
- **`TokenRefreshService` no persistía la rotación** — el refresh rota el par completo; sin
  reescribir lo guardado quedaba un token muerto y la recarga siguiente terminaba en el login.
- **El `?volverA=` se valida** — solo rutas internas que empiecen con `/`, y `//` se rechaza. Sin
  eso el login es un redirector abierto.
- **El identificador se elige, no se adivina** — la API acepta correo *o* documento y mandar los dos
  es un 400. Inferir por la arroba haría que un documento mal tipeado se mandara como correo y la
  persona no entendería el rechazo.

---

## 3 · Lo construido — arquitectura y design system (línea B)

Partió de una auditoría con un hallazgo crítico: **`dev` no compilaba** (18 errores). El commit
`ca3a245` había incorporado plantillas y CSS completos del sistema de avisos dejando las clases como
stubs vacíos del CLI.

| Fase | Qué hizo | Resultado |
|---|---|---|
| **2** | Reparación del build: `ToastService`, `Toast`, `ToastContainer`, `ToastDevPanel` implementados derivando el contrato de las plantillas y el CSS existentes | 18 errores → **0** |
| **3** | Alias `@core`/`@shared`/`@features`, barriles `index.ts`, `loadComponent` en todas las rutas | Bundle inicial 391,98 kB → **286,40 kB** crudo (−27 %); 1 → **5** chunks diferidos |
| **4** | Reclasificación atómica | 7 componentes movidos de nivel |
| **5** | `injectFormControl()` (7 consumidores) y extracción de `organisms/dialog/` desde `date-picker` | Sin cambio de comportamiento: 196/196 pruebas siguieron pasando sin tocar ninguna |
| **6** | ESLint (`angular-eslint` 22) con las reglas de arquitectura verificadas | `yarn lint` → **0 errores** |
| **7** | Documentación (`CLAUDE.md`) | **No iniciada** |

### Reclasificaciones y su motivo

| Componente | De | A | Motivo |
|---|---|---|---|
| `RadioGroup` | atoms | molecules | El grupo **es** el control: tiene el `value` y coordina a sus hijos |
| `Radio` | atoms | molecules | «Un radio suelto no significa nada» — no es reutilizable solo |
| `AvatarGroup` | atoms | molecules | Compone avatares y calcula desborde |
| `FileInput` | atoms | molecules | Área de soltar, validación de tipo/tamaño/cupo |
| `DatePicker` | molecules | organisms | Abre diálogo modal, mueve y atrapa el foco |
| `ToastContainer` | molecules | organisms | Es la región viva y coordina la cola entera |
| `form-control.context.ts` | `components/form-control/` | `shared/forms/` | No es un componente: es un contrato de DI |

### Lo que la auditoría marcó como fortaleza y **no** hay que tocar

- **`FORM_CONTROL_CONTEXT`** resuelve accesibilidad de formularios de forma estructural: el campo
  genera `id`/`aria-describedby` y el control los consume. Es mejor que lo habitual.
- **Ids estables entre servidor y cliente** (`nextControlId`) — la hidratación no rompe.
- **`design-tokens.types.ts` declara nombres, nunca valores** — evita deriva CSS ↔ TS por
  construcción.
- **Cero uso de `any`** en todo el repo, verificado.
- Decisiones difíciles ya resueltas y comentadas: `0` válido en inputs numéricos, correos no pasados
  a minúsculas (RFC 5321), `aria-disabled` en vez de `disabled` nativo.

### Una decisión de accesibilidad que vale conocer

El lint marcó el fondo del diálogo (clic sin manejador de teclado). **Se suprimió de forma acotada,
con la razón escrita en el código**: el equivalente por teclado es **Escape**, que el diálogo ya
atiende. Añadir `tabindex` a un fondo decorativo lo metería en el orden de tabulación *dentro de la
propia trampa de foco* — sería peor para quien navega con teclado. La regla no puede ver el Escape
del elemento hermano.

---

## 4 · Métricas

Cada columna es de **su** rama, antes del merge. No son comparables entre sí: miden bases distintas.

| Métrica | Línea A (`dev`) | Línea B (`refactor`) |
|---|---|---|
| Pruebas | 778 en 68 archivos | 211 en 22 archivos |
| Build | ✅ SSR + 8 rutas prerenderizadas | ✅ |
| Lint | no existía | ✅ 0 errores |
| Cobertura | umbrales bloqueantes 80/80/60 | — |
| Bundle inicial (transferencia) | — | 80,96 kB |

**Árbol fusionado ahora mismo:** 211 archivos `.ts`, 71 `.spec.ts`. Build ❌.

---

## 5 · Lo que falta

### Primero, y bloquea todo lo demás

**La reconciliación de las dos líneas.** Cada hora de trabajo nuevo sobre cualquiera de las dos
agranda el conflicto. El criterio propuesto:

- Donde **solo un lado** tiene la pieza, entra esa (cliente de terminología de un lado; registro
  dual, selector de organización, verificación de correo, panel, umbrales de coverage, breakpoints y
  `autocomplete` del otro).
- Donde **hay dos**, elegir **una** por pieza y portarle lo que la otra tenga de más. Nadie debería
  resolver esos conflictos sin mirar los dos lados: ambos funcionan y tienen pruebas.

### Se puede hacer ya, nada lo bloquea

- **Alta de organización** — formulario condicional por tipo de tenant (PAYER/BROKER/PROVIDER). El
  backend está completo y el cliente de terminología ya existe.
- **Fase 7 de la auditoría** — `CLAUDE.md` con las reglas de clasificación.
- Enviar `PARA-EL-DISENADOR.md` (tarjeta 14), escrito y pendiente de envío.

### Bloqueado por decisión, no por código

- **Verificación de identidad (t22) y altas administrativas (t23):** la aplicación **no tiene
  interior** — sin navegación ni área de administración, cada pantalla nueva es una ruta suelta.
  Inventar el armazón sin diseño es trabajo que probablemente se tire. *Es lo próximo natural: el
  403 «puerta» ya ofrece «Verificar mi identidad» y ese enlace apunta a una ruta que no existe.*
- **MFA:** el campo queda siempre visible como opcional porque el backend no señala cuándo hace
  falta. Cuando lo declare, se oculta hasta que lo pida.
- **`localStorage` para el refresh token:** superficie de XSS conocida. La alternativa (cookie
  `httpOnly`) exige cambio del backend. **Decisión de seguridad previa a producción.**

### Deuda anotada, ninguna urgente

- 20 consultas de medios escritas `max-width` (escritorio-primero) contra la regla mobile-first.
- `core/` en ~82 % de cobertura, dos puntos sobre el umbral: el próximo agregado sin pruebas lo hace
  fallar.
- **47 archivos con diferencias de Prettier, todas preexistentes.** No se reformatearon a propósito:
  mezclaría ruido con la refactorización. Merece un commit propio y aislado.
- Sin pruebas e2e ni de accesibilidad automatizadas (axe).
- `classList()` y `warnIfNoAccessibleName()` quedaron sin extraer: repeticiones de 10–12 líneas con
  variantes reales entre sí; el beneficio no está claro.
- El panel «Avisos (dev)» asoma en toda pantalla en desarrollo (en producción no se descarga).

---

## 6 · Decisiones que siguen esperando al equipo

1. **`@angular/forms` o el contrato propio por signals.** Hoy el proyecto **no usa `@angular/forms`**:
   tiene un contrato propio por DI. Condiciona toda la capa de formularios y validación.
2. **`shared/` vs `common/`.** Se recomendó `shared/` (convención de Angular); hoy revertirlo cuesta
   una línea de `tsconfig.json`.
3. **El contrato del sistema de avisos** es una **derivación** de las plantillas, no una
   especificación confirmada. Si quien escribió el commit tenía otra API en mente, hay que ajustarla.
4. **Modo de instalación de Yarn.** El repo no fija `.yarnrc.yml`, así que Yarn 4 instala en **modo
   PnP**. El repo de la API sí lo fija, con `nodeLinker: node-modules`: hoy los dos repositorios
   instalan distinto. Conviene que sea una decisión y no un accidente.
5. **Las fuentes normativas de diseño citadas en el código no están en el repositorio**
   (`ALOVIDA_Sistema_de_Diseno.html`, `identidad-visual.md`). Son la fuente de los valores de color,
   las variantes y las excepciones WCAG E1–E4. Sin ellas no se altera ningún token.
6. **El registro no inicia sesión solo** (lleva al login) y **los avisos de error quedan fijos** hasta
   cerrarse: ambas documentadas, ambas a validar con el diseñador.

---

## 7 · Cómo levantar todo

### Con Docker (recomendado, aislado del host)

```bash
docker compose up -d          # frontend en :4200
docker compose logs -f        # ver el build en vivo
docker compose down
```

El contenedor trae su propia instalación de Yarn para Linux y no depende del estado del host.
`proxy.conf.docker.json` redirige el proxy a `host.docker.internal:3000`, porque dentro del
contenedor `localhost` es el contenedor.

### En el host

```bash
# Almacenes. Nunca el servicio `api` del compose: arranca con DDL propio.
cd ../mantra-core-health-redesa-api
docker compose up -d postgres postgres-init mongodb mongo-init redis opensearch opensearch-init minio
corepack yarn build && corepack yarn start:prod    # API en :3000

cd ../mantra-core-health
corepack yarn start                                 # frontend en :4200
```

**`ng` no está en el PATH y no puede estarlo de forma útil:** con Yarn PnP no hay `node_modules`, así
que un `ng` global no resuelve las dependencias del proyecto. Usar siempre **`yarn start`** o
**`corepack yarn <script>`**.

### Cuenta de demostración

```
admin@redesa.test / S3cret-passw0rd
```

Se siembra sola al arrancar la API con `BOOTSTRAP_ADMIN_EMAIL` y `BOOTSTRAP_ADMIN_PASSWORD`.
Devuelve roles `SECURITY_ADMIN` y `SUPERADMIN` y un tenant.

---

## 8 · Dos decisiones de arquitectura previas a tocar rutas

**Lo que tiene sesión no se puede prerenderizar.** La sesión vive en el navegador y el servidor no la
ve: la API entrega el refresh token en el cuerpo del login, no como cookie. Prerenderizar una
pantalla con sesión produce HTML de «no autenticado» que al hidratar se reemplaza — un parpadeo en el
mejor caso, un `<main>` vacío servido como contenido en el peor. Por eso el área con sesión va en
`RenderMode.Client` y solo el login y la vitrina se prerenderizan.

**Ninguna pantalla se importa directamente.** Todas van diferidas. La vitrina sola pesa unos 900 kB
porque instancia el sistema de diseño entero, y nunca se descarga si nadie la abre.

---

## 9 · Riesgos abiertos

| Riesgo | Por qué importa |
|---|---|
| **El merge en curso toca 309 archivos** | Es el riesgo dominante hoy. Reconcilia una reestructuración con 24 commits de producto construidos sobre la estructura vieja |
| **Dos implementaciones de auth, ambas probadas** | Elegir por pieza, no por rama. Resolver los conflictos «a ojo» pierde trabajo verificado |
| **`localStorage` para el refresh token** | Superficie de XSS aceptada temporalmente; decisión pendiente antes de producción |
| **Trabajo en paralelo sin protocolo firme** | `COORDINACION-AGENTES.md` existe para esto; el tenedor actual ocurrió igual |
| **La app no tiene navegación interior** | Cada pantalla nueva es una ruta suelta hasta que haya diseño del armazón |

---

*Consolidado a partir de `ESTADO-FRONTEND.md`, `AVANCE-FRONTEND-2026-08-01.md`,
`PENDIENTES-BACKEND.md`, `COORDINACION-AGENTES.md`, `docs/auditoria/01-diagnostico.md` y
`docs/auditoria/02-fases-ejecutadas.md`, más inspección directa del repositorio.*
