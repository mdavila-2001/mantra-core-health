import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import type { ContextoReporte } from '@core/data-access/reporting/reporting.types';
import { construirAdquisicion } from './adquisicion.dataset';
import { construirCalidad } from './calidad.dataset';
import { construirCobros } from './cobros.dataset';
import { construirComisiones } from './comisiones.dataset';
import { construirPublicidad } from './publicidad.dataset';
import { construirResumen } from './resumen.dataset';
import { construirSuscripciones } from './suscripciones.dataset';

/**
 * Regresión: «Haz clic…» y «Elige…» llegaron a la pantalla en trato de «tú» y `check-usted` no los
 * vigila (son verbos que también existen en tercera persona). Todo el texto que los datos de ejemplo
 * mandan a la interfaz se lee en «usted».
 */
const TUTEO = /\b(haz clic|haz click|elige|puedes|quieres|escribe|pregúntame|comparte el código|selecciona un|podrás|verás|tendrás|sabrás)\b/i;

const CONTEXTOS: readonly ContextoReporte[] = [
  { periodo: '30d', comparar: 'periodo-anterior', moneda: 'BOB', alcance: 'plataforma', filtros: [] },
  { periodo: '12m', comparar: 'ninguna', moneda: 'USD', alcance: 'organizacion', filtros: [] },
  { periodo: '7d', comparar: 'mismo-periodo-ano-anterior', moneda: 'BOB', alcance: 'plataforma', filtros: [] },
];

const PESTANAS = { construirResumen, construirSuscripciones, construirPublicidad, construirComisiones, construirCobros, construirAdquisicion, construirCalidad };

describe('el texto de los datos de ejemplo va en «usted»', () => {
  for (const [nombre, construir] of Object.entries(PESTANAS)) {
    it(`${nombre}: ningún título, subtítulo, motivo ni aviso usa el trato de «tú»`, () => {
      for (const ctx of CONTEXTOS) {
        const texto = JSON.stringify(construir(ctx));
        expect(TUTEO.exec(texto)?.[0] ?? null, `${nombre} (${ctx.periodo}, ${ctx.comparar})`).toBeNull();
      }
    });
  }
});

describe('las plantillas de reportería también van en «usted»', () => {
  /** Todas las `.html` de `features/reporting` y del panel de gráficos: lo que se escribe a mano en la vista. */
  function plantillas(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? plantillas(join(dir, e.name)) : e.name.endsWith('.html') ? [join(dir, e.name)] : [],
    );
  }
  const RAIZ = join(__dirname, '../../../..');
  const archivos = [...plantillas(join(RAIZ, 'features/reporting')), ...plantillas(join(RAIZ, 'shared/components/organisms/chart-panel'))];

  it('hay plantillas que revisar', () => {
    expect(archivos.length).toBeGreaterThan(5);
  });

  for (const archivo of archivos) {
    it(`${archivo.split('/app/')[1]} no usa el trato de «tú»`, () => {
      expect(readFileSync(archivo, 'utf-8')).not.toMatch(TUTEO);
    });
  }
});
