import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type {
  PharmacyDirectoryPage,
  PharmacyProduct,
  PharmacyProductSearchPage,
} from '../../../core/data-access/pharmacy/pharmacy.types';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import type { CamposDelProducto } from './catalogo.reglas';
import { CAMPOS_VACIOS } from './catalogo.reglas';
import { PharmacyCatalog } from './pharmacy-catalog';

/**
 * «Catálogo de productos» de la farmacia.
 *
 * Lo que se fija es el recorrido completo de cada mutación contra la API
 * simulada con `HttpTestingController`: qué petición sale, con qué cuerpo, y
 * que después de la respuesta **se relee el catálogo** — la prueba de un alta
 * es verla en la lista, no el toast.
 */
const FARMACIA = { id: '7f1c9a52-6d3e-4b18-9c47-2a5e8f0b1d63', name: 'Farmacia del Centro' };

const DIRECTORIO: PharmacyDirectoryPage = {
  items: [{ ...FARMACIA, code: 'FC-01', siteCount: 1, productCount: 1 }],
  count: 1,
};

function producto(parciales: Partial<PharmacyProduct>): PharmacyProduct {
  return {
    id: 'p-1',
    pharmacyId: FARMACIA.id,
    pharmacyName: FARMACIA.name,
    productCode: 'PAR-500',
    brandName: 'Paracetamol Bagó',
    genericName: 'Paracetamol',
    strengthText: '500 mg',
    packageSizeText: 'Caja x 20',
    dosageForm: null,
    medication: null,
    requiresPrescription: false,
    ...parciales,
  };
}

function pagina(items: readonly PharmacyProduct[]): PharmacyProductSearchPage {
  return { items, limit: 500, truncated: false };
}

/** Lo que la spec toca del componente: señales y métodos protegidos. */
interface Interno {
  pestana: { set: (indice: number) => void; (): number };
  campos: { set: (campos: CamposDelProducto) => void };
  alElegirArchivo: (archivos: readonly File[]) => Promise<void>;
  publicarCarga: () => void;
  alElegirAccion: (codigo: string, producto: PharmacyProduct) => Promise<void>;
  buscar: (termino: string) => void;
  detenerCarga: () => void;
}

describe('PharmacyCatalog', () => {
  let fixture: ComponentFixture<PharmacyCatalog>;
  let http: HttpTestingController;
  let confirmar: boolean;

  const interno = (): Interno => fixture.componentInstance as unknown as Interno;
  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const texto = (): string => raiz().textContent ?? '';

  function esperarListado(items: readonly PharmacyProduct[]): void {
    const pedido = http.expectOne((r) => r.url.endsWith('/pharmacy/products'));
    expect(pedido.request.params.get('pharmacyId')).toBe(FARMACIA.id);
    expect(pedido.request.params.get('limit')).toBe('500');
    pedido.flush(pagina(items));
    fixture.detectChanges();
  }

  function montar(items: readonly PharmacyProduct[] = [producto({})]): void {
    fixture = TestBed.createComponent(PharmacyCatalog);
    fixture.detectChanges();
    http.expectOne((r) => r.url.endsWith('/pharmacy/pharmacies')).flush(DIRECTORIO);
    fixture.detectChanges();
    esperarListado(items);
  }

  beforeEach(() => {
    confirmar = true;
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: DialogService, useValue: { confirm: () => Promise.resolve(confirmar) } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('con una sola farmacia no pregunta cuál y lista su catálogo', () => {
    montar();

    expect(raiz().querySelector('app-select')).toBeNull();
    expect(texto()).toContain('Paracetamol Bagó');
    expect(texto()).toContain('PAR-500');
    expect(texto()).toContain('1 producto publicado');
  });

  it('una búsqueda vieja que vuelve tarde no pisa a la nueva', () => {
    montar();

    interno().buscar('amox');
    interno().buscar('amoxi');
    const pedidos = http.match((r) => r.url.endsWith('/pharmacy/products'));
    expect(pedidos.map((p) => p.request.params.get('search'))).toEqual(['amox', 'amoxi']);
    // La primera se canceló al salir la segunda.
    expect(pedidos[0]!.cancelled).toBe(true);
    pedidos[1]!.flush(pagina([producto({ id: 'p-9', productCode: 'AMOXI-1', brandName: 'Amoxi' })]));
    fixture.detectChanges();

    expect(texto()).toContain('AMOXI-1');
  });

  it('un catálogo vacío dice qué hacer', () => {
    montar([]);

    expect(texto()).toContain('Tu catálogo todavía no tiene productos.');
    expect(texto()).toContain('Nuevo producto');
  });

  describe('alta de un producto', () => {
    function completarYGuardar(campos: Partial<CamposDelProducto>): void {
      interno().pestana.set(1);
      fixture.detectChanges();
      interno().campos.set({ ...CAMPOS_VACIOS, ...campos });
      fixture.detectChanges();
      (raiz().querySelector('[data-testid="catalogo-guardar"]') as HTMLButtonElement).click();
      fixture.detectChanges();
    }

    it('manda el alta sin opcionales vacíos, relee el catálogo y vuelve a la lista', () => {
      montar();
      completarYGuardar({
        codigo: 'IBU-400',
        generico: 'Ibuprofeno',
        concentracion: '400 mg',
        receta: 'no',
        codigoDeBarras: '7501031311309',
      });

      const alta = http.expectOne(`/pharmacies/${FARMACIA.id}/products`);
      expect(alta.request.method).toBe('POST');
      expect(alta.request.body).toEqual({
        productCode: 'IBU-400',
        genericName: 'Ibuprofeno',
        strengthText: '400 mg',
        requiresPrescription: false,
        identifiers: [{ identifierType: 'GTIN', identifierValue: '7501031311309' }],
      });
      alta.flush({ id: 'p-2', pharmacyId: FARMACIA.id, productCode: 'IBU-400', status: 's', identifierCount: 1, createdAt: '' }, { status: 201, statusText: 'Created' });
      fixture.detectChanges();

      esperarListado([
        producto({}),
        producto({ id: 'p-2', productCode: 'IBU-400', brandName: null, genericName: 'Ibuprofeno' }),
      ]);

      expect(interno().pestana()).toBe(0);
      expect(texto()).toContain('IBU-400');
      expect(texto()).toContain('2 productos publicados');
    });

    it('no llama a la API si faltan datos, y dice todo lo que falta', () => {
      montar();
      completarYGuardar({ codigo: '', receta: '' });

      http.expectNone(`/pharmacies/${FARMACIA.id}/products`);
      const errores = raiz().querySelector('[data-testid="catalogo-errores-alta"]');
      expect(errores?.querySelectorAll('li')).toHaveLength(2);
    });

    it('muestra el 409 del código repetido tal como lo dice la API', () => {
      montar();
      completarYGuardar({ codigo: 'PAR-500', marca: 'Otra' });

      http
        .expectOne(`/pharmacies/${FARMACIA.id}/products`)
        .flush(
          { statusCode: 409, code: 'CONFLICT', message: 'Ya existe un producto con ese código en la farmacia' },
          { status: 409, statusText: 'Conflict' },
        );
      fixture.detectChanges();

      expect(raiz().querySelector('[data-testid="catalogo-errores-alta"]')?.textContent).toContain(
        'Ya existe un producto con ese código',
      );
    });
  });

  it('retira un producto confirmado y relee el catálogo', async () => {
    montar();

    await interno().alElegirAccion('retirar', producto({}));
    const retiro = http.expectOne(`/pharmacies/${FARMACIA.id}/products/p-1`);
    expect(retiro.request.method).toBe('DELETE');
    retiro.flush({ ok: true });

    esperarListado([]);
    expect(texto()).toContain('Tu catálogo todavía no tiene productos.');
  });

  it('no retira nada si se cancela la confirmación', async () => {
    montar();
    confirmar = false;

    await interno().alElegirAccion('retirar', producto({}));

    http.expectNone(`/pharmacies/${FARMACIA.id}/products/p-1`);
  });

  describe('importación masiva', () => {
    const CSV = [
      'codigo;marca;generico;receta',
      'A-1;Uno;;no',
      'A-2;;Dos;sí',
      'PAR-500;Ya está;;no',
      ';Sin código;;',
    ].join('\n');

    async function subir(contenido: string): Promise<void> {
      interno().pestana.set(2);
      fixture.detectChanges();
      await interno().alElegirArchivo([new File([contenido], 'catalogo.csv', { type: 'text/csv' })]);
      // Los códigos se comparan contra el catálogo releído en ese momento.
      http.expectOne((r) => r.url.endsWith('/pharmacy/products')).flush(pagina([producto({})]));
      fixture.detectChanges();
    }

    it('separa las filas listas de las que hay que corregir antes de mandar nada', async () => {
      montar();
      await subir(CSV);

      const revision = raiz().querySelector('[data-testid="catalogo-revision"]')?.textContent ?? '';
      expect(revision).toMatch(/2\s+filas listas/);
      expect(revision).toMatch(/2\s+filas a corregir/);
      expect(texto()).toContain('ya está en tu catálogo');
      http.expectNone(`/pharmacies/${FARMACIA.id}/products`);
    });

    it('publica fila por fila, en serie, y cuenta lo que la API rechazó', async () => {
      montar();
      await subir(CSV);

      interno().publicarCarga();
      fixture.detectChanges();

      // Una sola en vuelo: la segunda sale cuando vuelve la primera.
      const primera = http.expectOne(`/pharmacies/${FARMACIA.id}/products`);
      expect(primera.request.body).toEqual({ productCode: 'A-1', brandName: 'Uno', requiresPrescription: false });
      primera.flush({ id: 'n-1' }, { status: 201, statusText: 'Created' });

      const segunda = http.expectOne(`/pharmacies/${FARMACIA.id}/products`);
      expect(segunda.request.body).toEqual({ productCode: 'A-2', genericName: 'Dos', requiresPrescription: true });
      segunda.flush(
        { statusCode: 409, code: 'CONFLICT', message: 'Ya existe un producto con ese código en la farmacia' },
        { status: 409, statusText: 'Conflict' },
      );
      fixture.detectChanges();

      // Hubo al menos un alta: se relee el catálogo.
      esperarListado([producto({}), producto({ id: 'n-1', productCode: 'A-1', brandName: 'Uno' })]);

      const resultado = raiz().querySelector('[data-testid="catalogo-resultado"]')?.textContent ?? '';
      expect(resultado).toMatch(/1\s+producto publicado/);
      expect(resultado).toMatch(/1\s+rechazados por la API/);
      expect(texto()).toContain('Ya existe un producto con ese código');
    });

    it('un 403 no es de la fila: corta la carga en vez de mandar las demás', async () => {
      montar();
      await subir(CSV);

      interno().publicarCarga();
      http
        .expectOne(`/pharmacies/${FARMACIA.id}/products`)
        .flush(
          { statusCode: 403, code: 'FORBIDDEN', message: 'Forbidden resource' },
          { status: 403, statusText: 'Forbidden' },
        );
      fixture.detectChanges();

      // La segunda fila lista no salió.
      http.expectNone(`/pharmacies/${FARMACIA.id}/products`);
      expect(raiz().querySelector('[data-testid="catalogo-falla-general"]')).not.toBeNull();
    });

    it('detener espera a que vuelva la fila en camino y no manda la siguiente', async () => {
      montar();
      await subir(CSV);

      interno().publicarCarga();
      const enCamino = http.expectOne(`/pharmacies/${FARMACIA.id}/products`);
      interno().detenerCarga();
      // La fila en vuelo no se cancela: puede haberse guardado en el servidor.
      expect(enCamino.cancelled).toBe(false);
      enCamino.flush({ id: 'n-1' }, { status: 201, statusText: 'Created' });

      http.expectNone(`/pharmacies/${FARMACIA.id}/products`);
      esperarListado([producto({}), producto({ id: 'n-1', productCode: 'A-1' })]);
      const resultado = raiz().querySelector('[data-testid="catalogo-resultado"]')?.textContent ?? '';
      expect(resultado).toMatch(/1\s+producto publicado/);
      expect(texto()).toContain('Detuviste la carga');
    });

    it('un CSV guardado por Excel en Windows-1252 conserva las tildes', async () => {
      montar();
      interno().pestana.set(2);
      fixture.detectChanges();
      const bytes = new Uint8Array([
        ...new TextEncoder().encode('codigo;marca\nB-1;C'),
        0xe1,
        ...new TextEncoder().encode('psulas\n'),
      ]);

      await interno().alElegirArchivo([new File([bytes], 'excel.csv', { type: 'text/csv' })]);
      http.expectOne((r) => r.url.endsWith('/pharmacy/products')).flush(pagina([]));
      fixture.detectChanges();

      expect(raiz().querySelector('[data-testid="catalogo-codificacion"]')).not.toBeNull();
      expect(raiz().querySelector('[data-testid="catalogo-muestra"]')?.textContent).toContain('Cápsulas');
    });

    it('rechaza el archivo entero si no trae la columna del código', async () => {
      montar();
      interno().pestana.set(2);
      fixture.detectChanges();

      await interno().alElegirArchivo([new File(['marca\nUno\n'], 'x.csv', { type: 'text/csv' })]);
      fixture.detectChanges();

      expect(raiz().querySelector('[data-testid="catalogo-error-archivo"]')?.textContent).toContain(
        'Falta la columna «codigo»',
      );
    });
  });
});
