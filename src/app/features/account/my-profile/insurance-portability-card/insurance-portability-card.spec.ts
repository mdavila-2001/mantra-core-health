import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AuthService } from '../../../../core/auth/auth.service';
import { PatientContextService } from '../../../../core/patient-context/patient-context.service';
import { InsurancePortabilityCard } from './insurance-portability-card';

function query(testId: string): HTMLElement | null {
  return document.querySelector(`[data-testid="${testId}"]`);
}

function montar(opciones: {
  patientProfileId?: string | null;
  isActingForDependent?: boolean;
} = {}): ComponentFixture<InsurancePortabilityCard> {
  // `?? 'patient-1'` no serviría: un `patientProfileId: null` explícito es
  // justo el caso que se quiere probar, y `??` lo confundiría con "omitido".
  const patientProfileId: string | null =
    opciones.patientProfileId === undefined ? 'patient-1' : opciones.patientProfileId;
  TestBed.configureTestingModule({
    imports: [InsurancePortabilityCard],
    providers: [
      {
        provide: AuthService,
        useValue: { patientProfileId: () => patientProfileId },
      },
      {
        provide: PatientContextService,
        useValue: { isActingForDependent: () => opciones.isActingForDependent ?? false },
      },
    ],
  });
  const fixture = TestBed.createComponent(InsurancePortabilityCard);
  fixture.detectChanges();
  return fixture;
}

describe('InsurancePortabilityCard', () => {
  it('muestra el botón para exportar el historial', () => {
    montar();

    expect(query('insurance-portability-card')).not.toBeNull();
    expect(query('btn-open-portability-dialog')).not.toBeNull();
  });

  it('abre el diálogo al pulsar "Exportar mi historial"', () => {
    const fixture = montar();

    expect(document.querySelector('app-portability-export-dialog')).toBeNull();

    query('btn-open-portability-dialog')?.dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    );
    fixture.detectChanges();

    expect(document.querySelector('app-portability-export-dialog')).not.toBeNull();
  });

  it('avisa cuando la sesión está actuando por un dependiente', () => {
    montar({ isActingForDependent: true });

    expect(query('insurance-portability-card')?.textContent).toContain(
      'trámite personal',
    );
  });

  it('sin perfil de paciente propio, no ofrece exportar', () => {
    montar({ patientProfileId: null });

    expect(query('btn-open-portability-dialog')).toBeNull();
  });
});
