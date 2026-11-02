import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { afterEach, describe, expect, it } from 'vitest';
import { Input } from '../../../shared/components/atoms/input/input';
import { Select } from '../../../shared/components/atoms/select/select';
import { GroupForm, type GroupFormData } from './group-form';

describe('GroupForm · contratos de selección estrictos', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('ignora null conservando tipo/visibilidad explícitos y la validación', () => {
    const fixture = TestBed.createComponent(GroupForm);
    fixture.componentRef.setInput('perfilListo', true);
    fixture.detectChanges();
    fixture.debugElement.query(By.directive(Input)).injector.get(Input).value.set('Grupo sintético');
    const selects = fixture.debugElement.queryAll(By.directive(Select));
    selects[1].injector.get(Select).value.set('SUPPORT');
    selects[2].injector.get(Select).value.set('PUBLIC');
    selects[1].injector.get(Select).value.set(null);
    selects[2].injector.get(Select).value.set(null);
    fixture.detectChanges();
    let sent: GroupFormData | undefined;
    fixture.componentInstance.submitForm.subscribe((value) => { sent = value; });
    const root: HTMLElement = fixture.nativeElement;
    const buttons = root.querySelectorAll<HTMLButtonElement>('button');
    const create = Array.from(buttons).find((button) => button.textContent?.includes('Crear grupo'));
    create?.click();
    expect(sent?.groupType).toBe('SUPPORT');
    expect(sent?.visibility).toBe('PUBLIC');
    expect(root.textContent).toContain('Tema o especialidad');
  });

  it('cancelar conserva un evento explícito sin enviar el formulario', () => {
    const fixture = TestBed.createComponent(GroupForm);
    fixture.componentRef.setInput('perfilListo', true);
    fixture.detectChanges();
    let cancelled = 0;
    let submitted = 0;
    fixture.componentInstance.cancelled.subscribe(() => { ++cancelled; });
    fixture.componentInstance.submitForm.subscribe(() => { ++submitted; });
    const root: HTMLElement = fixture.nativeElement;
    Array.from(root.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.trim() === 'Cancelar')?.click();
    expect(cancelled).toBe(1);
    expect(submitted).toBe(0);
  });
});
