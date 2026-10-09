import type { FilaDeClausula, PlanDelMercado } from './insurer-detail';
import {
  criterioDe,
  filtrarPlanes,
  filtrosDelCatalogo,
  normalizar,
} from './insurer-detail.filters';

const fila = (id: string, categoria: string, requisitos = ''): FilaDeClausula => ({
  id,
  categoria,
  cobertura: categoria,
  cubre: '90 %',
  copago: '—',
  deducible: '—',
  tope: '—',
  autorizacion: 'No',
  requisitos,
});

const plan = (
  id: string,
  nombre: string,
  tipo: string,
  segmento: string | null,
  clausulas: FilaDeClausula[],
): PlanDelMercado => ({
  id,
  nombre,
  producto: `Andina · ${tipo}`,
  tipo,
  segmento,
  rotulo: tipo,
  prima: null,
  mayorCobertura: false,
  destacadas: [],
  resumen: '',
  clausulas,
});

const PLANES = [
  plan('p1', 'Plan Integral', 'Salud', 'Individual', [
    fila('a', 'Internación', 'No cubre: Cirugía estética'),
    fila('b', 'Maternidad'),
  ]),
  plan('p2', 'Plan Esencial', 'Salud', 'Empresas', [fila('c', 'Internación')]),
  plan('p3', 'Plan Accidentes', 'Accidentes personales', 'Empresas', [fila('d', 'Emergencias')]),
];

describe('filtros de «Productos y planes»', () => {
  it('normaliza acentos, mayúsculas y espacios', () => {
    expect(normalizar('  Odontología   INFANTIL ')).toBe('odontologia infantil');
  });

  it('ofrece sólo los filtros con dos opciones o más, sacadas del catálogo', () => {
    const filtros = filtrosDelCatalogo(PLANES);
    expect(filtros.map((f) => f.key)).toEqual(['tipo', 'segmento', 'cobertura']);
    expect(filtros[2]!.options.map((o) => o.label)).toEqual([
      'Emergencias',
      'Internación',
      'Maternidad',
    ]);
    expect(filtrosDelCatalogo([PLANES[0]!]).map((f) => f.key)).toEqual(['cobertura']);
  });

  it('un parámetro de un filtro que no se ofrece no filtra', () => {
    const filtros = filtrosDelCatalogo(PLANES);
    expect(criterioDe({ tipo: 'Vida' }, filtros).tipo).toBeNull();
    expect(criterioDe({ tipo: 'Salud' }, filtros).tipo).toBe('Salud');
  });

  it('el término en el plan deja todas sus cláusulas; en una cláusula, sólo ésa', () => {
    const filtros = filtrosDelCatalogo(PLANES);
    const porNombre = filtrarPlanes(PLANES, criterioDe({ q: 'integral' }, filtros));
    expect(porNombre.map((p) => [p.plan.id, p.clausulas.length])).toEqual([['p1', 2]]);

    const porCobertura = filtrarPlanes(PLANES, criterioDe({ q: 'maternidad' }, filtros));
    expect(porCobertura.map((p) => [p.plan.id, p.clausulas.map((c) => c.id)])).toEqual([
      ['p1', ['b']],
    ]);

    const porExclusion = filtrarPlanes(PLANES, criterioDe({ q: 'estetica' }, filtros));
    expect(porExclusion.map((p) => p.plan.id)).toEqual(['p1']);
  });

  it('los filtros se combinan entre sí y con el buscador', () => {
    const filtros = filtrosDelCatalogo(PLANES);
    const empresasSalud = filtrarPlanes(
      PLANES,
      criterioDe({ tipo: 'Salud', segmento: 'Empresas' }, filtros),
    );
    expect(empresasSalud.map((p) => p.plan.id)).toEqual(['p2']);

    const internacion = filtrarPlanes(PLANES, criterioDe({ cobertura: 'Internación' }, filtros));
    expect(internacion.map((p) => [p.plan.id, p.clausulas.length])).toEqual([
      ['p1', 1],
      ['p2', 1],
    ]);

    expect(filtrarPlanes(PLANES, criterioDe({ q: 'veterinaria' }, filtros))).toEqual([]);
  });
});
