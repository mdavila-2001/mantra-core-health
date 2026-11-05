import { HttpErrorResponse } from '@angular/common/http';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { throwError } from 'rxjs';
import { vi } from 'vitest';

import { AccessLifecycleClient } from '../../../../core/data-access/access-governance/access-lifecycle.client';
import {
  casosDeCicloDeVida,
  GENTE,
  TRASPASO_DE_PABLO,
} from '../../../../core/mock/fixtures/support-hospital-governance';
import { uuid } from '../../../../core/mock/mock-store';
import {
  abrirElSimulador,
  esperarHasta,
  porId,
  textoDe,
  tocar,
} from '../../../../../testing/gobierno-simulador';
import { chooseSelectOption } from '../../../../../testing/select';
import { LifecycleCase } from './lifecycle-case';

// La primera petición carga el simulador y su validador de contrato: tarda más que una prueba de componente común.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const NORA_CASE = uuid('demo-gov-case-nora-joiner');

describe('LifecycleCase', () => {
  const sim = abrirElSimulador('hospital_piloto');
  let fixture: ComponentFixture<LifecycleCase>;

  let currentCaseId = '';
  let configured = false;
  const configurar = (caseId: string): void => {
    currentCaseId = caseId;
    if (configured) return;
    configured = true;
    TestBed.configureTestingModule({
      providers: [
        ...sim.providers,
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => currentCaseId } } },
        },
      ],
    });
    sim.iniciarSesion();
  };
  const abrir = async (): Promise<void> => {
    fixture = TestBed.createComponent(LifecycleCase);
    document.body.appendChild(fixture.nativeElement);
    await esperarHasta(
      fixture,
      () =>
        porId('case-kind') !== null ||
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

  beforeEach(() => {
    TestBed.resetTestingModule();
    configured = false;
    sim.reiniciar();
    configurar(NORA_CASE);
  });
  afterEach(() => {
    fixture?.nativeElement.remove();
    fixture?.destroy();
    vi.restoreAllMocks();
  });
  afterAll(() => sim.cerrar());

  it('muestra el ingreso de Nora con lo que falta, cómo se completa cada paso y su plazo', async () => {
    configurar(NORA_CASE);
    await abrir();
    expect(document.body.querySelector('h1')!.textContent).toContain('Ingreso de Nora Villarroel');
    expect(textoDe('case-status')).toBe('Abierto');
    expect(textoDe('case-due')).toMatch(/^Vence en \d+ días?$/);
    expect(textoDe('checklist-progress')).toBe('1 de 3 pasos obligatorios completos.');
    expect(textoDe('step-status-IDENTITY_VERIFIED')).toContain('Hecho');
    expect(textoDe('step-status-SUPERVISOR_ASSIGNED')).toBe('Pendiente');
    expect(textoDe('step-SUPERVISOR_ASSIGNED')).toContain('Dueño de la cuenta asignado');
    // El compromiso de confidencialidad lo acepta la propia persona: no hay botón, y se dice.
    expect(textoDe('step-auto-CONFIDENTIALITY_ACK')).toBe(
      'Este paso se completa solo: no hace falta que usted haga nada.',
    );
    expect(porId('step-done-CONFIDENTIALITY_ACK')).toBeNull();
  });

  it('asigna el dueño de la cuenta de punta a punta: petición, recarga y el paso queda hecho', async () => {
    const put = vi.spyOn(TestBed.inject(AccessLifecycleClient), 'putOwner');
    configurar(NORA_CASE);
    await abrir();

    await tocar(fixture, 'owner-assign');
    expect(put).not.toHaveBeenCalled();
    expect(textoDe('case-failure')).toContain('Elija quién será responsable de la cuenta.');

    await chooseSelectOption(fixture, porId('owner-select')!, 'Sofía Camacho');
    await tocar(fixture, 'owner-assign');
    await esperarHasta(fixture, () =>
      textoDe('step-status-SUPERVISOR_ASSIGNED').startsWith('Hecho'),
    );
    expect(put).toHaveBeenCalledWith(GENTE.nora.engagementId, {
      supervisorUserId: GENTE.sofia.userId,
    });
    expect(textoDe('case-notice')).toContain(
      'Sofía Camacho es ahora responsable de la cuenta de Nora Villarroel.',
    );
    expect(textoDe('checklist-progress')).toBe('2 de 3 pasos obligatorios completos.');
    expect(porId('owner-assign')).toBeNull();
  });

  it('el dueño que la API no admite se explica en lenguaje simple y el paso sigue pendiente', async () => {
    const error = new HttpErrorResponse({
      status: 422,
      error: {
        statusCode: 422,
        code: 'PRECONDITION_FAILED',
        message: 'x',
        reason: 'OWNER_NOT_ELIGIBLE',
        details: { reason: 'OWNER_NOT_ELIGIBLE' },
        timestamp: '',
        path: '/x',
      },
    });
    configurar(NORA_CASE);
    vi.spyOn(TestBed.inject(AccessLifecycleClient), 'putOwner').mockReturnValue(
      throwError(() => error),
    );
    await abrir();
    await chooseSelectOption(fixture, porId('owner-select')!, 'Mario Salvatierra');
    await tocar(fixture, 'owner-assign');
    await esperarHasta(fixture, () => porId('case-failure') !== null);
    expect(textoDe('case-failure')).toContain('Esa persona no puede ser responsable de la cuenta.');
    expect(textoDe('step-status-SUPERVISOR_ASSIGNED')).toBe('Pendiente');
  });

  it('un paso manual sin acción propia se marca como hecho y un paso automático se explica sin botón', async () => {
    const done = vi.spyOn(TestBed.inject(AccessLifecycleClient), 'completeChecklistItem');
    const caso = casosDeCicloDeVida.get(NORA_CASE)!;
    casosDeCicloDeVida.actualizar(NORA_CASE, {
      checklist: [
        ...caso.checklist,
        {
          code: 'SCOPE_REVIEWED',
          label: 'SCOPE_REVIEWED',
          required: true,
          completion: 'MANUAL',
          status: 'PENDING',
        },
      ],
    });
    configurar(NORA_CASE);
    await abrir();
    await tocar(fixture, 'step-done-SCOPE_REVIEWED');
    await esperarHasta(fixture, () => textoDe('step-status-SCOPE_REVIEWED').startsWith('Hecho'));
    expect(done).toHaveBeenCalledWith(NORA_CASE, 'SCOPE_REVIEWED');
    expect(textoDe('case-notice')).toContain(
      '«Alcance revisado sin conflictos de funciones» quedó marcado como hecho.',
    );
  });

  it('la baja de Pablo sin traspaso queda abierta: se ve lo pendiente y se pasa a otra persona, y la lista de verificación cierra el caso', async () => {
    // Pablo: baja inmediata sin traspaso (el caso queda abierto con todo pendiente).
    const lifecycle = TestBed.inject(AccessLifecycleClient);
    configurar(NORA_CASE);
    let caseId = '';
    await new Promise<void>((resolve) =>
      lifecycle
        .offboard(GENTE.pablo.engagementId, { reason: 'Renuncia de Pablo', handover: null })
        .subscribe((r) => {
          caseId = r.caseId!;
          resolve();
        }),
    );
    currentCaseId = caseId;
    await abrir();
    expect(textoDe('case-kind')).toBe('Baja');
    await pestana('Traspaso');
    expect(textoDe('handover-empty')).toContain('Todavía no hay trabajo traspasado');
    expect(porId('handover-recipient')).not.toBeNull();

    await tocar(fixture, 'handover-assign');
    expect(textoDe('case-failure')).toContain('Elija quién recibe el trabajo pendiente.');

    const assign = vi.spyOn(lifecycle, 'assignHandover');
    await chooseSelectOption(fixture, porId('handover-recipient')!, 'Lucía Paz');
    await tocar(fixture, 'handover-assign');
    await esperarHasta(fixture, () => textoDe('case-status') === 'Completado');
    expect(assign).toHaveBeenCalledWith(caseId, { defaultToUserId: GENTE.lucia.userId });
    expect(textoDe('case-notice')).toContain('el trabajo pendiente quedó reasignado');
    expect(porId('handover-recipient')).toBeNull();
    expect(TRASPASO_DE_PABLO).toHaveLength(6);
  });

  it('el registro de transferencia se exporta y muestra su huella de verificación', async () => {
    configurar(NORA_CASE);
    await abrir();
    await pestana('Registro');
    expect(textoDe('case-record')).toContain('Ingreso a enfermería de Internación');
    await tocar(fixture, 'case-export');
    await esperarHasta(fixture, () => porId('case-exported') !== null);
    expect(textoDe('case-exported')).toMatch(/Huella de verificación: [0-9a-f]{64}/);
  });

  it('un caso que no existe es S6: no dice si existe ni a quién pertenece', async () => {
    configurar(uuid('caso-que-no-existe'));
    await abrir();
    expect(document.body.textContent).toContain('No encontramos lo que busca');
    expect(document.body.querySelector('h1')!.textContent).toContain('Caso de ciclo de vida');
  });

  it('S9: un error inesperado trae el código de soporte', async () => {
    configurar(NORA_CASE);
    vi.spyOn(TestBed.inject(AccessLifecycleClient), 'getCase').mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 500,
            error: {
              statusCode: 500,
              code: 'INTERNAL',
              message: 'x',
              correlationId: 'req-555',
              timestamp: '',
              path: '/x',
            },
          }),
      ),
    );
    await abrir();
    expect(document.body.textContent).toContain('req-555');
  });
});
