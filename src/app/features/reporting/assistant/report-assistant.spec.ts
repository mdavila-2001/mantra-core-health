import { afterEach } from 'vitest';
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError, type Observable } from 'rxjs';

import { formatearValor } from '@core/data-access/reporting/reporting-format';
import { ReportingClient } from '@core/data-access/reporting/reporting.client';
import type { PestanaReporte, VerticalReporte } from '@core/data-access/reporting/reporting.types';

import { PESTANAS, kpi, pestana } from './assistant.fixtures';
import { ReportAssistant } from './report-assistant';
import { ReportContextStore } from '../state/report-context.store';

const BOB = { tipo: 'moneda', moneda: 'BOB' } as const;
/** `texto()` normaliza los espacios (incluido el que separa «Bs» de la cifra): el esperado también. */
const MRR_TEXTO = formatearValor(12345.5, BOB).replace(/\s+/g, ' ');

/** El catálogo del montaje, con cifras reconocibles en los KPI que las pruebas consultan. */
function buildTestData(): Map<VerticalReporte, PestanaReporte> {
  const mapa = new Map<VerticalReporte, PestanaReporte>(PESTANAS.map((p) => [p.pestana, p]));
  mapa.set(
    'suscripciones',
    pestana('suscripciones', [
      kpi('mrr', 'Ingreso recurrente mensual (MRR)', 'Ingreso recurrente mensual de las suscripciones activas.', {
        valor: 12345.5,
        unidad: BOB,
        variacionPct: 4.2,
      }),
      kpi('churn', 'Tasa de cancelación (churn)', 'Suscripciones dadas de baja sobre las activas.', {
        valor: 3.1,
        unidad: { tipo: 'porcentaje' },
        variacionPct: 0.4,
        subirEsMalo: true,
      }),
    ]),
  );
  mapa.set(
    'adquisicion',
    pestana('adquisicion', [
      kpi('cac', 'Costo de adquisición (CAC)', 'Gasto de adquisición dividido entre las altas.', {
        valor: null,
        unidad: BOB,
        motivoSinDato: 'No hubo altas en el periodo.',
      }),
      kpi('conv', 'Tasa de conversión', 'Visitas que terminaron en un registro.'),
    ]),
  );
  return mapa;
}

describe('ReportAssistant', () => {
  let fixture: ComponentFixture<ReportAssistant>;
  let pedir: ReturnType<typeof vi.fn>;
  let datos: Map<VerticalReporte, PestanaReporte>;

  async function montar(
    impl?: (v: VerticalReporte) => Observable<PestanaReporte>,
    /** Corre justo antes de montar el asistente: sirve para poner el foco en otro sitio. */
    antes?: () => void,
  ): Promise<void> {
    datos = buildTestData();
    pedir = vi.fn((v: VerticalReporte) => (impl ? impl(v) : of(datos.get(v) as PestanaReporte)));
    await TestBed.configureTestingModule({
      imports: [ReportAssistant],
      providers: [provideRouter([]), { provide: ReportingClient, useValue: { pestana: pedir } }],
    }).compileComponents();
    antes?.();
    fixture = TestBed.createComponent(ReportAssistant);
    // En el documento de verdad: `focus()` no hace nada sobre un elemento desconectado.
    document.body.appendChild(fixture.nativeElement as HTMLElement);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const texto = (): string => (raiz().textContent ?? '').replace(/\s+/g, ' ');
  const registro = (): HTMLElement => raiz().querySelector('[role="log"]') as HTMLElement;

  function boton(nombre: string | RegExp): HTMLButtonElement {
    const encontrados = [...raiz().querySelectorAll('button')].filter((b) =>
      typeof nombre === 'string' ? (b.textContent ?? '').trim() === nombre : nombre.test(b.textContent ?? ''),
    );
    if (encontrados.length === 0) {
      throw new Error(`no hay botón «${String(nombre)}»`);
    }
    return encontrados[0];
  }

  function escribir(valor: string): void {
    const campo = raiz().querySelector('input.native-input') as HTMLInputElement;
    campo.value = valor;
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
  }

  async function esperar(condicion: () => boolean): Promise<void> {
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(condicion()).toBe(true);
    });
  }

  async function preguntar(pregunta: string): Promise<void> {
    escribir(pregunta);
    boton('Enviar').click();
    fixture.detectChanges();
  }

  beforeEach(() => {
    globalThis.sessionStorage.clear();
  });

  describe('vacío con sugerencias', () => {
    beforeEach(async () => montar());

    it('dice que las respuestas son de ejemplo', () => {
      expect(texto()).toContain('Respuestas de ejemplo');
    });

    it('ofrece cinco preguntas para empezar', () => {
      const chips = raiz().querySelectorAll('ul[aria-label="Preguntas sugeridas"] button');
      expect(chips).toHaveLength(5);
    });

    it('el registro es un log con anuncio cortés y la entrada tiene nombre accesible', () => {
      expect(registro().getAttribute('aria-live')).toBe('polite');
      expect(raiz().querySelector('input.native-input')?.getAttribute('aria-label')).toBeTruthy();
    });

    it('no hace ninguna petición hasta que se pregunta', () => {
      expect(pedir).not.toHaveBeenCalled();
    });

    it('pedir una pregunta vacía orienta en vez de enviar', async () => {
      boton('Enviar').click();
      fixture.detectChanges();
      expect(texto()).toContain('Escriba una pregunta primero');
      expect(pedir).not.toHaveBeenCalled();
    });

    it('focus() lleva el foco a la caja de la pregunta', () => {
      document.body.appendChild(raiz());
      fixture.componentInstance.focus();
      expect(document.activeElement).toBe(raiz().querySelector('input.native-input'));
      raiz().remove();
    });
  });

  describe('responder', () => {
    beforeEach(async () => montar());

    it('cita el mismo número que el KPI, con definición, fuente, frescura y variación', async () => {
      await preguntar('¿Cuál es el MRR?');
      await esperar(() => texto().includes('Ingreso recurrente mensual (MRR)'));

      expect(texto()).toContain(MRR_TEXTO);
      expect(texto()).toContain('Ingreso recurrente mensual de las suscripciones activas.');
      expect(texto()).toContain('fuente de ejemplo');
      expect(texto()).toContain('cada hora');
      expect(texto()).toContain('+4,2 %');
      expect(texto()).toContain('subió');
      expect(texto()).toContain('de toda la plataforma');
      expect(texto()).toContain('Datos de ejemplo');
    });

    it('«Abrir en el reporte» apunta a la pestaña dueña de la medida', async () => {
      await preguntar('cuál es el mrr');
      await esperar(() => raiz().querySelector('a[href="/reports/commercial/suscripciones"]') !== null);
      const enlace = raiz().querySelector('a[href="/reports/commercial/suscripciones"]') as HTMLAnchorElement;
      expect(enlace.textContent).toContain('Abrir en el reporte');
      expect(enlace.getAttribute('aria-label')).toContain('Abrir en el reporte');
    });

    it('la medida sin dato dice «Sin dato» y su motivo, nunca 0', async () => {
      await preguntar('cuál es el CAC');
      await esperar(() => texto().includes('Por qué no hay dato'));
      expect(texto()).toContain('Sin dato');
      expect(texto()).toContain('No hubo altas en el periodo.');
      expect(raiz().querySelector('.respuesta__valor')?.textContent?.trim()).toBe('Valor: Sin dato');
    });

    it('si el alcance es la organización, la respuesta lo dice', async () => {
      TestBed.inject(ReportContextStore).alcance.set('organizacion');
      await preguntar('cuál es el mrr');
      await esperar(() => texto().includes('de su organización'));
      expect(pedir).toHaveBeenCalledWith('suscripciones', expect.objectContaining({ alcance: 'organizacion' }));
    });

    it('usa el contexto actual (moneda y filtros) en la petición y lo cita', async () => {
      const store = TestBed.inject(ReportContextStore);
      store.moneda.set('USD');
      store.alternarFiltro({ dimension: 'plan', valor: 'Pro' });
      await preguntar('mrr');
      await esperar(() => texto().includes('plan: Pro'));
      expect(pedir).toHaveBeenCalledWith('suscripciones', expect.objectContaining({ moneda: 'USD' }));
    });

    it('Enter envía la pregunta', async () => {
      escribir('churn');
      (raiz().querySelector('input.native-input') as HTMLElement).dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
      );
      await esperar(() => texto().includes('Tasa de cancelación (churn)'));
    });

    it('una sugerencia inicial envía su pregunta', async () => {
      boton('¿Cuál es el MRR?').click();
      await esperar(() => texto().includes(MRR_TEXTO));
      expect(raiz().querySelectorAll('ul[aria-label="Preguntas sugeridas"]')).toHaveLength(0);
    });

    it('las preguntas seguidas reutilizan lo ya pedido', async () => {
      await preguntar('mrr');
      await esperar(() => texto().includes(MRR_TEXTO));
      const tras1 = pedir.mock.calls.length;
      await preguntar('churn');
      await esperar(() => texto().includes('Tasa de cancelación (churn)'));
      expect(tras1).toBe(7);
      expect(pedir).toHaveBeenCalledTimes(7);
    });
  });

  describe('medidas que no se pueden contestar', () => {
    beforeEach(async () => montar());

    it('una medida inexistente se dice y sugiere tres cercanas que se pueden pulsar', async () => {
      await preguntar('cuál es el NPS');
      await esperar(() => texto().includes('No tengo esa medida en el catálogo'));
      const sugeridas = raiz().querySelectorAll('ul[aria-label="Medidas posibles"] button');
      expect(sugeridas).toHaveLength(3);

      (sugeridas[0] as HTMLButtonElement).click();
      await esperar(() => raiz().querySelector('.respuesta') !== null);
    });

    it('pedir pacientes se rechaza sin ir a buscar datos', async () => {
      await preguntar('dame los pacientes');
      await esperar(() => texto().includes('no tienen datos de pacientes'));
      expect(pedir).not.toHaveBeenCalled();
    });

    it('SQL o instrucciones se tratan como texto: se muestran y no casan con nada', async () => {
      await preguntar('DROP TABLE users; <b>hola</b>');
      await esperar(() => texto().includes('No tengo esa medida'));
      expect(texto()).toContain('DROP TABLE users; <b>hola</b>');
      expect(raiz().querySelector('.msg--usuario b')).toBeNull();
    });

    it('una pregunta ambigua pide elegir en vez de adivinar', async () => {
      await preguntar('tasa de conversión');
      await esperar(() => texto().includes('Encontré más de una medida parecida'));
      const opciones = [...raiz().querySelectorAll('ul[aria-label="Medidas posibles"] button')];
      expect(opciones.map((b) => b.textContent?.trim()).join('|')).toContain('Publicidad push y pauteo');
      expect(opciones.map((b) => b.textContent?.trim()).join('|')).toContain('Adquisición y cuentas');
    });

    it('sin medidas cargadas dice que no hay nada que consultar', async () => {
      TestBed.resetTestingModule();
      await montar((v) => of(pestana(v, [])));
      await preguntar('mrr');
      await esperar(() => texto().includes('Todavía no hay medidas cargadas'));
    });
  });

  describe('doble envío', () => {
    it('mientras responde, Enviar queda bloqueado y la segunda orden no repite peticiones', async () => {
      const abiertas: Subject<PestanaReporte>[] = [];
      await montar(() => {
        const s = new Subject<PestanaReporte>();
        abiertas.push(s);
        return s;
      });
      await preguntar('mrr');
      await esperar(() => texto().includes('Buscando en sus reportes…'));

      expect(boton('Enviar').getAttribute('aria-disabled')).toBe('true');
      expect(registro().getAttribute('aria-busy')).toBe('true');
      escribir('churn');
      boton('Enviar').click();
      fixture.detectChanges();
      expect(pedir).toHaveBeenCalledTimes(7);
      expect(raiz().querySelectorAll('.msg--usuario')).toHaveLength(1);

      abiertas.forEach((s, i) => {
        s.next(datos.get(['resumen', 'suscripciones', 'publicidad', 'comisiones', 'cobros', 'adquisicion', 'calidad'][i] as VerticalReporte) as PestanaReporte);
        s.complete();
      });
      await esperar(() => texto().includes(MRR_TEXTO));
      expect(boton('Enviar').getAttribute('aria-disabled')).toBe('false');
      expect(texto()).not.toContain('Buscando en sus reportes…');
    });
  });

  describe('errores', () => {
    it('sin conexión explica y permite reintentar; al volver la red responde', async () => {
      let caido = true;
      await montar((v) =>
        caido ? throwError(() => new HttpErrorResponse({ status: 0 })) : of(datos.get(v) as PestanaReporte),
      );
      await preguntar('mrr');
      await esperar(() => texto().includes('Sin conexión'));
      expect(texto()).toContain('Revise su conexión');

      caido = false;
      boton('Reintentar').click();
      await esperar(() => texto().includes(MRR_TEXTO));
      expect(texto()).not.toContain('Sin conexión');
      expect(raiz().querySelectorAll('.msg--usuario')).toHaveLength(1);
    });

    it('un fallo del servidor muestra el código de la petición, no el error crudo', async () => {
      await montar(() =>
        throwError(
          () =>
            new HttpErrorResponse({
              status: 500,
              error: { code: 'INTERNAL', message: 'SQLSTATE 42P01 relation missing', correlationId: 'req-123', timestamp: 't', path: '/p' },
            }),
        ),
      );
      await preguntar('mrr');
      await esperar(() => texto().includes('No se pudo responder'));
      expect(texto()).toContain('req-123');
      expect(texto()).not.toContain('SQLSTATE');
      expect(boton('Reintentar')).toBeTruthy();
    });

    it('sin permiso lo dice y no ofrece reintentar', async () => {
      await montar(() =>
        throwError(
          () =>
            new HttpErrorResponse({
              status: 403,
              error: { code: 'FORBIDDEN', message: 'x', timestamp: 't', path: '/p' },
            }),
        ),
      );
      await preguntar('mrr');
      await esperar(() => texto().includes('Sin permiso'));
      expect(texto()).toContain('no tiene permiso');
      expect(() => boton('Reintentar')).toThrow();
    });

    it('si falla solo una pestaña, contesta con las demás y avisa cuál no pudo revisar', async () => {
      await montar((v) => (v === 'cobros' ? throwError(() => new HttpErrorResponse({ status: 0 })) : of(datos.get(v) as PestanaReporte)));
      await preguntar('mrr');
      await esperar(() => texto().includes(MRR_TEXTO));
      expect(texto()).toContain('No pude revisar: Cobros y caja');
    });
  });

  describe('historial', () => {
    beforeEach(async () => montar());

    it('recuerda las preguntas, las ofrece de nuevo y se puede borrar', async () => {
      await preguntar('mrr');
      await esperar(() => texto().includes(MRR_TEXTO));
      expect(texto()).toContain('Preguntas recientes (1)');
      expect(JSON.parse(globalThis.sessionStorage.getItem('alovida:reportes:asistente:historial:anonymous') ?? '[]')).toEqual(['mrr']);

      boton('Borrar historial').click();
      fixture.detectChanges();
      expect(texto()).not.toContain('Preguntas recientes');
      expect(globalThis.sessionStorage.getItem('alovida:reportes:asistente:historial:anonymous')).toBeNull();
    });

    it('pulsar una pregunta del historial la vuelve a hacer', async () => {
      await preguntar('churn');
      await esperar(() => texto().includes('Tasa de cancelación (churn)'));
      boton('churn').click();
      await esperar(() => raiz().querySelectorAll('.msg--usuario').length === 2);
    });

    it('el panel funciona aunque el almacenamiento esté bloqueado', async () => {
      const roto = (): never => {
        throw new Error('bloqueado');
      };
      vi.stubGlobal('sessionStorage', { getItem: roto, setItem: roto, removeItem: roto });
      try {
        await preguntar('mrr');
        await esperar(() => texto().includes(MRR_TEXTO));
        expect(texto()).toContain('Preguntas recientes (1)');
      } finally {
        vi.unstubAllGlobals();
      }
    });
  });

  describe('historial previo', () => {
    it('al abrir recupera lo que había guardado', async () => {
      globalThis.sessionStorage.setItem('alovida:reportes:asistente:historial:anonymous', JSON.stringify(['cac', 'mrr']));
      await montar();
      await esperar(() => texto().includes('Preguntas recientes (2)'));
    });
  });

  describe('el foco al montarse (el panel carga con @defer después de abrirse)', () => {
    afterEach(() => {
      (fixture.nativeElement as HTMLElement).remove();
      document.querySelectorAll('[data-test-otro]').forEach((e) => e.remove());
    });

    it('con el foco ocioso, lleva el foco al campo de la pregunta', async () => {
      await montar();
      expect(document.activeElement).toBe(raiz().querySelector('input.native-input'));
    });

    it('no le roba el foco a otro campo en el que la persona ya estaba escribiendo', async () => {
      let otro: HTMLInputElement | null = null;
      await montar(undefined, () => {
        otro = document.createElement('input');
        otro.setAttribute('data-test-otro', '');
        document.body.appendChild(otro);
        otro.focus();
      });
      expect(document.activeElement).toBe(otro);
      expect(document.activeElement).not.toBe(raiz().querySelector('input.native-input'));
    });
  });
});
