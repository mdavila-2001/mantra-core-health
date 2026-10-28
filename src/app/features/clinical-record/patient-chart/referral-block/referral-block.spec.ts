import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, type WritableSignal } from '@angular/core';

import { AuthService } from '../../../../core/auth/auth.service';
import type { Referral } from '../../../../core/data-access/referrals/referrals.types';
import { empty, loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import type { ReferenceOption } from '../../../../shared/components/molecules/reference-combobox/reference-combobox.types';
import { ReferralBlock } from './referral-block';

const LUCIA = {
  kind: 'PRACTITIONER',
  id: 'hp-1',
  displayName: 'Dra. Lucía Mendoza',
  tenantId: 't-clinica',
  subtitle: 'Endocrinología',
};

/** Quien deriva. La API no debería devolverlo, y si lo hace no se ofrece. */
const YO = { ...LUCIA, id: 'hp-yo', displayName: 'Dra. Camila Vargas', subtitle: null };

const HOSPITAL = {
  kind: 'ORGANIZATION',
  id: 't-hospital',
  displayName: 'Hospital San Lucas',
  tenantId: 't-hospital',
  subtitle: 'Hospital · Santa Cruz',
};

const FISIO = {
  id: 's-fisio',
  code: 'FISIO',
  name: 'Fisioterapia',
  description: 'Diez sesiones.',
  price: '120.00',
  currency: 'BOB',
  tenantId: 't-hospital',
  practiceName: 'Hospital San Lucas',
};

const ALTA = {
  id: 'ref-1',
  patientProfileId: 'pat-1',
  statusConceptId: 'x',
  createdAt: '2026-10-24T12:00:00Z',
};

/**
 * Derivar desde la consulta: a otro profesional (pedido del propietario,
 * 24/10/2026) o a una organización médica, por un servicio concreto («tipo
 * tratamiento», pedido del cliente, 28/10/2026). Se fija el contrato con la
 * API: qué se manda, qué no se manda (quien deriva sale del token), que sin
 * encuentro no hay formulario, y que la lista y los servicios respetan M34.
 */
describe('ReferralBlock', () => {
  let fixture: ComponentFixture<ReferralBlock>;
  let http: HttpTestingController;

  function member<T>(name: string): T {
    const c = fixture.componentInstance as unknown as Record<string, unknown>;
    const value = c[name];
    return (typeof value === 'function' ? value.bind(c) : value) as T;
  }

  function writable<T>(name: string): WritableSignal<T> {
    return (fixture.componentInstance as unknown as Record<string, WritableSignal<T>>)[name];
  }

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function create(encounterId: string | null = 'enc-1'): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: { practitionerProfileId: signal<string | null>('hp-yo') },
        },
      ],
    });
    fixture = TestBed.createComponent(ReferralBlock);
    fixture.componentRef.setInput('patientProfileId', 'pat-1');
    fixture.componentRef.setInput('encounterId', encounterId);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  }

  /** Busca, devuelve los destinos y elige el primero que se ofrece. */
  function pickTarget(targets: readonly object[], services: readonly object[] = [FISIO]): void {
    member<(q: string) => void>('search')('lu');
    http.expectOne((r) => r.url === '/referrals/targets').flush({ items: targets });
    const option = member<() => readonly ReferenceOption[]>('targetOptions')()[0]!;
    member<(o: ReferenceOption) => void>('choose')(option);
    http.expectOne((r) => r.url === '/referrals/target-services').flush({ items: services });
    fixture.detectChanges();
  }

  afterEach(() => {
    for (const r of http.match((req) => req.url === '/terminology/concepts')) {
      r.flush({ items: [], count: 0, limit: 200 });
    }
    http.verify();
  });

  /* -- Buscar ---------------------------------------------------------------- */

  it('busca en la API con espera, desde dos letras y por la clase elegida', async () => {
    create();
    const input = host().querySelector<HTMLInputElement>('[data-testid="referral-practitioner"] input')!;
    expect(input).not.toBeNull();

    input.value = 'l';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r, 400));
    // Una sola letra no viaja: el servidor exige dos.
    http.expectNone((r) => r.url === '/referrals/targets');

    input.value = 'luc';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    http.expectNone((r) => r.url === '/referrals/targets');
    await new Promise((r) => setTimeout(r, 400));

    const req = http.expectOne((r) => r.url === '/referrals/targets');
    expect(req.request.params.get('q')).toBe('luc');
    expect(req.request.params.get('kind')).toBe('PRACTITIONER');
    req.flush({ items: [LUCIA] });

    expect(member<() => readonly ReferenceOption[]>('targetOptions')()).toEqual([
      { value: 'hp-1', label: 'Dra. Lucía Mendoza', hint: 'Endocrinología' },
    ]);
  });

  it('nunca ofrece a quien deriva, aunque la API lo devuelva', () => {
    create();
    member<(q: string) => void>('search')('va');
    http.expectOne((r) => r.url === '/referrals/targets').flush({ items: [YO, LUCIA] });

    expect(member<() => readonly ReferenceOption[]>('targetOptions')().map((o) => o.value)).toEqual([
      'hp-1',
    ]);
  });

  it('a organización: busca por ORGANIZATION y pide sus servicios por targetTenantId', () => {
    create();
    member<(k: string) => void>('chooseKind')('ORGANIZATION');
    fixture.detectChanges();
    expect(host().querySelector('[data-testid="referral-organization"]')).not.toBeNull();

    member<(q: string) => void>('search')('san');
    const search = http.expectOne((r) => r.url === '/referrals/targets');
    expect(search.request.params.get('kind')).toBe('ORGANIZATION');
    search.flush({ items: [HOSPITAL] });
    member<(o: ReferenceOption) => void>('choose')(member<() => readonly ReferenceOption[]>('targetOptions')()[0]!);

    const servicesReq = http.expectOne((r) => r.url === '/referrals/target-services');
    expect(servicesReq.request.params.get('targetTenantId')).toBe('t-hospital');
    expect(servicesReq.request.params.has('targetProfileId')).toBe(false);
    servicesReq.flush({ items: [FISIO] });

    expect(member<() => readonly { label: string }[]>('serviceOptions')().map((o) => o.label)).toEqual([
      'Sin un servicio en particular',
      'Fisioterapia · Bs 120.00',
    ]);
  });

  it('cambiar de clase olvida el destino elegido', () => {
    create();
    pickTarget([LUCIA]);
    member<(k: string) => void>('chooseKind')('ORGANIZATION');
    expect(member<() => unknown>('target')()).toBeNull();
    expect(writable<string | null>('selectedService')()).toBeNull();
  });

  /* -- Servicios ------------------------------------------------------------- */

  it('un destino sin servicios es S3 con su próxima acción, y aun así se puede derivar', () => {
    create();
    pickTarget([LUCIA], []);

    const state = member<() => ViewState<unknown>>('services')();
    expect(state.status).toBe('empty');
    expect(state.status === 'empty' && state.nextAction.label).toContain('busque otro destino');
    expect(host().textContent).toContain('no tiene servicios publicados');
    expect(member<() => boolean>('canSubmit')()).toBe(true);
  });

  it('el detalle del servicio elegido se muestra para no elegir a ciegas', () => {
    create();
    pickTarget([LUCIA]);
    writable<string | null>('selectedService').set('s-fisio');
    expect(member<() => string>('serviceHint')()).toBe('Diez sesiones.');
  });

  /* -- Tipo y envío ---------------------------------------------------------- */

  it('el tipo viene en Tratamiento y las cinco opciones están en castellano', () => {
    create();
    expect(writable<string | null>('referralType')()).toBe('TREATMENT');
    expect(member<readonly { label: string }[]>('typeOptions').map((o) => o.label)).toEqual([
      'Tratamiento',
      'Interconsulta',
      'Estudio diagnóstico',
      'Procedimiento',
      'Segunda opinión',
    ]);
  });

  it('sin elegir a nadie no se puede enviar', () => {
    create();
    expect(member<() => boolean>('canSubmit')()).toBe(false);
    pickTarget([LUCIA]);
    expect(member<() => boolean>('canSubmit')()).toBe(true);
  });

  it('deriva: persona, encuentro, destino, servicio y tipo — y NO quién deriva', () => {
    create();
    let changes = 0;
    fixture.componentInstance.cambio.subscribe(() => (changes += 1));
    pickTarget([LUCIA]);
    writable<string | null>('selectedService').set('s-fisio');
    writable<string>('reason').set('  Control de la tiroides  ');

    member<() => void>('submit')();

    const req = http.expectOne((r) => r.url === '/referrals' && r.method === 'POST');
    expect(req.request.body).toEqual({
      patientProfileId: 'pat-1',
      sourceEncounterId: 'enc-1',
      targetProfileId: 'hp-1',
      targetServiceCatalogId: 's-fisio',
      referralType: 'TREATMENT',
      reasonText: 'Control de la tiroides',
    });
    expect(req.request.body.referringProfileId).toBeUndefined();
    req.flush(ALTA, { status: 201, statusText: 'Created' });
    fixture.detectChanges();

    expect(changes).toBe(1);
    expect(member<() => string | null>('referredTo')()).toContain('Lucía Mendoza');
    expect(host().querySelector('[data-testid="referral-success"]')).not.toBeNull();
    // El formulario queda limpio para derivar a otro, con Tratamiento otra vez.
    expect(member<() => boolean>('canSubmit')()).toBe(false);
    expect(writable<string | null>('referralType')()).toBe('TREATMENT');
  });

  it('a una organización manda targetTenantId, y lo vacío no viaja', () => {
    create();
    member<(k: string) => void>('chooseKind')('ORGANIZATION');
    pickTarget([HOSPITAL]);
    writable<string | null>('referralType').set('SECOND_OPINION');
    writable<Date | null>('validUntil').set(new Date(2026, 11, 31));

    member<() => void>('submit')();

    const req = http.expectOne((r) => r.url === '/referrals' && r.method === 'POST');
    expect(req.request.body).toEqual({
      patientProfileId: 'pat-1',
      sourceEncounterId: 'enc-1',
      targetTenantId: 't-hospital',
      referralType: 'SECOND_OPINION',
      validUntil: '2026-12-31',
    });
    req.flush(ALTA);
  });

  it('sin encuentro abierto lo dice y no ofrece enviar', () => {
    create(null);

    expect(member<() => boolean>('noEncounter')()).toBe(true);
    expect(member<() => boolean>('canSubmit')()).toBe(false);
    expect(host().querySelector('[data-testid="referral-no-encounter"]')).not.toBeNull();
    expect(host().querySelector('[data-testid="referral-submit"]')).toBeNull();
  });

  /* -- Errores --------------------------------------------------------------- */

  it('un 409 es un aviso («ya la derivó»), no un error', () => {
    create();
    pickTarget([LUCIA]);
    member<() => void>('submit')();
    http
      .expectOne((r) => r.url === '/referrals' && r.method === 'POST')
      .flush(
        { code: 'CONFLICT', message: 'Ya existe una referencia equivalente' },
        { status: 409, statusText: 'Conflict' },
      );
    fixture.detectChanges();

    expect(member<() => boolean>('duplicate')()).toBe(true);
    expect(member<() => string | null>('submissionError')()).toBeNull();
    expect(host().querySelector('[data-testid="referral-duplicate"]')).not.toBeNull();
  });

  it('un 404 del encuentro se dice con palabras, no con «error», y no emite cambio', () => {
    create();
    let changes = 0;
    fixture.componentInstance.cambio.subscribe(() => (changes += 1));
    pickTarget([LUCIA]);
    member<() => void>('submit')();
    http
      .expectOne((r) => r.url === '/referrals' && r.method === 'POST')
      .flush(
        { code: 'NOT_FOUND', message: 'Encuentro no encontrado' },
        { status: 404, statusText: 'Not Found' },
      );
    fixture.detectChanges();

    expect(changes).toBe(0);
    expect(member<() => string | null>('submissionError')()).toContain('No encontramos este encuentro');
    expect(host().querySelector('[data-testid="referral-error"]')).not.toBeNull();
    // Lo elegido sigue ahí: reintentar no obliga a empezar de cero.
    expect(member<() => unknown>('target')()).not.toBeNull();
  });

  it('una validación del servidor se muestra con su mensaje', () => {
    create();
    pickTarget([LUCIA]);
    member<() => void>('submit')();
    http.expectOne((r) => r.url === '/referrals' && r.method === 'POST').flush(
      {
        statusCode: 400,
        code: 'VALIDATION_FAILED',
        message: 'Validation failed',
        details: { violations: ['reasonText must be shorter than or equal to 1000 characters'] },
      },
      { status: 400, statusText: 'Bad Request' },
    );
    fixture.detectChanges();
    expect(host().querySelector('[data-testid="referral-error"]')?.textContent).toContain('1000');
  });

  it('si los servicios no cargan, se dice y se puede reintentar', () => {
    create();
    member<(q: string) => void>('search')('lu');
    http.expectOne((r) => r.url === '/referrals/targets').flush({ items: [LUCIA] });
    member<(o: ReferenceOption) => void>('choose')(member<() => readonly ReferenceOption[]>('targetOptions')()[0]!);
    http
      .expectOne((r) => r.url === '/referrals/target-services')
      .flush({ code: 'INTERNAL', message: 'x' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(member<() => ViewState<unknown>>('services')().status).toBe('error');

    member<() => void>('loadServices')();
    http.expectOne((r) => r.url === '/referrals/target-services').flush({ items: [FISIO] });
    expect(member<() => ViewState<unknown>>('services')().status).toBe('ready');
  });

  /* -- La lista -------------------------------------------------------------- */

  describe('la lista', () => {
    const REFERRAL: Referral = {
      id: 'r-1',
      patientProfileId: 'pat-1',
      statusConceptId: 'st-aceptada',
      createdAt: new Date('2026-10-20T12:00:00.000Z'),
      referralType: 'TREATMENT',
      targetDisplayName: 'Hospital San Lucas',
      targetServiceName: 'Fisioterapia',
    };

    it('sin `referrals` no se dibuja', () => {
      create();
      expect(host().querySelector('[data-testid="referral-list"]')).toBeNull();
      expect(member<() => unknown>('list')()).toBeNull();
    });

    it('vacía es S3 con próxima acción', () => {
      create();
      fixture.componentRef.setInput('referrals', ready([]));
      fixture.detectChanges();
      expect(member<() => ViewState<unknown>>('list')().status).toBe('empty');
      expect(host().textContent).toContain('todavía no tiene derivaciones');
    });

    it('muestra tipo, destino, servicio y el estado traducido por código', () => {
      create();
      fixture.componentRef.setInput('referrals', ready([REFERRAL]));
      fixture.detectChanges();
      http.expectOne((r) => r.url === '/terminology/concepts').flush({
        items: [
          { conceptId: 'st-aceptada', code: 'REF_ACCEPTED', display: 'Referral accepted', codeSystemVersionId: 'v' },
        ],
        count: 1,
        limit: 200,
      });
      fixture.detectChanges();

      const rows = host().querySelectorAll('[data-testid="referral-row"]');
      expect(rows).toHaveLength(1);
      expect(rows[0]?.textContent).toContain('Tratamiento · Hospital San Lucas');
      expect(rows[0]?.textContent).toContain('Fisioterapia');
      // El código manda: el rótulo del catálogo en inglés no llega a la pantalla.
      expect(rows[0]?.textContent).toContain('Aceptada');
      expect(rows[0]?.textContent).not.toContain('Referral accepted');
    });

    it('se sigue viendo sin encuentro abierto', () => {
      create(null);
      fixture.componentRef.setInput('referrals', ready([REFERRAL]));
      fixture.detectChanges();
      http.expectOne((r) => r.url === '/terminology/concepts').flush({ items: [], count: 0, limit: 200 });
      fixture.detectChanges();
      expect(host().querySelectorAll('[data-testid="referral-row"]')).toHaveLength(1);
    });

    it('mientras no sabe cómo se llama el estado, la lista espera (S2): nunca un estado falso', () => {
      create();
      fixture.componentRef.setInput('referrals', ready([REFERRAL]));
      fixture.detectChanges();
      expect(member<() => ViewState<unknown>>('list')().status).toBe('loading');
      expect(host().querySelectorAll('[data-testid="referral-row"]')).toHaveLength(0);
      http.expectOne((r) => r.url === '/terminology/concepts').flush({ items: [], count: 0, limit: 200 });
      expect(member<() => ViewState<unknown>>('list')().status).toBe('ready');
    });

    it('si el catálogo falla, la lista igual se muestra y no se vuelve a pedir al releer', () => {
      create();
      fixture.componentRef.setInput('referrals', ready([REFERRAL]));
      fixture.detectChanges();
      http
        .expectOne((r) => r.url === '/terminology/concepts')
        .flush({ code: 'INTERNAL', message: 'x' }, { status: 500, statusText: 'Server Error' });
      fixture.detectChanges();
      expect(host().querySelector('[data-testid="referral-row"]')?.textContent).toContain('Sin registrar');

      // La relectura pasa por `loading` y vuelve con lo mismo: no hay otra petición.
      fixture.componentRef.setInput('referrals', loading());
      fixture.detectChanges();
      fixture.componentRef.setInput('referrals', ready([REFERRAL]));
      fixture.detectChanges();
      http.expectNone((r) => r.url === '/terminology/concepts');
      expect(member<() => ViewState<unknown>>('list')().status).toBe('ready');
    });

    it('los estados que no son datos pasan tal cual al anfitrión', () => {
      create();
      fixture.componentRef.setInput('referrals', loading());
      expect(member<() => ViewState<unknown>>('list')().status).toBe('loading');
      fixture.componentRef.setInput('referrals', empty({ label: 'x' }));
      expect(member<() => ViewState<unknown>>('list')().status).toBe('empty');
    });
  });
});
