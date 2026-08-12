# Reversión

**No hay procedimiento de reversión de despliegue porque no hay despliegue.**
Esta página cubre lo que sí se puede revertir hoy y lo que hará falta cuando
exista.

---

## Lo que sí se puede revertir hoy

### El trabajo documental

Todo lo que este trabajo añadió vive en cinco lugares, y **ninguno entra al
bundle**:

```text
docs/          (excepto docs/auditoria/, preexistente)
scripts/       (excepto generate-env.mjs, que es de otro trabajo)
structurizr/
mkdocs.yml
```

```bash
git status --porcelain
rm -rf structurizr mkdocs.yml
git clean -nd docs scripts     # revisar ANTES de borrar
```

`package.json`, `angular.json`, `tsconfig*.json`, `eslint.config.js`,
`vitest.config.ts`, `yarn.lock`, `src/` y `public/` quedaron **sin modificar**.
Ver [validación de regresiones](../reports/regression-validation.md).

### Un cambio de código

```bash
git revert <sha>
yarn install --immutable
yarn lint && yarn tsc -p tsconfig.app.json --noEmit && yarn build && yarn test:coverage
```

## Lo que va a hacer falta

| Elemento | Estado |
|---|---|
| Artefactos versionados | **No existen.** `version: "0.0.0"`, sin identificador de build |
| Registro de imágenes | No existe |
| Estrategia de despliegue | No definida |
| Procedimiento documentado | No existe |
| Smoke posterior a la reversión | No existe |

**Sin versionado no hay reversión posible**: no se puede volver a «la versión
anterior» si nada dice cuál es. Es la razón por la que el versionado del
artefacto está clasificado como `HIGH`.

## Las tres particularidades de este frontend

Una reversión de este proyecto no es solo «volver al contenedor anterior».

### 1 · Los chunks viejos desaparecen

`outputHashing: "all"` da nombres nuevos en cada build. Al revertir:

- Quien tenga la versión nueva abierta pedirá chunks que **el despliegue viejo no
  tiene** → 404 → navegación que no completa.
- El `maxAge: '1y'` de los estáticos hace que esos nombres sigan cacheados.

**Mitigación:** conservar los artefactos de las dos últimas versiones y servir la
unión, o aceptar que quien tenga la pestaña abierta debe recargar.

Ver el runbook
[chunks desactualizados](runbooks/chunks-desactualizados.md).

### 2 · Las 4 rutas prerenderizadas son HTML estático

`/auth`, `/auth/register`, `/auth/forgot-password` y `/design-system` **se generan en el
build**. Revertir el JavaScript sin revertir ese HTML deja las dos mitades
descoordinadas.

**Regla: el artefacto se revierte entero**, browser y server juntos.

### 3 · `PUBLIC_API_BASE_URL` está compilada dentro

No se puede cambiar al revertir. Si la reversión es por un problema de destino de
la API, hace falta **una imagen nueva**, no una anterior.

## Procedimiento propuesto

### Cuándo revertir

| Situación | Acción |
|---|---|
| La aplicación no carga | **Revertir de inmediato** |
| Un flujo crítico roto (login, registro) | **Revertir** |
| Degradación de rendimiento | Revertir si es grave |
| Fallo cosmético | Corregir hacia adelante |
| Fallo de la API | **No revertir el frontend**: escalar |

La última fila importa: **la mitad de los síntomas del frontend son problemas de
la API**, y revertir el frontend no arregla ninguno.

### Cómo

```text
1 · Identificar la versión anterior buena
2 · Revertir el artefacto COMPLETO (browser + server)
3 · Verificar con el smoke de abajo
4 · Comunicar
5 · Registrar la incidencia con el `requestId` que reportó quien lo detectó
```

### Smoke tras revertir

- [ ] `/auth` carga
- [ ] `/design-system` carga (verifica el prerenderizado)
- [ ] Iniciar sesión funciona
- [ ] `/dashboard` no muestra S8 (verifica que la API es alcanzable)
- [ ] Recargar con sesión no vuelve al login
- [ ] El tema no parpadea

Es el mismo de [despliegue](deployment.md#después--smoke), y por una razón:
**una reversión es un despliegue.**

## Reversión de datos

**No aplica.** El frontend no persiste nada más que un token y una preferencia de
tema. Ninguna migración de datos que revertir.

Cuando exista caché, habría que vaciarla al revertir: una caché escrita por la
versión nueva puede tener una forma que la anterior no entiende.

## Estado

Depende del `BLOCKER` de [despliegue](deployment.md).

**Lo que sí se puede hacer hoy** es el versionado del artefacto (`HIGH`), que es
prerrequisito de cualquier reversión y no depende de que exista el despliegue.
