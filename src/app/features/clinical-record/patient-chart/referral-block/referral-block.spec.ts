import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, type WritableSignal } from '@angular/core';

import { AuthService } from '../../../../core/auth/auth.service';
import { ReferralsClient } from '../../../../core/data-access/referrals/referrals.client';
import type { Referral, ReferralCreated } from '../../../../core/data-access/referrals/referrals.types';
import { empty, loading, ready, stale } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import type { ReferenceOption } from '../../../../shared/components/molecules/reference-combobox/reference-combobox.types';
import { ReferralBlock } from './referral-block';
import { emptyTransferDraft, type TransferDraft } from './referral-transfer.model';

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
  price: 120,
  currency: 'BOB',
  tenantId: 't-hospital',
  practiceName: 'Hospital San Lucas',
};

/** Otra profesional: para cambiar de destino con una lectura en vuelo. */
const ANA = { ...LUCIA, id: 'hp-2', displayName: 'Dra. Ana Suárez', subtitle: 'Cardiología' };

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

  /** Envía con un servicio elegido y responde el POST con ese error. */
  function submitFailing(body: object, status: number, statusText: string): void {
    pickTarget([LUCIA]);
    writable<string | null>('selectedService').set('s-fisio');
    member<() => void>('submit')();
    http.expectOne((r) => r.url === '/referrals' && r.method === 'POST').flush(body, { status, statusText });
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
    // El estado del consentimiento de cada fila y las sedes de una organización
    // se leen aparte: se responden vacíos para que `verify()` hable de lo que
    // cada prueba mira.
    for (const r of http.match((req) => req.url === '/consent/treatment-informed-consents')) {
      r.flush({ items: [] });
    }
    for (const r of http.match((req) => /^\/tenants\/[^/]+\/branches$/.test(req.url))) {
      r.flush({ items: [], count: 0 });
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

  it('el motivo dice dónde lo ve la persona: en el aviso de un profesional, en su lista si no', () => {
    create();
    expect(member<() => string>('reasonHint')()).toContain('en su aviso');
    member<(k: string) => void>('chooseKind')('ORGANIZATION');
    expect(member<() => string>('reasonHint')()).toContain('lista de derivaciones, no en el aviso');
    member<(k: string) => void>('chooseKind')('EXTERNAL');
    expect(member<() => string>('reasonHint')()).toContain('lista de derivaciones');
  });

  it('cambiar de clase olvida el destino elegido', () => {
    create();
    pickTarget([LUCIA]);
    member<(k: string) => void>('chooseKind')('ORGANIZATION');
    expect(member<() => unknown>('target')()).toBeNull();
    expect(writable<string | null>('selectedService')()).toBeNull();
  });

  it('cambiar de clase vacía las opciones y apaga «buscando»', () => {
    create();
    member<(q: string) => void>('search')('lu');
    http.expectOne((r) => r.url === '/referrals/targets').flush({ items: [LUCIA] });
    member<(q: string) => void>('search')('luc');
    expect(writable<boolean>('searching')()).toBe(true);
    const inFlight = http.expectOne((r) => r.url === '/referrals/targets');

    member<(k: string) => void>('chooseKind')('ORGANIZATION');

    expect(member<() => readonly ReferenceOption[]>('targetOptions')()).toEqual([]);
    expect(writable<boolean>('searching')()).toBe(false);
    // La búsqueda en vuelo se canceló: no queda nada que responder.
    expect(inFlight.cancelled).toBe(true);
  });

  it('una respuesta tardía de la clase anterior no repuebla las opciones', () => {
    create();
    member<(q: string) => void>('search')('lu');
    const late = http.expectOne((r) => r.url === '/referrals/targets');
    member<(k: string) => void>('chooseKind')('ORGANIZATION');
    // Aunque la cancelación no llegara a tiempo, la respuesta es de otra clase.
    if (!late.cancelled) late.flush({ items: [LUCIA] });

    expect(member<() => readonly ReferenceOption[]>('targetOptions')()).toEqual([]);
    expect(writable<boolean>('searching')()).toBe(false);
  });

  it('olvidar el destino descarta la búsqueda en vuelo', () => {
    create();
    member<(q: string) => void>('search')('lu');
    const inFlight = http.expectOne((r) => r.url === '/referrals/targets');
    member<(o: ReferenceOption | null) => void>('choose')(null);
    expect(inFlight.cancelled).toBe(true);
    expect(writable<boolean>('searching')()).toBe(false);
    expect(member<() => readonly ReferenceOption[]>('targetOptions')()).toEqual([]);
  });

  /* -- Servicios ------------------------------------------------------------- */

  it('un destino sin servicios lo dice en línea, con sus dos salidas, y aun así se puede derivar', () => {
    create();
    pickTarget([LUCIA], []);

    expect(member<() => boolean>('noServices')()).toBe(true);
    const notice = host().querySelector('[data-testid="referral-no-services"]');
    expect(notice?.textContent).toContain('Este destino no tiene servicios publicados');
    expect(notice?.querySelector('[data-testid="referral-without-service"]')).not.toBeNull();
    expect(notice?.querySelector('[data-testid="referral-search-another"]')).not.toBeNull();
    // No es el S3 de página («Todavía no hay nada acá»).
    expect(host().textContent).not.toContain('Todavía no hay nada');
    expect(member<() => boolean>('canSubmit')()).toBe(true);
  });

  it('«Buscar otro destino» olvida el elegido y vuelve al buscador', async () => {
    create();
    pickTarget([LUCIA], []);
    host().querySelector<HTMLElement>('[data-testid="referral-search-another"]')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(member<() => unknown>('target')()).toBeNull();
    expect(host().querySelector('[data-testid="referral-no-services"]')).toBeNull();
    expect(document.activeElement).toBe(
      host().querySelector('[data-testid="referral-practitioner"] input'),
    );
  });

  it('«Derivar sin un servicio» lleva al campo que lo describe', async () => {
    create();
    pickTarget([LUCIA], []);
    host().querySelector<HTMLElement>('[data-testid="referral-without-service"]')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.activeElement).toBe(
      host().querySelector('[data-testid="referral-requested-service"] textarea'),
    );
  });

  it('sin destino, el campo «Servicio» ya está, apagado y diciendo qué falta', () => {
    create();
    const pending = host().querySelector('[data-testid="referral-service-pending"]');
    expect(pending).not.toBeNull();
    expect(pending?.closest('app-form-field')?.textContent).toContain('Elija el destino');
  });

  it('una respuesta tardía de los servicios de otro destino no pisa a la del elegido', () => {
    create();
    member<(q: string) => void>('search')('lu');
    http.expectOne((r) => r.url === '/referrals/targets').flush({ items: [LUCIA, ANA] });
    const [lucia, ana] = member<() => readonly ReferenceOption[]>('targetOptions')();
    member<(o: ReferenceOption) => void>('choose')(lucia!);
    member<(o: ReferenceOption) => void>('choose')(ana!);
    const [first, second] = http.match((r) => r.url === '/referrals/target-services');
    expect(first!.request.params.get('targetProfileId')).toBe('hp-1');

    first!.flush({ items: [FISIO] });
    expect(member<() => ViewState<unknown>>('services')().status).toBe('loading');
    second!.flush({ items: [] });
    expect(member<() => boolean>('noServices')()).toBe(true);
  });

  it('el detalle del servicio elegido se muestra para no elegir a ciegas', () => {
    create();
    pickTarget([LUCIA]);
    writable<string | null>('selectedService').set('s-fisio');
    expect(member<() => string>('serviceHint')()).toBe('Diez sesiones.');
  });

  /* -- Tipo y envío ---------------------------------------------------------- */

  it('el tipo viene en Tratamiento y las ocho opciones de la API están en castellano', () => {
    create();
    expect(writable<string | null>('referralType')()).toBe('TREATMENT');
    expect(member<readonly { label: string }[]>('typeOptions').map((o) => o.label)).toEqual([
      'Tratamiento',
      'Interconsulta',
      'Estudio diagnóstico',
      'Procedimiento',
      'Segunda opinión',
      'Terapia',
      'Internación',
      'Otro',
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
    const issued: ReferralCreated[] = [];
    TestBed.inject(ReferralsClient).issued.subscribe((c) => issued.push(c));
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
    // Tratamiento ofrece consentimiento: el detalle se abre solo, leído del servidor.
    http
      .expectOne((r) => r.url === '/referrals/ref-1' && r.method === 'GET')
      .flush({ ...ALTA, status: 'PENDING', referralType: 'TREATMENT', targetProfileId: 'hp-1' });
    fixture.detectChanges();
    expect(member<{ opened: () => Referral | null }>('detail').opened()?.id).toBe('ref-1');
    expect(member<{ justIssued: () => boolean }>('detail').justIssued()).toBe(true);

    // La relectura la dispara el cliente (`issued`), no el bloque: así llega
    // aunque el modal se cierre con el envío en vuelo.
    expect(issued).toEqual([ALTA]);
    expect(changes).toBe(0);
    expect(member<() => { name: string } | null>('issued')()?.name).toContain('Lucía Mendoza');
    expect(host().querySelector('[data-testid="referral-success"]')?.textContent).toContain(
      'Ya puede ver la ficha y reservar',
    );
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
    // Sin un servicio del catálogo, la API v4266 exige el servicio en texto y
    // el resumen clínico: se cargan acá (antes, el cuerpo sin ellos era válido).
    writable<string>('requestedService').set(' Segunda opinión quirúrgica ');
    writable<string>('clinicalSummary').set('Hernia inguinal derecha.');

    member<() => void>('submit')();

    const req = http.expectOne((r) => r.url === '/referrals' && r.method === 'POST');
    expect(req.request.body).toEqual({
      patientProfileId: 'pat-1',
      sourceEncounterId: 'enc-1',
      targetTenantId: 't-hospital',
      referralType: 'SECOND_OPINION',
      requestedServiceText: 'Segunda opinión quirúrgica',
      clinicalSummary: 'Hernia inguinal derecha.',
      validUntil: '2026-12-31',
    });
    req.flush(ALTA);
    fixture.detectChanges();
    // La API también avisa por una organización: el texto lo dice sin hablar de «ficha».
    const success = host().querySelector('[data-testid="referral-success"]')?.textContent ?? '';
    expect(success).toContain('Le avisamos a la persona que la derivó a Hospital San Lucas');
    expect(success).not.toContain('ficha');
  });

  it('sin encuentro abierto lo dice y no ofrece enviar', () => {
    create(null);

    expect(member<() => boolean>('noEncounter')()).toBe(true);
    expect(member<() => boolean>('canSubmit')()).toBe(false);
    expect(host().querySelector('[data-testid="referral-no-encounter"]')).not.toBeNull();
    expect(host().querySelector('[data-testid="referral-submit"]')).toBeNull();
    // Sin anfitrión que sepa abrirlo, no se ofrece una salida que no lleva a nada.
    expect(host().querySelector('[data-testid="referral-open-encounter"]')).toBeNull();
  });

  it('sin encuentro, si el anfitrión sabe abrirlo, ofrece ir a hacerlo', () => {
    create(null);
    fixture.componentRef.setInput('offersOpenEncounter', true);
    fixture.detectChanges();
    let asked = 0;
    fixture.componentInstance.openEncounter.subscribe(() => (asked += 1));
    host().querySelector<HTMLElement>('[data-testid="referral-open-encounter"]')!.click();
    expect(asked).toBe(1);
  });

  /* -- Errores --------------------------------------------------------------- */

  it('un 409 REFERRAL_ALREADY_EXISTS es un aviso («ya la derivó»), no un error', () => {
    create();
    submitFailing(
      { code: 'CONFLICT', reason: 'REFERRAL_ALREADY_EXISTS', message: 'Ya existe una referencia equivalente' },
      409,
      'Conflict',
    );

    expect(member<() => boolean>('duplicate')()).toBe(true);
    expect(member<() => string | null>('submissionError')()).toBeNull();
    expect(host().querySelector('[data-testid="referral-duplicate"]')).not.toBeNull();
  });

  it('un 409 sin ese sub-código no se disfraza de «ya la derivó»', () => {
    create();
    submitFailing({ code: 'CONFLICT', message: 'Otro conflicto' }, 409, 'Conflict');

    expect(member<() => boolean>('duplicate')()).toBe(false);
    expect(host().querySelector('[data-testid="referral-error"]')?.textContent).toContain('Otro conflicto');
  });

  it('el resultado se dibuja junto al botón y recibe el foco', async () => {
    create();
    submitFailing(
      { code: 'CONFLICT', reason: 'REFERRAL_ALREADY_EXISTS', message: 'x' },
      409,
      'Conflict',
    );
    await fixture.whenStable();
    const outcome = host().querySelector<HTMLElement>('[data-testid="referral-outcome"]')!;
    expect(outcome.querySelector('[data-testid="referral-duplicate"]')).not.toBeNull();
    // Inmediatamente antes del botón, no arriba del formulario.
    expect(outcome.nextElementSibling?.getAttribute('data-testid')).toBe('referral-submit');
    expect(document.activeElement).toBe(outcome);
  });

  it('un 404 del encuentro lo nombra, no emite cambio y deja lo elegido', () => {
    create();
    let changes = 0;
    fixture.componentInstance.cambio.subscribe(() => (changes += 1));
    submitFailing(
      { code: 'NOT_FOUND', reason: 'REFERRAL_ENCOUNTER_NOT_FOUND', message: 'Encuentro no encontrado' },
      404,
      'Not Found',
    );

    expect(changes).toBe(0);
    expect(member<() => string | null>('submissionError')()).toContain('No encontramos este encuentro');
    expect(host().querySelector('[data-testid="referral-error"]')).not.toBeNull();
    // Lo elegido sigue ahí: reintentar no obliga a empezar de cero.
    expect(member<() => unknown>('target')()).not.toBeNull();
  });

  it('un 404 del servicio o del destino culpa a quien corresponde', () => {
    create();
    submitFailing({ code: 'NOT_FOUND', reason: 'REFERRAL_SERVICE_NOT_FOUND', message: 'x' }, 404, 'Not Found');
    expect(member<() => string | null>('submissionError')()).toContain('El servicio elegido ya no está');

    create();
    submitFailing({ code: 'NOT_FOUND', reason: 'REFERRAL_TARGET_NOT_FOUND', message: 'x' }, 404, 'Not Found');
    expect(member<() => string | null>('submissionError')()).toContain('El destino elegido ya no está');
  });

  it('un 404 sin sub-código no culpa al encuentro', () => {
    create();
    submitFailing({ code: 'NOT_FOUND', message: 'No encontrado' }, 404, 'Not Found');
    expect(member<() => string | null>('submissionError')()).toBe(
      'El encuentro, el destino o el servicio ya no están disponibles. Vuelva a buscar el destino.',
    );
  });

  it('un 422 PRECONDITION_FAILED con details.reason se dice con su texto', () => {
    create();
    submitFailing(
      {
        statusCode: 422,
        code: 'PRECONDITION_FAILED',
        message: 'El servicio no pertenece a la organización destino.',
        details: { targetServiceCatalogId: 's-fisio', reason: 'REFERRAL_SERVICE_TARGET_MISMATCH' },
      },
      422,
      'Unprocessable Entity',
    );
    expect(host().querySelector('[data-testid="referral-error"]')?.textContent).toContain(
      'Ese servicio no lo ofrece el destino elegido',
    );

    create();
    submitFailing(
      { code: 'PRECONDITION_FAILED', message: 'x', details: { reason: 'REFERRAL_SERVICE_INACTIVE' } },
      422,
      'Unprocessable Entity',
    );
    expect(member<() => string | null>('submissionError')()).toContain('dio de baja ese servicio');

    create();
    submitFailing(
      { code: 'PRECONDITION_FAILED', message: 'x', details: { reason: 'REFERRAL_TARGET_REQUIRED' } },
      422,
      'Unprocessable Entity',
    );
    expect(member<() => string | null>('submissionError')()).toContain('Falta el destino');
  });

  it('una validación del servidor se muestra con su mensaje', () => {
    create();
    pickTarget([LUCIA]);
    writable<string | null>('selectedService').set('s-fisio');
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

  /* -- v4266: externo, sede, lo clínico ----------------------------------- */

  it('sin servicio del catálogo no envía: dice junto al campo que faltan el servicio y el resumen', () => {
    create();
    pickTarget([LUCIA]);
    member<() => void>('submit')();
    http.expectNone((r) => r.url === '/referrals' && r.method === 'POST');
    fixture.detectChanges();
    expect(host().querySelector('[data-testid="referral-issues"]')).not.toBeNull();
    expect(member<(f: string) => string>('issueFor')('requestedServiceText')).toContain('servicio');
    expect(member<(f: string) => string>('issueFor')('clinicalSummary')).toContain('resumen clínico');
  });

  it('a un destino externo: no busca, manda nombre, contacto y lo clínico', () => {
    create();
    member<(k: string) => void>('chooseKind')('EXTERNAL');
    fixture.detectChanges();
    expect(host().querySelector('[data-testid="referral-services"]')).toBeNull();
    expect(member<() => boolean>('canSubmit')()).toBe(false);
    writable<string>('externalName').set('Centro de Hemodiálisis Norte');
    writable<string>('externalContact').set('3 333 4444');
    writable<string | null>('referralType').set('THERAPY');
    writable<string>('requestedService').set('Hemodiálisis');
    writable<string>('clinicalSummary').set('ERC estadio 5.');
    writable<string>('diagnosis').set('N18.5');
    writable<string>('treatmentGiven').set('Dieta hipoproteica.');
    expect(member<() => boolean>('canSubmit')()).toBe(true);

    member<() => void>('submit')();
    const req = http.expectOne((r) => r.url === '/referrals' && r.method === 'POST');
    expect(req.request.body).toEqual({
      patientProfileId: 'pat-1',
      sourceEncounterId: 'enc-1',
      targetExternalName: 'Centro de Hemodiálisis Norte',
      targetExternalContact: '3 333 4444',
      referralType: 'THERAPY',
      requestedServiceText: 'Hemodiálisis',
      clinicalSummary: 'ERC estadio 5.',
      diagnosisText: 'N18.5',
      treatmentGivenText: 'Dieta hipoproteica.',
    });
    req.flush(ALTA);
    http.expectOne((r) => r.url === '/referrals/ref-1').flush({ ...ALTA, status: 'PENDING', referralType: 'THERAPY' });
    fixture.detectChanges();
    // Fuera de la plataforma no hay aviso: el texto no lo promete.
    const success = host().querySelector('[data-testid="referral-success"]')?.textContent ?? '';
    expect(success).toContain('no recibe aviso');
    expect(success).not.toContain('Le avisamos');
  });

  it('a una organización ofrece sus sedes y manda la elegida', () => {
    create();
    member<(k: string) => void>('chooseKind')('ORGANIZATION');
    member<(q: string) => void>('search')('san');
    http.expectOne((r) => r.url === '/referrals/targets').flush({ items: [HOSPITAL] });
    member<(o: ReferenceOption) => void>('choose')(member<() => readonly ReferenceOption[]>('targetOptions')()[0]!);
    http.expectOne((r) => r.url === '/referrals/target-services').flush({ items: [FISIO] });
    http
      .expectOne((r) => r.url === '/tenants/t-hospital/branches')
      .flush({ count: 1, items: [{ id: 'b-norte', tenantId: 't-hospital', code: 'N', name: 'Anexo Norte' }] });
    fixture.detectChanges();
    expect(host().querySelector('[data-testid="referral-branch"]')).not.toBeNull();

    writable<string | null>('selectedBranch').set('b-norte');
    writable<string | null>('selectedService').set('s-fisio');
    writable<string | null>('referralType').set('CONSULTATION');
    member<() => void>('submit')();
    const req = http.expectOne((r) => r.url === '/referrals' && r.method === 'POST');
    expect(req.request.body).toMatchObject({ targetTenantId: 't-hospital', targetBranchId: 'b-norte' });
    req.flush(ALTA);
  });

  it('sin escritura sobre la historia no ofrece el formulario, pero sí la lista', () => {
    create();
    fixture.componentRef.setInput('canWrite', false);
    fixture.detectChanges();
    expect(host().querySelector('[data-testid="referral-read-only"]')).not.toBeNull();
    expect(host().querySelector('[data-testid="referral-submit"]')).toBeNull();
  });

  /* -- La lista -------------------------------------------------------------- */

  /* -- Traslado (v4274) ----------------------------------------------------- */

  it('UNA tarjeta con dos pestañas: Derivación y Traslado', () => {
    create();
    const tabs = [...host().querySelectorAll('[role="tab"]')].map((t) => t.textContent?.trim());
    expect(tabs).toEqual(['1 · Derivación', '2 · Traslado']);
  });

  it('crítico sin ambulancia ni personal no envía: abre la pestaña Traslado con los errores', () => {
    create();
    pickTarget([LUCIA]);
    writable<string | null>('selectedService').set('s-fisio');
    writable<TransferDraft>('transferDraft').set({
      ...emptyTransferDraft(),
      required: true,
      transportMode: 'PRIVATE_VEHICLE',
      departureCondition: 'CRITICAL',
    });
    member<() => void>('submit')();
    http.expectNone((r) => r.url === '/referrals' && r.method === 'POST');
    fixture.detectChanges();
    expect(writable<number>('tab')()).toBe(1);
    const summary = host().querySelector('[data-testid="referral-issues"]')?.textContent ?? '';
    expect(summary).toContain('Traslado: Un paciente inestable o crítico viaja en ambulancia');
    expect(summary).toContain('personal de salud');
    expect(summary).toContain('avise al establecimiento receptor');
    expect(host().querySelector('[data-testid="transfer-unstable-why"]')).not.toBeNull();
    expect(host().querySelectorAll('[role="tab"]')[1]?.textContent).toContain('falta');
  });

  it('con el traslado completo lo manda en transfer, y lo que no se trasladó no viaja', () => {
    create();
    pickTarget([LUCIA]);
    writable<string | null>('selectedService').set('s-fisio');
    writable<TransferDraft>('transferDraft').set({
      ...emptyTransferDraft(),
      required: true,
      transportMode: 'AMBULANCE_ADVANCED',
      departureCondition: 'CRITICAL',
      escortProfessionalName: 'Dr. Vaca',
      receiverContacted: true,
      receiverContactName: 'Guardia',
      vitals: { ...emptyTransferDraft().vitals, systolicBp: '90', diastolicBp: '50', temperatureC: '38,5' },
    });
    member<() => void>('submit')();
    const req = http.expectOne((r) => r.url === '/referrals' && r.method === 'POST');
    expect(req.request.body.transfer).toEqual({
      required: true,
      transportMode: 'AMBULANCE_ADVANCED',
      departureCondition: 'CRITICAL',
      escortProfessionalName: 'Dr. Vaca',
      vitals: { systolicBp: 90, diastolicBp: 50, temperatureC: 38.5 },
      receiverContacted: true,
      receiverContactName: 'Guardia',
    });
    req.flush(ALTA, { status: 201, statusText: 'Created' });
    http.expectOne((r) => r.url === '/referrals/ref-1').flush({ ...ALTA, status: 'PENDING' });
    // Emitida, el borrador del traslado vuelve a vacío.
    expect(writable<TransferDraft>('transferDraft')().required).toBe(false);
  });

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

    it('con el estado legible de la API no depende del catálogo; dice sede, consentimiento y abre el detalle', () => {
      create();
      fixture.componentRef.setInput(
        'referrals',
        ready([
          {
            ...REFERRAL,
            status: 'COMPLETED',
            targetTenantName: 'Hospital San Lucas',
            targetBranchName: 'Anexo Norte',
            informedConsentId: 'c-1',
          } satisfies Referral,
        ]),
      );
      fixture.detectChanges();
      http.expectOne((r) => r.url === '/terminology/concepts').flush({ items: [], count: 0, limit: 200 });
      fixture.detectChanges();
      const row = host().querySelector('[data-testid="referral-row"]')!;
      expect(row.textContent).toContain('Hospital San Lucas · Anexo Norte');
      expect(row.textContent).toContain('Con contrarreferencia');
      expect(row.querySelector('[data-testid="referral-consent-linked"]')).not.toBeNull();

      row.querySelector<HTMLElement>('[data-testid="referral-open"] button, [data-testid="referral-open"]')!.click();
      http.expectOne((r) => r.url === '/referrals/r-1').flush({
        id: 'r-1',
        patientProfileId: 'pat-1',
        statusConceptId: 'st-aceptada',
        createdAt: '2026-10-20T12:00:00.000Z',
        status: 'COMPLETED',
        referralType: 'TREATMENT',
        informedConsentId: 'c-1',
      });
      fixture.detectChanges();
      expect(member<{ opened: () => Referral | null }>('detail').opened()?.status).toBe('COMPLETED');
    });

    it('si la derivación ya no se puede abrir (404), lo dice en palabras', () => {
      create();
      member<{ open: (id: string) => void }>('detail').open('r-x');
      http
        .expectOne((r) => r.url === '/referrals/r-x')
        .flush(
          { code: 'NOT_FOUND', reason: 'REFERRAL_NOT_FOUND', message: 'x' },
          { status: 404, statusText: 'Not Found' },
        );
      expect(member<{ openingError: () => string | null }>('detail').openingError()).toContain('No encontramos esta derivación');
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

    it('una fila anterior al tipo se titula con el destino, sin «Sin tipo»', () => {
      create();
      const { referralType: _type, ...legacy } = REFERRAL;
      fixture.componentRef.setInput('referrals', ready([legacy]));
      fixture.detectChanges();
      http.expectOne((r) => r.url === '/terminology/concepts').flush({ items: [], count: 0, limit: 200 });
      fixture.detectChanges();
      const heading = host().querySelector('[data-testid="referral-row"] .referral__main')?.textContent?.trim();
      expect(heading).toBe('Hospital San Lucas');
    });

    it('al releer (S7) la lista sigue a la vista y la antigüedad va junto al título', () => {
      create();
      fixture.componentRef.setInput('referrals', ready([REFERRAL]));
      fixture.detectChanges();
      http.expectOne((r) => r.url === '/terminology/concepts').flush({ items: [], count: 0, limit: 200 });
      fixture.componentRef.setInput('referrals', stale([REFERRAL], new Date(2026, 9, 31, 14, 32)));
      fixture.detectChanges();

      expect(member<() => ViewState<unknown>>('list')().status).toBe('stale');
      expect(host().querySelectorAll('[data-testid="referral-row"]')).toHaveLength(1);
      expect(host().querySelector('[data-testid="referral-list-refreshing"]')?.textContent).toContain('14:32');
      // Sin el banner de S7 por omisión, que empujaba la lista.
      expect(host().textContent).not.toContain('pueden estar atrasados');
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
