import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError, type Observable } from 'rxjs';

import { AuthzClient } from '../../../core/data-access/authz/authz.client';
import { ProfilesClient } from '../../../core/data-access/profiles/profiles.client';
import { MedicalSpecialtiesCatalog } from '../../../core/data-access/terminology/medical-specialties.service';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { AccessRequests } from './access-requests';

/*
 * Lo que se prueba acá es la diferencia entre «no hay» y «no se pudo leer».
 * Antes, una lectura caída se pintaba como «No tiene solicitudes pendientes»:
 * el paciente creía que nadie pedía ver su historia.
 */

function caida(correlationId: string): HttpErrorResponse {
  return new HttpErrorResponse({
    status: 500,
    error: { code: 'INTERNAL', message: 'x', correlationId, timestamp: '', path: '' },
  });
}

const SOLICITUD = {
  id: 'cr-1',
  practitionerProfileId: 'pp-9',
  validFrom: '2026-10-01',
};

describe('AccessRequests', () => {
  let fixture: ComponentFixture<AccessRequests>;

  function montar(opciones: {
    solicitudes: () => Observable<unknown[]>;
    especialidades?: () => Observable<unknown[]>;
    responder?: () => Observable<unknown>;
  }): void {
    TestBed.configureTestingModule({
      imports: [AccessRequests],
      providers: [
        provideRouter([]),
        {
          provide: AuthzClient,
          useValue: {
            listMyPendingCareRelationshipRequests: opciones.solicitudes,
            respondToCareRelationshipRequest: opciones.responder ?? (() => of({})),
          },
        },
        {
          provide: ProfilesClient,
          useValue: { getPractitionerProfile: () => of({ displayName: 'Dra. Quispe' }) },
        },
        {
          provide: MedicalSpecialtiesCatalog,
          useValue: {
            listar: opciones.especialidades ?? (() => of([{ conceptId: 'c-card', display: 'Cardiología' }])),
          },
        },
        { provide: NavigationService, useValue: { breadcrumbs: signal([]) } },
      ],
    });
    fixture = TestBed.createComponent(AccessRequests);
    fixture.detectChanges();
  }

  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const porTestId = (id: string): HTMLElement | null => raiz().querySelector(`[data-testid="${id}"]`);

  it('si la lectura falla, lo dice con el código de soporte y no afirma que no hay solicitudes', () => {
    let falla = true;
    montar({ solicitudes: () => (falla ? throwError(() => caida('corr-acc')) : of([SOLICITUD])) });

    expect(porTestId('access-requests-error')?.textContent).toContain(
      'No pudimos traer sus solicitudes de vínculo. (Código de soporte: corr-acc)',
    );
    expect(raiz().textContent).not.toContain('No tiene solicitudes pendientes');

    falla = false;
    porTestId('access-requests-error')?.querySelector<HTMLButtonElement>('button')?.click();
    fixture.detectChanges();

    expect(porTestId('access-requests-error')).toBeNull();
    expect(raiz().textContent).toContain('Dra. Quispe');
  });

  it('sin especialidades para elegir, lo dice en vez de dejar el recuadro vacío', () => {
    montar({
      solicitudes: () => of([SOLICITUD]),
      especialidades: () => throwError(() => caida('corr-esp')),
    });

    expect(porTestId('access-requests-specialties-error')?.textContent).toContain(
      'No pudimos traer la lista de especialidades para elegir qué autoriza. (Código de soporte: corr-esp)',
    );
  });

  it('una lista vacía de verdad sigue siendo el estado vacío', () => {
    montar({ solicitudes: () => of([]) });

    expect(raiz().textContent).toContain('No tiene solicitudes pendientes');
    expect(porTestId('access-requests-error')).toBeNull();
  });

  it('si rechazar falla, avisa el motivo de la API y deja decidir otra vez', () => {
    montar({
      solicitudes: () => of([SOLICITUD]),
      responder: () =>
        throwError(
          () =>
            new HttpErrorResponse({
              status: 409,
              error: {
                code: 'CONFLICT',
                message: 'La solicitud ya fue respondida.',
                correlationId: 'corr-dec',
                timestamp: '',
                path: '',
              },
            }),
        ),
    });
    const avisos = vi.spyOn(TestBed.inject(ToastService), 'error');

    const rechazar = [...raiz().querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.textContent?.trim() === 'Rechazar',
    );
    rechazar?.click();
    fixture.detectChanges();

    expect(avisos).toHaveBeenCalledWith('La solicitud ya fue respondida. (Código de soporte: corr-dec)');
    expect(rechazar?.disabled || rechazar?.getAttribute('aria-disabled') === 'true').toBe(false);
  });

  it('si rechazar sale bien, la solicitud se va de la pantalla', () => {
    montar({ solicitudes: () => of([SOLICITUD]) });
    expect(raiz().textContent).toContain('Dra. Quispe');

    [...raiz().querySelectorAll<HTMLButtonElement>('button')]
      .find((b) => b.textContent?.trim() === 'Rechazar')
      ?.click();
    fixture.detectChanges();

    expect(raiz().textContent).not.toContain('Dra. Quispe');
    expect(raiz().textContent).toContain('No tiene solicitudes pendientes');
  });
});
