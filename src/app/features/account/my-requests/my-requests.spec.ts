import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { MyClaimsView } from '@core/data-access/insurance/insurance.types';

import { MyRequests } from './my-requests';

/**
 * «Mis solicitudes». Lo que se fija: abre en «Decisiones de la aseguradora»
 * con lo decidido y su motivo; lo abierto vive en la otra pestaña; la columna
 * de la contraparte cambia con el lado; el vacío dice por qué; y el buscador
 * acota.
 */

interface WireClaim {
  readonly id: string;
  readonly claimIdentifier: string;
  readonly patientName: string | null;
  readonly practitioner: { readonly displayName: string; readonly specialty: string | null };
  readonly providerName: string;
  readonly service: { readonly code: string; readonly display: string };
  readonly additionalServiceCount: number;
  readonly billedTotal: { readonly amount: string; readonly currency: { code: string; display: string } };
  readonly approvedTotal: { readonly amount: string; readonly currency: { code: string; display: string } } | null;
  readonly submittedAt: string;
  readonly serviceDate: string;
  readonly insurerName: string;
  readonly planName: string;
  readonly status: { readonly code: string; readonly display: string };
  readonly decision: { readonly outcome: string; readonly decidedAt: string; readonly reason: string | null } | null;
}

const BOB = { code: 'BOB', display: 'Boliviano' };

function claim(
  n: number,
  servicio: string,
  decision: WireClaim['decision'],
  paciente: string | null = 'Juan Mamani',
): WireClaim {
  const outcome = decision?.outcome ?? null;
  return {
    id: `c-${n}`,
    claimIdentifier: `CLM-2026-${1000 + n}`,
    patientName: paciente,
    practitioner: { displayName: 'Dra. Valeria Rojas Mendoza', specialty: 'Cardiología' },
    providerName: 'Consultorio Dra. Rojas',
    service: { code: `SVC_${n}`, display: servicio },
    additionalServiceCount: 0,
    billedTotal: { amount: '250.00', currency: BOB },
    approvedTotal:
      outcome === null ? null : { amount: outcome === 'REJECTED' ? '0.00' : '125.00', currency: BOB },
    submittedAt: new Date().toISOString(),
    serviceDate: new Date().toISOString().slice(0, 10),
    insurerName: 'Seguros Andina',
    planName: 'Seguros Andina · Plan Integral',
    status: outcome === null ? { code: 'IN_REVIEW', display: 'En revisión' } : { code: outcome, display: outcome },
    decision,
  };
}

const RECHAZO = { outcome: 'REJECTED', decidedAt: new Date().toISOString(), reason: 'El plan no cubre este servicio.' };
const PARCIAL = { outcome: 'PARTIAL', decidedAt: new Date().toISOString(), reason: 'El plan cubre la mitad.' };

describe('MyRequests', () => {
  let fixture: ComponentFixture<MyRequests>;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MyRequests],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MyRequests);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function responder(view: MyClaimsView, items: WireClaim[]): void {
    http.expectOne((r) => r.url.endsWith('/insurance/my-claims')).flush({ view, items, truncated: false });
    fixture.detectChanges();
  }

  function texto(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function pestanas(): HTMLButtonElement[] {
    return [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  }

  it('abre en «Decisiones de la aseguradora» con lo decidido, y lo abierto queda en la otra pestaña', () => {
    responder('PATIENT', [
      claim(1, 'Ecografía', RECHAZO, null),
      claim(2, 'Hemograma completo', PARCIAL, null),
      claim(3, 'Consulta de especialidad', null, null),
    ]);
    const [decididas, espera] = pestanas();
    expect(decididas!.textContent).toContain('Decisiones de la aseguradora (2)');
    expect(decididas!.getAttribute('aria-selected')).toBe('true');
    expect(espera!.textContent).toContain('En espera de decisión (1)');
    expect(texto()).toContain('Rechazada');
    expect(texto()).toContain('Aprobada en parte');
    expect(texto()).not.toContain('Consulta de especialidad');

    espera!.click();
    fixture.detectChanges();
    expect(texto()).toContain('Consulta de especialidad');
    expect(texto()).toContain('En revisión');
    expect(texto()).not.toContain('Ecografía');
  });

  it('«Ver decisión» muestra el motivo de la aseguradora', () => {
    responder('PATIENT', [claim(1, 'Ecografía', RECHAZO, null)]);
    const componente = fixture.componentInstance as unknown as {
      ejecutarAccion(codigo: string, fila: unknown): void;
      decididas(): readonly unknown[];
    };
    componente.ejecutarAccion('ver', componente.decididas()[0]);
    fixture.detectChanges();
    const motivo = document.querySelector('[data-testid="mis-solicitudes-motivo"]');
    expect(motivo?.textContent).toContain('El plan no cubre este servicio.');
  });

  it('la columna de la contraparte cambia con el lado', () => {
    responder('PRACTITIONER', [claim(1, 'Ecografía', RECHAZO, 'Juan Mamani')]);
    const encabezados = [...(fixture.nativeElement as HTMLElement).querySelectorAll('th')].map((th) => th.textContent?.trim());
    expect(encabezados).toContain('Paciente');
    expect(texto()).toContain('Juan Mamani');
  });

  it('la vista del paciente nombra al médico, no a sí mismo', () => {
    responder('PATIENT', [claim(1, 'Ecografía', RECHAZO, null)]);
    const encabezados = [...(fixture.nativeElement as HTMLElement).querySelectorAll('th')].map((th) => th.textContent?.trim());
    expect(encabezados).toContain('Médico');
    expect(texto()).toContain('Dra. Valeria Rojas Mendoza');
  });

  it('una cuenta que no presenta solicitudes ve un vacío que dice por qué', () => {
    responder('NONE', []);
    expect(texto()).toContain('Tu cuenta no presenta solicitudes a aseguradoras');
  });

  it('el buscador acota por motivo', () => {
    responder('LABORATORY', [claim(1, 'Ecografía', RECHAZO), claim(2, 'Hemograma completo', PARCIAL)]);
    const componente = fixture.componentInstance as unknown as {
      onFiltrosCambiaron(activos: Record<string, string>): void;
      totalFiltrado(): number;
    };
    componente.onFiltrosCambiaron({ q: 'mitad' });
    expect(componente.totalFiltrado()).toBe(1);
  });
});
