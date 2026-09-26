import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError, type Observable } from 'rxjs';
import { vi } from 'vitest';

import { AuthService } from '../../../../core/auth/auth.service';
import { PharmacyClient } from '../../../../core/data-access/pharmacy/pharmacy.client';
import type {
  AvailabilityResult,
  PharmacyProduct,
  PharmacyProductSearchPage,
  PharmacySite,
  PharmacySitePage,
} from '../../../../core/data-access/pharmacy/pharmacy.types';
import { PharmacyOrdersClient } from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.client';
import type { BorradorDePedido } from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.types';
import { ProfilesClient } from '../../../../core/data-access/profiles/profiles.client';
import { borradorDelCarrito, PharmacyShop } from './pharmacy-shop';

/**
 * **Comprar** (pestaña de «Farmacia», 25/09/2026) — el carrito libre.
 *
 * Lo que se fija: se elige una farmacia antes de ver su catálogo, un
 * producto con receta obligatoria no suma al carrito, y «Continuar» arma el
 * mismo `BorradorDePedido` que ya arma «Dónde comprar mi receta» y navega a
 * la misma pantalla de revisión — nada de eso es una pantalla nueva.
 */
describe('PharmacyShop', () => {
  let fixture: ComponentFixture<PharmacyShop>;
  let nearbySites: ReturnType<typeof vi.fn<(query?: unknown) => Observable<PharmacySitePage>>>;
  let searchProducts: ReturnType<
    typeof vi.fn<(query?: unknown) => Observable<PharmacyProductSearchPage>>
  >;
  let availability: ReturnType<typeof vi.fn<(query: unknown) => Observable<AvailabilityResult>>>;
  let prepararBorrador: ReturnType<typeof vi.fn<(draft: BorradorDePedido) => void>>;
  let router: Router;

  const SITIO: PharmacySite = {
    siteId: 'site-1',
    siteName: 'Sucursal Centro',
    pharmacyId: 'ph-1',
    pharmacyName: 'Farmacia Andina',
    addressText: 'Calle Libertad 245',
    latitude: -17.7833,
    longitude: -63.1821,
    distanceKm: 1.2,
    homeDeliveryAvailable: false,
    pickupAvailable: true,
    productCount: 2,
  };

  const IBUPROFENO: PharmacyProduct = {
    id: 'prod-ibu',
    pharmacyId: 'ph-1',
    pharmacyName: 'Farmacia Andina',
    productCode: 'IBU-400',
    brandName: null,
    genericName: 'Ibuprofeno',
    strengthText: '400 mg',
    packageSizeText: 'Blíster x 10',
    dosageForm: { code: 'TABLET', display: 'Comprimido' },
    medication: { code: 'MESH-IBU', display: 'Ibuprofeno' },
    requiresPrescription: false,
  };

  const AMOXICILINA: PharmacyProduct = {
    id: 'prod-amx',
    pharmacyId: 'ph-1',
    pharmacyName: 'Farmacia Andina',
    productCode: 'AMX-500',
    brandName: 'Amoxil',
    genericName: 'Amoxicilina',
    strengthText: '500 mg',
    packageSizeText: 'Caja x 21',
    dosageForm: { code: 'CAPSULE', display: 'Cápsula' },
    medication: { code: 'MESH-AMOX', display: 'Amoxicilina' },
    requiresPrescription: true,
  };

  async function montar(): Promise<void> {
    TestBed.resetTestingModule();
    nearbySites = vi.fn(() => of({ items: [SITIO], count: 1 }));
    searchProducts = vi.fn(() => of({ items: [IBUPROFENO, AMOXICILINA], limit: 50, truncated: false }));
    availability = vi.fn(() =>
      of<AvailabilityResult>({
        requestedProductIds: [IBUPROFENO.id],
        items: [
          {
            siteId: SITIO.siteId,
            siteName: SITIO.siteName,
            pharmacyId: SITIO.pharmacyId,
            pharmacyName: SITIO.pharmacyName,
            addressText: SITIO.addressText,
            latitude: SITIO.latitude,
            longitude: SITIO.longitude,
            distanceKm: SITIO.distanceKm,
            homeDeliveryAvailable: false,
            pickupAvailable: true,
            complete: true,
            availableCount: 1,
            missingProductIds: [],
            totalAmount: '15.00',
            currency: { code: 'BOB', display: 'Boliviano' },
            products: [
              {
                productId: IBUPROFENO.id,
                productCode: IBUPROFENO.productCode,
                brandName: IBUPROFENO.brandName,
                genericName: IBUPROFENO.genericName,
                strengthText: IBUPROFENO.strengthText,
                packageSizeText: IBUPROFENO.packageSizeText,
                medication: IBUPROFENO.medication,
                availableQuantity: 20,
                price: { unitAmount: '15.00', patientAmount: '15.00', currency: { code: 'BOB', display: 'Boliviano' }, priceListCode: 'PUBLICO' },
              },
            ],
          },
        ],
        count: 1,
      }),
    );
    prepararBorrador = vi.fn();

    TestBed.configureTestingModule({
      imports: [PharmacyShop],
      providers: [
        provideRouter([]),
        {
          provide: PharmacyClient,
          useValue: { nearbySites, searchProducts, availability },
        },
        { provide: PharmacyOrdersClient, useValue: { prepararBorrador } },
        { provide: AuthService, useValue: { patientProfileId: signal<string | null>('pp-1') } },
        { provide: ProfilesClient, useValue: { getOwnPatientProfile: () => of(null) } },
      ],
    });
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture = TestBed.createComponent(PharmacyShop);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function raiz(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function texto(): string {
    return raiz().textContent ?? '';
  }

  async function asentar(): Promise<void> {
    for (let vuelta = 0; vuelta < 3; vuelta++) {
      await fixture.whenStable();
      fixture.detectChanges();
    }
  }

  function elegirLaFarmacia(): void {
    raiz().querySelector<HTMLButtonElement>('[data-testid="tienda-elegir-farmacia"]')?.click();
    fixture.detectChanges();
  }

  it('sin perfil de paciente no busca farmacias', async () => {
    TestBed.resetTestingModule();
    nearbySites = vi.fn(() => of({ items: [], count: 0 }));
    TestBed.configureTestingModule({
      imports: [PharmacyShop],
      providers: [
        provideRouter([]),
        { provide: PharmacyClient, useValue: { nearbySites, searchProducts: vi.fn(), availability: vi.fn() } },
        { provide: PharmacyOrdersClient, useValue: { prepararBorrador: vi.fn() } },
        { provide: AuthService, useValue: { patientProfileId: signal<string | null>(null) } },
        { provide: ProfilesClient, useValue: {} },
      ],
    });
    fixture = TestBed.createComponent(PharmacyShop);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(texto()).toContain('Esta sección es para pacientes');
    expect(nearbySites).not.toHaveBeenCalled();
  });

  it('lista farmacias y al elegir una muestra su catálogo', async () => {
    await montar();
    await asentar();

    expect(raiz().querySelector('[data-testid="tienda-farmacias"]')).not.toBeNull();
    expect(texto()).toContain('Farmacia Andina');

    elegirLaFarmacia();
    await asentar();

    expect(searchProducts).toHaveBeenCalledWith(
      expect.objectContaining({ pharmacyId: SITIO.pharmacyId }),
    );
    expect(texto()).toContain('Ibuprofeno');
  });

  it('un producto con receta obligatoria no suma al carrito y ofrece la historia clínica', async () => {
    await montar();
    await asentar();
    elegirLaFarmacia();
    await asentar();

    const filas = [...raiz().querySelectorAll('[data-testid="tienda-productos"] li')];
    const filaAmoxicilina = filas.find((fila) => fila.textContent?.includes('Amoxil'));
    expect(filaAmoxicilina?.textContent).toContain('Requiere receta');
    expect(filaAmoxicilina?.querySelector('[data-testid="tienda-cantidad-mas"]')).toBeNull();
    expect(filaAmoxicilina?.querySelector('a')?.getAttribute('href')).toBe('/my-account/medical-record');
  });

  it('agregar unidades habilita «Continuar», que arma el borrador y navega a la revisión', async () => {
    await montar();
    await asentar();
    elegirLaFarmacia();
    await asentar();

    const filas = [...raiz().querySelectorAll('[data-testid="tienda-productos"] li')];
    const filaIbuprofeno = filas.find((fila) => fila.textContent?.includes('Ibuprofeno'));
    filaIbuprofeno?.querySelector<HTMLButtonElement>('[data-testid="tienda-cantidad-mas"]')?.click();
    fixture.detectChanges();

    expect(raiz().querySelector('[data-testid="tienda-carrito"]')?.textContent).toContain('1 unidad');

    raiz().querySelector<HTMLButtonElement>('[data-testid="tienda-continuar"]')?.click();
    await asentar();

    expect(availability).toHaveBeenCalledWith(
      expect.objectContaining({ productIds: [IBUPROFENO.id] }),
    );
    expect(prepararBorrador).toHaveBeenCalledTimes(1);
    const borrador = prepararBorrador.mock.calls[0]?.[0] as BorradorDePedido;
    expect(borrador.requestId).toBe('');
    expect(borrador.siteId).toBe(SITIO.siteId);
    expect(borrador.lineas).toEqual([
      expect.objectContaining({ productId: IBUPROFENO.id, cantidad: 1, disponible: true, precio: '15.00' }),
    ]);
    expect(router.navigate).toHaveBeenCalledWith(['/my-account/pharmacy-orders/new']);
  });

  it('si la sede ya no aparece en la disponibilidad, lo dice y no navega', async () => {
    await montar();
    availability.mockReturnValueOnce(
      of<AvailabilityResult>({ requestedProductIds: [IBUPROFENO.id], items: [], count: 0 }),
    );
    await asentar();
    elegirLaFarmacia();
    await asentar();
    const filas = [...raiz().querySelectorAll('[data-testid="tienda-productos"] li')];
    filas
      .find((fila) => fila.textContent?.includes('Ibuprofeno'))
      ?.querySelector<HTMLButtonElement>('[data-testid="tienda-cantidad-mas"]')
      ?.click();
    fixture.detectChanges();

    raiz().querySelector<HTMLButtonElement>('[data-testid="tienda-continuar"]')?.click();
    await asentar();

    expect(texto()).toContain('Elegí otra farmacia');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('si la disponibilidad falla, lo dice y no navega', async () => {
    await montar();
    availability.mockReturnValueOnce(throwError(() => new Error('caída')));
    await asentar();
    elegirLaFarmacia();
    await asentar();
    const filas = [...raiz().querySelectorAll('[data-testid="tienda-productos"] li')];
    filas
      .find((fila) => fila.textContent?.includes('Ibuprofeno'))
      ?.querySelector<HTMLButtonElement>('[data-testid="tienda-cantidad-mas"]')
      ?.click();
    fixture.detectChanges();

    raiz().querySelector<HTMLButtonElement>('[data-testid="tienda-continuar"]')?.click();
    await asentar();

    expect(texto()).toContain('No pudimos confirmar la disponibilidad');
    expect(router.navigate).not.toHaveBeenCalled();
  });
});

describe('borradorDelCarrito', () => {
  it('marca sin precio y sin disponible lo que la sede ya no publica', () => {
    const borrador = borradorDelCarrito(
      [
        {
          producto: {
            id: 'x',
            pharmacyId: 'ph-1',
            pharmacyName: 'Farmacia Andina',
            productCode: 'X',
            brandName: 'X',
            genericName: null,
            strengthText: null,
            packageSizeText: null,
            dosageForm: null,
            medication: null,
            requiresPrescription: false,
          },
          cantidad: 2,
        },
      ],
      {
        siteId: 'site-1',
        siteName: 'Sucursal Centro',
        pharmacyId: 'ph-1',
        pharmacyName: 'Farmacia Andina',
        addressText: null,
        latitude: null,
        longitude: null,
        distanceKm: null,
        homeDeliveryAvailable: null,
        pickupAvailable: null,
        complete: false,
        availableCount: 0,
        missingProductIds: ['x'],
        totalAmount: null,
        currency: null,
        products: [],
      },
    );

    expect(borrador.lineas).toEqual([
      expect.objectContaining({ productId: 'x', disponible: false, precio: null, moneda: null }),
    ]);
  });
});
