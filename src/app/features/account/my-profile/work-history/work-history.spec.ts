import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';

import { AuthService } from '../../../../core/auth/auth.service';
import { WorkHistory } from './work-history';

const AFILIACIONES = '/profiles/practitioners/me/affiliations';

/** Una afiliación tal como llega por el cable. */
const enCable = (over: Record<string, unknown> = {}) => ({
  id: 'af-1',
  practitionerProfileId: 'prac-1',
  organizationName: 'Hospital Obrero N.º 1',
  roleTitle: 'Médico de planta',
  departmentText: 'Cardiología',
  practiceSiteId: null,
  affiliationTypeConceptId: 'c-1',
  startDate: '2020-03-01',
  endDate: null,
  current: true,
  status: 'c-activo',
  createdAt: '2026-08-14T12:00:00.000Z',
  ...over,
});

/**
 * Monta el bloque con o sin perfil profesional en la sesión.
 *
 * El claim decide si el bloque **se dibuja**, así que es lo primero que hay que
 * poder controlar: preguntárselo al backend significaría pintar y despintar una
 * sección del perfil.
 */
async function montar(practitionerProfileId: string | null) {
  await TestBed.configureTestingModule({
    imports: [WorkHistory],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      {
        provide: AuthService,
        useValue: { practitionerProfileId: signal(practitionerProfileId) },
      },
    ],
  }).compileComponents();

  const fixture: ComponentFixture<WorkHistory> = TestBed.createComponent(WorkHistory);
  fixture.detectChanges();
  return { fixture, http: TestBed.inject(HttpTestingController) };
}

/**
 * Los miembros protegidos del componente, para poder hablar de lo que hace sin
 * pasar por el DOM en cada aserción.
 */
function api(fixture: ComponentFixture<WorkHistory>): Record<string, UnMiembro> {
  return fixture.componentInstance as unknown as Record<string, UnMiembro>;
}

/**
 * Una señal, una computada o un método del componente.
 *
 * `set` acepta `string | Date | null` porque es lo que llevan las señales del
 * formulario, y declararlo así evita un `as` por cada campo que una prueba
 * siembra.
 */
interface UnMiembro {
  (...args: never[]): unknown;
  set(valor: string | Date | null): void;
}

describe('WorkHistory', () => {
  afterEach(() => TestBed.resetTestingModule());

  /**
   * Una cuenta de paciente no tiene historial laboral que mostrar. El bloque no
   * pide nada y no dibuja nada: contarle a un paciente el `403` de un endpoint
   * de profesionales sería contarle un problema que no tiene.
   */
  it('no pide nada cuando la sesión no tiene perfil profesional', async () => {
    const { fixture, http } = await montar(null);

    http.expectNone(AFILIACIONES);
    expect(fixture.nativeElement.textContent).not.toContain('Historial laboral');

    http.verify();
  });

  it('pide el historial propio sin ningún identificador', async () => {
    const { http } = await montar('prac-1');

    const req = http.expectOne(AFILIACIONES);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual([]);
    req.flush({ items: [], count: 0 });

    // Los consultorios van por su lado: atar la afiliación a una sede es
    // opcional y su fallo no puede llevarse el formulario.
    http.expectOne('/practitioners/prac-1/sites').flush({ items: [], count: 0 });
    http.verify();
  });

  it('muestra el vínculo con su institución, cargo y período', async () => {
    const { fixture, http } = await montar('prac-1');

    http.expectOne(AFILIACIONES).flush({ items: [enCable()], count: 1 });
    http.expectOne('/practitioners/prac-1/sites').flush({ items: [], count: 0 });
    fixture.detectChanges();

    const texto: string = fixture.nativeElement.textContent;
    expect(texto).toContain('Hospital Obrero N.º 1');
    expect(texto).toContain('Médico de planta');
    // Sin fin declarado, el vínculo sigue vigente y la lista lo dice con esa
    // palabra en vez de dejar el guion colgando.
    expect(texto).toContain('actualidad');

    http.verify();
  });

  it('sigue ofreciendo el formulario aunque la lectura del historial falle', async () => {
    const { fixture, http } = await montar('prac-1');

    http.expectOne(AFILIACIONES).flush('boom', { status: 500, statusText: 'Server Error' });
    http.expectOne('/practitioners/prac-1/sites').flush({ items: [], count: 0 });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Agregar un vínculo');

    http.verify();
  });

  it('envía la fecha local como YYYY-MM-DD y omite lo opcional vacío', async () => {
    const { fixture, http } = await montar('prac-1');

    http.expectOne(AFILIACIONES).flush({ items: [], count: 0 });
    http.expectOne('/practitioners/prac-1/sites').flush({ items: [], count: 0 });

    const componente = api(fixture);
    componente['institucion'].set('  Clínica del Sur  ');
    componente['cargo'].set('Jefe de guardia');
    // 1 de marzo local. Con `toISOString()` viajaría como 28 de febrero en
    // cualquier huso al oeste de Greenwich.
    componente['desde'].set(new Date(2021, 2, 1));
    fixture.detectChanges();

    componente['registrar']();

    const req = http.expectOne((r) => r.url === AFILIACIONES && r.method === 'POST');
    expect(req.request.body).toEqual({
      organizationName: 'Clínica del Sur',
      roleTitle: 'Jefe de guardia',
      startDate: '2021-03-01',
    });

    req.flush(enCable({ id: 'af-2' }));
    http.expectOne(AFILIACIONES).flush({ items: [], count: 0 });
    http.verify();
  });

  it('no deja enviar un período que termina antes de empezar', async () => {
    const { fixture, http } = await montar('prac-1');

    http.expectOne(AFILIACIONES).flush({ items: [], count: 0 });
    http.expectOne('/practitioners/prac-1/sites').flush({ items: [], count: 0 });

    const componente = api(fixture);
    componente['institucion'].set('Clínica del Sur');
    componente['cargo'].set('Jefe de guardia');
    componente['desde'].set(new Date(2024, 0, 1));
    componente['hasta'].set(new Date(2023, 0, 1));
    fixture.detectChanges();

    expect(componente['periodoInvertido']()).toBe(true);
    expect(componente['puedeRegistrar']()).toBe(false);

    componente['registrar']();
    http.expectNone((r) => r.method === 'POST');
    http.verify();
  });

  /**
   * El `409` es el historial negándose a decir dos veces lo mismo, no un fallo
   * del sistema. Se cuenta como aviso y no en rojo, o le enseñaría a quien
   * escribe que la aplicación se rompe cuando en realidad lo está protegiendo.
   */
  it('cuenta el duplicado como aviso y no como error', async () => {
    const { fixture, http } = await montar('prac-1');

    http.expectOne(AFILIACIONES).flush({ items: [], count: 0 });
    http.expectOne('/practitioners/prac-1/sites').flush({ items: [], count: 0 });

    const componente = api(fixture);
    componente['institucion'].set('Hospital Obrero N.º 1');
    componente['cargo'].set('Médico de planta');
    componente['desde'].set(new Date(2020, 2, 1));
    fixture.detectChanges();

    componente['registrar']();

    http.expectOne((r) => r.url === AFILIACIONES && r.method === 'POST').flush(
      { code: 'CONFLICT', message: 'Ese vínculo ya está en el historial laboral' },
      { status: 409, statusText: 'Conflict' },
    );
    fixture.detectChanges();

    expect(componente['avisoDeDuplicado']()).not.toBeNull();
    expect(componente['errorDelRegistro']()).toBeNull();

    http.verify();
  });

  /* ---- layout="timeline" (embebido en la pestaña Trayectoria) ------------ */

  it('en layout="timeline" no dibuja su propio listado, sólo el formulario', async () => {
    const { fixture, http } = await montar('prac-1');
    fixture.componentRef.setInput('layout', 'timeline');

    http.expectOne(AFILIACIONES).flush({ items: [enCable()], count: 1 });
    http.expectOne('/practitioners/prac-1/sites').flush({ items: [], count: 0 });
    fixture.detectChanges();

    const texto: string = fixture.nativeElement.textContent;
    expect(texto).not.toContain('Historial laboral');
    expect(texto).not.toContain('Hospital Obrero N.º 1');
    expect(texto).toContain('Agregar un vínculo');

    http.verify();
  });

  it('en layout="flat" (por defecto) sigue dibujando su propio listado', async () => {
    const { fixture, http } = await montar('prac-1');

    http.expectOne(AFILIACIONES).flush({ items: [enCable()], count: 1 });
    http.expectOne('/practitioners/prac-1/sites').flush({ items: [], count: 0 });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Historial laboral');

    http.verify();
  });

  it('emite `added` tras un alta exitosa', async () => {
    const { fixture, http } = await montar('prac-1');

    http.expectOne(AFILIACIONES).flush({ items: [], count: 0 });
    http.expectOne('/practitioners/prac-1/sites').flush({ items: [], count: 0 });

    let emitido = false;
    fixture.componentInstance.added.subscribe(() => (emitido = true));

    const componente = api(fixture);
    componente['institucion'].set('Clínica del Sur');
    componente['cargo'].set('Jefe de guardia');
    componente['desde'].set(new Date(2021, 2, 1));
    fixture.detectChanges();
    componente['registrar']();

    http
      .expectOne((r) => r.url === AFILIACIONES && r.method === 'POST')
      .flush(enCable({ id: 'af-2' }));
    http.expectOne(AFILIACIONES).flush({ items: [], count: 0 });

    expect(emitido).toBe(true);
    http.verify();
  });
});
