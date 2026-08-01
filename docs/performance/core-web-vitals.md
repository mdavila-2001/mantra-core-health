# Core Web Vitals

**No hay ninguna medición.** Ni sintética (Lighthouse) ni de campo (telemetría).
Esta página documenta esa ausencia y lo que el código permite anticipar.

---

## Estado de la medición

| Métrica | Objetivo «bueno» | Medido | Cómo se mediría |
|---|---|---|---|
| **LCP** (mayor pintado con contenido) | ≤ 2,5 s | **No** | Lighthouse, o `PerformanceObserver` |
| **INP** (interacción a siguiente pintado) | ≤ 200 ms | **No** | Solo de campo, con telemetría real |
| **CLS** (desplazamiento acumulado) | ≤ 0,1 | **No** | Lighthouse o `PerformanceObserver` |
| TTFB | ≤ 800 ms | **No** | Depende del despliegue, que no existe |
| FCP | ≤ 1,8 s | **No** | Lighthouse |

**Sin línea base no hay presupuesto posible.** Fijar «LCP ≤ 2,5 s» hoy sería
copiar el umbral de Google, no comprometerse con algo medido.

## Lo que el código permite anticipar

No es medición; es lectura. Cada afirmación es verificable en el código.

### A favor del LCP

| Decisión | Efecto |
|---|---|
| **4 rutas prerenderizadas** | `/auth`, `/auth/registro`, `/auth/recuperar` y `/design-system` salen del servidor **ya pintadas**. Es justo donde el SSR paga |
| **Tipografías autoalojadas** | Cero peticiones a un CDN externo, cero resolución DNS de terceros |
| **Inter Variable en un solo archivo** | Un archivo cubre 100–900 |
| **Cero scripts de terceros** | Nada bloquea la carga |
| `maxAge: '1y'` en los estáticos | Con `outputHashing: "all"`, las visitas repetidas no bajan nada |

### En contra del LCP

| Decisión | Efecto |
|---|---|
| **516,70 kB iniciales** (132,27 kB en tránsito) | Todo eso hay que descargar, analizar y ejecutar antes de hidratar |
| **Poppins es estática, tres pesos** | Tres archivos, no uno |
| **Todo lo que tiene sesión se pinta en el cliente** | `/panel` no puede prerenderizarse: el servidor no ve la sesión |
| `inlineCritical: false` en producción | El CSS crítico **no** se pone en línea: hay una petición de estilos bloqueante |

### A favor del CLS

| Decisión | Efecto |
|---|---|
| **El script anti-parpadeo del tema** | El tema correcto se aplica antes del primer paint: no hay repintado |
| **`app-skeleton` con la forma del contenido** | El panel reserva 4 líneas *«con la forma de la lista que va a ocupar su lugar»* |
| **`prefers-reduced-motion` global** | Nada se mueve si la persona no quiere |

### En contra del CLS

| Decisión | Efecto |
|---|---|
| **`Breakpoints` arranca en escritorio bajo SSR** | En un teléfono, el nav pasa de columna a cajón **tras el primer render**. Es un cambio de layout observable |
| Sin dimensiones reservadas para el contenido diferido | La vitrina, al cargar su fragmento |

El primero está **decidido a conciencia**: la alternativa —arrancar en cajón—
haría desaparecer el botón de hamburguesa en escritorio, y *«un elemento que se va
es peor que uno que llega»*.

### A favor del INP

| Decisión | Efecto |
|---|---|
| **Todos los componentes `OnPush`** | Salvo la raíz, que no tiene estado |
| **Señales en todas partes** | La notificación es puntual, no un recorrido de árbol |
| `withEventReplay()` | Los clics anteriores a la hidratación no se pierden |

### En contra del INP

| Decisión | Efecto |
|---|---|
| Sin caché de datos | Cada navegación que necesite datos vuelve a pedir |
| Sin cancelación de peticiones | Una respuesta tardía se procesa igual |

## `inlineCritical: false` merece una mirada

```json
"styles": { "minify": true, "inlineCritical": false }
```

Angular lo trae en `true` por defecto: extrae el CSS crítico y lo pone en línea
en el `<head>`, evitando una petición bloqueante en la primera pintada.

Está **desactivado a propósito** —alguien lo escribió— pero **el motivo no está
registrado en ninguna parte**. Las razones habituales son un fallo con
`@import` de tipografías (que este proyecto usa) o una incompatibilidad con el
prerenderizado.

Es exactamente el tipo de decisión que un ADR debería conservar. Registrado como
brecha `MEDIUM` en
[el análisis de brechas](../reports/documentation-gap-analysis.md); si el motivo
se recupera, corresponde
[un ADR](../adr/index.md).

## Qué haría falta para medir

### Medición sintética — la más barata

```bash
yarn build
yarn serve:ssr:mantra-core-health
npx lighthouse http://localhost:4000/auth --view
```

**No requiere instalar nada permanente** (`npx` lo baja al vuelo) y da LCP, FCP y
CLS de las cuatro rutas prerenderizadas. Es el primer paso obvio.

Para `/panel` haría falta una sesión, así que la medición sintética cubre lo
público y deja fuera lo autenticado.

### Medición de campo — la única que da INP

INP **solo se mide con usuarios reales**: depende de qué hacen y con qué
dispositivo. Exige telemetría, que hoy no existe.

Ver [Web Vitals](../observability/web-vitals.md) y
[analítica](../integrations/analytics.md), donde están las decisiones de
privacidad que hay que tomar antes.

## Recomendación

1. **Correr Lighthouse sobre las cuatro rutas prerenderizadas.** Sin instalar
   nada. De ahí sale la primera línea base real.
2. **Fijar presupuestos con esos números**, no con los de Google.
3. **Recuperar o volver a decidir `inlineCritical`.**
4. Evaluar la telemetría de Web Vitals **después** de resolver la discusión de
   privacidad.

Ninguna se ejecuta acá: las cuatro son cambios de producto o de herramientas.
