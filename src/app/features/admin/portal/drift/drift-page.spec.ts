import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { drift, finding, findingDetail } from '../portal.fixture';
import { DriftPage } from './drift-page';
import { describeFindingItem, readDrift } from './drift.model';

const RUTA = '/superadmin/portal/systems/drift';

describe('DriftPage', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  async function abrir(query = ''): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'superadmin/portal/systems/drift', component: DriftPage }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`${RUTA}${query}`, DriftPage);
    http.expectOne('/admin/portal/flujos/hallazgos').flush([finding()]);
    http.expectOne('/admin/portal/catalogo/deriva').flush(drift());
    harness.detectChanges();
  }

  function documento(): HTMLElement {
    return harness.fixture.nativeElement as HTMLElement;
  }

  afterEach(() => http.verify());

  it('lista los hallazgos del mapa con su severidad', async () => {
    await abrir();
    const tabla = documento().querySelector('[data-testid="portal-findings-table"]')!;
    expect(tabla.textContent).toContain('Escriben sin declarar roles');
    expect(tabla.textContent).toContain('Alta');
  });

  it('la deriva del modelo nombra lo que conoce y deja el resto con su clave', async () => {
    await abrir('?vista=modelo');
    const deriva = documento().querySelector('[data-testid="portal-model-drift"]')!;
    expect(deriva.textContent).toContain('Entidades del ORM sin tabla en el modelo');
    expect(deriva.textContent).toContain('payments.cash_registers');
    expect(deriva.textContent).toContain('En ninguna fuente del modelo');
    expect(deriva.textContent).toContain('audio_assets');
    expect(deriva.textContent).toContain('19 divergen de su entidad');
  });

  it('`?hallazgo=` abre el cajón con sus casos y «Ver más» suma la página siguiente', async () => {
    await abrir('?hallazgo=FLU-02');
    const primera = http.expectOne((r) => r.url === '/admin/portal/flujos/hallazgos/FLU-02');
    expect(primera.request.params.get('limit')).toBe('50');
    primera.flush(findingDetail('c1'));
    harness.detectChanges();

    const cajon = documento().querySelector('[data-testid="portal-finding-detail"]')!;
    expect(cajon.textContent).toContain('GET /audio-assets/{assetId}/content');
    expect(cajon.textContent).toContain('Declarar @Roles en el controlador');

    documento().querySelector<HTMLButtonElement>('[data-testid="portal-finding-more"] button, button[data-testid="portal-finding-more"]')!.click();
    const segunda = http.expectOne((r) => r.url === '/admin/portal/flujos/hallazgos/FLU-02');
    expect(segunda.request.params.get('cursor')).toBe('c1');
    segunda.flush(findingDetail(null));
    harness.detectChanges();
    expect(documento().querySelectorAll('.finding__item')).toHaveLength(2);
    expect(documento().querySelector('[data-testid="portal-finding-more"]')).toBeNull();
  });
});

describe('drift.model', () => {
  it('cuenta listas y números, y una clave nueva se muestra tal cual', () => {
    const vista = readDrift({ resumen: {}, deriva: { entidadesSinTabla: [{}, {}], clavesNuevas: 3, texto: 'x' } });
    expect(vista.metrics).toEqual([
      { key: 'entidadesSinTabla', label: 'Entidades del ORM sin tabla en el modelo', value: 2 },
      { key: 'clavesNuevas', label: 'clavesNuevas', value: 3 },
    ]);
    // Las entradas sin `tabla` no se inventan.
    expect(vista.orphanEntities).toEqual([]);
    expect(vista.tables).toBeNull();
  });

  it('un caso de proceso se nombra por el proceso, uno de operación por su ruta', () => {
    expect(describeFindingItem({ proceso: 'audio_assets', nombre: 'Audio Assets', detalle: 'sin pruebas' }).title).toBe(
      'Audio Assets',
    );
    const op = describeFindingItem({ operacion: 'A_b', metodo: 'POST', ruta: '/x', fuente: null });
    expect(op).toEqual({ title: 'POST /x', detail: null, source: null, operationId: 'A_b' });
  });
});
