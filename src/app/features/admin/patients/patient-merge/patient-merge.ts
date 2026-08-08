import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { ProfilesClient } from '../../../../core/data-access/profiles/profiles.client';
import type {
  PatientListItem,
  PatientMergeEvent,
} from '../../../../core/data-access/profiles/profiles.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { NavigationService } from '../../../../core/navigation/navigation.service';
import { loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AnnounceOnAppear } from '../../../../shared/a11y/announce-on-appear';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import type { BreadcrumbItem } from '../../../../shared/components/molecules/breadcrumb/breadcrumb.types';
import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ReferenceCombobox } from '../../../../shared/components/molecules/reference-combobox/reference-combobox';
import type { ReferenceOption } from '../../../../shared/components/molecules/reference-combobox/reference-combobox.types';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { FormActions } from '../../../../shared/components/organisms/form-actions/form-actions';
import { FormSection } from '../../../../shared/components/organisms/form-section/form-section';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { patientDetailRoute, PATIENTS_ROUTE } from '../patients.routes';

/** Cuántos candidatos trae cada búsqueda del combobox. */
const CANDIDATOS_POR_BUSQUEDA = 10;

/**
 * Fusión de pacientes duplicados — acción **V05-01·A** (UC-05-08 y UC-05-09).
 *
 * ## Por qué es una pantalla y no un modal
 *
 * La ficha del vault la especifica como «modal con formulario (3 campos)». Se
 * hizo como pantalla, y la razón es del sistema de diseño, no del gusto:
 * **`app-dialog` es un diálogo de confirmación, no un anfitrión de
 * formularios** — su contrato es `confirm({ title, message })` y no proyecta
 * contenido. Las alternativas eran extender la molécula (cambio en `shared/`
 * que necesita validación del diseñador) o rehacer a mano el `<dialog>` nativo
 * dentro de esta pantalla, duplicando la trampa de foco y la inertización que
 * el sistema ya resuelve una vez.
 *
 * El diálogo **sí** se usa para lo que es: la confirmación final, que acá es
 * obligatoria (`destructive`).
 *
 * Y para una operación de esta consecuencia, la pantalla ayuda: se ven los dos
 * registros enteros antes de decidir, en vez de dos renglones apretados.
 *
 * ## Los dos perfiles NO son intercambiables
 *
 * El que sobrevive conserva su historia; el otro queda absorbido. Elegirlos al
 * revés no es un error de tipeo recuperable, así que la pantalla lo dice con
 * palabras en cada campo y repite ambos nombres en la confirmación.
 *
 * ## Revertir sólo es posible acá y ahora
 *
 * `POST /profiles/patients/merge/:eventId/reverse` necesita el identificador
 * del evento, y **el backend no expone ningún listado de eventos de fusión**:
 * el único lugar del mundo donde ese identificador existe es la respuesta que
 * acaba de llegar. Por eso el «Deshacer» se ofrece en el resultado y se
 * advierte que, al salir, la fusión deja de ser reversible desde la interfaz.
 * No es una decisión de diseño: es lo único que el contrato permite.
 *
 * ## El motivo queda afuera
 *
 * `reasonConceptId` es opcional en las dos operaciones y es un campo de
 * catálogo. No hay forma de que el frontend sepa a qué conjunto de valores lo
 * liga el modelo, y para esos campos el modelo sólo tiene sembrado un
 * placeholder `DEFAULT_*`. Ver el bloqueo B1 de `HALLAZGOS-Y-BLOQUEOS-W1.md`.
 */
@Component({
  selector: 'app-patient-merge',
  imports: [
    Alert,
    AnnounceOnAppear,
    AppButton,
    FormActions,
    FormField,
    FormSection,
    PageHeader,
    ReferenceCombobox,
  ],
  templateUrl: './patient-merge.html',
  styleUrl: './patient-merge.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientMerge {
  private readonly profiles = inject(ProfilesClient);
  private readonly navigation = inject(NavigationService);
  private readonly router = inject(Router);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);

  protected readonly breadcrumbs = computed<readonly BreadcrumbItem[]>(() => {
    const base = this.navigation.breadcrumbs();
    const ultimo = base.at(-1);
    if (ultimo === undefined) {
      return [];
    }
    return [
      ...base.slice(0, -1),
      { label: ultimo.label, routerLink: PATIENTS_ROUTE },
      { label: 'Fusionar duplicados' },
    ];
  });

  /* ---- los dos lados de la fusión ---------------------------------------- */

  protected readonly sobreviviente = signal<ReferenceOption | null>(null);
  protected readonly absorbido = signal<ReferenceOption | null>(null);

  protected readonly candidatosSobreviviente = signal<readonly ReferenceOption[]>([]);
  protected readonly candidatosAbsorbido = signal<readonly ReferenceOption[]>([]);

  protected readonly buscandoSobreviviente = signal(false);
  protected readonly buscandoAbsorbido = signal(false);

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly enviando = computed(() => this.state().status === 'loading');

  /** El evento de la fusión recién hecha. Es lo único que permite deshacerla. */
  protected readonly resultado = signal<PatientMergeEvent | null>(null);

  protected readonly deshaciendo = signal(false);
  protected readonly deshecha = signal(false);

  /**
   * Fusionar a alguien consigo mismo no es una fusión: el backend lo
   * rechazaría, pero decirlo antes de enviar ahorra el viaje y explica mejor.
   */
  protected readonly mismoPaciente = computed(() => {
    const a = this.sobreviviente();
    const b = this.absorbido();
    return a !== null && b !== null && a.value === b.value;
  });

  protected readonly puedeFusionar = computed(
    () => this.sobreviviente() !== null && this.absorbido() !== null && !this.mismoPaciente(),
  );

  protected readonly errorMessage = computed<string | null>(() => {
    const state = this.state();
    if (state.status === 'validation') {
      return state.issues.map((issue) => issue.message).join(' ') || null;
    }
    if (state.status === 'forbidden') {
      return state.message ?? 'No tenés permiso para fusionar pacientes.';
    }
    if (state.status === 'not-found') {
      return 'Alguno de los dos perfiles ya no existe. Volvé a buscarlos.';
    }
    if (state.status === 'offline') {
      return 'No pudimos conectarnos. Revisá tu conexión y reintentá.';
    }
    if (state.status === 'error') {
      return `${state.message || 'Ocurrió un error inesperado.'} (${state.requestId})`;
    }
    return null;
  });

  /* ---- búsqueda de candidatos -------------------------------------------- */

  protected buscarSobreviviente(texto: string): void {
    this.buscar(texto, this.candidatosSobreviviente, this.buscandoSobreviviente);
  }

  protected buscarAbsorbido(texto: string): void {
    this.buscar(texto, this.candidatosAbsorbido, this.buscandoAbsorbido);
  }

  /**
   * Busca pacientes y los traduce a opciones del combobox.
   *
   * El `hint` lleva el código y la fecha de nacimiento porque este es
   * **justamente** el caso en que hay homónimos: se está buscando un duplicado,
   * así que dos filas con el mismo nombre es lo esperable, no la excepción.
   * Sin algo que las distinga, la pantalla invitaría a fusionar la equivocada.
   */
  private buscar(
    texto: string,
    destino: { set: (opciones: readonly ReferenceOption[]) => void },
    cargando: { set: (valor: boolean) => void },
  ): void {
    if (texto === '') {
      destino.set([]);
      return;
    }

    cargando.set(true);
    this.profiles.searchPatients({ query: texto, limit: CANDIDATOS_POR_BUSQUEDA }).subscribe({
      next: (pagina) => {
        destino.set(pagina.items.map(toOption));
        cargando.set(false);
      },
      error: () => {
        // El combobox muestra «sin resultados»; el error general de la pantalla
        // se reserva para el envío, que es lo que la persona vino a hacer.
        destino.set([]);
        cargando.set(false);
      },
    });
  }

  /* ---- fusionar ---------------------------------------------------------- */

  protected async fusionar(): Promise<void> {
    if (this.enviando() || !this.puedeFusionar()) {
      return;
    }

    const sobrevive = this.sobreviviente();
    const absorbe = this.absorbido();
    if (sobrevive === null || absorbe === null) {
      return;
    }

    // Se nombran los dos y en el orden en que va a ocurrir: una confirmación
    // que dice «¿confirmás la acción?» no confirma nada.
    const confirmado = await this.dialogs.confirm({
      title: 'Confirmar la fusión',
      message:
        `«${absorbe.label}» se va a fusionar dentro de «${sobrevive.label}», que es el que ` +
        'sobrevive y conserva la historia. Queda registrado y es auditable.',
      confirmLabel: 'Fusionar',
      destructive: true,
    });

    if (!confirmado) {
      return;
    }

    this.state.set(loading());

    this.profiles
      .mergePatients({
        survivingPatientProfileId: sobrevive.value,
        mergedPatientProfileId: absorbe.value,
      })
      .subscribe({
        next: (evento) => {
          this.state.set(ready(null));
          this.resultado.set(evento);
          this.toasts.success('Los dos registros quedaron fusionados.');
        },
        error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
      });
  }

  /* ---- deshacer ---------------------------------------------------------- */

  /**
   * Revierte la fusión recién hecha.
   *
   * Sin confirmación a propósito: deshacer devuelve las cosas a como estaban y
   * el paso atrás no necesita fricción — la fricción va en el paso que cambia
   * el estado, que ya la tuvo.
   */
  protected deshacer(): void {
    const evento = this.resultado();
    if (evento === null || this.deshaciendo() || this.deshecha()) {
      return;
    }

    this.deshaciendo.set(true);

    this.profiles.reverseMerge(evento.id).subscribe({
      next: () => {
        this.deshaciendo.set(false);
        this.deshecha.set(true);
        this.toasts.success('La fusión quedó revertida.');
      },
      error: (error: unknown) => {
        this.deshaciendo.set(false);
        this.state.set(errorToViewState<null>(error));
      },
    });
  }

  /* ---- salidas ------------------------------------------------------------ */

  protected verSobreviviente(): void {
    const sobrevive = this.sobreviviente();
    if (sobrevive !== null) {
      void this.router.navigateByUrl(patientDetailRoute(sobrevive.value));
    }
  }

  protected volver(): void {
    void this.router.navigateByUrl(PATIENTS_ROUTE);
  }

  /** Deja la pantalla lista para otra fusión y suelta el evento anterior. */
  protected otraFusion(): void {
    this.sobreviviente.set(null);
    this.absorbido.set(null);
    this.candidatosSobreviviente.set([]);
    this.candidatosAbsorbido.set([]);
    this.resultado.set(null);
    this.deshecha.set(false);
    this.state.set(ready(null));
  }
}

/**
 * De paciente a opción del buscador.
 *
 * El rótulo nunca queda vacío: sin nombre cargado, el código identifica igual —
 * y en una pantalla de fusión, una opción sin texto sería imposible de elegir
 * con criterio.
 */
function toOption(paciente: PatientListItem): ReferenceOption {
  const nacimiento = paciente.birthDate?.toLocaleDateString('es-419');

  return {
    value: paciente.profileId,
    label: paciente.displayName ?? `Sin nombre · ${paciente.patientCode}`,
    hint: nacimiento === undefined
      ? paciente.patientCode
      : `${paciente.patientCode} · nacido/a el ${nacimiento}`,
  };
}
