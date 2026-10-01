import { isInsideSchedule, windowStatus } from './campaign-window';
import { fromCents, percentOffCents, toCents } from './promotion-money';
import type {
  CampaignScope,
  EvaluationContext,
  EvaluationResult,
  LineResult,
  Mechanic,
  Nudge,
  OrderDiscountResult,
  OrderLine,
  PromotionCampaign,
} from './promotion-mechanics.types';

/* ============================================================================
    Evaluación de un pedido contra un conjunto de campañas.

    Reglas que fijan los resultados (cada una tiene su test):

    1. Aritmética en centavos enteros; el redondeo favorece a quien compra.
    2. «Llevá X, pagá Y» cuenta **lotes enteros**: 3 unidades en un 2x1 regalan
       una, no una y media. Las bonificadas son las más baratas de cada lote.
    3. Un descuento nunca supera lo que se paga.
    4. **Un renglón pertenece a una sola campaña de ítem.** Las candidatas se
       ordenan por ahorro y se asignan de mayor a menor; una mecánica de varios
       renglones (combo, regalo) se aplica entera o no se aplica.
    5. Entre el nivel de ítem y el de total, se elige el escenario de mayor
       ahorro. Sumar los dos sólo es posible si todas las campañas involucradas
       son combinables, y el mínimo de compra se mide sobre lo ya rebajado.
    6. El tope de la campaña se aplica al final, sobre lo que esa campaña dio.
       Es una simplificación a propósito: el ranking usa el ahorro sin tope, así
       que una campaña topada puede ganar un renglón que, ya topada, valía
       menos que otra. Se prefiere previsible a óptimo.
    7. Un mínimo no alcanzado no descuenta: devuelve un aviso (`Nudge`) con lo
       que falta.
    ========================================================================== */

/** Un renglón ya validado, con el precio en centavos. */
interface PricedLine {
  readonly itemId: string;
  readonly quantity: number;
  readonly unitCents: number;
  readonly categoryId: string | null;
}

/** Lo que una campaña le descontaría al pedido, por ítem. */
interface Candidate {
  readonly campaignId: string;
  readonly stackable: boolean;
  /** Centavos de descuento por `itemId`. Sólo entradas mayores que cero. */
  readonly discounts: ReadonlyMap<string, number>;
}

/** Un descuento sobre el total del pedido, antes de elegir escenario. */
interface OrderCandidate {
  readonly campaignId: string;
  readonly stackable: boolean;
  readonly cents: number;
}

/** Una unidad suelta de un renglón, para repartir lotes entre ítems distintos. */
interface Unit {
  readonly itemId: string;
  readonly cents: number;
}

/**
 * Evalúa un pedido.
 *
 * Los renglones con precio ilegible o cantidad no positiva **se descartan**:
 * quien llama los valida antes. Los renglones repetidos del mismo ítem se
 * suman.
 */
export function evaluateOrder(
  campaigns: readonly PromotionCampaign[],
  orderLines: readonly OrderLine[],
  context: EvaluationContext,
): EvaluationResult {
  const lines = pricedLines(orderLines);
  const live = campaigns.filter((campaign) => isLive(campaign, context));
  const listSubtotal = lines.reduce((sum, line) => sum + line.unitCents * line.quantity, 0);

  const itemCandidates = live.flatMap((campaign) => itemCandidatesOf(campaign, lines));
  const picked = capped(assignToLines(itemCandidates), live);
  const scenario = chooseScenario(live, picked, listSubtotal);

  const itemDiscounts = scenario.useItems ? picked : new Map<string, PickedLine>();
  const itemSavings = sumOf(itemDiscounts);
  const payableBeforeOrder = listSubtotal - itemSavings;

  return {
    lines: lines.map((line) => lineResult(line, itemDiscounts.get(line.itemId))),
    orderDiscounts: scenario.order === null ? [] : [orderDiscountResult(scenario.order)],
    nudges: nudgesFor(live, lines, payableBeforeOrder),
    pointsMultiplier: pointsMultiplierOf(live),
    listSubtotal: fromCents(listSubtotal),
    totalDiscount: fromCents(itemSavings + (scenario.order?.cents ?? 0)),
    total: fromCents(payableBeforeOrder - (scenario.order?.cents ?? 0)),
  };
}

/* ─── Entrada ─────────────────────────────────────────────────────────────── */

function pricedLines(orderLines: readonly OrderLine[]): readonly PricedLine[] {
  const byItem = new Map<string, PricedLine>();
  for (const line of orderLines) {
    const unitCents = toCents(line.unitPrice);
    if (unitCents === null || !Number.isInteger(line.quantity) || line.quantity < 1) {
      continue;
    }
    const existing = byItem.get(line.itemId);
    byItem.set(line.itemId, {
      itemId: line.itemId,
      quantity: (existing?.quantity ?? 0) + line.quantity,
      unitCents: existing?.unitCents ?? unitCents,
      categoryId: existing?.categoryId ?? line.categoryId ?? null,
    });
  }
  return [...byItem.values()];
}

/** Vigencia en días completos, calendario semanal, franja horaria y cupón. */
function isLive(campaign: PromotionCampaign, context: EvaluationContext): boolean {
  if (windowStatus(campaign.from, campaign.to, context.now) !== 'LIVE') {
    return false;
  }
  if (!isInsideSchedule(campaign.conditions, context.now)) {
    return false;
  }
  const coupon = campaign.conditions.couponCode;
  if (coupon === null) {
    return true;
  }
  const typed = (context.couponCodes ?? []).map((code) => code.trim().toUpperCase());
  return typed.includes(coupon.trim().toUpperCase());
}

function inScope(scope: CampaignScope, line: PricedLine): boolean {
  return (
    scope.allItems ||
    scope.itemIds.includes(line.itemId) ||
    (line.categoryId !== null && scope.categoryIds.includes(line.categoryId))
  );
}

/* ─── Candidatas de ítem ──────────────────────────────────────────────────── */

/** Las mecánicas que descuentan sobre el total, no sobre ítems. */
function isOrderLevel(mechanic: Mechanic): boolean {
  return (
    mechanic.kind === 'ORDER_PERCENT_OVER' ||
    mechanic.kind === 'ORDER_AMOUNT_OVER' ||
    mechanic.kind === 'SPEND_TIERS' ||
    mechanic.kind === 'POINTS_MULTIPLIER'
  );
}

function itemCandidatesOf(
  campaign: PromotionCampaign,
  lines: readonly PricedLine[],
): readonly Candidate[] {
  const mechanic = campaign.mechanic;
  if (isOrderLevel(mechanic)) {
    return [];
  }
  const matching = lines.filter((line) => inScope(campaign.scope, line));
  const make = (discounts: Map<string, number>): readonly Candidate[] => {
    for (const [itemId, cents] of discounts) {
      if (cents <= 0) {
        discounts.delete(itemId);
      }
    }
    return discounts.size === 0
      ? []
      : [{ campaignId: campaign.id, stackable: campaign.conditions.stackable, discounts }];
  };
  const perLine = (discountOf: (line: PricedLine) => number): readonly Candidate[] =>
    matching.flatMap((line) => make(new Map([[line.itemId, discountOf(line)]])));

  switch (mechanic.kind) {
    case 'PERCENT_OFF':
    case 'CLEARANCE':
      return perLine((line) => percentOffCents(line.unitCents, mechanic.percent) * line.quantity);
    case 'AMOUNT_OFF_PER_UNIT': {
      const amount = toCents(mechanic.amount) ?? 0;
      return perLine((line) => Math.min(amount, line.unitCents) * line.quantity);
    }
    case 'CAMPAIGN_PRICE':
      return perLine((line) => {
        const price = toCents(mechanic.prices[line.itemId] ?? '');
        return price === null ? 0 : Math.max(0, line.unitCents - price) * line.quantity;
      });
    case 'BUY_X_PAY_Y':
      return make(freeUnits(matching, mechanic.take, mechanic.take - mechanic.pay, 100));
    case 'NTH_UNIT_PERCENT':
      return make(freeUnits(matching, mechanic.nth, 1, mechanic.percent));
    case 'VOLUME_TIERS':
      return make(volumeDiscounts(matching, mechanic.tiers));
    case 'BUNDLE_PRICE':
      return make(bundleDiscounts(lines, campaign.scope.itemIds, mechanic.bundlePrice));
    case 'GIFT_WITH_PURCHASE':
      return make(rewardDiscounts(lines, mechanic.triggerItemId, mechanic.rewardItemId, 100));
    case 'BUY_A_GET_B_PERCENT':
      return make(
        rewardDiscounts(lines, mechanic.triggerItemId, mechanic.rewardItemId, mechanic.percent),
      );
    case 'ORDER_PERCENT_OVER':
    case 'ORDER_AMOUNT_OVER':
    case 'SPEND_TIERS':
    case 'POINTS_MULTIPLIER':
      // Descuentan sobre el total, no sobre ítems: el guard de arriba ya las
      // sacó; el caso existe para que el compilador exija cubrir cada mecánica.
      return [];
  }
}

/** Las unidades sueltas de varios renglones, de la más cara a la más barata. */
function expandUnits(lines: readonly PricedLine[]): readonly Unit[] {
  return lines
    .flatMap((line) =>
      Array.from({ length: line.quantity }, () => ({ itemId: line.itemId, cents: line.unitCents })),
    )
    .sort((a, b) => b.cents - a.cents || a.itemId.localeCompare(b.itemId));
}

/**
 * Lotes enteros de `lotSize` unidades; en cada lote, las `perLot` últimas (las
 * más baratas) reciben `percent` de descuento.
 *
 * Con `percent = 100` es «llevá X, pagá Y»; con `perLot = 1` y otro porcentaje,
 * «la enésima unidad al N %». Un lote incompleto no descuenta nada.
 */
function freeUnits(
  lines: readonly PricedLine[],
  lotSize: number,
  perLot: number,
  percent: number,
): Map<string, number> {
  const units = expandUnits(lines);
  const discounts = new Map<string, number>();
  for (let start = 0; start + lotSize <= units.length; start += lotSize) {
    for (const unit of units.slice(start + lotSize - perLot, start + lotSize)) {
      discounts.set(unit.itemId, (discounts.get(unit.itemId) ?? 0) + percentOffCents(unit.cents, percent));
    }
  }
  return discounts;
}

/** El tramo más alto alcanzado por la cantidad total del alcance. */
function volumeDiscounts(
  lines: readonly PricedLine[],
  tiers: readonly { readonly minQuantity: number; readonly percent: number }[],
): Map<string, number> {
  const quantity = lines.reduce((sum, line) => sum + line.quantity, 0);
  const reached = [...tiers]
    .sort((a, b) => a.minQuantity - b.minQuantity)
    .filter((tier) => tier.minQuantity <= quantity)
    .pop();
  const discounts = new Map<string, number>();
  if (reached === undefined) {
    return discounts;
  }
  for (const line of lines) {
    discounts.set(line.itemId, percentOffCents(line.unitCents, reached.percent) * line.quantity);
  }
  return discounts;
}

/**
 * Un combo: una unidad de cada ítem a un precio conjunto, tantas veces como
 * alcance el ítem del que menos hay. El ahorro se reparte en proporción al
 * precio de cada ítem; el resto de la división se lo queda el primero, para que
 * la suma sea exacta.
 */
function bundleDiscounts(
  lines: readonly PricedLine[],
  bundleItemIds: readonly string[],
  bundlePrice: string,
): Map<string, number> {
  const discounts = new Map<string, number>();
  const members = [...bundleItemIds]
    .sort()
    .map((itemId) => lines.find((line) => line.itemId === itemId));
  const price = toCents(bundlePrice);
  if (price === null || members.length < 2 || members.some((member) => member === undefined)) {
    return discounts;
  }
  const present = members.filter((member): member is PricedLine => member !== undefined);
  const sets = Math.min(...present.map((member) => member.quantity));
  const listPerSet = present.reduce((sum, member) => sum + member.unitCents, 0);
  const savingPerSet = listPerSet - price;
  if (sets < 1 || savingPerSet <= 0) {
    return discounts;
  }
  const total = savingPerSet * sets;
  let assigned = 0;
  for (const member of present) {
    const share = Math.floor((total * member.unitCents) / listPerSet);
    discounts.set(member.itemId, share);
    assigned += share;
  }
  discounts.set(present[0].itemId, (discounts.get(present[0].itemId) ?? 0) + (total - assigned));
  return discounts;
}

/** «Comprando A, B de regalo / al N %»: tantas unidades de B como de A. */
function rewardDiscounts(
  lines: readonly PricedLine[],
  triggerItemId: string,
  rewardItemId: string,
  percent: number,
): Map<string, number> {
  const trigger = lines.find((line) => line.itemId === triggerItemId);
  const reward = lines.find((line) => line.itemId === rewardItemId);
  const discounts = new Map<string, number>();
  if (trigger === undefined || reward === undefined || triggerItemId === rewardItemId) {
    return discounts;
  }
  const units = Math.min(trigger.quantity, reward.quantity);
  discounts.set(rewardItemId, percentOffCents(reward.unitCents, percent) * units);
  return discounts;
}

/* ─── Asignación y tope ───────────────────────────────────────────────────── */

/** Lo que quedó asignado a un renglón. */
interface PickedLine {
  readonly campaignId: string;
  readonly stackable: boolean;
  readonly cents: number;
}

/**
 * Reparte los renglones entre las candidatas, de mayor a menor ahorro. Una
 * candidata se aplica si **ninguno** de sus renglones ya está tomado.
 */
function assignToLines(candidates: readonly Candidate[]): ReadonlyMap<string, PickedLine> {
  const total = (candidate: Candidate): number =>
    [...candidate.discounts.values()].reduce((sum, cents) => sum + cents, 0);
  const ranked = [...candidates].sort(
    (a, b) => total(b) - total(a) || a.campaignId.localeCompare(b.campaignId),
  );
  const taken = new Map<string, PickedLine>();
  for (const candidate of ranked) {
    const itemIds = [...candidate.discounts.keys()];
    if (itemIds.some((itemId) => taken.has(itemId))) {
      continue;
    }
    for (const [itemId, cents] of candidate.discounts) {
      taken.set(itemId, { campaignId: candidate.campaignId, stackable: candidate.stackable, cents });
    }
  }
  return taken;
}

/** Aplica el tope de cada campaña sobre lo que esa campaña dio, renglón a renglón. */
function capped(
  picked: ReadonlyMap<string, PickedLine>,
  campaigns: readonly PromotionCampaign[],
): ReadonlyMap<string, PickedLine> {
  const result = new Map(picked);
  for (const campaign of campaigns) {
    const cap = campaign.conditions.maxDiscount === null ? null : toCents(campaign.conditions.maxDiscount);
    if (cap === null) {
      continue;
    }
    let remaining = cap;
    const own = [...result.entries()]
      .filter(([, line]) => line.campaignId === campaign.id)
      .sort(([a], [b]) => a.localeCompare(b));
    for (const [itemId, line] of own) {
      const kept = Math.min(line.cents, remaining);
      remaining -= kept;
      result.set(itemId, { ...line, cents: kept });
    }
  }
  return result;
}

function sumOf(picked: ReadonlyMap<string, PickedLine>): number {
  return [...picked.values()].reduce((sum, line) => sum + line.cents, 0);
}

/* ─── Nivel de total y elección de escenario ──────────────────────────────── */

interface Scenario {
  readonly useItems: boolean;
  readonly order: OrderCandidate | null;
}

/**
 * Elige el escenario de mayor ahorro entre: sólo ítems, sólo total (medido
 * sobre el precio de lista) y los dos (el total medido sobre lo ya rebajado,
 * sólo si todas las campañas son combinables). En empate gana el más granular.
 */
function chooseScenario(
  campaigns: readonly PromotionCampaign[],
  picked: ReadonlyMap<string, PickedLine>,
  listSubtotal: number,
): Scenario {
  const itemSavings = sumOf(picked);
  const allStackable = [...picked.values()].every((line) => line.stackable);
  const afterItems = listSubtotal - itemSavings;

  const combinedOrder = allStackable ? bestOrder(campaigns, afterItems, true) : null;
  const orderOnly = bestOrder(campaigns, listSubtotal, false);

  const scenarios: readonly (Scenario & { readonly savings: number })[] = [
    { useItems: true, order: combinedOrder, savings: itemSavings + (combinedOrder?.cents ?? 0) },
    { useItems: true, order: null, savings: itemSavings },
    { useItems: false, order: orderOnly, savings: orderOnly?.cents ?? 0 },
  ];
  return scenarios.reduce((best, scenario) => (scenario.savings > best.savings ? scenario : best));
}

/** La campaña de total que más descuenta sobre `base`, o `null`. */
function bestOrder(
  campaigns: readonly PromotionCampaign[],
  base: number,
  onlyStackable: boolean,
): OrderCandidate | null {
  let best: OrderCandidate | null = null;
  for (const campaign of campaigns) {
    if (onlyStackable && !campaign.conditions.stackable) {
      continue;
    }
    const cents = orderDiscountCents(campaign, base);
    if (cents > 0 && (best === null || cents > best.cents)) {
      best = { campaignId: campaign.id, stackable: campaign.conditions.stackable, cents };
    }
  }
  return best;
}

/** Cuánto descuenta una campaña de total sobre `base`. Cero si no la alcanza. */
function orderDiscountCents(campaign: PromotionCampaign, base: number): number {
  const mechanic = campaign.mechanic;
  let cents: number;
  switch (mechanic.kind) {
    case 'ORDER_PERCENT_OVER':
      cents = reaches(mechanic.minSpend, base) ? percentOffCents(base, mechanic.percent) : 0;
      break;
    case 'ORDER_AMOUNT_OVER':
      cents = reaches(mechanic.minSpend, base) ? (toCents(mechanic.amount) ?? 0) : 0;
      break;
    case 'SPEND_TIERS': {
      const reached = mechanic.tiers
        .filter((tier) => reaches(tier.minSpend, base))
        .sort((a, b) => (toCents(a.minSpend) ?? 0) - (toCents(b.minSpend) ?? 0))
        .pop();
      cents = reached === undefined ? 0 : percentOffCents(base, reached.percent);
      break;
    }
    default:
      return 0;
  }
  const cap = campaign.conditions.maxDiscount === null ? null : toCents(campaign.conditions.maxDiscount);
  return Math.max(0, Math.min(cents, base, cap ?? Number.POSITIVE_INFINITY));
}

function reaches(minSpend: string, base: number): boolean {
  const minimum = toCents(minSpend);
  return minimum !== null && base >= minimum;
}

/* ─── Resultado ───────────────────────────────────────────────────────────── */

function lineResult(line: PricedLine, picked: PickedLine | undefined): LineResult {
  const listTotal = line.unitCents * line.quantity;
  const discount = picked?.cents ?? 0;
  return {
    itemId: line.itemId,
    quantity: line.quantity,
    unitPrice: fromCents(line.unitCents),
    listTotal: fromCents(listTotal),
    discount: fromCents(discount),
    total: fromCents(listTotal - discount),
    campaignId: discount > 0 ? (picked?.campaignId ?? null) : null,
  };
}

function orderDiscountResult(order: OrderCandidate): OrderDiscountResult {
  return { campaignId: order.campaignId, amount: fromCents(order.cents) };
}

function pointsMultiplierOf(campaigns: readonly PromotionCampaign[]): number | null {
  const multipliers = campaigns.flatMap((campaign) =>
    campaign.mechanic.kind === 'POINTS_MULTIPLIER' ? [campaign.mechanic.multiplier] : [],
  );
  return multipliers.length === 0 ? null : Math.max(...multipliers);
}

/* ─── Avisos: lo que le falta al pedido ───────────────────────────────────── */

function nudgesFor(
  campaigns: readonly PromotionCampaign[],
  lines: readonly PricedLine[],
  payable: number,
): readonly Nudge[] {
  return campaigns.flatMap((campaign) => [
    ...spendNudges(campaign, payable),
    ...unitNudges(campaign, lines),
  ]);
}

/** Avisa cuánto falta para el próximo umbral de gasto. */
function spendNudges(campaign: PromotionCampaign, payable: number): readonly Nudge[] {
  const mechanic = campaign.mechanic;
  if (payable <= 0) {
    return [];
  }
  const thresholds =
    mechanic.kind === 'SPEND_TIERS'
      ? mechanic.tiers.map((tier) => toCents(tier.minSpend))
      : mechanic.kind === 'ORDER_PERCENT_OVER' || mechanic.kind === 'ORDER_AMOUNT_OVER'
        ? [toCents(mechanic.minSpend)]
        : [];
  const next = thresholds
    .filter((threshold): threshold is number => threshold !== null && threshold > payable)
    .sort((a, b) => a - b)[0];
  return next === undefined
    ? []
    : [
        {
          kind: 'SPEND_MORE',
          campaignId: campaign.id,
          missingAmount: fromCents(next - payable),
          reward: mechanic,
        },
      ];
}

/**
 * Avisa cuántas unidades faltan para empezar a descontar. Sólo cuando ya hay
 * al menos una unidad del alcance: avisarle a quien no compró nada es ruido.
 */
function unitNudges(campaign: PromotionCampaign, lines: readonly PricedLine[]): readonly Nudge[] {
  const mechanic = campaign.mechanic;
  const units = lines
    .filter((line) => inScope(campaign.scope, line))
    .reduce((sum, line) => sum + line.quantity, 0);
  if (units < 1) {
    return [];
  }
  const target = nextUnitThreshold(mechanic, units);
  return target === null
    ? []
    : [{ kind: 'ADD_UNITS', campaignId: campaign.id, missingUnits: target - units, reward: mechanic }];
}

function nextUnitThreshold(mechanic: Mechanic, units: number): number | null {
  switch (mechanic.kind) {
    case 'BUY_X_PAY_Y':
      return units < mechanic.take ? mechanic.take : null;
    case 'NTH_UNIT_PERCENT':
      return units < mechanic.nth ? mechanic.nth : null;
    case 'VOLUME_TIERS':
      return (
        [...mechanic.tiers]
          .map((tier) => tier.minQuantity)
          .sort((a, b) => a - b)
          .find((minimum) => minimum > units) ?? null
      );
    default:
      return null;
  }
}
