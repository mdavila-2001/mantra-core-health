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

  it('ofrece las tres cuentas de persona —paciente, médico y personal de apoyo—, y ninguna organización', () => {
    const titulos = tarjetas().map((card) =>
      card.querySelector('.tipos__card-title')!.textContent!.trim(),
    );

    // Sin «Otro»: una tarjeta que no lleva a ningún lado deja sin opción a quien
    // ya eligió la suya.
    // «Médico» y no «Doctor» (F2 del plan de UX del 22/08/2026): en toda la
    // superficie que ve un paciente o un profesional se dice «médico».
    // Las organizaciones viven en «Registrá tu organización» del acceso.
    expect(titulos).toEqual(['Paciente', 'Médico', 'Secretaria o personal de apoyo']);
  });

  it('cada tarjeta lleva a su alta', () => {
    const destinos = tarjetas().map((card) => card.getAttribute('href'));

    expect(destinos).toEqual([
      '/auth/register/patient',
      '/auth/register/practitioner',
      '/auth/register/support-staff',
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

  it('ofrece las cinco organizaciones que tienen alta, y ninguna cuenta de persona', () => {
    const titulos = tarjetas().map((card) =>
      card.querySelector('.tipos__card-title')!.textContent!.trim(),
    );

    // `register-organization` crea un tenant PAYER y sólo ése: por eso la
    // tarjeta dice «Aseguradora» y no «Organización».
    expect(titulos).toEqual([
      'Aseguradora',
      'Laboratorio',
      'Imagenología',
      'Farmacia',
      'Organización médica',
    ]);
  });

  it('cada tarjeta lleva a su alta', () => {
    const destinos = tarjetas().map((card) => card.getAttribute('href'));

    expect(destinos).toEqual([
      '/auth/register/organization',
      '/auth/register/laboratory',
      '/auth/register/imaging-center',
      '/auth/register/pharmacy',
      '/auth/register/medical-center',
    ]);
  });

  it('titula la pantalla como el alta de una organización', () => {
    const titulo = fixture.debugElement.query(By.css('.tipos__title')).nativeElement as HTMLElement;

    expect(titulo.textContent).toContain('Registre su organización');
  });
});

describe('RegisterAccountType · composición de la rejilla', () => {
  async function render(audience?: 'organizations'): Promise<HTMLElement> {
    await TestBed.configureTestingModule({
      imports: [RegisterAccountType],
      providers: [
        provideRouter([]),
        ...(audience
          ? [{ provide: ActivatedRoute, useValue: { snapshot: { data: { audience } } } }]
          : []),
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(RegisterAccountType);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('con las tres cuentas de persona reparte de a tres: ninguna columna queda vacía', async () => {
    // Eran dos (paciente y médico) y la regla era «de a dos, sin hueco a la
    // derecha». Con la secretaria (31/10/2026) son tres: una fila de tres.
    const el = await render();

    expect(el.querySelector('.tipos__grid')?.getAttribute('data-columns')).toBe('3');
  });

  it('con cinco tipos los reparte de a tres', async () => {
    const el = await render('organizations');

    expect(el.querySelector('.tipos__grid')?.getAttribute('data-columns')).toBe('3');
  });

  it('cada tarjeta lleva el tono de su tipo, y ninguno es ámbar', async () => {
    const el = await render('organizations');
    const tonos = Array.from(el.querySelectorAll('.tipos__card')).map((c) =>
      c.getAttribute('data-tone'),
    );

    // Todas traen tono, y salen de los cuatro tríos de estado del sistema: el
    // ámbar es el punto de acción único del producto y no se reparte.
    expect(tonos.every((t) => ['primary', 'secondary', 'success', 'info'].includes(t ?? ''))).toBe(
      true,
    );
    // Dos vecinas nunca comparten tono: es lo que las distingue de un vistazo.
    for (let i = 1; i < tonos.length; i++) expect(tonos[i]).not.toBe(tonos[i - 1]);
  });

  it('cada tarjeta marca su contenedor para que el ícono juegue al apuntarla', async () => {
    const el = await render();

    for (const tarjeta of Array.from(el.querySelectorAll('.tipos__card'))) {
      expect(tarjeta.hasAttribute('data-icon-play')).toBe(true);
    }
  });
});
