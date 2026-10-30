import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import {
  OWN_OFFICE_KEY,
  type OrganizationChoice,
  type PractitionerOrganization,
} from '../../../shared/components/molecules/organization-select/organization-select.types';
import { PublicationAttempt, PublicationPlace, publicationTargetOf } from './publication-target';

const SESSION_TENANT = 'tenant-session';

const OWN_OFFICE: PractitionerOrganization = {
  practiceId: 'practice-own',
  practiceSiteId: 'site-own',
  name: 'Consultorio Dra. Rojas',
  isOwnOffice: true,
  tenantId: null,
};
const OLIVOS: PractitionerOrganization = {
  practiceId: 'practice-olivos',
  practiceSiteId: 'site-olivos',
  name: 'Clínica Los Olivos',
  isOwnOffice: false,
  tenantId: 'tenant-olivos',
};

const OWN_OFFICE_CHOICE: OrganizationChoice = { key: OWN_OFFICE_KEY, organization: OWN_OFFICE };
const OLIVOS_CHOICE: OrganizationChoice = { key: OLIVOS.practiceId, organization: OLIVOS };

/**
 * Dónde se publica la agenda: la organización elegida en el selector, o la de
 * la sesión. «Mi consultorio» tiene que mandar exactamente lo de antes del
 * selector, que es lo que el resto de la pantalla y sus pruebas suponen.
 */
describe('publicationTargetOf', () => {
  it('una organización afiliada manda su organización y su práctica, y habla como ella', () => {
    expect(publicationTargetOf(OLIVOS_CHOICE, SESSION_TENANT)).toEqual({
      tenantId: 'tenant-olivos',
      practiceId: 'practice-olivos',
      scope: { tenantId: 'tenant-olivos' },
    });
  });

  it('«Mi consultorio» publica en la organización de la sesión, sin práctica ni organización declarada', () => {
    expect(publicationTargetOf(OWN_OFFICE_CHOICE, SESSION_TENANT)).toEqual({
      tenantId: SESSION_TENANT,
      scope: {},
    });
  });

  it('«Mi consultorio» sin registrar también publica en la de la sesión', () => {
    expect(
      publicationTargetOf({ key: OWN_OFFICE_KEY, organization: null }, SESSION_TENANT),
    ).toEqual({ tenantId: SESSION_TENANT, scope: {} });
  });

  it('sin nada elegido es lo de siempre: la organización de la sesión, sin declararla', () => {
    expect(publicationTargetOf(null, SESSION_TENANT)).toEqual({
      tenantId: SESSION_TENANT,
      scope: {},
    });
  });

  it('sin organización en la sesión, «Mi consultorio» no tiene dónde publicar', () => {
    expect(publicationTargetOf(OWN_OFFICE_CHOICE, null)).toBeNull();
  });

  it('una organización afiliada no depende de la sesión', () => {
    expect(publicationTargetOf(OLIVOS_CHOICE, null)).toEqual({
      tenantId: 'tenant-olivos',
      practiceId: 'practice-olivos',
      scope: { tenantId: 'tenant-olivos' },
    });
  });
});

describe('PublicationPlace', () => {
  it('sigue lo elegido mientras la pantalla publica la agenda propia', () => {
    const place = new PublicationPlace(signal(SESSION_TENANT), signal(true));

    expect(place.tenantId()).toBe(SESSION_TENANT);
    place.choice.set(OLIVOS_CHOICE);

    expect(place.target()).toEqual({
      tenantId: 'tenant-olivos',
      practiceId: 'practice-olivos',
      scope: { tenantId: 'tenant-olivos' },
    });
    expect(place.tenantId()).toBe('tenant-olivos');
  });

  it('declara la organización elegida para leer lo suyo, y ninguna con «Mi consultorio»', () => {
    const place = new PublicationPlace(signal(SESSION_TENANT), signal(true));

    expect(place.scope()).toEqual({});
    place.choice.set(OLIVOS_CHOICE);
    expect(place.scope()).toEqual({ tenantId: 'tenant-olivos' });
    place.choice.set(OWN_OFFICE_CHOICE);
    expect(place.scope()).toEqual({});
  });

  it('sin organización en ningún lado no declara nada', () => {
    const place = new PublicationPlace(signal(null), signal(true));

    expect(place.target()).toBeNull();
    expect(place.scope()).toEqual({});
  });

  it('quien publica para otro recurso publica en la sesión aunque haya elegido otra', () => {
    const choosesOwn = signal(true);
    const place = new PublicationPlace(signal(SESSION_TENANT), choosesOwn);
    place.choice.set(OLIVOS_CHOICE);

    choosesOwn.set(false);

    expect(place.target()).toEqual({ tenantId: SESSION_TENANT, scope: {} });
    expect(place.scope()).toEqual({});
  });

  it('avisa la organización al empezar y cada vez que cambia, no cuando cambia otra cosa', () => {
    const place = new PublicationPlace(signal(SESSION_TENANT), signal(true));
    const unrelated = signal(0);
    const loads: (string | null)[] = [];
    TestBed.runInInjectionContext(() =>
      place.watchTenant((tenantId) => {
        unrelated();
        loads.push(tenantId);
      }),
    );
    TestBed.tick();

    place.choice.set(OLIVOS_CHOICE);
    TestBed.tick();
    unrelated.set(1);
    TestBed.tick();
    place.choice.set(OWN_OFFICE_CHOICE);
    TestBed.tick();

    expect(loads).toEqual([SESSION_TENANT, 'tenant-olivos', SESSION_TENANT]);
  });
});

describe('PublicationAttempt', () => {
  const RETIRED = {
    id: 'tpl-1',
    statusConceptId: 'archived',
    releasedSlots: 12,
    keptSlots: 2,
    liveBookings: 2,
    liveBookingIds: ['b-1', 'b-2'],
    truncated: false,
  };

  it('habla como la organización con la que empezó', () => {
    const attempt = new PublicationAttempt();
    expect(attempt.scope()).toBeUndefined();

    attempt.begin({ tenantId: 'tenant-olivos', scope: { tenantId: 'tenant-olivos' } });

    expect(attempt.scope()).toEqual({ tenantId: 'tenant-olivos' });
  });

  it('retomar tras un fallo no olvida lo ya retirado', () => {
    const attempt = new PublicationAttempt();
    attempt.begin({ tenantId: SESSION_TENANT, scope: {} });
    attempt.retirement.set(RETIRED);

    attempt.begin({ tenantId: SESSION_TENANT, scope: {} });

    expect(attempt.retirement()).toEqual(RETIRED);
  });

  it('al soltarlo no queda nada: ni dónde publicaba ni lo que retiró', () => {
    const attempt = new PublicationAttempt();
    attempt.begin({ tenantId: 'tenant-olivos', scope: { tenantId: 'tenant-olivos' } });
    attempt.retirement.set(RETIRED);

    attempt.reset();

    expect(attempt.scope()).toBeUndefined();
    expect(attempt.retirement()).toBeNull();
  });
});
