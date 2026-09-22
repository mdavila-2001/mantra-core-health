import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AuthService } from '../../../../core/auth/auth.service';
import type {
  CoverageValidity,
  OwnCoverage,
} from '../../../../core/data-access/profiles/profiles.types';
import { PatientContextService } from '../../../../core/patient-context/patient-context.service';
import { InsurancePortabilityCard } from './insurance-portability-card';

/** Una cobertura con lo mínimo que la tarjeta mira: su vigencia. */
function cobertura(validityStatus: CoverageValidity): OwnCoverage {
  return {
    id: `cov-${validityStatus}-${Math.random()}`,
    carrierName: 'Alianza Vida',
    isPublic: false,
    verified: true,
    validityStatus,
    benefits: [],
  };
}

function query(testId: string): HTMLElement | null {
  return document.querySelector(`[data-testid="${testId}"]`);
}

function montar(opciones: {
  patientProfileId?: string | null;
  isActingForDependent?: boolean;
  coverages?: readonly OwnCoverage[];
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
  fixture.componentRef.setInput('coverages', opciones.coverages ?? []);
  fixture.detectChanges();
  return fixture;
}

describe('InsurancePortabilityCard', () => {
  it('muestra el botón para exportar el historial', () => {
    montar();

    expect(query('insurance-portability-card')).not.toBeNull();
    expect(query('btn-open-portability-dialog')).not.toBeNull();
  });

  it('el botón se llama «Exportar certificado de portabilidad»', () => {
    montar();

    // Es el nombre accesible que fija el requisito, y el mismo con el que se
    // titula el diálogo que abre (WCAG 2.5.3, la etiqueta está en el nombre).
    expect(query('btn-open-portability-dialog')?.textContent?.trim()).toBe(
      'Exportar certificado de portabilidad',
    );
  });

  describe('estado de las coberturas', () => {
    it('sin coberturas declaradas lo dice, y ofrece exportar igual', () => {
      montar({ coverages: [] });

      expect(query('portability-coverage-summary')?.textContent?.trim()).toBe(
        'No tenés coberturas declaradas.',
      );
      // El derecho de portabilidad no depende de tener una cobertura.
      expect(query('btn-open-portability-dialog')).not.toBeNull();
    });

    it('con todas vigentes las cuenta sin más', () => {
      montar({ coverages: [cobertura('CURRENT'), cobertura('CURRENT')] });

      expect(query('portability-coverage-summary')?.textContent?.trim()).toBe(
        '2 coberturas vigentes.',
      );
    });

    it('una sola vigente va en singular', () => {
      montar({ coverages: [cobertura('CURRENT')] });

      expect(query('portability-coverage-summary')?.textContent?.trim()).toBe(
        '1 cobertura vigente.',
      );
    });

    it('con algunas vencidas dice cuántas de cuántas siguen vigentes', () => {
      montar({
        coverages: [cobertura('CURRENT'), cobertura('EXPIRED'), cobertura('UPCOMING')],
      });

      expect(query('portability-coverage-summary')?.textContent?.trim()).toBe(
        '1 de 3 coberturas vigentes.',
      );
    });

    it('sin ninguna vigente no dice «0 de N», que se lee como un error', () => {
      montar({ coverages: [cobertura('EXPIRED'), cobertura('INACTIVE')] });

      expect(query('portability-coverage-summary')?.textContent?.trim()).toBe(
        '2 coberturas declaradas, ninguna vigente.',
      );
    });

    it('una vigencia desconocida no cuenta como vigente', () => {
      // `UNKNOWN` es «no sabemos», no «sí»: contarla como vigente sería
      // afirmarle al titular algo que la API no confirmó.
      montar({ coverages: [cobertura('UNKNOWN')] });

      expect(query('portability-coverage-summary')?.textContent?.trim()).toBe(
        '1 cobertura declarada, ninguna vigente.',
      );
    });
  });

  it('abre el diálogo al pulsar el botón de exportar', () => {
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
