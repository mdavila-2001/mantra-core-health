import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, DeferBlockBehavior, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';

import { of } from 'rxjs';

import { AuthService } from '../../../../core/auth/auth.service';
import { maybeDateOnly } from '../../../../core/data-access/wire';
import { BoMunicipalitiesCatalog } from '../../../../core/data-access/terminology/bo-municipalities.service';
import type { RamaDepartamento } from '../../../../core/data-access/terminology/bo-municipalities.service';
import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import { WorkHistory } from './work-history';
import type { ReferenceOption } from '../../../../shared/components/molecules/reference-combobox/reference-combobox.types';

const AFILIACIONES = '/profiles/practitioners/me/affiliations';
const PADRON = '/profiles/practitioners/me/linkable-organizations';

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
  statusKind: 'aprobado',
  decisionReasonText: null,
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
  (...args: readonly (string | Date | null)[]): unknown;
  set(valor: unknown): void;
}

/**
 * Lee una señal o computada del componente con el tipo que se espera.
 *
 * Invocar un `UnMiembro` devuelve `unknown` —que es lo correcto: el helper no
 * sabe qué guarda cada señal—, así que el tipo se declara acá, en la prueba que
 * sí lo sabe, en vez de aflojar el helper para todas.
 */
function leer<T>(componente: Record<string, UnMiembro>, nombre: string): T {
  return componente[nombre]() as T;
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
    componente['escribirAMano']();
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
    componente['escribirAMano']();
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
    componente['escribirAMano']();
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
    componente['escribirAMano']();
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

  describe('elegir la institucion del padron', () => {
    /** Un establecimiento tal como lo devuelve el buscador. */
    const delPadron = (over: Record<string, unknown> = {}) => ({
      facilityConceptId: 'fac-1',
      code: 'BO_EST_CLINICA_FOIANINI',
      name: 'CLINICA FOIANINI',
      municipality: 'SANTA CRUZ DE LA SIERRA',
      type: 'CLINICA_PRIVADA',
      address: 'Av. Irala # 468',
      ...over,
    });

    /** Monta el bloque con las dos lecturas de arranque ya resueltas. */
    async function listo() {
      const montado = await montar('prac-1');
      montado.http.expectOne(AFILIACIONES).flush({ items: [], count: 0 });
      montado.http.expectOne('/practitioners/prac-1/sites').flush({ items: [], count: 0 });
      return montado;
    }

    it('guarda el nombre CANONICO del padron, no lo que se tecleo', async () => {
      // Es todo el punto de haber elegido en vez de escrito: si se guardara el
      // texto tecleado, «CLINICA FOIANINI» y «Clinica Foianini» volverían a ser
      // dos instituciones distintas.
      const { fixture, http } = await listo();
      const componente = api(fixture);

      componente['buscarEnPadron']('foia');
      http.expectOne((r) => r.url === PADRON).flush({
        items: [delPadron()],
        count: 1,
        limit: 20,
      });
      componente['establecimiento'].set(
        leer<readonly ReferenceOption[]>(componente, 'resultados')[0],
      );
      componente['cargo'].set('Cardióloga');
      componente['desde'].set(new Date(2021, 2, 1));
      fixture.detectChanges();

      componente['registrar']();

      const req = http.expectOne((r) => r.url === AFILIACIONES && r.method === 'POST');
      expect(req.request.body.organizationName).toBe('CLINICA FOIANINI');

      req.flush(enCable({ id: 'af-2' }));
      http.expectOne(AFILIACIONES).flush({ items: [], count: 0 });
      http.verify();
    });

    it('el municipio va en la pista, nunca dentro del nombre', async () => {
      // El rótulo es lo que se guarda: pegarle « · WARNES» dejaría el municipio
      // escrito dentro del nombre de la institución. Pero sin mostrarlo, los
      // cuatro «SAN LUIS» del padrón son indistinguibles.
      const { fixture, http } = await listo();
      const componente = api(fixture);

      componente['buscarEnPadron']('san luis');
      http.expectOne((r) => r.url === PADRON).flush({
        items: [delPadron({ name: 'SAN LUIS', municipality: 'EL TORNO', address: null })],
        count: 1,
        limit: 20,
      });

      const opcion = leer<readonly ReferenceOption[]>(componente, 'resultados')[0];
      expect(opcion.label).toBe('SAN LUIS');
      expect(opcion.hint).toBe('EL TORNO');
      http.verify();
    });

    it('no consulta el padron con el campo vacio', async () => {
      // Escribir y borrar no debería disparar una consulta que devolvería el
      // padrón entero para no mostrarlo.
      const { fixture, http } = await listo();

      api(fixture)['buscarEnPadron']('   ');

      http.verify();
    });

    it('un fallo del buscador no rompe el alta: queda el texto libre', async () => {
      const { fixture, http } = await listo();
      const componente = api(fixture);

      componente['buscarEnPadron']('foia');
      http.expectOne((r) => r.url === PADRON).error(new ProgressEvent('error'));

      expect(leer(componente, 'resultados')).toEqual([]);
      expect(leer(componente, 'buscandoEnPadron')).toBe(false);
      http.verify();
    });

    it('pasar a texto libre descarta lo elegido del padron', async () => {
      // Quedarse con un establecimiento elegido y además un nombre tecleado
      // serían dos respuestas a la misma pregunta.
      const { fixture, http } = await listo();
      const componente = api(fixture);

      componente['buscarEnPadron']('foia');
      http.expectOne((r) => r.url === PADRON).flush({
        items: [delPadron()],
        count: 1,
        limit: 20,
      });
      componente['establecimiento'].set(
        leer<readonly ReferenceOption[]>(componente, 'resultados')[0],
      );

      componente['escribirAMano']();

      expect(leer(componente, 'establecimiento')).toBeNull();
      expect(leer(componente, 'nombreDeLaInstitucion')).toBe('');
      http.verify();
    });

    it('sin elegir nada del padron no deja registrar', async () => {
      const { fixture, http } = await listo();
      const componente = api(fixture);

      componente['cargo'].set('Cardióloga');
      componente['desde'].set(new Date(2021, 2, 1));
      fixture.detectChanges();

      expect(leer(componente, 'puedeRegistrar')).toBe(false);
      http.verify();
    });
  });


  describe('el medico ve en que quedo su tramite', () => {
    /** Monta el bloque con un historial de una sola afiliación. */
    async function conHistorial(over: Record<string, unknown>) {
      const montado = await montar('prac-1');
      montado.http.expectOne(AFILIACIONES).flush({ items: [enCable(over)], count: 1 });
      montado.http.expectOne('/practitioners/prac-1/sites').flush({ items: [], count: 0 });
      montado.fixture.detectChanges();
      return montado;
    }

    it('avisa que esta esperando aprobacion, y que eso frena publicar', async () => {
      // Es el único lugar donde el médico puede mirar el trámite que él inició.
      // Sin esto pide el vínculo y no se entera de nada.
      const { fixture, http } = await conHistorial({
        statusKind: 'pendiente',
        practiceSiteId: 'sede-1',
      });

      expect(fixture.nativeElement.textContent).toContain('Esperando que la organización te acepte');
      expect(fixture.nativeElement.textContent).toContain('no vas a poder publicar agenda');
      http.verify();
    });

    it('avisa el rechazo sin dejarlo sin salida', async () => {
      const { fixture, http } = await conHistorial({ statusKind: 'rechazado' });

      expect(fixture.nativeElement.textContent).toContain('no aceptó este vínculo');
      expect(fixture.nativeElement.textContent).toContain('hablá con ellos');
      http.verify();
    });

    it('un vinculo aprobado no anuncia nada', async () => {
      // Lo esperable no se avisa: un cartel en cada línea vuelve ruido la lista
      // y esconde justamente el que importa.
      const { fixture, http } = await conHistorial({ statusKind: 'aprobado' });

      expect(fixture.nativeElement.textContent).not.toContain('Esperando');
      expect(fixture.nativeElement.textContent).not.toContain('no aceptó');
      http.verify();
    });

    it('un vinculo DECLARADO se cuenta, sin pintarlo como problema', async () => {
      // El médico PUEDE publicar con un vínculo declarado. Lo que se le dice es
      // por qué su ficha no lleva el sello de la institución, para que no lo lea
      // como un trámite trabado.
      const { fixture, http } = await conHistorial({ statusKind: 'declarado' });

      expect(fixture.nativeElement.textContent).toContain('Declarado por vos');
      expect(fixture.nativeElement.textContent).toContain('no lleva su sello');
      expect(fixture.nativeElement.textContent).not.toContain('Esperando');
      http.verify();
    });

    it('un estado que este cliente no conoce no inventa un aviso', async () => {
      // Cuando llegue `declarado` del backend, esta pantalla va a callarse en
      // vez de mentir sobre él.
      const { fixture, http } = await conHistorial({ statusKind: 'desconocido' });

      expect(fixture.nativeElement.textContent).not.toContain('Esperando');
      expect(fixture.nativeElement.textContent).not.toContain('no aceptó');
      http.verify();
    });
    it('el rechazo MUESTRA el motivo que dio la organizacion', async () => {
      // Leer «no aceptaron tu vínculo» y tener que buscar por qué en otro
      // renglón parte en dos una sola noticia.
      const { fixture, http } = await conHistorial({
        statusKind: 'rechazado',
        decisionReasonText: 'No figurás en nuestro plantel de cardiología',
      });

      expect(fixture.nativeElement.textContent).toContain('no aceptó este vínculo');
      expect(fixture.nativeElement.textContent).toContain(
        'No figurás en nuestro plantel',
      );
      http.verify();
    });

    it('sin motivo, el rechazo igual dice qué hacer', async () => {
      const { fixture, http } = await conHistorial({
        statusKind: 'rechazado',
        decisionReasonText: null,
      });

      expect(fixture.nativeElement.textContent).toContain('hablá con ellos');
      expect(fixture.nativeElement.textContent).not.toContain('Motivo:');
      http.verify();
    });

    it('un vinculo REVOCADO avisa y aclara que las citas siguen', async () => {
      const { fixture, http } = await conHistorial({ statusKind: 'revocado' });

      expect(fixture.nativeElement.textContent).toContain('dio de baja');
      expect(fixture.nativeElement.textContent).toContain('siguen en pie');
      http.verify();
    });
  });
});

/* ============================================================================
   ALV-005/006/007/010 — dónde atiendo, cargo opcional, direcciones en mayúsculas.
   ========================================================================== */

const SITIOS = '/practitioners/prac-1/sites';
const SITIO_PROPIO = '/practitioners/me/sites';

/** Una sede tal como llega por el cable. */
const sedeEnCable = (over: Record<string, unknown> = {}) => ({
  id: 'site-1',
  practiceId: 'pr-1',
  code: 'CONSULTORIO-1',
  name: 'Consultorio Dra. Pérez',
  timeZone: 'America/La_Paz',
  addressText: 'Av. Brasil 1234, La Paz',
  latitude: null,
  longitude: null,
  status: 'c-activo',
  ...over,
});

/** El árbol de municipios, con un solo departamento y un solo municipio. */
const RAMAS: readonly RamaDepartamento[] = [
  {
    conceptId: 'dep-sc',
    sigla: 'SC',
    nombre: 'Santa Cruz',
    municipios: [{ conceptId: 'mun-scz', nombre: 'Santa Cruz de la Sierra', ine: '070101' }],
  },
];

async function montarConSedes(confirmar = true) {
  const dialogs = { confirm: vi.fn(async () => confirmar) };
  const municipios = { listar: () => of(RAMAS), olvidar: vi.fn() };
  await TestBed.configureTestingModule({
    // El picker y el mapa van en un `@defer (when …)`: en el runner de CI un
    // bloque diferido que se dispara solo es una carrera (ver la nota del
    // repo sobre @defer en specs). Estas pruebas hablan con las señales del
    // componente, no con el DOM del bloque, así que se deja en manual.
    deferBlockBehavior: DeferBlockBehavior.Manual,
    imports: [WorkHistory],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: AuthService, useValue: { practitionerProfileId: signal('prac-1') } },
      { provide: DialogService, useValue: dialogs },
      { provide: BoMunicipalitiesCatalog, useValue: municipios },
    ],
  }).compileComponents();

  const fixture: ComponentFixture<WorkHistory> = TestBed.createComponent(WorkHistory);
  fixture.detectChanges();
  const http = TestBed.inject(HttpTestingController);
  http.expectOne(AFILIACIONES).flush({ items: [], count: 0 });
  return { fixture, http, dialogs };
}

describe('WorkHistory — dónde atiendo (ALV-005/006/010) y cargo opcional (ALV-007)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('lista las sedes con la dirección en MAYÚSCULAS, sin persistirla así', async () => {
    const { fixture, http } = await montarConSedes();
    http.expectOne(SITIOS).flush({ items: [sedeEnCable()], count: 1 });
    fixture.detectChanges();

    const texto: string = fixture.nativeElement.textContent;
    expect(texto).toContain('Consultorio Dra. Pérez');
    // ALV-010: se normaliza al MOSTRAR. El dato del cable sigue en minúsculas.
    expect(texto).toContain('AV. BRASIL 1234, LA PAZ');
    expect(texto).not.toContain('Av. Brasil 1234, La Paz');
    http.verify();
  });

  it('sin sedes lo dice, y no dibuja una lista vacía', async () => {
    const { fixture, http } = await montarConSedes();
    http.expectOne(SITIOS).flush({ items: [], count: 0 });
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-testid="sedes-vacio"]'),
    ).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll('[data-testid="sede-propia"]').length).toBe(0);
    http.verify();
  });

  it('registra un consultorio propio con dirección, municipio y departamento deducido', async () => {
    const { fixture, http } = await montarConSedes();
    http.expectOne(SITIOS).flush({ items: [], count: 0 });
    const componente = api(fixture);

    componente['abrirAltaDeSede']();
    componente['nombreDeSedeNueva'].set('  Consultorio Dra. Pérez ');
    componente['direccionDeSede'].set('Av. Brasil 1234');
    componente['ciudadDeSede'].set('La Paz');
    componente['municipioDeSede'].set('mun-scz');
    fixture.detectChanges();

    expect(leer(componente, 'departamentoDeSede')).toBe('dep-sc');
    componente['guardarSede']();

    const req = http.expectOne((r) => r.url === SITIO_PROPIO && r.method === 'POST');
    expect(req.request.body).toEqual({
      name: 'Consultorio Dra. Pérez',
      address: {
        lines: ['Av. Brasil 1234'],
        city: 'La Paz',
        municipalityConceptId: 'mun-scz',
        administrativeAreaConceptId: 'dep-sc',
      },
    });
    req.flush(sedeEnCable());

    // Tras el alta se relee la lista: sale del servidor, no de lo escrito.
    http.expectOne(SITIOS).flush({ items: [sedeEnCable()], count: 1 });
    fixture.detectChanges();
    expect(leer<boolean>(componente, 'altaDeSedeAbierta')).toBe(false);
    expect(fixture.nativeElement.querySelectorAll('[data-testid="sede-propia"]').length).toBe(1);
    http.verify();
  });

  it('manda el punto del mapa como latitud y longitud, y omite la dirección si está vacía', async () => {
    const { fixture, http } = await montarConSedes();
    http.expectOne(SITIOS).flush({ items: [], count: 0 });
    const componente = api(fixture);

    componente['abrirAltaDeSede']();
    componente['nombreDeSedeNueva'].set('Consultorio');
    fixture.detectChanges();
    componente['guardarSede']();

    // Sin dirección no viaja `address`: una fila vacía en common.addresses no
    // es «sin dirección».
    const sinDireccion = http.expectOne((r) => r.url === SITIO_PROPIO && r.method === 'POST');
    expect(sinDireccion.request.body).toEqual({ name: 'Consultorio' });
    sinDireccion.flush(sedeEnCable());
    http.expectOne(SITIOS).flush({ items: [], count: 0 });

    componente['abrirAltaDeSede']();
    componente['nombreDeSedeNueva'].set('Consultorio');
    componente['direccionDeSede'].set('Calle 1');
    (componente['marcarPunto'] as unknown as (p: { lat: number; lng: number }) => void)({
      lat: -16.5,
      lng: -68.15,
    });
    fixture.detectChanges();
    componente['guardarSede']();

    const conPunto = http.expectOne((r) => r.url === SITIO_PROPIO && r.method === 'POST');
    expect(conPunto.request.body.address).toEqual({
      lines: ['Calle 1'],
      latitude: -16.5,
      longitude: -68.15,
    });
    conPunto.flush(sedeEnCable());
    http.expectOne(SITIOS).flush({ items: [], count: 0 });
    http.verify();
  });

  it('retira una sede sólo si se confirma, y relee la lista', async () => {
    const { fixture, http, dialogs } = await montarConSedes(true);
    http.expectOne(SITIOS).flush({ items: [sedeEnCable()], count: 1 });
    fixture.detectChanges();

    await (api(fixture)['quitarSede'] as unknown as (s: unknown) => Promise<void>)(
      sedeEnCable(),
    );
    expect(dialogs.confirm).toHaveBeenCalled();
    http.expectOne((r) => r.url === `${SITIO_PROPIO}/site-1` && r.method === 'DELETE').flush(null);
    http.expectOne(SITIOS).flush({ items: [], count: 0 });
    http.verify();
  });

  it('si no se confirma, no toca nada', async () => {
    const { fixture, http } = await montarConSedes(false);
    http.expectOne(SITIOS).flush({ items: [sedeEnCable()], count: 1 });

    await (api(fixture)['quitarSede'] as unknown as (s: unknown) => Promise<void>)(
      sedeEnCable(),
    );
    http.expectNone((r) => r.method === 'DELETE');
    http.verify();
  });

  it('ALV-007: registra un vínculo sin cargo y no manda roleTitle', async () => {
    const { fixture, http } = await montarConSedes();
    http.expectOne(SITIOS).flush({ items: [], count: 0 });
    const componente = api(fixture);

    componente['escribirAMano']();
    componente['institucion'].set('Mi consultorio');
    componente['desde'].set(new Date(2021, 2, 1));
    fixture.detectChanges();

    expect(leer<boolean>(componente, 'puedeRegistrar')).toBe(true);
    componente['registrar']();

    const req = http.expectOne((r) => r.url === AFILIACIONES && r.method === 'POST');
    expect(req.request.body).toEqual({
      organizationName: 'Mi consultorio',
      startDate: '2021-03-01',
    });
    req.flush(enCable({ id: 'af-3', roleTitle: null }));
    http.expectOne(AFILIACIONES).flush({ items: [enCable({ roleTitle: null })], count: 1 });
    fixture.detectChanges();

    // Sin cargo no se dibuja el renglón del cargo, tampoco un guion.
    expect(fixture.nativeElement.querySelector('.historial__cargo')).toBeNull();
    http.verify();
  });
});

describe('WorkHistory — consultorio propio vs. ajeno y QR bancario (P32 / P33)', () => {
  afterEach(() => TestBed.resetTestingModule());

  const PROPIA = sedeEnCable({ id: 'site-propia', name: 'Consultorio Dra. Pérez', isOwnSite: true });
  const AJENA = sedeEnCable({
    id: 'site-hospital',
    name: 'Hospital San Lucas',
    isOwnSite: false,
    bankQrFileId: 'file-qr',
  });

  it('distingue el consultorio propio del hospital, y sólo ofrece corregir el propio', async () => {
    const { fixture, http } = await montarConSedes();
    http.expectOne(SITIOS).flush({ items: [PROPIA, AJENA], count: 2 });
    fixture.detectChanges();

    const marcas = fixture.nativeElement.querySelectorAll('[data-testid="sede-propia-marca"]');
    expect(marcas.length).toBe(1);
    // Corregir alcanza sólo al propio: la sede del hospital es de él.
    const editar = fixture.nativeElement.querySelectorAll('[data-testid="sede-editar"]');
    expect(editar.length).toBe(1);
    // El QR, en cambio, va en las dos: también se cobra donde no sos dueño.
    expect(fixture.nativeElement.querySelectorAll('[data-testid="sede-qr"]').length).toBe(2);
    http.verify();
  });

  it('avisa qué sede no tiene QR de cobro, sin esconder el camino para cargarlo', async () => {
    const { fixture, http } = await montarConSedes();
    http.expectOne(SITIOS).flush({ items: [PROPIA, AJENA], count: 2 });
    fixture.detectChanges();

    // La propia no tiene QR; el hospital sí.
    const avisos = fixture.nativeElement.querySelectorAll('[data-testid="sede-sin-qr"]');
    expect(avisos.length).toBe(1);
    http.verify();
  });

  it('esconde el alta cuando ya hay un consultorio propio: la práctica personal es UNA', async () => {
    const { fixture, http } = await montarConSedes();
    http.expectOne(SITIOS).flush({ items: [PROPIA], count: 1 });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="sede-agregar"]')).toBeNull();
    http.verify();
  });

  it('sin la marca lo trata como ajeno y deja el alta disponible', async () => {
    // Un frontend desplegado contra una API anterior al P32-a: ausente se lee
    // como «no sé», y la degradación prudente nunca esconde un camino.
    const { fixture, http } = await montarConSedes();
    http.expectOne(SITIOS).flush({ items: [sedeEnCable()], count: 1 });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="sede-editar"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="sede-agregar"]')).not.toBeNull();
    http.verify();
  });

  it('corrige el nombre con un PATCH y NO manda dirección si el formulario la deja en blanco', async () => {
    const { fixture, http } = await montarConSedes();
    http.expectOne(SITIOS).flush({ items: [PROPIA], count: 1 });
    fixture.detectChanges();
    const componente = api(fixture);

    (componente['abrirEdicionDeSede'] as unknown as (s: unknown) => void)(PROPIA);
    fixture.detectChanges();
    // El formulario arranca con el nombre que ya tenía.
    expect(leer<string>(componente, 'nombreDeSedeNueva')).toBe('Consultorio Dra. Pérez');

    componente['nombreDeSedeNueva'].set('Consultorio Sur');
    componente['guardarSede']();

    const req = http.expectOne(
      (r) => r.url === `${SITIO_PROPIO}/site-propia` && r.method === 'PATCH',
    );
    // Sin calle escrita no viaja `address`: en blanco es «no la toques», que
    // es exactamente lo que el PATCH hace con lo que no recibe.
    expect(req.request.body).toEqual({ name: 'Consultorio Sur' });
    req.flush(sedeEnCable({ name: 'Consultorio Sur', isOwnSite: true }));

    http.expectOne(SITIOS).flush({ items: [PROPIA], count: 1 });
    fixture.detectChanges();
    expect(leer<boolean>(componente, 'altaDeSedeAbierta')).toBe(false);
    http.verify();
  });

  it('manda la dirección entera cuando sí se escribe una calle', async () => {
    const { fixture, http } = await montarConSedes();
    http.expectOne(SITIOS).flush({ items: [PROPIA], count: 1 });
    const componente = api(fixture);

    (componente['abrirEdicionDeSede'] as unknown as (s: unknown) => void)(PROPIA);
    componente['direccionDeSede'].set('Calle Nueva 99');
    componente['ciudadDeSede'].set('Santa Cruz');
    componente['municipioDeSede'].set('mun-scz');
    fixture.detectChanges();
    componente['guardarSede']();

    const req = http.expectOne(
      (r) => r.url === `${SITIO_PROPIO}/site-propia` && r.method === 'PATCH',
    );
    expect(req.request.body).toEqual({
      name: 'Consultorio Dra. Pérez',
      address: {
        lines: ['Calle Nueva 99'],
        city: 'Santa Cruz',
        municipalityConceptId: 'mun-scz',
        administrativeAreaConceptId: 'dep-sc',
      },
    });
    req.flush(sedeEnCable());
    http.expectOne(SITIOS).flush({ items: [PROPIA], count: 1 });
    http.verify();
  });

  it('refleja el QR recién guardado sin volver a pedir la lista', async () => {
    const { fixture, http } = await montarConSedes();
    http.expectOne(SITIOS).flush({ items: [PROPIA], count: 1 });
    fixture.detectChanges();
    const componente = api(fixture);

    (componente['abrirQrDeSede'] as unknown as (s: unknown) => void)(PROPIA);
    (componente['qrGuardado'] as unknown as (id: string) => void)('file-nuevo');
    fixture.detectChanges();

    const sedes = leer<readonly { bankQrFileId?: string | null }[]>(componente, 'sedes');
    expect(sedes[0].bankQrFileId).toBe('file-nuevo');
    // El aviso en ámbar desaparece sin volver a pedir la lista de sedes.
    expect(fixture.nativeElement.querySelector('[data-testid="sede-sin-qr"]')).toBeNull();
    expect(http.match(SITIOS).length).toBe(0);

    // El modal, que sigue abierto, sí baja la imagen nueva para mostrarla: es
    // el contenido del archivo, no la lista.
    http
      .expectOne('/common/files/file-nuevo/content')
      .flush(new Blob(['qr'], { type: 'image/png' }));
    http.verify();
  });

  it('nombra el retiro distinto según de quién sea la sede', async () => {
    const { fixture, http } = await montarConSedes();
    http.expectOne(SITIOS).flush({ items: [PROPIA, AJENA], count: 2 });
    fixture.detectChanges();
    const componente = api(fixture);

    const etiqueta = componente['etiquetaDeRetiro'] as unknown as (s: unknown) => string;
    expect(etiqueta(PROPIA)).toBe('Retirar Consultorio Dra. Pérez de tus consultorios');
    expect(etiqueta(AJENA)).toBe('Dejar de atender en Hospital San Lucas');
    http.verify();
  });
});

/**
 * Una afiliación ya mapeada al dominio: es lo que el componente recibe de la
 * lista, con las fechas como `Date`. `enCable` es la forma del transporte y no
 * sirve para alimentar al formulario —el date-picker pide un `Date`—.
 *
 * @param over - Lo que cambia respecto del vínculo de ejemplo.
 */
const enDominio = (over: Record<string, unknown> = {}) => {
  const { startDate, endDate, createdAt, ...resto } = enCable(over);
  // El mismo `maybeDateOnly` que usa `toAffiliation`, y no `new Date(texto)`:
  // el constructor lee «2020-03-01» como medianoche UTC y en Bolivia eso es el
  // día anterior. La prueba tiene que recibir lo que recibe la pantalla.
  return {
    ...resto,
    startDate: maybeDateOnly(String(startDate)) ?? new Date(NaN),
    endDate: endDate === null ? null : (maybeDateOnly(String(endDate)) ?? null),
    createdAt: new Date(String(createdAt)),
  };
};

/**
 * Monta el bloque con un vínculo ya en la lista y el diálogo bajo control.
 *
 * @param afiliacion - El vínculo que devuelve el `GET`, tal como llega por el cable.
 * @param confirmar - Qué contesta el diálogo de confirmación.
 */
async function montarConVinculo(
  afiliacion: Record<string, unknown>,
  confirmar = true,
  layout: 'flat' | 'timeline' = 'flat',
) {
  const dialogs = { confirm: vi.fn(async () => confirmar) };
  await TestBed.configureTestingModule({
    deferBlockBehavior: DeferBlockBehavior.Manual,
    imports: [WorkHistory],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: AuthService, useValue: { practitionerProfileId: signal('prac-1') } },
      { provide: DialogService, useValue: dialogs },
    ],
  }).compileComponents();

  const fixture: ComponentFixture<WorkHistory> = TestBed.createComponent(WorkHistory);
  fixture.componentRef.setInput('layout', layout);
  fixture.detectChanges();
  const http = TestBed.inject(HttpTestingController);
  http.expectOne(AFILIACIONES).flush({ items: [afiliacion], count: 1 });
  http.expectOne('/practitioners/prac-1/sites').flush({ items: [], count: 0 });
  fixture.detectChanges();
  return { fixture, http, dialogs };
}

describe('WorkHistory — corregir y retirar un vínculo laboral', () => {
  afterEach(() => TestBed.resetTestingModule());

  /**
   * Quién puede tocar qué. Es la regla que sostiene todo lo demás: un sello lo
   * pone una organización, y que el profesional pueda reescribir por detrás lo
   * que alguien ya confirmó convierte el sello en una mentira.
   */
  it('sólo deja corregir lo declarado, y retirar además lo que nadie contestó', async () => {
    const { fixture, http } = await montarConVinculo(enCable({ statusKind: 'declarado' }));
    const componente = api(fixture);

    const puedeCorregirse = (kind: string) =>
      componente['puedeCorregirse'](enDominio({ statusKind: kind }) as never) as boolean;
    const puedeRetirarse = (kind: string) =>
      componente['puedeRetirarse'](enDominio({ statusKind: kind }) as never) as boolean;

    expect(puedeCorregirse('declarado')).toBe(true);
    expect(puedeCorregirse('pendiente')).toBe(false);
    expect(puedeCorregirse('aprobado')).toBe(false);
    expect(puedeCorregirse('rechazado')).toBe(false);
    expect(puedeCorregirse('revocado')).toBe(false);

    // Retirar una solicitud que nadie contestó es arrepentirse a tiempo; lo ya
    // decidido por una organización queda.
    expect(puedeRetirarse('declarado')).toBe(true);
    expect(puedeRetirarse('pendiente')).toBe(true);
    expect(puedeRetirarse('aprobado')).toBe(false);
    expect(puedeRetirarse('rechazado')).toBe(false);

    http.verify();
  });

  it('el renglón de un vínculo aprobado no ofrece ni corregir ni retirar', async () => {
    const { fixture, http } = await montarConVinculo(enCable({ statusKind: 'aprobado' }));

    const raiz: HTMLElement = fixture.nativeElement;
    expect(raiz.querySelector('[data-testid="vinculo-editar"]')).toBeNull();
    expect(raiz.querySelector('[data-testid="vinculo-retirar"]')).toBeNull();

    http.verify();
  });

  it('corrige con un PATCH y manda el fin vacío como null, para volver a ponerlo en curso', async () => {
    const { fixture, http } = await montarConVinculo(
      enCable({ statusKind: 'declarado', endDate: '2023-12-31', current: false }),
    );
    const componente = api(fixture);

    componente['abrirEdicionDeVinculo'](
      enDominio({ statusKind: 'declarado', endDate: '2023-12-31' }) as never,
    );
    fixture.detectChanges();

    // El fin se vacía a mano: es el gesto de «seguís ejerciendo ahí».
    componente['hasta'].set(null);
    componente['cargo'].set('Jefa de guardia');
    componente['guardarVinculo']();

    const req = http.expectOne(
      (r) => r.url === `${AFILIACIONES}/af-1` && r.method === 'PATCH',
    );
    expect(req.request.body).toEqual({
      organizationName: 'Hospital Obrero N.º 1',
      roleTitle: 'Jefa de guardia',
      startDate: '2020-03-01',
      // El null explícito es lo que el contrato lee como «volvió a estar
      // vigente». Omitirlo dejaría el cierre puesto por error sin forma de
      // deshacerse.
      endDate: null,
    });

    req.flush(enCable({ endDate: null }));
    http.expectOne(AFILIACIONES).flush({ items: [], count: 0 });
    http.verify();
  });

  it('corrigiendo no se ofrece la sede: el PATCH no la admite', async () => {
    const { fixture, http } = await montarConVinculo(enCable({ statusKind: 'declarado' }));
    const componente = api(fixture);

    componente['abrirEdicionDeVinculo'](enDominio({ statusKind: 'declarado' }) as never);
    fixture.detectChanges();

    expect(componente['vinculoEnEdicion']()).not.toBeNull();
    const texto: string = fixture.nativeElement.textContent;
    expect(texto).not.toContain('Consultorio de la plataforma');
    // Y el formulario dice qué se está haciendo, no «Agregar un vínculo».
    expect(texto).toContain('Corregir «Hospital Obrero N.º 1»');

    http.verify();
  });

  it('retira con un DELETE, y sólo después de que la persona confirme', async () => {
    const { fixture, http, dialogs } = await montarConVinculo(
      enCable({ statusKind: 'declarado' }),
    );
    const componente = api(fixture);

    await componente['retirarVinculo'](enDominio({ statusKind: 'declarado' }) as never);

    expect(dialogs.confirm).toHaveBeenCalledOnce();
    const req = http.expectOne(
      (r) => r.url === `${AFILIACIONES}/af-1` && r.method === 'DELETE',
    );
    req.flush(null);
    http.expectOne(AFILIACIONES).flush({ items: [], count: 0 });
    http.verify();
  });

  it('si la persona cancela el diálogo, no se borra nada', async () => {
    const { fixture, http, dialogs } = await montarConVinculo(
      enCable({ statusKind: 'declarado' }),
      false,
    );
    const componente = api(fixture);

    await componente['retirarVinculo'](enDominio({ statusKind: 'declarado' }) as never);

    expect(dialogs.confirm).toHaveBeenCalledOnce();
    http.expectNone((r) => r.method === 'DELETE');
    http.verify();
  });
  /**
   * La razón de ser del bloque: en «Trayectoria» —que es el único lugar donde
   * el perfil monta este componente— la lista plana está suprimida a propósito,
   * así que sin este bloque los botones no existirían para nadie.
   */
  it('en «Trayectoria» ofrece lo accionable, sin repetir la historia entera', async () => {
    const { fixture, http } = await montarConVinculo(
      enCable({ statusKind: 'declarado' }),
      true,
      'timeline',
    );

    const raiz: HTMLElement = fixture.nativeElement;
    expect(raiz.querySelector('[data-testid="vinculos-editables"]')).not.toBeNull();
    expect(raiz.querySelector('[data-testid="vinculo-editar"]')).not.toBeNull();
    expect(raiz.querySelector('[data-testid="vinculo-retirar"]')).not.toBeNull();

    http.verify();
  });

  it('sin nada que tocar, el bloque no se dibuja', async () => {
    const { fixture, http } = await montarConVinculo(
      enCable({ statusKind: 'aprobado' }),
      true,
      'timeline',
    );

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-testid="vinculos-editables"]'),
    ).toBeNull();

    http.verify();
  });
});
