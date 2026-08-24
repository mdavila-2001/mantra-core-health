import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';

import { RegisterAccountType } from './register-account-type';

/**
 * Lo que esta pantalla promete es **que las tres puertas abren**. Por eso lo que
 * se prueba es a dónde llevan las tarjetas y que sean enlaces de verdad: si el
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

  it('ofrece las tres cuentas que tienen alta pública, y ninguna más', () => {
    const titulos = tarjetas().map((card) =>
      card.querySelector('.tipos__card-title')!.textContent!.trim(),
    );

    // Sin «Otro»: la API no tiene una cuarta alta pública, y una tarjeta que no
    // lleva a ningún lado deja sin opción a quien ya eligió la suya.
    // «Médico» y no «Doctor» (F2 del plan de UX del 22/08/2026): en toda la
    // superficie que ve un paciente o un profesional se dice «médico».
    expect(titulos).toEqual(['Paciente', 'Médico', 'Aseguradora']);
  });

  it('cada tarjeta lleva a su alta', () => {
    const destinos = tarjetas().map((card) => card.getAttribute('href'));

    expect(destinos).toEqual([
      '/auth/register/patient',
      '/auth/register/practitioner',
      '/auth/register/organization',
    ]);
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

    expect(items).toHaveLength(3);
  });

  it('dice «Aseguradora», que es lo que el alta crea de verdad', () => {
    const aseguradora = fixture.debugElement.query(By.css('[data-testid="tipo-aseguradora"]'))
      .nativeElement as HTMLElement;

    // `register-organization` crea un tenant PAYER y sólo ése: llamarla
    // «Organización» prometería clínicas y farmacias que todavía no entran.
    expect(aseguradora.textContent).toContain('Aseguradora');
    expect(aseguradora.textContent).not.toContain('Organización');
  });

  it('deja volver a iniciar sesión', () => {
    expect(
      fixture.debugElement.query(By.css('[data-testid="tipos-ir-login"]')),
    ).not.toBeNull();
  });
});
