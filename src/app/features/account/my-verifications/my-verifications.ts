import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of, switchMap, type Observable } from 'rxjs';

import { InsuranceClient } from '../../../core/data-access/insurance/insurance.client';
import type { CarrierCatalogEntry } from '../../../core/data-access/insurance/insurance.types';
import { PractitionerInsurerRequestsClient } from '../../../core/data-access/insurance/practitioner-insurer-requests.client';
import type { InsurerRequest } from '../../../core/data-access/insurance/practitioner-insurer-requests.types';
import { ProfilesClient } from '../../../core/data-access/profiles/profiles.client';
import type { OwnPractitionerProfile } from '../../../core/data-access/profiles/profiles.types';
import { TerminologyClient } from '../../../core/data-access/terminology/terminology.client';
import type { ConceptLabels } from '../../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../shared/components/atoms/button/button-link';
import { NavIcon } from '../../../shared/components/atoms/nav-icon/nav-icon';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { EmptyState } from '../../../shared/components/molecules/empty-state/empty-state';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { Stepper } from '../../../shared/components/molecules/stepper/stepper';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { StatusSeal } from '../../../shared/components/organisms/status-seal/status-seal';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { conceptosDe } from '../my-profile/practitioner-profile/practitioner-profile';
import {
  buildRoadmap,
  buildThreads,
  roadmapStepper,
  type RequestThread,
  type RoadmapStep,
} from './my-verifications.model';

/** Lo que la pantalla necesita leído, todo junto. */
interface Datos {
  readonly perfil: OwnPractitionerProfile;
  readonly etiquetas: ConceptLabels;
  /** `null` si la lectura falló: la hoja de ruta lo dice en vez de esconderlo. */
  readonly seguros: readonly InsurerRequest[] | null;
  readonly catalogo: readonly CarrierCatalogEntry[];
}

const PESTANAS = ['Hoja de ruta', 'Solicitudes enviadas'] as const;
const PESTANA = { ruta: 0, bandeja: 1 } as const;

/**
 * «Mis verificaciones» del profesional (propietario, 28/10/2026: «falta un
 * lugar visual donde se pueda ver mis verificaciones y el proceso tipo road
 * map… y una bandeja de solicitudes enviadas tipo mensajería chat»).
 *
 * UNA tarjeta con dos pestañas, centrada y a lo ancho (regla del cliente,
 * `composition-rules.md` §5):
 *
 * - **Hoja de ruta**: los tramos de su verificación —perfil, matrícula,
 *   títulos, especialidades, instituciones, seguros— con un sello por tramo.
 * - **Solicitudes enviadas**: cada pedido que mandó a una institución o a una
 *   aseguradora, contado como una conversación: lo que pidió, cuándo, y qué le
 *   respondieron con su motivo. Desde ahí retira o vuelve a pedir, y pide a una
 *   aseguradora nueva.
 *
 * No calcula ningún estado: lo dice la API. Sólo lo traduce y lo ordena
 * (`my-verifications.model.ts`).
 */
@Component({
  selector: 'app-my-verifications',
  imports: [
    Alert,
    AnnounceOnAppear,
    AppButton,
    AppButtonLink,
    Card,
    DatePipe,
    EmptyState,
    FormField,
    NavIcon,
    PageHeader,
    RouterLink,
    Select,
    StatusSeal,
    Stepper,
    Tab,
    Tabs,
    ViewStateHost,
  ],
  templateUrl: './my-verifications.html',
  styleUrl: './my-verifications.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyVerifications {
  private readonly profiles = inject(ProfilesClient);
  private readonly terminology = inject(TerminologyClient);
  private readonly insurerRequests = inject(PractitionerInsurerRequestsClient);
  private readonly insurance = inject(InsuranceClient);
  private readonly navigation = inject(NavigationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly pestanas = PESTANAS;

  protected readonly state = signal<ViewState<Datos>>(loading());

  protected readonly pestana = signal<number>(
    this.route.snapshot.queryParamMap.get('tab') === 'requests' ? PESTANA.bandeja : PESTANA.ruta,
  );

  private readonly datos = computed(() => {
    const s = this.state();
    return s.status === 'ready' ? s.data : null;
  });

  protected readonly pasos = computed<readonly RoadmapStep[]>(() => {
    const d = this.datos();
    return d === null ? [] : buildRoadmap(d.perfil, d.etiquetas, d.seguros);
  });

  protected readonly indicador = computed(() => roadmapStepper(this.pasos()));

  protected readonly verificados = computed(
    () => this.pasos().filter((p) => p.state === 'approved').length,
  );

  protected readonly hilos = computed<readonly RequestThread[]>(() => {
    const d = this.datos();
    return d === null ? [] : buildThreads(d.perfil.affiliations, d.seguros ?? []);
  });

  /** La conversación abierta. Por omisión, la de la novedad más reciente. */
  private readonly hiloElegidoId = signal<string | null>(null);
  protected readonly hiloAbierto = computed<RequestThread | null>(() => {
    const hilos = this.hilos();
    const id = this.hiloElegidoId();
    return hilos.find((h) => h.id === id) ?? hilos[0] ?? null;
  });

  protected readonly pendientes = computed(
    () => this.hilos().filter((h) => h.state === 'pending').length,
  );

  /* ---- Pedir a otra aseguradora ------------------------------------------ */

  /** Las del catálogo que todavía no se pidieron (o se pueden volver a pedir). */
  protected readonly aseguradorasDisponibles = computed<readonly SelectOption<string>[]>(() => {
    const d = this.datos();
    if (d === null) return [];
    const vivas = new Set(
      (d.seguros ?? [])
        .filter((r) => r.status === 'PENDING' || r.status === 'APPROVED')
        .map((r) => r.carrierId),
    );
    return d.catalogo
      .filter((c) => !vivas.has(c.id))
      .map((c) => ({ value: c.id, label: c.isPublic ? `${c.name} (seguro público)` : c.name }));
  });

  protected readonly aseguradoraNueva = signal<string | null>(null);
  protected readonly enviando = signal(false);
  protected readonly avisoDeEnvio = signal<{ tono: 'success' | 'error'; texto: string } | null>(
    null,
  );

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.pestana.set(params.get('tab') === 'requests' ? PESTANA.bandeja : PESTANA.ruta);
    });
    this.cargar();
  }

  protected cargar(): void {
    this.state.set(loading());
    this.leer().subscribe({
      next: (datos) => this.state.set(ready(datos)),
      error: (error: unknown) => this.state.set(errorToViewState<Datos>(error)),
    });
  }

  /**
   * El perfil es lo único sin lo cual no hay pantalla. Las etiquetas, las
   * solicitudes a aseguradoras y el catálogo degradan: la hoja de ruta dice
   * «sin dato» donde no pudo leer, en vez de caerse entera.
   */
  private leer(): Observable<Datos> {
    return this.profiles.getOwnPractitionerProfile().pipe(
      switchMap((perfil) =>
        forkJoin({
          etiquetas: this.terminology
            .readConceptLabels(conceptosDe(perfil))
            .pipe(catchError(() => of<ConceptLabels>(new Map()))),
          seguros: this.insurerRequests
            .listMine()
            .pipe(catchError(() => of<readonly InsurerRequest[] | null>(null))),
          catalogo: this.insurance
            .listCarrierCatalog()
            .pipe(catchError(() => of<readonly CarrierCatalogEntry[]>([]))),
        }).pipe(map((resto) => ({ perfil, ...resto }))),
      ),
    );
  }

  protected elegirPestana(indice: number): void {
    this.pestana.set(indice);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: indice === PESTANA.bandeja ? 'requests' : null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected abrirHilo(id: string): void {
    this.hiloElegidoId.set(id);
  }

  protected irABandeja(): void {
    this.elegirPestana(PESTANA.bandeja);
  }

  /* ---- Acciones: cada una relee de la API, nunca supone el resultado ------ */

  protected pedirAseguradora(): void {
    const id = this.aseguradoraNueva();
    if (id === null || this.enviando()) return;
    this.pedir([id], 'Solicitud enviada. La aseguradora la va a confirmar o rechazar.');
  }

  protected volverAPedir(hilo: RequestThread): void {
    if (hilo.carrierId === undefined || this.enviando()) return;
    this.pedir([hilo.carrierId], `Volvimos a enviar su solicitud a ${hilo.counterpart}.`);
  }

  protected retirar(hilo: RequestThread): void {
    if (this.enviando()) return;
    const requestId = hilo.id.replace(/^ins-/, '');
    this.enviando.set(true);
    this.avisoDeEnvio.set(null);
    this.insurerRequests.withdraw(requestId).subscribe({
      next: () => this.releerSeguros(`Retiró su solicitud a ${hilo.counterpart}.`, hilo.id),
      error: (error: unknown) => this.fallo(error),
    });
  }

  private pedir(carrierIds: readonly string[], exito: string): void {
    this.enviando.set(true);
    this.avisoDeEnvio.set(null);
    this.insurerRequests.request(carrierIds).subscribe({
      next: () => {
        this.aseguradoraNueva.set(null);
        this.releerSeguros(exito, null);
      },
      error: (error: unknown) => this.fallo(error),
    });
  }

  /**
   * Después de escribir se vuelve a leer de la API —no se arma la fila en el
   * cliente—: lo que se ve es lo que quedó guardado.
   */
  private releerSeguros(exito: string, abrir: string | null): void {
    this.insurerRequests.listMine().subscribe({
      next: (seguros) => {
        this.state.update((s) => (s.status === 'ready' ? ready({ ...s.data, seguros }) : s));
        const recienPedida = seguros[0];
        this.hiloElegidoId.set(abrir ?? (recienPedida ? `ins-${recienPedida.id}` : null));
        this.enviando.set(false);
        this.avisoDeEnvio.set({ tono: 'success', texto: exito });
      },
      error: (error: unknown) => this.fallo(error),
    });
  }

  private fallo(error: unknown): void {
    this.enviando.set(false);
    const conflicto = error instanceof HttpErrorResponse && error.status === 409;
    this.avisoDeEnvio.set({
      tono: 'error',
      texto: conflicto
        ? 'Ya tiene una solicitud viva con esa aseguradora.'
        : 'No pudimos enviar el cambio. Revise su conexión y vuelva a intentarlo.',
    });
  }
}
