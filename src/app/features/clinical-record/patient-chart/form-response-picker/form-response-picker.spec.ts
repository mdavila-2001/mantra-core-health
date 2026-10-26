import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { AuthService } from '../../../../core/auth/auth.service';

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

  it('la API real manda `closedAt: null` en la abierta, y tampoco cuenta', () => {
    responder([{ ...instancia('inst-abierta'), closedAt: null }, instancia('inst-1', '2026-09-26T10:00:00Z')]);

    expect(fixture.componentInstance.seleccionada()).toBe('inst-1');
    expect(deshabilitado()).toBe(true);
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

/**
 * A3 (26/10/2026): el «Formulario libre — campo y valor» se guarda como nota
 * del expediente (P39). Con `aceptaNotas`, una nota libre firmada del encuentro
 * cuenta como respuesta; un borrador se ofrece firmar en vez de decir «Falta el
 * formulario médico».
 */
describe('FormResponsePicker con notas libres', () => {
  let fixture: ComponentFixture<FormResponsePicker>;
  let http: HttpTestingController;

  const nota = (noteId: string, firmada: boolean, entries = [{ label: 'PA', value: '120/80' }]) => ({
    noteId,
    encounterId: 'enc-1',
    lifecycleStatusConceptId: 'lc',
    currentVersionId: `${noteId}-v1`,
    entries,
    releasedToPatient: false,
    createdAt: '2026-10-26T11:32:00Z',
    ...(firmada ? { signedAt: '2026-10-26T11:40:00Z' } : {}),
  });

  function responder(instancias: readonly object[], notas: readonly object[]): void {
    http
      .expectOne((r) => r.url === '/forms/instances' && r.params.get('encounter') === 'enc-1')
      .flush({ encounterId: 'enc-1', items: instancias, limit: 50, truncated: false });
    http
      .expectOne(
        (r) =>
          r.url === '/charts/notes' &&
          r.params.get('patientProfileId') === 'pac-1' &&
          // La API rechaza `encounterId` (lista blanca): el filtro es local.
          !r.params.has('encounterId'),
      )
      .flush({ items: notas, count: notas.length, limit: 50, nextCursor: null });
    fixture.detectChanges();
  }

  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { practitionerProfileId: signal('med-1') } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(FormResponsePicker);
    fixture.componentRef.setInput('encounterId', 'enc-1');
    fixture.componentRef.setInput('patientProfileId', 'pac-1');
    fixture.componentRef.setInput('aceptaNotas', true);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('una nota libre firmada del encuentro cuenta como respuesta y queda elegida', () => {
    responder([], [nota('nota-1', true)]);

    expect(fixture.componentInstance.notaSeleccionada()).toBe('nota-1');
    expect(fixture.componentInstance.seleccionada()).toBeNull();
    expect(raiz().querySelector('[data-testid="respuesta-falta"]')).toBeNull();
    expect(raiz().querySelector('[data-testid="respuesta-del-formulario"]')).not.toBeNull();
  });

  it('una nota libre firmada de OTRO encuentro no cuenta', () => {
    responder([], [{ ...nota('nota-otra', true), encounterId: 'enc-viejo' }]);

    expect(fixture.componentInstance.notaSeleccionada()).toBeNull();
    expect(raiz().querySelector('[data-testid="respuesta-falta"]')).not.toBeNull();
  });

  it('una nota sin filas (SOAP) no es un formulario libre', () => {
    responder([], [nota('nota-soap', true, [])]);

    expect(fixture.componentInstance.notaSeleccionada()).toBeNull();
    expect(raiz().querySelector('[data-testid="respuesta-falta"]')).not.toBeNull();
  });

  it('un borrador libre no dice «falta»: ofrece firmarlo y, firmado, queda elegido', () => {
    responder([], [nota('nota-b', false)]);

    expect(raiz().querySelector('[data-testid="respuesta-falta"]')).toBeNull();
    const boton = raiz().querySelector<HTMLButtonElement>('[data-testid="respuesta-firmar"]');
    expect(boton).not.toBeNull();
    boton!.click();

    const firma = http.expectOne('/charts/notes/nota-b/versions/nota-b-v1/sign');
    expect(firma.request.body).toEqual({ signerProfileId: 'med-1' });
    firma.flush(nota('nota-b', true));
    responder([], [nota('nota-b', true)]);

    expect(fixture.componentInstance.notaSeleccionada()).toBe('nota-b');
  });

  it('con respuesta de formulario y nota libre, gana la respuesta más reciente de forms', () => {
    responder(
      [
        {
          id: 'inst-1',
          resourceId: 'enc-1',
          resourceTypeConceptId: 'rt',
          schemaVersion: 1,
          createdAt: '2026-10-26T11:00:00Z',
          closedAt: '2026-10-26T11:10:00Z',
        },
      ],
      [nota('nota-1', true)],
    );

    expect(fixture.componentInstance.seleccionada()).toBe('inst-1');
    expect(fixture.componentInstance.notaSeleccionada()).toBeNull();
  });
});
