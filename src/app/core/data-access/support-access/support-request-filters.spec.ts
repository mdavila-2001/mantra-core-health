import { ageBucketOf, countByView, effectiveStatus, filterRequests, isExpired, isUrgent, requesters } from './support-request-filters';
import type { SupportEngagementRequest } from './support-access.types';

const AHORA = new Date('2026-10-30T12:00:00Z');
const hace = (dias: number): string => new Date(AHORA.getTime() - dias * 86_400_000).toISOString();

function solicitud(id: string, over: Partial<SupportEngagementRequest> & { creadaHaceDias: number }): SupportEngagementRequest {
  const { creadaHaceDias, ...resto } = over;
  return {
    id,
    tenantId: 't',
    organizationName: 'H',
    requesterUserId: `u-${id}`,
    requesterName: `Persona ${id}`,
    direction: 'REQUEST',
    roleTemplate: 'SECRETARY',
    status: 'PENDING',
    createdAt: hace(creadaHaceDias),
    expiresAt: hace(creadaHaceDias - 15),
    items: [],
    ...resto,
  };
}

const LISTA = [
  solicitud('a', { creadaHaceDias: 1 }),
  solicitud('b', { creadaHaceDias: 5, roleTemplate: 'NURSING' }),
  solicitud('c', { creadaHaceDias: 13 }),
  solicitud('d', { creadaHaceDias: 20, status: 'EXPIRED' }),
  solicitud('e', { creadaHaceDias: 30, status: 'REJECTED', roleTemplate: 'CALL_CENTER' }),
  // La API todavía no la barrió, pero ya pasó su plazo.
  solicitud('f', { creadaHaceDias: 17 }),
];

describe('antigüedad', () => {
  it('reparte por tramos desde que se envió', () => {
    expect(LISTA.map((r) => ageBucketOf(r, AHORA))).toEqual(['LT3', 'D3_7', 'D8_14', 'GE15', 'GE15', 'GE15']);
  });
});

describe('vencidas y urgentes', () => {
  it('una pendiente pasada de plazo es vencida aunque la API no la haya marcado', () => {
    expect(isExpired(LISTA[5]!, AHORA)).toBe(true);
    expect(effectiveStatus(LISTA[5]!, AHORA)).toBe('EXPIRED');
    expect(effectiveStatus(LISTA[4]!, AHORA)).toBe('REJECTED');
  });

  it('urgente es la pendiente que vence en tres días o menos; nunca una vencida ni una resuelta', () => {
    expect(isUrgent(LISTA[2]!, AHORA)).toBe(true);
    expect(isUrgent(LISTA[0]!, AHORA)).toBe(false);
    expect(isUrgent(LISTA[5]!, AHORA)).toBe(false);
    expect(isUrgent(LISTA[4]!, AHORA)).toBe(false);
  });
});

describe('filterRequests', () => {
  const ids = (f: Parameters<typeof filterRequests>[1]): string[] => filterRequests(LISTA, f, AHORA).map((r) => r.id);

  it('sin filtros devuelve todo', () => expect(ids({})).toEqual(['a', 'b', 'c', 'd', 'e', 'f']));
  it('por persona', () => expect(ids({ person: 'u-b' })).toEqual(['b']));
  it('por rol', () => expect(ids({ role: 'NURSING' })).toEqual(['b']));
  it('por estado usa el efectivo: «vencida» incluye la que la API no barrió', () => {
    expect(ids({ status: 'EXPIRED' })).toEqual(['d', 'f']);
    expect(ids({ status: 'PENDING' })).toEqual(['a', 'b', 'c']);
  });
  it('por antigüedad', () => expect(ids({ age: 'GE15' })).toEqual(['d', 'e', 'f']));
  it('los filtros se combinan', () => expect(ids({ age: 'GE15', status: 'REJECTED' })).toEqual(['e']));
});

describe('apoyos de la bandeja', () => {
  it('lista a las personas sin repetir y por orden alfabético', () => {
    expect(requesters([...LISTA, solicitud('a', { creadaHaceDias: 9 })]).map((p) => p.name)).toEqual(['Persona a', 'Persona b', 'Persona c', 'Persona d', 'Persona e', 'Persona f']);
  });

  it('cuenta pendientes y resueltas con el estado efectivo', () => {
    expect(countByView(LISTA, AHORA)).toEqual({ pending: 3, resolved: 3 });
  });
});
