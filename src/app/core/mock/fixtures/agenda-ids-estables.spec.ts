import { ESTADO_RESERVA } from './conceptos';

/**
 * Las reservas de la maqueta sobreviven a F5 (`sessionStorage`) y los cupos se
 * regeneran en cada carga. Si el id del cupo dependiera de la distancia a hoy,
 * una pestaña abierta ayer vería hoy cada reserva colgada de un cupo de otro
 * día, y el día entero saldría «No disponible · Sin lugar».
 */
describe('agenda de la maqueta — ids de cupo estables entre días', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
  });

  async function cuposCargadosEl(dia: Date): Promise<Map<string, string>> {
    vi.resetModules();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(dia);
    const { cupos } = await import('./agenda');
    return new Map(cupos.todos().map((c) => [`${c.resourceId}|${c.startAt}`, c.id]));
  }

  it('el mismo cupo conserva su id si la maqueta se carga al día siguiente', async () => {
    const ayer = await cuposCargadosEl(new Date(2026, 8, 24, 10, 0));
    const hoy = await cuposCargadosEl(new Date(2026, 8, 25, 10, 0));

    const comunes = [...hoy.keys()].filter((clave) => ayer.has(clave));
    expect(comunes.length).toBeGreaterThan(100);
    for (const clave of comunes) {
      expect(hoy.get(clave), clave).toBe(ayer.get(clave));
    }
  });

  it('la capacidad libre de cada cupo sale de las reservas vigentes que tiene encima', async () => {
    const { cupos, reservas } = await import('./agenda');
    const anuladas = new Set([ESTADO_RESERVA['BK-CANCELLED'], ESTADO_RESERVA['BK-REJECTED']]);

    for (const cupo of cupos.todos()) {
      const encima = reservas
        .todos()
        .filter((r) => r.bookableSlotId === cupo.id && !anuladas.has(r.statusConceptId)).length;
      expect(cupo.remainingCapacity, cupo.id).toBe(Math.max(0, cupo.capacity - encima));
    }
  });
});
