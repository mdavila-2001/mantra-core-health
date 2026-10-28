import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, map, Observable, of, startWith, switchMap } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import {
  InsuranceClient,
} from '../../../core/data-access/insurance/insurance.client';
import {
  type ClaimQuoteInput,
  type ClaimQuoteResult,
  type CreatedClaim,
  type PatientCoverageOption,
} from '../../../core/data-access/insurance/insurance.types';
import { ServicesCatalogClient } from '../../../core/data-access/services-catalog/services-catalog.client';
import { unavailableMessageOf } from '../../../core/data-access/simulator-only';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { dataOf, empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { ClaimQuoteBreakdown } from '../../../shared/components/molecules/claim-quote-breakdown/claim-quote-breakdown';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { ReferenceCombobox } from '../../../shared/components/molecules/reference-combobox/reference-combobox';
import type { ReferenceOption } from '../../../shared/components/molecules/reference-combobox/reference-combobox.types';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { aVistaDeCotizacion, motivoDeBloqueo } from './claim-quote-vm';
import { LoadingState } from '../../../shared/components/molecules/loading-state/loading-state';

/** Importe en bolivianos: dígitos con hasta dos decimales, y algo distinto de cero. */
const IMPORTE = /^\d+(\.\d{1,2})?$/;
const SERVICIOS_POR_BUSQUEDA = 20;

/**
 * **Cobro con seguro** (REQ-16-026): cotiza el cobro de un servicio con la
 * cobertura de la persona y lo envía a la aseguradora solo si la cotización
 * lo permite. Vive dentro del bloque «Pagos» de la consulta.
 *
 * El reparto lo calcula el servidor en cada cambio (con una pausa para no
 * pedir en cada tecla). La pantalla no suma ni recalcula: solo muestra lo que
 * vuelve, y bloquea el envío con el motivo en usted cuando algo falta.
 */
@Component({
  selector: 'app-claim-quote-section',
  imports: [AppButton, Input, Alert, ClaimQuoteBreakdown, FormField, ReferenceCombobox, LoadingState],
  templateUrl: './claim-quote-section.html',
  styleUrl: './claim-quote-section.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClaimQuoteSection {
  private readonly client = inject(InsuranceClient);
  private readonly procedimientos = inject(ServicesCatalogClient);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly patientProfileId = input.required<string>();

  /** Se emite con el reclamo creado, para que quien usa la pantalla lo sepa. */
  readonly enviado = output<CreatedClaim>();

  /** Coberturas de la persona: la primera vigente es la que se cotiza. */
  protected readonly coberturas = toSignal(
    toObservable(this.patientProfileId).pipe(
      switchMap((id): Observable<ViewState<readonly PatientCoverageOption[]>> =>
        this.client.listCoveragesOfPatient(id).pipe(
          map((items): ViewState<readonly PatientCoverageOption[]> =>
            items.length > 0
              ? ready(items)
              : empty(
                  { label: 'Continuar con el cobro habitual' },
                  'Esta persona no tiene un seguro vigente registrado. El cobro se hace de forma particular.',
                ),
          ),
          startWith(loading()),
          catchError((error: unknown): Observable<ViewState<readonly PatientCoverageOption[]>> => {
            // Contra la API real la lectura no existe todavía: se dice, no se
            // presenta como una falla de la persona ni del sistema.
            const aviso = unavailableMessageOf(error);
            return of(
              aviso === null
                ? errorToViewState<readonly PatientCoverageOption[]>(error)
                : empty({ label: 'Continuar con el cobro habitual' }, aviso),
            );
          }),
        ),
      ),
    ),
    { initialValue: loading() as ViewState<readonly PatientCoverageOption[]> },
  );

  /** El aviso de «sin seguro» sale del estado de carga, sin leerlo desde la plantilla. */
  protected readonly avisoSinCobertura = computed(() => {
    const estado = this.coberturas();
    return estado.status === 'empty' ? (estado.message ?? '') : '';
  });

  protected readonly cobertura = computed<PatientCoverageOption | null>(
    () => dataOf(this.coberturas())?.[0] ?? null,
  );

  /* ---- el formulario ------------------------------------------------------- */

  protected readonly servicioId = signal<string | null>(null);
  protected readonly busquedaDeServicio = signal('');
  protected readonly montoTexto = signal<string | number | null>('');
  protected readonly autorizacionTexto = signal<string | number | null>('');

  /** Los servicios del nomenclador que coinciden con lo escrito. */
  protected readonly opciones = toSignal(
    toObservable(this.busquedaDeServicio).pipe(
      debounceTime(250),
      switchMap((termino) =>
        this.procedimientos
          .searchProcedures({ query: termino, limit: SERVICIOS_POR_BUSQUEDA })
          .pipe(
            map((pagina): readonly ReferenceOption[] =>
              pagina.items.map((item) => ({
                value: item.conceptId,
                label: item.display,
                hint: item.specialty === null ? item.code : `${item.code} · ${item.specialty}`,
              })),
            ),
            catchError(() => of<readonly ReferenceOption[]>([])),
          ),
      ),
    ),
    { initialValue: [] as readonly ReferenceOption[] },
  );

  protected readonly etiquetaDelServicio = computed(
    () => this.opciones().find((opcion) => opcion.value === this.servicioId())?.label ?? 'Servicio cotizado',
  );

  protected readonly montoValido = computed(() => {
    const monto = String(this.montoTexto() ?? '').trim();
    return IMPORTE.test(monto) && /[1-9]/.test(monto);
  });

  protected readonly montoIncompleto = computed(() => {
    const monto = String(this.montoTexto() ?? '').trim();
    return monto !== '' && !this.montoValido();
  });

  /** El pedido de cotización, o `null` mientras falta algo para cotizar. */
  protected readonly pedido = computed<ClaimQuoteInput | null>(() => {
    const cobertura = this.cobertura();
    const servicio = this.servicioId();
    if (cobertura === null || servicio === null || !this.montoValido()) return null;
    const autorizacion = String(this.autorizacionTexto() ?? '').trim();
    return {
      insuranceCarrierId: cobertura.insuranceCarrierId,
      patientCoverageId: cobertura.id,
      ...(autorizacion === '' ? {} : { priorAuthorizationRequestId: autorizacion }),
      lines: [
        {
          lineSequence: 1,
          serviceConceptId: servicio,
          billedAmount: String(this.montoTexto()).trim(),
        },
      ],
    };
  });

  /** La cotización del servidor para el pedido actual. */
  protected readonly cotizacion = toSignal(
    toObservable(this.pedido).pipe(
      debounceTime(300),
      switchMap((pedido): Observable<ViewState<ClaimQuoteResult>> => {
        if (pedido === null) {
          return of(empty({ label: 'Elija el servicio y el monto' }, 'Elija el servicio y el monto para ver el reparto del cobro.'));
        }
        return this.client.quoteClaim(pedido).pipe(
          map((resultado): ViewState<ClaimQuoteResult> => ready(resultado)),
          startWith(loading()),
          catchError((error: unknown) => of(errorToViewState<ClaimQuoteResult>(error))),
        );
      }),
    ),
    { initialValue: empty({ label: 'Elija el servicio y el monto' }) as ViewState<ClaimQuoteResult> },
  );

  protected readonly resultado = computed(() => dataOf(this.cotizacion()));

  protected readonly vista = computed(() => {
    const resultado = this.resultado();
    return resultado === null ? null : aVistaDeCotizacion(resultado, this.etiquetaDelServicio(), 'BOB');
  });

  protected readonly motivo = computed(() => {
    const resultado = this.resultado();
    return resultado === null ? null : motivoDeBloqueo(resultado);
  });

  protected readonly puedeEnviar = computed(
    () => this.resultado()?.canSubmit === true && !this.enviando() && this.cobertura() !== null,
  );

  /* ---- el envío ----------------------------------------------------------- */

  protected readonly enviando = signal(false);
  protected readonly identificadorEnviado = signal<string | null>(null);
  protected readonly errorDeEnvio = signal<string | null>(null);

  protected elegirServicio(id: string | null): void {
    this.servicioId.set(id);
  }

  protected enviar(): void {
    const pedido = this.pedido();
    const cobertura = this.cobertura();
    const resultado = this.resultado();
    if (pedido === null || cobertura === null || resultado === null || !resultado.canSubmit) return;
    if (this.enviando()) return;

    const identificador = `COB-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    this.enviando.set(true);
    this.errorDeEnvio.set(null);
    this.client
      .createClaim({
        ...pedido,
        billingProviderEntityId: this.auth.activeTenantId() ?? '',
        claimIdentifier: identificador,
        ...(resultado.currencyConceptId === null ? {} : { currencyConceptId: resultado.currencyConceptId }),
        idempotencyKey: crypto.randomUUID(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (creado) => {
          this.enviando.set(false);
          this.identificadorEnviado.set(identificador);
          this.toast.success('Cobro enviado a la aseguradora');
          this.servicioId.set(null);
          this.montoTexto.set('');
          this.autorizacionTexto.set('');
          this.enviado.emit(creado);
        },
        error: () => {
          this.enviando.set(false);
          this.errorDeEnvio.set(
            'No pudimos enviar el cobro a la aseguradora. Revise los datos y vuelva a intentarlo. Si el problema continúa, consulte con su administrador.',
          );
        },
      });
  }

}
