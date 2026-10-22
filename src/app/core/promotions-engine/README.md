# Motor de promociones

Las mecánicas de una campaña —qué descuenta, sobre qué, con qué condiciones— y la forma
de calcular lo que vale un pedido. **No sabe de farmacias**: razona sobre `PromotableItem`
(id, nombre, precio, moneda). Una farmacia mapea productos; una clínica mapearía servicios;
un laboratorio, estudios.

Sin Angular, sin HTTP, sin estado: son funciones puras, por eso se prueban solas.

## Piezas

| Archivo | Qué hace |
|---|---|
| `promotion-mechanics.types.ts` | Los contratos. `Mechanic` es una unión discriminada: cada `kind` lleva sus campos y nada más |
| `promotion-money.ts` | Aritmética en centavos enteros; el redondeo favorece a quien compra |
| `campaign-window.ts` | Vigencia en días completos (extremos inclusivos), días de la semana y franja horaria |
| `validate-draft.ts` | `validateDraft()` → todos los fallos juntos, uno por causa |
| `evaluate-order.ts` | `evaluateOrder()` → qué descuenta cada campaña en un pedido, y qué le falta para alcanzar otra |
| `describe-mechanic.ts` | **La única fuente de prosa**: badge, oración y avisos. Panel, ficha, pedido y «Mis promociones» llaman acá |
| `mechanic-catalog.ts` | Las 14 mecánicas por familia, con etiqueta, ayuda y ejemplo |

## Las 14 mecánicas

| Familia | Mecánica | Cómo la lee el paciente | Modelo 51 |
|---|---|---|---|
| Precio | `PERCENT_OFF` | 20 % menos | `DISC_PERCENT` · sobre ítems |
| | `CAMPAIGN_PRICE` | Antes 45 · ahora 38 | `DISC_FIXED` por ítem |
| | `AMOUNT_OFF_PER_UNIT` | Bs 10 menos en cada unidad | `DISC_FIXED` · ITEM |
| | `CLEARANCE` | Vencimiento cercano: 35 % menos | `DISC_PERCENT` con etiqueta propia |
| Cantidad | `BUY_X_PAY_Y` | 2x1 · 3x2 | `DISC_BOGO` |
| | `NTH_UNIT_PERCENT` | La segunda unidad al 50 % | `DISC_BOGO` + `percentage` — **semántica por definir** |
| | `VOLUME_TIERS` | 2 u: 10 % · 3 o más: 15 % | **falta umbral por cantidad** |
| Total | `ORDER_PERCENT_OVER` | 10 % si tu compra llega a Bs 200 | `DISC_PERCENT` · ORDER · `min_purchase_amount` |
| | `ORDER_AMOUNT_OVER` | Bs 30 menos desde Bs 250 | `DISC_FIXED` · ORDER · `min_purchase_amount` |
| | `SPEND_TIERS` | Desde Bs 100: 5 % · desde Bs 200: 10 % | varias `discount_rules` ORDER |
| Combos | `BUNDLE_PRICE` | Combo A + B a Bs 60 | **la relación entre productos no está modelada** |
| | `GIFT_WITH_PURCHASE` | Comprando A, B de regalo | idem |
| | `BUY_A_GET_B_PERCENT` | Comprando A, B al 30 % | idem |
| Fidelización | `POINTS_MULTIPLIER` | Puntos ×2 | `earning_rules` + `condition_json` |

`modelSupport` en `mechanic-catalog.ts` dice, por mecánica, si el backend ya la calcula
(`MODELED`), si el modelo tiene las columnas pero la API no las lee (`PENDING_API`) o si
falta definición (`PENDING_MODEL`). **Hoy ninguna mecánica por producto está soportada**:
`discount_rules.target_filter_json` se persiste y nadie lo lee. Por eso todo esto vive en
la maqueta con gate de demo.

## Reglas de evaluación

1. Centavos enteros; el redondeo favorece a quien compra («33 %» nunca cuesta más).
2. «Llevá X, pagá Y» cuenta **lotes enteros**: 3 unidades en un 2x1 regalan una. Lo gratis es
   lo más barato de cada lote.
3. Un descuento nunca supera lo que se paga.
4. **Un renglón pertenece a una sola campaña de ítem**: gana la de mayor ahorro. Un combo o un
   regalo se aplica entero o no se aplica.
5. Entre ítem y total gana el escenario de mayor ahorro (empate: ítems). Sumarlos exige que
   todas las campañas sean combinables, y el mínimo se mide sobre lo ya rebajado.
6. El tope se aplica sobre lo que dio esa campaña, al final. El ranking usa el ahorro sin
   tope: una simplificación a propósito, previsible antes que óptima.
7. Un mínimo no alcanzado no descuenta: devuelve un `Nudge` («Te faltan Bs 23 para…»).

## Lo que el motor NO hace

- **No hace cumplir** `perPersonLimit`, `availableUnits` ni `budget`: necesitan el historial de
  canjes (`redemptions`), que es del backend. Se guardan y se muestran.
- **No segmenta por diagnóstico.** Prohibido sin consentimiento; ver el README de
  `data-access/pharmacy-campaigns/`.
- **No conoce envío ni medio de pago.** La farmacia no tiene envío (solo retiro) y el pedido no
  trae medio de pago.

## Cómo lo adopta otra organización

1. Mapear lo que vende a `PromotableItem` (`itemId`, `label`, `unitPrice`, `currency`).
2. Guardar `PromotionCampaign` donde le corresponda (hoy, en memoria).
3. `validateDraft()` antes de publicar y `evaluateOrder()` al armar el pedido.
4. Pintar con `describeMechanic()` / `describeNudge()`: no escribir prosa propia.

## Bug conocido en la API (no se toca acá)

`promotions-discounts.service.ts` calcula `BOGO` como `importe × get / (buy + get)`: prorratea
sobre el importe en vez de contar lotes enteros. Con una unidad en un 2x1 daría 50 % de
descuento. Este motor cuenta lotes; cuando se conecte el backend hay que corregir la API, no
este motor.
