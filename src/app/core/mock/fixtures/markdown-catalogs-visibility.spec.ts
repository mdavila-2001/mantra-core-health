import { HttpHeaders } from '@angular/common/http';

import { crearRouterSimulado } from '../handlers';
import type { MockRequest } from '../mock-router';
import { DENTAL_FEE_SCHEDULE, MEDICAL_FEE_SCHEDULE } from './fee-schedules.generated';
import { ASEGURADORAS_REALES, CLINICAS_REALES, HOSPITALES_REALES } from './instituciones.generated';
import { INSURER_NETWORK_PRACTITIONERS } from './insurer-network.generated';
import { PHARMACIES_AND_LABS, PRIMARY_CARE_CENTERS } from './markdown-institutions.generated';
import { REGISTERED_PATIENTS, REGISTERED_PRACTITIONERS } from './registered-people.generated';

/* ============================================================================
    Que cada dato de `markdown_convertidos/` llegue a la pantalla.

    `tools/verify-markdown-catalogs.py` prueba que cada fila de los doce `.md`
    está en los `*.generated.ts`. Esto prueba la otra mitad: que cada registro
    generado sale por el endpoint que usa su pantalla, recorriendo **todas las
    páginas** —un dato que existe pero ningún listado devuelve no se ve—.
    ========================================================================== */

const router = crearRouterSimulado();

function get(path: string, query: Record<string, string>): Record<string, unknown> {
  const coincidencia = router.match('GET', path);
  expect(coincidencia, `sin ruta para ${path}`).not.toBeNull();
  const peticion: MockRequest = {
    method: 'GET',
    path,
    params: coincidencia!.params,
    query: new URLSearchParams(query),
    body: null,
    headers: new HttpHeaders(),
    user: null,
  };
  return coincidencia!.handler(peticion) as Record<string, unknown>;
}

/** Todas las páginas de un listado por cursor, juntas. */
function todo<T>(path: string, query: Record<string, string> = {}): T[] {
  const items: T[] = [];
  let cursor: string | null = null;
  do {
    const pagina = get(path, { ...query, limit: '200', ...(cursor === null ? {} : { cursor }) }) as {
      items: T[];
      nextCursor: string | null;
    };
    items.push(...pagina.items);
    cursor = pagina.nextCursor;
  } while (cursor !== null);
  return items;
}

const nombres = (items: readonly { displayName: string }[]) => new Set(items.map((i) => i.displayName));

describe('cada dato de markdown_convertidos sale por el endpoint de su pantalla', () => {
  it('la guía de profesionales lista a los 763 de la red y a los 13 usuarios médicos', () => {
    const guia = todo<{ profileId: string; displayName: string; professionalTitle: string }>('/profiles/practitioners');
    expect(guia.length).toBe(15 + INSURER_NETWORK_PRACTITIONERS.length + REGISTERED_PRACTITIONERS.length);
    const vistos = new Set(guia.map((p) => p.displayName.toUpperCase()));
    for (const p of INSURER_NETWORK_PRACTITIONERS) {
      const enOrden = `${p.givenNames} ${p.surnames}`.toUpperCase();
      const comoLaFuente = `${p.surnames} ${p.givenNames}`.toUpperCase();
      expect(vistos.has(enOrden) || vistos.has(comoLaFuente), p.id).toBe(true);
    }
  });

  it('el directorio público devuelve la vitrina de cada médico', () => {
    const publicos = todo<{ displayName: string }>('/public/search/practitioners');
    expect(publicos.length).toBeGreaterThanOrEqual(15 + INSURER_NETWORK_PRACTITIONERS.length + REGISTERED_PRACTITIONERS.length);
  });

  it('el directorio de clínicas trae las 22 clínicas, los 17 hospitales y los 464 centros de primer nivel', () => {
    const vistas = nombres(todo('/public/search/organizations'));
    for (const c of [...CLINICAS_REALES, ...HOSPITALES_REALES]) expect(vistas.has(c.name), c.name).toBe(true);
    const primerNivel = todo<{ displayName: string; headline: string }>('/public/search/organizations').filter((o) =>
      o.headline.startsWith('Centro de salud de primer nivel'),
    );
    expect(primerNivel).toHaveLength(PRIMARY_CARE_CENTERS.length);
  });

  it('el directorio de aseguradoras trae las 19, sin que una tape a otra', () => {
    const vistas = todo<{ slug: string }>('/public/search/insurers');
    const reales = vistas.filter((v) => !['seguros-andina'].includes(v.slug));
    expect(new Set(reales.map((v) => v.slug)).size).toBe(reales.length);
    expect(reales.length).toBeGreaterThanOrEqual(ASEGURADORAS_REALES.length);
  });

  it('el directorio de farmacias trae las 7 de la planilla', () => {
    const vistas = nombres(todo('/public/search/pharmacies'));
    for (const f of PHARMACIES_AND_LABS.filter((x) => x.kind === 'PHARMACY')) expect(vistas.has(f.name), f.name).toBe(true);
  });

  it('el directorio de laboratorios trae los laboratorios y centros de la planilla', () => {
    const pagina = get('/diagnostic-units/search', { limit: '1000' }) as { items: { name: string }[] };
    const vistos = pagina.items.map((u) => u.name.toUpperCase());
    for (const u of PHARMACIES_AND_LABS.filter((x) => x.kind !== 'PHARMACY')) {
      // Plexus y Zuna vienen del corpus con su nombre de cadena.
      const clave = /plexus/i.test(u.name) ? 'PLEXUS' : /zuna/i.test(u.name) ? 'ZUNA' : u.name.toUpperCase();
      expect(vistos.some((v) => v.includes(clave)), u.name).toBe(true);
    }
  });

  it('el padrón de pacientes trae a las 92 personas de USUARIO_PACIENTES', () => {
    const lista = todo<{ displayName: string }>('/profiles/patients');
    const vistos = new Set(lista.map((p) => p.displayName.toUpperCase()));
    for (const p of REGISTERED_PATIENTS) {
      const nombre = [p.givenName, p.middleName, p.surname, p.motherSurname].filter(Boolean).join(' ').toUpperCase();
      expect(vistos.has(nombre), nombre).toBe(true);
    }
  });

  it('el nomenclador trae las 4887 prestaciones de los dos aranceles', () => {
    const todas = todo<{ code: string }>('/billing/service-catalog/procedures');
    expect(todas).toHaveLength(MEDICAL_FEE_SCHEDULE.length + DENTAL_FEE_SCHEDULE.length);
    expect(new Set(todas.map((i) => i.code)).size).toBe(todas.length);
  });
});
