import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { ClinicDetail } from './clinic-detail';

const SLUG = 'clinica-los-olivos';

const PERFIL = {
  kind: 'ORGANIZATION',
  slug: SLUG,
  displayName: 'Clínica Los Olivos',
  headline: 'Clínica privada · 24 horas',
  biography: 'Clínica de segundo nivel con urgencias 24 horas.',
  avatarUrl: null,
  coverUrl: null,
  verified: true,
  city: 'Santa Cruz de la Sierra',
  address: 'Av. Banzer, 3.º anillo',
  location: { lat: -17.77, lng: -63.19 },
  specialties: [],
  trajectory: [],
  practiceSites: [],
  ratingAverage: 4.6,
  ratingCount: 18,
  acceptsReviews: true,
  posts: [],
  updatedAt: '2026-09-10T12:00:00.000Z',
};

const CATALOGO = {
  items: [
    {
      id: 'srv-1',
      code: 'CONS-CARDIO',
      name: 'Consulta cardiológica',
      description: 'Incluye electrocardiograma de reposo.',
      price: '250.00',
      currency: 'BOB',
      isActive: true,
    },
    {
      id: 'srv-2',
      code: 'CERT-APTITUD',
      name: 'Certificado de aptitud',
      description: null,
      price: null,
      currency: null,
      isActive: false,
    },
  ],
  nextCursor: null,
  totalHint: 2,
  generatedAt: '2026-09-11T12:00:00.000Z',
};

describe('ClinicDetail', () => {
  let fixture: ComponentFixture<ClinicDetail>;
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
    fixture = TestBed.createComponent(ClinicDetail);
    fixture.detectChanges();
  }

  /** Las dos lecturas de la pantalla, resueltas. */
  function responder(): void {
    http.expectOne(`/public/profiles/o/${SLUG}`).flush(PERFIL);
    http.expectOne((pedido) => pedido.url === `/public/profiles/o/${SLUG}/services`).flush(
      CATALOGO,
    );
    fixture.detectChanges();
  }

  afterEach(() => http?.verify());

  it('muestra el establecimiento y su catálogo de servicios con el precio', () => {
    montar();
    responder();

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Clínica Los Olivos');
    expect(texto).toContain('Santa Cruz de la Sierra');
    expect(texto).toContain('Consulta cardiológica');
    // El código del nomenclador no se pinta (19/09/2026): no le dice nada a
    // quien busca dónde atenderse, y sigue viajando en el dato.
    expect(texto).not.toContain('CONS-CARDIO');
    // Con coma decimal y en «Bs», la moneda visible de todo el producto.
    expect(texto).toContain('250,00 Bs');
  });

  it('no ofrece editar el precio: el catálogo es de la clínica', () => {
    montar();
    responder();

    const botones = fixture.nativeElement.querySelectorAll('button, input');
    expect(botones.length).toBe(0);
    expect(fixture.nativeElement.textContent as string).not.toContain('Editar precio');
  });

  it('dice que falta el arancel en vez de pintar un cero', () => {
    montar();
    responder();

    // Sobre la celda y no sobre el texto de la pantalla: «250,00» del otro
    // servicio contiene «0,00», así que buscarlo en todo el texto no prueba
    // nada.
    const precios = [
      ...(fixture.nativeElement.querySelectorAll(
        '[data-testid="clinic-service-price"]',
      ) as NodeListOf<HTMLElement>),
    ].map((celda) => (celda.textContent ?? '').trim());
    expect(precios).toEqual(['250,00 Bs', 'Sin precio publicado']);
  });

  it('rotula el servicio dado de baja y no lo esconde', () => {
    montar();
    responder();

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Certificado de aptitud');
    expect(texto).toContain('No disponible');
  });

  it('conserva la ficha cuando el catálogo falla', () => {
    montar();
    http.expectOne(`/public/profiles/o/${SLUG}`).flush(PERFIL);
    http
      .expectOne((pedido) => pedido.url === `/public/profiles/o/${SLUG}/services`)
      .flush({ code: 'NOT_FOUND' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();

    // La ficha sigue en pantalla: los dos estados son independientes justamente
    // para esto — el catálogo es P30 y contra la API real todavía no responde.
    expect(fixture.nativeElement.textContent as string).toContain('Clínica Los Olivos');
  });

  it('no llama a la API cuando la ruta no trae slug', () => {
    montar(null);
    http.verify();
  });
});
