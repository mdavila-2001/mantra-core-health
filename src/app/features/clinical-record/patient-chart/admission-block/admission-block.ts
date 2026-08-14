import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import { AuthService } from '../../../../core/auth/auth.service';
import { ClinicalClient } from '../../../../core/data-access/clinical/clinical.client';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../shared/components/molecules/card/card';
import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { DatePicker } from '../../../../shared/components/organisms/date-picker/date-picker';
import { FormActions } from '../../../../shared/components/organisms/form-actions/form-actions';

/**
 * Una internación tal como la muestra la ficha: sin uuid y con el «sigue
 * abierta» ya resuelto.
 */
export interface InternacionEnFicha {
  readonly id: string;
  readonly abierta: boolean;
  readonly desde: Date | null;
  readonly hasta: Date | null;
}

/**
 * **Alta de internación** desde el expediente — punto 8 del reclamo.
 *
 * ## Lo que faltaba, en una línea
 *
 * El expediente ya cargaba como contexto al iniciar la atención, y los
 * encuentros ya traían su `episodeId`. Lo que no existía era **abrir** el
 * episodio: `clinical.client.ts` no tenía ningún método para crear uno, así que
 * el `episodeId` sólo se podía leer si alguien lo había creado por fuera del
 * sistema. Quien atendía a una persona que había que internar no tenía dónde
 * decirlo.
 *
 * ## Se da de alta desde la atención que ya está ocurriendo
 *
 * El bloque exige un **encuentro en curso**. El contrato no lo pide —se puede
 * abrir un episodio sin encuentro— pero una internación que nace sin la
 * consulta que la motivó es un registro que después nadie sabe explicar. Es el
 * mismo criterio con el que el diagnóstico y la receta viven dentro del
 * encuentro.
 *
 * ## El `409` no es un error: es que ya está internada
 *
 * El backend rechaza un segundo episodio activo para el mismo paciente en la
 * misma organización. La salida no es reintentar: es mirar el episodio que ya
 * está arriba, en este mismo bloque. Por eso se cuenta en ámbar y señalando
 * dónde está.
 *
 * ## Después de abrir, se relee
 *
 * La lista sale de `GET /clinical/patients/:id/summary`, no de la respuesta del
 * alta. Una internación que aparece porque la pintamos nosotros y no porque el
 * servidor la tenga es la clase de mentira que un expediente no puede
 * permitirse — y es exactamente lo que la definición de hecho pide comprobar:
 * que la internación siga ahí al reabrir la ficha.
 */
@Component({
  selector: 'app-admission-block',
  imports: [Alert, Card, DatePicker, DatePipe, FormActions, FormField],
  templateUrl: './admission-block.html',
  styleUrl: './admission-block.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdmissionBlock {
  private readonly clinical = inject(ClinicalClient);
  private readonly auth = inject(AuthService);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);

  /** La persona de la ficha. */
  readonly patientProfileId = input.required<string>();

  /**
   * El encuentro en curso, o `null` si no hay ninguno abierto.
   *
   * Lo sabe el expediente —lo deriva de `endAt`, no del estado— y baja hecho,
   * igual que en los otros bloques: preguntarlo dos veces permitiría que las
   * dos respuestas discreparan.
   */
  readonly encounterId = input<string | null>(null);

  /** Las internaciones que ya tiene esta persona, del expediente. */
  readonly internaciones = input<readonly InternacionEnFicha[]>([]);

  /** Algo se escribió y el expediente tiene que releerse. */
  readonly cambio = output<void>();

  /* -- El formulario ------------------------------------------------------- */

  protected readonly inicio = signal<Date | null>(null);

  protected readonly registrando = signal(false);

  /** El resultado de la última escritura. */
  protected readonly registro = signal<ViewState<null>>(ready(null));

  /**
   * La organización bajo cuya custodia queda el episodio.
   *
   * `tenantId` es obligatorio y no se deduce del paciente: una persona puede
   * estar atendida en más de una organización, y quién responde por la
   * internación lo eligió la sesión.
   */
  protected readonly organizacion = this.auth.activeTenantId;

  protected readonly sinOrganizacion = computed(() => this.organizacion() === null);

  protected readonly hayEncuentro = computed(() => {
    const id = this.encounterId();
    return id !== null && id !== '';
  });

  /**
   * La internación abierta, si la hay.
   *
   * Es la que hace que el formulario no tenga sentido: abrir una segunda
   * responde `409`, así que en vez de ofrecerlo se muestra la que está en curso.
   */
  protected readonly internacionAbierta = computed<InternacionEnFicha | null>(
    () => this.internaciones().find((internacion) => internacion.abierta) ?? null,
  );

  protected readonly puedeRegistrar = computed(
    () =>
      this.hayEncuentro() &&
      !this.sinOrganizacion() &&
      this.internacionAbierta() === null &&
      !this.registrando(),
  );

  /**
   * El aviso de la internación ya abierta, en palabras.
   *
   * Separado del error porque **no es un error**: es el expediente negándose a
   * abrir dos veces la misma estancia. La salida está a la vista, arriba.
   */
  protected readonly avisoDeDuplicado = computed<string | null>(() => {
    const state = this.registro();
    if (
      state.status === 'validation' &&
      state.issues.some((issue) => issue.code === 'CONFLICT')
    ) {
      return 'Esta persona ya tiene una internación abierta: es la que figura acá arriba. No hace falta abrir otra.';
    }
    return null;
  });

  /** El fallo de la escritura, en palabras. */
  protected readonly errorDelRegistro = computed<string | null>(() => {
    if (this.avisoDeDuplicado() !== null) {
      return null;
    }

    const state = this.registro();
    if (state.status === 'validation') {
      return state.issues.map((issue) => issue.message).join(' ') || null;
    }
    if (state.status === 'forbidden') {
      return state.message ?? 'Tu rol no permite dar de alta internaciones.';
    }
    if (state.status === 'not-found') {
      return 'El expediente ya no existe. Recargá la pantalla.';
    }
    if (state.status === 'offline') {
      return 'No pudimos conectarnos. Revisá tu conexión y reintentá.';
    }
    if (state.status === 'error') {
      return `${state.message || 'Ocurrió un error inesperado.'} (${state.requestId})`;
    }
    return null;
  });

  /**
   * Da de alta la internación (UC-08-01).
   *
   * **Con confirmación**, a diferencia del encuentro y del diagnóstico: el
   * backend no publica ningún endpoint para cerrar ni anular un episodio, así
   * que desde la interfaz esto no se deshace. El M34 reserva el diálogo
   * exactamente para eso.
   */
  protected async registrar(): Promise<void> {
    const patientProfileId = this.patientProfileId();
    const tenantId = this.organizacion();
    if (!this.puedeRegistrar() || tenantId === null || patientProfileId === '') {
      return;
    }

    const confirmado = await this.dialogs.confirm({
      title: '¿Dar de alta la internación?',
      message:
        'Queda abierta hasta que se cierre, y desde acá no se puede anular. Va a aparecer como contexto cada vez que se abra este expediente.',
      confirmLabel: 'Dar de alta',
    });
    if (!confirmado) {
      return;
    }

    const inicio = this.inicio();
    const profesional = this.auth.practitionerProfileId();

    this.registrando.set(true);
    this.registro.set(loading());

    this.clinical
      .createCareEpisode({
        patientProfileId,
        tenantId,
        // Los opcionales sin valor se **omiten**: el backend valida con
        // `forbidNonWhitelisted`, y una clave en `undefined` viajaría declarada.
        ...(inicio === null ? {} : { startAt: inicio }),
        // Quién queda a cargo, del claim de la sesión. Una internación sin
        // responsable es una estancia sin nadie que responda por ella.
        ...(profesional === null ? {} : { responsiblePractitionerId: profesional }),
      })
      .subscribe({
        next: () => {
          this.registrando.set(false);
          this.registro.set(ready(null));
          this.inicio.set(null);
          this.toasts.success(
            'Queda abierta y aparece como contexto del expediente.',
            'Internación dada de alta',
          );
          this.cambio.emit();
        },
        error: (error: unknown) => {
          this.registrando.set(false);
          this.registro.set(errorToViewState<null>(error));
        },
      });
  }
}
