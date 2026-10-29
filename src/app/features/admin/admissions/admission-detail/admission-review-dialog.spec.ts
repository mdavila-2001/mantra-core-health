import { TestBed, type ComponentFixture } from '@angular/core/testing';

import {
  AdmissionReviewDialog,
  type ReviewDialogConfig,
  type ReviewDialogResult,
} from './admission-review-dialog';

const FUENTE: ReviewDialogConfig = { heading: 'Verificar: Matrícula', confirmLabel: 'Verificar requisito', source: true };
const MOTIVO: ReviewDialogConfig = {
  heading: 'Rechazar', confirmLabel: 'Rechazar requisito', destructive: true,
  reason: { label: 'Qué está mal', withCode: true, note: true },
};

describe('AdmissionReviewDialog', () => {
  let fixture: ComponentFixture<AdmissionReviewDialog>;
  let resultados: ReviewDialogResult[];
  let cancelado: number;
  let recargas: number;

  function montar(config: ReviewDialogConfig, extra: { busy?: boolean; stale?: boolean; serverError?: string | null } = {}): void {
    resultados = [];
    cancelado = 0;
    recargas = 0;
    fixture = TestBed.createComponent(AdmissionReviewDialog);
    fixture.componentRef.setInput('config', config);
    if (extra.busy !== undefined) fixture.componentRef.setInput('busy', extra.busy);
    if (extra.stale !== undefined) fixture.componentRef.setInput('stale', extra.stale);
    if (extra.serverError !== undefined) fixture.componentRef.setInput('serverError', extra.serverError);
    fixture.componentInstance.confirmed.subscribe((r) => resultados.push(r));
    fixture.componentInstance.cancelled.subscribe(() => (cancelado += 1));
    fixture.componentInstance.reload.subscribe(() => (recargas += 1));
    fixture.detectChanges();
  }

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(testid: string): T | null => el().querySelector<T>(`[data-testid="${testid}"]`);
  const escribir = (selector: string, valor: string): void => {
    const campo = el().querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!;
    campo.value = valor;
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
  };
  const elegir = (testid: string, valor: string): void => {
    const s = q<HTMLSelectElement>(testid)!;
    s.value = valor;
    s.dispatchEvent(new Event('change', { bubbles: true }));
    fixture.detectChanges();
  };
  const confirmar = (): void => {
    q<HTMLButtonElement>('admission-review-confirm')!.click();
    fixture.detectChanges();
  };
  const textoDelMotivo = (): string => 'Documento cortado: no se lee el número.';

  describe('verificar un requisito: la fuente', () => {
    beforeEach(() => montar(FUENTE));

    it('sin elegir la fuente no confirma y lo dice', () => {
      confirmar();
      expect(resultados).toEqual([]);
      expect(el().textContent).toContain('Elija de dónde obtuvo el dato.');
      expect(q('admission-review-source-type')?.getAttribute('aria-invalid')).toBe('true');
    });

    it('la referencia es opcional: con solo el tipo confirma, con la fecha de hoy', () => {
      elegir('admission-review-source-type', 'MINSALUD_REGISTRY');
      confirmar();
      expect(resultados).toHaveLength(1);
      expect(resultados[0]).toMatchObject({ sourceType: 'MINSALUD_REGISTRY' });
      expect(resultados[0]!.sourceConsultedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect('sourceRef' in resultados[0]!).toBe(false);
    });

    it('con referencia la manda recortada; no obliga a que sea una dirección web', () => {
      elegir('admission-review-source-type', 'PROVIDED_DOCUMENT');
      escribir('[data-testid="admission-review-source-ref"] input, input[data-testid="admission-review-source-ref"]', '  Comprobante N.º 4512  ');
      confirmar();
      expect(resultados[0]).toMatchObject({ sourceType: 'PROVIDED_DOCUMENT', sourceRef: 'Comprobante N.º 4512' });
    });

    it('«Otra fuente» exige describirla', () => {
      elegir('admission-review-source-type', 'OTHER');
      confirmar();
      expect(resultados).toEqual([]);
      expect(el().textContent).toContain('Describa la fuente que consultó.');
    });

    it('una fecha de consulta futura no se acepta', () => {
      elegir('admission-review-source-type', 'SEDES');
      escribir('[data-testid="admission-review-consulted-at"]', '2999-01-01');
      confirmar();
      expect(resultados).toEqual([]);
      expect(el().textContent).toContain('no puede ser futura');
    });

    it('ofrece las seis fuentes, sin inventar una dirección', () => {
      const opciones = [...q<HTMLSelectElement>('admission-review-source-type')!.options].map((o) => o.textContent?.trim());
      expect(opciones).toEqual([
        'Elija una fuente…', 'Registro del Ministerio de Salud', 'Colegio Médico', 'SEDES', 'SEGIP',
        'Documento aportado por el médico', 'Otra fuente',
      ]);
    });
  });

  describe('rechazar o pedir información: el motivo estructurado', () => {
    beforeEach(() => montar(MOTIVO));

    it('exige el código y el texto, y los dice por separado', () => {
      confirmar();
      expect(resultados).toEqual([]);
      expect(el().textContent).toContain('Elija el motivo.');
      expect(el().textContent).toContain('Escriba el motivo.');
    });

    it('manda el código, el texto que ve el médico y la nota interna separada', () => {
      elegir('admission-review-reason-code', 'ILLEGIBLE');
      escribir('textarea', textoDelMotivo());
      const notas = el().querySelectorAll('textarea');
      notas[1]!.value = 'Se parece a otro expediente.';
      notas[1]!.dispatchEvent(new Event('input', { bubbles: true }));
      fixture.detectChanges();
      confirmar();
      expect(resultados).toEqual([{ reasonCode: 'ILLEGIBLE', reason: textoDelMotivo(), internalNote: 'Se parece a otro expediente.' }]);
    });

    it('rotula la nota interna como lo que es: el profesional no la ve', () => {
      expect(el().textContent).toContain('Nota interna: no la ve el profesional');
    });

    it('la nota interna es opcional', () => {
      elegir('admission-review-reason-code', 'OTHER');
      escribir('textarea', textoDelMotivo());
      confirmar();
      expect(resultados).toEqual([{ reasonCode: 'OTHER', reason: textoDelMotivo() }]);
    });

    it('el motivo: 4 caracteres es corto, 5 y 500 pasan, 501 no', () => {
      elegir('admission-review-reason-code', 'OTHER');
      const intentar = (n: number): number => {
        escribir('textarea', 'a'.repeat(n));
        confirmar();
        return resultados.length;
      };
      expect(intentar(4)).toBe(0);
      expect(intentar(501)).toBe(0);
      expect(q('admission-review-count')?.textContent).toContain('501 / 500');
      expect(el().textContent).toContain('sobran 1');
      expect(intentar(500)).toBe(1);
      expect(intentar(5)).toBe(2);
    });

    it('un motivo con emoji y espacios en los bordes se recorta y pasa', () => {
      elegir('admission-review-reason-code', 'OTHER');
      escribir('textarea', '   Falta el sello 🩺   ');
      confirmar();
      expect(resultados[0]!.reason).toBe('Falta el sello 🩺');
    });

    it('el botón destructivo es de error', () => {
      expect(q('admission-review-confirm')?.className).toMatch(/danger|error/);
    });
  });

  it('la decisión final solo confirma: sin campos, con su aviso y su resumen', () => {
    montar({
      heading: 'Verificar al profesional', confirmLabel: 'Verificar al profesional',
      warning: 'Es la decisión final.', summary: ['5 de 5 requisitos verificados'],
    });
    expect(q('admission-review-warning')?.textContent).toContain('Es la decisión final.');
    expect(q('admission-review-summary')?.textContent).toContain('5 de 5');
    confirmar();
    expect(resultados).toEqual([{}]);
  });

  it('reasignar exige elegir a una persona', () => {
    montar({ heading: 'Reasignar', confirmLabel: 'Reasignar', assignees: [{ id: 'u1', name: 'Rosario Quispe' }] });
    confirmar();
    expect(resultados).toEqual([]);
    elegir('admission-review-assignee', 'u1');
    confirmar();
    expect(resultados).toEqual([{ assigneeId: 'u1' }]);
  });

  describe('mientras viaja', () => {
    it('con `busy` no confirma ni cancela: un doble clic no manda dos veces', () => {
      montar(FUENTE, { busy: true });
      elegir('admission-review-source-type', 'SEDES');
      q<HTMLButtonElement>('admission-review-confirm')!.click();
      q<HTMLButtonElement>('admission-review-confirm')!.click();
      expect(resultados).toEqual([]);
      (fixture.componentInstance as unknown as { cancel(): void }).cancel();
      expect(cancelado).toBe(0);
    });

    it('un doble clic con el diálogo libre emite una vez por clic: el anfitrión es quien bloquea con `busy`', () => {
      montar(FUENTE);
      elegir('admission-review-source-type', 'SEDES');
      confirmar();
      expect(resultados).toHaveLength(1);
    });
  });

  describe('los errores del servidor', () => {
    it('un 412 se muestra dentro del diálogo, sin cerrarlo', () => {
      montar(FUENTE, { serverError: 'Falta la fuente.' });
      expect(q('admission-review-error')?.textContent).toContain('Falta la fuente.');
      expect(cancelado).toBe(0);
    });

    it('un 409 conserva lo escrito y ofrece «Ver cambios»', () => {
      montar(MOTIVO);
      elegir('admission-review-reason-code', 'NAME_MISMATCH');
      escribir('textarea', textoDelMotivo());
      fixture.componentRef.setInput('stale', true);
      fixture.detectChanges();
      expect(q('admission-review-stale')?.textContent).toContain('Otra persona modificó esta admisión');
      expect(el().querySelector('textarea')!.value).toBe(textoDelMotivo());
      expect(q<HTMLSelectElement>('admission-review-reason-code')!.value).toBe('NAME_MISMATCH');
      q<HTMLButtonElement>('admission-review-reload')!.click();
      expect(recargas).toBe(1);
      // Ya con los cambios a la vista, confirma lo mismo que había escrito.
      fixture.componentRef.setInput('stale', false);
      fixture.detectChanges();
      confirmar();
      expect(resultados[0]).toMatchObject({ reasonCode: 'NAME_MISMATCH', reason: textoDelMotivo() });
    });
  });
});
