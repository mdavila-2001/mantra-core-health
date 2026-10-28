import { describe, expect, it } from 'vitest';

import type { ServiceOffering } from '../../../core/data-access/scheduling/scheduling.types';
import {
  DESTINO_TODAS_MIS_CONSULTAS,
  ID_TIPO_ATENCION_CONSULTA,
} from '../../../core/data-access/surveys/surveys-targets';
import {
  asociacionesVisibles,
  destinoDeOpcion,
  opcionesDeDestino,
  serviciosAsociables,
  VALOR_TODAS_MIS_CONSULTAS,
} from './survey-destinos';

function oferta(id: string, catalogo: string, nombre: string, activa = true): ServiceOffering {
  return {
    id,
    practitionerProfileId: 'p-1',
    serviceCatalogId: catalogo,
    serviceCode: nombre.toUpperCase(),
    serviceName: nombre,
    price: '100.00',
    minDurationMinutes: 10,
    maxDurationMinutes: 20,
    prepMinutes: 0,
    cleanupMinutes: 0,
    isPatientBookable: true,
    requiresApproval: false,
    isActive: activa,
  };
}

describe('servicios asociables', () => {
  it('se identifican por billing.service_catalog.id, no por el id de la oferta', () => {
    const servicios = serviciosAsociables([oferta('oferta-1', 'catalogo-ecg', 'Electrocardiograma')]);
    expect(servicios).toEqual([{ id: 'catalogo-ecg', nombre: 'Electrocardiograma', activo: true }]);
  });

  it('dos ofertas del mismo servicio de catálogo son un solo servicio', () => {
    const servicios = serviciosAsociables([
      oferta('oferta-1', 'catalogo-ecg', 'Electrocardiograma', false),
      oferta('oferta-2', 'catalogo-ecg', 'Electrocardiograma', true),
    ]);
    expect(servicios).toHaveLength(1);
    expect(servicios[0]!.activo).toBe(true);
  });

  it('salen por orden alfabético', () => {
    const servicios = serviciosAsociables([
      oferta('o1', 'c1', 'Prueba de esfuerzo'),
      oferta('o2', 'c2', 'Ecocardiograma'),
    ]);
    expect(servicios.map((s) => s.nombre)).toEqual(['Ecocardiograma', 'Prueba de esfuerzo']);
  });
});

describe('opciones del selector', () => {
  const servicios = serviciosAsociables([
    oferta('o1', 'c1', 'Electrocardiograma'),
    oferta('o2', 'c2', 'Holter', false),
  ]);

  it('«Todas mis consultas» va primero y después cada servicio', () => {
    const opciones = opcionesDeDestino(servicios);
    expect(opciones.map((o) => o.label)).toEqual(['Todas mis consultas', 'Electrocardiograma', 'Holter']);
    expect(opciones[0]!.value).toBe(VALOR_TODAS_MIS_CONSULTAS);
  });

  it('un servicio desactivado lo dice, no se esconde', () => {
    const holter = opcionesDeDestino(servicios).find((o) => o.label === 'Holter');
    expect(holter?.description).toBe('Servicio desactivado');
  });

  it('sin servicios queda «Todas mis consultas»: la opción no depende de la lista', () => {
    expect(opcionesDeDestino([]).map((o) => o.value)).toEqual([VALOR_TODAS_MIS_CONSULTAS]);
  });
});

describe('qué se manda a la API', () => {
  it('un servicio viaja como SERVICE con su id de catálogo', () => {
    expect(destinoDeOpcion('c1')).toEqual({ targetType: 'SERVICE', targetId: 'c1' });
  });

  it('«Todas mis consultas» viaja como CARE_TYPE con el valor aislado en una constante', () => {
    const destino = destinoDeOpcion(VALOR_TODAS_MIS_CONSULTAS);
    expect(destino).toEqual(DESTINO_TODAS_MIS_CONSULTAS);
    expect(destino).toEqual({ targetType: 'CARE_TYPE', targetId: ID_TIPO_ATENCION_CONSULTA });
  });
});

describe('a qué está asociada hoy', () => {
  const servicios = serviciosAsociables([oferta('o1', 'c1', 'Electrocardiograma')]);

  it('dice el NOMBRE del servicio, nunca el identificador', () => {
    const [visible] = asociacionesVisibles([{ id: 'a1', targetType: 'SERVICE', targetId: 'c1' }], servicios);
    expect(visible!.nombre).toBe('Electrocardiograma');
    // Lo que se PINTA (nombre y tipo) no lleva el id; `valor` es interno.
    expect(`${visible!.nombre} ${visible!.tipo}`).not.toContain('c1');
  });

  it('reconoce «Todas mis consultas»', () => {
    const [visible] = asociacionesVisibles(
      [{ id: 'a2', targetType: 'CARE_TYPE', targetId: ID_TIPO_ATENCION_CONSULTA }],
      servicios,
    );
    expect(visible).toMatchObject({ nombre: 'Todas mis consultas', valor: VALOR_TODAS_MIS_CONSULTAS });
  });

  it('un servicio que ya no figura entre los suyos se dice sin mostrar el UUID', () => {
    const [visible] = asociacionesVisibles(
      [{ id: 'a3', targetType: 'SERVICE', targetId: '8f3c1b2e-0000-4000-8000-000000000001' }],
      servicios,
    );
    expect(visible!.nombre).toBe('Un servicio que ya no figura entre los suyos');
    expect(visible!.nombre).not.toMatch(/[0-9a-f]{8}-/);
  });
});
