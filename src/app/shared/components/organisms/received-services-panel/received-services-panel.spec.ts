import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';

import { ReceivedServicesClient } from '../../../../core/data-access/received-services/received-services.client';
import type { ReceivedService, ReceivedServicesPage } from '../../../../core/data-access/received-services/received-services.types';
import { TerminologyClient } from '../../../../core/data-access/terminology/terminology.client';
import type { ConceptLabels } from '../../../../core/data-access/terminology/terminology.types';
import { ReceivedServicesPanel } from './received-services-panel';

const PATIENT = 'p-1';

function service(overrides: Partial<ReceivedService> = {}): ReceivedService {
  return {
    id: 'rs-1',
    type: 'INTERVENTION',
    typeConceptId: 'type-int',
    serviceConceptId: 'svc-1',
    statusConceptId: 'st-1',
    performedAt: new Date('2026-08-12T14:30:00.000Z'),
    performerName: 'Dra. Ana Rojas',
    practiceSiteName: 'Clínica Los Olivos',
    resultText: 'Sin complicaciones',
    cost: { amount: '350.00', currencyCode: 'BOB', source: 'INVOICE_LINE' },
    ...overrides,
  };
}

function page(items: ReceivedService[], overrides: Partial<ReceivedServicesPage> = {}): ReceivedServicesPage {
  return { patientProfileId: PATIENT, items, limit: 100, truncated: false, costsVisible: true, ...overrides };
}

const LABELS: ConceptLabels = new Map([
  ['svc-1', { conceptId: 'svc-1', code: 'svc-1', display: 'Infiltración articular', codeSystemVersionId: 'v' }],
  ['st-1', { conceptId: 'st-1', code: 'st-1', display: 'Realizada', codeSystemVersionId: 'v' }],
]);

describe('ReceivedServicesPanel', () => {
  const list = vi.fn();
  const readConceptLabels = vi.fn();
  let fixture: ComponentFixture<ReceivedServicesPanel>;

  async function mount(patientProfileId = PATIENT): Promise<HTMLElement> {
    fixture = TestBed.createComponent(ReceivedServicesPanel);
    fixture.componentRef.setInput('patientProfileId', patientProfileId);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    list.mockReset();
    readConceptLabels.mockReset().mockReturnValue(of(LABELS));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ReceivedServicesClient, useValue: { list } },
        { provide: TerminologyClient, useValue: { readConceptLabels } },
      ],
    });
  });

  it('lee los servicios del paciente con el tope y los dibuja ya traducidos', async () => {
    list.mockReturnValue(of(page([service()])));
    const root = await mount();

    expect(list).toHaveBeenCalledWith(PATIENT, 100);
    const text = root.textContent ?? '';
    expect(text).toContain('Infiltración articular');
    expect(text).toContain('Intervención médica');
    expect(text).toContain('Dra. Ana Rojas');
    expect(text).toContain('Clínica Los Olivos');
    expect(text).toContain('Realizada');
    expect(text).toContain('Sin complicaciones');
    expect(text).toContain('350.00 Bs');
    // Nada de identificadores ni de fechas ISO.
    expect(text).not.toMatch(/svc-1|st-1|type-int|2026-08/);
  });

  it('pide las etiquetas de los conceptos de lo que llegó', async () => {
    list.mockReturnValue(of(page([service()])));
    await mount();
    expect(readConceptLabels).toHaveBeenCalledWith(expect.arrayContaining(['svc-1', 'st-1']));
  });

  it('si las etiquetas fallan, el servicio igual se muestra y no hay uuid', async () => {
    list.mockReturnValue(of(page([service()])));
    readConceptLabels.mockReturnValue(throwError(() => new Error('terminología caída')));
    const text = (await mount()).textContent ?? '';
    expect(text).toContain('Servicio sin denominación');
    expect(text).toContain('Dra. Ana Rojas');
    expect(text).not.toMatch(/svc-1|st-1/);
  });

  it('sin servicios muestra el vacío con su indicación', async () => {
    list.mockReturnValue(of(page([])));
    const text = (await mount()).textContent ?? '';
    expect(text).toContain('Todavía no hay servicios recibidos en esta historia.');
    expect(text).toContain('Aparecen cuando se completa una intervención o se aplica una vacuna');
  });

  it('quien lee sin importes no ve la columna de costo ni un «sin cobro» falso', async () => {
    list.mockReturnValue(of(page([service({ cost: null })], { costsVisible: false })));
    const text = (await mount()).textContent ?? '';
    expect(text).not.toContain('Costo');
    expect(text).not.toContain('Sin cobro registrado');
  });

  it('con importes visibles, un servicio sin cobro lo dice', async () => {
    list.mockReturnValue(of(page([service({ cost: null })])));
    const text = (await mount()).textContent ?? '';
    expect(text).toContain('Costo');
    expect(text).toContain('Sin cobro registrado');
  });

  it('avisa cuando la lista quedó recortada', async () => {
    list.mockReturnValue(of(page([service()], { truncated: true })));
    const text = (await mount()).textContent ?? '';
    expect(text).toContain('Lista recortada');
    expect(text).toContain('100 servicios más recientes');
  });

  it('no avisa recorte cuando la lista está completa', async () => {
    list.mockReturnValue(of(page([service()])));
    expect((await mount()).textContent ?? '').not.toContain('Lista recortada');
  });

  it('mientras carga no muestra servicios ni el vacío', async () => {
    const pending = new Subject<ReceivedServicesPage>();
    list.mockReturnValue(pending);
    fixture = TestBed.createComponent(ReceivedServicesPanel);
    fixture.componentRef.setInput('patientProfileId', PATIENT);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).not.toContain('Todavía no hay servicios');
    expect(text).not.toContain('Infiltración');
  });

  it('un error de la lectura se queda en la pestaña y permite reintentar', async () => {
    list.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })));
    const root = await mount();
    expect(root.querySelector('[data-testid="received-services-table"]')).not.toBeNull();
    expect(root.textContent ?? '').not.toContain('Infiltración');

    list.mockReturnValue(of(page([service()])));
    const retry = Array.from(root.querySelectorAll('button')).find((button) => /reintentar/i.test(button.textContent ?? ''));
    expect(retry, 'el estado de error ofrece reintentar').toBeDefined();
    retry!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(root.textContent ?? '').toContain('Infiltración articular');
  });

  it('cambiar de paciente vuelve a leer', async () => {
    list.mockReturnValue(of(page([service()])));
    await mount('p-1');
    fixture.componentRef.setInput('patientProfileId', 'p-2');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(list).toHaveBeenLastCalledWith('p-2', 100);
  });

  it('el panel es una región con su título para lectores de pantalla', async () => {
    list.mockReturnValue(of(page([service()])));
    const root = await mount();
    const region = root.querySelector('section[aria-labelledby="received-services-title"]');
    expect(region).not.toBeNull();
    expect(root.querySelector('#received-services-title')?.textContent?.trim()).toBe('Servicios recibidos');
  });
});
