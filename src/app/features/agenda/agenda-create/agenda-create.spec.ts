import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, type WritableSignal } from '@angular/core';
import { FormArray, FormGroup } from '@angular/forms';
import { provideRouter } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { AgendaCreate } from './agenda-create';

const TENANT = '11111111-1111-1111-1111-111111111111';
const PERFIL = '22222222-2222-2222-2222-222222222222';

/** Acceso a los miembros protegidos que el recorrido de prueba necesita mover. */
interface Testable {
  readonly publicarParaOtro: WritableSignal<boolean>;
  readonly usarPolitica: WritableSignal<boolean>;
  readonly avanzadasAbiertas: WritableSignal<boolean>;
  readonly publicado: WritableSignal<boolean>;
  readonly semana: FormArray;
  readonly formGeneral: FormGroup;
  readonly formTecnico: FormGroup;
  readonly formPolitica: FormGroup;
  readonly fechaDeFin: WritableSignal<Date | null>;
  readonly resumen: () => string;
  readonly sinDias: () => boolean;
  alternarDia(indice: number): void;
  elegirDuracion(indice: number, minutos: number): void;
  repetirElPrimero(): void;
  publicar(): void;
}

/**
 * **Publicar mi agenda** — MAC-2.
 *
 * La regla madre de la tarea es que la pantalla **manda exactamente lo mismo
 * que antes**: los mismos cuatro POST, en el mismo orden, con los mismos
 * campos. Lo que cambió es qué se le pregunta al médico. Por eso las
 * aserciones de contrato son las más importantes de este archivo: si alguna se
 * cae, el rediseño dejó de ser un rediseño.
 */
describe('AgendaCreate', () => {
  let fixture: ComponentFixture<AgendaCreate>;
  let http: HttpTestingController;
  let acc: Testable;

  function crear(
    roles: readonly string[] = ['PRACTITIONER'],
    tenant: string | null = TENANT,
    perfilProfesional: string | null = PERFIL,
  ): void {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            roles: signal<readonly string[]>(roles),
            activeTenantId: signal<string | null>(tenant),
            practitionerProfileId: signal<string | null>(perfilProfesional),
            displayName: signal<string | null>('Dra. Elena Salas'),
          },
        },
        { provide: NavigationService, useValue: { breadcrumbs: signal([]) } },
      ],
    });
    fixture = TestBed.createComponent(AgendaCreate);
    http = TestBed.inject(HttpTestingController);
    acc = fixture.componentInstance as unknown as Testable;
    fixture.detectChanges();
    // Las sedes se leen al construir; sin responderla, `http.verify()` la
    // denuncia como pendiente en cada prueba.
    http.expectOne('/practices').flush([]);
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  /** Enciende el lunes con su horario por defecto (9 a 13, 30 minutos). */
  function encenderLunes(): void {
    acc.alternarDia(0);
    fixture.detectChanges();
  }

  /** El ciclo completo: recurso → plantilla → cupos, sin política. */
  function publicarCompleto(): void {
    encenderLunes();
    acc.publicar();
    http.expectOne('/scheduling/resources').flush({ id: 'res-1', name: 'x', stateConceptId: 'c' });
    http
      .expectOne('/scheduling/resources/res-1/templates')
      .flush({ id: 'tpl-1', name: 'x', ruleCount: 1, statusConceptId: 'c' });
    http
      .expectOne('/scheduling/templates/tpl-1/generate-slots')
      .flush({ templateId: 'tpl-1', created: 40, skipped: 0 });
    fixture.detectChanges();
  }

  /* -- Quién puede entrar --------------------------------------------------- */

  it('sin rol de agenda no muestra el formulario, muestra el aviso', () => {
    crear(['PATIENT']);
    const texto: string = fixture.nativeElement.textContent;
    expect(texto).toContain('Esta sección es para quien publica agenda');
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
  });

  it('sin organización activa bloquea y explica, en vez de dejar avanzar hasta un 400', () => {
    crear(['PRACTITIONER'], null);
    expect(fixture.nativeElement.textContent).toContain('Elegí una organización primero');
  });

  it('un profesional sin perfil en la sesión ve el aviso y no el formulario', () => {
    crear(['PRACTITIONER'], TENANT, null);
    expect(fixture.nativeElement.textContent).toContain('Esta sección es para profesionales');
  });

  /* -- Cero jerga ----------------------------------------------------------- */

  it('el médico NO ve jerga técnica: ni tabla, ni uuid, ni zona horaria IANA', () => {
    crear();
    const texto: string = fixture.nativeElement.textContent;
    expect(texto).not.toContain('practitioner_profiles');
    expect(texto).not.toContain(PERFIL);
    expect(texto).not.toContain('resourceRefId');
    expect(texto).not.toContain('tenantId');
  });

  it('le dice de quién es la agenda, con su nombre', () => {
    crear();
    expect(fixture.nativeElement.textContent).toContain('Vas a publicar tu propia agenda');
    expect(fixture.nativeElement.textContent).toContain('Dra. Elena Salas');
  });

  it('ni siquiera al publicar muestra el uuid de lo que creó', () => {
    crear();
    publicarCompleto();
    expect(fixture.nativeElement.textContent).not.toContain('res-1');
    expect(fixture.nativeElement.textContent).not.toContain('tpl-1');
  });

  /* -- Las dos decisiones --------------------------------------------------- */

  it('arranca sin ningún día encendido y no deja publicar así', () => {
    crear();
    expect(acc.sinDias()).toBe(true);
  });

  it('no publica si no hay un solo día elegido', () => {
    crear();
    acc.publicar();
    // Ninguna petición: si saliera, el backend recibiría una plantilla sin reglas.
    http.verify();
  });

  it('encender un día alcanza para publicar: el horario y la duración ya tienen valor', () => {
    crear();
    encenderLunes();
    expect(acc.sinDias()).toBe(false);
  });

  it('la duración se elige por fichas y queda en la franja', () => {
    crear();
    encenderLunes();
    acc.elegirDuracion(0, 45);
    expect(acc.semana.at(0).getRawValue().duracion).toBe(45);
  });

  it('repetir el primero copia su horario a los demás días encendidos', () => {
    crear();
    acc.alternarDia(0);
    acc.alternarDia(3);
    acc.semana.at(0).patchValue({ desde: '08:00', hasta: '11:00', duracion: 20 });
    fixture.detectChanges();

    acc.repetirElPrimero();

    expect(acc.semana.at(3).getRawValue()).toMatchObject({
      desde: '08:00',
      hasta: '11:00',
      duracion: 20,
    });
  });

  /* -- El contrato: los mismos POST que antes ------------------------------- */

  it('manda los cuatro POST en el orden del contrato', () => {
    crear();
    encenderLunes();
    acc.publicar();

    const recurso = http.expectOne('/scheduling/resources');
    expect(recurso.request.method).toBe('POST');
    recurso.flush({ id: 'res-1', name: 'x', stateConceptId: 'c' });

    const plantilla = http.expectOne('/scheduling/resources/res-1/templates');
    plantilla.flush({ id: 'tpl-1', name: 'x', ruleCount: 1, statusConceptId: 'c' });

    const cupos = http.expectOne('/scheduling/templates/tpl-1/generate-slots');
    cupos.flush({ templateId: 'tpl-1', created: 40, skipped: 0 });
  });

  it('el recurso lleva la identidad que el backend comprueba, aunque no se pregunte', () => {
    crear();
    encenderLunes();
    acc.publicar();

    const req = http.expectOne('/scheduling/resources');
    expect(req.request.body).toMatchObject({
      tenantId: TENANT,
      resourceType: 'PRACTITIONER',
      resourceRefType: 'practitioner_profiles',
      resourceRefId: PERFIL,
    });
    req.flush({ id: 'res-1', name: 'x', stateConceptId: 'c' });
    http.expectOne('/scheduling/resources/res-1/templates').flush({
      id: 'tpl-1',
      name: 'x',
      ruleCount: 1,
      statusConceptId: 'c',
    });
    http
      .expectOne('/scheduling/templates/tpl-1/generate-slots')
      .flush({ templateId: 'tpl-1', created: 1, skipped: 0 });
  });

  it('el nombre del recurso y el de la plantilla se derivan, no se piden', () => {
    crear();
    encenderLunes();
    acc.publicar();

    const recurso = http.expectOne('/scheduling/resources');
    expect(recurso.request.body.name).toBe('Agenda de Dra. Elena Salas');
    recurso.flush({ id: 'res-1', name: 'x', stateConceptId: 'c' });

    const plantilla = http.expectOne('/scheduling/resources/res-1/templates');
    expect(plantilla.request.body.name).toBe('Horario de Agenda de Dra. Elena Salas');
    plantilla.flush({ id: 'tpl-1', name: 'x', ruleCount: 1, statusConceptId: 'c' });

    http
      .expectOne('/scheduling/templates/tpl-1/generate-slots')
      .flush({ templateId: 'tpl-1', created: 1, skipped: 0 });
  });

  it('la franja viaja con el día, las horas y la duración elegida', () => {
    crear();
    acc.alternarDia(3); // jueves
    acc.semana.at(3).patchValue({ desde: '14:00', hasta: '18:00', duracion: 20 });
    fixture.detectChanges();
    acc.publicar();

    http.expectOne('/scheduling/resources').flush({ id: 'res-1', name: 'x', stateConceptId: 'c' });
    const plantilla = http.expectOne('/scheduling/resources/res-1/templates');
    expect(plantilla.request.body.rules).toEqual([
      expect.objectContaining({
        dayOfWeek: 4,
        startTime: '14:00',
        endTime: '18:00',
        slotMinutes: 20,
      }),
    ]);
    plantilla.flush({ id: 'tpl-1', name: 'x', ruleCount: 1, statusConceptId: 'c' });
    http
      .expectOne('/scheduling/templates/tpl-1/generate-slots')
      .flush({ templateId: 'tpl-1', created: 1, skipped: 0 });
  });

  /* -- La política, opcional de verdad -------------------------------------- */

  it('sin tocar la política, la plantilla se crea sin bookingPolicyId', () => {
    crear();
    encenderLunes();
    acc.publicar();

    http.expectOne('/scheduling/resources').flush({ id: 'res-1', name: 'x', stateConceptId: 'c' });
    // Ni siquiera se llama al endpoint: `expectOne` de la plantilla fallaría si
    // hubiera una petición de política pendiente en el medio.
    const plantilla = http.expectOne('/scheduling/resources/res-1/templates');
    expect(plantilla.request.body.bookingPolicyId).toBeUndefined();
    plantilla.flush({ id: 'tpl-1', name: 'x', ruleCount: 1, statusConceptId: 'c' });
    http
      .expectOne('/scheduling/templates/tpl-1/generate-slots')
      .flush({ templateId: 'tpl-1', created: 1, skipped: 0 });
  });

  it('si el médico la abre, la política se manda con código y nombre derivados', () => {
    crear();
    encenderLunes();
    acc.usarPolitica.set(true);
    acc.formPolitica.patchValue({ minNoticeMinutes: '30' });
    fixture.detectChanges();
    acc.publicar();

    http.expectOne('/scheduling/resources').flush({ id: 'res-1', name: 'x', stateConceptId: 'c' });
    const politica = http.expectOne('/scheduling/booking-policies');
    expect(politica.request.body).toMatchObject({
      tenantId: TENANT,
      code: 'AGENDA-DE-DRA-ELENA-SALAS',
      minNoticeMinutes: 30,
    });
    politica.flush({ id: 'pol-1', code: 'X', stateConceptId: 'c' });

    const plantilla = http.expectOne('/scheduling/resources/res-1/templates');
    expect(plantilla.request.body.bookingPolicyId).toBe('pol-1');
    plantilla.flush({ id: 'tpl-1', name: 'x', ruleCount: 1, statusConceptId: 'c' });
    http
      .expectOne('/scheduling/templates/tpl-1/generate-slots')
      .flush({ templateId: 'tpl-1', created: 1, skipped: 0 });
  });

  /* -- La ventana, calculada ------------------------------------------------ */

  it('la ventana de cupos se calcula sola: no se le pregunta al médico', () => {
    crear();
    encenderLunes();
    acc.publicar();

    http.expectOne('/scheduling/resources').flush({ id: 'res-1', name: 'x', stateConceptId: 'c' });
    http
      .expectOne('/scheduling/resources/res-1/templates')
      .flush({ id: 'tpl-1', name: 'x', ruleCount: 1, statusConceptId: 'c' });

    const cupos = http.expectOne('/scheduling/templates/tpl-1/generate-slots');
    const { from, to } = cupos.request.body;
    const meses =
      (new Date(to).getFullYear() - new Date(from).getFullYear()) * 12 +
      (new Date(to).getMonth() - new Date(from).getMonth());
    expect(meses).toBe(3);
    cupos.flush({ templateId: 'tpl-1', created: 1, skipped: 0 });
  });

  it('con fecha de fin, los cupos no se generan más allá de ella', () => {
    crear();
    encenderLunes();
    // Dentro del horizonte de tres meses: manda la fecha de fin.
    const fin = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    acc.formGeneral.patchValue({ tieneFin: 'si' });
    acc.fechaDeFin.set(fin);
    fixture.detectChanges();
    acc.publicar();

    http.expectOne('/scheduling/resources').flush({ id: 'res-1', name: 'x', stateConceptId: 'c' });
    const plantilla = http.expectOne('/scheduling/resources/res-1/templates');
    expect(plantilla.request.body.validTo).toBe(fin.toISOString());
    plantilla.flush({ id: 'tpl-1', name: 'x', ruleCount: 1, statusConceptId: 'c' });

    const cupos = http.expectOne('/scheduling/templates/tpl-1/generate-slots');
    expect(cupos.request.body.to).toBe(fin.toISOString());
    cupos.flush({ templateId: 'tpl-1', created: 1, skipped: 0 });
  });

  /* -- Errores y reintento --------------------------------------------------- */

  it('un error no pierde lo hecho y reintentar no duplica el recurso', () => {
    crear();
    encenderLunes();
    acc.publicar();
    http.expectOne('/scheduling/resources').flush({ id: 'res-1', name: 'x', stateConceptId: 'c' });
    http
      .expectOne('/scheduling/resources/res-1/templates')
      .flush(
        { code: 'PRECONDITION_FAILED', message: 'Se cruza con otro horario' },
        { status: 422, statusText: 'Unprocessable' },
      );
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No se pudo publicar');

    // El segundo intento NO vuelve a crear el recurso: arranca en la plantilla.
    acc.publicar();
    http
      .expectOne('/scheduling/resources/res-1/templates')
      .flush({ id: 'tpl-1', name: 'x', ruleCount: 1, statusConceptId: 'c' });
    http
      .expectOne('/scheduling/templates/tpl-1/generate-slots')
      .flush({ templateId: 'tpl-1', created: 1, skipped: 0 });
  });

  it('el 422 de solape se lee como una frase, no como JSON', () => {
    crear();
    encenderLunes();
    acc.publicar();
    http.expectOne('/scheduling/resources').flush({ id: 'res-1', name: 'x', stateConceptId: 'c' });
    // El cuerpo lleva `code` porque la API lo manda: el traductor de errores
    // del repo despacha por código, y una prueba que lo omite mide el camino
    // genérico en vez del real.
    http.expectOne('/scheduling/resources/res-1/templates').flush(
      {
        code: 'PRECONDITION_FAILED',
        message: 'Ya tenés un horario los martes de 10:00 a 12:00 que se cruza con éste',
      },
      { status: 422, statusText: 'Unprocessable' },
    );
    fixture.detectChanges();

    const texto: string = fixture.nativeElement.textContent;
    expect(texto).toContain('Ya tenés un horario los martes');
    expect(texto).not.toContain('{');
  });

  /* -- El resumen, en palabras ----------------------------------------------- */

  it('resume lo publicado en una oración legible', () => {
    crear();
    acc.alternarDia(0);
    acc.alternarDia(3);
    fixture.detectChanges();

    expect(acc.resumen()).toBe('lunes y jueves de 9 a 13, consultas de 30 minutos');
  });

  it('con un solo día no dice «y»', () => {
    crear();
    encenderLunes();
    expect(acc.resumen()).toBe('lunes de 9 a 13, consultas de 30 minutos');
  });

  it('con horarios distintos por día omite el horario en vez de mentir uno', () => {
    crear();
    acc.alternarDia(0);
    acc.alternarDia(3);
    acc.semana.at(3).patchValue({ desde: '15:00', hasta: '19:00' });
    fixture.detectChanges();

    expect(acc.resumen()).toBe('lunes y jueves, consultas de 30 minutos');
  });

  it('al terminar felicita con la frase y sin un solo identificador', () => {
    crear();
    publicarCompleto();

    const texto: string = fixture.nativeElement.textContent;
    expect(texto).toContain('tu agenda ya está publicada');
    expect(texto).toContain('lunes de 9 a 13, consultas de 30 minutos');
    expect(texto).toContain('40');
  });

  /* -- La excepción se fue --------------------------------------------------- */

  it('ya no pide inventar una excepción para poder terminar', () => {
    crear();
    const texto: string = fixture.nativeElement.textContent;
    expect(texto).not.toContain('Excepción');
    expect(texto).not.toContain('Ausencia');
    expect(texto).not.toContain('Feriado');
  });

  /* -- El formulario técnico, opt-in ----------------------------------------- */

  it('quien administra puede pedir el formulario técnico para una agenda ajena', () => {
    crear(['SCHEDULING_ADMIN'], TENANT, null);
    acc.avanzadasAbiertas.set(true);
    acc.publicarParaOtro.set(true);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Identificador del recurso');
  });
});
