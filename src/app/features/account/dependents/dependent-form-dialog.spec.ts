import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DependentFormDialog } from './dependent-form-dialog';

/**
 * El alta de un dependiente: por CI (un solo campo) o buscándolo por nombre.
 *
 * Lo que fija: por CI no hay más campos y el CI viaja solo; «no hay cuenta» se
 * dice junto al campo; por nombre se busca desde tres letras, se elige una
 * cuenta y se envía con su perfil; y al enviarse avisa a la pantalla a quién.
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
    fixture.componentInstance.sent.subscribe((envio) => enviados.push(envio.destinatario));

    escribirCi(' 5009871 ');
    enviar();

    const peticion = http.expectOne('/profiles/patients/me/dependent-requests');
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({ nationalId: '5009871' });
    peticion.flush({ id: 'sol-1', status: 'PENDING' }, { status: 201, statusText: 'Created' });

    expect(enviados).toEqual(['la cuenta con CI 5009871']);
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
  describe('por nombre', () => {
    const CANDIDATOS = [
      { patientProfileId: 'pac-1', displayName: 'Ana Lucía Pérez', maskedNationalId: '••••871' },
      { patientProfileId: 'pac-2', displayName: 'Ana María Rojas' },
    ];

    function pasarAPorNombre(): void {
      host.querySelector<HTMLButtonElement>('[data-testid="segmentado-nombre"]')!.click();
      fixture.detectChanges();
    }

    function escribirNombre(valor: string): void {
      const campo = host.querySelector<HTMLInputElement>('[data-testid="dependent-name-search"] input')!;
      campo.value = valor;
      campo.dispatchEvent(new Event('input'));
      campo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      fixture.detectChanges();
    }

    function candidatos(): HTMLButtonElement[] {
      return Array.from(host.querySelectorAll<HTMLButtonElement>('[data-testid="dependent-candidate"]'));
    }

    it('cambia el campo del CI por el buscador y no deja enviar sin elegir a nadie', () => {
      pasarAPorNombre();

      expect(host.querySelector('[data-testid="dependent-national-id"]')).toBeNull();
      expect(host.querySelector('[data-testid="dependent-name-search"]')).not.toBeNull();
      expect(host.textContent).toContain('Escribí al menos 3 letras');
      expect(host.querySelector('[data-testid="dependent-submit"]')!.getAttribute('aria-disabled')).toBe('true');

      enviar();
      http.expectNone('/profiles/patients/me/dependent-requests');
    });

    it('con menos de tres letras no sale a la red', () => {
      pasarAPorNombre();
      escribirNombre('an');
      http.expectNone((r) => r.url.includes('dependent-candidates'));
    });

    it('busca, muestra las cuentas y envía la solicitud con el perfil elegido', () => {
      const enviados: string[] = [];
      fixture.componentInstance.sent.subscribe((envio) => enviados.push(envio.destinatario));
      pasarAPorNombre();

      escribirNombre('Ana');
      const busqueda = http.expectOne((r) => r.url.includes('dependent-candidates'));
      expect(busqueda.request.params.get('q')).toBe('Ana');
      busqueda.flush(CANDIDATOS);
      fixture.detectChanges();

      expect(candidatos().map((c) => c.textContent)).toEqual([
        expect.stringContaining('Ana Lucía Pérez'),
        expect.stringContaining('Ana María Rojas'),
      ]);
      expect(candidatos()[0]!.textContent).toContain('CI ••••871');
      expect(host.textContent).toContain('2 cuentas encontradas');

      candidatos()[0]!.click();
      fixture.detectChanges();
      expect(candidatos()[0]!.getAttribute('aria-checked')).toBe('true');
      expect(candidatos()[1]!.getAttribute('aria-checked')).toBe('false');

      enviar();
      const peticion = http.expectOne('/profiles/patients/me/dependent-requests');
      expect(peticion.request.body).toEqual({ patientProfileId: 'pac-1' });
      peticion.flush({ id: 'sol-1', status: 'PENDING' }, { status: 201, statusText: 'Created' });

      expect(enviados).toEqual(['Ana Lucía Pérez']);
    });

    it('sin coincidencias lo dice y sugiere el CI', () => {
      pasarAPorNombre();
      escribirNombre('Zzzz');
      http.expectOne((r) => r.url.includes('dependent-candidates')).flush([]);
      fixture.detectChanges();

      expect(candidatos().length).toBe(0);
      expect(host.textContent).toContain('No encontramos ninguna cuenta con ese nombre');
    });

    it('si la búsqueda falla lo dice, y no deja nada elegido', () => {
      pasarAPorNombre();
      escribirNombre('Ana');
      http
        .expectOne((r) => r.url.includes('dependent-candidates'))
        .flush({}, { status: 500, statusText: 'Server Error' });
      fixture.detectChanges();

      expect(host.textContent).toContain('No pudimos buscar en este momento');
      expect(host.querySelector('[data-testid="dependent-submit"]')!.getAttribute('aria-disabled')).toBe('true');
    });

    it('un error al enviar se dice arriba, no junto a un campo que no está', () => {
      pasarAPorNombre();
      escribirNombre('Ana');
      http.expectOne((r) => r.url.includes('dependent-candidates')).flush(CANDIDATOS);
      fixture.detectChanges();
      candidatos()[1]!.click();
      fixture.detectChanges();

      enviar();
      http
        .expectOne('/profiles/patients/me/dependent-requests')
        .flush(
          { statusCode: 409, code: 'CONFLICT', message: 'Ya le enviaste una solicitud a esa persona. Falta que la acepte.', error: 'Conflict' },
          { status: 409, statusText: 'Conflict' },
        );
      fixture.detectChanges();

      expect(host.querySelector('app-alert')?.textContent).toContain('Ya le enviaste una solicitud');
    });
  });
});
