# Solución de problemas

Problemas reales de este repositorio, con la causa comprobada. Para incidentes
en un entorno desplegado, ver los [runbooks](../operations/runbooks/index.md).

---

## «Could not find the builder's node package»

**Síntoma.** El contenedor falla al arrancar, o el build no encuentra
`@angular/build`.

**Causa.** Artefactos de instalación del host mezclados con los de la imagen.
El repositorio instala en modo PnP y `.yarn/unplugged/` contiene binarios
nativos **de la plataforma donde se instaló**. Los de macOS no corren en Linux.

**Solución.**

```bash
docker compose build --no-cache
```

`.dockerignore` ya excluye `.pnp.*`, `.yarn/unplugged`, `.yarn/cache` y
`node_modules` justamente por esto. Si el problema persiste, comprobá que nadie
haya montado la raíz del proyecto como volumen: `docker-compose.yml` monta
**solo** `src/`, `public/` y los `tsconfig`, y hay un comentario explicando por
qué.

---

## El editor marca imports que sí compilan

**Síntoma.** VS Code subraya en rojo `import { … } from '@angular/core'`, pero
`yarn build` pasa sin errores.

**Causa.** Modo PnP: no hay `node_modules` que el servidor de TypeScript del
editor pueda recorrer.

**Solución.**

```bash
yarn dlx @yarnpkg/sdks vscode
```

Y después seleccionar la versión de TypeScript del workspace
(`Ctrl/Cmd+Shift+P` → *TypeScript: Select TypeScript Version* → *Use Workspace
Version*).

---

## `Cannot find module './env.generated'`

**Síntoma.** La compilación falla al resolver `src/environments/env.generated.ts`.

**Causa.** Ese archivo es **generado** y no se versiona. Si invocaste `ng` o
`vite` directamente en vez de por los alias de `package.json`, nadie lo escribió.

**Solución.**

```bash
yarn env:generate
```

Los alias `start`, `build`, `watch` y `test` ya lo encadenan. El contenedor lo
genera en su `CMD`.

---

## El login responde, pero el panel no carga datos

**Síntoma.** Entrás bien y el panel muestra la tarjeta «Directorio público» en
estado **S8 (sin conexión)** o **S9 (error inesperado)**.

**Esto no es un fallo de la aplicación**: es exactamente lo que debe mostrar
cuando la API no está. Comprobá, en orden:

1. ¿La API responde? `curl -i http://localhost:3000/public/directory`
2. ¿El proxy la alcanza? Las seis rutas de `proxy.conf.json` son
   `/iam`, `/public`, `/terminology`, `/profiles`, `/identity`, `/common`. Una
   ruta nueva de la API que no esté ahí se va al servidor de desarrollo.
3. Si estás en Docker: `BACKEND_ORIGIN` no puede ser `localhost` — dentro del
   contenedor eso es el contenedor. Usá `host.docker.internal`.

---

## Entro, y me vuelve a sacar al login

**Síntoma.** El inicio de sesión funciona, y a la siguiente petición volvés a
`/auth`.

**Causa probable.** El interceptor recibió un `401`, intentó refrescar una vez,
falló, y cerró la sesión — que es su comportamiento correcto y deliberado (no
reintenta en bucle para no agotar el límite de peticiones de la API).

Qué mirar:

- ¿El refresh token se guardó? Debe estar en `localStorage` bajo
  `mantra.refresh-token`. Si el navegador bloquea el almacenamiento (Safari en
  modo privado, cookies de terceros deshabilitadas), la sesión **funciona
  durante la pestaña y se pierde al recargar**: es una degradación deliberada.
- ¿El token trae más de una organización? Entonces no te está sacando: te está
  mandando a `/auth/organization` a elegir. Es el segundo camino del `authGuard`.
- ¿El reloj de la máquina está bien? `isAccessTokenExpired` compara contra `exp`
  con 10 s de margen.

Ver [sesión y tokens](../security/session-and-tokens.md).

---

## Todo se ve con el tema equivocado por un instante al cargar

**Síntoma.** Un parpadeo claro→oscuro (o al revés) en la primera pintada.

**Causa.** Bajo SSR el HTML llega sin `data-theme`. Por eso `src/index.html`
tiene un script en línea en el `<head>` que estampa el atributo **antes del
primer paint**, leyendo `localStorage`.

Si el parpadeo aparece, comprobá que la clave siga siendo la misma en los dos
lados:

```text
src/index.html                       'mantra-core-health.theme'
src/app/core/tokens/theme.service.ts  THEME_STORAGE_KEY
```

Son un espejo declarado. La preferencia `system` **no escribe atributo** a
propósito: la resuelve `@media (prefers-color-scheme: dark)` en CSS, sin
JavaScript, y por eso nunca parpadea.

---

## El menú lateral ocupa toda la pantalla en el teléfono

**Síntoma.** En un ancho chico, la navegación empuja el contenido fuera de la
pantalla.

**Causa.** `Shell` recibe `drawerMode` como entrada — no mide la ventana él
mismo. Quien la mide es `core/layout/breakpoints.ts` (umbral 780 px) y quien se
lo pasa es `ShellLayout`. Si el shell se monta desde otro lado sin pasar
`drawerMode`, se queda en modo escritorio.

Bajo SSR arranca **siempre** en escritorio (`false`) y se corrige tras el primer
render: el servidor no tiene ventana que medir. Al revés sería peor — el HTML
del servidor traería el botón de hamburguesa y desaparecería al hidratar en
cualquier pantalla grande.

---

## `yarn build` avisa que se pasa del presupuesto

```text
▲ bundle initial exceeded maximum budget. Budget 500.00 kB was not met by 16.70 kB
```

**Es preexistente y no rompe.** El umbral de aviso está en 500 kB y el de error
en 1 MB; el artefacto pesa 516,70 kB crudos (132,27 kB en tránsito). Análisis y
propuesta en [presupuestos](../performance/budgets.md).

---

## `yarn install` avisa de un par de dependencias no satisfecho

```text
YN0060: @angular/cli 21.2.19 no satisface lo que angular-eslint pide (>=22 <23)
```

**Preexistente, sin efecto medido.** Lint y build pasan. Subir `@angular/cli`
tocaría el lockfile y el toolchain: es un cambio de producto y necesita
autorización. Registrado en [la línea base](../reports/baseline.md#41--par-de-dependencias-no-satisfecho-aviso-de-instalación).

---

## El recargado en caliente no reacciona (en Docker, en macOS)

**Causa.** Los bind mounts de Docker Desktop en macOS no propagan eventos de
sistema de archivos.

**Ya está resuelto**: el `CMD` del `Dockerfile.dev` pasa `--poll 2000`. Si lo
sacás, deja de funcionar.

---

## Las pruebas avisan de PnP y Vite

```text
Using Yarn PnP with Vite is discouraged…
```

Conocido, sin efecto medido: 804 pruebas pasan. Silenciarlo exigiría cambiar el
`nodeLinker` del proyecto entero.
