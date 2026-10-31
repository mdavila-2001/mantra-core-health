import { TestBed, type ComponentFixture } from '@angular/core/testing';

import type { AdmissionRequirement, SubmittedFormSection } from '@core/data-access/admissions/admissions.types';
import { AdmissionSubmittedForm } from './admission-submitted-form';

const SECCIONES: SubmittedFormSection[] = [
  {
    key: 'personal', title: 'Datos personales',
    fields: [
      { key: 'name', label: 'Nombres', value: 'Valeria', required: true, requirementCode: 'NATIONAL_ID', kind: 'TEXT' },
      { key: 'birth', label: 'Fecha de nacimiento', value: null, required: true, requirementCode: 'NATIONAL_ID', kind: 'TEXT' },
      { key: 'second', label: 'Segundo nombre', value: '', required: false, requirementCode: null, kind: 'TEXT' },
    ],
  },
  {
    key: 'home', title: 'Domicilio y ubicación',
    fields: [{ key: 'gps', label: 'Ubicación GPS', value: '-17.78330, -63.18210', required: false, requirementCode: null, kind: 'COORDINATES' }],
  },
];

const REQ: AdmissionRequirement = {
  code: 'NATIONAL_ID', label: 'Cédula de identidad', description: null, mandatory: true, evidenceKind: 'DATA', requiresSource: false,
  minItems: 1, maxItems: 1, state: 'PENDING', satisfied: false, blockedBy: 'PENDING',
  items: [{
    id: 'rev-ci', itemId: 'item-ci', itemType: 'PROFILE', label: 'Cédula 4567890', state: 'PENDING', fileId: null, source: null,
    reasonCode: null, reasonText: null, internalNote: null, reviewedBy: null, reviewedAt: null, evidenceChanged: false,
    evidenceSha256: 'e'.repeat(64), rowVersion: 2,
  }],
};

describe('AdmissionSubmittedForm', () => {
  let fixture: ComponentFixture<AdmissionSubmittedForm>;
  const decisiones: unknown[] = [];
  const evidencias: string[] = [];

  function montar(sections = SECCIONES, extra: { canReview?: boolean; documents?: number } = {}): void {
    fixture = TestBed.createComponent(AdmissionSubmittedForm);
    fixture.componentRef.setInput('sections', sections);
    fixture.componentRef.setInput('requirements', [REQ]);
    fixture.componentRef.setInput('documents', Array.from({ length: extra.documents ?? 2 }, (_, i) => ({ id: `d${i}`, requirementCode: 'NATIONAL_ID' })));
    fixture.componentRef.setInput('canReview', extra.canReview ?? true);
    decisiones.length = 0;
    evidencias.length = 0;
    fixture.componentInstance.review.subscribe((r) => decisiones.push(r));
    fixture.componentInstance.viewEvidence.subscribe((c) => evidencias.push(c));
    fixture.detectChanges();
  }

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const q = (id: string): HTMLElement | null => el().querySelector(`[data-testid="${id}"]`);

  it('es un formulario de solo lectura por secciones, con encabezado por sección', () => {
    montar();
    const secciones = [...el().querySelectorAll('[data-testid="form-section"] h3')].map((h) => h.textContent);
    expect(secciones).toEqual(['Datos personales', 'Domicilio y ubicación']);
    expect(el().querySelector('input, textarea, select')).toBeNull();
  });

  it('marca el dato obligatorio que falta y lo cuenta arriba, sin inventar el valor', () => {
    montar();
    expect(q('form-missing')?.textContent).toContain('Fecha de nacimiento');
    expect(q('form-missing')?.textContent).not.toContain('Segundo nombre');
    const faltante = [...el().querySelectorAll('.campo--falta')];
    expect(faltante).toHaveLength(1);
    expect(faltante[0]!.textContent).toContain('Falta este dato obligatorio');
  });

  it('un opcional vacío dice «No declarado», sin alarma', () => {
    montar();
    expect(el().textContent).toContain('No declarado');
  });

  it('las coordenadas ofrecen un enlace al mapa que no filtra la ventana', () => {
    montar();
    const enlace = el().querySelector<HTMLAnchorElement>('.campo__mapa')!;
    expect(enlace.href).toContain('openstreetmap.org');
    expect(enlace.href).toContain('mlat=-17.7833');
    expect(enlace.rel).toBe('noopener noreferrer');
    expect(enlace.target).toBe('_blank');
  });

  it('unas coordenadas ilegibles no inventan un enlace', () => {
    montar([{ key: 'h', title: 'Domicilio', fields: [{ key: 'g', label: 'GPS', value: 'sin datos', required: false, requirementCode: null, kind: 'COORDINATES' }] }]);
    expect(el().querySelector('.campo__mapa')).toBeNull();
  });

  it('cada requisito ligado a la sección muestra su estado, su huella y enlaza a la evidencia', () => {
    montar();
    const vinculo = q('form-requirement')!;
    expect(vinculo.textContent).toContain('Cédula de identidad');
    expect(vinculo.textContent).toContain('Pendiente');
    expect(q('form-hash')?.textContent).toContain('eeeeeeeeeeee…');
    q('form-view-evidence')!.click();
    expect(evidencias).toEqual(['NATIONAL_ID']);
    expect(q('form-view-evidence')?.textContent).toContain('(2)');
  });

  it('sin documentos del requisito no ofrece «Ver evidencia»', () => {
    montar(SECCIONES, { documents: 0 });
    expect(q('form-view-evidence')).toBeNull();
  });

  it('verificar o rechazar desde el formulario pide la misma decisión', () => {
    montar();
    const botones = [...q('form-requirement')!.querySelectorAll('button')];
    botones.find((b) => b.textContent?.includes('Verificar'))!.click();
    botones.find((b) => b.textContent?.includes('Rechazar'))!.click();
    expect(decisiones).toEqual([
      { itemId: 'item-ci', requirementCode: 'NATIONAL_ID', decision: 'VERIFIED' },
      { itemId: 'item-ci', requirementCode: 'NATIONAL_ID', decision: 'REJECTED' },
    ]);
  });

  it('un requisito con varias fichas no se decide desde acá: manda a revisarlas una por una', () => {
    const ficha = REQ.items[0]!;
    const varias: AdmissionRequirement = { ...REQ, maxItems: 2, items: [ficha, { ...ficha, id: 'rev-ci2', itemId: 'item-ci2' }] };
    montar();
    fixture.componentRef.setInput('requirements', [varias]);
    const pedidosFichas: string[] = [];
    fixture.componentInstance.viewRequirement.subscribe((c) => pedidosFichas.push(c));
    fixture.detectChanges();
    expect([...q('form-requirement')!.querySelectorAll('button')].some((b) => b.textContent?.includes('Verificar'))).toBe(false);
    q('form-review-items')!.click();
    expect(pedidosFichas).toEqual(['NATIONAL_ID']);
    expect(decisiones).toEqual([]);
  });

  it('sin permiso de revisar, solo se mira', () => {
    montar(SECCIONES, { canReview: false });
    expect([...q('form-requirement')!.querySelectorAll('button')].some((b) => b.textContent?.includes('Verificar'))).toBe(false);
  });

  it('sin formulario enviado lo dice', () => {
    montar([]);
    expect(el().textContent).toContain('No hay formulario enviado');
  });
});
