import { describe, expect, it } from 'vitest';

import type { Condition, Encounter, MedicationRequest } from '../../../../../core/data-access/clinical/clinical.types';
import { type RegistroDeLaRed, type VinculoDeLaRed } from '../../recorrido-clinico/red-clinica.model';
import { agruparEnEpisodios } from '../../recorrido-clinico/red-clinica.episodios';
import { episodioPropuesto, guiaDelExpediente, idsDelEpisodio, NINGUNO_VISIBLE, visiblesDelPaso } from './guia-de-la-red';

const registro = (id: string, clase: RegistroDeLaRed['clase'], extra: Partial<RegistroDeLaRed> = {}): RegistroDeLaRed => ({
  id, clase, titulo: id, detalle: '', estado: '', cuando: new Date(2026, 0, 10), ...extra,
});
const REGISTROS = [
  registro('e1', 'atencion'),
  registro('dx1', 'diagnostico', { encuentroId: 'e1', certeza: 'confirmado', concepto: 'C1', titulo: 'Hipotiroidismo' }),
  registro('rx1', 'medicacion', { encuentroId: 'e1' }),
  registro('e2', 'atencion'),
  registro('dx2', 'diagnostico', { encuentroId: 'e2', certeza: 'confirmado', concepto: 'C2', titulo: 'Pielonefritis' }),
];
const VINCULOS: VinculoDeLaRed[] = [
  { desde: 'e1', hasta: 'dx1', motivo: 'registrado-en' },
  { desde: 'e1', hasta: 'rx1', motivo: 'registrado-en' },
  { desde: 'dx1', hasta: 'rx1', motivo: 'indicado-para' },
  { desde: 'e2', hasta: 'dx2', motivo: 'registrado-en' },
];

describe('guiaDelExpediente', () => {
  const resumen = {
    encounters: [{ id: 'e1', statusConceptId: 's', primaryPractitionerId: 'pr-1' } as Encounter],
    conditions: [{ id: 'dx1' } as Condition],
    medicationRequests: [{ id: 'rx1' } as MedicationRequest],
    careEpisodes: [],
  };
  const etiquetas = new Map([['c1', { display: 'Hipotiroidismo', code: 'E03' }]]);

  it('narra las mismas lecturas que la red; lo que no llegó va vacío', () => {
    const guia = guiaDelExpediente({ resumen, citas: null, derivaciones: null, estudios: null }, (id) => etiquetas.get(id), null, new Date(0));
    expect(guia.registros.atenciones).toBe(resumen.encounters);
    expect(guia.registros.recetas).toBe(resumen.medicationRequests);
    expect(guia.registros.citas).toEqual([]);
    expect(guia.registros.ordenes).toEqual([]);
    expect(guia.lector.etiqueta('c1')).toBe('Hipotiroidismo');
    expect(guia.lector.codigo?.('c1')).toBe('E03');
    expect(guia.lector.etiqueta(undefined)).toBeUndefined();
    expect(guia.lector.servicioDeAtencion).toBeUndefined();
  });

  it('sólo nombra al profesional que mira; a otro, no', () => {
    const guia = guiaDelExpediente({ resumen, citas: [], derivaciones: [], estudios: { orders: [], reports: [] } }, () => undefined, { profileId: 'pr-1', displayName: 'Dra. Ana Rojas' }, new Date(0));
    expect(guia.lector.profesional?.('pr-1')).toBe('Dra. Ana Rojas');
    expect(guia.lector.profesional?.('pr-2')).toBeUndefined();
  });
});

describe('visiblesDelPaso', () => {
  const presentes = new Set(REGISTROS.map((r) => r.id));

  it('sin filtros: lo revelado que la red tiene', () => {
    expect(visiblesDelPaso(['e1', 'dx1', 'cita-que-no-esta'], [], presentes)).toEqual(['e1', 'dx1']);
  });

  it('con filtros: la intersección', () => {
    expect(visiblesDelPaso(['e1', 'dx1', 'rx1'], ['dx1', 'rx1', 'dx2'], presentes)).toEqual(['dx1', 'rx1']);
  });

  it('nada en común: nunca vacío (para la red, vacío es «todos»)', () => {
    expect(visiblesDelPaso(['e1'], ['dx2'], presentes)).toEqual([NINGUNO_VISIBLE]);
    expect(visiblesDelPaso([], [], presentes)).toEqual([NINGUNO_VISIBLE]);
  });
});

describe('episodioPropuesto', () => {
  const red = agruparEnEpisodios(REGISTROS, VINCULOS);
  const de = (nombre: string) => red.episodios.find((e) => e.nombre === nombre)!;

  it('el del nodo abierto manda sobre el filtro de hilo', () => {
    expect(episodioPropuesto(red, { seleccionado: 'rx1', hiloDeDiagnosticoId: 'dx2' })?.nombre).toBe('Hipotiroidismo');
  });

  it('sin nodo abierto, el del filtro «Solo el hilo de este diagnóstico»', () => {
    expect(episodioPropuesto(red, { seleccionado: null, hiloDeDiagnosticoId: 'dx2' })?.nombre).toBe('Pielonefritis');
  });

  it('sin ninguno de los dos, ninguno', () => {
    expect(episodioPropuesto(red, { seleccionado: null, hiloDeDiagnosticoId: null })).toBeNull();
  });

  it('los ids de un episodio incluyen lo compartido', () => {
    expect(idsDelEpisodio(de('Hipotiroidismo'))).toEqual(expect.arrayContaining(['dx1', 'rx1', 'e1']));
  });
});
