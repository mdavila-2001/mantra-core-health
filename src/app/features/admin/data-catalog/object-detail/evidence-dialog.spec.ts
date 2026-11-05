import { HttpErrorResponse } from '@angular/common/http';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { DataCatalogClient } from '../../../../core/data-access/admin-portal/data-catalog.client';
import type { Evidence } from '../../../../core/data-access/admin-portal/data-catalog.types';
import { chooseSelectOption } from '../../../../../testing/select';
import { EvidenceDialog } from './evidence-dialog';

/**
 * Añadir evidencia verificable a un objeto del catálogo de datos. La
 * referencia es obligatoria (≥ 3 caracteres) y se recorta; versión y extracto
 * viajan sólo si se escribieron. Un fallo se dice con el texto genérico, sin
 * filtrar detalles internos.
 */
describe('EvidenceDialog', () => {
  let fixture: ComponentFixture<EvidenceDialog>;
  let addEvidence: ReturnType<typeof vi.fn>;
  let guardadas: Evidence[];
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const campos = (): HTMLInputElement[] => Array.from(root().querySelectorAll<HTMLInputElement>('form input'));

  async function pintar(): Promise<void> {
    fixture = TestBed.createComponent(EvidenceDialog);
    fixture.componentRef.setInput('objectId', 'obj-1');
    guardadas = [];
    fixture.componentInstance.saved.subscribe((e) => guardadas.push(e));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function escribir(campo: HTMLInputElement | HTMLTextAreaElement, texto: string): Promise<void> {
    campo.value = texto;
    campo.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function guardar(): Promise<void> {
    root().querySelector<HTMLElement>('[data-testid="evidence-save"]')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    addEvidence = vi.fn(() => of({ id: 'ev-1' }));
    TestBed.configureTestingModule({ providers: [{ provide: DataCatalogClient, useValue: { addEvidence } }] });
  });

  it('avisa que nunca van secretos ni datos de pacientes', async () => {
    await pintar();
    expect(root().textContent).toContain('Nunca un secreto ni datos de pacientes.');
  });

  it('sin referencia (o muy corta) no guarda y lo explica', async () => {
    await pintar();
    await escribir(campos()[0]!, 'ab');
    await guardar();
    expect(addEvidence).not.toHaveBeenCalled();
    expect(root().textContent).toContain('Escriba una referencia verificable.');
  });

  it('guarda tipo y referencia recortada; lo opcional vacío no viaja', async () => {
    await pintar();
    await escribir(campos()[0]!, '  SQL/17_billing/90_fk_deferred.sql  ');
    await guardar();
    expect(addEvidence).toHaveBeenCalledWith('obj-1', { kind: 'MIGRATION', reference: 'SQL/17_billing/90_fk_deferred.sql' });
    expect(guardadas).toEqual([{ id: 'ev-1' }]);
  });

  it('con otro tipo, versión y extracto, los manda recortados', async () => {
    await pintar();
    await chooseSelectOption(fixture, root().querySelector('app-select')!, 'Referencia a código');
    await escribir(campos()[0]!, 'src/app/x.ts:12');
    await escribir(campos()[1]!, '  8791ecc1 ');
    await escribir(root().querySelector('textarea')!, '  const x = 1;  ');
    await guardar();
    expect(addEvidence).toHaveBeenCalledWith('obj-1', {
      kind: 'CODE_REFERENCE',
      reference: 'src/app/x.ts:12',
      sourceRevision: '8791ecc1',
      excerpt: 'const x = 1;',
    });
  });

  it('un fallo de la API se muestra y no emite', async () => {
    addEvidence.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    await pintar();
    await escribir(campos()[0]!, 'docs/x.md');
    await guardar();
    expect(guardadas).toEqual([]);
    expect(root().textContent).toContain('No se pudo añadir la evidencia.');
  });
});
