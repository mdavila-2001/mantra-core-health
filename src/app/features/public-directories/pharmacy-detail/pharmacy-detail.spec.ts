import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { PharmacyDetail } from './pharmacy-detail';

const SLUG = 'farmacia-vida';

const PERFIL = {
  kind: 'PHARMACY',
  slug: SLUG,
  displayName: 'Farmacia Vida',
  headline: 'Farmacia · entrega a domicilio',
  biography: 'Genéricos y de marca, entrega en menos de una hora.',
  avatarUrl: null,
  coverUrl: null,
  verified: false,
  city: 'Santa Cruz de la Sierra',
  address: 'Av. Alemana N.º 2100',
  location: { lat: -17.76, lng: -63.16 },
  specialties: [],
  trajectory: [],
  practiceSites: [],
  ratingAverage: null,
  ratingCount: 0,
  acceptsReviews: true,
  posts: [],
  updatedAt: '2026-09-10T12:00:00.000Z',
};

const CATALOGO = {
  items: [
    {
      id: 'prod-1',
      genericName: 'Losartán',
      brandName: 'Losartán Bagó',
      presentation: '50 mg comprimidos',
      therapeuticGroup: 'Cardiovascular',
      price: '18.50',
      currency: 'BOB',
      inStock: true,
      requiresPrescription: true,
    },
    {
      id: 'prod-2',
      genericName: 'Amoxicilina',
      brandName: null,
      presentation: '500 mg cápsulas',
      therapeuticGroup: 'Antibióticos',
      price: '32.00',
      currency: 'BOB',
      inStock: false,
      requiresPrescription: true,
    },
    {
      id: 'prod-3',
      genericName: 'Paracetamol',
      brandName: 'Paracetamol Inti',
      presentation: '500 mg comprimidos',
      therapeuticGroup: null,
      price: '8.00',
      currency: 'BOB',
      inStock: true,
      requiresPrescription: false,
    },
  ],
  nextCursor: null,
  totalHint: 3,
  generatedAt: '2026-09-11T12:00:00.000Z',
};

describe('PharmacyDetail', () => {
  let fixture: ComponentFixture<PharmacyDetail>;
  let http: HttpTestingController;

  function montar(slug: string | null = SLUG): void {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ slug: slug ?? '' })) },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PharmacyDetail);
    fixture.detectChanges();
  }

  function responder(): void {
    http.expectOne(`/public/profiles/f/${SLUG}`).flush(PERFIL);
    http.expectOne((pedido) => pedido.url === `/public/profiles/f/${SLUG}/products`).flush(
      CATALOGO,
    );
    fixture.detectChanges();
  }

  afterEach(() => http?.verify());

  it('muestra la farmacia y sus medicamentos con precio', () => {
    montar();
    responder();

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Farmacia Vida');
    expect(texto).toContain('Losartán');
    expect(texto).toContain('Losartán Bagó · 50 mg comprimidos');
    expect(texto).toContain('18,50 BOB');
  });

  it('agrupa por grupo terapéutico y deja el resto al final, sin esconderlo', () => {
    montar();
    responder();

    const grupos = [
      ...(fixture.nativeElement.querySelectorAll('.ficha-publica__grupo') as NodeListOf<
        HTMLElement
      >),
    ].map((titulo) => (titulo.textContent ?? '').trim());
    expect(grupos).toEqual(['Antibióticos', 'Cardiovascular', 'Sin grupo declarado']);
  });

  it('rotula lo agotado y lo que exige receta, y sólo eso', () => {
    montar();
    responder();

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Sin stock');
    expect(texto).toContain('Con receta');
    // Lo normal no se rotula: si todo lleva distintivo, ninguno distingue.
    expect(texto).not.toContain('En stock');
    expect(texto).not.toContain('Venta libre');
  });

  it('no ofrece editar el precio: el catálogo es de la farmacia', () => {
    montar();
    responder();

    expect(fixture.nativeElement.querySelectorAll('button, input').length).toBe(0);
  });

  it('conserva la ficha cuando el catálogo falla', () => {
    montar();
    http.expectOne(`/public/profiles/f/${SLUG}`).flush(PERFIL);
    http
      .expectOne((pedido) => pedido.url === `/public/profiles/f/${SLUG}/products`)
      .flush({ code: 'NOT_FOUND' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent as string).toContain('Farmacia Vida');
  });

  it('no llama a la API cuando la ruta no trae slug', () => {
    montar(null);
    http.verify();
  });
});
