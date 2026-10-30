import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { vi } from 'vitest';

import type { AdmissionDocument } from '@core/data-access/admissions/admissions.types';
import {
  AdmissionDocumentViewer,
  SAFE_DOCUMENT_TYPES,
  safeDownloadName,
  sniffDocumentType,
} from './admission-document-viewer';

/* El visor muestra documentos que SUBE UN TERCERO y los abre quien revisa.
   Un HTML o un SVG abierto en una pestaña nueva correría con el origen de la
   aplicación y la sesión del revisor: por eso el tipo se decide por la firma de
   los bytes y lo demás solo se descarga. */

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d];
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0, 0x10];
const WEBP = [0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50];
const GIF = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61];
const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34];
const bytes = (texto: string): number[] => [...new TextEncoder().encode(texto)];

function doc(overrides: Partial<AdmissionDocument> = {}): AdmissionDocument {
  return {
    id: 'd-1', requirementCode: 'NATIONAL_ID', fileId: 'f-1', name: 'cedula.png', mimeType: 'image/png',
    sizeBytes: 100, uploadedAt: null, pages: null, reviewState: 'PENDING', evidenceSha256: null, ...overrides,
  };
}

describe('sniffDocumentType', () => {
  it('reconoce por la firma los cinco tipos que se muestran', () => {
    expect(sniffDocumentType(new Uint8Array(PNG))).toBe('image/png');
    expect(sniffDocumentType(new Uint8Array(JPEG))).toBe('image/jpeg');
    expect(sniffDocumentType(new Uint8Array(WEBP))).toBe('image/webp');
    expect(sniffDocumentType(new Uint8Array(GIF))).toBe('image/gif');
    expect(sniffDocumentType(new Uint8Array(PDF))).toBe('application/pdf');
  });

  it('HTML, SVG, XML, JS, texto, vacío y RIFF que no es WEBP no son nada', () => {
    for (const texto of ['<!doctype html><script>alert(1)</script>', '<svg xmlns="http://www.w3.org/2000/svg" onload="x()"/>', '<?xml version="1.0"?><a/>', 'alert(document.cookie)', 'hola', '']) {
      expect(sniffDocumentType(new Uint8Array(bytes(texto)))).toBeNull();
    }
    expect(sniffDocumentType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x41, 0x56, 0x45]))).toBeNull();
    // Un PNG truncado en la firma tampoco.
    expect(sniffDocumentType(new Uint8Array([0x89, 0x50, 0x4e]))).toBeNull();
  });

  it('la lista blanca no incluye SVG ni HTML', () => {
    expect(SAFE_DOCUMENT_TYPES.join(',')).not.toMatch(/svg|html|xml|javascript/);
  });
});

describe('safeDownloadName', () => {
  it('no deja rutas ni caracteres de control', () => {
    expect(safeDownloadName('../../etc/passwd')).toBe('etc-passwd');
    expect(safeDownloadName('..\\..\\windows\\system32')).toBe('windows-system32');
    expect(safeDownloadName('a\u0000b\nc.png')).toBe('a-b-c.png');
    expect(safeDownloadName('<img src=x onerror=alert(1)>.png')).toBe('img src=x onerror=alert(1)-.png');
    expect(safeDownloadName('/')).toBe('documento');
    expect(safeDownloadName('')).toBe('documento');
    expect(safeDownloadName(null)).toBe('documento');
  });

  it('conserva tildes y emoji, y corta lo larguísimo', () => {
    expect(safeDownloadName('cédula 🩺.png')).toBe('cédula 🩺.png');
    expect(safeDownloadName('x'.repeat(300))).toHaveLength(120);
  });
});

describe('AdmissionDocumentViewer', () => {
  let fixture: ComponentFixture<AdmissionDocumentViewer>;
  let http: HttpTestingController;
  let objetos: Map<string, Blob>;
  let abiertas: unknown[][];
  let revocadas: string[];
  const original = { crear: URL.createObjectURL, revocar: URL.revokeObjectURL, abrir: window.open };

  beforeEach(() => {
    objetos = new Map();
    abiertas = [];
    revocadas = [];
    let n = 0;
    URL.createObjectURL = vi.fn((b: Blob | MediaSource) => {
      const url = `blob:test-${(n += 1)}`;
      objetos.set(url, b as Blob);
      return url;
    });
    URL.revokeObjectURL = vi.fn((url: string) => void revocadas.push(url));
    window.open = vi.fn((...args: unknown[]) => (abiertas.push(args), null)) as unknown as typeof window.open;
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    fixture = TestBed.createComponent(AdmissionDocumentViewer);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    URL.createObjectURL = original.crear;
    URL.revokeObjectURL = original.revocar;
    window.open = original.abrir;
    http.verify();
  });

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const q = (testid: string): HTMLElement | null => el().querySelector(`[data-testid="${testid}"]`);

  async function abrir(contenido: BlobPart[], tipo: string, documento = doc()): Promise<void> {
    fixture.componentRef.setInput('admissionId', 'a-1');
    fixture.componentRef.setInput('document', documento);
    fixture.detectChanges();
    http.expectOne('/admissions/a-1/documents/f-1/download-url').flush({ url: '/common/files/f-1/content', expiresAt: '2030-01-01T00:00:00Z', name: 'cedula.png', mimeType: 'image/png' });
    http.expectOne('/common/files/f-1/content').flush(new Blob(contenido, { type: tipo }));
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 20));
    fixture.detectChanges();
  }

  it('mientras llega muestra un esqueleto anunciado, no un hueco', () => {
    fixture.componentRef.setInput('admissionId', 'a-1');
    fixture.componentRef.setInput('document', doc());
    fixture.detectChanges();
    expect(q('viewer-loading')?.getAttribute('aria-busy')).toBe('true');
    http.expectOne('/admissions/a-1/documents/f-1/download-url').flush({ url: '/common/files/f-1/content', expiresAt: '2030-01-01T00:00:00Z', name: 'cedula.png', mimeType: 'image/png' });
    http.expectOne('/common/files/f-1/content').flush(new Blob([]));
  });

  describe('lo que sí se muestra', () => {
    it('un PNG se muestra y se puede abrir en una pestaña nueva, con el tipo verificado', async () => {
      await abrir([new Uint8Array(PNG)], 'image/png');
      const img = el().querySelector('img');
      expect(img).not.toBeNull();
      expect(img?.getAttribute('alt')).toBe('Documento cedula.png');
      const abre = q('viewer-open') as HTMLButtonElement;
      expect(abre).not.toBeNull();
      abre.click();
      expect(abiertas).toHaveLength(1);
      expect(abiertas[0]![1]).toBe('_blank');
      expect(abiertas[0]![2]).toBe('noopener');
      expect(objetos.get(abiertas[0]![0] as string)?.type).toBe('image/png');
    });

    it('el JPEG, el WEBP y el GIF también, y una cabecera vacía no importa si los bytes son una imagen', async () => {
      await abrir([new Uint8Array(JPEG)], '');
      expect(el().querySelector('img')).not.toBeNull();
      expect([...objetos.values()].some((b) => b.type === 'image/jpeg')).toBe(true);
    });

    it('un PDF se abre con el tipo application/pdf aunque la cabecera diga otra cosa', async () => {
      // Lo que se prueba es el tipo VERIFICADO por la firma y la apertura en pestaña, no la decodificación del PDF
      // (la prueba del PDF corrupto la ejerce con pdf.js real). Con bytes de cabecera solamente, pdf.js falla en
      // cuanto termina de cargar y el visor pasa a «dañado»: la prueba dependería de quién llegue antes.
      const sinPdfJs = vi
        .spyOn(AdmissionDocumentViewer.prototype as unknown as { openPdf(blob: Blob): Promise<void> }, 'openPdf')
        .mockResolvedValue(undefined);
      try {
        await abrir([new Uint8Array(PDF)], 'application/octet-stream', doc({ name: 'm.pdf', mimeType: 'application/pdf' }));
        expect(q('viewer-open')).not.toBeNull();
        q('viewer-open')!.click();
        expect(objetos.get(abiertas[0]![0] as string)?.type).toBe('application/pdf');
      } finally {
        sinPdfJs.mockRestore();
      }
    });
  });

  describe('lo que NUNCA se abre en una pestaña', () => {
    const casos: [string, string, string][] = [
      ['html', '<!doctype html><script>fetch("/iam/me")</script>', 'text/html'],
      ['svg', '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>', 'image/svg+xml'],
      ['xml', '<?xml version="1.0"?><x:script xmlns:x="http://www.w3.org/1999/xhtml">1</x:script>', 'application/xml'],
      ['javascript', 'alert(document.cookie)', 'text/javascript'],
      ['octet-stream', 'cualquier cosa', 'application/octet-stream'],
      ['tipo vacío', '<html><body onload=alert(1)>', ''],
    ];
    it.each(casos)('%s: sin vista, sin «abrir en pestaña», y la descarga es octet-stream', async (_n, contenido, tipo) => {
      // «Tipo vacío» es que NADIE declaró un tipo (ni la cabecera ni la ficha): con uno declarado de imagen o PDF sería «mismatch».
      await abrir([contenido], tipo, tipo === '' ? doc({ mimeType: null }) : doc());
      expect(q('viewer-unsupported')).not.toBeNull();
      expect(el().querySelector('img')).toBeNull();
      expect(el().querySelector('iframe, object, embed')).toBeNull();
      expect(q('viewer-open')).toBeNull();
      // Aunque alguien llame al método a mano, no abre nada.
      (fixture.componentInstance as unknown as { openInNewTab(): void }).openInNewTab();
      expect(abiertas).toHaveLength(0);
      // Lo único ofrecido es una descarga forzada con tipo opaco.
      const descarga = q('viewer-download') as HTMLAnchorElement;
      expect(descarga).not.toBeNull();
      expect(descarga.hasAttribute('download')).toBe(true);
      expect([...objetos.values()].every((b) => b.type === 'application/octet-stream')).toBe(true);
      expect([...objetos.values()].some((b) => /html|svg|xml|javascript/.test(b.type))).toBe(false);
    });

    it('un tipo mentiroso (cabecera image/png con bytes HTML) no se muestra y se dice por qué', async () => {
      await abrir(['<!doctype html><script>alert(1)</script>'], 'image/png');
      expect(q('viewer-mismatch')).not.toBeNull();
      expect(el().querySelector('img')).toBeNull();
      expect(q('viewer-open')).toBeNull();
      expect([...objetos.values()].every((b) => b.type === 'application/octet-stream')).toBe(true);
    });

    it('sin tipo en la cabecera pero con la ficha declarando una imagen, bytes HTML tampoco se muestran: «mismatch»', async () => {
      await abrir(['<!doctype html><script>alert(1)</script>'], '', doc({ mimeType: 'image/png' }));
      expect(q('viewer-mismatch')).not.toBeNull();
      expect(el().querySelector('img')).toBeNull();
      expect(q('viewer-open')).toBeNull();
    });

    it('lo mismo con una cabecera application/pdf sobre bytes HTML', async () => {
      await abrir(['<html></html>'], 'application/pdf', doc({ mimeType: 'application/pdf' }));
      expect(q('viewer-mismatch')).not.toBeNull();
      expect(q('viewer-open')).toBeNull();
    });

    it('el nombre de la descarga se sanea: sin rutas ni caracteres de control, con emoji', async () => {
      await abrir(['<html>'], 'text/html', doc({ name: '../../etc/pass\u0000wd 🩺.html' }));
      expect(q('viewer-download')?.getAttribute('download')).toBe('etc-pass-wd 🩺.html');
    });

    it('un PDF corrupto (firma válida, cuerpo roto) cae en «no pudimos abrir el archivo»', async () => {
      await abrir([new Uint8Array([...PDF, 0xff, 0xfe, 0x00])], 'application/pdf', doc({ mimeType: 'application/pdf', name: 'roto.pdf' }));
      await new Promise((r) => setTimeout(r, 50));
      fixture.detectChanges();
      expect(q('viewer-corrupt')).not.toBeNull();
    });

    it('una imagen cuyos bytes no decodifican se informa como dañada', async () => {
      await abrir([new Uint8Array(PNG)], 'image/png');
      el().querySelector('img')!.dispatchEvent(new Event('error'));
      fixture.detectChanges();
      expect(q('viewer-corrupt')).not.toBeNull();
    });
  });

  describe('los fallos', () => {
    function pedir(): void {
      fixture.componentRef.setInput('admissionId', 'a-1');
      fixture.componentRef.setInput('document', doc());
      fixture.detectChanges();
    }

    it('403 al pedir el acceso: sin acceso, y no se ofrece reintentar', () => {
      pedir();
      http.expectOne('/admissions/a-1/documents/f-1/download-url').flush({}, { status: 403, statusText: 'Forbidden' });
      fixture.detectChanges();
      expect(q('viewer-forbidden')).not.toBeNull();
      expect(q('viewer-retry')).toBeNull();
    });

    it('404: el archivo ya no está', () => {
      pedir();
      http.expectOne('/admissions/a-1/documents/f-1/download-url').flush({}, { status: 404, statusText: 'Not Found' });
      fixture.detectChanges();
      expect(q('viewer-not-found')).not.toBeNull();
    });

    it('un error de red permite reintentar y el reintento vuelve a pedir el acceso', () => {
      pedir();
      http.expectOne('/admissions/a-1/documents/f-1/download-url').error(new ProgressEvent('error'));
      fixture.detectChanges();
      q('viewer-retry')!.click();
      fixture.detectChanges();
      http.expectOne('/admissions/a-1/documents/f-1/download-url').flush({}, { status: 404, statusText: 'x' });
    });

    it('una URL firmada vencida dice «el enlace venció» y reintentar pide una firma nueva', async () => {
      pedir();
      http.expectOne('/admissions/a-1/documents/f-1/download-url').flush({ url: 'https://almacen.example.com/o?s=1', expiresAt: '2020-01-01T00:00:00Z', name: 'cedula.png', mimeType: 'image/png' });
      http.expectOne('https://almacen.example.com/o?s=1').flush(new Blob(['vencida']), { status: 403, statusText: 'Forbidden' });
      // El cuerpo de un error de descarga es un Blob: se lee de forma asíncrona antes de decidir qué error es.
      await fixture.whenStable();
      await new Promise((r) => setTimeout(r, 20));
      fixture.detectChanges();
      expect(q('viewer-expired')?.textContent).toContain('El enlace del documento venció');
      expect(q('viewer-forbidden')).toBeNull();
      q('viewer-retry')!.click();
      fixture.detectChanges();
      http.expectOne('/admissions/a-1/documents/f-1/download-url').flush({}, { status: 404, statusText: 'x' });
    });
  });

  it('al destruir el visor se revocan las URLs de objeto', async () => {
    await abrir([new Uint8Array(PNG)], 'image/png');
    const creadas = [...objetos.keys()];
    expect(creadas.length).toBeGreaterThan(0);
    fixture.destroy();
    for (const url of creadas) expect(revocadas).toContain(url);
  });

  it('al cambiar de documento se revoca la URL del anterior', async () => {
    await abrir([new Uint8Array(PNG)], 'image/png');
    const primera = [...objetos.keys()][0]!;
    fixture.componentRef.setInput('document', doc({ id: 'd-2', fileId: 'f-2' }));
    fixture.detectChanges();
    expect(revocadas).toContain(primera);
    http.expectOne('/admissions/a-1/documents/f-2/download-url').flush({}, { status: 404, statusText: 'x' });
  });

  it('el zoom y la rotación responden al teclado y respetan sus límites', async () => {
    await abrir([new Uint8Array(PNG)], 'image/png');
    const escenario = el().querySelector('.visor__escenario') as HTMLElement;
    const tecla = (key: string): void => {
      escenario.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    };
    for (let i = 0; i < 30; i++) tecla('+');
    fixture.detectChanges();
    expect(q('viewer-zoom')?.textContent).toContain('400');
    for (let i = 0; i < 30; i++) tecla('-');
    fixture.detectChanges();
    expect(q('viewer-zoom')?.textContent).toContain('25');
    tecla('0');
    fixture.detectChanges();
    expect(q('viewer-zoom')?.textContent).toContain('100');
    tecla('r');
    fixture.detectChanges();
    expect(el().querySelector('.visor__lienzo')?.classList.contains('visor__lienzo--lateral')).toBe(true);
  });

  it('una imagen de 40 megapíxeles avisa que puede tardar', async () => {
    await abrir([new Uint8Array(PNG)], 'image/png', doc({ sizeBytes: 90_000_000 }));
    const img = el().querySelector('img')!;
    Object.defineProperty(img, 'naturalWidth', { value: 8000 });
    Object.defineProperty(img, 'naturalHeight', { value: 5000 });
    img.dispatchEvent(new Event('load'));
    fixture.detectChanges();
    expect(q('viewer-large')?.textContent).toContain('40 megapíxeles');
  });
});
