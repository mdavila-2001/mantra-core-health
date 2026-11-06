import { HttpErrorResponse } from '@angular/common/http';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { ServicesCatalogClient } from '../../../core/data-access/services-catalog/services-catalog.client';
import type { ServiceCatalogItem } from '../../../core/data-access/services-catalog/services-catalog.types';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { ServiceTerms } from './service-terms';

/**
 * Los términos y condiciones de un servicio. Cambiar los términos por defecto
 * pide confirmación; guardar exige texto y lo manda recortado; volver a los de
 * por defecto (destructivo) confirma y manda `null`. Un rechazo deja la
 * edición abierta con el mensaje de la API.
 */

function servicio(termsText: string | null): ServiceCatalogItem {
  return { id: 'sv-1', code: 'CONS-01', name: 'Consulta general', termsText } as unknown as ServiceCatalogItem;
}

describe('ServiceTerms', () => {
  let fixture: ComponentFixture<ServiceTerms>;
  let update: ReturnType<typeof vi.fn>;
  let confirm: ReturnType<typeof vi.fn>;
  let actualizados: ServiceCatalogItem[];
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const q = (id: string): HTMLElement | null => root().querySelector(`[data-testid="service-terms-${id}"]`);

  async function pintar(termsText: string | null): Promise<void> {
    fixture = TestBed.createComponent(ServiceTerms);
    fixture.componentRef.setInput('service', servicio(termsText));
    fixture.componentRef.setInput('priceLabel', '150,00 Bs');
    actualizados = [];
    fixture.componentInstance.updated.subscribe((s) => actualizados.push(s));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function tocar(id: string): Promise<void> {
    q(id)!.click();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function escribir(texto: string): Promise<void> {
    const area = q('input')!.querySelector('textarea')!;
    area.value = texto;
    area.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    update = vi.fn((_: string, cambios: { termsText: string | null }) => of(servicio(cambios.termsText)));
    confirm = vi.fn(async () => true);
    TestBed.configureTestingModule({
      providers: [
        { provide: ServicesCatalogClient, useValue: { update } },
        { provide: DialogService, useValue: { confirm } },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });
  });

  it('arriba el servicio con su precio; sin términos propios dice que usa los por defecto', async () => {
    await pintar(null);
    expect(q('card')?.textContent).toContain('Consulta general');
    expect(q('card')?.textContent).toContain('150,00 Bs');
    expect(q('default')).not.toBeNull();
    expect(q('restore')).toBeNull();
  });

  it('editar los por defecto pide confirmación; si se cancela, no edita', async () => {
    confirm.mockResolvedValue(false);
    await pintar(null);
    await tocar('edit');
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: '¿Cambiar los términos por defecto?' }));
    expect(q('input')).toBeNull();
  });

  it('guarda los términos recortados y emite el servicio actualizado', async () => {
    await pintar(null);
    await tocar('edit');
    await escribir('  Se cobra la consulta al reservar.  ');
    await tocar('save');
    expect(update).toHaveBeenCalledWith('sv-1', { termsText: 'Se cobra la consulta al reservar.' });
    expect(actualizados).toHaveLength(1);
    expect(q('input')).toBeNull();
  });

  it('en blanco no guarda y lo explica', async () => {
    await pintar('Términos propios');
    await tocar('edit');
    expect(confirm).not.toHaveBeenCalled();
    await escribir('   ');
    await tocar('save');
    expect(update).not.toHaveBeenCalled();
    expect(root().textContent).toContain('Escriba los términos, o vuelva a los de por defecto.');
  });

  it('volver a los de por defecto confirma como destructivo y manda null', async () => {
    await pintar('Términos propios');
    expect(q('text')?.textContent).toBe('Términos propios');
    await tocar('restore');
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ destructive: true }));
    expect(update).toHaveBeenCalledWith('sv-1', { termsText: null });
  });

  it('un rechazo deja la edición abierta con el mensaje de la API', async () => {
    update.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 422, error: { code: 'VALIDATION_FAILED', message: 'Demasiado largo.' } })));
    await pintar('Términos propios');
    await tocar('edit');
    await escribir('Nuevo texto');
    await tocar('save');
    expect(q('input')).not.toBeNull();
    expect(root().textContent).toContain('Demasiado largo.');
    expect(actualizados).toEqual([]);
  });
});
