import { firstValueFrom, of, throwError } from 'rxjs';
import { vi } from 'vitest';

import type { SupportEngagement } from '../../../core/data-access/support-access/support-access.types';
import { confirmBatch, describeBatch, revokeBatch } from './review-batch';

const persona = (id: string, grants: number): SupportEngagement =>
  ({ id, personName: `Persona ${id}`, grants: Array.from({ length: grants }, (_, i) => ({ id: `${id}-g${i}` })) }) as unknown as SupportEngagement;

describe('confirmar en lote', () => {
  it('confirma a cada persona, con el período pedido o sin él', async () => {
    const recertify = vi.fn(() => of({} as SupportEngagement));
    const r = await firstValueFrom(confirmBatch({ recertify: recertify as never }, [persona('a', 1), persona('b', 0)], 12));
    expect(r.map((x) => x.ok)).toEqual([true, true]);
    expect(recertify).toHaveBeenCalledWith('a', 12);
    await firstValueFrom(confirmBatch({ recertify: recertify as never }, [persona('c', 0)]));
    expect(recertify).toHaveBeenLastCalledWith('c', undefined);
  });

  it('una que falla no frena a las demás y queda dicho cuál', async () => {
    const recertify = vi.fn((id: string) => (id === 'b' ? throwError(() => new Error('x')) : of({} as SupportEngagement)));
    const r = await firstValueFrom(confirmBatch({ recertify: recertify as never }, [persona('a', 0), persona('b', 0), persona('c', 0)]));
    expect(r.filter((x) => !x.ok).map((x) => x.engagementId)).toEqual(['b']);
    expect(recertify).toHaveBeenCalledTimes(3);
    expect(describeBatch(r, 'confirm')).toEqual({ tone: 'warning', text: 'Se confirmó el vínculo de 2 personas. No se pudo con Persona b: vuelva a intentarlo con ellas.' });
  });
});

describe('quitar permisos en lote', () => {
  it('retira cada permiso de cada persona y cuenta cuántos', async () => {
    const changeGrant = vi.fn(() => of({} as never));
    const r = await firstValueFrom(revokeBatch({ changeGrant: changeGrant as never }, [persona('a', 2), persona('b', 1)]));
    expect(changeGrant).toHaveBeenCalledTimes(3);
    expect(changeGrant).toHaveBeenCalledWith('a', { grantId: 'a-g0', revoke: true });
    expect(r.find((x) => x.engagementId === 'a')!.revoked).toBe(2);
  });

  it('si falla un permiso de una persona, esa persona figura como fallida y las otras siguen', async () => {
    const changeGrant = vi.fn((id: string) => (id === 'a' ? throwError(() => new Error('x')) : of({} as never)));
    const r = await firstValueFrom(revokeBatch({ changeGrant: changeGrant as never }, [persona('a', 2), persona('b', 1)]));
    expect(r.map((x) => [x.engagementId, x.ok])).toEqual(expect.arrayContaining([['a', false], ['b', true]]));
  });
});

describe('el resumen', () => {
  it('todo bien, todo mal y mezcla', () => {
    const ok = { engagementId: 'a', personName: 'A', ok: true };
    const mal = { engagementId: 'b', personName: 'B', ok: false };
    expect(describeBatch([ok], 'revoke')).toEqual({ tone: 'success', text: 'Se quitaron los permisos de 1 persona.' });
    expect(describeBatch([mal], 'confirm').tone).toBe('error');
    expect(describeBatch([ok, mal], 'confirm').tone).toBe('warning');
  });
});
