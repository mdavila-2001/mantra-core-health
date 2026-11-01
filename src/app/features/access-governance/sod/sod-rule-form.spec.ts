import { TestBed, type ComponentFixture } from '@angular/core/testing';

import type { SodRule } from '../../../core/data-access/access-governance/governance-rules.types';
import { SUPPORT_ATOMS } from '../../../core/data-access/support-access/support-atoms';
import { SodRuleForm, type SodRuleSubmission } from './sod-rule-form';

/**
 * El formulario de una regla de separación de funciones (SoD). Valida código
 * (al crear), nombre, los dos grupos de permisos y los días de excepción; y
 * emite lo que la API espera: al crear, el código y la regla base si se
 * eligió; al editar, la versión esperada (`expectedRowVersion`) para que la API
 * detecte una edición concurrente. Lo opcional vacío no viaja.
 */

const A = SUPPORT_ATOMS[0]!.code;
const B = SUPPORT_ATOMS[1]!.code;

const REGLA: SodRule = {
  id: 'r-1',
  code: 'SOD-ORG-01',
  name: 'Cobrar y anular',
  atomsA: [A],
  atomsB: [B],
  scope: 'PERSON',
  action: 'REQUIRE_APPROVAL',
  isHard: false,
  maxExceptionDays: 30,
  rationale: 'Riesgo de fraude',
  rowVersion: 4,
} as unknown as SodRule;

describe('SodRuleForm', () => {
  let fixture: ComponentFixture<SodRuleForm>;
  let enviados: SodRuleSubmission[];
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement = HTMLElement>(id: string): T | null => root().querySelector<T>(`[data-testid="${id}"]`);

  async function pintar(rule: SodRule | null = null, busy = false): Promise<void> {
    fixture = TestBed.createComponent(SodRuleForm);
    fixture.componentRef.setInput('rule', rule);
    fixture.componentRef.setInput('busy', busy);
    enviados = [];
    fixture.componentInstance.submitted.subscribe((s) => enviados.push(s));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function escribir(id: string, texto: string): Promise<void> {
    const campo = q<HTMLInputElement>(id)!;
    campo.value = texto;
    campo.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function marcar(prefijo: 'a' | 'b', code: string): void {
    const caja = root().querySelector<HTMLInputElement>(`[data-testid="sod-form-${prefijo}-opcion-${code}"] input`)!;
    caja.checked = true;
    caja.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  async function enviar(): Promise<void> {
    q('sod-form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('vacío: no emite y lista todo lo que falta', async () => {
    await pintar();
    await enviar();
    expect(enviados).toEqual([]);
    const problemas = q('sod-form-problemas')!.textContent!;
    expect(problemas).toContain('Escriba un código como SOD-ORG-01.');
    expect(problemas).toContain('Póngale un nombre que se entienda.');
    expect(problemas).toContain('Elija al menos un permiso del primer grupo.');
    expect(problemas).toContain('Elija al menos un permiso del segundo grupo.');
  });

  it('un código con otra forma se rechaza', async () => {
    await pintar();
    await escribir('sod-form-codigo', 'sod org 1');
    await enviar();
    expect(q('sod-form-problemas')?.textContent).toContain('Escriba un código como SOD-ORG-01.');
  });

  it('crear: emite código y nombre recortados, los dos grupos, y lo opcional vacío no viaja', async () => {
    await pintar();
    await escribir('sod-form-codigo', ' SOD-ORG-07 ');
    await escribir('sod-form-nombre', '  Pagar y aprobar  ');
    await escribir('sod-form-dias', '');
    marcar('a', A);
    marcar('b', B);
    await enviar();
    expect(enviados).toEqual([
      {
        mode: 'create',
        rule: { code: 'SOD-ORG-07', name: 'Pagar y aprobar', atomsA: [A], atomsB: [B], scope: 'PERSON', action: 'REQUIRE_APPROVAL', isHard: false },
      },
    ]);
  });

  it('días de excepción menores a 1 se rechazan; «sin excepciones» los oculta y no los manda', async () => {
    await pintar();
    await escribir('sod-form-codigo', 'SOD-ORG-07');
    await escribir('sod-form-nombre', 'Pagar y aprobar');
    marcar('a', A);
    marcar('b', B);
    await escribir('sod-form-dias', '0');
    await enviar();
    expect(enviados).toEqual([]);
    expect(q('sod-form-problemas')?.textContent).toContain('Los días de una excepción son un número desde 1.');

    const dura = q('sod-form-dura')!.querySelector('input')!;
    dura.checked = true;
    dura.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(q('sod-form-dias')).toBeNull();
    await enviar();
    expect(enviados[0]).toEqual({ mode: 'create', rule: expect.objectContaining({ isHard: true }) });
    expect((enviados[0] as { rule: object }).rule).not.toHaveProperty('maxExceptionDays');
  });

  it('editar: precarga la regla, no pide código y manda la versión esperada', async () => {
    await pintar(REGLA);
    expect(q('sod-form-codigo')).toBeNull();
    expect(q<HTMLInputElement>('sod-form-nombre')!.value).toBe('Cobrar y anular');
    expect(root().querySelector('h3')?.textContent?.trim()).toBe('Editar la regla');
    await escribir('sod-form-nombre', 'Cobrar y anular cobros');
    await enviar();
    expect(enviados).toEqual([
      {
        mode: 'edit',
        ruleId: 'r-1',
        change: {
          expectedRowVersion: 4,
          name: 'Cobrar y anular cobros',
          atomsA: [A],
          atomsB: [B],
          scope: 'PERSON',
          action: 'REQUIRE_APPROVAL',
          isHard: false,
          maxExceptionDays: 30,
          rationale: 'Riesgo de fraude',
        },
      },
    ]);
  });

  it('ocupado no emite; el fallo de la API se muestra; cancelar emite', async () => {
    await pintar(REGLA, true);
    await enviar();
    expect(enviados).toEqual([]);
    fixture.componentRef.setInput('failure', 'Otra persona cambió la regla.');
    fixture.detectChanges();
    expect(q('sod-form-error')?.textContent).toContain('Otra persona cambió la regla.');
    let cancelado = 0;
    fixture.componentInstance.cancelled.subscribe(() => (cancelado += 1));
    q('sod-form-cancelar')!.click();
    expect(cancelado).toBe(1);
  });
});
