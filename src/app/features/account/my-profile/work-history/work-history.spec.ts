import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, DeferBlockBehavior, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';

import { of } from 'rxjs';

import { AuthService } from '../../../../core/auth/auth.service';
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
async function montar(practitionerProfileId: string | null, confirmar = true) {
  const dialogs = { confirm: vi.fn(async () => confirmar) };
  await TestBed.configureTestingModule({
    imports: [WorkHistory],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      {
        provide: AuthService,
        useValue: { practitionerProfileId: signal(practitionerProfileId) },
      },
      { provide: DialogService, useValue: dialogs },
    ],
  }).compileComponents();

  const fixture: ComponentFixture<WorkHistory> = TestBed.createComponent(WorkHistory);
  fixture.detectChanges();
  return { fixture, http: TestBed.inject(HttpTestingController), dialogs };
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
/**
 * Las acciones de una sede, sin importar en qué forma las dibuje ADR-0012.
 *
 * En la sede propia son tres y viven en un desplegable —cuyo panel se muda al
 * `<body>` mientras está abierto, así que buscarlo dentro de la fila no lo
 * encuentra—; en la ajena son dos y se quedan en la fila. El spec pregunta por
 * la acción y no por la forma: preguntar por la forma lo rompería cada vez que
 * una sede gane o pierda una acción, aunque la pantalla siguiera funcionando.
 */
function accionesDeSede(
  fixture: ComponentFixture<WorkHistory>,
  fila: HTMLElement,
): HTMLElement[] {
  const disparador = fila.querySelector<HTMLButtonElement>(
    '[data-testid="row-actions-trigger"]',
  );
  if (disparador === null) {
    return [...fila.querySelectorAll<HTMLElement>('app-row-actions [data-action]')];
  }
  cerrarAcciones(fixture);
  disparador.click();
  fixture.detectChanges();
  return [...document.querySelectorAll<HTMLElement>('app-menu [role="menuitem"]')];
}

/** Una acción de esa sede por su código, o `null` si esa sede no la ofrece. */
function accionDeSede(
  fixture: ComponentFixture<WorkHistory>,
  fila: HTMLElement,
  code: string,
): HTMLElement | null {
  return accionesDeSede(fixture, fila).find((el) => el.dataset['action'] === code) ?? null;
}

/**
 * Los códigos que esa sede ofrece, en orden.
 *
 * Pedilos UNA vez por fila y repartí de ahí: volver a abrir el mismo
 * desplegable dentro de la misma prueba devuelve vacío, porque el disparador
 * acaba de recibir el foco de vuelta del cierre y se come ese clic.
 */
function codigosDeSede(
  fixture: ComponentFixture<WorkHistory>,
  fila: HTMLElement,
): (string | undefined)[] {
  return accionesDeSede(fixture, fila).map((el) => el.dataset['action']);
}

/**
 * Cierra el desplegable que hubiera abierto. Si quedara abierto entre dos
 * filas, la siguiente leería el panel de la anterior y el spec mediría otra
 * sede sin avisar.
 */
function cerrarAcciones(fixture: ComponentFixture<WorkHistory>): void {
  if (document.querySelector('app-menu [role="menuitem"]') === null) {
    return;
  }
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  fixture.detectChanges();
}

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

    // El formulario vive en un modal desde el 19/09/2026: lo que tiene que
    // seguir en pie tras un 500 es la PUERTA para cargarlo.
    expect(
      fixture.nativeElement.querySelector('[data-testid="abrir-alta-vinculo"]'),
    ).not.toBeNull();

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

    await (componente['registrar'] as unknown as () => Promise<void>)();

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

    await (componente['registrar'] as unknown as () => Promise<void>)();

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
    expect(texto).toContain('Añadir elemento a tu historial');

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

  describe('el alta de un vínculo es un modal (19/09/2026)', () => {
    /** Monta el bloque con las dos lecturas de arranque ya resueltas. */
    async function listo() {
      const montado = await montar('prac-1');
      montado.http.expectOne(AFILIACIONES).flush({ items: [], count: 0 });
      montado.http.expectOne('/practitioners/prac-1/sites').flush({ items: [], count: 0 });
      montado.fixture.detectChanges();
      return montado;
    }

    it('no dibuja el formulario hasta que se pide, y entonces es uno solo', async () => {
      const { fixture, http } = await listo();

      // Cerrado: ni el modal ni sus campos existen en el DOM. Es la diferencia
      // con un panel plegable, que los deja montados y sólo los esconde.
      expect(fixture.nativeElement.querySelector('app-content-dialog')).toBeNull();
      expect(fixture.nativeElement.textContent).not.toContain('Cuándo empezaste');

      fixture.nativeElement.querySelector('[data-testid="abrir-alta-vinculo"]').click();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelectorAll('app-content-dialog')).toHaveLength(1);
      expect(fixture.nativeElement.textContent).toContain('Cuándo empezaste');

      http.verify();
    });

    it('en «Trayectoria» el botón NO va dentro de una tarjeta', async () => {
      // Ahí el bloque es sólo la puerta: la línea de tiempo la pinta la ficha
      // y los consultorios viven en otra pestaña. Una tarjeta del alto de
      // media pantalla alrededor de un botón es una caja vacía.
      const { fixture, http } = await montar('prac-1');
      fixture.componentRef.setInput('layout', 'timeline');
      fixture.componentRef.setInput('secciones', 'historial');
      http.expectOne(AFILIACIONES).flush({ items: [], count: 0 });
      http.expectOne('/practitioners/prac-1/sites').flush({ items: [], count: 0 });
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('app-card')).toBeNull();
      expect(fixture.nativeElement.querySelector('[data-testid="abrir-alta-vinculo"]')).not.toBeNull();

      http.verify();
    });

    it('al pie del perfil sí es una tarjeta, como siempre', async () => {
      const { fixture, http } = await montar('prac-1');
      http.expectOne(AFILIACIONES).flush({ items: [], count: 0 });
      http.expectOne('/practitioners/prac-1/sites').flush({ items: [], count: 0 });
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('app-card')).not.toBeNull();

      http.verify();
    });

    it('un alta exitosa lo cierra; una fallida lo deja abierto con el error', async () => {
      const { fixture, http } = await listo();
      const componente = api(fixture);

      componente['abrirAltaDeVinculo']();
      componente['escribirAMano']();
      componente['institucion'].set('Clínica del Sur');
      componente['desde'].set(new Date(2021, 2, 1));
      fixture.detectChanges();

      // Primero el camino que falla: el modal NO puede cerrarse, porque
      // cerrarlo tiraría lo escrito y dejaría el error sin dónde leerse.
      await (componente['registrar'] as unknown as () => Promise<void>)();
      http
        .expectOne((r) => r.url === AFILIACIONES && r.method === 'POST')
        .flush('boom', { status: 500, statusText: 'Server Error' });
      fixture.detectChanges();

      expect(leer<boolean>(componente, 'altaDeVinculoAbierta')).toBe(true);
      expect(fixture.nativeElement.querySelector('[data-testid="afiliacion-error"]')).not.toBeNull();

      await (componente['registrar'] as unknown as () => Promise<void>)();
      http
        .expectOne((r) => r.url === AFILIACIONES && r.method === 'POST')
        .flush(enCable({ id: 'af-2' }));
      http.expectOne(AFILIACIONES).flush({ items: [], count: 0 });
      fixture.detectChanges();

      expect(leer<boolean>(componente, 'altaDeVinculoAbierta')).toBe(false);
      expect(fixture.nativeElement.querySelector('app-content-dialog')).toBeNull();

      http.verify();
    });
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
    await (componente['registrar'] as unknown as () => Promise<void>)();

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

      await (componente['registrar'] as unknown as () => Promise<void>)();

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

async function montarConSedes(
  confirmar = true,
  secciones?: 'ambas' | 'consultorios' | 'historial',
) {
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
      provideRouter([]),
      { provide: AuthService, useValue: { practitionerProfileId: signal('prac-1') } },
      { provide: DialogService, useValue: dialogs },
      { provide: BoMunicipalitiesCatalog, useValue: municipios },
    ],
  }).compileComponents();

  const fixture: ComponentFixture<WorkHistory> = TestBed.createComponent(WorkHistory);
  /* El input se fija ANTES del primer `detectChanges`: es el que decide si el
     componente pide las sedes, y ponerlo después ya llegaría tarde. */
  if (secciones !== undefined) {
    fixture.componentRef.setInput('secciones', secciones);
  }
  fixture.detectChanges();
  const http = TestBed.inject(HttpTestingController);
  /* Cada modo pide sólo lo que dibuja. `historial` no lee las sedes —eso ya
     estaba— y desde el 20/09/2026 `consultorios` tampoco lee el historial
     (`work-history.ts`, guarda de `cargar`): con el consultorio adentro del
     perfil, la ficha monta este componente dos veces y esa lectura se hacía
     por duplicado para no dibujarse nunca. El helper espeja la asimetría; el
     `http.verify()` de cada prueba es lo que la fija. */
  if (secciones !== 'consultorios') {
    http.expectOne(AFILIACIONES).flush({ items: [], count: 0 });
  }
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
    expect(
      fixture.nativeElement.querySelectorAll('[data-testid="sedes-propias"] tbody tr').length,
    ).toBe(0);
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
    expect(fixture.nativeElement.querySelectorAll('[data-testid="sedes-propias"] tbody tr').length).toBe(1);
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

    // D-06: tocar el mapa vacía la dirección — así que si nadie la vuelve a
    // escribir después, `direccionDelFormulario()` sigue leyendo «vacía» y el
    // punto se pierde igual que la calle. El aviso junto al campo
    // (`sede-direccion-vaciada`) es lo que evita esto en la práctica.
    componente['abrirAltaDeSede']();
    componente['nombreDeSedeNueva'].set('Consultorio');
    componente['direccionDeSede'].set('Calle 1');
    (componente['marcarPunto'] as unknown as (p: { lat: number; lng: number }) => void)({
      lat: -16.5,
      lng: -68.15,
    });
    expect(leer<string>(componente, 'direccionDeSede')).toBe('');
    fixture.detectChanges();
    componente['guardarSede']();

    const sinRetipear = http.expectOne((r) => r.url === SITIO_PROPIO && r.method === 'POST');
    expect(sinRetipear.request.body).toEqual({ name: 'Consultorio' });
    sinRetipear.flush(sedeEnCable());
    http.expectOne(SITIOS).flush({ items: [], count: 0 });

    // Quien sí vuelve a escribir la dirección (lo que el aviso le pide) manda
    // la calle y el punto juntos.
    componente['abrirAltaDeSede']();
    componente['nombreDeSedeNueva'].set('Consultorio');
    (componente['marcarPunto'] as unknown as (p: { lat: number; lng: number }) => void)({
      lat: -16.5,
      lng: -68.15,
    });
    componente['direccionDeSede'].set('Calle 1');
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
    await (componente['registrar'] as unknown as () => Promise<void>)();

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


/**
 * Lo que el cliente pidió el 13/09/2026 sobre «Dónde atiendo».
 *
 * Tres cosas que antes no existían y ninguna prueba sostenía:
 *
 * 1. El bloque **sale de Trayectoria**. Hasta ahora el componente dibujaba
 *    siempre los dos —consultorios e historial— y el único interruptor era
 *    `soloConsultorios`, que sólo sabía suprimir el segundo.
 * 2. **El consultorio propio es uno solo**, y se corrige. No es regla de
 *    pantalla: `POST /practitioners/me/sites` reutiliza la práctica personal,
 *    así que la propia es una por persona — y el botón de alta seguía
 *    ofreciendo la segunda.
 * 3. **Atender en un hospital que ya existe no es crear un consultorio.** Había
 *    una sola puerta, así que quien atiende en la Clínica Foianini terminaba
 *    creándose un consultorio con el nombre de la clínica.
 */
describe('WorkHistory — las dos puertas de «Dónde atiendo» (13/09/2026)', () => {
  afterEach(() => TestBed.resetTestingModule());

  /** La misma sede, marcada como propia o como ajena. */
  const propia = (over: Record<string, unknown> = {}) =>
    sedeEnCable({ id: 'site-propio', name: 'Consultorio Dra. Pérez', isOwnSite: true, ...over });
  const ajena = (over: Record<string, unknown> = {}) =>
    sedeEnCable({ id: 'site-ajeno', name: 'Hospital San Lucas', isOwnSite: false, ...over });

  it('con `secciones="historial"» no dibuja los consultorios', async () => {
    const { fixture, http } = await montarConSedes(true, 'historial');

    expect(fixture.nativeElement.querySelector('[data-testid="sedes-propias"]')).toBeNull();
    // Y no pide las sedes que no va a dibujar.
    http.verify();
  });

  it('con `secciones="consultorios"» no dibuja el historial laboral', async () => {
    const { fixture, http } = await montarConSedes(true, 'consultorios');
    // Ni lo pide. Es la simétrica de la prueba de arriba, y la que faltaba:
    // la ficha del médico monta este componente dos veces, así que una
    // lectura que no se dibuja se paga dos veces por visita.
    expect(http.match(AFILIACIONES)).toHaveLength(0);
    http.expectOne(SITIOS).flush({ items: [], count: 0 });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="sedes-propias"]')).not.toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Añadir elemento a tu historial');
    http.verify();
  });

  it('distingue el consultorio propio del lugar donde trabaja', async () => {
    const { fixture, http } = await montarConSedes();
    http.expectOne(SITIOS).flush({ items: [propia(), ajena()], count: 2 });
    fixture.detectChanges();

    const texto: string = fixture.nativeElement.textContent;
    expect(texto).toContain('Tu consultorio');
    expect(texto).toContain('Trabajás acá');
  });

  it('el propio se puede editar; el ajeno, sólo retirar', async () => {
    const { fixture, http } = await montarConSedes();
    http.expectOne(SITIOS).flush({ items: [propia(), ajena()], count: 2 });
    fixture.detectChanges();

    const filas = [
      ...fixture.nativeElement.querySelectorAll('[data-testid="sedes-propias"] tbody tr'),
    ] as HTMLElement[];
    expect(filas).toHaveLength(2);
    const propiaOfrece = codigosDeSede(fixture, filas[0]!);
    const ajenaOfrece = codigosDeSede(fixture, filas[1]!);

    expect(propiaOfrece).toContain('editar');
    expect(ajenaOfrece).not.toContain('editar');
    // Retirar sigue estando en los dos: dejar de atender en un lugar vale para
    // el propio y para el ajeno.
    expect(propiaOfrece).toContain('retirar');
    expect(ajenaOfrece).toContain('retirar');
    cerrarAcciones(fixture);
  });

  it('teniendo uno propio, ya no ofrece crear otro', async () => {
    const { fixture, http } = await montarConSedes();
    http.expectOne(SITIOS).flush({ items: [propia()], count: 1 });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="sede-agregar"]')).toBeNull();
    expect(
      fixture.nativeElement.querySelector('[data-testid="sede-propia-unica"]')?.textContent,
    ).toContain('Consultorio Dra. Pérez');
  });

  /**
   * Sin la marca la pantalla no puede saberlo, y esconder el alta sería peor
   * que ofrecerla de más: dejaría a alguien sin forma de cargar el primero.
   */
  it('sin `isOwnSite` en el cable, el alta sigue disponible', async () => {
    const { fixture, http } = await montarConSedes();
    http.expectOne(SITIOS).flush({ items: [sedeEnCable()], count: 1 });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="sede-agregar"]')).not.toBeNull();
  });

  it('editar el propio manda un PATCH a su id, no un alta nueva', async () => {
    const { fixture, http } = await montarConSedes();
    http.expectOne(SITIOS).flush({ items: [propia({ addressText: 'Av. Brasil 1234' })], count: 1 });
    fixture.detectChanges();

    const componente = api(fixture);
    (componente['abrirEdicionDeSede'] as unknown as (s: unknown) => void)(
      propia({ addressText: 'Av. Brasil 1234' }),
    );
    fixture.detectChanges();
    // El formulario abre con lo que ya tenía cargado.
    expect(leer(componente, 'nombreDeSedeNueva')).toBe('Consultorio Dra. Pérez');
    expect(leer(componente, 'direccionDeSede')).toBe('Av. Brasil 1234');

    componente['nombreDeSedeNueva'].set('Consultorio Dra. Pérez · Equipetrol');
    componente['registrarSede']();

    const req = http.expectOne(
      (r) => r.url === `${SITIO_PROPIO}/site-propio` && r.method === 'PATCH',
    );
    expect((req.request.body as { name: string }).name).toBe(
      'Consultorio Dra. Pérez · Equipetrol',
    );
    req.flush(propia());
    http.expectOne(SITIOS).flush({ items: [propia()], count: 1 });
    http.verify();
  });

  it('elegir un establecimiento del padrón declara que atiende ahí, en curso', async () => {
    const { fixture, http } = await montarConSedes();
    http.expectOne(SITIOS).flush({ items: [], count: 0 });
    fixture.detectChanges();

    const componente = api(fixture);
    componente['lugarElegido'].set({ value: 'fac-1', label: 'Clínica Foianini' });
    componente['atiendoAca']();

    const req = http.expectOne((r) => r.url === AFILIACIONES && r.method === 'POST');
    const cuerpo = req.request.body as Record<string, unknown>;
    expect(cuerpo['organizationName']).toBe('Clínica Foianini');
    // Sin `endDate`: es dónde atiende HOY, y así lo lee la ficha.
    expect(cuerpo['endDate']).toBeUndefined();
    // Y sin cargo: acá la pregunta es dónde, no como qué.
    expect(cuerpo['roleTitle']).toBeUndefined();
  });
});

/**
 * Lo que el cliente pidió el 13/09/2026 sobre las acciones de cada sede.
 *
 * 1. **Editar y retirar en ícono**, con su globo. Antes eran dos rótulos, y con
 *    un tercero la fila se partía en dos renglones apenas el nombre del
 *    hospital era largo.
 * 2. **Un botón de QR** por sede, que abre el QR bancario con el que cobra ahí.
 * 3. **En ámbar cuando falta.** Y no sólo en ámbar: el color solo no dice nada
 *    a quien no lo ve (WCAG 1.4.1), así que el nombre accesible cambia también.
 */
describe('WorkHistory — las acciones de cada sede (13/09/2026)', () => {
  afterEach(() => TestBed.resetTestingModule());

  const conQr = (over: Record<string, unknown> = {}) =>
    sedeEnCable({ id: 'site-qr', name: 'Consultorio Dra. Pérez', isOwnSite: true, bankQrFileId: 'file-qr', ...over });
  const sinQr = (over: Record<string, unknown> = {}) =>
    sedeEnCable({ id: 'site-sin-qr', name: 'Hospital San Lucas', isOwnSite: false, bankQrFileId: null, ...over });

  /** Las filas de «Dónde atiendo», en el orden en que se dibujan. */
  function filas(fixture: ComponentFixture<WorkHistory>): HTMLElement[] {
    return [...fixture.nativeElement.querySelectorAll('[data-testid="sedes-propias"] tbody tr')];
  }

  /**
   * Antes esta prueba exigía lo contrario: que editar y retirar fueran glifos
   * sin texto, cada uno con su globo. ADR-0012 invirtió la regla —el globo era
   * el parche de un botón mudo— y lo que se exige ahora es el texto a la vista.
   * No se debilitó: cambió de exigencia junto con la decisión, y sigue
   * midiendo lo mismo, que es si se entiende qué hace cada acción.
   */
  it('editar y retirar se leen con su texto, y el disparador dice de qué sede', async () => {
    const { fixture, http } = await montarConSedes();
    http.expectOne(SITIOS).flush({ items: [conQr()], count: 1 });
    fixture.detectChanges();

    const fila = filas(fixture)[0]!;

    // Tres acciones: la sede propia colapsa. El disparador nombra la sede,
    // porque «Acciones» repetido cuatro veces no le sirve a quien navega por
    // lista de botones.
    const disparador = fila.querySelector('[data-testid="row-actions-trigger"]')!;
    expect(disparador.getAttribute('aria-label')).toBe('Acciones de Consultorio Dra. Pérez');

    const acciones = accionesDeSede(fixture, fila);
    const editar = acciones.find((el) => el.dataset['action'] === 'editar')!;
    const retirar = acciones.find((el) => el.dataset['action'] === 'retirar')!;

    expect(editar.textContent?.trim()).toBe('Editar');
    expect(retirar.textContent?.trim()).toBe('Retirar');

    // El ícono sigue estando: acompaña al texto, no lo sustituye.
    expect(editar.querySelector('svg')).not.toBeNull();
    expect(retirar.querySelector('svg')).not.toBeNull();

    cerrarAcciones(fixture);
  });

  /**
   * El glifo dice «borrar» porque es el que se reconoce; el texto dice lo que
   * de verdad pasa, que no es lo mismo en las dos sedes.
   */
  it('retirar se nombra distinto en la propia y en la ajena', async () => {
    const { fixture, http } = await montarConSedes();
    http.expectOne(SITIOS).flush({ items: [conQr(), sinQr()], count: 2 });
    fixture.detectChanges();

    const [propiaFila, ajenaFila] = filas(fixture);
    expect(accionDeSede(fixture, propiaFila!, 'retirar')!.textContent?.trim()).toBe('Retirar');
    expect(accionDeSede(fixture, ajenaFila!, 'retirar')!.textContent?.trim()).toBe(
      'Dejar de atender',
    );

    // De qué sede se trata ya no lo repite cada etiqueta: en la ajena, que se
    // dibuja en la fila, lo dice el nombre accesible.
    expect(accionDeSede(fixture, ajenaFila!, 'retirar')!.getAttribute('aria-label')).toBe(
      'Dejar de atender — Hospital San Lucas',
    );
    cerrarAcciones(fixture);
  });

  it('toda sede tiene su botón de QR, propia o ajena', async () => {
    const { fixture, http } = await montarConSedes();
    http.expectOne(SITIOS).flush({ items: [conQr(), sinQr()], count: 2 });
    fixture.detectChanges();

    expect(filas(fixture).map((fila) => codigosDeSede(fixture, fila).includes('qr'))).toEqual([
      true,
      true,
    ]);
    cerrarAcciones(fixture);
  });

  /**
   * El ámbar se fue con el botón sólo-ícono: ADR-0012 no le deja tono propio a
   * una acción suelta. Lo que decía sigue dicho en palabras, y en dos lugares:
   * el nombre de la acción y el aviso de la fila. Lo que se perdió está
   * anotado en el `.css`: el ámbar avisaba sin abrir el desplegable.
   */
  it('sin QR configurado lo dice con palabras, y en la fila', async () => {
    const { fixture, http } = await montarConSedes();
    http.expectOne(SITIOS).flush({ items: [conQr(), sinQr()], count: 2 });
    fixture.detectChanges();

    const [conImagen, sinImagen] = filas(fixture);

    expect(accionDeSede(fixture, sinImagen!, 'qr')!.textContent?.trim()).toBe(
      'Configurar QR bancario',
    );
    expect(accionDeSede(fixture, conImagen!, 'qr')!.textContent?.trim()).toBe('Ver QR bancario');

    // Y el aviso de la fila, que no depende de abrir nada, sigue apareciendo
    // sólo en la que no lo tiene.
    expect(sinImagen!.querySelector('[data-testid="sede-sin-qr"]')).not.toBeNull();
    expect(conImagen!.querySelector('[data-testid="sede-sin-qr"]')).toBeNull();
    cerrarAcciones(fixture);
  });

  /**
   * `bankQrFileId` llega ausente contra la API real (P33). Ausente se lee como
   * «no hay ninguno», que es lo que deja el camino para cargarlo — nunca lo
   * esconde.
   */
  it('sin `bankQrFileId` en el cable, se trata como sin configurar', async () => {
    const { fixture, http } = await montarConSedes();
    http.expectOne(SITIOS).flush({ items: [sedeEnCable()], count: 1 });
    fixture.detectChanges();

    expect(accionDeSede(fixture, filas(fixture)[0]!, 'qr')!.textContent?.trim()).toBe(
      'Configurar QR bancario',
    );
    cerrarAcciones(fixture);
  });

  /**
   * Uno solo y fuera del `@for`: dentro habría un `<dialog>` por fila —cuatro
   * en el DOM para uno que se abre— y cada uno pidiendo su imagen.
   */
  it('el modal no existe hasta que se pide, y entonces es uno solo', async () => {
    const { fixture, http } = await montarConSedes();
    http.expectOne(SITIOS).flush({ items: [conQr(), sinQr()], count: 2 });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-site-bank-qr-dialog')).toBeNull();

    accionDeSede(fixture, filas(fixture)[0]!, 'qr')!.click();
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelectorAll('app-site-bank-qr-dialog'),
    ).toHaveLength(1);
  });

  /**
   * Tras guardar, lo único que cambia es que esa sede pasa de «Configurar» a
   * «Ver». Releer las cuatro sedes para enterarse de eso es una vuelta
   * completa por un dato que ya está en la mano.
   */
  it('guardar un QR cambia lo que ofrece esa fila, sin releer la lista', async () => {
    const { fixture, http } = await montarConSedes();
    http.expectOne(SITIOS).flush({ items: [sinQr()], count: 1 });
    fixture.detectChanges();

    const componente = api(fixture);
    (componente['abrirQrDeSede'] as unknown as (s: unknown) => void)(sinQr());
    (componente['qrGuardado'] as unknown as (f: string) => void)('file-nuevo');
    fixture.detectChanges();

    expect(accionDeSede(fixture, filas(fixture)[0]!, 'qr')!.textContent?.trim()).toBe(
      'Ver QR bancario',
    );
    cerrarAcciones(fixture);
    // Y no se volvió a pedir la lista de sedes.
    expect(http.match(SITIOS).length).toBe(0);
    // El modal, que sigue abierto, sí baja la imagen nueva: es el contenido del
    // archivo, no la lista.
    http
      .expectOne('/common/files/file-nuevo/content')
      .flush(new Blob(['qr'], { type: 'image/png' }));
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
    const sedes = [
      ...fixture.nativeElement.querySelectorAll('[data-testid="sedes-propias"] tbody tr'),
    ] as HTMLElement[];
    const ofrecen = sedes.map((fila) => codigosDeSede(fixture, fila));
    expect(ofrecen.filter((codigos) => codigos.includes('editar'))).toHaveLength(1);
    // El QR, en cambio, va en las dos: también se cobra donde no sos dueño.
    expect(ofrecen.filter((codigos) => codigos.includes('qr'))).toHaveLength(2);
    cerrarAcciones(fixture);
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

    const fila = fixture.nativeElement.querySelector(
      '[data-testid="sedes-propias"] tbody tr',
    ) as HTMLElement;
    expect(codigosDeSede(fixture, fila)).not.toContain('editar');
    expect(fixture.nativeElement.querySelector('[data-testid="sede-agregar"]')).not.toBeNull();
    cerrarAcciones(fixture);
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
    // Vaciarla a propósito: el formulario ya no abre en blanco, así que «en
    // blanco» es una decisión de quien edita y no el estado inicial.
    componente['direccionDeSede'].set('');
    await (componente['guardarSede'] as unknown as () => Promise<void>)();

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
    await (componente['guardarSede'] as unknown as () => Promise<void>)();

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

    // La distinción es del negocio y se conserva: en la propia se deja de
    // ofrecer un consultorio que es suyo, en la ajena se corta un vínculo con
    // una organización. Lo que ya no hace la etiqueta es repetir el nombre de
    // la sede: eso lo pone el nombre accesible, a partir de `fila`.
    const etiqueta = componente['etiquetaDeRetiro'] as unknown as (s: unknown) => string;
    expect(etiqueta(PROPIA)).toBe('Retirar');
    expect(etiqueta(AJENA)).toBe('Dejar de atender');
    http.verify();
  });
});

/**
 * H4.S1/H4.S2 (ADR-0015): el consultorio en modal, guardar habilitado por
 * cambios y confirmación antes de persistir una edición.
 */
describe('WorkHistory — el consultorio en modal, guardar por cambios y confirmación (ADR-0015)', () => {
  afterEach(() => TestBed.resetTestingModule());

  const PROPIA = sedeEnCable({
    id: 'site-propia',
    name: 'Consultorio Dra. Pérez',
    isOwnSite: true,
    addressText: 'Av. Brasil 1234',
  });

  it('el formulario nace en un modal, nunca en línea debajo de la lista', async () => {
    const { fixture, http } = await montarConSedes();
    http.expectOne(SITIOS).flush({ items: [], count: 0 });
    const componente = api(fixture);

    componente['abrirAltaDeSede']();
    fixture.detectChanges();

    const modal = fixture.nativeElement.querySelector('[data-testid="content-dialog"]');
    expect(modal).not.toBeNull();
    expect(modal?.querySelector('[data-testid="sede-formulario"]')).not.toBeNull();
    // El formulario no vive suelto en la sección, fuera del modal.
    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="sedes-propias"] > [data-testid="sede-formulario"]',
      ),
    ).toBeNull();
    http.verify();
  });

  it('editar sin tocar nada deja Guardar deshabilitado', async () => {
    const { fixture, http } = await montarConSedes();
    http.expectOne(SITIOS).flush({ items: [PROPIA], count: 1 });
    const componente = api(fixture);

    (componente['abrirEdicionDeSede'] as unknown as (s: unknown) => void)(PROPIA);
    fixture.detectChanges();

    expect(leer<boolean>(componente, 'puedeGuardarSede')).toBe(false);
    const guardar = fixture.nativeElement.querySelector('[data-testid="sede-guardar"]');
    expect(guardar?.getAttribute('aria-disabled')).toBe('true');
    http.verify();
  });

  it('cambiar el nombre habilita Guardar; volverlo a como estaba lo apaga', async () => {
    const { fixture, http } = await montarConSedes();
    http.expectOne(SITIOS).flush({ items: [PROPIA], count: 1 });
    const componente = api(fixture);

    (componente['abrirEdicionDeSede'] as unknown as (s: unknown) => void)(PROPIA);
    componente['nombreDeSedeNueva'].set('Otro nombre');
    fixture.detectChanges();
    expect(leer<boolean>(componente, 'puedeGuardarSede')).toBe(true);

    componente['nombreDeSedeNueva'].set('Consultorio Dra. Pérez');
    fixture.detectChanges();
    expect(leer<boolean>(componente, 'puedeGuardarSede')).toBe(false);
    http.verify();
  });

  it('el alta (sin edición) no exige que «cambie» nada: manda por validez', async () => {
    const { fixture, http } = await montarConSedes();
    http.expectOne(SITIOS).flush({ items: [], count: 0 });
    const componente = api(fixture);

    componente['abrirAltaDeSede']();
    fixture.detectChanges();
    expect(leer<boolean>(componente, 'puedeGuardarSede')).toBe(false); // sin nombre

    componente['nombreDeSedeNueva'].set('Consultorio nuevo');
    fixture.detectChanges();
    expect(leer<boolean>(componente, 'puedeGuardarSede')).toBe(true);
    http.verify();
  });

  it('guardar una edición pide confirmación antes de mandar el PATCH', async () => {
    const { fixture, http, dialogs } = await montarConSedes(true);
    http.expectOne(SITIOS).flush({ items: [PROPIA], count: 1 });
    const componente = api(fixture);

    (componente['abrirEdicionDeSede'] as unknown as (s: unknown) => void)(PROPIA);
    componente['nombreDeSedeNueva'].set('Otro nombre');
    fixture.detectChanges();
    await (componente['guardarSede'] as unknown as () => Promise<void>)();

    expect(dialogs.confirm).toHaveBeenCalled();
    http
      .expectOne((r) => r.url === `${SITIO_PROPIO}/site-propia` && r.method === 'PATCH')
      .flush(sedeEnCable());
    http.expectOne(SITIOS).flush({ items: [PROPIA], count: 1 });
    http.verify();
  });

  it('si no se confirma, no manda el PATCH y el modal sigue abierto con lo escrito', async () => {
    const { fixture, http, dialogs } = await montarConSedes(false);
    http.expectOne(SITIOS).flush({ items: [PROPIA], count: 1 });
    const componente = api(fixture);

    (componente['abrirEdicionDeSede'] as unknown as (s: unknown) => void)(PROPIA);
    componente['nombreDeSedeNueva'].set('Otro nombre');
    fixture.detectChanges();
    await (componente['guardarSede'] as unknown as () => Promise<void>)();

    expect(dialogs.confirm).toHaveBeenCalled();
    http.expectNone((r) => r.method === 'PATCH');
    expect(leer<boolean>(componente, 'altaDeSedeAbierta')).toBe(true);
    expect(leer<string>(componente, 'nombreDeSedeNueva')).toBe('Otro nombre');
    http.verify();
  });

  it('el alta (sin edición) no pide confirmación al guardar', async () => {
    const { fixture, http, dialogs } = await montarConSedes();
    http.expectOne(SITIOS).flush({ items: [], count: 0 });
    const componente = api(fixture);

    componente['abrirAltaDeSede']();
    componente['nombreDeSedeNueva'].set('Consultorio nuevo');
    fixture.detectChanges();
    componente['guardarSede']();

    expect(dialogs.confirm).not.toHaveBeenCalled();
    http.expectOne((r) => r.url === SITIO_PROPIO && r.method === 'POST').flush(sedeEnCable());
    http.expectOne(SITIOS).flush({ items: [], count: 0 });
    http.verify();
  });

  it('cancelar sin cambios cierra directo, sin preguntar', async () => {
    const { fixture, http, dialogs } = await montarConSedes();
    http.expectOne(SITIOS).flush({ items: [PROPIA], count: 1 });
    const componente = api(fixture);

    (componente['abrirEdicionDeSede'] as unknown as (s: unknown) => void)(PROPIA);
    fixture.detectChanges();
    componente['intentarCerrarAltaDeSede']();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(dialogs.confirm).not.toHaveBeenCalled();
    expect(leer<boolean>(componente, 'altaDeSedeAbierta')).toBe(false);
    http.verify();
  });

  it('cancelar con cambios pregunta si se descarta; confirmado, cierra y limpia', async () => {
    const { fixture, http, dialogs } = await montarConSedes(true);
    http.expectOne(SITIOS).flush({ items: [PROPIA], count: 1 });
    const componente = api(fixture);

    (componente['abrirEdicionDeSede'] as unknown as (s: unknown) => void)(PROPIA);
    componente['nombreDeSedeNueva'].set('Otro nombre');
    fixture.detectChanges();
    componente['intentarCerrarAltaDeSede']();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(dialogs.confirm).toHaveBeenCalled();
    expect(leer<boolean>(componente, 'altaDeSedeAbierta')).toBe(false);
    http.verify();
  });

  it('si no se confirma el descarte, el modal sigue abierto con lo escrito', async () => {
    const { fixture, http } = await montarConSedes(false);
    http.expectOne(SITIOS).flush({ items: [PROPIA], count: 1 });
    const componente = api(fixture);

    (componente['abrirEdicionDeSede'] as unknown as (s: unknown) => void)(PROPIA);
    componente['nombreDeSedeNueva'].set('Otro nombre');
    fixture.detectChanges();
    componente['intentarCerrarAltaDeSede']();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(leer<boolean>(componente, 'altaDeSedeAbierta')).toBe(true);
    expect(leer<string>(componente, 'nombreDeSedeNueva')).toBe('Otro nombre');
    http.verify();
  });

  it('D-06: tocar el mapa anuncia que hay que volver a escribir la dirección', async () => {
    const { fixture, http } = await montarConSedes();
    http.expectOne(SITIOS).flush({ items: [], count: 0 });
    const componente = api(fixture);

    componente['abrirAltaDeSede']();
    componente['direccionDeSede'].set('Calle 1');
    fixture.detectChanges();
    expect(leer<boolean>(componente, 'avisoDireccionVaciada')).toBe(false);

    (componente['marcarPunto'] as unknown as (p: { lat: number; lng: number }) => void)({
      lat: -16.5,
      lng: -68.15,
    });
    fixture.detectChanges();

    expect(leer<string>(componente, 'direccionDeSede')).toBe('');
    expect(leer<boolean>(componente, 'avisoDireccionVaciada')).toBe(true);
    expect(
      fixture.nativeElement.querySelector('[data-testid="sede-direccion-vaciada"]'),
    ).not.toBeNull();
    http.verify();
  });
});

/** H4.S1 (ADR-0015): la barra de «Dónde atiendo» busca, filtra y pagina en cliente. */
describe('WorkHistory — barra y paginación de «Dónde atiendo» (ADR-0015, H4.S1)', () => {
  afterEach(() => TestBed.resetTestingModule());

  const consultorio = (n: number) =>
    sedeEnCable({
      id: `site-${n}`,
      name: `Consultorio ${n}`,
      isOwnSite: n === 1,
      addressText: n % 2 === 0 ? 'AV. BANZER, SANTA CRUZ' : 'CALLE LIBERTAD, LA PAZ',
    });
  const DOCE_SEDES = Array.from({ length: 12 }, (_, i) => consultorio(i + 1));

  it('busca por nombre o dirección, normalizado', async () => {
    const { fixture, http } = await montarConSedes();
    http.expectOne(SITIOS).flush({ items: DOCE_SEDES, count: 12 });
    const componente = api(fixture);

    (componente['onFiltrosSedesChanged'] as unknown as (a: Record<string, string>) => void)({
      q: 'banzer',
    });
    fixture.detectChanges();

    const filtradas = leer<readonly { name: string }[]>(componente, 'sedesFiltradas');
    expect(filtradas.length).toBe(6); // los pares: 2,4,6,8,10,12
    expect(filtradas.every((s) => s.name !== undefined)).toBe(true);
    http.verify();
  });

  it('filtra por tipo (propio / ajeno)', async () => {
    const { fixture, http } = await montarConSedes();
    http.expectOne(SITIOS).flush({ items: DOCE_SEDES, count: 12 });
    const componente = api(fixture);

    (componente['onFiltrosSedesChanged'] as unknown as (a: Record<string, string>) => void)({
      tipo: 'propio',
    });
    fixture.detectChanges();

    const filtradas = leer<readonly { name: string }[]>(componente, 'sedesFiltradas');
    expect(filtradas).toEqual([expect.objectContaining({ name: 'Consultorio 1' })]);
    http.verify();
  });

  it('pagina en cliente, 10 por página por omisión', async () => {
    const { fixture, http } = await montarConSedes();
    http.expectOne(SITIOS).flush({ items: DOCE_SEDES, count: 12 });
    const componente = api(fixture);
    fixture.detectChanges();

    expect(leer<readonly unknown[]>(componente, 'sedesPaginadas').length).toBe(10);

    componente['paginaSedes'].set(2);
    fixture.detectChanges();
    expect(leer<readonly unknown[]>(componente, 'sedesPaginadas').length).toBe(2);

    const paginador = fixture.nativeElement.querySelector('app-pagination');
    expect(paginador).not.toBeNull();
    http.verify();
  });

  it('sin resultados de la búsqueda lo dice, sin confundirlo con «no hay sedes»', async () => {
    const { fixture, http } = await montarConSedes();
    http.expectOne(SITIOS).flush({ items: DOCE_SEDES, count: 12 });
    const componente = api(fixture);

    (componente['onFiltrosSedesChanged'] as unknown as (a: Record<string, string>) => void)({
      q: 'no existe ninguna así',
    });
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-testid="sedes-sin-resultados"]'),
    ).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="sedes-vacio"]')).toBeNull();
    http.verify();
  });
});

/**
 * H4.S3 — el historial laboral como tabla (D-09, ADR-0015).
 *
 * `ProfilesClient` no tiene `PATCH`/`DELETE` de afiliaciones ni el tipo
 * `PractitionerAffiliation` trae `fileId` (confirmado leyendo
 * `profiles.client.ts` y `profiles.types.ts`): el manejador real es de Itzan
 * y no está. Por regla 65 esto se aísla detrás de un doble local —un
 * `Map`/`Set` en memoria, declarado como tal— y se ejercita en sus tres
 * niveles (correcto, límite, inválido) en vez de quedar `BLOQUEADO`. La
 * subida del adjunto en sí **no** es parte del doble: usa `FilesClient` real
 * y comparte infraestructura, así que esa parte se prueba contra el POST
 * real de `/common/files/upload`.
 */
describe('WorkHistory — el historial como tabla, doble local (H4.S3, regla 65)', () => {
  async function montarConTabla(confirmar = true) {
    const { fixture, http, dialogs } = await montar('prac-1', confirmar);
    fixture.componentRef.setInput('layout', 'tabla');
    http
      .expectOne(AFILIACIONES)
      .flush({ items: [enCable(), enCable({ id: 'af-2', organizationName: 'Clínica del Sur', roleTitle: 'Pediatra' })], count: 2 });
    http.expectOne('/practitioners/prac-1/sites').flush({ items: [], count: 0 });
    fixture.detectChanges();
    return { fixture, http, dialogs, componente: api(fixture) };
  }

  it('dibuja app-data-table con las afiliaciones reales', async () => {
    const { fixture, http } = await montarConTabla();

    expect(fixture.nativeElement.querySelector('app-data-table')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Hospital Obrero N.º 1');
    expect(fixture.nativeElement.textContent).toContain('Clínica del Sur');
    http.verify();
  });

  it('«editar» desde las acciones de la fila precarga el cargo actual', async () => {
    const { http, componente } = await montarConTabla();

    (componente['ejecutarAccionDeAfiliacion'] as unknown as (c: string, a: unknown) => void)(
      'editar',
      enCable(),
    );

    expect(leer<boolean>(componente, 'edicionAfiliacionAbierta')).toBe(true);
    expect(leer<string>(componente, 'cargoEnEdicion')).toBe('Médico de planta');
    http.verify();
  });

  it('guardar el cargo editado pide confirmación y lo aplica sólo al doble local, sin PATCH real (nivel correcto)', async () => {
    const { http, dialogs, componente } = await montarConTabla(true);

    (componente['ejecutarAccionDeAfiliacion'] as unknown as (c: string, a: unknown) => void)(
      'editar',
      enCable(),
    );
    componente['cargoEnEdicion'].set('Jefe de cardiología');

    await (componente['guardarEdicionDeAfiliacion'] as unknown as () => Promise<void>)();

    expect(dialogs.confirm).toHaveBeenCalled();
    expect(
      leer<readonly { readonly organizationName: string; readonly roleTitle: string | null }[]>(
        componente,
        'afiliacionesEnTabla',
      ).find((a) => a.organizationName === 'Hospital Obrero N.º 1')?.roleTitle,
    ).toBe('Jefe de cardiología');
    expect(leer<boolean>(componente, 'edicionAfiliacionAbierta')).toBe(false);
    // El doble es local: nunca sale un PATCH de afiliaciones hacia el servidor.
    http.expectNone((r) => r.url === AFILIACIONES && r.method === 'PATCH');
    http.verify();
  });

  it('si no se confirma el guardado, el cargo no cambia y el modal sigue abierto (nivel inválido)', async () => {
    const { http, dialogs, componente } = await montarConTabla(false);

    (componente['ejecutarAccionDeAfiliacion'] as unknown as (c: string, a: unknown) => void)(
      'editar',
      enCable(),
    );
    componente['cargoEnEdicion'].set('Jefe de cardiología');

    await (componente['guardarEdicionDeAfiliacion'] as unknown as () => Promise<void>)();

    expect(dialogs.confirm).toHaveBeenCalled();
    expect(
      leer<readonly { readonly organizationName: string; readonly roleTitle: string | null }[]>(
        componente,
        'afiliacionesEnTabla',
      ).find((a) => a.organizationName === 'Hospital Obrero N.º 1')?.roleTitle,
    ).toBe('Médico de planta');
    expect(leer<boolean>(componente, 'edicionAfiliacionAbierta')).toBe(true);
    http.verify();
  });

  it('cerrar con cambios sin guardar pregunta si se descarta; confirmado, cierra y limpia', async () => {
    const { http, dialogs, componente } = await montarConTabla(true);

    (componente['ejecutarAccionDeAfiliacion'] as unknown as (c: string, a: unknown) => void)(
      'editar',
      enCable(),
    );
    componente['cargoEnEdicion'].set('Otro cargo');

    componente['intentarCerrarEdicionDeAfiliacion']();
    await Promise.resolve();

    expect(dialogs.confirm).toHaveBeenCalled();
    expect(leer<boolean>(componente, 'edicionAfiliacionAbierta')).toBe(false);
    http.verify();
  });

  it('subir un adjunto al guardar sube el archivo real y le asocia el fileId a la fila (nivel correcto)', async () => {
    const { http, dialogs, componente } = await montarConTabla(true);

    (componente['ejecutarAccionDeAfiliacion'] as unknown as (c: string, a: unknown) => void)(
      'editar',
      enCable(),
    );
    componente['archivoAdjunto'].set([
      new File(['x'], 'certificado.pdf', { type: 'application/pdf' }),
    ]);

    const guardando = (componente['guardarEdicionDeAfiliacion'] as unknown as () => Promise<void>)();
    await Promise.resolve();

    expect(dialogs.confirm).toHaveBeenCalled();
    const subida = http.expectOne((r) => r.url.endsWith('/common/files/upload'));
    expect(subida.request.method).toBe('POST');
    subida.flush({ id: 'file-77' });
    await guardando;

    expect(
      leer<readonly { readonly organizationName: string; readonly fileId: string | null }[]>(
        componente,
        'afiliacionesEnTabla',
      ).find((a) => a.organizationName === 'Hospital Obrero N.º 1')?.fileId,
    ).toBe('file-77');
    expect(leer<boolean>(componente, 'edicionAfiliacionAbierta')).toBe(false);
    http.verify();
  });

  it('si la subida del adjunto falla, el error se muestra y la edición sigue abierta (nivel inválido)', async () => {
    const { http, componente } = await montarConTabla(true);

    (componente['ejecutarAccionDeAfiliacion'] as unknown as (c: string, a: unknown) => void)(
      'editar',
      enCable(),
    );
    componente['archivoAdjunto'].set([
      new File(['x'], 'certificado.pdf', { type: 'application/pdf' }),
    ]);

    const guardando = (componente['guardarEdicionDeAfiliacion'] as unknown as () => Promise<void>)();
    await Promise.resolve();
    http
      .expectOne((r) => r.url.endsWith('/common/files/upload'))
      .flush({ message: 'nope' }, { status: 500, statusText: 'Server Error' });
    await guardando;

    expect(leer<string | null>(componente, 'errorDeAdjunto')).not.toBeNull();
    expect(leer<boolean>(componente, 'edicionAfiliacionAbierta')).toBe(true);
    http.verify();
  });

  it('«retirar» pide confirmación y, confirmada, saca la fila sin pedir un DELETE real (nivel correcto)', async () => {
    const { http, dialogs, componente } = await montarConTabla(true);

    await (componente['retirarAfiliacionLocal'] as unknown as (a: unknown) => Promise<void>)(
      enCable(),
    );

    expect(dialogs.confirm).toHaveBeenCalled();
    expect(
      leer<readonly { readonly organizationName: string }[]>(componente, 'afiliacionesEnTabla').some(
        (a) => a.organizationName === 'Hospital Obrero N.º 1',
      ),
    ).toBe(false);
    http.expectNone((r) => r.method === 'DELETE');
    http.verify();
  });

  it('si no se confirma el retiro, la fila sigue en la tabla (nivel límite)', async () => {
    const { http, dialogs, componente } = await montarConTabla(false);

    await (componente['retirarAfiliacionLocal'] as unknown as (a: unknown) => Promise<void>)(
      enCable(),
    );

    expect(dialogs.confirm).toHaveBeenCalled();
    expect(
      leer<readonly { readonly organizationName: string }[]>(componente, 'afiliacionesEnTabla').some(
        (a) => a.organizationName === 'Hospital Obrero N.º 1',
      ),
    ).toBe(true);
    http.verify();
  });

  it('la búsqueda filtra por institución o cargo, sin importar los acentos', async () => {
    const { http, componente } = await montarConTabla();

    (componente['onFiltrosHistorialChanged'] as unknown as (a: Record<string, string>) => void)({
      q: 'clinica',
    });

    const filtrado = leer<readonly { readonly organizationName: string }[]>(
      componente,
      'historialFiltrado',
    );
    expect(filtrado).toHaveLength(1);
    expect(filtrado[0].organizationName).toBe('Clínica del Sur');
    http.verify();
  });
});
