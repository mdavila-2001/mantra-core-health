import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { FormResponsePicker } from './form-response-picker';

/**
 * El selector de la respuesta del formulario médico.
 *
 * Lo que fijan estas pruebas:
 *
 * 1. **Viene cargada**: la respuesta más reciente queda elegida sin tocar nada.
 * 2. **Con una sola, deshabilitado**; con varias, habilitado.
 * 3. **Sólo cuentan las cerradas**: una instancia abierta no es respuesta.
 * 4. **Sin respuesta, `null` y un aviso**: quien lo usa bloquea su botón.
 */
describe('FormResponsePicker', () => {
  let fixture: ComponentFixture<FormResponsePicker>;
  let http: HttpTestingController;

  const instancia = (id: string, closedAt?: string) => ({
    id,
    resourceId: 'enc-1',
    resourceTypeConceptId: 'rt',
    schemaVersion: 1,
    createdAt: '2026-09-26T09:00:00Z',
    ...(closedAt === undefined ? {} : { closedAt }),
  });

  function responder(items: readonly object[]): void {
    http
      .expectOne((r) => r.url === '/forms/instances' && r.params.get('encounter') === 'enc-1')
      .flush({ encounterId: 'enc-1', items, limit: 50, truncated: false });
    fixture.detectChanges();
  }

  function selector(): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="respuesta-del-formulario"]',
    );
  }

  function deshabilitado(): boolean {
    return selector()?.querySelector('[disabled], [aria-disabled="true"]') !== null;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(FormResponsePicker);
    fixture.componentRef.setInput('encounterId', 'enc-1');
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('con una sola respuesta la elige sola y queda deshabilitado', () => {
    responder([instancia('inst-1', '2026-09-26T10:00:00Z')]);

    expect(fixture.componentInstance.seleccionada()).toBe('inst-1');
    expect(selector()).not.toBeNull();
    expect(deshabilitado()).toBe(true);
  });

  it('con varias elige la más reciente y deja cambiarla', () => {
    responder([
      instancia('inst-vieja', '2026-09-26T09:30:00Z'),
      instancia('inst-nueva', '2026-09-26T11:00:00Z'),
    ]);

    expect(fixture.componentInstance.seleccionada()).toBe('inst-nueva');
    expect(deshabilitado()).toBe(false);
  });

  it('una instancia abierta no cuenta como respuesta', () => {
    responder([instancia('inst-abierta')]);

    expect(fixture.componentInstance.seleccionada()).toBeNull();
    const aviso = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="respuesta-falta"]',
    );
    expect(aviso?.textContent).toContain('Formulario médico');
  });

  it('sin encuentro no pregunta nada y lo dice', () => {
    fixture.componentRef.setInput('encounterId', null);
    fixture.detectChanges();
    // La primera consulta, la de enc-1, quedó en vuelo: se descarta.
    http.match(() => true).forEach((pedido) => pedido.flush({ items: [] }));

    expect(fixture.componentInstance.seleccionada()).toBeNull();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector(
        '[data-testid="respuesta-sin-encuentro"]',
      ),
    ).not.toBeNull();
  });

  it('si la lectura falla, no deja nada elegido', () => {
    http
      .expectOne((r) => r.url === '/forms/instances')
      .flush({ message: 'boom' }, { status: 500, statusText: 'Error' });
    fixture.detectChanges();

    expect(fixture.componentInstance.seleccionada()).toBeNull();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-testid="respuesta-error"]'),
    ).not.toBeNull();
  });
});
