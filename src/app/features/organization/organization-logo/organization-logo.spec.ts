import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { LogoDeOrganizacionClient } from '../../../core/data-access/directory/organization-logo.client';
import { FileInput } from '../../../shared/components/molecules/file-input/file-input';
import { OrganizationLogo } from './organization-logo';

const PNG_1X1 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==';

describe('OrganizationLogo', () => {
  let fixture: ComponentFixture<OrganizationLogo>;
  const cliente = {
    obtenerUrl: vi.fn(),
    subir: vi.fn(),
    guardar: vi.fn(),
  };

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const imagen = (): HTMLImageElement | null => el().querySelector('img');
  const archivo = (): File => new File([new Uint8Array([137, 80, 78, 71])], 'logo.png', { type: 'image/png' });

  async function montar(opciones: { editar: boolean; url?: string | null } = { editar: true }): Promise<void> {
    cliente.obtenerUrl.mockReturnValue(of(opciones.url ?? null));
    fixture = TestBed.createComponent(OrganizationLogo);
    fixture.componentRef.setInput('tenantId', 't-1');
    fixture.componentRef.setInput('nombre', 'Farmacia Central');
    fixture.componentRef.setInput('puedeEditar', opciones.editar);
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /** El selector de archivos avisa que se eligió uno, como lo haría la persona. */
  function elegir(archivos: File[]): void {
    fixture.debugElement.query(By.directive(FileInput)).triggerEventHandler('filesChange', archivos);
  }

  beforeEach(async () => {
    vi.resetAllMocks();
    await TestBed.configureTestingModule({
      imports: [OrganizationLogo],
      providers: [{ provide: LogoDeOrganizacionClient, useValue: cliente }],
    }).compileComponents();
  });

  it('lee el logo de la organización que se le pasa y lo dibuja con su nombre', async () => {
    await montar({ editar: false, url: PNG_1X1 });

    expect(cliente.obtenerUrl).toHaveBeenCalledWith('t-1');
    expect(imagen()?.getAttribute('alt')).toBe('Logo de Farmacia Central');
  });

  it('sin logo muestra el marcador del mismo tamaño y ninguna imagen', async () => {
    await montar({ editar: false });

    expect(imagen()).toBeNull();
    expect(el().querySelector('[data-testid="logo-organizacion-vista"]')).not.toBeNull();
  });

  it('quien no administra lo ve pero no tiene cómo cambiarlo', async () => {
    await montar({ editar: false, url: PNG_1X1 });

    expect(el().querySelector('app-file-input')).toBeNull();
    expect(el().querySelector('[data-testid="logo-organizacion-quitar"]')).toBeNull();
  });

  it('quien administra sube un logo: se sube, se asocia a la organización y se ve', async () => {
    cliente.subir.mockReturnValue(of('file-9'));
    cliente.guardar.mockReturnValue(of(undefined));
    await montar({ editar: true });

    elegir([archivo()]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(cliente.subir).toHaveBeenCalledTimes(1);
    expect(cliente.guardar).toHaveBeenCalledWith('t-1', 'file-9');
    // La vista previa se arma leyendo el archivo (FileReader): llega un instante después.
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(imagen()).not.toBeNull();
    });
    expect(el().querySelector('[data-testid="logo-organizacion-quitar"]')).not.toBeNull();
    expect(el().querySelector('[data-testid="logo-organizacion-error"]')).toBeNull();
  });

  it('si no se pudo guardar lo dice y no deja un logo que no existe', async () => {
    cliente.subir.mockReturnValue(of('file-9'));
    cliente.guardar.mockReturnValue(throwError(() => new Error('403')));
    await montar({ editar: true });

    elegir([archivo()]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el().querySelector('[data-testid="logo-organizacion-error"]')?.textContent).toContain(
      'No se pudo guardar el logo',
    );
    expect(imagen()).toBeNull();
  });

  it('si la API explica por qué no lo guardó, lo dice con el código de soporte', async () => {
    cliente.subir.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 413,
            error: { code: 'PAYLOAD_TOO_LARGE', message: 'La imagen supera los 2 MB.', correlationId: 'c-logo' },
          }),
      ),
    );
    await montar({ editar: true });

    elegir([archivo()]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el().querySelector('[data-testid="logo-organizacion-error"]')?.textContent).toContain(
      'La imagen supera los 2 MB. (Código de soporte: c-logo)',
    );
  });

  it('si quitar falla, lo dice y el logo sigue', async () => {
    cliente.guardar.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 500,
            error: { code: 'INTERNAL', message: 'boom', correlationId: 'c-quitar' },
          }),
      ),
    );
    await montar({ editar: true, url: PNG_1X1 });

    (el().querySelector('[data-testid="logo-organizacion-quitar"]') as HTMLElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el().querySelector('[data-testid="logo-organizacion-error"]')?.textContent).toContain(
      'No se pudo quitar el logo. Pruebe de nuevo. (Código de soporte: c-quitar)',
    );
    expect(imagen()).not.toBeNull();
  });

  it('quitar deja la organización sin logo', async () => {
    cliente.guardar.mockReturnValue(of(undefined));
    await montar({ editar: true, url: PNG_1X1 });

    (el().querySelector('[data-testid="logo-organizacion-quitar"]') as HTMLElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(cliente.guardar).toHaveBeenCalledWith('t-1', null);
    expect(imagen()).toBeNull();
  });

  it('un archivo rechazado dice por qué y no toca el logo actual', async () => {
    await montar({ editar: true, url: PNG_1X1 });

    fixture.debugElement
      .query(By.directive(FileInput))
      .triggerEventHandler('rejected', [{ file: archivo(), reason: 'tamaño' }]);
    fixture.detectChanges();

    expect(el().querySelector('[data-testid="logo-organizacion-error"]')?.textContent).toContain('2 MB');
    expect(imagen()).not.toBeNull();
    expect(cliente.subir).not.toHaveBeenCalled();
  });
});
