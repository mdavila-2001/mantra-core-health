import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';

import { InsuranceClient } from '../../../core/data-access/insurance/insurance.client';
import type {
  ClaimDetail,
  ClaimLine,
  ClaimLineDuplicateStudy,
} from '../../../core/data-access/insurance/insurance.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { dataOf, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { Tooltip } from '../../../shared/components/atoms/tooltip/tooltip';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { currencySuffix, formatAmount, formatMoney } from '../money-format';
import { displayCurrency } from '../../../core/money/display-currency';
import { InsuranceContactChannels } from './insurance-contact-channels/insurance-contact-channels';

/**
 * Detalle de una solicitud de seguro — `administration/insurance-claims/:claimId`.
 *
 * ## La cabecera es texto, no un formulario deshabilitado
 *
 * El pedido dice «tipo formulario pero no habilitado para edición». Se dibuja
 * como una lista de definiciones con el aire de un formulario, y **no** como
 * `<input readonly>`: un campo deshabilitado sigue siendo un campo —entra en
 * el orden de tabulación en algunos navegadores, se copia distinto, y le dice
 * a quien usa lector de pantalla «acá se escribe, pero no podés». Lo que hay
 * que comunicar es que esto **se lee**, y para eso el elemento correcto es
 * texto.
 *
 * ## El total de los ítems lo suma el servidor
 *
 * Y se compara **como cadena** contra el declarado en la cabecera. Sumar
 * decimales en el navegador produce descuadres de un céntimo indistinguibles
 * de un error real; y si los dos números difieren de verdad, la pantalla lo
 * **dice** en vez de taparlo — un descuadre entre lo facturado y la suma de
 * los ítems es exactamente lo que alguien tiene que ver.
 *
 * ## La cláusula y la justificación son del ítem; la disposición, de la versión
 *
 * `claim_line_adjudications` tiene el motivo catalogado (`reason_concept_id`,
 * todavía sin catálogo real — P-16-4) y, desde v4.2.9 (subtarea 2.2), la cita
 * textual de la cláusula contractual (`policy_clause_reference`) y la
 * justificación circunstanciada (`denial_rationale`) **por ítem**. El texto de
 * `claim_adjudication_versions.disposition_text` sigue siendo **de la versión
 * entera** y se muestra donde corresponde, una vez, con el dictamen: repetirlo
 * en cada fila lo haría pasar por un motivo particular de ese ítem.
 *
 * ## El contacto de la aseguradora es un enlace, no una acción (subtarea 2.3)
 *
 * `app-insurance-contact-channels` dibuja WhatsApp/call center/correo de
 * `detail.header` — la cabecera de la solicitud ya trae los tres canales, sin
 * una consulta aparte. Esta pantalla no envía nada por su cuenta: los botones
 * son anclas que abren el canal con el destino y, en el caso de WhatsApp, el
 * mensaje ya cargados; el resto lo hace el teléfono o el correo del usuario.
 */
@Component({
  selector: 'app-insurance-claim-detail',
  imports: [
    Alert,
    AppButton,
    Badge,
    InsuranceContactChannels,
    PageHeader,
    RouterLink,
    Tooltip,
    ViewStateHost,
  ],
  // `imports` sólo habilita `| date` en la plantilla; `duplicateSummary()`
  // arma el texto del globo en esta clase e inyecta `DatePipe` directo, que
  // necesita el proveedor explícito (NG0201 si falta — visto en el diálogo
  // de antiduplicación de `AnalysisOrderBlock`).
  providers: [DatePipe],
  templateUrl: './insurance-claim-detail.html',
  styleUrl: './insurance-claim-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InsuranceClaimDetail {

  private readonly insurance = inject(InsuranceClient);
  private readonly navigation = inject(NavigationService);
  private readonly route = inject(ActivatedRoute);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly datePipe = inject(DatePipe);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  private readonly claimId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('claimId') ?? '')),
    { initialValue: '' },
  );

  protected readonly state = signal<ViewState<ClaimDetail>>(loading());
  protected readonly claim = computed(() => dataOf(this.state()) ?? null);

  /** Si «Reclamar» está en vuelo: evita el doble envío desde la pantalla. */
  protected readonly claiming = signal(false);

  /**
   * Si la suma de los ítems no coincide con el monto declarado.
   *
   * La comparación es de **cadena normalizada**, no de números: `'1250.0'` y
   * `'1250.00'` son el mismo dinero con distinta escala, y marcarlos como
   * descuadre sería un falso positivo. Lo que se normaliza es la escala; lo
   * que **no** se hace es redondear para que cierre.
   */
  protected readonly totalMismatch = computed(() => {
    const detail = this.claim();
    if (!detail) return false;
    return !sameDecimal(
      detail.header.billedTotal.amount,
      detail.lineBilledTotal.amount,
    );
  });

  constructor() {
    this.load();
  }

  protected retry(): void {
    this.load();
  }

  /** Muestra un importe con su moneda, o el texto de la ausencia. */
  protected money = formatMoney;

  /**
   * Sólo el importe, para la tabla de ítems.
   *
   * La moneda va **una vez** en el encabezado de cada columna: repetirla en
   * cada celda son seis «Boliviano» por fila que no aportan nada y empujaban
   * la tabla fuera de la pantalla —medido a 1440 px: la última columna quedaba
   * cortada a media palabra—.
   */
  protected amount = formatAmount;

  /** Sufijo de moneda del encabezado, tomado del propio importe. */
  protected currency = currencySuffix;

  /**
   * La moneda visible de un importe: «Bs» para el boliviano y la UMA del
   * arancel, el código tal cual para cualquier otra. Ver `display-currency.ts`.
   */
  protected moneda(code?: string | null): string {
    return displayCurrency(code);
  }

  /**
   * Resumen del documento clínico que respalda un ítem.
   *
   * **Nombra qué es** cuando el modelo lo sabe, y dice que no lo sabe cuando
   * el ítem sólo trae una referencia de texto libre. Inventar «atención» o
   * «receta» a partir de un `varchar` sin integridad referencial es afirmar
   * algo que la base no sostiene.
   *
   * @param line - El ítem facturado.
   * @returns El texto del globo de resumen.
   */
  protected referenceSummary(line: ClaimLine): string {
    if (line.reference === null) {
      return 'Este ítem no declara documento clínico de origen.';
    }
    if (line.referenceType === 'DIAGNOSTIC_STUDY') {
      return `Estudio diagnóstico ofertado · ${line.reference}`;
    }
    if (line.referenceType === 'MEDICATION_DISPENSATION') {
      return `Línea de dispensación de medicamento · ${line.reference}`;
    }
    return (
      `Referencia clínica declarada: ${line.reference}. ` +
      'El tipo de documento no está registrado en el modelo, así que no se ' +
      'afirma cuál es.'
    );
  }

  /**
   * Cómo se rotula el tipo de documento en la columna.
   *
   * @param line - El ítem facturado.
   * @returns El rótulo corto.
   */
  protected referenceLabel(line: ClaimLine): string {
    if (line.reference === null) return 'Sin documento';
    if (line.referenceType === 'DIAGNOSTIC_STUDY') return 'Estudio';
    if (line.referenceType === 'MEDICATION_DISPENSATION') return 'Dispensación';
    return 'Tipo no registrado';
  }

  /**
   * El globo del badge «Posible duplicado» (antiduplicación de estudios,
   * v4.2.17, T-26, subtarea 3.2): fecha, prestador y la justificación del
   * médico si repitió el estudio. Nunca el informe en sí — eso es
   * `duplicateStudy` sin más que metadatos, por diseño (FT-32-R02).
   *
   * @param duplicate - El estudio duplicado del ítem.
   * @returns El texto del globo.
   */
  protected duplicateSummary(duplicate: ClaimLineDuplicateStudy): string {
    const fecha = this.datePipe.transform(duplicate.performedAt, 'd MMM y') ?? '';
    const base = `Estudio idéntico (${duplicate.studyName}) realizado el ${fecha} en ${duplicate.providerName}.`;
    return duplicate.reused
      ? `${base} Reutilizó el informe previo en vez de repetirlo.`
      : `${base} Justificación médica: ${duplicate.justification ?? 'sin registrar'}`;
  }

  /**
   * Reclama el dictamen vigente, reabriendo el caso.
   *
   * Pide confirmación porque presentar un reclamo es un acto que la
   * aseguradora recibe y no se puede retirar desde acá. La operación es
   * idempotente en el servidor: si ya hay una disputa abierta sobre esa misma
   * versión, se devuelve ésa — por eso el botón no se esconde después de
   * reclamar, sólo cambia lo que dice.
   */
  protected async claimAgain(): Promise<void> {
    const detail = this.claim();
    if (!detail || this.claiming()) return;

    const confirmed = await this.dialogs.confirm({
      title: 'Reclamar esta solicitud',
      message:
        'Se abre un reclamo sobre el dictamen vigente. El dictamen anterior ' +
        'no se borra ni se modifica: queda como versión consultable.',
      confirmLabel: 'Reclamar',
    });
    if (!confirmed) return;

    this.claiming.set(true);
    this.insurance
      .openClaimDispute(detail.header.id, {
        ...(detail.adjudication
          ? { claimAdjudicationVersionId: detail.adjudication.id }
          : {}),
        initiatedBy: 'PROVIDER',
      })
      .subscribe({
        next: () => {
          this.claiming.set(false);
          this.toast.show({
            type: 'success',
            message: 'El reclamo quedó presentado.',
          });
          // Se relee en vez de tocar el estado en memoria: la solicitud pasa a
          // figurar como reclamada y eso lo decide el servidor.
          this.load();
        },
        error: (error: unknown) => {
          this.claiming.set(false);
          this.state.set(errorToViewState<ClaimDetail>(error));
        },
      });
  }

  private load(): void {
    const id = this.claimId();
    if (id === '') return;
    this.state.set(loading());
    this.insurance.getClaim(id).subscribe({
      next: (detail) => this.state.set(ready(detail)),
      error: (error: unknown) =>
        this.state.set(errorToViewState<ClaimDetail>(error)),
    });
  }
}

/**
 * Compara dos importes decimales por valor, normalizando la escala.
 *
 * No convierte a `number`: `Number('0.1') + Number('0.2')` ya demuestra por
 * qué. Se alinean las posiciones decimales rellenando con ceros y se comparan
 * las cadenas resultantes, que es exacto para cualquier cantidad de decimales.
 *
 * @param a - Primer importe.
 * @param b - Segundo importe.
 * @returns `true` si representan el mismo valor.
 */
export function sameDecimal(a: string, b: string): boolean {
  const [ea, fa = ''] = a.trim().split('.');
  const [eb, fb = ''] = b.trim().split('.');
  const escala = Math.max(fa.length, fb.length);
  const norm = (entera: string, fraccion: string): string =>
    `${entera.replace(/^\+/, '') || '0'}.${fraccion.padEnd(escala, '0')}`;
  return norm(ea, fa) === norm(eb, fb);
}
