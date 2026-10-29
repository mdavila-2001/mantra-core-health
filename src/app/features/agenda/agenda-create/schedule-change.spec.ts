import { HttpHeaders, provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { signal, type Signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import {
  cupos,
  plantillas,
  RECURSO_MEDICA,
  type CupoSimulado,
  type PlantillaSimulada,
} from '../../../core/mock/fixtures/agenda';
import { registrarAgenda } from '../../../core/mock/handlers/scheduling.handlers';
import { isMockReply, MockRouter, type MockMethod } from '../../../core/mock/mock-router';
import { buscarUsuario, TENANT_CONSULTORIO } from '../../../core/mock/mock-session';
import type { Coleccion } from '../../../core/mock/mock-store';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { DialogService } from '@shared/components/molecules/dialog/dialog-service';
import { environment } from '../../../../environments/environment';
import { AgendaCreate } from './agenda-create';

/** Lo que la secuencia necesita mover y leer de la pantalla. */
interface ScheduleChangeScreen {
  readonly vigente: Signal<{ readonly id: string; readonly name: string } | null>;
  readonly resourceId: Signal<string | null>;
  readonly publicado: Signal<boolean>;
  fijarDeLaFila(indice: number, campo: string, valor: unknown): void;
  publicar(): void;
}

/** Una plantilla como la lista el simulador: sin `resourceId`, que es la ruta. */
type ListedTemplate = Omit<PlantillaSimulada, 'resourceId'>;

type FlushBody = Parameters<TestRequest['flush']>[0];

const MORNINGS = 'Mañanas en la clínica';
const STUDIES = 'Estudios en la clínica';
const PAST_SATURDAYS = 'Sábados (temporada pasada)';

/** El jueves de la tabla (`DIAS`, de lunes a domingo). */
const THURSDAY_INDEX = 3;

/** El aviso del retiro cuando hay alguien ya recibido: confirmarlo retira conservando las citas. */
const PATIENT_PRESENT_TITLE = 'Hay un paciente ya recibido';

/** Vueltas de «pedir y contestar» antes de dar la secuencia por colgada. */
const MAX_ROUNDS = 40;

/**
 * Deja una tabla del simulador como estaba, filas y orden.
 *
 * El corredor comparte los módulos entre archivos de prueba (`isolate: false`
 * en `@angular/build`): la agenda de la médica que este archivo cambia es la
 * misma que leen los demás. El orden también cuenta, porque es el del listado
 * de plantillas.
 */
function restoreTable<T extends { readonly id: string }>(
  table: Coleccion<T>,
  rows: readonly T[],
): void {
  for (const row of table.todos()) table.borrar(row.id);
  for (const row of rows) table.agregar(row);
}

/**
 * Cambiar el horario de «Mañanas en la clínica» y guardarlo, contra el
 * simulador de agenda entero (`registrarAgenda`) y no contra respuestas armadas
 * a mano: cada petición de la pantalla la contesta el mismo manejador que
 * contesta en la maqueta.
 *
 * La médica del simulador tiene en su agenda dos horarios vivos —«Mañanas en la
 * clínica», de lunes a sábado, y «Estudios en la clínica», martes y jueves de
 * tarde— y uno ya retirado. La pantalla abre uno solo para cambiarlo. Guardar
 * tiene que retirar **ése** y ningún otro, y el horario guardado tiene que
 * quedar vivo al lado del que no se tocó.
 *
 * Es la secuencia de la verificación en la maqueta: lunes a sábado de 8 a 12,
 * con el jueves en «Otros servicios».
 */
describe('AgendaCreate · cambiar «Mañanas en la clínica» contra el simulador', () => {
  const simulator = new MockRouter();
  registrarAgenda(simulator);
  const doctor = buscarUsuario('medica')!;

  let fixture: ComponentFixture<AgendaCreate>;
  let http: HttpTestingController;
  /** Cada petición contestada, como `MÉTODO /ruta`. */
  let served: string[];
  /** Los títulos de los diálogos que la pantalla pidió, en orden. */
  let asked: string[];
  /** Lo que guardar cambia en el simulador: las plantillas y los cupos que suelta y genera. */
  let templatesBefore: PlantillaSimulada[];
  let slotsBefore: CupoSimulado[];

  /**
   * Conservar las citas en el retiro —con un paciente ya recibido es la única
   * salida, y sin él es «Conservar las citas»— y quedarse en la pantalla al
   * terminar.
   */
  const dialogs = {
    confirm: (config: { readonly title: string }) => {
      asked.push(config.title);
      return Promise.resolve(config.title === PATIENT_PRESENT_TITLE);
    },
  };

  const mockBackendBefore = environment.mockBackend;
  beforeAll(() => Object.assign(environment, { mockBackend: true }));
  afterAll(() => Object.assign(environment, { mockBackend: mockBackendBefore }));

  beforeEach(() => {
    served = [];
    asked = [];
    templatesBefore = structuredClone(plantillas.todos());
    slotsBefore = structuredClone(cupos.todos());
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'schedule', children: [] }]),
        {
          provide: AuthService,
          useValue: {
            roles: signal<readonly string[]>(doctor.roles),
            activeTenantId: signal<string | null>(TENANT_CONSULTORIO),
            practitionerProfileId: signal<string | null>(doctor.practitionerProfileId ?? null),
            displayName: signal<string | null>(doctor.displayName),
          },
        },
        { provide: NavigationService, useValue: { breadcrumbs: signal([]) } },
        { provide: DialogService, useValue: dialogs },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    restoreTable(plantillas, templatesBefore);
    restoreTable(cupos, slotsBefore);
    http.verify();
  });

  function openScreen(): ScheduleChangeScreen {
    fixture = TestBed.createComponent(AgendaCreate);
    return fixture.componentInstance as unknown as ScheduleChangeScreen;
  }

  /** Contesta una petición con el manejador del simulador, como lo haría la maqueta. */
  function serve(request: TestRequest): void {
    const { method, url, params, body } = request.request;
    const path = new URL(url, 'http://simulator.test').pathname;
    const match = simulator.match(method as MockMethod, path);
    if (match === null) throw new Error(`El simulador no atiende ${method} ${path}`);
    const result = match.handler({
      method: method as MockMethod,
      path,
      params: match.params,
      query: new URLSearchParams(params.toString()),
      body,
      headers: new HttpHeaders(),
      user: doctor,
    });
    const reply = isMockReply(result) ? result : { status: 200, body: result };
    served.push(`${method} ${path}`);
    request.flush(structuredClone(reply.body ?? null) as FlushBody, {
      status: reply.status,
      statusText: 'Simulador',
    });
  }

  /**
   * Contesta todo lo que la pantalla pida hasta que deje de pedir.
   *
   * Entre vuelta y vuelta se cede un turno: el retiro decide con un diálogo, que
   * es una promesa, y su `DELETE` sale recién después.
   */
  async function settle(): Promise<void> {
    let quietRounds = 0;
    for (let round = 0; round < MAX_ROUNDS && quietRounds < 2; round++) {
      fixture.detectChanges();
      const pending = http.match(() => true);
      pending.forEach(serve);
      quietRounds = pending.length === 0 ? quietRounds + 1 : 0;
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    if (quietRounds < 2) throw new Error('La pantalla siguió pidiendo después de la última vuelta');
  }

  /** Las plantillas de la agenda, como las lee la pantalla. */
  function templatesOf(resourceId: string): readonly ListedTemplate[] {
    const path = `/scheduling/resources/${resourceId}/templates`;
    const match = simulator.match('GET', path)!;
    const page = match.handler({
      method: 'GET',
      path,
      params: match.params,
      query: new URLSearchParams(),
      body: null,
      headers: new HttpHeaders(),
      user: doctor,
    }) as { readonly items: readonly ListedTemplate[] };
    return page.items;
  }

  function named(templates: readonly ListedTemplate[], name: string): ListedTemplate {
    const template = templates.find((candidate) => candidate.name === name);
    if (template === undefined) throw new Error(`La agenda no tiene «${name}»`);
    return template;
  }

  it('guardar retira «Mañanas en la clínica» y ninguna otra; la nueva y «Estudios en la clínica» quedan vivas', async () => {
    const before = templatesOf(RECURSO_MEDICA);
    const mornings = named(before, MORNINGS);
    const studies = named(before, STUDIES);
    expect(mornings.retired).toBe(false);
    expect(studies.retired).toBe(false);
    expect(named(before, PAST_SATURDAYS).retired).toBe(true);

    const screen = openScreen();
    await settle();

    // Abre para cambiar «Mañanas en la clínica», la primera de su agenda.
    expect(screen.resourceId()).toBe(RECURSO_MEDICA);
    expect(screen.vigente()?.id).toBe(mornings.id);

    screen.fijarDeLaFila(THURSDAY_INDEX, 'modo', 'SERVICES');
    screen.publicar();
    await settle();

    expect(screen.publicado()).toBe(true);
    expect(asked.at(-1)).toBe('Listo, su horario quedó cambiado');
    // Se retira exactamente el horario que se estaba cambiando.
    expect(served.filter((line) => line.startsWith('DELETE '))).toEqual([
      `DELETE /scheduling/templates/${mornings.id}`,
    ]);

    const after = templatesOf(RECURSO_MEDICA);
    const created = after.filter((template) => !before.some((old) => old.id === template.id));
    expect(created).toHaveLength(1);
    const saved = created[0]!;

    expect(named(after, MORNINGS).retired).toBe(true);
    expect(named(after, PAST_SATURDAYS).retired).toBe(true);
    // «Estudios en la clínica» no se tocó: sigue viva y con sus mismas franjas.
    expect(named(after, STUDIES)).toEqual(studies);

    // El horario guardado está vivo: lunes a sábado de 8 a 12, el jueves solo servicios.
    expect(saved.retired).toBe(false);
    expect(saved.rules.map((rule) => rule.dayOfWeek)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(
      saved.rules.every((rule) => rule.startTime === '08:00' && rule.endTime === '12:00'),
    ).toBe(true);
    expect(saved.rules.find((rule) => rule.dayOfWeek === 4)?.bookingMode).toBe('SERVICES');
    expect(after.filter((template) => !template.retired).map((template) => template.id)).toEqual(
      expect.arrayContaining([studies.id, saved.id]),
    );
  });
});
