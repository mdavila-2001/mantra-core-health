import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { GroupComposer } from './group-composer';

/**
 * La caja para publicar en un grupo. Avisa ANTES de escribir que no van datos
 * de pacientes (DOC-SOC-014), no publica en blanco, emite el texto recortado y
 * se vacía, y mientras se envía no deja volver a publicar.
 */
describe('GroupComposer', () => {
  let fixture: ComponentFixture<GroupComposer>;
  let publicados: string[];
  let cancelados: number;
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const area = (): HTMLTextAreaElement => root().querySelector('textarea')!;
  const boton = (texto: string): HTMLButtonElement =>
    Array.from(root().querySelectorAll('button')).find((b) => b.textContent?.trim() === texto)!;

  function pintar(inputs: Record<string, unknown> = {}): void {
    fixture = TestBed.createComponent(GroupComposer);
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    publicados = [];
    cancelados = 0;
    fixture.componentInstance.publicado.subscribe((t) => publicados.push(t));
    fixture.componentInstance.cancelado.subscribe(() => (cancelados += 1));
    fixture.detectChanges();
  }

  function escribir(texto: string): void {
    area().value = texto;
    area().dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  it('el aviso sobre datos de pacientes va antes del área de texto', () => {
    pintar();
    const aviso = root().querySelector('.compositor__aviso')!;
    expect(aviso.textContent).toContain('No escriba datos personales de un paciente');
    expect(aviso.compareDocumentPosition(area()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('en blanco no deja publicar', () => {
    pintar();
    escribir('   ');
    expect(boton('Publicar').getAttribute('aria-disabled')).toBe('true');
    boton('Publicar').click();
    expect(publicados).toEqual([]);
  });

  it('publica el texto recortado y se vacía', () => {
    pintar();
    escribir('  Hola grupo  ');
    boton('Publicar').click();
    fixture.detectChanges();
    expect(publicados).toEqual(['Hola grupo']);
    expect(area().value).toBe('');
  });

  it('mientras envía no deja publicar otra vez', () => {
    pintar({ enviando: true });
    escribir('Hola');
    expect(boton('Publicar').getAttribute('aria-disabled')).toBe('true');
  });

  it('con acción propia y cancelable: el rótulo cambia y cancelar vacía y emite', () => {
    pintar({ accion: 'Responder', cancelable: true });
    escribir('borrador');
    boton('Cancelar').click();
    fixture.detectChanges();
    expect(cancelados).toBe(1);
    expect(area().value).toBe('');
    expect(boton('Responder')).toBeDefined();
  });

  it('sin cancelable no hay botón Cancelar', () => {
    pintar();
    expect(Array.from(root().querySelectorAll('button')).some((b) => b.textContent?.trim() === 'Cancelar')).toBe(false);
  });
});
