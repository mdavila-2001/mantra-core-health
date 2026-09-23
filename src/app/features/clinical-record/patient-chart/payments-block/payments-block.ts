import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { of, type Observable } from 'rxjs';
import { catchError, map, startWith, switchMap } from 'rxjs/operators';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';

import { AccountingClient } from '../../../../core/data-access/accounting/accounting.client';
import type { PaidConsultation } from '../../../../core/data-access/accounting/accounting.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { dataOf, loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Alert } from '../../../../shared/components/molecules/alert/alert';

/**
 * Cuántos pagos se muestran. Lo que quede afuera se dice, no se calla.
 *
 * Veinte son dos años de tratamiento mensual: más que eso ya no es «lo que me
 * pagó» sino un libro, y para eso está Contabilidad.
 */
const TOPE_DE_PAGOS = 20;

/** La organización todavía no abrió una práctica: no hay dónde buscar un pago. */
const SIN_PRACTICA: PagosDelPaciente = {
  pagos: [],
  total: importeFormateado('0'),
  recortados: 0,
  sinPractica: true,
};

/** Un pago ya resuelto para la lista. */
export interface PagoEnPantalla {
  readonly id: string;
  readonly comprobante: string;
  readonly cuando: Date | null;
  /** Ya formateado: el importe no se convierte a número en ningún punto. */
  readonly importe: string;
}

/** Lo que la vista necesita, ya unido: el total no se recalcula en la plantilla. */
export interface PagosDelPaciente {
  readonly pagos: readonly PagoEnPantalla[];
  readonly total: string;
  readonly recortados: number;
  /**
   * La organización no tiene una práctica todavía.
   *
   * Es un campo y no un `total` vacío: «no hay dónde buscar» y «buscamos y no
   * pagó nada» son dos respuestas distintas a la misma pregunta, y la de
   * arriba no se arregla esperando.
   */
  readonly sinPractica: boolean;
}

/**
 * **Pagos de la persona** — lo que ya pagó, dentro de la consulta.
 *
 * ```html
 * <app-payments-block [patientProfileId]="id" />
 * ```
 *
 * ## Por qué vive en la consulta y no sólo en Contabilidad
 *
 * Quien atiende **y ejecuta un tratamiento** —odontología, dermatología— toma
 * una decisión clínica y económica en el mismo acto: seguir con la siguiente
 * sesión, entregar el trabajo, indicar un control. Esa decisión necesita saber
 * qué pagó la persona, y hasta ahora la respuesta estaba en Contabilidad: otra
 * sección, otro rol y otro recorrido mental, con el paciente sentado enfrente.
 *
 * Lo que se muestra es **lo cobrado y asentado**, no una promesa: sale de
 * `GET /accounting/practitioner/paid-consultations`, que es la lista de
 * comprobantes pagados de la práctica, filtrada por esta persona.
 *
 * ## Es de sólo lectura, y a propósito
 *
 * Acá no se cobra ni se anula nada. Cobrar es un asiento contable con su
 * cuenta de debe y de haber —vive en Contabilidad, con su rol— y un botón de
 * «marcar como pagado» junto a la historia clínica sería exactamente la clase
 * de atajo que deja la caja sin cuadrar.
 *
 * ## Los importes son texto de punta a punta
 *
 * Igual que en el resto del módulo contable: `paidTotal` llega como decimal en
 * texto y se formatea sin pasar por `number`. La suma se hace en centavos
 * enteros, que es la única forma de sumar dinero sin que 0.1 + 0.2 aparezca en
 * la pantalla de alguien.
 *
 * ## Sin práctica no hay pagos que pedir
 *
 * `paid-consultations` cuelga de un `practiceId`, así que primero se leen las
 * prácticas de la organización. Una organización sin prácticas no es un error:
 * es una que todavía no abrió su caja, y eso se dice con esas palabras.
 */
@Component({
  selector: 'app-payments-block',
  imports: [Alert, AppButton, Badge, DatePipe],
  templateUrl: './payments-block.html',
  styleUrl: './payments-block.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentsBlock {
  private readonly libros = inject(AccountingClient);

  readonly patientProfileId = input.required<string>();

  /** Reintento manual: cambiarlo vuelve a disparar la lectura. */
  private readonly intento = signal(0);

  private readonly pedido = computed(() => ({
    paciente: this.patientProfileId(),
    intento: this.intento(),
  }));

  protected readonly estado = toSignal(
    toObservable(this.pedido).pipe(
      switchMap(({ paciente }): Observable<ViewState<PagosDelPaciente>> =>
        this.libros.listPractices().pipe(
          switchMap((practicas): Observable<ViewState<PagosDelPaciente>> => {
            const practica = practicas[0];
            // Sin práctica no hay caja: no es un error ni una lista vacía de
            // pagos, así que la vista lo dice con sus propias palabras.
            if (practica === undefined) {
              return of(ready(SIN_PRACTICA));
            }
            return this.libros
              .listPaidConsultations(practica.id)
              .pipe(map((facturas) => ready(resolver(facturas, paciente))));
          }),
          startWith(loading()),
          catchError((error: unknown) => of(errorToViewState<PagosDelPaciente>(error))),
        ),
      ),
    ),
    { initialValue: loading() as ViewState<PagosDelPaciente> },
  );

  protected readonly datos = computed(() => dataOf(this.estado()));

  protected readonly hayPagos = computed(() => (this.datos()?.pagos.length ?? 0) > 0);

  protected readonly sinPractica = computed(() => this.datos()?.sinPractica === true);

  protected readonly topeDePagos = TOPE_DE_PAGOS;

  protected recargar(): void {
    this.intento.update((n) => n + 1);
  }
}

/** Los comprobantes de esta persona, del más reciente al más viejo. */
function resolver(
  facturas: readonly PaidConsultation[],
  patientProfileId: string,
): PagosDelPaciente {
  const suyas = facturas
    .filter((factura) => factura.patientProfileId === patientProfileId)
    .sort((a, b) => b.issueDate.getTime() - a.issueDate.getTime());

  const pagos = suyas.slice(0, TOPE_DE_PAGOS).map(
    (factura): PagoEnPantalla => ({
      id: factura.invoiceId,
      comprobante: factura.invoiceNumber,
      cuando: Number.isNaN(factura.issueDate.getTime()) ? null : factura.issueDate,
      importe: importeFormateado(factura.paidTotal),
    }),
  );

  // El total suma **todo** lo pagado, no sólo lo que entra en la lista: es la
  // cifra que la persona reconoce como «lo que llevo pagado», y recortarla al
  // tope de la lista la haría mentir sin avisar.
  const total = suyas.reduce((acumulado, factura) => acumulado + aCentavos(factura.paidTotal), 0);

  return {
    pagos,
    total: importeFormateado(deCentavos(total)),
    recortados: Math.max(suyas.length - TOPE_DE_PAGOS, 0),
    sinPractica: false,
  };
}

/**
 * Un decimal en texto a centavos enteros.
 *
 * Trunca a dos decimales en vez de redondear: la fracción de centavo no existe
 * en un comprobante, y si llegara sería un dato del backend que no nos toca
 * interpretar hacia arriba.
 */
function aCentavos(valor: string): number {
  const [entero = '0', decimales = ''] = valor.trim().split('.');
  const centavos = `${decimales}00`.slice(0, 2);
  const signo = entero.startsWith('-') ? -1 : 1;
  return signo * (Math.abs(Number(entero)) * 100 + Number(centavos));
}

function deCentavos(centavos: number): string {
  const signo = centavos < 0 ? '-' : '';
  const absoluto = Math.abs(centavos);
  return `${signo}${Math.floor(absoluto / 100)}.${String(absoluto % 100).padStart(2, '0')}`;
}

/**
 * Importe en bolivianos, sin convertir a número: sólo se formatea.
 *
 * Mismo criterio y mismo aspecto que el tablero de Contabilidad
 * (`cockpit.ts`): las dos pantallas hablan del mismo dinero y no pueden
 * escribirlo distinto.
 */
function importeFormateado(valor: string): string {
  const partes = valor.split('.');
  const entero = (partes[0] ?? '0').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `Bs ${entero},${(partes[1] ?? '00').padEnd(2, '0')}`;
}
