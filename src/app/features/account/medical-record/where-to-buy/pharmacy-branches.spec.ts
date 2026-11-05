import type { MedicationRequest } from '../../../../core/data-access/clinical/clinical.types';
import {
  FIXTURE_IDS,
  MEDICATION_AVAILABILITY_FIXTURE,
} from '../../../../core/data-access/pharmacy/pharmacy.fixtures';
import type {
  MedicationAvailabilityResult,
  MedicationAvailabilitySite,
} from '../../../../core/data-access/pharmacy/pharmacy.types';
import { createOrderRequest } from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.adapter';
import {
  cartLinesFromDraft,
  evaluateBranches,
  orderDraftOf,
  rowsOfPrescription,
  splitByPublication,
  type PrescriptionItem,
} from './pharmacy-branches';

/** Una fila del resumen clínico, con lo mínimo que `rowsOfPrescription` mira. */
function row(id: string, encounterId?: string): MedicationRequest {
  return {
    id,
    medicationConceptId: `concepto-${id}`,
    statusConceptId: 'st-activa',
    createdAt: new Date('2026-03-01T10:30:00.000Z'),
    ...(encounterId === undefined ? {} : { encounterId }),
  };
}

/**
 * La receta elegida (FAR-03 · D-3): «Dónde comprar» toma sólo las filas del
 * mismo encuentro, porque el pedido viaja bajo un único `medicationRequestId`.
 */
describe('rowsOfPrescription (FAR-03 · D-3)', () => {
  it('de dos encuentros, devuelve sólo las filas del encuentro de la elegida', () => {
    const rows = [row('rx-a1', 'enc-a'), row('rx-b1', 'enc-b'), row('rx-a2', 'enc-a')];

    expect(rowsOfPrescription(rows, 'rx-a2').map((r) => r.id)).toEqual(['rx-a1', 'rx-a2']);
    expect(rowsOfPrescription(rows, 'rx-b1').map((r) => r.id)).toEqual(['rx-b1']);
  });

  it('una fila sin encuentro es una receta sola: no arrastra a las otras sin encuentro', () => {
    const rows = [row('rx-suelta'), row('rx-otra-suelta'), row('rx-a1', 'enc-a')];

    expect(rowsOfPrescription(rows, 'rx-suelta').map((r) => r.id)).toEqual(['rx-suelta']);
  });

  it('el encuentro en null (como lo serializa la API) tampoco junta fármacos sueltos', () => {
    // La API manda la clave con `null` cuando la columna está vacía; el tipo
    // del front la declara opcional, así que el doble la fuerza.
    const suelta = (id: string): MedicationRequest =>
      ({ ...row(id), encounterId: null }) as unknown as MedicationRequest;
    const rows = [suelta('rx-suelta'), suelta('rx-otra-suelta'), row('rx-a1', 'enc-a')];

    expect(rowsOfPrescription(rows, 'rx-suelta').map((r) => r.id)).toEqual(['rx-suelta']);
  });

  it('un id que no está en la lista no trae nada', () => {
    const rows = [row('rx-a1', 'enc-a'), row('rx-suelta')];

    expect(rowsOfPrescription(rows, 'rx-inexistente')).toEqual([]);
    expect(rowsOfPrescription([], 'rx-a1')).toEqual([]);
  });
});

/**
 * «Dónde comprar» con toda la red (B2 · H3-05): cada sede surte cada
 * medicamento con un producto suyo, y el pedido sale de la sede elegida con
 * ese producto — nunca con el de otra farmacia.
 */
describe('una receta de dos fármacos en farmacias distintas (B2 · H3-05)', () => {
  const [andinaFull, surPartial] = MEDICATION_AVAILABILITY_FIXTURE.items;
  const AMOXICILLIN = FIXTURE_IDS.conceptoAmoxicilina;
  const IBUPROFEN = FIXTURE_IDS.conceptoIbuprofeno;
  const SUR_IBUPROFEN = 'producto-ibuprofeno-del-sur';

  /** Andina sólo tiene amoxicilina; del Sur sólo ibuprofeno, con su propio producto. */
  const ANDINA: MedicationAvailabilitySite = {
    ...andinaFull!,
    complete: false,
    availableCount: 1,
    missingMedicationConceptIds: [IBUPROFEN],
    totalAmount: '68.00',
    products: andinaFull!.products.filter((product) => product.medicationConceptId === AMOXICILLIN),
  };
  const SUR: MedicationAvailabilitySite = {
    ...surPartial!,
    products: surPartial!.products.map((product) => ({ ...product, productId: SUR_IBUPROFEN })),
  };
  const RESPONSE: MedicationAvailabilityResult = {
    requestedMedicationConceptIds: [AMOXICILLIN, IBUPROFEN],
    unpublishedMedicationConceptIds: [],
    items: [ANDINA, SUR],
    count: 2,
  };
  const ITEMS: readonly PrescriptionItem[] = [
    { conceptId: AMOXICILLIN, medication: 'Amoxicilina', instructions: '', issued: true },
    { conceptId: IBUPROFEN, medication: 'Ibuprofeno', instructions: '', issued: true },
  ];

  it('cada sede se ve parcial y dice por nombre qué tiene y qué le falta', () => {
    const { branches, withoutProduct } = evaluateBranches(RESPONSE, ITEMS, new Set());

    expect(withoutProduct).toEqual([]);
    expect(branches.map((branch) => branch.complete)).toEqual([false, false]);
    expect(branches[0]?.missing).toEqual(['Ibuprofeno']);
    expect([...(branches[0]?.covers ?? [])]).toEqual([AMOXICILLIN]);
    expect(branches[1]?.missing).toEqual(['Amoxicilina']);
    expect([...(branches[1]?.covers ?? [])]).toEqual([IBUPROFEN]);
  });

  it('el pedido a la sede del Sur lleva el ibuprofeno del Sur, y la amoxicilina no viaja', () => {
    const draft = orderDraftOf('m-1', SUR, ITEMS, []);

    expect(draft.siteId).toBe(SUR.siteId);
    expect(draft.lineas.map((line) => [line.medicamento, line.productId, line.disponible])).toEqual(
      [
        ['Amoxicilina', null, false],
        ['Ibuprofeno', SUR_IBUPROFEN, true],
      ],
    );
    expect(draft.lineas[0]?.missingAtSite).toBe(true);

    const body = createOrderRequest(
      { borrador: draft, modalidad: 'RETIRO', direccionDeEntrega: null },
      'idem-sur',
    );
    // Ni el producto de Andina ni una línea sin producto: sólo lo de esta sede.
    expect(body.lines).toEqual([{ productId: SUR_IBUPROFEN, quantity: 1 }]);
    expect(body.siteId).toBe(SUR.siteId);
  });

  it('el pedido a Andina lleva su amoxicilina y nunca el producto de otra farmacia', () => {
    const draft = orderDraftOf('m-1', ANDINA, ITEMS, []);
    const body = createOrderRequest(
      { borrador: draft, modalidad: 'RETIRO', direccionDeEntrega: null },
      'idem-andina',
    );

    expect(body.lines).toEqual([{ productId: FIXTURE_IDS.productoAmoxicilina, quantity: 1 }]);
  });

  it('al carrito va lo de la sede; lo que le falta vuelve por su nombre', () => {
    const { lines, omitted } = cartLinesFromDraft(orderDraftOf('m-1', SUR, ITEMS, []));

    expect(lines.map((line) => line.productId)).toEqual([SUR_IBUPROFEN]);
    expect(omitted).toEqual(['Amoxicilina']);
  });

  it('lo que ninguna farmacia de la red publica se dice aparte y nadie queda completo', () => {
    const { branches, withoutProduct, withoutProductConceptIds } = evaluateBranches(
      { ...RESPONSE, items: [andinaFull!], unpublishedMedicationConceptIds: [IBUPROFEN] },
      ITEMS,
      new Set(),
    );

    expect(withoutProduct).toEqual(['Ibuprofeno']);
    expect(withoutProductConceptIds).toEqual([IBUPROFEN]);
    expect(branches[0]?.complete).toBe(false);
    // Una línea sin producto publicado sí bloquea el pedido: la API no la acepta.
    const draft = orderDraftOf(
      'm-1',
      andinaFull!,
      splitByPublication({ unpublishedMedicationConceptIds: [IBUPROFEN] }, ITEMS).queryable,
      withoutProduct,
    );
    expect(() =>
      createOrderRequest(
        { borrador: draft, modalidad: 'RETIRO', direccionDeEntrega: null },
        'idem-x',
      ),
    ).toThrow();
  });
});
