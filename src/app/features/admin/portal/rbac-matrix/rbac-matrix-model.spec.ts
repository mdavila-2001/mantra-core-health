import {
  allGaps,
  buildMatrix,
  buildSavePlan,
  cellRoles,
  coverageRows,
  draftChangeCount,
  effectOf,
  filterGaps,
  indexCatalog,
  pickModule,
  roleCountsByModule,
  type Draft,
} from './rbac-matrix-model';
import { ROLE_FIN, ROLE_OPS, fixtureCatalog } from './rbac-matrix.fixture';

const catalog = fixtureCatalog();
const index = indexCatalog(catalog);
const draft = (entries: [string, '' | 'ALLOW' | 'DENY'][]): Draft => new Map(entries);

describe('rbac-matrix-model', () => {
  describe('pickModule', () => {
    it('correcto: el pedido manda', () => {
      expect(pickModule(catalog, 'pharma_lab')?.key).toBe('pharma_lab');
    });
    it('límite: sin pedido o con uno desconocido, el primero con permisos; sin permisos, el primero', () => {
      expect(pickModule(catalog, '')?.key).toBe('billing');
      expect(pickModule(catalog, 'no_existe')?.key).toBe('billing');
      expect(
        pickModule(
          { ...catalog, modules: catalog.modules.filter((m) => m.permissionCount === 0) },
          '',
        )?.key,
      ).toBe('ops');
    });
    it('inválido: sin módulos no hay nada que elegir', () => {
      expect(pickModule({ ...catalog, modules: [] }, '')).toBeNull();
    });
  });

  describe('buildMatrix', () => {
    it('correcto: sólo las acciones que el módulo ofrece, en orden canónico, con una celda por columna', () => {
      const m = buildMatrix(catalog.modules[0]!);
      expect(m.columns).toEqual(['list', 'export', 'approve']);
      expect(m.rows).toHaveLength(1);
      expect(m.rows[0]!.cells.map((c) => c?.action)).toEqual(['list', 'export', 'approve']);
    });
    it('límite: un recurso que no ofrece una acción deja la celda en null', () => {
      const m = buildMatrix(catalog.modules[2]!);
      expect(m.columns).toEqual(['update']);
      const both = buildMatrix({
        ...catalog.modules[0]!,
        resources: [...catalog.modules[0]!.resources, ...catalog.modules[1]!.resources],
      });
      expect(both.columns).toEqual(['read', 'list', 'export', 'approve']);
      expect(both.rows[0]!.cells[0]).toBeNull();
    });
    it('inválido: una búsqueda sin coincidencias devuelve una matriz vacía, no un error', () => {
      expect(buildMatrix(catalog.modules[0]!, 'zzz')).toEqual({ columns: [], rows: [] });
      expect(buildMatrix(catalog.modules[0]!, ' INVOI ').rows).toHaveLength(1);
    });
  });

  describe('cellRoles', () => {
    it('separa quién permite de a quién se le niega, sin repetir', () => {
      const row = buildMatrix(catalog.modules[0]!).rows[0]!;
      expect(cellRoles(row.cells[0]!, row.permissions)).toEqual({
        allow: ['FINANCE'],
        deny: ['OPS'],
      });
      expect(cellRoles(row.cells[1]!, row.permissions)).toEqual({ allow: [], deny: [] });
      expect(cellRoles(row.cells[2]!, row.permissions)).toEqual({ allow: [], deny: [] });
    });
  });

  describe('effectOf y roleCountsByModule', () => {
    it('el borrador está por encima de lo guardado, y "" es sin asignar', () => {
      expect(effectOf(index, ROLE_FIN, 'p-list', draft([]))).toBe('ALLOW');
      expect(effectOf(index, ROLE_FIN, 'p-list', draft([['p-list', '']]))).toBe('');
      expect(effectOf(index, ROLE_FIN, 'p-approve', draft([]))).toBe('');
      expect(effectOf(index, ROLE_OPS, 'p-list', draft([]))).toBe('DENY');
    });
    it('cuenta por módulo con el borrador aplicado', () => {
      const counts = roleCountsByModule(catalog, index, ROLE_FIN, draft([['p-approve', 'ALLOW']]));
      expect(counts.find((c) => c.module === 'billing')).toEqual({
        module: 'billing',
        allow: 2,
        deny: 0,
        total: 2,
      });
      expect(counts.find((c) => c.module === 'pharma_lab')).toEqual({
        module: 'pharma_lab',
        allow: 0,
        deny: 0,
        total: 0,
      });
    });
  });

  describe('buildSavePlan', () => {
    const base = [{ permissionId: 'p-list', effect: 'ALLOW', scope: 'TENANT' }];

    it('correcto: parte de lo que el servidor tiene, agrega lo nuevo y conserva restricción y ámbito de lo que no se tocó', () => {
      const plan = buildSavePlan({
        base,
        draft: draft([['p-approve', 'ALLOW']]),
        index,
        roleId: ROLE_FIN,
      });
      expect(plan.bindings).toEqual([
        {
          permissionId: 'p-list',
          effect: 'ALLOW',
          scope: 'TENANT',
          constraintJson: { maxAmount: 100 },
        },
        { permissionId: 'p-approve', effect: 'ALLOW' },
      ]);
      expect(plan.added.map((l) => l.code)).toEqual(['billing.invoices.approve']);
      expect(plan.dangerousGranted).toBe(1);
      expect(plan).toMatchObject({ total: 1, wouldEmpty: false, unknown: [] });
    });

    it('límite: cambiar el efecto conserva ámbito y restricción; quitar lo borra; dejar igual no es un cambio', () => {
      const changed = buildSavePlan({
        base,
        draft: draft([['p-list', 'DENY']]),
        index,
        roleId: ROLE_FIN,
      });
      expect(changed.bindings).toEqual([
        {
          permissionId: 'p-list',
          effect: 'DENY',
          scope: 'TENANT',
          constraintJson: { maxAmount: 100 },
        },
      ]);
      expect(changed.changed).toHaveLength(1);
      const removed = buildSavePlan({
        base: [...base, { permissionId: 'p-approve', effect: 'ALLOW', scope: null }],
        draft: draft([['p-approve', '']]),
        index,
        roleId: ROLE_FIN,
      });
      expect(removed.bindings.map((b) => b.permissionId)).toEqual(['p-list']);
      expect(removed.removed).toHaveLength(1);
      const same = buildSavePlan({
        base,
        draft: draft([['p-list', 'ALLOW']]),
        index,
        roleId: ROLE_FIN,
      });
      expect(same.total).toBe(0);
    });

    it('inválido: dejar el rol sin permisos se marca; un permiso del servidor que el catálogo no conoce se reporta y no se descarta', () => {
      const empty = buildSavePlan({
        base,
        draft: draft([['p-list', '']]),
        index,
        roleId: ROLE_FIN,
      });
      expect(empty.wouldEmpty).toBe(true);
      expect(empty.bindings).toEqual([]);
      const stale = buildSavePlan({
        base: [...base, { permissionId: 'p-nuevo', effect: 'ALLOW', scope: null }],
        draft: draft([]),
        index,
        roleId: ROLE_FIN,
      });
      expect(stale.unknown).toEqual(['p-nuevo']);
      expect(stale.bindings.map((b) => b.permissionId)).toEqual(['p-list', 'p-nuevo']);
    });

    it('inválido: un permiso del borrador que ya no existe en el catálogo se ignora', () => {
      const plan = buildSavePlan({
        base,
        draft: draft([['p-fantasma', 'ALLOW']]),
        index,
        roleId: ROLE_FIN,
      });
      expect(plan.total).toBe(0);
    });
  });

  describe('draftChangeCount', () => {
    it('cuenta sólo lo que difiere de lo guardado', () => {
      expect(
        draftChangeCount(
          index,
          ROLE_FIN,
          draft([
            ['p-list', 'ALLOW'],
            ['p-approve', 'ALLOW'],
            ['p-x', ''],
          ]),
        ),
      ).toBe(1);
    });
  });

  describe('coverageRows', () => {
    it('ordena por huecos y calcula el porcentaje sólo sobre rutas que autorizan algo', () => {
      const rows = coverageRows(catalog);
      expect(rows.map((r) => r.module)).toEqual(['pharma_lab', 'billing', 'ops']);
      const billing = rows.find((r) => r.module === 'billing')!;
      expect(billing).toMatchObject({ authorizable: 4, inFineCells: 2, finePercent: 50 });
      expect(rows.find((r) => r.module === 'ops')).toMatchObject({
        authorizable: 0,
        finePercent: null,
      });
    });
  });

  describe('huecos', () => {
    it('allGaps ordena por prioridad y filterGaps combina los filtros', () => {
      const gaps = allGaps(catalog);
      expect(gaps.map((g) => g.severity)).toEqual(['HIGH', 'MEDIUM', 'MEDIUM']);
      expect(
        filterGaps(gaps, { module: 'pharma_lab', severity: '', kind: '', query: '' }),
      ).toHaveLength(2);
      expect(filterGaps(gaps, { module: '', severity: 'HIGH', kind: '', query: '' })).toHaveLength(
        1,
      );
      expect(
        filterGaps(gaps, { module: '', severity: '', kind: 'ROLE_ONLY', query: 'finance' }),
      ).toHaveLength(1);
      expect(filterGaps(gaps, { module: '', severity: '', kind: '', query: 'nada' })).toEqual([]);
    });
  });
});
