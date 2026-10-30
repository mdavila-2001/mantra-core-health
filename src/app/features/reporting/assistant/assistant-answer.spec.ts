import { formatearValor } from '@core/data-access/reporting/reporting-format';
import type { ContextoReporte } from '@core/data-access/reporting/reporting.types';

import { construirRespuesta } from './assistant-answer';
import { CONTEXTO_BASE, kpi, pestana } from './assistant.fixtures';

describe('construirRespuesta', () => {
  const bob = { tipo: 'moneda', moneda: 'BOB' } as const;
  const mrr = kpi('mrr', 'MRR', 'Ingreso recurrente mensual.', {
    valor: 12345.5,
    unidad: bob,
    variacionPct: 4.2,
  });
  const p = pestana('suscripciones', [mrr]);
  const con = (parcial: Partial<ContextoReporte>): ContextoReporte => ({ ...CONTEXTO_BASE, ...parcial });

  it('cita el valor tal cual lo formatea el reporte', () => {
    const r = construirRespuesta(mrr, p, CONTEXTO_BASE);
    expect(r.valorTexto).toBe(formatearValor(12345.5, bob));
    expect(r.sinDato).toBe(false);
    expect(r.motivoSinDato).toBeNull();
  });

  it('lleva definición, fuente, frescura y la ruta de la pestaña dueña', () => {
    const r = construirRespuesta(mrr, p, CONTEXTO_BASE);
    expect(r.definicion).toBe('Ingreso recurrente mensual.');
    expect(r.fuente).toBe('fuente de ejemplo');
    expect(r.frescura).toBe('cada hora');
    expect(r.ruta).toBe('/reporting/comercial/suscripciones');
    expect(r.esEjemplo).toBe(true);
  });

  it('null se dice «Sin dato» con su motivo, nunca 0', () => {
    const r = construirRespuesta(
      kpi('cac', 'CAC', 'd', { valor: null, motivoSinDato: 'Aún no hay campañas con registros.' }),
      p,
      CONTEXTO_BASE,
    );
    expect(r.valorTexto).toBe('Sin dato');
    expect(r.valorTexto).not.toMatch(/0/);
    expect(r.motivoSinDato).toBe('Aún no hay campañas con registros.');
    expect(r.variacion).toBeNull();
  });

  it('null sin motivo declarado lo dice, no inventa uno', () => {
    const r = construirRespuesta(kpi('x', 'X', 'd', { valor: null }), p, CONTEXTO_BASE);
    expect(r.motivoSinDato).toBe('El reporte no indica el motivo.');
  });

  it('el valor cero es un valor, no un «sin dato»', () => {
    const r = construirRespuesta(kpi('x', 'X', 'd', { valor: 0 }), p, CONTEXTO_BASE);
    expect(r.sinDato).toBe(false);
    expect(r.valorTexto).toBe('0');
  });

  it('dice de quién es el número según el alcance', () => {
    expect(construirRespuesta(mrr, p, con({ alcance: 'organizacion' })).ambito).toBe('de tu organización');
    expect(construirRespuesta(mrr, p, con({ alcance: 'plataforma' })).ambito).toBe('de toda la plataforma');
  });

  it('nombra los filtros activos', () => {
    const r = construirRespuesta(mrr, p, con({ filtros: [{ dimension: 'plan', valor: 'Pro' }] }));
    expect(r.filtros).toEqual(['plan: Pro']);
  });

  it('la variación dice el sentido con palabras y si es favorable', () => {
    const sube = construirRespuesta(mrr, p, CONTEXTO_BASE).variacion;
    expect(sube?.texto).toBe('+4,2 %');
    expect(sube?.descripcion).toContain('subió');
    expect(sube?.descripcion).toContain('favorable');
    expect(sube?.favorable).toBe(true);
  });

  it('cuando subir es malo (churn), una subida es desfavorable', () => {
    const churn = kpi('churn', 'Churn', 'd', { variacionPct: 1.5, subirEsMalo: true });
    const v = construirRespuesta(churn, p, CONTEXTO_BASE).variacion;
    expect(v?.favorable).toBe(false);
    expect(v?.descripcion).toContain('desfavorable');
  });

  it('sin comparación activa no hay variación; con ella pero sin dato, se dice', () => {
    expect(construirRespuesta(mrr, p, con({ comparar: 'ninguna' })).variacion).toBeNull();
    const sinComparativo = construirRespuesta(kpi('x', 'X', 'd', { variacionPct: null }), p, CONTEXTO_BASE).variacion;
    expect(sinComparativo?.texto).toBe('Sin comparativo');
    expect(sinComparativo?.favorable).toBeNull();
  });

  it('sin información declarada lo dice en vez de inventar una definición', () => {
    const r = construirRespuesta(kpi('x', 'X', 'd', { info: null, infoMotivo: 'Medida en revisión' }), p, CONTEXTO_BASE);
    expect(r.definicion).toContain('Medida en revisión');
    expect(r.formula).toBeNull();
  });
});
