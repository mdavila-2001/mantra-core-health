import { PROFESIONALES } from './personas';
import { recursos } from './agenda';

/**
 * H3.S1.M3 (2026-09-22) — los casos límite de R-03, declarados con evidencia
 * en vez de supuestos.
 */
describe('agenda de los registrados — casos límite', () => {
  it('un médico registrado sin ninguna especialidad mapeada sigue sin recurso', () => {
    // José Luis Daga Jordán (fila 20 de USUARIO_MEDICOS_1.md): occupation
    // "MEDICO CIRUJANO" sin specialty declarada → especialidadesDe() devuelve
    // [] (registered-people.ts:73-76, un médico cirujano sin especialidad
    // declarada no hereda una que la planilla no dice). Sin especialidad, el
    // filtro de `recursos` (agenda.ts:118-120) lo deja afuera a propósito: no
    // hay qué agendarle.
    const daga = PROFESIONALES.find((p) => p.origen === 'USUARIO_PROPIETARIO' && p.practitionerCode === 'USR-0020');
    expect(daga).toBeDefined();
    expect(daga!.especialidades).toHaveLength(0);

    const tieneRecurso = recursos.todos().some((r) => r.resourceRefId === daga!.id);
    expect(tieneRecurso).toBe(false);
  });

  it('los otros 12 registrados con especialidad sí tienen recurso', () => {
    const registradosConEspecialidad = PROFESIONALES.filter(
      (p) => p.origen === 'USUARIO_PROPIETARIO' && p.especialidades.length > 0,
    );
    expect(registradosConEspecialidad).toHaveLength(12);

    const idsConRecurso = new Set(recursos.todos().map((r) => r.resourceRefId));
    for (const p of registradosConEspecialidad) {
      expect(idsConRecurso.has(p.id)).toBe(true);
    }
  });

  it('la sede asignada a cada registrado es una de las tres del simulador, no una inventada', () => {
    const sitiosConocidos = new Set(['OLIVOS-C', 'SANLUCAS', 'ROJAS']);
    const registrados = PROFESIONALES.filter((p) => p.origen === 'USUARIO_PROPIETARIO');
    for (const p of registrados) {
      const recurso = recursos.todos().find((r) => r.resourceRefId === p.id);
      if (recurso === undefined) continue; // el caso sin especialidad, cubierto arriba
      expect(sitiosConocidos.has(recurso.site?.code ?? '')).toBe(true);
    }
  });
});
