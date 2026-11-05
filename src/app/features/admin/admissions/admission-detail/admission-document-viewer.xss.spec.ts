import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { vi } from 'vitest';

import type { AdmissionDocument } from '@core/data-access/admissions/admissions.types';
import { AdmissionDocumentViewer } from './admission-document-viewer';

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
 * M-4 / O3-5 — `admission-document-viewer.ts:144` (`safeUrl`) y `:148`
 * (`safeDownload`) marcan una URL como confiable con `bypassSecurityTrustUrl`.
 * Eso sólo es correcto si lo marcado es **siempre** una URL de objeto (`blob:`)
 * que armó el propio visor, nunca un texto que vino de la API o del archivo.
 * Acá se le dan las cargas hostiles por las dos vías que controla un tercero:
 * la URL que devuelve `download-url` y los bytes / el nombre del documento.
 */

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d];

function doc(overrides: Partial<AdmissionDocument> = {}): AdmissionDocument {
  return {
    id: 'd-1', requirementCode: 'NATIONAL_ID', fileId: 'f-1', name: 'cedula.png', mimeType: 'image/png',
    sizeBytes: 100, uploadedAt: null, pages: null, reviewState: 'PENDING', evidenceSha256: null, ...overrides,
  };
}

describe('AdmissionDocumentViewer · URL confiables (M-4)', () => {
  let fixture: ComponentFixture<AdmissionDocumentViewer>;
  let http: HttpTestingController;
  let objetos: Map<string, Blob>;
  const original = { crear: URL.createObjectURL, revocar: URL.revokeObjectURL };

  beforeEach(() => {
    objetos = new Map();
    let n = 0;
    URL.createObjectURL = vi.fn((b: Blob | MediaSource) => {
      const url = `blob:test-${(n += 1)}`;
      objetos.set(url, b as Blob);
      return url;
    });
    URL.revokeObjectURL = vi.fn();
    limpiarMarca();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    fixture = TestBed.createComponent(AdmissionDocumentViewer);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(async () => {
    await new Promise((r) => setTimeout(r, 30));
    URL.createObjectURL = original.crear;
    URL.revokeObjectURL = original.revocar;
    expect(document.documentElement.hasAttribute(MARCA)).toBe(false);
    http.verify();
  });

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;

  async function abrir(urlDeLaApi: string, contenido: BlobPart[], tipo: string, documento = doc()): Promise<void> {
    fixture.componentRef.setInput('admissionId', 'a-1');
    fixture.componentRef.setInput('document', documento);
    fixture.detectChanges();
    http
      .expectOne('/admissions/a-1/documents/f-1/download-url')
      .flush({ url: urlDeLaApi, expiresAt: '2030-01-01T00:00:00Z', name: documento.name, mimeType: documento.mimeType });
    http.expectOne((req) => req.method === 'GET' && req.responseType === 'blob').flush(new Blob(contenido, { type: tipo }));
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 20));
    fixture.detectChanges();
  }

  /** Todo `src`/`href` del visor: deben ser URL de objeto, nada más. */
  function urlsDelDom(): string[] {
    return Array.from(el().querySelectorAll('[src], [href]')).map(
      (nodo) => nodo.getAttribute('src') ?? nodo.getAttribute('href') ?? '',
    );
  }

  it('admission-document-viewer.ts:144 — una URL `javascript:` de la API nunca llega al DOM', async () => {
    await abrir('javascript:document.documentElement.dataset.xss=1', [new Uint8Array(PNG)], 'image/png');

    const img = el().querySelector('img');
    expect(img).not.toBeNull();
    expect(urlsDelDom().length).toBeGreaterThan(0);
    expect(urlsDelDom().every((u) => u.startsWith('blob:'))).toBe(true);
    expect(el().innerHTML).not.toMatch(/javascript:/i);
    expect(ejecutado()).toBe(false);
  });

  it('admission-document-viewer.ts:144 — un PNG políglota (firma + `<script>`) se muestra sólo como imagen tipada', async () => {
    const poliglota = [new Uint8Array(PNG), '<script>document.documentElement.dataset.xss=1</script><svg onload=document.documentElement.dataset.xss=1>'];
    await abrir('/common/files/f-1/content', poliglota, 'text/html');

    const src = el().querySelector('img')?.getAttribute('src') ?? '';
    expect(src.startsWith('blob:')).toBe(true);
    // El navegador decide cómo interpretar la URL de objeto por su tipo: es el
    // VERIFICADO por la firma, no el `text/html` que declaró la respuesta.
    expect(objetos.get(src)?.type).toBe('image/png');
    expect(el().querySelector('script, svg[onload], iframe, object, embed')).toBeNull();
  });

  it('admission-document-viewer.ts:148 — HTML hostil con nombre hostil sólo se ofrece como descarga opaca', async () => {
    const nombre = '"><img src=x onerror=document.documentElement.dataset.xss=1>.html';
    await abrir(
      'data:text/html,<script>document.documentElement.dataset.xss=1</script>',
      ['<!doctype html><body onload=document.documentElement.dataset.xss=1><script>document.documentElement.dataset.xss=1</script>'],
      'text/html',
      doc({ name: nombre, mimeType: 'text/html' }),
    );

    const descarga = el().querySelector<HTMLAnchorElement>('[data-testid="viewer-download"]');
    expect(descarga).not.toBeNull();
    const href = descarga!.getAttribute('href') ?? '';
    expect(href.startsWith('blob:')).toBe(true);
    expect(objetos.get(href)?.type).toBe('application/octet-stream');
    // El nombre viaja como atributo y saneado de rutas; no se vuelve marcado.
    expect(descarga!.getAttribute('download')).not.toContain('"');
    expect(el().querySelector('img, script, iframe')).toBeNull();
    expect(urlsDelDom().every((u) => u.startsWith('blob:'))).toBe(true);
    expect(ejecutado()).toBe(false);
  });
});
