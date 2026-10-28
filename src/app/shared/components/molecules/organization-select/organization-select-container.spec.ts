import { signal, type WritableSignal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of, throwError, type Observable } from 'rxjs';
import { vi, type Mock } from 'vitest';

import { SessionStore } from '@core/auth/session.store';
import { PracticeSitesClient } from '@core/data-access/practice-sites/practice-sites.client';
import { ROLE_ASSIGNMENT_STATUS } from '@core/data-access/practice-sites/role-assignment-concepts';
import type {
  MyRoleAssignment,
  PracticeSite,
  PracticeSitePage,
} from '@core/data-access/practice-sites/practice-sites.types';
import { OrganizationSelectContainer } from './organization-select-container';
import { practitionerOrganizationsOf } from './organization-select.rules';
import {
  AFFILIATE_LABEL,
  OWN_OFFICE_KEY,
  OWN_OFFICE_LABEL,
  type OrganizationChoice,
} from './organization-select.types';

const PROFILE_ID = 'hp-rojas';

function assignment(overrides: Partial<MyRoleAssignment> & Pick<MyRoleAssignment, 'practiceId' | 'practiceName'>): MyRoleAssignment {
  return {
    id: `ra-${overrides.practiceId}`,
    roleConceptId: 'role-attending',
    status: ROLE_ASSIGNMENT_STATUS.ACTIVE,
    isPrimary: false,
    createdAt: new Date('2026-10-01T12:00:00Z'),
    avatarUrl: null,
    tenantId: `tenant-${overrides.practiceId}`,
    ...overrides,
  };
}

function site(overrides: Partial<PracticeSite> & Pick<PracticeSite, 'id' | 'practiceId' | 'name'>): PracticeSite {
  return {
    code: 'SITE',
    timeZone: 'America/La_Paz',
    addressText: null,
    latitude: null,
    longitude: null,
    status: 'ACTIVE',
    ...overrides,
  };
}

const OWN_SITE = site({
  id: 'site-own',
  practiceId: 'practice-own',
  name: 'Consultorio Dra. Rojas',
  isOwnSite: true,
});
const OLIVOS_SITE = site({ id: 'site-olivos', practiceId: 'practice-olivos', name: 'Sede Central', isOwnSite: false });

const OWN_OFFICE_ASSIGNMENT = assignment({
  practiceId: 'practice-own',
  practiceName: 'Consultorio propio',
  practiceSiteId: 'site-own',
});
const OLIVOS_ASSIGNMENT = assignment({
  practiceId: 'practice-olivos',
  practiceName: 'Clínica Los Olivos',
  practiceSiteId: 'site-olivos',
  isPrimary: true,
});
const SAN_LUCAS_PENDING = assignment({
  practiceId: 'practice-san-lucas',
  practiceName: 'Hospital San Lucas',
  status: ROLE_ASSIGNMENT_STATUS.PENDING,
});

describe('practitionerOrganizationsOf', () => {
  it('pone el consultorio propio primero y no repite su afiliación', () => {
    const organizations = practitionerOrganizationsOf([OWN_OFFICE_ASSIGNMENT, OLIVOS_ASSIGNMENT], OWN_SITE);

    expect(organizations).toEqual([
      { practiceId: 'practice-own', practiceSiteId: 'site-own', name: 'Consultorio Dra. Rojas', isOwnOffice: true, tenantId: null },
      {
        practiceId: 'practice-olivos',
        practiceSiteId: 'site-olivos',
        name: 'Clínica Los Olivos',
        isOwnOffice: false,
        tenantId: 'tenant-practice-olivos',
      },
    ]);
  });

  it('sin sede propia no hay consultorio en la lista', () => {
    expect(practitionerOrganizationsOf([OLIVOS_ASSIGNMENT], null).map((o) => o.isOwnOffice)).toEqual([false]);
  });

  it('ofrece solo las afiliaciones activas, por concepto o por código', () => {
    const organizations = practitionerOrganizationsOf(
      [
        OLIVOS_ASSIGNMENT,
        SAN_LUCAS_PENDING,
        assignment({ practiceId: 'practice-sur', practiceName: 'Centro Médico Sur', statusCode: 'practice:ROLE_ASG_ACTIVE' }),
        assignment({ practiceId: 'practice-norte', practiceName: 'Centro Médico Norte', statusCode: 'ROLE_ASG_INVITED' }),
        assignment({ practiceId: 'practice-japones', practiceName: 'Hospital Japonés', status: ROLE_ASSIGNMENT_STATUS.ENDED }),
      ],
      null,
    );

    expect(organizations.map((o) => o.name)).toEqual(['Clínica Los Olivos', 'Centro Médico Sur']);
  });

  it('deja una sola fila por organización, la primera', () => {
    const organizations = practitionerOrganizationsOf(
      [
        assignment({ id: 'ra-1', practiceId: 'practice-sur', practiceName: 'Centro Médico Sur', practiceSiteId: 'site-sur-1' }),
        assignment({ id: 'ra-2', practiceId: 'practice-sur', practiceName: 'Centro Médico Sur', practiceSiteId: 'site-sur-2' }),
      ],
      null,
    );

    expect(organizations).toEqual([
      {
        practiceId: 'practice-sur',
        practiceSiteId: 'site-sur-1',
        name: 'Centro Médico Sur',
        isOwnOffice: false,
        tenantId: 'tenant-practice-sur',
      },
    ]);
  });

  it('una afiliación sin sede queda sin sede', () => {
    const [organization] = practitionerOrganizationsOf(
      [assignment({ practiceId: 'practice-sur', practiceName: 'Centro Médico Sur' })],
      null,
    );

    expect(organization.practiceSiteId).toBeNull();
  });

  it('una afiliación activa sin organización no se ofrece: no habría dónde publicar', () => {
    const organizations = practitionerOrganizationsOf(
      [
        assignment({ practiceId: 'practice-sur', practiceName: 'Centro Médico Sur', tenantId: undefined }),
        assignment({ practiceId: 'practice-norte', practiceName: 'Centro Médico Norte', tenantId: null }),
        assignment({ practiceId: 'practice-este', practiceName: 'Centro Médico Este', tenantId: '' }),
      ],
      null,
    );

    expect(organizations).toEqual([]);
  });

  it('una afiliación activa con su organización se ofrece y la lleva', () => {
    const [organization] = practitionerOrganizationsOf(
      [assignment({ practiceId: 'practice-sur', practiceName: 'Centro Médico Sur', tenantId: 'tenant-sur' })],
      null,
    );

    expect(organization).toMatchObject({ practiceId: 'practice-sur', tenantId: 'tenant-sur' });
  });

  it('«Mi consultorio» no lleva organización: publica en la de la sesión', () => {
    const [ownOffice] = practitionerOrganizationsOf([OWN_OFFICE_ASSIGNMENT], OWN_SITE);

    expect(ownOffice).toMatchObject({ isOwnOffice: true, tenantId: null });
  });
});

describe('OrganizationSelectContainer', () => {
  interface Doubles {
    readonly listMyRoleAssignments: Mock<() => Observable<readonly MyRoleAssignment[]>>;
    readonly listSitesOfPractitioner: Mock<(profileId: string) => Observable<PracticeSitePage>>;
  }

  let doubles: Doubles;
  let profileId: WritableSignal<string | null>;

  function page(items: readonly PracticeSite[]): PracticeSitePage {
    return { items, count: items.length };
  }

  async function render(): Promise<{
    fixture: ComponentFixture<OrganizationSelectContainer>;
    choices: OrganizationChoice[];
    affiliationRequests: () => number;
  }> {
    const fixture = TestBed.createComponent(OrganizationSelectContainer);
    const choices: OrganizationChoice[] = [];
    let requests = 0;
    fixture.componentInstance.selected.subscribe((choice) => choices.push(choice));
    fixture.componentInstance.affiliationRequested.subscribe(() => requests++);
    await fixture.whenStable();
    return { fixture, choices, affiliationRequests: () => requests };
  }

  function trigger(fixture: ComponentFixture<unknown>): HTMLButtonElement {
    return fixture.nativeElement.querySelector('.select-trigger');
  }

  function rows(fixture: ComponentFixture<unknown>): HTMLLIElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('[role="option"]'));
  }

  function rowLabels(fixture: ComponentFixture<unknown>): string[] {
    return rows(fixture).map((row) => row.querySelector('.option-label')?.textContent?.trim() ?? '');
  }

  async function open(fixture: ComponentFixture<unknown>): Promise<void> {
    trigger(fixture).click();
    await fixture.whenStable();
  }

  async function chooseRow(fixture: ComponentFixture<unknown>, index: number): Promise<void> {
    await open(fixture);
    rows(fixture)[index].click();
    await fixture.whenStable();
  }

  function failure(fixture: ComponentFixture<unknown>): HTMLElement | null {
    return fixture.nativeElement.querySelector('[data-testid="organization-select-failure"]');
  }

  beforeEach(async () => {
    doubles = {
      listMyRoleAssignments: vi.fn<() => Observable<readonly MyRoleAssignment[]>>(() =>
        of([OWN_OFFICE_ASSIGNMENT, OLIVOS_ASSIGNMENT, SAN_LUCAS_PENDING]),
      ),
      listSitesOfPractitioner: vi.fn<(profileId: string) => Observable<PracticeSitePage>>(() =>
        of(page([OWN_SITE, OLIVOS_SITE])),
      ),
    };
    profileId = signal<string | null>(PROFILE_ID);
    await TestBed.configureTestingModule({
      imports: [OrganizationSelectContainer],
      providers: [
        { provide: PracticeSitesClient, useValue: doubles },
        { provide: SessionStore, useValue: { practitionerProfileId: profileId } },
      ],
    }).compileComponents();
  });

  it('elige el consultorio por omisión y ofrece después las organizaciones activas', async () => {
    const { fixture } = await render();

    expect(trigger(fixture).textContent?.trim()).toBe(OWN_OFFICE_LABEL);
    await open(fixture);
    expect(rowLabels(fixture)).toEqual([OWN_OFFICE_LABEL, 'Clínica Los Olivos', AFFILIATE_LABEL]);
    expect(doubles.listSitesOfPractitioner).toHaveBeenCalledWith(PROFILE_ID);
  });

  it('no ofrece la organización activa que llega sin su `tenantId`', async () => {
    doubles.listMyRoleAssignments.mockReturnValue(
      of([
        OLIVOS_ASSIGNMENT,
        assignment({ practiceId: 'practice-sur', practiceName: 'Centro Médico Sur', tenantId: undefined }),
      ]),
    );
    const { fixture } = await render();

    await open(fixture);

    expect(rowLabels(fixture)).toEqual([OWN_OFFICE_LABEL, 'Clínica Los Olivos', AFFILIATE_LABEL]);
  });

  it('con la lista vacía, solo aparece el consultorio', async () => {
    doubles.listMyRoleAssignments.mockReturnValue(of([]));
    doubles.listSitesOfPractitioner.mockReturnValue(of(page([])));
    const { fixture } = await render();

    await open(fixture);

    expect(rowLabels(fixture)).toEqual([OWN_OFFICE_LABEL, AFFILIATE_LABEL]);
    expect(failure(fixture)).toBeNull();
  });

  it('reenvía la organización elegida', async () => {
    const { fixture, choices } = await render();

    await chooseRow(fixture, 1);

    expect(choices).toEqual([
      {
        key: 'practice-olivos',
        organization: {
          practiceId: 'practice-olivos',
          practiceSiteId: 'site-olivos',
          name: 'Clínica Los Olivos',
          isOwnOffice: false,
          tenantId: 'tenant-practice-olivos',
        },
      },
    ]);
  });

  it('el consultorio entrega su práctica y su sede', async () => {
    const { fixture, choices } = await render();
    fixture.componentRef.setInput('value', 'practice-olivos');
    await fixture.whenStable();

    await chooseRow(fixture, 0);

    expect(choices).toEqual([
      {
        key: OWN_OFFICE_KEY,
        organization: {
          practiceId: 'practice-own',
          practiceSiteId: 'site-own',
          name: 'Consultorio Dra. Rojas',
          isOwnOffice: true,
          tenantId: null,
        },
      },
    ]);
  });

  it('la última opción reenvía «afiliarme» y el valor no cambia', async () => {
    const { fixture, choices, affiliationRequests } = await render();

    await chooseRow(fixture, 2);

    expect(affiliationRequests()).toBe(1);
    expect(choices).toEqual([]);
    expect(trigger(fixture).textContent?.trim()).toBe(OWN_OFFICE_LABEL);
  });

  it('sin perfil profesional en la sesión no pide nada y queda el consultorio', async () => {
    profileId.set(null);
    const { fixture } = await render();

    await open(fixture);

    expect(doubles.listMyRoleAssignments).not.toHaveBeenCalled();
    expect(doubles.listSitesOfPractitioner).not.toHaveBeenCalled();
    expect(rowLabels(fixture)).toEqual([OWN_OFFICE_LABEL, AFFILIATE_LABEL]);
    expect(failure(fixture)).toBeNull();
  });

  it('si la carga falla, avisa, deja el consultorio y reintenta', async () => {
    doubles.listMyRoleAssignments.mockReturnValueOnce(throwError(() => new Error('503')));
    const { fixture } = await render();

    expect(failure(fixture)?.textContent).toContain('No pudimos cargar sus organizaciones');
    await open(fixture);
    expect(rowLabels(fixture)).toEqual([OWN_OFFICE_LABEL, AFFILIATE_LABEL]);
    fixture.nativeElement.querySelector('.select-dialog .dialog-actions button').click();
    await fixture.whenStable();

    fixture.nativeElement.querySelector('[data-testid="organization-select-retry"]').click();
    await fixture.whenStable();

    expect(failure(fixture)).toBeNull();
    await open(fixture);
    expect(rowLabels(fixture)).toEqual([OWN_OFFICE_LABEL, 'Clínica Los Olivos', AFFILIATE_LABEL]);
  });

  it('si falla la sede propia tampoco ofrece organizaciones', async () => {
    doubles.listSitesOfPractitioner.mockReturnValueOnce(throwError(() => new Error('500')));
    const { fixture } = await render();

    await open(fixture);

    expect(failure(fixture)).not.toBeNull();
    expect(rowLabels(fixture)).toEqual([OWN_OFFICE_LABEL, AFFILIATE_LABEL]);
  });

  it('vuelve a cargar cuando cambia el perfil de la sesión', async () => {
    const { fixture } = await render();

    profileId.set('hp-otra');
    await fixture.whenStable();

    expect(doubles.listMyRoleAssignments).toHaveBeenCalledTimes(2);
    expect(doubles.listSitesOfPractitioner).toHaveBeenLastCalledWith('hp-otra');
  });

  it('tiene nombre accesible y se deshabilita desde afuera', async () => {
    const { fixture } = await render();

    fixture.componentRef.setInput('disabled', true);
    await fixture.whenStable();

    expect(trigger(fixture).getAttribute('aria-label')).toBe('Organización');
    expect(trigger(fixture).disabled).toBe(true);
  });
});
