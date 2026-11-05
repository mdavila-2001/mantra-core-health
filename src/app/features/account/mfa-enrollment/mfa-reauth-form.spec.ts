import { TestBed, type ComponentFixture } from '@angular/core/testing';

import type { MfaReauth } from '../../../core/data-access/iam/mfa.types';
import { MfaReauthForm } from './mfa-reauth-form';

/**
 * La reautenticación antes de tocar los métodos de verificación: con la
 * contraseña o, si se puede, con el código de la aplicación. No emite nada
 * sin el dato, limpia el campo después de emitir (no queda la contraseña en
 * memoria del formulario) y no deja enviar mientras la API trabaja.
 */
describe('MfaReauthForm', () => {
  let fixture: ComponentFixture<MfaReauthForm>;
  let emitidos: MfaReauth[];
  let cancelados: number;

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement = HTMLElement>(id: string): T | null =>
    root().querySelector<T>(`[data-testid="reauth-${id}"]`);

  async function pintar(inputs: Record<string, unknown> = {}): Promise<void> {
    fixture = TestBed.createComponent(MfaReauthForm);
    fixture.componentRef.setInput('reason', 'Va a quitar un método.');
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    emitidos = [];
    cancelados = 0;
    fixture.componentInstance.proven.subscribe((p) => emitidos.push(p));
    fixture.componentInstance.cancelled.subscribe(() => (cancelados += 1));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function escribir(id: string, texto: string): Promise<void> {
    const campo = q<HTMLInputElement>(id)!;
    campo.value = texto;
    campo.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function enviar(): Promise<void> {
    q<HTMLFormElement>('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('explica el motivo y, sin código disponible, sólo pide la contraseña', async () => {
    await pintar();

    expect(root().textContent).toContain('Va a quitar un método.');
    expect(q('modo-codigo')).toBeNull();
    expect(q('contrasena')?.getAttribute('type')).toBe('password');
  });

  it('enviar vacío no emite y muestra el error del campo', async () => {
    await pintar();
    await enviar();

    expect(emitidos).toEqual([]);
    expect(root().textContent).toContain('Escriba su contraseña actual.');
  });

  it('con contraseña emite currentPassword y vacía el campo', async () => {
    await pintar();
    await escribir('contrasena', 'secreta-123');
    await enviar();

    expect(emitidos).toEqual([{ currentPassword: 'secreta-123' }]);
    expect(q<HTMLInputElement>('contrasena')!.value).toBe('');
  });

  it('con código: exige 6 a 8 dígitos y emite el código limpio de espacios y guiones', async () => {
    await pintar({ canUseCode: true });
    q('modo-codigo')!.click();
    fixture.detectChanges();
    expect(q('modo-codigo')!.getAttribute('aria-pressed')).toBe('true');

    await escribir('codigo', '12a');
    await enviar();
    expect(emitidos).toEqual([]);
    expect(root().textContent).toContain('Escriba los 6 dígitos');

    await escribir('codigo', '123 - 456');
    await enviar();
    expect(emitidos).toEqual([{ mfaCode: '123456' }]);
  });

  it('ocupado: no emite aunque haya dato, y deshabilita cancelar', async () => {
    await pintar({ busy: true });
    await escribir('contrasena', 'secreta-123');
    await enviar();

    expect(emitidos).toEqual([]);
    // `app-button` deshabilita por aria-disabled (sigue enfocable) y corta el clic.
    expect(q('cancelar')!.getAttribute('aria-disabled')).toBe('true');
  });

  it('muestra el fallo que devuelve la API como alerta', async () => {
    await pintar({ failure: 'La contraseña no coincide.' });
    expect(q('error')?.textContent).toContain('La contraseña no coincide.');
  });

  it('cancelar emite cancelled y usa el prefijo para sus testid', async () => {
    await pintar();
    q('cancelar')!.click();
    expect(cancelados).toBe(1);

    await pintar({ prefix: 'quitar' });
    expect(root().querySelector('[data-testid="quitar-form"]')).not.toBeNull();
  });
});
