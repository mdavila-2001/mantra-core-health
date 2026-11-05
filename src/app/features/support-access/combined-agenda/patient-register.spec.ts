import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Component } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SupportPatientsClient } from '../../../core/data-access/support-access/support-patients.client';
import type { SupportPatientMatch } from '../../../core/data-access/support-access/support-patients.types';
import type { PickedPatient } from './patient-finder';
import { PatientRegister } from './patient-register';

@Component({
  imports: [PatientRegister],
  template: `<app-patient-register orgId="t-1" orgName="Hospital Piloto" document="5000999" (created)="created.push($event)" (cancelled)="cancelled = true" />`,
})
class Anfitrion {
  created: PickedPatient[] = [];
  cancelled = false;
}

const PARECIDO: SupportPatientMatch = { profileId: 'p-7', displayName: 'Ana Rojas Vaca', documentMasked: '***111', ageYears: 30, isMinor: false };
/** Un posible duplicado de la propia organización: se puede usar. */
const DUPLICADO = { ...PARECIDO, linkedToOrganization: true, matchedBy: ['DOCUMENT'] };
/** Uno de OTRA organización: la API no da perfil, nombre ni edad; solo que existe y con qué coincide. */
const DUPLICADO_AJENO = { documentMasked: '***222', isMinor: false, linkedToOrganization: false, matchedBy: ['NAME_AND_BIRTH_DATE'] };

describe('PatientRegister: registro rápido', () => {
  let fixture: ComponentFixture<Anfitrion>;
  let register: ReturnType<typeof vi.fn>;
  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byId = (id: string): HTMLElement | null => host().querySelector(`[data-testid="${id}"]`);
  const settle = async (): Promise<void> => {
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const escribir = async (id: string, valor: string): Promise<void> => {
    const input = byId(id)!.querySelector('input')!;
    input.value = valor;
    input.dispatchEvent(new Event('input'));
    await settle();
  };
  const clic = async (el: Element | null): Promise<void> => {
    (el as HTMLElement).click();
    await settle();
  };
  const llenar = async (nacimiento = '1990-03-10'): Promise<void> => {
    await escribir('registro-nombre', 'Ana');
    await escribir('registro-apellido', 'Rojas');
    await escribir('registro-nacimiento', nacimiento);
    await escribir('registro-telefono', '71234567');
  };

  beforeEach(async () => {
    register = vi.fn(() => of({ outcome: 'CREATED', patient: { ...PARECIDO, profileId: 'p-new', displayName: 'Ana Rojas' }, invitationSent: true }));
    TestBed.configureTestingModule({ providers: [{ provide: SupportPatientsClient, useValue: { register, searchExact: vi.fn() } }] });
    fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();
    await settle();
  });

  it('trae el documento que ya se había escrito en el buscador', () => {
    expect((byId('registro-documento')!.querySelector('input') as HTMLInputElement).value).toBe('5000999');
  });

  it('dice qué falta antes de enviar, y no envía', async () => {
    await clic(byId('registro-guardar'));
    expect(register).not.toHaveBeenCalled();
    expect(byId('registro-faltan')!.textContent).toContain('el nombre');
    expect(byId('registro-faltan')!.textContent).toContain('la fecha de nacimiento');
  });

  it('registra a un adulto y avisa que le llega la invitación', async () => {
    await llenar();
    await clic(byId('registro-guardar'));
    expect(register).toHaveBeenCalledWith('t-1', expect.objectContaining({ name: 'Ana', lastName: 'Rojas', document: '5000999', birthDate: '1990-03-10', phone: '71234567', inviteToPortal: true }));
    expect(register.mock.calls[0]![1].guardian).toBeUndefined();
    expect(fixture.componentInstance.created[0]!.patient.profileId).toBe('p-new');
  });

  it('un menor exige a su representante, con nombre, documento y parentesco', async () => {
    const menor = new Date();
    menor.setFullYear(menor.getFullYear() - 8);
    const nacimiento = `${menor.getFullYear()}-${String(menor.getMonth() + 1).padStart(2, '0')}-${String(menor.getDate()).padStart(2, '0')}`;
    await llenar(nacimiento);
    expect(byId('registro-representante')).not.toBeNull();
    await clic(byId('registro-guardar'));
    expect(register).not.toHaveBeenCalled();
    expect(byId('registro-faltan')!.textContent).toContain('el nombre del representante');
    await escribir('registro-rep-nombre', 'Marta Rojas');
    await escribir('registro-rep-documento', '4000001');
    await escribir('registro-rep-parentesco', 'Madre');
    await clic(byId('registro-guardar'));
    // La API exige también el teléfono del representante.
    expect(register).not.toHaveBeenCalled();
    expect(byId('registro-faltan')!.textContent).toContain('el teléfono del representante');
    await escribir('registro-rep-telefono', '71234568');
    await clic(byId('registro-guardar'));
    expect(register.mock.calls[0]![1].guardian).toMatchObject({ name: 'Marta Rojas', document: '4000001', phone: '71234568', relationship: 'Madre' });
  });

  it('un menor registrado deja constancia de la identidad sin verificar y del representante pendiente, sin decir «vinculado»', async () => {
    const menor = new Date();
    menor.setFullYear(menor.getFullYear() - 8);
    const nacimiento = `${menor.getFullYear()}-${String(menor.getMonth() + 1).padStart(2, '0')}-${String(menor.getDate()).padStart(2, '0')}`;
    register.mockReturnValueOnce(of({ outcome: 'CREATED', patient: { ...PARECIDO, profileId: 'p-min', displayName: 'Luis Rojas', isMinor: true }, invitationSent: false, identityVerified: false, guardian: { recorded: true, status: 'PENDING_VERIFICATION' } }));
    await llenar(nacimiento);
    await escribir('registro-rep-nombre', 'Marta Rojas');
    await escribir('registro-rep-documento', '4000001');
    await escribir('registro-rep-parentesco', 'Madre');
    await escribir('registro-rep-telefono', '71234568');
    await clic(byId('registro-guardar'));
    expect(fixture.componentInstance.created[0]!.registration).toEqual({ identityVerified: false, guardianPending: true });
    expect(host().textContent).not.toContain('vinculado');
  });

  it('un adulto registrado queda con la identidad sin verificar y sin representante pendiente', async () => {
    register.mockReturnValueOnce(of({ outcome: 'CREATED', patient: { ...PARECIDO, profileId: 'p-ad' }, invitationSent: true, identityVerified: false }));
    await llenar();
    await clic(byId('registro-guardar'));
    expect(fixture.componentInstance.created[0]!.registration).toEqual({ identityVerified: false, guardianPending: false });
  });

  it('un documento solo de ceros no se envía: no tiene contenido', async () => {
    await llenar();
    await escribir('registro-documento', '000000');
    await clic(byId('registro-guardar'));
    expect(register).not.toHaveBeenCalled();
    expect(byId('registro-faltan')!.textContent).toContain('un documento con contenido');
  });

  it('un 429 por IP se explica distinto del de la persona', async () => {
    const ip = new HttpErrorResponse({ status: 429, error: { code: 'RATE_LIMITED', message: 'x', details: { reason: 'SUPPORT_PATIENT_SEARCH_THROTTLED', limit: 'PER_MINUTE', scope: 'IP' }, timestamp: '', path: '' } });
    register.mockReturnValueOnce(throwError(() => ip));
    await llenar();
    await clic(byId('registro-guardar'));
    expect(byId('registro-error')!.textContent).toContain('esta conexión');
    expect(byId('registro-error')!.textContent).toContain('No es un problema de su cuenta');
  });

  it('avisa de posibles duplicados ANTES de crear, y se puede elegir a la persona que ya existía', async () => {
    register.mockReturnValueOnce(of({ outcome: 'POSSIBLE_DUPLICATES', duplicates: [DUPLICADO] }));
    await llenar();
    await clic(byId('registro-guardar'));
    expect(byId('registro-duplicados')).not.toBeNull();
    expect(host().textContent).toContain('Ana Rojas Vaca');
    expect(fixture.componentInstance.created).toEqual([]);
    await clic(byId('usar-existente-p-7'));
    expect(fixture.componentInstance.created[0]!.patient.profileId).toBe('p-7');
  });

  it('un duplicado de otra organización no ofrece «Es esta persona» ni muestra sus datos, y se puede seguir', async () => {
    register.mockReturnValueOnce(of({ outcome: 'POSSIBLE_DUPLICATES', duplicates: [DUPLICADO_AJENO] }));
    await llenar();
    await clic(byId('registro-guardar'));
    expect(byId('parecido-ajeno')!.textContent).toContain('otra organización');
    expect(byId('parecido-ajeno')!.textContent).toContain('el nombre y la fecha de nacimiento');
    expect(host().querySelector('[data-testid^="usar-existente-"]')).toBeNull();
    expect(host().textContent).not.toContain('***222');
    expect(fixture.componentInstance.created).toEqual([]);
    await clic(byId('registro-seguir'));
    expect(register.mock.calls[1]![1].acknowledgeDuplicates).toBe(true);
  });

  it('si no es la misma persona, vuelve a enviar dejando constancia de que vio el aviso', async () => {
    register.mockReturnValueOnce(of({ outcome: 'POSSIBLE_DUPLICATES', duplicates: [DUPLICADO] }));
    await llenar();
    await clic(byId('registro-guardar'));
    await clic(byId('registro-seguir'));
    expect(register.mock.calls[1]![1].acknowledgeDuplicates).toBe(true);
    expect(fixture.componentInstance.created[0]!.patient.profileId).toBe('p-new');
  });

  it('la invitación al paciente se puede quitar', async () => {
    await llenar();
    await clic(byId('registro-invitar'));
    await clic(byId('registro-guardar'));
    expect(register.mock.calls[0]![1].inviteToPortal).toBe(false);
  });
});
