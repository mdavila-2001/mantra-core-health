import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import type { LabInboxItem } from '../../core/data-access/diagnostics/diagnostics-lab.types';
import { ToastService } from '../../shared/components/molecules/toast/toast.service';
import { LabReception } from './lab-reception';

/**
 * La recepción de muestras del laboratorio. Lo que estas pruebas fijan:
 *
 * 1. **La bandeja se pide por POST y la búsqueda viaja en el cuerpo**: el
 *    nombre del paciente nunca en la URL.
 * 2. **Los tres estados de la bandeja**: cargando, vacía (con qué hacer) y el
 *    error — el 403 del que no es personal del laboratorio, con su mensaje.
 * 3. **Recibir muestra** crea el espécimen con el tenant activo, su contenedor,
 *    y deja la fila como «Muestra recibida» sin recargar la bandeja.
 * 4. **Registrar accesión** acesiona sólo lo no rechazado y saca la orden.
 * 5. **Accesibilidad básica**: tabla con caption, botones con nombre que
 *    incluye al paciente y diálogos con título.
 */

const TENANT = 't-lab';

const STATUS_COLLECTED = 'st-collected';
const STATUS_REJECTED = 'st-rejected';

function wireOrder(id: string, specimens: readonly unknown[] = []) {
  return {
    serviceRequestId: id,
    patientProfileId: `p-${id}`,
    patientDisplayName: `Paciente ${id}`,
    patientCode: `HC-${id}`,
    codeConceptId: 'study-1',
    codeDisplay: 'Hemograma completo',
    categoryConceptId: 'cat-lab',
    priorityConceptId: 'prio-1',
    statusConceptId: 'sr-active',
    requesterProfileId: null,
    requestingTenantId: 't-clinic',
    requestingTenantName: 'Clínica Los Olivos',
    requestedAt: '2026-09-20T08:00:00.000Z',
    specimens,
  };
}

function wireSpecimen(id: string, status: string) {
  return {
    id,
    patientProfileId: 'p-x',
    specimenTypeConceptId: 'type-bldv',
    statusConceptId: status,
    collectedAt: '2026-09-21T08:00:00.000Z',
    containers: [
      { id: `c-${id}`, containerIdentifier: `TUBO-${id}`, containerTypeConceptId: 'ct-edta', statusConceptId: 'cs-active' },
    ],
    custodyEvents: [],
  };
}

const LABELS = {
  items: [
    { conceptId: 'prio-1', code: 'PRI-ROUTINE', display: 'Rutina', codeSystemVersionId: 'csv' },
    { conceptId: STATUS_COLLECTED, code: 'SPEC_COLLECTED', display: 'Recolectado', codeSystemVersionId: 'csv' },
    { conceptId: STATUS_REJECTED, code: 'diagnostics:SPECIMEN_REJECTED', display: 'Rechazado', codeSystemVersionId: 'csv' },
    { conceptId: 'type-bldv', code: 'BLDV', display: 'Sangre venosa', codeSystemVersionId: 'csv' },
    { conceptId: 'ct-edta', code: 'TUBE_LAVENDER_EDTA', display: 'Tubo tapa lila (EDTA)', codeSystemVersionId: 'csv' },
  ],
  total: 5,
};

function dynamicEnum(code: string, options: readonly [string, string, string][]) {
  return {
    code,
    name: code,
    definitionId: `def-${code}`,
    valueSetId: `vs-${code}`,
    allowCustomValue: false,
    options: options.map(([conceptId, optionCode, display], i) => ({
      conceptId,
      code: optionCode,
      display,
      ordinal: i + 1,
      isDefault: false,
    })),
  };
}

describe('LabReception', () => {
  let fixture: ComponentFixture<LabReception>;
  let component: LabReception;
  let http: HttpTestingController;
  let host: HTMLElement;
  const toastSuccess = vi.fn();

  beforeEach(() => {
    toastSuccess.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            roles: signal<readonly string[]>(['USER']),
            tenants: signal<readonly string[]>([TENANT]),
            activeTenantType: signal<string | null>('DIAGNOSTIC_CENTER'),
            activeTenantId: signal<string | null>(TENANT),
          },
        },
        { provide: ToastService, useValue: { success: toastSuccess } },
      ],
    });

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(LabReception);
    component = fixture.componentInstance;
    host = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => http.verify());

  function inboxRequest() {
    return http.expectOne(
      (r) => r.method === 'POST' && r.url === '/diagnostics/service-requests/inbox',
    );
  }

  function flushLabels(): void {
    for (const req of http.match((r) => r.url === '/terminology/concepts')) req.flush(LABELS);
  }

  /** Monta la bandeja con estas órdenes y deja todo dibujado. */
  function loadInbox(items: readonly unknown[], nextCursor: string | null = null): void {
    fixture.detectChanges();
    inboxRequest().flush({ items, count: items.length, limit: 25, nextCursor });
    flushLabels();
    fixture.detectChanges();
  }

  function rows(): readonly LabInboxItem[] {
    const state = component['inbox']();
    return state.status === 'ready' ? state.data : [];
  }

  function button(testId: string, index = 0): HTMLElement {
    const found = host.querySelectorAll<HTMLElement>(`[data-testid="${testId}"]`)[index];
    if (found === undefined) throw new Error(`No hay ${testId}`);
    return found;
  }

  describe('la bandeja', () => {
    it('empieza cargando y pide la bandeja por POST, sin nada del paciente en la URL', () => {
      fixture.detectChanges();
      expect(component['inbox']().status).toBe('loading');

      const req = inboxRequest();
      expect(req.request.body).toEqual({ limit: 25 });
      expect(req.request.urlWithParams).toBe('/diagnostics/service-requests/inbox');
      req.flush({ items: [], count: 0, limit: 25, nextCursor: null });
    });

    it('buscar por paciente manda el texto en el cuerpo; una letra suelta no busca', () => {
      loadInbox([wireOrder('1')]);

      component['search']('P');
      http.expectNone((r) => r.url === '/diagnostics/service-requests/inbox');

      component['search'](' Pérez ');
      const req = inboxRequest();
      expect(req.request.body).toEqual({ limit: 25, patientQuery: 'Pérez' });
      expect(req.request.urlWithParams).not.toContain('P%C3%A9rez');
      req.flush({ items: [], count: 0, limit: 25, nextCursor: null });
      fixture.detectChanges();

      const state = component['inbox']();
      expect(state.status).toBe('empty');
      if (state.status === 'empty') expect(state.message).toContain('Pérez');
    });

    it('vacía: dice qué va a aparecer y cuándo', () => {
      loadInbox([]);
      const state = component['inbox']();
      expect(state.status).toBe('empty');
      if (state.status === 'empty') {
        expect(state.message).toContain('No hay órdenes esperando muestra');
        expect(state.nextAction.route).toBeUndefined();
      }
    });

    it('403: queda como «sin permiso» con el mensaje para el personal del laboratorio', () => {
      fixture.detectChanges();
      inboxRequest().flush(
        { statusCode: 403, code: 'FORBIDDEN', message: 'Se requiere ser personal del laboratorio de la organización activa' },
        { status: 403, statusText: 'Forbidden' },
      );
      fixture.detectChanges();

      const state = component['inbox']();
      expect(state.status).toBe('forbidden');
      if (state.status === 'forbidden') expect(state.message).toContain('personal del laboratorio');
    });

    it('un fallo del servidor es reintentable', () => {
      fixture.detectChanges();
      inboxRequest().flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });
      fixture.detectChanges();
      expect(component['inbox']().status).toBe('error');

      component['reload']();
      inboxRequest().flush({ items: [], count: 0, limit: 25, nextCursor: null });
    });

    it('«Cargar más» sigue el cursor y suma filas; desaparece sin cursor', () => {
      loadInbox([wireOrder('1')], 'cursor-2');
      button('lab-reception-more').click();

      const req = inboxRequest();
      expect(req.request.body).toEqual({ limit: 25, cursor: 'cursor-2' });
      req.flush({ items: [wireOrder('2')], count: 1, limit: 25, nextCursor: null });
      flushLabels();
      fixture.detectChanges();

      expect(rows().map((r) => r.serviceRequestId)).toEqual(['1', '2']);
      expect(host.querySelector('[data-testid="lab-reception-more"]')).toBeNull();
    });

    it('etapas: sin muestra, recibida y rechazada', () => {
      loadInbox([
        wireOrder('1'),
        wireOrder('2', [wireSpecimen('s2', STATUS_COLLECTED)]),
        wireOrder('3', [wireSpecimen('s3', STATUS_REJECTED)]),
      ]);
      const [pending, received, rejected] = rows();
      expect(component['stageBadge'](pending!).label).toBe('Sin muestra');
      expect(component['stageBadge'](received!).label).toBe('Muestra recibida');
      expect(component['stageBadge'](rejected!).label).toBe('Rechazada');
    });
  });

  describe('accesibilidad', () => {
    it('la tabla tiene caption y los botones de fila nombran al paciente', () => {
      loadInbox([wireOrder('1')]);

      expect(host.querySelector('caption')?.textContent).toContain(
        'Órdenes de laboratorio pendientes de recepción',
      );
      expect(button('lab-reception-receive').getAttribute('aria-label')).toBe(
        'Recibir muestra de Paciente 1',
      );
      expect(button('lab-reception-accession').getAttribute('aria-label')).toBe(
        'Registrar accesión de Paciente 1',
      );
      // Sin muestra no hay nada que acesionar.
      expect(button('lab-reception-accession').getAttribute('aria-disabled')).toBe('true');
    });

    it('la custodia se abre por fila y dice si está expandida', () => {
      loadInbox([wireOrder('1', [wireSpecimen('s1', STATUS_COLLECTED)])]);
      const toggle = button('lab-reception-custody-toggle');
      expect(toggle.getAttribute('aria-expanded')).toBe('false');

      toggle.click();
      fixture.detectChanges();

      expect(toggle.getAttribute('aria-expanded')).toBe('true');
      const panel = host.querySelector('[data-testid="lab-reception-custody"]');
      expect(panel?.textContent).toContain('Cadena de custodia · Paciente 1');
      expect(panel?.textContent).toContain('TUBO-s1');
      expect(panel?.textContent).toContain('Sangre venosa');
    });
  });

  describe('recibir muestra', () => {
    it('crea el espécimen con el tenant activo, su contenedor, y deja la fila como recibida', () => {
      loadInbox([wireOrder('1')]);
      button('lab-reception-receive').click();
      fixture.detectChanges();

      const specimenEnum = http.expectOne(
        (r) =>
          r.url === '/system-context/dynamic-enums' &&
          r.params.get('target') === 'diagnostics.specimens.specimen_type_concept_id',
      );
      const containerEnum = http.expectOne(
        (r) =>
          r.url === '/system-context/dynamic-enums' &&
          r.params.get('target') === 'diagnostics.specimen_containers.container_type_concept_id',
      );
      specimenEnum.flush(dynamicEnum('specimen-type', [['type-bldv', 'BLDV', 'Venous blood (whole blood)']]));
      containerEnum.flush(
        dynamicEnum('specimen-container-type', [['ct-edta', 'TUBE_LAVENDER_EDTA', 'Lavender-top tube']]),
      );
      flushLabels();
      fixture.detectChanges();

      // El diálogo se titula con el paciente y ofrece el catálogo en castellano.
      expect(host.querySelector('[data-testid="content-dialog-title"]')?.textContent).toContain(
        'Recibir muestra de Paciente 1',
      );
      expect(component['specimenTypeOptions']()).toEqual([{ value: 'type-bldv', label: 'Sangre venosa' }]);

      // Sin completar, no envía y marca los tres campos.
      component['submitReceive']();
      fixture.detectChanges();
      http.expectNone((r) => r.url === '/diagnostics/specimens');
      expect(component['specimenTypeError']()).not.toBe('');
      expect(component['containerTypeError']()).not.toBe('');
      expect(component['containerLabelError']()).not.toBe('');

      component['specimenType'].set('type-bldv');
      component['containerType'].set('ct-edta');
      component['containerLabel'].set('  TUBO-5012 ');
      component['submitReceive']();

      const create = http.expectOne((r) => r.method === 'POST' && r.url === '/diagnostics/specimens');
      expect(create.request.body).toEqual({
        patientProfileId: 'p-1',
        custodianTenantId: TENANT,
        specimenTypeConceptId: 'type-bldv',
        serviceRequestId: '1',
      });
      create.flush({ id: 's-new', status: STATUS_COLLECTED });

      const container = http.expectOne((r) => r.url === '/diagnostics/specimens/s-new/containers');
      expect(container.request.body).toEqual({
        containerIdentifier: 'TUBO-5012',
        containerTypeConceptId: 'ct-edta',
      });
      container.flush({ id: 'c-new', status: 'cs-active' });

      http
        .expectOne((r) => r.method === 'GET' && r.url === '/diagnostics/specimens/s-new')
        .flush(wireSpecimen('new', STATUS_COLLECTED));
      // Las etiquetas que faltan del espécimen nuevo (el estado del contenedor).
      flushLabels();
      fixture.detectChanges();

      expect(component['receiveOrder']()).toBeNull();
      expect(component['stageBadge'](rows()[0]!).label).toBe('Muestra recibida');
      expect(toastSuccess).toHaveBeenCalled();
    });

    it('un rechazo de la API queda en el diálogo, con su mensaje', () => {
      loadInbox([wireOrder('1')]);
      component['openReceive'](rows()[0]!);
      for (const req of http.match((r) => r.url === '/system-context/dynamic-enums')) {
        req.flush(dynamicEnum('x', [['type-bldv', 'BLDV', 'Venous blood']]));
      }
      flushLabels();

      component['specimenType'].set('type-bldv');
      component['containerType'].set('type-bldv');
      component['containerLabel'].set('TUBO-1');
      component['submitReceive']();
      http
        .expectOne((r) => r.url === '/diagnostics/specimens')
        .flush(
          { statusCode: 400, code: 'VALIDATION_FAILED', message: 'Faltan datos del espécimen' },
          { status: 400, statusText: 'Bad Request' },
        );
      fixture.detectChanges();

      expect(component['receiveError']()).toBe('Faltan datos del espécimen');
      expect(component['receiveOrder']()).not.toBeNull();
    });

    /** Abre el diálogo, responde los catálogos y envía con lo elegido. */
    function submitWithCatalogs(): void {
      loadInbox([wireOrder('1')]);
      component['openReceive'](rows()[0]!);
      for (const req of http.match((r) => r.url === '/system-context/dynamic-enums')) {
        req.flush(dynamicEnum('x', [['type-bldv', 'BLDV', 'Venous blood']]));
      }
      flushLabels();
      component['specimenType'].set('type-bldv');
      component['containerType'].set('ct-edta');
      component['containerLabel'].set('TUBO-1');
      component['submitReceive']();
    }

    function catalogRejection(reason: string) {
      return [
        {
          statusCode: 422,
          code: 'PRECONDITION_FAILED',
          message: 'El tipo no pertenece al catálogo',
          details: { reason },
        },
        { status: 422, statusText: 'Unprocessable Entity' },
      ] as const;
    }

    it('tipo de muestra fuera del catálogo (422 con motivo): lo dice en castellano y vuelve a pedir los catálogos', () => {
      submitWithCatalogs();
      http
        .expectOne((r) => r.url === '/diagnostics/specimens')
        .flush(...catalogRejection('SPECIMEN_TYPE_NOT_IN_CATALOG'));
      fixture.detectChanges();

      expect(component['receiveError']()).toBe(
        'Ese tipo de muestra ya no está en el catálogo. Actualizamos la lista: elegí otro.',
      );
      expect(component['receiveOrder']()).not.toBeNull();
      // Los dos catálogos se piden de nuevo; la bandeja no, porque no se creó nada.
      expect(http.match((r) => r.url === '/system-context/dynamic-enums')).toHaveLength(2);
      http.expectNone((r) => r.url === '/diagnostics/service-requests/inbox');
    });

    it('contenedor fuera del catálogo: la muestra ya quedó, así que además relee la bandeja', () => {
      submitWithCatalogs();
      http
        .expectOne((r) => r.url === '/diagnostics/specimens')
        .flush({ id: 's-new', status: STATUS_COLLECTED });
      http
        .expectOne((r) => r.url === '/diagnostics/specimens/s-new/containers')
        .flush(...catalogRejection('CONTAINER_TYPE_NOT_IN_CATALOG'));
      fixture.detectChanges();

      expect(component['receiveError']()).toContain('La muestra quedó registrada');
      expect(http.match((r) => r.url === '/system-context/dynamic-enums')).toHaveLength(2);
      inboxRequest().flush({ items: [], count: 0, limit: 25, nextCursor: null });
    });

    it('un 422 sin motivo de catálogo conserva el mensaje de la API', () => {
      submitWithCatalogs();
      http
        .expectOne((r) => r.url === '/diagnostics/specimens')
        .flush(...catalogRejection('OTRA_COSA'));
      fixture.detectChanges();

      expect(component['receiveError']()).toBe('El tipo no pertenece al catálogo');
      http.expectNone((r) => r.url === '/system-context/dynamic-enums');
    });
  });

  describe('registrar accesión', () => {
    it('acesiona sólo las muestras no rechazadas y saca la orden de la bandeja', () => {
      loadInbox([
        wireOrder('1', [wireSpecimen('ok', STATUS_COLLECTED), wireSpecimen('bad', STATUS_REJECTED)]),
        wireOrder('2'),
      ]);
      button('lab-reception-accession').click();
      fixture.detectChanges();

      const confirm = host.querySelector('[data-testid="lab-reception-accession-specimens"]');
      expect(confirm?.textContent).toContain('TUBO-ok');
      expect(confirm?.textContent).not.toContain('TUBO-bad');

      component['submitAccession']();
      const req = http.expectOne((r) => r.method === 'POST' && r.url === '/diagnostics/accessions');
      expect(req.request.body).toEqual({
        patientProfileId: 'p-1',
        specimenIds: ['ok'],
        serviceRequestId: '1',
      });
      req.flush({ id: 'acc-1', status: 'acc-received', accessionSpecimenIds: ['as-1'] });

      http.expectOne((r) => r.url === '/diagnostics/accessions/acc-1').flush({
        id: 'acc-1',
        custodianTenantId: TENANT,
        patientProfileId: 'p-1',
        accessionNumber: 'ACC-1234',
        receivedAt: '2026-09-26T10:00:00.000Z',
        priorityConceptId: 'prio-1',
        statusConceptId: 'acc-received',
        specimens: [],
      });
      fixture.detectChanges();

      expect(rows().map((r) => r.serviceRequestId)).toEqual(['2']);
      expect(component['accessionOrder']()).toBeNull();
      expect(toastSuccess.mock.calls[0]?.[0]).toContain('ACC-1234');
    });
  });
});
