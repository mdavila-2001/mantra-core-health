import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';

import { AuthService } from '../../../../core/auth/auth.service';
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
