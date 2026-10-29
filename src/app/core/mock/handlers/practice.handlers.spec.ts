import { HttpHeaders } from '@angular/common/http';

import { registrarPracticas } from './practice.handlers';
import { MockRouter, type MockMethod } from '../mock-router';
import { buscarUsuario } from '../mock-session';
import { PRACTICAS } from './practice.handlers';
import { QUIROFANO } from './procedures.handlers';

/**
 * El simulador tiene que contestar con la MISMA forma que la API real: si no,
 * la pantalla funciona contra el backend y revienta en la maqueta, o al revés.
 */
describe('handlers de consultorios y arancel', () => {
  const router = new MockRouter();
  registrarPracticas(router);
  const admin = buscarUsuario('superadmin')!;

  function call<T>(method: MockMethod, path: string, query = new URLSearchParams()): T {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    return match.handler({
      method,
      path,
      params: match.params,
      query,
      body: null,
      headers: new HttpHeaders(),
      user: admin,
    }) as T;
  }

  it('las especialidades del arancel llegan en { items }, como las lee el cliente', () => {
    // Con el arreglo pelado, «Importar arancel» reventaba al abrir:
    // «Cannot read properties of undefined (reading 'map')» (barrido del refactor UX).
    const respuesta = call<{ items: readonly { specialty: string; count: number }[] }>(
      'GET',
      '/billing/service-catalog/procedure-specialties',
    );

    expect(Array.isArray(respuesta)).toBe(false);
    expect(respuesta.items.length).toBeGreaterThan(0);
    expect(respuesta.items[0]).toEqual({
      specialty: expect.any(String),
      count: expect.any(Number),
    });
  });

  /**
   * LA CONSOLA DE LA ORGANIZACIÓN, COHERENTE CONSIGO MISMA Y CON LA API.
   *
   * Tres incoherencias de la maqueta: los recuentos de la sede eran cifras
   * fijas que no coincidían con las filas de las pestañas; todos los badges
   * salían `info` porque los códigos eran inventados (`ACTIVE`, `OPERATIONAL`)
   * y la pantalla pinta por el código que emite la API; y los quirófanos no
   * existían como espacios, así que un caso quirúrgico apuntaba a un id que la
   * estructura de la organización no conocía.
   */
  describe('consola de la organización', () => {
    interface Consola {
      sites: { id: string; clinicalUnitCount: number; careSpaceCount: number }[];
      clinicalUnits: { id: string; siteId: string; status: { code: string } }[];
      careSpaces: { id: string; siteId: string; clinicalUnitId: string | null; name: string; operationalStatus: { code: string } | null; status: { code: string } }[];
      staff: { clinicalUnitId: string | null; siteId: string | null; status: { code: string } }[];
    }
    const hospital = PRACTICAS.find((p) => p.code === 'SANLUCAS')!;
    const consola = (id: string) => call<Consola>('GET', `/practices/${id}/organization`);

    it.each(PRACTICAS.map((p) => [p.code, p.id] as const))(
      '%s: los recuentos de cada sede se derivan de las filas, no se fijan',
      (_codigo, id) => {
        const datos = consola(id);

        for (const sede of datos.sites) {
          expect(sede.clinicalUnitCount).toBe(datos.clinicalUnits.filter((u) => u.siteId === sede.id).length);
          expect(sede.careSpaceCount).toBe(datos.careSpaces.filter((e) => e.siteId === sede.id).length);
        }
        expect(datos.sites.reduce((n, sede) => n + sede.careSpaceCount, 0)).toBe(datos.careSpaces.length);
      },
    );

    it('los quirófanos del hospital son los mismos ids que usan los casos quirúrgicos', () => {
      const datos = consola(hospital.id);
      const quirofanos = datos.careSpaces.filter((e) => e.name.startsWith('Quirófano'));

      expect(quirofanos.map((q) => q.id).sort()).toEqual([QUIROFANO.Q1, QUIROFANO.Q2].sort());
      // Y cuelgan del área de quirófanos, no de una cualquiera.
      expect(new Set(quirofanos.map((q) => q.clinicalUnitId)).size).toBe(1);
    });

    it('todos los códigos de estado son los que emite la API: ningún badge cae en «info» por un código inventado', () => {
      const emitidos = /^(SITE|UNIT|SPACE)_(ACTIVE|RETIRED|OP_(PLANNED|CLOSED|AVAILABLE))$/;
      const datos = consola(hospital.id) as unknown as {
        clinicalUnits: { status: { code: string } }[];
        careSpaces: { status: { code: string }; operationalStatus: { code: string } | null }[];
        sites: { status: { code: string }; operationalStatus: { code: string } | null }[];
        staff: { status: { code: string } }[];
      };
      const codigos = [
        ...datos.sites.flatMap((s) => [s.status.code, s.operationalStatus?.code ?? 'SITE_ACTIVE']),
        ...datos.clinicalUnits.map((u) => u.status.code),
        ...datos.careSpaces.flatMap((e) => [e.status.code, e.operationalStatus?.code ?? 'SPACE_ACTIVE']),
      ];

      for (const codigo of codigos) {
        expect(codigo).toMatch(emitidos);
      }
      // Y hay variedad real, no todo «activo»: sin ella no se vería que los badges distinguen.
      expect(new Set(codigos).size).toBeGreaterThan(3);
      expect(datos.staff.map((p) => p.status.code)).toEqual(
        expect.arrayContaining(['ROLE_ASG_ACTIVE', 'ROLE_ASG_ENDED']),
      );
    });

    it('la plantilla cuelga de áreas de su misma sede', () => {
      const datos = consola(hospital.id);
      const sedeDeArea = new Map(datos.clinicalUnits.map((u) => [u.id, u.siteId]));

      for (const persona of datos.staff) {
        expect(sedeDeArea.get(persona.clinicalUnitId!)).toBe(persona.siteId);
      }
    });
  });
});
