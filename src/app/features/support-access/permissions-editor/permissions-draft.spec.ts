import type {
  LocationNode,
  SupportGrant,
} from '../../../core/data-access/support-access/support-access.types';
import {
  diffGrants,
  toDraft,
  type DraftGrant,
} from '../../../core/data-access/support-access/support-grant-draft';
import {
  addTargets,
  buildLocationTree,
  hasTarget,
  levelNoun,
  locationTarget,
  selectionOf,
  selectLevel,
  setActions,
  toggleAction,
  toggleTarget,
} from './permissions-draft';

const SEDE: LocationNode = {
  id: 's1',
  kind: 'SITE',
  name: 'Sede Central',
  parentId: null,
  path: '/s1/',
};
const EDIFICIO: LocationNode = {
  id: 'b1',
  kind: 'BUILDING',
  name: 'Edificio A',
  parentId: 's1',
  path: '/s1/b1/',
};
const PISO1: LocationNode = {
  id: 'p1',
  kind: 'LEVEL',
  name: 'Piso 1',
  parentId: 'b1',
  path: '/s1/b1/p1/',
};
const PISO2: LocationNode = {
  id: 'p2',
  kind: 'LEVEL',
  name: 'Piso 2',
  parentId: 'b1',
  path: '/s1/b1/p2/',
};
const SALA: LocationNode = {
  id: 'r1',
  kind: 'CONSULTING_ROOM',
  name: 'Consultorio 101',
  parentId: 'p1',
  path: '/s1/b1/p1/r1/',
};
const NODOS = [SEDE, EDIFICIO, PISO1, PISO2, SALA];
const VER_Y_CREAR = ['schedule.view', 'schedule.create'] as const;

describe('toggleTarget', () => {
  it('agrega el objetivo con las acciones del rol y lo quita al repetir', () => {
    const objetivo = { targetKind: 'PRACTITIONER', practitionerRoleAssignmentId: 'd-1' } as const;

    const con = toggleTarget([], objetivo, VER_Y_CREAR, 'DYNAMIC');
    expect(con).toHaveLength(1);
    expect(con[0]).toMatchObject({
      ...objetivo,
      actions: ['schedule.view', 'schedule.create'],
      expansionMode: 'DYNAMIC',
    });
    expect(hasTarget(con, objetivo)).toBe(true);

    expect(toggleTarget(con, objetivo, VER_Y_CREAR, 'DYNAMIC')).toEqual([]);
  });

  it('dos filas con el mismo objetivo no conviven; con objetivos distintos se suman', () => {
    const a = { targetKind: 'PRACTITIONER', practitionerRoleAssignmentId: 'd-1' } as const;
    const b = { targetKind: 'PRACTITIONER', practitionerRoleAssignmentId: 'd-2' } as const;

    expect(
      addTargets(addTargets([], [a, b], VER_Y_CREAR, 'DYNAMIC'), [a], VER_Y_CREAR, 'DYNAMIC'),
    ).toHaveLength(2);
  });
});

describe('acciones por fila', () => {
  const base = toggleTarget(
    [],
    { targetKind: 'SERVICE', healthcareServiceId: 's-1' },
    VER_Y_CREAR,
    'DYNAMIC',
  );

  it('una celda de la matriz cambia solo su fila y deja las acciones en orden canónico', () => {
    const otra = toggleTarget(
      base,
      { targetKind: 'SERVICE', healthcareServiceId: 's-2' },
      VER_Y_CREAR,
      'DYNAMIC',
    );
    const resultado = toggleAction(otra, otra[0]!.key, 'schedule.check_in', true);

    expect(resultado[0]!.actions).toEqual([
      'schedule.view',
      'schedule.create',
      'schedule.check_in',
    ]);
    expect(resultado[1]!.actions).toEqual(['schedule.view', 'schedule.create']);
  });

  it('setActions ordena y descarta lo que no es una acción', () => {
    const resultado = setActions(base, base[0]!.key, ['schedule.create', 'schedule.view']);
    expect(resultado[0]!.actions).toEqual(['schedule.view', 'schedule.create']);
  });
});

describe('árbol de ubicaciones', () => {
  it('arma la jerarquía a partir de la lista plana', () => {
    const arbol = buildLocationTree(NODOS);

    expect(arbol).toHaveLength(1);
    expect(arbol[0]!.node.name).toBe('Sede Central');
    expect(arbol[0]!.children[0]!.children.map((n) => n.node.name)).toEqual(['Piso 1', 'Piso 2']);
  });

  it('una sede se otorga por `practiceSiteId`; lo demás, por `careSpaceId`', () => {
    expect(locationTarget(SEDE)).toEqual({ targetKind: 'LOCATION', practiceSiteId: 's1' });
    expect(locationTarget(PISO1)).toEqual({ targetKind: 'LOCATION', careSpaceId: 'p1' });
  });

  it('elegir un piso marca como incluidos sus consultorios y como parcial a sus ancestros', () => {
    const borrador = toggleTarget([], locationTarget(PISO1), VER_Y_CREAR, 'DYNAMIC');

    expect(selectionOf(PISO1, NODOS, borrador).state).toBe('selected');
    expect(selectionOf(SALA, NODOS, borrador)).toEqual({ state: 'inherited', by: PISO1 });
    expect(selectionOf(EDIFICIO, NODOS, borrador).state).toBe('partial');
    expect(selectionOf(PISO2, NODOS, borrador).state).toBe('none');
  });

  describe('«Seleccionar todo» en un nivel', () => {
    it('con lo nuevo automático elige el padre: cubre también lo que se agregue después', () => {
      const resultado = selectLevel([], EDIFICIO, [PISO1, PISO2], VER_Y_CREAR, 'DYNAMIC');

      expect(resultado).toHaveLength(1);
      expect(resultado[0]).toMatchObject({ careSpaceId: 'b1', expansionMode: 'DYNAMIC' });
    });

    it('con el modo fijo elige los hijos de hoy, uno por uno', () => {
      const resultado = selectLevel([], EDIFICIO, [PISO1, PISO2], VER_Y_CREAR, 'FIXED');

      expect(resultado.map((r) => r.careSpaceId)).toEqual(['p1', 'p2']);
      expect(resultado.every((r) => r.expansionMode === 'FIXED')).toBe(true);
    });

    it('pasar de pisos sueltos a «todo automático» no deja filas redundantes', () => {
      const sueltos = selectLevel([], EDIFICIO, [PISO1, PISO2], VER_Y_CREAR, 'FIXED');
      const todo = selectLevel(sueltos, EDIFICIO, [PISO1, PISO2], VER_Y_CREAR, 'DYNAMIC');

      expect(todo.map((r) => r.careSpaceId)).toEqual(['b1']);
    });
  });

  it('nombra el nivel en plural, para el botón', () => {
    expect(levelNoun([PISO1, PISO2])).toBe('pisos');
    expect(levelNoun([SALA])).toBe('consultorios');
    expect(levelNoun([])).toBe('lugares');
  });
});

describe('guardar: solo las diferencias', () => {
  const guardado: SupportGrant = {
    id: 'g-1',
    engagementId: 'e-1',
    targetKind: 'PRACTITIONER',
    practitionerRoleAssignmentId: 'd-1',
    expansionMode: 'DYNAMIC',
    actions: ['schedule.view', 'schedule.create'],
    status: 'ACTIVE',
  };
  const retirable: SupportGrant = { ...guardado, id: 'g-2', practitionerRoleAssignmentId: 'd-2' };

  it('sin cambios no manda nada', () => {
    const { create, change, revoke } = diffGrants([guardado], [toDraft(guardado)]);
    expect([create, change, revoke]).toEqual([[], [], []]);
  });

  it('crea lo nuevo, cambia lo editado y retira lo que se sacó', () => {
    const editado: DraftGrant = { ...toDraft(guardado), actions: ['schedule.view'] };
    const nuevo = toggleTarget(
      [],
      { targetKind: 'SERVICE', healthcareServiceId: 's-9' },
      VER_Y_CREAR,
      'DYNAMIC',
    )[0]!;

    const { create, change, revoke } = diffGrants(
      [guardado, retirable],
      [editado, nuevo as DraftGrant],
    );

    expect(create).toEqual([
      {
        targetKind: 'SERVICE',
        healthcareServiceId: 's-9',
        actions: ['schedule.view', 'schedule.create'],
        expansionMode: 'DYNAMIC',
      },
    ]);
    expect(change).toEqual([
      { grantId: 'g-1', actions: ['schedule.view'], expansionMode: 'DYNAMIC' },
    ]);
    expect(revoke).toEqual([{ grantId: 'g-2', revoke: true }]);
  });

  it('lo ya revocado no se vuelve a retirar', () => {
    const { revoke } = diffGrants([{ ...retirable, status: 'REVOKED' }], []);
    expect(revoke).toEqual([]);
  });
});
