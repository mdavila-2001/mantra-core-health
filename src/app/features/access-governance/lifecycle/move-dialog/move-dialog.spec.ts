import { HttpErrorResponse } from '@angular/common/http';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { throwError } from 'rxjs';
import { vi } from 'vitest';

import { AccessExplainClient } from '../../../../core/data-access/access-governance/access-explain.client';
import { AccessLifecycleClient } from '../../../../core/data-access/access-governance/access-lifecycle.client';
import { GENTE, aprobaciones } from '../../../../core/mock/fixtures/support-hospital-governance';
import { permisos, vinculos } from '../../../../core/mock/fixtures/support-hospital';
import { uuid } from '../../../../core/mock/mock-store';
import {
  abrirElSimulador,
  escribirEn,
  esperarHasta,
  marcar,
  porId,
  textoDe,
  tocar,
} from '../../../../../testing/gobierno-simulador';
import { chooseSelectOption } from '../../../../../testing/select';
import { MoveEngagement } from './move-dialog';

// La primera petición carga el simulador y su validador de contrato: tarda más que una prueba de componente común.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

describe('MoveEngagement', () => {
  const sim = abrirElSimulador('hospital_piloto');
  let fixture: ComponentFixture<MoveEngagement>;
  let engagementId = GENTE.marcos.engagementId;
  const liveGrants = (): string[] =>
    permisos
      .filtrar((p) => p.engagementId === engagementId && p.status === 'ACTIVE')
      .map((p) => p.id);
  const composers = (): HTMLElement[] =>
    Array.from(document.body.querySelectorAll<HTMLElement>('[data-testid$="-composer"]'));

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
    fixture = TestBed.createComponent(MoveEngagement);
    document.body.appendChild(fixture.nativeElement);
    await esperarHasta(
      fixture,
      () =>
        porId('move-simulate') !== null ||
        document.body.querySelector('app-empty-state, [role="alert"]') !== null,
    );
  };
  const verVistaPrevia = async (): Promise<void> => {
    await tocar(fixture, 'move-simulate');
    await esperarHasta(fixture, () => porId('move-preview') !== null);
  };
  const desafio = async (): Promise<void> => {
    await esperarHasta(fixture, () => porId('desafio-codigo') !== null);
    await escribirEn(fixture, 'desafio-codigo', '123456');
    await tocar(fixture, 'desafio-verificar');
  };

  beforeEach(() => {
    TestBed.resetTestingModule();
    configured = false;
    sim.reiniciar();
    engagementId = GENTE.marcos.engagementId;
    configurar();
  });
  afterEach(() => {
    fixture?.nativeElement.remove();
    fixture?.destroy();
    document.body
      .querySelectorAll('app-access-challenge-dialog')
      .forEach((n) => n.parentElement?.remove());
    vi.restoreAllMocks();
  });
  afterAll(() => sim.cerrar());

  it('arranca con el rol y los permisos vigentes como borrador y no deja confirmar sin ver la vista previa', async () => {
    configurar();
    await abrir();
    expect(document.body.querySelector('h1')!.textContent).toContain(
      'Cambiar de rol o alcance: Marcos Ribera',
    );
    expect(composers().length).toBe(liveGrants().length);
    expect(composers().length).toBeGreaterThan(0);
    expect(textoDe('move-promises')).toContain('Lo anterior vence ahora.');
    expect(porId('move-confirm')!.getAttribute('aria-disabled')).toBe('true');
    expect(textoDe('move-needs-preview')).toContain('Primero vea la vista previa');
  });

  it('simula el conjunto nuevo antes de guardar: muestra validez, resumen, impacto y puntaje; cualquier edición deja la vista previa atrasada', async () => {
    const simulate = vi.spyOn(TestBed.inject(AccessExplainClient), 'simulate');
    configurar();
    await abrir();
    await verVistaPrevia();
    expect(simulate).toHaveBeenCalledTimes(1);
    expect(simulate.mock.calls[0]![0]).toMatchObject({ engagementId, draft: { mode: 'REPLACE' } });
    expect(simulate.mock.calls[0]![0].draft.grants).toHaveLength(liveGrants().length);
    expect(textoDe('move-preview-valid')).toContain('El cambio es válido');
    expect(textoDe('move-preview-score')).toMatch(/Puntaje de privilegios: \d+ → \d+ \(\+?-?\d+\)/);
    expect(porId('move-preview-impact')).not.toBeNull();
    expect(textoDe('move-preview-immediate')).toContain('Se aplica de inmediato');
    expect(textoDe('move-confirm')).toBe('Aplicar el cambio');

    await tocar(
      fixture,
      `move-grant-${composers()[0]!.getAttribute('data-testid')!.split('-composer')[0]!.replace('move-grant-', '')}-remove`,
    );
    expect(porId('move-preview-outdated')).not.toBeNull();
    expect(porId('move-confirm')!.getAttribute('aria-disabled')).toBe('true');
  });

  it('aplica el cambio de punta a punta (200): motivo, segundo paso en el diálogo, petición con la huella, resultado y recarga', async () => {
    const move = vi.spyOn(TestBed.inject(AccessLifecycleClient), 'move');
    configurar();
    await abrir();
    const antes = liveGrants();
    expect(antes.length).toBeGreaterThan(0);

    // Cambia el rol y quita el primer permiso.
    await chooseSelectOption(fixture, porId('move-template')!, 'Recepción');
    const firstDraft = composers()[0]!.getAttribute('data-testid')!.replace('-composer', '');
    await tocar(fixture, `${firstDraft}-remove`);
    await verVistaPrevia();

    await escribirEn(fixture, 'move-reason', 'corto');
    expect(porId('move-confirm')).not.toBeNull();
    (porId('move-confirm') as HTMLButtonElement).click();
    await esperarHasta(fixture, () =>
      document.body.textContent!.includes('Escriba al menos 10 caracteres'),
    );
    expect(move).not.toHaveBeenCalled();

    await escribirEn(fixture, 'move-reason', 'La persona pasa a recepción del piso 1');
    await tocar(fixture, 'move-confirm');
    await desafio();
    await esperarHasta(
      fixture,
      () => porId('move-result') !== null && textoDe('move-result') !== '',
    );

    expect(move).toHaveBeenCalledTimes(2);
    const request = move.mock.calls.at(-1)![1];
    expect(move.mock.calls.at(-1)![0]).toBe(engagementId);
    expect(request).toMatchObject({
      reason: 'La persona pasa a recepción del piso 1',
      newTemplateCode: 'FRONT_DESK',
    });
    expect(request.simulationToken).toMatch(/^sim_/);
    expect(request.grants).toHaveLength(antes.length - 1);
    expect(textoDe('move-result')).toContain('El cambio ya está aplicado');
    expect(porId('move-case-link')!.getAttribute('href')).toContain(
      '/administration/access-governance/lifecycle/',
    );

    // La recarga trae lo guardado: lo anterior venció y el rol cambió.
    expect(vinculos.get(engagementId)!.roleTemplate).toBe('FRONT_DESK');
    expect(antes.every((id) => permisos.get(id)!.status === 'REVOKED')).toBe(true);
    await esperarHasta(fixture, () => composers().length === antes.length - 1);
    expect(porId('move-reason')!.querySelector('textarea')!.value).toBe('');
  });

  it('si el cambio sube mucho el privilegio responde 202: el botón dice «Enviar para aprobación», nada cambia y queda pendiente', async () => {
    sim.conPasoExtra();
    configurar();
    await abrir();
    const antes = liveGrants();
    const firstDraft = composers()[0]!.getAttribute('data-testid')!.replace('-composer', '');
    // Exportar reportes y ver los tableros de gobierno suman tres permisos de sensibilidad alta (+15 puntos).
    for (const categoria of ['Reportes', 'Auditoría y explicación']) {
      const boton = Array.from(
        document.body.querySelectorAll<HTMLButtonElement>('.accordion-panel__trigger'),
      ).find((b) => b.textContent!.includes(categoria))!;
      boton.click();
      await fixture.whenStable();
      fixture.detectChanges();
    }
    for (const code of [
      'reports.agenda.export',
      'reports.billing.export',
      'audit.reports.governance.view',
    ]) {
      await marcar(fixture, `${firstDraft}-atom-${code}`, true);
    }
    await verVistaPrevia();
    expect(porId('move-preview-valid')).not.toBeNull();
    expect(textoDe('move-preview-four-eyes')).toContain('Necesita la aprobación de otra persona');
    expect(textoDe('move-preview-four-eyes')).toContain(
      'sube el puntaje de privilegios más de 10 puntos',
    );
    expect(textoDe('move-confirm')).toBe('Enviar para aprobación');

    await escribirEn(fixture, 'move-reason', 'Marcos cubrirá la caja del servicio');
    await tocar(fixture, 'move-confirm');
    await esperarHasta(fixture, () => porId('move-result') !== null);
    expect(textoDe('move-result')).toContain('Queda pendiente de aprobación');
    expect(textoDe('move-result')).toContain('nada cambió');
    expect(porId('move-approvals-link')!.getAttribute('href')).toBe(
      '/administration/access-governance/approvals',
    );
    expect(liveGrants()).toEqual(antes);
    expect(
      aprobaciones.filtrar((a) => a.kind === 'ENGAGEMENT_MOVE' && a.status === 'PENDING'),
    ).toHaveLength(1);
  });

  it('si la huella ya no vale (SIMULATION_STALE) lo explica y pide ver la vista previa otra vez', async () => {
    sim.conPasoExtra();
    const error = new HttpErrorResponse({
      status: 409,
      error: {
        statusCode: 409,
        code: 'CONFLICT',
        message: 'x',
        reason: 'SIMULATION_STALE',
        details: { reason: 'SIMULATION_STALE' },
        timestamp: '',
        path: '/x',
      },
    });
    vi.spyOn(TestBed.inject(AccessLifecycleClient), 'move').mockReturnValue(
      throwError(() => error),
    );
    configurar();
    await abrir();
    await verVistaPrevia();
    await escribirEn(fixture, 'move-reason', 'Cambio de rol sin cambios de fondo');
    await tocar(fixture, 'move-confirm');
    await esperarHasta(fixture, () => porId('move-failure') !== null);
    expect(textoDe('move-failure')).toContain(
      'Algo cambió mientras editaba. Revise la vista previa y vuelva a guardar.',
    );
    expect(porId('move-preview')).toBeNull();
  });

  it('un conflicto de funciones sin excepción se explica y lleva a pedir la excepción', async () => {
    sim.conPasoExtra();
    const error = new HttpErrorResponse({
      status: 409,
      error: {
        statusCode: 409,
        code: 'CONFLICT',
        message: 'x',
        reason: 'SOD_EXCEPTION_REQUIRED',
        details: { reason: 'SOD_EXCEPTION_REQUIRED' },
        timestamp: '',
        path: '/x',
      },
    });
    vi.spyOn(TestBed.inject(AccessLifecycleClient), 'move').mockReturnValue(
      throwError(() => error),
    );
    configurar();
    await abrir();
    await verVistaPrevia();
    await escribirEn(fixture, 'move-reason', 'Necesita cobrar y emitir comprobantes');
    await tocar(fixture, 'move-confirm');
    await esperarHasta(fixture, () => porId('move-failure') !== null);
    expect(textoDe('move-failure')).toContain(
      'Esta combinación necesita una excepción aprobada por otra persona.',
    );
    expect(porId('move-sod-link')!.getAttribute('href')).toBe(
      '/administration/access-governance/sod',
    );
  });

  it('S6: un vínculo que no existe no dice nada de él; S3: uno terminado explica que no se puede cambiar', async () => {
    engagementId = uuid('vinculo-que-no-existe');
    configurar();
    await abrir();
    expect(document.body.textContent).toContain('No encontramos lo que busca');
    fixture.destroy();
    fixture.nativeElement.remove();

    engagementId = GENTE.pablo.engagementId;
    vinculos.actualizar(engagementId, { status: 'ENDED' });
    fixture = TestBed.createComponent(MoveEngagement);
    document.body.appendChild(fixture.nativeElement);
    await esperarHasta(fixture, () => document.body.textContent!.includes('ya terminó'));
    expect(document.body.querySelector('a[href="/administration/support-team"]')).not.toBeNull();
  });

  it('avisa antes de confirmar si hay condiciones propias de cada permiso, porque el cambio de rol no las conserva', async () => {
    engagementId = GENTE.ana.engagementId;
    configurar();
    await abrir();
    expect(textoDe('move-conditions-warning')).toContain(
      'Algunas condiciones propias de cada permiso no se conservan',
    );
    // La prohibición expresa de Ana se conserva tal cual y se dice.
    expect(document.body.querySelector('[data-testid^="move-denied-"]')!.textContent).toContain(
      'Prohibición expresa',
    );
    fixture.destroy();
    fixture.nativeElement.remove();

    engagementId = GENTE.marcos.engagementId;
    permisos
      .filtrar((p) => p.engagementId === engagementId)
      .forEach((p) => permisos.actualizar(p.id, { actionConditions: undefined }));
    fixture = TestBed.createComponent(MoveEngagement);
    document.body.appendChild(fixture.nativeElement);
    await esperarHasta(fixture, () => porId('move-simulate') !== null);
    expect(porId('move-conditions-warning')).toBeNull();
  });
});
