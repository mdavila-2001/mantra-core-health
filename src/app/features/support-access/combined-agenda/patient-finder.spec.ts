import { HttpErrorResponse } from '@angular/common/http';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Component } from '@angular/core';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SupportPatientsClient } from '../../../core/data-access/support-access/support-patients.client';
import type { SupportPatientMatch } from '../../../core/data-access/support-access/support-patients.types';
import { PatientFinder, type PickedPatient } from './patient-finder';

@Component({
  imports: [PatientFinder],
  template: `<app-patient-finder orgId="t-1" orgName="Hospital Piloto" [canRegister]="canRegister" (picked)="picked.push($event)" />`,
})
class Anfitrion {
  canRegister = true;
  picked: PickedPatient[] = [];
}

const ADULTO: SupportPatientMatch = { profileId: 'p-1', displayName: 'Ana Lucía Pérez Quiroga', documentMasked: '***000', phoneMasked: '6******0', ageYears: 36, isMinor: false };
const MENOR: SupportPatientMatch = {
  profileId: 'p-2',
  displayName: 'Martín Rocha Antelo',
  documentMasked: '***613',
  ageYears: 11,
  isMinor: true,
  representatives: [
    { id: 'r-1', name: 'Sandra Antelo', relationship: 'Madre' },
    { id: 'r-2', name: 'Felipe Rocha', relationship: 'Padre' },
  ],
};

describe('PatientFinder: la búsqueda exacta', () => {
  let fixture: ComponentFixture<Anfitrion>;
  let searchExact: ReturnType<typeof vi.fn>;
  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byId = (id: string): HTMLElement | null => host().querySelector(`[data-testid="${id}"]`);
  const settle = async (): Promise<void> => {
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const clic = async (el: Element | null): Promise<void> => {
    (el as HTMLElement).click();
    await settle();
  };
  const escribir = async (id: string, valor: string): Promise<void> => {
    const input = byId(id)!.querySelector('input')!;
    input.value = valor;
    input.dispatchEvent(new Event('input'));
    await settle();
  };
  const buscar = async (): Promise<void> => clic(byId('buscador-buscar'));
  const modo = async (valor: string): Promise<void> => clic(host().querySelector(`[data-testid="buscador-modo"] [data-value="${valor}"]`));

  beforeEach(async () => {
    searchExact = vi.fn(() => of({ items: [ADULTO] }));
    TestBed.configureTestingModule({ providers: [{ provide: SupportPatientsClient, useValue: { searchExact, register: vi.fn() } }] });
    fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();
    await settle();
  });

  it('«Juan» se rechaza con un mensaje que dice cómo buscar, y no sale ninguna petición', async () => {
    await escribir('buscador-texto', 'Juan');
    await buscar();
    expect(searchExact).not.toHaveBeenCalled();
    expect(byId('buscador-aviso-texto')!.textContent).toContain('«Juan» no alcanza');
    expect(byId('buscador-aviso')!.textContent).toContain('documento de identidad completo');
  });

  it('un pedazo del documento tampoco', async () => {
    await escribir('buscador-texto', '412');
    await buscar();
    expect(searchExact).not.toHaveBeenCalled();
    expect(byId('buscador-aviso')).not.toBeNull();
  });

  it('el documento completo busca, y el resultado trae datos mínimos: sin documento ni teléfono en claro', async () => {
    await escribir('buscador-texto', '5000000');
    await buscar();
    expect(searchExact).toHaveBeenCalledWith('t-1', { kind: 'DOCUMENT', document: '5000000' }, expect.objectContaining({ context: expect.anything() }));
    const tarjeta = byId('paciente-p-1')!.textContent!;
    expect(tarjeta).toContain('Ana Lucía Pérez Quiroga');
    expect(tarjeta).toContain('36 años');
    expect(tarjeta).toContain('***000');
    expect(tarjeta).not.toContain('5000000');
  });

  it('un 429 de la búsqueda (SUPPORT_PATIENT_SEARCH_THROTTLED) dice si es el tope por minuto o por día, y de quién', async () => {
    const tope = (limit: string, scope: string): HttpErrorResponse =>
      new HttpErrorResponse({ status: 429, error: { statusCode: 429, code: 'RATE_LIMITED', message: 'x', details: { reason: 'SUPPORT_PATIENT_SEARCH_THROTTLED', limit, scope }, timestamp: '', path: '/' } });
    searchExact.mockReturnValueOnce(throwError(() => tope('PER_MINUTE', 'PERSON')));
    await escribir('buscador-texto', '5000000');
    await buscar();
    const porMinuto = byId('buscador-aviso-texto')!.textContent!;
    expect(porMinuto).toContain('minuto');
    searchExact.mockReturnValueOnce(throwError(() => tope('PER_DAY', 'IP')));
    await buscar();
    const porIp = byId('buscador-aviso-texto')!.textContent!;
    expect(porIp).toContain('esta conexión');
    expect(porIp).not.toBe(porMinuto);
  });

  it('el teléfono completo busca por teléfono', async () => {
    await modo('PHONE');
    await escribir('buscador-texto', '+591 7123 4567');
    await buscar();
    expect(searchExact).toHaveBeenCalledWith('t-1', { kind: 'PHONE', phone: '71234567' }, expect.objectContaining({ context: expect.anything() }));
  });

  it('por nombre hace falta el nombre completo Y la fecha de nacimiento', async () => {
    await modo('NAME_BIRTH');
    await escribir('buscador-nombre', 'Juan Pérez');
    await buscar();
    expect(searchExact).not.toHaveBeenCalled();
    expect(byId('buscador-aviso-texto')!.textContent).toContain('fecha de nacimiento');
    await escribir('buscador-nacimiento', '1990-05-12');
    await buscar();
    expect(searchExact).toHaveBeenCalledWith('t-1', { kind: 'NAME_BIRTH', fullName: 'Juan Pérez', birthDate: '1990-05-12' }, expect.objectContaining({ context: expect.anything() }));
  });

  it('elegir al paciente lo entrega al contenedor', async () => {
    await escribir('buscador-texto', '5000000');
    await buscar();
    await clic(byId('elegir-p-1'));
    const host = fixture.componentInstance;
    expect(host.picked).toEqual([{ patient: ADULTO, representative: null }]);
  });

  it('sin resultados, lo dice y ofrece registrar al paciente', async () => {
    searchExact.mockReturnValueOnce(of({ items: [] }));
    await escribir('buscador-texto', '5000000');
    await buscar();
    expect(byId('buscador-sin-resultados')).not.toBeNull();
    expect(byId('registrar-paciente-nuevo')).not.toBeNull();
  });

  it('sin permiso de registrar, no hay botón para registrar', async () => {
    fixture.componentInstance.canRegister = false;
    fixture.changeDetectorRef.detectChanges();
    await settle();
    expect(byId('registrar-paciente-nuevo')).toBeNull();
  });

  it('si la API rechaza la búsqueda, muestra su mensaje', async () => {
    searchExact.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 400, error: { statusCode: 400, code: 'VALIDATION_FAILED', message: 'La búsqueda es exacta: escriba el documento completo del paciente.', error: 'Bad Request', details: [{ field: 'document', messages: ['La búsqueda es exacta: escriba el documento completo del paciente.'] }] } })));
    await escribir('buscador-texto', '5000000');
    await buscar();
    expect(byId('buscador-aviso-texto')!.textContent).toContain('La búsqueda es exacta');
  });

  describe('menores de edad', () => {
    beforeEach(async () => {
      searchExact.mockReturnValue(of({ items: [MENOR] }));
      await escribir('buscador-texto', '5029613');
      await buscar();
    });

    it('no se elige al menor hasta decir quién actúa por él', async () => {
      expect(byId('paciente-p-2')!.textContent).toContain('Menor de edad');
      expect(byId('elegir-p-2')!.getAttribute('aria-disabled')).toBe('true');
      await clic(byId('elegir-p-2'));
      expect(fixture.componentInstance.picked).toEqual([]);
    });

    it('con su representante elegido, se entrega con él', async () => {
      await clic(byId('representante-r-2'));
      await clic(byId('elegir-p-2'));
      expect(fixture.componentInstance.picked[0]!.representative).toEqual({ id: 'r-2', name: 'Felipe Rocha', relationship: 'Padre' });
    });
  });

  it('un menor sin representante registrado no se puede elegir y se explica por qué', async () => {
    searchExact.mockReturnValue(of({ items: [{ ...MENOR, representatives: [] }] }));
    await escribir('buscador-texto', '5029613');
    await buscar();
    expect(byId('menor-sin-representante')!.textContent).toContain('representante legal');
    expect(byId('elegir-p-2')!.getAttribute('aria-disabled')).toBe('true');
  });
});
