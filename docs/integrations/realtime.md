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
