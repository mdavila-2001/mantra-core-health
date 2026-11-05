import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { SupportStaffClient } from '../../../core/data-access/support-staff/support-staff.client';
import type { SupportStaffRegistration } from '../../../core/data-access/support-staff/support-staff.types';
import { BoDepartmentsCatalog } from '../../../core/data-access/terminology/bo-departments.service';
import { RegisterSupportStaff } from './register-support-staff';

/**
 * El alta de la secretaria reusa las piezas y las reglas del alta de paciente:
 * lo que se fija acá es que el formulario no deje pasar lo que el de paciente
 * tampoco deja y que el cuerpo sea el acordado.
 */
describe('RegisterSupportStaff', () => {
  let fixture: ComponentFixture<RegisterSupportStaff>;
  const enviados: SupportStaffRegistration[] = [];

  beforeEach(async () => {
    enviados.length = 0;
    await TestBed.configureTestingModule({
      imports: [RegisterSupportStaff],
      providers: [
        provideRouter([]),
        { provide: BoDepartmentsCatalog, useValue: { listar: () => of([{ conceptId: 'dep-sc', display: 'Santa Cruz' }]) } },
        {
          provide: SupportStaffClient,
          useValue: {
            registerSupportStaff: (datos: SupportStaffRegistration) => {
              enviados.push(datos);
              return of({ userId: 'u', personId: 'p', supportProfileId: 's', role: 'SUPPORT_STAFF', emailVerificationSent: true });
            },
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(RegisterSupportStaff);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  function interno<T>(nombre: string): T {
    const valor = (fixture.componentInstance as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(fixture.componentInstance) : valor) as T;
  }

  function formulario() {
    return interno<{
      controls: Record<string, { setValue: (v: unknown) => void; value: unknown }>;
      invalid: boolean;
      patchValue: (v: unknown) => void;
    }>('form');
  }

  function completar(cambios: Record<string, unknown> = {}) {
    formulario().patchValue({
      personName: { name: 'Rosa', middleName: '', thirdName: '', lastName: 'Choque', motherLastName: 'Mamani' },
      nationalId: '6001001',
      issuerAdministrativeAreaConceptId: 'dep-sc',
      birthDate: new Date(1990, 4, 4),
      email: 'rosa@ejemplo.com',
      phone: '+591 70012345',
      password: 'secreta123',
      ...cambios,
    });
  }

  it('no envía con un documento con espacios ni sin correo con dominio', () => {
    completar({ nationalId: '600 1001' });
    expect(formulario().invalid).toBe(true);
    completar({ email: 'rosa@ejemplo' });
    expect(formulario().invalid).toBe(true);
    interno<() => void>('submit')();
    expect(enviados).toHaveLength(0);
  });

  it('rechaza a una menor de edad', () => {
    completar({ birthDate: new Date() });
    // El tope lo pone el selector de fecha (maxDate); el requerido sigue en el control.
    const paginas = interno<() => readonly { campos: readonly { key: string; maxDate?: Date | 'today' }[] }[]>('paginas')();
    const fecha = paginas.flatMap((p) => p.campos).find((c) => c.key === 'birthDate');
    expect(fecha?.maxDate instanceof Date && fecha.maxDate.getFullYear()).toBe(new Date().getFullYear() - 18);
  });

  it('envía el alta y orienta a aceptar la invitación del hospital', () => {
    completar();
    interno<() => void>('submit')();
    expect(enviados[0]).toEqual(
      expect.objectContaining({
        name: 'Rosa',
        lastName: 'Choque',
        nationalId: '6001001',
        birthDate: '1990-05-04',
        phone: '+591 70012345',
      }),
    );
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="alta-apoyo-siguiente"]')).not.toBeNull();
  });
});
