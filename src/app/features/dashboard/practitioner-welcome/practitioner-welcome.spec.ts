import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SessionStore } from '../../../core/auth/session.store';
import { PractitionerWelcome } from './practitioner-welcome';

/** base64url sobre UTF-8, como el token real. */
function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) =>
    btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(o))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.firma`;
}

/**
 * La portada del médico fija tres cosas:
 *
 * 1. Saluda por el nombre de pila, sin apellidos.
 * 2. Los atajos salen de la misma regla que el menú: una sección que el menú no
 *    le muestra a la sesión no aparece como atajo.
 * 3. El alta pendiente se dice con su avance y un único botón; sin alta
 *    pendiente, no hay aviso.
 */
describe('PractitionerWelcome', () => {
  let fixture: ComponentFixture<PractitionerWelcome>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PractitionerWelcome],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
  });

  function crear(claims: Record<string, unknown>): HTMLElement {
    TestBed.inject(SessionStore).start({ accessToken: jwt(claims), refreshToken: 'r-1' });
    fixture = TestBed.createComponent(PractitionerWelcome);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const MEDICO = {
    sub: 'u-1',
    roles: ['PRACTITIONER'],
    tenants: ['t-1'],
    hpid: 'hp-1',
    name: 'Luis Alberto Arce Catacora',
  };

  it('saluda por el nombre de pila, sin los dos apellidos', () => {
    const raiz = crear(MEDICO);
    const titulo = raiz.querySelector('h1')?.textContent ?? '';
    expect(titulo).toContain('Luis Alberto');
    expect(titulo).not.toContain('Catacora');
  });

  it('ofrece los atajos del día que el menú también le muestra', () => {
    const raiz = crear(MEDICO);
    const agenda = raiz.querySelector('[data-testid="welcome-shortcut-schedule"]');
    expect(agenda?.getAttribute('href')).toBe('/schedule');
    expect(raiz.querySelector('[data-testid="welcome-shortcut-records"]')).not.toBeNull();
    expect(raiz.querySelector('[data-testid="welcome-shortcut-primary"]')).not.toBeNull();
    // Cada atajo lleva su ícono: se reconoce sin leer.
    expect(agenda?.querySelector('.shortcut__icon app-nav-icon')).not.toBeNull();
  });

  it('sin el rol que abre una sección, su atajo no aparece', () => {
    // `CLINICIAN` ve el archivo clínico pero no la agenda ni los pacientes de cabecera.
    const raiz = crear({ ...MEDICO, roles: ['CLINICIAN'] });
    expect(raiz.querySelector('[data-testid="welcome-shortcut-schedule"]')).toBeNull();
    expect(raiz.querySelector('[data-testid="welcome-shortcut-primary"]')).toBeNull();
    expect(raiz.querySelector('[data-testid="welcome-shortcut-records"]')).not.toBeNull();
  });

  it('con el alta a medias dice cuánto lleva y ofrece un solo camino', () => {
    const raiz = crear(MEDICO);
    fixture.componentRef.setInput('onboarding', { completed: 3, total: 5 });
    fixture.detectChanges();

    const bloque = raiz.querySelector('[data-testid="welcome-onboarding"]');
    expect(bloque?.textContent).toContain('Complete su perfil para recibir pacientes');
    expect(bloque?.textContent).toContain('3 de 5');
    expect(bloque?.textContent).toContain('Le faltan 2');
    expect(
      raiz.querySelector('[data-testid="welcome-onboarding-go"]')?.getAttribute('href'),
    ).toBe('/onboarding');
  });

  it('sin alta pendiente no hay aviso', () => {
    const raiz = crear(MEDICO);
    expect(raiz.querySelector('[data-testid="welcome-onboarding"]')).toBeNull();
    expect(raiz.textContent).not.toContain('Complete su perfil');
  });

  it('«Mis verificaciones» aparece sólo si el panel lo pide', () => {
    const raiz = crear(MEDICO);
    expect(raiz.querySelector('[data-testid="dashboard-my-verifications"]')).toBeNull();

    fixture.componentRef.setInput('showVerifications', true);
    fixture.detectChanges();
    expect(
      raiz
        .querySelector('[data-testid="dashboard-my-verifications"] a')
        ?.getAttribute('href'),
    ).toBe('/my-account/verifications');
  });
});
