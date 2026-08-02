# Instrumentar RxJS sin romperlo

Un span mal colocado en un flujo reactivo no da una medición equivocada: da una
fuga de memoria, un span que no se cierra nunca, o una petición que se ejecuta
dos veces. Esta página es la lista de lo que sí y lo que no, con el porqué.

Toda la instrumentación de Observables pasa por `TracingService.traceObservable`
—no hay operadores propios ni parcheo global— y `FormTracing` es su único
envoltorio de más alto nivel.

---

## 1 · Las cuatro reglas

### Regla 1 · El span se abre al suscribirse, no al construir

```ts
// mal: el span existe aunque nadie consuma el Observable
const span = tracer.startSpan('operacion');
return this.http.get(url).pipe(finalize(() => span.end()));

// bien: `defer` retrasa todo hasta la suscripción
return defer(() => {
  const span = tracer.startSpan('operacion');
  …
});
```

Un Observable de `HttpClient` que nadie consume **no hace ninguna petición**. Un
span abierto ahí mediría una petición que no existió, y como nada lo cerraría,
se quedaría abierto para siempre: los spans sin cerrar no se exportan, se
acumulan en memoria hasta que la pestaña muere.

Está fijado por la prueba «NO abre span si nadie se suscribe».

### Regla 2 · Un span es una operación, no una emisión

```ts
// mal: veinte emisiones, veinte spans
source.pipe(tap((value) => tracer.startSpan('emision').end()));
```

Un `Subject` con veinte emisiones produce **un** span. La prueba «un span por
operación, no uno por emisión» lo fija emitiendo tres veces y comprobando que al
final hay uno solo.

Vale también para lo que no es RxJS: no hay spans por actualización de signal,
por recomputación de `computed`, por ejecución de `effect`, por ciclo de
detección de cambios ni por lifecycle hook.

### Regla 3 · `finalize` cierra, y cierra una sola vez

`finalize` corre en los tres finales: completado, error y **desuscripción**. Es
el único que los cubre todos. Un `tap({complete})` deja el span abierto cuando
alguien se da de baja antes de tiempo, que es lo que pasa cada vez que un
`switchMap` descarta el anterior.

### Regla 4 · Cancelar no es fallar

Una desuscripción marca `ui.result = cancelled` y **no** pone el span en error.
Pasa constantemente y por motivos sanos: la persona navega, un `switchMap`
descarta la búsqueda anterior, un componente se destruye. Marcarlas en rojo
llenaría el panel de fallos que nadie puede accionar, y el día que haya un fallo
de verdad estaría enterrado entre ellos.

---

## 2 · Comportamiento por operador

| Operador | Qué pasa | Nota |
|---|---|---|
| Observable frío | Un span por suscripción | El caso normal |
| `Subject` / `BehaviorSubject` | Un span, mientras dure la suscripción | Ver §3 |
| `switchMap` | El descartado se cierra como `cancelled` | Correcto y deseado |
| `mergeMap` | Un span por rama, todos hijos si la suscripción va en contexto | |
| `concatMap` | Se cierran en orden | |
| `exhaustMap` | Lo ignorado no abre span: nunca se suscribió | |
| `forkJoin` / `combineLatest` | Un span por fuente envuelta | Envolver el resultado, no cada fuente, si lo que interesa es el conjunto |
| `retry` | El reintento ocurre **dentro** del mismo span | Ver §4 |
| `catchError` que devuelve un valor | El span **completa**, no falla | El error se manejó: decirlo de otro modo sería mentir |
| `share` | El span es de la primera suscripción | Ver §3 |
| `shareReplay` | Igual, y las repeticiones no abren span | Ver §3 |
| `takeUntilDestroyed` | Desuscripción → `cancelled` | Comportamiento correcto |

---

## 3 · `share`, `shareReplay` y multisuscripción

Con `share`, el trabajo lo dispara la **primera** suscripción. El span pertenece
a ella. Las suscripciones siguientes reciben las emisiones sin abrir span
propio, así que el panel muestra una operación —que es lo que ocurrió— y no
tres.

Con `shareReplay`, una suscripción posterior recibe el valor cacheado sin que
pase nada: ni petición, ni span. También correcto.

La consecuencia a tener presente: **la duración del span es la de la primera
suscripción**, no la del conjunto. Si la primera se da de baja y el flujo sigue
vivo para otras, el span se cierra como `cancelled` aunque el trabajo continúe.

Cuando eso importe, se envuelve **la fuente compartida** una sola vez, antes del
`share`, y no cada consumidor.

---

## 4 · Reintentos

`retry` reintenta dentro del mismo span. Es deliberado: para la pantalla, «pedir
el perfil» es una operación aunque por debajo hayan salido tres peticiones.

En el interceptor pasa lo mismo con el refresco de sesión. `tracingInterceptor`
va **antes** que `authInterceptor` precisamente para esto: si fuera al revés,
una llamada que la persona vive como una produciría dos spans hermanos y la
latencia real quedaría repartida entre los dos.

Cuando haga falta ver los intentos por separado, la forma correcta es un span
hijo por intento —no un span raíz por intento—, y hoy no hay ningún caso que lo
justifique.

---

## 5 · Lo que no se instrumenta, y por qué

| Qué | Por qué no |
|---|---|
| Selectores y estado derivado | Se recalculan sin parar; medir eso es medir el framework |
| `Subject` globales de larga vida | Un span que dura toda la sesión no se exporta hasta que termina, y para entonces no sirve |
| Cada operador de un flujo | El resultado es un árbol de spans que describe el código, no la operación |
| Parcheo global de RxJS | Cambiaría el comportamiento de todo el proyecto para observar una parte |
| Flujos de interfaz (scroll, hover, teclas) | Volumen enorme, señal nula |

Y tres prohibiciones que son de corrección, no de gusto: no cambiar el orden de
los operadores, no convertir un Observable frío en caliente, y no provocar
suscripciones adicionales. Las tres alterarían el comportamiento de la
aplicación, que es exactamente lo que la observabilidad no puede hacer.

---

## 6 · Cómo se envuelve algo nuevo

```ts
// En un servicio de core/
return this.tracing.traceObservable(
  'perfil.cargar',                       // clase de operación, sin identificadores
  { 'app.feature': 'perfiles' },         // atributos que no describen a nadie
  () => this.profiles.get(id),           // fábrica, no Observable ya construido
);
```

Para un formulario, `FormTracing.traceSubmit` ya aporta el nombre del
formulario, el recuento de errores de validación y el resultado:

```ts
this.formTracing
  .traceSubmit('login', 'auth', this.form, () => this.auth.login(credenciales))
  .subscribe({ next: …, error: … });
```

El `subscribe` no cambia. Lo que devuelve es el mismo Observable, envuelto.

Siguiente: [05-web-vitals-strategy.md](05-web-vitals-strategy.md).
