import { describe, expect, it } from 'vitest';

import type { Condition } from '../../../../core/data-access/clinical/clinical.types';
import type { DiagnosticOrder } from '../../../../core/data-access/diagnostics/diagnostics.types';
import type { Referral } from '../../../../core/data-access/referrals/referrals.types';
import { ENTRADA_DE_ALERTAS_DEMO } from './red-clinica.demo';
import {
  alertasDeApoyo,
  antiguedad,
  derivacionesAbiertas,
  diagnosticosRepetidos,
  diasEntre,
  estudiosSinResultado,
  motivosRepetidos,
  nodosAlertados,
  presuntivosSinResolver,
  resultadosFueraDeRango,
  type EntradaDeAlertas,
} from './red-clinica-alertas';

const ahora = new Date(2026, 10, 6, 10);
const haceDias = (n: number) => new Date(ahora.getTime() - n * 24 * 60 * 60 * 1000);
const codigos: Record<string, string> = {
  prov: 'COND_PROVISIONAL',
  conf: 'COND_CONFIRMED',
  ref: 'clinical:CONDITION_REFUTED',
  act: 'COND_ACTIVE',
  cancel: 'SR_CANCELLED',
  activa: 'SR_ACTIVE',
};
const base: EntradaDeAlertas = {
  ahora,
  codigoDe: (id) => (id === undefined ? undefined : codigos[id]),
  etiquetaDe: (id) => (id === undefined ? undefined : `Concepto ${id}`),
};
const condicion = (parcial: Partial<Condition> & { id: string }): Condition => ({
  codeConceptId: 'c',
  createdAt: haceDias(5),
  verificationStatusConceptId: 'prov',
  ...parcial,
});
const orden = (parcial: Partial<DiagnosticOrder> & { id: string }): DiagnosticOrder => ({
  patientProfileId: 'p',
  codeConceptId: 'lab',
  statusConceptId: 'activa',
  createdAt: haceDias(3),
  ...parcial,
});
const derivacion = (parcial: Partial<Referral> & { id: string }): Referral => ({
  patientProfileId: 'p',
  statusConceptId: 'x',
  createdAt: haceDias(10),
  ...parcial,
});

/** Ninguna alerta afirma ni sugiere un diagnóstico. */
const PALABRAS_PROHIBIDAS = /posible|probable|compatible con|sugiere|sospecha de|\bdescartar\b|considerar el diagn/i;

describe('utilidades', () => {
  it('días completos, nunca negativos', () => {
    expect(diasEntre(haceDias(3), ahora)).toBe(3);
    expect(diasEntre(new Date(ahora.getTime() + 1e9), ahora)).toBe(0);
  });

  it('antigüedad en palabras', () => {
    expect(antiguedad(0)).toBe('hoy');
    expect(antiguedad(1)).toBe('hace 1 día');
    expect(antiguedad(45)).toBe('hace 45 días');
    expect(antiguedad(95)).toBe('hace 3 meses');
  });
});

describe('presuntivosSinResolver', () => {
  it('avisa del presuntivo con su antigüedad, y sube la prioridad con el plazo', () => {
    const alertas = presuntivosSinResolver({
      ...base,
      diagnosticos: [
        condicion({ id: 'a', createdAt: haceDias(3) }),
        condicion({ id: 'b', createdAt: haceDias(20) }),
        condicion({ id: 'c', createdAt: haceDias(50) }),
      ],
    });
    expect(alertas.map((a) => [a.nodoId, a.prioridad, a.dias])).toEqual([
      ['a', 'baja', 3],
      ['b', 'media', 20],
      ['c', 'alta', 50],
    ]);
    expect(alertas[1].titulo).toBe('Presuntivo sin resolver: Concepto c');
    expect(alertas[1].detalle).toContain('hace 20 días');
    expect(alertas[1].detalle).toContain('Sin estudios pedidos');
  });

  it('no avisa de confirmados, descartados (por catálogo o por C3), resueltos ni reemplazados', () => {
    const alertas = presuntivosSinResolver({
      ...base,
      diagnosticos: [
        condicion({ id: 'conf', verificationStatusConceptId: 'conf' }),
        condicion({ id: 'ref', verificationStatusConceptId: 'ref' }),
        condicion({
          id: 'c3',
          verification: { outcome: 'CONFIRMED', decidedAt: '', decidedByProfileId: 'x', reasonText: null, basedOn: null },
        }),
        condicion({ id: 'res', resolvedAt: haceDias(1) }),
        { ...condicion({ id: 'rep' }), ...{ replacedByConditionId: 'conf' } },
      ],
    });
    expect(alertas).toEqual([]);
  });

  it('cuenta y resalta los estudios pedidos para resolverlo (reasonConditionId, tolerante)', () => {
    const alertas = presuntivosSinResolver({
      ...base,
      diagnosticos: [condicion({ id: 'dx' })],
      ordenes: [
        { ...orden({ id: 'o1' }), ...{ reasonConditionId: 'dx' } },
        orden({ id: 'o2' }),
      ],
    });
    expect(alertas[0].nodoIds).toEqual(['dx', 'o1']);
    expect(alertas[0].detalle).toContain('1 estudio pedido para resolverlo');
  });

  it('respeta los umbrales y el mapeo de ids de nodo', () => {
    const [alerta] = presuntivosSinResolver({
      ...base,
      umbrales: { presuntivoDias: 2 },
      idDeNodo: (tipo, id) => `${tipo}:${id}`,
      diagnosticos: [condicion({ id: 'a', createdAt: haceDias(3) })],
    });
    expect(alerta.prioridad).toBe('media');
    expect(alerta.nodoId).toBe('diagnostico:a');
  });

  it('sin resolver de códigos, un diagnóstico sin decisión cuenta como en estudio', () => {
    const alertas = presuntivosSinResolver({ ahora, diagnosticos: [condicion({ id: 'a' })] });
    expect(alertas[0].titulo).toBe('Presuntivo sin resolver: Diagnóstico presuntivo');
  });
});

describe('estudiosSinResultado', () => {
  it('avisa de la orden sin informe liberado', () => {
    const alertas = estudiosSinResultado({
      ...base,
      ordenes: [orden({ id: 'o1', createdAt: haceDias(9) })],
    });
    expect(alertas).toHaveLength(1);
    expect(alertas[0].prioridad).toBe('media');
    expect(alertas[0].detalle).toContain('hace 9 días');
    expect(alertas[0].detalle).toContain('Aún no hay informe');
  });

  it('distingue el informe en redacción del liberado', () => {
    const informe = {
      id: 'i',
      patientProfileId: 'p',
      serviceRequestId: 'o1',
      codeConceptId: 'lab',
      lifecycleStatusConceptId: 'x',
      createdAt: haceDias(1),
    };
    const enRedaccion = estudiosSinResultado({
      ...base,
      ordenes: [orden({ id: 'o1' })],
      informes: [{ ...informe, currentVersionId: 'v1' }],
    });
    expect(enRedaccion[0].detalle).toContain('en redacción');
    const liberado = estudiosSinResultado({
      ...base,
      ordenes: [orden({ id: 'o1' })],
      informes: [{ ...informe, currentVersionId: 'v1', currentReleasedVersionId: 'v1' }],
    });
    expect(liberado).toEqual([]);
  });

  it('no avisa de la orden cancelada ni de la satisfecha por un informe previo', () => {
    expect(
      estudiosSinResultado({
        ...base,
        ordenes: [
          orden({ id: 'o1', statusConceptId: 'cancel' }),
          orden({ id: 'o2', previousDiagnosticReportId: 'inf-viejo' }),
        ],
      }),
    ).toEqual([]);
  });

  it('resalta también el diagnóstico para el que se pidió', () => {
    const [alerta] = estudiosSinResultado({
      ...base,
      ordenes: [{ ...orden({ id: 'o1' }), ...{ reasonConditionId: 'dx' } }],
    });
    expect(alerta.nodoIds).toEqual(['o1', 'dx']);
  });
});

describe('derivacionesAbiertas', () => {
  it('pendiente → sin respuesta, con días', () => {
    const [alerta] = derivacionesAbiertas({
      ...base,
      derivaciones: [derivacion({ id: 'r', status: 'PENDING', targetDisplayName: 'Cardiología', createdAt: haceDias(8) })],
    });
    expect(alerta.tipo).toBe('derivacion-sin-respuesta');
    expect(alerta.titulo).toBe('Derivación sin respuesta de Cardiología');
    expect(alerta.prioridad).toBe('media');
  });

  it('sin estado legible y sin respuesta fechada también cuenta como sin respuesta', () => {
    const alertas = derivacionesAbiertas({ ...base, derivaciones: [derivacion({ id: 'r' })] });
    expect(alertas[0].tipo).toBe('derivacion-sin-respuesta');
    expect(alertas[0].titulo).toContain('el destino');
  });

  it('aceptada con llegada y sin contrarreferencia, pasado el plazo', () => {
    const [alerta] = derivacionesAbiertas({
      ...base,
      derivaciones: [
        {
          ...derivacion({ id: 'r', status: 'ACCEPTED', respondedAt: haceDias(40), transfer: { arrivedAt: haceDias(30) } }),
          ...{ targetEncounterId: 'enc-destino' },
        },
      ],
    });
    expect(alerta.tipo).toBe('derivacion-sin-contrarreferencia');
    expect(alerta.detalle).toContain('llegó hace 30 días');
    expect(alerta.nodoIds).toEqual(['r', 'enc-destino']);
    expect(alerta.prioridad).toBe('media');
  });

  it('no avisa antes del plazo, con contrarreferencia, rechazada o cancelada', () => {
    expect(
      derivacionesAbiertas({
        ...base,
        derivaciones: [
          derivacion({ id: 'a', status: 'ACCEPTED', respondedAt: haceDias(3) }),
          derivacion({ id: 'b', status: 'COMPLETED', respondedAt: haceDias(60), counterReferralText: 'Control en 6 meses.' }),
          derivacion({ id: 'c', status: 'REJECTED' }),
          derivacion({ id: 'd', status: 'CANCELLED' }),
          derivacion({ id: 'e', status: 'ACCEPTED' }),
        ],
      }),
    ).toEqual([]);
  });
});

describe('repeticiones', () => {
  it('el mismo diagnóstico registrado dos veces', () => {
    const [alerta] = diagnosticosRepetidos({
      ...base,
      diagnosticos: [
        condicion({ id: 'x2', codeConceptId: 'migr', createdAt: haceDias(2) }),
        condicion({ id: 'x1', codeConceptId: 'migr', createdAt: haceDias(90) }),
        condicion({ id: 'y', codeConceptId: 'otro' }),
      ],
    });
    expect(alerta.titulo).toBe('Diagnóstico registrado 2 veces: Concepto migr');
    expect(alerta.nodoIds).toEqual(['x1', 'x2']);
    expect(alerta.nodoId).toBe('x2');
  });

  it('el mismo motivo de consulta, sin importar mayúsculas, tildes ni el punto final', () => {
    const alertas = motivosRepetidos({
      ...base,
      atenciones: [
        { id: 'e1', statusConceptId: 's', reasonText: 'Cefalea', startAt: haceDias(60) },
        { id: 'e2', statusConceptId: 's', reasonText: 'cefaléa.', startAt: haceDias(30) },
        { id: 'e3', statusConceptId: 's', reasonText: 'Control', startAt: haceDias(1) },
        { id: 'e4', statusConceptId: 's' },
      ],
    });
    expect(alertas).toHaveLength(1);
    expect(alertas[0].nodoIds).toEqual(['e1', 'e2']);
    expect(alertas[0].titulo).toContain('2 veces');
  });

  it('el umbral de repeticiones se puede subir', () => {
    expect(
      motivosRepetidos({
        ...base,
        umbrales: { repeticiones: 3 },
        atenciones: [
          { id: 'e1', statusConceptId: 's', reasonText: 'Tos' },
          { id: 'e2', statusConceptId: 's', reasonText: 'Tos' },
        ],
      }),
    ).toEqual([]);
  });
});

describe('resultadosFueraDeRango', () => {
  it('lista hasta tres valores con su referencia y cuenta el resto', () => {
    const [alerta] = resultadosFueraDeRango({
      ...base,
      resultados: [
        {
          nodoId: 'e',
          estudio: 'Perfil',
          valores: [
            { nombre: 'A', valor: 10, rango: { alto: 5 } },
            { nombre: 'B', valor: 10, rango: { alto: 5 } },
            { nombre: 'C', valor: 10, rango: { alto: 5 } },
            { nombre: 'D', valor: 10, rango: { alto: 5 }, unidad: 'u' },
            { nombre: 'E', valor: 1, rango: { alto: 5 } },
          ],
        },
      ],
    });
    expect(alerta.titulo).toBe('4 valores fuera del rango de referencia en Perfil');
    expect(alerta.detalle).toBe('A 10 (referencia ≤ 5); B 10 (referencia ≤ 5); C 10 (referencia ≤ 5); y 1 más.');
    expect(alerta.prioridad).toBe('media');
  });

  it('un valor crítico sube a prioridad alta', () => {
    const [alerta] = resultadosFueraDeRango({
      ...base,
      resultados: [{ nodoId: 'e', estudio: 'Ionograma', valores: [{ nombre: 'K', valor: 6.9, interpretacion: 'critico-alto' }] }],
    });
    expect(alerta.tipo).toBe('resultado-critico');
    expect(alerta.prioridad).toBe('alta');
  });

  it('sin valores fuera de rango no hay alerta', () => {
    expect(
      resultadosFueraDeRango({ ...base, resultados: [{ nodoId: 'e', estudio: 'x', valores: [{ nombre: 'a', valor: 1 }] }] }),
    ).toEqual([]);
  });
});

describe('alertasDeApoyo sobre la historia de demostración', () => {
  const alertas = alertasDeApoyo(ENTRADA_DE_ALERTAS_DEMO);

  it('encuentra lo que quedó abierto, y nada más', () => {
    expect(alertas.map((a) => a.id)).toEqual([
      'presuntivo-sin-resolver:dx3',
      'estudio-sin-resultado:e3',
      'derivacion-sin-respuesta:d2',
      'resultado-fuera-de-rango:e1',
      'resultado-fuera-de-rango:e2',
      'derivacion-sin-contrarreferencia:d1',
      'motivo-repetido:cefalea persistente',
    ]);
  });

  it('ordena por prioridad', () => {
    const peso = { alta: 0, media: 1, baja: 2 };
    const pesos = alertas.map((a) => peso[a.prioridad]);
    expect([...pesos].sort((a, b) => a - b)).toEqual(pesos);
  });

  it('ninguna alerta afirma ni sugiere un diagnóstico', () => {
    for (const a of alertas) {
      expect(`${a.titulo} ${a.detalle}`).not.toMatch(PALABRAS_PROHIBIDAS);
    }
  });

  it('cada alerta lleva a un nodo que está entre los que resalta', () => {
    for (const a of alertas) expect(a.nodoIds).toContain(a.nodoId);
    expect(nodosAlertados(alertas).has('a3')).toBe(true);
  });

  it('sin datos, sin alertas', () => {
    expect(alertasDeApoyo({ ahora })).toEqual([]);
  });
});
