import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { wireMine } from '../../../../testing/admissions';
import { AdmissionStatusCard } from './admission-status-card';

const URL_MIA = '/profiles/practitioners/me/admission';

describe('AdmissionStatusCard', () => {
  let fixture: ComponentFixture<AdmissionStatusCard>;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement = HTMLElement>(testid: string): T | null => el().querySelector<T>(`[data-testid="${testid}"]`);

  function montar(respuesta: unknown, opciones: { hideWhenVerified?: boolean; status?: number } = {}): void {
    fixture = TestBed.createComponent(AdmissionStatusCard);
    if (opciones.hideWhenVerified) fixture.componentRef.setInput('hideWhenVerified', true);
    fixture.detectChanges();
    const req = http.expectOne(URL_MIA);
    if (opciones.status === undefined) req.flush(respuesta as never);
    else req.flush(respuesta ?? {}, { status: opciones.status, statusText: 'x' });
    fixture.detectChanges();
  }

  it('mientras llega muestra un esqueleto', () => {
    fixture = TestBed.createComponent(AdmissionStatusCard);
    fixture.detectChanges();
    expect(q('admission-card-loading')).not.toBeNull();
    http.expectOne(URL_MIA).flush(wireMine());
  });

  describe('sin solicitud', () => {
    it('un 404 no dibuja nada: ni tarjeta vacía ni error, y no se reintenta', () => {
      montar(null, { status: 404 });
      expect(q('admission-status-card')).toBeNull();
      expect(el().textContent?.trim()).toBe('');
      http.expectNone(URL_MIA);
    });
  });

  describe('un error de red', () => {
    it('se dice en chico y deja reintentar, sin tapar la pantalla', () => {
      montar(null, { status: 500 });
      expect(q('admission-card-error')?.textContent).toContain('No pudimos cargar el estado de su verificación');
      (q('admission-card-error')!.querySelector('button') as HTMLButtonElement).click();
      fixture.detectChanges();
      http.expectOne(URL_MIA).flush(wireMine());
      fixture.detectChanges();
      expect(q('admission-card-status')?.textContent).toContain('Enviada');
    });
  });

  describe('cada estado, con texto y no solo color', () => {
    /* [código de la API (en español), rótulo en pantalla, título para el médico] */
    const casos: [string, string, string][] = [
      ['ENVIADA', 'Enviada', 'Recibimos su solicitud'],
      ['EN_REVISION', 'En revisión', 'Su solicitud está en revisión'],
      ['INFORMACION_REQUERIDA', 'Información requerida', 'Necesitamos más información'],
      ['VERIFICADA', 'Verificada', 'Su matrícula está verificada'],
      ['RECHAZADA', 'Rechazada', 'No pudimos verificar su solicitud'],
      ['SUSPENDIDA', 'Suspendida', 'Su verificación está suspendida'],
      ['EXPIRADA', 'Verificación vencida', 'Su verificación venció'],
      ['ABANDONADA', 'Abandonada', 'Su solicitud se cerró por falta de respuesta'],
      ['RETIRADA', 'Retirada', 'Su solicitud fue retirada'],
    ];
    it.each(casos)('%s', (code, etiqueta, titulo) => {
      montar(wireMine({ status: { code, label: etiqueta } }));
      expect(q('admission-card-status')?.textContent).toContain(etiqueta);
      expect(q('admission-card-title')?.textContent).toContain(titulo);
    });

    it('«Corregir y reenviar» solo donde la API dice que se puede (canResubmit): información requerida, rechazada, vencida o abandonada', () => {
      const reenviables = ['INFORMACION_REQUERIDA', 'RECHAZADA', 'EXPIRADA', 'ABANDONADA'];
      for (const [code] of casos) {
        fixture?.destroy();
        montar(wireMine({ status: { code, label: code }, canResubmit: reenviables.includes(code) }));
        expect(q('admission-card-resubmit') !== null, code).toBe(reenviables.includes(code));
      }
    });
  });

  describe('qué se le dice al médico', () => {
    it('el plazo estimado de respuesta mientras está abierta', () => {
      montar(wireMine({ dueAt: '2026-11-03T13:00:00Z' }));
      expect(q('admission-card-due')?.textContent).toContain('antes del 03/11/2026');
    });

    it('con información pedida, hasta cuándo puede responder y qué se le pidió', () => {
      montar(wireMine({
        status: { code: 'INFORMACION_REQUERIDA', label: 'Información requerida' }, infoDueAt: '2026-11-25T12:00:00Z',
        infoRequestedText: 'Suba el carnet del colegio con la fecha legible.',
      }));
      expect(q('admission-card-info')?.textContent).toContain('Suba el carnet del colegio');
      expect(q('admission-card-info-due')?.textContent).toContain('hasta el 25/11/2026');
      expect(q('admission-card-due')).toBeNull();
    });

    it('lo que falta, con el motivo que escribió el revisor para él', () => {
      montar(wireMine({
        status: { code: 'RECHAZADA', label: 'Rechazada' }, decisionReasonText: 'La matrícula no figura.',
        items: [
          { type: 'REQUIREMENT', id: 'r1', label: 'Matrícula profesional', state: 'REJECTED', reasonText: 'No se lee el número.', reasonCode: 'ILEGIBLE' },
          { type: 'REQUIREMENT', id: 'r2', label: 'Cédula de identidad', state: 'VERIFIED', reasonText: null, reasonCode: null },
        ],
      }));
      expect(q('admission-card-reason')?.textContent).toContain('La matrícula no figura.');
      const items = q('admission-card-items')!.textContent ?? '';
      expect(items).toContain('Matrícula profesional');
      expect(items).toContain('Rechazado');
      expect(items).toContain('No se lee el número.');
      expect(items).not.toContain('Cédula de identidad');
    });

    it('verificada: sin lista de pendientes', () => {
      montar(wireMine({ status: { code: 'VERIFICADA', label: 'Verificada' }, items: [{ type: 'REQUIREMENT', id: 'r', label: 'Cédula', state: 'VERIFIED', reasonText: null, reasonCode: null }] }));
      expect(q('admission-card-items')).toBeNull();
    });

    it('en el panel de inicio, una solicitud verificada no ocupa lugar', () => {
      montar(wireMine({ status: { code: 'VERIFICADA', label: 'Verificada' } }), { hideWhenVerified: true });
      expect(q('admission-status-card')).toBeNull();
    });

    it('en el panel de inicio, una solicitud abierta sí se ve', () => {
      montar(wireMine(), { hideWhenVerified: true });
      expect(q('admission-status-card')).not.toBeNull();
    });
  });

  describe('corregir y reenviar', () => {
    const observada = () => wireMine({ status: { code: 'INFORMACION_REQUERIDA', label: 'Información requerida' }, canResubmit: true, resubmissionCount: 1 });

    it('pide marcar la atestación y no manda nada sin ella', () => {
      montar(observada());
      expect(el().textContent).toContain('Declaro que los datos y documentos son verídicos.');
      q('admission-card-resubmit')!.click();
      fixture.detectChanges();
      http.expectNone(`${URL_MIA}/resubmit`);
      expect(q('admission-card-attest-error')?.textContent).toContain('Marque la declaración');
    });

    it('con la atestación reenvía, dice la versión del texto y muestra el estado nuevo', () => {
      montar(observada());
      q('admission-card-attest')!.querySelector<HTMLInputElement>('input')!.click();
      fixture.detectChanges();
      q('admission-card-resubmit')!.click();
      const req = http.expectOne(`${URL_MIA}/resubmit`);
      expect(req.request.body).toEqual({ attested: true, attestationVersion: '2026-10' });
      req.flush(wireMine({ status: { code: 'ENVIADA', label: 'Enviada' }, canResubmit: false, resubmissionCount: 2 }));
      fixture.detectChanges();
      expect(q('admission-card-status')?.textContent).toContain('Enviada');
      expect(q('admission-card-resubmit')).toBeNull();
    });

    it('un doble clic manda una sola petición', () => {
      montar(observada());
      q('admission-card-attest')!.querySelector<HTMLInputElement>('input')!.click();
      fixture.detectChanges();
      const b = q('admission-card-resubmit')!;
      b.click();
      b.click();
      http.expectOne(`${URL_MIA}/resubmit`).flush(wireMine());
    });

    it('dice cuántas veces ya reenvió la solicitud', () => {
      montar(observada());
      expect(el().textContent).toContain('Ya la reenvió 1 vez.');
      fixture.destroy();
      montar(wireMine({ status: { code: 'INFORMACION_REQUERIDA', label: 'Información requerida' }, canResubmit: true, resubmissionCount: 2 }));
      expect(el().textContent).toContain('Ya la reenvió 2 veces.');
    });

    it('sin reenvíos disponibles lo dice y manda a soporte, sin botón', () => {
      montar(wireMine({ status: { code: 'RECHAZADA', label: 'Rechazada' }, canResubmit: false, resubmissionCount: 3 }));
      expect(q('admission-card-resubmit')).toBeNull();
      expect(q('admission-card-limit')?.textContent).toContain('máximo de reenvíos');
    });

    it('un 412 del servidor se muestra y deja volver a intentar', () => {
      montar(observada());
      q('admission-card-attest')!.querySelector<HTMLInputElement>('input')!.click();
      fixture.detectChanges();
      q('admission-card-resubmit')!.click();
      http.expectOne(`${URL_MIA}/resubmit`).flush(
        { code: 'PRECONDITION_FAILED', message: 'Llegó al máximo de reenvíos.' }, { status: 412, statusText: 'x' },
      );
      // Tras un rechazo de la API se relee la solicitud vigente.
      http.expectOne(URL_MIA).flush(observada());
      fixture.detectChanges();
      expect(q('admission-card-resubmit-error')?.textContent).toContain('Llegó al máximo de reenvíos.');
      expect(q<HTMLButtonElement>('admission-card-resubmit')?.getAttribute('aria-disabled')).toBe('false');
    });
  });

  describe('retirar la solicitud', () => {
    it('pide confirmar y, si se confirma, retira por POST y muestra el estado nuevo', () => {
      montar(wireMine({ canWithdraw: true }));
      q('admission-card-withdraw')!.click();
      fixture.detectChanges();
      expect(q('admission-card-withdraw-confirm')?.textContent).toContain('no podrá reenviarla');
      http.expectNone(`${URL_MIA}/withdraw`);
      q('admission-card-withdraw-yes')!.click();
      http.expectOne(`${URL_MIA}/withdraw`).flush(wireMine({ status: { code: 'RETIRADA', label: 'Retirada' }, canWithdraw: false }));
      fixture.detectChanges();
      expect(q('admission-card-status')?.textContent).toContain('Retirada');
      expect(q('admission-card-withdraw')).toBeNull();
    });

    it('«No, mantenerla» no manda nada', () => {
      montar(wireMine({ canWithdraw: true }));
      q('admission-card-withdraw')!.click();
      fixture.detectChanges();
      q('admission-card-withdraw-no')!.click();
      fixture.detectChanges();
      http.expectNone(`${URL_MIA}/withdraw`);
      expect(q('admission-card-withdraw')).not.toBeNull();
    });

    it('si la API ya no la deja retirar, la opción no se ofrece', () => {
      montar(wireMine({ canWithdraw: false }));
      expect(q('admission-card-withdraw')).toBeNull();
    });
  });

  it('el estado «Mi perfil» enlaza a donde se corrige', () => {
    montar(wireMine({ status: { code: 'INFORMACION_REQUERIDA', label: 'Información requerida' }, canResubmit: true }));
    expect(el().querySelector('a')?.getAttribute('href')).toBe('/my-account');
  });
});
