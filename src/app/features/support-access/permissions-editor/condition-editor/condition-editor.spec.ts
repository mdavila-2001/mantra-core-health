import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import type { PermissionAtomView } from '../../../../core/data-access/access-governance/access-explain.types';
import type { SupportCondition } from '../../../../core/data-access/access-governance/conditions.types';
import { localPermissionCatalog } from '../local-catalog';
import type { PlacedIssue } from '../issue-placement';
import { ConditionEditor } from './condition-editor';

const atoms = (...codes: string[]): readonly PermissionAtomView[] =>
  localPermissionCatalog().atoms.filter((a) => codes.includes(a.code));

describe('ConditionEditor', () => {
  let fixture: ComponentFixture<ConditionEditor>;
  let emitidas: (SupportCondition | undefined)[];
  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byId = (id: string): HTMLElement | null => host().querySelector(`[data-testid="${id}"]`);
  const clic = (el: Element | null): void => {
    (el as HTMLElement).click();
    fixture.detectChanges();
  };
  const interruptor = (id: string): HTMLInputElement => byId(id)!.querySelector('input')!;
  const poner = (id: string, valor: unknown): void => {
    const el = fixture.debugElement.query(
      (d) => (d.nativeElement as HTMLElement).getAttribute?.('data-testid') === id,
    );
    (el.componentInstance as { value: { set: (v: unknown) => void } }).value.set(valor);
    fixture.detectChanges();
  };

  function montar(entradas: Record<string, unknown> = {}): void {
    emitidas = [];
    fixture = TestBed.createComponent(ConditionEditor);
    fixture.componentRef.setInput(
      'atoms',
      atoms(
        'agenda.appointment.view',
        'agenda.appointment.view.reason',
        'agenda.appointment.cancel',
      ),
    );
    for (const [nombre, valor] of Object.entries(entradas))
      fixture.componentRef.setInput(nombre, valor);
    fixture.componentInstance.conditionChange.subscribe((c) => emitidas.push(c));
    fixture.detectChanges();
  }
  const ultima = (): SupportCondition | undefined => emitidas.at(-1);

  it('sin condiciones lo dice y todas las secciones empiezan plegadas', () => {
    montar();

    expect(byId('cond-total')!.textContent).toContain('Sin condiciones');
    expect(byId('cond-time-add')).toBeNull();
    expect(byId('cond-toggle-when')!.getAttribute('aria-expanded')).toBe('false');
  });

  it('un horario se arma con una frase y sin que nadie escriba JSON', () => {
    montar();
    clic(byId('cond-toggle-when'));
    clic(byId('cond-time-add'));

    expect(ultima()).toEqual({
      schemaVersion: 1,
      time: { windows: [{ days: [1, 2, 3, 4, 5], from: '08:00', to: '18:00' }] },
    });
  });

  it('cambiar los días con el preajuste y la hora de la franja', () => {
    montar({
      condition: {
        schemaVersion: 1,
        time: { windows: [{ days: [1, 2, 3, 4, 5], from: '08:00', to: '18:00' }] },
      },
    });
    poner('cond-time-days-0', 'mon-sat');
    expect(ultima()?.time?.windows[0]?.days).toEqual([1, 2, 3, 4, 5, 6]);

    const desde = host().querySelector('[data-testid="cond-time-from-0"]') as HTMLInputElement;
    desde.value = '07:30';
    desde.dispatchEvent(new Event('input'));
    expect(ultima()?.time?.windows[0]?.from).toBe('07:30');
  });

  it('la última franja no se puede dejar sin días', () => {
    montar({
      condition: {
        schemaVersion: 1,
        time: { windows: [{ days: [6], from: '08:00', to: '12:00' }] },
      },
    });
    poner('cond-time-days-0', 'custom');
    emitidas.length = 0;
    clic(byId('cond-time-day-0-6')!.querySelector('input'));

    expect(emitidas).toEqual([]);
  });

  it('un límite de cuántas veces por día, con «si se pasa» pidiendo aprobación', () => {
    montar();
    clic(byId('cond-toggle-limits'));
    clic(interruptor('cond-limit-ACTIONS'));
    expect(ultima()?.limits).toEqual([
      { metric: 'ACTIONS', per: 'DAY', max: 20, onExceed: 'DENY' },
    ]);

    fixture.componentRef.setInput('condition', ultima());
    fixture.detectChanges();
    poner('cond-limit-exceed-ACTIONS', 'REQUIRE_APPROVAL');
    expect(ultima()?.limits?.[0]?.onExceed).toBe('REQUIRE_APPROVAL');
    const max = host().querySelector('[data-testid="cond-limit-max-ACTIONS"]') as HTMLInputElement;
    max.value = '5';
    max.dispatchEvent(new Event('input'));
    expect(ultima()?.limits?.[0]?.max).toBe(5);
  });

  it('a quién: pacientes con cita en una ventana, sin menores ni reservados', () => {
    montar();
    clic(byId('cond-toggle-patients'));
    poner('cond-patients-scope', 'WITH_APPOINTMENT_WINDOW');
    expect(ultima()?.patients).toEqual({
      scope: 'WITH_APPOINTMENT_WINDOW',
      appointmentWindow: { daysBefore: 1, daysAfter: 14 },
    });

    fixture.componentRef.setInput('condition', ultima());
    fixture.detectChanges();
    clic(byId('cond-exclude-minors')!.querySelector('input'));
    fixture.componentRef.setInput('condition', ultima());
    fixture.detectChanges();
    clic(byId('cond-exclude-flag-VIP')!.querySelector('input'));
    expect(ultima()?.patients?.exclude).toEqual({ minors: true, flags: ['VIP'] });
  });

  it('sobre qué citas: antelación mínima con aprobación del doctor y tope de días hacia adelante', () => {
    montar();
    clic(byId('cond-toggle-appointment'));
    clic(interruptor('cond-lead'));
    expect(ultima()?.appointment?.leadTime).toEqual({
      minHours: 24,
      onViolation: 'REQUIRE_APPROVAL',
    });
    fixture.componentRef.setInput('condition', ultima());
    fixture.detectChanges();
    clic(interruptor('cond-horizon'));
    expect(ultima()?.appointment?.horizon).toEqual({ maxDaysAhead: 90 });
  });

  it('canal: solo chat; sin ninguno marcado se quita la condición', () => {
    montar();
    clic(byId('cond-toggle-channel'));
    clic(byId('cond-channel-CHAT')!.querySelector('input'));
    expect(ultima()?.channels).toEqual({ allow: ['CHAT'] });
    fixture.componentRef.setInput('condition', ultima());
    fixture.detectChanges();
    clic(byId('cond-channel-CHAT')!.querySelector('input'));
    expect(ultima()).toBeUndefined();
  });

  it('«qué ve»: solo hay sección si el permiso trae datos por campo, y muestra un ejemplo de cada opción', () => {
    montar();
    expect(byId('cond-section-fields')).not.toBeNull();
    clic(byId('cond-toggle-fields'));
    expect(byId('cond-field-example-agenda.appointment.view.reason')!.textContent).toContain(
      'Dolor de cabeza desde hace tres días',
    );
    poner('cond-field-mask-agenda.appointment.view.reason', 'PARTIAL');
    expect(ultima()?.fields).toEqual({ 'agenda.appointment.view.reason': { mask: 'PARTIAL' } });

    const sinCampos = TestBed.createComponent(ConditionEditor);
    sinCampos.componentRef.setInput('atoms', atoms('agenda.appointment.cancel'));
    sinCampos.detectChanges();
    expect(
      (sinCampos.nativeElement as HTMLElement).querySelector('[data-testid="cond-section-fields"]'),
    ).toBeNull();
  });

  it('desde dónde: red de la organización, equipo de confianza y duración máxima de la sesión', () => {
    montar();
    clic(byId('cond-toggle-where'));
    clic(interruptor('cond-network'));
    expect(ultima()).toEqual({ schemaVersion: 1, network: { require: 'ORG_RULES' } });
    fixture.componentRef.setInput('condition', ultima());
    fixture.detectChanges();
    clic(interruptor('cond-device'));
    fixture.componentRef.setInput('condition', ultima());
    fixture.detectChanges();
    clic(interruptor('cond-session'));
    expect(ultima()).toMatchObject({
      device: { knownOnly: true },
      session: { maxSessionMinutes: 240 },
    });
    fixture.componentRef.setInput('condition', ultima());
    fixture.detectChanges();
    poner('cond-session-hours', '120');
    expect(ultima()?.session).toEqual({ maxSessionMinutes: 120 });
  });

  it('controles: motivo, verificación en dos pasos y aprobación', () => {
    montar();
    clic(byId('cond-toggle-controls'));
    clic(interruptor('cond-reason'));
    fixture.componentRef.setInput('condition', ultima());
    fixture.detectChanges();
    clic(interruptor('cond-approval'));
    fixture.componentRef.setInput('condition', ultima());
    fixture.detectChanges();
    poner('cond-approval-by', 'SECOND_APPROVER');
    expect(ultima()?.obligations).toEqual({
      requireReason: { minLength: 10 },
      approval: { by: 'SECOND_APPROVER', ttlMinutes: 60 },
    });
  });

  it('montos solo con permisos de facturación; techo de delegación solo con los permisos de dar permisos', () => {
    montar();
    expect(byId('cond-section-amount')).toBeNull();
    expect(byId('cond-section-ceiling')).toBeNull();

    const caja = TestBed.createComponent(ConditionEditor);
    caja.componentRef.setInput('atoms', atoms('billing.payment.collect', 'team.grants.assign'));
    caja.detectChanges();
    const el = caja.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="cond-section-amount"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="cond-section-ceiling"]')).not.toBeNull();
  });

  it('techo de delegación: qué áreas, a qué roles y por cuántos días', () => {
    montar({ atoms: atoms('team.grants.assign') });
    clic(byId('cond-toggle-ceiling'));
    clic(byId('cond-ceiling-allow-agenda.*')!.querySelector('input'));
    fixture.componentRef.setInput('condition', ultima());
    fixture.detectChanges();
    clic(byId('cond-ceiling-template-SECRETARY')!.querySelector('input'));
    fixture.componentRef.setInput('condition', ultima());
    fixture.detectChanges();
    const dias = host().querySelector('[data-testid="cond-ceiling-days"]') as HTMLInputElement;
    dias.value = '180';
    dias.dispatchEvent(new Event('input'));

    expect(ultima()?.delegationCeiling).toEqual({
      allowAtoms: ['agenda.*'],
      templates: ['SECRETARY'],
      maxValidDays: 180,
    });
  });

  it('una fila «Denegar» solo muestra lo que una prohibición admite, y el alcance de paciente en una frase', () => {
    montar({ deny: true });

    for (const quita of ['limits', 'patients', 'fields', 'amount', 'where', 'controls', 'ceiling'])
      expect(byId(`cond-section-${quita}`)).toBeNull();
    clic(byId('cond-toggle-deny'));
    poner('cond-deny-patient', 'minor');
    expect(ultima()?.patients).toEqual({ isMinor: true });
  });

  it('el error del servidor se marca en la sección, aunque esté plegada, y dice cómo arreglarlo', () => {
    const issue: PlacedIssue = {
      severity: 'error',
      code: 'CONDITION_TIME_EMPTY_WINDOW',
      message: 'Una franja empieza y termina a la misma hora: no cubre ningún momento.',
      writeIndex: 0,
      wholePermission: true,
      conditionKey: 'time',
      section: 'when',
      path: 'grants[0].condition.time.windows[0]',
    };
    montar({ issues: [issue] });

    expect(byId('cond-section-when')!.getAttribute('data-invalid')).toBe('true');
    expect(byId('cond-issues-when')!.textContent).toContain('empieza y termina a la misma hora');
    expect(byId('cond-toggle-when')!.getAttribute('aria-expanded')).toBe('true');
  });

  it('cada sección dice cuántas condiciones tiene', () => {
    montar({
      condition: {
        schemaVersion: 1,
        network: { require: 'ORG_RULES' },
        device: { knownOnly: true },
      },
    });

    expect(byId('cond-toggle-where')!.textContent).toContain('2 condiciones');
    expect(byId('cond-total')!.textContent).toContain('2 condiciones activas');
  });

  it('el JSON no se ve nunca', () => {
    montar({ condition: { schemaVersion: 1, network: { require: 'ORG_RULES' } } });
    expect(host().textContent).not.toContain('schemaVersion');
    expect(host().textContent).not.toContain('{');
  });
});
