# Runbook 12 · Reversión de una entrega

**Cuándo.** Cuando cualquiera de los once runbooks anteriores concluye
«revertir».

**Severidad.** La del incidente que la motiva.

---

## Antes de nada: ¿es del frontend?

**La mitad de los síntomas del frontend son problemas de la API.** Revertir el
frontend no arregla ninguno.

| Señal | Revertir el frontend |
|---|---|
| Pantalla en blanco tras un despliegue | **Sí** |
| Chunks fallidos | Sí (o conservar artefactos) |
| Error de hidratación | Sí |
| **S8 en el panel** | **No** → [runbook 4](backend-no-disponible.md) |
| **S9 con códigos de soporte** | **No** → escalar a la API |
| S4/S5 en masa | **No** → cambio de contrato en la API |
| CORS | **No** → [runbook 6](cors-bloqueando.md) |

## El estado actual

**No hay despliegue de producción**, así que este procedimiento describe lo que
hará falta. Ver [despliegue](../deployment.md).

Y **no hay versionado del artefacto**: `package.json` dice `0.0.0` y nada en la
aplicación dice qué versión corre.

> **Sin versionado no hay reversión posible**: no se puede volver a «la versión
> anterior» si nada dice cuál es. Es la razón por la que el versionado está
> clasificado como `HIGH`.

## Las tres particularidades de este frontend

### 1 · Los chunks viejos desaparecen

`outputHashing: "all"` da nombres nuevos en cada build. Al revertir, quien tenga
la versión nueva abierta pedirá chunks que el despliegue viejo **no tiene**.

**Mitigación:** conservar los artefactos de las dos últimas versiones y servir la
unión.

### 2 · Cuatro rutas son HTML estático

`/auth`, `/auth/registro`, `/auth/recuperar` y `/design-system` se generan en el
build.

**Regla: el artefacto se revierte entero**, `browser` y `server` juntos. Revertir
solo uno deja las dos mitades descoordinadas.

### 3 · `PUBLIC_API_BASE_URL` está compilada dentro

Si el incidente es por un destino de API equivocado, **una versión anterior no
lo arregla**: hace falta una imagen nueva. Ver
[runbook 8](variables-incorrectas.md).

## Procedimiento

### 1 · Decidir

| Situación | Acción |
|---|---|
| La aplicación no carga | **Revertir ya** |
| Flujo crítico roto (login, registro) | **Revertir** |
| Fallo cosmético | Corregir hacia adelante |
| Causa desconocida y grave | **Revertir** — es reversible y barato |

### 2 · Identificar la versión anterior buena

Hoy: por el commit. Cuando exista versionado, por la etiqueta del artefacto.

### 3 · Revertir el artefacto completo

`dist/mantra-core-health/browser/` **y** `.../server/`, preservando la estructura:
`server.mjs` busca `../browser` relativo a sí mismo.

### 4 · Smoke

- [ ] `/auth` carga
- [ ] `/design-system` carga (verifica el prerenderizado)
- [ ] Iniciar sesión funciona
- [ ] `/panel` **no** muestra S8 (verifica que la API es alcanzable)
- [ ] Recargar con sesión **no** vuelve al login (verifica `restoreSession`)
- [ ] El tema no parpadea (verifica el script en línea)

Es el mismo de [despliegue](../deployment.md#después--smoke): **una reversión es
un despliegue.**

### 5 · Comunicar

Qué se revirtió, desde qué versión, por qué, y qué sigue.

### 6 · Registrar

- Código de soporte de quien reportó.
- Hora del despliegue y hora de la reversión.
- Síntoma.
- Qué runbook se usó.

### 7 · Post mortem

Para S1 y S2. La pregunta que más rinde acá:

> **¿Qué lo habría detectado antes?**

Hoy la respuesta casi siempre es **«nada»** —no hay telemetría ni smoke
automatizado— y eso es exactamente el argumento para agregarlos.

## Reversión del código, en el repositorio

```bash
git revert <sha>
yarn install --immutable
yarn lint && yarn tsc -p tsconfig.app.json --noEmit && yarn build && yarn test:coverage
```

`git revert` y no `reset`: conserva la historia y no reescribe lo que otros ya
tienen.

## Reversión de datos

**No aplica.** El frontend solo persiste un token y una preferencia de tema.

Cuando exista caché, habría que vaciarla: una caché escrita por la versión nueva
puede tener una forma que la anterior no entiende.

## Prevención

| # | Qué | Estado |
|---|---|---|
| 1 | **Versionar el artefacto** | **No existe** (`HIGH`) |
| 2 | Conservar los artefactos de las dos últimas versiones | No implementado |
| 3 | Smoke automatizado tras el despliegue | No existe |
| 4 | Staging donde probar antes | **No existe** |
| 5 | Telemetría que detecte antes que un humano | **No existe** (`CRITICAL`) |

El **1** es prerrequisito de todo lo demás **y no depende de que exista el
despliegue**: se puede hacer hoy.
