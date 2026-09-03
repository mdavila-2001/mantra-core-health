import { firstValueFrom, of } from 'rxjs';

import { miRecursoDeAgenda, misRecursosDeAgenda } from './mi-recurso';
import type { SchedulingClient } from '@core/data-access/scheduling/scheduling.client';
import type { AgendaResource } from '@core/data-access/scheduling/scheduling.types';

const PERFIL = 'hp-1';

function recurso(id: string, name: string, refId = PERFIL): AgendaResource {
  return { id, name, resourceRefId: refId } as AgendaResource;
}

/** Un cliente que devuelve la página que se le pida. */
function clienteCon(items: readonly AgendaResource[]): SchedulingClient {
  return {
    listResources: () => of({ items, count: items.length }),
  } as unknown as SchedulingClient;
}

/**
 * LAS AGENDAS DE QUIEN ATIENDE — todas, no la primera.
 *
 * El defecto que esto cierra se encontró en un recorrido real: la pantalla de
 * publicar horarios no preguntaba **en qué agenda**, y la causa era una línea.
 * `miRecursoDeAgenda` resolvía con `.find(...)`, que devuelve una y descarta el
 * resto, así que un profesional que atiende en dos sedes tenía la segunda
 * invisible en todo el producto.
 *
 * No era hipotético: en la base de desarrollo hay un profesional con **tres**
 * —«Consultorio propio», «Consultorio en la Caja», «Segundo turno propio»— y
 * sólo se veía la primera.
 */
describe('misRecursosDeAgenda', () => {
  it('devuelve TODAS las agendas del profesional, no la primera', async () => {
    const cliente = clienteCon([
      recurso('r-1', 'Consultorio propio'),
      recurso('r-2', 'Consultorio en la Caja'),
      recurso('r-3', 'Segundo turno propio'),
    ]);

    const recursos = await firstValueFrom(misRecursosDeAgenda(cliente, 't-1', PERFIL));

    expect(recursos.map((r) => r.name)).toEqual([
      'Consultorio propio',
      'Consultorio en la Caja',
      'Segundo turno propio',
    ]);
  });

  it('deja fuera las agendas de otros profesionales', async () => {
    // El filtro es por perfil, que es el mismo criterio con el que el backend
    // decide si la agenda es tuya. Sin esto, alguien publicaría sobre la agenda
    // de un colega y el servidor lo rechazaría con un 403 sin explicación.
    const cliente = clienteCon([
      recurso('r-1', 'La mía'),
      recurso('r-9', 'La de otro', 'hp-999'),
    ]);

    const recursos = await firstValueFrom(misRecursosDeAgenda(cliente, 't-1', PERFIL));

    expect(recursos.map((r) => r.id)).toEqual(['r-1']);
  });

  it('sin ninguna agenda devuelve la lista vacía, no un error', async () => {
    const recursos = await firstValueFrom(misRecursosDeAgenda(clienteCon([]), 't-1', PERFIL));

    expect(recursos).toEqual([]);
  });
});

describe('miRecursoDeAgenda', () => {
  it('sigue devolviendo la primera: las otras pantallas no cambian', async () => {
    // «Consulta médica» y «Evoluciones» siguen usando ésta. También tendrían
    // que preguntar cuál, pero eso es tocar tres pantallas en un arreglo que se
    // pidió para una — queda dicho, no hecho.
    const cliente = clienteCon([recurso('r-1', 'Primera'), recurso('r-2', 'Segunda')]);

    const elegido = await firstValueFrom(miRecursoDeAgenda(cliente, 't-1', PERFIL));

    expect(elegido?.id).toBe('r-1');
  });

  it('sin agendas devuelve null, como antes', async () => {
    const elegido = await firstValueFrom(miRecursoDeAgenda(clienteCon([]), 't-1', PERFIL));

    expect(elegido).toBeNull();
  });
});
