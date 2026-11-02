import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { DialogService } from '../../../../../shared/components/molecules/dialog/dialog-service';
import { ToastService } from '../../../../../shared/components/molecules/toast/toast.service';
import { ShareLinks } from './share-links';

const LIST_URL = '/clinical/prescription-shares';

const ROWS = [
  {
    shareId: 'sh-old',
    resourceType: 'MEDICATION_REQUEST',
    resourceId: 'mr-1',
    createdAt: '2026-09-01T10:00:00.000Z',
    expiresAt: '2026-09-30T10:00:00.000Z',
    status: 'EXPIRED',
    uses: 0,
  },
  {
    shareId: 'sh-new',
    resourceType: 'PRESCRIPTION_ENCOUNTER',
    resourceId: 'enc-1',
    createdAt: '2026-10-20T10:00:00.000Z',
    expiresAt: '2026-11-19T10:00:00.000Z',
    status: 'VALID',
    uses: 1,
  },
];

/**
 * «Enlaces compartidos» (FAR-01, REQ-018).
 *
 * Lo que fijan estas pruebas: la lista se pide por el perfil del paciente y
 * sale la más nueva arriba, con estado, vencimiento y aperturas; vacía tiene
 * su texto y una próxima acción; «Revocar» pide confirmación, no hace nada si
 * se cancela y con el 204 deja la fila en «Revocado» sin volver a pedir la
 * lista; un rechazo lo avisa y deja la fila como estaba; carga y error.
 */
describe('ShareLinks', () => {
  let http: HttpTestingController;
  let confirm: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    confirm = vi.fn().mockResolvedValue(true);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: DialogService, useValue: { confirm } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function mount(highlight: string | null = null): ComponentFixture<ShareLinks> {
    const fixture = TestBed.createComponent(ShareLinks);
    fixture.componentRef.setInput('patientProfileId', 'pp-1');
    fixture.componentRef.setInput('highlightShareId', highlight);
    fixture.componentRef.setInput(
      'prescriptionDates',
      new Map([['enc-1', new Date('2026-10-15T10:00:00.000Z')]]),
    );
    fixture.detectChanges();
    return fixture;
  }

  function list(fixture: ComponentFixture<ShareLinks>, rows: object[] = ROWS): void {
    const req = http.expectOne((r) => r.url === LIST_URL);
    expect(req.request.params.get('patientProfileId')).toBe('pp-1');
    req.flush(rows);
    fixture.detectChanges();
  }

  function rowsOf(fixture: ComponentFixture<ShareLinks>): HTMLElement[] {
    return [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
        '[data-testid="prescription-share-link-row"]',
      ),
    ];
  }

  it('lista los enlaces del paciente, el más nuevo arriba, con estado y aperturas', () => {
    const fixture = mount();
    expect(fixture.nativeElement.querySelector('.view-state-host__loading')).not.toBeNull();
    list(fixture);

    const rows = rowsOf(fixture);
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Vigente');
    expect(rows[0].textContent).toContain('1 apertura');
    expect(rows[0].textContent).toContain('Receta del');
    expect(rows[0].textContent).toContain('2026');
    expect(rows[1].textContent).toContain('Vencido');
    expect(rows[1].textContent).toContain('Receta compartida');
  });

  it('dos enlaces del mismo día se distinguen por la hora, y uno vencido no dice «vence el»', () => {
    const fixture = mount();
    list(fixture);

    const meta = rowsOf(fixture).map(
      (row) => row.querySelector('[data-testid="prescription-share-link-meta"]')?.textContent ?? '',
    );
    expect(meta[0]).toMatch(/a las \d{2}:\d{2}/);
    expect(meta[0]).toContain('vence el');
    expect(meta[1]).toContain('ya no abre');
    expect(meta[1]).not.toContain('vence el');
  });

  it('una receta anulada no se informa como «Vencido» (H12-09)', () => {
    const fixture = mount();
    list(fixture, [{ ...ROWS[1], status: 'EXPIRED', endedReason: 'PRESCRIPTION_NOT_ACTIVE' }]);

    const status = rowsOf(fixture)[0].querySelector('[data-testid="prescription-share-link-status"]');
    expect(status?.textContent?.trim()).toBe('Receta sin vigencia');
  });

  it('marca el enlace que llegó por ?share=', () => {
    const fixture = mount('sh-new');
    list(fixture);

    expect(rowsOf(fixture)[0].getAttribute('aria-current')).toBe('true');
    expect(rowsOf(fixture)[1].getAttribute('aria-current')).toBeNull();
    // Dicho en texto, no solo con el color del borde.
    expect(
      rowsOf(fixture)[0].querySelector('[data-testid="prescription-share-link-highlight"]')
        ?.textContent,
    ).toContain('El enlace que acaba de abrir');
    expect(
      rowsOf(fixture)[1].querySelector('[data-testid="prescription-share-link-highlight"]'),
    ).toBeNull();
  });

  it('sin enlaces, un vacío con próxima acción', () => {
    const fixture = mount();
    list(fixture, []);

    expect(fixture.nativeElement.textContent).toContain('Todavía no compartió ninguna receta.');
    expect(fixture.nativeElement.textContent).toContain('Use «Compartir» en una receta emitida');
  });

  it('un error de la lectura queda recuperable', () => {
    const fixture = mount();
    http
      .expectOne((r) => r.url === LIST_URL)
      .flush(
        { code: 'INTERNAL', message: 'x', correlationId: 'req-5' },
        { status: 500, statusText: 'Server Error' },
      );
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('req-5');
    expect(fixture.nativeElement.textContent).toContain('Reintentar');
  });

  it('«Revocar» confirma y, con el 204, la fila pasa a «Revocado» sin recargar', async () => {
    const fixture = mount();
    list(fixture);

    const revoke = rowsOf(fixture)[0].querySelector<HTMLButtonElement>(
      '[data-testid="prescription-share-link-revoke"]',
    );
    revoke?.click();
    await fixture.whenStable();

    expect(confirm).toHaveBeenCalledTimes(1);
    const req = http.expectOne('/clinical/prescription-shares/sh-new/revoke');
    expect(req.request.method).toBe('POST');
    req.flush(null, { status: 204, statusText: 'No Content' });
    fixture.detectChanges();

    http.expectNone((r) => r.url === LIST_URL);
    expect(rowsOf(fixture)[0].textContent).toContain('Revocado');
    expect(
      rowsOf(fixture)[0].querySelector('[data-testid="prescription-share-link-revoke"]'),
    ).toBeNull();
  });

  it('cancelar la confirmación no revoca nada', async () => {
    confirm.mockResolvedValue(false);
    const fixture = mount();
    list(fixture);

    rowsOf(fixture)[0]
      .querySelector<HTMLButtonElement>('[data-testid="prescription-share-link-revoke"]')
      ?.click();
    await fixture.whenStable();

    http.expectNone('/clinical/prescription-shares/sh-new/revoke');
    expect(rowsOf(fixture)[0].textContent).toContain('Vigente');
  });

  it('un rechazo de la API lo avisa y la fila queda como estaba', async () => {
    const error = vi.spyOn(TestBed.inject(ToastService), 'error');
    const fixture = mount();
    list(fixture);

    rowsOf(fixture)[0]
      .querySelector<HTMLButtonElement>('[data-testid="prescription-share-link-revoke"]')
      ?.click();
    await fixture.whenStable();
    http
      .expectOne('/clinical/prescription-shares/sh-new/revoke')
      .flush({ code: 'NOT_FOUND', message: 'x' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();

    expect(error).toHaveBeenCalledWith('No se pudo revocar el enlace.');
    expect(rowsOf(fixture)[0].textContent).toContain('Vigente');
  });
});
