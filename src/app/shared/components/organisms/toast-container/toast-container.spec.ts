import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { ToastService } from '../../molecules/toast/toast.service';
import { ToastContainer } from './toast-container';

/**
 * Las dos regiones vivas de avisos. Existen desde el primer render (un lector
 * de pantalla sólo anuncia cambios en una región que ya conocía); los errores
 * van a la región asertiva y el resto a la cortés.
 */
describe('ToastContainer', () => {
  let fixture: ComponentFixture<ToastContainer>;
  let toasts: ToastService;

  const region = (id: string): HTMLElement =>
    (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${id}"]`)!;

  beforeEach(() => {
    fixture = TestBed.createComponent(ToastContainer);
    toasts = TestBed.inject(ToastService);
    fixture.detectChanges();
  });

  afterEach(() => {
    for (const t of toasts.toasts()) toasts.dismiss(t.id);
  });

  it('las dos regiones están desde el principio, vacías, con su rol', () => {
    expect(region('avisos-region').getAttribute('role')).toBe('status');
    expect(region('avisos-region').getAttribute('aria-live')).toBe('polite');
    expect(region('avisos-region-errores').getAttribute('role')).toBe('alert');
    expect(region('avisos-region-errores').getAttribute('aria-live')).toBe('assertive');
    expect(region('avisos-region').querySelectorAll('app-toast')).toHaveLength(0);
  });

  it('un éxito va a la región cortés; un error, a la asertiva', () => {
    toasts.success('Guardado.');
    toasts.error('No se pudo guardar.');
    fixture.detectChanges();

    expect(region('avisos-region').textContent).toContain('Guardado.');
    expect(region('avisos-region').textContent).not.toContain('No se pudo guardar.');
    expect(region('avisos-region-errores').textContent).toContain('No se pudo guardar.');
  });

  it('cerrar un aviso lo saca del servicio', () => {
    toasts.success('Guardado.');
    fixture.detectChanges();
    const id = toasts.toasts()[0]!.id;

    fixture.componentInstance.dismiss(id);
    fixture.detectChanges();

    expect(toasts.toasts().some((t) => t.id === id)).toBe(false);
  });
});
