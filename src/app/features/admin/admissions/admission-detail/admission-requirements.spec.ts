import { TestBed, type ComponentFixture } from '@angular/core/testing';

import type {
  AdmissionDocument,
  AdmissionRequirement,
  AdmissionReviewItem,
  RequirementsSummary,
} from '@core/data-access/admissions/admissions.types';
import { AdmissionRequirements, ITEMS_VISIBLE } from './admission-requirements';

/** Una ficha (matrícula, título…) de un requisito, tal como la entrega el cliente. */
function item(id: string, extra: Partial<AdmissionReviewItem> = {}): AdmissionReviewItem {
  return {
    id: `rev-${id}`, itemId: `item-${id}`, itemType: 'LICENSE', label: `Ficha ${id}`, state: 'PENDING', fileId: null, source: null,
    reasonCode: null, reasonText: null, internalNote: null, reviewedBy: null, reviewedAt: null, evidenceChanged: false,
    evidenceSha256: 'a'.repeat(64), rowVersion: 2, ...extra,
  };
}

/** Un requisito con una ficha; el estado del requisito sigue al de su ficha salvo que la prueba diga otra cosa. */
function req(code: string, extra: Partial<AdmissionRequirement> = {}): AdmissionRequirement {
  const items = extra.items ?? [item(code)];
  const state = extra.state ?? items[0]?.state ?? 'MISSING';
  return {
    code, label: `Requisito ${code}`, description: 'Descripción.', mandatory: true, evidenceKind: 'DOCUMENT', requiresSource: true,
    minItems: 1, maxItems: 1, satisfied: state === 'VERIFIED', blockedBy: state === 'VERIFIED' ? null : state, ...extra, items, state,
  };
}

/** El avance que calcula la API (la pantalla lo muestra tal cual). */
function resumen(requirements: readonly AdmissionRequirement[]): RequirementsSummary {
  return {
    total: requirements.length,
    verified: requirements.filter((r) => r.state === 'VERIFIED').length,
    rejected: requirements.filter((r) => r.state === 'REJECTED').length,
    pending: requirements.filter((r) => r.state === 'PENDING' || r.state === 'INFO_REQUIRED').length,
  };
}

const doc = (fileId: string, id = `doc-${fileId}`): AdmissionDocument => ({
  id, requirementCode: 'A', fileId, name: `${fileId}.pdf`, mimeType: 'application/pdf',
  sizeBytes: 1000, uploadedAt: null, pages: null, reviewState: 'PENDING', evidenceSha256: null,
});

describe('AdmissionRequirements', () => {
  let fixture: ComponentFixture<AdmissionRequirements>;
  const pedidos: unknown[] = [];

  function montar(requirements: AdmissionRequirement[], documents: AdmissionDocument[] = [], extra: { canReview?: boolean; busy?: boolean } = {}): void {
    fixture = TestBed.createComponent(AdmissionRequirements);
    fixture.componentRef.setInput('requirements', requirements);
    fixture.componentRef.setInput('documents', documents);
    fixture.componentRef.setInput('summary', resumen(requirements));
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
    montar([req('a', { state: 'VERIFIED', items: [item('a', { state: 'VERIFIED' })] }), req('b'), req('c', { mandatory: false })]);
    expect(q('requirements-progress')?.textContent).toBe('1 de 3 requisitos verificados');
    expect(q('requirements-missing')?.textContent).toContain('Requisito b');
    expect(q('requirements-missing')?.textContent).not.toContain('Requisito c');
    expect(el().querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('1');
  });

  it('el avance es el que calculó la API, no uno recontado en la pantalla', () => {
    montar([req('a'), req('b')]);
    fixture.componentRef.setInput('summary', { total: 7, verified: 5, rejected: 1, pending: 1 });
    fixture.detectChanges();
    expect(q('requirements-progress')?.textContent).toBe('5 de 7 requisitos verificados, 1 rechazado');
    expect(el().querySelector('[role="progressbar"]')?.getAttribute('aria-valuemax')).toBe('7');
  });

  it('con todos los obligatorios verificados lo dice', () => {
    montar([req('a', { state: 'VERIFIED', items: [item('a', { state: 'VERIFIED' })] })]);
    expect(q('requirements-complete')).not.toBeNull();
  });

  it('cada requisito dice si es obligatorio, su estado en palabras y sus fichas', () => {
    montar([req('a', { mandatory: false, state: 'INFO_REQUIRED', items: [item('a', { state: 'INFO_REQUIRED', label: 'Matrícula MP-2404' })] })]);
    const fila = q('requirement-row')!;
    expect(fila.textContent).toContain('Opcional');
    expect(q('requirement-status')?.textContent).toContain('Información requerida');
    expect(q('item-status')?.textContent).toContain('Información requerida');
    expect(fila.textContent).toContain('Matrícula MP-2404');
  });

  it('lo verificado muestra la fuente declarada, la fecha de consulta y quién lo revisó', () => {
    montar([req('a', {
      state: 'VERIFIED',
      items: [item('a', {
        state: 'VERIFIED',
        source: { type: { code: 'MEDICAL_COLLEGE', label: 'Colegio Médico' }, ref: 'https://colegio.example/padron', consultedAt: new Date('2026-10-28T12:00:00Z') },
        reviewedAt: new Date('2026-10-28T12:30:00Z'), reviewedBy: { id: 'u', name: 'Marcelo Dávila' },
      })],
    })]);
    const fuente = q('requirement-source')!;
    expect(fuente.textContent).toContain('Colegio Médico');
    expect(fuente.textContent).toContain('consultada el 28/10/2026');
    expect(fuente.querySelector('a')?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(el().textContent).toContain('Revisado por Marcelo Dávila');
  });

  it('una fuente sin dirección (solo un comprobante) no se vuelve enlace', () => {
    montar([req('a', {
      state: 'VERIFIED',
      items: [item('a', { state: 'VERIFIED', source: { type: { code: 'SEDES', label: 'SEDES' }, ref: 'Comprobante 4512', consultedAt: null } })],
    })]);
    expect(q('requirement-source')?.querySelector('a')).toBeNull();
    expect(q('requirement-source')?.textContent).toContain('Comprobante 4512');
  });

  it('lo rechazado muestra el código, el texto para el médico y la nota interna rotulada', () => {
    montar([req('a', {
      state: 'REJECTED',
      items: [item('a', { state: 'REJECTED', reasonCode: 'ILLEGIBLE', reasonText: 'No se lee.', internalNote: 'Sospecho del escaneo.' })],
    })]);
    expect(q('requirement-reason')?.textContent).toContain('Ilegible o cortado');
    expect(q('requirement-reason')?.textContent).toContain('No se lee.');
    expect(q('requirement-internal-note')?.textContent).toContain('Nota interna: no la ve el profesional.');
  });

  it('las tres decisiones salen con la ficha, su requisito y la decisión; la ya tomada se deshabilita', () => {
    montar([req('a'), req('b', { state: 'VERIFIED', items: [item('b', { state: 'VERIFIED' })] })]);
    all('requirement-verify')[0]!.click();
    all('requirement-reject')[0]!.click();
    all('requirement-info')[0]!.click();
    expect(pedidos).toEqual([
      { itemId: 'item-a', requirementCode: 'a', decision: 'VERIFIED' },
      { itemId: 'item-a', requirementCode: 'a', decision: 'REJECTED' },
      { itemId: 'item-a', requirementCode: 'a', decision: 'INFO_REQUIRED' },
    ]);
    expect(all('requirement-verify')[1]!.getAttribute('aria-disabled')).toBe('true');
  });

  it('cada ficha se revisa por separado: el pedido nombra SU ficha, no la de al lado', () => {
    montar([req('a', { maxItems: 2, items: [item('a1'), item('a2')] })]);
    all('requirement-reject')[1]!.click();
    expect(pedidos).toEqual([{ itemId: 'item-a2', requirementCode: 'a', decision: 'REJECTED' }]);
  });

  it('cada botón dice a qué ficha se refiere (lector de pantalla)', () => {
    montar([req('a')]);
    expect(q('requirement-verify')?.getAttribute('aria-label')).toBe('Verificar Ficha a');
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

  it('una ficha sin revisión materializada (la admisión no se tomó) no se puede decidir', () => {
    montar([req('a', { items: [item('a', { id: null, rowVersion: null })] })]);
    expect(q('requirement-verify')?.getAttribute('aria-disabled')).toBe('true');
    q('requirement-verify')!.click();
    expect(pedidos).toEqual([]);
  });

  it('si el médico cambió la ficha después de verificarla avisa y vuelve a permitir verificar', () => {
    montar([req('a', { state: 'VERIFIED', items: [item('a', { state: 'VERIFIED', evidenceChanged: true })] })]);
    expect(q('item-evidence-changed')?.textContent).toContain('revísela de nuevo');
    expect(q('requirement-verify')?.getAttribute('aria-disabled')).not.toBe('true');
  });

  describe('los documentos', () => {
    it('muestra el archivo de cada ficha con su tipo y tamaño y lo abre en el carrusel', () => {
      const vistos: string[] = [];
      montar([req('a', { maxItems: 2, items: [item('a1', { fileId: 'f-1' }), item('a2', { fileId: 'f-2' })] })], [doc('f-1'), doc('f-2')]);
      fixture.componentInstance.viewDocument.subscribe((id) => vistos.push(id));
      expect(all('requirement-document')).toHaveLength(2);
      expect(all('requirement-document')[0]!.textContent).toContain('PDF');
      all('requirement-document')[1]!.click();
      expect(vistos).toEqual(['doc-f-2']);
    });

    it(`con más de ${ITEMS_VISIBLE} fichas muestra las primeras y «Ver todas (n)»`, () => {
      const fichas = Array.from({ length: 58 }, (_, i) => item(`x${i}`, { fileId: `f-${i}` }));
      montar([req('a', { maxItems: null, items: fichas })], fichas.map((f) => doc(f.fileId!)));
      expect(all('requirement-item')).toHaveLength(ITEMS_VISIBLE);
      expect(all('requirement-document')).toHaveLength(ITEMS_VISIBLE);
      const mas = el().querySelector<HTMLButtonElement>('.requisito__mas')!;
      expect(mas.textContent).toContain('Ver todas (58)');
      mas.click();
      fixture.detectChanges();
      expect(all('requirement-item')).toHaveLength(58);
      expect(el().querySelector('.requisito__mas')?.textContent).toContain('Ver menos');
    });

    it('una ficha de un requisito documental sin archivo lo dice', () => {
      montar([req('a')]);
      expect(el().textContent).toContain('Sin documento adjunto.');
    });

    it('un requisito sin fichas explica que el médico no lo aportó', () => {
      montar([req('a', { state: 'MISSING', items: [] })]);
      expect(q('requirement-empty')?.textContent).toContain('El médico todavía no aportó este requisito.');
    });
  });

  it('sin requisitos cargados explica por qué no se puede verificar', () => {
    montar([]);
    expect(el().textContent).toContain('Esta admisión no tiene requisitos cargados');
  });
});
