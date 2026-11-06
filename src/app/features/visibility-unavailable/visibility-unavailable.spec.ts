import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { VisibilityUnavailable } from './visibility-unavailable';

describe('VisibilityUnavailable (S3 con próxima acción)', () => {
  let fixture: ComponentFixture<VisibilityUnavailable>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VisibilityUnavailable],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(VisibilityUnavailable);
    fixture.detectChanges();
  });

  const html = (): HTMLElement => fixture.nativeElement as HTMLElement;

  it('se anuncia: la persona esperaba una pantalla y llegó acá', () => {
    expect(html().querySelector('[role="alert"]')).not.toBeNull();
  });

  it('dice que no está disponible para su perfil, sin nombrar la regla ni la pantalla', () => {
    const texto = html().textContent ?? '';
    expect(texto).toContain('No disponible para su perfil');
    expect(texto.toLowerCase()).not.toContain('regla');
  });

  it('ofrece la próxima acción: volver al inicio', () => {
    const enlace = html().querySelector<HTMLAnchorElement>('a[empty-actions]');
    expect(enlace?.textContent?.trim()).toBe('Ir al inicio');
    expect(enlace?.getAttribute('href')).toBe('/dashboard');
  });
});
