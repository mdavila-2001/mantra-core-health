import { HttpErrorResponse } from '@angular/common/http';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { SimpleAccountingClient } from '../../../core/data-access/simple-accounting/simple-accounting.client';
import type { AccountClass, SimpleAccount } from '../../../core/data-access/simple-accounting/simple-accounting.types';
import { chooseSelectOption, selectShownLabel } from '../../../../testing/select';
import { AccountDialog } from './account-dialog';

/**
 * Alta y edición de una cuenta de la contabilidad simple del consultorio.
 * Crea con la práctica, edita por id; el nombre es obligatorio y se recorta;
 * la clase queda fija si viene impuesta por la pestaña o si la cuenta es una
 * de las generales sembradas (se renombra, no se reclasifica).
 */

const SEMBRADA: SimpleAccount = { id: 'ac-1', code: '5.1', name: 'Insumos', accountClass: 'EXPENSE', seeded: true } as SimpleAccount;

describe('AccountDialog', () => {
  let fixture: ComponentFixture<AccountDialog>;
  let createAccount: ReturnType<typeof vi.fn>;
  let updateAccount: ReturnType<typeof vi.fn>;
  let guardadas: SimpleAccount[];
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const nombre = (): HTMLInputElement => root().querySelector<HTMLInputElement>('[data-testid="cuenta-nombre"]')!;
  const clase = (): Element => root().querySelector('[data-testid="cuenta-clase"]')!;

  async function pintar(inputs: { cuenta?: SimpleAccount | null; claseFija?: AccountClass | null } = {}): Promise<void> {
    fixture = TestBed.createComponent(AccountDialog);
    fixture.componentRef.setInput('practiceId', 'pr-1');
    if (inputs.cuenta !== undefined) fixture.componentRef.setInput('cuenta', inputs.cuenta);
    if (inputs.claseFija !== undefined) fixture.componentRef.setInput('claseFija', inputs.claseFija);
    guardadas = [];
    fixture.componentInstance.saved.subscribe((c) => guardadas.push(c));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function escribirNombre(texto: string): Promise<void> {
    nombre().value = texto;
    nombre().dispatchEvent(new Event('input'));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function guardar(): Promise<void> {
    root().querySelector<HTMLElement>('[data-testid="cuenta-guardar"]')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    createAccount = vi.fn((_: string, datos: object) => of({ id: 'nueva', code: '5.9', seeded: false, ...datos }));
    updateAccount = vi.fn((id: string, datos: object) => of({ ...SEMBRADA, id, ...datos }));
    TestBed.configureTestingModule({ providers: [{ provide: SimpleAccountingClient, useValue: { createAccount, updateAccount } }] });
  });

  it('nueva: título genérico, gasto por omisión; crea en la práctica con el nombre recortado', async () => {
    await pintar();
    expect(root().querySelector('[data-testid="content-dialog-title"]')?.textContent?.trim()).toBe('Nueva cuenta');
    expect(selectShownLabel(clase())).toBe('Gasto');
    await escribirNombre('  Laboratorio de referencia  ');
    await chooseSelectOption(fixture, clase(), 'Activo');
    await guardar();

    expect(createAccount).toHaveBeenCalledWith('pr-1', { name: 'Laboratorio de referencia', accountClass: 'ASSET' });
    expect(guardadas).toHaveLength(1);
  });

  it('sin nombre no guarda y lo explica', async () => {
    await pintar();
    await guardar();
    expect(createAccount).not.toHaveBeenCalled();
    expect(root().textContent).toContain('Escriba un nombre de hasta 80 caracteres.');
  });

  it('un nombre de sólo espacios tampoco se guarda', async () => {
    // Observación: hoy no muestra el mensaje (el control es «válido» para
    // `Validators.required`); el guardado sí se frena por el `trim()`.
    await pintar();
    await escribirNombre('   ');
    await guardar();
    expect(createAccount).not.toHaveBeenCalled();
  });

  it('con clase fija: título con la clase y la clase no se puede cambiar', async () => {
    await pintar({ claseFija: 'LIABILITY' });
    expect(root().querySelector('[data-testid="content-dialog-title"]')?.textContent?.trim()).toBe('Nueva cuenta de deuda');
    await escribirNombre('Préstamo');
    await guardar();
    expect(createAccount).toHaveBeenCalledWith('pr-1', { name: 'Préstamo', accountClass: 'LIABILITY' });
  });

  it('una cuenta sembrada se renombra por id sin cambiar de clase, y lo explica', async () => {
    await pintar({ cuenta: SEMBRADA });
    expect(root().querySelector('[data-testid="content-dialog-title"]')?.textContent?.trim()).toBe('Editar la cuenta');
    expect(nombre().value).toBe('Insumos');
    expect(root().textContent).toContain('se puede renombrar, no cambiar de clase');
    await escribirNombre('Insumos médicos');
    await guardar();
    expect(updateAccount).toHaveBeenCalledWith('ac-1', { name: 'Insumos médicos', accountClass: 'EXPENSE' });
    expect(createAccount).not.toHaveBeenCalled();
  });

  it('un rechazo de la API muestra su mensaje y no emite', async () => {
    createAccount.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 409, error: { code: 'CONFLICT', message: 'Ya existe una cuenta con ese nombre.' } })),
    );
    await pintar();
    await escribirNombre('Insumos');
    await guardar();
    expect(guardadas).toEqual([]);
    expect(root().textContent).toContain('Ya existe una cuenta con ese nombre.');
  });
});
