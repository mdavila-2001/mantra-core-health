import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { API_BASE_URL } from '../../../core/data-access/api';
import { SurveyInsightsPanel } from './survey-insights';

/* ============================================================================
    «Cómo le va» — lo que se ve en cada estado.

    1. Con datos: las cinco cifras, el desglose del NPS y las barras por pregunta,
       con el `n` siempre a la vista.
    2. Suprimido por el servidor (menos de 5 respuestas, `privacy.suppressed`):
       sólo totales, el motivo, cuántas lleva y cómo ampliarlo; NINGÚN gráfico.
    3. Vacío (S3): dice por qué y la próxima acción AFLOJA el filtro.
    4. Error (S9): reintento, y el reintento vuelve a pedir lo mismo.
    5. Cambiar de período o de servicio pide de nuevo, con los parámetros que son.
    ========================================================================== */

interface Parcial {
  issued?: number;
  answered?: number;
  nps?: { value: number | null; promoters: number; passives: number; detractors: number; n: number };
  safety?: number;
  comments?: { text: string }[];
}

/** Lo que manda la API con menos de 5 respuestas: totales y nada más. */
function cuerpoSuprimido(issued: number, answered: number): Record<string, unknown> {
  return {
    privacy: { minCohort: 5, suppressed: true },
    totals: { issued, answered, responseRate: issued === 0 ? 0 : answered / issued },
    nps: { value: null, promoters: 0, passives: 0, detractors: 0, n: 0 },
    byQuestion: [],
    trend: [],
    safetyAlerts: { n: 0 },
    comments: [],
  };
}

/** Cinco comentarios: el mínimo con el que el servidor los manda. */
const CINCO_COMENTARIOS = [
  'Muy buena atención.',
  'Todo bien, sólo mejoraría la puntualidad.',
  'Rápido y profesional.',
  'La sala de espera estaba llena.',
  'Excelente trato.',
].map((text) => ({ text }));

function cuerpo(p: Parcial = {}): Record<string, unknown> {
  return {
    privacy: { minCohort: 5, suppressed: false },
    totals: { issued: p.issued ?? 20, answered: p.answered ?? 12, responseRate: 0.6 },
    nps: p.nps ?? { value: 33, promoters: 6, passives: 4, detractors: 2, n: 12 },
    byQuestion: [
      {
        questionId: 'q-sat',
        text: 'En general, ¿cómo calificaría su experiencia con esta consulta?',
        dimension: 'satisfaccion_global',
        answerType: 'SCALE',
        suppressed: false,
        n: p.answered ?? 12,
        average: 4.25,
        distribution: [
          { value: 1, count: 0 },
          { value: 2, count: 1 },
          { value: 3, count: 1 },
          { value: 4, count: 4 },
          { value: 5, count: 6 },
        ],
      },
      {
        questionId: 'q-espera',
        text: 'Desde la hora acordada, ¿cuánto tiempo esperó?',
        dimension: 'tiempo_espera',
        answerType: 'SINGLE_CHOICE',
        suppressed: false,
        n: 12,
        average: null,
        optionCounts: [
          { option: 'Menos de 15 minutos', count: 8 },
          { option: 'Más de 1 hora', count: 4 },
        ],
      },
    ],
    trend: [
      { period: '2026-10-12', answered: 4, average: 4.5 },
      { period: '2026-10-19', answered: 8, average: 4.1 },
    ],
    safetyAlerts: { n: p.safety ?? 0 },
    comments: p.comments ?? CINCO_COMENTARIOS,
  };
}

describe('SurveyInsightsPanel · «Cómo le va»', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<SurveyInsightsPanel>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: '' },
        provideRouter([]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(SurveyInsightsPanel);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const buscar = (testId: string): HTMLElement | null => raiz().querySelector(`[data-testid="${testId}"]`);
  const texto = (testId: string): string => (buscar(testId)?.textContent ?? '').replace(/\s+/g, ' ').trim();

  /** Responde los servicios del médico (la lectura que acompaña a la primera). */
  function responderServicios(): void {
    http
      .expectOne((r) => r.url === '/scheduling/service-offerings')
      .flush({
        items: [
          { id: 'o-1', practitionerProfileId: 'p', serviceCatalogId: 'cat-ecg', serviceCode: 'ECG', serviceName: 'Electrocardiograma', price: '1.00', minDurationMinutes: 1, maxDurationMinutes: 2, prepMinutes: 0, cleanupMinutes: 0, isPatientBookable: true, requiresApproval: false, isActive: true },
        ],
      });
  }

  /** Responde el resumen pendiente y devuelve los parámetros con los que se pidió. */
  function responderResumen(body: Record<string, unknown>): URLSearchParams {
    const pedido = http.expectOne((r) => r.url === '/surveys/insights');
    const params = new URLSearchParams(pedido.request.params.toString());
    pedido.flush(body);
    fixture.detectChanges();
    return params;
  }

  /** `from` y `to` de un pedido, ya leídos. */
  const meses = (params: URLSearchParams): number => {
    const [fa, fm, fd] = params.get('from')!.split('-').map(Number) as [number, number, number];
    const [ta, tm, td] = params.get('to')!.split('-').map(Number) as [number, number, number];
    // Meses calendario completos: día 1 hasta el último día del mes.
    expect(fd).toBe(1);
    expect(td).toBe(new Date(ta, tm, 0).getDate());
    return (ta - fa) * 12 + (tm - fm) + 1;
  };

  it('al abrir pide los últimos 3 meses calendario de TODO, sin serviceId y sin horas', () => {
    responderServicios();
    const params = responderResumen(cuerpo());
    expect(params.has('serviceId')).toBe(false);
    expect(params.get('from')).toMatch(/^\d{4}-\d{2}-01$/);
    expect(params.get('to')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(meses(params)).toBe(3);
  });

  it('ofrece sólo tres períodos: Este mes, 3 meses y 12 meses', () => {
    const rotulos = Array.from(raiz().querySelectorAll('[role="radio"]')).map((b) => b.textContent!.trim());
    expect(rotulos).toEqual(['Este mes', '3 meses', '12 meses']);
    responderServicios();
    responderResumen(cuerpo());
  });

  it('mientras carga muestra el esqueleto y los filtros siguen a la vista', () => {
    expect(buscar('resumen-cargando')).not.toBeNull();
    expect(buscar('resumen-filtros')).not.toBeNull();
    responderServicios();
    responderResumen(cuerpo());
    expect(buscar('resumen-cargando')).toBeNull();
  });

  it('con datos: las cifras llevan su n y el NPS su semáforo escrito', () => {
    responderServicios();
    responderResumen(cuerpo());

    expect(texto('kpi-respuestas')).toContain('12');
    expect(texto('kpi-respuestas')).toContain('de 20 enviadas');
    expect(texto('kpi-tasa')).toContain('60%');
    expect(texto('kpi-nps')).toContain('+33');
    expect(texto('kpi-nps')).toContain('Bueno');
    expect(texto('kpi-nps')).toContain('n = 12');
    expect(texto('kpi-satisfaccion')).toContain('4,3 / 5');
    expect(texto('kpi-satisfaccion')).toContain('n = 12');
    expect(texto('kpi-alertas')).toContain('Nadie reportó problemas');

    const desglose = texto('resumen-nps-desglose');
    expect(desglose).toContain('Promotores');
    expect(desglose).toContain('6 · 50%');
    expect(desglose).toContain('Detractores');
    expect(desglose).toContain('2 · 17%');
  });

  it('las barras por pregunta traen n, promedio y una cifra escrita en cada barra', () => {
    responderServicios();
    responderResumen(cuerpo());
    const preguntas = raiz().querySelectorAll('[data-testid="resumen-pregunta"]');
    expect(preguntas).toHaveLength(2);
    // Van en el orden del cuestionario base: primero la espera, después la satisfacción.
    const textos = Array.from(preguntas).map((p) => p.textContent!.replace(/\s+/g, ' '));
    const satisfaccion = textos.find((t) => t.includes('Satisfacción global'))!;
    expect(satisfaccion).toBeDefined();
    expect(satisfaccion).toContain('Satisfacción global');
    expect(satisfaccion).toContain('n = 12');
    expect(satisfaccion).toContain('promedio 4,3 de 5');
    expect(satisfaccion).toContain('6 · 50%');
    // Las opciones de una elección salen con su texto, no con un índice.
    expect(textos.find((t) => t.includes('Tiempo de espera'))).toContain('Menos de 15 minutos');
  });

  it('la tendencia tiene una tabla equivalente', () => {
    responderServicios();
    responderResumen(cuerpo());
    const tabla = buscar('resumen-tendencia')!.querySelector('table')!;
    expect(tabla.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(tabla.textContent).toContain('Semana del 12 de oct de 2026');
  });

  it('los comentarios van bajo «Comentarios del período», sin fecha ni mes y sin orden implícito', () => {
    responderServicios();
    responderResumen(cuerpo());
    const bloque = texto('resumen-comentarios');
    expect(bloque).toContain('Comentarios del período');
    expect(bloque).not.toContain('Comentarios recientes');
    expect(bloque).toContain('Muy buena atención.');
    expect(raiz().querySelectorAll('.comentario')).toHaveLength(5);
    // Ninguna fecha, ni mes ni día, junto a los comentarios.
    expect(bloque).not.toMatch(/\b(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\b/i);
    expect(bloque).not.toMatch(/\d{4}/);
    // Cada comentario es su texto y nada más.
    for (const c of Array.from(raiz().querySelectorAll('.comentario'))) {
      expect(c.children).toHaveLength(1);
    }
  });

  it('con alertas de seguridad dice cuántas piden seguimiento', () => {
    responderServicios();
    responderResumen(cuerpo({ safety: 2 }));
    expect(texto('kpi-alertas')).toContain('2');
    expect(texto('kpi-alertas')).toContain('respuestas piden seguimiento');
  });

  it('un NPS sin valor se dice «sin datos suficientes», no como un cero', () => {
    responderServicios();
    responderResumen(cuerpo({ nps: { value: null, promoters: 0, passives: 0, detractors: 0, n: 0 } }));
    expect(texto('kpi-nps')).toContain('Sin datos suficientes');
    expect(texto('kpi-nps')).not.toContain('+0');
    expect(texto('resumen-nps-sin-datos')).toContain('al menos 5 respuestas');
    // Sin valor no hay desglose que dibujar.
    expect(buscar('resumen-nps-desglose')).toBeNull();
  });

  it('una pregunta suprimida llega sin barras y dice por qué', () => {
    responderServicios();
    const base = cuerpo();
    const preguntas = base['byQuestion'] as Record<string, unknown>[];
    preguntas.push({
      questionId: 'q-suprimida',
      text: 'En esta consulta, ¿con qué frecuencia el profesional le escuchó con atención?',
      dimension: 'comunicacion',
      answerType: 'SCALE',
      suppressed: true,
    });
    responderResumen(base);
    const items = Array.from(raiz().querySelectorAll('[data-testid="resumen-pregunta"]')) as HTMLElement[];
    const suprimida = items.find((i) => i.textContent!.includes('Escucha'))!;
    expect(suprimida.querySelector('[data-testid="resumen-pregunta-suprimida"]')?.textContent).toContain('Sin datos suficientes');
    expect(suprimida.querySelectorAll('.barras__fila')).toHaveLength(0);
    // Y no inventa un n ni un promedio.
    expect(suprimida.textContent).not.toContain('promedio');
    expect(suprimida.textContent).not.toMatch(/n\s=\s\d/);
  });

  it('sin 5 comentarios el servidor no manda ninguno y se dice por qué, sin un bloque vacío engañoso', () => {
    responderServicios();
    responderResumen(cuerpo({ comments: [] }));
    expect(texto('resumen-comentarios-reservados')).toContain('al menos 5 comentarios');
    expect(raiz().querySelectorAll('.comentario')).toHaveLength(0);
  });

  describe('suprimido por el servidor (menos de 5 respuestas)', () => {
    beforeEach(() => {
      responderServicios();
      responderResumen(cuerpoSuprimido(6, 3));
    });

    it('dice por qué, el mínimo y cuántas lleva', () => {
      const aviso = texto('resumen-suprimido-aviso');
      expect(aviso).toContain('Todavía no hay suficientes respuestas para mostrar el resumen');
      expect(aviso).toContain('se necesitan al menos 5 en este período');
      expect(aviso).toContain('para proteger la privacidad de sus pacientes');
      expect(aviso).toContain('llevan 3');
    });

    it('muestra SÓLO los totales: dos cifras, sin NPS, satisfacción ni alertas', () => {
      expect(raiz().querySelectorAll('app-metric-card')).toHaveLength(2);
      expect(texto('kpi-respuestas')).toContain('3');
      expect(texto('kpi-respuestas')).toContain('de 6 enviadas');
      expect(texto('kpi-tasa')).toContain('50%');
      for (const kpi of ['nps', 'satisfaccion', 'alertas']) expect(buscar(`kpi-${kpi}`)).toBeNull();
    });

    it('no dibuja gráficos vacíos que parezcan un resultado', () => {
      for (const seccion of ['resumen-nps', 'resumen-preguntas', 'resumen-tendencia', 'resumen-comentarios']) {
        expect(buscar(seccion), seccion).toBeNull();
      }
      expect(buscar('resumen-contenido')).toBeNull();
      expect(buscar('resumen-pocas')).toBeNull();
    });

    it('NO es el vacío S3: ese es para cero respuestas', () => {
      expect(buscar('resumen-vacio')).toBeNull();
    });

    it('la próxima acción amplía el período y vuelve a pedir', () => {
      expect(texto('resumen-suprimido-accion')).toBe('Ver los últimos 12 meses');
      (buscar('resumen-suprimido-accion') as HTMLButtonElement).click();
      const params = responderResumen(cuerpo());
      const dias = (Date.parse(params.get('to')!) - Date.parse(params.get('from')!)) / 86_400_000;
      expect(dias).toBeGreaterThanOrEqual(364);
      expect(buscar('resumen-contenido')).not.toBeNull();
    });

    it('usa el mínimo que declara el servidor, no uno propio', () => {
      fixture.componentInstance['elegirServicio']('cat-ecg');
      responderResumen({ ...cuerpoSuprimido(8, 2), privacy: { minCohort: 10, suppressed: true } });
      expect(texto('resumen-suprimido-aviso')).toContain('al menos 10');
    });
  });

  it('un servidor que todavía no manda `privacy` no esconde nada', () => {
    responderServicios();
    const { privacy: _omitido, ...sinPrivacy } = cuerpo();
    responderResumen(sinPrivacy);
    expect(buscar('resumen-contenido')).not.toBeNull();
    expect(buscar('resumen-suprimido')).toBeNull();
  });

  it('S3: sin ninguna respuesta (aunque el servidor suprima) dice por qué y ofrece ampliar el período', () => {
    responderServicios();
    responderResumen(cuerpoSuprimido(0, 0));
    const vacio = texto('resumen-vacio');
    expect(vacio).toContain('Todavía no recibió respuestas');
    expect(vacio).toContain('se envían solas al terminar cada consulta');
    expect(buscar('resumen-contenido')).toBeNull();
    expect(texto('resumen-vacio-accion')).toBe('Ver los últimos 12 meses');
    // Los filtros siguen: hay con qué aflojar.
    expect(buscar('resumen-filtros')).not.toBeNull();
  });

  it('S3: si se enviaron pero nadie respondió, lo dice', () => {
    responderServicios();
    responderResumen(cuerpoSuprimido(7, 0));
    expect(texto('resumen-vacio')).toContain('Se enviaron 7 encuestas en este período y todavía nadie respondió');
  });

  it('S3: la acción «ver 12 meses» vuelve a pedir con el rango largo', () => {
    responderServicios();
    responderResumen(cuerpoSuprimido(0, 0));
    (buscar('resumen-vacio-accion') as HTMLButtonElement).click();
    const params = responderResumen(cuerpo());
    const dias = (Date.parse(params.get('to')!) - Date.parse(params.get('from')!)) / 86_400_000;
    expect(dias).toBeGreaterThanOrEqual(364);
  });

  it('cambiar de período pide de nuevo con ese rango, siempre en meses calendario', () => {
    responderServicios();
    responderResumen(cuerpo());
    const tocar = (rotulo: string): void => {
      const opcion = Array.from(raiz().querySelectorAll<HTMLElement>('[role="radio"]')).find(
        (b) => b.textContent!.trim() === rotulo,
      )!;
      opcion.click();
      fixture.detectChanges();
    };

    tocar('Este mes');
    expect(buscar('resumen-cargando')).not.toBeNull();
    expect(meses(responderResumen(cuerpo()))).toBe(1);

    tocar('12 meses');
    expect(meses(responderResumen(cuerpo()))).toBe(12);

    tocar('3 meses');
    expect(meses(responderResumen(cuerpo()))).toBe(3);
  });

  it('elegir un servicio manda su billing.service_catalog.id, no el de la oferta', () => {
    responderServicios();
    responderResumen(cuerpo());
    fixture.componentInstance['elegirServicio']('cat-ecg');
    const params = responderResumen(cuerpo());
    expect(params.get('serviceId')).toBe('cat-ecg');
  });

  it('volver a «Todas mis consultas» quita serviceId del pedido', () => {
    responderServicios();
    responderResumen(cuerpo());
    fixture.componentInstance['elegirServicio']('cat-ecg');
    responderResumen(cuerpo());
    fixture.componentInstance['elegirServicio'](null);
    expect(responderResumen(cuerpo()).has('serviceId')).toBe(false);
  });

  it('S9: un error del servidor ofrece reintentar y el reintento pide lo mismo', () => {
    responderServicios();
    http
      .expectOne((r) => r.url === '/surveys/insights')
      .flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(raiz().textContent).toContain('Algo salió mal');
    const reintentar = Array.from(raiz().querySelectorAll('button')).find((b) => b.textContent!.includes('Reintentar'))!;
    reintentar.click();
    responderResumen(cuerpo());
    expect(buscar('resumen-contenido')).not.toBeNull();
  });

  it('si la lista de servicios falla, el filtro sigue sirviendo con «Todas»', () => {
    http
      .expectOne((r) => r.url === '/scheduling/service-offerings')
      .flush({ message: 'x' }, { status: 500, statusText: 'Server Error' });
    responderResumen(cuerpo());
    expect(buscar('resumen-contenido')).not.toBeNull();
  });
});
