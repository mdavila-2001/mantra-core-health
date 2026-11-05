import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SupportAccessClient } from '../../../core/data-access/support-access/support-access.client';
import type { SupportEngagementRequest } from '../../../core/data-access/support-access/support-access.types';
import { SupportRequests } from './support-requests';

const SOLICITUD: SupportEngagementRequest = {
  id: 'r-1',
  tenantId: 't-1',
  organizationName: 'Hospital Piloto',
  requesterUserId: 'u-ana',
  requesterName: 'Ana Gutiérrez',
  direction: 'REQUEST',
  roleTemplate: 'SECRETARY',
  parentEngagementId: 'e-ana',
  message: 'Cubro pediatría y traumatología.',
  status: 'PENDING',
  expiresAt: new Date(Date.now() + 13 * 86_400_000).toISOString(),
  createdAt: new Date().toISOString(),
  items: [
    { id: 'i-1', targetKind: 'PRACTITIONER', practitionerRoleAssignmentId: 'd-1', practitionerName: 'Dr. Martín Suárez', proposedActions: ['schedule.view', 'schedule.create', 'schedule.cancel'], decision: 'PENDING' },
    { id: 'i-2', targetKind: 'PRACTITIONER', practitionerRoleAssignmentId: 'd-2', practitionerName: 'Dr. Jorge Vaca', proposedActions: ['schedule.view'], decision: 'PENDING' },
  ],
};

describe('SupportRequests', () => {
  let fixture: ComponentFixture<SupportRequests>;
  let decideRequest: ReturnType<typeof vi.fn>;
  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byId = (id: string): HTMLElement | null => host().querySelector(`[data-testid="${id}"]`);
  const clic = (el: Element | null): void => {
    (el as HTMLElement).click();
    fixture.detectChanges();
  };
  const decidir = (itemId: string, valor: string): void =>
    clic(byId(`decision-${itemId}`)!.querySelector(`[data-value="${valor}"]`));

  beforeEach(async () => {
    decideRequest = vi.fn(() => of({ ...SOLICITUD, status: 'PARTIAL', items: SOLICITUD.items.map((i) => ({ ...i, decision: 'APPROVED' as const })) }));
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: SupportAccessClient, useValue: { listRequests: () => of({ items: [SOLICITUD] }), decideRequest } }],
    });
    fixture = TestBed.createComponent(SupportRequests);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('muestra quién pide, qué pide en palabras y cuándo vence', () => {
    const texto = byId('solicitud-r-1')!.textContent!;
    expect(texto).toContain('Ana Gutiérrez');
    expect(texto).toContain('ampliar');
    expect(texto).toContain('Dr. Martín Suárez');
    expect(texto).toContain('Pidió poder ver la agenda, crear citas y cancelar citas');
    expect(texto).toContain('vence en 13 días');
    expect(texto).not.toMatch(/schedule\./);
  });

  it('no guarda sin decidir cada ítem, y dice cuáles faltan', () => {
    clic(byId('guardar-decision-r-1'));

    expect(decideRequest).not.toHaveBeenCalled();
    expect(byId('faltantes-r-1')!.textContent).toContain('Falta decidir: Dr. Martín Suárez.');
    expect(byId('faltantes-r-1')!.textContent).toContain('Falta decidir: Dr. Jorge Vaca.');
  });

  it('rechazar pide el motivo antes de guardar', () => {
    decidir('i-1', 'APPROVED');
    decidir('i-2', 'REJECTED');
    expect(byId('motivo-i-2')).not.toBeNull();

    clic(byId('guardar-decision-r-1'));

    expect(decideRequest).not.toHaveBeenCalled();
    expect(byId('faltantes-r-1')!.textContent).toContain('Escriba el motivo del rechazo');
  });

  it('la aprobación parcial manda un ajuste y un rechazo con su motivo, ítem por ítem', () => {
    decidir('i-1', 'ADJUSTED');
    // «Cancelar citas» se desmarca.
    clic(host().querySelector('[data-testid="ajuste-i-1-schedule.cancel"] input'));
    decidir('i-2', 'REJECTED');
    const motivo = byId('motivo-i-2')!.querySelector('textarea')!;
    motivo.value = 'La cubre otra persona.';
    motivo.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    clic(byId('guardar-decision-r-1'));

    expect(decideRequest).toHaveBeenCalledTimes(1);
    expect(decideRequest).toHaveBeenCalledWith('r-1', {
      items: [
        { itemId: 'i-1', decision: 'ADJUSTED', actions: ['schedule.view', 'schedule.create'] },
        { itemId: 'i-2', decision: 'REJECTED', comment: 'La cubre otra persona.' },
      ],
    });
  });

  it('«Aprobar todo como se pidió» marca todos los ítems sin ajustes', () => {
    clic(byId('aprobar-todo-r-1'));
    clic(byId('guardar-decision-r-1'));

    expect(decideRequest).toHaveBeenCalledWith('r-1', {
      items: [{ itemId: 'i-1', decision: 'APPROVED' }, { itemId: 'i-2', decision: 'APPROVED' }],
    });
  });
});

/* ---- la bandeja con muchas solicitudes: filtros, paginación y vencidas -------------- */

const dias = (n: number): string => new Date(Date.now() + n * 86_400_000).toISOString();

function pedido(id: string, nombre: string, over: Partial<SupportEngagementRequest> & { creadaHaceDias: number }): SupportEngagementRequest {
  const { creadaHaceDias, ...resto } = over;
  return {
    ...SOLICITUD,
    id,
    requesterUserId: `u-${id}`,
    requesterName: nombre,
    parentEngagementId: undefined,
    createdAt: dias(-creadaHaceDias),
    expiresAt: dias(15 - creadaHaceDias),
    items: [{ id: `i-${id}`, targetKind: 'ALL', proposedActions: ['schedule.view'], decision: 'PENDING' }],
    ...resto,
  } as SupportEngagementRequest;
}

const MUCHAS: SupportEngagementRequest[] = [
  pedido('p1', 'Rocío Vargas', { creadaHaceDias: 13 }),
  pedido('p2', 'Sofía Aguilar', { creadaHaceDias: 6, roleTemplate: 'MEDICAL_ASSISTANT' }),
  pedido('p3', 'Julia Mamani', { creadaHaceDias: 5, roleTemplate: 'NURSING' }),
  pedido('p4', 'Ana Gutiérrez', { creadaHaceDias: 2 }),
  pedido('v1', 'Carmen Ibáñez', { creadaHaceDias: 21, status: 'EXPIRED', roleTemplate: 'NURSING' }),
  // La API todavía no la barrió: ya pasó su plazo, pero sigue figurando pendiente.
  pedido('v2', 'Luis Terán', { creadaHaceDias: 17, roleTemplate: 'CALL_CENTER' }),
  pedido('r1', 'Pedro Camacho', { creadaHaceDias: 33, status: 'REJECTED', roleTemplate: 'FRONT_DESK', decidedAt: dias(-29) }),
  pedido('r2', 'Silvia Soria', { creadaHaceDias: 52, status: 'APPROVED', roleTemplate: 'BILLING_CASHIER', decidedAt: dias(-50) }),
  pedido('r3', 'Gabriel Rojas', { creadaHaceDias: 41, status: 'PARTIAL', roleTemplate: 'CALL_CENTER', decidedAt: dias(-38) }),
  pedido('r4', 'Mariana López', { creadaHaceDias: 27, status: 'REJECTED', decidedAt: dias(-24) }),
  pedido('r5', 'Raúl Peña', { creadaHaceDias: 35, status: 'APPROVED', decidedAt: dias(-30) }),
];

describe('SupportRequests · filtros, paginación y vencidas', () => {
  let fixture: ComponentFixture<SupportRequests>;
  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byId = (id: string): HTMLElement | null => host().querySelector(`[data-testid="${id}"]`);
  const tarjetas = (): string[] => [...host().querySelectorAll('li.solicitud')].map((li) => li.querySelector('.solicitud__titulo')!.textContent!.trim());
  const refrescar = async (): Promise<void> => {
    await fixture.whenStable();
    fixture.detectChanges();
  };

  async function abrir(query: Record<string, string> = {}, lista: SupportEngagementRequest[] = MUCHAS): Promise<void> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: SupportAccessClient, useValue: { listRequests: () => of({ items: lista }), decideRequest: vi.fn() } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(query) }, queryParamMap: of(convertToParamMap(query)), queryParams: of(query) } },
      ],
    });
    fixture = TestBed.createComponent(SupportRequests);
    fixture.detectChanges();
    await refrescar();
  }

  it('cuenta pendientes y resueltas con el estado efectivo: la que pasó su plazo ya es resuelta', async () => {
    await abrir();
    const barra = byId('solicitudes-vista')!.textContent!;
    expect(barra).toContain('Pendientes (4)');
    expect(barra).toContain('Resueltas (7)');
  });

  it('pendientes: las cuatro, sin las vencidas, y de a cinco por página', async () => {
    await abrir();
    expect(tarjetas()).toEqual(['Rocío Vargas', 'Sofía Aguilar', 'Julia Mamani', 'Ana Gutiérrez']);
    expect(byId('solicitudes-paginacion')).not.toBeNull();
  });

  it('resueltas pagina: siete en dos páginas de cinco', async () => {
    await abrir();
    (byId('solicitudes-vista')!.querySelector('[data-value="RESOLVED"]') as HTMLElement).click();
    await refrescar();
    expect(tarjetas()).toHaveLength(5);
    expect(host().textContent).toContain('1–5 de 7');
  });

  it('filtra por persona', async () => {
    await abrir({ persona: 'u-p3' });
    expect(tarjetas()).toEqual(['Julia Mamani']);
    expect(byId('solicitudes-vista')!.textContent).toContain('Pendientes (1)');
  });

  it('filtra por rol', async () => {
    await abrir({ rol: 'NURSING' });
    expect(tarjetas()).toEqual(['Julia Mamani']);
    expect(byId('solicitudes-vista')!.textContent).toContain('Resueltas (1)');
  });

  it('filtra por antigüedad: quince días o más son las vencidas y las muy viejas', async () => {
    await abrir({ antiguedad: 'GE15' });
    expect(byId('solicitudes-vista')!.textContent).toContain('Pendientes (0)');
    expect(byId('solicitudes-vista')!.textContent).toContain('Resueltas (7)');
    await abrir({ antiguedad: 'LT3' });
    expect(tarjetas()).toEqual(['Ana Gutiérrez']);
  });

  it('elegir un estado manda a la vista que le corresponde', async () => {
    await abrir({ estado: 'REJECTED' });
    expect(tarjetas().sort()).toEqual(['Mariana López', 'Pedro Camacho']);
    await abrir({ estado: 'PENDING' });
    expect(tarjetas()).toHaveLength(4);
  });

  it('el estado «vencida» incluye la que la API todavía no marcó', async () => {
    await abrir({ estado: 'EXPIRED' });
    expect(tarjetas().sort()).toEqual(['Carmen Ibáñez', 'Luis Terán']);
  });

  it('los filtros se combinan; sin resultados lo dice distinto de «no hay solicitudes»', async () => {
    await abrir({ rol: 'CALL_CENTER', antiguedad: 'LT3' });
    expect(byId('solicitudes-sin-resultados')!.textContent).toContain('Ninguna solicitud coincide con los filtros.');
    await abrir({}, []);
    expect(host().textContent).toContain('No hay solicitudes.');
  });

  it('una vencida se muestra aparte: dice cuándo venció, que ya no se decide y qué hacer', async () => {
    await abrir({ estado: 'EXPIRED' });
    const aviso = byId('solicitud-vencida-v1')!;
    expect(aviso.textContent).toContain('Esta solicitud venció');
    expect(aviso.textContent).toContain('Ya no se puede aprobar ni rechazar');
    expect(aviso.textContent).toContain('enviar una solicitud nueva');
    expect(byId('solicitud-estado-v1')!.textContent).toContain('Vencida');
    // Ni controles de decisión ni botón de guardar.
    expect(byId('decision-i-v1')).toBeNull();
    expect(byId('guardar-decision-v1')).toBeNull();
    // La que la API todavía no barrió se trata igual.
    expect(byId('solicitud-vencida-v2')).not.toBeNull();
    expect(byId('guardar-decision-v2')).toBeNull();
  });

  it('una pendiente que vence en tres días o menos se marca como urgente', async () => {
    await abrir();
    expect(byId('solicitud-vence-p1')!.classList.contains('solicitud__vence--urgente')).toBe(true);
    expect(byId('solicitud-vence-p4')!.classList.contains('solicitud__vence--urgente')).toBe(false);
  });

  it('una pendiente vigente sigue teniendo sus controles', async () => {
    await abrir();
    expect(byId('decision-i-p1')).not.toBeNull();
    expect(byId('guardar-decision-p1')).not.toBeNull();
  });
});
