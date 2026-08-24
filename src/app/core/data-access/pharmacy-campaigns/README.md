# Campañas de farmacia (FAR-I7)

Las promociones que una farmacia publica y un paciente ve: cards en «dónde comprar»,
banner en el pedido y una pantalla de detalle con URL compartible.

## Estado: sin backend, con gate de demo

Los módulos `promotions` y `marketing` existen en el modelo pero **no publican una sola
lectura** — seis y trece rutas respectivamente, todas `POST`
(`promotions.controller.ts:41-112`, `marketing.controller.ts:62-236`). El
`GET /promotions/campaigns?site=&active=` que la tarjeta del carril anticipaba no existe.

Además el modelo **todavía no relaciona una campaña con productos**:
`discount_rules.target_filter_json` se persiste literal y nadie lo lee
(`promotions-discounts.service.ts:182`), y `applies_to_concept_id` es
`ORDER | ITEM | CATEGORY`, que es una clase de objetivo y no una lista de productos. El
pedido a Marcelo está en `COORDINACION-AGENTES.md`.

Mientras tanto, mismo camino que la billetera de puntos (FAR-I6): **las reglas se cumplen
de verdad** —la vigencia se evalúa contra el reloj, una promoción vencida no entrega
precios ni por URL directa, el precio promocional siempre es menor que el de lista— y los
**datos son de demostración**, con chip «DEMO» a la vista y bajo
`environment.campaignsDemo`. Apagado el interruptor, las secciones de promoción no se
pintan en ningún lado: sin campañas no hay sección vacía decorativa.

## La segmentación por diagnóstico: lo que este módulo NO hace, y por qué

El registro del cliente pide (FARMACIA-5, literal) *«campañas de medicamentos para
pacientes que padecen una enfermedad exclusiva (ejemplo: diabéticos)»*. **Este módulo no
implementa esa segmentación, y no es una omisión pendiente: es una decisión.** Apuntar una
promoción a las personas que tienen un diagnóstico convierte la entrega del mensaje en una
inferencia sobre la salud de quien lo recibe. La campaña que llega a un teléfono revela la
condición de su dueño a cualquiera que mire la pantalla, y el solo hecho de armar la
audiencia obliga a cruzar el padrón comercial con el diagnóstico clínico — un uso del dato
que la persona no autorizó cuando lo entregó para atenderse. Por eso acá no hay ni un
campo, ni un filtro, ni un tipo que la insinúe: lo que se construyó son campañas como
contenido general, iguales para todos o acotadas por farmacia favorita y cercanía.

La versión dirigida es posible, pero **requiere consentimiento** explícito, granular y
revocable de cada paciente para el uso de su condición con fines de promoción — un permiso
distinto del que se da para ser atendido, pedido por separado, con su registro auditable y
con la campaña anulándose para quien lo revoque. Esa maquinaria es el módulo de
`consent`, que el modelo ya contempla y este carril no toca. El día que exista, la
segmentación se apoya en él: `marketing.segments` y `segment_members` son la maquinaria
que la ejecutaría, y la regla es que ningún segmento se pueda construir a partir de un
dato clínico sin un consentimiento vigente que lo respalde para ese uso concreto. Hasta
entonces, la respuesta al cliente es esta: **la campaña para diabéticos se puede hacer,
después del consentimiento, no antes.**

## Piezas

| Archivo | Qué es |
|---|---|
| `pharmacy-campaigns.types.ts` | Los contratos. `CampanaPublica` es una unión discriminada para que una campaña vencida no pueda filtrar precios por plantilla |
| `pharmacy-campaigns.money.ts` | Aritmética en centavos enteros. Los importes son texto siempre: el `numeric` del backend no cabe en un `number` |
| `pharmacy-campaigns.fixtures.ts` | La forma de las tres campañas sembradas — título, ventana y porcentaje. **No sus productos**: esos se materializan contra el catálogo real |
| `pharmacy-campaigns.client.ts` | El cliente. Reglas puras exportadas (`estadoDe`, `revisar`, `ahorroDe`) para poder verificarlas sin instanciarlo |

## Decisiones que no se deducen leyendo el código

- **El porcentaje se deriva, no se guarda.** Lo que la farmacia fija son los dos precios;
  un porcentaje almacenado aparte se desincroniza en cuanto uno cambia. Así lo que se pinta
  es lo que ella puso, y no hay descuento inventado por redondeo.
- **`conDescuento` redondea hacia abajo.** Con 33 % sobre 10.00, al más cercano daría 6.70
  (33,0 %) y hacia abajo da 6.69 (33,1 %): quien lee «33 %» nunca paga peor que eso.
- **Los extremos de la vigencia son inclusivos.** Una campaña que termina hoy vale hoy.
- **Con dos campañas sobre el mismo producto gana el precio más bajo.**
- **El total del pedido no se reescribe.** El banner *muestra* el precio promocional; el
  total autoritativo es del backend. Bakearlo en `totalDe()` —el mock que FAR-E1 va a
  borrar— haría que el descuento desapareciera en silencio el día que llegue el backend. La
  regla para Ender está en `COORDINACION-AGENTES.md`.
- **Las campañas sembradas tienen id estable** (su URL abre siempre); las que crea la
  farmacia viven lo que vive la sesión. Sin `localStorage`: nada promete una durabilidad
  que el backend no da.
