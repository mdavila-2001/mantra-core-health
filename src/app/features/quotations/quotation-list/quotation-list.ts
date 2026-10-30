import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import type { TemplateRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, map, of, switchMap } from 'rxjs';

import { QuotationsClient } from '../../../core/data-access/quotations/quotations.client';
import type { QuotationListItem } from '../../../core/data-access/quotations/quotations.types';
import type { PatientListItem } from '../../../core/data-access/profiles/profiles.types';
import { ProfilesClient } from '../../../core/data-access/profiles/profiles.client';
import { TerminologyClient } from '../../../core/data-access/terminology/terminology.client';
import type { ConceptLabels } from '../../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
// El encabezado lleva un `<a app-button>`, y `AppButton` es `button[app-button]`:
// sin esta pieza el atributo no engancha nada y la acción principal se dibuja como
// texto suelto, sin el color de las demás pantallas de listado.
import { AppButtonLink } from '../../../shared/components/atoms/button/button-link';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { SearchField } from '../../../shared/components/molecules/search-field/search-field';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { QUOTATION_NEW_ROUTE } from '../quotations.routes';
import { quotationDate, quotationPrice, quotationStatusLabel } from './quotation-list.view';

/** Tope del buscador de pacientes. La API pagina por cursor; acá alcanza una página. */
const TOPE_PACIENTES = 25;

/**
 * **Cotizaciones** (FT-24) — el listado de presupuestos de un paciente.
 *
 * ## Por qué esta pantalla busca un paciente en vez de listar todo
 *
 * El contrato asumido de FT-24 sólo expone `GET /quotations?patientProfileId=`
 * — no hay un listado general por práctica o por profesional. Enumerar «todas
 * las cotizaciones» no es una lectura que el backend ofrezca, así que, igual
 * que el Archivo clínico (`clinical-record.ts`), esta pantalla **elige** antes
 * de mostrar: se busca al paciente y recién ahí se piden sus cotizaciones. Es
 * el mismo buscador que reusa el resto del producto — `app-search-field` +
 * `app-data-table` sobre `ProfilesClient.searchPatients` —, no un componente
 * nuevo.
 */
@Component({
  selector: 'app-quotation-list',
  imports: [AppButton, AppButtonLink, Badge, DataTable, PageHeader, RouterLink, SearchField],
  templateUrl: './quotation-list.html',
  styleUrl: './quotation-list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuotationList {
  private readonly profiles = inject(ProfilesClient);
  private readonly quotations = inject(QuotationsClient);
  private readonly navigation = inject(NavigationService);
  private readonly terminology = inject(TerminologyClient);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly nuevaCotizacionRoute = QUOTATION_NEW_ROUTE;

  private readonly celdaEstado =
    viewChild.required<TemplateRef<{ $implicit: QuotationListItem }>>('celdaEstado');
  private readonly celdaPrecio =
    viewChild.required<TemplateRef<{ $implicit: QuotationListItem }>>('celdaPrecio');
  private readonly attentionCell =
    viewChild.required<TemplateRef<{ $implicit: QuotationListItem }>>('attentionCell');
  private readonly validUntilCell =
    viewChild.required<TemplateRef<{ $implicit: QuotationListItem }>>('validUntilCell');
  private readonly celdaAccionPaciente =
    viewChild.required<TemplateRef<{ $implicit: PatientListItem }>>('celdaAccionPaciente');

  /* ---- búsqueda de paciente ------------------------------------------------- */

  protected readonly busquedaDePaciente = signal('');
  protected readonly resultadosDePacientes = signal<ViewState<readonly PatientListItem[]>>(
    empty(
      { label: 'Escriba para buscar' },
      'Busque un paciente por nombre o código para ver sus cotizaciones.',
    ),
  );
  protected readonly pacienteElegido = signal<PatientListItem | null>(null);

  protected readonly cargandoPacientes = computed(
    () => this.resultadosDePacientes().status === 'loading',
  );

  protected buscarPaciente(texto: string): void {
    this.busquedaDePaciente.set(texto);
    if (texto.trim() === '') {
      this.resultadosDePacientes.set(
        empty(
          { label: 'Escriba para buscar' },
          'Busque un paciente por nombre o código para ver sus cotizaciones.',
        ),
      );
      return;
    }

    this.resultadosDePacientes.set(loading());
    this.profiles.searchPatients({ query: texto, limit: TOPE_PACIENTES }).subscribe({
      next: (pagina) =>
        this.resultadosDePacientes.set(
          pagina.items.length > 0
            ? ready(pagina.items)
            : empty({ label: 'Volver a buscar' }, `Nadie coincide con «${texto}».`),
        ),
      error: (error: unknown) =>
        this.resultadosDePacientes.set(errorToViewState<readonly PatientListItem[]>(error)),
    });
  }

  protected readonly columnasDePacientes = computed<readonly ColumnDef<PatientListItem>[]>(() => [
    { key: 'displayName', header: 'Paciente', priority: 1 },
    { key: 'patientCode', header: 'Código', priority: 2 },
    { key: 'accion', header: '', priority: 1, cell: this.celdaAccionPaciente() },
  ]);

  protected readonly porPaciente = (fila: PatientListItem): string => fila.profileId;
  /** Nombre de la fila para el lector de pantalla (`rowLabel` de la tabla). */
  protected readonly nombreDePaciente = (fila: PatientListItem): string => fila.displayName ?? '';

  protected elegirPaciente(paciente: PatientListItem): void {
    this.pacienteElegido.set(paciente);
    this.cargarCotizaciones(paciente.profileId);
  }

  protected quitarPaciente(): void {
    this.pacienteElegido.set(null);
    this.cotizaciones.set(loading());
  }

  /* ---- cotizaciones del paciente elegido ------------------------------------ */

  protected readonly cotizaciones = signal<ViewState<readonly QuotationListItem[]>>(loading());

  protected readonly columnasDeCotizaciones = computed<readonly ColumnDef<QuotationListItem>[]>(
    () => [
      { key: 'serviceNameSnapshot', header: 'Servicio', priority: 1 },
      { key: 'offeredPrice', header: 'Precio ofrecido', priority: 1, align: 'end', cell: this.celdaPrecio() },
      { key: 'status', header: 'Estado', priority: 1, cell: this.celdaEstado() },
      {
        key: 'attentionDate',
        header: 'Fecha de atención',
        priority: 2,
        cell: this.attentionCell(),
      },
      { key: 'validUntil', header: 'Válida hasta', priority: 2, cell: this.validUntilCell() },
    ],
  );

  /**
   * H15: el estado y la moneda llegan como conceptos (`statusConceptId`,
   * `currencyConceptId`); sin traducirlos, la celda de estado salía vacía y el
   * precio sin moneda. Se leen una vez por página, sin repetir ids.
   */
  private readonly labels = signal<ConceptLabels>(new Map());

  /** «300,00 Bs»; con otra moneda, su código; sin moneda resuelta, el número solo. */
  protected priceOf(row: QuotationListItem): string {
    const currency =
      row.currencyConceptId === undefined
        ? undefined
        : this.labels().get(row.currencyConceptId)?.code;
    return quotationPrice(row.offeredPrice, currency);
  }

  /** El estado legible, por código (`quotation-list.view.ts`); nunca el uuid ni una celda vacía. */
  protected statusOf(row: QuotationListItem): string {
    const concept = this.labels().get(row.statusConceptId);
    return quotationStatusLabel(row.statusCode ?? concept?.code, concept?.display);
  }

  protected readonly formatDate = quotationDate;

  protected readonly porCotizacion = (fila: QuotationListItem): string => fila.id;
  /** Nombre de la fila para el lector de pantalla (`rowLabel` de la tabla). */
  protected readonly nombreDeCotizacion = (fila: QuotationListItem): string =>
    fila.serviceNameSnapshot;

  protected recargarCotizaciones(): void {
    const paciente = this.pacienteElegido();
    if (paciente !== null) {
      this.cargarCotizaciones(paciente.profileId);
    }
  }

  private cargarCotizaciones(patientProfileId: string): void {
    this.cotizaciones.set(loading());
    this.quotations
      .listQuotationsByPatient(patientProfileId)
      .pipe(
        switchMap((items) =>
          this.terminology
            .readConceptLabels(
              items
                .flatMap((row) => [row.statusConceptId, row.currencyConceptId])
                .filter((id): id is string => typeof id === 'string' && id !== ''),
            )
            .pipe(
              catchError(() => of<ConceptLabels>(new Map())),
              map((labels) => ({ items, labels })),
            ),
        ),
      )
      .subscribe({
        next: ({ items, labels }) => {
          this.labels.set(labels);
          this.cotizaciones.set(
            items.length > 0
              ? ready(items)
              : empty(
                  { label: 'Nueva cotización', route: QUOTATION_NEW_ROUTE },
                  'Esta persona todavía no tiene cotizaciones.',
                ),
          );
        },
        error: (error: unknown) =>
          this.cotizaciones.set(errorToViewState<readonly QuotationListItem[]>(error)),
      });
  }
}
