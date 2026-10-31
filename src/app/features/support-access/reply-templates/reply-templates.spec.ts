import { HttpErrorResponse } from '@angular/common/http';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { SupportAccessClient } from '../../../core/data-access/support-access/support-access.client';
import type { ReplyTemplate } from '../../../core/data-access/support-access/support-inbox.types';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { ReplyTemplates } from './reply-templates';

const BASE: ReplyTemplate[] = [
  { id: 't-1', category: 'GENERAL', title: 'Recibimos su mensaje', bodyText: 'Hola {paciente}, recibimos su mensaje.', retired: false, version: 3 },
  { id: 't-2', category: 'BILLING', title: 'Costos', bodyText: 'Caja confirma el costo.', retired: true, version: 1 },
];

const desfasada = (currentVersion: number): HttpErrorResponse =>
  new HttpErrorResponse({ status: 409, error: { statusCode: 409, code: 'CONFLICT', message: 'x', details: { reason: 'REPLY_TEMPLATE_STALE', currentVersion }, timestamp: '', path: '' } });

describe('ReplyTemplates', () => {
  let fixture: ComponentFixture<ReplyTemplates>;
  let listOrgReplyTemplates: ReturnType<typeof vi.fn>;
  let createReplyTemplate: ReturnType<typeof vi.fn>;
  let updateReplyTemplate: ReturnType<typeof vi.fn>;
  let toastError: ReturnType<typeof vi.fn>;
  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byId = (id: string): HTMLElement | null => host().querySelector(`[data-testid="${id}"]`) ?? document.body.querySelector(`[data-testid="${id}"]`);
  const refrescar = async (): Promise<void> => {
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const clic = async (id: string): Promise<void> => {
    (byId(id) as HTMLElement).click();
    await refrescar();
  };
  const escribir = async (id: string, valor: string): Promise<void> => {
    const el = byId(id) as HTMLElement;
    const campo = (el.matches('input,textarea') ? el : el.querySelector('input,textarea')) as HTMLInputElement;
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
    await refrescar();
  };

  async function abrir(lista: readonly ReplyTemplate[] = BASE): Promise<void> {
    listOrgReplyTemplates = vi.fn(() => of({ items: lista, count: lista.length }));
    createReplyTemplate = vi.fn(() => of({ id: 't-9', category: 'GENERAL', title: 'x', bodyText: 'y', retired: false, version: 1 }));
    updateReplyTemplate = vi.fn(() => of({ ...BASE[0]!, version: 4 }));
    toastError = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: SupportAccessClient, useValue: { listOrgReplyTemplates, createReplyTemplate, updateReplyTemplate } },
        { provide: ToastService, useValue: { success: vi.fn(), error: toastError } },
      ],
    });
    fixture = TestBed.createComponent(ReplyTemplates);
    fixture.detectChanges();
    await refrescar();
  }

  it('lista las respuestas con su categoría y su versión, y marca las retiradas', async () => {
    await abrir();
    expect(host().querySelectorAll('[data-testid^="respuesta-t-"]').length).toBe(2);
    expect(byId('respuesta-t-1')!.textContent).toContain('Recibimos su mensaje');
    expect(byId('respuesta-version-t-1')!.textContent).toContain('Versión 3');
    expect(byId('respuesta-retirada-t-2')).not.toBeNull();
    expect(byId('respuesta-retirada-t-1')).toBeNull();
    expect(byId('respuesta-estado-t-1')!.textContent).toContain('Retirar');
    expect(byId('respuesta-estado-t-2')!.textContent).toContain('Reactivar');
  });

  it('avisa a la vista que solo van respuestas administrativas, nunca clínicas', async () => {
    await abrir();
    expect(byId('respuestas-aviso')!.textContent).toContain('Nada clínico');
    expect(byId('respuestas-aviso')!.textContent).toContain('{paciente}');
  });

  it('sin respuestas lo dice', async () => {
    await abrir([]);
    expect(host().textContent).toContain('Todavía no hay respuestas preparadas.');
  });

  it('crear sin título ni texto no manda nada y lo explica', async () => {
    await abrir();
    await clic('respuesta-nueva');
    await clic('respuesta-guardar');
    expect(createReplyTemplate).not.toHaveBeenCalled();
    expect(byId('respuesta-formulario')!.textContent).toContain('Escriba un título.');
    expect(byId('respuesta-formulario')!.textContent).toContain('Escriba el texto de la respuesta.');
  });

  it('crear manda categoría, título y texto, y vuelve a leer la lista', async () => {
    await abrir();
    await clic('respuesta-nueva');
    await escribir('respuesta-titulo', '  Dónde queda  ');
    await escribir('respuesta-texto', 'Estamos en el piso 2.');
    await clic('respuesta-guardar');
    expect(createReplyTemplate).toHaveBeenCalledWith({ category: 'GENERAL', title: 'Dónde queda', bodyText: 'Estamos en el piso 2.' });
    expect(listOrgReplyTemplates).toHaveBeenCalledTimes(2);
    expect(byId('respuesta-formulario')).toBeNull();
  });

  it('editar manda la versión que se vio como expectedVersion', async () => {
    await abrir();
    await clic('respuesta-editar-t-1');
    await escribir('respuesta-titulo', 'Recibimos su consulta');
    await clic('respuesta-guardar');
    expect(updateReplyTemplate).toHaveBeenCalledWith('t-1', { category: 'GENERAL', title: 'Recibimos su consulta', bodyText: 'Hola {paciente}, recibimos su mensaje.', expectedVersion: 3 });
  });

  it('si otra persona la cambió (409 REPLY_TEMPLATE_STALE) no pisa nada: lo explica, dice la versión de hoy y deja cargarla', async () => {
    await abrir();
    updateReplyTemplate.mockReturnValueOnce(throwError(() => desfasada(5)));
    await clic('respuesta-editar-t-1');
    await escribir('respuesta-titulo', 'Mi cambio');
    await clic('respuesta-guardar');
    const error = byId('respuesta-error')!;
    expect(error.getAttribute('data-kind')).toBe('STALE');
    expect(error.textContent).toContain('no se guardó su cambio');
    expect(byId('respuesta-version-actual')!.textContent).toContain('versión 5');
    // Lo escrito sigue ahí hasta que la persona decida.
    expect((byId('respuesta-titulo') as HTMLInputElement).value).toBe('Mi cambio');

    // «Cargar la versión actual» trae lo que hoy tiene la API, con su versión, y se edita sobre eso.
    listOrgReplyTemplates.mockReturnValueOnce(of({ items: [{ ...BASE[0]!, title: 'Título de la otra persona', version: 5 }, BASE[1]!], count: 2 }));
    await clic('respuesta-cargar-actual');
    expect((byId('respuesta-titulo') as HTMLInputElement).value).toBe('Título de la otra persona');
    expect(byId('respuesta-error')).toBeNull();
    await clic('respuesta-guardar');
    expect(updateReplyTemplate).toHaveBeenLastCalledWith('t-1', expect.objectContaining({ expectedVersion: 5, title: 'Título de la otra persona' }));
  });

  it('retirar manda { retired: true } con la versión vista; reactivar, { retired: false }', async () => {
    await abrir();
    await clic('respuesta-estado-t-1');
    expect(updateReplyTemplate).toHaveBeenCalledWith('t-1', { retired: true, expectedVersion: 3 });
    await clic('respuesta-estado-t-2');
    expect(updateReplyTemplate).toHaveBeenCalledWith('t-2', { retired: false, expectedVersion: 1 });
  });

  it('si al retirar otra persona se adelantó, lo avisa y vuelve a leer la lista', async () => {
    await abrir();
    updateReplyTemplate.mockReturnValueOnce(throwError(() => desfasada(9)));
    await clic('respuesta-estado-t-1');
    expect(toastError).toHaveBeenCalledWith(expect.stringContaining('Otra persona cambió esta respuesta'));
    expect(listOrgReplyTemplates).toHaveBeenCalledTimes(2);
  });
});
