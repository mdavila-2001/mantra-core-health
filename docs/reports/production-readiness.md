# Informe de preparación para producción

- **Fecha:** 2026-08-01 (segunda revisión, tras el endurecimiento de código)
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
| **B-02** | Sin decidir el dominio de la API | ✅ **Los dos caminos funcionan sin tocar código.** Queda elegir uno |
| **C-01** | Sin captura de errores; pantalla en blanco invisible | ✅ `ErrorHandler` propio, `ErrorReporter` con código de soporte, pantalla de recuperación, manejo de chunk fallido |
| **C-02** | Sin CSP ni cabeceras | ✅ Seis cabeceras, CSP con hashes, **verificada contra el artefacto real** |

## Lo que queda, y es todo configuración

| # | Qué | Tipo | Quién |
|---|---|---|---|
| 1 | **Elegir si la API va detrás del mismo dominio** | Decisión | Arquitectura |
| 2 | Destino del despliegue (host, orquestador, dominio) | Infraestructura | Operaciones |
| 3 | Certificado TLS | Infraestructura | Operaciones |
| 4 | Valor de `PUBLIC_API_BASE_URL` para cada entorno | Configuración | Operaciones |
| 5 | CORS en la API, **solo si se elige la opción 2 del punto 1** | Configuración | Equipo de la API |
| 6 | Que el dominio de los enlaces del correo coincida con el del frontend | Configuración | Equipo de la API |
| 7 | Credenciales del primer administrador | Credenciales | Equipo de la API |
| 8 | Destino remoto para la telemetría de errores | Decisión | Producto + Seguridad |

**Ninguno es código.** El 1 es el primero de la cadena: con «mismo dominio» —lo
recomendado— el 4 queda vacío y el 5 desaparece.

> **El 6 se pasa por alto y rompe dos journeys completos.** La API arma los
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

**860 pruebas, 0 fallos.**

## Estado de la batería

```text
yarn lint                       limpio
yarn tsc --noEmit               limpio
yarn build                      OK · 4 rutas prerenderizadas · 542,07 kB
                                     SIN avisos de presupuesto
yarn test:coverage              77 archivos · 860 pruebas · 0 fallos
node scripts/generate-doc-report.mjs
  ✓ inventarios · arquitectura · enlaces · cobertura
  ✓ deriva de contrato · contrastes · presupuesto
```

## Lo que sigue faltando, y no bloquea

| # | Qué | Severidad |
|---|---|---|
| 1 | **Pruebas E2E** | HIGH — excepción formal declarada |
| 2 | **Pruebas de contrato** | HIGH — el OpenAPI del backend no es alcanzable |
| 3 | **Destino remoto de errores** | El `ErrorHandler` es el punto único donde enchufarlo |
| 4 | Regresión visual | MEDIUM |
| 5 | Core Web Vitals medidos | MEDIUM — `npx lighthouse`, sin instalar nada |
| 6 | Prueba de `IdentityVerification` | MEDIUM |
| 7 | Marco normativo de privacidad declarado | MEDIUM — decisión, no código |

Los tres primeros son los mismos de la revisión anterior. **Ninguno impide
desplegar**; los tres mejoran lo que el equipo sabe, no lo que la aplicación
hace.

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

**El único riesgo que no bajó es la detección de una API caída**, y depende de
la decisión 8 (destino de telemetría).

## Conclusión

> ## ✅ APTO PARA PRODUCCIÓN A NIVEL DE CÓDIGO
>
> **No queda ningún cambio de código pendiente.** Lo que falta —el destino, el
> dominio, el certificado y las credenciales— es configuración y decisiones de
> infraestructura.
>
> La primera es gratis y desbloquea el resto: **decidir si la API va detrás del
> mismo dominio que el frontend.**

Detalle de lo que sigue abierto en
[el análisis de brechas](documentation-gap-analysis.md).
