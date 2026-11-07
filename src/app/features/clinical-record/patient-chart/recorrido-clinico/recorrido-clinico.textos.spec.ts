import { describe, expect, it } from 'vitest';

import type { RegistroDeLaRed } from './red-clinica.model';
import type { ColumnaDeLaRed, NodoDeLaRed } from './red-clinica.geometria.types';
import { fechaPropia } from './recorrido-clinico.textos';

const columna = (fecha: Date): ColumnaDeLaRed => ({
  clave: 'c',
  x: 0,
  ancho: 100,
  ancha: false,
  fecha,
  encuentroId: null,
  contexto: 'atencion',
  intervalo: '',
  hueco: 0,
});
const nodo = (cuando: Date, clase: RegistroDeLaRed['clase'] = 'estudio'): NodoDeLaRed => ({
  id: 'n',
  forma: 'tarjeta',
  registro: { id: 'n', clase, titulo: 'n', detalle: '', estado: '', cuando },
  episodio: 'e',
  columna: 0,
  x: 0,
  y: 0,
  ancho: 10,
  alto: 10,
});

/* Fixed instants: the expectations hold under `TZ=UTC` and `TZ=America/La_Paz`. */
describe('fechaPropia · on the clinical day (La Paz)', () => {
  // 20:30 in La Paz on 10 March (00:30 UTC on the 11th).
  const noche = new Date('2026-03-11T00:30:00Z');

  it('no own date when the record shares its column\'s clinical day, though UTC splits them', () => {
    expect(fechaPropia(nodo(noche), columna(new Date('2026-03-10T14:00:00Z')), false)).toBeNull();
  });

  it('shows the own date when the clinical day differs, though the UTC date is the same', () => {
    const propia = fechaPropia(nodo(noche, 'diagnostico'), columna(new Date('2026-03-11T14:00:00Z')), false);
    expect(propia).toEqual({ rotulo: 'Inicio', fecha: noche, formato: 'd MMM' });
  });

  it('compares the clinical year: 31 December at night is not the next year', () => {
    const nochevieja = new Date('2027-01-01T01:00:00Z');
    const propia = fechaPropia(nodo(nochevieja), columna(new Date('2026-12-20T14:00:00Z')), false);
    expect(propia?.formato).toBe('d MMM');
  });
});
