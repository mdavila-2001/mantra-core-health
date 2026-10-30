import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { ServicesCatalogClient } from '../../../core/data-access/services-catalog/services-catalog.client';
import type { ServiceCatalogItem } from '../../../core/data-access/services-catalog/services-catalog.types';
import { ConsultationPriceBlock } from './consultation-price-block';

function item(defaultPrice: string): ServiceCatalogItem {
  return {
    id: 'svc-1',
    practiceId: 'pr-1',
    code: 'CITA_MEDICA',
    name: 'Cita médica',
    defaultPrice,
    isActive: true,
  } as ServiceCatalogItem;
}

describe('ConsultationPriceBlock', () => {
  let fixture: ComponentFixture<ConsultationPriceBlock>;
  let search: ReturnType<typeof vi.fn>;
  let update: ReturnType<typeof vi.fn>;

  function mount(items: readonly ServiceCatalogItem[]): HTMLElement {
    search.mockReturnValue(of({ items, count: items.length, limit: 20, nextCursor: null }));
    TestBed.configureTestingModule({
      imports: [ConsultationPriceBlock],
      providers: [provideRouter([]), { provide: ServicesCatalogClient, useValue: { search, update } }],
    });
    fixture = TestBed.createComponent(ConsultationPriceBlock);
    fixture.componentRef.setInput('practiceId', 'pr-1');
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const byTestId = (id: string): HTMLElement | null =>
    (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${id}"]`);

  function write(value: string): void {
    fixture.componentRef.setInput('priceDraft', value);
    fixture.detectChanges();
  }

  beforeEach(() => {
    search = vi.fn();
    update = vi.fn();
  });

  it('busca el ítem CITA_MEDICA de la práctica', () => {
    mount([item('150.00')]);
    expect(search).toHaveBeenCalledWith('pr-1', { query: 'CITA_MEDICA', limit: 20 });
  });

  it('en 0.00 dice «Defina el precio», nunca «0,00 Bs»', () => {
    const host = mount([item('0.00')]);
    expect(byTestId('consultation-price-undefined')!.textContent).toContain('Defina el precio');
    expect(host.textContent).not.toContain('0,00 Bs');
    expect(host.textContent).not.toContain('0.00 Bs');
  });

  it('con precio lo muestra como «150,00 Bs»', () => {
    mount([item('150.00')]);
    expect(byTestId('consultation-price-current')!.textContent!.trim()).toBe('150,00 Bs');
  });

  it('guarda con PATCH y la coma viaja como punto; el bloque muestra lo que devolvió la API', () => {
    mount([item('0.00')]);
    update.mockReturnValue(of(item('150.50')));
    write('150,50');
    byTestId('consultation-price-save')!.click();
    fixture.detectChanges();

    expect(update).toHaveBeenCalledWith('svc-1', { defaultPrice: '150.50' });
    expect(byTestId('consultation-price-current')!.textContent!.trim()).toBe('150,50 Bs');
    expect(byTestId('consultation-price-saved')).not.toBeNull();
  });

  it('un 422 deja el texto de la API junto al campo y no cambia el precio', () => {
    mount([item('80.00')]);
    update.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { code: 'PRECONDITION_FAILED', message: 'El precio tiene que ser mayor que 0', timestamp: '', path: '' },
          }),
      ),
    );
    write('0');
    byTestId('consultation-price-save')!.click();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.form-field-error')!.textContent).toContain(
      'El precio tiene que ser mayor que 0',
    );
    expect(byTestId('consultation-price-current')!.textContent!.trim()).toBe('80,00 Bs');
  });

  it('un importe con tres decimales no se manda', () => {
    mount([item('80.00')]);
    write('10.123');
    byTestId('consultation-price-save')!.click();
    expect(update).not.toHaveBeenCalled();
  });

  it('enlaza a «Mis servicios»', () => {
    mount([item('80.00')]);
    expect(byTestId('consultation-price-my-services')!.getAttribute('href')).toBe('/my-services');
  });

  it('sin CITA_MEDICA no inventa un precio: el vacío lleva a «Mis servicios»', () => {
    const host = mount([]);
    expect(byTestId('consultation-price')).toBeNull();
    expect(host.textContent).toContain('no tiene el servicio «Cita médica»');
  });
});
