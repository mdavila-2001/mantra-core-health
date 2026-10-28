import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { chooseSelectOption } from '../../../../../testing/select';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import { ProcedureImport } from './procedure-import';

const RUTA = '/administration/services-catalog/import';
const API = '/billing/service-catalog';

const PRACTICA_1 = { id: 'pr1', code: 'P1', name: 'Consultorio Central' };
const PRACTICA_2 = { id: 'pr2', code: 'P2', name: 'Clínica Norte' };

/** Las 36 del arancel, recortadas a las que importan acá. */
const ESPECIALIDADES = [
  { specialty: 'Cardiología', count: 120 },
  { specialty: 'Dermatología', count: 40 },
  { specialty: 'Pediatría', count: 75 },
];

function procedimiento(code: string, specialty: string, extra: Record<string, unknown> = {}) {
  return {
    conceptId: `c-${code}`,
    code,
    display: `Procedimiento ${code}`,
    specialty,
    group: 'Grupo',
    referencePrice: '20.00',
    priceUnit: 'UMA',
    ocrSuspect: false,
    ...extra,
  };
}

function paginaDeProcedimientos(items: unknown[], nextCursor: string | null = null) {
  return { items, nextCursor };
}

function paginaDelCatalogo(codes: string[], nextCursor: string | null = null) {
  return {
    items: codes.map((code, i) => ({
      id: `s${i}`,
      practiceId: 'pr1',
      code,
      name: code,
      defaultPrice: '1.00',
      isActive: true,
    })),
    count: codes.length,
    limit: 500,
    nextCursor,
  };
}

describe('ProcedureImport', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let router: Router;
  let confirmaciones: { title: string; message: string; details?: { label: string; value: string }[] }[];
  let respuestaDeConfirmar: boolean;

  beforeEach(() => {
    confirmaciones = [];
    respuestaDeConfirmar = true;

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'administration/services-catalog/import', component: ProcedureImport },
          { path: 'administration/services-catalog', children: [] },
        ]),
        {
          provide: DialogService,
          useValue: {
            confirm: (config: { title: string; message: string }) => {
              confirmaciones.push(config);
              return Promise.resolve(respuestaDeConfirmar);
            },
          },
        },
      ],
    });

    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => http.verify());

  /* ---- ayudas ------------------------------------------------------------ */

  async function abrir(url = RUTA): Promise<ProcedureImport> {
    harness = await RouterTestingHarness.create();
    return harness.navigateByUrl(url, ProcedureImport);
  }

  async function asentar(): Promise<void> {
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  function el(): HTMLElement {
    return harness.routeNativeElement as HTMLElement;
  }

  function porTestId(id: string): HTMLElement | null {
    return el().querySelector(`[data-testid="${id}"]`);
  }

  /** `app-button` se deshabilita con `aria-disabled`, no con el atributo nativo. */
  function deshabilitado(id: string): boolean {
    const boton = porTestId(id);
    if (boton === null) throw new Error(`No hay «${id}»`);
    return boton.getAttribute('aria-disabled') === 'true';
  }

  function avisos(): string {
    return TestBed.inject(ToastService)
      .toasts()
      .map((a) => `${a.title ?? ''} ${a.message}`)
      .join(' | ');
  }

  function texto(): string {
    return el().textContent ?? '';
  }

  const urlPracticas = () => http.expectOne('/practices');
  const urlMias = () => http.expectOne(`${API}/procedure-specialties/mine`);
  const urlEspecialidades = () => http.expectOne(`${API}/procedure-specialties`);
  const catalogo = () => http.expectOne((r) => r.url === API && r.method === 'GET');
  const arancel = () => http.expectOne((r) => r.url === `${API}/procedures`);

  /** Responde lo que la pantalla pide al abrirse, sin tocar el arancel ni el catálogo. */
  async function responderBase(
    opciones: {
      practicas?: unknown[];
      mias?: { specialty: string; count: number }[] | Error;
    } = {},
  ): Promise<void> {
    urlPracticas().flush(opciones.practicas ?? [PRACTICA_1]);
    const mias = opciones.mias ?? [{ specialty: 'Cardiología', count: 120 }];
    if (mias instanceof Error) {
      urlMias().flush({ message: 'x' }, { status: 500, statusText: 'Error' });
    } else {
      urlMias().flush({ items: mias });
    }
    urlEspecialidades().flush({ items: ESPECIALIDADES });
    await asentar();
  }

  /** La lectura del catálogo de la práctica que dispara la preselección. */
  async function responderCatalogo(codes: string[] = []): Promise<void> {
    catalogo().flush(paginaDelCatalogo(codes));
    await asentar();
  }

  async function seleccionarEspecialidad(etiqueta: string): Promise<void> {
    // `app-select` elige en un modal: se abre y se toca la fila, como la persona.
    const host = el().querySelector<HTMLElement>('app-filter-bar app-select');
    if (host === null) throw new Error('No hay desplegable de especialidad');
    await chooseSelectOption(harness.fixture, host, etiqueta);
  }

  /* ---- especialidad por omisión ------------------------------------------ */

  describe('especialidad por omisión', () => {
    it('sin ?specialty= espera las del médico y pide el arancel con ellas', async () => {
      await abrir();
      // Todavía no se sabe el default: no se pide el arancel con todo y se pisa después.
      urlPracticas().flush([PRACTICA_1]);
      await asentar();
      http.expectNone((r) => r.url === `${API}/procedures`);

      urlMias().flush({
        items: [
          { specialty: 'Cardiología', count: 120 },
          { specialty: 'Pediatría', count: 75 },
        ],
      });
      urlEspecialidades().flush({ items: ESPECIALIDADES });
      await asentar();
      await responderCatalogo();

      const req = arancel();
      expect(req.request.params.get('specialty')).toBe('Cardiología|Pediatría');
      expect(req.request.params.get('limit')).toBe('60');
      req.flush(paginaDeProcedimientos([procedimiento('A1', 'Cardiología')]));
      await asentar();

      // Y quedó escrito en la URL: el filtro de la pantalla lo muestra y se comparte.
      expect(router.url).toContain('specialty=Cardiolog%C3%ADa%7CPediatr%C3%ADa');
      expect(texto()).toContain('Especialidad: Mis especialidades: Cardiología, Pediatría (195)');
      expect(texto()).toContain('Procedimiento A1');
    });

    it('con una sola especialidad, el chip lleva su nombre con recuento', async () => {
      await abrir();
      await responderBase();
      await responderCatalogo();
      arancel().flush(paginaDeProcedimientos([procedimiento('A1', 'Cardiología')]));
      await asentar();

      expect(texto()).toContain('Especialidad: Cardiología (120)');
    });

    it('una especialidad en la URL manda sobre la del médico', async () => {
      await abrir(`${RUTA}?specialty=Dermatolog%C3%ADa`);
      await responderBase();
      await responderCatalogo();

      const req = arancel();
      expect(req.request.params.get('specialty')).toBe('Dermatología');
      req.flush(paginaDeProcedimientos([]));
      await asentar();
      expect(router.url).toContain('Dermatolog');
      expect(router.url).not.toContain('Cardiolog');
    });

    it('«Todas las especialidades» se respeta y el default no vuelve', async () => {
      await abrir();
      await responderBase();
      await responderCatalogo();
      arancel().flush(paginaDeProcedimientos([procedimiento('A1', 'Cardiología')]));
      await asentar();

      await seleccionarEspecialidad('Todas las especialidades');
      await asentar();

      const req = arancel();
      expect(req.request.params.has('specialty')).toBe(false);
      req.flush(paginaDeProcedimientos([procedimiento('A1', 'Cardiología'), procedimiento('D1', 'Dermatología')]));
      await asentar();

      // «Explícito»: el parámetro está y vacío, que es lo que distingue «todas» de «sin elegir».
      expect(router.url).toMatch(/specialty=(&|$)/);
      expect(texto()).toContain('Procedimiento D1');
      http.expectNone((r) => r.url === `${API}/procedures`);
    });

    it('quitar el chip del filtro también es «todas» y se escribe vacío en la URL', async () => {
      const comp = await abrir();
      await responderBase();
      await responderCatalogo();
      arancel().flush(paginaDeProcedimientos([procedimiento('A1', 'Cardiología')]));
      await asentar();

      // Lo que emite el organismo al quitar el filtro: el filtro ya no está.
      (comp as unknown as { filtrar: (f: Record<string, string>) => void }).filtrar({});
      await asentar();

      const req = arancel();
      expect(req.request.params.has('specialty')).toBe(false);
      req.flush(paginaDeProcedimientos([]));
      await asentar();
      expect(router.url).toMatch(/specialty=(&|$)/);
    });

    it('si el médico no tiene especialidades, muestra todo el arancel y lo dice', async () => {
      await abrir();
      await responderBase({ mias: [] });
      await responderCatalogo();

      const req = arancel();
      expect(req.request.params.has('specialty')).toBe(false);
      req.flush(paginaDeProcedimientos([procedimiento('A1', 'Cardiología')]));
      await asentar();

      expect(texto()).toContain('Procedimiento A1');
      expect(porTestId('importar-aviso-especialidad')?.textContent).toContain('mostramos todo');
    });

    it('si falla la lectura de las suyas, muestra todo el arancel y lo dice', async () => {
      await abrir();
      await responderBase({ mias: new Error('x') });
      await responderCatalogo();

      const req = arancel();
      expect(req.request.params.has('specialty')).toBe(false);
      req.flush(paginaDeProcedimientos([procedimiento('A1', 'Cardiología')]));
      await asentar();

      expect(porTestId('importar-aviso-especialidad')?.textContent).toContain(
        'No pudimos leer sus especialidades',
      );
    });

    it('el texto y la especialidad se combinan en un solo pedido', async () => {
      const comp = await abrir();
      await responderBase();
      await responderCatalogo();
      arancel().flush(paginaDeProcedimientos([]));
      await asentar();

      (comp as unknown as { filtrar: (f: Record<string, string>) => void }).filtrar({
        specialty: 'Cardiología',
        q: 'ecg',
      });
      await asentar();

      const req = arancel();
      expect(req.request.params.get('specialty')).toBe('Cardiología');
      expect(req.request.params.get('q')).toBe('ecg');
      expect(req.request.params.has('cursor')).toBe(false);
      req.flush(paginaDeProcedimientos([]));
    });
  });

  /* ---- respuestas viejas y paginación ------------------------------------- */

  describe('peticiones', () => {
    it('un cambio de filtro cancela la petición anterior y su respuesta no pisa la nueva', async () => {
      const comp = await abrir(`${RUTA}?specialty=Cardiolog%C3%ADa`);
      await responderBase();
      await responderCatalogo();
      const vieja = arancel();
      expect(vieja.request.params.get('specialty')).toBe('Cardiología');

      (comp as unknown as { filtrar: (f: Record<string, string>) => void }).filtrar({
        specialty: 'Pediatría',
      });
      await asentar();

      expect(vieja.cancelled).toBe(true);
      const nueva = arancel();
      expect(nueva.request.params.get('specialty')).toBe('Pediatría');
      nueva.flush(paginaDeProcedimientos([procedimiento('P1', 'Pediatría')]));
      await asentar();

      expect(texto()).toContain('Procedimiento P1');
      expect(texto()).not.toContain('Procedimiento C9');
    });

    it('«Cargar más» manda el cursor y conserva el filtro múltiple', async () => {
      await abrir(`${RUTA}?specialty=Cardiolog%C3%ADa%7CPediatr%C3%ADa`);
      await responderBase();
      await responderCatalogo();
      arancel().flush(
        paginaDeProcedimientos([procedimiento('A1', 'Cardiología')], 'cursor-2'),
      );
      await asentar();

      porTestId('specialty-browser-more')?.click();
      await asentar();

      const req = arancel();
      expect(req.request.params.get('cursor')).toBe('cursor-2');
      expect(req.request.params.get('specialty')).toBe('Cardiología|Pediatría');
      req.flush(paginaDeProcedimientos([procedimiento('P1', 'Pediatría')]));
      await asentar();

      expect(texto()).toContain('Procedimiento A1');
      expect(texto()).toContain('Procedimiento P1');
      expect(porTestId('specialty-browser-more')).toBeNull();
    });

    it('si falla «Cargar más», lo ya mostrado sigue en pantalla', async () => {
      await abrir(`${RUTA}?specialty=Cardiolog%C3%ADa`);
      await responderBase();
      await responderCatalogo();
      arancel().flush(paginaDeProcedimientos([procedimiento('A1', 'Cardiología')], 'cursor-2'));
      await asentar();

      porTestId('specialty-browser-more')?.click();
      await asentar();
      arancel().flush({ message: 'x' }, { status: 500, statusText: 'Error' });
      await asentar();

      expect(texto()).toContain('Procedimiento A1');
    });
  });

  /* ---- la práctica -------------------------------------------------------- */

  describe('práctica de destino', () => {
    it('mientras carga, muestra el estado de carga', async () => {
      await abrir();
      harness.detectChanges();
      expect(porTestId('importar-practicas-cargando')).not.toBeNull();
      urlPracticas();
      urlMias();
      urlEspecialidades();
    });

    it('con una sola práctica queda fija y preseleccionada', async () => {
      await abrir();
      await responderBase();
      await responderCatalogo();
      arancel().flush(paginaDeProcedimientos([]));
      await asentar();

      expect(porTestId('importar-practica-fija')?.textContent).toContain('Consultorio Central');
      expect(porTestId('importar-practica')).toBeNull();
    });

    it('con varias, ofrece el selector con la primera elegida y relee el catálogo al cambiar', async () => {
      const comp = await abrir();
      await responderBase({ practicas: [PRACTICA_1, PRACTICA_2] });
      expect(catalogo().request.params.get('practiceId')).toBe('pr1');
      http.match((r) => r.url === API).forEach((r) => r.flush(paginaDelCatalogo([])));
      arancel().flush(paginaDeProcedimientos([]));
      await asentar();

      expect(porTestId('importar-practica')).not.toBeNull();
      (comp as unknown as { cambiarPractica: (id: string) => void }).cambiarPractica('pr2');
      await asentar();

      expect(catalogo().request.params.get('practiceId')).toBe('pr2');
    });

    it('si falla, lo dice con su próxima acción y reintentar vuelve a pedir', async () => {
      await abrir();
      urlPracticas().flush(
        { code: 'INTERNAL', message: 'boom', correlationId: 'req-77', timestamp: '', path: '' },
        { status: 500, statusText: 'Error' },
      );
      urlMias().flush({ items: [] });
      urlEspecialidades().flush({ items: ESPECIALIDADES });
      await asentar();
      arancel().flush(paginaDeProcedimientos([]));
      await asentar();

      const alerta = porTestId('importar-practicas-error');
      expect(alerta).not.toBeNull();
      expect(alerta?.textContent).toContain('No pudimos cargar sus prácticas');
      expect(alerta?.textContent).toContain('req-77');
      // No es «No hay opciones disponibles» ni «no tiene ninguna».
      expect(porTestId('importar-sin-practica')).toBeNull();

      porTestId('importar-practicas-reintentar')?.click();
      await asentar();
      urlPracticas().flush([PRACTICA_1]);
      await asentar();
      await responderCatalogo();

      expect(porTestId('importar-practicas-error')).toBeNull();
      expect(porTestId('importar-practica-fija')?.textContent).toContain('Consultorio Central');
    });

    it('un 403 al leer las prácticas dice que falta permiso, no que falló el servidor', async () => {
      await abrir();
      urlPracticas().flush({}, { status: 403, statusText: 'Forbidden' });
      urlMias().flush({ items: [] });
      urlEspecialidades().flush({ items: ESPECIALIDADES });
      await asentar();
      arancel().flush(paginaDeProcedimientos([]));
      await asentar();

      expect(porTestId('importar-practicas-error')?.textContent).toContain('No tiene permiso');
    });

    it('sin ninguna práctica, explica qué hacer y no deja importar', async () => {
      await abrir();
      await responderBase({ practicas: [] });
      arancel().flush(
        paginaDeProcedimientos([procedimiento('A1', 'Cardiología')]),
      );
      await asentar();

      const aviso = porTestId('importar-sin-practica');
      expect(aviso?.textContent).toContain('No tiene ninguna práctica asignada');
      expect(aviso?.textContent).toContain('administre la organización');
      expect(porTestId('importar-practicas-error')).toBeNull();
      expect(deshabilitado('importar-todo')).toBe(true);
      expect(deshabilitado('procedimiento-importar')).toBe(true);
    });
  });

  /* ---- importar uno ------------------------------------------------------- */

  describe('importar uno', () => {
    async function conUnProcedimiento(): Promise<void> {
      await abrir(`${RUTA}?specialty=Cardiolog%C3%ADa`);
      await responderBase();
      await responderCatalogo(['YA-1']);
      arancel().flush(
        paginaDeProcedimientos([procedimiento('A1', 'Cardiología'), procedimiento('YA-1', 'Cardiología')]),
      );
      await asentar();
    }

    it('crea el servicio con el código y el precio del arancel, y lo marca como importado', async () => {
      await conUnProcedimiento();

      expect(texto()).toContain('Ya está en su catálogo');
      const boton = porTestId('procedimiento-importar') as HTMLButtonElement;
      boton.click();
      await asentar();

      const req = http.expectOne((r) => r.url === API && r.method === 'POST');
      expect(req.request.body).toEqual({
        practiceId: 'pr1',
        code: 'A1',
        name: 'Procedimiento A1',
        serviceConceptId: 'c-A1',
        defaultPrice: '20.00',
        isActive: true,
      });
      req.flush({ id: 's9' });
      await asentar();

      expect(porTestId('procedimiento-importar')).toBeNull();
      expect(el().querySelectorAll('[data-testid="procedimiento"]').length).toBe(2);
    });

    it('sólo un FORBIDDEN habla de permiso; un 404 no se le parece', async () => {
      await conUnProcedimiento();

      const importar = async (status: number, body: object) => {
        (porTestId('procedimiento-importar') as HTMLButtonElement).click();
        await asentar();
        http
          .expectOne((r) => r.url === API && r.method === 'POST')
          .flush(body, { status, statusText: 'x' });
        await asentar();
      };

      const toasts = avisos;
      await importar(403, { code: 'FORBIDDEN', message: 'Forbidden resource' });
      expect(toasts()).toContain('exige permiso de administración');
      await importar(404, { code: 'NOT_FOUND', message: 'Práctica no encontrada' });
      const ultimo = toasts().split(' | ').at(-1) ?? '';
      expect(ultimo).not.toContain('permiso');
      expect(ultimo).toContain('Procedimiento A1');
    });
  });

  /* ---- importar todo ------------------------------------------------------ */

  describe('importar todo lo de mi especialidad', () => {
    async function listoParaImportar(
      url = RUTA,
      mias = [{ specialty: 'Cardiología', count: 120 }],
    ): Promise<void> {
      await abrir(url);
      await responderBase({ mias });
      await responderCatalogo();
      arancel().flush(paginaDeProcedimientos([procedimiento('A1', 'Cardiología')]));
      await asentar();
    }

    function botonDeLote(): HTMLButtonElement {
      return porTestId('importar-todo') as HTMLButtonElement;
    }

    it('el botón primario nombra la especialidad y el total', async () => {
      await listoParaImportar();
      expect(botonDeLote().textContent).toContain('Importar todo lo de mi especialidad (120)');
      expect(deshabilitado('importar-todo')).toBe(false);
      expect(botonDeLote().className).toContain('primary');
    });

    it('confirma diciendo cuántos son; si se cancela no manda nada', async () => {
      await listoParaImportar();
      respuestaDeConfirmar = false;

      botonDeLote().click();
      await asentar();

      expect(confirmaciones.length).toBe(1);
      expect(confirmaciones[0]?.message).toContain('120 procedimientos');
      expect(confirmaciones[0]?.details).toEqual(
        expect.arrayContaining([
          { label: 'Práctica', value: 'Consultorio Central' },
          { label: 'Especialidades', value: 'Cardiología' },
          { label: 'Procedimientos', value: '120' },
        ]),
      );
      http.expectNone((r) => r.url === `${API}/import-procedures`);
    });

    it('confirmado, manda el filtro vigente, muestra «Importando…» y luego creados/omitidos', async () => {
      await listoParaImportar(RUTA, [
        { specialty: 'Cardiología', count: 120 },
        { specialty: 'Pediatría', count: 75 },
      ]);

      botonDeLote().click();
      await asentar();

      const req = http.expectOne(`${API}/import-procedures`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        practiceId: 'pr1',
        specialties: ['Cardiología', 'Pediatría'],
      });
      expect(botonDeLote().textContent).toContain('Importando…');
      expect(deshabilitado('importar-todo')).toBe(true);

      req.flush({ created: 150, skipped: 45, total: 195 });
      await asentar();

      expect(porTestId('importar-resultado-creados')?.textContent).toBe('150');
      expect(porTestId('importar-resultado-omitidos')?.textContent).toBe('45');
      expect(porTestId('importar-resultado')?.textContent).toContain('Consultorio Central');

      // Relee lo importado: ahora «Ya está en su catálogo» sale de la fuente.
      const relectura = catalogo();
      expect(relectura.request.params.get('practiceId')).toBe('pr1');
      relectura.flush(paginaDelCatalogo(['A1']));
      await asentar();
      expect(texto()).toContain('Ya está en su catálogo');
      expect(botonDeLote().textContent).not.toContain('Importando');
    });

    it('con texto de búsqueda lo manda como q junto a las especialidades', async () => {
      await listoParaImportar(`${RUTA}?specialty=Cardiolog%C3%ADa&q=ecg`);
      botonDeLote().click();
      await asentar();

      expect(confirmaciones[0]?.details).toEqual(
        expect.arrayContaining([{ label: 'Que coincidan con', value: '«ecg»' }]),
      );
      const req = http.expectOne(`${API}/import-procedures`);
      expect(req.request.body).toEqual({ practiceId: 'pr1', specialties: ['Cardiología'], q: 'ecg' });
      req.flush({ created: 1, skipped: 0, total: 1 });
      await asentar();
      // Y relee el catálogo de la práctica.
      await responderCatalogo(['A1']);
    });

    it('sin ningún filtro no deja importar el arancel entero de un clic', async () => {
      await listoParaImportar(`${RUTA}?specialty=`);
      expect(deshabilitado('importar-todo')).toBe(true);
      expect(porTestId('importar-todo-ayuda')).not.toBeNull();
    });

    it.each([
      [403, 'exige permiso de administración'],
      [404, 'ya no existe o no tiene acceso'],
      [400, 'rechazó el pedido'],
      [500, 'error inesperado'],
      [0, 'No pudimos comunicarnos con el servidor'],
    ])('un %i dice lo que corresponde', async (status, fragmento) => {
      await listoParaImportar();
      botonDeLote().click();
      await asentar();

      const req = http.expectOne(`${API}/import-procedures`);
      if (status === 0) {
        req.error(new ProgressEvent('error'), { status: 0 });
      } else {
        req.flush({}, { status, statusText: 'x' });
      }
      await asentar();

      const error = porTestId('importar-lote-error');
      expect(error).not.toBeNull();
      expect(error?.textContent).toContain(fragmento);
      if (status !== 403) {
        // «Exige permiso de administración» queda para el 403 y nada más.
        expect(error?.textContent).not.toContain('exige permiso de administración');
      }
      expect(botonDeLote().textContent).not.toContain('Importando');
      expect(deshabilitado('importar-todo')).toBe(false);
    });
  });

  /* ---- lo ya importado ---------------------------------------------------- */

  describe('catálogo de la práctica', () => {
    it('recorre todas las páginas por cursor para marcar lo ya importado', async () => {
      await abrir(`${RUTA}?specialty=Cardiolog%C3%ADa`);
      await responderBase();

      const primera = catalogo();
      expect(primera.request.params.get('limit')).toBe('500');
      expect(primera.request.params.has('cursor')).toBe(false);
      primera.flush(paginaDelCatalogo(['X-1'], 'sig-1'));
      await asentar();

      const segunda = catalogo();
      expect(segunda.request.params.get('cursor')).toBe('sig-1');
      segunda.flush(paginaDelCatalogo(['A2']));
      await asentar();

      arancel().flush(paginaDeProcedimientos([procedimiento('A2', 'Cardiología')]));
      await asentar();

      // A2 sólo estaba en la segunda página.
      expect(porTestId('procedimiento-importar')).toBeNull();
      expect(texto()).toContain('Ya está en su catálogo');
    });

    it('si no se puede leer, lo avisa en vez de callar', async () => {
      await abrir(`${RUTA}?specialty=Cardiolog%C3%ADa`);
      await responderBase();
      catalogo().flush({}, { status: 500, statusText: 'x' });
      arancel().flush(paginaDeProcedimientos([]));
      await asentar();

      expect(porTestId('importar-aviso-catalogo')).not.toBeNull();
    });
  });
});
