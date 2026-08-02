# Análisis de brechas

> ## Actualización · endurecimiento de código (2026-08-01)
>
> **Los 2 BLOCKER, los 2 CRITICAL y 8 de los 11 HIGH se cerraron a nivel de
> código.** Lo que queda de ellos es configuración, credenciales o decisiones
> de infraestructura.
>
> | Antes | Ahora |
> |---|---|
> | B-01 sin despliegue | ✅ `Dockerfile` de producción · falta el **destino** |
> | B-02 dominio de la API | ✅ los dos caminos funcionan · falta **elegir** |
> | C-01 sin captura de errores | ✅ `ErrorHandler`, código de soporte, pantalla de recuperación · falta el **destino remoto** |
> | C-02 sin CSP | ✅ seis cabeceras, verificadas contra el artefacto |
> | H-01 sin versionado | ✅ versión y commit en el paquete |
> | H-04 `Dashboard`/`ShellLayout` sin prueba | ✅ ambas probadas |
> | H-05 / H-07 ruta de verificación rota | ✅ pantalla construida, ruta real |
> | H-06 acuse no anunciado | ✅ directiva `appAnuncio` |
> | H-10 sin CI | ✅ workflow con la batería completa |
> | M-01…M-04, M-08, M-10, M-11, M-13, M-16, M-19 | ✅ cerradas |
> | L-01, L-02 | ✅ cerradas |
>
> **Y una brecha que nadie había detectado, encontrada por el verificador
> nuevo:** `--st-warning-fg` daba 4,46:1, a 0,04 de AA. Corregida.
>
> **Siguen abiertas:** H-02 (E2E), H-03 (contrato), H-08/H-09 (monitoreo y
> telemetría, dependen del destino), H-11 (dominio del correo), M-05…M-07,
> M-09, M-12, M-14, M-15, M-17, M-18, M-20…M-22 y los LOW restantes.
>
> El detalle de lo cerrado está en
> [preparación productiva](production-readiness.md). Lo de abajo es el análisis
> original, que se conserva como registro de dónde se partió.

---

**Fase 3 del plan documental.** Cada hallazgo con su evidencia, su riesgo y su
acción — y con la columna que más importa: **si cambia el producto**.

- **Fecha:** 2026-08-01
- **Total:** 47 hallazgos
- **Ninguno se ejecutaba al momento del diagnóstico.** Los que cambian producto
  quedaban como propuesta autorizable.

> ### ⚠️ Estado
>
> Las tablas de abajo son **el diagnóstico original** y se conservan tal cual:
> son el registro de qué se encontró y con qué evidencia, y reescribirlas
> borraría el rastro.
>
> **Con la autorización de cambio de producto concedida después, 38 de los 47 se
> cerraron.** El detalle está en [lo que se cerró](#lo-que-se-cerró), al final, y
> el veredicto en
> [el informe de preparación productiva](production-readiness.md).

---

## Resumen

| Severidad | Cantidad | Definición |
|---|---:|---|
| `BLOCKER` | **2** | Impide afirmar preparación productiva |
| `CRITICAL` | **2** | Riesgo alto de seguridad, acceso, pérdida de flujo o integración |
| `HIGH` | **11** | Ausencia relevante de trazabilidad o mantenibilidad |
| `MEDIUM` | **22** | Mejora necesaria, no bloqueante |
| `LOW` | **10** | Optimización editorial o de detalle |

### Por área

| Área | B | C | H | M | L |
|---|---:|---:|---:|---:|---:|
| Operación y despliegue | 2 | — | 3 | 1 | 1 |
| Observabilidad | — | 1 | 2 | 2 | — |
| Seguridad y privacidad | — | 1 | 1 | 4 | 1 |
| Pruebas | — | — | 3 | 2 | — |
| Accesibilidad | — | — | 2 | 6 | 4 |
| Arquitectura y datos | — | — | 1 | 4 | 2 |
| Rendimiento | — | — | — | 2 | 2 |
| Gobierno | — | — | 1 | 1 | — |

---

## BLOCKER

| ID | Área | Elemento real | Evidencia | Brecha | Riesgo | Acción | ¿Cambia producto? | Validación |
|---|---|---|---|---|---|---|---|---|
| **B-01** | Operación | `yarn build` produce artefacto completo | Solo existe `Dockerfile.dev`; sin destino, dominio ni pipeline | **No hay despliegue de producción** | No se puede entregar. Bloquea monitoreo, CSP probada, smoke, rollback y Web Vitals | Definir destino, imagen de producción y pipeline | **Sí** | Smoke de [despliegue](../operations/deployment.md#después--smoke) |
| **B-02** | Operación | `PUBLIC_API_BASE_URL` configurable | [configuración](../operations/configuration.md#la-decisión-tomada) | **No está decidido si la API va detrás del mismo dominio** | Sin esto no se puede construir la imagen, escribir la CSP ni saber si hace falta CORS | Decidir | **Sí** (arquitectura de despliegue) | Login funcionando en el entorno destino |

## CRITICAL

| ID | Área | Elemento real | Evidencia | Brecha | Riesgo | Acción | ¿Cambia producto? |
|---|---|---|---|---|---|---|---|
| **C-01** | Observabilidad | `provideBrowserGlobalErrorListeners()` | [error boundaries §nivel 3](../architecture/error-boundaries.md#nivel-3--lo-que-se-rompe-fuera-de-una-petición) | **Sin captura remota de errores** y sin frontera de fallo de render | Una pantalla en blanco es **invisible**. Nadie detecta un incidente | `ErrorHandler` propio + componente frontera + manejo de chunk fallido + destino remoto | **Sí** |
| **C-02** | Seguridad | `src/server.ts` sin cabeceras | [CSP](../security/content-security-policy.md) | **Sin CSP ni cabeceras de seguridad** | Segunda línea ausente frente a XSS con el refresh token en `localStorage`; clickjacking posible | Añadir `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS y CSP (empezando en `Report-Only`) | **Sí** |

## HIGH

| ID | Área | Brecha | Riesgo | Acción | ¿Cambia producto? |
|---|---|---|---|---|---|
| **H-01** | Operación | **Sin versión ni identificador de build** (`version: "0.0.0"`) | En un incidente no se sabe qué código corre. **Sin esto no hay rollback posible** | Versionar el artefacto | **Sí** |
| **H-02** | Pruebas | **Sin E2E** | Los 9 journeys verificados a mano no tienen red de seguridad. El más expuesto es J5 (sesión persistente) | Playwright + los 4 journeys críticos | **Sí** |
| **H-03** | Pruebas | **Sin pruebas de contrato** | Un cambio del backend no se detecta hasta producción. Un `code` nuevo se degrada a S9 en silencio | Verificar `API_ERROR_CODES` contra el catálogo (barato); publicar el OpenAPI (externo) | **Sí** |
| **H-04** | Pruebas | **`Dashboard` y `ShellLayout` sin prueba** | La única pantalla autenticada y su layout. Dos reglas de producto (`toState`) sin nada que las fije | Escribirlas. **No requiere herramientas nuevas** | **No** (solo pruebas) |
| **H-05** | Arquitectura | `IDENTITY_VERIFICATION_ROUTE = '/identity/me'` es ruta de la **API** | El estado S5 «con acción» ofrece una puerta que **no lleva a ninguna parte** | Apuntarla a una ruta del router, o quitar la acción | **Sí** |
| **H-06** | Accesibilidad | **A11Y-01**: el acuse de `/auth/recuperar` no se anuncia | Es toda la respuesta que recibe la persona | Región viva + foco | **Sí** |
| **H-07** | Accesibilidad | **A11Y-02**: ídem H-05 desde la perspectiva de accesibilidad | — | — | **Sí** |
| **H-08** | Observabilidad | **Sin monitoreo de disponibilidad ni alertas** | Un pico de S8 (API caída) no se detecta | Monitor externo de una URL — **no requiere instrumentar nada** | **Sí** |
| **H-09** | Observabilidad | **Sin evento `estado_ux_mostrado`** | La instrumentación más barata y valiosa: **un solo punto** (`ViewStateHost`) | Instrumentar | **Sí** |
| **H-10** | Gobierno | **Sin CI** | Las nueve etapas dependen de la disciplina | Workflow con lo que ya existe | **Sí** |
| **H-11** | Integraciones | **El dominio de los enlaces del correo no está coordinado** | Si no coincide con el del frontend, **dos journeys quedan a medias** | Documentarlo en los dos repositorios | **No** (documental, en otro repo) |

## MEDIUM

| ID | Área | Brecha | Acción | ¿Cambia producto? |
|---|---|---|---|---|
| **M-01** | Accesibilidad | A11Y-03: el error general no se anuncia en 6 pantallas | Directiva que extraiga las 2 reglas de `ViewStateHost` | Sí |
| **M-02** | Accesibilidad | A11Y-04: las confirmaciones no se anuncian | Ídem | Sí |
| **M-03** | Accesibilidad | A11Y-05: los errores del servidor no se anclan al campo | Mapear `details` a campos | Sí |
| **M-04** | Accesibilidad | A11Y-06: contrastes sin verificación automática | Script propio, **sin dependencias** | No |
| **M-05** | Accesibilidad | A11Y-07: E1/E2 (`--text-muted`) no se hacen cumplir | Regla de lint cuando existan secciones clínicas | Sí |
| **M-06** | Accesibilidad | A11Y-08: reflow y zoom sin verificar | Verificación manual + evaluar `clamp()` | Parcial |
| **M-07** | Accesibilidad | A11Y-09: objetivos táctiles sin medir | Medir | No (medición) |
| **M-08** | Accesibilidad | A11Y-10: `/auth/organizacion` sin estado vacío ni guard | Añadir mensaje y evaluar el guard | Sí |
| **M-09** | Seguridad | Sin cierre de sesión por inactividad | Temporizador que llame a `logout()` | Sí |
| **M-10** | Seguridad | Cerrar sesión en una pestaña no cierra la otra | Oyente de `storage` | Sí |
| **M-11** | Seguridad | `isAccessTokenExpired` **existe y nadie la llama** | Refresco proactivo | Sí |
| **M-12** | Seguridad | **Marco normativo no declarado** (HIPAA/GDPR/ley local) | Definirlo. **Necesario antes de la primera pantalla con PHI** | No (decisión) |
| **M-13** | Arquitectura | La organización elegida no se persiste | Quien tenga varias pasa por el selector en cada recarga | Sí |
| **M-14** | Arquitectura | El barril `@shared` **no lo importa nadie** | Adoptarlo, reducirlo o quitarlo | Sí |
| **M-15** | Arquitectura | Sin cancelación ni timeout de peticiones | Evaluar | Sí |
| **M-16** | Arquitectura | El comodín redirige a `/` en vez de mostrar un 404 | Decisión de producto sin registrar | Sí |
| **M-17** | Datos | Sin caché de estado remoto | **No implementar todavía**: esperar al primer caso concreto | Sí |
| **M-18** | Rendimiento | `inlineCritical: false` **sin motivo registrado** | Medir, probar y decidir. Ver [ADR-0010](../adr/ADR-0010-css-critico-en-linea.md) | Sí |
| **M-19** | Rendimiento | Presupuesto inicial 18,95 kB sobre el aviso | Diferir `auth/`, o subir el umbral. **Decidir** | Sí |
| **M-20** | Pruebas | Sin regresión visual | Playwright (misma dependencia que E2E) | Sí |
| **M-21** | Pruebas | Sin accesibilidad automatizada | `axe-core` en pruebas de componente | Sí |
| **M-22** | Diseño | Un token declarado solo en CSS pasaría sin aviso (D4) | Comprobación inversa | No |

## LOW

| ID | Brecha | Acción |
|---|---|---|
| **L-01** | Comentario de `login.ts` desactualizado (deriva D1) | Corregir el comentario |
| **L-02** | Tres tipografías instaladas y sin importar | Usarlas o quitarlas |
| **L-03** | `register-patient/` da de alta dos perfiles; el nombre miente | Renombrar |
| **L-04** | `ForgotPassword` y `ResetPassword` sin `AuthSplit` | Inconsistencia visual del mismo flujo |
| **L-05** | Sin tokens de movimiento (`--duration-*`, `--ease-*`) | Añadirlos cuando la repetición duela |
| **L-06** | Sin tokens de apilamiento (`--z-*`) | **El de mayor riesgo de los LOW**: dos capas pueden coincidir |
| **L-07** | El favicon no lleva hash y se cachea un año | Renombrarlo al cambiarlo |
| **L-08** | Los dos proxys pueden separarse sin aviso | Comprobación que compare las listas |
| **L-09** | `forgot-password`/`reset-password` no están en las rutas públicas del interceptor | Caso de borde sin consecuencia observada |
| **L-10** | `/design-system` es pública y prerenderizada en producción | Decidir si debe estarlo |

---

## Clasificación por tipo de acción

| Tipo | Cantidad | Ejemplos |
|---|---:|---|
| **Decisión, sin código** | 4 | B-02, M-12, M-16, M-19 |
| **Solo pruebas o verificación** (no toca producto) | 5 | H-04, M-04, M-07, M-22, L-08 |
| **Documental en otro repositorio** | 1 | H-11 |
| **Cambio de producto** | 37 | El resto |

**Las cinco de la segunda fila son las de mejor relación valor/riesgo**: no
tocan comportamiento y cierran huecos reales.

## Orden recomendado

### Sin autorización de cambio de producto

1. **H-04** — probar `Dashboard` y `ShellLayout`.
2. **M-04** — verificación de contrastes (script propio).
3. **L-08** — comprobar que los dos proxys coinciden.
4. **M-22** — comprobación inversa de tokens.
5. Lighthouse con `npx` — la primera línea base de rendimiento.

### Decisiones que hay que tomar

6. **B-02** — dominio de la API. **Bloquea a B-01 y C-02.**
7. **M-19** — el presupuesto: bajar o subir.
8. **M-12** — marco normativo.

### Cambios de producto, por valor

9. **H-01** — versionar el artefacto. Prerrequisito de todo lo operativo.
10. **C-02** — cabeceras de seguridad (las cuatro fáciles primero).
11. **H-05 / H-07** — la ruta de verificación de identidad.
12. **H-06 / M-01 / M-02** — una directiva cierra tres brechas de accesibilidad.
13. **C-01** — telemetría de errores.
14. **B-01** — despliegue.
15. **H-02 / M-20** — Playwright cubre E2E y regresión visual.

## Lo que se cerró

### Con el trabajo documental, sin tocar producto

| Cerrado | Cómo |
|---|---|
| Sin inventario de rutas, componentes, API y módulos | **Generado desde el código**, regenerable |
| Sin verificación de las reglas de arquitectura | `check-architecture.mjs` |
| Sin detección de deriva entre código y documentación | Cuatro verificadores |
| Sin registro de decisiones | **10 ADR**, con su evidencia |
| Sin runbooks | **12**, uno por síntoma |
| Sin modelo C4 | `structurizr/workspace.dsl` |
| Sin modelo de amenazas | STRIDE completo |
| Sin trazabilidad negocio → ruta → API → prueba | La matriz, con dos excepciones formales |
| **D2 y D3** (raíz de API, `.env.example`) | **Resueltas por trabajo concurrente**, no por éste |

### Con la autorización de cambio de producto

| ID | Cerrado con |
|---|---|
| **B-02** | La API va **detrás del mismo dominio**. `deploy/nginx.conf` con los seis prefijos |
| **C-01** | `AppErrorHandler` + `ErrorReporter` (código `E-<commit>-<n>`, sin PHI ni pila) + `features/error-recovery`. **Queda el destino remoto** |
| **C-02** | Seis cabeceras desde `src/server/security-headers.ts`, con CSP por hash SHA-256 |
| **H-01** | `buildInfo` con commit y fecha, estampado por `generate-env.mjs` |
| **H-02** | Playwright: **7 journeys de sesión** contra el artefacto construido |
| **H-03** | Verificación de `API_ERROR_CODES` contra el catálogo |
| **H-04** | `Dashboard` y `ShellLayout` probados |
| **H-05 / H-07** | `IDENTITY_VERIFICATION_ROUTE = '/identidad/verificar'` y la pantalla que la hace real |
| **H-06 / M-01 / M-02** | La directiva `appAnuncio`, aplicada a las 6 pantallas de autenticación |
| **H-10** | `.github/workflows/ci.yml`, con etapa de Playwright |
| **M-03** | `fieldOf()` ancla los errores de `class-validator` al campo |
| **M-04** | `check-contrast.mjs` — **encontró un defecto real** (`--st-warning-fg` a 4,46:1) |
| **M-09** | `IdleLogoutService`, 15 min con aviso a los 13 |
| **M-10** | Oyente de `storage` sobre `mantra.refresh-token` |
| **M-11** | Refresco proactivo en el interceptor |
| **M-13** | La organización elegida se persiste |
| **M-15** | `timeoutInterceptor`: 30 s, y 120 s en subidas |
| **M-16** | El comodín muestra un 404 |
| **M-21** | `axe-core` sobre 13 componentes — **encontró `select-name`, crítico** |
| **M-22** | `check-tokens.mjs`, bidireccional, 202 tokens |
| **L-05 / L-06** | Tokens de movimiento y de apilamiento |
| **L-07 / L-08 / L-09** | Favicon con hash, `check-api-prefixes.mjs`, rutas públicas del interceptor |

**Tres de estos cierres los encontró la propia herramienta**, no una revisión:
`check-contrast.mjs` halló un contraste insuficiente, `axe-core` un `<select>`
sin nombre accesible, y Playwright dos defectos que bloqueaban producción
—`allowedHosts` rechazando todo dominio real, y el refresh token sobreviviendo al
cierre de sesión—. Ninguno de los cinco era visible leyendo el código.

### Lo que sigue abierto

| ID | Qué falta | Por qué no se cerró |
|---|---|---|
| **B-01** | Desplegar | Necesita destino, credenciales y un registro de imágenes. **No es código** |
| **C-01** (parcial) | Destino remoto de los errores | Decisión de operación con implicaciones de privacidad |
| **H-08 / H-09** | Monitoreo, alertas y evento `estado_ux_mostrado` | Dependen de B-01 |
| **H-11** | El dominio de los enlaces del correo | Está en el repositorio de la API |
| **M-06 / M-07** | Reflow, zoom y objetivos táctiles | Requieren un navegador real y una persona midiendo |
| **M-12** | Marco normativo (HIPAA/GDPR/ley local) | **Decisión legal**, no técnica |
| **M-17 / M-18 / M-19** | Caché, CSS crítico, presupuesto | Decisiones que piden un caso concreto o una medición en producción |
| **L-01 a L-04, L-10** | Detalles editoriales y de nombres | Sin consecuencia observada |

**Ninguna de las abiertas es de código.** Todas son configuración, credenciales,
una decisión o una medición que necesita producción.
