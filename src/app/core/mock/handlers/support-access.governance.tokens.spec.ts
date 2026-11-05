import {
  coincideConLaSimulacion,
  guardarFichaDeSimulacion,
  huellaDelBorrador,
  olvidarSimulaciones,
  type Borrador,
} from './support-access.governance.tokens';

/**
 * El `simulationToken` del simulador es tan estricto como el de la API real (B7c, #50): vale para el borrador ENTERO de ESE vínculo,
 * no para «alguno de los permisos que se simularon».
 */
describe('simulationToken del simulador', () => {
  const VINCULO = 'e1';
  const PERMISO = {
    effect: 'ALLOW',
    actions: ['agenda.appointment.view'],
    targetKind: 'PRACTITIONER',
    practitionerRoleAssignmentId: 'ra-1',
  };
  const OTRO = {
    effect: 'ALLOW',
    actions: ['agenda.appointment.cancel'],
    targetKind: 'PRACTITIONER',
    practitionerRoleAssignmentId: 'ra-2',
  };

  beforeEach(() => olvidarSimulaciones());

  it('un permiso guardado solo vale si el borrador simulado era EXACTAMENTE ese permiso', () => {
    const token = guardarFichaDeSimulacion(VINCULO, {
      mode: 'PATCH',
      grants: [PERMISO, OTRO],
      removeGrantIds: [],
    });
    // Antes valía: bastaba que uno de los dos permisos simulados coincidiera.
    expect(
      coincideConLaSimulacion(token, VINCULO, {
        mode: 'PATCH',
        grants: [PERMISO],
        removeGrantIds: [],
      }),
    ).toBe(false);
    expect(
      coincideConLaSimulacion(token, VINCULO, {
        mode: 'PATCH',
        grants: [OTRO],
        removeGrantIds: [],
      }),
    ).toBe(false);
    expect(
      coincideConLaSimulacion(token, VINCULO, {
        mode: 'PATCH',
        grants: [OTRO, PERMISO],
        removeGrantIds: [],
      }),
    ).toBe(true);
  });

  it('no depende del orden de las acciones ni de las repetidas, pero sí de las condiciones, del objetivo y del vencimiento', () => {
    const borrador: Borrador = {
      mode: 'PATCH',
      grants: [
        {
          ...PERMISO,
          actions: ['b.atom', 'a.atom', 'a.atom'],
          condition: { schemaVersion: 1, time: { windows: [] } },
        },
      ],
      removeGrantIds: [],
    };
    const token = guardarFichaDeSimulacion(VINCULO, borrador);
    const igual = (g: object): Borrador => ({
      mode: 'PATCH',
      grants: [
        {
          ...PERMISO,
          actions: ['a.atom', 'b.atom'],
          condition: { schemaVersion: 1, time: { windows: [] } },
          ...g,
        },
      ],
      removeGrantIds: [],
    });
    expect(coincideConLaSimulacion(token, VINCULO, igual({}))).toBe(true);
    expect(
      coincideConLaSimulacion(token, VINCULO, igual({ condition: { schemaVersion: 1 } })),
    ).toBe(false);
    expect(
      coincideConLaSimulacion(token, VINCULO, igual({ practitionerRoleAssignmentId: 'ra-9' })),
    ).toBe(false);
    expect(
      coincideConLaSimulacion(token, VINCULO, igual({ validTo: '2027-01-01T00:00:00Z' })),
    ).toBe(false);
  });

  it('un campo en null NO es lo mismo que un campo ausente: así rompió la huella el null que manda la API (SIMULATION_STALE)', () => {
    const conNulos = huellaDelBorrador(VINCULO, {
      mode: 'PATCH',
      grants: [{ ...PERMISO, healthcareServiceId: null, validTo: null }],
      removeGrantIds: [],
    });
    const sinNulos = huellaDelBorrador(VINCULO, {
      mode: 'PATCH',
      grants: [PERMISO],
      removeGrantIds: [],
    });
    // `validTo: null` se normaliza a ausente (como en la API); la referencia en `null`, no.
    expect(conNulos).not.toBe(sinNulos);
    expect(
      huellaDelBorrador(VINCULO, {
        mode: 'PATCH',
        grants: [{ ...PERMISO, validTo: null }],
        removeGrantIds: [],
      }),
    ).toBe(sinNulos);
  });

  it('un cambio de rol es el REPLACE completo con su plantilla; es de ese vínculo; y un token ajeno o vencido no vale', () => {
    const reemplazo: Borrador = {
      mode: 'REPLACE',
      templateCode: 'FRONT_DESK',
      grants: [PERMISO],
      removeGrantIds: [],
    };
    const token = guardarFichaDeSimulacion(VINCULO, reemplazo);
    expect(coincideConLaSimulacion(token, VINCULO, reemplazo)).toBe(true);
    expect(
      coincideConLaSimulacion(token, VINCULO, { ...reemplazo, templateCode: 'SECRETARY' }),
    ).toBe(false);
    expect(coincideConLaSimulacion(token, VINCULO, { ...reemplazo, mode: 'PATCH' })).toBe(false);
    expect(coincideConLaSimulacion(token, 'otro-vinculo', reemplazo)).toBe(false);
    expect(coincideConLaSimulacion('sim_inventado', VINCULO, reemplazo)).toBe(false);
  });
});
