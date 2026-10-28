import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { InsurerPractitionerRequests } from './practitioner-requests';

/**
 * La bandeja de la aseguradora. Fija que decidir escribe en la API y relee
 * —lo que queda es lo guardado—, que el motivo viaja recortado y que un 422
 * (ya decidida o retirada) se dice con palabras.
 */
describe('InsurerPractitionerRequests', () => {
  let fixture: ComponentFixture<InsurerPractitionerRequests>;
  let http: HttpTestingController;
  const URL = '/insurance/practitioner-requests';

  const PENDIENTE = {
    id: 'r-1',
    practitionerProfileId: 'p-1',
    practitionerName: 'Dra. Ana Rojas',
    professionalTitle: 'Médica cardióloga',
    status: 'PENDING',
    decisionReasonText: null,
    createdAt: '2026-10-25T10:00:00Z',
    decidedAt: null,
  };

  function montar(filas: unknown[] = [PENDIENTE]): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(InsurerPractitionerRequests);
    fixture.detectChanges();
    http.expectOne(URL).flush({ items: filas, count: filas.length });
    fixture.detectChanges();
  }

  function porTestId(id: string): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${id}"]`);
  }

  afterEach(() => http.verify());

  it('muestra quién pide, desde cuándo y su estado', () => {
    montar();
    const fila = porTestId('aseguradora-pedido-r-1')!;
    expect(fila.textContent).toContain('Dra. Ana Rojas');
    expect(fila.textContent).toContain('Médica cardióloga');
    expect(fila.textContent).toContain('Pendiente');
  });

  it('aprobar escribe y relee: el sello queda porque la API lo devolvió', () => {
    montar();
    (porTestId('aseguradora-aprobar') as HTMLButtonElement).click();
    const aprobacion = http.expectOne(`${URL}/r-1/approve`);
    expect(aprobacion.request.method).toBe('POST');
    aprobacion.flush({ ...PENDIENTE, status: 'APPROVED' });
    http.expectOne(URL).flush({
      items: [{ ...PENDIENTE, status: 'APPROVED', decidedAt: '2026-10-28T10:00:00Z' }],
      count: 1,
    });
    fixture.detectChanges();

    expect(porTestId('aseguradora-pedido-r-1')?.textContent).toContain('Aprobada');
    expect(porTestId('aseguradora-aprobar')).toBeNull();
    expect(porTestId('aseguradora-pedidos-aviso')?.textContent).toContain('Se aprobó');
  });

  it('rechazar manda el motivo escrito, recortado', () => {
    montar();
    (porTestId('aseguradora-rechazar') as HTMLButtonElement).click();
    fixture.detectChanges();
    (fixture.componentInstance as unknown as { motivo: { set(v: string): void } }).motivo.set(
      '  Sin convenio vigente  ',
    );
    (porTestId('aseguradora-confirmar-rechazo') as HTMLButtonElement).click();

    const rechazo = http.expectOne(`${URL}/r-1/reject`);
    expect(rechazo.request.body).toEqual({ reason: 'Sin convenio vigente' });
    rechazo.flush({ ...PENDIENTE, status: 'REJECTED' });
    http.expectOne(URL).flush({
      items: [{ ...PENDIENTE, status: 'REJECTED', decisionReasonText: 'Sin convenio vigente' }],
      count: 1,
    });
    fixture.detectChanges();

    expect(porTestId('aseguradora-pedido-r-1')?.textContent).toContain('«Sin convenio vigente»');
  });

  it('un 422 dice que ya fue decidida y relee: la fila deja de ofrecer decidir', () => {
    montar();
    (porTestId('aseguradora-aprobar') as HTMLButtonElement).click();
    http
      .expectOne(`${URL}/r-1/approve`)
      .flush({ message: 'ya decidida' }, { status: 422, statusText: 'Unprocessable' });
    http.expectOne(URL).flush({ items: [{ ...PENDIENTE, status: 'WITHDRAWN' }], count: 1 });
    fixture.detectChanges();

    expect(porTestId('aseguradora-pedidos-aviso')?.textContent).toContain('ya fue decidida');
    expect(porTestId('aseguradora-pedido-r-1')).not.toBeNull();
    expect(porTestId('aseguradora-aprobar')).toBeNull();
  });

  it('decisión guardada y relectura caída: dice que se guardó, no que falló', () => {
    montar();
    (porTestId('aseguradora-aprobar') as HTMLButtonElement).click();
    http.expectOne(`${URL}/r-1/approve`).flush({ ...PENDIENTE, status: 'APPROVED' });
    http.expectOne(URL).flush(null, { status: 500, statusText: 'Error' });
    fixture.detectChanges();

    const aviso = porTestId('aseguradora-pedidos-aviso')?.textContent ?? '';
    expect(aviso).toContain('Se aprobó la solicitud de Dra. Ana Rojas.');
    expect(aviso).toContain('recárguela');
    expect(aviso).not.toContain('No pudimos guardar');
  });

  it('separa lo que espera decisión de lo ya decidido', () => {
    montar([
      PENDIENTE,
      { ...PENDIENTE, id: 'r-2', status: 'REJECTED', decisionReasonText: 'Sin convenio' },
    ]);
    expect(porTestId('aseguradora-grupo-por-decidir')?.textContent).toContain('Dra. Ana Rojas');
    expect(porTestId('aseguradora-grupo-por-decidir')?.querySelectorAll('li')).toHaveLength(1);
    expect(porTestId('aseguradora-grupo-decididas')?.textContent).toContain('«Sin convenio»');
  });

  it('sin solicitudes, el vacío ofrece volver a «Solicitudes recibidas»', () => {
    montar([]);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Ningún profesional pidió todavía',
    );
  });
});
