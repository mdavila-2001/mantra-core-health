import { formatDate } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  LOCALE_ID,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { PharmacyPrescriptionSharesClient } from '../../../core/data-access/pharmacy-prescription-shares/pharmacy-prescription-shares.client';
import type {
  PharmacyPrescriptionShare,
  PrescriptionProductSite,
  SiteProductRef,
} from '../../../core/data-access/pharmacy-prescription-shares/pharmacy-prescription-shares.types';
import { describeApiFailure } from '../../../core/http/api-failure';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { dataOf, empty, isForbidden, loading, mapData, notFound, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Link } from '../../../shared/components/atoms/link/link';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { FactList } from '../../../shared/components/molecules/fact-list/fact-list';
import type { Hecho } from '../../../shared/components/molecules/fact-list/fact-list.types';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { availabilityFallback, itemLabels, sameDrugCounts, siteKey } from '../dispense-display';
import { PRESCRIPTION_DISPENSE_TESTIDS } from '../prescription-dispense.testids';
import { PrescriptionItem, type AvailabilityRequest } from '../prescription-item/prescription-item';
import { OPEN_FAILURE_COPY, openFailureOf, type OpenFailure } from './open-failure';

/** La bandeja de la farmacia: la salida de todos los estados sin receta. */
export const PHARMACY_INBOX_ROUTE = '/administration/pharmacy-orders';

/** Qué cambia de una sede al escribir su disponibilidad. */
type SitePatch = Pick<PrescriptionProductSite, 'available' | 'quantity' | 'stockUpdatedAt'>;

/**
 * «Abrir receta» de la farmacia (FAR-02, `CONTRATO.md` §2, REQ-FAR-02-008, 009
 * y 011): `administration/pharmacy-orders/rx/:token`, a donde lleva `/rx/:token`
 * cuando la organización activa es una farmacia.
 *
 * ## Qué muestra
 *
 * Quién recetó y cuándo, el paciente **enmascarado** (iniciales y los últimos
 * tres dígitos del documento: es todo lo que la API manda, S-4) y, por ítem
 * en una pestaña, el fármaco, la indicación, lo recetado y lo que queda, y los
 * productos del catálogo que lo surten con una fila por sede.
 *
 * ## El interruptor por sede
 *
 * «Lo tengo / No lo tengo» llama al `PUT` de disponibilidad de FAR-06 (§4). La
 * sede muestra lo pedido mientras viaja, con el interruptor deshabilitado; con
 * 200, lo que devolvió la API; con error vuelve a lo que tenía y dice por qué
 * (el `message` de la API cuando está escrito para la persona, S-9). Lo que
 * está en vuelo vive acá y no en el interruptor, para que no se pierda al
 * cambiar de pestaña.
 *
 * ## Estados
 *
 * S1 lo resuelve el guard de la sección (solo organizaciones `PHARMACY`). S2
 * mientras se abre; S3 si la receta no trae ítems vigentes; S5 para el 410
 * (revocada o vencida) y el 403; S6 para el 404; S8 y S9 por el mapeo común.
 * El front no decide el acceso: la farmacia ve lo que la API le devolvió.
 */
@Component({
  selector: 'app-open-prescription',
  imports: [
    Alert,
    Card,
    FactList,
    Link,
    PageHeader,
    PrescriptionItem,
    RouterLink,
    Tab,
    Tabs,
    ViewStateHost,
  ],
  templateUrl: './open-prescription.html',
  styleUrl: './open-prescription.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OpenPrescription {
  private readonly route = inject(ActivatedRoute);
  private readonly client = inject(PharmacyPrescriptionSharesClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly locale = inject(LOCALE_ID);

  private readonly token = this.route.snapshot.paramMap.get('token') ?? '';

  protected readonly testids = PRESCRIPTION_DISPENSE_TESTIDS;
  protected readonly inboxRoute = PHARMACY_INBOX_ROUTE;
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;

  protected readonly state = signal<ViewState<PharmacyPrescriptionShare>>(loading());
  protected readonly failure = signal<OpenFailure | null>(null);
  protected readonly selectedItem = signal(0);

  /** Las sedes con el interruptor en vuelo (`siteKey`). */
  protected readonly pending = signal<ReadonlySet<string>>(new Set());
  /** El motivo del último fallo de cada sede (`siteKey`). */
  protected readonly failures = signal<Readonly<Record<string, string>>>({});

  protected readonly share = computed(() => dataOf(this.state()));

  /** La etiqueta de la pestaña de cada ítem, sin repetidas. */
  protected readonly tabLabels = computed(() => itemLabels(this.share()?.items ?? []));

  /** Cuántos ítems comparten el fármaco de cada uno (las cantidades son del fármaco). */
  protected readonly sameDrug = computed(() => sameDrugCounts(this.share()?.items ?? []));

  protected readonly failureCopy = computed(() => {
    const failure = this.failure();
    return failure === null ? null : OPEN_FAILURE_COPY[failure];
  });

  /** El `requestId` del 403/410, para que el mostrador pueda reportarlo. */
  protected readonly deniedRequestId = computed(() => {
    const state = this.state();
    return isForbidden(state) ? (state.requestId ?? null) : null;
  });

  protected readonly facts = computed<readonly Hecho[]>(() => {
    const rx = this.share();
    if (rx === null) {
      return [];
    }
    return [
      { etiqueta: 'Recetó', valor: this.prescriberText(rx) },
      { etiqueta: 'Emitida', valor: this.dateText(rx.issuedAt) },
      { etiqueta: 'Vence', valor: this.dateText(rx.validTo) },
      { etiqueta: 'Paciente', valor: rx.patient.maskedName },
      {
        etiqueta: 'Documento',
        valor: rx.patient.documentLast3 === null ? null : `terminado en ${rx.patient.documentLast3}`,
      },
    ];
  });

  constructor() {
    if (this.token === '') {
      this.failure.set('UNKNOWN_LINK');
      this.state.set(notFound());
      return;
    }
    this.load();
  }

  protected load(): void {
    this.failure.set(null);
    this.state.set(loading());
    this.client
      .open(this.token)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rx) =>
          this.state.set(
            rx.items.length === 0
              ? empty(
                  { label: 'Volver a la bandeja', route: PHARMACY_INBOX_ROUTE },
                  'La receta no tiene medicamentos vigentes.',
                )
              : ready(rx),
          ),
        error: (error: unknown) => {
          const outcome = openFailureOf<PharmacyPrescriptionShare>(error);
          this.failure.set(outcome.failure);
          this.state.set(outcome.state);
        },
      });
  }

  protected setAvailability(request: AvailabilityRequest): void {
    const key = siteKey(request.ref);
    const previous = this.findSite(request.ref);
    if (this.pending().has(key) || previous === null) {
      return;
    }

    this.patchSite(request.ref, { ...previous, available: request.available });
    this.pending.update((keys) => new Set(keys).add(key));
    this.failures.update((all) => {
      const rest = { ...all };
      delete rest[key];
      return rest;
    });

    this.client
      .setSiteAvailability(request.ref, request.available)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (saved) => {
          this.patchSite(request.ref, {
            available: saved.available,
            quantity: saved.quantity,
            stockUpdatedAt: saved.stockUpdatedAt,
          });
          this.settle(key);
        },
        error: (error: unknown) => {
          this.patchSite(request.ref, previous);
          this.failures.update((all) => ({
            ...all,
            [key]: describeApiFailure(error, availabilityFallback(error)),
          }));
          this.settle(key);
        },
      });
  }

  private settle(key: string): void {
    this.pending.update((keys) => {
      const next = new Set(keys);
      next.delete(key);
      return next;
    });
  }

  /** Lo que la sede tenía antes de escribir: es a lo que vuelve si falla. */
  private findSite(ref: SiteProductRef): SitePatch | null {
    for (const item of this.share()?.items ?? []) {
      for (const match of item.matches) {
        if (match.pharmacyId !== ref.pharmacyId || match.pharmacyProductId !== ref.productId) {
          continue;
        }
        const site = match.sites.find((candidate) => candidate.siteId === ref.siteId);
        if (site !== undefined) {
          return { available: site.available, quantity: site.quantity, stockUpdatedAt: site.stockUpdatedAt };
        }
      }
    }
    return null;
  }

  /**
   * Escribe la sede en **todos** los ítems donde aparece: el mismo fármaco en
   * dos ítems trae los mismos productos, y las dos filas tienen que decir lo
   * mismo.
   */
  private patchSite(ref: SiteProductRef, patch: SitePatch): void {
    this.state.update((state) =>
      mapData(state, (rx) => ({
        ...rx,
        items: rx.items.map((item) => ({
          ...item,
          matches: item.matches.map((match) =>
            match.pharmacyId === ref.pharmacyId && match.pharmacyProductId === ref.productId
              ? {
                  ...match,
                  sites: match.sites.map((site) => (site.siteId === ref.siteId ? { ...site, ...patch } : site)),
                }
              : match,
          ),
        })),
      })),
    );
  }

  private prescriberText(rx: PharmacyPrescriptionShare): string {
    const name = rx.prescriber.name ?? 'Sin registrar';
    const license = rx.prescriber.license;
    if (license === null) {
      return name;
    }
    const pending = license.state === 'PENDING' ? ' (en verificación)' : '';
    return `${name} · matrícula ${license.number}${pending}`;
  }

  private dateText(value: Date | null): string | null {
    return value === null ? null : formatDate(value, 'dd/MM/yyyy', this.locale);
  }
}
