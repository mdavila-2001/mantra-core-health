import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LabPortalClient } from '../../../core/data-access/lab-portal/lab-portal.client';
import type { LabResultFile, LabResultTarget } from '../../../core/data-access/lab-portal/lab-portal.types';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { LaboratoryResults } from './laboratory-results';

/**
 * Detector de ejecución. Un doble de `window.alert` no sirve en este corredor:
 * jsdom corre los manejadores inline en su propio contexto y llama a SU `alert`,
 * no al del objeto que ven las pruebas (medido: el doble nunca se llamaba).
 * Por eso las cargas, en vez de `alert(1)`, escriben una marca en el DOM
 * —`data-xss` en `<html>`— que se ve desde cualquier contexto.
 */
const MARCA = 'data-xss';
function limpiarMarca(): void {
  document.documentElement.removeAttribute(MARCA);
}
/** Dispara los eventos que activan un manejador inline y dice si alguno corrió. */
function ejecutado(): boolean {
  for (const el of Array.from(document.body.querySelectorAll('*'))) {
    const conManejador = el.getAttributeNames().some((a) => /^on/i.test(a));
    for (const tipo of ['error', 'load', 'toggle', 'focus', 'mouseover', 'animationstart', ...(conManejador ? ['click'] : [])]) {
      el.dispatchEvent(new Event(tipo));
    }
  }
  return document.documentElement.hasAttribute(MARCA);
}

/**
 * «Resultados» del laboratorio: el archivo de lo subido y su visor.
 *
 * Fija el contrato con la API (qué se pide con cada filtro, el retiro con
 * motivo), los estados del listado (vacío con y sin filtros, error) y —por
 * M-4 / O3-5, `laboratory-results.ts:538`— que el visor no convierta en
 * marcado activo lo que trae un archivo: el PDF entra al `<iframe>` como URL de
 * objeto tipada `application/pdf` aunque la respuesta diga `text/html`, y un
 * texto con `<script>` se muestra como texto.
 */

function archivo(partial: Partial<LabResultFile> = {}): LabResultFile {
  return {
    id: 'f-1',
    fileName: 'hemograma.pdf',
    contentType: 'application/pdf',
    sizeBytes: 2048,
    kind: 'PDF',
    uploadedAt: '2026-10-30T12:00:00Z',
    uploadedBy: 'Lic. Rocío Paz',
    orderId: 'o-1',
    orderLabel: 'Hemograma completo · pedido por Dra. Valeria Rojas',
    patientName: 'Ana Pérez',
    note: null,
    notified: true,
    status: 'AVAILABLE',
    withdrawnReason: null,
    ...partial,
  };
}

const TARGET: LabResultTarget = {
  orderId: 'o-1',
  studyName: 'Hemograma completo',
  patientName: 'Ana Pérez',
  requesterName: 'Dra. Valeria Rojas',
  requestedAt: '2026-10-29T12:00:00Z',
  fileCount: 0,
};

describe('LaboratoryResults', () => {
  let fixture: ComponentFixture<LaboratoryResults>;
  let files: LabResultFile[];
  let content: Blob;
  let listResultFiles: ReturnType<typeof vi.fn>;
  let withdrawResult: ReturnType<typeof vi.fn>;
  let confirmWithReason: ReturnType<typeof vi.fn>;
  let objetos: Map<string, Blob>;
  const original = { crear: URL.createObjectURL, revocar: URL.revokeObjectURL };

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const q = (testId: string): HTMLElement | null => root().querySelector(`[data-testid="${testId}"]`);

  async function montar(): Promise<void> {
    fixture = TestBed.createComponent(LaboratoryResults);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function abrirVisor(nombre: string): Promise<void> {
    const boton = root().querySelector<HTMLButtonElement>(`[aria-label="Ver ${nombre}"]`);
    expect(boton).not.toBeNull();
    boton!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();
  }

  beforeEach(() => {
    files = [archivo()];
    content = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
    objetos = new Map();
    let n = 0;
    URL.createObjectURL = vi.fn((b: Blob | MediaSource) => {
      const url = `blob:lab-${(n += 1)}`;
      objetos.set(url, b as Blob);
      return url;
    });
    URL.revokeObjectURL = vi.fn();
    limpiarMarca();
    listResultFiles = vi.fn(() =>
      of({ items: files, count: files.length, totalBytes: files.reduce((s, f) => s + f.sizeBytes, 0) }),
    );
    withdrawResult = vi.fn(() => of(undefined));
    confirmWithReason = vi.fn(async () => 'Era de otro paciente');

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: LabPortalClient,
          useValue: {
            listResultTargets: vi.fn(() => of({ items: [TARGET], count: 1 })),
            listResultFiles,
            resultContent: vi.fn(() => of(content)),
            withdrawResult,
          },
        },
        { provide: DialogService, useValue: { confirmWithReason } },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn(), info: vi.fn() } },
      ],
    });
  });

  afterEach(async () => {
    await new Promise((r) => setTimeout(r, 30));
    URL.createObjectURL = original.crear;
    URL.revokeObjectURL = original.revocar;
    expect(document.documentElement.hasAttribute(MARCA)).toBe(false);
    fixture?.destroy();
  });

  describe('el archivo de lo subido', () => {
    it('lista lo que devuelve la API con su conteo y su paciente', async () => {
      files = [archivo(), archivo({ id: 'f-2', fileName: 'rx.png', kind: 'IMAGE', contentType: 'image/png', sizeBytes: 1024 })];
      await montar();

      expect(q('results-count')?.textContent).toContain('2 archivos');
      expect(q('results-grid')?.querySelectorAll('li')).toHaveLength(2);
      expect(q('results-grid')?.textContent).toContain('Ana Pérez');
      expect(listResultFiles).toHaveBeenCalledWith({
        q: undefined,
        kind: undefined,
        orderId: undefined,
        includeWithdrawn: undefined,
      });
    });

    it('sin archivos y sin filtros, dice qué hacer primero', async () => {
      files = [];
      await montar();

      expect(root().textContent).toContain('Todavía no subió resultados.');
    });

    it('cambiar el formato vuelve a pedir con ese filtro', async () => {
      await montar();
      listResultFiles.mockClear();
      (fixture.componentInstance as unknown as { kind: { set(v: string): void } }).kind.set('IMAGE');
      fixture.detectChanges();
      await fixture.whenStable();

      expect(listResultFiles).toHaveBeenCalledWith(expect.objectContaining({ kind: 'IMAGE' }));
    });

    it('un error del listado no deja la grilla vacía como si no hubiera nada', async () => {
      listResultFiles.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
      await montar();

      expect(q('results-grid')).toBeNull();
      expect(root().textContent).not.toContain('Todavía no subió resultados.');
    });
  });

  describe('el visor', () => {
    it('un PDF se ve en un marco con URL de objeto', async () => {
      await montar();
      await abrirVisor('hemograma.pdf');

      const marco = q('results-viewer')?.querySelector('iframe');
      expect(marco).not.toBeNull();
      expect(marco!.getAttribute('src')?.startsWith('blob:')).toBe(true);
    });

    it('retirar pide motivo y lo manda a la API', async () => {
      await montar();
      await abrirVisor('hemograma.pdf');
      const retirar = Array.from(root().querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Retirar');
      retirar!.click();
      await fixture.whenStable();
      await new Promise((r) => setTimeout(r, 0));

      expect(confirmWithReason).toHaveBeenCalled();
      expect(withdrawResult).toHaveBeenCalledWith('f-1', 'Era de otro paciente');
    });

    it('si se cancela el motivo, no se retira nada', async () => {
      confirmWithReason.mockResolvedValue(null);
      await montar();
      await abrirVisor('hemograma.pdf');
      Array.from(root().querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Retirar')!.click();
      await fixture.whenStable();
      await new Promise((r) => setTimeout(r, 0));

      expect(withdrawResult).not.toHaveBeenCalled();
    });
  });

  describe('cargas hostiles (M-4 · laboratory-results.ts:538)', () => {
    it('un «PDF» cuyos bytes son HTML con script entra al marco tipado application/pdf, nunca text/html', async () => {
      content = new Blob(['<!doctype html><script>parent.document.documentElement.dataset.xss=1</script>'], { type: 'text/html' });
      await montar();
      await abrirVisor('hemograma.pdf');

      const src = q('results-viewer')?.querySelector('iframe')?.getAttribute('src') ?? '';
      expect(src.startsWith('blob:')).toBe(true);
      expect(objetos.get(src)?.type).toBe('application/pdf');
      expect(root().querySelector('script')).toBeNull();
      expect(ejecutado()).toBe(false);
    });

    it('un archivo de texto con marcado hostil se muestra como texto, no como HTML', async () => {
      const hostil = '<img src=x onerror=document.documentElement.dataset.xss=1><script>document.documentElement.dataset.xss=1</script><svg onload=document.documentElement.dataset.xss=1>';
      files = [archivo({ id: 'f-3', fileName: 'informe.txt', kind: 'TEXT', contentType: 'text/plain' })];
      content = new Blob([hostil], { type: 'text/html' });
      await montar();
      await abrirVisor('informe.txt');
      await new Promise((r) => setTimeout(r, 10));
      fixture.detectChanges();

      const pre = q('results-viewer')?.querySelector('pre');
      expect(pre?.textContent).toBe(hostil);
      expect(q('results-viewer')?.querySelector('img, script, svg, iframe')).toBeNull();
      expect(ejecutado()).toBe(false);
    });

    it('un nombre de archivo hostil se pinta como texto en la grilla y el visor', async () => {
      const nombre = '<img src=x onerror=document.documentElement.dataset.xss=1>.pdf';
      files = [archivo({ fileName: nombre, patientName: '<script>document.documentElement.dataset.xss=1</script>' })];
      await montar();

      expect(q('results-grid')?.textContent).toContain(nombre);
      expect(q('results-grid')?.querySelector('img[onerror], script')).toBeNull();
      await abrirVisor(nombre);
      expect(root().querySelector('img[onerror], script')).toBeNull();
    });

    it('una imagen se muestra sólo con <img> (un SVG con script no corre dentro de <img>)', async () => {
      files = [archivo({ id: 'f-4', fileName: 'rx.svg', kind: 'IMAGE', contentType: 'image/svg+xml' })];
      content = new Blob(['<svg xmlns="http://www.w3.org/2000/svg" onload="document.documentElement.dataset.xss=1"/>'], { type: 'image/svg+xml' });
      await montar();
      await abrirVisor('rx.svg');

      const visor = q('results-viewer')!;
      expect(visor.querySelector('img')?.getAttribute('src')?.startsWith('blob:')).toBe(true);
      expect(visor.querySelector('iframe, object, embed, svg[onload]')).toBeNull();
    });
  });
});
