import { firstValueFrom, of, throwError } from 'rxjs';

import { agendaResourceMy, agendaResourcesMy, agendaWithLiveSchedule } from './my-resource';
import type { SchedulingClient } from '@core/data-access/scheduling/scheduling.client';
import type { AgendaResource, PublishedTemplate } from '@core/data-access/scheduling/scheduling.types';

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

    const recursos = await firstValueFrom(agendaResourcesMy(cliente, 't-1', PERFIL));

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

    const recursos = await firstValueFrom(agendaResourcesMy(cliente, 't-1', PERFIL));

    expect(recursos.map((r) => r.id)).toEqual(['r-1']);
  });

  it('sin ninguna agenda devuelve la lista vacía, no un error', async () => {
    const recursos = await firstValueFrom(agendaResourcesMy(clienteCon([]), 't-1', PERFIL));

    expect(recursos).toEqual([]);
  });
});

describe('miRecursoDeAgenda', () => {
  it('sigue devolviendo la primera: las otras pantallas no cambian', async () => {
    // «Consultas médicas» y «Evoluciones» siguen usando ésta. También tendrían
    // que preguntar cuál, pero eso es tocar tres pantallas en un arreglo que se
    // pidió para una — queda dicho, no hecho.
    const cliente = clienteCon([recurso('r-1', 'Primera'), recurso('r-2', 'Segunda')]);

    const elegido = await firstValueFrom(agendaResourceMy(cliente, 't-1', PERFIL));

    expect(elegido?.id).toBe('r-1');
  });

  it('sin agendas devuelve null, como antes', async () => {
    const elegido = await firstValueFrom(agendaResourceMy(clienteCon([]), 't-1', PERFIL));

    expect(elegido).toBeNull();
  });
});

describe('agendas en otra organización', () => {
  /** Un cliente que anota con qué se le pidió la lista. */
  function recordingClient() {
    const listResources = vi.fn(() => of({ items: [recurso('r-olivos', 'Olivos')], count: 1 }));
    return { client: { listResources } as unknown as SchedulingClient, listResources };
  }

  it('con `scope`, la búsqueda se declara como esa organización', async () => {
    const { client, listResources } = recordingClient();

    const found = await firstValueFrom(
      agendaResourceMy(client, 't-olivos', PERFIL, { tenantId: 't-olivos' }),
    );

    expect(found?.id).toBe('r-olivos');
    expect(listResources).toHaveBeenCalledWith({ tenantId: 't-olivos' }, { tenantId: 't-olivos' });
  });

  it('sin `scope` pide como siempre: la organización la pone la sesión', async () => {
    const { client, listResources } = recordingClient();

    await firstValueFrom(agendaResourcesMy(client, 't-1', PERFIL));

    expect(listResources).toHaveBeenCalledWith({ tenantId: 't-1' }, undefined);
  });
});

describe('agendaWithLiveSchedule', () => {
  const plantilla = (id: string, retired: boolean) => ({ id, retired, rules: [] }) as unknown as PublishedTemplate;

  function clienteDePlantillas(porRecurso: Record<string, readonly PublishedTemplate[] | 'error'>): SchedulingClient {
    return {
      listTemplates: (id: string) => {
        const items = porRecurso[id];
        return items === 'error' ? throwError(() => new Error('x')) : of({ items: items ?? [], count: 0 });
      },
    } as unknown as SchedulingClient;
  }

  it('skips agendas without a live schedule, or whose read failed', async () => {
    const cliente = clienteDePlantillas({
      'r-1': [],
      'r-2': 'error',
      'r-3': [plantilla('t-old', true)],
      'r-4': [plantilla('t-live', false)],
    });
    const recursos = ['r-1', 'r-2', 'r-3', 'r-4'].map((id) => recurso(id, id));

    const found = await firstValueFrom(agendaWithLiveSchedule(cliente, recursos));

    expect(found?.resource.id).toBe('r-4');
    expect(found?.template.id).toBe('t-live');
  });

  it('is null when no agenda has a schedule in force', async () => {
    const cliente = clienteDePlantillas({ 'r-1': [] });
    expect(await firstValueFrom(agendaWithLiveSchedule(cliente, [recurso('r-1', 'x')]))).toBeNull();
    expect(await firstValueFrom(agendaWithLiveSchedule(cliente, []))).toBeNull();
  });
});
