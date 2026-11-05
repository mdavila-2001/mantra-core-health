import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AccessExplainClient } from '../../../core/data-access/access-governance/access-explain.client';
import { SupportAccessClient } from '../../../core/data-access/support-access/support-access.client';
import type { SupportGrant } from '../../../core/data-access/support-access/support-access.types';
import {
  CATALOGO,
  EXPLICACION_ANA_FUERA_DE_HORARIO,
  EXPLICACION_MARCOS,
  EXPLICACION_MARCOS_APROBADA,
  SIMULACION_CON_CAMBIOS,
  SIMULACION_CON_ERRORES,
  VINCULO_ANA,
  VINCULO_MARCOS,
  elegir,
  escribir,
  falloDeApi,
  pulsar,
} from './simulator.fixtures';
import { Simulator } from './simulator';

const PERMISO_ACTUAL: SupportGrant = {
  id: 'g-1',
  engagementId: 'eng-marcos',
  targetKind: 'PRACTITIONER',
  practitionerRoleAssignmentId: 'doc-suarez',
  practitionerName: 'Dr. Martín Suárez',
  expansionMode: 'DYNAMIC',
  actions: ['schedule.cancel'],
  status: 'ACTIVE',
  effect: 'ALLOW',
  atoms: ['agenda.appointment.cancel'],
  conditionsSummary: 'Cancelar con al menos 24 horas de anticipación.',
};

describe('Simulator', () => {
  let fixture: ComponentFixture<Simulator>;
  let explain: ReturnType<typeof vi.fn>;
  let simulate: ReturnType<typeof vi.fn>;
  let listEngagements: ReturnType<typeof vi.fn>;
  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byId = (id: string): HTMLElement | null => host().querySelector(`[data-testid="${id}"]`);
  const settle = async (): Promise<void> => {
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  async function abrir(
    query: Record<string, string> = {},
    engagements = [VINCULO_MARCOS, VINCULO_ANA],
  ): Promise<void> {
    listEngagements = vi.fn(() => of({ items: engagements }));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(query) } },
        },
        {
          provide: SupportAccessClient,
          useValue: {
            listEngagements,
            getCatalog: () => of(CATALOGO),
            listGrants: vi.fn(() => of([PERMISO_ACTUAL])),
          },
        },
        {
          provide: AccessExplainClient,
          useValue: {
            explain,
            simulate,
            getPermissionCatalog: () => throwError(() => falloDeApi(404, 'NOT_FOUND')),
          },
        },
      ],
    });
    fixture = TestBed.createComponent(Simulator);
    fixture.detectChanges();
    await settle();
  }

  beforeEach(() => {
    explain = vi.fn(() => of(EXPLICACION_MARCOS));
    simulate = vi.fn(() => of(SIMULACION_CON_CAMBIOS));
  });

  describe('estados de la pantalla', () => {
    it('sin personal de apoyo es un vacío con su próxima acción', async () => {
      await abrir({}, []);
      expect(host().textContent).toContain('Todavía no hay personal de apoyo para simular.');
      expect(host().querySelector('a[href="/administration/support-invitations"]')).not.toBeNull();
      expect(byId('explicar-panel')).toBeNull();
    });

    it('sin autoridad (403) es un muro sin acción inventada', async () => {
      listEngagements = vi.fn(() => throwError(() => falloDeApi(403, 'FORBIDDEN')));
      TestBed.configureTestingModule({
        providers: [
          provideRouter([]),
          {
            provide: SupportAccessClient,
            useValue: { listEngagements, getCatalog: () => of(CATALOGO) },
          },
          { provide: AccessExplainClient, useValue: { getPermissionCatalog: () => of(null) } },
        ],
      });
      fixture = TestBed.createComponent(Simulator);
      fixture.detectChanges();
      await settle();
      expect(byId('explicar-panel')).toBeNull();
      expect(host().textContent).not.toContain('Elija a una persona');
    });

    it('si el catálogo de doctores no carga, el simulador sigue funcionando sin esos filtros', async () => {
      listEngagements = vi.fn(() => of({ items: [VINCULO_MARCOS] }));
      TestBed.configureTestingModule({
        providers: [
          provideRouter([]),
          {
            provide: SupportAccessClient,
            useValue: {
              listEngagements,
              getCatalog: () => throwError(() => falloDeApi(500, 'INTERNAL')),
            },
          },
          {
            provide: AccessExplainClient,
            useValue: {
              explain,
              simulate,
              getPermissionCatalog: () => throwError(() => falloDeApi(500, 'INTERNAL')),
            },
          },
        ],
      });
      fixture = TestBed.createComponent(Simulator);
      fixture.detectChanges();
      await settle();
      expect(byId('explicar-panel')).not.toBeNull();
      expect(byId('explicar-doctor')).toBeNull();
    });
  });

  describe('explicar', () => {
    it('pregunta con la persona, la acción y el doctor y pinta el veredicto con la traza', async () => {
      await abrir();
      await elegir(host(), 'explicar-persona', 'Marcos Ribera', settle);
      await elegir(host(), 'explicar-accion', 'Cancelar citas', settle);
      await elegir(host(), 'explicar-doctor', 'Suárez', settle);
      await pulsar(host(), 'explicar-enviar', settle);
      expect(explain).toHaveBeenCalledTimes(1);
      expect(explain.mock.calls[0]![0]).toEqual({
        engagementId: 'eng-marcos',
        action: 'agenda.appointment.cancel',
        practitionerRoleAssignmentId: 'doc-suarez',
      });
      expect(byId('veredicto')!.getAttribute('data-efecto')).toBe('CHALLENGE');
      expect(byId('paso-7')!.textContent).toContain('Decidió aquí');
    });

    it('sin persona o sin acción no pregunta y lo dice', async () => {
      await abrir();
      await pulsar(host(), 'explicar-enviar', settle);
      expect(explain).not.toHaveBeenCalled();
      expect(host().textContent).toContain('Elija a la persona.');
      expect(host().textContent).toContain('Elija qué quiso hacer.');
    });

    it('«¿y si tuviera la aprobación?» vuelve a preguntar con assume y cambia el veredicto', async () => {
      explain.mockImplementation((req: { assume?: { approvalGranted?: boolean } }) =>
        of(req.assume?.approvalGranted === true ? EXPLICACION_MARCOS_APROBADA : EXPLICACION_MARCOS),
      );
      await abrir();
      await elegir(host(), 'explicar-persona', 'Marcos Ribera', settle);
      await elegir(host(), 'explicar-accion', 'Cancelar citas', settle);
      await pulsar(host(), 'explicar-enviar', settle);
      expect(byId('veredicto')!.textContent).toContain('Puede, pero falta un requisito');
      const si = host().querySelectorAll<HTMLElement>(
        '[data-testid="explicacion-ysi"] button[data-value="YES"]',
      );
      si[2]!.click();
      await settle();
      expect(explain).toHaveBeenCalledTimes(2);
      expect(explain.mock.calls[1]![0].assume).toEqual({ approvalGranted: true });
      expect(byId('veredicto')!.textContent).toContain('Sí puede');
      expect(byId('explicacion-supuestos')!.textContent).toContain('si tuviera la aprobación');
    });

    it('tocar un campo después de ver el resultado lo marca como de la consulta anterior, con su hora', async () => {
      await abrir();
      await elegir(host(), 'explicar-persona', 'Marcos Ribera', settle);
      await elegir(host(), 'explicar-accion', 'Cancelar citas', settle);
      await pulsar(host(), 'explicar-enviar', settle);
      expect(host().textContent).not.toContain('pueden estar atrasados');
      await elegir(host(), 'explicar-accion', 'Crear citas', settle);
      expect(host().textContent).toContain('Está viendo datos que pueden estar atrasados');
      expect(host().textContent).toContain('03/11/2026');
    });

    it('una persona inexistente o ajena se ve como «no encontrado», sin pistas', async () => {
      explain.mockReturnValue(
        throwError(() =>
          falloDeApi(
            404,
            'NOT_FOUND',
            'SUPPORT_ENGAGEMENT_NOT_FOUND',
            'Vínculo eng-zzz inexistente',
          ),
        ),
      );
      await abrir();
      await elegir(host(), 'explicar-persona', 'Marcos Ribera', settle);
      await elegir(host(), 'explicar-accion', 'Cancelar citas', settle);
      await pulsar(host(), 'explicar-enviar', settle);
      expect(byId('veredicto')).toBeNull();
      expect(host().textContent).not.toContain('eng-zzz');
    });

    it('un error del servidor muestra el código de seguimiento y deja reintentar', async () => {
      explain.mockReturnValueOnce(
        throwError(() => falloDeApi(500, 'INTERNAL', undefined, 'Falló')),
      );
      await abrir();
      await elegir(host(), 'explicar-persona', 'Ana Gutiérrez', settle);
      await elegir(host(), 'explicar-accion', 'Crear citas', settle);
      await pulsar(host(), 'explicar-enviar', settle);
      expect(host().textContent).toContain('req-123');
      explain.mockReturnValue(of(EXPLICACION_ANA_FUERA_DE_HORARIO));
      await pulsar(host(), 'explicar-enviar', settle);
      expect(byId('veredicto')!.textContent).toContain('No puede');
    });

    it('un enlace con la consulta lista la precarga pero NO la envía: exige un clic (F7)', async () => {
      await abrir({
        engagementId: 'eng-marcos',
        action: 'agenda.appointment.cancel',
        doctor: 'doc-suarez',
        ask: '1',
      });
      expect(explain).not.toHaveBeenCalled();
      expect(byId('veredicto')).toBeNull();
      expect(byId('explicar-lista')?.textContent).toContain('Pulse «Explicar»');

      await pulsar(host(), 'explicar-enviar', settle);
      expect(explain).toHaveBeenCalledTimes(1);
      expect(explain.mock.calls[0]![0]).toMatchObject({
        engagementId: 'eng-marcos',
        action: 'agenda.appointment.cancel',
        practitionerRoleAssignmentId: 'doc-suarez',
      });
      expect(byId('veredicto')).not.toBeNull();
    });

    it('un identificador de paciente mal escrito no sale al servidor', async () => {
      await abrir();
      await elegir(host(), 'explicar-persona', 'Marcos Ribera', settle);
      await elegir(host(), 'explicar-accion', 'Cancelar citas', settle);
      await escribir(host(), 'explicar-paciente', 'no-es-un-uuid', settle);
      await pulsar(host(), 'explicar-enviar', settle);
      expect(explain).not.toHaveBeenCalled();
      expect(host().textContent).toContain('no tiene el formato esperado');
    });
  });

  describe('simular', () => {
    async function irAlBorrador(): Promise<void> {
      const pestanas = Array.from(host().querySelectorAll<HTMLElement>('[role="tab"]'));
      pestanas.find((p) => p.textContent?.includes('¿Qué pasa si cambio permisos?'))!.click();
      await settle();
    }

    it('arma un borrador, simula y compara antes y después con símbolo y palabras', async () => {
      await abrir();
      await irAlBorrador();
      await elegir(host(), 'borrador-persona', 'Marcos Ribera', settle);
      expect(byId('borrador-actuales')!.textContent).toContain('Cancelar con al menos 24 horas');
      await elegir(host(), 'borrador-permiso', 'Cobrar la atención', settle);
      await pulsar(host(), 'borrador-agregar', settle);
      expect(byId('borrador-items')!.textContent).toContain('Permitir: Cobrar la atención');
      await pulsar(host(), 'borrador-simular', settle);
      expect(simulate).toHaveBeenCalledTimes(1);
      expect(simulate.mock.calls[0]![0]).toEqual({
        engagementId: 'eng-marcos',
        draft: {
          mode: 'PATCH',
          grants: [{ effect: 'ALLOW', actions: ['billing.payment.collect'] }],
          removeGrantIds: [],
        },
        autoScenarios: true,
      });
      expect(byId('simulacion-veredicto')!.getAttribute('data-valido')).toBe('true');
      expect(host().querySelectorAll('[data-testid="simulacion-casos"] tbody tr').length).toBe(3);
      expect(byId('caso-1')!.textContent).toContain('Ahora sí puede');
      expect(byId('caso-2')!.textContent).toContain('Ya no puede');
      expect(byId('caso-0')!.textContent).toContain('Sin cambio');
      expect(byId('impacto-ya-no-puede')!.textContent).toContain('1');
      expect(byId('simulacion-puntaje')!.textContent).toContain('41 → 56');
      expect(byId('simulacion-cuatro-ojos')!.textContent).toContain(
        'Necesita la aprobación de otra persona',
      );
    });

    it('«solo lo que cambia» oculta los casos sin cambio', async () => {
      await abrir();
      await irAlBorrador();
      await elegir(host(), 'borrador-persona', 'Marcos Ribera', settle);
      await elegir(host(), 'borrador-permiso', 'Cobrar la atención', settle);
      await pulsar(host(), 'borrador-agregar', settle);
      await pulsar(host(), 'borrador-simular', settle);
      await pulsar(host(), 'segmentado-CHANGES', settle);
      expect(host().querySelectorAll('[data-testid="simulacion-casos"] tbody tr').length).toBe(2);
      expect(byId('caso-0')).toBeNull();
    });

    it('quitar un permiso actual viaja como removeGrantIds', async () => {
      await abrir();
      await irAlBorrador();
      await elegir(host(), 'borrador-persona', 'Marcos Ribera', settle);
      (byId('quitar-g-1')!.querySelector('input') as HTMLInputElement).click();
      await settle();
      await pulsar(host(), 'borrador-simular', settle);
      expect(simulate.mock.calls[0]![0].draft).toEqual({
        mode: 'PATCH',
        grants: [],
        removeGrantIds: ['g-1'],
      });
    });

    it('un borrador con errores dice qué corregir y no se confunde con uno válido', async () => {
      simulate.mockReturnValue(of(SIMULACION_CON_ERRORES));
      await abrir();
      await irAlBorrador();
      await elegir(host(), 'borrador-persona', 'Marcos Ribera', settle);
      await elegir(host(), 'borrador-permiso', 'Cobrar la atención', settle);
      await pulsar(host(), 'borrador-agregar', settle);
      await pulsar(host(), 'borrador-simular', settle);
      expect(byId('simulacion-veredicto')!.getAttribute('data-valido')).toBe('false');
      expect(byId('simulacion-veredicto')!.textContent).toContain('Este cambio tiene errores');
      expect(byId('simulacion-errores')!.textContent).toContain('no cabe en el techo');
    });

    it('un borrador vacío no se simula', async () => {
      await abrir();
      await irAlBorrador();
      await elegir(host(), 'borrador-persona', 'Marcos Ribera', settle);
      await pulsar(host(), 'borrador-simular', settle);
      expect(simulate).not.toHaveBeenCalled();
      expect(byId('borrador-vacio')).not.toBeNull();
    });

    it('un caso propio lleva «¿Por qué?»: pasa a explicar con el caso listo y lo pregunta', async () => {
      await abrir();
      await irAlBorrador();
      await elegir(host(), 'borrador-persona', 'Marcos Ribera', settle);
      await elegir(host(), 'borrador-permiso', 'Cobrar la atención', settle);
      await pulsar(host(), 'borrador-agregar', settle);
      await elegir(host(), 'caso-accion', 'Cancelar citas', settle);
      await pulsar(host(), 'caso-enviar', settle);
      expect(byId('borrador-casos')!.textContent).toContain('Cancelar citas');
      await pulsar(host(), 'borrador-simular', settle);
      expect(simulate.mock.calls[0]![0].scenarios).toEqual([
        { label: 'Cancelar citas', action: 'agenda.appointment.cancel' },
      ]);
      await pulsar(host(), 'caso-por-que-0', settle);
      expect(explain).toHaveBeenCalledTimes(1);
      expect(explain.mock.calls[0]![0]).toMatchObject({
        engagementId: 'eng-marcos',
        action: 'agenda.appointment.cancel',
      });
      expect(byId('veredicto')).not.toBeNull();
    });
  });
});
