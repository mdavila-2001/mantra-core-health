import type {
  ChartNote,
  ClinicalSummary,
  Condition,
} from '../../../core/data-access/clinical/clinical.types';
import type { PatientOrder } from '../../../core/data-access/diagnostics/diagnostics.types';
import {
  CODIGO_ACTIVA,
  CODIGO_CONFIRMADO,
  CODIGO_CURSO_CRONICO,
  CODIGO_DESCARTADO,
  CODIGO_REMISION,
  CODIGO_RESUELTA,
  diagnosisStateOf,
  DIAGNOSIS_STATE_LABELS,
} from '../../../shared/clinical/diagnosis-state';
import {
  atencionesDeLaHistoria,
  bloquesDeDiagnosticos,
  seccionesNuevasDeLaHistoria,
} from './history-view-model';

/**
 * Carril C6 · la clasificación de un diagnóstico y el armado de la línea.
 *
 * Funciones puras: sin TestBed, sin DOM y sin red. Lo que fijan:
 *
 * 1. **El bloque se decide por CÓDIGO de catálogo, no por etiqueta.** La
 *    etiqueta es metadato de presentación y puede cambiar sin aviso; ramificar
 *    por ella haría que un retoque de redacción moviera una enfermedad de
 *    columna.
 * 2. **El kill-test**: `DXV-REFUTED` nunca es una enfermedad activa, ni
 *    siquiera cuando el estado clínico dice `COND-ACTIVE`.
 * 3. **La clasificación es total.** Un diagnóstico que no cayera en ningún
 *    bloque desaparecería de la historia, y nadie lo iría a buscar.
 * 4. **Lo que C1–C4 no dejaron se omite sin romper**, en los tres niveles del
 *    contrato: con el dato, en el borde, y sin el dato.
 */

/** El catálogo del entorno de prueba: identificador → código publicado. */
const CODIGOS = new Map<string, string>([
  ['id-confirmado', CODIGO_CONFIRMADO],
  ['id-descartado', CODIGO_DESCARTADO],
  ['id-provisional', 'DXV-PROVISIONAL'],
  ['id-diferencial', 'DXV-DIFFERENTIAL'],
  ['id-activa', CODIGO_ACTIVA],
  ['id-resuelta', CODIGO_RESUELTA],
  ['id-remision', CODIGO_REMISION],
  ['id-cronica', CODIGO_CURSO_CRONICO],
]);

const codigo = (id: string | undefined): string | undefined =>
  id === undefined ? undefined : CODIGOS.get(id);

/** Las etiquetas del mismo catálogo, para lo que se pinta. */
const ETIQUETAS = new Map<string, string>([
  ['id-confirmado', 'Confirmado'],
  ['id-descartado', 'Descartado'],
  ['id-provisional', 'Provisional'],
  ['id-activa', 'Activa'],
  ['id-resuelta', 'Resuelta'],
  ['id-remision', 'En remisión'],
  ['con-hta', 'Hipertensión'],
  ['med-losartan', 'Losartán'],
  ['lab-hemograma', 'Hemograma'],
  ['cat-lab', 'Análisis de laboratorio'],
  ['st-cumplida', 'Cumplida'],
]);

const etiqueta = (id: string | undefined): string =>
  (id === undefined ? undefined : ETIQUETAS.get(id)) ?? 'Sin registrar';

function condicion(campos: Partial<Condition> = {}): Condition {
  return {
    id: 'dx-1',
    codeConceptId: 'con-hta',
    createdAt: new Date(2026, 1, 1),
    ...campos,
  };
}

describe('diagnosisStateOf', () => {
  it('confirmado y activo es una enfermedad activa', () => {
    expect(
      diagnosisStateOf(
        condicion({
          verificationStatusConceptId: 'id-confirmado',
          clinicalStatusConceptId: 'id-activa',
        }),
        codigo,
      ),
    ).toBe('activa');
  });

  it('provisional o diferencial está en estudio', () => {
    expect(
      diagnosisStateOf(condicion({ verificationStatusConceptId: 'id-provisional' }), codigo),
    ).toBe('en-estudio');
    expect(
      diagnosisStateOf(condicion({ verificationStatusConceptId: 'id-diferencial' }), codigo),
    ).toBe('en-estudio');
  });

  /**
   * **El kill-test del carril.** Activo en lo clínico y descartado en la
   * certeza: si el bloque se decidiera por el estado clínico, este diagnóstico
   * aparecería como una enfermedad que la persona no tiene.
   */
  it('descartado es histórico aunque el estado clínico diga que está activo', () => {
    expect(
      diagnosisStateOf(
        condicion({
          verificationStatusConceptId: 'id-descartado',
          clinicalStatusConceptId: 'id-activa',
        }),
        codigo,
      ),
    ).toBe('historico');
  });

  it('resuelto es histórico, por el estado clínico o por la fecha de resolución', () => {
    expect(diagnosisStateOf(condicion({ clinicalStatusConceptId: 'id-resuelta' }), codigo)).toBe(
      'historico',
    );
    expect(
      diagnosisStateOf(
        condicion({
          verificationStatusConceptId: 'id-confirmado',
          resolvedAt: new Date(2026, 8, 3),
        }),
        codigo,
      ),
    ).toBe('historico');
  });

  it('en remisión es histórico: dejó de ser una enfermedad activa', () => {
    expect(
      diagnosisStateOf(
        condicion({
          verificationStatusConceptId: 'id-confirmado',
          clinicalStatusConceptId: 'id-remision',
        }),
        codigo,
      ),
    ).toBe('historico');
  });

  /** El nivel inválido del contrato: el catálogo no resuelve nada. */
  it('sin certeza declarada cae en estudio, que es la afirmación más débil', () => {
    expect(diagnosisStateOf(condicion(), codigo)).toBe('en-estudio');
    expect(
      diagnosisStateOf(condicion({ verificationStatusConceptId: 'id-inexistente' }), codigo),
    ).toBe('en-estudio');
  });

  it('los tres bloques tienen nombre para quien lee su historia', () => {
    expect(DIAGNOSIS_STATE_LABELS['en-estudio']).toBe('En estudio');
    expect(DIAGNOSIS_STATE_LABELS.activa).toBe('Enfermedades activas');
    expect(DIAGNOSIS_STATE_LABELS.historico).toBe('Históricos');
  });
});

describe('bloquesDeDiagnosticos', () => {
  it('devuelve los tres bloques aunque no haya ni un diagnóstico', () => {
    const bloques = bloquesDeDiagnosticos([], etiqueta, codigo);

    expect(bloques.map((bloque) => bloque.testId)).toEqual([
      'historia-en-estudio',
      'historia-activas',
      'historia-historicos',
    ]);
    expect(bloques.every((bloque) => bloque.filas.length === 0)).toBe(true);
    // Cada vacío orienta en vez de quedarse mudo.
    expect(bloques.every((bloque) => bloque.vacio !== '')).toBe(true);
  });

  /** El nivel correcto: con fecha esperada de resolución, se dice hasta cuándo. */
  it('una enfermedad activa con plazo dice hasta cuándo', () => {
    const [, activas] = bloquesDeDiagnosticos(
      [
        condicion({
          verificationStatusConceptId: 'id-confirmado',
          clinicalStatusConceptId: 'id-activa',
          expectedResolutionAt: new Date(Date.UTC(2026, 10, 24)),
        }),
      ],
      etiqueta,
      codigo,
    );

    const duracion = activas!.filas[0]!.hechos.find((hecho) => hecho.etiqueta === 'Duración');
    expect(duracion?.valor).toBe('hasta el 24/11/2026');
  });

  /** El nivel límite: curso crónico gana sobre cualquier fecha esperada. */
  it('un curso crónico dice «crónica» y no una fecha', () => {
    const [, activas] = bloquesDeDiagnosticos(
      [
        condicion({
          verificationStatusConceptId: 'id-confirmado',
          clinicalCourseConceptId: 'id-cronica',
          expectedResolutionAt: new Date(Date.UTC(2026, 10, 24)),
        }),
      ],
      etiqueta,
      codigo,
    );

    expect(activas!.filas[0]!.hechos.find((h) => h.etiqueta === 'Duración')?.valor).toBe('crónica');
  });

  /** El nivel inválido: sin curso ni plazo, no se inventa ninguno. */
  it('sin curso ni plazo no inventa una duración', () => {
    const [, activas] = bloquesDeDiagnosticos(
      [condicion({ verificationStatusConceptId: 'id-confirmado' })],
      etiqueta,
      codigo,
    );

    expect(activas!.filas[0]!.hechos.some((hecho) => hecho.etiqueta === 'Duración')).toBe(false);
  });

  it('un histórico dice por qué: la fecha de resolución, o el estado que lo cerró', () => {
    const [, , historicos] = bloquesDeDiagnosticos(
      [
        condicion({ id: 'a', resolvedAt: new Date(Date.UTC(2026, 8, 3)) }),
        condicion({ id: 'b', verificationStatusConceptId: 'id-descartado' }),
      ],
      etiqueta,
      codigo,
    );

    const porque = historicos!.filas.map(
      (fila) => fila.hechos.find((hecho) => hecho.etiqueta === 'Por qué')?.valor,
    );
    expect(porque).toEqual(['resuelto el 03/09/2026', 'Descartado']);
  });

  /**
   * El histórico no lleva plazo: una fecha esperada de resolución en algo ya
   * cerrado se leería como que todavía falta.
   */
  it('un histórico no muestra duración aunque la condición traiga un plazo', () => {
    const [, , historicos] = bloquesDeDiagnosticos(
      [
        condicion({
          verificationStatusConceptId: 'id-descartado',
          expectedResolutionAt: new Date(Date.UTC(2026, 10, 24)),
        }),
      ],
      etiqueta,
      codigo,
    );

    expect(historicos!.filas[0]!.hechos.some((hecho) => hecho.etiqueta === 'Duración')).toBe(false);
  });
});

/* ---- la línea del encuentro y sus degradaciones -------------------------- */

const ENCUENTRO = {
  id: 'e-1',
  statusConceptId: 'st-1',
  reasonText: 'Dolor de garganta',
  startAt: new Date(2026, 2, 1, 10, 0),
  endAt: new Date(2026, 2, 1, 10, 40),
};

function resumen(campos: Partial<ClinicalSummary> = {}): ClinicalSummary {
  return {
    patientProfileId: 'pp-1',
    conditions: [],
    allergies: [],
    medicationRequests: [],
    observations: [],
    encounters: [ENCUENTRO],
    careEpisodes: [],
    limit: 50,
    truncated: [],
    ...campos,
  };
}

const NOTA_LIBERADA: ChartNote = {
  noteId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeea1b2',
  encounterId: 'e-1',
  lifecycleStatusConceptId: 'st-1',
  chiefComplaintText: 'Odinofagia',
  releasedToPatient: true,
  createdAt: new Date(2026, 2, 1, 10, 15),
};

const ORDEN: PatientOrder = {
  id: 'o-1',
  encounterId: 'e-1',
  codeConceptId: 'lab-hemograma',
  categoryConceptId: 'cat-lab',
  statusConceptId: 'st-cumplida',
  hasReleasedResult: true,
  createdAt: new Date(2026, 2, 1, 10, 25),
};

describe('atencionesDeLaHistoria', () => {
  it('reparte cada hecho en la atención que lo registró', () => {
    const [atencion] = atencionesDeLaHistoria(
      resumen({
        conditions: [
          condicion({ encounterId: 'e-1', verificationStatusConceptId: 'id-confirmado' }),
        ],
        medicationRequests: [
          {
            id: 'm-1',
            medicationConceptId: 'med-losartan',
            statusConceptId: 'st-1',
            encounterId: 'e-1',
            indicationConditionId: 'dx-1',
            doseText: '50 mg',
            createdAt: new Date(2026, 2, 1, 10, 30),
          },
        ],
      }),
      { notas: [NOTA_LIBERADA], ordenes: [ORDEN], citas: [] },
      etiqueta,
      codigo,
    );

    expect(atencion!.titulo).toContain('Dolor de garganta');
    expect(atencion!.sello).toBe('Cerrada');
    expect(atencion!.notas[0]!.rotulo).toBe('Nota #a1b2');
    expect(atencion!.ordenes[0]!.categoria).toBe('Análisis de laboratorio');
    expect(atencion!.diagnosticos[0]!.estado).toBe('Diagnóstico confirmado');
    // La receta dice su motivo por el diagnóstico que la justifica.
    expect(atencion!.recetas[0]!.indicacion).toBe('Hipertensión');
  });

  /** Nivel inválido del contrato de la nota: el profesional no la liberó. */
  it('una nota no liberada al paciente no entra en la línea', () => {
    const [atencion] = atencionesDeLaHistoria(
      resumen(),
      { notas: [{ ...NOTA_LIBERADA, releasedToPatient: false }], ordenes: [], citas: [] },
      etiqueta,
      codigo,
    );

    expect(atencion!.notas).toEqual([]);
  });

  /** Nivel límite: lo que C1–C4 no dejaron se omite sin romper. */
  it('sin notas, sin órdenes y sin recetas la atención se arma igual', () => {
    const [atencion] = atencionesDeLaHistoria(
      resumen(),
      { notas: [], ordenes: [], citas: [] },
      etiqueta,
      codigo,
    );

    expect(atencion!.notas).toEqual([]);
    expect(atencion!.ordenes).toEqual([]);
    expect(atencion!.recetas).toEqual([]);
    expect(atencion!.encabezado.motivo).toBe('Dolor de garganta');
  });

  it('una atención sin fecha ni motivo no inventa ninguno de los dos', () => {
    const [atencion] = atencionesDeLaHistoria(
      resumen({ encounters: [{ id: 'e-9', statusConceptId: 'st-1' }] }),
      { notas: [], ordenes: [], citas: [] },
      etiqueta,
      codigo,
    );

    expect(atencion!.titulo).toBe('Consulta');
    expect(atencion!.encabezado.cuando).toBeNull();
    expect(atencion!.sello).toBe('En curso');
  });

  /** Una receta sin diagnóstico asociado cae en su texto libre, no en un uuid. */
  it('una receta sin diagnóstico usa el motivo escrito', () => {
    const [atencion] = atencionesDeLaHistoria(
      resumen({
        medicationRequests: [
          {
            id: 'm-1',
            medicationConceptId: 'med-losartan',
            statusConceptId: 'st-1',
            encounterId: 'e-1',
            indicationText: 'Control de presión',
            createdAt: new Date(2026, 2, 1, 10, 30),
          },
        ],
      }),
      { notas: [], ordenes: [], citas: [] },
      etiqueta,
      codigo,
    );

    expect(atencion!.recetas[0]!.indicacion).toBe('Control de presión');
  });
});

describe('seccionesNuevasDeLaHistoria', () => {
  it('el papel dice lo mismo que la pantalla, bloque por bloque', () => {
    const condiciones = [
      condicion({ id: 'a', verificationStatusConceptId: 'id-confirmado', encounterId: 'e-1' }),
      condicion({ id: 'b', verificationStatusConceptId: 'id-descartado' }),
    ];
    const bloques = bloquesDeDiagnosticos(condiciones, etiqueta, codigo);
    const atenciones = atencionesDeLaHistoria(
      resumen({ conditions: condiciones }),
      { notas: [NOTA_LIBERADA], ordenes: [ORDEN], citas: [] },
      etiqueta,
      codigo,
    );

    const secciones = seccionesNuevasDeLaHistoria(bloques, atenciones);

    expect(secciones.diagnosticos.activas.map((fila) => fila.nombre)).toEqual(['Hipertensión']);
    expect(secciones.diagnosticos.historicos.map((fila) => fila.certeza)).toEqual(['Descartado']);
    // El kill-test, también en el papel.
    expect(secciones.diagnosticos.activas.map((fila) => fila.certeza)).not.toContain('Descartado');
    // Y la línea sale en el mismo orden que la dibuja el organismo: **por
    // instante**. El diagnóstico se registró el 1 de febrero y la consulta fue
    // el 1 de marzo, así que va primero aunque el orden del relato lo ponga
    // detrás de la nota — el tiempo manda sobre el tipo, y el desempate por
    // tipo sólo entra a igualdad de instante.
    expect(secciones.lineas[0]!.hechos.map((hecho) => hecho.titulo)).toEqual([
      'Diagnóstico confirmado: Hipertensión',
      'Nota #a1b2',
      'Análisis de laboratorio: Hemograma',
    ]);
  });
});
