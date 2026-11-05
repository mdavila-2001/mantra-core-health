import { HttpHeaders } from '@angular/common/http';

import type {
  MyUiVisibility,
  UiElement,
  UiElementSyncResult,
  UiPreview,
  UiVisibilityPage,
  UiVisibilityRule,
} from '../../data-access/ui-visibility/ui-visibility.types';
import { MockRouter, isMockReply, type MockMethod, type MockRequest } from '../mock-router';
import { buscarUsuario, type MockUser } from '../mock-session';
import { SUJETOS_DE_LA_SEMILLA, registrarVisibilidad, reiniciarVisibilidad } from './ui-visibility.handlers';
import { reglaVigente, resolverVisibilidad, type SujetoDeResolucion } from './ui-visibility.resolver';

const router = new MockRouter();
registrarVisibilidad(router);

const admin = buscarUsuario('superadmin')!;
const farmacia = buscarUsuario('farmacia')!;
const aseguradora = buscarUsuario('aseguradora')!;
const paciente = buscarUsuario('paciente')!;

interface Pedido {
  readonly query?: Record<string, string>;
  readonly body?: unknown;
  readonly headers?: Record<string, string>;
  readonly user?: MockUser | null;
}

function llamar(method: MockMethod, path: string, o: Pedido = {}) {
  const match = router.match(method, path);
  if (match === null) throw new Error(`No existe ${method} ${path}`);
  return match.handler({
    method,
    path,
    params: match.params,
    query: new URLSearchParams(o.query ?? {}),
    body: o.body ?? null,
    headers: new HttpHeaders(o.headers ?? {}),
    user: o.user === undefined ? admin : o.user,
  } satisfies MockRequest);
}

const estado = (r: unknown): number => (isMockReply(r) ? r.status : 200);
const cuerpo = <T>(r: unknown): T => (isMockReply(r) ? r.body : r) as T;
const razon = (r: unknown): string | undefined => (cuerpo<{ reason?: string }>(r)).reason;
const campos = (r: unknown): string[] =>
  (cuerpo<{ details?: { fields?: { field: string }[] } }>(r).details?.fields ?? []).map((f) => f.field);

const REGLA_VALIDA = {
  elementKey: 'pharmacy.orders.patient-phone',
  effect: 'HIDE',
  subjectType: 'ROLE',
  subjectId: 'DPO',
  reason: 'Se oculta el teléfono a quien no lo necesita.',
};

beforeEach(() => reiniciarVisibilidad());

describe('visibilidad simulada: el resolutor del contrato', () => {
  const ahora = new Date('2026-10-31T12:00:00.000Z');
  const el = (key: string, parentKey: string | null = null, extra: Partial<UiElement> = {}): UiElement => ({
    id: key,
    key,
    kind: 'SCREEN',
    moduleCode: key.split('.')[0]!,
    parentKey,
    label: key,
    description: null,
    defaultVisible: true,
    source: 'CODE',
    status: 'ACTIVE',
    activeRuleCount: 0,
    ...extra,
  });
  let n = 0;
  const rg = (r: Partial<UiVisibilityRule> & Pick<UiVisibilityRule, 'elementKey' | 'effect' | 'subjectType'>): UiVisibilityRule => ({
    id: `r${++n}`,
    subjectId: r.subjectType === 'ALL' ? null : 'x',
    subjectLabel: null,
    validFrom: null,
    validTo: null,
    reason: 'motivo de prueba',
    version: 1,
    createdAt: '2026-10-01T00:00:00.000Z',
    createdByLabel: null,
    ...r,
  });
  const sujeto: SujetoDeResolucion = { userId: 'u1', tenantIds: ['t1'], roleCodes: ['A', 'B'], orgTypes: ['PAYER'] };
  const unico = (elementos: UiElement[], reglas: UiVisibilityRule[], s = sujeto) =>
    Object.fromEntries(resolverVisibilidad(elementos, reglas, s, ahora).map((e) => [e.elementKey, e]));

  it('correcto: sin regla gana defaultVisible, y un defaultVisible=false nace oculto', () => {
    const r = unico([el('m.a'), el('m.b', null, { defaultVisible: false })], []);
    expect(r['m.a']).toMatchObject({ hidden: false, reason: 'DEFAULT', winningRuleId: null });
    expect(r['m.b']).toMatchObject({ hidden: true, reason: 'DEFAULT', winningRuleId: null });
  });

  it('especificidad: USER > TENANT > ROLE > ORG_TYPE > ALL, cada escalón le gana al de abajo', () => {
    const tipos = ['USER', 'TENANT', 'ROLE', 'ORG_TYPE', 'ALL'] as const;
    const ids = { USER: 'u1', TENANT: 't1', ROLE: 'A', ORG_TYPE: 'PAYER', ALL: null };
    for (let i = 0; i < tipos.length - 1; i++) {
      const alta = rg({ elementKey: 'm.a', effect: 'SHOW', subjectType: tipos[i]!, subjectId: ids[tipos[i]!] });
      const baja = rg({ elementKey: 'm.a', effect: 'HIDE', subjectType: tipos[i + 1]!, subjectId: ids[tipos[i + 1]!] });
      const r = unico([el('m.a')], [baja, alta]);
      expect(r['m.a'], `${tipos[i]} contra ${tipos[i + 1]}`).toMatchObject({ hidden: false, winningRuleId: alta.id });
    }
  });

  it('límite: en el empate de especificidad gana HIDE, también entre dos ROLE del mismo usuario', () => {
    const show = rg({ elementKey: 'm.a', effect: 'SHOW', subjectType: 'ROLE', subjectId: 'A' });
    const hide = rg({ elementKey: 'm.a', effect: 'HIDE', subjectType: 'ROLE', subjectId: 'B' });
    expect(unico([el('m.a')], [show, hide])['m.a']).toMatchObject({ hidden: true, winningRuleId: hide.id });
    expect(unico([el('m.a')], [hide, show])['m.a']).toMatchObject({ hidden: true, winningRuleId: hide.id });
  });

  it('límite: una regla de otro sujeto, terminada o programada no cuenta', () => {
    const ajena = rg({ elementKey: 'm.a', effect: 'HIDE', subjectType: 'ROLE', subjectId: 'OTRO' });
    const terminada = rg({ elementKey: 'm.a', effect: 'HIDE', subjectType: 'ALL', validTo: '2026-10-31T11:59:59.000Z' });
    const programada = rg({ elementKey: 'm.a', effect: 'HIDE', subjectType: 'ALL', validFrom: '2026-11-01T00:00:00.000Z' });
    expect(unico([el('m.a')], [ajena, terminada, programada])['m.a']).toMatchObject({ hidden: false, reason: 'DEFAULT' });
    expect(reglaVigente(terminada, ahora)).toBe(false);
    expect(reglaVigente(programada, ahora)).toBe(false);
    expect(reglaVigente(rg({ elementKey: 'm.a', effect: 'HIDE', subjectType: 'ALL' }), ahora)).toBe(true);
  });

  it('cascada: oculto el padre, oculto el hijo aunque tenga SHOW propio; informa el ancestro de más arriba', () => {
    const elementos = [el('m'), el('m.p', 'm'), el('m.p.c', 'm.p')];
    const hideRaiz = rg({ elementKey: 'm', effect: 'HIDE', subjectType: 'ALL' });
    const showHijo = rg({ elementKey: 'm.p.c', effect: 'SHOW', subjectType: 'USER', subjectId: 'u1' });
    const r = unico(elementos, [hideRaiz, showHijo]);
    expect(r['m']).toMatchObject({ hidden: true, reason: 'RULE', winningRuleId: hideRaiz.id, ancestorKey: null });
    expect(r['m.p']).toMatchObject({ hidden: true, reason: 'ANCESTOR_HIDDEN', winningRuleId: null, ancestorKey: 'm' });
    expect(r['m.p.c']).toMatchObject({ hidden: true, reason: 'ANCESTOR_HIDDEN', ancestorKey: 'm' });
  });

  it('inválido: un ciclo de parentKey no cuelga el resolutor, y los RETIRED no se presentan', () => {
    const ciclo = [el('m.a', 'm.b'), el('m.b', 'm.a'), el('m.old', null, { status: 'RETIRED' })];
    const r = unico(ciclo, [rg({ elementKey: 'm.a', effect: 'HIDE', subjectType: 'ALL' })]);
    expect(Object.keys(r).sort()).toEqual(['m.a', 'm.b']);
    expect(r['m.b']).toMatchObject({ hidden: true, reason: 'ANCESTOR_HIDDEN', ancestorKey: 'm.a' });
  });
});

describe('visibilidad simulada: quién puede y qué datos hay', () => {
  it('sin sesión 401; sin el rol de seguridad 403 (también en preview y reglas)', () => {
    for (const [m, p] of [
      ['GET', '/admin/ui-visibility/elements'],
      ['GET', '/admin/ui-visibility/rules'],
      ['GET', '/admin/ui-visibility/preview'],
      ['POST', '/admin/ui-visibility/rules'],
      ['POST', '/admin/ui-visibility/elements/sync'],
    ] as const) {
      expect(estado(llamar(m, p, { user: null })), `${m} ${p} sin sesión`).toBe(401);
      expect(estado(llamar(m, p, { user: paciente })), `${m} ${p} paciente`).toBe(403);
    }
  });

  it('todo el dato sintético se declara SIMULADO, también los autores de las reglas', () => {
    const elementos = cuerpo<UiVisibilityPage<UiElement>>(llamar('GET', '/admin/ui-visibility/elements'));
    expect(elementos.items.length).toBeGreaterThan(10);
    for (const e of elementos.items) expect(e.label).toContain('SIMULADO');
    const reglas = cuerpo<UiVisibilityPage<UiVisibilityRule>>(llamar('GET', '/admin/ui-visibility/rules'));
    for (const r of reglas.items) expect(r.createdByLabel).toContain('SIMULADO');
  });

  it('lista elementos por módulo, tipo, estado y búsqueda sin tildes, con conteo de reglas vigentes', () => {
    const q = (query: Record<string, string>) => cuerpo<UiVisibilityPage<UiElement>>(llamar('GET', '/admin/ui-visibility/elements', { query }));
    expect(q({ module: 'laboratory' }).items.every((e) => e.moduleCode === 'laboratory')).toBe(true);
    expect(q({ kind: 'ACTION' }).items.every((e) => e.kind === 'ACTION')).toBe(true);
    expect(q({ status: 'RETIRED' }).items.map((e) => e.key)).toEqual(['billing.legacy-report']);
    expect(q({ q: 'GRAFICO' }).items.map((e) => e.key)).toEqual(['laboratory.results.trend-chart']);
    const exportar = q({ q: 'export-button' }).items[0]!;
    // La regla terminada de billing no cuenta; las dos vigentes de exportar sí.
    expect(exportar.activeRuleCount).toBe(2);
    expect(q({ module: 'billing' }).items.find((e) => e.key === 'billing.invoices.void-button')!.activeRuleCount).toBe(0);
  });

  it('límite: el cursor recorre sin repetir y total es el del filtro entero; limit fuera de rango es 400', () => {
    const a = cuerpo<UiVisibilityPage<UiElement>>(llamar('GET', '/admin/ui-visibility/elements', { query: { limit: '5' } }));
    expect(a.items).toHaveLength(5);
    expect(a.nextCursor).not.toBeNull();
    const b = cuerpo<UiVisibilityPage<UiElement>>(
      llamar('GET', '/admin/ui-visibility/elements', { query: { limit: '5', cursor: a.nextCursor! } }),
    );
    expect(b.items.map((e) => e.key).filter((k) => a.items.some((x) => x.key === k))).toEqual([]);
    expect(b.total).toBe(a.total);
    expect(estado(llamar('GET', '/admin/ui-visibility/elements', { query: { limit: '201' } }))).toBe(400);
    expect(estado(llamar('GET', '/admin/ui-visibility/elements', { query: { kind: 'NADA' } }))).toBe(400);
  });
});

describe('visibilidad simulada: elementos', () => {
  const NUEVO = {
    key: 'pharmacy.orders.note',
    kind: 'FIELD',
    moduleCode: 'pharmacy',
    parentKey: 'pharmacy.orders',
    label: 'Nota del pedido (SIMULADO)',
    description: null,
    defaultVisible: true,
  };

  it('alta manual: nace ACTIVE con source ADMIN y 0 reglas; persiste en el listado', () => {
    const r = llamar('POST', '/admin/ui-visibility/elements', { body: NUEVO });
    expect(estado(r)).toBe(201);
    expect(cuerpo<UiElement>(r)).toMatchObject({ source: 'ADMIN', status: 'ACTIVE', activeRuleCount: 0 });
    const lista = cuerpo<UiVisibilityPage<UiElement>>(llamar('GET', '/admin/ui-visibility/elements', { query: { q: 'orders.note' } }));
    expect(lista.items.map((e) => e.key)).toEqual(['pharmacy.orders.note']);
  });

  it('inválido: clave repetida 409 en el campo key; clave mal formada, módulo ajeno y clave extra son 400', () => {
    llamar('POST', '/admin/ui-visibility/elements', { body: NUEVO });
    const repetida = llamar('POST', '/admin/ui-visibility/elements', { body: NUEVO });
    expect(estado(repetida)).toBe(409);
    expect(campos(repetida)).toEqual(['key']);
    const mala = llamar('POST', '/admin/ui-visibility/elements', { body: { ...NUEVO, key: 'Pharmacy Orders' } });
    expect(estado(mala)).toBe(400);
    expect(campos(mala)).toContain('key');
    const ajena = llamar('POST', '/admin/ui-visibility/elements', { body: { ...NUEVO, key: 'laboratory.x.y' } });
    expect(estado(ajena)).toBe(400);
    expect(estado(llamar('POST', '/admin/ui-visibility/elements', { body: { ...NUEVO, extra: 1 } }))).toBe(400);
  });

  it('un padre inexistente es 422 UI_ELEMENT_NOT_FOUND y uno retirado 409 UI_ELEMENT_RETIRED, ambos en parentKey', () => {
    const inexistente = llamar('POST', '/admin/ui-visibility/elements', { body: { ...NUEVO, parentKey: 'pharmacy.no-existe' } });
    expect([estado(inexistente), razon(inexistente), campos(inexistente)]).toEqual([422, 'UI_ELEMENT_NOT_FOUND', ['parentKey']]);
    const retirado = llamar('POST', '/admin/ui-visibility/elements', { body: { ...NUEVO, key: 'billing.x', moduleCode: 'billing', parentKey: 'billing.legacy-report' } });
    expect([estado(retirado), razon(retirado)]).toEqual([409, 'UI_ELEMENT_RETIRED']);
  });

  it('sync idempotente: la segunda corrida no cambia nada; lo CODE que ya no llega queda RETIRED, lo ADMIN no', () => {
    llamar('POST', '/admin/ui-visibility/elements', { body: NUEVO });
    const borradores = [
      { key: 'pharmacy', kind: 'MODULE', moduleCode: 'pharmacy', parentKey: null, label: 'Farmacia (SIMULADO)', description: null, defaultVisible: true },
      { key: 'crm.home', kind: 'SCREEN', moduleCode: 'crm', parentKey: null, label: 'Inicio CRM', description: null, defaultVisible: true },
    ];
    const primera = cuerpo<UiElementSyncResult>(llamar('POST', '/admin/ui-visibility/elements/sync', { body: { elements: borradores } }));
    // 1 nuevo; farmacia no cambió; los 17 CODE activos restantes se retiran. El ADMIN (nota) se respeta.
    expect(primera.created).toBe(1);
    expect(primera.unchanged).toBe(1);
    expect(primera.retired).toBe(16);
    const segunda = cuerpo<UiElementSyncResult>(llamar('POST', '/admin/ui-visibility/elements/sync', { body: { elements: borradores } }));
    expect(segunda).toEqual({ created: 0, updated: 0, retired: 0, unchanged: 2 });
    const lista = cuerpo<UiVisibilityPage<UiElement>>(llamar('GET', '/admin/ui-visibility/elements', { query: { q: 'orders.note' } }));
    expect(lista.items[0]!.status).toBe('ACTIVE');
    // Una reaparición reactiva lo retirado y cuenta como actualizado.
    const vuelve = cuerpo<UiElementSyncResult>(
      llamar('POST', '/admin/ui-visibility/elements/sync', {
        body: { elements: [...borradores, { ...borradores[0]!, key: 'pharmacy.orders', kind: 'SCREEN', parentKey: 'pharmacy', label: 'Pedidos (SIMULADO)' }] },
      }),
    );
    expect(vuelve.updated).toBe(1);
  });

  it('sync inválido: claves repetidas o mal formadas son 400 con el índice del elemento', () => {
    const base = { key: 'crm.home', kind: 'SCREEN', moduleCode: 'crm', parentKey: null, label: 'x', description: null, defaultVisible: true };
    const r = llamar('POST', '/admin/ui-visibility/elements/sync', { body: { elements: [base, base, { ...base, key: 'MAL' }] } });
    expect(estado(r)).toBe(400);
    expect(campos(r)).toEqual(expect.arrayContaining(['elements.1.key', 'elements.2.key']));
    expect(estado(llamar('POST', '/admin/ui-visibility/elements/sync', { body: { elements: 'no' } }))).toBe(400);
  });
});

describe('visibilidad simulada: reglas', () => {
  const crear = (body: Record<string, unknown> = REGLA_VALIDA) => llamar('POST', '/admin/ui-visibility/rules', { body });

  it('crea una regla en versión 1 con autor y etiqueta de sujeto, y aparece como vigente', () => {
    const r = crear();
    expect(estado(r)).toBe(201);
    expect(cuerpo<UiVisibilityRule>(r)).toMatchObject({ version: 1, subjectLabel: 'DPO', createdByLabel: admin.displayName });
    const vigentes = cuerpo<UiVisibilityPage<UiVisibilityRule>>(
      llamar('GET', '/admin/ui-visibility/rules', { query: { elementKey: REGLA_VALIDA.elementKey, active: 'true' } }),
    );
    expect(vigentes.items).toHaveLength(1);
  });

  it('inválido: elemento ausente 404, retirado 409, repetida 409, sujeto incoherente 422, motivo corto 400', () => {
    const ausente = crear({ ...REGLA_VALIDA, elementKey: 'no.existe' });
    expect([estado(ausente), razon(ausente)]).toEqual([404, 'UI_ELEMENT_NOT_FOUND']);
    const retirada = crear({ ...REGLA_VALIDA, elementKey: 'billing.legacy-report' });
    expect([estado(retirada), razon(retirada)]).toEqual([409, 'UI_ELEMENT_RETIRED']);
    crear();
    const repetida = crear();
    expect([estado(repetida), razon(repetida)]).toEqual([409, 'UI_RULE_DUPLICATE']);
    for (const mala of [
      { ...REGLA_VALIDA, subjectType: 'ALL', subjectId: 'DPO' },
      { ...REGLA_VALIDA, subjectType: 'USER', subjectId: null },
      { ...REGLA_VALIDA, subjectType: 'TENANT', subjectId: 'no-es-uuid' },
      { ...REGLA_VALIDA, subjectType: 'ROLE', subjectId: 'minusculas' },
    ]) {
      const r = crear(mala);
      expect([estado(r), razon(r), campos(r)], JSON.stringify(mala)).toEqual([422, 'UI_RULE_INVALID_SUBJECT', ['subjectId']]);
    }
    const corto = crear({ ...REGLA_VALIDA, reason: 'corto' });
    expect([estado(corto), campos(corto)]).toEqual([400, ['reason']]);
    const fechas = crear({ ...REGLA_VALIDA, validFrom: '2026-12-01T00:00:00.000Z', validTo: '2026-11-01T00:00:00.000Z' });
    expect([estado(fechas), campos(fechas)]).toEqual([400, ['validTo']]);
  });

  it('PATCH exige If-Match: sin cabecera 428, versión vieja 409 UI_RULE_VERSION_MISMATCH, versión actual sube la versión', () => {
    const id = cuerpo<UiVisibilityRule>(crear()).id;
    const url = `/admin/ui-visibility/rules/${id}`;
    const cambio = { effect: 'SHOW', reason: 'Se vuelve a mostrar el teléfono.' };
    expect(estado(llamar('PATCH', url, { body: cambio }))).toBe(428);
    const ok = llamar('PATCH', url, { body: cambio, headers: { 'If-Match': '1' } });
    expect(cuerpo<UiVisibilityRule>(ok)).toMatchObject({ effect: 'SHOW', version: 2 });
    const vieja = llamar('PATCH', url, { body: { reason: 'Otro motivo suficiente.' }, headers: { 'If-Match': '1' } });
    expect([estado(vieja), razon(vieja)]).toEqual([409, 'UI_RULE_VERSION_MISMATCH']);
    expect(cuerpo<{ details: { currentVersion: number } }>(vieja).details.currentVersion).toBe(2);
    // El rechazo no cambió nada.
    const lista = cuerpo<UiVisibilityPage<UiVisibilityRule>>(llamar('GET', '/admin/ui-visibility/rules', { query: { elementKey: REGLA_VALIDA.elementKey } }));
    expect(lista.items[0]).toMatchObject({ reason: 'Se vuelve a mostrar el teléfono.', version: 2 });
  });

  it('PATCH inválido: clave ajena 400, cuerpo vacío 400, regla inexistente 404', () => {
    const id = cuerpo<UiVisibilityRule>(crear()).id;
    const url = `/admin/ui-visibility/rules/${id}`;
    expect(estado(llamar('PATCH', url, { body: { subjectType: 'ALL' }, headers: { 'If-Match': '1' } }))).toBe(400);
    expect(estado(llamar('PATCH', url, { body: {}, headers: { 'If-Match': '1' } }))).toBe(400);
    expect(estado(llamar('PATCH', '/admin/ui-visibility/rules/no-existe', { body: { effect: 'SHOW' }, headers: { 'If-Match': '1' } }))).toBe(404);
  });

  it('terminar no borra: la regla sigue en la lista (active=false), es idempotente y libera la terna', () => {
    const id = cuerpo<UiVisibilityRule>(crear()).id;
    const terminada = cuerpo<UiVisibilityRule>(llamar('POST', `/admin/ui-visibility/rules/${id}/end`));
    expect(terminada.validTo).not.toBeNull();
    expect(terminada.version).toBe(2);
    const otra = cuerpo<UiVisibilityRule>(llamar('POST', `/admin/ui-visibility/rules/${id}/end`));
    expect(otra.version).toBe(2);
    const finalizadas = cuerpo<UiVisibilityPage<UiVisibilityRule>>(
      llamar('GET', '/admin/ui-visibility/rules', { query: { elementKey: REGLA_VALIDA.elementKey, active: 'false' } }),
    );
    expect(finalizadas.items.map((r) => r.id)).toEqual([id]);
    expect(estado(crear())).toBe(201);
    // Una terminada ya no se edita.
    const edicion = llamar('PATCH', `/admin/ui-visibility/rules/${id}`, { body: { effect: 'SHOW' }, headers: { 'If-Match': '2' } });
    expect(estado(edicion)).toBe(409);
  });

  it('terminar una regla programada la deja sin llegar a regir', () => {
    const futuro = new Date(Date.now() + 5 * 86_400_000).toISOString();
    const id = cuerpo<UiVisibilityRule>(crear({ ...REGLA_VALIDA, validFrom: futuro })).id;
    const t = cuerpo<UiVisibilityRule>(llamar('POST', `/admin/ui-visibility/rules/${id}/end`));
    expect(t.validTo).toBe(futuro);
    expect(reglaVigente(t, new Date())).toBe(false);
  });
});

describe('visibilidad simulada: lo que ve cada persona', () => {
  const ocultos = (u: MockUser) => cuerpo<MyUiVisibility>(llamar('GET', '/me/ui-visibility', { user: u })).hiddenKeys;

  it('GET /me exige sesión', () => {
    expect(estado(llamar('GET', '/me/ui-visibility', { user: null }))).toBe(401);
  });

  it('la farmacia: USER (SHOW) gana a ROLE (HIDE) en exportar, y TENANT oculta la nueva reserva', () => {
    const h = ocultos(farmacia);
    expect(h).not.toContain('pharmacy.orders.export-button');
    expect(h).toContain('agenda.calendar.new-booking');
    expect(h).not.toContain('laboratory.results');
    expect(h).toContain('billing.invoices.manual-note'); // defaultVisible=false
    expect(h).not.toContain('billing.legacy-report'); // retirado: no se presenta
    expect(SUJETOS_DE_LA_SEMILLA.farmaciaUserId).toBe(farmacia.id);
  });

  it('la aseguradora: ORG_TYPE oculta resultados y, por cascada, sus hijos', () => {
    const h = ocultos(aseguradora);
    expect(h).toEqual(expect.arrayContaining(['laboratory.results', 'laboratory.results.print-button', 'laboratory.results.trend-chart']));
    expect(h).not.toContain('agenda.calendar.new-booking');
  });

  it('la versión cambia cuando cambia lo oculto y no cuando no', () => {
    const v = () => cuerpo<MyUiVisibility>(llamar('GET', '/me/ui-visibility', { user: farmacia })).version;
    const antes = v();
    expect(v()).toBe(antes);
    llamar('POST', '/admin/ui-visibility/rules', {
      body: { ...REGLA_VALIDA, elementKey: 'pharmacy.orders.patient-phone', subjectType: 'ROLE', subjectId: 'PHARMACY_STAFF' },
    });
    expect(v()).not.toBe(antes);
  });

  it('«ver como» un rol: el rol, el motivo de cada oculto y la regla ganadora', () => {
    const p = cuerpo<UiPreview>(llamar('GET', '/admin/ui-visibility/preview', { query: { roleCode: 'PHARMACY_STAFF' } }));
    expect(p.subject).toEqual({ type: 'ROLE', id: 'PHARMACY_STAFF', label: 'PHARMACY_STAFF' });
    const exportar = p.entries.find((e) => e.elementKey === 'pharmacy.orders.export-button')!;
    expect(exportar).toMatchObject({ hidden: true, reason: 'RULE' });
    expect(exportar.winningRuleId).not.toBeNull();
    expect(p.entries.find((e) => e.elementKey === 'billing.invoices.manual-note')).toMatchObject({ hidden: true, reason: 'DEFAULT', winningRuleId: null });
  });

  it('«ver como» una persona: la misma resolución que /me, y el motivo de cascada con su ancestro', () => {
    const p = cuerpo<UiPreview>(llamar('GET', '/admin/ui-visibility/preview', { query: { userId: aseguradora.id } }));
    expect(p.subject).toMatchObject({ type: 'USER', id: aseguradora.id, label: aseguradora.displayName });
    const hijo = p.entries.find((e) => e.elementKey === 'laboratory.results.trend-chart')!;
    expect(hijo).toMatchObject({ hidden: true, reason: 'ANCESTOR_HIDDEN', ancestorKey: 'laboratory.results', winningRuleId: null });
    expect(p.entries.filter((e) => e.hidden).map((e) => e.elementKey).sort()).toEqual(ocultosDe(aseguradora));
  });

  function ocultosDe(u: MockUser): string[] {
    return [...cuerpo<MyUiVisibility>(llamar('GET', '/me/ui-visibility', { user: u })).hiddenKeys];
  }

  it('la vista previa exige exactamente uno de userId o roleCode, y que existan', () => {
    expect(estado(llamar('GET', '/admin/ui-visibility/preview'))).toBe(400);
    expect(estado(llamar('GET', '/admin/ui-visibility/preview', { query: { userId: 'a', roleCode: 'B' } }))).toBe(400);
    expect(estado(llamar('GET', '/admin/ui-visibility/preview', { query: { userId: 'no-existe' } }))).toBe(404);
    expect(estado(llamar('GET', '/admin/ui-visibility/preview', { query: { roleCode: 'minuscula' } }))).toBe(400);
  });
});
