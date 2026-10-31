import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { SupportAccessClient } from '../../../core/data-access/support-access/support-access.client';
import type { SupportActivityEntry, SupportEngagement } from '../../../core/data-access/support-access/support-access.types';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { SupportReview } from './support-review';

const enDias = (n: number): string => new Date(Date.now() + n * 86_400_000).toISOString();

function vinculo(id: string, nombre: string, status: SupportEngagement['status'], dias: number, grants = 1, extra: Partial<SupportEngagement> = {}): SupportEngagement {
  return {
    id,
    tenantId: 't',
    organizationName: 'H',
    ownerKind: 'ORGANIZATION',
    userId: `u-${id}`,
    personName: nombre,
    roleTemplate: 'FRONT_DESK',
    status,
    origin: 'INVITATION',
    recertifyEveryMonths: 12,
    nextRecertificationAt: enDias(dias),
    grants: Array.from({ length: grants }, (_, i) => ({ id: `${id}-g${i}`, engagementId: id, targetKind: 'ALL' as const, expansionMode: 'DYNAMIC' as const, actions: ['schedule.view' as const], status: 'ACTIVE' as const })),
    ...extra,
  };
}

const GABRIEL = vinculo('g', 'Gabriel Rojas', 'ACTIVE', 12);
const PEDRO = vinculo('p', 'Pedro Camacho', 'ACTIVE', -6, 2);
const SILVIA = vinculo('s', 'Silvia Soria', 'SUSPENDED', -22, 1, { lastConfirmedBy: 'PERSON', lastConfirmedAt: enDias(-1) });
const AL_DIA = vinculo('a', 'Ana Gutiérrez', 'ACTIVE', 200);

function entrada(id: string, createdAt: string, personName: string, action: string, summary: string): SupportActivityEntry {
  const crudo = action.includes('.') ? action.toUpperCase().replace('.', '_') : action;
  return { id, userId: 'u', personName, action, auditAction: crudo, entity: 'x', summary, success: true, result: 'SUCCESS', createdAt };
}

const HISTORIA: SupportActivityEntry[] = [
  entrada('h1', '2026-10-29T10:00:00Z', 'Hospital', 'engagement.recertified', 'Se confirmó el vínculo de Lucía Paz por 12 meses.'),
  entrada('h2', '2026-10-28T10:00:00Z', 'Ana', 'schedule.create', 'Creó una cita.'),
  entrada('h3', '2026-10-27T10:00:00Z', 'Hospital', 'grant.revoked', 'Se retiró un permiso a Pedro Camacho.'),
  // La API no reconoce todos los asientos: llegan con el crudo como código.
  entrada('h4', '2026-10-26T10:00:00Z', 'Hospital', 'SUPPORT_ENGAGEMENT_SUSPENDED', 'Se suspendió un vínculo.'),
];

describe('SupportReview', () => {
  let fixture: ComponentFixture<SupportReview>;
  let recertify: ReturnType<typeof vi.fn>;
  let changeGrant: ReturnType<typeof vi.fn>;
  let confirm: ReturnType<typeof vi.fn>;
  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byId = (id: string): HTMLElement | null => host().querySelector(`[data-testid="${id}"]`);
  const refrescar = async (): Promise<void> => {
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const clic = async (el: Element | null): Promise<void> => {
    (el as HTMLElement).click();
    await refrescar();
  };
  const marcar = async (nombre: string): Promise<void> => {
    const fila = [...host().querySelectorAll('[data-testid="tabla-fila"]')].find((f) => f.textContent?.includes(nombre));
    await clic(fila!.querySelector('input'));
  };

  async function abrir(items: readonly SupportEngagement[] = [AL_DIA, GABRIEL, PEDRO, SILVIA]): Promise<void> {
    recertify = vi.fn(() => of({ ok: true }));
    changeGrant = vi.fn(() => of({ ok: true }));
    confirm = vi.fn(() => Promise.resolve(true));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: SupportAccessClient, useValue: { listEngagements: () => of({ items }), getOrganizationActivity: () => of({ items: HISTORIA }), recertify, changeGrant } },
        { provide: DialogService, useValue: { confirm } },
      ],
    });
    fixture = TestBed.createComponent(SupportReview);
    fixture.detectChanges();
    await refrescar();
  }

  it('lista solo lo que hay que revisar, lo más urgente primero, y deja fuera lo que está al día', async () => {
    await abrir();
    const nombres = [...host().querySelectorAll('[data-testid^="revision-persona-"]')].map((n) => n.textContent!.trim());
    expect(nombres).toEqual(['Silvia Soria', 'Pedro Camacho', 'Gabriel Rojas']);
  });

  it('dice el estado de cada uno y qué pasa si no se confirma', async () => {
    await abrir();
    expect(byId('revision-estado-s')!.textContent).toContain('Suspendido');
    expect(byId('revision-estado-p')!.textContent).toContain('Vencido');
    expect(byId('revision-estado-g')!.textContent).toContain('Por vencer');
    expect(byId('revision-frase-p')!.textContent).toContain('se suspende en 9 días');
    expect(byId('revision-frase-g')!.textContent).toContain('vence en 12 días');
    expect(byId('revision-frase-s')!.textContent).toContain('No puede actuar hasta que se reactive');
    // La persona solo declara que sigue trabajando aquí: no pide ni logra reactivarse.
    expect(byId('revision-declaracion-s')!.textContent).toContain('sigue trabajando aquí');
    expect(byId('revision-declaracion-p')).toBeNull();
  });

  it('el suspendido se «reactiva», no se «confirma»', async () => {
    await abrir();
    expect(byId('revision-confirmar-s')!.textContent).toContain('Reactivar');
    expect(byId('revision-confirmar-g')!.textContent).toContain('Confirmar');
  });

  it('el filtro deja ver solo un estado y cuenta cada uno', async () => {
    await abrir();
    const filtro = byId('revision-filtro')!;
    expect(filtro.textContent).toContain('Todos (3)');
    expect(filtro.textContent).toContain('Suspendidos (1)');
    await clic(filtro.querySelector('[data-value="SUSPENDED"]'));
    expect([...host().querySelectorAll('[data-testid^="revision-persona-"]')].map((n) => n.textContent!.trim())).toEqual(['Silvia Soria']);
  });

  it('confirmar a uno pide confirmación, llama a la API y vuelve a leer', async () => {
    await abrir();
    await clic(byId('revision-confirmar-g'));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(recertify).toHaveBeenCalledWith('g', undefined);
    expect(byId('revision-resultado')!.textContent).toContain('Se confirmó el vínculo de 1 persona');
  });

  it('si cancela, no se confirma nada', async () => {
    await abrir();
    confirm.mockResolvedValueOnce(false);
    await clic(byId('revision-confirmar-g'));
    expect(recertify).not.toHaveBeenCalled();
  });

  it('sin nada seleccionado no hay barra de lote; seleccionar la muestra con el conteo', async () => {
    await abrir();
    expect(byId('revision-lote')).toBeNull();
    await marcar('Pedro Camacho');
    await marcar('Gabriel Rojas');
    expect(byId('revision-seleccionados')!.textContent).toContain('2 seleccionados');
  });

  it('confirmar en lote: elige el período y confirma a cada uno', async () => {
    await abrir();
    await marcar('Pedro Camacho');
    await marcar('Gabriel Rojas');
    await clic(byId('revision-confirmar-lote'));
    expect(byId('revision-dialogo-confirmar')).not.toBeNull();
    (fixture.componentInstance as unknown as { cambiarMeses(m: string): void }).cambiarMeses('6');
    fixture.detectChanges();
    await clic(byId('revision-confirmar-lote-ok'));
    expect(recertify.mock.calls.map((c) => c[0]).sort()).toEqual(['g', 'p']);
    expect(recertify.mock.calls.every((c) => c[1] === 6)).toBe(true);
    expect(byId('revision-resultado')!.textContent).toContain('Se confirmó el vínculo de 2 personas');
  });

  it('quitar permisos en lote: pide confirmación con el detalle y retira cada permiso', async () => {
    await abrir();
    await marcar('Pedro Camacho');
    await marcar('Silvia Soria');
    await clic(byId('revision-quitar-lote'));
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ destructive: true, details: [{ label: 'Pedro Camacho', value: '2 permisos' }, { label: 'Silvia Soria', value: '1 permiso' }] }));
    expect(changeGrant).toHaveBeenCalledTimes(3);
    expect(changeGrant).toHaveBeenCalledWith('p', { grantId: 'p-g0', revoke: true });
    expect(byId('revision-resultado')!.textContent).toContain('Se quitaron los permisos de 2 personas');
  });

  it('si falla uno del lote, dice cuál y las demás siguen', async () => {
    await abrir();
    recertify.mockImplementation((id: string) => (id === 'p' ? throwError(() => new Error('x')) : of({ ok: true })));
    await marcar('Pedro Camacho');
    await marcar('Gabriel Rojas');
    await clic(byId('revision-confirmar-lote'));
    await clic(byId('revision-confirmar-lote-ok'));
    expect(byId('revision-resultado')!.textContent).toContain('Se confirmó el vínculo de 1 persona');
    expect(byId('revision-resultado')!.textContent).toContain('No se pudo con Pedro Camacho');
  });

  it('si no hay nada por revisar, lo dice', async () => {
    await abrir([AL_DIA]);
    expect(host().textContent).toContain('No hay vínculos por revisar: todos están al día.');
  });

  it('el historial deja solo lo que le pasó a los vínculos y a sus permisos', async () => {
    await abrir();
    const pestanas = [...host().querySelectorAll('[role="tab"]')] as HTMLElement[];
    await clic(pestanas.find((t) => t.textContent?.includes('Historial'))!);
    const texto = byId('revision-historial')!.textContent!;
    expect(texto).toContain('Se confirmó un vínculo');
    expect(texto).toContain('Se retiró un permiso');
    expect(texto).toContain('Se suspendió un vínculo');
    expect(texto).not.toContain('Creó una cita');
  });
});
