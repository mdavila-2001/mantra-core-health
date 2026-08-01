# Tiempo real

**No existe ninguna integración en tiempo real.** Esta página lo registra con
evidencia, porque una aplicación de salud suele necesitarla y su ausencia es una
decisión, no un descuido.

---

## Verificado por ausencia

```bash
grep -rn "WebSocket\|EventSource\|socket.io\|SSE\|setInterval\|setTimeout" src/app --include="*.ts"
```

No aparece ninguna conexión persistente ni sondeo periódico. Las dependencias
tampoco: `package.json` no trae `socket.io-client`, `sockjs`, `@microsoft/signalr`
ni equivalentes.

| Mecanismo | Estado |
|---|---|
| WebSockets | No existe |
| Server-Sent Events | No existe |
| Sondeo periódico | No existe |
| Long polling | No existe |
| Notificaciones push del navegador | No existe |
| Service worker | No existe |
| Sincronización entre pestañas (`storage` event) | No existe |

## Cómo se actualizan los datos hoy

**Manualmente, y con el estado que lo dice.**

```html
<app-view-state-host [state]="directory()" (retry)="load()" (refresh)="load()">
```

El proyecto no finge que el dato está fresco: cuando la proyección declara
`refreshedAt`, se muestra **S7 con la antigüedad siempre visible** y un botón
«Actualizar».

Es una respuesta honesta a la falta de tiempo real: en vez de refrescar en
segundo plano sin avisar, se dice cuán viejo es lo que se ve y se ofrece
recargar.

## Por qué no hace falta todavía

Las ocho pantallas actuales son de autenticación y un panel. Ninguna muestra
datos que cambien mientras la persona mira:

| Pantalla | ¿Cambiaría solo? |
|---|---|
| Login, registro, recuperación, verificación | No |
| Elegir organización | No |
| Panel | El directorio público cambia con la frecuencia de una vista materializada |

## Dónde va a hacer falta

Cuando existan las secciones del modelo, tres casos lo van a pedir:

| Caso | Mecanismo razonable |
|---|---|
| Estado de una verificación de identidad | Sondeo. `IdentityClient.getVerificationCase` ya existe |
| Agenda de turnos con varios profesionales | WebSocket o SSE |
| Avisos entre usuarios | SSE |
| Resultados que llegan mientras se mira una historia | SSE |

**El primero es el que ya tiene la mitad hecha**: la operación de consulta existe
y nadie la llama. Un sondeo cada N segundos mientras el caso esté abierto sería
la implementación más simple que funciona, y no requiere infraestructura nueva.

## Lo que habría que resolver antes

Si se decide agregar una conexión persistente:

1. **Autenticación.** Los WebSockets no llevan cabeceras. Habría que negociar el
   token en la conexión o por un ticket de un solo uso — el patrón `Bearer` +
   `X-Tenant-Id` del interceptor **no se traslada tal cual**.
2. **Reconexión y estado.** Una conexión caída necesita reintento con retroceso
   y, sobre todo, **una forma de decirle a la persona que lo que ve puede estar
   desactualizado**. El proyecto ya tiene ese estado: es S7.
3. **Cambio de organización.** `X-Tenant-Id` define el contexto. Cambiar de
   organización tendría que cerrar y reabrir la conexión, o el servidor estaría
   mandando eventos de la organización anterior.
4. **Cierre de sesión.** La conexión debe cerrarse. Hoy `clearLocal()` limpia
   store y almacenamiento; tendría que cerrar también el socket.
5. **PHI en tránsito.** Un evento con datos clínicos exige las mismas garantías
   que una respuesta HTTP: TLS, y nada en registros del cliente.
6. **SSR.** `EventSource` y `WebSocket` no existen en Node. Toda conexión tiene
   que abrirse tras `afterNextRender`, como hace `Breakpoints` con `matchMedia`.

El punto 3 es el menos evidente y el más peligroso: es el mismo problema que
`ShellLayout.changeTenant` ya resuelve para la navegación, y que una conexión
persistente reintroduciría.

## Estado

**No es una brecha.** Es una ausencia coherente con el alcance actual. Se
convierte en brecha el día que exista una pantalla cuyo dato cambie mientras se
mira. Registrado así en
[el análisis de brechas](../reports/documentation-gap-analysis.md).
