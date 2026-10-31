import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { AccessLifecycleClient } from '../../../../core/data-access/access-governance/access-lifecycle.client';
import {
  aprobaciones,
  casosDeCicloDeVida,
  GENTE,
  metaDeVinculo,
} from '../../../../core/mock/fixtures/support-hospital-governance';
import { permisos, vinculos } from '../../../../core/mock/fixtures/support-hospital';
import { uuid } from '../../../../core/mock/mock-store';
import {
  abrirElSimulador,
  escribirEn,
  esperarHasta,
  porId,
  textoDe,
  tocar,
} from '../../../../../testing/gobierno-simulador';
import { chooseSelectOption } from '../../../../../testing/select';
import { OffboardEngagement } from './offboard-dialog';

// La primera petición carga el simulador y su validador de contrato: tarda más que una prueba de componente común.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

describe('OffboardEngagement', () => {
  const sim = abrirElSimulador('hospital_piloto');
  let fixture: ComponentFixture<OffboardEngagement>;
  let engagementId = GENTE.pablo.engagementId;

  let configured = false;
  const configurar = (): void => {
    if (configured) return;
    configured = true;
    TestBed.configureTestingModule({
      providers: [
        ...sim.providers,
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => engagementId } } },
        },
      ],
    });
    sim.iniciarSesion();
  };
  const abrir = async (): Promise<void> => {
    configurar();
    fixture = TestBed.createComponent(OffboardEngagement);
    document.body.appendChild(fixture.nativeElement);
    await esperarHasta(
      fixture,
      () =>
        porId('offboard-status') !== null ||
        document.body.querySelector('app-empty-state, [role="alert"]') !== null,
    );
  };
  const pestana = async (nombre: string): Promise<void> => {
    const boton = Array.from(
      document.body.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
    ).find((b) => b.textContent!.includes(nombre))!;
    boton.click();
    await esperarHasta(fixture, () => boton.getAttribute('aria-selected') === 'true');
  };
  const continuar = async (): Promise<void> => tocar(fixture, 'offboard-next');

  beforeEach(() => {
    TestBed.resetTestingModule();
    configured = false;
    sim.reiniciar();
    engagementId = GENTE.pablo.engagementId;
    configurar();
  });
  afterEach(() => {
    fixture?.nativeElement.remove();
    fixture?.destroy();
    vi.restoreAllMocks();
  });
  afterAll(() => sim.cerrar());

  it('paso 1: dice qué tiene en las manos, por tipo y con su cantidad', async () => {
    await abrir();
    expect(textoDe('offboard-status')).toContain('Pablo Mamani · vínculo activo');
    expect(textoDe('offboard-count-CONVERSATION')).toContain('3 conversaciones');
    expect(textoDe('offboard-count-TASK')).toContain('2 tareas abiertas');
    expect(textoDe('offboard-count-PENDING_APPOINTMENT')).toContain('1 cita pendiente');
    expect(textoDe('offboard-count-PENDING_APPOINTMENT')).toContain('Las citas se mantienen');
  });

  it('da de baja con traspaso de punta a punta: revoca primero, reasigna después, y deja el registro de transferencia', async () => {
    const offboard = vi.spyOn(TestBed.inject(AccessLifecycleClient), 'offboard');
    await abrir();
    await continuar();
    for (const kind of ['CONVERSATION', 'TASK', 'PENDING_APPOINTMENT']) {
      await chooseSelectOption(fixture, porId(`handover-target-${kind}`)!, 'Lucía Paz');
    }
    await continuar();
    expect(textoDe('offboard-fixed-text')).toContain(
      'El acceso termina ahora. Las citas se mantienen y su gestión pasa a la recepción.',
    );

    await tocar(fixture, 'offboard-confirm');
    expect(offboard).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Escriba al menos 5 caracteres');

    await escribirEn(fixture, 'offboard-reason', 'Renuncia de Pablo');
    await tocar(fixture, 'offboard-confirm');
    await esperarHasta(fixture, () => porId('offboard-result') !== null);

    expect(offboard).toHaveBeenCalledWith(engagementId, {
      reason: 'Renuncia de Pablo',
      handover: { defaultToUserId: GENTE.lucia.userId },
    });
    expect(textoDe('offboard-result')).toContain(
      'primero se revocó y después se reasignó el trabajo',
    );
    expect(textoDe('offboard-result')).toContain('No quedó nada pendiente.');
    const caso = casosDeCicloDeVida.filtrar(
      (c) => c.kind === 'LEAVER' && c.engagementId === engagementId,
    )[0]!;
    expect(caso.handover.every((h) => h.toUserId === GENTE.lucia.userId)).toBe(true);
    expect(porId('offboard-case-link')!.getAttribute('href')).toBe(
      `/administration/access-governance/lifecycle/${caso.id}`,
    );
    // La recarga trae lo guardado: terminó el vínculo y se revocaron los permisos.
    expect(vinculos.get(engagementId)!.status).toBe('ENDED');
    expect(
      permisos.filtrar((p) => p.engagementId === engagementId && p.status === 'ACTIVE'),
    ).toHaveLength(0);
    await esperarHasta(fixture, () => textoDe('offboard-status').includes('terminado'));
  });

  it('«Solo dar de baja ahora» corta primero y deja el traspaso abierto en el caso, a la vista', async () => {
    const offboard = vi.spyOn(TestBed.inject(AccessLifecycleClient), 'offboard');
    await abrir();
    await continuar();
    await continuar();
    await escribirEn(fixture, 'offboard-reason', 'Corte inmediato por seguridad');
    await tocar(fixture, 'offboard-only');
    await esperarHasta(fixture, () => porId('offboard-result') !== null);
    expect(offboard).toHaveBeenCalledWith(engagementId, {
      reason: 'Corte inmediato por seguridad',
      handover: null,
    });
    expect(textoDe('offboard-result')).toContain(
      'Quedan 6 elementos por traspasar: el caso sigue abierto.',
    );
    expect(vinculos.get(engagementId)!.status).toBe('ENDED');
  });

  it('si supervisaba cuentas, exige elegir el nuevo dueño antes de continuar y lo manda en el traspaso', async () => {
    engagementId = GENTE.sofia.engagementId;
    await abrir();
    const offboard = vi.spyOn(TestBed.inject(AccessLifecycleClient), 'offboard');
    expect(textoDe('offboard-count-SUPERVISED_ACCOUNT')).toContain('2 cuentas que supervisaba');
    await continuar();
    await continuar();
    expect(textoDe('offboard-issues')).toContain(
      'Elija quién será responsable de las 2 cuentas que esta persona supervisaba.',
    );
    await chooseSelectOption(fixture, porId('handover-owner')!, 'Mario Salvatierra');
    await continuar();
    await escribirEn(fixture, 'offboard-reason', 'Cambio de jefatura');
    await tocar(fixture, 'offboard-confirm');
    await esperarHasta(fixture, () => porId('offboard-result') !== null);
    expect(offboard.mock.calls[0]![1].handover).toEqual({ supervisedTo: GENTE.mario.userId });
    expect(metaDeVinculo.get(GENTE.marcos.engagementId)!.supervisorUserId).toBe(GENTE.mario.userId);
  });

  it('suspende en el acto sin aprobación y, suspendida, lo que se ofrece es pedir la reactivación con cuatro ojos', async () => {
    await abrir();
    await pestana('Suspender o reactivar');
    expect(porId('reactivate-form')).toBeNull();
    await chooseSelectOption(fixture, porId('suspend-reason-code')!, 'Licencia o ausencia');
    await tocar(fixture, 'suspend-submit');
    await esperarHasta(fixture, () => porId('reactivate-form') !== null);
    expect(vinculos.get(engagementId)!.status).toBe('SUSPENDED');
    expect(textoDe('suspend-result')).toContain('Su acceso se cortó ahora');
    expect(textoDe('offboard-status')).toContain('suspendido');

    await tocar(fixture, 'reactivate-submit');
    expect(document.body.textContent).toContain('Escriba al menos 5 caracteres');
    await escribirEn(fixture, 'reactivate-reason', 'Volvió de su licencia');
    await tocar(fixture, 'reactivate-submit');
    await esperarHasta(fixture, () => porId('reactivate-result') !== null);
    expect(textoDe('reactivate-result')).toContain(
      'Otra persona debe aprobarla; hasta entonces sigue suspendida.',
    );
    expect(vinculos.get(engagementId)!.status).toBe('SUSPENDED');
    expect(
      aprobaciones.filtrar((a) => a.kind === 'REACTIVATION' && a.status === 'PENDING'),
    ).toHaveLength(1);
    expect(porId('reactivate-approvals-link')!.getAttribute('href')).toBe(
      '/administration/access-governance/approvals',
    );
  });

  it('S6 y S3: un vínculo que no existe no dice nada; uno ya terminado explica que no hay nada más que hacer', async () => {
    engagementId = uuid('no-existe');
    await abrir();
    expect(document.body.textContent).toContain('No encontramos lo que busca');
    fixture.destroy();
    fixture.nativeElement.remove();

    engagementId = GENTE.mario.engagementId;
    vinculos.actualizar(engagementId, { status: 'ENDED' });
    fixture = TestBed.createComponent(OffboardEngagement);
    document.body.appendChild(fixture.nativeElement);
    await esperarHasta(fixture, () => document.body.textContent!.includes('ya está dada de baja'));
  });
});
