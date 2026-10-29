import { Component, input, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import type { AdmissionDocument, AdmissionRequirement } from '@core/data-access/admissions/admissions.types';
import { AdmissionDocumentViewer } from './admission-document-viewer';
import { AdmissionEvidenceGallery, type GalleryReviewRequest } from './admission-evidence-gallery';

@Component({ selector: 'app-admission-document-viewer', template: '<div data-testid="viewer-stub">{{ document().name }}</div>' })
class ViewerStub {
  readonly admissionId = input.required<string>();
  readonly document = input.required<AdmissionDocument>();
}

function req(code: string, status: AdmissionRequirement['status'], extra: Partial<AdmissionRequirement> = {}): AdmissionRequirement {
  return {
    id: `r-${code}`, code, label: `Requisito ${code}`, description: null, mandatory: true, status, documents: [], data: [],
    itemRef: null, source: null, evidenceSha256: null, reasonCode: null, reasonText: null, internalNote: null,
    reviewedAt: null, reviewedBy: null, ...extra,
  };
}

function doc(n: number, code: string, extra: Partial<AdmissionDocument> = {}): AdmissionDocument {
  return {
    id: `d-${n}`, requirementCode: code, fileId: `f-${n}`, name: `archivo-${n}.pdf`, mimeType: 'application/pdf',
    sizeBytes: 2048, uploadedAt: new Date('2026-10-26T13:00:00Z'), pages: 1, reviewState: 'PENDING',
    evidenceSha256: `${n}`.repeat(64).slice(0, 64), ...extra,
  };
}

describe('AdmissionEvidenceGallery', () => {
  let fixture: ComponentFixture<AdmissionEvidenceGallery>;
  let pedidos: GalleryReviewRequest[];
  let campos: string[];

  const requisitos = [req('A', 'PENDING'), req('B', 'VERIFIED'), req('C', 'PENDING')];

  function montar(documents: readonly AdmissionDocument[], opciones: { canReview?: boolean; requirements?: readonly AdmissionRequirement[]; expanded?: boolean } = {}): void {
    TestBed.overrideComponent(AdmissionEvidenceGallery, {
      remove: { imports: [AdmissionDocumentViewer] },
      add: { imports: [ViewerStub] },
    });
    fixture = TestBed.createComponent(AdmissionEvidenceGallery);
    fixture.componentRef.setInput('admissionId', 'adm-1');
    fixture.componentRef.setInput('documents', documents);
    fixture.componentRef.setInput('requirements', opciones.requirements ?? requisitos);
    fixture.componentRef.setInput('canReview', opciones.canReview ?? true);
    fixture.componentRef.setInput('expanded', opciones.expanded ?? false);
    pedidos = [];
    campos = [];
    fixture.componentInstance.review.subscribe((r) => pedidos.push(r));
    fixture.componentInstance.showField.subscribe((c) => campos.push(c));
    fixture.detectChanges();
  }

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement = HTMLElement>(testid: string): T | null => el().querySelector<T>(`[data-testid="${testid}"]`);
  const contador = (): string => (q('gallery-counter')?.textContent ?? '').trim();
  const tecla = (key: string): void => {
    q('evidence-gallery')!.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    fixture.detectChanges();
  };
  const tresDocs = [doc(1, 'A'), doc(2, 'B'), doc(3, 'C')];

  describe('la vista', () => {
    beforeEach(() => montar(tresDocs));

    it('es un carrusel con nombre, contador anunciado y la vista grande del primero', () => {
      const region = q('evidence-gallery')!;
      expect(region.getAttribute('role')).toBe('region');
      expect(region.getAttribute('aria-roledescription')).toBe('carrusel');
      expect(region.getAttribute('aria-label')).toBe('Evidencia subida por el médico');
      expect(q('gallery-counter')?.getAttribute('aria-live')).toBe('polite');
      expect(contador()).toBe('1 de 3');
      expect(q('viewer-stub')?.textContent).toContain('archivo-1.pdf');
    });

    it('sobre cada documento: requisito, nombre, tipo, tamaño, fecha, huella y estado con punto y texto', () => {
      expect(q('gallery-requirement')?.textContent).toContain('Requisito A');
      expect(q('gallery-requirement')?.textContent).toContain('Obligatorio');
      expect(q('gallery-name')?.textContent).toBe('archivo-1.pdf');
      const info = q('gallery-info')!.textContent ?? '';
      expect(info).toContain('PDF');
      expect(info).toContain('2 KB');
      expect(info).toContain('26/10/2026');
      expect(q('gallery-hash')?.textContent).toContain('111111111111…');
      expect(q('gallery-hash')?.getAttribute('title')).toHaveLength(64);
      const estado = q('gallery-status')!;
      expect(estado.textContent).toContain('Pendiente');
      expect(estado.querySelector('.estado__punto')?.getAttribute('aria-hidden')).toBe('true');
    });

    it('cada miniatura dice en voz alta cuál es y en qué estado está', () => {
      const miniaturas = [...q('gallery-strip')!.querySelectorAll('button')];
      expect(miniaturas).toHaveLength(3);
      expect(miniaturas[1]!.getAttribute('aria-label')).toBe('Documento 2 de 3: archivo-2.pdf, Verificado');
      expect(miniaturas[0]!.getAttribute('aria-current')).toBe('true');
      expect(miniaturas[1]!.getAttribute('aria-current')).toBeNull();
    });
  });

  describe('la navegación', () => {
    beforeEach(() => montar(tresDocs));

    it('flechas del teclado, Inicio y Fin; no se pasa de los extremos', () => {
      tecla('ArrowRight');
      expect(contador()).toBe('2 de 3');
      tecla('ArrowRight');
      tecla('ArrowRight');
      expect(contador()).toBe('3 de 3');
      tecla('ArrowLeft');
      expect(contador()).toBe('2 de 3');
      tecla('Home');
      expect(contador()).toBe('1 de 3');
      tecla('ArrowLeft');
      expect(contador()).toBe('1 de 3');
      tecla('End');
      expect(contador()).toBe('3 de 3');
    });

    it('los botones de flecha se deshabilitan en los extremos', () => {
      expect(q('gallery-prev')?.getAttribute('aria-disabled')).toBe('true');
      q('gallery-next')!.click();
      fixture.detectChanges();
      expect(contador()).toBe('2 de 3');
      expect(q('gallery-prev')?.getAttribute('aria-disabled')).toBe('false');
    });

    it('una miniatura lleva directo a su documento', () => {
      [...q('gallery-strip')!.querySelectorAll('button')][2]!.click();
      fixture.detectChanges();
      expect(contador()).toBe('3 de 3');
      expect(q('gallery-name')?.textContent).toBe('archivo-3.pdf');
    });

    it('las teclas dentro de un selector son del selector, no del carrusel', () => {
      const select = q<HTMLSelectElement>('gallery-filter-requirement')!;
      select.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
      expect(contador()).toBe('1 de 3');
    });

    it('deslizar el dedo a la izquierda avanza y a la derecha retrocede, solo si el gesto es amplio', () => {
      const visor = el().querySelector('.galeria__visor') as HTMLElement;
      const tocar = (de: number, a: number): void => {
        visor.dispatchEvent(Object.assign(new Event('touchstart', { bubbles: true }), { touches: [{ clientX: de }] }));
        visor.dispatchEvent(Object.assign(new Event('touchend', { bubbles: true }), { changedTouches: [{ clientX: a }] }));
        fixture.detectChanges();
      };
      tocar(300, 100);
      expect(contador()).toBe('2 de 3');
      tocar(100, 130);
      expect(contador()).toBe('2 de 3');
      tocar(100, 300);
      expect(contador()).toBe('1 de 3');
    });

    it('Esc cierra solo la vista ampliada', () => {
      let cierres = 0;
      fixture.componentInstance.closeExpanded.subscribe(() => (cierres += 1));
      tecla('Escape');
      expect(cierres).toBe(0);
      fixture.componentRef.setInput('expanded', true);
      fixture.detectChanges();
      tecla('Escape');
      expect(cierres).toBe(1);
    });
  });

  describe('los filtros', () => {
    beforeEach(() => montar(tresDocs));

    const filtrar = (testid: string, valor: string): void => {
      const s = q<HTMLSelectElement>(testid)!;
      s.value = valor;
      s.dispatchEvent(new Event('change', { bubbles: true }));
      fixture.detectChanges();
    };

    it('por requisito: ofrece solo los que tienen documentos, con su cuenta', () => {
      const opciones = [...q<HTMLSelectElement>('gallery-filter-requirement')!.options].map((o) => o.textContent?.trim());
      expect(opciones).toEqual(['Todos', 'Requisito A (1)', 'Requisito B (1)', 'Requisito C (1)']);
      filtrar('gallery-filter-requirement', 'C');
      expect(contador()).toBe('1 de 1');
      expect(q('gallery-name')?.textContent).toBe('archivo-3.pdf');
    });

    it('por estado del requisito', () => {
      filtrar('gallery-filter-state', 'PENDING');
      expect(contador()).toBe('1 de 2');
      expect([...q('gallery-strip')!.querySelectorAll('button')]).toHaveLength(2);
    });

    it('sin coincidencias lo dice y deja quitar los filtros', () => {
      filtrar('gallery-filter-state', 'REJECTED');
      expect(q('gallery-no-match')?.textContent).toContain('Ningún documento coincide');
      expect(contador()).toBe('0 de 0');
      (q('gallery-no-match')!.querySelector('button') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(contador()).toBe('1 de 3');
    });
  });

  describe('decidir desde el carrusel', () => {
    it('Verificar, Rechazar y Pedir información piden la decisión sobre el requisito del documento en pantalla', () => {
      montar(tresDocs);
      q('gallery-verify')!.click();
      q('gallery-reject')!.click();
      q('gallery-info-required')!.click();
      expect(pedidos).toEqual([
        { requirementId: 'r-A', decision: 'VERIFIED' },
        { requirementId: 'r-A', decision: 'REJECTED' },
        { requirementId: 'r-A', decision: 'INFO_REQUIRED' },
      ]);
    });

    it('con la revisión ocupada no pide nada (doble clic)', () => {
      montar(tresDocs);
      fixture.componentRef.setInput('busy', true);
      fixture.detectChanges();
      (q('gallery-verify') as HTMLButtonElement).click();
      expect(pedidos).toEqual([]);
    });

    it('sin permiso de revisar no hay botones de decisión, pero sí el enlace al campo', () => {
      montar(tresDocs, { canReview: false });
      expect(q('gallery-verify')).toBeNull();
      q('gallery-show-field')!.click();
      expect(campos).toEqual(['A']);
    });

    it('al terminar una decisión salta al siguiente pendiente, dando la vuelta al final', () => {
      montar(tresDocs);
      expect(contador()).toBe('1 de 3');
      // El requisito A se verificó: el siguiente pendiente es C (B ya estaba verificado).
      fixture.componentRef.setInput('requirements', [req('A', 'VERIFIED'), req('B', 'VERIFIED'), req('C', 'PENDING')]);
      fixture.componentRef.setInput('advanceToken', 1);
      fixture.detectChanges();
      expect(contador()).toBe('3 de 3');
      // Se verifica C: no queda ninguno pendiente y se queda donde está.
      fixture.componentRef.setInput('requirements', [req('A', 'VERIFIED'), req('B', 'VERIFIED'), req('C', 'VERIFIED')]);
      fixture.componentRef.setInput('advanceToken', 2);
      fixture.detectChanges();
      expect(contador()).toBe('3 de 3');
    });

    it('da la vuelta: si los pendientes quedan antes, vuelve a ellos', () => {
      montar(tresDocs);
      tecla('End');
      fixture.componentRef.setInput('requirements', [req('A', 'PENDING'), req('B', 'VERIFIED'), req('C', 'VERIFIED')]);
      fixture.componentRef.setInput('advanceToken', 1);
      fixture.detectChanges();
      expect(contador()).toBe('1 de 3');
    });
  });

  describe('los límites y los vacíos', () => {
    it('sin documentos, un vacío que explica qué hacer', () => {
      montar([]);
      expect(el().textContent).toContain('Este médico no subió documentos');
      expect(q('gallery-counter')).toBeNull();
    });

    it('60 documentos con nombres de 200 caracteres: el contador, la tira y la navegación aguantan', () => {
      const muchos = Array.from({ length: 60 }, (_, i) => doc(i + 1, 'A', { name: `${'n'.repeat(190)}-${i + 1}.pdf` }));
      montar(muchos);
      expect(contador()).toBe('1 de 60');
      expect(q('gallery-strip')!.querySelectorAll('button')).toHaveLength(60);
      tecla('End');
      expect(contador()).toBe('60 de 60');
      expect(q('gallery-name')?.textContent).toHaveLength(197);
    });

    it('un documento sin requisito conocido se dice, no se inventa', () => {
      montar([doc(1, 'ZZZ')]);
      expect(q('gallery-requirement')?.textContent).toContain('Requisito sin identificar');
      expect(q('gallery-verify')).toBeNull();
    });

    it('sin fecha de carga ni tamaño se dice «Sin fecha registrada» y «Tamaño desconocido»', () => {
      montar([doc(1, 'A', { uploadedAt: null, sizeBytes: null, mimeType: null, evidenceSha256: null })]);
      const info = q('gallery-info')!.textContent ?? '';
      expect(info).toContain('Sin fecha registrada');
      expect(info).toContain('Tamaño desconocido');
      expect(info).toContain('Tipo desconocido');
      expect(info).toContain('Sin huella');
    });

    it('al ampliar, el botón cambia a «Cerrar vista ampliada»', () => {
      montar(tresDocs, { expanded: true });
      expect(q('gallery-collapse')).not.toBeNull();
      expect(q('gallery-expand')).toBeNull();
    });
  });

  it('si el documento elegido desaparece (otra versión de la ficha), cae en el primero', () => {
    montar(tresDocs);
    fixture.componentRef.setInput('selectedId', 'd-ya-no-existe');
    fixture.detectChanges();
    expect(contador()).toBe('1 de 3');
  });

  it('la selección es del anfitrión: se conserva al reconstruir la vista', () => {
    const elegido = signal<string | null>('d-2');
    montar(tresDocs);
    fixture.componentRef.setInput('selectedId', elegido());
    fixture.detectChanges();
    expect(contador()).toBe('2 de 3');
  });
});
