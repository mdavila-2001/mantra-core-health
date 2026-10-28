import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HealthcareServicesClient } from '../../../core/data-access/healthcare-services/healthcare-services.client';
import { PracticeSitesClient } from '../../../core/data-access/practice-sites/practice-sites.client';
import { ServicesCatalogClient } from '../../../core/data-access/services-catalog/services-catalog.client';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { AffiliationRequestForm } from '../../account/my-profile/affiliation-invitations/affiliation-request-form/affiliation-request-form';
import { AffiliationDialog } from './affiliation-dialog';

/**
 * «Afiliarme a otra organización…» abre el formulario de solicitud en un
 * modal. Lo que este envoltorio agrega —y lo que se prueba acá— es el modal: el
 * formulario tiene sus propias pruebas.
 */
describe('AffiliationDialog', () => {
  let fixture: ComponentFixture<AffiliationDialog>;
  let success: ReturnType<typeof vi.fn>;
  let closed: number;
  let requested: number[];
  let changed: number;

  beforeEach(async () => {
    success = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: ServicesCatalogClient, useValue: { listPractices: () => of([]) } },
        { provide: PracticeSitesClient, useValue: { selfRequestAffiliation: vi.fn() } },
        { provide: HealthcareServicesClient, useValue: { listSites: () => of([]), listOffers: () => of([]) } },
        { provide: ToastService, useValue: { success } },
      ],
    });
    fixture = TestBed.createComponent(AffiliationDialog);
    closed = 0;
    requested = [];
    changed = 0;
    fixture.componentInstance.closed.subscribe(() => closed++);
    fixture.componentInstance.requested.subscribe((count) => requested.push(count));
    fixture.componentInstance.changed.subscribe(() => changed++);
    await fixture.whenStable();
  });

  function dialog(): HTMLDialogElement {
    return fixture.nativeElement.querySelector('dialog[data-testid="content-dialog"]');
  }

  function form(): AffiliationRequestForm {
    return fixture.debugElement.query(By.directive(AffiliationRequestForm)).componentInstance;
  }

  it('abre el formulario de solicitud dentro del modal', () => {
    expect(dialog().hasAttribute('open')).toBe(true);
    expect(dialog().querySelector('[data-testid="request-form"]')).not.toBeNull();
  });

  it('el título se lee una sola vez: lo dice el modal, que es su nombre accesible', () => {
    const heading = dialog().querySelector('[data-testid="content-dialog-title"]');
    expect(heading?.textContent?.trim()).toBe('Pedir afiliarme a un centro');
    expect(dialog().getAttribute('aria-labelledby')).toBe(heading?.id);

    const ownTitle = dialog().querySelector<HTMLElement>('.request__title');
    expect(ownTitle).not.toBeNull();
    expect(getComputedStyle(ownTitle!).display).toBe('none');
  });

  it('enviar avisa, dice cuántas y cierra el modal antes de que la pantalla lo desmonte', () => {
    form().requested.emit(2);

    expect(success).toHaveBeenCalledWith(
      'Pidió afiliarse por 2 procedimientos.',
      'Falta que el centro apruebe',
    );
    expect(requested).toEqual([2]);
    expect(closed).toBe(1);
    expect(dialog().hasAttribute('open')).toBe(false);
  });

  it('una sola solicitud se dice en singular', () => {
    form().requested.emit(1);

    expect(success).toHaveBeenCalledWith(
      'Pidió afiliarse por 1 procedimiento.',
      'Falta que el centro apruebe',
    );
  });

  it('cancelar cierra el modal sin enviar ni avisar', () => {
    dialog().querySelector<HTMLElement>('[data-testid="request-cancel"]')?.click();

    expect(closed).toBe(1);
    expect(dialog().hasAttribute('open')).toBe(false);
    expect(success).not.toHaveBeenCalled();
    expect(requested).toEqual([]);
  });

  it('una solicitud a medias deja el formulario abierto y lo avisa afuera', () => {
    form().changed.emit();

    expect(changed).toBe(1);
    expect(closed).toBe(0);
    expect(dialog().hasAttribute('open')).toBe(true);
  });
});
