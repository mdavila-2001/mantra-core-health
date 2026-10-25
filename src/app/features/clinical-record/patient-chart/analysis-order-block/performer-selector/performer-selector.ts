import { ChangeDetectionStrategy, Component, computed, effect, input, model } from '@angular/core';

import { nextControlId } from '@shared/forms/form-control.context';
import { Radio } from '../../../../../shared/components/molecules/radio/radio';
import { RadioGroup } from '../../../../../shared/components/molecules/radio-group/radio-group';
import {
  DEFAULT_PERFORMER_CHOICE,
  type PerformerChoice,
  type PerformerMode,
  type PerformerSite,
} from './performer-selector.rules';

/** El texto que acompaña a cualquier opción: avisa que no se obliga a nadie. */
export const PERFORMER_RECOMMENDATION_TEXT = 'Es una recomendación. Su paciente puede elegir otro lugar.';

/** Por qué «Lo hago yo» está deshabilitada cuando no hay ninguna sede propia. */
export const NO_OWN_SITE_REASON =
  'No tiene una sede activa que publique este procedimiento con precio';

/** Por qué «En este centro» está deshabilitada cuando la búsqueda no trae sedes. */
export const NO_CENTER_SITE_REASON = 'Ningún centro publica este procedimiento con precio';

/**
 * **Quién realiza el procedimiento** — el selector de tres opciones de la orden.
 *
 * ## Es de presentación
 *
 * No lee nada y no conoce la API: recibe las sedes ya calculadas y devuelve la
 * elección. Qué campos viajan por modo es de `performerFieldsOf`, y de dónde
 * salen las sedes es de `PerformerSiteOptions`; así el formulario se prueba con
 * entradas simuladas y las reglas se prueban sin pantalla.
 *
 * ## «Que elija el paciente» es el modo por defecto
 *
 * El paciente es la parte menos favorecida (principio rector de esta pantalla): sin
 * una decisión expresa del médico, nada se recomienda. Y las otras dos son una
 * **recomendación**, no una asignación: no restringen qué centros ve el
 * paciente ni le dan al centro acceso a la orden, y el texto lo dice antes de
 * guardar.
 *
 * ## Las sedes van en el orden recibido
 *
 * La API ordena igual para todos (completos, distancia, precio, nombre); el
 * front pinta tal cual y no reordena.
 */
@Component({
  selector: 'app-performer-selector',
  imports: [Radio, RadioGroup],
  templateUrl: './performer-selector.html',
  styleUrl: './performer-selector.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PerformerSelector {
  /** El procedimiento pedido, o `null` si todavía no se eligió. */
  readonly procedureConceptId = input<string | null>(null);

  /** «Lo hago yo»: sedes activas del médico que publican el procedimiento. */
  readonly ownSites = input<readonly PerformerSite[]>([]);

  /** «En este centro»: sedes que publican el procedimiento, sean o no del médico. */
  readonly centerSites = input<readonly PerformerSite[]>([]);

  /** Las sedes todavía se están leyendo. */
  readonly sitesLoading = input(false);

  /** Por qué las sedes no se pudieron leer, o `null`. Nunca se inventan sedes. */
  readonly sitesError = input<string | null>(null);

  /** La elección del médico. Arranca en «Que elija el paciente». */
  readonly choice = model<PerformerChoice>(DEFAULT_PERFORMER_CHOICE);

  protected readonly recommendation = PERFORMER_RECOMMENDATION_TEXT;
  protected readonly modeGroupName = nextControlId('performer-mode');
  protected readonly siteGroupName = nextControlId('performer-site');

  protected readonly mode = computed(() => this.choice().mode);

  /** Las sedes que ofrece el modo elegido, o `null` si el modo no lleva sede. */
  protected readonly sitesOfMode = computed<readonly PerformerSite[] | null>(() => {
    switch (this.mode()) {
      case 'SELF':
        return this.ownSites();
      case 'ORGANIZATION':
        return this.centerSites();
      default:
        return null;
    }
  });

  private readonly sitesReady = computed(
    () => this.procedureConceptId() !== null && !this.sitesLoading() && this.sitesError() === null,
  );

  protected readonly selfEnabled = computed(() => this.sitesReady() && this.ownSites().length > 0);
  protected readonly organizationEnabled = computed(
    () => this.sitesReady() && this.centerSites().length > 0,
  );

  /** El motivo visible de «Lo hago yo» deshabilitada, o `null` si está disponible. */
  protected readonly selfReason = computed(() =>
    this.selfEnabled() ? null : (this.unavailableReason() ?? NO_OWN_SITE_REASON),
  );

  /** El motivo visible de «En este centro» deshabilitada, o `null`. */
  protected readonly organizationReason = computed(() =>
    this.organizationEnabled() ? null : (this.unavailableReason() ?? NO_CENTER_SITE_REASON),
  );

  /** Lo que impide mirar las sedes, antes de saber si hay o no. */
  private readonly unavailableReason = computed<string | null>(() => {
    if (this.procedureConceptId() === null) {
      return 'Elija primero el procedimiento';
    }
    if (this.sitesError() !== null) {
      return this.sitesError();
    }
    return this.sitesLoading() ? 'Buscando sedes…' : null;
  });

  constructor() {
    // Si lo elegido deja de existir —cambió el procedimiento, se recargaron las
    // sedes— se vuelve al modo por defecto en vez de dejar una elección que ya
    // no se puede ver ni enviar.
    effect(() => {
      const { mode, siteId } = this.choice();
      const sites = this.sitesOfMode();
      const modeGone = (mode === 'SELF' && !this.selfEnabled()) || (mode === 'ORGANIZATION' && !this.organizationEnabled());
      const siteGone = siteId !== null && sites !== null && !sites.some((s) => s.practiceSiteId === siteId);
      if (modeGone || siteGone) {
        this.choice.set(DEFAULT_PERFORMER_CHOICE);
      }
    });
  }

  protected pickMode(next: PerformerMode | null): void {
    if (next === null || next === this.mode()) {
      return;
    }
    // La sede es de un modo: al cambiar de modo se elige de nuevo.
    this.choice.set({ mode: next, siteId: null });
  }

  protected pickSite(siteId: string | null): void {
    this.choice.set({ mode: this.mode(), siteId });
  }

  protected siteLabel(site: PerformerSite): string {
    return site.addressText === null ? site.name : `${site.name} · ${site.addressText}`;
  }
}
