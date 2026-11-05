import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AccessExplainClient } from '../../../core/data-access/access-governance/access-explain.client';
import type {
  PermissionCatalog,
  SimulateAccessRequest,
  SimulateAccessResponse,
} from '../../../core/data-access/access-governance/access-explain.types';
import { SupportAccessClient } from '../../../core/data-access/support-access/support-access.client';
import type {
  SupportCatalog,
  SupportEngagement,
  SupportGrant,
} from '../../../core/data-access/support-access/support-access.types';
import {
  ATOM_CATEGORY_LABELS,
  LEGACY_ALIAS_ATOMS,
  LEGACY_ALIAS_PRIMARY,
  SUPPORT_ATOMS,
} from '../../../core/data-access/support-access/support-atoms';
import { AccessChallengeCancelledError } from '../../../core/access-challenge/access-challenge';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { PermissionsEditor } from './permissions-editor';
import { PREVIEW_DEBOUNCE_MS } from './editor-save-flow';

const CATALOGO: SupportCatalog = {
  organizationName: 'Hospital Piloto',
  services: [
    { id: 's-eco', name: 'Ecografía' },
    { id: 's-cons', name: 'Consulta de cardiología' },
  ],
  locations: [
    { id: 'central', kind: 'SITE', name: 'Sede Central', parentId: null, path: '/central/' },
    { id: 'a', kind: 'BUILDING', name: 'Edificio A', parentId: 'central', path: '/central/a/' },
    { id: 'a-p1', kind: 'LEVEL', name: 'Piso 1', parentId: 'a', path: '/central/a/a-p1/' },
    {
      id: 'a-103',
      kind: 'CONSULTING_ROOM',
      name: 'Consultorio 103',
      parentId: 'a-p1',
      path: '/central/a/a-p1/a-103/',
    },
    { id: 'a-p2', kind: 'LEVEL', name: 'Piso 2', parentId: 'a', path: '/central/a/a-p2/' },
    {
      id: 'a-201',
      kind: 'PROCEDURE_ROOM',
      name: 'Sala 201',
      parentId: 'a-p2',
      path: '/central/a/a-p2/a-201/',
    },
  ],
  doctors: [
    {
      id: 'd-perez',
      name: 'Dr. Andrés Pérez',
      specialty: 'Cardiología',
      placements: [
        { careSpaceId: 'a-103', healthcareServiceId: 's-cons' },
        { careSpaceId: 'a-201', healthcareServiceId: 's-eco' },
      ],
    },
    {
      id: 'd-rojas',
      name: 'Dra. Valeria Rojas',
      specialty: 'Ginecología',
      placements: [{ careSpaceId: 'a-201', healthcareServiceId: 's-eco' }],
    },
  ],
};

const VINCULO: SupportEngagement = {
  id: 'e-1',
  tenantId: 't-1',
  organizationName: 'Hospital Piloto',
  ownerKind: 'ORGANIZATION',
  userId: 'u-lucia',
  personName: 'Lucía Paz',
  roleTemplate: 'FRONT_DESK',
  status: 'ACTIVE',
  origin: 'INVITATION',
  recertifyEveryMonths: 12,
  grants: [],
};

const CATALOGO_DE_PERMISOS: PermissionCatalog = {
  atoms: SUPPORT_ATOMS.map((a) => ({ ...a })),
  categories: Object.entries(ATOM_CATEGORY_LABELS).map(([code, name]) => ({ code, name })),
  aliases: Object.entries(LEGACY_ALIAS_ATOMS).map(([code, atoms]) => ({
    code,
    atoms: [...atoms],
    primary: LEGACY_ALIAS_PRIMARY[code]!,
  })),
};

/** Una respuesta de `simulate` válida; cada prueba cambia lo que le importa. */
function respuesta(over: Partial<SimulateAccessResponse> = {}): SimulateAccessResponse {
  return {
    valid: true,
    validation: { errors: [], warnings: [] },
    governance: {
      sodFindings: [],
      needsFourEyes: { required: false, reasons: [] },
      privilegeScore: { before: 0, after: 6, delta: 6 },
    },
    summary: {
      plain: ['Lucía Paz podrá ver la agenda del Dr. Andrés Pérez.'],
      changes: ['Ahora podrá: ver la agenda.'],
    },
    scenarios: [],
    impact: {
      newlyAllowed: 2,
      newlyDenied: 0,
      unchanged: 5,
      challengesNew: 0,
      doctorsCovered: { before: 0, after: 1 },
      servicesCovered: { before: 0, after: 0 },
      spacesCovered: { before: 0, after: 2 },
      effectiveAtoms: { added: ['agenda.appointment.view'], removed: [] },
    },
    simulationToken: 'sim_1',
    limits: { scenarioCount: 2, truncated: false },
    evaluatedAt: '2026-10-30T10:00:00-04:00',
    ...over,
  };
}

const falla = (
  status: number,
  reason: string,
  message: string,
  details?: Record<string, unknown>,
): HttpErrorResponse =>
  new HttpErrorResponse({
    status,
    error: {
      code: status === 409 ? 'CONFLICT' : 'VALIDATION_FAILED',
      message,
      reason,
      timestamp: '',
      path: '',
      ...(details === undefined ? {} : { details }),
    },
  });

const GRANT_GUARDADO = (over: Partial<SupportGrant> = {}): SupportGrant => ({
  id: 'g-1',
  engagementId: 'e-1',
  targetKind: 'PRACTITIONER',
  practitionerRoleAssignmentId: 'd-perez',
  expansionMode: 'DYNAMIC',
  actions: ['schedule.view', 'schedule.check_in'],
  status: 'ACTIVE',
  origin: 'LEGACY',
  atoms: [
    'agenda.appointment.view',
    'agenda.appointment.view.patient_name',
    'agenda.appointment.check_in',
    'patients.search.exact',
    'patients.profile.view_basic',
  ],
  ...over,
});

describe('PermissionsEditor', () => {
  let fixture: ComponentFixture<PermissionsEditor>;
  let createGrant: ReturnType<typeof vi.fn>;
  let changeGrant: ReturnType<typeof vi.fn>;
  let simulate: ReturnType<typeof vi.fn>;
  let listEngagements: ReturnType<typeof vi.fn>;
  let confirm: ReturnType<typeof vi.fn>;
  let tokens = 0;
  beforeEach(() => {
    tokens = 0;
  });
  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byId = (id: string): HTMLElement | null => host().querySelector(`[data-testid="${id}"]`);
  const texto = (id: string): string => byId(id)?.textContent ?? '';
  const clic = (el: Element | null): void => {
    (el as HTMLElement).click();
    fixture.detectChanges();
  };
  const irAPestana = async (indice: number): Promise<void> => {
    clic(host().querySelectorAll('[role="tab"]')[indice]!);
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const desactivado = (id: string): boolean => byId(id)!.getAttribute('aria-disabled') === 'true';
  const casilla = (id: string): HTMLInputElement => byId(id)!.querySelector('input')!;

  async function montar(
    vinculo: SupportEngagement = VINCULO,
    opciones: { simulacion?: (request: SimulateAccessRequest) => unknown } = {},
  ): Promise<void> {
    createGrant = vi.fn((_id: string, g: object) =>
      of({ id: 'nuevo', engagementId: 'e-1', status: 'ACTIVE', ...g }),
    );
    changeGrant = vi.fn(() => of({}));
    listEngagements = vi.fn(() => of({ items: [vinculo] }));
    simulate = vi.fn(
      opciones.simulacion ?? (() => of(respuesta({ simulationToken: `sim_${++tokens}` }))),
    );
    confirm = vi.fn(async () => true);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'e-1' } } } },
        {
          provide: SupportAccessClient,
          useValue: { listEngagements, getCatalog: () => of(CATALOGO), createGrant, changeGrant },
        },
        {
          provide: AccessExplainClient,
          useValue: {
            simulate,
            getPermissionCatalog: () => of(CATALOGO_DE_PERMISOS),
            // El resumen de los permisos vigentes es opcional: sin él el editor sigue (la API puede tardar o fallar).
            getEngagementSummary: () => of(null),
          },
        },
        { provide: DialogService, useValue: { confirm } },
        { provide: PREVIEW_DEBOUNCE_MS, useValue: 0 },
      ],
    });
    fixture = TestBed.createComponent(PermissionsEditor);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const asentar = async (): Promise<void> => {
    await fixture.whenStable();
    fixture.detectChanges();
    // El guardado encadena promesas: se deja correr hasta que la cola se vacía.
    for (let vuelta = 0; vuelta < 3; vuelta++) {
      await new Promise<void>((listo) => setTimeout(listo, 0));
      fixture.detectChanges();
    }
  };
  const alternar = (id: string): void => clic(casilla(id));

  it('sin permisos el resumen lo dice y la vista previa no cubre a nadie', async () => {
    await montar();

    expect(texto('resumen')).toContain('Todavía no tiene ningún permiso');
    expect(byId('vista-previa-sin-doctores')).not.toBeNull();
    expect(desactivado('editor-guardar')).toBe(true);
  });

  it('elegir un doctor reescribe el resumen en lenguaje simple y la vista previa antes de guardar', async () => {
    await montar();

    clic(casilla('doctor-d-perez'));

    const resumen = texto('resumen');
    // El paquete de recepción: ver, registrar la llegada, atender sin cita y registrar pacientes. Nada de crear citas.
    expect(resumen).toContain(
      'Puede ver la agenda, registrar la llegada del paciente, atender pacientes sin cita y registrar pacientes nuevos de Dr. Andrés Pérez',
    );
    expect(resumen).toContain('No puede crear citas');
    expect(resumen).not.toMatch(/schedule\.|PRACTITIONER/);
    expect(texto('vista-previa-doctores')).toContain('Dr. Andrés Pérez');
    expect(texto('vista-previa-doctores')).toContain('Toda su agenda');
    expect(texto('vista-previa-doctores')).not.toContain('Dra. Valeria Rojas');
    expect(desactivado('editor-guardar')).toBe(false);
  });

  it('un piso cubre solo una parte de cada doctor, y la vista previa lo dice con el espacio', async () => {
    await montar();

    await irAPestana(2);
    clic(casilla('ubicacion-casilla-a-p1'));

    expect(texto('vista-previa-doctores')).toContain('Dr. Andrés Pérez');
    expect(texto('vista-previa-doctores')).toContain('Solo: Consultorio 103');
    expect(texto('vista-previa-doctores')).not.toContain('Dra. Valeria Rojas');
    expect(texto('resumen')).toContain('en Piso 1');
    expect(texto('resumen')).toContain('Incluye automáticamente lo que se agregue después.');
    // Lo que queda dentro del piso se ve marcado y no se toca.
    clic(host().querySelector('button[aria-label="Abrir Piso 1"]'));
    expect(casilla('ubicacion-casilla-a-103').checked).toBe(true);
    expect(casilla('ubicacion-casilla-a-103').disabled).toBe(true);
  });

  it('«Seleccionar todo» en un nivel con lo nuevo automático elige el padre; en modo fijo, los hijos', async () => {
    await montar();
    await irAPestana(2);

    clic(byId('nivel-a'));
    expect(casilla('ubicacion-casilla-a').checked).toBe(true);
    expect(texto('matriz-tabla')).toContain('Edificio A');

    // Se vuelve atrás y se repite en modo fijo.
    clic(casilla('ubicacion-casilla-a'));
    expect(byId('matriz-vacia')).not.toBeNull();
    clic(byId('ubicaciones-automatico')!.querySelector('input'));
    clic(byId('nivel-a'));
    expect(casilla('ubicacion-casilla-a-p1').checked).toBe(true);
    expect(casilla('ubicacion-casilla-a-p2').checked).toBe(true);
    expect(casilla('ubicacion-casilla-a').checked).toBe(false);
  });

  it('una combinación restringe: doctor × servicio cubre ese doctor solo con ese servicio', async () => {
    await montar();
    await irAPestana(3);
    // Sin los dos objetivos elegidos, no se agrega.
    expect(desactivado('combo-agregar')).toBe(true);
  });

  it('la matriz marca una acción por permiso y recalcula el resumen', async () => {
    await montar();
    clic(casilla('doctor-d-perez'));
    const fila = host()
      .querySelector('[data-testid^="quitar-nuevo-"]')!
      .getAttribute('data-testid')!
      .replace('quitar-', '');

    clic(casilla(`celda-${fila}-schedule.create`));

    expect(texto('resumen')).toContain('crear citas');
    expect(texto('resumen')).not.toContain('No puede crear citas');
  });

  it('guarda solo la diferencia: se simula el mismo permiso y se guarda con su huella (UI → petición → respuesta → recarga → UI)', async () => {
    await montar();
    clic(casilla('doctor-d-rojas'));
    await asentar();

    // La vista previa se pidió con el borrador y todavía no se guardó nada.
    expect(simulate).toHaveBeenCalledTimes(1);
    const peticion = simulate.mock.calls[0]![0] as SimulateAccessRequest;
    expect(peticion).toEqual({
      engagementId: 'e-1',
      draft: {
        mode: 'PATCH',
        grants: [
          {
            effect: 'ALLOW',
            actions: ['schedule.view', 'schedule.check_in', 'schedule.walk_in', 'patient.register'],
            targetKind: 'PRACTITIONER',
            practitionerRoleAssignmentId: 'd-rojas',
            expansionMode: 'DYNAMIC',
          },
        ],
        removeGrantIds: [],
      },
      autoScenarios: true,
    });
    expect(createGrant).not.toHaveBeenCalled();
    expect(texto('preview-summary')).toContain(
      'Lucía Paz podrá ver la agenda del Dr. Andrés Pérez.',
    );

    clic(byId('editor-guardar'));
    await asentar();

    expect(createGrant).toHaveBeenCalledTimes(1);
    expect(createGrant).toHaveBeenCalledWith('e-1', {
      targetKind: 'PRACTITIONER',
      practitionerRoleAssignmentId: 'd-rojas',
      expansionMode: 'DYNAMIC',
      actions: ['schedule.view', 'schedule.check_in', 'schedule.walk_in', 'patient.register'],
      effect: 'ALLOW',
      simulationToken: 'sim_1',
    });
    expect(changeGrant).not.toHaveBeenCalled();
    // Se volvió a leer del servidor y la pantalla quedó sin cambios.
    expect(listEngagements).toHaveBeenCalledTimes(2);
    expect(desactivado('editor-guardar')).toBe(true);
  });

  it('un permiso sin ninguna acción no se guarda: la pantalla pide marcar o quitar', async () => {
    await montar();
    clic(casilla('doctor-d-rojas'));
    const fila = host()
      .querySelector('[data-testid^="quitar-nuevo-"]')!
      .getAttribute('data-testid')!
      .replace('quitar-', '');
    for (const accion of [
      'schedule.view',
      'schedule.check_in',
      'schedule.walk_in',
      'patient.register',
    ]) {
      clic(casilla(`celda-${fila}-${accion}`));
    }

    clic(byId('editor-guardar'));

    expect(createGrant).not.toHaveBeenCalled();
    expect(byId('editor-sin-acciones')).not.toBeNull();
  });

  /* ---- vista previa obligatoria ------------------------------------------------------------------- */

  describe('vista previa', () => {
    it('no se puede guardar mientras no hay vista previa válida: con errores se listan y Guardar queda apagado', async () => {
      await montar(VINCULO, {
        simulacion: () =>
          of(
            respuesta({
              valid: false,
              simulationToken: undefined,
              validation: {
                errors: [
                  {
                    code: 'GUARDRAIL_CEILING_EXCEEDED',
                    path: 'grants[0].actions[0]',
                    message:
                      'Ver la agenda no cabe en el techo de la plantilla de esta organización.',
                  },
                ],
                warnings: [],
              },
            }),
          ),
      });
      clic(casilla('doctor-d-perez'));
      await asentar();

      expect(texto('preview-errors')).toContain(
        'no cabe en el techo de la plantilla de esta organización',
      );
      expect(desactivado('editor-guardar')).toBe(true);
      clic(byId('editor-guardar'));
      await asentar();
      expect(createGrant).not.toHaveBeenCalled();
    });

    it('muestra el resumen, lo que cambia, el impacto, los conflictos de funciones y el puntaje de privilegios', async () => {
      await montar(VINCULO, {
        simulacion: () =>
          of(
            respuesta({
              governance: {
                sodFindings: [
                  {
                    ruleCode: 'SOD-1',
                    action: 'REQUIRE_APPROVAL',
                    atoms: ['billing.payment.collect', 'agenda.appointment.create'],
                    message: 'Quien cobra no debería crear citas.',
                  },
                ],
                needsFourEyes: { required: false, reasons: [] },
                privilegeScore: { before: 8, after: 21, delta: 13 },
              },
            }),
          ),
      });
      clic(casilla('doctor-d-perez'));
      await asentar();

      expect(texto('preview-changes')).toContain('Ahora podrá: ver la agenda.');
      expect(texto('preview-impact')).toContain('2');
      expect(texto('preview-sod')).toContain('Quien cobra no debería crear citas.');
      expect(texto('preview-sod')).toContain('Pide aprobación');
      expect(texto('preview-score')).toContain('8');
      expect(texto('preview-score')).toContain('21');
      expect(byId('preview')!.getAttribute('aria-live')).toBe('polite');
    });

    it('si la política pide cuatro ojos pero no hay un átomo crítico nuevo el botón NO dice «Enviar para aprobación»: se aplica de inmediato y la pantalla lo dice (B7c, #49)', async () => {
      await montar(VINCULO, {
        simulacion: () =>
          of(
            respuesta({
              governance: {
                sodFindings: [],
                needsFourEyes: {
                  required: true,
                  reasons: ['El cambio sube el puntaje de privilegios más de 10 puntos.'],
                },
                privilegeScore: { before: 0, after: 20, delta: 20 },
              },
            }),
          ),
      });
      clic(casilla('doctor-d-perez'));
      await asentar();

      expect(texto('editor-guardar')).toContain('Guardar permisos');
      expect(texto('editor-guardar')).not.toContain('aprobación');
      expect(texto('save-status')).toContain('no lo envía a aprobar');
    });

    it('al editar de nuevo el borrador la vista previa vieja deja de valer hasta que se recalcula', async () => {
      await montar();
      clic(casilla('doctor-d-perez'));
      await asentar();
      expect(desactivado('editor-guardar')).toBe(false);

      simulate.mockImplementation(() => new Subject());
      clic(casilla('doctor-d-rojas'));
      expect(desactivado('editor-guardar')).toBe(true);
    });
  });

  /* ---- varios permisos: una huella por permiso ---------------------------------------------------- */

  it('con varios permisos cada uno se guarda con su propia huella (la del servidor es de un solo permiso)', async () => {
    await montar();
    clic(casilla('doctor-d-perez'));
    clic(casilla('doctor-d-rojas'));
    await asentar();
    simulate.mockClear();

    clic(byId('editor-guardar'));
    await asentar();

    // Una simulación por permiso, cada una con un solo permiso en el borrador.
    expect(simulate).toHaveBeenCalledTimes(2);
    for (const llamada of simulate.mock.calls)
      expect((llamada[0] as SimulateAccessRequest).draft.grants).toHaveLength(1);
    expect(createGrant).toHaveBeenCalledTimes(2);
    const usados = createGrant.mock.calls.map(
      (c) => (c[1] as { simulationToken: string }).simulationToken,
    );
    expect(new Set(usados).size).toBe(2);
  });

  /* ---- SIMULATION_STALE --------------------------------------------------------------------------- */

  it('409 SIMULATION_STALE: avisa, vuelve a simular y no pierde el borrador', async () => {
    await montar();
    clic(casilla('doctor-d-rojas'));
    await asentar();
    createGrant.mockImplementationOnce(() =>
      throwError(() => falla(409, 'SIMULATION_STALE', 'Algo cambió.')),
    );
    const antes = simulate.mock.calls.length;

    clic(byId('editor-guardar'));
    await asentar();

    expect(texto('stale-notice')).toContain('Algo cambió mientras editaba');
    expect(simulate.mock.calls.length).toBeGreaterThan(antes);
    // El borrador sigue: la fila de la doctora está en la matriz y se puede volver a guardar.
    expect(host().querySelector('[data-testid^="quitar-nuevo-"]')).not.toBeNull();
    expect(desactivado('editor-guardar')).toBe(false);
  });

  it('un 422 al guardar se explica en lenguaje simple junto al campo', async () => {
    await montar();
    clic(casilla('doctor-d-rojas'));
    await asentar();
    createGrant.mockImplementationOnce(() =>
      throwError(() =>
        falla(422, 'GUARDRAIL_CEILING_EXCEEDED', 'Cobrar no cabe en el techo.', {
          path: 'actions[0]',
        }),
      ),
    );

    clic(byId('editor-guardar'));
    await asentar();

    expect(texto('editor-error')).toContain('Cobrar no cabe en el techo.');
  });

  /* ---- 422 de condiciones (ronda 2 de la API) ----------------------------------------------------- */

  it('CONDITION_TOO_LARGE se explica en lenguaje simple (no «8 KiB») y se marca en las condiciones del permiso', async () => {
    await montar();
    clic(casilla('doctor-d-rojas'));
    clic(byId('segmentado-advanced'));
    await asentar();
    createGrant.mockImplementationOnce(() =>
      throwError(() => falla(422, 'CONDITION_TOO_LARGE', 'La condición pesa más de 8 KiB.', { path: 'condition' })),
    );
    clic(byId('editor-guardar'));
    await asentar();

    expect(texto('editor-error')).toContain('Las condiciones son demasiado largas');
    expect(texto('editor-error')).not.toContain('KiB');
  });

  it('CONDITION_NOT_APPLICABLE_TO_ATOM sin ruta explica qué hacer: marcar permisos específicos', async () => {
    await montar();
    clic(casilla('doctor-d-rojas'));
    await asentar();
    createGrant.mockImplementationOnce(() =>
      throwError(() =>
        falla(422, 'CONDITION_NOT_APPLICABLE_TO_ATOM', 'Las condiciones no aplican a permisos escritos con códigos antiguos (schedule.view).'),
      ),
    );
    clic(byId('editor-guardar'));
    await asentar();

    expect(texto('editor-error')).toContain('Esa condición no se puede aplicar a este permiso');
    expect(texto('editor-error')).not.toContain('schedule.view');
  });

  /* ---- 202: queda pendiente de aprobación, con el porqué en lenguaje simple ------------------------ */

  it.each([
    [['NEW_CRITICAL_ATOMS'], 'permisos críticos'],
    [['SCOPE_WIDENED'], 'Amplía'],
    [['VALIDITY_EXTENDED'], 'Alarga'],
    [['SCOPE_WIDENED', 'VALIDITY_EXTENDED'], 'Alarga'],
  ])('un 202 con %j se explica: %s, sin mostrar el código', async (motivos, fragmento) => {
    await montar({ ...VINCULO, grants: [GRANT_GUARDADO()] });
    const info = vi.spyOn(TestBed.inject(ToastService), 'info');
    clic(byId('segmentado-advanced'));
    await asentar();
    alternar('atom-agenda.appointment.cancel');
    await asentar();
    changeGrant.mockImplementation(() =>
      of({ status: 'PENDING_APPROVAL', approvalId: 'a-1', expiresAt: '2026-11-07T00:00:00Z', reasons: motivos, criticalAtoms: [] }),
    );

    clic(byId('editor-guardar'));
    await asentar();

    expect(info).toHaveBeenCalledTimes(1);
    const [titulo, detalle] = info.mock.calls[0]!;
    expect(titulo).toContain('pendiente de aprobación');
    expect(detalle).toContain(fragmento);
    expect(`${titulo} ${detalle}`).not.toMatch(/NEW_CRITICAL_ATOMS|SCOPE_WIDENED|VALIDITY_EXTENDED/);
    expect(detalle).toContain('no rige hasta que otra persona lo apruebe');
  });

  /* ---- F1: el guardado se corta a medias (el diálogo se cancela o la API falla) ------------------- */

  describe('un guardado que se corta a medias dice qué quedó aplicado', () => {
    it('si se cancela el diálogo de un paso extra, no hay «sin conexión»: se dice qué quedó guardado y qué falta', async () => {
      await montar(VINCULO);
      clic(casilla('doctor-d-perez'));
      clic(casilla('doctor-d-rojas'));
      await asentar();
      // El primer permiso se guarda; en el segundo la persona cierra el diálogo del paso extra.
      createGrant.mockImplementationOnce((_id: string, g: object) => of({ id: 'nuevo-1', engagementId: 'e-1', status: 'ACTIVE', ...g }));
      createGrant.mockImplementationOnce(() => throwError(() => new AccessChallengeCancelledError()));

      clic(byId('editor-guardar'));
      await asentar();

      expect(createGrant).toHaveBeenCalledTimes(2);
      const falla = texto('editor-error');
      expect(falla).toContain('canceló la verificación');
      expect(falla).not.toContain('sin conexión');
      expect(falla).not.toContain('No pudimos guardar');
      const parcial = texto('partial-notice');
      expect(parcial).toContain('Ya quedó guardado: 1 permiso nuevo');
      expect(parcial).toContain('Falta guardar: 1 permiso nuevo');
    });

    it('si se cancela antes de aplicar nada, lo dice: no se guardó ningún cambio', async () => {
      await montar(VINCULO);
      clic(casilla('doctor-d-rojas'));
      await asentar();
      createGrant.mockImplementationOnce(() => throwError(() => new AccessChallengeCancelledError()));

      clic(byId('editor-guardar'));
      await asentar();

      expect(texto('editor-error')).toContain('canceló la verificación');
      expect(texto('editor-error')).toContain('No se guardó ningún cambio');
      expect(desactivado('editor-guardar')).toBe(false);
    });

    it('una falla de la API con revocaciones ya hechas dice cuántas se aplicaron', async () => {
      await montar({ ...VINCULO, grants: [GRANT_GUARDADO()] });
      clic(byId('segmentado-advanced'));
      await asentar();
      clic(host().querySelector('[data-testid="effect-deny"] input'));
      await asentar();
      // Se retira el permiso (queda aplicado) y falla el alta de la prohibición.
      createGrant.mockImplementationOnce(() => throwError(() => new HttpErrorResponse({ status: 500, error: { statusCode: 500, code: 'INTERNAL', message: 'x', timestamp: '', path: '' } })));
      clic(byId('editor-guardar'));
      await asentar();

      expect(changeGrant).toHaveBeenCalledWith('e-1', { grantId: 'g-1', revoke: true });
      expect(texto('partial-notice')).toContain('Ya quedó guardado: 1 permiso retirado');
    });
  });

  /* ---- pendiente 69: un vencimiento ya puesto no se puede quitar ---------------------------------- */

  const campoDeVigencia = (): HTMLInputElement => {
    const el = byId('valid-to')!;
    return (el.matches('input') ? el : el.querySelector('input')) as HTMLInputElement;
  };

  it('borrar la fecha de vencimiento de un permiso guardado no la quita (la API no sabe quitarla): se vuelve a poner y se explica', async () => {
    await montar({ ...VINCULO, grants: [GRANT_GUARDADO({ validTo: '2026-12-31T23:59:00.000Z' })] });
    clic(byId('segmentado-advanced'));
    await asentar();
    const campo = campoDeVigencia();
    expect(campo.value).toBe('2026-12-31');

    campo.value = '';
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    await asentar();

    expect(campoDeVigencia().value).toBe('2026-12-31');
    expect(texto('vigencia-aviso')).toContain('No se puede quitar la fecha de vencimiento');
    expect(texto('vigencia-aviso')).toContain('quite el permiso y vuelva a darlo');
    // No hay nada que guardar: el borrador sigue igual al guardado.
    expect(desactivado('editor-guardar')).toBe(true);
  });

  it('cambiar la fecha por otra sí se puede y no avisa nada', async () => {
    await montar({ ...VINCULO, grants: [GRANT_GUARDADO({ validTo: '2026-12-31T23:59:00.000Z' })] });
    clic(byId('segmentado-advanced'));
    await asentar();
    const campo = campoDeVigencia();
    campo.value = '2026-11-30';
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    await asentar();
    expect(campoDeVigencia().value).toBe('2026-11-30');
    expect(byId('vigencia-aviso')).toBeNull();
  });

  /* ---- modo Avanzado ------------------------------------------------------------------------------ */

  describe('modo Avanzado', () => {
    async function aAvanzado(): Promise<void> {
      clic(casilla('doctor-d-perez'));
      clic(byId('segmentado-advanced'));
      await asentar();
    }

    it('empieza en «Básico» y «Avanzado» muestra los 73 permisos en 7 categorías con su sensibilidad', async () => {
      await montar();
      clic(casilla('doctor-d-perez'));
      expect(byId('advanced-panel')).toBeNull();
      expect(byId('segmentado-basic')!.getAttribute('aria-checked')).toBe('true');

      clic(byId('segmentado-advanced'));
      await asentar();
      expect(byId('advanced-panel')).not.toBeNull();
      expect(host().querySelectorAll('[data-testid^="atom-category-"]')).toHaveLength(7);
      clic(byId('atoms-expand-all'));
      await asentar();

      expect(host().querySelectorAll('[data-testid^="atom-check-"]')).toHaveLength(73);
      expect(texto('atom-badge-billing.receipt.void')).toContain('Crítica');
      expect(texto('atom-badge-agenda.appointment.view')).toContain('Baja');
      // Cada obligación se dice con palabras, no solo con un ícono.
      expect(texto('atom-tags-agenda.hours.edit')).toContain('Pide motivo');
      expect(texto('atom-tags-agenda.hours.edit')).toContain('Pide aprobación');
    });

    it('los alias antiguos se muestran como alias con el aviso «se normalizarán»', async () => {
      await montar({ ...VINCULO, grants: [GRANT_GUARDADO()] });
      clic(byId('segmentado-advanced'));
      await asentar();

      expect(texto('legacy-notice')).toContain('se normalizarán');
      expect(texto('legacy-notice')).toContain('Ver la agenda');
      expect(texto('legacy-notice')).toContain('Registrar la llegada del paciente');
    });

    it('marcar un permiso preciso convierte los alias en átomos y simula esos átomos', async () => {
      await montar();
      await aAvanzado();
      simulate.mockClear();
      clic(byId('atoms-expand-all'));
      await asentar();

      alternar('atom-check-agenda.appointment.create');
      await asentar();

      const peticion = simulate.mock.calls.at(-1)![0] as SimulateAccessRequest;
      const acciones = peticion.draft.grants[0]!.actions;
      expect(acciones).toContain('agenda.appointment.create');
      expect(acciones).toContain('agenda.appointment.view');
      expect(acciones.some((a) => a.startsWith('schedule.'))).toBe(false);
      expect(byId('legacy-notice')).toBeNull();
    });

    it('un permiso que el rol no puede dar aparece deshabilitado con la explicación', async () => {
      await montar();
      await aAvanzado();
      clic(byId('atoms-expand-all'));
      await asentar();

      expect(casilla('atom-check-team.guardrails.manage').disabled).toBe(true);
      expect(texto('atom-reason-team.guardrails.manage')).toContain(
        'Solo el administrador de seguridad',
      );
    });

    it('Permitir/Denegar: una fila en «Denegar» se simula y se guarda con effect DENY', async () => {
      await montar();
      await aAvanzado();
      simulate.mockClear();

      clic(host().querySelector('[data-testid="effect-deny"] input'));
      await asentar();
      expect(
        (simulate.mock.calls.at(-1)![0] as SimulateAccessRequest).draft.grants[0]!.effect,
      ).toBe('DENY');

      clic(byId('editor-guardar'));
      await asentar();
      expect(createGrant.mock.calls[0]![1]).toMatchObject({ effect: 'DENY' });
    });

    it('un permiso que ya existe y cambia de Permitir a Denegar se retira y se crea de nuevo', async () => {
      await montar({ ...VINCULO, grants: [GRANT_GUARDADO()] });
      clic(byId('segmentado-advanced'));
      await asentar();

      clic(host().querySelector('[data-testid="effect-deny"] input'));
      await asentar();
      const peticion = simulate.mock.calls.at(-1)![0] as SimulateAccessRequest;
      expect(peticion.draft.removeGrantIds).toEqual(['g-1']);
      clic(byId('editor-guardar'));
      await asentar();

      expect(confirm).toHaveBeenCalled();
      expect(changeGrant).toHaveBeenCalledWith('e-1', { grantId: 'g-1', revoke: true });
      expect(createGrant.mock.calls[0]![1]).toMatchObject({
        effect: 'DENY',
        practitionerRoleAssignmentId: 'd-perez',
      });
    });
  });

  /* ---- condiciones -------------------------------------------------------------------------------- */

  describe('condiciones', () => {
    async function conCondiciones(): Promise<void> {
      clic(casilla('doctor-d-perez'));
      clic(byId('segmentado-advanced'));
      await asentar();
      clic(byId('cond-toggle-when'));
      await asentar();
    }

    it('un horario armado con frases viaja en la simulación y en lo que se guarda, sin JSON a la vista', async () => {
      await montar();
      await conCondiciones();
      simulate.mockClear();

      clic(byId('cond-time-add'));
      await asentar();

      const peticion = simulate.mock.calls.at(-1)![0] as SimulateAccessRequest;
      expect(peticion.draft.grants[0]!.condition).toEqual({
        schemaVersion: 1,
        time: { windows: [{ days: [1, 2, 3, 4, 5], from: '08:00', to: '18:00' }] },
      });
      expect(texto('cond-section-when')).toContain('1 condición');
      expect(host().textContent).not.toContain('schemaVersion');

      clic(byId('editor-guardar'));
      await asentar();
      expect(createGrant.mock.calls[0]![1]).toMatchObject({
        condition: {
          schemaVersion: 1,
          time: { windows: [{ days: [1, 2, 3, 4, 5], from: '08:00', to: '18:00' }] },
        },
      });
    });

    it('«Solo desde la red de la organización» y «Solo con el doctor conectado» arman network y presence', async () => {
      await montar();
      await conCondiciones();
      clic(byId('cond-toggle-where'));
      clic(byId('cond-toggle-presence'));
      await asentar();
      simulate.mockClear();

      clic(host().querySelector('[data-testid="cond-network"] input'));
      clic(host().querySelector('[data-testid="cond-presence"] input'));
      await asentar();

      const condicion = (simulate.mock.calls.at(-1)![0] as SimulateAccessRequest).draft.grants[0]!
        .condition;
      expect(condicion).toEqual({
        schemaVersion: 1,
        network: { require: 'ORG_RULES' },
        presence: { doctor: 'ONLINE' },
      });
    });

    it('un error del servidor en la condición se marca en la sección y dice cómo arreglarlo', async () => {
      await montar(VINCULO, {
        simulacion: (req) =>
          of(
            (req.draft.grants[0]?.condition?.time?.windows.length ?? 0) > 0
              ? respuesta({
                  valid: false,
                  simulationToken: undefined,
                  validation: {
                    errors: [
                      {
                        code: 'CONDITION_TIME_EMPTY_WINDOW',
                        path: 'grants[0].condition.time.windows[0]',
                        message:
                          'Una franja empieza y termina a la misma hora: no cubre ningún momento.',
                      },
                    ],
                    warnings: [],
                  },
                })
              : respuesta(),
          ),
      });
      await conCondiciones();
      clic(byId('cond-time-add'));
      await asentar();

      expect(texto('cond-issues-when')).toContain('empieza y termina a la misma hora');
      expect(byId('cond-section-when')!.getAttribute('data-invalid')).toBe('true');
      expect(desactivado('editor-guardar')).toBe(true);
    });
  });
});
