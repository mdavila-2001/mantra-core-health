import { describe, expect, it } from 'vitest';

import { ARISTAS_DEMO, NODOS_DEMO } from './red-clinica.demo';
import {
  aplicarFiltro,
  aristasVisibles,
  criteriosActivos,
  diagnosticosDe,
  especialidadesDe,
  FILTRO_VACIO,
  hiloDeDiagnostico,
  normalizarTexto,
  profesionalesDe,
  tiposPresentes,
  type FiltroDeRed,
} from './red-clinica-filtro';
import { TIPOS_DE_NODO, type NodoDeRed } from './red-clinica.types';

const ids = (nodos: readonly NodoDeRed[]) => nodos.map((n) => n.id);
const con = (parcial: Partial<FiltroDeRed>): FiltroDeRed => ({ ...FILTRO_VACIO, ...parcial });

describe('aplicarFiltro', () => {
  it('el filtro vacío devuelve todo, en el mismo orden', () => {
    expect(ids(aplicarFiltro(NODOS_DEMO, FILTRO_VACIO, ARISTAS_DEMO))).toEqual(ids(NODOS_DEMO));
  });

  it('no muta la entrada', () => {
    const copia = [...NODOS_DEMO];
    aplicarFiltro(NODOS_DEMO, con({ texto: 'cefalea' }), ARISTAS_DEMO);
    expect(NODOS_DEMO).toEqual(copia);
  });

  it('por tipos: sólo los elegidos', () => {
    const r = aplicarFiltro(NODOS_DEMO, con({ tipos: ['diagnostico', 'estudio'] }));
    expect(new Set(r.map((n) => n.tipo))).toEqual(new Set(['diagnostico', 'estudio']));
    expect(r).toHaveLength(6);
  });

  it('por especialidad y por profesional', () => {
    expect(ids(aplicarFiltro(NODOS_DEMO, con({ especialidadId: 'esp-cardio' })))).toEqual(['a3', 'e3', 'dx3']);
    expect(ids(aplicarFiltro(NODOS_DEMO, con({ profesionalId: 'pro-mendez' })))).toEqual(['a3', 'e3', 'dx3']);
    expect(aplicarFiltro(NODOS_DEMO, con({ profesionalId: 'nadie' }))).toHaveLength(0);
  });

  it('un nodo sin profesional queda fuera al filtrar por profesional', () => {
    const sinQuien: NodoDeRed = { id: 'x', tipo: 'nota', titulo: 'Nota', cuando: null };
    expect(aplicarFiltro([sinQuien], con({ profesionalId: 'pro-rojas' }))).toHaveLength(0);
    expect(aplicarFiltro([sinQuien], con({ especialidadId: 'esp-mg' }))).toHaveLength(0);
  });

  it('el rango de fechas es inclusivo de punta a punta del día', () => {
    const r = aplicarFiltro(
      NODOS_DEMO,
      con({ desde: new Date(2026, 8, 2, 23, 0), hasta: new Date(2026, 8, 2, 0, 0) }),
    );
    expect(ids(r)).toEqual(['a3', 'e3', 'dx3']);
  });

  it('sólo «desde» o sólo «hasta»', () => {
    expect(ids(aplicarFiltro(NODOS_DEMO, con({ desde: new Date(2026, 9, 1) })))).toEqual(['d2']);
    expect(aplicarFiltro(NODOS_DEMO, con({ hasta: new Date(2026, 7, 4) })).map((n) => n.id)).toEqual([
      'c1',
      'a1',
      'dx1',
      'dx2',
      'e1',
      'e2',
    ]);
  });

  it('con rango puesto, un nodo sin fecha queda fuera', () => {
    const sinFecha: NodoDeRed = { id: 'x', tipo: 'documento', titulo: 'Doc', cuando: null };
    expect(aplicarFiltro([sinFecha], con({ desde: new Date(2000, 0, 1) }))).toHaveLength(0);
    expect(aplicarFiltro([sinFecha], FILTRO_VACIO)).toHaveLength(1);
  });

  it('el texto ignora mayúsculas y tildes, y busca en profesional, especialidad y buscable', () => {
    expect(ids(aplicarFiltro(NODOS_DEMO, con({ texto: 'HIPERTENSION' })))).toEqual(['dx2', 'e1', 'd1', 'd2']);
    expect(ids(aplicarFiltro(NODOS_DEMO, con({ texto: 'méndez' })))).toEqual(['d1', 'a3', 'e3', 'dx3']);
    expect(ids(aplicarFiltro(NODOS_DEMO, con({ texto: 'cardiologia' })))).toEqual(['d1', 'a3', 'e3', 'dx3']);
    expect(ids(aplicarFiltro(NODOS_DEMO, con({ texto: '  cefalea  ' })))).toEqual(['c1', 'a1', 'dx1', 'a2']);
  });

  it('busca en el estado y en los textos del análisis', () => {
    expect(ids(aplicarFiltro(NODOS_DEMO, con({ texto: 'en estudio' })))).toEqual(['dx3']);
    expect(ids(aplicarFiltro(NODOS_DEMO, con({ texto: 'sokolow' })))).toEqual(['dx3']);
    expect(ids(aplicarFiltro(NODOS_DEMO, con({ texto: 'patrón hipertensivo' })))).toEqual(['e1']);
    expect(ids(aplicarFiltro(NODOS_DEMO, con({ texto: 'sede centro' })))).toEqual(['c1', 'r1']);
  });

  it('los criterios se combinan con «y»', () => {
    const r = aplicarFiltro(
      NODOS_DEMO,
      con({ tipos: ['estudio'], profesionalId: 'pro-rojas', texto: 'perfil' }),
      ARISTAS_DEMO,
    );
    expect(ids(r)).toEqual(['e2']);
  });

  it('«solo el hilo de este diagnóstico» usa las aristas', () => {
    const r = aplicarFiltro(NODOS_DEMO, con({ hiloDeDiagnosticoId: 'dx3' }), ARISTAS_DEMO);
    expect(ids(r)).toEqual(['a3', 'dx3']);
  });

  it('sin aristas, el hilo es sólo el diagnóstico', () => {
    expect(ids(aplicarFiltro(NODOS_DEMO, con({ hiloDeDiagnosticoId: 'dx2' })))).toEqual(['dx2']);
  });
});

describe('hiloDeDiagnostico', () => {
  it('trae estudios, evidencia, medicación y el diagnóstico reemplazado, con sus atenciones', () => {
    const hilo = hiloDeDiagnostico('dx2', NODOS_DEMO, ARISTAS_DEMO);
    expect([...hilo].sort()).toEqual(['a1', 'a2', 'a3', 'dx1', 'dx2', 'e1', 'e2', 'e3', 'm1'].sort());
  });

  it('una atención entra al hilo pero no lo propaga: dx3 (otro diagnóstico de a3) no entra', () => {
    const hilo = hiloDeDiagnostico('dx2', NODOS_DEMO, ARISTAS_DEMO);
    expect(hilo.has('a3')).toBe(true);
    expect(hilo.has('dx3')).toBe(false);
    expect(hilo.has('d1')).toBe(false);
  });

  it('el diferencial resuelto es el mismo hilo en los dos sentidos', () => {
    const desdeDescartado = hiloDeDiagnostico('dx1', NODOS_DEMO, ARISTAS_DEMO);
    expect(desdeDescartado.has('dx2')).toBe(true);
    // dx2 se expande (se llegó por `reemplazado-por`): trae su medicación.
    expect(desdeDescartado.has('m1')).toBe(true);
  });

  it('otro diagnóstico al que se llega por un vínculo que no es de reemplazo entra pero no se expande', () => {
    const nodos: NodoDeRed[] = [
      { id: 'A', tipo: 'diagnostico', titulo: 'A', cuando: null },
      { id: 'E', tipo: 'estudio', titulo: 'E', cuando: null },
      { id: 'B', tipo: 'diagnostico', titulo: 'B', cuando: null },
      { id: 'M', tipo: 'medicacion', titulo: 'M', cuando: null },
    ];
    const hilo = hiloDeDiagnostico('A', nodos, [
      { desde: 'E', hasta: 'A', tipo: 'pedido-para' },
      { desde: 'E', hasta: 'B', tipo: 'evidencia-de' },
      { desde: 'M', hasta: 'B', tipo: 'indicado-para' },
    ]);
    expect([...hilo].sort()).toEqual(['A', 'B', 'E']);
  });

  it('un id desconocido devuelve un conjunto vacío, y tolera ciclos', () => {
    expect(hiloDeDiagnostico('nope', NODOS_DEMO, ARISTAS_DEMO).size).toBe(0);
    const nodos: NodoDeRed[] = [
      { id: 'A', tipo: 'diagnostico', titulo: 'A', cuando: null },
      { id: 'B', tipo: 'diagnostico', titulo: 'B', cuando: null },
    ];
    const hilo = hiloDeDiagnostico('A', nodos, [
      { desde: 'A', hasta: 'B', tipo: 'reemplazado-por' },
      { desde: 'B', hasta: 'A', tipo: 'reemplazado-por' },
    ]);
    expect(hilo.size).toBe(2);
  });

  it('ignora aristas que apuntan a nodos que no están', () => {
    const hilo = hiloDeDiagnostico('dx3', NODOS_DEMO, [
      ...ARISTAS_DEMO,
      { desde: 'fantasma', hasta: 'dx3', tipo: 'pedido-para' },
    ]);
    expect(hilo.has('fantasma')).toBe(false);
  });
});

describe('utilidades de la barra', () => {
  it('cuenta los criterios activos (el rango cuenta uno)', () => {
    expect(criteriosActivos(FILTRO_VACIO)).toBe(0);
    expect(criteriosActivos(con({ texto: '   ' }))).toBe(0);
    expect(
      criteriosActivos(
        con({ texto: 'x', tipos: ['cita'], desde: new Date(), hasta: new Date(), profesionalId: 'p' }),
      ),
    ).toBe(4);
  });

  it('normaliza texto', () => {
    expect(normalizarTexto('  Árbol ÑANDÚ ')).toBe('arbol nandu');
  });

  it('opciones únicas y ordenadas', () => {
    expect(especialidadesDe(NODOS_DEMO).map((e) => e.nombre)).toEqual(['Cardiología', 'Medicina general']);
    expect(profesionalesDe(NODOS_DEMO).map((p) => p.nombre)).toEqual(['Dr. Luis Méndez', 'Dra. Ana Rojas']);
    expect(diagnosticosDe(NODOS_DEMO).map((n) => n.id)).toEqual(['dx3', 'dx1', 'dx2']);
    expect(tiposPresentes(NODOS_DEMO, TIPOS_DE_NODO)).toEqual([
      'cita',
      'reconsulta',
      'atencion',
      'diagnostico',
      'estudio',
      'derivacion',
      'medicacion',
    ]);
  });

  it('aristasVisibles conserva sólo las de dos puntas visibles', () => {
    const visibles = aplicarFiltro(NODOS_DEMO, con({ especialidadId: 'esp-cardio' }));
    expect(aristasVisibles(ARISTAS_DEMO, visibles)).toEqual([
      { desde: 'e3', hasta: 'a3', tipo: 'registrado-en' },
      { desde: 'dx3', hasta: 'a3', tipo: 'registrado-en' },
    ]);
  });
});
