# Informe de preparación para producción

- **Fecha:** 2026-08-01 (tercera revisión, tras las pruebas contra el artefacto)
- **Alcance:** frontend `mantra-core-health`
- **Veredicto:** **APTO A NIVEL DE CÓDIGO** · pendiente de **configuración y
  credenciales**

---

## Declaración

> ## ✅ APTO PARA PRODUCCIÓN A NIVEL DE CÓDIGO
>
> No queda ningún cambio de código pendiente para desplegar.
> **Lo que falta es configuración y credenciales**, y está enumerado abajo.

La revisión anterior declaraba **NO APTO** por dos bloqueantes y dos críticos.
Los cuatro se cerraron a nivel de código:

| # | Antes | Ahora |
|---|---|---|
| **B-01** | No existe despliegue de producción | ✅ `Dockerfile` multietapa, usuario sin privilegios, `HEALTHCHECK` |
| **B-02** | Sin decidir el dominio de la API | ✅ **Decidido: mismo dominio.** `PUBLIC_API_BASE_URL` vacía, proxy en `deploy/nginx.conf` |
| **C-01** | Sin captura de errores; pantalla en blanco invisible | ✅ `ErrorHandler` propio, `ErrorReporter` con código de soporte, pantalla de recuperación, manejo de chunk fallido |
| **C-02** | Sin CSP ni cabeceras | ✅ Seis cabeceras, CSP con hashes, **verificada contra el artefacto real** |

## Lo que encontró probar de verdad

Esta revisión añadió tres capas de verificación —Playwright contra el artefacto
construido, `axe-core` sobre el sistema de diseño, y un verificador de tokens— y
**las tres encontraron defectos que ninguna lectura del código había visto**.

Dos de ellos bloqueaban producción.

### 1 · `security.allowedHosts` rechazaba todo dominio real · era `BLOCKER`

`angular.json` traía `build.options.security.allowedHosts: ["localhost"]`. Esa
opción **se hornea en el artefacto**: el servidor de producción respondía **400 a
cualquier petición cuyo `Host` no fuera `localhost`**.

```text
Host: localhost           → 200
Host: mantra.example.com  → 400
```

Es decir: la aplicación **no habría respondido en producción**, y el síntoma
—400 en todo— no apunta a Angular por ningún lado. Sin una prueba que sirviera el
artefacto y le pidiera con otro `Host`, se descubría desplegando.

Corregido quitando la opción del build y moviendo la validación del `Host` a
`deploy/nginx.conf`, donde es configuración en caliente y no una imagen por
dominio.

### 2 · Cerrar sesión no borraba el refresh token · era `CRITICAL`

`AuthService.logout()` limpiaba el almacenamiento **dentro del callback de la
respuesta** de la API. La navegación al login es local e instantánea; la
respuesta viaja por la red. La navegación ganaba siempre.

**Resultado: la siguiente recarga restauraba la sesión que se acababa de
cerrar.** En un dispositivo compartido —un consultorio, una recepción— eso es una
sesión abierta que alguien creyó haber cerrado.

Ninguna prueba unitaria podía verlo: todas hacían `flush()` de la respuesta, que
es justo el caso en el que sí funcionaba. Lo encontró la prueba E2E que vuelve a
entrar a `/panel` después de salir.

### 3 · Tres `<select>` sin nombre accesible · era `A11Y-12`

`axe-core` lo marcó como **crítico** el primer día: el desplegable de resultados
por página y los dos filtros de `app-filter-bar` se anunciaban como «cuadro
combinado» y nada más. Los tres pasaban un `placeholder`, que **no nombra al
control**: se renderiza como `<option hidden>`.

Corregido con un `ariaLabel` en `app-select`, la misma vía que `app-search-field`
ya usaba.

> **Lo que estos tres tienen en común:** ninguno se ve leyendo el código, y los
> tres se ven a la primera corrida de la herramienta correcta. Es el argumento
> completo a favor de estas tres capas.

## Lo que queda, y es todo configuración

> ## ✅ La decisión de arquitectura está tomada
>
> **La API va detrás del mismo dominio.** `PUBLIC_API_BASE_URL` queda vacía en
> todos los entornos, el reverse proxy enruta los seis prefijos, y con eso
> desaparecen tres cosas: el CORS, la variable por entorno y la imagen por
> entorno.

| # | Qué | Tipo | Quién |
|---|---|---|---|
| 1 | Host, orquestador o PaaS de destino | Infraestructura | Operaciones |
| 2 | Dominio y certificado TLS | Infraestructura | Operaciones |
| 3 | Que la API sea alcanzable como `api:3000` en la red del proxy | Configuración | Operaciones + API |
| 4 | Que el dominio de los enlaces del correo coincida con el del frontend | Configuración | Equipo de la API |
| 5 | Credenciales del primer administrador | Credenciales | Equipo de la API |
| 6 | Destino remoto para la telemetría de errores | Decisión | Producto + Seguridad |

**Ninguno es código.**

> **El 4 se pasa por alto y rompe dos journeys completos.** La API arma los
> enlaces de verificación de correo y de recuperación de contraseña; si su
> dominio no es el del frontend, esas dos landings no se alcanzan.

## Lo que se cerró en esta revisión

### Seguridad

| Qué | Dónde |
|---|---|
| Seis cabeceras de seguridad en todas las respuestas | `src/server/security-headers.ts` |
| CSP con hashes de los scripts en línea, recolectados del artefacto | Ídem |
| `frame-ancestors 'none'` + `X-Frame-Options: DENY` | Cierra el clickjacking |
| `connect-src` derivado de `PUBLIC_API_BASE_URL` | Las dos mitades no se pueden separar |
| 14 pruebas sobre la política | `security-headers.spec.ts` |

### Errores

| Qué | Dónde |
|---|---|
| `ErrorHandler` propio con contexto (versión, commit, ruta) | `core/errors/app-error-handler.ts` |
| `ErrorReporter` con código de soporte dictable | `core/errors/error-reporter.ts` |
| **Sin traza ni datos personales en el registro**, con prueba | Ídem |
| Pantalla de recuperación con código y versión | `features/error-recovery/` |
| Manejo del fragmento diferido fallido | `app.routes.ts` |
| Página 404 que no filtra existencia | `features/not-found/` |

### Accesibilidad

| Qué | Cierra |
|---|---|
| Directiva `appAnuncio`: región viva + foco | **A11Y-01, A11Y-03, A11Y-04** |
| Aplicada a las 6 pantallas de `auth/` | El acuse de recuperación ya se anuncia |
| Estado vacío en `/auth/organizacion` | **A11Y-10** |
| **Verificador de contrastes** sin dependencias | **A11Y-06** |
| Pantalla de verificación de identidad | **A11Y-02** — la puerta ya lleva a algún lado |

> **El verificador encontró un defecto real que nadie había visto:**
> `--st-warning-fg` (ámbar 700) sobre `--st-warning-bg` daba **4,46:1**, a 0,04
> de AA. Corregido a ámbar 800 → **7,49:1**, con el mismo criterio que el
> sistema ya había aplicado a `secondary`.

### Sesión

| Qué | Cierra |
|---|---|
| Cerrar sesión en una pestaña cierra las demás | M-10 |
| Refresco **proactivo** con `isAccessTokenExpired` | M-11 — la función existía sin consumidor |
| Organización elegida persistida, y borrada al cerrar sesión | M-13 |

### Operación

| Qué | Cierra |
|---|---|
| `Dockerfile` de producción multietapa | B-01 |
| Versión y commit estampados en el paquete | **H-01** — sin esto no hay reversión posible |
| Workflow de CI con la batería completa | H-10 |
| Presupuesto de bundle **decidido** (560 kB), sin avisos | M-19 |

### Pruebas

| Qué | Cierra |
|---|---|
| `Dashboard` — las dos reglas de `toState` | **H-04** |
| `ShellLayout` — usuario, organizaciones, menú, navegación | H-04 |
| `TokenRefreshService` — la garantía de una sola petición en vuelo | Brecha declarada |
| `ErrorReporter`, `AnnounceOnAppear`, `security-headers` | Código nuevo |

### Pruebas añadidas en esta revisión

| Qué | Cierra |
|---|---|
| **Playwright**: 7 journeys de sesión contra el artefacto construido | **H-02** |
| **`axe-core`**: 13 componentes, ~90 reglas WCAG A/AA | **M-21** |
| `IdentityVerification` y `ErrorRecovery` | Código nuevo sin cubrir |
| `timeoutInterceptor` e `IdleLogoutService` | **M-15**, **M-09** |
| Nombre accesible de `Select`, dentro y fuera de un campo | El defecto que encontró axe |

**903 pruebas, 0 fallos.**

## Estado de la batería

```text
yarn lint                       limpio
yarn tsc --noEmit               limpio
yarn build                      OK · 4 rutas prerenderizadas · 547,21 kB
                                     SIN avisos de presupuesto
yarn test:coverage              82 archivos · 903 pruebas · 0 fallos
yarn e2e                        7 journeys · 0 fallos · contra el artefacto
node scripts/generate-doc-report.mjs
  ✓ las 9 verificaciones pasan
```

## Lo que sigue faltando, y no bloquea

| # | Qué | Severidad |
|---|---|---|
| 1 | **Destino remoto de errores** | El `ErrorHandler` es el punto único donde enchufarlo |
| 2 | **Pruebas de contrato** | HIGH — el OpenAPI del backend no es alcanzable |
| 3 | Capturas de regresión visual | MEDIUM — la configuración está; hay que generarlas **en el contenedor** |
| 4 | Core Web Vitals medidos | MEDIUM — `npx lighthouse`, sin instalar nada |
| 5 | Reflow, zoom y objetivos táctiles | MEDIUM — piden un navegador y una persona midiendo |
| 6 | Prueba con lector de pantalla | La que más información aporta, y la única insustituible |
| 7 | Marco normativo de privacidad declarado | MEDIUM — decisión legal, no código |

**Ninguno impide desplegar.** El 1 y el 2 mejoran lo que el equipo sabe, no lo
que la aplicación hace; el 3 al 6 requieren un entorno o una persona que este
repositorio no puede proveer; el 7 es una decisión.

## Riesgos residuales tras el despliegue

| Riesgo | Antes | Ahora |
|---|---|---|
| Fallo de render invisible | **Alto** | Bajo — hay código de soporte y pantalla de recuperación. **Falta el envío remoto** |
| XSS lee el refresh token | Medio | **Bajo** — CSP sin `unsafe-inline` en `script-src` |
| Clickjacking | Medio | **Cerrado** |
| No se puede revertir | Alto | **Cerrado** — el artefacto lleva versión y commit |
| Chunk viejo tras un despliegue | Alto | Bajo — se detecta y se ofrece recargar |
| API caída sin detección | **Alto** | **Alto** — sigue faltando telemetría |
| Regresión de contraste | Medio | **Cerrado** — se mide en cada CI |
| Regresión de accesibilidad estructural | Medio | **Cerrado** — `axe-core` en cada CI |
| El artefacto no responde en el dominio real | **Alto** | **Cerrado** — era real, y lo destapó el E2E |
| Sesión que sobrevive a cerrar sesión | **Alto** | **Cerrado** — ídem |

**El único riesgo que no bajó es la detección de una API caída**, y depende de
la decisión 6 (destino de telemetría).

Los dos últimos de la tabla no estaban en la revisión anterior porque **nadie
sabía que existían**. Los dos eran reales, los dos bloqueaban producción, y los
dos los encontró probar contra el artefacto construido en vez de contra jsdom.

## Conclusión

> ## ✅ APTO PARA PRODUCCIÓN A NIVEL DE CÓDIGO
>
> **No queda ningún cambio de código pendiente.** Lo que falta —el destino, el
> dominio, el certificado y las credenciales— es configuración y decisiones de
> infraestructura.
>
> La decisión de arquitectura ya está tomada —**la API va detrás del mismo
> dominio**— y el código la refleja entero: imagen, proxy, CSP y variables.
>
> El veredicto se apoya en algo que las dos revisiones anteriores no tenían:
> **la aplicación se probó construida, servida y pedida por un navegador real.**
> Esa prueba encontró dos defectos que bloqueaban producción. Los dos están
> corregidos y los dos tienen ahora una prueba que impide que vuelvan.

Detalle de lo que sigue abierto en
[el análisis de brechas](documentation-gap-analysis.md).
