import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { TenantSelection } from './tenant-selection';

describe('TenantSelection', () => {
  let component: TenantSelection;
  let fixture: ComponentFixture<TenantSelection>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TenantSelection],
      // La pantalla ya tenía un `Router` inyectado para navegar tras elegir; el
      // estado vacío añadió además un `routerLink` en la plantilla, y ése sí
      // necesita rutas configuradas para resolverse.
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(TenantSelection);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  /**
   * Sin sesión la lista queda vacía, y antes eso era una pantalla muda: ni
   * mensaje ni salida. Quien llegara directo a esta URL no tenía forma de saber
   * qué había pasado.
   */
  it('sin organizaciones explica qué pasó y ofrece volver al login', () => {
    fixture.detectChanges();

    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('No encontramos organizaciones');

    const salida = (fixture.nativeElement as HTMLElement).querySelector('a[routerLink="/auth"]');
    expect(salida).not.toBeNull();
  });

  /** El estado vacío se anuncia: es la respuesta que recibe la persona. */
  it('anuncia el estado vacío a un lector de pantalla', () => {
    fixture.detectChanges();

    const vacio = (fixture.nativeElement as HTMLElement).querySelector('.tenant__vacio');
    expect(vacio?.getAttribute('role')).toBe('status');
    expect(vacio?.getAttribute('aria-live')).toBe('polite');
  });
});
