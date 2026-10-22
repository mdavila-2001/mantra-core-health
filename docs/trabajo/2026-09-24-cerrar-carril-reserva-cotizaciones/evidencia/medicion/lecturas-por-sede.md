# Lecturas de cupos por sede — antes y después (H1.S2.M2, H2.S2.M2–M3)

En la maqueta la pestaña Red no muestra estas lecturas: el simulador es un interceptor en memoria.
Por eso se cuentan con `HttpTestingController`, en el spec del componente, con el mismo recorrido
antes y después.

| Situación de la sede | Antes (`4daf00aa`) | Después |
|---|---|---|
| Con cupos en la semana visible | 1 lectura (semana) | 1 lectura (semana + horizonte) |
| Con la semana vacía | **2 lecturas en serie**: la semana y, cuando vuelve vacía, el «próximo hueco» (60 días, `limit=1`) | **1 lectura**: el próximo hueco sale de la misma respuesta |
| N sedes, todas con la semana vacía | hasta **2N** lecturas, en dos tandas | **N** lecturas, todas a la vez |

## De dónde sale cada número

- **Antes:** el spec de la base, `practitioner-availability.spec.ts` @ `4daf00aa`, test «con la
  semana vacía ofrece el próximo hueco»: responde `/scheduling/slots` **dos veces seguidas** —la
  segunda sólo sale después de la primera— y el test «con cupos esta semana no busca el próximo
  hueco» fija la lectura única del caso con cupos.
- **Después:** el spec de la rama, tests «pide los cupos de todas las sedes en paralelo, una
  lectura por sede» (dos sedes → dos pedidos pendientes a la vez, y `expectNone` después de
  responderlos vacíos) y «con la semana vacía ofrece el próximo hueco de la misma lectura»
  (`expectNone` tras la primera respuesta).

## Por qué no hay filtro por profesional (Q-J3)

`GET /scheduling/slots` acepta un solo `resourceId` (`ListSlotsQueryDto` de la API; el doble de
`scheduling.handlers.ts:160` también), ventana de hasta 92 días y `limit` hasta 500, ordenado por
`startAt`. Sin un filtro por profesional la unidad mínima es la sede, y una lectura por sede en
paralelo es lo más que se puede sin tocar la API (fuera del alcance del carril).
