# Banderas de funcionalidad

**No existen.** Ni locales, ni remotas, ni por entorno.

---

## Estado

```bash
grep -rn "featureFlag\|flags\|isEnabled\|toggle" src/app --include="*.ts" | grep -v toggleTheme
```

Sin resultados. `Environment` declara **un solo campo**:

```ts
export interface Environment {
  readonly apiBaseUrl: string;
}
```

## Lo que se usa en su lugar

### 1 · `isDevMode()`

Dos usos, los dos para avisos que no valen la pena en producción:

```ts
// button.ts
if (isDevMode()) {
  afterNextRender(() => this.warnIfMissingAccessibleName());
}

// view-state-host.ts
if (isDevMode()) {
  effect(() => { if (this.status() === 'error' && !this.errorRequestId()) console.warn(…); });
}
```

**No es una bandera de funcionalidad**: es el modo de compilación. No se puede
cambiar sin recompilar y no distingue entornos más allá de dev/prod.

### 2 · Desmontar el componente

`core/dev/toast-dev-panel/` existe y **no está en ninguna plantilla**. `app.html`
explica por qué:

> *«se quitó de acá: aparecía encima de TODAS las pantallas en desarrollo,
> incluida una demostración.»*

Es la forma más simple de apagar algo: no montarlo. Funciona, y es lo correcto
para una herramienta de desarrollo.

### 3 · No escribir la pantalla

El caso más común, y está declarado:

> *«el menú tiene lo que existe de verdad… Las 81 secciones del modelo se van
> agregando a medida que sus pantallas se escriben — un ítem que lleva a una ruta
> vacía es peor que no tenerlo.»*

**Con 8 pantallas de 81, la estrategia de despliegue es «se despliega cuando está
lista».** No hace falta una bandera para esconder algo que no existe.

## Cuándo van a hacer falta

| Situación | ¿Hace falta una bandera? |
|---|---|
| Una pantalla a medio hacer | No: no se fusiona |
| Una sección solo para ciertos roles | **No: eso es autorización**, y la autoridad es la API |
| Probar dos variantes con usuarios | Sí |
| Desplegar algo apagado y encenderlo después | Sí |
| Apagar algo roto sin revertir | **Sí, y es el caso más valioso** |
| Una sección solo para una organización | Sí |

**La segunda fila importa:** esconder una sección por rol **no es una bandera**.
Y no protege nada: la autoridad es la API. Confundirlas produce el peor de los
dos mundos — una bandera que se cree un control de acceso.

## Si se implementan

### Nivel 1 · Por entorno, en el build

```ts
// PROPUESTA
export interface Environment {
  readonly apiBaseUrl: string;
  readonly features: Readonly<Record<string, boolean>>;
}
```

Con `generate-env.mjs`, que ya tiene el mecanismo: una entrada más en su
`MANIFEST`.

| A favor | En contra |
|---|---|
| Sin infraestructura nueva | Cambiar una bandera exige **recompilar** |
| Sin peticiones extra | No sirve para apagar algo roto en caliente |
| Reutiliza las defensas del generador | |

### Nivel 2 · Desde la API

El backend devuelve las banderas del usuario y la organización.

| A favor | En contra |
|---|---|
| Se cambian sin desplegar | Una petición más en el arranque |
| Por usuario y por organización | Estado nuevo que gestionar |
| **Permite apagar algo roto** | Un fallo al leerlas necesita un valor por defecto seguro |

### Nivel 3 · Servicio de terceros

**Rompe la propiedad de «cero terceros»** del proyecto, y con ella las cuatro
consecuencias que enumera
[servicios externos](../integrations/external-services.md#por-qué-esto-importa).

En una aplicación de salud, un servicio que ve qué usuario tiene qué bandera ve
más de lo que parece.

## Reglas para cuando existan

1. **Una bandera no es autorización.** La autoridad es la API.
2. **Toda bandera tiene fecha de retiro.** Una bandera permanente es una rama
   permanente.
3. **El valor por defecto es seguro.** Si la lectura falla, la funcionalidad está
   apagada.
4. **Se prueban los dos caminos**, o la mitad del código no está probada.
5. **No se anidan.** Dos banderas cruzadas son cuatro caminos.
6. **Nada de PHI en la clave ni en el valor.**

## Recomendación

**No implementar todavía.** Con 8 pantallas de 81 y despliegue por rama, no hay
un caso concreto que lo justifique.

El primero que va a aparecer es el **nivel 2 para apagar algo roto sin
revertir**, y conviene esperar a que aparezca en vez de construir el mecanismo
antes.

Registrado como propuesta, no como brecha, en
[el análisis de brechas](../reports/documentation-gap-analysis.md).
