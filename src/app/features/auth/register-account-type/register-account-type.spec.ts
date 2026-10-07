import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';

import { RegisterAccountType } from './register-account-type';

/**
 * Lo que esta pantalla promete es **que las puertas abren**. Por eso lo que se
 * prueba es a dónde llevan las tarjetas y que sean enlaces de verdad: si el
 * destino se escribe mal, el fallo no es una excepción sino un 404 al final de
 * una decisión que la persona ya tomó.
 */
describe('RegisterAccountType', () => {
  let fixture: ComponentFixture<RegisterAccountType>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegisterAccountType],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(RegisterAccountType);
    await fixture.whenStable();
  });

  function tarjetas(): HTMLAnchorElement[] {
    return fixture.debugElement
      .queryAll(By.css('.tipos__card'))
      .map((el) => el.nativeElement as HTMLAnchorElement);
  }

  it('ofrece las dos cuentas de persona, y ninguna organización', () => {
    const titulos = tarjetas().map((card) =>
      card.querySelector('.tipos__card-title')!.textContent!.trim(),
    );

    // Sin «Otro»: una tarjeta que no lleva a ningún lado deja sin opción a quien
    // ya eligió la suya.
    // «Médico» y no «Doctor» (F2 del plan de UX del 22/08/2026): en toda la
    // superficie que ve un paciente o un profesional se dice «médico».
    // Las organizaciones viven en «Registrá tu organización» del acceso.
    expect(titulos).toEqual(['Paciente', 'Médico']);
  });

  it('cada tarjeta lleva a su alta', () => {
    const destinos = tarjetas().map((card) => card.getAttribute('href'));

    expect(destinos).toEqual(['/auth/register/patient', '/auth/register/practitioner']);
  });

  it('son enlaces, no botones', () => {
    // Un botón con `navigate()` hace lo mismo al hacer clic y pierde todo lo
    // demás: abrir en otra pestaña, copiar la dirección, el anuncio de «enlace».
    for (const tarjeta of tarjetas()) {
      expect(tarjeta.tagName).toBe('A');
    }
  });

  it('la rejilla es una lista: el lector anuncia cuántas opciones hay antes de leerlas', () => {
    const items = fixture.debugElement.queryAll(By.css('.tipos__grid > li'));

    expect(items).toHaveLength(2);
  });

  it('deja volver a iniciar sesión', () => {
    expect(
      fixture.debugElement.query(By.css('[data-testid="tipos-ir-login"]')),
    ).not.toBeNull();
  });
});

describe('RegisterAccountType · organizaciones', () => {
  let fixture: ComponentFixture<RegisterAccountType>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegisterAccountType],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { data: { audience: 'organizations' } } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RegisterAccountType);
    await fixture.whenStable();
  });

  function tarjetas(): HTMLAnchorElement[] {
    return fixture.debugElement
      .queryAll(By.css('.tipos__card'))
      .map((el) => el.nativeElement as HTMLAnchorElement);
  }

  it('ofrece las cuatro organizaciones que tienen alta, y ninguna cuenta de persona', () => {
    const titulos = tarjetas().map((card) =>
      card.querySelector('.tipos__card-title')!.textContent!.trim(),
    );

    // `register-organization` crea un tenant PAYER y sólo ése: por eso la
    // tarjeta dice «Aseguradora» y no «Organización».
    expect(titulos).toEqual(['Aseguradora', 'Laboratorio', 'Imagenología', 'Farmacia']);
  });

  it('cada tarjeta lleva a su alta', () => {
    const destinos = tarjetas().map((card) => card.getAttribute('href'));

    expect(destinos).toEqual([
      '/auth/register/organization',
      '/auth/register/laboratory',
      '/auth/register/imaging-center',
      '/auth/register/pharmacy',
    ]);
  });

  it('titula la pantalla como el alta de una organización', () => {
    const titulo = fixture.debugElement.query(By.css('.tipos__title')).nativeElement as HTMLElement;

    expect(titulo.textContent).toContain('Registrá tu organización');
  });
});
