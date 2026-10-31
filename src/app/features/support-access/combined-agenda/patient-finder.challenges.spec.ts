import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SupportPatientsClient } from '../../../core/data-access/support-access/support-patients.client';
import { patientList } from '../../../core/mock/fixtures/people';
import { banderasDePacientes } from '../../../core/mock/fixtures/support-hospital-governance';
import {
  reiniciarElGobiernoDeAccesos,
  reiniciarLaSesionDelSimulador,
} from '../../../core/mock/handlers/mock-reset';
import { reiniciarTopeDeBusquedas } from '../../../core/mock/handlers/support-access.patients.handlers';
import { iso, uuid } from '../../../core/mock/mock-store';
import { TENANT_HOSPITAL_PILOTO } from '../../../core/mock/mock-session';
import { resolverDesafiosEnPrueba } from '../../../../testing/access-challenge-test';
import {
  olvidarPeticiones,
  peticiones,
  provideGovernanceMock,
} from '../../../../testing/governance-mock-backend';
import { PatientFinder } from './patient-finder';

/**

 * La búsqueda de pacientes no abre diálogos de desafío (la API real no desafía ahí) y un rechazo por permiso ofrece «¿Por qué no puedo?» (`isolate: false`: cada prueba parte del piloto de fábrica).
 */
describe('PatientFinder: desafíos de acceso', () => {
  let fixture: ComponentFixture<PatientFinder>;
  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byId = (id: string): HTMLElement | null => host().querySelector(`[data-testid="${id}"]`);
  const settle = async (): Promise<void> => {
    for (let i = 0; i < 4; i += 1) {
      fixture.detectChanges();
      await fixture.whenStable();
    }
  };
  const buscar = async (documento: string): Promise<void> => {
    const campo = byId('buscador-texto')!.querySelector('input')!;
    campo.value = documento;
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
    (byId('buscador-buscar') as HTMLElement).click();
    await settle();
  };
  const hechas = (): string[] => peticiones.map((p) => `${p.method} ${p.path} ${p.status}`);

  async function montar(cuenta: string): Promise<void> {
    TestBed.configureTestingModule({
      providers: [...provideGovernanceMock(cuenta, { desafios: true })],
    });
    fixture = TestBed.createComponent(PatientFinder);
    fixture.componentRef.setInput('orgId', TENANT_HOSPITAL_PILOTO);
    fixture.componentRef.setInput('orgName', 'Hospital Piloto Mantra');
    await settle();
  }

  /** Un paciente que Ana encuentra por documento. */
  async function pacienteEncontrable(): Promise<{
    id: string;
    nationalId: string;
    displayName: string;
  }> {
    const clientes = TestBed.inject(SupportPatientsClient);
    for (const p of patientList.todos()) {
      const { items } = await firstValueFrom(
        clientes.searchExact(TENANT_HOSPITAL_PILOTO, { kind: 'DOCUMENT', document: p.nationalId }),
      );
      if (items.length > 0)
        return { id: p.id, nationalId: p.nationalId, displayName: p.displayName };
    }
    throw new Error('El padrón del piloto no trae ningún paciente que Ana pueda buscar.');
  }
  const reservar = (id: string): void => {
    banderasDePacientes.agregar({
      id: uuid(`spec-bandera-${id}`),
      patientProfileId: id,
      flag: 'VIP',
      reason: 'Autoridad pública',
      validFrom: iso(-1),
    });
  };

  beforeEach(() => {
    reiniciarLaSesionDelSimulador();
    reiniciarElGobiernoDeAccesos();
    reiniciarTopeDeBusquedas();
    olvidarPeticiones();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    reiniciarElGobiernoDeAccesos();
    reiniciarTopeDeBusquedas();
  });

  it('un paciente sin bandera se encuentra en un solo paso y no se abre ningún diálogo', async () => {
    await montar('ana');
    const paciente = await pacienteEncontrable();
    const desafios = resolverDesafiosEnPrueba();
    olvidarPeticiones();

    await buscar(paciente.nationalId);

    expect(hechas()).toEqual(['POST /me/support-patient-search 200']);
    expect(desafios.preguntados).toEqual([]);
    expect(host().textContent).toContain(paciente.displayName);
  });

  /**
   * Pendiente 58: la API real no desafía en la búsqueda (no pide motivo ni segundo paso: lo que protege a un paciente reservado lo
   * decide el servidor). El mock tampoco: un paciente reservado se busca en un solo paso, como cualquier otro, sin diálogos.
   */
  it('un paciente reservado se busca en un solo paso: la API real no desafía en la búsqueda', async () => {
    await montar('ana');
    const paciente = await pacienteEncontrable();
    reservar(paciente.id);
    const desafios = resolverDesafiosEnPrueba();
    olvidarPeticiones();

    await buscar(paciente.nationalId);

    expect(hechas()).toEqual(['POST /me/support-patient-search 200']);
    expect(desafios.preguntados).toEqual([]);
    expect(byId(`paciente-${paciente.id}`)).not.toBeNull();
    expect(byId('buscador-aviso')).toBeNull();
  });

  it('un rechazo por permiso lo dice y ofrece «¿Por qué no puedo?» sobre la búsqueda', async () => {
    await montar('perez');
    olvidarPeticiones();

    await buscar('4123456');

    expect(hechas()).toEqual(['POST /me/support-patient-search 403']);
    expect(byId('buscador-aviso-texto')!.textContent).toContain(
      'No tiene un vínculo de apoyo vigente con esta organización.',
    );
    expect(byId('buscador-por-que-boton')!.textContent).toContain('¿Por qué no puedo?');
  });
});
