import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { resolverEstadosDeCaso } from '../../../../testing/case-status';
import { MyProfile } from './my-profile';

/**
 * «Mi perfil» **con la verificación de identidad ofrecida**.
 *
 * ## Qué fija, y por qué hace falta
 *
 * El archivo de al lado fija lo que se ve con `VERIFICACION_DE_IDENTIDAD_OFRECIDA`
 * apagada, que es como se despliega hoy. Éste fija lo que vuelve cuando se
 * encienda: la ficha lateral con su lectura, la fila del código anunciada como
 * pendiente y la invitación al trámite. Apagar una función sin una prueba del
 * estado encendido convierte el interruptor en un borrado con más pasos, porque
 * nadie puede comprobar que lo que vuelve es lo que se apagó.
 *
 * ## Por qué se escribe el campo en vez de reemplazar el módulo
 *
 * Lo natural sería sustituir la constante al cargarla, pero este corredor no lo
 * admite: `vi.mock` sobre una ruta relativa falla con «The "vi.mock" and related
 * methods are not supported for relative imports with the Angular unit-test
 * system. Please use Angular TestBed for mocking dependencies.». La constante no
 * entra por inyección —es un `import` directo—, así que tampoco hay proveedor
 * que sustituir.
 *
 * Queda escribir el campo que la pantalla copia de ella, y **volver a leer**:
 * `cargarCasos()` decide en el constructor, así que encender el interruptor
 * después de montar no basta; hace falta el mismo `recargar()` que dispara el
 * botón de reintento. Eso es también lo que la prueba deja fijado: la decisión
 * se toma al leer, no al pintar.
 */
const ESTADO = '22222222-2222-4222-8222-222222222222';

/** Quien todavía no verificó: la API no le manda el código. */
const RESUMEN_SIN_VERIFICAR = {
  personId: 'p-1',
  patientProfileId: 'pp-1',
  displayName: 'Ana Salas',
  birthDate: '1985-03-14',
  personStatus: ESTADO,
  identityVerified: false,
};

describe('MyProfile · con la verificación ofrecida', () => {
  let fixture: ComponentFixture<MyProfile>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyProfile],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(MyProfile);
    http = TestBed.inject(HttpTestingController);
    resolverEstadosDeCaso(http);
    fixture.detectChanges();

    // El montaje inicial corre con el interruptor real —apagado—: se responde su
    // resumen para dejar la pantalla limpia antes de encenderlo.
    responderSinVerificar();
    http.expectNone('/identity/me/verification-cases');
  });

  afterEach(() => http.verify());

  /** Responde el resumen de quien no verificó, y el catálogo de su estado. */
  function responderSinVerificar(): void {
    // La tarjeta pide además el perfil completo, para mostrar los datos que la
    // persona declaró. Ninguna prueba de este archivo lo afirma —miran el
    // interruptor de verificación—, pero sin responderlo `verify()` protesta.
    for (const req of http.match('/profiles/patients/me')) {
      req.flush({
        personId: 'per-1',
        patientProfileId: 'pp-1',
        identityVerified: false,
        coverages: [],
        guardians: [],
      });
    }
    http.expectOne('/profiles/patients/me/summary').flush(RESUMEN_SIN_VERIFICAR);
    http
      .expectOne((r) => r.url === '/terminology/concepts')
      .flush({
        items: [
          { conceptId: ESTADO, code: 'ACTIVE', display: 'Activa', codeSystemVersionId: 'c-1' },
        ],
        count: 1,
        limit: 50,
      });
    fixture.detectChanges();
  }

  /**
   * Enciende el interruptor y vuelve a leer, que es lo que hará el día que la
   * constante valga `true` desde el arranque.
   */
  function encenderYReleer(): void {
    (fixture.componentInstance as unknown as Record<string, boolean>)['verificacionOfrecida'] =
      true;
    (fixture.componentInstance as unknown as Record<string, () => void>)['recargar']();
  }

  it('vuelve a pedir el historial de verificaciones', () => {
    encenderYReleer();

    const req = http.expectOne('/identity/me/verification-cases');
    expect(req.request.method).toBe('GET');
    req.flush([]);

    responderSinVerificar();
  });

  it('sin verificar, el código se anuncia pendiente y se invita al trámite', () => {
    encenderYReleer();
    http.expectOne('/identity/me/verification-cases').flush([]);
    responderSinVerificar();

    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelector('[data-testid="mi-perfil-codigo"]')?.textContent?.trim()).toBe(
      'Pendiente de verificación',
    );

    const invitacion = raiz.querySelector<HTMLAnchorElement>(
      '.mi-perfil__principal p.mi-perfil__nota a',
    );
    expect(invitacion?.textContent?.trim()).toBe(
      'Verificá tu identidad para ver tu código de paciente',
    );
    expect(invitacion?.getAttribute('href')).toBe('/my-account/identity/verify');
  });

  /** Y la ficha lateral, que es lo que el interruptor apaga entero. */
  it('vuelve la ficha «Verificación de identidad» del lateral', () => {
    encenderYReleer();
    http.expectOne('/identity/me/verification-cases').flush([]);
    responderSinVerificar();

    const lateral = (fixture.nativeElement as HTMLElement).querySelector('.mi-perfil__lateral');
    expect(lateral?.textContent).toContain('Verificación de identidad');
    expect(lateral?.textContent).toContain('Todavía no iniciaste ninguna verificación');
  });
});
