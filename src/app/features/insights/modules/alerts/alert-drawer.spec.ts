import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';

import type { MarketingAlert } from '../../domain/insights.types';
import { InsightsWorkflow } from '../../insights-workflow';
import { AlertDrawer } from './alert-drawer';

/**
 * El detalle de una alerta de marketing y su ciclo (nuevo → en revisión →
 * resuelta/descartada, reabrir). El cajón no guarda: le pide el cambio al
 * workflow, que habla con la API; mientras trabaja, los controles se apagan.
 * La causa se rotula como hipótesis, no como hecho.
 */

const ALERTA: MarketingAlert = {
  id: 'AL-7',
  severity: 'anomaly',
  title: 'Salto de CPC en Google',
  what: 'El CPC subió 40 %.',
  detectedAt: '2026-10-29T10:00:00Z',
  magnitude: '+40 %',
  source: 'Google Ads',
  cause: 'Competencia por la palabra clave',
  impact: 'Menos clics con el mismo presupuesto',
  confidence: 'high',
  recommendation: 'Revisar pujas.',
  evidence: ['CPC 7 días', 'Cuota de impresiones'],
  module: 'campaigns',
  query: { channel: 'google' },
  series: [1, 2],
  status: 'open',
};

describe('AlertDrawer', () => {
  let fixture: ComponentFixture<AlertDrawer>;
  const estado = signal<string>('new');
  const responsable = signal<string | null>(null);
  const ocupado = signal(false);
  let setAlert: ReturnType<typeof vi.fn>;
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const boton = (texto: string): HTMLButtonElement | undefined =>
    Array.from(root().querySelectorAll<HTMLButtonElement>('.ad__actions button')).find((b) => b.textContent?.trim() === texto);

  beforeEach(() => {
    estado.set('new');
    responsable.set(null);
    ocupado.set(false);
    setAlert = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: InsightsWorkflow,
          useValue: {
            statusOf: () => estado(),
            ownerOf: () => responsable(),
            busy: ocupado,
            workflow: signal({ 'AL-7': { transitions: [{ at: '2026-10-29T11:00:00Z', fromStatus: null, toStatus: 'new', toOwner: null }] } }),
            setAlert,
          },
        },
      ],
    });
    fixture = TestBed.createComponent(AlertDrawer);
    fixture.componentRef.setInput('alert', ALERTA);
    fixture.detectChanges();
  });

  it('muestra qué pasó, por qué importa, la causa como hipótesis, evidencia y fuente', () => {
    expect(root().querySelector('.ad__title')?.textContent).toBe('Salto de CPC en Google');
    expect(root().textContent).toContain('Posible causa (hipótesis, no confirmada)');
    expect(root().querySelectorAll('.ad__facts li')).toHaveLength(2);
    expect(root().querySelector('.ad__meta')?.textContent).toContain('Confianza Alta');
    expect(root().querySelector('.ad__status')?.textContent).toBe('Nuevo');
  });

  it('nueva: «En revisión» pide el cambio al workflow con el responsable actual', () => {
    boton('En revisión')!.click();
    expect(setAlert).toHaveBeenCalledWith(ALERTA, 'in_progress', null);
  });

  it('asignar responsable conserva el estado', () => {
    const select = root().querySelector<HTMLSelectElement>('.ad__owner select')!;
    select.value = 'marketing';
    select.dispatchEvent(new Event('change'));
    expect(setAlert).toHaveBeenCalledWith(ALERTA, 'new', 'marketing');
  });

  it('resuelta: sólo ofrece reabrir', () => {
    estado.set('resolved');
    fixture.componentRef.setInput('alert', { ...ALERTA });
    fixture.detectChanges();
    expect(boton('Marcar resuelta')).toBeUndefined();
    boton('Reabrir')!.click();
    expect(setAlert).toHaveBeenCalledWith(expect.objectContaining({ id: 'AL-7' }), 'new', null);
  });

  it('mientras el workflow trabaja, los controles se apagan', () => {
    ocupado.set(true);
    fixture.detectChanges();
    expect(boton('Descartar')!.disabled).toBe(true);
    expect(root().querySelector<HTMLSelectElement>('.ad__owner select')!.disabled).toBe(true);
  });

  it('«Ver datos» lleva al módulo con el filtro de la alerta, y hay historial', () => {
    expect(root().querySelector('a.ad__btn')?.getAttribute('href')).toBe('/insights/campaigns?channel=google');
    expect(root().querySelectorAll('.ad__hist li')).toHaveLength(1);
    expect(root().querySelector('.ad__hist li')?.textContent).toContain('Alta → Nuevo');
  });
});
