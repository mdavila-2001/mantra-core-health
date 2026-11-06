import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { NodoDeRed, ValorDeResultado } from '../red-clinica.types';
import { RedClinicaPanel } from './red-clinica-panel';

/** El estudio como lo arma el expediente: liberado, sin valores, con el id de su informe. */
const ESTUDIO: NodoDeRed = {
  id: 'ord-tsh',
  tipo: 'estudio',
  titulo: 'TSH',
  cuando: new Date(2026, 4, 15),
  detalle: { tipo: 'estudio', resultado: { liberadoEn: null, valores: [], archivos: [], informeId: 'inf-tsh' } },
};
const OTRO: NodoDeRed = { id: 'ord-2', tipo: 'estudio', titulo: 'Hemograma', cuando: null, detalle: { tipo: 'estudio', resultado: null } };

const LEIDO = {
  reportId: 'inf-tsh',
  patientProfileId: 'pac-1',
  serviceRequestId: 'ord-tsh',
  codeConceptId: 'c',
  codeDisplay: 'TSH',
  categoryConceptId: null,
  versionId: 'v',
  versionNumber: 1,
  clinicalStatusConceptId: 'st',
  issuedAt: null,
  releasedAt: '2025-05-17T16:00:00.000Z',
  patientVisible: false,
  conclusionText: 'Compatible con hipotiroidismo primario.',
  values: [
    {
      observationId: 'o-1', codeConceptId: 'c-tsh', name: 'TSH', value: '8.9', valueKind: 'QUANTITY', valueConceptId: null,
      unitConceptId: null, unit: 'mUI/L', referenceRange: { low: '0.4', high: '4.0', text: null, unitConceptId: null, unit: 'mUI/L' },
      interpretationConceptId: 'i', interpretationCode: 'H', interpretation: 'Alto', statusConceptId: 'st', effectiveAt: null,
    },
    {
      observationId: 'o-2', codeConceptId: 'c-hb', name: 'Hemoglobina', value: '13.6', valueKind: 'QUANTITY', valueConceptId: null,
      unitConceptId: null, unit: 'g/dL', referenceRange: { low: '12.0', high: '16.0', text: null, unitConceptId: null, unit: 'g/dL' },
      interpretationConceptId: null, interpretationCode: null, interpretation: null, statusConceptId: 'st', effectiveAt: null,
    },
  ],
  files: [],
};

@Component({
  imports: [RedClinicaPanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-red-clinica-panel
      presentacion="lateral"
      [nodo]="nodo()"
      [nodos]="[estudio, otro]"
      pacienteId="pac-1"
      (informeLeido)="leidos.push($event)"
      (cerrado)="nodo.set(null)"
    />
  `,
})
class Anfitrion {
  readonly estudio = ESTUDIO;
  readonly otro = OTRO;
  readonly nodo = signal<NodoDeRed | null>(null);
  readonly leidos: { informeId: string; valores: readonly ValorDeResultado[] }[] = [];
}

describe('RedClinicaPanel: el informe liberado, leído al abrir el estudio', () => {
  let fixture: ComponentFixture<Anfitrion>;
  let host: Anfitrion;
  let http: HttpTestingController;
  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const texto = () => el().querySelector('[data-testid="red-panel"]')?.textContent?.replace(/\s+/g, ' ') ?? '';
  const URL = '/diagnostics/patients/pac-1/reports/inf-tsh';

  async function pintar(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function abrir(nodo: NodoDeRed | null): Promise<void> {
    host.nodo.set(nodo);
    await pintar();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Anfitrion],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(Anfitrion);
    host = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    await pintar();
  });

  afterEach(() => http.verify());

  it('mientras lee lo dice (S1) y sigue diciendo que está liberado; nada se lee por adelantado', async () => {
    http.expectNone((r) => r.url.endsWith(URL));
    await abrir(ESTUDIO);
    const req = http.expectOne((r) => r.url.endsWith(URL));
    expect(el().querySelector('[data-testid="red-panel-informe-cargando"]')).not.toBeNull();
    expect(el().querySelector('[data-testid="red-panel-liberado"]')?.textContent).toContain('Resultado liberado');
    req.flush(LEIDO);
  });

  it('con el informe: fecha, valores con rango, el rótulo del laboratorio y el fuera de rango en texto', async () => {
    await abrir(ESTUDIO);
    http.expectOne((r) => r.url.endsWith(URL)).flush(LEIDO);
    await pintar();
    // El mes sale en el idioma del entorno (en las pruebas no se registra «es»).
    expect(texto()).toMatch(/Liberado el 17 de \S+ de 2025/);
    expect(texto()).toContain('1 valor fuera de rango');
    const filas = Array.from(el().querySelectorAll<HTMLTableRowElement>('[data-testid="red-panel-valor"]'));
    expect(filas).toHaveLength(2);
    expect(filas[0].textContent).toContain('8,9 mUI/L');
    expect(filas[0].textContent).toContain('0,4 – 4 mUI/L');
    expect(filas[0].querySelector('[data-testid="red-panel-interpretacion"]')?.textContent).toContain('Alto');
    expect(filas[0].textContent).toContain('fuera de rango');
    expect(filas[0].classList).toContain('panel__fila--fuera');
    expect(filas[1].classList).not.toContain('panel__fila--fuera');
    expect(texto()).toContain('Compatible con hipotiroidismo primario.');
    expect(host.leidos).toEqual([{ informeId: 'inf-tsh', valores: expect.any(Array) }]);
  });

  it('liberado sin publicar al paciente: lo dice', async () => {
    await abrir(ESTUDIO);
    http.expectOne((r) => r.url.endsWith(URL)).flush(LEIDO);
    await pintar();
    expect(el().querySelector('[data-testid="red-panel-sin-publicar"]')?.textContent).toContain('Liberado sin publicar al paciente');
  });

  it('un 404 dice que no está disponible (S6), sin borrar que estaba liberado', async () => {
    await abrir(ESTUDIO);
    http
      .expectOne((r) => r.url.endsWith(URL))
      .flush({ code: 'NOT_FOUND', message: 'x', reason: 'DIAGNOSTICS_RESOURCE_NOT_AVAILABLE' }, { status: 404, statusText: 'Not Found' });
    await pintar();
    expect(el().querySelector('[data-testid="red-panel-informe-error"]')?.textContent).toContain('El informe no está disponible');
    expect(el().querySelector('[data-testid="red-panel-liberado"]')).not.toBeNull();
  });

  it('un 500 muestra el id de petición (S9) y «Reintentar» vuelve a leer', async () => {
    await abrir(ESTUDIO);
    http.expectOne((r) => r.url.endsWith(URL)).flush({}, { status: 500, statusText: 'Error', headers: { 'x-request-id': 'req-9' } });
    await pintar();
    expect(texto()).toContain('Código de soporte');
    const reintentar = Array.from(el().querySelectorAll<HTMLElement>('[data-testid="red-panel-informe-error"] button')).find((b) =>
      b.textContent?.includes('Reintentar'),
    )!;
    reintentar.click();
    await pintar();
    http.expectOne((r) => r.url.endsWith(URL)).flush(LEIDO);
    await pintar();
    expect(el().querySelectorAll('[data-testid="red-panel-valor"]')).toHaveLength(2);
  });

  it('cambiar a otro nodo cancela la lectura en curso; volver lee de nuevo', async () => {
    await abrir(ESTUDIO);
    const primera = http.expectOne((r) => r.url.endsWith(URL));
    await abrir(OTRO);
    expect(primera.cancelled).toBe(true);
    await abrir(ESTUDIO);
    http.expectOne((r) => r.url.endsWith(URL)).flush(LEIDO);
  });
});
