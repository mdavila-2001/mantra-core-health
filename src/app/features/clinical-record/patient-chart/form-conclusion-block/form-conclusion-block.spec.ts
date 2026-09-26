import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { DiagnosisIaClient } from '../../../../core/data-access/triage-ia/diagnosis-ia.client';
import type {
  RespuestaDeFormulario,
  SugerenciaIa,
} from '../../../../core/data-access/triage-ia/diagnosis-ia.types';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import {
  ESPERA_DE_SUGERENCIAS_MS,
  FormConclusionBlock,
  type CierreDelFormulario,
} from './form-conclusion-block';

/**
 * Lo que estas pruebas fijan (D4):
 *
 * 1. **Se pregunta con las respuestas, y sólo con las que tienen texto.** Sin
 *    ninguna, no se llama a nadie.
 * 2. **La IA propone, el catálogo filtra.** «Usar» resuelve el ICD-10-CM por
 *    código exacto o por categoría, y el estudio por LOINC o por etiqueta; sin
 *    correspondencia se avisa y no se elige nada.
 * 3. **El descargo del servicio se muestra siempre que haya sugerencias.**
 * 4. **Sin servicio el cierre sigue a mano**, y elegir a mano emite igual.
 * 5. **Una orden sin categoría no se emite**: se dice qué falta.
 */

const SUGERENCIA: SugerenciaIa = {
  source: 'catalog',
  recognized: true,
  symptoms: [
    { code: 'fiebre', label: 'fiebre' },
    { code: 'tos', label: 'tos' },
  ],
  tentativeDiagnoses: [
    {
      slug: 'neumonia',
      code: 'J18.9',
      codeSystem: 'icd10cm',
      label: 'Neumonía',
      score: 0.63,
      why: 'Por fiebre, tos y dolor de pecho.',
      matchedSymptoms: ['fiebre', 'tos', 'dolor-de-pecho'],
      suggestedTests: [
        {
          slug: 'radiografia-de-torax',
          code: '36643-5',
          codeSystem: 'loinc',
          label: 'Radiografía de tórax',
          category: 'IMAGING',
        },
      ],
    },
    {
      slug: 'faringitis-aguda',
      code: 'J02',
      codeSystem: 'icd10cm',
      label: 'Faringitis aguda',
      score: 0.4,
      why: 'Por tos.',
      matchedSymptoms: ['tos'],
      suggestedTests: [],
    },
    {
      slug: 'enfermedad-rara',
      code: 'Z99.9',
      codeSystem: 'icd10cm',
      label: 'Enfermedad rara',
      score: 0.1,
      why: '',
      matchedSymptoms: [],
      suggestedTests: [],
    },
  ],
  suggestedOrders: [
    {
      slug: 'radiografia-de-torax',
      code: '36643-5',
      codeSystem: 'loinc',
      label: 'Radiografía de tórax',
      category: 'IMAGING',
      forDiagnoses: ['neumonia'],
    },
    {
      slug: 'prueba-desconocida',
      code: '0000-0',
      codeSystem: 'loinc',
      label: 'Prueba que el catálogo no tiene',
      category: 'LAB',
      forDiagnoses: ['enfermedad-rara'],
    },
  ],
  disclaimer:
    'Apoyo al criterio médico; no es un diagnóstico. El diagnóstico nace como presuntivo y lo confirma o rechaza el profesional.',
  knowledgeVersion: 'symptom-check-2862369d+anatomia-v1+glosario-v1-2862369d',
};

const RESPUESTAS: readonly RespuestaDeFormulario[] = [
  { question: '¿Tiene fiebre?', answer: 'sí, 38.5 desde hace tres días' },
  { question: '¿Tiene tos?', answer: '' },
  { question: 'Observaciones', answer: 'tos seca' },
];

/** El catálogo, como lo publica `GET /system-context/dynamic-enums` por target. */
const CATALOGOS: Readonly<
  Record<string, readonly { conceptId: string; code: string; display: string }[]>
> = {
  'clinical.conditions.code_concept_id': [
    { conceptId: 'dx-j069', code: 'J06.9', display: 'Infección respiratoria aguda' },
    { conceptId: 'dx-neumonia', code: 'J18.9', display: 'Neumonía' },
    { conceptId: 'dx-faringitis', code: 'J02.9', display: 'Faringitis aguda' },
  ],
  'clinical.service_requests.code_concept_id': [
    { conceptId: 'st-hemograma', code: 'STUDY-HEMOGRAMA', display: 'Hemograma completo' },
    { conceptId: 'st-rx-torax', code: 'STUDY-RX-TORAX', display: 'Radiografía de tórax' },
  ],
  'clinical.service_requests.category_concept_id': [
    { conceptId: 'cat-lab', code: 'SRQ-LAB', display: 'Laboratorio' },
    { conceptId: 'cat-imaging', code: 'SRQ-IMAGING', display: 'Imagenología' },
  ],
};

describe('FormConclusionBlock', () => {
  let fixture: ComponentFixture<FormConclusionBlock>;
  let componente: FormConclusionBlock;
  let http: HttpTestingController;
  let sugerir: ReturnType<typeof vi.fn>;
  let toasts: ToastService;
  let emitidos: CierreDelFormulario[];

  beforeEach(() => {
    vi.useFakeTimers();
    sugerir = vi.fn(() => of(SUGERENCIA));
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: DiagnosisIaClient, useValue: { sugerir } },
        // Sin espera de verdad: la prueba avanza el reloj falso.
        { provide: ESPERA_DE_SUGERENCIAS_MS, useValue: 0 },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    toasts = TestBed.inject(ToastService);
    fixture = TestBed.createComponent(FormConclusionBlock);
    componente = fixture.componentInstance;
    fixture.componentRef.setInput('nombreDeFicha', 'Ficha de cardiología');
    emitidos = [];
    componente.cierre.subscribe((cierre) => emitidos.push(cierre));
  });

  afterEach(() => {
    vi.useRealTimers();
    http.verify();
  });

  function interno<T>(nombre: string): T {
    const valor = (componente as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(componente) : valor) as T;
  }

  function html(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  /** Responde los catálogos que piden los selectores y el bloque (memoizados por target). */
  function responderCatalogos(): void {
    for (const peticion of http.match((r) => r.url === '/system-context/dynamic-enums')) {
      const target = peticion.request.params.get('target') ?? '';
      peticion.flush({
        code: target,
        name: target,
        definitionId: `def-${target}`,
        valueSetId: `vs-${target}`,
        options: (CATALOGOS[target] ?? []).map((opcion, ordinal) => ({ ...opcion, ordinal })),
      });
    }
  }

  /** Dibuja el bloque con estas respuestas y deja que la espera venza. */
  function responder(respuestas: readonly RespuestaDeFormulario[]): void {
    fixture.componentRef.setInput('respuestas', respuestas);
    fixture.detectChanges();
    responderCatalogos();
    vi.advanceTimersByTime(1);
    fixture.detectChanges();
  }

  it('pregunta con las respuestas que tienen texto, y dibuja los tentativos con su descargo', () => {
    responder(RESPUESTAS);

    expect(sugerir).toHaveBeenCalledTimes(1);
    expect(sugerir).toHaveBeenCalledWith({
      answers: [
        { question: '¿Tiene fiebre?', answer: 'sí, 38.5 desde hace tres días' },
        { question: 'Observaciones', answer: 'tos seca' },
      ],
    });
    const tentativos = html().querySelectorAll('[data-testid="cierre-tentativos"] li');
    expect(tentativos).toHaveLength(3);
    expect(tentativos[0].textContent).toContain('Neumonía');
    expect(tentativos[0].textContent).toContain('J18.9');
    expect(tentativos[0].textContent).toContain('63 %');
    expect(tentativos[0].textContent).toContain('Por fiebre, tos y dolor de pecho.');
    expect(tentativos[0].textContent).toContain('Radiografía de tórax');
    expect(html().querySelector('[data-testid="cierre-disclaimer"]')?.textContent).toContain(
      'no es un diagnóstico',
    );
    expect(html().querySelectorAll('[data-testid="cierre-ordenes"] li')).toHaveLength(2);
  });

  it('sin ninguna respuesta con texto no pregunta nada y lo dice', () => {
    responder([{ question: '¿Tiene fiebre?', answer: '   ' }]);

    expect(sugerir).not.toHaveBeenCalled();
    expect(html().querySelector('[data-testid="cierre-sin-respuestas"]')).not.toBeNull();
    expect(html().querySelector('[data-testid="cierre-tentativos"]')).toBeNull();
  });

  it('«Usar» lleva el tentativo al selector por código exacto y emite el cierre', () => {
    responder(RESPUESTAS);
    const botones = html().querySelectorAll<HTMLButtonElement>(
      '[data-testid="cierre-usar-tentativo"]',
    );

    botones[0].click();
    fixture.detectChanges();

    expect(interno<() => string | null>('diagnostico')()).toBe('dx-neumonia');
    expect(emitidos.at(-1)).toEqual({ diagnostico: 'dx-neumonia', orden: null });
    expect(componente.tieneCambiosPendientes()).toBe(true);
  });

  it('límite: sin código exacto resuelve por la categoría ICD; sin nada, avisa y no elige', () => {
    const aviso = vi.spyOn(toasts, 'warning');
    responder(RESPUESTAS);
    const botones = html().querySelectorAll<HTMLButtonElement>(
      '[data-testid="cierre-usar-tentativo"]',
    );

    // `J02` no está; `J02.9` sí: misma categoría de tres caracteres.
    botones[1].click();
    expect(interno<() => string | null>('diagnostico')()).toBe('dx-faringitis');

    // `Z99.9` no tiene nada parecido en el catálogo: se avisa, no se inventa.
    botones[2].click();
    expect(interno<() => string | null>('diagnostico')()).toBe('dx-faringitis');
    expect(aviso).toHaveBeenCalledTimes(1);
    expect(aviso.mock.calls[0][0]).toContain('Enfermedad rara');
    expect(emitidos).toHaveLength(1);
  });

  it('«Usar» una orden fija la categoría y el estudio por etiqueta, con el concepto de la categoría', () => {
    const aviso = vi.spyOn(toasts, 'warning');
    responder(RESPUESTAS);
    const botones = html().querySelectorAll<HTMLButtonElement>('[data-testid="cierre-usar-orden"]');

    botones[0].click();
    fixture.detectChanges();
    expect(emitidos.at(-1)).toEqual({
      diagnostico: null,
      orden: {
        codeConceptId: 'st-rx-torax',
        category: 'IMAGING',
        categoryConceptId: 'cat-imaging',
      },
    });

    // La que el catálogo no tiene no se elige y no pisa lo elegido.
    botones[1].click();
    expect(aviso).toHaveBeenCalledTimes(1);
    expect(emitidos).toHaveLength(1);
  });

  it('límite: un estudio elegido sin categoría no viaja, y se dice qué falta', () => {
    responder(RESPUESTAS);

    interno<(id: string | null) => void>('elegirEstudio')('st-hemograma');
    fixture.detectChanges();

    expect(emitidos.at(-1)).toEqual({ diagnostico: null, orden: null });
    expect(html().querySelector('[data-testid="cierre-orden-incompleta"]')).not.toBeNull();

    interno<(c: 'LAB' | 'IMAGING' | 'OTHER' | null) => void>('elegirCategoria')('LAB');
    fixture.detectChanges();
    expect(emitidos.at(-1)?.orden).toEqual({
      codeConceptId: 'st-hemograma',
      category: 'LAB',
      categoryConceptId: 'cat-lab',
    });
    expect(html().querySelector('[data-testid="cierre-orden-incompleta"]')).toBeNull();
  });

  it('límite: el servicio responde sin sugerencias y el bloque lo dice', () => {
    sugerir.mockReturnValue(of({ ...SUGERENCIA, tentativeDiagnoses: [], suggestedOrders: [] }));
    responder(RESPUESTAS);

    expect(html().querySelector('[data-testid="cierre-vacio"]')).not.toBeNull();
    expect(html().querySelector('[data-testid="cierre-disclaimer"]')).toBeNull();
  });

  it('inválido: sin servicio se dice, y elegir a mano emite igual', () => {
    sugerir.mockReturnValue(of(null));
    responder(RESPUESTAS);

    expect(html().querySelector('[data-testid="cierre-sin-servicio"]')).not.toBeNull();
    expect(html().querySelector('app-concept-select')).not.toBeNull();

    interno<(id: string | null) => void>('elegirDiagnostico')('dx-j069');
    expect(emitidos.at(-1)).toEqual({ diagnostico: 'dx-j069', orden: null });
  });
});
