import { HttpHeaders } from '@angular/common/http';

import { crearRouterSimulado } from '../handlers';
import type { MockRequest } from '../mock-router';
import { recursos } from './agenda';
import { vitrinas } from './comunidad';
import { DENTAL_FEE_SCHEDULE, MEDICAL_FEE_SCHEDULE } from './fee-schedules.generated';
import { INSURER_NETWORK_PRACTITIONERS } from './insurer-network.generated';
import { credencialesDe, licenciasDe, PROFESIONALES, PROFESIONALES_DEMO_REGISTRADOS } from './personas';

/* ============================================================================
    Los catálogos de `markdown_convertidos/` que el propietario pidió ver.

    Dos cosas se fijan acá. Que **se ven**: el nomenclador responde con la forma
    que lee el importador —con el arreglo pelado, `body.items` era `undefined`
    y la pantalla del arancel se caía entera—. Y que los médicos reales de la
    red **no traen nada inventado**: ni agenda, ni nota, ni diploma.
    ========================================================================== */

const router = crearRouterSimulado();

function get(path: string, query: Record<string, string> = {}): unknown {
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
  return coincidencia!.handler(peticion);
}

describe('el arancel real en el nomenclador', () => {
  it('las especialidades vienen envueltas en `items`, como las lee el importador', () => {
    const respuesta = get('/billing/service-catalog/procedure-specialties') as {
      items: { specialty: string; count: number }[];
    };
    expect(Array.isArray(respuesta.items)).toBe(true);
    const total = respuesta.items.reduce((suma, e) => suma + e.count, 0);
    expect(total).toBe(MEDICAL_FEE_SCHEDULE.length + DENTAL_FEE_SCHEDULE.length);
    expect(respuesta.items.map((e) => e.specialty)).toContain('Traumatología y Ortopedia');
    expect(respuesta.items.map((e) => e.specialty)).toContain('Odontología · Endodoncia');
  });

  it('el médico va en UMA y el odontológico en dólares, sin convertir', () => {
    const medica = get('/billing/service-catalog/procedures', { q: 'Sigmoidectomia' }) as {
      items: { priceUnit: string; referencePrice: string }[];
    };
    expect(medica.items[0]).toMatchObject({ priceUnit: 'UMA', referencePrice: '156' });

    const dental = get('/billing/service-catalog/procedures', { specialty: 'Odontología · Endodoncia' }) as {
      items: { priceUnit: string | null }[];
    };
    expect(dental.items.length).toBeGreaterThan(0);
    expect(dental.items.every((i) => i.priceUnit === 'USD')).toBe(true);
  });

  it('lo que la planilla no cotiza viaja en null, no en cero', () => {
    const sinPrecio = DENTAL_FEE_SCHEDULE.filter((i) => i.referencePrice === null);
    expect(sinPrecio.length).toBeGreaterThan(0);
    expect(sinPrecio.every((i) => i.priceUnit === null)).toBe(true);
  });
});

describe('los médicos reales de la red de las aseguradoras', () => {
  const deLaRed = PROFESIONALES.filter((p) => p.origen === 'RED_ASEGURADORA');

  it('reemplazan a los generados con faker, todos', () => {
    expect(deLaRed.length).toBe(INSURER_NETWORK_PRACTITIONERS.length);
    const deLaPlanilla = PROFESIONALES.filter((p) => p.origen === 'USUARIO_PROPIETARIO');
    // Los de demostración (D-H3-PROV-01) son un grupo aparte: ni red ni planilla.
    const deDemostracion = PROFESIONALES.filter((p) => p.origen === 'DEMO');
    expect(deDemostracion).toEqual([...PROFESIONALES_DEMO_REGISTRADOS]);
    expect(PROFESIONALES.length).toBe(15 + deLaRed.length + deLaPlanilla.length + deDemostracion.length);
  });

  it('aparecen en el directorio público con su aseguradora', () => {
    const vitrina = vitrinas.todos().find((v) => /Menacho Butron/.test(v.displayName));
    expect(vitrina).toBeDefined();
    expect(vitrina!.headline).toContain('Alianza Seguros');
  });

  it('no tienen agenda, nota, seguidores ni credenciales inventadas', () => {
    const ids = new Set(deLaRed.map((p) => p.id));
    expect(recursos.todos().filter((r) => ids.has(r.resourceRefId))).toEqual([]);

    const suyas = vitrinas.todos().filter((v) => ids.has(v.targetId));
    expect(suyas.every((v) => v.ratingAverage === null && v.seguidores === 0 && !v.hasPublishedAgenda)).toBe(true);
    expect(deLaRed.every((p) => !p.verified)).toBe(true);
    expect(deLaRed.flatMap(credencialesDe)).toEqual([]);
    expect(deLaRed.flatMap(licenciasDe)).toEqual([]);
  });
});
