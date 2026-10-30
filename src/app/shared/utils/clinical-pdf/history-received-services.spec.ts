import { servicesBlocks, type HistoryService } from './history-received-services';

function service(overrides: Partial<HistoryService> = {}): HistoryService {
  return {
    date: '12/08/2026',
    title: 'Infiltración articular',
    type: 'Intervención médica',
    performer: 'Dra. Ana Rojas',
    site: 'Clínica Los Olivos',
    status: 'Realizada',
    result: 'Tolerancia adecuada.',
    cost: '350.00 Bs',
    ...overrides,
  };
}

describe('servicesBlocks', () => {
  it('siempre imprime el encabezado, y dice el vacío', () => {
    expect(servicesBlocks([])).toEqual([
      { kind: 'heading', text: 'Servicios recibidos', level: 2 },
      { kind: 'paragraph', text: 'Sin servicios recibidos.' },
    ]);
  });

  it('imprime una banda de encabezado y una fila por servicio, en el orden dado', () => {
    const blocks = servicesBlocks([service(), service({ date: '03/06/2026', title: 'Apendicectomía' })]);
    const rows = blocks.filter((block) => block.kind === 'row');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ header: true, cells: ['Fecha', 'Servicio', 'Profesional y sede', 'Estado', 'Resultado', 'Costo'] });
    expect(rows[1]).toMatchObject({ cells: ['12/08/2026', 'Infiltración articular (Intervención médica)', 'Dra. Ana Rojas · Clínica Los Olivos', 'Realizada', 'Tolerancia adecuada.', '350.00 Bs'] });
    expect(rows[2]).toMatchObject({ cells: expect.arrayContaining(['Apendicectomía (Intervención médica)']) });
  });

  it('un servicio sin resultado imprime una raya, no una celda vacía', () => {
    const [, , row] = servicesBlocks([service({ result: '' })]);
    expect(row).toMatchObject({ cells: expect.arrayContaining(['—']) });
  });

  it('un servicio sin cobro registrado lo dice en la columna de costo', () => {
    const [, , row] = servicesBlocks([service({ cost: 'Sin cobro registrado' })]);
    expect(row).toMatchObject({ cells: expect.arrayContaining(['Sin cobro registrado']) });
  });

  it('si quien descarga no ve importes no hay columna de costo', () => {
    const blocks = servicesBlocks([service({ cost: '' })]);
    const rows = blocks.filter((block) => block.kind === 'row');
    expect(rows[0]).toMatchObject({ cells: ['Fecha', 'Servicio', 'Profesional y sede', 'Estado', 'Resultado'] });
    expect(rows[1]).toMatchObject({ cells: expect.not.arrayContaining(['']) });
  });

  it('no deja pasar identificadores ni fechas ISO', () => {
    expect(JSON.stringify(servicesBlocks([service()]))).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-|\d{4}-\d{2}-\d{2}T/i);
  });
});
