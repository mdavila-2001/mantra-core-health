import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import type {
  ExplainAccessResponse,
  ExplainAssume,
} from '../../../../core/data-access/access-governance/access-explain.types';
import { EXPLICACION_ANA_FUERA_DE_HORARIO, EXPLICACION_MARCOS } from '../simulator.fixtures';
import { ExplainResult, type ExplainAudience } from './explain-result';

describe('ExplainResult', () => {
  let fixture: ComponentFixture<ExplainResult>;
  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byId = (id: string): HTMLElement | null => host().querySelector(`[data-testid="${id}"]`);

  async function pintar(
    result: ExplainAccessResponse,
    audience: ExplainAudience = 'admin',
    assumed?: ExplainAssume,
  ): Promise<void> {
    fixture = TestBed.createComponent(ExplainResult);
    fixture.componentRef.setInput('result', result);
    fixture.componentRef.setInput('audience', audience);
    if (assumed !== undefined) fixture.componentRef.setInput('assumed', assumed);
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('el veredicto de un desafío dice ⚠ y «falta un requisito», con la oración del servidor', async () => {
    await pintar(EXPLICACION_MARCOS);
    const veredicto = byId('veredicto')!;
    expect(veredicto.getAttribute('data-efecto')).toBe('CHALLENGE');
    expect(veredicto.textContent).toContain('⚠');
    expect(veredicto.textContent).toContain('Puede, pero falta un requisito');
    expect(byId('explicacion-resumen')!.textContent).toContain(
      'faltan 6 horas y su permiso exige 24',
    );
    expect(veredicto.getAttribute('aria-live')).toBe('polite');
  });

  it('la traza sale paso a paso, en orden, y marca cuál decidió con palabras', async () => {
    await pintar(EXPLICACION_MARCOS);
    const pasos = Array.from(host().querySelectorAll('[data-testid="explicacion-pasos"] > li'));
    expect(pasos.length).toBe(8);
    expect(pasos[0]!.textContent).toContain('Pasó');
    const decisivo = byId('paso-7')!;
    expect(decisivo.textContent).toContain('No pasó');
    expect(decisivo.textContent).toContain('Decidió aquí');
    expect(decisivo.getAttribute('aria-current')).toBe('step');
    // Los números reales están detrás de «Ver el detalle», no a la vista.
    expect(decisivo.querySelector('details')!.textContent).toContain('minHours');
  });

  it('para el administrador muestra lo que puede cambiar; la persona ve a quién pedirlo', async () => {
    await pintar(EXPLICACION_MARCOS, 'admin');
    expect(byId('explicacion-arreglos')!.textContent).toContain('Bajar la anticipación mínima');
    expect(byId('explicacion-pedir')).toBeNull();
    await pintar(
      {
        ...EXPLICACION_MARCOS,
        adminFixes: undefined,
        askAdmin: 'Pida a su administrador que baje la anticipación mínima.',
      },
      'self',
    );
    expect(byId('explicacion-arreglos')).toBeNull();
    expect(byId('explicacion-pedir')!.textContent).toContain('Pida a su administrador');
    expect(host().textContent).toContain('Lo que usted puede hacer');
  });

  it('lista lo que falta, lo que se le pide, lo que se usó y los datos que verá', async () => {
    await pintar(EXPLICACION_MARCOS);
    expect(byId('explicacion-falta')!.textContent).toContain('Pida la aprobación del Dr. Suárez');
    expect(byId('explicacion-obligaciones')!.textContent).toContain(
      'Escribir el motivo (al menos 10 caracteres).',
    );
    expect(byId('explicacion-uso')!.textContent).toContain('3 de 20');
    expect(byId('explicacion-campos')!.textContent).toContain('Completo');
    expect(byId('explicacion-pie')!.textContent).toContain('2f3d2a5e');
  });

  it('una negación sin nada que hacer no inventa pendientes', async () => {
    await pintar(EXPLICACION_ANA_FUERA_DE_HORARIO);
    expect(byId('veredicto')!.textContent).toContain('No puede');
    expect(byId('explicacion-falta')).toBeNull();
    expect(byId('explicacion-obligaciones')).toBeNull();
  });

  it('«¿y si…?» emite los supuestos que se pisaron y recuerda con cuáles se calculó', async () => {
    await pintar(EXPLICACION_MARCOS, 'admin');
    const emitidos: (ExplainAssume | undefined)[] = [];
    fixture.componentInstance.assumeChanged.subscribe((a) => emitidos.push(a));
    const si = Array.from(
      host().querySelectorAll<HTMLButtonElement>(
        '[data-testid="explicacion-ysi"] button[data-value="YES"]',
      ),
    );
    expect(si.length).toBe(4);
    // El tercero es «Si tuviera la aprobación».
    si[2]!.click();
    fixture.detectChanges();
    expect(emitidos).toEqual([{ approvalGranted: true }]);
    byId('explicacion-ysi-limpiar')!.click();
    expect(emitidos[1]).toBeUndefined();
    await pintar(EXPLICACION_MARCOS, 'admin', { approvalGranted: true });
    expect(byId('explicacion-supuestos')!.textContent).toContain('si tuviera la aprobación');
  });

  it('el administrador puede pedir todos los pasos aunque una negación temprana corte la lista', async () => {
    await pintar(EXPLICACION_MARCOS, 'admin');
    expect(byId('explicacion-forzar')).not.toBeNull();
    await pintar(EXPLICACION_MARCOS, 'self');
    expect(byId('explicacion-forzar')).toBeNull();
  });
});
