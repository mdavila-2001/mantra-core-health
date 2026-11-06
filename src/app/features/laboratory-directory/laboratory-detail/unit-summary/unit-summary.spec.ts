import { TestBed } from '@angular/core/testing';

import type {
  DiagnosticStudy,
  DiagnosticUnitDetail,
} from '../../../../core/data-access/diagnostic-units/diagnostic-units.types';
import { LabUnitSummary } from './unit-summary';

function study(id: string, amount: string | null, minutes: number | null, currency = 'BOB'): DiagnosticStudy {
  return {
    id,
    code: id,
    name: `Estudio ${id}`,
    description: null,
    siteId: null,
    modality: null,
    preparationInstructions: null,
    expectedDurationMinutes: null,
    expectedTurnaroundMinutes: minutes,
    requiresMedicalOrder: null,
    prices:
      amount === null
        ? []
        : [{ amount, currency: { code: currency, display: 'Boliviano' }, scheduleCode: 'PUBLIC', siteId: null }],
  };
}

const UNIT: DiagnosticUnitDetail = {
  id: 'u1',
  code: 'LAB-CENTRAL',
  name: 'Laboratorio Central',
  type: { code: 'DU_TYPE_LAB', display: 'Lab' },
  siteCount: 1,
  equipmentCount: 2,
  studyCount: 3,
  acceptsExternalOrders: false,
  walkInAvailable: true,
  homeCollectionAvailable: null,
  sites: [{ id: 's1', code: 'S1', name: 'Sede', role: { code: 'P', display: 'Principal' }, sampleCollectionAvailable: true, imagingAvailable: false }],
  equipment: [
    { id: 'e1', siteId: 's1', type: { code: 'A', display: 'A' }, manufacturer: null, model: null, modality: null, operationalStatus: { code: 'OPERATIONAL', display: 'Operativo' }, lastCalibrationAt: null, nextCalibrationDueAt: null },
    { id: 'e2', siteId: 's1', type: { code: 'B', display: 'B' }, manufacturer: null, model: null, modality: null, operationalStatus: { code: 'MAINTENANCE', display: 'En mantenimiento' }, lastCalibrationAt: null, nextCalibrationDueAt: null },
  ],
  studies: [study('a', '140.00', 1440), study('b', '45.50', 240), study('c', '5.00', null, 'USD')],
  accreditations: [],
};

describe('LabUnitSummary', () => {
  function render(unit: DiagnosticUnitDetail): HTMLElement {
    const fixture = TestBed.createComponent(LabUnitSummary);
    fixture.componentRef.setInput('unit', unit);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const stats = (host: HTMLElement): string[] =>
    [...host.querySelectorAll('.unit-summary__stat')].map((el) => el.textContent!.replace(/\s+/g, ' ').trim());

  it('muestra sólo lo que el centro hace, y su código', () => {
    const host = render(UNIT);
    const text = host.textContent ?? '';
    expect(text).toContain('Atención sin cita');
    expect(text).not.toContain('Toma de muestras a domicilio');
    expect(text).not.toContain('Recibe órdenes externas');
    expect(text).toContain('LAB-CENTRAL');
  });

  it('calcula el «desde» en la moneda más usada, la entrega más rápida y los equipos operativos', () => {
    // El USD va primero a propósito: no puede fijar la moneda de comparación.
    const cifras = stats(render({ ...UNIT, studies: [study('c', '5.00', null, 'USD'), ...UNIT.studies.slice(0, 2)] }));
    expect(cifras.find((c) => c.startsWith('Desde'))).toContain('45,50');
    expect(cifras.find((c) => c.startsWith('Resultados desde'))).toContain('4 h');
    expect(cifras.find((c) => c.startsWith('Equipos operativos'))).toContain('1 de 2');
  });

  it('no repite las cuentas de estudios y sedes, que ya están en las pestañas', () => {
    const cifras = stats(render(UNIT));
    expect(cifras.some((c) => c.startsWith('Estudios') || c.startsWith('Sedes'))).toBe(false);
  });

  it('dice «Referencia desde» cuando el mínimo no es un precio que publicó el centro', () => {
    const referencia = { ...study('r', '9.75', null), prices: [{ ...study('r', '9.75', null).prices[0]!, scheduleCode: 'REFERENCIA_FONASA_2026_BOB' }] };
    const cifras = stats(render({ ...UNIT, studies: [referencia] }));
    expect(cifras.some((c) => c.startsWith('Referencia desde 9,75'))).toBe(true);
    expect(cifras.some((c) => c.startsWith('Desde'))).toBe(false);
  });

  it('omite la cifra que no tiene dato en vez de dibujar un cero', () => {
    const cifras = stats(
      render({ ...UNIT, equipment: [], studies: [study('x', null, null)] }),
    );
    expect(cifras.some((c) => c.startsWith('Desde'))).toBe(false);
    expect(cifras.some((c) => c.startsWith('Resultados desde'))).toBe(false);
    expect(cifras.some((c) => c.startsWith('Equipos'))).toBe(false);
    expect(cifras.some((c) => c.startsWith('Acreditaciones'))).toBe(false);
  });

  it('no dibuja la grilla de cifras cuando no hay ninguna', () => {
    const host = render({ ...UNIT, equipment: [], studies: [study('x', null, null)] });
    expect(host.querySelector('.unit-summary__stats')).toBeNull();
  });
});
