# Requisitos previos

Lo mínimo para que el repositorio compile y las pruebas corran. Todo lo de esta
página está verificado contra la ejecución real, no contra lo que suele pedir un
proyecto Angular.

## Herramientas

| Herramienta | Versión | Por qué esa |
|---|---|---|
| Node.js | **24.x** | Es la que usa la imagen de desarrollo (`node:24-bookworm-slim`). El proyecto no declara `engines`, así que nada lo impone: usar otra mayor es arriesgarse a una diferencia que solo aparece en CI |
| Yarn | **4.18.0** | Fijada en `package.json` → `packageManager`. No hace falta instalarla: la baja Corepack |
| Git | cualquiera reciente | — |

```bash
corepack enable          # habilita Yarn 4 con la versión que fija el proyecto
node -v                  # v24.x
yarn -v                  # 4.18.0
```

**No uses `npm install` ni `pnpm install`.** El repositorio está en modo Plug'n'Play
de Yarn (ver abajo) y otro gestor generaría un `node_modules` que convive mal con
`.pnp.cjs`.

## El repositorio instala en modo PnP

`package.json` no declara `nodeLinker`, así que Yarn 4 usa su modo por defecto:
**Plug'n'Play**. En vez de un `node_modules`, la instalación produce

```text
.pnp.cjs            resolución de módulos (≈ 830 kB, generado)
.pnp.loader.mjs     cargador ESM (generado)
.yarn/unplugged/    dependencias con binarios nativos, desempaquetadas
```

Los tres están en `.gitignore` y se regeneran con `yarn install`.

Tres consecuencias prácticas:

1. **Los binarios de `.yarn/unplugged/` son de tu plataforma.** Los de macOS no
   sirven en el contenedor Linux, y por eso `.dockerignore` los excluye. Si el
   contenedor falla con *«Could not find the builder's node package»*, es esto.
2. **El editor necesita el SDK de Yarn** para resolver los tipos. Sin él,
   TypeScript en VS Code marca como no encontrados imports que compilan bien:
   ```bash
   yarn dlx @yarnpkg/sdks vscode
   ```
3. **Vite avisa que PnP está desaconsejado** al correr las pruebas. Es un aviso
   conocido y sin efecto medido: las 804 pruebas pasan. Está registrado en
   [la línea base](../reports/baseline.md).

## Para levantar la aplicación completa hace falta el backend

El frontend por sí solo compila, arranca y sirve todas las pantallas públicas.
Lo que **no** funciona sin API es cualquier cosa que pida datos: iniciar sesión,
registrarse y el panel.

| Qué querés hacer | Necesitás la API |
|---|---|
| `yarn build`, `yarn lint`, `yarn test` | No |
| Ver la vitrina del sistema de diseño (`/design-system`) | No |
| Ver el login o el registro pintados | No |
| Entrar, registrarte o ver el panel con datos | **Sí** |

La API es el repositorio `mantra-core-health-redesa-api` y escucha en
`http://localhost:3000`, que es a donde apunta `proxy.conf.json`. Sin ella, el
panel muestra los estados **S8 (sin conexión)** o **S9 (error inesperado)** —
que es exactamente lo que debe mostrar, no un fallo de la aplicación.

## Docker (opcional)

Hay una imagen de desarrollo (`Dockerfile.dev` + `docker-compose.yml`) que evita
tener que instalar Node y Yarn en el host. Requiere Docker Desktop o Docker
Engine con Compose v2. Ver [instalación local](local-setup.md#con-docker).

## Editor

`.vscode/extensions.json` declara las extensiones recomendadas del proyecto. Las
que importan para trabajar cómodo:

- **Angular Language Service** — comprobación de plantillas con `strictTemplates`.
- **ESLint** y **Prettier** — el proyecto tiene ambas configuradas
  (`eslint.config.js`, `.prettierrc`).

## Siguiente paso

[Instalación local](local-setup.md).
