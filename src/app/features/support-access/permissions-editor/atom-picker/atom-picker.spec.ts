import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';

import { localPermissionCatalog } from '../local-catalog';
import { AtomPicker } from './atom-picker';

describe('AtomPicker', () => {
  let fixture: ComponentFixture<AtomPicker>;
  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byId = (id: string): HTMLElement | null => host().querySelector(`[data-testid="${id}"]`);
  const checks = (): number => host().querySelectorAll('[data-testid^="atom-check-"]').length;

  function montar(entradas: Record<string, unknown> = {}): void {
    fixture = TestBed.createComponent(AtomPicker);
    fixture.componentRef.setInput('catalog', localPermissionCatalog());
    for (const [nombre, valor] of Object.entries(entradas))
      fixture.componentRef.setInput(nombre, valor);
    fixture.detectChanges();
  }

  it('agrupa los 73 permisos en las 7 categorías; empiezan abiertas solo las que ya tienen algo marcado', () => {
    montar({ selected: ['agenda.appointment.view'] });

    expect(host().querySelectorAll('[data-testid^="atom-category-"]')).toHaveLength(7);
    expect(byId('atom-agenda.appointment.view')).not.toBeNull();
    expect(byId('atom-billing.receipt.void')).toBeNull();
    expect(byId('atom-category-SUPPORT_AGENDA')!.textContent).toContain('1 de 20 marcados');
  });

  it('«Desplegar todo» muestra los 73, con la sensibilidad en texto y lo que pide cada uno', () => {
    montar();
    (byId('atoms-expand-all') as HTMLElement).click();
    fixture.detectChanges();

    expect(checks()).toBe(73);
    expect(byId('atom-badge-billing.receipt.void')!.textContent).toContain('Sensibilidad: Crítica');
    expect(byId('atom-badge-agenda.appointment.view')!.textContent).toContain('Sensibilidad: Baja');
    expect(byId('atom-tags-billing.receipt.void')!.textContent).toContain('Pide motivo');
    expect(byId('atom-tags-billing.receipt.void')!.textContent).toContain(
      'Pide verificación en dos pasos',
    );
  });

  it('la búsqueda filtra por nombre y abre lo que encuentra', () => {
    montar();
    const input = byId('atom-search') as HTMLInputElement;
    input.value = 'cobrar';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(byId('atom-billing.payment.collect')).not.toBeNull();
    expect(byId('atom-agenda.appointment.create')).toBeNull();
  });

  it('un permiso que no se puede dar al personal de apoyo queda deshabilitado con el motivo', () => {
    montar();
    (byId('atoms-expand-all') as HTMLElement).click();
    fixture.detectChanges();

    expect(
      (byId('atom-check-team.sod.manage')!.querySelector('input') as HTMLInputElement).disabled,
    ).toBe(true);
    expect(byId('atom-reason-team.sod.manage')!.textContent).toContain(
      'Solo el administrador de seguridad puede dar esto.',
    );
  });

  it('el motivo de quien administra (techo) se muestra igual, y marcar avisa el cambio', () => {
    montar({
      disabledReasons: {
        'billing.payment.collect': 'Solo el administrador de seguridad puede dar esto.',
      },
    });
    const cambios: unknown[] = [];
    fixture.componentInstance.toggled.subscribe((c) => cambios.push(c));
    (byId('atoms-expand-all') as HTMLElement).click();
    fixture.detectChanges();

    expect(
      (byId('atom-check-billing.payment.collect')!.querySelector('input') as HTMLInputElement)
        .disabled,
    ).toBe(true);
    (
      byId('atom-check-agenda.appointment.create')!.querySelector('input') as HTMLInputElement
    ).click();
    expect(cambios).toEqual([{ atom: 'agenda.appointment.create', on: true }]);
  });

  it('un error del servidor sobre un permiso se ve junto a su casilla y abre su categoría', () => {
    montar({
      issues: { 'billing.receipt.void': ['Anular recibos no cabe en el techo de la plantilla.'] },
    });

    expect(byId('atom-billing.receipt.void')!.textContent).toContain(
      'Anular recibos no cabe en el techo de la plantilla.',
    );
  });

  it('con `disabled` ninguna casilla se puede tocar', () => {
    montar({ disabled: true });
    (byId('atoms-expand-all') as HTMLElement).click();
    fixture.detectChanges();
    const alguna = vi.fn();
    fixture.componentInstance.toggled.subscribe(alguna);

    expect(
      (byId('atom-check-agenda.appointment.view')!.querySelector('input') as HTMLInputElement)
        .disabled,
    ).toBe(true);
    expect(alguna).not.toHaveBeenCalled();
  });
});
