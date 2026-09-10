import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';

import { AuthService } from '../../../../core/auth/auth.service';
import { ClinicalClient } from '../../../../core/data-access/clinical/clinical.client';
import type { NewAllergyReaction } from '../../../../core/data-access/clinical/clinical.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { Textarea } from '../../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../shared/components/molecules/card/card';
import { ConceptSelect } from '../../../../shared/components/molecules/concept-select/concept-select';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { AttachmentUploader } from '../../../../shared/components/organisms/attachment-uploader/attachment-uploader';
import { FormActions } from '../../../../shared/components/organisms/form-actions/form-actions';
import type { CitaDelPaciente } from '../diagnosis-block/diagnosis-block';

/** El alérgeno. Los medicamentos salen del vademécum; el resto, de este set. */
export const TARGET_SUSTANCIA = 'clinical.allergy_intolerances.substance_concept_id';
export const TARGET_TIPO = 'clinical.allergy_intolerances.type_concept_id';
export const TARGET_CATEGORIA_ALERGIA = 'clinical.allergy_intolerances.category_concept_id';
export const TARGET_CRITICIDAD = 'clinical.allergy_intolerances.criticality_concept_id';
export const TARGET_MANIFESTACION = 'clinical.allergy_reactions.manifestation_concept_id';
export const TARGET_SEVERIDAD_REACCION = 'clinical.allergy_reactions.severity_concept_id';

/** Una reacción a medio cargar, tal como la sostiene el formulario. */
interface ReaccionEnCurso {
  readonly clave: number;
  manifestacion: string | null;
  severidad: string | null;
  descripcion: string;
}

/**
 * **Alergias e intolerancias** del expediente — UC-08-09.
 *
 * ## Por qué existe
 *
 * El contrato estaba entero —`POST /clinical/allergy-intolerances` con sus
 * reacciones— y **ninguna pantalla lo usaba**: la alergia sólo se veía, en la
 * banda ámbar del expediente y en su pestaña. Registrar una era imposible desde
 * el producto.
 *
 * ## La sustancia es lo único obligatorio
 *
 * Lo dice el DTO. Todo lo demás —tipo, categoría, criticidad, reacciones— es
 * opcional, y pedirlo sería inventar requisitos que el contrato no tiene. Quien
 * registra una alergia en el mostrador sabe a qué; el resto se completa después.
 *
 * ## Varias reacciones
 *
 * Porque el contrato las declara en plural y porque una misma sustancia produce
 * más de una cosa: urticaria **y** broncoespasmo no son dos alergias.
 *
 * ## La cita es opcional y hoy no llega al backend
 *
 * `allergy_intolerances` **no tiene `encounter_id`** ni el DTO lo acepta: la
 * clave viaja igual porque la maqueta la guarda y la pantalla la muestra, y
 * contra la API real da 400 hasta que la columna exista. Ver P26.
 */
@Component({
  selector: 'app-allergy-block',
  imports: [
    Alert,
    AppButton,
    AttachmentUploader,
    Card,
    ConceptSelect,
    FormActions,
    FormField,
    Select,
    Textarea,
  ],
  templateUrl: './allergy-block.html',
  styleUrl: './allergy-block.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AllergyBlock {
  private readonly clinical = inject(ClinicalClient);
  private readonly auth = inject(AuthService);
  private readonly toasts = inject(ToastService);

  readonly patientProfileId = input.required<string>();

  /** El encuentro en curso, cuando el bloque vive dentro de la atención. */
  readonly encounterId = input<string | null>(null);

  /** Las citas del paciente, para «¿en qué cita se detectó?». */
  readonly citas = input<readonly CitaDelPaciente[]>([]);

  /** Se emite cuando la alergia quedó registrada. */
  readonly cambio = output<void>();

  protected readonly targetSustancia = TARGET_SUSTANCIA;
  protected readonly targetTipo = TARGET_TIPO;
  protected readonly targetCategoria = TARGET_CATEGORIA_ALERGIA;
  protected readonly targetCriticidad = TARGET_CRITICIDAD;
  protected readonly targetManifestacion = TARGET_MANIFESTACION;
  protected readonly targetSeveridad = TARGET_SEVERIDAD_REACCION;

  protected readonly organizacion = this.auth.activeTenantId;
  protected readonly sinOrganizacion = computed(() => this.organizacion() === null);

  protected readonly sustancia = signal<string | null>(null);
  protected readonly tipo = signal<string | null>(null);
  protected readonly categoria = signal<string | null>(null);
  protected readonly criticidad = signal<string | null>(null);
  protected readonly citaElegida = signal<string | null>(null);

  /**
   * Las reacciones cargadas. Arranca con una: registrar una alergia sin decir
   * qué pasó es lo corriente sólo cuando la persona no lo recuerda, y para eso
   * la fila se puede dejar vacía o quitar.
   */
  protected readonly reacciones = signal<readonly ReaccionEnCurso[]>([
    { clave: 0, manifestacion: null, severidad: null, descripcion: '' },
  ]);

  private siguienteClave = 1;

  protected agregarReaccion(): void {
    this.reacciones.update((actuales) => [
      ...actuales,
      { clave: this.siguienteClave++, manifestacion: null, severidad: null, descripcion: '' },
    ]);
  }

  protected quitarReaccion(clave: number): void {
    this.reacciones.update((actuales) => actuales.filter((r) => r.clave !== clave));
  }

  protected fijarManifestacion(clave: number, valor: string | null): void {
    this.actualizarReaccion(clave, (r) => ({ ...r, manifestacion: valor }));
  }

  protected fijarSeveridad(clave: number, valor: string | null): void {
    this.actualizarReaccion(clave, (r) => ({ ...r, severidad: valor }));
  }

  protected fijarDescripcion(clave: number, valor: string): void {
    this.actualizarReaccion(clave, (r) => ({ ...r, descripcion: valor }));
  }

  private actualizarReaccion(clave: number, cambiar: (r: ReaccionEnCurso) => ReaccionEnCurso): void {
    this.reacciones.update((actuales) =>
      actuales.map((r) => (r.clave === clave ? cambiar(r) : r)),
    );
  }

  /** Las opciones del selector de cita, con la vacía primero. */
  protected readonly opcionesDeCita = computed<readonly SelectOption<string | null>[]>(() => [
    { value: null, label: 'Sin cita asociada' },
    ...this.citas().map((cita) => ({
      value: cita.id,
      label: cita.enCurso ? `${cita.etiqueta} · en curso` : cita.etiqueta,
    })),
  ]);

  protected readonly registrando = signal(false);
  protected readonly registro = signal<ViewState<null>>(ready(null));

  /** La alergia recién registrada, para ofrecerle adjuntos. */
  protected readonly alergiaRecienRegistrada = signal<string | null>(null);

  protected readonly enlazarAdjuntoALaAlergia = (fileId: string, allergyId: string) =>
    this.clinical.attachFileToAllergy(allergyId, fileId);

  protected cerrarAdjuntos(): void {
    this.alergiaRecienRegistrada.set(null);
  }

  /** La sustancia es lo único obligatorio: lo dice el DTO. */
  protected readonly puedeRegistrar = computed(
    () => !this.sinOrganizacion() && this.sustancia() !== null && !this.registrando(),
  );

  protected readonly errorDeLaAlergia = computed<string | null>(() => {
    const estado = this.registro();
    if (estado.status === 'validation') {
      return estado.issues[0]?.message ?? 'No pudimos registrar la alergia.';
    }
    if ('message' in estado && typeof estado.message === 'string' && estado.message !== '') {
      return estado.message;
    }
    return estado.status === 'error' ? 'No pudimos registrar la alergia.' : null;
  });

  protected registrar(): void {
    const custodianTenantId = this.organizacion();
    const substanceConceptId = this.sustancia();
    if (custodianTenantId === null || substanceConceptId === null || this.registrando()) return;

    // Sólo las reacciones que dicen algo: la manifestación es lo obligatorio de
    // una reacción, y una fila vacía no es una reacción sin gravedad, es nada.
    const reactions: NewAllergyReaction[] = this.reacciones()
      .filter((r) => r.manifestacion !== null)
      .map((r) => ({
        manifestationConceptId: r.manifestacion!,
        ...(r.severidad === null ? {} : { severityConceptId: r.severidad }),
        ...(r.descripcion.trim() === '' ? {} : { description: r.descripcion.trim() }),
      }));

    const tipo = this.tipo();
    const categoria = this.categoria();
    const criticidad = this.criticidad();
    const encuentro = this.citaElegida() ?? this.encounterId();

    this.registrando.set(true);
    this.registro.set(loading());

    this.clinical
      .createAllergyIntolerance({
        custodianTenantId,
        patientProfileId: this.patientProfileId(),
        substanceConceptId,
        // Los opcionales sin elegir se omiten: el backend valida con
        // `forbidNonWhitelisted` y una clave en null no es «sin especificar».
        ...(tipo === null ? {} : { typeConceptId: tipo }),
        ...(categoria === null ? {} : { categoryConceptId: categoria }),
        ...(criticidad === null ? {} : { criticalityConceptId: criticidad }),
        ...(encuentro === null ? {} : { encounterId: encuentro }),
        ...(reactions.length === 0 ? {} : { reactions }),
      })
      .subscribe({
        next: (registrada) => {
          this.registrando.set(false);
          this.registro.set(ready(null));
          this.alergiaRecienRegistrada.set(registrada.id);
          this.limpiar();
          this.toasts.success('Queda en la banda de alergias del expediente.', 'Alergia registrada');
          this.cambio.emit();
        },
        error: (error: unknown) => {
          this.registrando.set(false);
          this.registro.set(errorToViewState<null>(error));
        },
      });
  }

  private limpiar(): void {
    this.sustancia.set(null);
    this.tipo.set(null);
    this.categoria.set(null);
    this.criticidad.set(null);
    this.citaElegida.set(null);
    this.reacciones.set([
      { clave: this.siguienteClave++, manifestacion: null, severidad: null, descripcion: '' },
    ]);
  }
}
