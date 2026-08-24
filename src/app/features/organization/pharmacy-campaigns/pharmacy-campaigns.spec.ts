import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import type { PharmacyDirectoryPage } from '../../../core/data-access/pharmacy/pharmacy.types';
import { PharmacyCampaignsClient } from '../../../core/data-access/pharmacy-campaigns/pharmacy-campaigns.client';
import { PharmacyCampaigns } from './pharmacy-campaigns';

/**
 * «Promociones de mi farmacia» (FAR-I7).
 *
 * Lo que se fija: el chip DEMO está a la vista siempre que el carril esté
 * encendido —una promoción que ningún backend honra no se pinta callada—; con
 * una sola farmacia publicada no se pregunta de cuál es la campaña; los fallos
 * del formulario vuelven **todos juntos**; y una campaña publicada queda
 * visible para el paciente en el mismo instante.
 *
 * Corren con la demo encendida, que es el default de desarrollo.
 */
const FARMACIA = { id: '7f1c9a52-6d3e-4b18-9c47-2a5e8f0b1d63', name: 'Farmacia del Centro' };

const DIRECTORIO: PharmacyDirectoryPage = {
  items: [{ ...FARMACIA, code: 'FC-01', siteCount: 2, productCount: 40 }],
  count: 1,
};

describe('PharmacyCampaigns', () => {
  let fixture: ComponentFixture<PharmacyCampaigns>;
  let http: HttpTestingController;
  let client: PharmacyCampaignsClient;

  function montar(directorio: PharmacyDirectoryPage = DIRECTORIO): void {
    fixture = TestBed.createComponent(PharmacyCampaigns);
    fixture.detectChanges();
    http.expectOne((peticion) => peticion.url.endsWith('/pharmacy/pharmacies')).flush(directorio);
    fixture.detectChanges();
  }

  function texto(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function elemento(selector: string): Element | null {
    return (fixture.nativeElement as HTMLElement).querySelector(selector);
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    client = TestBed.inject(PharmacyCampaignsClient);
  });

  afterEach(() => http.verify());

  it('deja el chip DEMO a la vista: la campaña no la honra ningún backend', () => {
    montar();

    expect(elemento('[data-testid="campanas-chip-demo"]')).not.toBeNull();
    expect(texto()).toContain('DEMO');
  });

  it('no pregunta de qué farmacia es cuando hay una sola publicada', () => {
    montar();

    // El selector no aparece y la sección de campañas ya está disponible.
    expect(elemento('#campanas-farmacia')).toBeNull();
    expect(elemento('#campanas-publicadas')).not.toBeNull();
  });

  it('dice que no hay campañas en vez de pintar una lista vacía', () => {
    montar();

    expect(elemento('[data-testid="campanas-sin-campanas"]')).not.toBeNull();
  });

  it('junta todos los fallos del formulario en un solo intento', () => {
    montar();

    // Publicar en blanco: sin título y sin productos, las dos cosas a la vez.
    (elemento('[data-testid="campanas-publicar"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    const fallos = elemento('[data-testid="campanas-fallos"]');
    expect(fallos?.querySelectorAll('li')).toHaveLength(2);
    expect(fallos?.textContent).toContain('título');
    expect(fallos?.textContent).toContain('producto');
  });

  it('borrar una fecha no tapa los demás fallos ni inventa una vigencia invertida', () => {
    montar();
    // El caso de arriba no lo veía: el formulario **trae** las dos fechas
    // puestas. Vaciando una, publicar cortaba antes de revisar el resto y
    // acusaba a la vigencia de estar al revés, que era falso.
    const componente = fixture.componentInstance as unknown as {
      desde: { set: (valor: Date | null) => void };
    };
    componente.desde.set(null);

    (elemento('[data-testid="campanas-publicar"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    const fallos = elemento('[data-testid="campanas-fallos"]');
    expect(fallos?.textContent).toContain('Elegí desde qué día');
    expect(fallos?.textContent).not.toContain('anterior a la de inicio');
    // Y los otros dos siguen dichos: tres problemas, un solo intento.
    expect(fallos?.querySelectorAll('li')).toHaveLength(3);
  });

  it('cada campaña publicada enlaza a su ficha pública, que es lo que se comparte', async () => {
    // Sembrar antes de montar: la lista se carga al elegir la farmacia, y
    // sembrar después dejaría la pantalla mostrando el vacío de siempre.
    client.sembrarPara(FARMACIA.id, FARMACIA.name, [
      { productId: 'p-1', nombre: 'Paracetamol 500 mg', presentacion: null, precio: '15.00', moneda: 'BOB' },
    ]);
    montar();

    const [primera] = await firstValueFrom(client.campanasDeFarmacia(FARMACIA.id));
    const enlace = elemento(`[data-testid="campanas-lista"] a[href="/promociones/${primera.id}"]`);
    // Sin esto, quien publica la campaña no tiene de dónde sacar el enlace que
    // la tarjeta le pide compartir.
    expect(enlace).not.toBeNull();
    expect(enlace?.textContent?.trim()).toBe(primera.titulo);
  });

  it('deja la campaña publicada visible para el paciente en el acto', async () => {
    montar();

    const componente = fixture.componentInstance as unknown as {
      titulo: { set: (valor: string) => void };
      renglones: {
        set: (
          valor: readonly {
            productId: string;
            nombre: string;
            presentacion: string | null;
            precioNormal: string;
            moneda: string;
            precioPromocional: string | null;
          }[],
        ) => void;
      };
      publicar: () => void;
    };
    componente.titulo.set('Cuidado diario');
    componente.renglones.set([
      {
        productId: 'p-1',
        nombre: 'Metformina 850 mg',
        presentacion: 'caja x 30',
        precioNormal: '48.00',
        moneda: 'BOB',
        precioPromocional: null,
      },
    ]);
    componente.publicar();
    fixture.detectChanges();

    const vigentes = client.campanasVigentes(FARMACIA.id);
    expect(vigentes).toHaveLength(1);
    expect(vigentes[0].titulo).toBe('Cuidado diario');
    // Y aparece en la lista de la propia farmacia, no sólo en el cliente.
    expect(await firstValueFrom(client.campanasDeFarmacia(FARMACIA.id))).toHaveLength(1);
    expect(texto()).toContain('Cuidado diario');
  });

  it('publica cuando el campo numérico devuelve un número, no su texto', async () => {
    montar();

    // `app-input` declara `model<string | number | null>` y con `type="number"`
    // emite un **número**. Se entra por los manejadores de la plantilla y no
    // por los signals: el defecto vivía justo en ese borde —el porcentaje
    // llegaba como número, `enteroDe` moría en `20.trim()` y publicar no hacía
    // nada, sin alerta— y ningún caso que escriba el signal a mano lo ve.
    const componente = fixture.componentInstance as unknown as {
      titulo: { set: (valor: string) => void };
      fijarPorcentaje: (valor: string | number | null) => void;
      fijarPrecioNormal: (productId: string, precio: string | number | null) => void;
      renglones: {
        set: (
          valor: readonly {
            productId: string;
            nombre: string;
            presentacion: string | null;
            precioNormal: string;
            moneda: string;
            precioPromocional: string | null;
          }[],
        ) => void;
      };
      publicar: () => void;
    };
    componente.titulo.set('Promo de temporada');
    componente.renglones.set([
      {
        productId: 'p-1',
        nombre: 'Paracetamol 500 mg',
        presentacion: 'caja x 16',
        precioNormal: '',
        moneda: 'BOB',
        precioPromocional: null,
      },
    ]);
    componente.fijarPrecioNormal('p-1', 15);
    componente.fijarPorcentaje(20);
    componente.publicar();
    fixture.detectChanges();

    const vigentes = client.campanasVigentes(FARMACIA.id);
    expect(vigentes).toHaveLength(1);
    // El 20 % se aplicó sobre el precio que entró como número.
    expect(vigentes[0].productos[0].precioNormal).toBe('15.00');
    expect(vigentes[0].productos[0].precioPromocional).toBe('12.00');
    expect(await firstValueFrom(client.campanasDeFarmacia(FARMACIA.id))).toHaveLength(1);
  });

  it('ofrece elegir la farmacia cuando hay más de una publicada', () => {
    montar({
      items: [
        { ...FARMACIA, code: 'FC-01', siteCount: 2, productCount: 40 },
        {
          id: 'a1b2c3d4-0000-4000-8000-000000000002',
          name: 'Farmacia Andina',
          code: 'FA-01',
          siteCount: 1,
          productCount: 10,
        },
      ],
      count: 2,
    });

    expect(elemento('#campanas-farmacia')).not.toBeNull();
    // Sin farmacia elegida no se ofrece publicar nada.
    expect(elemento('[data-testid="campanas-publicar"]')).toBeNull();
  });
});
