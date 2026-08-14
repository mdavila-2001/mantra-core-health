# Web Vitals

**No se recogen.** Ni en el cliente, ni en un pipeline, ni en ningún lado.

Para el análisis de qué anticipan las decisiones del código, ver
[Core Web Vitals](../performance/core-web-vitals.md). Esta página es sobre la
instrumentación que no existe.

---

## Estado

| Métrica | Instrumentada | Se puede medir hoy |
|---|---|---|
| LCP | No | Con Lighthouse, en las 4 rutas públicas |
| INP | No | **No.** Solo con usuarios reales |
| CLS | No | Con Lighthouse |
| TTFB | No | Depende del despliegue, que no existe |
| FCP | No | Con Lighthouse |

```bash
grep -rn "web-vitals\|PerformanceObserver\|performance.mark\|performance.measure" src/
```

Sin resultados. Ninguna dependencia de `web-vitals` en `package.json`.

## Los dos caminos

### Sintético — sin instrumentar nada

```bash
yarn build
yarn serve:ssr:mantra-core-health &
npx lighthouse http://localhost:4000/auth --view
```

| Ventajas | Límites |
|---|---|
| **No requiere instalar nada permanente** | Mide una máquina, no usuarios |
| Da LCP, FCP y CLS | **No da INP** |
| Reproducible entre commits | Solo las 4 rutas públicas: `/dashboard` necesita sesión |
| Ninguna decisión de privacidad | |

**Es el primer paso obvio**, y el único sin discusión previa.

### De campo — la única fuente de INP

```ts
// PROPUESTA, no implementada
import { onCLS, onINP, onLCP } from 'web-vitals';
onLCP((metric) => enviar(metric));
onINP((metric) => enviar(metric));
onCLS((metric) => enviar(metric));
```

Requiere:

1. Una dependencia nueva (`web-vitals`, ~2 kB).
2. **Un destino donde enviar** — que hoy no existe.
3. Las decisiones de privacidad de
   [analítica](../integrations/analytics.md#antes-de-agregar-analítica).

## Por qué INP solo se mide de campo

LCP y CLS son propiedades de la carga: una máquina de CI puede reproducirlas.

**INP mide la respuesta a las interacciones reales de personas reales**, con sus
dispositivos y sus condiciones. No hay forma sintética de saber cuánto tarda la
aplicación en responder al clic de alguien en un teléfono de gama media con la
batería al 8 %.

Para este proyecto es especialmente relevante porque el arranque **espera al
canje del refresh token** antes de pintar. Es un intercambio consciente
(sin parpadeo a cambio de una petición), pero su costo real solo se ve de campo.

## Los datos de Web Vitals **no** son datos personales

Vale distinguirlo de la discusión de analítica: un LCP de 2,3 segundos no dice
nada sobre quién lo midió ni qué estaba mirando.

**Pero el envío sí revela cosas:** la IP, la ruta visitada y el momento. En salud,
saber que alguien visitó una sección determinada **sí** es información.

Consecuencia práctica: si se instrumentan Web Vitals, **la ruta debe enviarse
normalizada** (`/pacientes/:id`, no `/pacientes/4821`), y conviene un destino
propio antes que uno de terceros.

## Recomendación

1. **Correr Lighthouse sobre las cuatro rutas prerenderizadas.** Sin instalar
   nada, sin decidir nada. De ahí sale la primera línea base real.
2. **Fijar presupuestos con esos números**, no con los de Google. Ver
   [presupuestos](../performance/budgets.md).
3. **Añadirlo al pipeline** cuando exista uno.
4. **Evaluar el campo después**, junto con la decisión de telemetría en general.

## Estado

`MEDIUM`, dependiente del `BLOCKER` de
[despliegue](../operations/deployment.md): medir el rendimiento de algo que no
está desplegado no tiene destinatario.

El paso 1 **sí se puede hacer hoy** y es el de mejor relación
información/esfuerzo de toda la documentación de rendimiento.
