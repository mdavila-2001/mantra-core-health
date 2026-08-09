# Runbook 8 · Variables de entorno incorrectas

**Síntoma.** La aplicación carga pero pide a la API equivocada: S8 en el panel,
CORS en la consola, o peticiones a un dominio que no corresponde.

**Impacto.** Alto.
**Severidad.** S1.

---

## La causa que hay que entender primero

**`PUBLIC_API_BASE_URL` es de _build_, no de ejecución.**

```text
.env  →  scripts/generate-env.mjs  →  env.generated.ts  →  compilado en el paquete
```

**No se puede cambiar en el contenedor al arrancar.** Corregirla exige
**recompilar y redesplegar**.

Es la diferencia más costosa de descubrir en un incidente.

## Diagnóstico

### 1 · ¿Contra qué origen sale la petición?

```text
F12 → Red → cualquier petición a /iam o /public → columna de URL
```

| Lo que se ve | Significa |
|---|---|
| `https://<frontend>/iam/...` | `apiBaseUrl` **vacío**: rutas relativas |
| `https://<otro>/iam/...` | `apiBaseUrl` con valor |

Y desde la consola:

```js
performance.getEntriesByType('resource')
  .filter(r => r.name.includes('/iam') || r.name.includes('/public'))
  .map(r => r.name);
```

### 2 · ¿Es el valor correcto para este entorno?

| Entorno | Esperado |
|---|---|
| Host (`yarn start`) | Vacío — lo resuelve `proxy.conf.json` |
| Contenedor | Vacío — lo resuelve `proxy.generated.json` |
| Producción, mismo dominio | **Vacío** |
| Producción, otro dominio | La raíz absoluta de la API |

### 3 · Reproducir la generación

```bash
yarn env:generate && cat src/environments/env.generated.ts
```

```ts
export const envFromProcess: Partial<Environment> = {};
```

Un objeto vacío significa que **ninguna variable del manifiesto estaba
definida**, y mandan los valores por defecto de `environment*.ts` — que hoy son
ambos `''`.

### 4 · ¿El generador abortó?

`generate-env.mjs` **falla al compilar** en vez de generar algo peligroso:

| Mensaje | Causa |
|---|---|
| «no puede estar en el MANIFIESTO» | Se agregó una clave con nombre de secreto |
| Valor con forma de JWT o PEM | Se pegó una credencial |
| URL con `usuario:contraseña@`, query o fragmento | `PUBLIC_API_BASE_URL` mal formada |

Un build fallido por esto **no es un problema: es la defensa funcionando**. Ver
[seguridad frontend](../../security/frontend-security.md#variables-públicas-y-privadas).

### 5 · Las otras tres variables

| Variable | Síntoma si está mal |
|---|---|
| `PORT` | El servidor escucha donde nadie lo busca, o `EADDRINUSE` |
| `FRONTEND_PORT` | El contenedor no es alcanzable en el puerto esperado |
| `BACKEND_ORIGIN` | El proxy del contenedor apunta mal → S8 |

**`BACKEND_ORIGIN=http://localhost:3000` dentro de un contenedor es el error más
común**: `localhost` ahí es el contenedor, no el host. Debe ser
`host.docker.internal`.

### 6 · ¿Falta una ruta en el proxy?

```text
/iam  /public  /terminology  /profiles  /identity  /common
```

Están en **dos archivos** (`proxy.conf.json` y `proxy.conf.docker.json`) y hay
que mantenerlos a la par. Una ruta que falte se va al servidor de desarrollo y
devuelve el `index.html` de Angular — que no es JSON, así que sale S9.

**Esa duplicación no tiene prueba que la vigile** (brecha `LOW`).

## Evidencia

- [ ] URL exacta de una petición fallida
- [ ] `env.generated.ts` con el que se compiló
- [ ] Variables del entorno de despliegue
- [ ] Registros del build (¿corrió `env:generate`?)
- [ ] Consola (revela CORS)

## Mitigación

| Causa | Acción |
|---|---|
| `PUBLIC_API_BASE_URL` mal | **Reconstruir y redesplegar.** No hay atajo |
| `BACKEND_ORIGIN` mal (contenedor) | Corregir y reiniciar — es de ejecución |
| `PORT` mal | Ídem |
| Ruta faltante en el proxy | Agregarla **a los dos archivos** |
| Build sin `env:generate` | Reconstruir con `yarn build`, no `ng build` |

## Escalamiento

Frontend, salvo que la API haya cambiado de dominio sin avisar.

## Prevención

1. **Decidir el dominio de la API** — la decisión pendiente número uno.
2. **Una imagen por entorno**, o rutas relativas siempre y una sola imagen.
3. **El smoke debe incluir «el panel no muestra S8»**, que detecta esto.
4. **Comprobación de que los dos proxys coinciden** (`LOW`, fácil).
5. **Registrar en el build con qué valor se compiló**, para poder verificarlo
   después.

La 5 es la más barata y la que más ahorra en un incidente.
