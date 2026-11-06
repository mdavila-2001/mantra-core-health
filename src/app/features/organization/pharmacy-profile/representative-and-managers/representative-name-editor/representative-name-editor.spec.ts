import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { LegalRepresentativeClient } from '../../../../../core/data-access/directory/legal-representative.client';
import { RepresentativeNameEditor } from './representative-name-editor';

describe('RepresentativeNameEditor', () => {
  let fixture: ComponentFixture<RepresentativeNameEditor>;
  const client = { rename: vi.fn() };
  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byId = <T extends HTMLElement>(id: string): T | null => el().querySelector<T>(`[data-testid="${id}"]`);

  function mount(): void {
    TestBed.configureTestingModule({ providers: [{ provide: LegalRepresentativeClient, useValue: client }] });
    fixture = TestBed.createComponent(RepresentativeNameEditor);
    fixture.componentRef.setInput('tenantId', 't-1');
    fixture.componentRef.setInput('parts', { name: 'Wendy', middleName: 'Jennyfer', lastName: 'Dávila', motherLastName: 'Tamal' });
    fixture.detectChanges();
  }

  function submit(): void {
    el().querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
    fixture.detectChanges();
  }

  beforeEach(() => client.rename.mockReset());

  it('offers the change and opens the form with the current parts', () => {
    mount();
    expect(byId('representante-editor')).toBeNull();

    byId<HTMLButtonElement>('representante-cambiar-nombre')?.click();
    fixture.detectChanges();

    const inputs = Array.from(el().querySelectorAll('input')).map((i) => i.value);
    expect(inputs).toEqual(['Wendy', 'Jennyfer', 'Dávila', 'Tamal']);
  });

  it('saves the typed parts, closes, and tells the owner of the data to reload', () => {
    mount();
    client.rename.mockReturnValue(of({ fullName: 'Wendy Dávila' }));
    const saved = vi.fn();
    fixture.componentInstance.saved.subscribe(saved);
    byId<HTMLButtonElement>('representante-cambiar-nombre')?.click();
    fixture.detectChanges();

    submit();

    expect(client.rename).toHaveBeenCalledWith('t-1', {
      name: 'Wendy',
      middleName: 'Jennyfer',
      lastName: 'Dávila',
      motherLastName: 'Tamal',
    });
    expect(saved).toHaveBeenCalledTimes(1);
    expect(byId('representante-editor')).toBeNull();
  });

  it('does not send a name without given name or last name', () => {
    mount();
    fixture.componentRef.setInput('parts', {});
    byId<HTMLButtonElement>('representante-cambiar-nombre')?.click();
    fixture.detectChanges();

    submit();

    expect(client.rename).not.toHaveBeenCalled();
    expect(el().textContent).toContain('Este dato es obligatorio.');
  });

  it('keeps the form open and says why when the API refuses', () => {
    mount();
    client.rename.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 403, error: { message: 'Se requiere ser OWNER o ADMIN' } })),
    );
    byId<HTMLButtonElement>('representante-cambiar-nombre')?.click();
    fixture.detectChanges();

    submit();

    expect(byId('representante-editor')).not.toBeNull();
    expect(byId('representante-error')?.textContent ?? '').not.toBe('');
  });
});
