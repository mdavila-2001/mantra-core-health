import { ChangeDetectionStrategy, Component, computed, effect, inject, untracked } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { SessionStore } from '@core/auth/session.store';
import { NavigationService } from '@core/navigation/navigation.service';
import { rolesAlcanzan } from '@core/navigation/navigation.types';
import { Card } from '@shared/components/molecules/card/card';
import { Tab } from '@shared/components/molecules/tabs/tab/tab';
import { Tabs } from '@shared/components/molecules/tabs/tabs';
import { PageHeader } from '@shared/components/organisms/page-header/page-header';
import { ObservabilityContextStore, PESTANAS, type PestanaSistema } from '../state/observability-context.store';
import { ObsContextBar } from './context-bar';
import { ObsTabEndpoints } from './tab-endpoints';
import { ObsTabErrores } from './tab-errores';
import { ObsTabLatencia } from './tab-latencia';
import { ObsTabNoMedido } from './tab-no-medido';
import { ObsTabResumen } from './tab-resumen';
import { ObsTabSql } from './tab-sql';
import { ETIQUETA_PESTANA, ROLES_POR_PESTANA } from './sistema-access';

/**
 * Observabilidad del sistema: UNA tarjeta a lo ancho con pestañas (Resumen · Errores · Latencia · Consultas
 * SQL · Endpoints · No medido), con un contexto global (rango, zona horaria, frescura) sincronizado con la URL.
 * La pestaña que el rol de la sesión no alcanza no se dibuja; la autoridad sigue siendo la API.
 */
@Component({
  selector: 'app-observability-sistema',
  imports: [PageHeader, Card, Tabs, Tab, ObsContextBar, ObsTabResumen, ObsTabErrores, ObsTabLatencia, ObsTabSql, ObsTabEndpoints, ObsTabNoMedido],
  templateUrl: './sistema.html',
  styleUrl: './sistema.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ObservabilitySistema {
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);
  private readonly sesion = inject(SessionStore);
  protected readonly store = inject(ObservabilityContextStore);
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;

  protected readonly visibles = computed<readonly PestanaSistema[]>(() =>
    PESTANAS.filter((p) => rolesAlcanzan(ROLES_POR_PESTANA[p], this.sesion.roles())),
  );
  protected readonly indice = computed(() => Math.max(0, this.visibles().indexOf(this.store.pestana())));
  protected readonly etiqueta = ETIQUETA_PESTANA;

  constructor() {
    // URL → contexto (al entrar y con atrás/adelante).
    this.ruta.queryParams.pipe(takeUntilDestroyed()).subscribe((p) => this.store.desdeParametros(p));
    // Contexto → URL (sin apilar historial por cada cambio de filtro).
    effect(() => {
      const params = this.store.haciaParametros();
      untracked(() => {
        const actual = this.ruta.snapshot.queryParams;
        const iguales = Object.keys({ ...params, ...actual }).every((k) => String(params[k] ?? '') === String(actual[k] ?? ''));
        if (!iguales) {
          void this.router.navigate([], { relativeTo: this.ruta, queryParams: params, replaceUrl: true });
        }
      });
    });
  }

  protected elegir(i: number): void {
    const p = this.visibles()[i];
    if (p !== undefined) this.store.pestana.set(p);
  }

  protected se(pestana: PestanaSistema): boolean {
    return this.visibles().includes(pestana);
  }
}
