import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';

import { DirectoryClient } from '../../../../core/data-access/directory/directory.client';
import type { VerifyTenantConfirmation } from '../../../../core/data-access/directory/directory.types';
import { TerminologyClient } from '../../../../core/data-access/terminology/terminology.client';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AnnounceOnAppear } from '../../../../shared/a11y/announce-on-appear';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import type { BreadcrumbItem } from '../../../../shared/components/molecules/breadcrumb/breadcrumb.types';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ReferenceCombobox } from '../../../../shared/components/molecules/reference-combobox/reference-combobox';
import type { ReferenceOption } from '../../../../shared/components/molecules/reference-combobox/reference-combobox.types';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { FormActions } from '../../../../shared/components/organisms/form-actions/form-actions';
import { FormSection } from '../../../../shared/components/organisms/form-section/form-section';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ORGANIZATIONS_ROUTE, organizationDetailRoute } from '../organizations.routes';

/** Cuántos candidatos trae cada búsqueda de concepto. */
const CANDIDATOS_POR_BUSQUEDA = 10;

/**
 * Verificación de una organización — vista **V04-01·A**
 * (`POST /admin/tenants/{id}/verification`, UC-04-02). Pide `SECURITY_ADMIN`.
 *
 * ## Qué es verificar
 *
 * El alta deja la organización **pendiente**: existe en el directorio y no
 * opera. Verificarla es el acto por el que alguien mira su documentación
 * regulatoria y la activa. Son dos operaciones distintas, de dos roles
 * distintos, y esta pantalla es la segunda.
 *
 * ## Por qué ofrece corregir país y jurisdicción
 *
 * El contrato admite confirmarlos en el mismo acto, y tiene sentido: la
 * verificación es justo el momento en que alguien contrasta lo declarado contra
 * un papel. Los dos campos son opcionales — omitirlos deja lo que se cargó en el
 * alta.
 *
 * Se resuelven con el mismo buscador de conceptos que el alta, y por el mismo
 * motivo: esas dos columnas no tienen binding en `dynamic-enums`, así que la
 * búsqueda es sobre el catálogo entero y el código es la pista.
 */
@Component({
  selector: 'app-organization-verify',
  imports: [
    Alert,
    AnnounceOnAppear,
    FormActions,
    FormField,
    FormSection,
    PageHeader,
    ReferenceCombobox,
  ],
  templateUrl: './organization-verify.html',
  styleUrl: './organization-verify.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationVerify {
  private readonly directory = inject(DirectoryClient);
  private readonly terminology = inject(TerminologyClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  /**
   * La organización que se verifica, leída del segmento `:tenantId`.
   *
   * Del `paramMap` y no con `input()`: el router no declara
   * `withComponentInputBinding()`. Mismo mecanismo que la ficha.
   */
  protected readonly tenantId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('tenantId') ?? '')),
    { initialValue: '' },
  );

  protected readonly breadcrumbs = computed<readonly BreadcrumbItem[]>(() => [
    { label: 'Organizaciones', routerLink: ORGANIZATIONS_ROUTE },
    { label: 'Organización', routerLink: organizationDetailRoute(this.tenantId()) },
    { label: 'Verificar' },
  ]);

  protected readonly pais = signal<ReferenceOption | null>(null);
  protected readonly candidatosPais = signal<readonly ReferenceOption[]>([]);
  protected readonly buscandoPais = signal(false);

  protected readonly jurisdiccion = signal<ReferenceOption | null>(null);
  protected readonly candidatosJurisdiccion = signal<readonly ReferenceOption[]>([]);
  protected readonly buscandoJurisdiccion = signal(false);

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly enviando = computed(() => this.state().status === 'loading');

  protected readonly errorMessage = computed<string | null>(() => {
    const state = this.state();
    if (state.status === 'validation') {
      return state.issues.map((issue) => issue.message).join(' ') || null;
    }
    if (state.status === 'forbidden') {
      return (
        state.message || 'Sólo una cuenta con administración de seguridad puede verificar.'
      );
    }
    if (state.status === 'offline') {
      return 'No pudimos conectarnos. Revisá tu conexión y reintentá.';
    }
    if (state.status === 'error') {
      return `${state.message || 'Ocurrió un error inesperado.'} (${state.requestId})`;
    }
    return null;
  });

  protected buscarPais(texto: string): void {
    this.buscarConcepto(texto, this.candidatosPais, this.buscandoPais);
  }

  protected buscarJurisdiccion(texto: string): void {
    this.buscarConcepto(texto, this.candidatosJurisdiccion, this.buscandoJurisdiccion);
  }

  /**
   * Busca conceptos y los traduce a opciones, con el código como pista.
   *
   * @param texto - Lo que se escribió en el buscador.
   * @param destino - Dónde dejar los candidatos.
   * @param cargando - Bandera de búsqueda en curso.
   */
  private buscarConcepto(
    texto: string,
    destino: { set: (opciones: readonly ReferenceOption[]) => void },
    cargando: { set: (valor: boolean) => void },
  ): void {
    if (texto === '') {
      destino.set([]);
      return;
    }

    cargando.set(true);
    this.terminology.searchConcepts({ query: texto, limit: CANDIDATOS_POR_BUSQUEDA }).subscribe({
      next: (pagina) => {
        destino.set(
          pagina.items.map((concepto) => ({
            value: concepto.conceptId,
            label: concepto.display,
            hint: concepto.code,
          })),
        );
        cargando.set(false);
      },
      error: () => {
        destino.set([]);
        cargando.set(false);
      },
    });
  }

  protected submit(): void {
    if (this.enviando()) {
      return;
    }

    this.state.set(loading());

    this.directory.verifyTenant(this.tenantId(), this.datos()).subscribe({
      next: (organizacion) => {
        this.state.set(ready(null));
        this.toast.success(
          `«${organizacion.legalName}» quedó verificada y puede operar.`,
          'Organización verificada',
        );
        void this.router.navigateByUrl(organizationDetailRoute(this.tenantId()));
      },
      error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
    });
  }

  protected cancelar(): void {
    void this.router.navigateByUrl(organizationDetailRoute(this.tenantId()));
  }

  /** Sólo viaja lo que se corrigió: omitir deja lo declarado en el alta. */
  private datos(): VerifyTenantConfirmation {
    const pais = this.pais();
    const jurisdiccion = this.jurisdiccion();

    return {
      ...(pais === null ? {} : { countryConceptId: pais.value }),
      ...(jurisdiccion === null ? {} : { jurisdictionConceptId: jurisdiccion.value }),
    };
  }
}
