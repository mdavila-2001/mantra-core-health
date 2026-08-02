# Convenciones de nombres y atributos

Un nombre de span es una **clase de operación**, no una operación concreta.
Jaeger agrupa, ordena y compara por ese nombre: si lleva un identificador
adentro, cada ejecución es una clase distinta, la lista de operaciones crece sin
límite y ninguna estadística sirve.

La regla se aplica en el código, no en la revisión: la ruta pasa por
`routeTemplate()` y la URL por `sanitizeUrl()` antes de tocar un span.

---

## 1 · Servicios

Tres identidades distintas, porque son tres procesos distintos:

| `service.name` | Quién lo emite | Cuándo |
|---|---|---|
| `mantra-angular-web` | El navegador | Siempre que hay una pestaña abierta |
| `mantra-angular-ssr` | `src/server.ts` | Cada petición que renderiza el motor de Angular |
| `mantra-core-health-api` | La API | Fuera de este repositorio |

`service.namespace` vale `mantra` en los tres.

**Nunca el mismo nombre para navegador y servidor.** Con uno solo, Jaeger
mostraría un único servicio cuyas latencias mezclan un render de 30 ms con una
sesión de navegador de veinte minutos, y la mitad de las preguntas de la fase 1
dejan de tener respuesta.

---

## 2 · Spans técnicos

Los emite la infraestructura de observabilidad. Nombre fijo, sin excepciones.

| Nombre | Qué mide | Dónde se crea |
|---|---|---|
| `angular.bootstrap` | Del primer byte de `main.ts` a la aplicación estable | `core/observability/browser/` |
| `angular.document.load` | La carga del documento, de *Navigation Timing* | ídem |
| `angular.navigation` | El ciclo completo de una navegación del Router | `core/observability/routing/` |
| `angular.lazy-route.load` | La descarga y evaluación de un fragmento de ruta | ídem |
| `angular.guard.evaluate` | La evaluación de un guard | ídem |
| `angular.http.request` | Una petición lógica de `HttpClient` | `core/observability/http/` |
| `angular.form.submit` | Del envío de un formulario a su resultado | Pantalla, vía `TracingService` |
| `angular.hydration` | De la hidratación al primer estado estable | `core/observability/browser/` |
| `ssr.render` | El render de una ruta en el servidor | `src/server/telemetry/` |

Reservados, sin uso hoy porque el proyecto no tiene el elemento correspondiente:
`angular.resolver.execute` (no hay resolvers), `angular.defer.load` (no hay
bloques `@defer`).

---

## 3 · Spans de negocio

Los emite una pantalla o un servicio de aplicación. Describen **lo que la
persona estaba intentando hacer**, no cómo está implementado.

| Nombre | Flujo |
|---|---|
| `auth.login` | Inicio de sesión |
| `auth.logout` | Cierre de sesión |
| `auth.session.restore` | Restauración al arrancar |
| `auth.session.refresh` | Canje del refresh token |
| `auth.tenant.select` | Elección de organización |
| `auth.password.recovery.request` | Solicitud de recuperación |
| `auth.password.reset` | Fijado de la contraseña nueva |
| `auth.email.verify` | Verificación del correo |
| `patient.register` | Alta de paciente |
| `document.upload` | Subida de archivo |

Un nombre de negocio sobrevive a un cambio de implementación. `auth.login` sigue
llamándose igual si mañana el login pasa de una petición a dos.

---

## 4 · Atributos

### Del recurso — describen el proceso, no la operación

```
service.name                    mantra-angular-web | mantra-angular-ssr
service.namespace               mantra
service.version                 la de package.json
deployment.environment.name     development | staging | production
app.build.id                    el commit corto de BUILD_INFO
app.framework                   angular
angular.version                 21
angular.rendering.mode          csr | ssr | prerender
angular.change_detection.mode   zoneless
```

`angular.change_detection.mode` es `zoneless` porque el proyecto lo es. Está
para que el día que alguien reintroduzca Zone.js, las trazas anteriores y las
posteriores se puedan separar sin adivinar.

### Propios de la aplicación

```
app.feature                     auth | panel | design-system
app.operation                   el nombre de negocio, sin el prefijo
app.route.template              /auth/verificar   (nunca con query)
app.route.from                  plantilla de origen
app.route.to                    plantilla de destino
app.api.route.template          /iam/auth/login
```

### De Angular

```
angular.navigation.id           el id del Router
angular.navigation.trigger      imperative | popstate | hashchange
angular.navigation.result       completed | cancelled | failed | skipped
angular.navigation.redirected   true | false
angular.lazy.type               route | component
angular.lazy.result             loaded | failed
angular.guard.name              authGuard
angular.guard.result            allowed | denied | redirected | error
angular.component               el selector, nunca sus entradas
```

### De interfaz

```
ui.form.name                    login | register-patient | reset-password
ui.action                       submit | confirm | upload | download
ui.result                       success | validation_error | error | cancelled
validation.error.count          un número
```

### De HTTP — de las convenciones semánticas, no inventados

```
http.request.method             GET | POST | …
http.response.status_code       200 | 401 | …
url.scheme                      https
url.path                        la ruta, ya normalizada
server.address                  el host de la API
error.type                      la clase del error, no su mensaje
```

### De archivos

```
file.extension                  pdf
file.mime.type                  application/pdf
file.size.bucket                0-1MB | 1-5MB | 5-20MB | 20-100MB | 100MB+
```

### De autenticación

```
auth.method                     email | national_id
auth.result                     success | failure
auth.failure.category           invalid_credentials | expired_session |
                                network_error | server_error |
                                validation_error | rate_limited | unknown
```

`auth.failure.category` es una lista cerrada a propósito. El mensaje que
devuelve la API puede cambiar de redacción, puede venir traducido y puede
describir algo interno del servidor; una categoría no.

---

## 5 · Prohibido

**En el nombre del span:**

```
customer.load.72839              → customer.load
route./auth/verificar?token=abc  → angular.navigation
document.upload.receta-ana.pdf   → document.upload
GET /profiles/8437               → angular.http.request
```

**En cualquier atributo:**

Contraseñas, códigos MFA, tokens de cualquier tipo, cookies, cabeceras
`Authorization` o `X-Tenant-Id`, claims del JWT, correos, teléfonos, documentos
de identidad, nombres de persona, direcciones, diagnósticos, montos, nombres de
archivo, cuerpos de petición o respuesta, HTML, valores de formulario, valores
de signals, trazas de pila, query strings sin sanitizar y URLs firmadas.

La lista larga con su justificación está en
[06-data-privacy-policy.md](06-data-privacy-policy.md).

---

## 6 · Cómo se convierte una URL en plantilla

El caso real de este repositorio:

```
URL visitada     /auth/verificar?token=eyJhbGciOi…
app.route.template   /auth/verificar
nombre del span      angular.navigation
```

El token del correo va en el query string. Si la URL entrara entera a un
atributo, **la credencial de verificación de esa persona quedaría guardada en
Jaeger**, legible por quien tenga acceso al panel, durante todo el tiempo de
retención.

La plantilla sale de la configuración del Router, no de un recorte del texto: se
recorre el árbol de rutas y se comparan los segmentos, de modo que un segmento
declarado como `:id` sale como `:id` aunque el valor sea un UUID que no lo
parezca.

Hoy `app.routes.ts` no declara ningún parámetro de ruta. La conversión existe
igual, porque el día que se agregue `/pacientes/:pacienteId` nadie va a
acordarse de volver acá.

---

## 7 · Eventos dentro de un span

Cuando algo es un instante y no un intervalo, es un evento, no un span hijo:

```
config.loaded            otel.initialized
bootstrap.started        bootstrap.completed
application.stable       hydration.started
hydration.completed      hydration.failed
http.retry               auth.refresh.started
navigation.redirected    chunk.load.failed
```

Un span por cada uno de estos multiplicaría el volumen sin agregar duración
medible.

Siguiente: [03-async-context-strategy.md](03-async-context-strategy.md).
