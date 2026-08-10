# Mantra Core Health

Frontend Angular 21 + SSR del sistema médico de Mantra Core Technologies (nombre de producto
provisional: **mantra-core-health**; el definitivo está pendiente).

## Arranque

```bash
corepack enable          # habilita el Yarn que declara package.json (4.18)
corepack yarn install
corepack yarn test --watch=false
corepack yarn start      # http://localhost:4200
```

**Usá siempre `corepack yarn <script>`, nunca `ng` a secas.** El CLI de Angular vive en las
dependencias del proyecto: un `ng` global apunta a otra instalación y falla de formas que no
señalan la causa. Todos los comandos de abajo pasan por los scripts de `package.json`.

> **Si el proyecto está en una ruta con espacios** (por ejemplo `C:\...\Sistema Salud\`), no hace
> falta hacer nada especial: `scripts/generate-env.mjs` resuelve la ruta con `fileURLToPath`. Si
> ves un error del estilo `ENOENT ... Sistema%20Salud`, estás en un commit anterior al arreglo.

### Comandos

| Comando | Qué hace |
| --- | --- |
| `corepack yarn start` | Servidor de desarrollo en `:4200`, con el proxy hacia la API |
| `corepack yarn build` | Compilación de producción con SSR en `dist/` |
| `corepack yarn test --watch=false` | Pruebas unitarias (Vitest) |
| `corepack yarn test:coverage` | Pruebas con cobertura y umbrales |
| `corepack yarn lint` | ESLint, incluidas las reglas de arquitectura |
| `corepack yarn e2e` | Suite Cypress de punta a punta |

### Generar código

Con el CLI del proyecto, **no a mano**: `angular.json` ya fija la convención de nombres
(clase `X`, archivo `x.ts`, sin sufijo `Component`).

```bash
corepack yarn ng generate component shared/components/atoms/mi-atomo
corepack yarn ng generate interface shared/components/atoms/mi-atomo/mi-atomo --type=types
```

### La API

El frontend habla con `mantra-core-health-api` a través del proxy (`proxy.conf.json` → `:3000`),
así que en desarrollo no hay CORS de por medio. Para levantar la API y su base, ver el README de
ese repositorio. Con el stack en pie, la cuenta sembrada por el bootstrap sirve para entrar.

## Antes de tocar el código

- **Coordinación.** Si hay más de una persona o sesión trabajando sobre la misma rama, declarar
  los archivos que se van a tocar en [`COORDINACION-AGENTES.md`](COORDINACION-AGENTES.md) **antes**
  de empezar. El archivo existe porque ya hubo un trabajo duplicado que costó reconciliar.
- **Colores y tipografías salen de `src/styles.css`.** Nunca un hex literal en un componente. Los
  exports de diseño (Stitch) traen su propia paleta Material y sus propias fuentes, que **no** son
  las de este sistema: de esos archivos se toma la estructura y la jerarquía, jamás los valores.
  Un hex copiado no lo detecta ninguna prueba, porque no es un token corrido sino uno nuevo.
- **Mobile-first.** Las consultas de medios van con `min-width` sobre los breakpoints tokenizados;
  el estilo base es el móvil.
- **Todo tiene que renderizar bajo SSR:** sin `window`, `document` ni `localStorage` en la ruta de
  render; lo que necesite el navegador va detrás de `afterNextRender()`.

## Documentos

| Archivo | Para qué |
| --- | --- |
| [`AVANCE-FRONTEND-CONSOLIDADO.md`](AVANCE-FRONTEND-CONSOLIDADO.md) | Qué hay construido y qué falta |
| [`ESTADO-FRONTEND.md`](ESTADO-FRONTEND.md) | Detalle del estado por área |
| [`PENDIENTES-BACKEND.md`](PENDIENTES-BACKEND.md) | Lo que el frontend espera de la API |
| [`COORDINACION-AGENTES.md`](COORDINACION-AGENTES.md) | Protocolo entre sesiones en paralelo |
