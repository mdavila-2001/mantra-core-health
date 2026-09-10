import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { DOCUMENTOS_DE_EJEMPLO } from '../pharmacy-profile.fixtures';
import { DocumentosLegales } from './documentos-legales';
import { FileInput } from '../../../../shared/components/molecules/file-input/file-input';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { empty, loading, ready } from '../../../../core/view-state/view-state';
import type { DocumentoLegal } from '../pharmacy-profile.types';
import type { ViewState } from '../../../../core/view-state/view-state.types';

describe('DocumentosLegales', () => {
  let fixture: ComponentFixture<DocumentosLegales>;
  let toasts: ToastService;

  function montar(state: ViewState<readonly DocumentoLegal[]>): HTMLElement {
    fixture = TestBed.createComponent(DocumentosLegales);
    toasts = TestBed.inject(ToastService);
    fixture.componentRef.setInput('state', state);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  afterEach(() => fixture.destroy());

  it('pinta los seis papeles que el registro pide, en su orden', () => {
    const root = montar(ready(DOCUMENTOS_DE_EJEMPLO));

    const nombres = Array.from(root.querySelectorAll('h3')).map((titulo) =>
      titulo.textContent?.trim(),
    );
    expect(nombres).toEqual([
      'Constitución de la empresa',
      'NIT',
      'SEPREC',
      'Licencia de funcionamiento',
      'Certificado SEDES',
      'Poder del representante legal',
    ]);
  });

  it('cada fila trae su archivo y su fecha de emisión, no sólo el vencimiento', () => {
    const texto = montar(ready(DOCUMENTOS_DE_EJEMPLO)).textContent ?? '';

    expect(texto).toContain('certificado-sedes-2025.pdf');
    expect(texto).toContain('Emitido el');
  });

  it('el plazo se dice en palabras, con el mismo criterio que el resto del sistema', () => {
    const texto = montar(ready(DOCUMENTOS_DE_EJEMPLO)).textContent ?? '';

    expect(texto).toContain('vencido hace 12 días');
    expect(texto).toContain('vence en 18 días');
  });

  it('la severidad del plazo la lleva el distintivo, no sólo el texto', () => {
    const root = montar(ready(DOCUMENTOS_DE_EJEMPLO));

    const vencido = Array.from(root.querySelectorAll('app-badge')).find((badge) =>
      badge.textContent?.includes('vencido hace 12 días'),
    );
    expect(vencido?.className).toContain('badge--error');
  });

  it('declara en pantalla que los estados de verificación son provisionales', () => {
    const root = montar(ready(DOCUMENTOS_DE_EJEMPLO));

    expect(root.querySelector('[data-testid="ficha-nota-verificacion"]')?.textContent).toContain(
      'provisionales',
    );
  });

  it('una carpeta vacía ofrece la próxima acción, no un cartel sin salida', () => {
    const root = montar(empty({ label: 'Cargar el primer documento' }));

    expect(root.textContent ?? '').toContain('Cargar el primer documento');
    expect(root.querySelector('[data-testid="ficha-documentos"]')).toBeNull();
  });

  it('mientras carga muestra el esqueleto y ningún papel', () => {
    const root = montar(loading());

    expect(root.querySelector('app-skeleton')).not.toBeNull();
    expect(root.textContent ?? '').not.toContain('Certificado SEDES');
  });

  it('la descarga no baja un archivo vacío: avisa qué falta para que exista', () => {
    const root = montar(ready(DOCUMENTOS_DE_EJEMPLO));

    root.querySelector<HTMLButtonElement>('[data-testid="ficha-descargar-seprec"]')?.click();

    const aviso = toasts.toasts().at(-1);
    expect(aviso?.title).toBe('Documento de ejemplo');
    expect(aviso?.message).toContain('seprec-matricula-comercio.pdf');
  });

  it('los botones repetidos dicen de qué documento son', () => {
    const root = montar(ready(DOCUMENTOS_DE_EJEMPLO));

    expect(
      root.querySelector('[data-testid="ficha-descargar-seprec"]')?.getAttribute('aria-label'),
    ).toBe('Descargar SEPREC');
    expect(
      root.querySelector('[data-testid="ficha-reemplazar-seprec"]')?.getAttribute('aria-label'),
    ).toBe('Reemplazar SEPREC');
  });

  it('el selector de archivo se abre en la fila que se pidió, y en una sola', () => {
    const root = montar(ready(DOCUMENTOS_DE_EJEMPLO));

    root.querySelector<HTMLButtonElement>('[data-testid="ficha-reemplazar-nit"]')?.click();
    fixture.detectChanges();

    expect(root.querySelectorAll('app-file-input')).toHaveLength(1);
  });

  it('el archivo elegido se ve rotulado: se muestra, pero todavía no está subido', () => {
    const root = montar(ready(DOCUMENTOS_DE_EJEMPLO));

    root.querySelector<HTMLButtonElement>('[data-testid="ficha-reemplazar-nit"]')?.click();
    fixture.detectChanges();

    const control = fixture.debugElement.query(By.directive(FileInput))
      .componentInstance as FileInput;
    control.files.set([new File(['x'], 'nit-actualizado.pdf', { type: 'application/pdf' })]);
    fixture.detectChanges();

    const texto = root.textContent ?? '';
    expect(texto).toContain('nit-actualizado.pdf');
    expect(texto).toContain('Sin subir');
    // Y el selector se cierra: ya se eligió.
    expect(root.querySelector('app-file-input')).toBeNull();
  });

  it('lo que el control descarta se dice en voz alta, con el motivo', () => {
    montar(ready(DOCUMENTOS_DE_EJEMPLO));

    fixture.componentInstance['avisarRechazos']([
      { file: new File(['x'], 'licencia.docx'), reason: 'tipo' },
    ]);

    const aviso = toasts.toasts().at(-1);
    expect(aviso?.title).toBe('Archivo no aceptado');
    expect(aviso?.message).toContain('el registro pide el documento en PDF');
  });
});
