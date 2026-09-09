import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of, switchMap, type Observable } from 'rxjs';

import { InsuranceClient } from '../../../core/data-access/insurance/insurance.client';
import type {
  CarrierCatalogEntry,
  CarrierDetail,
  Plan,
} from '../../../core/data-access/insurance/insurance.types';
import { ProfilesClient } from '../../../core/data-access/profiles/profiles.client';
import type { OwnCoverage } from '../../../core/data-access/profiles/profiles.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { dataOf, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Chip } from '../../../shared/components/atoms/chip/chip';
import { NavIcon } from '../../../shared/components/atoms/nav-icon/nav-icon';
import { Card } from '../../../shared/components/molecules/card/card';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';

/**
 * Lo que la pantalla necesita para pintarse, resuelto de una vez.
 *
 * `abierta` es la aseguradora cuyo catálogo se muestra —la contratada, o la
 * que se eligió en la rejilla— y `null` cuando no hay ninguna: ahí la pantalla
 * es la rejilla. `contratada` es la cobertura propia con la que se relaciona
 * la abierta, si la hay: es lo que permite decir «tu plan» y marcarlo entre
 * los demás.
 */
interface VistaDelSeguro {
  readonly coberturas: readonly OwnCoverage[];
  readonly catalogo: readonly CarrierCatalogEntry[];
  readonly abierta: CarrierDetail | null;
  readonly contratada: OwnCoverage | null;
}

/**
 * La entrada del catálogo público a la que apunta una cobertura declarada.
 *
 * Primero por identificador, que es lo cierto; si la API no lo mandó —la real
 * todavía no lo hace— por el nombre corto, que es lo que el perfil guarda.
 */
function entradaDe(
  cobertura: OwnCoverage,
  catalogo: readonly CarrierCatalogEntry[],
): CarrierCatalogEntry | undefined {
  return (
    catalogo.find((entrada) => entrada.id === cobertura.carrierId) ??
    catalogo.find(
      (entrada) =>
        entrada.name === cobertura.carrierName || entrada.legalName === cobertura.carrierName,
    )
  );
}

/** La cobertura propia que corresponde a una aseguradora abierta, si existe. */
function coberturaDe(
  abierta: CarrierDetail,
  coberturas: readonly OwnCoverage[],
  catalogo: readonly CarrierCatalogEntry[],
): OwnCoverage | null {
  return coberturas.find((cobertura) => entradaDe(cobertura, catalogo)?.id === abierta.id) ?? null;
}

/**
 * «Mi seguro»: el catálogo de la aseguradora del paciente, o el de cualquiera.
 *
 * Dos modos, decididos por lo que la persona declaró y por la URL:
 *
 * - **Con seguro declarado**, la pantalla abre directamente el catálogo de esa
 *   aseguradora —todos sus paquetes de servicio, con sus planes y
 *   coberturas—, marca el plan contratado y ofrece, en otra pestaña, las
 *   demás aseguradoras.
 * - **Sin seguro**, la rejilla de aseguradoras —la misma tarjeta que la portada
 *   de los directorios— y cada tarjeta abre `my-account/insurance/:carrierId`,
 *   que es esta misma pantalla mostrando ese catálogo con «Volver».
 *
 * Lee el catálogo **público** (`/insurance-carrier-catalog`), no el del tenant:
 * desde el tenant de un paciente el otro responde vacío. Y el perfil propio
 * puede faltar —quien entra sin perfil de paciente— sin que la pantalla se
 * caiga: sin perfil no hay coberturas, y se muestra la rejilla.
 */
@Component({
  selector: 'app-my-insurance',
  imports: [Card, Chip, DatePipe, NavIcon, PageHeader, RouterLink, Tab, Tabs, ViewStateHost],
  templateUrl: './my-insurance.html',
  // La rejilla de tarjetas va primera: es la disciplina compartida y la hoja
  // propia sólo la ajusta. Ver la cabecera de `rejilla-de-tarjetas.css`.
  styleUrls: ['../../../shared/styles/rejilla-de-tarjetas.css', './my-insurance.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyInsurance {
  private readonly insurance = inject(InsuranceClient);
  private readonly profiles = inject(ProfilesClient);
  private readonly route = inject(ActivatedRoute);

  /** La aseguradora pedida por la URL, o `''` en la portada de la sección. */
  private readonly carrierIdDeRuta = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('carrierId') ?? '')),
    { initialValue: '' },
  );

  protected readonly state = signal<ViewState<VistaDelSeguro>>(loading());
  protected readonly vista = computed(() => dataOf(this.state()));

  /** La pestaña abierta dentro de la tarjeta. Se vuelve a la primera al cargar. */
  protected readonly pestana = signal(0);

  /** Si se llegó desde la rejilla: hay adónde volver. */
  protected readonly abiertaPorRuta = computed(() => this.carrierIdDeRuta() !== '');

  /** Las demás aseguradoras: el catálogo entero menos la abierta. */
  protected readonly otras = computed<readonly CarrierCatalogEntry[]>(() => {
    const vista = this.vista();
    if (vista === null) return [];
    return vista.catalogo.filter((entrada) => entrada.id !== vista.abierta?.id);
  });

  /** Cuántos paquetes de servicio (productos) tiene la aseguradora abierta. */
  protected readonly paquetes = computed(() => this.vista()?.abierta?.products.length ?? 0);

  constructor() {
    // Cargar cada vez que cambia la aseguradora de la URL: la misma instancia
    // sirve la portada y `/:carrierId`, y el router la reutiliza al navegar
    // entre ellas.
    effect(() => {
      const id = this.carrierIdDeRuta();
      untracked(() => this.cargar(id));
    });
  }

  protected recargar(): void {
    this.cargar(this.carrierIdDeRuta());
  }

  /** Si un plan del catálogo es el que la persona declaró tener. */
  protected esPlanContratado(plan: Plan): boolean {
    const contratada = this.vista()?.contratada;
    return contratada?.planName !== undefined && contratada.planName === plan.name;
  }

  /** Lo que dice la tarjeta de una aseguradora en la rejilla. */
  protected resumenDe(entrada: CarrierCatalogEntry): string {
    const planes = entrada.plans.length === 1 ? '1 plan' : `${entrada.plans.length} planes`;
    return `${planes} · ${entrada.isPublic ? 'Seguro público' : 'Aseguradora privada'}`;
  }

  private cargar(carrierId: string): void {
    this.state.set(loading());
    this.pestana.set(0);
    this.leer(carrierId).subscribe({
      next: (vista) => this.state.set(ready(vista)),
      error: (error: unknown) => this.state.set(errorToViewState<VistaDelSeguro>(error)),
    });
  }

  /**
   * Resuelve la vista en dos pasos: perfil + catálogo, y después la ficha de
   * la aseguradora que corresponda —la de la URL, o la contratada—.
   *
   * El perfil propio se pide con red: un 404 («no tenés perfil de paciente»)
   * no es un error de esta pantalla, es «no hay coberturas», y la rejilla
   * sigue sirviendo. El catálogo sí es imprescindible y su fallo se muestra.
   */
  private leer(carrierId: string): Observable<VistaDelSeguro> {
    return forkJoin({
      perfil: this.profiles.getOwnPatientProfile().pipe(catchError(() => of(null))),
      catalogo: this.insurance.listCarrierCatalog(),
    }).pipe(
      switchMap(({ perfil, catalogo }) => {
        const coberturas = perfil?.coverages ?? [];
        const contratada =
          carrierId === ''
            ? (coberturas.find((cobertura) => entradaDe(cobertura, catalogo) !== undefined) ?? null)
            : null;
        const id =
          carrierId !== ''
            ? carrierId
            : contratada === null
              ? null
              : (entradaDe(contratada, catalogo)?.id ?? null);
        if (id === null) {
          return of<VistaDelSeguro>({ coberturas, catalogo, abierta: null, contratada: null });
        }
        return this.insurance.getCarrierCatalogEntry(id).pipe(
          map((abierta) => ({
            coberturas,
            catalogo,
            abierta,
            contratada: contratada ?? coberturaDe(abierta, coberturas, catalogo),
          })),
        );
      }),
    );
  }
}
