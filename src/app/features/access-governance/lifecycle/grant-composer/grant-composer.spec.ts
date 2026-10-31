import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { chooseSelectOption } from '../../../../../testing/select';
import { emptyDraft, type GrantDraft, type TargetOption } from '../grant-draft/grant-draft';
import { GrantComposer } from './grant-composer';

const OPTIONS: readonly TargetOption[] = [
  {
    key: 'SERVICE||svc-eco|',
    label: 'Servicio · Ecografía',
    target: { targetKind: 'SERVICE', healthcareServiceId: 'svc-eco' },
  },
  {
    key: 'SERVICE||svc-lab|',
    label: 'Servicio · Laboratorio',
    target: { targetKind: 'SERVICE', healthcareServiceId: 'svc-lab' },
  },
];

describe('GrantComposer', () => {
  let fixture: ComponentFixture<GrantComposer>;
  let emitted: GrantDraft[];
  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const atom = (code: string): HTMLElement | null =>
    el().querySelector(`[data-testid="g-atom-${code}"]`);
  const abrirCategoria = async (nombre: string): Promise<void> => {
    const boton = Array.from(
      el().querySelectorAll<HTMLButtonElement>('.accordion-panel__trigger'),
    ).find((b) => b.textContent!.includes(nombre))!;
    boton.click();
    fixture.detectChanges();
    await fixture.whenStable();
  };

  const abrir = async (draft: GrantDraft, inputs: Record<string, unknown> = {}): Promise<void> => {
    fixture = TestBed.createComponent(GrantComposer);
    fixture.componentRef.setInput('draft', draft);
    fixture.componentRef.setInput('options', OPTIONS);
    fixture.componentRef.setInput('idPrefix', 'g');
    for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
    emitted = [];
    fixture.componentInstance.draftChange.subscribe((d) => emitted.push(d));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(() => TestBed.configureTestingModule({}));

  it('agrupa los permisos por categoría y abre las que ya tienen algo marcado, con la cuenta de lo marcado', async () => {
    await abrir({
      ...emptyDraft(OPTIONS[0]!.key),
      atoms: ['agenda.appointment.view', 'agenda.appointment.cancel'],
    });
    const titulos = Array.from(el().querySelectorAll('.accordion-panel__label')).map((e) =>
      e.textContent!.trim(),
    );
    expect(titulos).toContain('Agenda · 2 marcados');
    expect(titulos).toContain('Facturación y caja');
    expect(atom('agenda.appointment.cancel')).not.toBeNull();
    expect(atom('billing.payment.collect')).toBeNull();
    await abrirCategoria('Facturación y caja');
    expect(atom('billing.payment.collect')).not.toBeNull();
  });

  it('lo que queda fuera del techo aparece deshabilitado con su explicación, y tocarlo no cambia nada', async () => {
    await abrir(emptyDraft(OPTIONS[0]!.key), {
      blocked: (a: string) =>
        a.startsWith('billing.') ? 'Solo el administrador de seguridad puede dar esto.' : null,
    });
    await abrirCategoria('Facturación y caja');
    const fila = atom('billing.payment.collect')!;
    const casilla = fila.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    expect(casilla.disabled).toBe(true);
    expect(fila.textContent).toContain('Solo el administrador de seguridad puede dar esto.');
    casilla.click();
    fixture.detectChanges();
    expect(emitted).toEqual([]);
  });

  it('marcar y desmarcar un permiso emite el borrador nuevo; cada permiso dice su sensibilidad y lo que pide', async () => {
    await abrir({ ...emptyDraft(OPTIONS[0]!.key), atoms: ['agenda.appointment.view'] });
    const cancelar = atom('agenda.appointment.cancel')!;
    expect(cancelar.textContent).toMatch(/Sensibilidad (baja|media|alta|crítica)/);
    cancelar.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
    expect(emitted.at(-1)!.atoms).toEqual(['agenda.appointment.view', 'agenda.appointment.cancel']);
    atom('agenda.appointment.view')!
      .querySelector<HTMLInputElement>('input[type="checkbox"]')!
      .click();
    expect(emitted.at(-1)!.atoms).toEqual([]);
  });

  it('cambia el objetivo desde la lista de lo que se puede elegir, o lo deja fijo con su nombre', async () => {
    await abrir(emptyDraft(OPTIONS[0]!.key));
    await chooseSelectOption(
      fixture,
      el().querySelector('[data-testid="g-target"]')!,
      'Servicio · Laboratorio',
    );
    expect(emitted.at(-1)!.targetKey).toBe(OPTIONS[1]!.key);
    fixture.destroy();

    await abrir(emptyDraft(OPTIONS[1]!.key), { lockTarget: true });
    expect(el().querySelector('[data-testid="g-target"]')!.textContent!.trim()).toBe(
      'Servicio · Laboratorio',
    );
    expect(el().querySelector('app-select')).toBeNull();
  });

  it('avisa si la vigencia pasa del último día que quien administra puede dar', async () => {
    await abrir(
      { ...emptyDraft(OPTIONS[0]!.key), validTo: '2027-06-01' },
      { maxValidTo: '2026-12-31' },
    );
    expect(el().textContent).toContain(
      'Como máximo hasta el 2026-12-31: es lo que usted puede dar.',
    );
    fixture.componentRef.setInput('draft', {
      ...emptyDraft(OPTIONS[0]!.key),
      validTo: '2026-11-30',
    });
    fixture.detectChanges();
    expect(el().textContent).not.toContain('Como máximo hasta');
  });

  it('el botón «Quitar este permiso» solo existe si se puede quitar y avisa al padre', async () => {
    await abrir(emptyDraft(OPTIONS[0]!.key));
    expect(el().querySelector('[data-testid="g-remove"]')).toBeNull();
    fixture.destroy();
    await abrir(emptyDraft(OPTIONS[0]!.key), { removable: true });
    let removed = 0;
    fixture.componentInstance.removed.subscribe(() => removed++);
    el().querySelector<HTMLElement>('[data-testid="g-remove"]')!.click();
    expect(removed).toBe(1);
  });
});
