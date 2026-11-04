# Trozos 404 y `NG0750` al iniciar sesión, tras un redespliegue

- Fecha: 2026-11-04
- Síntoma reportado: al iniciar sesión como paciente, la consola muestra
  `chunk-*.js 404` y `[E-desconocido-00N] NG0750 · 0.1.0 · /dashboard` (×4).
  Recargar lo arregla.

## Causa

La pestaña estaba ejecutando **una construcción anterior a la desplegada**.

Cada `ng build` pone nombres nuevos a los trozos diferidos (`chunk-CT2XDVRL.js`)
y el redespliegue deja sólo los de la construcción nueva. Una pestaña abierta
antes del redespliegue —la pantalla de login que quedó abierta, o la sesión
anterior que se cerró sin recargar— conserva el `main-*.js` viejo, que conoce
sólo los nombres viejos. Al entrar, el panel del paciente
(`features/dashboard/dashboard.html`) pinta sus **cuatro bloques `@defer`**, cada
uno pide un trozo que ya no existe → 404 → Angular informa `NG0750` (la carga de
un `@defer` falló). Son exactamente los cuatro `E-…-00N` del reporte.

Recargar «lo arregla» porque trae el `index.html` nuevo. El `Cache-Control:
no-cache` del HTML (`src/server.ts`) evita servir HTML viejo en una visita nueva,
pero no puede hacer nada por una pestaña que ya estaba abierta. Lo mismo pasa
durante un despliegue de Coolify con dos contenedores vivos detrás del alias
`web` (`deploy/nginx.coolify.conf`, `server web:4000 resolve`).

Lo agravaba que `app.routes.ts` convertía cada ruta perezosa fallida en
`ErrorRecovery` con `.catch(() => chunkFallido())`, **descartando el error**: ni
código de soporte ni intento de recuperación, sólo «Algo salió mal · Recargar».
Y en la maqueta, `mock-backend.interceptor.ts` guardaba en caché la promesa
rechazada del simulador: después del primer fallo, todo pedido fallaba hasta
recargar a mano («Ocurrió un error inesperado» en el login).

`E-desconocido` es otro hallazgo: Coolify construye sin `.git`, así que el commit
no se estampaba en el paquete.

## Arreglo (dos capas)

1. **Recuperación** — `core/errors/stale-build-recovery.ts`. Reconoce el fallo
   de un trozo inexistente (Chromium, Firefox, Safari, `NG0750`) y hace una carga
   completa de la página a la que se iba, **una sola vez por construcción**: si
   tras recargar la construcción es la misma, el trozo falta de verdad y no se
   vuelve a recargar (sin bucles). Enganchada en:
   - **al navegar** (recarga directa: la pantalla nueva no llegó a abrirse y
     los `canDeactivate` ya pasaron): `withNavigationErrorHandler` en
     `app.config.ts`, y `ErrorRecovery`, que ahora recibe el error de
     `chunkFallido` (64 rutas de `app.routes.ts`, las 18 de gobierno y las de
     afiliaciones, dispensa, receta compartida, Insights y alta asistida), lo
     registra con código y recupera;
   - **fuera de una navegación** (`AppErrorHandler` para los `@defer`, el
     cargador del simulador): primero confirma con `/build-version.json` que
     hay otra construcción —un corte de red da el mismo mensaje que un 404— y
     recarga sólo si la pantalla se abrió hace menos de 8 s (el caso del panel
     recién entrado). Si no, no toca lo que la persona está escribiendo: marca
     la pestaña y la próxima navegación hace la carga completa.
   - El simulador ya no guarda la promesa rechazada.
2. **Prevención** — `core/build/build-version-watcher.ts`. Compara la
   construcción en ejecución con `/build-version.json` (lo escribe
   `scripts/generate-env.mjs`, se sirve sin caché) al volver a la pestaña, cada
   5 min y al navegar. Si hay una nueva, la **próxima** navegación es una carga
   completa, en `GuardsCheckEnd`: un `canDeactivate` con cambios sin guardar
   sigue pidiendo confirmación. La navegación de la SPA vieja se aborta
   (`Navigation.abort()`), así que no corren resolvers ni el constructor de la
   pantalla dos veces, y se respeta `replaceUrl`. Nunca recarga por su cuenta.

Además: `SOURCE_COMMIT` (Coolify) como respaldo del commit
(`Dockerfile`, `deploy/docker-compose.coolify.yml`, `generate-env.mjs`).

## Evidencia (navegador real, Chromium)

Dos construcciones `demo` (A y B) servidas con las mismas reglas que
`src/server.ts` (404 para un `.js` inexistente). Paciente `7654321` con sesión en
A → se reemplaza A por B con la pestaña abierta → se abre una pantalla.
Script: [`reproduccion/repro.cjs`](reproduccion/repro.cjs); salida completa:
[`evidencia/resultado.json`](evidencia/resultado.json).

Las dos construcciones son de la versión final de este cambio. «Sin arreglo» se obtiene con el mismo paquete desactivando las dos capas desde la
prueba (huella ya marcada en `sessionStorage` y `/build-version.json` bloqueado).

| Escenario | Trozos 404 | Resultado | Captura |
|---|---|---|---|
| Panel (`@defer`), sin arreglo | 4 | 4× `NG0750` en `/dashboard`, falta «¿Cómo se siente?» — **el reporte** | [png](evidencia/defer-control-sin-arreglo.png) |
| Panel (`@defer`), capa 1 | 2 | el servidor confirma versión nueva → una carga completa de `/dashboard`, panel completo | [png](evidencia/defer-capa1-recuperacion.png) |
| Panel (`@defer`), servidor sin confirmar (como un corte de red) | 4 | **no** recarga: no se pierde nada por un fallo de red | [png](evidencia/defer-sin-confirmacion-no-recarga.png) |
| Mis citas (ruta), sin arreglo | 1 | «Algo salió mal» | [png](evidencia/control-sin-arreglo.png) |
| Mis citas (ruta), capa 1 | 1 | una carga completa, pantalla correcta | [png](evidencia/capa1-recuperacion.png) |
| Mis citas (ruta), capa 2 | **0** | carga completa antes de pedir nada viejo | [png](evidencia/capa2-vigilante.png) |
| Trozo que falta de verdad | 2 | **una** recarga, luego «Algo salió mal» con código (sin bucle) | [png](evidencia/guarda-trozo-roto-de-verdad.png) |

Pruebas unitarias nuevas: `stale-build-recovery.spec.ts`,
`build-version-watcher.spec.ts`, `error-recovery.spec.ts` y un caso nuevo en
`app-error-handler.spec.ts`. La suite completa no entra en la memoria del
contenedor de una sola vez: se corrió en 9 tandas (`core`, `shared`+`server`,
y `features` en siete grupos) y pasan las 18 564 pruebas. Las 8 «unhandled
errors» de `practitioner-profile.spec.ts` (`auth.roles is not a function`) ya
estaban antes de este cambio (verificado sobre la base).

## Revisión independiente

`frontend-reviewer` (no aprobado en la primera vuelta). Se corrigió: recarga
fuera de navegación sin confirmar versión ni proteger formularios (HIGH), la
navegación vieja que seguía tras `location.assign` (M1), las 18 rutas de
gobierno que seguían tragándose el error (M3), el fallo pendiente que podía
quedar colgado (L1, vigencia de 15 s), `replaceUrl` (L2) y el temporizador sin
cancelar (L3). M2: comprobado en Chromium que un `replaceState` justo después
de `location.assign` no cancela la carga completa; Firefox y Safari no se
probaron.

## No resuelto acá

- Coolify sólo pasa `SOURCE_COMMIT` al build con «Include Source Commit in
  Build» activado en el recurso. Sin eso el commit sigue `desconocido` (la
  huella igual funciona con `builtAt`).

- `notifications/me` respondiendo **504**: es la API (tiempo de espera en el
  proxy), no este cambio.
- `mock-backend-latencia.spec.ts` es inestable: corrido solo, su `beforeAll`
  supera 10 s también con el interceptor original; dentro de la tanda de
  `core` pasa.
- Mantener los trozos de la construcción anterior en el servidor (protección de
  versión) eliminaría hasta la recarga, pero exige un almacenamiento compartido
  entre imágenes; con las dos capas no hace falta.
