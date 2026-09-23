import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { PatientContextService } from '../../../core/patient-context/patient-context.service';
import type { Dependent } from '../../../core/data-access/profiles/profiles.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { EmptyState } from '../../../shared/components/molecules/empty-state/empty-state';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { DependentFormDialog } from './dependent-form-dialog';

/**
 * Las personas a cargo del titular, y el alta de una nueva.
 *
 * ## Qué es un dependiente acá
 *
 * Alguien por quien el titular puede actuar: pedirle turno, leer su historia.
 * No es lo mismo que un contacto de emergencia —esa es la persona a la que hay
 * que llamar, y se declara en el propio perfil—, y la diferencia se ve en lo
 * que cada uno habilita.
 *
 * ## Por qué la pantalla no decide nada
 *
 * Elegir a alguien acá cambia el contexto de la interfaz, no los permisos. La
 * API exige apoderamiento vigente en cada petición y responde 403 si no lo hay:
 * esta pantalla ofrece la conmutación, no la autoriza.
 */
@Component({
  selector: 'app-dependents',
  imports: [
    RouterLink,
    AppButton,
    Badge,
    Alert,
    Card,
    EmptyState,
    PageHeader,
    DependentFormDialog,
  ],
  templateUrl: './dependents.html',
  styleUrl: './dependents.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dependents {
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  protected readonly contexto = inject(PatientContextService);

  /** Si el diálogo de alta está abierto. */
  protected readonly registrando = signal(false);

  protected readonly dependents = this.contexto.dependents;
  protected readonly loading = this.contexto.loading;
  protected readonly loaded = this.contexto.loaded;
  protected readonly activo = this.contexto.activePatientProfileId;

  /**
   * La cuenta no es de un paciente.
   *
   * No es un error ni falta de permisos: quien atiende tiene sesión válida y
   * ninguna razón para tener dependientes. Mismo criterio que «Mis citas».
   */
  protected readonly sinPerfilDePaciente = computed(
    () => this.auth.patientProfileId() === null,
  );

  constructor() {
    this.contexto.loadDependents();
  }

  /** Pasa a operar por ese dependiente. */
  protected elegir(dependiente: Dependent): void {
    this.contexto.selectPatient(dependiente.patientProfileId);
    this.toast.show({
      type: 'success',
      message: `Ahora estás actuando por ${dependiente.fullName}.`,
    });
  }

  /** Vuelve a operar por uno mismo. */
  protected volverAMi(): void {
    this.contexto.resetToSelf();
    this.toast.show({ type: 'info', message: 'Volviste a tu propio perfil.' });
  }

  /** Suma el recién registrado y pasa a operar por él. */
  protected registrado(dependiente: Dependent): void {
    this.registrando.set(false);
    this.contexto.addDependent(dependiente);
    this.contexto.selectPatient(dependiente.patientProfileId);
    this.toast.show({
      type: 'success',
      message: `${dependiente.fullName} quedó registrado.`,
    });
  }

  /** Cómo se dice la edad de alguien en la tarjeta. */
  protected edad(dependiente: Dependent): string {
    const anios = dependiente.ageYears;
    if (anios === undefined) return 'Edad no declarada';
    if (anios === 0) return 'Menos de un año';
    return anios === 1 ? '1 año' : `${anios} años`;
  }
}
