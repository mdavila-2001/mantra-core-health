import type { ClinicalSummary } from '../../../core/data-access/clinical/clinical.types';
import { atencionDesdeResumen, recetaDesdeResumen } from './from-summary';

/**
 * El mapeo de lo que devuelve la API a los dos documentos (corrección #16).
 *
 * Es donde puede haber un error de verdad —un dato que sale de la pantalla en
 * vez del registro, o el diagnóstico de otra consulta colándose en este papel—,
 * y por eso se prueba acá, sobre funciones puras, y no montando una pantalla.
 */

const CONTEXTO = { paciente: 'Ana Quispe', profesional: 'Dra. Salas' };

/** Traductor de catálogo de mentira, con lo justo para estas pruebas. */
const ETIQUETAS: Readonly<Record<string, string>> = {
  'med-amoxi': 'Amoxicilina',
  'st-activa': 'Activa',
  'con-faringitis': 'Faringitis aguda',
  'obs-peso': 'Peso corporal',
  'u-kg': 'kg',
};

const etiqueta = (id: string | undefined): string =>
  id === undefined ? 'No registrado' : (ETIQUETAS[id] ?? 'No registrado');

const INDICACION = {
  id: 'm-1',
  medicationConceptId: 'med-amoxi',
  statusConceptId: 'st-activa',
  doseText: '500 mg',
  frequencyText: 'cada 8 horas',
  createdAt: new Date('2026-03-01T10:30:00.000Z'),
  issuedAt: new Date('2026-03-01T11:00:00.000Z'),
};

const ENCUENTRO = {
  id: 'e-1',
  statusConceptId: 'st-activa',
  reasonText: 'Dolor de garganta',
  startAt: new Date('2026-03-01T10:00:00.000Z'),
  endAt: new Date('2026-03-01T10:40:00.000Z'),
};

function resumen(parcial: Partial<ClinicalSummary> = {}): ClinicalSummary {
  return {
    patientProfileId: 'p-1',
    conditions: [],
    allergies: [],
    medicationRequests: [],
    observations: [],
    encounters: [ENCUENTRO],
    careEpisodes: [],
    limit: 50,
    truncated: [],
    ...parcial,
  };
}

describe('recetaDesdeResumen', () => {
  it('traduce el medicamento y conserva las fechas del registro', () => {
    const receta = recetaDesdeResumen(INDICACION, CONTEXTO, etiqueta);

    expect(receta.medicamentos[0].medicamento).toBe('Amoxicilina');
    expect(receta.medicamentos[0].dosis).toBe('500 mg');
    // Las fechas salen del registro, nunca del reloj del navegador.
    expect(receta.emitidaEl).toEqual(new Date('2026-03-01T11:00:00.000Z'));
    expect(receta.creadaEl).toEqual(new Date('2026-03-01T10:30:00.000Z'));
  });

  it('una indicación sin emitir no inventa fecha de emisión', () => {
    const { issuedAt: _emitida, ...borrador } = INDICACION;

    expect(recetaDesdeResumen(borrador, CONTEXTO, etiqueta).emitidaEl).toBeUndefined();
  });

  it('la vigencia se arma sólo con lo que la indicación declara', () => {
    const conDesde = recetaDesdeResumen(
      { ...INDICACION, validFrom: new Date('2026-03-01T00:00:00.000Z') },
      CONTEXTO,
      etiqueta,
    );
    expect(conDesde.medicamentos[0].vigencia).toContain('desde');

    // Sin fechas de vigencia no hay línea que imprimir: una vigencia inventada
    // en una receta es una indicación clínica falsa.
    expect(
      recetaDesdeResumen(INDICACION, CONTEXTO, etiqueta).medicamentos[0].vigencia,
    ).toBeUndefined();
  });
});

describe('atencionDesdeResumen', () => {
  it('lleva el motivo y las dos fechas de la consulta', () => {
    const atencion = atencionDesdeResumen(ENCUENTRO, resumen(), CONTEXTO, etiqueta);

    expect(atencion.motivo).toBe('Dolor de garganta');
    expect(atencion.inicio).toEqual(new Date('2026-03-01T10:00:00.000Z'));
    expect(atencion.cierre).toEqual(new Date('2026-03-01T10:40:00.000Z'));
  });

  it('el diagnóstico de OTRA consulta no se cuela en este documento', () => {
    const atencion = atencionDesdeResumen(
      ENCUENTRO,
      resumen({
        conditions: [
          {
            id: 'c-1',
            codeConceptId: 'con-faringitis',
            clinicalStatusConceptId: 'st-activa',
            encounterId: 'e-1',
            createdAt: new Date('2026-03-01T10:10:00.000Z'),
          },
          {
            id: 'c-2',
            codeConceptId: 'con-faringitis',
            clinicalStatusConceptId: 'st-activa',
            encounterId: 'e-OTRO',
            createdAt: new Date('2026-02-01T10:10:00.000Z'),
          },
        ],
      }),
      CONTEXTO,
      etiqueta,
    );

    const diagnosticos = atencion.bloques.find((bloque) => bloque.titulo === 'Diagnósticos');
    expect(diagnosticos?.datos).toEqual([{ etiqueta: 'Faringitis aguda', valor: 'Activa' }]);
  });

  it('un diagnóstico sin encuentro tampoco entra: no se sabe de qué consulta es', () => {
    const atencion = atencionDesdeResumen(
      ENCUENTRO,
      resumen({
        conditions: [
          {
            id: 'c-3',
            codeConceptId: 'con-faringitis',
            createdAt: new Date('2026-03-01T10:10:00.000Z'),
          },
        ],
      }),
      CONTEXTO,
      etiqueta,
    );

    expect(atencion.bloques.find((b) => b.titulo === 'Diagnósticos')?.datos).toHaveLength(0);
  });

  it('la observación con cantidad se imprime con su unidad', () => {
    const atencion = atencionDesdeResumen(
      ENCUENTRO,
      resumen({
        observations: [
          {
            id: 'o-1',
            codeConceptId: 'obs-peso',
            statusConceptId: 'st-activa',
            quantityValue: '78.5',
            quantityUnitConceptId: 'u-kg',
            encounterId: 'e-1',
          },
        ],
      }),
      CONTEXTO,
      etiqueta,
    );

    expect(atencion.bloques.find((b) => b.titulo === 'Observaciones')?.datos).toEqual([
      { etiqueta: 'Peso corporal', valor: '78.5 kg' },
    ]);
  });

  it('una observación booleana no sale vacía', () => {
    const atencion = atencionDesdeResumen(
      ENCUENTRO,
      resumen({
        observations: [
          {
            id: 'o-2',
            codeConceptId: 'obs-peso',
            statusConceptId: 'st-activa',
            valueBoolean: false,
            encounterId: 'e-1',
          },
        ],
      }),
      CONTEXTO,
      etiqueta,
    );

    expect(atencion.bloques.find((b) => b.titulo === 'Observaciones')?.datos[0].valor).toBe('No');
  });
});
