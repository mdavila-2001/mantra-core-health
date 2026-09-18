import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, type WritableSignal } from '@angular/core';
import { FormArray, FormGroup } from '@angular/forms';
import { provideRouter } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { DialogService } from '@shared/components/molecules/dialog/dialog-service';
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
  /** D2: la semana visible y el grupo de cada día, para comprobar la precarga. */
  readonly diasVisibles: () => readonly { indice: number; largo: string; activo: boolean }[];
  grupoDe(indice: number): FormGroup;
  alternarDia(indice: number): void;
  elegirDuracion(indice: number, minutos: number): void;
  elegirRespiro(indice: number, minutos: number): void;
  turnosDelDia(indice: number): number;
  repetirElPrimero(): void;
  publicar(): void;
  /** Publicar en una agenda nueva en vez de en la que ya existe. */
  readonly agendaNueva: WritableSignal<boolean>;
  readonly nombreNuevo: WritableSignal<string>;
  readonly eligeSede: () => boolean;
  readonly resourceId: WritableSignal<string | null>;
  fijarDeLaFila(indice: number, campo: string, valor: unknown): void;
  empezarAgendaNueva(): void;
  volverAAgendaExistente(): void;
  /** «Limpiar campos» del pedido original. */
  limpiarCampos(): Promise<void>;
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

  /**
   * Qué contesta el diálogo. Sin este doble, `confirm()` monta el `<dialog>`
   * real y espera un clic que en una prueba no llega nunca: el `await` queda
   * colgado y la prueba muere por tiempo, no por comportamiento.
   */
  let respuestaDelDialogo = true;
  /** El último diálogo que se pidió, para poder mirarlo desde una prueba. */
  let ultimoDialogo: Record<string, unknown> | null = null;
  const dialogsFalsos = {
    confirm: (config: Record<string, unknown>) => {
      ultimoDialogo = config;
      return Promise.resolve(respuestaDelDialogo);
    },
  };

  function crear(
    roles: readonly string[] = ['PRACTITIONER'],
    tenant: string | null = TENANT,
    perfilProfesional: string | null = PERFIL,
  ): void {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'schedule', children: [] }]),
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
        { provide: DialogService, useValue: dialogsFalsos },
      ],
    });
    fixture = TestBed.createComponent(AgendaCreate);
    http = TestBed.inject(HttpTestingController);
    acc = fixture.componentInstance as unknown as Testable;
    fixture.detectChanges();
    // Y desde D2 (plan de UX del 22/08/2026) también se busca el horario que ya
    // esté publicado, para poder **cambiarlo** en vez de crear una segunda
    // agenda. Por omisión se responde «no hay recurso», que es el caso del alta
    // y el que cubren casi todas las pruebas de este archivo; el del cambio lo
    // arma {@link crearConHorarioVigente}.
    if (leeHorarioVigente(roles, tenant, perfilProfesional)) {
      http.expectOne((r) => r.url === '/scheduling/resources').flush({ items: [], count: 0 });
    }
    fixture.detectChanges();
  }

  /**
   * Si la pantalla va a preguntar por el horario vigente con esos parámetros.
   *
   * Sin organización, sin perfil profesional o sin rol de agenda no pregunta:
   * las tres serían lecturas que la sesión no puede hacer.
   */
  function leeHorarioVigente(
    roles: readonly string[],
    tenant: string | null,
    perfil: string | null,
  ): boolean {
    const puedeCrear = ['SCHEDULING_ADMIN', 'SUPERADMIN', 'PRACTITIONER'].some((rol) =>
      roles.includes(rol),
    );
    return puedeCrear && tenant !== null && perfil !== null;
  }

  /** Abre la pantalla con un horario ya publicado, que es el caso de «cambiar». */
  function crearConHorarioVigente(plantilla: object): void {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'schedule', children: [] }]),
        {
          provide: AuthService,
          useValue: {
            roles: signal<readonly string[]>(['PRACTITIONER']),
            activeTenantId: signal<string | null>(TENANT),
            practitionerProfileId: signal<string | null>(PERFIL),
            displayName: signal<string | null>('Dra. Elena Salas'),
          },
        },
        { provide: NavigationService, useValue: { breadcrumbs: signal([]) } },
        { provide: DialogService, useValue: dialogsFalsos },
      ],
    });
    fixture = TestBed.createComponent(AgendaCreate);
    http = TestBed.inject(HttpTestingController);
    acc = fixture.componentInstance as unknown as Testable;
    fixture.detectChanges();
    http.expectOne((r) => r.url === '/scheduling/resources').flush({
      items: [{ id: 'res-1', name: 'Agenda', resourceRefId: PERFIL, stateConceptId: 'c' }],
      count: 1,
    });
    http
      .expectOne('/scheduling/resources/res-1/templates')
      .flush({ items: [plantilla], count: 1 });
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  /**
   * Contesta el retiro del horario vigente, que desde el arreglo del cierre de
   * turnos precede a toda publicación de un cambio.
   */
  function retirarVigente(id = 'tpl-1'): void {
    http.expectOne(`/scheduling/templates/${id}`).flush({
      id,
      statusConceptId: 'archived',
      releasedSlots: 24,
      keptSlots: 0,
    });
  }

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

  /** Un horario vigente que SÍ declara respiro, para la carga. */
  const VIGENTE_CON_RESPIRO = {
    id: 'tpl-9',
    name: 'Horario con respiro',
    slotMinutes: 30,
    statusConceptId: 'c',
    rules: [
      {
        dayOfWeek: 2,
        startTime: '15:00:00',
        endTime: '19:00:00',
        slotMinutes: 20,
        gapMinutes: 10,
      },
    ],
  };

  /* -- Cambiar un horario que ya existe (D2 del plan de UX) ----------------- */

  describe('cuando ya hay un horario publicado', () => {
    const VIGENTE = {
      id: 'tpl-1',
      name: 'Horario de Dra. Elena Salas',
      slotMinutes: 30,
      statusConceptId: 'c',
      rules: [
        { dayOfWeek: 2, startTime: '15:00:00', endTime: '19:00:00', slotMinutes: 20 },
        { dayOfWeek: 4, startTime: '15:00:00', endTime: '19:00:00', slotMinutes: 20 },
      ],
    };

    /**
     * El defecto que reportó el cliente: «la cita no acaba a la hora que
     * debería». Publicar un cambio creaba una plantilla más y dejaba viva la
     * anterior; como `generate-slots` es idempotente **por instante de
     * inicio**, el cupo viejo de las 08:00 sobrevivía con su fin viejo.
     */
    it('cambiar el horario retira el vigente ANTES de crear el nuevo', () => {
      crearConHorarioVigente(VIGENTE);
      acc.publicar();

      const retiro = http.expectOne('/scheduling/templates/tpl-1');
      expect(retiro.request.method).toBe('DELETE');
      // Todavía no se creó nada: el orden es lo que impide dos horarios vivos.
      http.expectNone('/scheduling/resources/res-1/templates');

      retiro.flush({
        id: 'tpl-1',
        statusConceptId: 'archived',
        releasedSlots: 24,
        keptSlots: 3,
      });

      http
        .expectOne('/scheduling/resources/res-1/templates')
        .flush({ id: 'tpl-2', name: 'x', ruleCount: 2, statusConceptId: 'c' });
      http
        .expectOne('/scheduling/templates/tpl-2/generate-slots')
        .flush({ templateId: 'tpl-2', created: 40, skipped: 0 });
      fixture.detectChanges();
    });

    /**
     * El 409 son citas de pacientes. Publicar igual las movería sin avisar, así
     * que no se publica nada y el mensaje del servidor se muestra tal cual.
     */
    it('si el retiro responde 409, no crea la plantilla nueva', () => {
      crearConHorarioVigente(VIGENTE);
      acc.publicar();

      http.expectOne('/scheduling/templates/tpl-1').flush(
        {
          code: 'CONFLICT',
          message: 'El horario tiene 3 citas comprometidas: resolvelas antes de cambiarlo.',
          details: { bookingIds: ['b-1', 'b-2', 'b-3'] },
        },
        { status: 409, statusText: 'Conflict' },
      );
      fixture.detectChanges();

      http.expectNone('/scheduling/resources/res-1/templates');
      expect(fixture.nativeElement.textContent).toContain('citas comprometidas');
    });

    it('la pantalla se presenta como un cambio, no como un alta', () => {
      crearConHorarioVigente(VIGENTE);

      const texto: string = fixture.nativeElement.textContent;
      expect(texto).toContain('Cambiá tu horario');
      expect(texto).not.toContain('Publicá tu agenda');
    });

    it('carga la semanita con el horario vigente, para poder editarlo', () => {
      crearConHorarioVigente(VIGENTE);

      // Martes y jueves encendidos, el resto apagados: es lo que hace que la
      // pantalla se reconozca como «la mía» en vez de un formulario en blanco.
      const activos = acc
        .diasVisibles()
        .filter((dia) => dia.activo)
        .map((dia) => dia.largo);
      expect(activos).toEqual(['Martes', 'Jueves']);

      const martes = acc.grupoDe(1).getRawValue();
      // Sin los segundos: el `<input type="time"> del formulario los rechaza.
      expect(martes.desde).toBe('15:00');
      expect(martes.hasta).toBe('19:00');
      expect(martes.duracion).toBe(20);
    });

    it('avisa que los turnos ya abiertos NO se cierran solos', () => {
      // Es la limitación real de `M41 scheduling`: no hay forma de retirar una
      // plantilla, así que publicar un cambio agrega el horario nuevo y deja
      // los cupos del anterior en pie. Callarlo dejaría a alguien atendiendo un
      // día que creía haber cerrado.
      crearConHorarioVigente(VIGENTE);

      expect(fixture.nativeElement.textContent).toContain(
        'Los turnos ya abiertos no se cierran solos',
      );
    });

    /**
     * AC-10-7 pide «un modal de éxito (no una pantalla)». Se hacen las dos:
     * el modal es el instante y se va al cerrarlo; la pantalla de atrás es el
     * registro, que sigue ahí si lo cerraste sin leer o si volvés con atrás.
     */
    it('al publicar avisa con un modal, y dice cuántos turnos abrió', async () => {
      // `false` = «Quedarme acá»: sin esto el modal navega y la prueba se va
      // de la pantalla que está midiendo.
      respuestaDelDialogo = false;
      ultimoDialogo = null;

      crearConHorarioVigente(VIGENTE);
      acc.publicar();
      retirarVigente();
      http
        .expectOne('/scheduling/resources/res-1/templates')
        .flush({ id: 'tpl-2', name: 'x', ruleCount: 2, statusConceptId: 'c' });
      http
        .expectOne('/scheduling/templates/tpl-2/generate-slots')
        .flush({ templateId: 'tpl-2', created: 40, skipped: 0 });
      await fixture.whenStable();

      expect(ultimoDialogo).not.toBeNull();
      expect(String(ultimoDialogo?.['title'])).toContain('Listo');
      // El número que importa: sin él el modal dice «listo» y no dice de qué.
      expect(JSON.stringify(ultimoDialogo?.['details'])).toContain('40');

      respuestaDelDialogo = true;
    });

    it('reusa el recurso: cambiar el horario NO crea una segunda agenda', () => {
      crearConHorarioVigente(VIGENTE);

      acc.publicar();

      // Ni un `POST /scheduling/resources`: el recurso ya estaba y se reusa. Es
      // el defecto que este carril arregla — «Cambiar mi horario» dejaba al
      // médico con dos agendas y a los pacientes viendo los turnos de las dos.
      http.expectNone((r) => r.url === '/scheduling/resources' && r.method === 'POST');
      retirarVigente();
      http
        .expectOne('/scheduling/resources/res-1/templates')
        .flush({ id: 'tpl-2', name: 'x', ruleCount: 2, statusConceptId: 'c' });
      http
        .expectOne('/scheduling/templates/tpl-2/generate-slots')
        .flush({ templateId: 'tpl-2', created: 40, skipped: 0 });
      fixture.detectChanges();
    });
  });

  /* -- El respiro entre consultas (TAREA-10 §3.4) --------------------------- */

  describe('el respiro entre consultas', () => {
    it('la pantalla lo ofrece, y arranca sin respiro', () => {
      crear();
      encenderLunes();

      // Sin respiro por omisión: es lo que la agenda hacía antes de que el
      // campo existiera, así que abrir el formulario no cambia nada.
      expect(acc.grupoDe(0).getRawValue().respiro).toBe(0);
      // Desde que el formulario es una tabla —la forma que pidió el
      // propietario— el respiro es una COLUMNA, no una pregunta suelta. Lo que
      // se comprueba sigue siendo lo mismo: que la opción está a la vista.
      const texto: string = fixture.nativeElement.textContent;
      expect(texto).toContain('Descanso');
      expect(texto).toContain('Sin respiro');
    });

    it('sin respiro NO manda el campo: cero declarado y no declarado son distintos', () => {
      crear();
      encenderLunes();

      acc.publicar();

      http.expectOne('/scheduling/resources').flush({ id: 'res-1' });
      const alta = http.expectOne('/scheduling/resources/res-1/templates');
      // Ni `gapMinutes: 0`: escribir un cero que nadie declaró borraría la
      // diferencia el día que el default cambie.
      expect(alta.request.body.rules[0].gapMinutes).toBeUndefined();
      alta.flush({ id: 'tpl-1', name: 'x', ruleCount: 1, statusConceptId: 'c' });
      http
        .expectOne('/scheduling/templates/tpl-1/generate-slots')
        .flush({ templateId: 'tpl-1', created: 8, skipped: 0 });
      fixture.detectChanges();
    });

    it('elegido, viaja con la franja', () => {
      crear();
      encenderLunes();
      acc.elegirRespiro(0, 15);

      acc.publicar();

      http.expectOne('/scheduling/resources').flush({ id: 'res-1' });
      const alta = http.expectOne('/scheduling/resources/res-1/templates');
      expect(alta.request.body.rules[0].gapMinutes).toBe(15);
      alta.flush({ id: 'tpl-1', name: 'x', ruleCount: 1, statusConceptId: 'c' });
      http
        .expectOne('/scheduling/templates/tpl-1/generate-slots')
        .flush({ templateId: 'tpl-1', created: 6, skipped: 0 });
      fixture.detectChanges();
    });

    it('dice cuántos turnos entran, con el respiro contado', () => {
      crear();
      encenderLunes();
      // 09:00–13:00 son 240 minutos. Con turnos de 30: entran 8.
      expect(acc.turnosDelDia(0)).toBe(8);

      // Con 30 de respiro el paso es 60, y el último turno tiene que entrar
      // ENTERO: 09:00, 10:00, 11:00, 12:00 → 4.
      acc.elegirRespiro(0, 30);
      expect(acc.turnosDelDia(0)).toBe(4);
    });

    it('el costo se ve antes de guardar, no después', () => {
      crear();
      encenderLunes();
      fixture.detectChanges();

      // La columna «Turnos» de la fila: el costo en el mismo renglón donde se
      // elige, que es donde se lo mira.
      expect(fixture.nativeElement.textContent).toContain('Turnos');
      expect(acc.turnosDelDia(0)).toBe(8);

      // Elegir respiro sobre una franja corta quita turnos, y ese número no se
      // deduce leyendo la fila.
      acc.elegirRespiro(0, 30);
      fixture.detectChanges();
      expect(acc.turnosDelDia(0)).toBe(4);
      expect(fixture.nativeElement.textContent).toContain('4');
    });

    it('la vista previa cuenta el respiro: no se contradice con el campo', () => {
      // El defecto que encontró la verificación visual: `calcularTurnos` ya
      // sabía contar el respiro (AG-4) y nadie se lo pasaba, así que la vista
      // previa decía «8 turnos» mientras el campo decía «entran 5». Dos
      // números para la misma franja, los dos en pantalla a la vez.
      crear();
      encenderLunes();
      acc.elegirRespiro(0, 15);
      fixture.detectChanges();

      const texto: string = fixture.nativeElement.textContent;
      // El número de la fila y el de la vista previa son el MISMO cálculo. Lo
      // que esta prueba impide es que vuelvan a separarse.
      expect(acc.turnosDelDia(0)).toBe(5);
      const previa: HTMLElement = fixture.nativeElement.querySelector('.agenda-create__previa-dia');
      expect(previa.textContent).toContain('Lunes');
      // Y el paso completo —30 + 15— se ve en el cierre: sin contar el
      // respiro, cinco turnos de 30 cerrarían a las 11:30, no a las 12:30.
      expect(texto).toContain('09:00 – 12:30');
      expect(texto).toContain('5 turnos de 30 min');
    });

    it('el resumen nombra el respiro sólo cuando lo hay', () => {
      crear();
      encenderLunes();
      expect(acc.resumen()).not.toContain('descanso');

      acc.elegirRespiro(0, 15);
      // «con 0 minutos de descanso» sería ruido en la mayoría de las agendas.
      expect(acc.resumen()).toContain('15 minutos de descanso');
    });

    it('un horario vigente con respiro lo carga en la semanita', () => {
      crearConHorarioVigente({
        ...VIGENTE_CON_RESPIRO,
      });

      expect(acc.grupoDe(1).getRawValue().respiro).toBe(10);
    });
  });

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

  /**
   * CREAR UNA SEGUNDA AGENDA — la mitad que faltaba.
   *
   * La pantalla decía «Publicar mi agenda» y, para quien ya tenía una,
   * **editaba la única que había**: `crearRecurso` reutiliza el `resourceId`
   * que la carga resuelve, y ese id siempre estaba puesto. O sea que un
   * profesional no podía abrir una agenda en otra sede **nunca**.
   *
   * Se encontró recorriendo el producto: «no sé dónde publicar mis horarios»
   * no era un problema de encontrar el botón, era que no había segundo lado.
   */
  describe('una segunda agenda', () => {
    it('con una agenda existente, se ofrece crear otra', () => {
      crearConHorarioVigente({
        id: 'tpl-1',
        name: 'Horario',
        ruleCount: 1,
        statusConceptId: 'c',
        rules: [],
      });

      // El bloque de elección aparece aunque haya una sola: es donde vive la
      // salida hacia la segunda.
      expect(acc.eligeSede()).toBe(true);
      expect(acc.agendaNueva()).toBe(false);
      expect(acc.resourceId()).toBe('res-1');
    });

    it('al empezar una nueva, publicar CREA un recurso en vez de reusar', () => {
      crearConHorarioVigente({
        id: 'tpl-1',
        name: 'Horario',
        ruleCount: 1,
        statusConceptId: 'c',
        rules: [],
      });

      acc.empezarAgendaNueva();
      fixture.detectChanges();
      // Soltar el id es lo único que hace que el alta cree en vez de editar.
      expect(acc.resourceId()).toBeNull();

      acc.nombreNuevo.set('Consultorio en la Caja');
      encenderLunes();
      acc.publicar();

      const alta = http.expectOne('/scheduling/resources');
      expect(alta.request.method).toBe('POST');
      // Y el nombre es el que escribió, no uno derivado de su propio nombre:
      // es lo único que distingue las dos agendas en todas las listas.
      expect((alta.request.body as { name: string }).name).toBe('Consultorio en la Caja');
      alta.flush({ id: 'res-2', name: 'Consultorio en la Caja', stateConceptId: 'c' });

      http
        .expectOne('/scheduling/resources/res-2/templates')
        .flush({ id: 'tpl-2', name: 'x', ruleCount: 1, statusConceptId: 'c' });
      http
        .expectOne((r) => r.url === '/scheduling/templates/tpl-2/generate-slots')
        .flush({ created: 4, skipped: 0 });

      expect(acc.publicado()).toBe(true);
    });

    it('sin nombre propio, la agenda nueva no se queda sin nombre', () => {
      // Cae al derivado en vez de mandar una cadena vacía, que el servidor
      // rechazaría y dejaría al médico sin saber qué campo llenar.
      crearConHorarioVigente({
        id: 'tpl-1',
        name: 'Horario',
        ruleCount: 1,
        statusConceptId: 'c',
        rules: [],
      });

      acc.empezarAgendaNueva();
      encenderLunes();
      acc.publicar();

      const alta = http.expectOne('/scheduling/resources');
      expect((alta.request.body as { name: string }).name).toBe('Agenda de Dra. Elena Salas');
      alta.flush({ id: 'res-2', name: 'x', stateConceptId: 'c' });
      http
        .expectOne('/scheduling/resources/res-2/templates')
        .flush({ id: 'tpl-2', name: 'x', ruleCount: 1, statusConceptId: 'c' });
      http
        .expectOne((r) => r.url === '/scheduling/templates/tpl-2/generate-slots')
        .flush({ created: 4, skipped: 0 });
    });

    it('«mejor una que ya tengo» vuelve a la existente', () => {
      crearConHorarioVigente({
        id: 'tpl-1',
        name: 'Horario',
        ruleCount: 1,
        statusConceptId: 'c',
        rules: [],
      });

      acc.empezarAgendaNueva();
      expect(acc.resourceId()).toBeNull();

      acc.volverAAgendaExistente();
      fixture.detectChanges();

      expect(acc.agendaNueva()).toBe(false);
      expect(acc.resourceId()).toBe('res-1');
      http.expectOne('/scheduling/resources/res-1/templates').flush({ items: [], count: 0 });
    });
  });

  /**
   * «LIMPIAR CAMPOS» — punto del pedido original que faltaba.
   *
   * Pide confirmación porque **no hay deshacer**: quien lo toca sin querer
   * pierde la semana que acaba de armar, y armarla es el trabajo entero de esta
   * pantalla.
   */
  describe('limpiar campos', () => {
    it('deja la semana en blanco cuando se confirma', async () => {
      crear();
      acc.alternarDia(0);
      acc.grupoDe(0).controls['desde'].setValue('07:00');
      fixture.detectChanges();
      expect(acc.sinDias()).toBe(false);

      await acc.limpiarCampos();
      fixture.detectChanges();

      expect(acc.sinDias()).toBe(true);
      // Y vuelve al valor de fábrica, no a lo que había escrito.
      expect(acc.grupoDe(0).controls['desde'].value).toBe('09:00');
    });

    it('no borra nada si se cancela', async () => {
      // El diálogo devuelve `false` al cancelar **y** en el servidor, donde no
      // hay quién conteste. Las dos situaciones tienen que dejar el formulario
      // intacto: un «limpiar» que limpia igual sería peor que no preguntar.
      crear();
      acc.alternarDia(0);
      fixture.detectChanges();

      respuestaDelDialogo = false;
      await acc.limpiarCampos();
      respuestaDelDialogo = true;
      fixture.detectChanges();

      expect(acc.sinDias()).toBe(false);
      expect(acc.grupoDe(0).controls['activo'].value).toBe(true);
    });
  });

  /**
   * LA FORMA DE TABLA — lo que pedía la bitácora original.
   *
   * «Una tabla donde cada día de la semana es una fila, las columnas que son
   * selects son: Desde, Hasta, Tamaño del slot». Antes eran fichas por día y un
   * panel desplegable: funcionaba y publicaba bien, pero no era la forma
   * pedida, y quien pidió una tabla no reconoce un acordeón.
   */
  describe('el formulario como tabla', () => {
    it('los SIETE días están siempre, encendidos o no', () => {
      // En una tabla se lee de un golpe qué días atendés y cuáles no. Con
      // paneles había que abrir uno por uno para saberlo.
      crear();
      const texto: string = fixture.nativeElement.textContent;

      for (const dia of ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']) {
        expect(texto).toContain(dia);
      }
      // Y los apagados lo dicen, en vez de desaparecer.
      expect(texto).toContain('No atendés');
    });

    it('las columnas son las que pidió el original', () => {
      crear();
      const texto: string = fixture.nativeElement.textContent;

      expect(texto).toContain('Desde');
      expect(texto).toContain('Hasta');
      expect(texto).toContain('Dura');
      expect(texto).toContain('Descanso');
    });

    it('las horas aceptan cualquier minuto: el horario es flexible', () => {
      // Eran un select de medias horas y quien abre a las 08:15 no podía
      // decirlo (propietario, 18/09). Ahora es un campo de hora.
      crear();
      encenderLunes();
      const desde: HTMLInputElement = fixture.nativeElement.querySelector(
        '[data-testid="agenda-create-desde-0"]',
      );
      expect(desde.type).toBe('time');
      expect(desde.getAttribute('aria-label')).toBe('Desde, Lunes');

      acc.fijarDeLaFila(0, 'desde', '08:15');
      acc.fijarDeLaFila(0, 'hasta', '12:40');
      fixture.detectChanges();

      // 08:15 → 12:40 son 265 minutos: 8 turnos de 30 y sobran 25.
      expect(acc.grupoDe(0).valid).toBe(true);
      expect(acc.turnosDelDia(0)).toBe(8);
    });

    it('ya no pregunta la sede ni los pacientes por turno', () => {
      crear();
      acc.avanzadasAbiertas.set(true);
      fixture.detectChanges();
      const texto: string = fixture.nativeElement.textContent;
      expect(texto).not.toContain('¿En qué sede atendés?');
      expect(texto).not.toContain('¿Cuántos pacientes por turno?');
    });

    it('elegir en la fila cambia el horario de ese día', () => {
      crear();
      encenderLunes();

      acc.fijarDeLaFila(0, 'desde', '07:00');
      acc.fijarDeLaFila(0, 'hasta', '11:00');
      fixture.detectChanges();

      expect(acc.grupoDe(0).getRawValue().desde).toBe('07:00');
      // Y el número de la fila se recalcula solo: 4 horas de 30 minutos.
      expect(acc.turnosDelDia(0)).toBe(8);
    });

    it('un día apagado no viaja al servidor', () => {
      // La casilla de la fila es lo que decide, igual que antes lo decidía la
      // ficha. Si un día apagado publicara, abriría turnos que nadie pidió.
      crear();
      encenderLunes();
      acc.publicar();

      http.expectOne('/scheduling/resources').flush({ id: 'res-1' });
      const alta = http.expectOne('/scheduling/resources/res-1/templates');
      expect(alta.request.body.rules).toHaveLength(1);
      alta.flush({ id: 'tpl-1', name: 'x', ruleCount: 1, statusConceptId: 'c' });
      http
        .expectOne('/scheduling/templates/tpl-1/generate-slots')
        .flush({ templateId: 'tpl-1', created: 8, skipped: 0 });
      fixture.detectChanges();
    });
  });
});
