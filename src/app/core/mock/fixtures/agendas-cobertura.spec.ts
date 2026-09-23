import { writeFileSync } from 'node:fs';
import { PROFESIONALES } from './personas';
import { recursos, cupos } from './agenda';

/**
 * H1.S2.M2 del carril de Ender (2026-09-22): cuántos profesionales del
 * directorio (`GET /profiles/practitioners`, sin filtro por especialidad —
 * `profiles.handlers.ts:939`) tienen recurso de agenda y cuántos tienen
 * cupos en los próximos ±14 días. Es la foto «antes» de R-03: los 13
 * registrados (`origen: 'USUARIO_PROPIETARIO'`) quedan fuera del filtro de
 * `recursos` (`agenda.ts:106`) y por lo tanto sin cupos.
 */
describe('cobertura de agendas — foto antes de R-03', () => {
  it('cuenta directorio / con recurso / con cupos en ±14 días', () => {
    const enDirectorio = PROFESIONALES.length;
    const idsConRecurso = new Set(recursos.todos().map((r) => r.resourceRefId));
    const conRecurso = PROFESIONALES.filter((p) => idsConRecurso.has(p.id)).length;

    const hoy = new Date();
    const desde = new Date(hoy);
    desde.setDate(desde.getDate() - 14);
    const hasta = new Date(hoy);
    hasta.setDate(hasta.getDate() + 14);

    const idsConCupoEnVentana = new Set(
      cupos
        .todos()
        .filter((c) => {
          const inicio = new Date(c.startAt);
          return inicio >= desde && inicio <= hasta;
        })
        .map((c) => {
          const recurso = recursos.todos().find((r) => r.id === c.resourceId);
          return recurso?.resourceRefId;
        })
        .filter((id): id is string => id !== undefined),
    );
    const conCupos = PROFESIONALES.filter((p) => idsConCupoEnVentana.has(p.id)).length;

    const registrados = PROFESIONALES.filter((p) => p.origen === 'USUARIO_PROPIETARIO');
    const registradosConEspecialidad = registrados.filter((p) => p.especialidades.length > 0);

    const resumen =
      `[H1.S2.M2] directorio=${enDirectorio} conRecurso=${conRecurso} conCuposEn14dias=${conCupos} ` +
      `registrados=${registrados.length} registradosConEspecialidad=${registradosConEspecialidad.length}\n`;
    console.log(resumen);
    try {
      writeFileSync('docs/trabajo/2026-09-22-ender-simulador-cabecera/evidencia/antes/agendas-raw.txt', resumen);
    } catch {
      /* si el cwd no es la raiz del repo, el resumen sigue en la consola */
    }

    expect(enDirectorio).toBeGreaterThan(0);
    expect(registrados.length).toBe(13);
  });
});
