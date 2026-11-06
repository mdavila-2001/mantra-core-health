import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError, type Observable } from 'rxjs';
import { vi } from 'vitest';

import { AuthService } from '../../../core/auth/auth.service';
import { AuthzClient } from '../../../core/data-access/authz/authz.client';
import type { AccessRequestItem } from '../../../core/data-access/authz/authz.types';
import { PractitionerAccessClient } from '../../../core/data-access/consent/practitioner-access.client';
import { MedicalSpecialtiesCatalog } from '../../../core/data-access/terminology/medical-specialties.service';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { AccessRequests } from './access-requests';

/*
 * El buzón de los dos lados. Lo que se fija: que cada rol lea su bandeja, que
 * «no hay» no se confunda con «no se pudo leer», que la decisión viaje a la
 * ruta de su tipo (con las especialidades sólo en el granular) y que después
 * de cada acción se relea la bandeja en vez de confiar en el toast.
 */

function failure(status: number, correlationId: string, message = 'x'): HttpErrorResponse {
  return new HttpErrorResponse({
    status,
    error: { code: status === 409 ? 'CONFLICT' : 'INTERNAL', message, correlationId, timestamp: '', path: '' },
  });
}

const BASE: AccessRequestItem = {
  id: 'ar-1',
  kind: 'GRANULAR',
  direction: 'RECEIVED',
  counterpart: { profileId: 'pro-1', displayName: 'Dra. Quispe' },
  requestedAt: new Date('2026-11-01T12:00:00Z'),
  status: 'PENDING',
  requestedSpecialtyConceptIds: ['c-card', 'c-neuro'],
  authorizedSpecialtyConceptIds: [],
};
const CATALOG = [
  { conceptId: 'c-card', display: 'Cardiología' },
  { conceptId: 'c-neuro', display: 'Neurología' },
];

describe('AccessRequests', () => {
  let fixture: ComponentFixture<AccessRequests>;
  let authz: Record<string, ReturnType<typeof vi.fn>>;
  let granular: Record<string, ReturnType<typeof vi.fn>>;
  let toasts: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let confirm: ReturnType<typeof vi.fn>;

  async function mount(options: {
    roles?: readonly string[];
    inbox: () => Observable<readonly AccessRequestItem[]>;
    catalog?: () => Observable<unknown[]>;
  }): Promise<void> {
    authz = {
      listMyAccessRequests: vi.fn(options.inbox),
      listPractitionerAccessRequests: vi.fn(options.inbox),
      respondToCareRelationshipRequest: vi.fn(() => of({ ok: true })),
      respondAsPractitioner: vi.fn(() => of(undefined)),
      revokeMyCareRelationship: vi.fn(() => of({ ok: true })),
    };
    granular = { decide: vi.fn(() => of(undefined)), revoke: vi.fn(() => of(undefined)) };
    toasts = { success: vi.fn(), error: vi.fn() };
    confirm = vi.fn(() => Promise.resolve(true));
    TestBed.configureTestingModule({
      imports: [AccessRequests],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { roles: signal(options.roles ?? ['PATIENT']) } },
        { provide: AuthzClient, useValue: authz },
        { provide: PractitionerAccessClient, useValue: granular },
        {
          provide: MedicalSpecialtiesCatalog,
          useValue: { listar: options.catalog ?? (() => of(CATALOG)), olvidar: vi.fn() },
        },
        { provide: NavigationService, useValue: { breadcrumbs: signal([]) } },
        { provide: ToastService, useValue: toasts },
        { provide: DialogService, useValue: { confirm } },
      ],
    });
    fixture = TestBed.createComponent(AccessRequests);
    await settle();
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byTestId = (id: string): HTMLElement | null => root().querySelector(`[data-testid="${id}"]`);
  const tab = (label: string) =>
    [...root().querySelectorAll<HTMLElement>('[role="tab"]')].find((t) => t.textContent?.includes(label));
  async function click(element: HTMLElement | null | undefined): Promise<void> {
    element?.click();
    await settle();
  }

  it('si la lectura falla lo dice con el código de soporte, no con «no hay», y reintenta', async () => {
    let fails = true;
    await mount({ inbox: () => (fails ? throwError(() => failure(500, 'corr-acc')) : of([BASE])) });

    expect(root().textContent).toContain('corr-acc');
    expect(root().textContent).not.toContain('No tiene solicitudes de acceso');

    fails = false;
    await click([...root().querySelectorAll<HTMLButtonElement>('button')].find((b) => /Reintentar/.test(b.textContent ?? '')));
    expect(root().textContent).toContain('Dra. Quispe');
  });

  it('una bandeja vacía es el vacío con su próxima acción', async () => {
    await mount({ inbox: () => of([]) });

    expect(root().textContent).toContain('No tiene solicitudes de acceso');
    expect([...root().querySelectorAll('a')].some((a) => a.textContent?.includes('Ver quién ve su historia'))).toBe(true);
  });

  it('el paciente lee su bandeja y cada pestaña cuenta lo suyo', async () => {
    await mount({
      inbox: () =>
        of([
          BASE,
          { ...BASE, id: 'ar-2', kind: 'CABECERA', direction: 'SENT', requestedSpecialtyConceptIds: [] },
          { ...BASE, id: 'ar-3', status: 'ACTIVE', authorizedSpecialtyConceptIds: ['c-card'] },
        ]),
    });

    expect(authz['listMyAccessRequests']).toHaveBeenCalled();
    expect(authz['listPractitionerAccessRequests']).not.toHaveBeenCalled();
    expect(tab('Recibidas (1)')).toBeDefined();
    expect(tab('Enviadas (1)')).toBeDefined();
    expect(tab('Historial (1)')).toBeDefined();
    expect(byTestId('access-request-ar-1')?.textContent).toContain('Especialidades pedidas: Cardiología, Neurología');
  });

  it('aceptar un granular precarga lo pedido, deja quitar una y manda sólo lo autorizado; después relee', async () => {
    await mount({ inbox: () => of([BASE]) });

    await click(byTestId('segmentado-ACCEPT'));
    const boxes = [...root().querySelectorAll<HTMLInputElement>('[data-testid="access-request-specialties"] input')];
    expect(boxes.map((b) => b.checked)).toEqual([true, true]);
    boxes[1]!.click();
    await settle();
    await click(byTestId('access-request-confirm'));

    expect(granular['decide']).toHaveBeenCalledWith('ar-1', {
      decision: 'ACCEPTED',
      authorizedSpecialtyConceptIds: ['c-card'],
    });
    expect(authz['listMyAccessRequests']).toHaveBeenCalledTimes(2);
    expect(toasts.success).toHaveBeenCalledWith('Aceptó la solicitud.');
  });

  it('un granular aceptado sin ninguna especialidad no se puede confirmar', async () => {
    await mount({ inbox: () => of([{ ...BASE, requestedSpecialtyConceptIds: ['c-card'] }]) });

    await click(byTestId('segmentado-ACCEPT'));
    root().querySelector<HTMLInputElement>('[data-testid="access-request-specialties"] input')!.click();
    await settle();

    expect(root().textContent).toContain('Elija al menos una especialidad');
    expect(byTestId('access-request-confirm')?.getAttribute('aria-disabled')).toBe('true');
  });

  it('una cabecera recibida se responde sin especialidades por la ruta del paciente', async () => {
    await mount({ inbox: () => of([{ ...BASE, kind: 'CABECERA', requestedSpecialtyConceptIds: [] }]) });

    await click(byTestId('segmentado-ACCEPT'));
    expect(byTestId('access-request-specialties')).toBeNull();
    await click(byTestId('access-request-confirm'));

    expect(authz['respondToCareRelationshipRequest']).toHaveBeenCalledWith('ar-1', { decision: 'ACCEPT' });
    expect(granular['decide']).not.toHaveBeenCalled();
  });

  it('si rechazar falla avisa el motivo de la API y deja decidir otra vez', async () => {
    await mount({ inbox: () => of([BASE]) });
    granular['decide']!.mockReturnValue(throwError(() => failure(409, 'corr-dec', 'La solicitud ya fue respondida.')));

    await click(byTestId('segmentado-REJECT'));
    await click(byTestId('access-request-confirm'));

    expect(toasts.error).toHaveBeenCalledWith('La solicitud ya fue respondida. (Código de soporte: corr-dec)');
    expect(byTestId('access-request-confirm')?.getAttribute('aria-disabled')).toBe('false');
  });

  it('el paciente revoca un acceso activo del historial con confirmación destructiva y relee', async () => {
    await mount({ inbox: () => of([{ ...BASE, status: 'ACTIVE', authorizedSpecialtyConceptIds: ['c-card'] }]) });

    await click(tab('Historial'));
    expect(byTestId('access-request-authorized')?.textContent).toContain('Autorizadas: Cardiología');
    await click(byTestId('access-request-revoke'));
    // The confirmation is a promise the zone does not wait for.
    await settle();

    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ destructive: true }));
    expect(granular['revoke']).toHaveBeenCalledWith('ar-1');
    expect(authz['listMyAccessRequests']).toHaveBeenCalledTimes(2);
  });

  it('el médico lee su bandeja, responde por su ruta y no tiene qué revocar ni elegir áreas', async () => {
    await mount({
      roles: ['PRACTITIONER'],
      inbox: () =>
        of([
          { ...BASE, kind: 'CABECERA', requestedSpecialtyConceptIds: [], counterpart: { profileId: 'p-1', displayName: 'Ana Pérez' } },
          { ...BASE, id: 'ar-9', direction: 'SENT', status: 'ACTIVE', authorizedSpecialtyConceptIds: ['c-card'] },
        ]),
    });

    expect(authz['listPractitionerAccessRequests']).toHaveBeenCalled();
    expect(root().textContent).not.toContain('Usted elige');
    await click(byTestId('segmentado-REJECT'));
    await click(byTestId('access-request-confirm'));
    expect(authz['respondAsPractitioner']).toHaveBeenCalledWith('ar-1', 'REJECT');

    await click(tab('Historial'));
    expect(byTestId('access-request-ar-9')).not.toBeNull();
    expect(byTestId('access-request-revoke')).toBeNull();
  });

  it('sin el catálogo de especialidades lo dice y ofrece reintentar', async () => {
    await mount({ inbox: () => of([BASE]), catalog: () => throwError(() => failure(500, 'corr-esp')) });

    const alert = byTestId('access-requests-specialties-error')?.textContent ?? '';
    expect(alert).toContain('No pudimos traer los nombres de las especialidades.');
    expect(alert).toContain('(Código de soporte: corr-esp)');
  });
});
