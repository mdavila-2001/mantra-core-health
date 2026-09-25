import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { signal } from '@angular/core';

import { AuthService } from '../../../core/auth/auth.service';
import { DiagnosticOrders } from './diagnostic-orders';
import type { AnalysisCategory, PatientOrderRow } from './diagnostic-orders.types';
import type { RowAction } from '../../../shared/components/molecules/row-actions/row-actions.types';

/** Acceso a lo `protected`, igual que `work-history.spec.ts` (regla: no exponer sólo para testear). */
interface Interno {
  readonly onFiltrosCambiaron: (activos: Readonly<Record<string, string>>) => void;
  readonly limpiarFiltros: () => void;
  readonly filasFiltradas: () => readonly PatientOrderRow[];
  readonly accionesDe: (fila: PatientOrderRow) => readonly RowAction[];
  readonly ejecutarAccion: (codigo: string, fila: PatientOrderRow) => void;
  readonly tab: () => AnalysisCategory | null;
  readonly q: () => string;
}

function api(componente: DiagnosticOrders): Interno {
  return componente as unknown as Interno;
}

const PROFILE_ID = '44444444-4444-4444-8444-444444444444';
const RUTA = '/my-account/diagnostic-orders';

let contador = 0;
/** Un id con forma de uuid real, para que el chequeo anti-uuid del final valga algo. */
function id(_prefijo: string): string {
  contador += 1;
  const n = String(contador).padStart(12, '0');
  return `00000000-0000-4000-8000-${n}`;
}

interface OrdenDeApi {
  readonly id: string;
  readonly encounterId?: string;
  readonly codeConceptId: string;
  readonly categoryConceptId?: string;
  readonly statusConceptId: string;
  readonly createdAt: string;
  readonly hasReleasedResult: boolean;
  readonly reportId?: string;
  readonly preparationInstructions?: string;
  readonly insuranceSettlement?: unknown;
  readonly insuranceSettlementAvailability?: string;
}

function orden(overrides: Partial<OrdenDeApi> = {}): OrdenDeApi {
  return {
    id: id('order'),
    codeConceptId: id('concept-code'),
    statusConceptId: id('concept-status'),
    createdAt: '2026-08-14T10:00:00.000Z',
    hasReleasedResult: false,
    ...overrides,
  };
}

/** Un concepto del catálogo, tal como responde `/terminology/concepts`. */
function concepto(conceptId: string, code: string, display: string) {
  return { conceptId, code, display };
}

/** Doble mínimo de la sesión: lo único que la pantalla le pide es el perfil. */
function authDoble(patientProfileId: string | null) {
  return { patientProfileId: signal(patientProfileId) };
}

/**
 * «Mis órdenes» — C9 (ADR-0015): reescritura completa sobre el diseño
 * anterior (agrupado por atención). Lo que fijan estas pruebas:
 *
 * 1. El tipo se deriva del **código** de `categoryConceptId` cuando llega
 *    (`SRQ-LAB`/`SRQ-IMAGING`), y cae en «Otros» sin categoría (C2 no corrió).
 * 2. Los conteos de pestaña son consistentes: Todas = suma de las tres.
 * 3. Buscador y filtros son en cliente, y la URL va y vuelve.
 * 4. Ninguna acción de fila es sólo un ícono, y ninguna aparece sin su
 *    condición (resultado liberado / preparación publicada / liquidación).
 * 5. Ningún uuid llega al DOM.
 *
 * Se monta con `RouterTestingHarness` (no `TestBed.createComponent` suelto):
 * la sincronización con la URL usa `ActivatedRoute`/`Router.navigate([],
 * {relativeTo})`, que sólo queda bien resuelto si el componente se alcanza
 * por una navegación real — con `createComponent` a secas, `relativeTo`
 * apunta a un `ActivatedRoute` no adjunto a ningún outlet y la escritura a la
 * URL queda muda.
 */
describe('DiagnosticOrders', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  function configurar(perfil: string | null): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'my-account/diagnostic-orders', component: DiagnosticOrders }]),
        { provide: AuthService, useValue: authDoble(perfil) },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  }

  async function mount(url: string = RUTA): Promise<DiagnosticOrders> {
    harness = await RouterTestingHarness.create();
    const componente = await harness.navigateByUrl(url, DiagnosticOrders);
    harness.detectChanges();
    return componente;
  }

  function texto(): string {
    return harness.routeNativeElement?.textContent ?? '';
  }

  /** Responde la lectura de órdenes y, si hace falta, el catálogo de conceptos. */
  function responder(items: readonly OrdenDeApi[], conceptos: readonly ReturnType<typeof concepto>[] = []): void {
    http
      .expectOne((request) => request.url === '/diagnostic-results/me/orders')
      .flush({ patientProfileId: PROFILE_ID, items, limit: 50, truncated: false });
    if (items.length > 0) {
      http
        .expectOne((request) => request.url.startsWith('/terminology/concepts'))
        .flush({ items: conceptos });
    }
    harness.detectChanges();
  }

  /**
   * Los botones visibles de las pestañas los dibuja `Tabs` (`role="tab"`), no
   * `Tab`: el `data-testid` puesto en `<app-tab>` cae en el panel, no en el
   * botón. Sin forma de pasarle un id al botón desde afuera (pieza de la
   * casa, no se toca — ver `PLAN.md`), se ubica por rol + texto.
   */
  function botonDePestana(texto_: string): HTMLElement | null {
    return [...(harness.routeNativeElement?.querySelectorAll('[role="tab"]') ?? [])].find((el) =>
      el.textContent?.includes(texto_),
    ) as HTMLElement | null;
  }

  afterEach(() => http.verify());

  it('no pregunta por nadie más: no hay id de paciente en la petición', async () => {
    configurar(PROFILE_ID);
    await mount();

    const pedido = http.expectOne((request) => request.url === '/diagnostic-results/me/orders');
    expect(pedido.request.url).not.toContain(PROFILE_ID);
    pedido.flush({ patientProfileId: PROFILE_ID, items: [], limit: 50, truncated: false });
  });

  it('no lee nada para una cuenta sin perfil de paciente', async () => {
    configurar(null);
    await mount();

    http.expectNone(() => true);
    expect(texto()).toContain('Esta sección es para pacientes');
  });

  it('sin órdenes explica de dónde sale una', async () => {
    configurar(PROFILE_ID);
    await mount();
    responder([]);

    expect(texto()).toContain('Cuando un médico te pida un estudio');
  });

  /* ---- C9.H2.M1: derivación del tipo, con y sin category ------------------- */

  it('con categoría SRQ-LAB, la orden entra a Laboratorio', async () => {
    configurar(PROFILE_ID);
    await mount();
    const o = orden({ categoryConceptId: 'cat-lab' });
    responder([o], [concepto('cat-lab', 'SRQ-LAB', 'Laboratorio')]);

    const badge = harness.routeNativeElement?.querySelector('app-badge');
    expect(badge?.textContent?.trim()).toBe('Laboratorio');
  });

  it('sin categoryConceptId (C2 no corrió), la orden cae en Otros', async () => {
    configurar(PROFILE_ID);
    await mount();
    responder([orden()]);

    const badge = harness.routeNativeElement?.querySelector('app-badge');
    expect(badge?.textContent?.trim()).toBe('Otros');
  });

  it('los conteos de pestaña son consistentes: Todas = Laboratorio + Imagenología + Otros', async () => {
    configurar(PROFILE_ID);
    await mount();
    responder(
      [
        orden({ categoryConceptId: 'cat-lab' }),
        orden({ categoryConceptId: 'cat-lab' }),
        orden({ categoryConceptId: 'cat-img' }),
        orden(),
      ],
      [concepto('cat-lab', 'SRQ-LAB', 'Laboratorio'), concepto('cat-img', 'SRQ-IMAGING', 'Imagenología')],
    );

    expect(botonDePestana('Todas')?.textContent).toContain('4');
    expect(botonDePestana('Laboratorio')?.textContent).toContain('2');
    expect(botonDePestana('Imagenología')?.textContent).toContain('1');
    expect(botonDePestana('Otros')?.textContent).toContain('1');
  });

  /* ---- C9.H2.M2: filtrado y URL --------------------------------------------- */

  it('el buscador reduce a las filas que contienen el término, sin distinguir mayúsculas ni acentos', async () => {
    configurar(PROFILE_ID);
    const componente = await mount();
    responder(
      [orden({ codeConceptId: 'c-hemo' }), orden({ codeConceptId: 'c-rx' })],
      [concepto('c-hemo', 'STUDY-HEMO', 'Hemograma'), concepto('c-rx', 'STUDY-RX', 'Radiografía')],
    );

    api(componente).onFiltrosCambiaron({ q: 'HEMO' });
    harness.detectChanges();

    expect(api(componente).filasFiltradas().length).toBe(1);
    expect(api(componente).filasFiltradas()[0].studyLabel).toBe('Hemograma');
  });

  it('el filtro «Con resultado» deja sólo las que enlazan a un resultado', async () => {
    configurar(PROFILE_ID);
    const componente = await mount();
    responder([orden({ hasReleasedResult: true }), orden({ hasReleasedResult: false })]);

    api(componente).onFiltrosCambiaron({ resultado: 'con' });
    harness.detectChanges();

    expect(api(componente).filasFiltradas().every((f) => f.hasResult)).toBe(true);
    expect(api(componente).filasFiltradas().length).toBe(1);
  });

  it('«Limpiar filtros» vuelve al total', async () => {
    configurar(PROFILE_ID);
    const componente = await mount();
    responder([orden(), orden()]);

    api(componente).onFiltrosCambiaron({ q: 'algo-que-no-existe' });
    harness.detectChanges();
    expect(api(componente).filasFiltradas().length).toBe(0);

    api(componente).limpiarFiltros();
    harness.detectChanges();
    expect(api(componente).filasFiltradas().length).toBe(2);
  });

  it('cambiar un filtro actualiza la URL', async () => {
    configurar(PROFILE_ID);
    const componente = await mount();
    responder([orden()]);

    api(componente).onFiltrosCambiaron({ q: 'hemograma' });
    harness.detectChanges();
    // El `effect()` dispara `Router.navigate()`, que es async: hay que
    // esperar la promesa antes de leer `Router.url`.
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toContain('q=hemograma');
  });

  it('entrar por una URL con filtros restaura la vista', async () => {
    configurar(PROFILE_ID);
    const componente = await mount(`${RUTA}?tab=LAB&q=hemo`);
    responder([orden({ categoryConceptId: 'cat-lab' })], [concepto('cat-lab', 'SRQ-LAB', 'Laboratorio')]);

    expect(api(componente).tab()).toBe('LAB');
    expect(api(componente).q()).toBe('hemo');
  });

  /* ---- C9.H3.M2: acciones de fila ------------------------------------------- */

  it('«Ver resultado» sólo aparece si la orden tiene un resultado liberado', async () => {
    configurar(PROFILE_ID);
    const componente = await mount();
    const conResultado = orden({ hasReleasedResult: true, reportId: id('report') });
    const sinResultado = orden({ hasReleasedResult: false });
    responder([conResultado, sinResultado]);

    const filas = api(componente).filasFiltradas();
    const accionesCon = api(componente).accionesDe(filas[0]).map((a) => a.code);
    const accionesSin = api(componente).accionesDe(filas[1]).map((a) => a.code);
    expect(accionesCon).toContain('ver-resultado');
    expect(accionesSin).not.toContain('ver-resultado');
  });

  it('«Ver preparación» sólo aparece si el catálogo publicó una', async () => {
    configurar(PROFILE_ID);
    const componente = await mount();
    responder([orden({ preparationInstructions: 'Ayuno de 8 horas' }), orden()]);

    const filas = api(componente).filasFiltradas();
    expect(api(componente).accionesDe(filas[0]).map((a) => a.code)).toContain('ver-preparacion');
    expect(api(componente).accionesDe(filas[1]).map((a) => a.code)).not.toContain('ver-preparacion');
  });

  it('todas las acciones de fila llevan texto, ninguna es sólo un ícono', async () => {
    configurar(PROFILE_ID);
    const componente = await mount();
    responder([orden({ hasReleasedResult: true, reportId: id('report'), preparationInstructions: 'Ayuno' })]);

    const acciones = api(componente).accionesDe(api(componente).filasFiltradas()[0]);
    for (const accion of acciones) {
      expect(accion.label.trim().length).toBeGreaterThan(0);
    }
  });

  it('«Ver preparación» abre el diálogo con el texto de la orden', async () => {
    configurar(PROFILE_ID);
    const componente = await mount();
    responder([orden({ preparationInstructions: 'Ayuno de 8 horas' })]);

    api(componente).ejecutarAccion('ver-preparacion', api(componente).filasFiltradas()[0]);
    harness.detectChanges();

    expect(texto()).toContain('Ayuno de 8 horas');
  });

  /* ---- Sin uuids en pantalla -------------------------------------------------- */

  it('no muestra ningún uuid en pantalla', async () => {
    configurar(PROFILE_ID);
    await mount();
    responder(
      [orden({ categoryConceptId: 'cat-lab', codeConceptId: 'c-hemo', statusConceptId: 'st-1' })],
      [
        concepto('cat-lab', 'SRQ-LAB', 'Laboratorio'),
        concepto('c-hemo', 'STUDY-HEMO', 'Hemograma'),
        concepto('st-1', 'ST-COMPLETED', 'Completado'),
      ],
    );

    const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    expect(UUID.test(texto())).toBe(false);
  });
});
