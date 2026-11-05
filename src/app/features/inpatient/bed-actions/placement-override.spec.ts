import type { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { askOverride, violationsOf } from './placement-override';

describe('forzar compatibilidad', () => {
  const dialogs = (respuesta: string | null) => ({ confirmWithReason: vi.fn(async () => respuesta) }) as unknown as DialogService;

  it('pide 20 caracteres y devuelve las reglas forzadas', async () => {
    const d = dialogs('Única cama libre del piso, autorizado');
    const r = await askOverride(d, [{ rule: 'SEX', severity: 'OVERRIDABLE', detail: 'x' }]);
    expect(r).toEqual({ justification: 'Única cama libre del piso, autorizado', ruleCodes: ['SEX'] });
    expect((d.confirmWithReason as ReturnType<typeof vi.fn>).mock.calls[0]![1]).toMatchObject({ minLength: 20 });
  });

  it('con una bloqueante no ofrece forzar', async () => {
    const d = dialogs('lo que sea');
    expect(await askOverride(d, [{ rule: 'SEX', severity: 'OVERRIDABLE', detail: 'x' }, { rule: 'HYGIENE', severity: 'BLOCKING', detail: 'y' }])).toBeNull();
    expect(d.confirmWithReason).not.toHaveBeenCalled();
  });

  it('lee las violaciones del detalle del error', () => {
    expect(violationsOf({ violations: [{ rule: 'AGE' }] })).toHaveLength(1);
    expect(violationsOf({})).toEqual([]);
  });
});
