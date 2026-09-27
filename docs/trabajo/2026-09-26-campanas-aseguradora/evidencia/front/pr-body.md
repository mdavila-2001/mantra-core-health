## Contexto

Prepara `dev` para hablar con la API real en vez de la maqueta en memoria, y saca el aviso de
demo que ya no aplica cuando eso pasa.

## Cambios

- **`environment.ts` / `environment.development.ts`**: `mockBackend` pasa a `false` (antes
  hardcodeado en `true` en los dos); `demoPresets`/`paymentDemo`/`loyaltyDemo`/`campaignsDemo`
  también a `false` por defecto, encendibles por variable de entorno
  (`PUBLIC_DEMO_PRESETS`, etc.) para un staging de demo. Sólo la rama `mockup` conserva su
  propio `environment.ts` con `mockBackend: true`.
- **`MockBanner`**: queda inerte (plantilla y estilos vacíos) en esta rama — el aviso «sin
  backend, cualquier contraseña sirve» no tiene sentido en `dev`. El componente sigue en su
  sitio (referenciado desde `app.html`/`app.ts`) para no tocar esos archivos.
- **`app.routes.server.ts`**: `auth/register/patient`, `auth/register/practitioner` y
  `auth/register/organization` pasan de `Prerender` a `Client`. Con `mockBackend` apagado,
  esas tres altas disparan al montarse llamadas HTTP reales a catálogos dinámicos
  (departamentos, ocupaciones, `/system-context/dynamic-enums` para tipo de credencial, tipo de
  entidad legal) — prerenderizarlas hace que el build les pegue a esas rutas sin backend
  escuchando, y la petición cuelga hasta el timeout y tumba la construcción entera.
  `auth/register/laboratory` sigue prerenderizándose: no inyecta ningún cliente HTTP en su alta.

## Verificación

- `yarn build` (producción): **exit 0** — antes fallaba con `AbortError` al prerenderizar
  `/auth/register/practitioner` (timeout esperando una API que no existe durante el build).
- `check-bundle-budget.mjs` (parte del propio gancho `pre-push`): inicial 255,03 kB en 12
  archivos, sin exceder ningún techo que el script controle.
- Gancho `pre-push` del repo: pasó limpio (sin `--no-verify`).

## Ojo al revisar

- El `bundle initial` que reporta el propio Angular CLI (no el script del hook) sigue marcando
  **warning** de presupuesto (1,21 MB contra 620 kB) — no bloquea el build (exit 0) y ya era así
  antes de esta rama; no se investigó si es exactamente la misma cifra que en `dev` limpio.
- No se auditaron el resto de las rutas de `auth/*` en profundidad: sólo se corrigieron las que
  el build señaló al fallar. Si alguna otra alta también dispara una llamada HTTP eager, se
  destaparía recién al buildear con esta configuración.
- Cambios ajenos a la Tarea 4 de campañas preventivas: este PR es sobre apagar el mock, no
  sobre campañas (ese trabajo va en el PR de la API #492 y en un PR de front aparte cuando se
  implemente el consumo de `/insurance/campaigns`).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
