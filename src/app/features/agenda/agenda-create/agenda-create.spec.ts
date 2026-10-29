import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, type WritableSignal } from '@angular/core';
import { FormArray, FormGroup } from '@angular/forms';
import { provideRouter } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { DialogService } from '@shared/components/molecules/dialog/dialog-service';
import { NavigationService } from '../../../core/navigation/navigation.service';
import {
  OWN_OFFICE_KEY,
  type OrganizationChoice,
} from '../../../shared/components/molecules/organization-select/organization-select.types';
import { AgendaCreate } from './agenda-create';
import { environment } from '../../../../environments/environment';

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
  abrirRepetir(): void;
  repetirFila(): void;
  readonly filaARepetir: WritableSignal<number | null>;
  readonly repetirAbierto: WritableSignal<boolean>;
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
  /** Horario flexible y almuerzo (propietario, 18/09). */
  readonly flexible: WritableSignal<boolean>;
  /** P36 · lo que se reserva por paciente en horario flexible. */
  readonly minutosPorPaciente: WritableSignal<number>;
  readonly conAlmuerzo: WritableSignal<boolean>;
  readonly almuerzoDesde: WritableSignal<string>;
  readonly almuerzoHasta: WritableSignal<string>;
  readonly almuerzoInvalido: () => boolean;
  /** Dónde se publica: lo elegido en el selector de organización (REQ-C2-003). */
  readonly place: { readonly choice: WritableSignal<OrganizationChoice | null> };
  readonly misAgendas: () => readonly unknown[];
  readonly esCambio: () => boolean;
  /** Elegir otra de las agendas de la organización. */
  elegirSede(id: string | null): void;
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

// Estas pruebas ejercitan funciones que hoy sólo existen en la maqueta (informe B):
// contra la API real sus claves no viajan, y eso lo cubren simulator-only.spec y
// contract-drift.spec. En esta rama la maqueta viene apagada: se enciende acá.
const mockBackendOriginal = environment.mockBackend;
beforeAll(() => Object.assign(environment, { mockBackend: true }));
afterAll(() => Object.assign(environment, { mockBackend: mockBackendOriginal }));

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
    http
      .expectOne((r) => r.url === '/scheduling/resources')
      .flush({
        items: [{ id: 'res-1', name: 'Agenda', resourceRefId: PERFIL, stateConceptId: 'c' }],
        count: 1,
      });
    http.expectOne('/scheduling/resources/res-1/templates').flush({ items: [plantilla], count: 1 });
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  /**
   * Contesta el retiro del horario vigente, que desde el arreglo del cierre de
   * turnos precede a toda publicación de un cambio.
   */
  /**
   * Desde el 24/10/2026 el retiro va precedido de la vista previa de citas
   * vivas (`live-bookings`): sin ninguna, se retira como siempre. La decisión
   * se toma en una promesa, así que el DELETE sale un tick después del GET.
   */
  async function retirarVigente(id = 'tpl-1'): Promise<void> {
    http
      .expectOne(`/scheduling/templates/${id}/live-bookings`)
      .flush({ templateId: id, total: 0, bookings: [], present: [] });
    await new Promise((resolve) => setTimeout(resolve, 0));
    http.expectOne(`/scheduling/templates/${id}`).flush({
      id,
      statusConceptId: 'archived',
      releasedSlots: 24,
      keptSlots: 0,
      liveBookings: 0,
      liveBookingIds: [],
      truncated: false,
      cancelledBookings: 0,
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
    it('cambiar el horario retira el vigente ANTES de crear el nuevo', async () => {
      crearConHorarioVigente(VIGENTE);
      acc.publicar();

      // Primero la vista previa de citas vivas; sin ninguna, se retira directo.
      http
        .expectOne('/scheduling/templates/tpl-1/live-bookings')
        .flush({ templateId: 'tpl-1', total: 0, bookings: [], present: [] });
      await new Promise((resolve) => setTimeout(resolve, 0));
      const retiro = http.expectOne('/scheduling/templates/tpl-1');
      expect(retiro.request.method).toBe('DELETE');
      // Todavía no se creó nada: el orden es lo que impide dos horarios vivos.
      http.expectNone('/scheduling/resources/res-1/templates');

      retiro.flush({
        id: 'tpl-1',
        statusConceptId: 'archived',
        releasedSlots: 24,
        keptSlots: 3,
        liveBookings: 3,
        liveBookingIds: ['b-1', 'b-2', 'b-3'],
        truncated: false,
        cancelledBookings: 0,
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
     * Si el retiro falla, no se publica nada y el mensaje del servidor se
     * muestra tal cual. Desde M4 las citas vivas ya no lo frenan (P23); el 409
     * sigue siendo el caso a probar porque es el de una API anterior, y el
     * camino de error es el mismo para cualquier rechazo.
     */
    it('si el retiro responde 409, no crea la plantilla nueva', async () => {
      crearConHorarioVigente(VIGENTE);
      acc.publicar();

      http
        .expectOne('/scheduling/templates/tpl-1/live-bookings')
        .flush({ templateId: 'tpl-1', total: 0, bookings: [], present: [] });
      await new Promise((resolve) => setTimeout(resolve, 0));
      http.expectOne('/scheduling/templates/tpl-1').flush(
        {
          code: 'CONFLICT',
          message: 'El horario tiene 3 citas comprometidas: resuélvalas antes de cambiarlo.',
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
      expect(texto).toContain('Cambie su horario');
      expect(texto).not.toContain('Publique su agenda');
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

    it('no muestra avisos arriba del formulario (propietario, 19/09/2026)', () => {
      crearConHorarioVigente(VIGENTE);

      const texto: string = fixture.nativeElement.textContent;
      expect(texto).not.toContain('Los turnos ya abiertos no se cierran solos');
      expect(texto).not.toContain('quirúrgicas');
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
      await retirarVigente();
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

    it('reusa el recurso: cambiar el horario NO crea una segunda agenda', async () => {
      crearConHorarioVigente(VIGENTE);

      acc.publicar();

      // Ni un `POST /scheduling/resources`: el recurso ya estaba y se reusa. Es
      // el defecto que este carril arregla — «Cambiar mi horario» dejaba al
      // médico con dos agendas y a los pacientes viendo los turnos de las dos.
      http.expectNone((r) => r.url === '/scheduling/resources' && r.method === 'POST');
      await retirarVigente();
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
      expect(fixture.nativeElement.textContent).toContain('Horarios');
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
      // Con el redondeo hacia adelante (04/10/2026) el sexto turno empieza a
      // las 12:45 —dentro de la franja— y se completa hasta las 13:15.
      expect(acc.turnosDelDia(0)).toBe(6);
      const previa: HTMLElement = fixture.nativeElement.querySelector('.agenda-create__previa-dia');
      expect(previa.textContent).toContain('Lunes');
      // Y el paso completo —30 + 15— se ve en el cierre.
      expect(texto).toContain('09:00 – 13:15');
      expect(texto).toContain('6 citas de 30 min');
      // Y se dice que el último pasa la hora de fin.
      expect(
        fixture.nativeElement.querySelector('[data-testid="agenda-create-previa-extiende"]')
          ?.textContent,
      ).toContain('13:15');
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

    it('un horario vigente con franjas de servicios carga qué atiende cada día (v4.2.40)', () => {
      crearConHorarioVigente({
        id: 'tpl-m',
        name: 'Mixto',
        slotMinutes: 30,
        statusConceptId: 'c',
        rules: [
          { dayOfWeek: 2, startTime: '14:00:00', endTime: '18:00:00', bookingMode: 'SERVICES' },
          {
            dayOfWeek: 3,
            startTime: '08:00:00',
            endTime: '12:00:00',
            slotMinutes: 30,
            bookingMode: 'MIXED',
          },
          { dayOfWeek: 4, startTime: '08:00:00', endTime: '12:00:00', slotMinutes: 30 },
        ],
      });

      expect(acc.grupoDe(1).getRawValue().modo).toBe('SERVICES');
      expect(acc.grupoDe(2).getRawValue().modo).toBe('MIXED');
      // Sin modo declarado ≡ sólo consultas: lo que toda franja era antes.
      expect(acc.grupoDe(3).getRawValue().modo).toBe('CONSULTATIONS');
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
    expect(fixture.nativeElement.textContent).toContain('Elija una organización primero');
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
    expect(fixture.nativeElement.textContent).toContain('Va a publicar su propia agenda');
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

  /*
   * Propietario, 04/10/2026: el botón va arriba, primero pregunta con un modal
   * y deja elegir qué fila repetir. Y copia el descanso, que antes quedaba atrás.
   */
  it('repetir pregunta primero: abrir el modal no cambia nada', () => {
    crear();
    acc.alternarDia(0);
    acc.alternarDia(3);
    acc.semana.at(0).patchValue({ desde: '08:00', hasta: '11:00', duracion: 20 });
    fixture.detectChanges();

    (
      fixture.nativeElement.querySelector(
        '[data-testid="agenda-create-masivo"]',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    expect(acc.repetirAbierto()).toBe(true);
    expect(
      fixture.nativeElement.querySelector('[data-testid="agenda-create-masivo-fila"]'),
    ).not.toBeNull();
    expect(acc.semana.at(3).getRawValue().desde).not.toBe('08:00');

    (
      fixture.nativeElement.querySelector(
        '[data-testid="agenda-create-masivo-cancelar"]',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    expect(acc.repetirAbierto()).toBe(false);
    expect(acc.semana.at(3).getRawValue().desde).not.toBe('08:00');
  });

  it('el botón de repetir está arriba de la tabla, no al pie', () => {
    crear();
    acc.alternarDia(0);
    acc.alternarDia(3);
    fixture.detectChanges();

    const boton: HTMLElement = fixture.nativeElement.querySelector(
      '[data-testid="agenda-create-masivo"]',
    );
    const tabla: HTMLElement = fixture.nativeElement.querySelector('.agenda-create__tabla');
    expect(boton.compareDocumentPosition(tabla) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('repetir copia la fila ELEGIDA —con su descanso— a los demás días encendidos', () => {
    crear();
    acc.alternarDia(0);
    acc.alternarDia(3);
    acc.alternarDia(4);
    acc.semana.at(3).patchValue({ desde: '08:00', hasta: '11:00', duracion: 20, respiro: 10 });
    fixture.detectChanges();

    acc.abrirRepetir();
    expect(acc.filaARepetir()).toBe(0);
    acc.filaARepetir.set(3);
    acc.repetirFila();

    for (const dia of [0, 4]) {
      expect(acc.semana.at(dia).getRawValue()).toMatchObject({
        desde: '08:00',
        hasta: '11:00',
        duracion: 20,
        respiro: 10,
      });
    }
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
        message: 'Ya tiene un horario los martes de 10:00 a 12:00 que se cruza con éste',
      },
      { status: 422, statusText: 'Unprocessable' },
    );
    fixture.detectChanges();

    const texto: string = fixture.nativeElement.textContent;
    expect(texto).toContain('Ya tiene un horario los martes');
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
    expect(texto).toContain('su agenda ya está publicada');
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

      for (const dia of [
        'Lunes',
        'Martes',
        'Miércoles',
        'Jueves',
        'Viernes',
        'Sábado',
        'Domingo',
      ]) {
        expect(texto).toContain(dia);
      }
      // Y los apagados lo dicen, en vez de desaparecer.
      expect(texto).toContain('No atiende');
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

      // 08:15 → 12:40 son 265 minutos: 8 turnos de 30 y el noveno, que
      // empieza 12:15, se completa hasta 12:45 (redondeo hacia adelante).
      expect(acc.grupoDe(0).valid).toBe(true);
      expect(acc.turnosDelDia(0)).toBe(9);
    });

    it('ya no pregunta la sede ni los pacientes por turno', () => {
      crear();
      acc.avanzadasAbiertas.set(true);
      fixture.detectChanges();
      const texto: string = fixture.nativeElement.textContent;
      expect(texto).not.toContain('¿En qué sede atiende?');
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
  /* -- Horario flexible, almuerzo y «Sí / No» (propietario, 18/09) ---------- */

  describe('horario flexible, almuerzo y botones Sí / No', () => {
    /** Publica hasta la plantilla y devuelve su cuerpo; cierra el ciclo. */
    function cuerpoDeLaPlantilla(): Record<string, unknown> {
      acc.publicar();
      http
        .expectOne('/scheduling/resources')
        .flush({ id: 'res-1', name: 'x', stateConceptId: 'c' });
      const plantilla = http.expectOne('/scheduling/resources/res-1/templates');
      const cuerpo = plantilla.request.body as Record<string, unknown>;
      plantilla.flush({ id: 'tpl-1', name: 'x', ruleCount: 1, statusConceptId: 'c' });
      http
        .expectOne('/scheduling/templates/tpl-1/generate-slots')
        .flush({ templateId: 'tpl-1', created: 1, skipped: 0 });
      return cuerpo;
    }

    it('el almuerzo parte el día en dos franjas: mañana y tarde', () => {
      crear();
      encenderLunes();
      acc.semana.at(0).patchValue({ desde: '08:00', hasta: '18:00', duracion: 30 });
      acc.conAlmuerzo.set(true);
      acc.almuerzoDesde.set('12:30');
      acc.almuerzoHasta.set('14:00');
      fixture.detectChanges();

      expect(acc.turnosDelDia(0)).toBe(9 + 8);
      expect(cuerpoDeLaPlantilla()['rules']).toEqual([
        expect.objectContaining({
          dayOfWeek: 1,
          startTime: '08:00',
          endTime: '12:30',
          slotMinutes: 30,
        }),
        expect.objectContaining({
          dayOfWeek: 1,
          startTime: '14:00',
          endTime: '18:00',
          slotMinutes: 30,
        }),
      ]);
    });

    it('un almuerzo fuera del horario de ese día no lo corta', () => {
      crear();
      encenderLunes();
      acc.semana.at(0).patchValue({ desde: '08:00', hasta: '12:00' });
      acc.conAlmuerzo.set(true);
      fixture.detectChanges();

      expect(cuerpoDeLaPlantilla()['rules']).toEqual([
        expect.objectContaining({ startTime: '08:00', endTime: '12:00' }),
      ]);
    });

    it('un almuerzo al revés se avisa y no deja publicar', () => {
      crear();
      encenderLunes();
      acc.conAlmuerzo.set(true);
      acc.almuerzoDesde.set('14:00');
      acc.almuerzoHasta.set('13:00');
      fixture.detectChanges();

      expect(acc.almuerzoInvalido()).toBe(true);
      acc.publicar();
      http.expectNone('/scheduling/resources');
      expect(fixture.nativeElement.textContent).toContain('Tiene que terminar después de empezar.');
    });

    it('en horario flexible no viajan duración ni descanso, y la plantilla lo declara', () => {
      crear();
      encenderLunes();
      acc.semana.at(0).patchValue({ respiro: 10 });
      acc.flexible.set(true);
      fixture.detectChanges();

      const cuerpo = cuerpoDeLaPlantilla();
      expect(cuerpo['flexibleHours']).toBe(true);
      const reglas = cuerpo['rules'] as Record<string, unknown>[];
      expect(reglas[0]).not.toHaveProperty('slotMinutes');
      expect(reglas[0]).not.toHaveProperty('gapMinutes');
      // P36: ni capacidad por turno —la API rechaza la franja que la declara—.
      expect(reglas[0]).not.toHaveProperty('capacityPerSlot');
      // Lo que se reserva por paciente viaja una vez, en la plantilla.
      expect(cuerpo['slotMinutes']).toBe(30);
    });

    it('P36 · en horario flexible se elige cuánto se reserva por paciente y viaja en la plantilla', () => {
      crear();
      encenderLunes();
      acc.flexible.set(true);
      fixture.detectChanges();
      expect(
        fixture.nativeElement.querySelector('[data-testid="agenda-create-minutos-por-paciente"]'),
      ).not.toBeNull();

      acc.minutosPorPaciente.set(20);
      expect(cuerpoDeLaPlantilla()['slotMinutes']).toBe(20);
    });

    it('P36 · con turnos fijos no se pregunta el tiempo por paciente', () => {
      crear();
      encenderLunes();
      fixture.detectChanges();
      expect(
        fixture.nativeElement.querySelector('[data-testid="agenda-create-minutos-por-paciente"]'),
      ).toBeNull();
    });

    it('en horario flexible la tabla no pregunta duración ni descanso', () => {
      crear();
      encenderLunes();
      acc.flexible.set(true);
      fixture.detectChanges();

      const encabezados = [...fixture.nativeElement.querySelectorAll('thead th')].map(
        (th: Element) => th.textContent?.trim(),
      );
      // «Atiendo» y «Telemedicina» sí están: qué admite la franja (consultas,
      // servicios o ambos, y si también por videollamada) no depende de si los
      // turnos son fijos. Lo que NO aparece es duración ni descanso.
      expect(encabezados).toEqual(['Día', 'Desde', 'Hasta', 'Atiendo', 'Telemedicina']);
      expect(acc.resumen()).toContain('horario flexible sin citas de duración fija');
    });

    describe('telemedicina por franja', () => {
      it('arranca apagada y NO se manda: ausente ≡ sin telemedicina', () => {
        crear();
        encenderLunes();

        expect(acc.grupoDe(0).getRawValue().telemedicina).toBe(false);
        const reglas = cuerpoDeLaPlantilla()['rules'] as Record<string, unknown>[];
        expect(reglas[0]).not.toHaveProperty('telemedicineEnabled');
      });

      it('el interruptor de la fila la activa y viaja como true en cada franja del día', () => {
        crear();
        encenderLunes();
        // Con almuerzo el día son dos franjas: las dos llevan la telemedicina.
        acc.semana.at(0).patchValue({ desde: '08:00', hasta: '18:00' });
        acc.conAlmuerzo.set(true);
        acc.almuerzoDesde.set('12:00');
        acc.almuerzoHasta.set('14:00');
        fixture.detectChanges();

        const interruptor = fixture.nativeElement.querySelector(
          '[data-testid="agenda-create-telemedicina-0"] input[role="switch"]',
        ) as HTMLInputElement;
        expect(interruptor).not.toBeNull();
        expect(interruptor.checked).toBe(false);
        expect(interruptor.getAttribute('aria-label')).toBe('Atiende por telemedicina, Lunes');
        interruptor.click();
        fixture.detectChanges();

        expect(acc.grupoDe(0).getRawValue().telemedicina).toBe(true);
        const reglas = cuerpoDeLaPlantilla()['rules'] as Record<string, unknown>[];
        expect(reglas).toHaveLength(2);
        for (const regla of reglas) expect(regla['telemedicineEnabled']).toBe(true);
      });

      it('la vista previa marca la franja con telemedicina', () => {
        crear();
        encenderLunes();
        acc.fijarDeLaFila(0, 'telemedicina', true);
        const previa = (
          acc as unknown as { reglasDeLaPrevia(): { telemedicineEnabled?: boolean }[] }
        ).reglasDeLaPrevia();
        expect(previa[0].telemedicineEnabled).toBe(true);
      });

      it('repetir una fila copia también la telemedicina', () => {
        crear();
        encenderLunes();
        acc.alternarDia(1);
        acc.fijarDeLaFila(0, 'telemedicina', true);
        acc.filaARepetir.set(0);
        acc.repetirFila();
        expect(acc.grupoDe(1).getRawValue().telemedicina).toBe(true);
      });

      it('un horario vigente con telemedicina la carga, y apagarla viaja como false', async () => {
        crearConHorarioVigente({
          id: 'tpl-1',
          name: 'Con telemedicina',
          slotMinutes: 30,
          statusConceptId: 'c',
          rules: [
            {
              dayOfWeek: 2,
              startTime: '15:00:00',
              endTime: '19:00:00',
              slotMinutes: 30,
              telemedicineEnabled: true,
            },
            {
              dayOfWeek: 4,
              startTime: '15:00:00',
              endTime: '19:00:00',
              slotMinutes: 30,
              telemedicineEnabled: false,
            },
          ],
        });
        expect(acc.grupoDe(1).getRawValue().telemedicina).toBe(true);
        expect(acc.grupoDe(3).getRawValue().telemedicina).toBe(false);

        // La apaga el martes, que la tenía publicada.
        acc.fijarDeLaFila(1, 'telemedicina', false);
        acc.publicar();
        await retirarVigente();
        const plantilla = http.expectOne('/scheduling/resources/res-1/templates');
        const reglas = (plantilla.request.body as { rules: Record<string, unknown>[] }).rules;
        plantilla.flush({ id: 'tpl-2', name: 'x', ruleCount: 2, statusConceptId: 'c' });
        http
          .expectOne('/scheduling/templates/tpl-2/generate-slots')
          .flush({ templateId: 'tpl-2', created: 1, skipped: 0 });

        const martes = reglas.find((r) => r['dayOfWeek'] === 2);
        const jueves = reglas.find((r) => r['dayOfWeek'] === 4);
        // El martes la tenía y la apagó: se escribe `false`, no se omite.
        expect(martes?.['telemedicineEnabled']).toBe(false);
        // El jueves nunca la tuvo: no se escribe nada.
        expect(jueves).not.toHaveProperty('telemedicineEnabled');
      });
    });

    describe('qué se atiende en cada franja (v4.2.40)', () => {
      it('por omisión es sólo consultas y NO se manda: ausente ≡ lo de siempre', () => {
        crear();
        encenderLunes();

        const reglas = cuerpoDeLaPlantilla()['rules'] as Record<string, unknown>[];
        expect(acc.semana.at(0).getRawValue().modo).toBe('CONSULTATIONS');
        expect(reglas[0]).not.toHaveProperty('bookingMode');
      });

      it('una franja de servicios viaja como SERVICES', () => {
        crear();
        encenderLunes();
        acc.semana.at(0).patchValue({ modo: 'SERVICES' });

        const reglas = cuerpoDeLaPlantilla()['rules'] as Record<string, unknown>[];
        expect(reglas[0]['bookingMode']).toBe('SERVICES');
      });

      it('una franja mixta viaja como MIXED, con su duración de consulta', () => {
        crear();
        encenderLunes();
        acc.semana.at(0).patchValue({ modo: 'MIXED', duracion: 20 });

        const reglas = cuerpoDeLaPlantilla()['rules'] as Record<string, unknown>[];
        expect(reglas[0]).toMatchObject({ bookingMode: 'MIXED', slotMinutes: 20 });
      });

      it('la columna «Atiendo» ofrece consultas, otros servicios y ambos', () => {
        crear();
        encenderLunes();
        expect(
          (acc as unknown as { opcionesDeModo: { value: string; label: string }[] }).opcionesDeModo,
        ).toEqual([
          { value: 'CONSULTATIONS', label: 'Consultas' },
          { value: 'SERVICES', label: 'Otros servicios' },
          { value: 'MIXED', label: 'Ambos' },
        ]);
        expect(
          fixture.nativeElement.querySelector('[data-testid="agenda-create-modo-0"]'),
        ).not.toBeNull();
      });

      it('un día sólo de servicios no tiene turnos fijos que contar', () => {
        crear();
        encenderLunes();
        acc.semana
          .at(0)
          .patchValue({ desde: '14:00', hasta: '18:00', duracion: 30, modo: 'SERVICES' });
        fixture.detectChanges();

        expect(acc.turnosDelDia(0)).toBe(0);
        const celda = fixture.nativeElement.querySelector('.schedule-day-row__slots');
        expect(celda.textContent.trim()).toBe('—');
      });

      it('un día mixto SÍ cuenta sus consultas', () => {
        crear();
        encenderLunes();
        acc.semana
          .at(0)
          .patchValue({ desde: '08:00', hasta: '10:00', duracion: 30, modo: 'MIXED' });

        expect(acc.turnosDelDia(0)).toBe(4);
      });

      it('el resumen no dice «consultas de 30 minutos» cuando hay franjas de servicios', () => {
        crear();
        encenderLunes();
        acc.semana.at(0).patchValue({ modo: 'SERVICES' });

        expect(acc.resumen()).toContain('franjas de servicios');
        expect(acc.resumen()).not.toContain('consultas de');
      });

      it('repetir el primer día copia también qué atiende', () => {
        crear();
        acc.alternarDia(0);
        acc.alternarDia(1);
        acc.semana.at(0).patchValue({ modo: 'MIXED' });

        acc.abrirRepetir();
        acc.repetirFila();

        expect(acc.semana.at(1).getRawValue().modo).toBe('MIXED');
      });

      it('las reglas de la vista previa llevan el modo, igual que las que se publican', () => {
        crear();
        encenderLunes();
        acc.semana.at(0).patchValue({ modo: 'SERVICES' });

        const previa = (
          acc as unknown as { reglasDeLaPrevia(): { bookingMode?: string }[] }
        ).reglasDeLaPrevia();
        expect(previa[0].bookingMode).toBe('SERVICES');
      });
    });

    it('con turnos fijos no se manda flexibleHours', () => {
      crear();
      encenderLunes();
      expect(cuerpoDeLaPlantilla()).not.toHaveProperty('flexibleHours');
    });

    /* -- Horario flexible y descanso por día (v4.2.64, REQ-C2-004 a 006) ---- */

    describe('horario flexible y descanso por día', () => {
      /** Lunes de turnos con descanso de 10 y martes flexible, los dos de 9 a 13. */
      function buildMixedWeek(): void {
        acc.alternarDia(0);
        acc.alternarDia(1);
        acc.elegirRespiro(0, 10);
        acc.fijarDeLaFila(1, 'flexible', true);
        fixture.detectChanges();
      }

      function rowOf(index: number): HTMLElement {
        return fixture.nativeElement.querySelectorAll('tbody tr')[index] as HTMLElement;
      }

      it('semana mixta: el lunes lleva su descanso y el martes sólo flexibleHours', () => {
        crear();
        buildMixedWeek();
        acc.minutosPorPaciente.set(20);

        expect(cuerpoDeLaPlantilla()).toStrictEqual({
          name: 'Horario de Agenda de Dra. Elena Salas',
          rules: [
            {
              dayOfWeek: 1,
              startTime: '09:00',
              endTime: '13:00',
              slotMinutes: 30,
              gapMinutes: 10,
              capacityPerSlot: 1,
            },
            { dayOfWeek: 2, startTime: '09:00', endTime: '13:00', flexibleHours: true },
          ],
          // Lo que se reserva por paciente los días flexibles; la plantilla NO es flexible.
          slotMinutes: 20,
        });
      });

      it('toda la semana flexible: el cuerpo es el de antes, sin flexibleHours por franja', () => {
        crear();
        buildMixedWeek();
        acc.flexible.set(true);
        fixture.detectChanges();

        expect(cuerpoDeLaPlantilla()).toStrictEqual({
          name: 'Horario de Agenda de Dra. Elena Salas',
          rules: [
            { dayOfWeek: 1, startTime: '09:00', endTime: '13:00' },
            { dayOfWeek: 2, startTime: '09:00', endTime: '13:00' },
          ],
          slotMinutes: 30,
          flexibleHours: true,
        });
      });

      it('marcar flexibles todos los días, uno por uno, publica lo mismo que el atajo', () => {
        crear();
        buildMixedWeek();
        acc.fijarDeLaFila(0, 'flexible', true);
        fixture.detectChanges();

        const body = cuerpoDeLaPlantilla();
        expect(body['flexibleHours']).toBe(true);
        expect(body['rules']).toStrictEqual([
          { dayOfWeek: 1, startTime: '09:00', endTime: '13:00' },
          { dayOfWeek: 2, startTime: '09:00', endTime: '13:00' },
        ]);
      });

      it('el descanso se oculta sólo en la fila flexible', () => {
        crear();
        buildMixedWeek();

        const headers = [...fixture.nativeElement.querySelectorAll('thead th')].map(
          (th: Element) => th.textContent?.trim(),
        );
        expect(headers).toContain('Descanso');
        expect(headers).toContain('Horario flexible');
        expect(rowOf(0).querySelector('[data-testid="schedule-day-gap-0"]')).not.toBeNull();
        expect(rowOf(1).querySelector('[data-testid="schedule-day-gap-1"]')).toBeNull();
        expect(rowOf(1).textContent).toContain('Sin citas de duración fija');
        expect(acc.turnosDelDia(1)).toBe(0);
      });

      it('apagar el atajo devuelve los turnos fijos a todos los días', () => {
        crear();
        buildMixedWeek();
        const screen = acc as unknown as { setWeekFlexible(flexible: boolean): void };
        screen.setWeekFlexible(true);
        screen.setWeekFlexible(false);

        expect(acc.flexible()).toBe(false);
        expect(acc.semana.at(1).getRawValue().flexible).toBe(false);
      });

      it('editar una plantilla mixta carga cada fila con lo suyo', () => {
        crearConHorarioVigente({
          id: 'tpl-1',
          retired: false,
          name: 'Horario',
          statusConceptId: 'c',
          slotMinutes: 20,
          flexibleHours: false,
          rules: [
            {
              dayOfWeek: 1,
              startTime: '09:00:00',
              endTime: '13:00:00',
              slotMinutes: 30,
              gapMinutes: 10,
              flexibleHours: false,
            },
            { dayOfWeek: 2, startTime: '15:00:00', endTime: '19:00:00', flexibleHours: true },
          ],
        });

        expect(acc.flexible()).toBe(false);
        expect(acc.minutosPorPaciente()).toBe(20);
        expect(acc.semana.at(0).getRawValue()).toMatchObject({
          activo: true,
          respiro: 10,
          duracion: 30,
          flexible: false,
        });
        expect(acc.semana.at(1).getRawValue()).toMatchObject({
          activo: true,
          desde: '15:00',
          hasta: '19:00',
          flexible: true,
        });
      });

      it('editar una plantilla flexible deja flexibles todas las filas', () => {
        crearConHorarioVigente({
          id: 'tpl-1',
          retired: false,
          name: 'Horario',
          statusConceptId: 'c',
          slotMinutes: 30,
          flexibleHours: true,
          rules: [
            { dayOfWeek: 1, startTime: '09:00:00', endTime: '13:00:00', flexibleHours: true },
            { dayOfWeek: 3, startTime: '09:00:00', endTime: '13:00:00', flexibleHours: true },
          ],
        });

        const screen = acc as unknown as { isFlexibleDay(index: number): boolean };
        expect(acc.flexible()).toBe(true);
        expect([0, 2].every((index) => screen.isFlexibleDay(index))).toBe(true);
      });

      it('la vista previa dice flexible al martes y deja los turnos del lunes', () => {
        crear();
        buildMixedWeek();

        const preview = (
          acc as unknown as { reglasDeLaPrevia(): Record<string, unknown>[] }
        ).reglasDeLaPrevia();
        expect(preview[0]).toMatchObject({ dayOfWeek: 1, slotMinutes: 30, gapMinutes: 10 });
        expect(preview[1]).toStrictEqual({
          dayOfWeek: 2,
          startTime: '09:00',
          endTime: '13:00',
          flexibleHours: true,
        });
      });
    });

    it('cada día se enciende con su botón «Sí» y se apaga con «No»', () => {
      crear();
      const fila = fixture.nativeElement.querySelector('[data-testid="agenda-create-dia-0"]');
      expect(fila.querySelector('[role="radiogroup"]').getAttribute('aria-label')).toBe(
        '¿Atiende el lunes?',
      );
      fila.querySelector('[data-value="si"]').click();
      fixture.detectChanges();
      expect(acc.semana.at(0).getRawValue().activo).toBe(true);

      fila.querySelector('[data-value="no"]').click();
      fixture.detectChanges();
      expect(acc.semana.at(0).getRawValue().activo).toBe(false);
      expect(
        fixture.nativeElement.querySelectorAll('input[type="checkbox"]:not([role="switch"])')
          .length,
      ).toBe(0);
    });

    it('las opciones avanzadas ya no tienen casillas: son «Sí / No»', () => {
      crear(['SCHEDULING_ADMIN', 'PRACTITIONER']);
      acc.avanzadasAbiertas.set(true);
      fixture.detectChanges();

      const raiz: HTMLElement = fixture.nativeElement;
      expect(raiz.querySelectorAll('input[type="checkbox"]:not([role="switch"])').length).toBe(0);
      raiz
        .querySelector<HTMLElement>('[data-testid="agenda-create-politica"] [data-value="si"]')!
        .click();
      fixture.detectChanges();
      expect(acc.usarPolitica()).toBe(true);
      expect(raiz.querySelector('[data-testid="agenda-create-otro-recurso"]')).not.toBeNull();
    });

    it('la fecha de fin es un interruptor: encendido pide la fecha, apagado es permanente', () => {
      crear();
      const raiz: HTMLElement = fixture.nativeElement;
      const vigencia = raiz.querySelector<HTMLElement>('[data-testid="agenda-create-vigencia"]')!;
      const interruptor = vigencia.querySelector<HTMLInputElement>('input[role="switch"]')!;

      expect(interruptor.checked).toBe(false);
      expect(vigencia.textContent).toContain('Nunca cambia — horario permanente');
      expect(raiz.querySelector('app-date-picker')).toBeNull();

      interruptor.click();
      fixture.detectChanges();
      expect(acc.formGeneral.getRawValue().tieneFin).toBe('si');
      expect(vigencia.textContent).toContain('Sí, hasta una fecha');
      expect(raiz.querySelector('app-date-picker')).not.toBeNull();

      interruptor.click();
      fixture.detectChanges();
      expect(acc.formGeneral.getRawValue().tieneFin).toBe('no');
    });

    it('un horario con dos franjas el mismo día vuelve como un día con almuerzo', () => {
      crearConHorarioVigente({
        id: 'tpl-1',
        retired: false,
        name: 'Horario',
        statusConceptId: 'c',
        slotMinutes: 30,
        rules: [
          { dayOfWeek: 1, startTime: '14:00:00', endTime: '18:00:00', slotMinutes: 30 },
          { dayOfWeek: 1, startTime: '08:00:00', endTime: '12:30:00', slotMinutes: 30 },
        ],
      });

      expect(acc.semana.at(0).getRawValue()).toMatchObject({
        activo: true,
        desde: '08:00',
        hasta: '18:00',
      });
      expect(acc.conAlmuerzo()).toBe(true);
      expect(acc.almuerzoDesde()).toBe('12:30');
      expect(acc.almuerzoHasta()).toBe('14:00');
    });
  });

  /**
   * DÓNDE SE PUBLICA — el selector de organización (REQ-C2-002 y 003).
   *
   * «Mi consultorio» tiene que mandar exactamente lo de antes del selector: la
   * organización de la sesión y ninguna práctica. Otra organización manda la
   * suya, y como cada organización tiene sus propias agendas, cambiarla suelta
   * la agenda de la anterior y busca las de la nueva.
   */
  describe('la organización donde se publica', () => {
    const OLIVOS: OrganizationChoice = {
      key: 'practice-olivos',
      organization: {
        practiceId: 'practice-olivos',
        practiceSiteId: 'site-olivos',
        name: 'Clínica Los Olivos',
        isOwnOffice: false,
        tenantId: 'tenant-olivos',
      },
    };
    const OWN_OFFICE: OrganizationChoice = {
      key: OWN_OFFICE_KEY,
      organization: {
        practiceId: 'practice-own',
        practiceSiteId: 'site-own',
        name: 'Consultorio Dra. Salas',
        isOwnOffice: true,
        tenantId: null,
      },
    };

    function listResourcesOf(tenantId: string) {
      return http.expectOne(
        (r) =>
          r.method === 'GET' &&
          r.url === '/scheduling/resources' &&
          r.params.get('tenantId') === tenantId,
      );
    }

    /** Termina el creation: plantilla y cupos, para que `verify()` no encuentre nada colgado. */
    function finishPublishing(resourceId: string): void {
      http
        .expectOne(`/scheduling/resources/${resourceId}/templates`)
        .flush({ id: 'tpl-9', name: 'x', ruleCount: 1, statusConceptId: 'c' });
      http
        .expectOne('/scheduling/templates/tpl-9/generate-slots')
        .flush({ templateId: 'tpl-9', created: 1, skipped: 0 });
    }

    it('el selector va arriba de la agenda y empieza en «Mi consultorio»', () => {
      crearConHorarioVigente({ id: 'tpl-1', name: 'Horario', statusConceptId: 'c', rules: [] });
      const root: HTMLElement = fixture.nativeElement;
      const field = root.querySelector<HTMLElement>('app-organization-field');
      const scheduleHeading = Array.from(root.querySelectorAll('h2')).find(
        (heading) => heading.textContent?.trim() === '¿En qué agenda publica?',
      );

      expect(field?.querySelector('label')?.textContent?.trim()).toBe('Organización');
      expect(field?.querySelector('.select-trigger')?.textContent?.trim()).toBe('Mi consultorio');
      expect(scheduleHeading).toBeDefined();
      expect(
        field!.compareDocumentPosition(scheduleHeading!) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it('quien arma la agenda de otro recurso no elige organización', () => {
      crear(['SCHEDULING_ADMIN'], TENANT, null);

      expect(fixture.nativeElement.querySelector('app-organization-field')).toBeNull();
    });

    it('con «Mi consultorio», el recurso lleva lo de siempre: la organización de la sesión y ninguna práctica', () => {
      crear();
      acc.place.choice.set(OWN_OFFICE);
      fixture.detectChanges();
      encenderLunes();
      acc.publicar();

      const creation = http.expectOne((r) => r.method === 'POST' && r.url === '/scheduling/resources');
      expect(creation.request.body.tenantId).toBe(TENANT);
      expect(creation.request.body).not.toHaveProperty('practiceId');
      creation.flush({ id: 'res-1', name: 'x', stateConceptId: 'c' });
      finishPublishing('res-1');
    });

    it('con otra organización, busca sus agendas y el recurso lleva su organización y su práctica', () => {
      crear();
      acc.place.choice.set(OLIVOS);
      fixture.detectChanges();
      listResourcesOf('tenant-olivos').flush({ items: [], count: 0 });
      encenderLunes();
      acc.publicar();

      const creation = http.expectOne((r) => r.method === 'POST' && r.url === '/scheduling/resources');
      expect(creation.request.body).toMatchObject({
        tenantId: 'tenant-olivos',
        practiceId: 'practice-olivos',
      });
      creation.flush({ id: 'res-olivos', name: 'x', stateConceptId: 'c' });
      finishPublishing('res-olivos');
    });

    it('cambiar de organización suelta la agenda y el horario de la anterior', () => {
      crearConHorarioVigente({ id: 'tpl-1', name: 'Horario', statusConceptId: 'c', rules: [] });
      expect(acc.resourceId()).toBe('res-1');
      expect(acc.esCambio()).toBe(true);

      acc.place.choice.set(OLIVOS);
      fixture.detectChanges();

      expect(acc.resourceId()).toBeNull();
      expect(acc.esCambio()).toBe(false);
      expect(acc.misAgendas()).toEqual([]);
      listResourcesOf('tenant-olivos').flush({ items: [], count: 0 });
    });

    it('las agendas que llegan tarde de la organización anterior no pisan las de la elegida', () => {
      crear();
      acc.place.choice.set(OLIVOS);
      fixture.detectChanges();
      acc.place.choice.set(OWN_OFFICE);
      fixture.detectChanges();

      listResourcesOf('tenant-olivos').flush({
        items: [{ id: 'res-olivos', name: 'Agenda', resourceRefId: PERFIL, stateConceptId: 'c' }],
        count: 1,
      });

      expect(acc.misAgendas()).toEqual([]);
      expect(acc.resourceId()).toBeNull();
      listResourcesOf(TENANT).flush({ items: [], count: 0 });
    });

    /*
     * COMO QUÉ ORGANIZACIÓN SE HABLA — el defecto de la revisión.
     *
     * La API resuelve la organización con `X-Tenant-Id`: rechaza con 403 el
     * `tenantId` del cuerpo o de la query que no es ése (`TENANT_SCOPE_CONFLICT`)
     * y no ve el recurso de otra. El interceptor pone el de la sesión, así que
     * con otra organización elegida **cada** petición tiene que declararla —las
     * lecturas y todos los pasos de la publicación— y con «Mi consultorio»
     * ninguna: sale como siempre. Acá no corre el interceptor, así que lo que
     * se ve en el encabezado es exactamente lo que declaró la pantalla.
     */

    /** Contesta la petición que calce y devuelve la organización que declaró, o `null`. */
    function answer(
      match: Parameters<HttpTestingController['expectOne']>[0],
      body: object,
    ): string | null {
      const req = http.expectOne(match);
      req.flush(body);
      return req.request.headers.get('X-Tenant-Id');
    }

    /** Las agendas de la organización, como las contesta la API. */
    function resourcesOf(tenantId: string, ...ids: string[]): string | null {
      return answer(
        (r) =>
          r.method === 'GET' &&
          r.url === '/scheduling/resources' &&
          r.params.get('tenantId') === tenantId,
        {
          items: ids.map((id) => ({
            id,
            name: 'Agenda',
            resourceRefId: PERFIL,
            stateConceptId: 'c',
          })),
          count: ids.length,
        },
      );
    }

    /** Un horario vigente de un día: con él, publicar es un cambio y no un alta. */
    const CURRENT_SCHEDULE = {
      id: 'tpl-1',
      name: 'Horario',
      slotMinutes: 20,
      statusConceptId: 'c',
      rules: [{ dayOfWeek: 2, startTime: '15:00:00', endTime: '19:00:00', slotMinutes: 20 }],
    };

    /** Publica un alta con reglas propias: recurso, política, plantilla y cupos. */
    function publishNew(): (string | null)[] {
      encenderLunes();
      acc.usarPolitica.set(true);
      fixture.detectChanges();
      acc.publicar();
      return [
        answer('/scheduling/resources', { id: 'res-new', name: 'x', stateConceptId: 'c' }),
        answer('/scheduling/booking-policies', { id: 'pol-1', code: 'X', stateConceptId: 'c' }),
        answer('/scheduling/resources/res-new/templates', {
          id: 'tpl-9',
          name: 'x',
          ruleCount: 1,
          statusConceptId: 'c',
        }),
        answer('/scheduling/templates/tpl-9/generate-slots', {
          templateId: 'tpl-9',
          created: 1,
          skipped: 0,
        }),
      ];
    }

    /** Contesta la petición que calce con un error del servidor. */
    function failWith500(match: Parameters<HttpTestingController['expectOne']>[0]): void {
      http
        .expectOne(match)
        .flush({ code: 'INTERNAL', message: 'x' }, { status: 500, statusText: 'Server Error' });
    }

    /** La vista previa sin citas y el retiro de un horario; lo que declaró cada uno. */
    async function retireCurrent(templateId: string): Promise<(string | null)[]> {
      const preview = answer(`/scheduling/templates/${templateId}/live-bookings`, {
        templateId,
        total: 0,
        bookings: [],
        present: [],
      });
      // La decisión sobre las citas vivas se toma en una promesa: el DELETE sale un tick después.
      await new Promise((resolve) => setTimeout(resolve, 0));
      return [
        preview,
        answer(`/scheduling/templates/${templateId}`, {
          id: templateId,
          statusConceptId: 'archived',
          releasedSlots: 0,
          keptSlots: 0,
          liveBookings: 0,
          liveBookingIds: [],
          truncated: false,
          cancelledBookings: 0,
        }),
      ];
    }

    /** Publica un cambio sobre el horario vigente: vista previa, retiro, plantilla y cupos. */
    async function publishChange(
      resourceId: string,
      templateId = CURRENT_SCHEDULE.id,
    ): Promise<(string | null)[]> {
      acc.publicar();
      return [
        ...(await retireCurrent(templateId)),
        answer(`/scheduling/resources/${resourceId}/templates`, {
          id: 'tpl-9',
          name: 'x',
          ruleCount: 1,
          statusConceptId: 'c',
        }),
        answer('/scheduling/templates/tpl-9/generate-slots', {
          templateId: 'tpl-9',
          created: 1,
          skipped: 0,
        }),
      ];
    }

    it('con otra organización, buscar sus agendas y cada paso de un alta hablan como ella', () => {
      crear();
      acc.place.choice.set(OLIVOS);
      fixture.detectChanges();

      const declared = [resourcesOf('tenant-olivos'), ...publishNew()];

      expect(declared).toEqual(Array(5).fill('tenant-olivos'));
    });

    it('con otra organización, leer su horario vigente y cambiarlo hablan como ella', async () => {
      crear();
      acc.place.choice.set(OLIVOS);
      fixture.detectChanges();
      const reading = [
        resourcesOf('tenant-olivos', 'res-olivos'),
        answer('/scheduling/resources/res-olivos/templates', {
          items: [CURRENT_SCHEDULE],
          count: 1,
        }),
      ];
      fixture.detectChanges();
      expect(acc.esCambio()).toBe(true);

      const declared = [...reading, ...(await publishChange('res-olivos'))];

      expect(declared).toEqual(Array(6).fill('tenant-olivos'));
    });

    it('con «Mi consultorio», ningún paso de un alta declara organización', () => {
      crear();
      acc.place.choice.set(OWN_OFFICE);
      fixture.detectChanges();

      expect(publishNew()).toEqual([null, null, null, null]);
    });

    it('al volver a «Mi consultorio», leer y cambiar el horario ya no declaran organización', async () => {
      crear();
      acc.place.choice.set(OLIVOS);
      fixture.detectChanges();
      resourcesOf('tenant-olivos');
      acc.place.choice.set(OWN_OFFICE);
      fixture.detectChanges();
      const reading = [
        resourcesOf(TENANT, 'res-1'),
        answer('/scheduling/resources/res-1/templates', { items: [CURRENT_SCHEDULE], count: 1 }),
      ];
      fixture.detectChanges();
      expect(acc.esCambio()).toBe(true);

      const declared = [...reading, ...(await publishChange('res-1'))];

      expect(declared).toEqual(Array(6).fill(null));
    });

    /*
     * LO QUE EL INTENTO YA HIZO no viaja a otra organización ni a otra agenda.
     *
     * Reintentar tras un fallo posterior al retiro no vuelve a retirar; pero el
     * retiro hecho en una agenda no dice nada del horario de otra. Si se
     * arrastrara, publicar en la nueva saltearía su retiro y dejaría dos
     * horarios vigentes sobre la misma agenda.
     */

    it('si falla después del retiro y cambia de organización, en la nueva se retira su horario', async () => {
      crearConHorarioVigente(CURRENT_SCHEDULE);
      acc.publicar();
      await retireCurrent('tpl-1');
      failWith500('/scheduling/resources/res-1/templates');
      fixture.detectChanges();

      acc.place.choice.set(OLIVOS);
      fixture.detectChanges();
      resourcesOf('tenant-olivos', 'res-olivos');
      answer('/scheduling/resources/res-olivos/templates', {
        items: [{ ...CURRENT_SCHEDULE, id: 'tpl-olivos' }],
        count: 1,
      });
      fixture.detectChanges();

      // Espera la vista previa y el DELETE del horario de Olivos antes de la plantilla nueva.
      const declared = await publishChange('res-olivos', 'tpl-olivos');

      expect(declared).toEqual(Array(4).fill('tenant-olivos'));
    });

    it('si falla después de crear la plantilla y elige otra agenda, en ésa se retira su horario y se crea uno', async () => {
      crear();
      acc.place.choice.set(OLIVOS);
      fixture.detectChanges();
      resourcesOf('tenant-olivos', 'res-a', 'res-b');
      answer('/scheduling/resources/res-a/templates', {
        items: [{ ...CURRENT_SCHEDULE, id: 'tpl-a' }],
        count: 1,
      });
      fixture.detectChanges();
      acc.publicar();
      await retireCurrent('tpl-a');
      answer('/scheduling/resources/res-a/templates', {
        id: 'tpl-new-a',
        name: 'x',
        ruleCount: 1,
        statusConceptId: 'c',
      });
      failWith500('/scheduling/templates/tpl-new-a/generate-slots');
      fixture.detectChanges();

      acc.elegirSede('res-b');
      answer('/scheduling/resources/res-b/templates', {
        items: [{ ...CURRENT_SCHEDULE, id: 'tpl-b' }],
        count: 1,
      });
      fixture.detectChanges();

      // Ni el retiro de «res-a» ni su plantilla valen para «res-b»: se retira la suya y se crea otra.
      await publishChange('res-b', 'tpl-b');
    });

    it('mientras se publica no se puede cambiar de organización; si falla, sí', () => {
      crear();
      encenderLunes();
      const group: HTMLFieldSetElement = fixture.nativeElement
        .querySelector('app-organization-field')
        .closest('fieldset');
      expect(group.disabled).toBe(false);

      acc.publicar();
      fixture.detectChanges();
      expect(group.disabled).toBe(true);

      failWith500('/scheduling/resources');
      fixture.detectChanges();
      expect(group.disabled).toBe(false);

      acc.publicar();
      fixture.detectChanges();
      expect(group.disabled).toBe(true);
      answer('/scheduling/resources', { id: 'res-new', name: 'x', stateConceptId: 'c' });
      answer('/scheduling/resources/res-new/templates', {
        id: 'tpl-9',
        name: 'x',
        ruleCount: 1,
        statusConceptId: 'c',
      });
      answer('/scheduling/templates/tpl-9/generate-slots', {
        templateId: 'tpl-9',
        created: 1,
        skipped: 0,
      });
      fixture.detectChanges();
      // Publicada, la pantalla pasa al aviso de éxito: el selector ya no está.
      expect(fixture.nativeElement.querySelector('app-organization-field')).toBeNull();
    });
  });

  /* -- «Opciones avanzadas», con el patrón del sistema (REQ-C2-007) -------- */

  it('«Opciones avanzadas» es una row que dice si está abierta y qué abre', () => {
    crear();
    const root: HTMLElement = fixture.nativeElement;
    const row = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.trim() === 'Opciones avanzadas',
    )!;

    expect(row.getAttribute('aria-expanded')).toBe('false');
    expect(root.textContent).not.toContain('Zona horaria');

    row.click();
    fixture.detectChanges();

    expect(row.getAttribute('aria-expanded')).toBe('true');
    expect(acc.avanzadasAbiertas()).toBe(true);
    const region = root.querySelector<HTMLElement>(`#${row.getAttribute('aria-controls')}`);
    expect(region?.textContent).toContain('Zona horaria');

    row.click();
    fixture.detectChanges();
    expect(row.getAttribute('aria-expanded')).toBe('false');
  });

  /**
   * LA LECTURA QUE SE TRAGABA.
   *
   * Si leer las agendas fallaba, el error se descartaba y el formulario quedaba
   * en blanco «para no arruinar el alta». No era inocuo: sin las agendas leídas
   * no hay `resourceId`, y publicar CREA una agenda nueva en vez de editar la
   * que ya existía, duplicándola ante los pacientes.
   */
  describe('si no se pueden leer las agendas', () => {
    function crearConLecturaCaida(): void {
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
      http
        .expectOne((r) => r.url === '/scheduling/resources')
        .flush({ message: 'caído' }, { status: 500, statusText: 'Server Error' });
      fixture.detectChanges();
    }

    it('se dice, y publicar no crea una agenda duplicada', () => {
      crearConLecturaCaida();
      const aviso = (fixture.nativeElement as HTMLElement).querySelector(
        '[data-testid="agenda-create-error-lectura"]',
      );
      expect(aviso).not.toBeNull();

      encenderLunes();
      acc.publicar();

      http.expectNone('/scheduling/resources');
    });

    it('«Reintentar» vuelve a leer y, si anda, deja publicar', () => {
      crearConLecturaCaida();
      (fixture.componentInstance as unknown as { reintentarLectura(): void }).reintentarLectura();

      http
        .expectOne((r) => r.url === '/scheduling/resources')
        .flush({
          items: [{ id: 'res-1', name: 'Agenda', resourceRefId: PERFIL, stateConceptId: 'c' }],
          count: 1,
        });
      http.expectOne('/scheduling/resources/res-1/templates').flush({ items: [], count: 0 });
      fixture.detectChanges();

      expect(
        (fixture.nativeElement as HTMLElement).querySelector('[data-testid="agenda-create-error-lectura"]'),
      ).toBeNull();
      expect(acc.resourceId()).toBe('res-1');
    });

    it('con una sola agenda se ofrece el bloque (ahí vive «crear otra»), con cero no', () => {
      crear();
      expect(acc.eligeSede()).toBe(false);
    });
  });
});
