import { firstValueFrom, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import type { SchedulingClient } from '@core/data-access/scheduling/scheduling.client';
import type { TenantScope } from '@core/data-access/scheduling/tenant-scope';
import { findMyAgenda } from './my-live-agenda';

const PERFIL = 'perfil-1';

/** A client whose agendas and templates are given per organization and per agenda. */
function client(
  resourcesByTenant: Record<string, string[] | 'falla'>,
  liveByResource: Record<string, boolean>,
): SchedulingClient & { listResources: ReturnType<typeof vi.fn> } {
  return {
    listResources: vi.fn(({ tenantId }: { tenantId: string }) => {
      const ids = resourcesByTenant[tenantId] ?? [];
      if (ids === 'falla') return throwError(() => new Error('403'));
      return of({ items: ids.map((id) => ({ id, resourceRefId: PERFIL })) });
    }),
    listTemplates: vi.fn((resourceId: string, _scope?: TenantScope) =>
      of({ items: [{ id: `t-${resourceId}`, retired: liveByResource[resourceId] !== true }] }),
    ),
  } as unknown as SchedulingClient & { listResources: ReturnType<typeof vi.fn> };
}

describe('findMyAgenda', () => {
  it('se queda con la agenda que tiene horario vigente, no con la primera vacía', async () => {
    const api = client({ activa: ['vacia', 'llena'] }, { llena: true });
    const found = await firstValueFrom(findMyAgenda(api, ['activa'], PERFIL));
    expect(found?.resource.id).toBe('llena');
  });

  it('encuentra el horario publicado en otra organización de la sesión', async () => {
    const api = client({ activa: [], afiliada: ['res-b'] }, { 'res-b': true });
    const found = await firstValueFrom(findMyAgenda(api, ['activa', 'afiliada'], PERFIL));
    expect(found?.tenantId).toBe('afiliada');
    expect(api.listResources).toHaveBeenLastCalledWith(
      { tenantId: 'afiliada' },
      { tenantId: 'afiliada' },
    );
  });

  it('no pregunta en otras organizaciones si la activa ya tiene horario', async () => {
    const api = client(
      { activa: ['res-a'], afiliada: ['res-b'] },
      { 'res-a': true, 'res-b': true },
    );
    const found = await firstValueFrom(findMyAgenda(api, ['activa', 'afiliada'], PERFIL));
    expect(found?.tenantId).toBe('activa');
    expect(api.listResources).toHaveBeenCalledTimes(1);
  });

  it('una organización ajena que falla es «no está ahí»; la activa que falla es un fallo', async () => {
    const ajena = client({ activa: [], afiliada: 'falla' }, {});
    expect(await firstValueFrom(findMyAgenda(ajena, ['activa', 'afiliada'], PERFIL))).toBeNull();

    const activa = client({ activa: 'falla' }, {});
    await expect(firstValueFrom(findMyAgenda(activa, ['activa'], PERFIL))).rejects.toThrow('403');
  });

  it('sin horario vigente en ninguna, devuelve la primera agenda propia de la activa', async () => {
    const api = client({ activa: ['retirada'], afiliada: ['otra'] }, {});
    const found = await firstValueFrom(findMyAgenda(api, ['activa', 'afiliada'], PERFIL));
    expect(found?.tenantId).toBe('activa');
    expect(found?.resource.id).toBe('retirada');
  });
});
