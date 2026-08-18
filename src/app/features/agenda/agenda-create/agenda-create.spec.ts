import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, type WritableSignal } from '@angular/core';
import { FormArray, FormGroup } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';

import { AuthService } from '../../../core/auth/auth.service';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { AgendaCreate } from './agenda-create';

const TENANT = '11111111-1111-1111-1111-111111111111';
const REF = '22222222-2222-2222-2222-222222222222';

/** Acceso a los miembros protegidos que el recorrido de prueba necesita mover. */
interface Testable {
  readonly fase: WritableSignal<number>;
  readonly finalizado: WritableSignal<boolean>;
  readonly resourceId: () => string | null;
  readonly policyId: () => string | null;
  readonly templateId: () => string | null;
  readonly slotsResultado: () => unknown;
  readonly excepcionResultado: () => unknown;
  readonly formRecurso: FormGroup;
  readonly formPolitica: FormGroup;
  readonly formPlantilla: FormGroup;
  readonly formExcepcion: FormGroup;
  readonly desde: WritableSignal<Date | null>;
  readonly hasta: WritableSignal<Date | null>;
  readonly excStart: WritableSignal<Date | null>;
  readonly excEnd: WritableSignal<Date | null>;
  siguiente(): void;
  atras(): void;
}

describe('AgendaCreate', () => {
  let fixture: ComponentFixture<AgendaCreate>;
  let http: HttpTestingController;
  let acc: Testable;
  let roles: WritableSignal<readonly string[]>;

  function crear(
    rolesIniciales: readonly string[] = ['SCHEDULING_ADMIN'],
    tenant: string | null = TENANT,
    perfilProfesional: string | null = null,
  ): void {
    roles = signal<readonly string[]>(rolesIniciales);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            roles,
            activeTenantId: signal<string | null>(tenant),
            practitionerProfileId: signal<string | null>(perfilProfesional),
          },
        },
        { provide: NavigationService, useValue: { breadcrumbs: signal([]) } },
      ],
    });
    fixture = TestBed.createComponent(AgendaCreate);
    http = TestBed.inject(HttpTestingController);
    acc = fixture.componentInstance as unknown as Testable;
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  /** Deja la fase 1 (recurso) lista y válida para enviar. */
  function llenarRecurso(): void {
    acc.formRecurso.setValue({
      resourceType: 'PRACTITIONER',
      resourceRefType: 'practitioner_profiles',
      resourceRefId: REF,
      name: 'Dra. Ríos',
      practiceId: '',
      timeZone: '',
      capacity: '',
    });
  }

  function completarRecurso(): void {
    llenarRecurso();
    acc.siguiente();
    http
      .expectOne('/scheduling/resources')
      .flush({ id: 'res-1', name: 'Dra. Ríos', stateConceptId: 'c' });
  }

  function completarPolitica(): void {
    acc.formPolitica.patchValue({ code: 'POL-STD', name: 'Estándar' });
    acc.siguiente();
    http
      .expectOne('/scheduling/booking-policies')
      .flush({ id: 'pol-1', code: 'POL-STD', stateConceptId: 'c' });
  }

  function completarPlantilla(): void {
    acc.formPlantilla.patchValue({ name: 'Mañanas' });
    acc.siguiente();
    http
      .expectOne('/scheduling/resources/res-1/templates')
      .flush({ id: 'tpl-1', name: 'Mañanas', ruleCount: 1, statusConceptId: 'c' });
  }

  function completarSlots(): void {
    acc.desde.set(new Date('2026-09-01T00:00:00.000Z'));
    acc.hasta.set(new Date('2026-09-08T00:00:00.000Z'));
    acc.siguiente();
    http
      .expectOne('/scheduling/templates/tpl-1/generate-slots')
      .flush({ templateId: 'tpl-1', created: 40, skipped: 0 });
  }

  /* -- render inicial ------------------------------------------------------ */

  it('arranca en la primera fase, con el recurso como paso actual', () => {
    crear();

    expect(acc.fase()).toBe(0);
    const h1 = fixture.debugElement.query(By.css('h1'));
    expect(h1.nativeElement.textContent).toContain('Crear agenda');
    const current = fixture.debugElement.query(By.css('.stepper__step--current .stepper__label'));
    expect(current.nativeElement.textContent.trim()).toBe('Recurso');
  });

  it('sin rol de agenda no muestra el formulario, muestra el aviso', () => {
    crear(['PATIENT']);

    expect(fixture.debugElement.query(By.css('app-stepper'))).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('No tenés permiso');
    http.expectNone(() => true);
  });

  it('sin organización activa bloquea el recorrido y no pide nada', () => {
    crear(['SCHEDULING_ADMIN'], null);

    // Ni el stepper ni el formulario: sólo el aviso de elegir organización.
    expect(fixture.debugElement.query(By.css('app-stepper'))).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Elegí una organización');
    http.expectNone(() => true);
  });

  /* -- autoservicio del profesional ---------------------------------------- */

  /**
   * El aviso de la agenda invita al profesional a «Publicar mi agenda» y su CTA
   * abre esta pantalla. Mientras el rol no estuvo en la lista, el viaje moría
   * acá con «No tenés permiso», en el único camino que lo vuelve reservable.
   */
  it('un profesional puede abrir el asistente', () => {
    crear(['PRACTITIONER'], TENANT, REF);

    expect(fixture.nativeElement.textContent).not.toContain('No tenés permiso');
    expect(fixture.debugElement.query(By.css('app-stepper'))).not.toBeNull();
    http.expectNone(() => true);
  });

  /**
   * El backend le acota el recurso al suyo (`assertPuedeCrearRecurso`). Son tres
   * datos que el profesional no tiene por qué saber —uno es un uuid—, así que la
   * pantalla los aporta en vez de pedirlos.
   */
  it('al profesional le fija la identidad del recurso y no se la pide', () => {
    crear(['PRACTITIONER'], TENANT, REF);

    const c = acc.formRecurso.controls;
    expect(c['resourceType'].value).toBe('PRACTITIONER');
    expect(c['resourceRefType'].value).toBe('practitioner_profiles');
    expect(c['resourceRefId'].value).toBe(REF);
    expect(c['resourceType'].disabled).toBe(true);
    expect(c['resourceRefType'].disabled).toBe(true);
    expect(c['resourceRefId'].disabled).toBe(true);
    http.expectNone(() => true);
  });

  it('el profesional publica su agenda sin tocar los campos de identidad', () => {
    crear(['PRACTITIONER'], TENANT, REF);

    // Sólo completa lo suyo: el nombre. Lo demás ya está puesto.
    acc.formRecurso.controls['name'].setValue('Dra. Ríos');
    acc.siguiente();

    const req = http.expectOne('/scheduling/resources');
    // `getRawValue()` lee también los deshabilitados: el cuerpo va completo.
    expect(req.request.body).toMatchObject({
      tenantId: TENANT,
      resourceType: 'PRACTITIONER',
      resourceRefType: 'practitioner_profiles',
      resourceRefId: REF,
      name: 'Dra. Ríos',
    });
    req.flush({ id: 'res-1', name: 'Dra. Ríos', stateConceptId: 'c' });
    expect(acc.fase()).toBe(1);
  });

  /**
   * F-29: el token de un médico recién registrado puede no traer `hpid`. Antes
   * la pantalla se rendía ahí mismo —«no deja crear agenda»—; ahora pregunta.
   */
  it('sin el perfil en el token lo pide a la API y el alta sigue', () => {
    crear(['PRACTITIONER'], TENANT, null);

    const req = http.expectOne('/profiles/practitioners/me/summary');
    // El perfil propio completo: el cliente convierte fechas de cada colección.
    req.flush({
      profileId: REF,
      personId: REF,
      displayName: 'Dra. Ríos',
      createdAt: new Date().toISOString(),
      specialties: [],
      credentials: [],
      licenses: [],
      languages: [],
      affiliations: [],
      activity: { encounters: 0, medicationRequests: 0, clinicalNotes: 0, documents: 0 },
    });
    fixture.detectChanges();

    // El aviso no aparece y el asistente está en pie, con la identidad puesta.
    expect(fixture.nativeElement.textContent).not.toContain('perfil profesional');
    expect(fixture.debugElement.query(By.css('app-stepper'))).not.toBeNull();
    expect(acc.formRecurso.getRawValue().resourceRefId).toBe(REF);
  });

  /** Si la API tampoco lo conoce, la cuenta no es de quien atiende: se dice. */
  it('un profesional sin perfil ni en el token ni en la API ve el aviso', () => {
    crear(['PRACTITIONER'], TENANT, null);

    http
      .expectOne('/profiles/practitioners/me/summary')
      .flush({ message: 'no hay perfil' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('app-stepper'))).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('perfil profesional');
  });

  /** Quien administra el catálogo arma la agenda de cualquiera: nada se fija. */
  it('a quien administra no le fija ni deshabilita nada', () => {
    crear(['SCHEDULING_ADMIN'], TENANT, null);

    const c = acc.formRecurso.controls;
    expect(c['resourceType'].value).toBe('');
    expect(c['resourceRefId'].enabled).toBe(true);
    http.expectNone(() => true);
  });

  /* -- validación / bloqueo ------------------------------------------------ */

  it('no envía ni avanza si la fase actual es inválida', () => {
    crear();
    // El recurso arranca con casi todo vacío: sólo `tenantId` viene precargado.
    acc.siguiente();

    http.expectNone('/scheduling/resources');
    expect(acc.fase()).toBe(0);
    expect(acc.formRecurso.touched).toBe(true);
  });

  /* -- POST por fase + encadenamiento de IDs ------------------------------- */

  it('la fase 1 hace POST a /scheduling/resources y guarda el resourceId', () => {
    crear();
    llenarRecurso();
    acc.siguiente();

    const req = http.expectOne('/scheduling/resources');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      tenantId: TENANT,
      resourceType: 'PRACTITIONER',
      resourceRefType: 'practitioner_profiles',
      resourceRefId: REF,
      name: 'Dra. Ríos',
    });
    req.flush({ id: 'res-1', name: 'Dra. Ríos', stateConceptId: 'c' });

    expect(acc.resourceId()).toBe('res-1');
    expect(acc.fase()).toBe(1);
  });

  it('encadena los ids: la plantilla cuelga del recurso y referencia la política', () => {
    crear();
    completarRecurso();
    completarPolitica();

    expect(acc.policyId()).toBe('pol-1');
    expect(acc.fase()).toBe(2);

    acc.formPlantilla.patchValue({ name: 'Mañanas' });
    acc.siguiente();

    const req = http.expectOne('/scheduling/resources/res-1/templates');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.name).toBe('Mañanas');
    // La política creada en la fase anterior viaja como bookingPolicyId.
    expect(req.request.body.bookingPolicyId).toBe('pol-1');
    expect(req.request.body.rules).toHaveLength(1);
    req.flush({ id: 'tpl-1', name: 'Mañanas', ruleCount: 1, statusConceptId: 'c' });

    expect(acc.templateId()).toBe('tpl-1');
    expect(acc.fase()).toBe(3);
  });

  it('la fase 4 genera cupos contra la plantilla materializando la ventana', () => {
    crear();
    completarRecurso();
    completarPolitica();
    completarPlantilla();

    acc.desde.set(new Date('2026-09-01T00:00:00.000Z'));
    acc.hasta.set(new Date('2026-09-08T00:00:00.000Z'));
    acc.siguiente();

    const req = http.expectOne('/scheduling/templates/tpl-1/generate-slots');
    expect(req.request.body).toEqual({
      from: '2026-09-01T00:00:00.000Z',
      to: '2026-09-08T00:00:00.000Z',
    });
    req.flush({ templateId: 'tpl-1', created: 40, skipped: 0 });

    expect(acc.fase()).toBe(4);
  });

  /* -- finalización -------------------------------------------------------- */

  it('la fase 5 registra la excepción y finaliza el recorrido', () => {
    crear();
    completarRecurso();
    completarPolitica();
    completarPlantilla();
    completarSlots();

    acc.formExcepcion.patchValue({ exceptionType: 'HOLIDAY' });
    acc.excStart.set(new Date('2026-09-14T00:00:00.000Z'));
    acc.excEnd.set(new Date('2026-09-15T00:00:00.000Z'));
    acc.siguiente();

    const req = http.expectOne('/scheduling/resources/res-1/exceptions');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      exceptionType: 'HOLIDAY',
      startAt: '2026-09-14T00:00:00.000Z',
      endAt: '2026-09-15T00:00:00.000Z',
    });
    req.flush({ id: 'exc-1', blockedSlots: 6 });

    expect(acc.finalizado()).toBe(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('La agenda quedó creada');
  });

  /* -- error de API -------------------------------------------------------- */

  it('un error de la API no avanza, conserva el estado y se muestra', () => {
    crear();
    llenarRecurso();
    acc.siguiente();

    http
      .expectOne('/scheduling/resources')
      .flush({ message: 'Falló' }, { status: 500, statusText: 'Server Error' });

    expect(acc.fase()).toBe(0);
    expect(acc.resourceId()).toBeNull();
    // El recurso cargado no se perdió: se puede reintentar sin recargar.
    expect(acc.formRecurso.controls['name'].value).toBe('Dra. Ríos');
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('app-alert[tone="error"]'))).not.toBeNull();
  });

  /* -- avance / retroceso -------------------------------------------------- */

  it('vuelve atrás sin perder los ids y no reenvía una fase ya cumplida', () => {
    crear();
    completarRecurso();
    expect(acc.fase()).toBe(1);

    acc.atras();
    expect(acc.fase()).toBe(0);
    // El id capturado sobrevive al retroceso.
    expect(acc.resourceId()).toBe('res-1');

    // Al avanzar de nuevo, la fase ya cumplida sólo pasa: no hay segundo POST.
    acc.siguiente();
    http.expectNone('/scheduling/resources');
    expect(acc.fase()).toBe(1);
  });

  it('la plantilla admite agregar y quitar franjas, sin bajar de una', () => {
    crear();
    completarRecurso();
    completarPolitica();

    const rules = acc.formPlantilla.controls['rules'] as FormArray;
    expect(rules.length).toBe(1);

    const componente = fixture.componentInstance as unknown as {
      agregarFranja(): void;
      quitarFranja(i: number): void;
    };
    componente.agregarFranja();
    expect(rules.length).toBe(2);

    componente.quitarFranja(1);
    expect(rules.length).toBe(1);

    // No se puede quedar sin ninguna: quitar la última no hace nada.
    componente.quitarFranja(0);
    expect(rules.length).toBe(1);
  });
});
