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

  it('mientras lee (S2) muestra el esqueleto de la tabla y lo anuncia; nada se lee por adelantado', async () => {
    http.expectNone((r) => r.url.endsWith(URL));
    await abrir(ESTUDIO);
    const req = http.expectOne((r) => r.url.endsWith(URL));
    const cargando = el().querySelector('[data-testid="red-panel-informe-cargando"]');
    expect(cargando?.getAttribute('role')).toBe('status');
    expect(cargando?.textContent).toContain('Leyendo los valores del informe…');
    expect(cargando?.querySelectorAll('.estado__fila app-skeleton').length).toBe(12);
    // «Resultado liberado» is said only once the read succeeded.
    expect(el().querySelector('[data-testid="red-panel-liberado"]')).toBeNull();
    req.flush(LEIDO);
    await pintar();
    expect(el().querySelector('[data-testid="red-panel-informe-cargando"]')).toBeNull();
    expect(el().querySelector('[data-testid="red-panel-liberado"]')).not.toBeNull();
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

  it.each([
    [404, 'NOT_FOUND', 'El informe no está disponible'],
    [403, 'FORBIDDEN', 'No puede ver este informe'],
  ])('un %i lo dice, sin «Resultado liberado», y «Volver a la red» cierra el panel', async (status, code, titulo) => {
    await abrir(ESTUDIO);
    http.expectOne((r) => r.url.endsWith(URL)).flush({ code, message: 'x' }, { status, statusText: 'x' });
    await pintar();
    expect(el().querySelector('[data-testid="red-panel-informe-error"]')?.textContent).toContain(titulo);
    expect(el().querySelector('[data-testid="red-panel-liberado"]')).toBeNull();
    el().querySelector<HTMLElement>('[data-testid="red-panel-volver"]')!.click();
    await pintar();
    expect(el().querySelector('[data-testid="red-panel"]')).toBeNull();
  });

  it('ningún error deja «Resultado liberado» debajo de su tarjeta', async () => {
    await abrir(ESTUDIO);
    http.expectOne((r) => r.url.endsWith(URL)).flush({}, { status: 500, statusText: 'Error', headers: { 'x-request-id': 'req-9' } });
    await pintar();
    expect(el().querySelector('[data-testid="red-panel-informe-error"]')).not.toBeNull();
    expect(el().querySelector('[data-testid="red-panel-liberado"]')).toBeNull();
    expect(el().querySelector('[data-testid="red-panel-volver"]')).toBeNull();
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

  it('un 429 (S4) lo dice con texto propio, cuánto esperar, y ofrece reintentar pasada la espera', async () => {
    await abrir(ESTUDIO);
    http
      .expectOne((r) => r.url.endsWith(URL))
      .flush({ code: 'RATE_LIMITED', message: 'Too many requests' }, { status: 429, statusText: 'Too Many Requests', headers: { 'retry-after': '30' } });
    await pintar();
    const aviso = el().querySelector('[data-testid="red-panel-informe-error"]');
    expect(aviso?.textContent).toContain('Demasiadas lecturas seguidas');
    expect(aviso?.textContent).toContain('Reintente en 30 segundos');
    expect(aviso?.textContent).not.toContain('Too many requests');
    Array.from(aviso!.querySelectorAll<HTMLElement>('button')).find((b) => b.textContent?.includes('Reintentar'))!.click();
    await pintar();
    http.expectOne((r) => r.url.endsWith(URL)).flush(LEIDO);
    await pintar();
    expect(el().querySelectorAll('[data-testid="red-panel-valor"]')).toHaveLength(2);
  });

  it('un 422 (S4) no muestra el mensaje ajeno del servidor ni reintenta a ciegas: texto propio, código y «Volver a la red»', async () => {
    await abrir(ESTUDIO);
    http.expectOne((r) => r.url.endsWith(URL)).flush(
      {
        code: 'VALIDATION_FAILED',
        message: 'Error de validación.',
        correlationId: 'req-422',
        details: { fields: [{ field: 'medicationConceptId', constraints: ['isNotEmpty'], messages: ['Elija un medicamento del catálogo.'] }] },
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    await pintar();
    const aviso = el().querySelector<HTMLElement>('[data-testid="red-panel-informe-error"]')!;
    const dice = aviso.textContent!.replace(/\s+/g, ' ');
    expect(dice).toContain('El servidor rechazó la lectura de este informe');
    expect(dice).not.toContain('Elija un medicamento del catálogo');
    expect(dice).not.toContain('Error de validación');
    expect(dice).toContain('Código de soporte: req-422');
    expect(Array.from(aviso.querySelectorAll('button')).map((b) => b.textContent?.trim())).toEqual(['Volver a la red']);
    expect(el().querySelector('[data-testid="red-panel-liberado"]')).toBeNull();
    el().querySelector<HTMLElement>('[data-testid="red-panel-volver"]')!.click();
    await pintar();
    http.expectNone((r) => r.url.endsWith(URL));
    expect(el().querySelector('[data-testid="red-panel"]')).toBeNull();
  });

  it('una referencia nueva del mismo nodo no le quita el foco a quien lo tiene', async () => {
    await abrir(ESTUDIO);
    http.expectOne((r) => r.url.endsWith(URL)).flush(LEIDO);
    await pintar();
    const otro = document.createElement('button');
    document.body.appendChild(otro);
    otro.focus();
    await abrir({ ...ESTUDIO });
    expect(document.activeElement).toBe(otro);
    otro.remove();
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
