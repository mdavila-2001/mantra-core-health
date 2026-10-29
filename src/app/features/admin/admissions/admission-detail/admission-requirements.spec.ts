import { TestBed, type ComponentFixture } from '@angular/core/testing';

import type { AdmissionDocument, AdmissionRequirement } from '@core/data-access/admissions/admissions.types';
import { AdmissionRequirements, DOCUMENTS_VISIBLE } from './admission-requirements';

function req(id: string, extra: Partial<AdmissionRequirement> = {}): AdmissionRequirement {
  return {
    id, code: id.toUpperCase(), label: `Requisito ${id}`, description: 'Descripción.', mandatory: true, status: 'PENDING',
    documents: [], data: [{ label: 'Número', value: '123' }], itemRef: null, source: null, evidenceSha256: null,
    reasonCode: null, reasonText: null, internalNote: null, reviewedAt: null, reviewedBy: null, ...extra,
  };
}

const docs = (code: string, n: number): AdmissionDocument[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `${code}-${i}`, requirementCode: code, fileId: `f-${code}-${i}`, name: `${code}-${i}.pdf`, mimeType: 'application/pdf',
    sizeBytes: 1000, uploadedAt: null, pages: null, reviewState: 'PENDING' as const, evidenceSha256: null,
  }));

describe('AdmissionRequirements', () => {
  let fixture: ComponentFixture<AdmissionRequirements>;
  const pedidos: unknown[] = [];

  function montar(requirements: AdmissionRequirement[], documents: AdmissionDocument[] = [], extra: { canReview?: boolean; busy?: boolean } = {}): void {
    fixture = TestBed.createComponent(AdmissionRequirements);
    fixture.componentRef.setInput('requirements', requirements);
    fixture.componentRef.setInput('documents', documents);
    fixture.componentRef.setInput('canReview', extra.canReview ?? true);
    fixture.componentRef.setInput('busy', extra.busy ?? false);
    pedidos.length = 0;
    fixture.componentInstance.review.subscribe((r) => pedidos.push(r));
    fixture.detectChanges();
  }

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const q = (id: string): HTMLElement | null => el().querySelector(`[data-testid="${id}"]`);
  const all = (id: string): HTMLElement[] => [...el().querySelectorAll<HTMLElement>(`[data-testid="${id}"]`)];

  it('resume el avance y nombra los obligatorios que faltan', () => {
    montar([req('a', { status: 'VERIFIED' }), req('b'), req('c', { mandatory: false })]);
    expect(q('requirements-progress')?.textContent).toBe('1 de 3 requisitos verificados');
    expect(q('requirements-missing')?.textContent).toContain('Requisito b');
    expect(q('requirements-missing')?.textContent).not.toContain('Requisito c');
    expect(el().querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('1');
  });

  it('con todos los obligatorios verificados lo dice', () => {
    montar([req('a', { status: 'VERIFIED' })]);
    expect(q('requirements-complete')).not.toBeNull();
  });

  it('cada requisito dice si es obligatorio, su estado en palabras y sus datos', () => {
    montar([req('a', { mandatory: false, status: 'INFO_REQUIRED' })]);
    const fila = q('requirement-row')!;
    expect(fila.textContent).toContain('Opcional');
    expect(q('requirement-status')?.textContent).toContain('Información requerida');
    expect(fila.textContent).toContain('Número');
  });

  it('lo verificado muestra la fuente declarada, la fecha de consulta y quién lo revisó', () => {
    montar([req('a', {
      status: 'VERIFIED',
      source: { type: { code: 'MEDICAL_COLLEGE', label: 'Colegio Médico' }, ref: 'https://colegio.example/padron', consultedAt: new Date('2026-10-28T12:00:00Z') },
      reviewedAt: new Date('2026-10-28T12:30:00Z'), reviewedBy: { id: 'u', name: 'Marcelo Dávila' },
    })]);
    const fuente = q('requirement-source')!;
    expect(fuente.textContent).toContain('Colegio Médico');
    expect(fuente.textContent).toContain('consultada el 28/10/2026');
    expect(fuente.querySelector('a')?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(el().textContent).toContain('Revisado por Marcelo Dávila');
  });

  it('una fuente sin dirección (solo un comprobante) no se vuelve enlace', () => {
    montar([req('a', { status: 'VERIFIED', source: { type: { code: 'SEDES', label: 'SEDES' }, ref: 'Comprobante 4512', consultedAt: null } })]);
    expect(q('requirement-source')?.querySelector('a')).toBeNull();
    expect(q('requirement-source')?.textContent).toContain('Comprobante 4512');
  });

  it('lo rechazado muestra el código, el texto para el médico y la nota interna rotulada', () => {
    montar([req('a', { status: 'REJECTED', reasonCode: 'ILLEGIBLE', reasonText: 'No se lee.', internalNote: 'Sospecho del escaneo.' })]);
    expect(q('requirement-reason')?.textContent).toContain('Ilegible o cortado');
    expect(q('requirement-reason')?.textContent).toContain('No se lee.');
    expect(q('requirement-internal-note')?.textContent).toContain('Nota interna: no la ve el profesional.');
  });

  it('las tres decisiones salen con el requisito y la decisión; la ya tomada se deshabilita', () => {
    montar([req('a'), req('b', { status: 'VERIFIED' })]);
    all('requirement-verify')[0]!.click();
    all('requirement-reject')[0]!.click();
    all('requirement-info')[0]!.click();
    expect(pedidos).toEqual([
      { requirementId: 'a', decision: 'VERIFIED' },
      { requirementId: 'a', decision: 'REJECTED' },
      { requirementId: 'a', decision: 'INFO_REQUIRED' },
    ]);
    expect(all('requirement-verify')[1]!.getAttribute('aria-disabled')).toBe('true');
  });

  it('cada botón dice a qué requisito se refiere (lector de pantalla)', () => {
    montar([req('a')]);
    expect(q('requirement-verify')?.getAttribute('aria-label')).toBe('Verificar Requisito a');
  });

  it('con la revisión ocupada no emite (doble clic)', () => {
    montar([req('a')], [], { busy: true });
    q('requirement-verify')!.click();
    expect(pedidos).toEqual([]);
  });

  it('sin permiso de revisar no hay botones de decisión', () => {
    montar([req('a')], [], { canReview: false });
    expect(q('requirement-verify')).toBeNull();
  });

  describe('los documentos', () => {
    it('lista cada archivo con su tipo y tamaño y lo abre en el carrusel', () => {
      const vistos: string[] = [];
      montar([req('a')], docs('A', 2));
      fixture.componentInstance.viewDocument.subscribe((id) => vistos.push(id));
      expect(all('requirement-document')).toHaveLength(2);
      expect(all('requirement-document')[0]!.textContent).toContain('PDF');
      all('requirement-document')[1]!.click();
      expect(vistos).toEqual(['A-1']);
    });

    it(`con más de ${DOCUMENTS_VISIBLE} documentos muestra los primeros y «Ver todos (n)»`, () => {
      montar([req('a')], docs('A', 58));
      expect(all('requirement-document')).toHaveLength(DOCUMENTS_VISIBLE);
      const mas = el().querySelector<HTMLButtonElement>('.requisito__mas')!;
      expect(mas.textContent).toContain('Ver todos (58)');
      mas.click();
      fixture.detectChanges();
      expect(all('requirement-document')).toHaveLength(58);
      expect(el().querySelector('.requisito__mas')?.textContent).toContain('Ver menos');
    });

    it('sin documentos lo dice', () => {
      montar([req('a')]);
      expect(el().textContent).toContain('El médico no subió documentos para este requisito.');
    });
  });

  it('sin requisitos cargados explica por qué no se puede verificar', () => {
    montar([]);
    expect(el().textContent).toContain('Esta admisión no tiene requisitos cargados');
  });
});
