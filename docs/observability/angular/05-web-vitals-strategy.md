# Rendimiento percibido y trazas

Qué se mide del rendimiento, qué no, y por qué Jaeger no es el sitio para la
mayor parte de ello.

---

## 1 · La decisión de fondo

**Jaeger es un almacén de trazas, no un sistema de métricas.**

Una traza responde «¿qué pasó en esta operación concreta y por qué tardó?». Una
métrica responde «¿cómo se comporta esto en general?». Convertir cada medición
de rendimiento en spans mezcla las dos cosas y hace las dos peor: el volumen se
dispara y las preguntas agregadas —el percentil 75 del LCP de la semana— siguen
sin poder responderse, porque el muestreo ya descartó la mayoría de los datos.

Por eso aquí se hace lo poco que **sí** encaja en una traza, y el resto se
declara pendiente de una herramienta de métricas.

---

## 2 · Lo que sí se mide, y dónde vive

| Medida | Dónde aparece | Cómo se obtiene |
|---|---|---|
| Carga del documento | Span `angular.document.load` | `PerformanceNavigationTiming` |
| Tiempo hasta el primer byte | Atributo `http.server.response.time_ms` de ese span | `responseStart` |
| Tamaño transferido y decodificado | Atributos del mismo span | `transferSize`, `decodedBodySize` |
| Arranque de Angular | Span `angular.bootstrap` | Marcas en `main.ts` |
| Hidratación / estabilidad | Span `angular.hydration` | `ApplicationRef.isStable`, vía `AppStabilityTracing` |
| Duración de navegación | Span `angular.navigation` | Eventos del Router |
| Carga de fragmento diferido | Span `angular.lazy-route.load` | `RouteConfigLoadStart` / `End` |
| Latencia por endpoint | Span `angular.http.request` | El interceptor |
| Render en el servidor | Span `ssr.render` | Middleware de Express |

Con eso se responde la pregunta que motiva casi toda investigación de lentitud:
**dónde se fue el tiempo** — en el servidor, en la red, en el arranque, en la
hidratación o en una llamada concreta.

### El caso concreto que esto destapa

`app.config.ts` tiene un inicializador que **espera al canje del refresh token**
antes de que el Router evalúe el guard. Es una petición de red dentro del
arranque, puesta a propósito para evitar un parpadeo al login, y hasta ahora
nadie la había medido. El span `angular.hydration` la incluye, y el
`angular.http.request` del refresco la aísla.

---

## 3 · Lo que no se mide, y por qué

| Métrica | Estado | Motivo |
|---|---|---|
| LCP | No se recoge | Es una métrica agregada; un span por visita no da percentiles |
| INP | No se recoge | Ídem, y exige observar todas las interacciones |
| CLS | No se recoge | Ídem |
| FCP | No se recoge | Ídem |
| Long tasks | No se recoge | Volumen alto, y en zoneless no hay una correlación directa con detección de cambios |
| Recursos individuales | **Deliberadamente no** | Serían decenas de spans por carga; ver §4 |

TTFB sí está, porque sale gratis de la entrada de navegación que ya se lee.

**No se recogen no porque no importen, sino porque medirlas bien exige una
herramienta de métricas** —un `MeterProvider` de OpenTelemetry exportando a un
sistema de series temporales, o `web-vitals` contra un endpoint propio—. Meterlas
en Jaeger daría la ilusión de tenerlas.

---

## 4 · Por qué no hay un span por recurso

`@opentelemetry/instrumentation-document-load` emite un span por cada recurso
descargado. Con las tipografías autoalojadas y los cinco archivos iniciales de
este proyecto, son decenas de spans por visita que repiten lo que cinco
atributos ya dicen.

Multiplicado por cada carga de página, sería con diferencia la mayor fuente de
volumen del sistema —más que todas las peticiones a la API juntas— a cambio de
información que las herramientas del navegador ya dan mejor.

La decisión completa, con las otras razones (el lazo de instrumentar `fetch`, el
peso en el paquete), está en
[01-architecture-design.md](01-architecture-design.md).

---

## 5 · Coste medido de la telemetría

Build de producción, comparando la misma rama con y sin la instrumentación:

| | Paquete inicial (crudo) | Transferencia estimada |
|---|---:|---:|
| Sin telemetría | 542,07 kB | 137,43 kB |
| Con telemetría | 571,81 kB | 147,10 kB |
| **Diferencia** | **+29,74 kB** | **+9,67 kB** |

Y aparte, en un fragmento que **solo se descarga si la telemetría está
encendida**:

```
telemetry-browser-bootstrap    49,17 kB crudo    14,47 kB transferido
```

Ese fragmento contiene el SDK entero, el exportador y los recursos. Que esté
fuera del paquete inicial es lo que evita que todo el mundo —incluida la gente
cuya traza el muestreo va a descartar— pague por él en la primera carga.

Los +9,67 kB del inicial son `@opentelemetry/api` más el código propio de
instrumentación, que sí tienen que estar disponibles desde el principio: el
interceptor y el seguimiento del Router se registran al arrancar.

### Efecto en el arranque

`startTelemetry()` no devuelve una promesa y no se espera. El `import()` del SDK
se dispara y el arranque sigue. Con la telemetría apagada —el valor por
defecto— el fragmento ni se pide.

`provideObservability()` añade un inicializador que **no devuelve nada**, así
que no se suma a la espera del inicializador de sesión que ya existía.

### Presupuesto

El aviso de `angular.json` estaba en 560 kB. Con esto pasa a 580 kB. No es un
aviso que se silencia: es que el coste está medido, es de 9,67 kB transferidos,
y compra la capacidad de responder por qué una pantalla tarda. El umbral de
error sigue en 1 MB, muy lejos.

---

## 6 · Si mañana hacen falta Web Vitals

El orden recomendado, y ninguno pasa por meter métricas en Jaeger:

1. **Un `MeterProvider` de OpenTelemetry** junto al `TracerProvider`, exportando
   por OTLP al mismo Collector. Aprovecha el gateway, la CSP y el saneado que ya
   existen; solo hay que añadir un pipeline de métricas al Collector y un
   destino que las guarde.
2. **La librería `web-vitals`** contra un endpoint propio, si lo único que se
   quiere son las cinco métricas de Core Web Vitals.
3. **Correlación por `app.release`, `app.route.template` y
   `deployment.environment.name`**, que ya son atributos de recurso de las
   trazas. Es lo que permitirá cruzar «esta versión empeoró el LCP» con «esta
   versión cambió estos spans».

Siguiente: [06-data-privacy-policy.md](06-data-privacy-policy.md).
