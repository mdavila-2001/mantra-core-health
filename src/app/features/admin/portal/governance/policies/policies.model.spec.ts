import {
  appliedKind,
  appliedName,
  changeAction,
  hasPolicyFilters,
  historyFrom,
  policyControl,
  policyFacts,
  policyQuery,
  policyState,
} from './policies.model';

describe('policies.model', () => {
  it('policyControl no inventa un plazo de retención ni un cero', () => {
    expect(policyControl('RETENTION', { retentionPeriodDays: null, disposition: 'ARCHIVE' })).toBe(
      'Sin plazo declarado · al vencer: ARCHIVE',
    );
    expect(policyControl('RETENTION', { retentionPeriodDays: 0, disposition: null })).toContain(
      '0 días',
    );
  });

  it('policyControl escribe lo que cada tipo controla con los códigos de la API, sin traducirlos', () => {
    expect(
      policyControl('WRITE', {
        insertMode: 'ALLOWED',
        updateMode: 'FORBIDDEN',
        deleteMode: 'FORBIDDEN',
        requiresReason: true,
        dualControl: false,
      }),
    ).toBe('Alta: ALLOWED · Cambio: FORBIDDEN · Baja: FORBIDDEN · exige motivo');
    expect(policyControl('ANONYMIZATION', { technique: 'HASH' })).toBe('Técnica: HASH');
    expect(policyControl('RESIDENCY', { jurisdiction: 'BO', crossBorderTransferBasis: null })).toBe(
      'Jurisdicción: BO · Transferencia: sin base declarada',
    );
  });

  it('policyFacts escribe sí/no/sin declarar, lista los nombres de parámetros y respeta el orden de la API', () => {
    const facts = policyFacts({
      dualControl: false,
      maxBatchSize: null,
      requiresReason: true,
      parameterKeys: ['algorithm', 'salt'],
      sinRotulo: 'x',
    });
    expect(facts.map((f) => [f.etiqueta, f.valor])).toEqual([
      ['Doble control', 'No'],
      ['Máximo por lote', 'Sin declarar'],
      ['Exige motivo', 'Sí'],
      ['Parámetros (sólo sus nombres)', 'algorithm, salt'],
      ['sinRotulo', 'x'],
    ]);
    expect(policyFacts({ parameterKeys: [] })[0]!.valor).toBe('Ninguno');
  });

  it('policyState distingue vigente de borrador, deja un código desconocido tal cual y sin estado lo dice', () => {
    expect(policyState('ACTIVE')).toEqual({ label: 'Activa', tone: 'success' });
    expect(policyState('DRAFT').tone).toBe('warning');
    expect(policyState('SUSPENDED')).toEqual({ label: 'SUSPENDED', tone: 'secondary' });
    expect(policyState(null).label).toBe('Sin estado');
  });

  it('policyQuery quita los filtros vacíos y un tipo desconocido (CLASSIFICATION ya no existe)', () => {
    expect(policyQuery({ q: '', type: '' })).toEqual({});
    expect(policyQuery({ q: 'x', type: 'WRITE' })).toEqual({ q: 'x', type: 'WRITE' });
    expect(policyQuery({ q: '', type: 'NOPE' })).toEqual({});
    expect(policyQuery({ q: '', type: 'CLASSIFICATION' })).toEqual({});
  });

  it('los destinos se nombran como tablas o columnas según lo que la API trajo', () => {
    const tabla = { schemaName: 's', tableName: 't', columnName: null };
    const columna = { schemaName: 's', tableName: 't', columnName: 'c' };
    expect(appliedKind([tabla])).toBe('Tablas');
    expect(appliedKind([columna])).toBe('Columnas');
    expect(appliedName(tabla)).toBe('s.t');
    expect(appliedName(columna)).toBe('s.t.c');
  });

  it('la bitácora de una política se pide desde un día antes de su alta; sin alta, la API decide', () => {
    expect(historyFrom({ createdAt: new Date('2026-09-02T00:00:00.000Z') })).toBe(
      '2026-09-01T00:00:00.000Z',
    );
    expect(historyFrom({})).toBeNull();
  });

  it('una acción desconocida se dice y las demás se muestran tal cual', () => {
    expect(changeAction('UNKNOWN')).toBe('Acción no registrada');
    expect(changeAction('CREATED')).toBe('CREATED');
  });

  it('un tipo inventado en la URL no cuenta como filtro puesto', () => {
    expect(hasPolicyFilters({ q: '', type: 'OTRO' })).toBe(false);
    expect(hasPolicyFilters({ q: '', type: 'WRITE' })).toBe(true);
    expect(hasPolicyFilters({ q: 'x', type: '' })).toBe(true);
  });
});
