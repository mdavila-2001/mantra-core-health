import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { Router, RouterLink, type UrlTree } from '@angular/router';

import type { ViewState } from '../../../../../core/view-state/view-state.types';
import { Link } from '../../../../../shared/components/atoms/link/link';
import { Alert } from '../../../../../shared/components/molecules/alert/alert';
import { ViewStateHost } from '../../../../../shared/components/organisms/view-state-host/view-state-host';

/**
 * The part of «Mi recorrido» that did not arrive, said through the M34 host.
 *
 * Only S5 is projected: the host paints it in the error tone with the support
 * code, which made a wall read as a fault (S9). Here it takes the warning tone
 * of the practitioner's panel (`red-clinica-informe-estado`), keeps the
 * state's message and its next action (a door, e.g. «Verificar identidad»),
 * and offers no retry. Every other state is the host's own.
 */
@Component({
  selector: 'app-recorrido-falta',
  imports: [Alert, Link, RouterLink, ViewStateHost],
  templateUrl: './recorrido-falta.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecorridoFalta {
  private readonly router = inject(Router);

  readonly estado = input.required<ViewState<unknown>>();
  /** What is missing, for the S5 title («sus estudios y controles»). */
  readonly que = input.required<string>();
  readonly reintentar = output<void>();

  protected readonly prohibido = computed(() => {
    const estado = this.estado();
    return estado.status === 'forbidden' ? estado : null;
  });

  /** Parsed first: a route string with a query would be escaped as one segment. */
  protected enlace(ruta: string, consulta?: Readonly<Record<string, string>>): UrlTree {
    const arbol = this.router.parseUrl(ruta);
    arbol.queryParams = { ...arbol.queryParams, ...consulta };
    return arbol;
  }
}
