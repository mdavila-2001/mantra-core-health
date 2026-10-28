import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
  untracked,
} from '@angular/core';

import { forkJoin, map, of, type Observable } from 'rxjs';

import { AuthService } from '../../../../core/auth/auth.service';
import { ChartNotesClient } from '../../../../core/data-access/chart-notes/chart-notes.client';
import type { ChartNote } from '../../../../core/data-access/clinical/clinical.types';
import { FormsClient } from '../../../../core/data-access/forms/forms.client';
import type { FormInstanceListItem } from '../../../../core/data-access/forms/forms.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';

/** Prefijos del valor del selector: una respuesta de `forms` o una nota libre. */
const DE_FORMULARIO = 'f:';
const DE_NOTA = 'n:';

/** Cómo quedó la búsqueda de respuestas del encuentro. */
type EstadoDeRespuestas = 'buscando' | 'listo' | 'error';

const FORMATO = new Intl.DateTimeFormat('es-BO', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/**
 * **La respuesta del formulario médico** a la que pertenece lo que se emite.
 *
 * Receta, orden de análisis, plan de cuidados y reconsulta nacen de lo que se
 * respondió en el formulario médico de la cita. Este selector los ata a esa
 * respuesta, y la atadura es obligatoria: sin respuesta no hay nada que emitir.
 *
 * ## Cargada por defecto
 *
 * La respuesta más reciente del encuentro viene elegida. Con una sola el
 * selector queda **deshabilitado**: no hay nada que decidir, y un control que
 * se puede tocar sin opciones reales invita a dudar. Con varias queda
 * habilitado, con la más reciente arriba y elegida.
 *
 * Sólo cuentan las respuestas **cerradas**: una instancia abierta es un
 * formulario a medio llenar, no una respuesta.
 *
 * Sin respuesta avisa qué falta; quien lo usa bloquea su botón mirando
 * `seleccionada()`, que queda en `null`.
 *
 * ## Las notas con filas «campo: valor» (A3, 26/10/2026)
 *
 * Hasta el 28/10/2026 el «Formulario médico» ofrecía el «Formulario libre —
 * campo y valor», que se guardaba como **nota** del expediente (P39) y no como
 * respuesta de `forms`. Ya no se elige ahí, pero esas notas siguen existiendo,
 * y los campos adicionales del formulario médico también dejan una nota con
 * filas. Quien lo usa con `aceptaNotas` (la orden de análisis, que la API ata a
 * notas con `basedOnNoteIds`, P40) recibe también las notas con filas
 * **firmadas** del encuentro como opción, en `notaSeleccionada`. Un borrador no
 * sirve de base —la API lo rechaza: todavía puede cambiar—, así que se ofrece
 * firmarlo acá mismo en vez de decir «Falta el formulario médico».
 */
@Component({
  selector: 'app-form-response-picker',
  imports: [Alert, AppButton, FormField, Select],
  template: `
    @if (encounterId() === null) {
      <app-alert
        tone="info"
        title="Abra el encuentro primero"
        data-testid="respuesta-sin-encuentro"
      >
        Lo que se emite en la cita cuelga de la respuesta del formulario médico, y esa respuesta es
        de un encuentro.
      </app-alert>
    } @else if (estado() === 'buscando') {
      <p class="respuesta__estado" role="status">Buscando la respuesta del formulario médico…</p>
    } @else if (estado() === 'error') {
      <app-alert
        tone="error"
        title="No pudimos traer la respuesta del formulario"
        data-testid="respuesta-error"
      >
        Sin saber a qué respuesta pertenece no se puede emitir. Cierre y vuelva a abrir para
        reintentar.
      </app-alert>
    } @else if (opciones().length === 0 && borrador(); as nota) {
      <app-alert
        tone="warning"
        title="El formulario libre está en borrador"
        data-testid="respuesta-borrador"
      >
        La orden se basa en lo que quedó firmado: un borrador todavía puede cambiar. Fírmelo para
        pedir la orden.
      </app-alert>
      <button
        app-button
        variant="secondary"
        size="sm"
        type="button"
        class="respuesta__firmar"
        data-testid="respuesta-firmar"
        [disabled]="firmando()"
        (clicked)="firmar(nota)"
      >
        Firmar el formulario libre
      </button>
      @if (errorAlFirmar()) {
        <p class="respuesta__estado" role="alert">No pudimos firmarlo. Reintente.</p>
      }
    } @else if (opciones().length === 0) {
      <app-alert tone="warning" title="Falta el formulario médico" data-testid="respuesta-falta">
        Complete primero el «Formulario médico» de esta cita. Todo lo que se emite queda asociado a
        esa respuesta.
      </app-alert>
    } @else {
      <app-form-field
        icon="survey"
        label="Respuesta del formulario médico"
        [required]="true"
        [hint]="
          opciones().length === 1
            ? 'La única respuesta de esta cita; queda asociada sola.'
            : 'Hay más de una respuesta en esta cita: elija de cuál sale.'
        "
      >
        <app-select
          data-testid="respuesta-del-formulario"
          [options]="opciones()"
          [value]="valorElegido()"
          [disabled]="opciones().length === 1"
          (valueChange)="elegir($event)"
        />
      </app-form-field>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .respuesta__firmar {
      margin-block-start: var(--sp-2);
    }
    .respuesta__estado {
      margin: 0;
      color: var(--text-secondary);
      font-size: var(--fs-caption);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormResponsePicker {
  private readonly forms = inject(FormsClient);
  private readonly notes = inject(ChartNotesClient);
  private readonly auth = inject(AuthService);

  /** El encuentro de la cita. */
  readonly encounterId = input<string | null>(null);

  /** De quién es el encuentro: hace falta para leer sus notas libres. */
  readonly patientProfileId = input<string | null>(null);

  /** Si una nota libre firmada del encuentro sirve de respuesta (ver arriba). */
  readonly aceptaNotas = input(false);

  /** La respuesta de `forms` elegida, o `null`. */
  readonly seleccionada = model<string | null>(null);

  /** La nota libre elegida (con `aceptaNotas`), o `null`. */
  readonly notaSeleccionada = model<string | null>(null);

  protected readonly estado = signal<EstadoDeRespuestas>('buscando');

  /** Las respuestas cerradas del encuentro, la más reciente primero. */
  protected readonly respuestas = signal<readonly FormInstanceListItem[]>([]);

  /** Las notas libres (con filas) del encuentro, la más reciente primero. */
  protected readonly notasLibres = signal<readonly ChartNote[]>([]);

  protected readonly firmando = signal(false);
  protected readonly errorAlFirmar = signal(false);

  /** El borrador libre más reciente, si no hay nada firmado que elegir. */
  protected readonly borrador = computed<ChartNote | null>(
    () => this.notasLibres().find((nota) => nota.signedAt === undefined) ?? null,
  );

  protected readonly opciones = computed<readonly SelectOption<string | null>[]>(() => [
    ...this.respuestas().map((respuesta, indice) => ({
      value: `${DE_FORMULARIO}${respuesta.id}`,
      label: `Formulario médico · ${FORMATO.format(new Date(respuesta.closedAt ?? respuesta.createdAt))}${indice === 0 ? ' · la más reciente' : ''}`,
    })),
    ...this.notasLibres()
      .filter((nota) => nota.signedAt !== undefined)
      .map((nota) => ({
        value: `${DE_NOTA}${nota.noteId}`,
        label: `Formulario libre · ${FORMATO.format(nota.signedAt ?? nota.createdAt)}`,
      })),
  ]);

  protected readonly valorElegido = computed<string | null>(() => {
    const respuesta = this.seleccionada();
    if (respuesta !== null) return `${DE_FORMULARIO}${respuesta}`;
    const nota = this.notaSeleccionada();
    return nota === null ? null : `${DE_NOTA}${nota}`;
  });

  constructor() {
    effect(() => {
      const encuentro = this.encounterId();
      const paciente = this.patientProfileId();
      const conNotas = this.aceptaNotas();
      untracked(() => this.cargar(encuentro, conNotas ? paciente : null));
    });
  }

  protected elegir(valor: string | null): void {
    if (valor?.startsWith(DE_NOTA)) {
      this.seleccionada.set(null);
      this.notaSeleccionada.set(valor.slice(DE_NOTA.length));
      return;
    }
    this.notaSeleccionada.set(null);
    this.seleccionada.set(
      valor?.startsWith(DE_FORMULARIO) ? valor.slice(DE_FORMULARIO.length) : null,
    );
  }

  /** Firma el borrador libre (la misma firma que el expediente) y relee. */
  protected firmar(nota: ChartNote): void {
    const firmante = this.auth.practitionerProfileId();
    if (this.firmando() || nota.currentVersionId === undefined || firmante === null) {
      return;
    }
    this.firmando.set(true);
    this.errorAlFirmar.set(false);
    this.notes.signVersion(nota.noteId, nota.currentVersionId, firmante).subscribe({
      next: () => {
        this.firmando.set(false);
        this.cargar(this.encounterId(), this.aceptaNotas() ? this.patientProfileId() : null);
      },
      error: () => {
        this.firmando.set(false);
        this.errorAlFirmar.set(true);
      },
    });
  }

  private cargar(encuentro: string | null, paciente: string | null): void {
    this.respuestas.set([]);
    this.notasLibres.set([]);
    this.seleccionada.set(null);
    this.notaSeleccionada.set(null);
    if (encuentro === null) {
      this.estado.set('listo');
      return;
    }
    this.estado.set('buscando');
    forkJoin([
      this.forms.listInstancesByEncounter(encuentro),
      this.notasLibresDe(encuentro, paciente),
    ]).subscribe({
      next: ([listado, notas]) => {
        if (this.encounterId() !== encuentro) return;
        const cerradas = listado.items
          .filter((item) => item.closedAt != null)
          .slice()
          .sort((a, b) => (b.closedAt ?? '').localeCompare(a.closedAt ?? ''));
        this.respuestas.set(cerradas);
        this.notasLibres.set(notas);
        const firmada = notas.find((nota) => nota.signedAt !== undefined);
        if (cerradas[0] !== undefined) {
          this.seleccionada.set(cerradas[0].id);
        } else if (firmada !== undefined) {
          this.notaSeleccionada.set(firmada.noteId);
        }
        this.estado.set('listo');
      },
      error: () => {
        if (this.encounterId() !== encuentro) return;
        this.estado.set('error');
      },
    });
  }

  /** Las notas libres (las que tienen filas campo/valor) del encuentro. */
  private notasLibresDe(
    encuentro: string,
    paciente: string | null,
  ): Observable<readonly ChartNote[]> {
    if (paciente === null) return of([]);
    // `GET /charts/notes` no filtra por encuentro: su lista blanca rechaza
    // `encounterId` con 400 (visto en navegador contra la API real, A3). Se
    // piden las de la persona y se acota acá por el encuentro de cada nota.
    return this.notes.listNotes({ patientProfileId: paciente, limit: 50 }).pipe(
      map((pagina) =>
        pagina.items
          .filter((nota) => nota.encounterId === encuentro)
          .filter((nota) => (nota.entries?.length ?? 0) > 0)
          .slice()
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
      ),
    );
  }
}
