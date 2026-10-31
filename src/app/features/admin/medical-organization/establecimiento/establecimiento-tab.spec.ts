import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { CATALOGO_INFRAESTRUCTURA, SITIOS_INFRA } from '../../../../core/mock/fixtures/infraestructura';
import { MaquetaDeInfraestructura } from '../../../../../testing/maqueta-de-infraestructura';
import type { SitioElegible } from '../infraestructura/infraestructura-tab';
import { EstablecimientoTab, filasDeCapacidad } from './establecimiento-tab';

const SAN_LUCAS = SITIOS_INFRA[0]!;

@Component({
  imports: [EstablecimientoTab],
  template: `<app-establecimiento-tab [sitios]="sitios" [puedeEscribir]="escribe()" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Anfitrion {
  readonly sitios: readonly SitioElegible[] = [SAN_LUCAS];
  readonly escribe = signal(true);
}

describe('EstablecimientoTab', () => {
  let http: HttpTestingController;
  const maqueta = new MaquetaDeInfraestructura();

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });

  function montar(): HTMLElement {
    const fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();
    maqueta.responderTodo(http, () => fixture.detectChanges());
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('muestra los datos regulatorios bolivianos del establecimiento', () => {
    const raiz = montar();
    expect(raiz.textContent).toContain('701010123');
    expect(raiz.textContent).toContain('Hospital de segundo nivel');
    expect(raiz.textContent).toContain('SEDES Santa Cruz');
  });

  it('capacidad declarada vs. real con brechas contadas, no escritas', () => {
    const raiz = montar();
    const tabla = raiz.querySelector('[data-testid=estab-capacidad]')!;
    // Camas censables: declaradas 10, activas 4.
    expect(tabla.textContent).toContain('Faltan 6');
    // Quirófanos: 2 y 2.
    expect(tabla.textContent).toContain('Coincide');
    expect(raiz.querySelector('[data-testid=estab-brechas]')?.textContent).toMatch(/\d+ brecha/);
  });

  it('una habilitación vencida se ve vencida aunque se haya cargado vigente', () => {
    const raiz = montar();
    expect(raiz.querySelector('[data-testid=estab-licencias]')!.textContent).toContain('Vencida');
  });

  it('sin escritura no ofrece editar', () => {
    const fixture = TestBed.createComponent(Anfitrion);
    fixture.componentInstance.escribe.set(false);
    fixture.detectChanges();
    maqueta.responderTodo(http, () => fixture.detectChanges());
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid=estab-editar-regulatorio]')).toBeNull();
  });

  it('S9 con código de petición si la API falla', () => {
    const fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();
    http.match((r) => r.url.includes('/practice/')).forEach((r) => maqueta.responder(r));
    http.expectOne(`/sites/${SAN_LUCAS.id}/structure`).flush({ code: 'INTERNAL', message: 'x', correlationId: 'req-estab-1' }, { status: 500, statusText: 'E' });
    http.match(() => true).filter((r) => !r.cancelled).forEach((r) => r.flush({}));
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('req-estab-1');
  });

  describe('filasDeCapacidad', () => {
    it('incluye lo contado aunque no esté declarado, y ordena como el catálogo', () => {
      const filas = filasDeCapacidad(
        {
          declared: [{ kindCode: 'CAP_OPERATING_ROOMS', quantity: 3, asOf: '2026-01-01', resolutionNumber: 'R1' }],
          derived: [
            { kindCode: 'CAP_BEDS_CENSABLE', quantity: 5 },
            { kindCode: 'CAP_OPERATING_ROOMS', quantity: 2 },
            { kindCode: 'CAP_ICU_BEDS', quantity: 0 },
          ],
          gaps: [],
        },
        CATALOGO_INFRAESTRUCTURA,
      );
      expect(filas.map((f) => [f.kindCode, f.declarada, f.real, f.diferencia])).toEqual([
        ['CAP_BEDS_CENSABLE', null, 5, null],
        ['CAP_OPERATING_ROOMS', 3, 2, -1],
      ]);
    });
  });
});
