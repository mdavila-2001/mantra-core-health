import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SessionStore } from '../../../core/auth/session.store';
import { HealthcareServicesClient } from '../../../core/data-access/healthcare-services/healthcare-services.client';
import { PracticeSitesClient } from '../../../core/data-access/practice-sites/practice-sites.client';
import { ROLE_ASSIGNMENT_STATUS } from '../../../core/data-access/practice-sites/role-assignment-concepts';
import type { MyRoleAssignment } from '../../../core/data-access/practice-sites/practice-sites.types';
import { ServicesCatalogClient } from '../../../core/data-access/services-catalog/services-catalog.client';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import {
  AFFILIATE_LABEL,
  OWN_OFFICE_LABEL,
  type OrganizationChoice,
} from '../../../shared/components/molecules/organization-select/organization-select.types';
import { OrganizationField } from './organization-field';

const OLIVOS: MyRoleAssignment = {
  id: 'ra-olivos',
  practiceId: 'practice-olivos',
  practiceName: 'Clínica Los Olivos',
  practiceSiteId: 'site-olivos',
  roleConceptId: 'role-attending',
  status: ROLE_ASSIGNMENT_STATUS.ACTIVE,
  isPrimary: true,
  createdAt: new Date('2026-10-01T12:00:00Z'),
  avatarUrl: null,
  tenantId: 'tenant-olivos',
};

/**
 * El campo «Organización» de «Publicar agenda»: el selector con su rótulo y
 * «Afiliarme a otra organización…» resuelto en un modal, sin navegar.
 */
describe('OrganizationField', () => {
  let fixture: ComponentFixture<OrganizationField>;
  let choices: OrganizationChoice[];

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: SessionStore, useValue: { practitionerProfileId: signal('hp-rojas') } },
        {
          provide: PracticeSitesClient,
          useValue: {
            listMyRoleAssignments: () => of([OLIVOS]),
            listSitesOfPractitioner: () => of({ items: [], count: 0 }),
            selfRequestAffiliation: vi.fn(),
          },
        },
        { provide: ServicesCatalogClient, useValue: { listPractices: () => of([]) } },
        { provide: HealthcareServicesClient, useValue: { listSites: () => of([]), listOffers: () => of([]) } },
        { provide: ToastService, useValue: { success: vi.fn() } },
      ],
    });
    fixture = TestBed.createComponent(OrganizationField);
    choices = [];
    fixture.componentInstance.selected.subscribe((choice) => choices.push(choice));
    await fixture.whenStable();
  });

  function trigger(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('.select-trigger');
  }

  function optionRows(): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('[role="option"]'));
  }

  async function choose(label: string): Promise<void> {
    trigger().click();
    await fixture.whenStable();
    optionRows()
      .find((row) => row.querySelector('.option-label')?.textContent?.trim() === label)
      ?.click();
    await fixture.whenStable();
  }

  function affiliationDialog(): HTMLDialogElement | null {
    return fixture.nativeElement.querySelector('app-affiliation-dialog dialog');
  }

  it('el rótulo «Organización» nombra al selector, que empieza en «Mi consultorio»', () => {
    const label: HTMLLabelElement = fixture.nativeElement.querySelector('label');

    expect(label.textContent?.trim()).toBe('Organización');
    expect(label.htmlFor).toBe(trigger().id);
    expect(trigger().textContent?.trim()).toBe(OWN_OFFICE_LABEL);
  });

  it('elegir una organización la reenvía con su organización', async () => {
    await choose('Clínica Los Olivos');

    expect(choices).toHaveLength(1);
    expect(choices[0].organization).toMatchObject({
      practiceId: 'practice-olivos',
      tenantId: 'tenant-olivos',
    });
  });

  it('«Afiliarme a otra organización…» abre el formulario en un modal y no elige nada', async () => {
    expect(affiliationDialog()).toBeNull();

    await choose(AFFILIATE_LABEL);

    expect(affiliationDialog()?.hasAttribute('open')).toBe(true);
    expect(affiliationDialog()?.querySelector('[data-testid="request-form"]')).not.toBeNull();
    expect(choices).toEqual([]);
    expect(trigger().textContent?.trim()).toBe(OWN_OFFICE_LABEL);
  });

  it('al cerrarse el modal, el campo lo desmonta', async () => {
    await choose(AFFILIATE_LABEL);

    affiliationDialog()?.querySelector<HTMLElement>('[data-testid="request-cancel"]')?.click();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('app-affiliation-dialog')).toBeNull();
  });
});
