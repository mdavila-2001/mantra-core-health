import { PROFESIONALES, PROFESIONALES_DEMO_REGISTRADOS } from './personas';
import { recursos } from './agenda';

/**
 * H3.S1.M3 (2026-09-22) — los casos límite de R-03, declarados con evidencia
 * en vez de supuestos.
 *
 * Contrato vigente: D-H3-PROV-01 (23/09/2026). Las 13 personas de la planilla
 * del propietario son reales y la planilla no dice dónde atienden, así que no
 * reciben agenda; la agenda de R-03 la tienen 13 profesionales de
 * demostración (`origen: 'DEMO'`). Acá no se nombra a nadie de la planilla.
 */
describe('agenda de los registrados — casos límite', () => {
  it('un médico sin ninguna especialidad sigue sin recurso', () => {
    // El médico escrito sin especialidad (`personas.ts`, clave
    // `sinespecialidad`): el filtro de `recursos` lo deja afuera a propósito,
    // porque no hay nada que reservarle. El caso se prueba con él y no con
    // uno de los 13 de demostración, que tienen todos especialidad.
    const sinEspecialidad = PROFESIONALES.filter((p) => p.origen === undefined && p.especialidades.length === 0);
    expect(sinEspecialidad.length).toBeGreaterThan(0);

    for (const p of sinEspecialidad) {
      expect(recursos.todos().some((r) => r.resourceRefId === p.id), p.id).toBe(false);
    }
  });

  it('ninguna de las 13 personas de la planilla del propietario tiene recurso', () => {
    const deLaPlanilla = PROFESIONALES.filter((p) => p.origen === 'USUARIO_PROPIETARIO');
    expect(deLaPlanilla).toHaveLength(13);

    const idsConRecurso = new Set(recursos.todos().map((r) => r.resourceRefId));
    for (const p of deLaPlanilla) {
      expect(idsConRecurso.has(p.id), p.id).toBe(false);
    }
  });

  it('los 13 de demostración tienen recurso en una de las dos instituciones inventadas, nunca en un consultorio de una persona', () => {
    expect(PROFESIONALES_DEMO_REGISTRADOS).toHaveLength(13);
    const sitiosDemo = new Set(['OLIVOS-C', 'SANLUCAS']);
    for (const p of PROFESIONALES_DEMO_REGISTRADOS) {
      const suyos = recursos.todos().filter((r) => r.resourceRefId === p.id);
      expect(suyos, p.id).toHaveLength(1);
      expect(sitiosDemo.has(suyos[0]!.site?.code ?? ''), p.id).toBe(true);
    }
  });
});
