import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DependentFormDialog } from './dependent-form-dialog';

/**
 * El alta de un dependiente pide sólo el CI.
 *
 * Lo que fija: no hay más campos; el CI viaja solo; «no hay cuenta» se dice
 * junto al campo; y al enviarse avisa a la pantalla con el CI.
 */
describe('DependentFormDialog', () => {
  let fixture: ComponentFixture<DependentFormDialog>;
  let http: HttpTestingController;
  let host: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(DependentFormDialog);
    fixture.detectChanges();
    host = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => http.verify());

  function escribirCi(valor: string): void {
    const campo = host.querySelector<HTMLInputElement>('input')!;
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function enviar(): void {
    host.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  it('tiene un solo campo: el CI', () => {
    expect(host.querySelectorAll('input, select, textarea').length).toBe(1);
    expect(host.textContent).toContain('CI');
    expect(host.textContent).not.toContain('Fecha de nacimiento');
    expect(host.textContent).not.toContain('Primer nombre');
  });

  it('sin CI no sale a la red', () => {
    enviar();
    http.expectNone('/profiles/patients/me/dependent-requests');
    expect(host.textContent).toContain('Escribí el CI de la persona.');
  });

  it('envía sólo el CI y avisa con él al terminar', () => {
    const enviados: string[] = [];
    fixture.componentInstance.sent.subscribe((ci) => enviados.push(ci));

    escribirCi(' 5009871 ');
    enviar();

    const peticion = http.expectOne('/profiles/patients/me/dependent-requests');
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({ nationalId: '5009871' });
    peticion.flush({ id: 'sol-1', status: 'PENDING' }, { status: 201, statusText: 'Created' });

    expect(enviados).toEqual(['5009871']);
  });

  it('si no hay cuenta con ese CI lo dice junto al campo', () => {
    escribirCi('1234567');
    enviar();

    http
      .expectOne('/profiles/patients/me/dependent-requests')
      .flush(
        {
          statusCode: 404,
          code: 'NOT_FOUND',
          message: 'No hay ninguna cuenta registrada con ese CI.',
          error: 'Not Found',
        },
        { status: 404, statusText: 'Not Found' },
      );
    fixture.detectChanges();

    expect(host.textContent).toContain('No hay ninguna cuenta registrada con ese CI.');
  });
});
