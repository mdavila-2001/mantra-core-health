import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { InsuranceCampaigns } from './insurance-campaigns';

const ROUTE = '/administration/insurance-campaigns';

/** Una fecha `AAAA-MM-DD` con los componentes locales, `days` días desde hoy. */
function civil(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function campaignWire(overrides: Record<string, unknown> = {}) {
  return {
    id: 'camp-1',
    code: 'CMP-CARDIO-2026',
    title: 'Chequeo Preventivo Cardiovascular y Perfil Lipídico',
    description: null,
    campaignType: 'LABORATORY',
    status: 'ACTIVE',
    targetCondition: { code: 'I10', display: 'Hipertensión esencial' },
    copayBonusPercentage: 100,
    validFrom: civil(0),
    validTo: civil(60),
    activatedAt: '2026-09-25T14:00:00.000000Z',
    partners: [
      {
        id: 'p-1',
        role: 'PROVIDER',
        type: 'LABORATORY',
        name: 'Laboratorio Central AloVida',
        networkProviderMembershipId: null,
      },
    ],
    createdAt: '2026-09-25T14:00:00.000000Z',
    updatedAt: '2026-09-25T14:00:00.000000Z',
    ...overrides,
  };
}

const page = (items: unknown[], nextCursor: string | null = null) => ({ items, nextCursor });

function apiError(status: number, code: string, message: string) {
  return {
    body: {
      statusCode: status,
      code,
      message,
      timestamp: '2026-09-25T00:00:00.000Z',
      path: '/insurance-campaigns',
    },
    init: { status, statusText: code },
  };
}

describe('InsuranceCampaigns', () => {
  let harness: RouterTestingHarness;
  let component: InsuranceCampaigns;
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'administration/insurance-campaigns', component: InsuranceCampaigns },
        ]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    component = await harness.navigateByUrl(ROUTE, InsuranceCampaigns);
  });

  afterEach(() => http.verify());

  const root = (): HTMLElement => harness.routeNativeElement as HTMLElement;
  const byTestId = (id: string) =>
    root().querySelector(`[data-testid="${id}"]`) as HTMLElement | null;

  function internal<T>(name: string): T {
    const value = (component as unknown as Record<string, unknown>)[name];
    return (typeof value === 'function' ? value.bind(component) : value) as T;
  }

  async function settle(): Promise<void> {
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  const listRequest = () =>
    http.expectOne((r) => r.url === '/insurance-campaigns' && r.method === 'GET');

  async function loadWith(items: unknown[]): Promise<void> {
    listRequest().flush(page(items));
    await settle();
  }

  const status = () => internal<() => { status: string }>('results')().status;

  describe('el listado', () => {
    it('empieza cargando y pide la primera página por cursor, sin filtros', () => {
      const request = listRequest();

      expect(status()).toBe('loading');
      expect(request.request.params.get('limit')).toBe('25');
      expect(request.request.params.has('cursor')).toBe(false);
      expect(request.request.params.has('type')).toBe(false);
      expect(request.request.params.has('status')).toBe(false);
      request.flush(page([]));
    });

    it('muestra la campaña con su código, su patología y el estado «Activa» (CA-4.1)', async () => {
      await loadWith([campaignWire()]);

      expect(status()).toBe('ready');
      const text = root().textContent ?? '';
      expect(text).toContain('CMP-CARDIO-2026');
      expect(text).toContain('Chequeo Preventivo Cardiovascular y Perfil Lipídico');
      expect(text).toContain('Hipertensión esencial');
      expect(text).toContain('100%');
      expect(byTestId('campaign-status-CMP-CARDIO-2026')?.textContent).toContain('Activa');
    });

    it('rotula el tipo en castellano, nunca con el código de la API', async () => {
      await loadWith([
        campaignWire({ id: 'a', code: 'CMP-A', campaignType: 'DIAGNOSTIC_IMAGING' }),
        campaignWire({ id: 'b', code: 'CMP-B', campaignType: 'VACCINATION' }),
      ]);

      const text = root().textContent ?? '';
      expect(text).toContain('Diagnóstico por imagen');
      expect(text).toContain('Vacunación');
      expect(text).not.toContain('DIAGNOSTIC_IMAGING');
      expect(text).not.toContain('VACCINATION');
    });

    it('rotula «Vencida» una campaña activa cuya vigencia ya terminó', async () => {
      await loadWith([campaignWire({ validFrom: civil(-90), validTo: civil(-1) })]);

      const badge = byTestId('campaign-status-CMP-CARDIO-2026')?.textContent ?? '';
      expect(badge).toContain('Vencida');
      expect(badge).not.toContain('Activa');
    });

    it('cada estado se dice con su texto, no sólo con un color', async () => {
      await loadWith([
        campaignWire({ id: 'a', code: 'CMP-A', status: 'DRAFT' }),
        campaignWire({ id: 'b', code: 'CMP-B', status: 'PAUSED' }),
        campaignWire({ id: 'c', code: 'CMP-C', status: 'EXPIRED' }),
      ]);

      expect(byTestId('campaign-status-CMP-A')?.textContent).toContain('Borrador');
      expect(byTestId('campaign-status-CMP-B')?.textContent).toContain('Pausada');
      expect(byTestId('campaign-status-CMP-C')?.textContent).toContain('Finalizada');
    });

    it('usa un estado vacío explícito cuando no hay campañas', async () => {
      await loadWith([]);

      expect(status()).toBe('empty');
      expect(root().textContent).toContain('Todavía no creaste campañas preventivas');
    });

    it('un fallo del servidor se dice y no deja la tabla en blanco', async () => {
      const failure = apiError(403, 'FORBIDDEN', 'La organización activa no es una aseguradora');
      listRequest().flush(failure.body, failure.init);
      await settle();

      expect(status()).toBe('forbidden');
    });

    it('un filtro en la URL vuelve a pedir con ese filtro, desde la primera página', async () => {
      await loadWith([campaignWire()]);

      await harness.navigateByUrl(`${ROUTE}?status=PAUSED&type=VACCINATION`, InsuranceCampaigns);
      const request = listRequest();

      expect(request.request.params.get('status')).toBe('PAUSED');
      expect(request.request.params.get('type')).toBe('VACCINATION');
      expect(request.request.params.has('cursor')).toBe(false);
      request.flush(page([]));
      await settle();
      expect(root().textContent).toContain('Ninguna campaña coincide con los filtros');
    });
  });

  describe('cambio de estado', () => {
    const click = async (testId: string) => {
      byTestId(testId)!.click();
      await settle();
    };

    it('un borrador sólo ofrece «Activar»', async () => {
      await loadWith([campaignWire({ status: 'DRAFT' })]);

      expect(byTestId('campaign-action-active-CMP-CARDIO-2026')).not.toBeNull();
      expect(byTestId('campaign-action-paused-CMP-CARDIO-2026')).toBeNull();
      expect(byTestId('campaign-action-expired-CMP-CARDIO-2026')).toBeNull();
    });

    it('una activa ofrece «Pausar» y «Finalizar»; una finalizada, nada', async () => {
      await loadWith([
        campaignWire({ status: 'ACTIVE' }),
        campaignWire({ id: 'c', code: 'CMP-C', status: 'EXPIRED' }),
      ]);

      expect(byTestId('campaign-action-paused-CMP-CARDIO-2026')).not.toBeNull();
      expect(byTestId('campaign-action-expired-CMP-CARDIO-2026')).not.toBeNull();
      expect(byTestId('campaign-action-active-CMP-C')).toBeNull();
      expect(byTestId('campaign-action-paused-CMP-C')).toBeNull();
      expect(byTestId('campaign-action-expired-CMP-C')).toBeNull();
    });

    it('una activa cuya vigencia terminó sólo se puede finalizar, no pausar', async () => {
      await loadWith([campaignWire({ validFrom: civil(-90), validTo: civil(-1) })]);

      expect(byTestId('campaign-action-paused-CMP-CARDIO-2026')).toBeNull();
      expect(byTestId('campaign-action-expired-CMP-CARDIO-2026')).not.toBeNull();
    });

    it('«Pausar» hace PATCH al estado PAUSED y recarga el listado', async () => {
      await loadWith([campaignWire()]);

      await click('campaign-action-paused-CMP-CARDIO-2026');
      const patch = http.expectOne('/insurance-campaigns/camp-1/status');
      expect(patch.request.method).toBe('PATCH');
      expect(patch.request.body).toEqual({ status: 'PAUSED' });
      patch.flush(campaignWire({ status: 'PAUSED' }));
      await settle();

      // Tras el cambio vuelve a pedir el listado.
      await loadWith([campaignWire({ status: 'PAUSED' })]);
      expect(byTestId('campaign-status-CMP-CARDIO-2026')?.textContent).toContain('Pausada');
    });

    it('«Finalizar» no se puede deshacer: pide confirmación antes de escribir', async () => {
      await loadWith([campaignWire()]);

      await click('campaign-action-expired-CMP-CARDIO-2026');
      // Todavía no hay ninguna petición: sólo apareció la pregunta.
      http.expectNone('/insurance-campaigns/camp-1/status');
      expect(root().textContent).toContain('No se puede reabrir');

      await click('campaign-confirm-CMP-CARDIO-2026');
      const patch = http.expectOne('/insurance-campaigns/camp-1/status');
      expect(patch.request.body).toEqual({ status: 'EXPIRED' });
      patch.flush(campaignWire({ status: 'EXPIRED' }));
      await settle();
      await loadWith([campaignWire({ status: 'EXPIRED' })]);
    });

    it('«No» cancela la confirmación sin escribir nada', async () => {
      await loadWith([campaignWire()]);
      await click('campaign-action-expired-CMP-CARDIO-2026');

      const no = [...root().querySelectorAll('button')].find(
        (b) => b.textContent?.trim() === 'No',
      )!;
      no.click();
      await settle();

      http.expectNone('/insurance-campaigns/camp-1/status');
      expect(byTestId('campaign-action-expired-CMP-CARDIO-2026')).not.toBeNull();
    });

    it('un fallo al cambiar el estado no deja la fila trabada', async () => {
      await loadWith([campaignWire()]);
      await click('campaign-action-paused-CMP-CARDIO-2026');

      const failure = apiError(
        422,
        'PRECONDITION_FAILED',
        'Una campaña en estado EXPIRED no puede pasar a ACTIVE',
      );
      http.expectOne('/insurance-campaigns/camp-1/status').flush(failure.body, failure.init);
      await settle();

      expect(internal<() => string | null>('busyId')()).toBeNull();
    });
  });

  describe('el formulario de alta', () => {
    interface FormControlLike {
      setValue: (value: unknown) => void;
      markAsTouched: () => void;
      markAsDirty: () => void;
      valid: boolean;
      invalid: boolean;
    }

    const control = (name: string): FormControlLike =>
      internal<{ controls: Record<string, FormControlLike> }>('form').controls[name]!;

    const form = () =>
      internal<{
        value: Record<string, unknown>;
        valid: boolean;
        invalid: boolean;
        hasError: (code: string) => boolean;
        getRawValue: () => Record<string, unknown>;
      }>('form');

    async function openForm(): Promise<void> {
      await loadWith([]);
      byTestId('campaign-new')!.click();
      await settle();
    }

    /** Llena lo mínimo para que el formulario sea válido. */
    function fillValid(overrides: Record<string, unknown> = {}): void {
      control('code').setValue('CMP-CARDIO-2026');
      control('title').setValue('Chequeo Preventivo Cardiovascular y Perfil Lipídico');
      const partners = internal<{ at: (i: number) => { setValue: (v: unknown) => void } }>(
        'partners',
      );
      partners
        .at(0)
        .setValue({ role: 'PROVIDER', type: 'LABORATORY', name: 'Laboratorio Central AloVida' });
      for (const [name, value] of Object.entries(overrides)) control(name).setValue(value);
    }

    it('se abre con «Nueva campaña» y trae los valores por omisión del caso habitual', async () => {
      await openForm();

      expect(byTestId('campaign-form')).not.toBeNull();
      const value = form().getRawValue();
      expect(value['copayBonusPercentage']).toBe(100);
      expect(value['campaignType']).toBe('LABORATORY');
      expect(value['activate']).toBe(true);
      expect(value['validFrom']).toBe(civil(0));
      expect(value['validTo']).toBe(civil(60));
    });

    it('«Cancelar» lo cierra y no manda nada', async () => {
      await openForm();
      const cancel = [...byTestId('campaign-form-actions')!.querySelectorAll('button')].find((b) =>
        b.textContent?.includes('Cancelar'),
      )!;
      cancel.click();
      await settle();

      expect(byTestId('campaign-form')).toBeNull();
      http.expectNone((r) => r.method === 'POST');
    });

    describe('validación en tiempo real (CA-4.6)', () => {
      it('un código inválido se marca apenas se toca el campo, sin esperar al envío', async () => {
        await openForm();
        control('code').setValue('cmp minúsculas');
        control('code').markAsDirty();
        await settle();

        expect(control('code').invalid).toBe(true);
        expect(root().textContent).toContain('Usá de 3 a 40 caracteres');
      });

      it('un código válido no muestra error', async () => {
        await openForm();
        control('code').setValue('CMP-CARDIO-2026');
        control('code').markAsDirty();
        await settle();

        expect(control('code').valid).toBe(true);
        expect(root().textContent).not.toContain('Usá de 3 a 40 caracteres');
      });

      it('fechas invertidas: el formulario es inválido y el error se dice en la fecha final', async () => {
        await openForm();
        fillValid({ validFrom: civil(10), validTo: civil(1) });
        control('validTo').markAsDirty();
        await settle();

        expect(form().invalid).toBe(true);
        expect(form().hasError('dateOrder')).toBe(true);
        expect(root().textContent).toContain('La fecha final no puede ser anterior a la inicial');
      });

      it('porcentaje fuera de 0..100 o con más de dos decimales es inválido', async () => {
        await openForm();
        for (const value of [-1, 101, 50.123]) {
          control('copayBonusPercentage').setValue(value);
          expect(control('copayBonusPercentage').invalid, String(value)).toBe(true);
        }
        for (const value of [0, 100, 33.5, 12.25]) {
          control('copayBonusPercentage').setValue(value);
          expect(control('copayBonusPercentage').valid, String(value)).toBe(true);
        }
      });

      it('el porcentaje es obligatorio', async () => {
        await openForm();
        control('copayBonusPercentage').setValue(null);

        expect(control('copayBonusPercentage').invalid).toBe(true);
      });

      it('sin nombre de aliado no es válido, ni con sólo espacios', async () => {
        await openForm();
        fillValid();
        const partner = internal<{
          at: (i: number) => { controls: Record<string, { setValue: (v: string) => void }> };
        }>('partners').at(0);

        partner.controls['name']!.setValue('   ');
        expect(form().invalid).toBe(true);
        partner.controls['name']!.setValue('Laboratorio Central AloVida');
        expect(form().valid).toBe(true);
      });

      it('enviar un formulario inválido no manda nada y marca los errores', async () => {
        await openForm();
        control('code').setValue('');
        internal<() => void>('submit')();
        await settle();

        http.expectNone((r) => r.method === 'POST');
        expect(root().textContent).toContain('Usá de 3 a 40 caracteres');
      });
    });

    describe('aliados', () => {
      const count = () => internal<{ length: number }>('partners').length;

      it('arranca con uno, se pueden sumar y quitar, pero nunca queda sin aliados', async () => {
        await openForm();
        expect(count()).toBe(1);

        byTestId('campaign-form-add-partner')!.click();
        await settle();
        expect(count()).toBe(2);

        byTestId('campaign-form-partner-remove-1')!.click();
        await settle();
        expect(count()).toBe(1);

        // El último no se puede quitar: el botón se anuncia deshabilitado
        // (`aria-disabled`, como todo `app-button`) y un clic no hace nada.
        const last = byTestId('campaign-form-partner-remove-0')!;
        expect(last.getAttribute('aria-disabled')).toBe('true');
        last.click();
        internal<(i: number) => void>('removePartner')(0);
        await settle();
        expect(count()).toBe(1);
      });
    });

    describe('envío', () => {
      it('CA-4.1: manda la campaña de referencia tal cual y la deja activa', async () => {
        await openForm();
        fillValid({
          targetConditionCode: 'i10',
          validFrom: '2026-10-01',
          validTo: '2026-11-30',
        });
        internal<() => void>('addPartner')();
        internal<{ at: (i: number) => { setValue: (v: unknown) => void } }>('partners')
          .at(1)
          .setValue({ role: 'PROVIDER', type: 'PHARMACY', name: 'Farmacias Aliadas' });

        internal<() => void>('submit')();
        await settle();

        const post = http.expectOne((r) => r.url === '/insurance-campaigns' && r.method === 'POST');
        expect(post.request.body).toEqual({
          code: 'CMP-CARDIO-2026',
          title: 'Chequeo Preventivo Cardiovascular y Perfil Lipídico',
          campaignType: 'LABORATORY',
          targetConditionCode: 'I10',
          copayBonusPercentage: 100,
          validFrom: '2026-10-01',
          validTo: '2026-11-30',
          partners: [
            { role: 'PROVIDER', type: 'LABORATORY', name: 'Laboratorio Central AloVida' },
            { role: 'PROVIDER', type: 'PHARMACY', name: 'Farmacias Aliadas' },
          ],
          activate: true,
        });
        post.flush(campaignWire());
        await settle();

        // Se cierra, se limpia y recarga el listado.
        expect(byTestId('campaign-form')).toBeNull();
        await loadWith([campaignWire()]);
        expect(byTestId('campaign-status-CMP-CARDIO-2026')?.textContent).toContain('Activa');
      });

      it('sin patología ni descripción no las manda', async () => {
        await openForm();
        fillValid({ description: '  ', targetConditionCode: '' });
        internal<() => void>('submit')();
        await settle();

        const post = http.expectOne((r) => r.url === '/insurance-campaigns' && r.method === 'POST');
        expect(post.request.body).not.toHaveProperty('description');
        expect(post.request.body).not.toHaveProperty('targetConditionCode');
        post.flush(campaignWire());
        await settle();
        await loadWith([]);
      });

      it('sin «Activar al crear» la campaña se guarda como borrador', async () => {
        await openForm();
        fillValid({ activate: false });
        internal<() => void>('submit')();
        await settle();

        const post = http.expectOne((r) => r.url === '/insurance-campaigns' && r.method === 'POST');
        expect((post.request.body as { activate: boolean }).activate).toBe(false);
        post.flush(campaignWire({ status: 'DRAFT' }));
        await settle();
        await loadWith([campaignWire({ status: 'DRAFT' })]);
        expect(byTestId('campaign-status-CMP-CARDIO-2026')?.textContent).toContain('Borrador');
      });

      it('un código repetido (409) se dice en el campo y el formulario conserva lo escrito', async () => {
        await openForm();
        fillValid();
        internal<() => void>('submit')();
        await settle();

        const failure = apiError(
          409,
          'CONFLICT',
          'Ya existe una campaña con ese código en la aseguradora',
        );
        http
          .expectOne((r) => r.url === '/insurance-campaigns' && r.method === 'POST')
          .flush(failure.body, failure.init);
        await settle();

        expect(root().textContent).toContain('Ya tenés una campaña con este código');
        expect(byTestId('campaign-form')).not.toBeNull();
        expect(form().getRawValue()['code']).toBe('CMP-CARDIO-2026');
      });

      it('sin permiso (403) lo dice tal cual y no cierra el formulario', async () => {
        await openForm();
        fillValid();
        internal<() => void>('submit')();
        await settle();

        const failure = apiError(
          403,
          'FORBIDDEN',
          'Se requiere ser OWNER o ADMIN de la organización',
        );
        http
          .expectOne((r) => r.url === '/insurance-campaigns' && r.method === 'POST')
          .flush(failure.body, failure.init);
        await settle();

        expect(byTestId('campaign-form-error')?.textContent).toContain(
          'Se requiere ser OWNER o ADMIN de la organización',
        );
        expect(byTestId('campaign-form')).not.toBeNull();
      });

      it('un segundo envío mientras el primero está en vuelo no duplica la petición', async () => {
        await openForm();
        fillValid();
        internal<() => void>('submit')();
        internal<() => void>('submit')();
        await settle();

        const posts = http.match((r) => r.url === '/insurance-campaigns' && r.method === 'POST');
        expect(posts).toHaveLength(1);
        posts[0]!.flush(campaignWire());
        await settle();
        await loadWith([]);
      });
    });
  });
});
