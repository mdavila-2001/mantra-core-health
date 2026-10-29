import { HttpHeaders } from '@angular/common/http';

import { PLAN_REASONS } from '../../data-access/floor-plan/floor-plan.codes';
import type { LayoutApplyResponse, LayoutResponse, PlanCardResponse, PlanStateResponse } from '../../data-access/floor-plan/floor-plan.types';
import { FOREIGN_PLAN_ID, FOREIGN_SPACE_ID, PLAN_SITE_ID, SEED_SPACES, planId, spaceId, unitId } from '../fixtures/floor-plan.seed';
import { MockRouter, isMockReply, type MockMethod, type MockReply } from '../mock-router';
import { buscarUsuario } from '../mock-session';
import { registerFloorPlan } from './floor-plan.handlers';
import { FloorPlanModel, type PlanRole } from './floor-plan.model';

/**
 * El plano de ejemplo del simulador (CONTRATO-PLANO §3, §4 y §7): 88 espacios,
 * errores del contrato, y sobre todo **qué claves viajan para cada rol** — la
 * clave `patient` no existe para Limpieza ni Mantenimiento (ausente ≠ nulo).
 */
describe('plano de planta del simulador (/floor-plans)', () => {
  const T0 = Date.parse('2026-10-29T12:00:00Z');
  let model: FloorPlanModel;
  let router: MockRouter;
  let role: PlanRole | null;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    model = new FloorPlanModel(T0);
    router = new MockRouter();
    role = null;
    registerFloorPlan(router, model, () => role);
  });
  afterEach(() => vi.useRealTimers());

  interface Result<T> {
    readonly status: number;
    readonly body: T;
  }

  function call<T = unknown>(
    method: MockMethod,
    path: string,
    options: { body?: unknown; headers?: Record<string, string>; user?: string } = {},
  ): Result<T> {
    const [pathname, queryString] = path.split('?');
    const match = router.match(method, pathname!);
    if (match === null) throw new Error(`sin manejador para ${method} ${path}`);
    const outcome = match.handler({
      method,
      path: pathname!,
      params: match.params,
      query: new URLSearchParams(queryString ?? ''),
      body: options.body ?? null,
      headers: new HttpHeaders(options.headers ?? {}),
      user: buscarUsuario(options.user ?? 'admin') ?? null,
    });
    return isMockReply(outcome) ? { status: (outcome as MockReply).status, body: (outcome as MockReply).body as T } : { status: 200, body: outcome as T };
  }

  const layout = (code: 'PB' | 'P1' | 'CP', query = ''): Result<LayoutResponse> => call('GET', `/floor-plans/${planId(code)}/layout${query}`);
  const state = (code: 'PB' | 'P1' | 'CP' = 'P1'): Result<PlanStateResponse> => call('GET', `/floor-plans/${planId(code)}/state`);

  describe('el ejemplo del contrato (§7)', () => {
    it('planta baja: 33 figuras y 70 elementos; piso 1: 51 y 64; campus: 2 y 2', () => {
      const counts = (['PB', 'P1', 'CP'] as const).map((c) => [layout(c).body.spaces.length, layout(c).body.elements.length]);
      expect(counts).toEqual([[33, 70], [51, 64], [2, 2]]);
    });

    it('el campus tiene un POLÍGONO (estacionamiento) y el edificio como rectángulo', () => {
      const kinds = layout('CP').body.spaces.map((s) => s.geometry.kind).sort();
      expect(kinds).toEqual(['POLYGON', 'RECT']);
    });

    it('lite no trae la tarjeta; full sí, con ruta, camas y unidad propietaria', () => {
      const lite = layout('P1', '?detail=lite').body.spaces;
      expect(lite.every((s) => s.card === undefined)).toBe(true);
      const full = layout('P1', '?detail=full').body.spaces;
      const room = full.find((s) => s.code === 'PLANO-P1-101')!;
      expect(room.card?.bedCount).toBe(2);
      expect(room.card?.path.map((p) => p.name)).toEqual(['Edificio principal', 'Piso 1', 'Internación Medicina']);
      expect(room.card?.ownerUnit?.name).toBe('Medicina interna');
    });

    it('el mismo código vertical de escalera y ascensor en los dos pisos', () => {
      const links = (c: 'PB' | 'P1'): string[] => layout(c).body.elements.filter((e) => e.verticalLinkCode).map((e) => e.verticalLinkCode!).sort();
      expect(links('PB')).toEqual(['ASC-1', 'ESC-A']);
      expect(links('P1')).toEqual(['ASC-1', 'ESC-A']);
    });

    it('la validación muestra exactamente los dos AREA_MISMATCH del §7', () => {
      const issues = call<{ issues: { severity: string; code: string; subjectId: string }[] }>('GET', `/floor-plans/${planId('PB')}/validation`).body.issues;
      const p1 = call<{ issues: { severity: string; code: string; subjectId: string }[] }>('GET', `/floor-plans/${planId('P1')}/validation`).body.issues;
      expect(issues.filter((i) => i.severity === 'ERROR')).toEqual([]);
      expect([...issues, ...p1].filter((i) => i.code === 'AREA_MISMATCH').map((i) => i.subjectId).sort()).toEqual([spaceId('PB-C3'), spaceId('P1-QX2')].sort());
    });

    it('pagina por cursor y por ventana', () => {
      const page1 = layout('P1', '?limit=20').body;
      expect(page1.spaces.length).toBe(20);
      expect(page1.page.nextCursor).toBe('20');
      expect(page1.page.total).toBe(51);
      const window = layout('P1', '?bbox=0,0,10,10&detail=lite').body.spaces.map((s) => s.code);
      expect(window).toContain('PLANO-P1-101');
      expect(window).not.toContain('PLANO-P1-UTI');
    });

    it('el foco por unidad Cirugía cruza pisos: planta baja (Procedimientos y yeso) y piso 1', () => {
      const entries = call<{ floorPlanName: string; spaceIds: string[] }[]>('GET', `/sites/${PLAN_SITE_ID}/plan-focus?unitId=${unitId('CIR')}`).body;
      expect(entries.map((e) => e.floorPlanName)).toEqual(['Planta baja', 'Piso 1']);
      expect(entries[0]!.spaceIds).toEqual([spaceId('PB-YES')]);
    });

    it('el foco por área devuelve el subárbol y la caja a enmarcar', () => {
      const body = layout('P1', `?focusSpaceId=${spaceId('P1-MED')}&unitMode=filter`).body;
      expect(body.spaces.length).toBe(1 + 4 + 5);
      expect(body.focus?.bbox).toEqual([2, 2, 22, 10.5]);
      const flagged = layout('P1', `?focusSpaceId=${spaceId('P1-MED')}&unitMode=flag`).body;
      expect(flagged.spaces.length).toBe(51);
      expect(flagged.spaces.filter((s) => s.inFocus).length).toBe(10);
    });

    it('la búsqueda ignora acentos, centra y dice si el espacio está dibujado', () => {
      const hits = call<{ name: string; floorPlanName: string | null; placed: boolean; centerXM: number | null }[]>('GET', `/sites/${PLAN_SITE_ID}/plan-search?q=quirofano`).body;
      expect(hits.map((h) => h.name)).toEqual(['Quirófano 1', 'Quirófano 2']);
      expect(hits[0]).toMatchObject({ floorPlanName: 'Piso 1', placed: true, centerXM: 27 });
    });
  });

  describe('permisos: lo que viaja depende del rol, no de lo que la UI oculte (§4)', () => {
    const stateKeys = (body: PlanStateResponse): string => JSON.stringify(body);

    it('Limpieza: la respuesta de red NO contiene la clave patient, ni en el estado ni en plan-card', () => {
      role = 'LIM';
      const body = state('P1').body;
      expect(stateKeys(body)).not.toContain('patient');
      expect(stateKeys(body)).not.toMatch(/initials/);
      expect(body.viewer.canSeePatient).toBe(false);
      const card = call<PlanCardResponse>('GET', `/care-spaces/${spaceId('P1-101-C1')}/plan-card`);
      expect(card.status).toBe(200);
      expect(JSON.stringify(card.body)).not.toContain('patient');
    });

    it('Mantenimiento tampoco recibe paciente; sí recibe los atributos técnicos', () => {
      role = 'MAN';
      expect(stateKeys(state('P1').body)).not.toContain('patient');
      const room = layout('P1').body.spaces.find((s) => s.code === 'PLANO-P1-AIS')!;
      expect(room.card?.technical?.pressure).toBe('Negativa');
    });

    it('Limpieza no ve atributos administrativos ni técnicos en la tarjeta estática', () => {
      role = 'LIM';
      const room = layout('P1').body.spaces.find((s) => s.code === 'PLANO-P1-AIS')!;
      expect(room.card?.ownerUnit).toBeNull();
      expect(room.card?.areaDeclaredM2).toBeNull();
      expect(room.card?.technical).toBeUndefined();
    });

    it('Limpieza sí recibe disponibilidad, higiene y aislamiento (F2, D-PL-04)', () => {
      role = 'LIM';
      const cell = state('P1').body.spaces[spaceId('P1-AIS-C1')]!;
      expect(cell.isolation.code).toBe('ISO_AIRBORNE');
      expect(cell.hygiene.code).toBeDefined();
      expect(cell.occupancy.code).toBe('OCC_OCCUPIED');
    });

    it('Administración (admin. de organización) ve el estado sin paciente: R sin paciente', () => {
      role = 'AO';
      expect(stateKeys(state('P1').body)).not.toContain('patient');
    });

    it('Admisión ve iniciales en el estado y el nombre solo en plan-card', () => {
      role = 'ADM';
      const cell = state('P1').body.spaces[spaceId('P1-101-C1')]!;
      expect(cell.occupancy.patient?.initials).toMatch(/^[A-ZÁÉÍÓÚÑ]{2,4}$/);
      expect(JSON.stringify(state('P1').body)).not.toMatch(/displayName/);
      const card = call<PlanCardResponse>('GET', `/care-spaces/${spaceId('P1-101-C1')}/plan-card`).body;
      expect(card.patient?.displayName).toContain(' ');
      expect(card.patient?.losDays).toBeGreaterThan(0);
    });

    it('Enfermería de Medicina: ve pacientes solo en su unidad; lo demás es silueta y plan-card contesta 404', () => {
      role = 'ENF';
      const body = layout('P1').body;
      const med = body.spaces.find((s) => s.code === 'PLANO-P1-101')!;
      const cir = body.spaces.find((s) => s.spaceId === spaceId('P1-201'))!;
      expect(med.inScope).toBe(true);
      expect(cir.inScope).toBe(false);
      expect(cir.code).toBeUndefined();
      expect(cir.name).toBeUndefined();
      expect(Object.keys(cir)).not.toContain('card');
      const st = state('P1').body;
      expect(st.spaces[spaceId('P1-101-C1')]?.occupancy.patient).toBeDefined();
      expect(st.spaces[spaceId('P1-201-C1')]).toBeUndefined();
      expect(call('GET', `/care-spaces/${spaceId('P1-201-C1')}/plan-card`).status).toBe(404);
      expect(call('GET', `/care-spaces/${spaceId('P1-101-C1')}/plan-card`).status).toBe(200);
    });

    it('Facturación ve la geometría pero no el estado: 403 con los roles requeridos', () => {
      role = 'FAC';
      expect(layout('P1').status).toBe(200);
      const denied = state('P1');
      expect(denied.status).toBe(403);
      expect(denied.body).toMatchObject({ reason: PLAN_REASONS.ACTION_NOT_ALLOWED });
      expect(layout('P1').body.viewer.canSeeState).toBe(false);
    });

    it('cada lectura de paciente queda auditada, deduplicada a 60 s por usuario y espacio', () => {
      role = 'ADM';
      const path = `/care-spaces/${spaceId('P1-101-C1')}/plan-card`;
      call('GET', path);
      call('GET', path);
      expect(model.occupantViews).toHaveLength(1);
      vi.setSystemTime(T0 + 61_000);
      call('GET', path);
      expect(model.occupantViews).toHaveLength(2);
    });

    it('una cuenta que no es de personal no entra al plano', () => {
      expect(call('GET', `/floor-plans/${planId('PB')}`, { user: 'paciente' }).status).toBe(403);
    });
  });

  describe('404 cruzado: otro tenant se comporta igual que inexistente', () => {
    it('lienzo, espacio y sede ajenos contestan 404 con el mismo cuerpo que un id cualquiera', () => {
      const a = call('GET', `/floor-plans/${FOREIGN_PLAN_ID}/layout`);
      const b = call('GET', `/floor-plans/00000000-0000-4000-a000-000000000000/layout`);
      expect(a.status).toBe(404);
      expect(a.body).toEqual(b.body);
      expect(call('GET', `/care-spaces/${FOREIGN_SPACE_ID}/plan-card`).status).toBe(404);
      expect(call('GET', `/sites/${FOREIGN_PLAN_ID}/floor-plans`).status).toBe(404);
    });
  });

  describe('estado en el tiempo (sondeo asOf)', () => {
    it('el estado cambia con el reloj: cada 30 s se aplica un evento del guion', () => {
      const before = state('P1').body;
      expect(before.spaces[spaceId('P1-102-C2')]!.hygiene.code).toBe('HYG_CLEANING');
      const mid = (vi.setSystemTime(T0 + 31_000), state('P1').body);
      expect(mid.spaces[spaceId('P1-102-C2')]!.hygiene.code).toBe('HYG_CLEAN');
      expect(Date.parse(mid.asOf)).toBe(T0 + 31_000);
      expect(Date.parse(mid.lastEventAt!)).toBeGreaterThan(Date.parse(before.lastEventAt!));
      expect(mid.layoutVersion).toBe(before.layoutVersion);
    });

    it('los recuentos por contenedor se mantienen coherentes con las celdas', () => {
      const st = state('P1').body;
      const ward = st.rollups[spaceId('P1-MED')]!;
      expect(ward.beds).toBe(5);
      expect(ward.occupied).toBe(3);
      expect(ward.isolation).toBe(1);
      expect(st.counts.total).toBe(26);
      const bedCells = Object.entries(st.spaces).filter(([id]) => /C\d/.test(keyOf(id)));
      expect(st.counts.occupied).toBe(bedCells.filter(([, c]) => c.occupancy.code === 'OCC_OCCUPIED').length);
      expect(st.counts.assignable).toBe(bedCells.filter(([, c]) => c.assignable).length);
    });

    function keyOf(id: string): string {
      return SEED_SPACES.find((s) => spaceId(s.key) === id)!.key;
    }

    it('el v2Code sigue la regla del contrato (C, K, I, O, R, H, U)', () => {
      const st = state('P1').body.spaces;
      expect(st[spaceId('P1-201-C2')]!.v2Code).toBe('C'); // bloqueada
      expect(st[spaceId('P1-203-C1')]!.v2Code).toBe('K'); // contaminada
      expect(st[spaceId('P1-AIS-C1')]!.v2Code).toBe('I'); // aislamiento
      expect(st[spaceId('P1-101-C1')]!.v2Code).toBe('O');
      expect(st[spaceId('P1-UTI-C4')]!.v2Code).toBe('R');
      expect(st[spaceId('P1-303-C2')]!.v2Code).toBe('H');
      expect(st[spaceId('P1-102-C1')]!.v2Code).toBe('U');
      expect(st[spaceId('P1-102-C1')]!.assignable).toBe(true);
    });
  });

  describe('guardado del layout (§3.4)', () => {
    const patchPlacement = (code: 'PB' | 'P1', body: unknown, headers: Record<string, string> = {}, query = ''): Result<LayoutApplyResponse & Record<string, unknown>> =>
      call('PATCH', `/floor-plans/${planId(code)}/layout${query}`, { body, headers: { 'If-Match': String(model.plans.get(code)!.layoutVersion), ...headers } });
    const rect = (centerXM: number, centerYM: number, widthM: number, depthM: number) => ({ kind: 'RECT' as const, centerXM, centerYM, widthM, depthM, rotationDeg: 0 });

    it('sin permiso de edición: 403 INFRA_ACTION_NOT_ALLOWED con los roles requeridos', () => {
      role = 'ENF';
      const r = patchPlacement('PB', { upsert: { placements: [] } });
      expect(r.status).toBe(403);
      expect(r.body).toMatchObject({ reason: PLAN_REASONS.ACTION_NOT_ALLOWED, details: { requiredRoles: ['SA', 'AO', 'AS'] } });
    });

    it('un solape devuelve 422 PLAN_LAYOUT_INVALID con el elemento, su vecino y el área solapada', () => {
      const r = patchPlacement('PB', { upsert: { placements: [{ spaceId: spaceId('PB-C2'), geometry: rect(31, 6.25, 4, 8.5) }] } });
      expect(r.status).toBe(422);
      const body = r.body as unknown as { reason: string; requestId: string; errors: { id: string; code: string; conflictsWith?: { code: string; overlapAreaM2?: number }[] }[] };
      expect(body.reason).toBe(PLAN_REASONS.LAYOUT_INVALID);
      expect(body.requestId).toMatch(/^[0-9a-f]{16}$/);
      const err = body.errors.find((e) => e.id === spaceId('PB-C2') && e.code === 'PLAN_SIBLING_OVERLAP')!;
      expect(err.conflictsWith?.map((c) => c.code)).toContain('PLANO-PB-C1');
      expect(err.conflictsWith?.[0]?.overlapAreaM2).toBeGreaterThan(0);
    });

    it('dryRun valida sin escribir', () => {
      const before = model.plans.get('PB')!.layoutVersion;
      const r = patchPlacement('PB', { upsert: { placements: [{ spaceId: spaceId('PB-C2'), geometry: rect(31, 6.25, 4, 8.5) }] } }, {}, '?dryRun=true');
      expect(r.status).toBe(422);
      expect(model.plans.get('PB')!.layoutVersion).toBe(before);
    });

    it('intercambiar la figura de dos locales en un mismo guardado funciona (toque de pared, sin solape)', () => {
      const before = model.plans.get('PB')!.layoutVersion;
      const r = patchPlacement('PB', { upsert: { placements: [
        { spaceId: spaceId('PB-C1'), geometry: rect(32, 6.25, 4, 8.5) },
        { spaceId: spaceId('PB-C2'), geometry: rect(28, 6.25, 4, 8.5) },
      ] } });
      expect(r.status).toBe(200);
      expect(r.body.layoutVersion).toBe(before + 1);
      expect(r.body.applied.moved).toBe(2);
      expect(layout('PB').body.layoutVersion).toBe(before + 1);
    });

    it('sacar una cama de su habitación: PLAN_CHILD_OUTSIDE_PARENT', () => {
      const bad = patchPlacement('P1', { upsert: { placements: [{ spaceId: spaceId('P1-101-C1'), geometry: rect(1, 1, 1, 2) }] } });
      expect(bad.status).toBe(422);
      expect(JSON.stringify(bad.body)).toContain('PLAN_CHILD_OUTSIDE_PARENT');
    });

    it('achicar la habitación con sus camas: solo guarda si las camas se mueven en el mismo guardado', () => {
      const room = { spaceId: spaceId('P1-101'), geometry: rect(3.75, 6.25, 3.5, 8.5) };
      const alone = patchPlacement('P1', { upsert: { placements: [room] } });
      expect(alone.status).toBe(422);
      expect(JSON.stringify(alone.body)).toContain('PLAN_CHILD_OUTSIDE_PARENT');
      const before = model.plans.get('P1')!.layoutVersion;
      const together = patchPlacement('P1', { upsert: { placements: [
        room,
        { spaceId: spaceId('P1-101-C1'), geometry: rect(3, 3.2, 1, 2) },
        { spaceId: spaceId('P1-101-C2'), geometry: rect(4.4, 3.2, 1, 2) },
      ] } });
      expect(together.status).toBe(200);
      expect(together.body.layoutVersion).toBe(before + 1);
      expect(together.body.applied.moved).toBe(3);
    });

    it('con If-Match viejo: 412 PLAN_VERSION_MISMATCH con la versión vigente', () => {
      const r = call('PATCH', `/floor-plans/${planId('PB')}/layout`, { body: { upsert: { placements: [] } }, headers: { 'If-Match': '999' } });
      expect(r.status).toBe(412);
      expect(r.body).toMatchObject({ reason: PLAN_REASONS.VERSION_MISMATCH, currentVersion: 1 });
    });

    it('sin If-Match tampoco se guarda', () => {
      expect(call('PATCH', `/floor-plans/${planId('PB')}/layout`, { body: {} }).status).toBe(412);
    });

    it('quitar del plano un local con camas ocupadas: 409 PLAN_SPACE_OCCUPIED', () => {
      const r = patchPlacement('P1', { remove: { spaceIds: [spaceId('P1-101')], cascade: true } });
      expect(r.status).toBe(409);
      expect(r.body).toMatchObject({ reason: PLAN_REASONS.SPACE_OCCUPIED });
    });

    it('quitar un padre con hijos dibujados exige cascade', () => {
      const r = patchPlacement('P1', { remove: { spaceIds: [spaceId('P1-102')] } });
      expect(r.status).toBe(409);
      expect(r.body).toMatchObject({ reason: 'PLAN_HAS_PLACED_CHILDREN' });
    });

    it('quitar un consultorio libre lo manda a la paleta y volver a dibujarlo lo trae de vuelta', () => {
      const removed = patchPlacement('PB', { remove: { spaceIds: [spaceId('PB-C3')] } });
      expect(removed.status).toBe(200);
      expect(removed.body.applied.removed).toBe(1);
      const palette = call<{ items: { spaceId: string; placeable: boolean }[] }>('GET', `/floor-plans/${planId('PB')}/unplaced-spaces`).body.items;
      expect(palette.find((i) => i.spaceId === spaceId('PB-C3'))?.placeable).toBe(true);
      const placed = patchPlacement('PB', { upsert: { placements: [{ spaceId: spaceId('PB-C3'), geometry: rect(36, 6.25, 4, 8.5) }] } });
      expect(placed.status).toBe(200);
      expect(placed.body.applied.placed).toBe(1);
      expect(placed.body.warnings.map((w) => w.spaceId)).toEqual([spaceId('PB-C3')]);
      expect(layout('PB').body.spaces.length).toBe(33);
    });

    it('un espacio ya dibujado en otro lienzo: 409 PLAN_SPACE_ALREADY_PLACED', () => {
      const r = patchPlacement('PB', { upsert: { placements: [{ spaceId: spaceId('P1-101'), geometry: rect(10, 6, 3, 3) }] } });
      expect(r.status).toBe(409);
      expect(r.body).toMatchObject({ reason: 'PLAN_SPACE_ALREADY_PLACED' });
    });

    it('una abertura que no cabe en su muro da PLAN_OPENING_OUTSIDE_WALL', () => {
      const wall = [...model.elements.values()].find((e) => e.kind === 'WALL' && e.plan === 'PB' && e.label === undefined)!;
      const r = patchPlacement('PB', { upsert: { elements: [{ kind: 'DOOR', hostElementId: wall.id, offsetM: 100, widthM: 1, swing: 'LEFT' }] } });
      expect(r.status).toBe(422);
      expect(JSON.stringify(r.body)).toContain('PLAN_OPENING_OUTSIDE_WALL');
    });

    it('más de 500 ítems: 413', () => {
      const many = Array.from({ length: 501 }, () => spaceId('PB-C1'));
      expect(patchPlacement('PB', { remove: { spaceIds: many } }).status).toBe(413);
    });
  });
});
