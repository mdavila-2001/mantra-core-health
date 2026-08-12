# Auditoría de rendimiento

- **Fecha:** 2026-08-01
- **Método:** análisis del artefacto construido y del código. **Sin medición en
  navegador.**

> **Limitación de partida.** No hay Lighthouse, ni telemetría, ni línea base de
> Core Web Vitals. Esta auditoría dice **cuánto pesa y qué lo explica**; no dice
> cuánto tarda en cargar para una persona.

---

## Lo que sí se midió

```text
Initial total        | 518,95 kB crudo | ~132 kB estimado en tránsito
  chunk-…            | 242,00 kB   runtime de Angular
  chunk-…            | 204,37 kB   runtime de Angular
  main               |  56,76 kB   código de la aplicación
  styles             |  14,54 kB   188 tokens + tipografías
  chunk-…            |   1,28 kB

Lazy
  design-system-sample | 181,73 kB
  toast-dev-panel      |   2,98 kB

Prerenderizadas: 4 rutas
```

| Presupuesto | Umbral | Actual | Estado |
|---|---|---|---|
| Inicial (aviso) | 500 kB | 518,95 kB | ⚠️ **+18,95 kB** |
| Inicial (error) | 1 MB | 518,95 kB | ✅ |
| Estilo por componente | 4 / 8 kB | — | ✅ sin avisos |

## El dato que ordena la discusión

**56,76 kB de código propio para 61 componentes, 15 servicios y 6 clientes.**

El resto —446 kB— es el runtime de Angular. Eso acota mucho lo que se puede
optimizar sin cambiar de framework, y también relativiza el exceso: **el
proyecto no está inflado, el umbral está apretado.**

## Hallazgos

### P-01 · `MEDIUM` · Presupuesto excedido, con dos salidas legítimas

18,95 kB sobre el umbral de aviso. El build **no falla**.

| Salida | Coste |
|---|---|
| **Diferir las 6 pantallas de `auth/`** | Medio. **Tres están prerenderizadas** y hay que verificar que sigan saliendo |
| **Subir el umbral a ~550 kB** | Nulo. Es reconocer que 500 era una cifra redonda |

**Lo que no es defendible es dejar el aviso indefinidamente**: un aviso que nadie
va a atender entrena a ignorar los avisos.

### P-02 · `MEDIUM` · `inlineCritical: false` sin motivo registrado

```json
"styles": { "minify": true, "inlineCritical": false }
```

Angular lo trae en `true`. Está desactivado explícitamente y **el porqué no está
en ninguna parte**.

Consecuencia: hay una petición de CSS bloqueante antes de la primera pintada, y
**nadie sabe si se puede revertir**. Ver
[ADR-0010](../adr/ADR-0010-css-critico-en-linea.md), que enumera las tres
hipótesis y cómo verificarlas.

### P-03 · `MEDIUM` · Sin línea base de Core Web Vitals

Ni sintética ni de campo. **Fijar objetivos hoy sería copiar los umbrales de
Google, no comprometerse con algo medido.**

**Y se resuelve sin instalar nada:**

```bash
yarn build && yarn serve:ssr:mantra-core-health &
npx lighthouse http://localhost:4000/auth --view
```

Cubre las cuatro rutas prerenderizadas. `/dashboard` necesita sesión, así que queda
fuera de la medición sintética.

### P-04 · `LOW` · Tres tipografías instaladas y sin importar

`@fontsource/lato`, `@fontsource-variable/open-sans`,
`@fontsource-variable/roboto`. **No pesan en el paquete** —lo que no se importa
no se empaqueta— pero ocupan lugar en el lockfile.

### P-05 · `LOW` · Sin presupuesto por fragmento

`design-system-sample` pesa 181,73 kB y **nada lo vigila**. Podría duplicarse sin
aviso.

## Lo que está bien y conviene no perder

| Decisión | Efecto |
|---|---|
| **Cero scripts de terceros** | Nada bloquea la carga |
| **Tipografías autoalojadas** | Cero DNS ni peticiones externas. Y privacidad |
| **Inter Variable en un archivo** | Cubre 100–900 |
| **4 rutas prerenderizadas** | Salen del servidor ya pintadas |
| `outputHashing: "all"` + `maxAge: '1y'` | Las visitas repetidas no bajan nada |
| **La vitrina diferida** | 181,73 kB fuera del paquete inicial |
| **Todos `OnPush`** + señales | La detección de cambios es puntual |
| `computed` en vez de trabajo en plantilla | Se recalcula solo si cambió una dependencia |
| `track` en todos los `@for` | Sin destruir y recrear DOM |
| `withEventReplay()` | Los clics previos a hidratar no se pierden |
| **Un solo `effect`** de producto | Escribe en el DOM, que es su uso correcto |

## Los dos intercambios conscientes

Ninguno es un defecto; los dos están documentados en el código.

### El arranque espera al canje del refresh token

```ts
provideAppInitializer(() => inject(AuthService).restoreSession())
```

**Cuesta una petición antes de la primera pintada** y compra que nadie con sesión
válida vea un parpadeo al login.

**Si el LCP resultara malo al medirlo, éste es el primer lugar donde mirar.**

### El nav arranca en escritorio bajo SSR

Produce un cambio de layout en un teléfono tras el primer render — un CLS
observable. La alternativa era peor: el botón de hamburguesa **desapareciendo** en
escritorio.

> *«Un elemento que se va es peor que uno que llega.»*

## Lo que no se pudo medir

| Métrica | Por qué |
|---|---|
| LCP, FCP, CLS | Sin Lighthouse ejecutado |
| **INP** | **Solo se mide de campo**, con usuarios reales |
| TTFB | Depende del despliegue, que no existe |
| Composición del bundle | Sin analizador instalado |
| Rendimiento con la API real | Sin entorno |

## Recomendaciones

| # | Qué | Dependencias | Valor |
|---|---|---|---|
| 1 | **Lighthouse con `npx`** | Ninguna permanente | **Alto** — desbloquea todo lo demás |
| 2 | Decidir P-01: bajar o subir | Ninguna | Medio |
| 3 | Resolver P-02 midiendo | Ninguna | Medio |
| 4 | `source-map-explorer` con `npx`, una vez | Ninguna permanente | Medio |
| 5 | Presupuesto por fragmento | Ninguna | Bajo |
| 6 | Quitar las tres tipografías de reserva | Ninguna | Bajo |
| 7 | Web Vitals de campo | Una, + privacidad | Alto, después |

**Las seis primeras no añaden ninguna dependencia al proyecto.**

Ninguna se ejecuta en este trabajo documental.

## Veredicto

**El rendimiento del artefacto es razonable y está sin medir.**

- El peso se explica casi entero por el framework.
- Las decisiones de carga son buenas y están justificadas.
- **La brecha real no es de rendimiento: es de medición.**

`P-03` es la que hay que cerrar primero, y es la más barata de todas.
