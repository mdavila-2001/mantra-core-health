import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { of, Subject } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

import { AuthService } from '../../../../core/auth/auth.service';
import {
  REFERRAL_TARGET_MIN_QUERY,
  ReferralsClient,
} from '../../../../core/data-access/referrals/referrals.client';
import type {
  Referral,
  ReferralTarget,
  ReferralTargetKind,
  ReferralTargetService,
  ReferralType,
} from '../../../../core/data-access/referrals/referrals.types';
import { TerminologyClient } from '../../../../core/data-access/terminology/terminology.client';
import type { ConceptLabels } from '../../../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { dataOf, empty, loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Divider } from '../../../../shared/components/atoms/divider/divider';
import { Select } from '../../../../shared/components/atoms/select/select';
import { Textarea } from '../../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../shared/components/molecules/card/card';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ReferenceCombobox } from '../../../../shared/components/molecules/reference-combobox/reference-combobox';
import type { ReferenceOption } from '../../../../shared/components/molecules/reference-combobox/reference-combobox.types';
import { SegmentedControl } from '../../../../shared/components/molecules/segmented-control/segmented-control';
import { DatePicker } from '../../../../shared/components/organisms/date-picker/date-picker';
import { StatusSeal } from '../../../../shared/components/organisms/status-seal/status-seal';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { writeFailureMessage } from '../../write-message';
import {
  derivacionEnPantalla,
  OPCIONES_DE_DESTINO,
  OPCIONES_DE_TIPO,
  opcionesDeServicio,
  TIPO_POR_DEFECTO,
  type DerivacionEnPantalla,
} from './referral-block.model';

/** El motivo cabe en el aviso de la persona: el servidor lo corta a este largo. */
const TOPE_DEL_MOTIVO = 500;

/**
 * **Derivar** — el médico recomienda a la persona que consulte con otro
 * profesional (pedido del propietario, 24/10/2026), o la deriva a una
 * organización médica, por **un servicio concreto** de su catálogo («tipo
 * tratamiento», pedido del cliente, 28/10/2026).
 *
 * ```html
 * <app-referral-block
 *   [patientProfileId]="id"
 *   [encounterId]="encuentroActual()"
 *   [derivaciones]="derivaciones()"
 *   (cambio)="releer()"
 *   (reintentar)="releer()"
 * />
 * ```
 *
 * ## El recorrido
 *
 * Profesional u organización → buscar por nombre en la API → (opcional) uno
 * de sus servicios, con el arancel a la vista → tipo (Tratamiento por defecto)
 * → motivo y vigencia. La API le avisa a la persona en su campana. **No
 * reserva nada**.
 *
 * ## Sin encuentro no hay derivación con aviso
 *
 * El encuentro es lo que demuestra que quien deriva atendió a esa persona; sin
 * él la API guarda la derivación pero no avisa, y un formulario que parece
 * funcionar y no avisa a nadie es peor que uno que dice qué falta. Sin
 * encuentro abierto el bloque lo dice y no ofrece el formulario; la lista de
 * lo ya derivado se sigue viendo.
 *
 * ## La lista la lee quien monta el bloque
 *
 * Igual que las recetas: la consulta la necesita para el contador de la
 * casilla, y dos lecturas de la misma lista pueden discrepar. Sin
 * `derivaciones` el bloque no dibuja la lista.
 */
@Component({
  selector: 'app-referral-block',
  imports: [
    Alert,
    AppButton,
    Card,
    DatePicker,
    DatePipe,
    Divider,
    FormField,
    NgTemplateOutlet,
    ReferenceCombobox,
    SegmentedControl,
    Select,
    StatusSeal,
    Textarea,
    ViewStateHost,
  ],
  templateUrl: './referral-block.html',
  styleUrl: './referral-block.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReferralBlock {
  private readonly referrals = inject(ReferralsClient);
  private readonly terminology = inject(TerminologyClient);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  /** La persona que se deriva. */
  readonly patientProfileId = input.required<string>();

  /** El encuentro en curso, o `null` si no hay uno abierto. */
  readonly encounterId = input<string | null>(null);

  /** Las derivaciones de la persona, leídas por quien monta el bloque; `null` no dibuja la lista. */
  readonly derivaciones = input<ViewState<readonly Referral[]> | null>(null);

  /** Avisa que se emitió una derivación, para que quien monta el bloque relea. */
  readonly cambio = output<void>();

  /** La lista falló y la persona pidió reintentar. */
  readonly reintentar = output<void>();

  protected readonly opcionesDeDestino = OPCIONES_DE_DESTINO;
  protected readonly opcionesDeTipo = OPCIONES_DE_TIPO;
  protected readonly minimoDeBusqueda = REFERRAL_TARGET_MIN_QUERY;
  protected readonly topeDelMotivo = TOPE_DEL_MOTIVO;
  protected readonly hoy = new Date();

  protected readonly sinEncuentro = computed(() => this.encounterId() === null);

  /* -- El destino ---------------------------------------------------------- */

  protected readonly clase = signal<ReferralTargetKind>('PRACTITIONER');
  protected readonly destino = signal<ReferralTarget | null>(null);
  protected readonly buscando = signal(false);
  private readonly resultados = signal<readonly ReferralTarget[]>([]);
  protected readonly errorDeBusqueda = signal<string | null>(null);
  private readonly busquedas = new Subject<{ q: string; kind: ReferralTargetKind }>();

  /**
   * Alterna en cada derivación para volver a montar el buscador. El combobox
   * guarda su propio texto y no lo borra cuando el valor vuelve a `null`; sin
   * esto quedaría escrito el nombre de alguien que ya no está elegido.
   */
  protected readonly vueltaPar = signal(true);

  protected readonly opciones = computed<readonly ReferenceOption[]>(() =>
    this.resultados().map((r) => ({
      value: r.id,
      label: r.displayName,
      ...(r.subtitle === null ? {} : { hint: r.subtitle }),
    })),
  );

  /* -- Los servicios del destino ------------------------------------------ */

  protected readonly servicios = signal<ViewState<readonly ReferralTargetService[]>>(loading());
  protected readonly servicioElegido = signal<string | null>(null);

  protected readonly opcionesDeServicio = computed(() =>
    opcionesDeServicio(dataOf(this.servicios()) ?? []),
  );

  /** La descripción del servicio elegido, para no elegir a ciegas por el nombre. */
  protected readonly detalleDelServicio = computed(() => {
    const elegido = (dataOf(this.servicios()) ?? []).find((s) => s.id === this.servicioElegido());
    if (elegido === undefined) {
      return 'Opcional. Uno de los servicios que ofrece el destino, con su arancel.';
    }
    return elegido.description ?? 'El servicio que se le pide al destino.';
  });

  /* -- El resto del formulario -------------------------------------------- */

  protected readonly tipo = signal<ReferralType | null>(TIPO_POR_DEFECTO);
  protected readonly motivo = signal('');
  protected readonly vigencia = signal<Date | null>(null);

  protected readonly enviando = signal(false);
  protected readonly registro = signal<ViewState<null>>(ready(null));
  protected readonly derivadoA = signal<string | null>(null);
  protected readonly yaDerivado = signal(false);

  protected readonly puedeEnviar = computed(
    () =>
      !this.sinEncuentro() &&
      this.destino() !== null &&
      !this.enviando() &&
      this.motivo().length <= TOPE_DEL_MOTIVO,
  );

  protected readonly errorDelRegistro = computed<string | null>(() => {
    const estado = this.registro();
    if (estado.status === 'validation') {
      return estado.issues.map((issue) => issue.message).join(' ') || null;
    }
    return writeFailureMessage(estado, {
      accion: 'derivar',
      sinPermiso: 'Sólo puede derivar a quien atiende desde su propia organización.',
      yaNoExiste:
        'No encontramos este encuentro entre los de esta persona. Vuelva a abrirlo y pruebe de nuevo.',
    });
  });

  /* -- La lista ------------------------------------------------------------ */

  private readonly etiquetas = signal<ConceptLabels>(new Map());

  /** Los estados ya consultados, con respuesta o sin ella: no se espera dos veces. */
  private readonly consultadas = signal<ReadonlySet<string>>(new Set());

  /** S3 con su próxima acción cuando no hay ninguna; el resto, tal cual llega. */
  protected readonly lista = computed<ViewState<readonly DerivacionEnPantalla[]> | null>(() => {
    const estado = this.derivaciones();
    if (estado === null || (estado.status !== 'ready' && estado.status !== 'stale')) {
      return estado;
    }
    if (estado.data.length === 0) {
      return empty(
        {
          label: this.sinEncuentro()
            ? 'Abra el encuentro y derive desde el formulario'
            : 'Derive desde el formulario de arriba',
        },
        'Esta persona todavía no tiene derivaciones.',
      );
    }
    // S2 hasta saber cómo se llama cada estado: un «Sin registrar» que al
    // instante pasa a «Solicitada» es un dato falso, aunque dure poco.
    const consultadas = this.consultadas();
    if (estado.data.some((d) => !consultadas.has(d.statusConceptId))) {
      return loading();
    }
    const etiquetas = this.etiquetas();
    return ready(estado.data.map((d) => derivacionEnPantalla(d, etiquetas)));
  });

  protected readonly filas = computed(() => {
    const lista = this.lista();
    return lista === null ? [] : (dataOf(lista) ?? []);
  });

  constructor() {
    this.busquedas
      .pipe(
        switchMap(({ q, kind }) =>
          this.referrals.searchTargets(q, kind).pipe(
            map((items) => ({ items, fallo: null })),
            catchError((error: unknown) =>
              of({
                items: [] as readonly ReferralTarget[],
                fallo:
                  writeFailureMessage(errorToViewState<null>(error), {
                    accion: 'buscar destinos',
                  }) ?? 'No pudimos buscar. Pruebe de nuevo.',
              }),
            ),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ items, fallo }) => {
        // Quien deriva no se ofrece a sí mismo, aunque la API lo devuelva.
        const yo = this.auth.practitionerProfileId();
        this.buscando.set(false);
        this.resultados.set(items.filter((r) => !(r.kind === 'PRACTITIONER' && r.id === yo)));
        this.errorDeBusqueda.set(fallo);
      });

    // El estado se traduce por código: la lista trae el uuid del concepto.
    // Sólo se piden los que faltan y se suman a los ya conocidos: al releer,
    // la lista pasa por `loading`, y vaciar las etiquetas ahí pintaba
    // «Sin registrar» en cada fila hasta que volvía la traducción.
    effect(() => {
      const estado = this.derivaciones();
      const conocidas = untracked(() => this.consultadas());
      const faltan = [
        ...new Set((estado === null ? [] : (dataOf(estado) ?? [])).map((d) => d.statusConceptId)),
      ].filter((id) => !conocidas.has(id));
      if (faltan.length === 0) return;
      untracked(() =>
        this.terminology
          .readConceptLabels(faltan)
          // Sin catálogo la lista igual se muestra, con «Sin registrar».
          .pipe(catchError(() => of<ConceptLabels>(new Map())))
          .subscribe((nuevas) => {
            this.etiquetas.update((previas) => new Map([...previas, ...nuevas]));
            this.consultadas.update((previas) => new Set([...previas, ...faltan]));
          }),
      );
    });
  }

  protected elegirClase(clase: ReferralTargetKind): void {
    if (clase === this.clase()) return;
    this.clase.set(clase);
    this.olvidarDestino();
  }

  protected buscar(texto: string): void {
    const q = texto.trim();
    if (q.length < REFERRAL_TARGET_MIN_QUERY) {
      this.resultados.set([]);
      return;
    }
    this.buscando.set(true);
    this.busquedas.next({ q, kind: this.clase() });
  }

  protected elegir(opcion: ReferenceOption | null): void {
    this.derivadoA.set(null);
    this.yaDerivado.set(false);
    const destino = opcion === null ? undefined : this.resultados().find((r) => r.id === opcion.value);
    if (destino === undefined) {
      this.olvidarDestino();
      return;
    }
    this.destino.set(destino);
    this.cargarServicios();
  }

  protected cargarServicios(): void {
    const destino = this.destino();
    if (destino === null) return;
    this.servicioElegido.set(null);
    this.servicios.set(loading());
    this.referrals
      .listTargetServices(
        destino.kind === 'PRACTITIONER'
          ? { targetProfileId: destino.id }
          : { targetTenantId: destino.id },
      )
      .subscribe({
        next: (items) => {
          // Una respuesta tardía de un destino ya descartado no pisa al nuevo.
          if (this.destino()?.id !== destino.id) return;
          this.servicios.set(
            items.length === 0
              ? empty(
                  { label: 'Derive sin un servicio en particular o busque otro destino' },
                  `${destino.displayName} no tiene servicios publicados para recibir derivaciones.`,
                )
              : ready(items),
          );
        },
        error: (error: unknown) => {
          if (this.destino()?.id === destino.id) {
            this.servicios.set(errorToViewState(error));
          }
        },
      });
  }

  protected derivar(): void {
    const encuentro = this.encounterId();
    const destino = this.destino();
    if (!this.puedeEnviar() || encuentro === null || destino === null) return;

    const servicio = this.servicioElegido();
    const tipo = this.tipo();
    const motivo = this.motivo().trim();
    const vigencia = this.vigencia();

    this.enviando.set(true);
    this.registro.set(loading());
    this.yaDerivado.set(false);

    this.referrals
      .create({
        patientProfileId: this.patientProfileId(),
        sourceEncounterId: encuentro,
        // Los opcionales sin elegir se omiten: `forbidNonWhitelisted`.
        ...(destino.kind === 'PRACTITIONER'
          ? { targetProfileId: destino.id }
          : { targetTenantId: destino.id }),
        ...(servicio === null ? {} : { targetServiceCatalogId: servicio }),
        ...(tipo === null ? {} : { referralType: tipo }),
        ...(motivo === '' ? {} : { reasonText: motivo }),
        ...(vigencia === null ? {} : { validUntil: vigencia }),
      })
      .subscribe({
        next: () => {
          this.enviando.set(false);
          this.registro.set(ready(null));
          this.derivadoA.set(destino.displayName);
          this.limpiar();
          this.cambio.emit();
        },
        error: (error: unknown) => {
          this.enviando.set(false);
          // 409: la misma derivación ya existe. No es un error del médico:
          // es un aviso, y se dice con palabras de aviso.
          if (esDuplicado(error)) {
            this.registro.set(ready(null));
            this.yaDerivado.set(true);
            return;
          }
          this.registro.set(errorToViewState<null>(error));
        },
      });
  }

  private olvidarDestino(): void {
    this.destino.set(null);
    this.resultados.set([]);
    this.servicioElegido.set(null);
    this.servicios.set(loading());
    this.errorDeBusqueda.set(null);
  }

  private limpiar(): void {
    this.olvidarDestino();
    this.vueltaPar.update((par) => !par);
    this.tipo.set(TIPO_POR_DEFECTO);
    this.motivo.set('');
    this.vigencia.set(null);
  }
}

function esDuplicado(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    (error as { status: unknown }).status === 409
  );
}
