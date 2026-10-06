import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { TerminologyClient } from '../../core/data-access/terminology/terminology.client';
import type { GlossaryTermDetail } from '../../core/data-access/terminology/terminology.types';
import { GlossaryDataFlow } from './glossary-data-flow';

/**
 * El mapa de conexión de datos: sigue «Envía datos a» eslabón por eslabón.
 * El cliente se dobla con un diccionario de fichas para probar el recorrido
 * (orden, corte por ciclo, enlaces) sin HTTP.
 */
function ficha(conceptId: string, display: string, siguiente?: string): GlossaryTermDetail {
  return {
    conceptId,
    display,
    relations: siguiente === undefined ? [] : [{ type: 'SENDS_DATA_TO', conceptId: siguiente, slug: siguiente, display: siguiente }],
  } as unknown as GlossaryTermDetail;
}

const FICHAS: Record<string, GlossaryTermDetail> = {
  eco: ficha('eco', 'Ecógrafo', 'dicom'),
  dicom: ficha('dicom', 'Imagen DICOM', 'pacs'),
  pacs: ficha('pacs', 'Archivo de imágenes (PACS/VNA)', 'resultado'),
  resultado: ficha('resultado', 'Resultado del paciente'),
  // Un ciclo: a → b → a.
  a: ficha('a', 'A', 'b'),
  b: ficha('b', 'B', 'a'),
  suelto: ficha('suelto', 'Sin destino'),
};

async function montar(entradas: { termino?: GlossaryTermDetail; conceptoId?: string; enlazar?: boolean }) {
  const leidos: string[] = [];
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: TerminologyClient,
        useValue: {
          readGlossaryTerm: (id: string) => {
            leidos.push(id);
            const f = FICHAS[id];
            return f === undefined ? throwError(() => new Error('404')) : of(f);
          },
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(GlossaryDataFlow);
  if (entradas.termino !== undefined) fixture.componentRef.setInput('termino', entradas.termino);
  if (entradas.conceptoId !== undefined) fixture.componentRef.setInput('conceptoId', entradas.conceptoId);
  if (entradas.enlazar !== undefined) fixture.componentRef.setInput('enlazar', entradas.enlazar);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  const host = fixture.nativeElement as HTMLElement;
  const nombres = (): string[] => [...host.querySelectorAll('.flujo__nombre')].map((n) => n.textContent!.trim());
  return { host, nombres, leidos };
}

describe('GlossaryDataFlow', () => {
  it('arma la cadena completa desde la ficha, en orden, y enlaza todo menos el origen', async () => {
    const { host, nombres } = await montar({ termino: FICHAS['eco']! });
    expect(nombres()).toEqual(['Ecógrafo', 'Imagen DICOM', 'Archivo de imágenes (PACS/VNA)', 'Resultado del paciente']);
    expect(host.querySelectorAll('a.flujo__nombre')).toHaveLength(3);
    expect(host.querySelector('[data-testid="glosario-mapa-de-datos"] h2')?.textContent).toContain('Mapa de conexión de datos');
  });

  it('con sólo el identificador lee el origen, y sin enlazar no ofrece enlaces', async () => {
    const { host, nombres, leidos } = await montar({ conceptoId: 'eco', enlazar: false });
    expect(leidos[0]).toBe('eco');
    expect(nombres()).toHaveLength(4);
    expect(host.querySelectorAll('a')).toHaveLength(0);
  });

  it('un ciclo corta el recorrido en vez de colgarlo', async () => {
    const { nombres } = await montar({ termino: FICHAS['a']! });
    expect(nombres()).toEqual(['A', 'B']);
  });

  it('un término sin «Envía datos a» no dibuja nada', async () => {
    const { host, leidos } = await montar({ termino: FICHAS['suelto']! });
    expect(host.querySelector('[data-testid="glosario-mapa-de-datos"]')).toBeNull();
    expect(leidos).toHaveLength(0);
  });

  it('si un eslabón no se puede leer, no muestra una cadena a medias', async () => {
    const { host } = await montar({ termino: ficha('x', 'X', 'inexistente') });
    expect(host.querySelector('[data-testid="glosario-mapa-de-datos"]')).toBeNull();
  });
});
