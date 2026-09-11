# Provocar un fallo en la maqueta

Sirve para **mirar** los estados de error de una pantalla en el navegador, no
sólo probarlos desde una prueba unitaria.

---

## El problema que resuelve

El backend simulado es un interceptor de Angular
(`core/mock/mock-backend.interceptor.ts`), así que **ninguna petición llega a la
red**. Eso es lo que hace que la maqueta arranque sin API detrás, y también lo
que dejaba un tercio de cada pantalla sin forma de mirarse: el camino feliz se
recorre entero, y los avisos de «tu rol no permite», «ya no existe» o «no
pudimos conectarnos» sólo existían en las pruebas.

No es una distinción académica. El defecto que trajo esta herramienta —el alta
de alergias se quedaba **muda** cuando la petición no llegaba, así que quien la
miraba se iba creyendo que la alergia quedó registrada— vivió meses en una
pantalla revisada muchas veces: nadie podía verlo porque nadie podía provocarlo.

**Cortar `fetch` o `XMLHttpRequest` desde la consola no sirve.** Como el
interceptor responde antes de la red, la petición se resuelve igual y parece que
el corte no hizo nada. Es un callejón que cuesta media hora descubrir.

## Cómo se usa

Desde la consola del navegador, o desde un guion de Playwright:

```js
sessionStorage.setItem('mock:fallos', JSON.stringify([
  { patron: '/clinical/allergy-intolerances', modo: 'red', metodos: ['POST'] },
]));
```

Se lee en **cada** petición: encenderlo y apagarlo no exige recargar.

| Campo | Qué hace |
|---|---|
| `patron` | Casa por **subcadena de la ruta**, no por la URL entera |
| `modo` | Cuál de los estados del M34 se quiere mirar |
| `metodos` | Opcional. Sin él alcanza a todos los métodos |

`metodos` es lo que hace usable la herramienta: deja fallar el alta **sin tumbar
la lectura** que pinta la pantalla donde vive el formulario.

## Los cinco modos

| `modo` | Respuesta | Estado M34 | Aviso típico |
|---|---|---|---|
| `red` | Estado 0, sin cuerpo | S8 · Offline | «No pudimos conectarnos. Revisá tu conexión y reintentá.» |
| `forbidden` | 403 · `FORBIDDEN` | S5 · Forbidden | El texto propio del bloque |
| `not-found` | 404 · `NOT_FOUND` | S6 · Not found | «El expediente ya no existe. Recargá la pantalla.» |
| `conflict` | 409 · `CONFLICT` | S4 · Validation | Lo que el bloque haga con el duplicado |
| `error` | 500 · `INTERNAL` | S9 · Error | El mensaje **con su identificador de petición** |

`red` se distingue de los demás a propósito: el estado 0 es lo que
`errorToViewState` lee como «la petición no llegó», y es el único sin cuerpo ni
código de contrato. Devolver un 500 en su lugar mostraría el aviso equivocado,
que es justo lo que esto viene a poder distinguir.

**Los cuerpos llevan el `code` del contrato**, no sólo el estado HTTP:
`errorToViewState` mapea por código —dos códigos distintos comparten el 403— y
un cuerpo sin él caería en «error inesperado» en vez del estado que se quería
mirar. También llevan `correlationId`, porque S9 exige el identificador y un
simulador que lo omite enseña a leer mal el error de verdad.

## Tres decisiones deliberadas

1. **Vive en `sessionStorage` y muere con la pestaña.** Un interruptor que
   sobrevive a la recarga es uno que alguien deja encendido sin querer y que
   después nadie encuentra. Mismo criterio que `modo-api.ts`.
2. **Sólo afecta al backend simulado.** Con la maqueta apagada el archivo no se
   consulta: `environment.mockBackend` lo decide antes, así que no hay forma de
   que se cuele en producción.
3. **Tolera basura sin romper nada.** Un JSON inválido, un modo que no existe o
   el almacenamiento bloqueado se leen como «sin fallos». Una herramienta de
   desarrollo que tumba la aplicación al escribirse mal es peor que no tenerla.

## Dónde está

| Archivo | Qué hace |
|---|---|
| `core/mock/fallos-simulados.ts` | Lee lo declarado y arma el cuerpo del fallo |
| `core/mock/mock-backend.interceptor.ts` | Lo consulta **antes** de buscar el manejador |
| `core/mock/fallos-simulados.spec.ts` | Fija el contrato: apagado por omisión, tolerante, con los códigos del contrato |

Ver también [Datos de prueba](test-data.md) y
[Recorrido visual](recorrido-visual.md).
