import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { PatientContextService } from '../../../core/patient-context/patient-context.service';
import { ProfilesClient } from '../../../core/data-access/profiles/profiles.client';
import type {
  Dependent,
  IncomingDependentLinkRequest,
} from '../../../core/data-access/profiles/profiles.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { EmptyState } from '../../../shared/components/molecules/empty-state/empty-state';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { RelatedPersonRelationshipsCatalog } from '../../../core/data-access/system-context/related-person-relationships.service';
import { DependentFormDialog, type SolicitudEnviada } from './dependent-form-dialog';

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
    Select,
    Alert,
    Card,
    EmptyState,
    FormField,
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
  protected readonly sinPerfilDePaciente = computed(() => this.auth.patientProfileId() === null);

  private readonly profiles = inject(ProfilesClient);
  private readonly relationshipsCatalog = inject(RelatedPersonRelationshipsCatalog);

  /** Lo que otras personas le pidieron a esta cuenta: ser su dependiente. */
  protected readonly solicitudes = signal<readonly IncomingDependentLinkRequest[]>([]);
  /** La solicitud que se está respondiendo, para bloquear el doble clic. */
  protected readonly respondiendo = signal<string | null>(null);
  protected readonly opcionesDeRelacion = signal<readonly SelectOption<string>[]>([]);
  private readonly relacionesElegidas = signal<ReadonlyMap<string, string>>(new Map());

  constructor() {
    if (this.sinPerfilDePaciente()) return;
    this.contexto.loadDependents();
    this.cargarSolicitudes();
  }

  private cargarSolicitudes(): void {
    this.profiles.listIncomingDependentLinkRequests().subscribe({
      next: (filas) => {
        this.solicitudes.set(filas);
        if (filas.length > 0) this.cargarRelaciones();
      },
      error: () => this.solicitudes.set([]),
    });
  }

  private cargarRelaciones(): void {
    const permitidos = new Set([
      'RELATIONSHIP_GUARDIAN',
      'RELATIONSHIP_MOTHER',
      'RELATIONSHIP_FATHER',
      'RELATIONSHIP_SPOUSE',
      'RELATIONSHIP_CHILD',
    ]);
    this.relationshipsCatalog.listar().subscribe({
      next: (opciones) =>
        this.opcionesDeRelacion.set(
          opciones
            .filter((opcion) => permitidos.has(opcion.code))
            .map((opcion) => ({
              value: opcion.conceptId,
              label: this.relationshipsCatalog.etiquetaDe(opcion),
            })),
        ),
      error: () => this.opcionesDeRelacion.set([]),
    });
  }

  protected relacionDe(solicitudId: string): string | null {
    return this.relacionesElegidas().get(solicitudId) ?? null;
  }

  protected cambiarRelacion(solicitudId: string, relacion: string | null): void {
    const siguientes = new Map(this.relacionesElegidas());
    if (relacion === null) siguientes.delete(solicitudId);
    else siguientes.set(solicitudId, relacion);
    this.relacionesElegidas.set(siguientes);
  }

  /** Se envió la solicitud; el vínculo nace cuando la otra persona acepte. */
  protected enviada(envio: SolicitudEnviada): void {
    this.registrando.set(false);
    this.toast.show({
      type: 'success',
      message: `Enviamos la solicitud a ${envio.destinatario}. Cuando la acepte, va a aparecer en su lista.`,
    });
  }

  protected responder(solicitud: IncomingDependentLinkRequest, aceptar: boolean): void {
    if (this.respondiendo() !== null) return;
    const relacion = this.relacionDe(solicitud.id);
    if (aceptar && relacion === null) return;
    this.respondiendo.set(solicitud.id);
    const operacion = aceptar
      ? this.profiles.acceptDependentLinkRequest(solicitud.id, relacion ?? undefined)
      : this.profiles.rejectDependentLinkRequest(solicitud.id);
    operacion.subscribe({
      next: () => {
        this.respondiendo.set(null);
        this.solicitudes.update((filas) => filas.filter((f) => f.id !== solicitud.id));
        this.toast.show({
          type: aceptar ? 'success' : 'info',
          message: aceptar
            ? `Aceptó: ${solicitud.requesterDisplayName} ahora puede actuar por usted.`
            : `Rechazó la solicitud de ${solicitud.requesterDisplayName}.`,
        });
      },
      error: () => {
        this.respondiendo.set(null);
        this.toast.show({
          type: 'error',
          message: 'No se pudo responder la solicitud. Intente de nuevo.',
        });
        this.cargarSolicitudes();
      },
    });
  }

  /** Pasa a operar por ese dependiente. */
  protected elegir(dependiente: Dependent): void {
    this.contexto.selectPatient(dependiente.patientProfileId);
    this.toast.show({
      type: 'success',
      message: `Ahora está actuando por ${dependiente.fullName}.`,
    });
  }

  /** Vuelve a operar por uno mismo. */
  protected volverAMi(): void {
    this.contexto.resetToSelf();
    this.toast.show({ type: 'info', message: 'Volvió a su propio perfil.' });
  }

  /** Cómo se dice la edad de alguien en la tarjeta. */
  protected edad(dependiente: Dependent): string {
    const anios = dependiente.ageYears;
    if (anios === undefined) return 'Edad no declarada';
    if (anios === 0) return 'Menos de un año';
    return anios === 1 ? '1 año' : `${anios} años`;
  }
}
