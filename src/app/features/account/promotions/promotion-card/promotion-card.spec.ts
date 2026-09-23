import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { etiquetaDeMultiplicador } from '../../loyalty/punto-motivo';
import { promocionesRecibidasDeEjemplo, type PromocionRecibida } from '../promotions.fixtures';
import { PromotionCard, type VarianteDeTarjeta } from './promotion-card';

/**
 * La tarjeta de una promoción recibida (T-E7). Lo que se fija: dice farmacia,
 * título, medicamento, descuento, vigencia y estado; el chip de puntos sale del
 * helper de «Mis puntos»; el CTA apunta al detalle público; la versión compacta
 * es la misma promoción, más corta; y nada de lo que pinta habla de la salud de
 * quien la recibe.
 */

const AHORA = new Date('2026-09-16T12:00:00');
const [NUEVA_CON_PUNTOS, LOTE, VENCIDA] = promocionesRecibidasDeEjemplo(AHORA);

/** El texto como lo lee una persona: sin los saltos de la plantilla. */
function normalizado(texto: string | null | undefined): string {
  return (texto ?? '').replace(/\s+/g, ' ').trim();
}

describe('PromotionCard', () => {
  let fixture: ComponentFixture<PromotionCard>;

  function montar(promocion: PromocionRecibida, variante: VarianteDeTarjeta = 'completa'): void {
    fixture = TestBed.createComponent(PromotionCard);
    fixture.componentRef.setInput('promocion', promocion);
    fixture.componentRef.setInput('variante', variante);
    fixture.detectChanges();
  }

  function porTestId(id: string): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${id}"]`);
  }

  function texto(): string {
    return normalizado((fixture.nativeElement as HTMLElement).textContent);
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  describe('completa', () => {
    it('dice farmacia, título, medicamento, descuento, vigencia y estado', () => {
      montar(NUEVA_CON_PUNTOS);

      expect(porTestId('promocion-tarjeta')?.getAttribute('data-variante')).toBe('completa');
      expect(normalizado(porTestId('promocion-farmacia')?.textContent)).toBe('Farmacia Central');
      expect(texto()).toContain(NUEVA_CON_PUNTOS.titulo);
      expect(normalizado(porTestId('promocion-medicamento')?.textContent)).toBe(
        'Paracetamol 500 mg',
      );
      expect(normalizado(porTestId('promocion-descuento')?.textContent)).toBe('20 % menos');
      expect(normalizado(porTestId('promocion-vigencia')?.textContent)).toMatch(
        /^Válida hasta el \d{1,2} de \S+$/,
      );
      expect(normalizado(porTestId('promocion-estado')?.textContent)).toBe('Nueva');
    });

    it('una promoción estándar no lleva chip de puntos ni motivo', () => {
      montar({ ...NUEVA_CON_PUNTOS, factorDePuntos: null });

      expect(porTestId('promocion-puntos')).toBeNull();
      expect(porTestId('promocion-motivo')).toBeNull();
      expect(porTestId('promocion-cta')).not.toBeNull();
    });

    it('el lote próximo a vencer lo dice como motivo', () => {
      montar(LOTE);

      expect(normalizado(porTestId('promocion-motivo')?.textContent)).toBe('Lote próximo a vencer');
      expect(normalizado(porTestId('promocion-estado')?.textContent)).toBe('Vista');
    });

    it('una vencida dice cuándo terminó', () => {
      montar(VENCIDA);

      expect(normalizado(porTestId('promocion-estado')?.textContent)).toBe('Vencida');
      expect(normalizado(porTestId('promocion-vigencia')?.textContent)).toMatch(/^Terminó el /);
    });
  });

  describe('Puntos x2', () => {
    it('el chip dice «Puntos» con el rótulo del helper de T-E6', () => {
      montar(NUEVA_CON_PUNTOS);

      expect(normalizado(porTestId('promocion-puntos')?.textContent)).toBe(
        `Puntos ${etiquetaDeMultiplicador('2')}`,
      );
      expect(normalizado(porTestId('promocion-puntos')?.textContent)).toBe('Puntos x2');
    });

    it('sigue al factor y no a un «x2» fijo', () => {
      montar({ ...NUEVA_CON_PUNTOS, factorDePuntos: ' 3 ' });

      expect(normalizado(porTestId('promocion-puntos')?.textContent)).toBe('Puntos x3');
    });
  });

  describe('CTA', () => {
    it('abre el detalle público de la campaña', () => {
      montar(NUEVA_CON_PUNTOS);

      const enlace = porTestId('promocion-cta') as HTMLAnchorElement | null;
      expect(enlace?.tagName).toBe('A');
      // Visible «Ver promoción»; el título completa el nombre para quien
      // recorre la lista de enlaces, donde hay uno por tarjeta.
      expect(normalizado(enlace?.textContent)).toBe(`Ver promoción: ${NUEVA_CON_PUNTOS.titulo}`);
      expect(normalizado(enlace?.querySelector('.sr-only')?.textContent)).toBe(
        `: ${NUEVA_CON_PUNTOS.titulo}`,
      );
      expect(enlace?.getAttribute('href')).toBe(`/promotions/${NUEVA_CON_PUNTOS.campaignId}`);
    });

    it('el título de la tarjeta es un h2, debajo del h1 de la página', () => {
      montar(NUEVA_CON_PUNTOS);

      const titulo = (fixture.nativeElement as HTMLElement).querySelector('h2');
      expect(normalizado(titulo?.textContent)).toBe(NUEVA_CON_PUNTOS.titulo);
      expect((fixture.nativeElement as HTMLElement).querySelector('h3')).toBeNull();
    });

    it('una vencida también enlaza: el detalle dice que terminó', () => {
      montar(VENCIDA);

      expect(porTestId('promocion-cta')?.getAttribute('href')).toBe(
        `/promotions/${VENCIDA.campaignId}`,
      );
    });
  });

  describe('compacta', () => {
    it('es la misma promoción en una línea, con estado, puntos y el mismo destino', () => {
      montar(NUEVA_CON_PUNTOS, 'compacta');

      expect(porTestId('promocion-tarjeta')?.getAttribute('data-variante')).toBe('compacta');
      expect(texto()).toContain(
        `Farmacia Central te mandó una promoción: ${NUEVA_CON_PUNTOS.titulo}`,
      );
      expect(normalizado(porTestId('promocion-estado')?.textContent)).toBe('Nueva');
      expect(normalizado(porTestId('promocion-puntos')?.textContent)).toBe('Puntos x2');
      expect(porTestId('promocion-cta')?.getAttribute('href')).toBe(
        `/promotions/${NUEVA_CON_PUNTOS.campaignId}`,
      );
      // Lo largo queda para la tarjeta completa.
      expect(porTestId('promocion-medicamento')).toBeNull();
    });
  });

  it('no pinta identificadores ni lenguaje de salud de la persona', () => {
    for (const promocion of [NUEVA_CON_PUNTOS, LOTE, VENCIDA]) {
      for (const variante of ['completa', 'compacta'] as const) {
        montar(promocion, variante);
        const leido = texto();
        expect(leido).not.toContain(promocion.campaignId);
        expect(leido).not.toMatch(/diagn[oó]stic|tratamiento|diabet|condici[oó]n|padec/i);
      }
    }
  });
});
