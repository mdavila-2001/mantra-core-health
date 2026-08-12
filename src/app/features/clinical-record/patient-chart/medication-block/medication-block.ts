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
import { SystemContextClient } from '../../../../core/data-access/system-context/system-context.client';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Input as AppInput } from '../../../../shared/components/atoms/input/input';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../shared/components/molecules/card/card';
import { ConceptSelect } from '../../../../shared/components/molecules/concept-select/concept-select';
import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { FormActions } from '../../../../shared/components/organisms/form-actions/form-actions';
import { StatusSeal } from '../../../../shared/components/organisms/status-seal/status-seal';

/**
 * La columna que gobierna el medicamento.
 *
 * El selector resuelve sus opciones por **binding de columna**, no por un value
 * set elegido acá: `esquema.tabla.columna` es lo que el catálogo publica, y es
 * lo que hace que el día que el binding se declare esta pantalla funcione sin
 * tocar una línea.
 */
export const TARGET_MEDICAMENTO = 'clinical.medication_requests.medication_concept_id';

/** La vía de administración. Opcional en el DTO: sin binding, se omite y ya. */
export const TARGET_VIA = 'clinical.medication_requests.route_concept_id';

/** La unidad de la cantidad. Mismo trato que la vía. */
export const TARGET_UNIDAD = 'clinical.medication_requests.unit_concept_id';

/**
 * Las vías en castellano, por código estable.
 *
 * El catálogo trae su `display` en inglés técnico porque es terminología, no
 * copy de producto, y mapear por **código** —no por uuid— es lo que permite
 * traducir sin atarse a un identificador que un re-seed puede mover.
 */
const ETIQUETAS_DE_VIA: Readonly<Record<string, string>> = {
  ROUTE_ORAL: 'Oral',
  ROUTE_IV: 'Intravenosa',
  ROUTE_IM: 'Intramuscular',
  ROUTE_SC: 'Subcutánea',
  ROUTE_TOP: 'Tópica',
  ROUTE_INH: 'Inhalatoria',
};

/** Las unidades en castellano. Mismo criterio que {@link ETIQUETAS_DE_VIA}. */
const ETIQUETAS_DE_UNIDAD: Readonly<Record<string, string>> = {
  UNIT_mg: 'mg',
  UNIT_g: 'g',
  UNIT_mL: 'mL',
  'UNIT_{tablet}': 'Comprimidos',
  'UNIT_{capsule}': 'Cápsulas',
  'UNIT_[drp]': 'Gotas',
};

/** Largo máximo de los dos textos libres. El backend no los acota; la legibilidad sí. */
const TOPE_DEL_TEXTO = 200;

/** Una receta del expediente, ya sin uuid y con su ciclo resuelto. */
export interface RecetaEnFicha {
  readonly id: string;
  /** El medicamento en palabras. Nunca el uuid del concepto. */
  readonly medicamento: string;
  /** Dosis y frecuencia, tal como se escribieron. */
  readonly indicacion: string;
  readonly estado: string;
  readonly firmada: boolean;
  readonly emitida: boolean;
}

/**
 * **Medicación** del expediente: prescribir, firmar y emitir — V08-01.
 *
 * ## Por qué es un componente y no más líneas en el expediente
 *
 * Porque la receta tiene su propio ciclo —borrador, firma, emisión— con tres
 * llamadas, un formulario y un camino de error que no se parece a ningún otro
 * de la pantalla. Metido en `PatientChart` habría duplicado el estado de
 * escritura del encuentro y mezclado dos avisos que compiten por el mismo
 * rincón. Aparte, además, deja la plantilla del expediente casi intacta, que
 * es lo que permite que otro carril agregue sus bloques sin pelearse por el
 * mismo archivo.
 *
 * ## Vive dentro del encuentro abierto
 *
 * El recorrido de quien atiende es check-in → ficha → recetar ahí mismo. Sin
 * encuentro en curso el bloque no ofrece el formulario: `encounterId` es
 * opcional en el contrato, pero una receta suelta —sin la consulta que la
 * motivó— es un dato que después nadie sabe explicar.
 *
 * ## El binding del selector se verifica antes de ofrecer nada
 *
 * `medicationConceptId` es obligatorio y sale del catálogo. Si la columna no
 * tiene binding declarado el selector queda vacío **por diseño** —no cae a
 * texto libre, porque un uuid tecleado a mano es un dato inválido o, peor, uno
 * válido de otro conjunto—. En ese caso el bloque lo dice con todas las letras
 * en vez de mostrar un formulario que no puede enviarse: es un dato que falta
 * en el catálogo, no un fallo de quien atiende.
 *
 * ## El `422` de emitir sin firmar es un paso que falta, no un error
 *
 * Con la política de firma D-05 vigente, emitir una receta sin firmar responde
 * `422 PRECONDITION_FAILED` (la `PreconditionFailedException` del proyecto es
 * 422, **no** 412). Se muestra como aviso de precondición y con la salida al
 * lado —el botón de firmar—, no como un error rojo: el sistema no falló, falta
 * un acto que quien receta tiene que hacer.
 *
 * ## Después de cada acción se relee
 *
 * Nada de mutar la lista en memoria. Las tres escrituras devuelven el estado
 * nuevo, pero la lista sale de `GET /clinical/patients/:id/summary`, y el
 * bloque avisa al expediente para que vuelva a leer. Una receta que aparece
 * porque la pintamos nosotros y no porque el servidor la tenga es exactamente
 * la clase de mentira que el expediente no puede permitirse.
 */
@Component({
  selector: 'app-medication-block',
  imports: [
    Alert,
    AppButton,
    AppInput,
    Card,
    ConceptSelect,
    FormActions,
    FormField,
    StatusSeal,
  ],
  templateUrl: './medication-block.html',
  styleUrl: './medication-block.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MedicationBlock {
  private readonly clinical = inject(ClinicalClient);
  private readonly systemContext = inject(SystemContextClient);
  private readonly auth = inject(AuthService);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);

  /** La persona de la ficha. */
  readonly patientProfileId = input.required<string>();

  /**
   * El encuentro en curso, o `null` si no hay ninguno abierto.
   *
   * Lo sabe el expediente —lo deriva de `endAt`, no del estado— y baja hecho:
   * el bloque no vuelve a preguntarlo para que no puedan discrepar.
   */
  readonly encounterId = input<string | null>(null);

  /** Las recetas de la persona, ya traducidas por el expediente. */
  readonly recetas = input.required<readonly RecetaEnFicha[]>();

  /**
   * Algo se escribió y el expediente tiene que releerse.
   *
   * Un solo aviso para las tres escrituras: lo que cambia es siempre el mismo
   * bloque, y quien lo recibe hace lo mismo en los tres casos.
   */
  readonly cambio = output<void>();

  protected readonly topeDelTexto = TOPE_DEL_TEXTO;
  protected readonly targetMedicamento = TARGET_MEDICAMENTO;
  protected readonly targetVia = TARGET_VIA;
  protected readonly targetUnidad = TARGET_UNIDAD;
  protected readonly etiquetasDeVia = ETIQUETAS_DE_VIA;
  protected readonly etiquetasDeUnidad = ETIQUETAS_DE_UNIDAD;

  /**
   * La organización bajo la que se receta.
   *
   * `custodianTenantId` es obligatorio en el DTO y no se deduce del paciente:
   * es quién responde por el registro, y eso lo eligió la sesión.
   */
  protected readonly organizacion = this.auth.activeTenantId;

  /* -- El formulario ------------------------------------------------------- */

  protected readonly medicamento = signal<string | null>(null);
  protected readonly dosis = signal('');
  protected readonly frecuencia = signal('');
  /** El control numérico devuelve texto: se convierte al enviar, no al teclear. */
  protected readonly cantidad = signal<string | number | null>('');
  protected readonly via = signal<string | null>(null);
  protected readonly unidad = signal<string | null>(null);

  /**
   * Si el catálogo del medicamento está disponible.
   *
   * `null` mientras se pregunta. Es el paso 0 hecho en código y no una vez a
   * mano: el día que el binding se declare, esta pantalla empieza a funcionar
   * sin desplegar nada nuevo.
   */
  protected readonly catalogoListo = signal<boolean | null>(null);

  protected readonly registrando = signal(false);

  /** La receta sobre la que hay una acción en vuelo, o `null`. */
  protected readonly accionEnCurso = signal<string | null>(null);

  /**
   * El resultado de la última escritura.
   *
   * Uno solo para las tres: sólo puede haber una en vuelo, y dos avisos
   * simultáneos sobre el mismo bloque compiten entre sí.
   */
  protected readonly registro = signal<ViewState<null>>(ready(null));

  /**
   * La receta que se intentó emitir sin firmar, si el `422` vino de ahí.
   *
   * Se guarda para poder decir **cuál** necesita firma y ofrecer el botón al
   * lado: «esta receta necesita firma» sin señalar cuál es un aviso que obliga
   * a adivinar.
   */
  private readonly recetaSinFirma = signal<RecetaEnFicha | null>(null);

  protected readonly hayEncuentro = computed(() => {
    const id = this.encounterId();
    return id !== null && id !== '';
  });

  protected readonly sinOrganizacion = computed(() => this.organizacion() === null);

  /**
   * Si el formulario puede enviarse.
   *
   * Las cuatro condiciones son del contrato, no de prudencia: encuentro en
   * curso (decisión de esta pantalla), organización activa y medicamento
   * elegido (obligatorios del DTO), y nada en vuelo.
   */
  protected readonly puedeRecetar = computed(
    () =>
      this.hayEncuentro() &&
      !this.sinOrganizacion() &&
      this.medicamento() !== null &&
      !this.registrando(),
  );

  /**
   * El aviso de precondición, en palabras.
   *
   * Separado del error de verdad porque **no es un error**: el `422` de emitir
   * sin firmar describe un paso que falta y tiene salida inmediata. Pintarlo en
   * rojo enseñaría a quien receta que el sistema se rompe cuando en realidad lo
   * está protegiendo.
   */
  protected readonly avisoDePrecondicion = computed<string | null>(() => {
    const receta = this.recetaSinFirma();
    if (receta === null) {
      return null;
    }
    return `«${receta.medicamento}» necesita tu firma antes de emitirse.`;
  });

  /**
   * El fallo de la escritura, en palabras.
   *
   * Mismo criterio que el encuentro: `errorToViewState` trae el
   * `PRECONDITION_FAILED` como una validación **con su código**, que es lo que
   * permite reconocerlo sin leer el mensaje. La diferencia es que acá hay dos
   * precondiciones distintas —falta la firma, o la receta ya no es un borrador—
   * y sólo la primera tiene salida desde esta pantalla.
   */
  protected readonly errorDeLaReceta = computed<string | null>(() => {
    // La precondición de firma ya se contó como aviso: repetirla en rojo sería
    // decir dos veces lo mismo con dos tonos que se contradicen.
    if (this.recetaSinFirma() !== null) {
      return null;
    }

    const state = this.registro();
    if (state.status === 'validation') {
      if (state.issues.some((issue) => issue.code === 'PRECONDITION_FAILED')) {
        return 'Esa receta ya no está en borrador: alguien la emitió o la invalidó antes. Recargá el expediente.';
      }
      return state.issues.map((issue) => issue.message).join(' ') || null;
    }
    if (state.status === 'forbidden') {
      return state.message ?? 'Tu rol no permite recetar.';
    }
    if (state.status === 'not-found') {
      return 'La receta ya no existe. Recargá el expediente.';
    }
    if (state.status === 'offline') {
      return 'No pudimos conectarnos. Revisá tu conexión y reintentá.';
    }
    if (state.status === 'error') {
      return `${state.message || 'Ocurrió un error inesperado.'} (${state.requestId})`;
    }
    return null;
  });

  /** El sello de una receta según dónde esté del ciclo. */
  protected selloDe(receta: RecetaEnFicha): 'pending' | 'in-review' | 'approved' {
    if (receta.emitida) {
      return 'approved';
    }
    return receta.firmada ? 'in-review' : 'pending';
  }

  constructor() {
    // El catálogo se pregunta una sola vez: el cliente memoiza por target, así
    // que esta llamada y la del selector son la misma petición.
    this.systemContext.dynamicEnum(TARGET_MEDICAMENTO).subscribe({
      next: (enumeracion) => this.catalogoListo.set(enumeracion.options.length > 0),
      // Sin binding declarado la API responde 404. No es un fallo transitorio
      // que convenga reintentar: es un dato que falta en el catálogo.
      error: () => this.catalogoListo.set(false),
    });
  }

  /* -- Las tres escrituras ------------------------------------------------- */

  /**
   * Prescribe la medicación (UC-08-10) — la receta queda en borrador.
   *
   * Sin confirmación previa: un borrador no compromete a nadie y se firma o se
   * descarta después. El diálogo se reserva para emitir, que sí es sin vuelta.
   */
  protected recetar(): void {
    const patientProfileId = this.patientProfileId();
    const custodianTenantId = this.organizacion();
    const medicationConceptId = this.medicamento();
    const encounterId = this.encounterId();

    if (
      custodianTenantId === null ||
      medicationConceptId === null ||
      encounterId === null ||
      this.registrando()
    ) {
      return;
    }

    const dosis = this.dosis().trim();
    const frecuencia = this.frecuencia().trim();
    const cantidad = cantidadDe(this.cantidad());
    const via = this.via();
    const unidad = this.unidad();

    this.registrando.set(true);
    this.registro.set(loading());
    this.recetaSinFirma.set(null);

    this.clinical
      .createMedicationRequest({
        custodianTenantId,
        patientProfileId,
        medicationConceptId,
        encounterId,
        // Los opcionales vacíos se **omiten**: una dosis en blanco es una
        // indicación registrada que no dice nada, y se lee peor que su ausencia.
        ...(dosis === '' ? {} : { doseText: dosis }),
        ...(frecuencia === '' ? {} : { frequencyText: frecuencia }),
        ...(cantidad === null ? {} : { quantityDecimal: cantidad }),
        ...(via === null ? {} : { routeConceptId: via }),
        ...(unidad === null ? {} : { unitConceptId: unidad }),
      })
      .subscribe({
        next: () => {
          this.registrando.set(false);
          this.registro.set(ready(null));
          this.limpiar();
          this.toasts.success('Queda en borrador hasta que la firmes.', 'Receta creada');
          this.cambio.emit();
        },
        error: (error: unknown) => {
          this.registrando.set(false);
          this.registro.set(errorToViewState<null>(error));
        },
      });
  }

  /**
   * Firma la receta (D-05).
   *
   * Sin confirmación: firmar es aditivo y no cierra nada —una receta firmada
   * todavía puede no emitirse—. Lo que sí hace es habilitar la emisión, que es
   * el paso que se confirma.
   */
  protected firmar(receta: RecetaEnFicha): void {
    if (this.accionEnCurso() !== null) {
      return;
    }

    this.accionEnCurso.set(receta.id);
    this.registro.set(loading());
    this.recetaSinFirma.set(null);

    this.clinical.signMedicationRequest(receta.id).subscribe({
      next: () => {
        this.accionEnCurso.set(null);
        this.registro.set(ready(null));
        this.toasts.success('Ya puede emitirse.', 'Receta firmada');
        this.cambio.emit();
      },
      error: (error: unknown) => {
        this.accionEnCurso.set(null);
        this.registro.set(errorToViewState<null>(error));
      },
    });
  }

  /**
   * Emite la receta y la vuelve inmutable.
   *
   * Con confirmación, y no por prudencia genérica: una receta emitida no se
   * edita —toda corrección pasa por invalidar o reemplazar— y es la que sale
   * del consultorio. Es el mismo criterio con el que se confirma el cierre de
   * un encuentro.
   */
  protected async emitir(receta: RecetaEnFicha): Promise<void> {
    if (this.accionEnCurso() !== null) {
      return;
    }

    const confirmado = await this.dialogs.confirm({
      title: '¿Emitir la receta?',
      message: `Se emite «${receta.medicamento}». Una receta emitida no se puede editar: para corregirla hay que invalidarla o reemplazarla.`,
      confirmLabel: 'Emitir receta',
    });
    if (!confirmado) {
      return;
    }

    this.accionEnCurso.set(receta.id);
    this.registro.set(loading());
    this.recetaSinFirma.set(null);

    this.clinical.issueMedicationRequest(receta.id).subscribe({
      next: () => {
        this.accionEnCurso.set(null);
        this.registro.set(ready(null));
        this.toasts.success('Queda sellada y no se puede editar.', 'Receta emitida');
        this.cambio.emit();
      },
      error: (error: unknown) => {
        this.accionEnCurso.set(null);
        const state = errorToViewState<null>(error);
        this.registro.set(state);
        // La precondición se distingue por su código, y **cuál** de las dos es
        // se sabe de este lado: si la receta no estaba firmada, lo que falta es
        // la firma. Si lo estaba, el estado que muestra la pantalla quedó viejo.
        if (
          !receta.firmada &&
          state.status === 'validation' &&
          state.issues.some((issue) => issue.code === 'PRECONDITION_FAILED')
        ) {
          this.recetaSinFirma.set(receta);
        }
      },
    });
  }

  /** Vacía el formulario tras un alta. El siguiente medicamento arranca limpio. */
  private limpiar(): void {
    this.medicamento.set(null);
    this.dosis.set('');
    this.frecuencia.set('');
    this.cantidad.set('');
    this.via.set(null);
    this.unidad.set(null);
  }
}

/**
 * La cantidad como número, o nada.
 *
 * El control numérico devuelve el texto tal cual se tecleó, y `Number('')` es
 * `0`: sin este filtro una receta sin cantidad viajaría con «cantidad cero»,
 * que en una indicación médica no es lo mismo que no haberla escrito.
 */
function cantidadDe(valor: string | number | null): number | null {
  if (valor === null || valor === '') {
    return null;
  }
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}
