import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';

import { CommunityClient } from '../../../core/data-access/community/community.client';
import type {
  AppealResolution,
  ModerationAppealItem,
  ModerationDecisionCode,
  ModerationQueueItem,
  ModerationQueueStatus,
} from '../../../core/data-access/community/community.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { EmptyState } from '../../../shared/components/molecules/empty-state/empty-state';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';

/** Cuántas entradas se piden por página. */
const PAGE_SIZE = 25;

/**
 * Las cuatro decisiones del contrato, con el texto que ve el moderador.
 *
 * No hay una quinta: los códigos son los del enum del servidor y agregar una
 * etiqueta acá que el backend no acepte daría un 400 al confirmarla.
 */
export const DECISIONES: readonly {
  readonly code: ModerationDecisionCode;
  readonly label: string;
}[] = [
  { code: 'REMOVED', label: 'Dar de baja' },
  { code: 'RESTRICTED', label: 'Restringir' },
  { code: 'WARNED', label: 'Advertir' },
  { code: 'DISMISSED', label: 'Desestimar' },
];

/** Las tres resoluciones de una apelación. */
export const RESOLUCIONES: readonly {
  readonly code: AppealResolution;
  readonly label: string;
}[] = [
  { code: 'UPHELD', label: 'Confirmar la decisión' },
  { code: 'OVERTURNED', label: 'Revertir la decisión' },
  { code: 'PARTIAL', label: 'Revertir en parte' },
];

/** Los filtros de estado que la pantalla ofrece. */
export const ESTADOS: readonly {
  readonly code: ModerationQueueStatus;
  readonly label: string;
}[] = [
  { code: 'QUEUED', label: 'Pendientes' },
  { code: 'IN_REVIEW', label: 'En revisión' },
  { code: 'RESOLVED', label: 'Resueltas' },
];

/**
 * La cola de moderación y las apelaciones.
 *
 * ## Lo que esta pantalla puede afirmar, y lo que no
 *
 * Muestra lo que el backend devuelve y nada más. En particular **no dice qué
 * contenido es el reportado**: la cola trae `contentRefId` y el tipo, no el
 * texto de la publicación, y resolverlo sería una lectura por fila contra un
 * endpoint que además puede negarla por visibilidad. Se muestra el
 * identificador y el motivo declarado —que sí viene—, y queda anotado como lo
 * que falta para que un moderador decida sin salir de acá.
 *
 * ## Tampoco inventa una política de strikes
 *
 * El contrato permite emitir un strike con la decisión, pero **qué pasa al
 * segundo y al tercero no está definido por producto**. La pantalla ofrece la
 * severidad como un dato opcional del formulario y no promete ninguna
 * consecuencia: escribir «al tercero se suspende la cuenta» sería afirmar una
 * regla que nadie escribió.
 *
 * ## El motivo es obligatorio, y del lado del servidor también
 *
 * El botón de confirmar está apagado sin motivo, pero eso es comodidad: el
 * contrato lo exige y rechaza la decisión sin él. Si sólo estuviera acá,
 * bastaría con llamar al endpoint por fuera.
 *
 * ## Quién entra
 *
 * `SECURITY_ADMIN`, y lo comprueba el servidor en cada una de las tres
 * lecturas. La guarda de la ruta evita que alguien llegue a una pantalla que
 * sólo le va a devolver 403; no es la que decide.
 */
@Component({
  selector: 'app-moderation',
  imports: [
    Alert,
    AppButton,
    Badge,
    Card,
    DatePipe,
    EmptyState,
    FormField,
    PageHeader,
    Textarea,
  ],
  templateUrl: './moderation.html',
  styleUrl: './moderation.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Moderation {
  private readonly community = inject(CommunityClient);

  protected readonly decisiones = DECISIONES;
  protected readonly resoluciones = RESOLUCIONES;
  protected readonly estados = ESTADOS;

  protected readonly pestania = signal<'cola' | 'apelaciones'>('cola');

  protected readonly entradas = signal<readonly ModerationQueueItem[]>([]);
  protected readonly apelaciones = signal<readonly ModerationAppealItem[]>([]);
  protected readonly cursor = signal<string | null>(null);
  protected readonly cargando = signal(false);
  protected readonly cargoAlgunaVez = signal(false);
  protected readonly error = signal('');
  protected readonly aviso = signal('');

  /** Estados marcados en el filtro. Vacío significa «todos». */
  protected readonly filtroEstado = signal<readonly ModerationQueueStatus[]>([
    'QUEUED',
  ]);

  /** Antigüedad mínima en horas, o `null` si no se acota. */
  protected readonly filtroHoras = signal<number | null>(null);

  /** La entrada abierta para decidir, si hay alguna. */
  protected readonly decidiendo = signal<string | null>(null);
  protected readonly decisionElegida = signal<ModerationDecisionCode | null>(
    null,
  );
  protected readonly motivo = signal('');
  protected readonly guardando = signal(false);

  /** La apelación abierta para resolver, si hay alguna. */
  protected readonly resolviendo = signal<string | null>(null);
  protected readonly resolucionElegida = signal<AppealResolution | null>(null);

  protected readonly hayMas = computed(() => this.cursor() !== null);

  protected readonly vacio = computed(
    () =>
      this.cargoAlgunaVez() &&
      (this.pestania() === 'cola'
        ? this.entradas().length === 0
        : this.apelaciones().length === 0),
  );

  /** El motivo tiene que decir algo: el contrato lo exige y acá se avisa antes. */
  protected readonly puedeConfirmar = computed(
    () =>
      this.decisionElegida() !== null &&
      this.motivo().trim().length > 0 &&
      !this.guardando(),
  );

  constructor() {
    this.cargar();
  }

  protected verCola(): void {
    if (this.pestania() !== 'cola') {
      this.pestania.set('cola');
      this.recargar();
    }
  }

  protected verApelaciones(): void {
    if (this.pestania() !== 'apelaciones') {
      this.pestania.set('apelaciones');
      this.recargar();
    }
  }

  /** Alterna un estado del filtro y vuelve a pedir la primera página. */
  protected alternarEstado(estado: ModerationQueueStatus): void {
    this.filtroEstado.update((actuales) =>
      actuales.includes(estado)
        ? actuales.filter((candidato) => candidato !== estado)
        : [...actuales, estado],
    );
    this.recargar();
  }

  protected estaFiltrado(estado: ModerationQueueStatus): boolean {
    return this.filtroEstado().includes(estado);
  }

  /** Acota por antigüedad, o la quita si ya estaba puesta. */
  protected alternarAntiguedad(horas: number): void {
    this.filtroHoras.update((actual) => (actual === horas ? null : horas));
    this.recargar();
  }

  protected recargar(): void {
    this.entradas.set([]);
    this.apelaciones.set([]);
    this.cursor.set(null);
    this.cargoAlgunaVez.set(false);
    this.cerrarFormularios();
    this.cargar();
  }

  protected verMas(): void {
    if (this.hayMas() && !this.cargando()) {
      this.cargar();
    }
  }

  /** Abre el formulario de decisión de una entrada. */
  protected decidir(queueId: string): void {
    this.cerrarFormularios();
    this.decidiendo.set(queueId);
  }

  protected elegirDecision(code: ModerationDecisionCode): void {
    this.decisionElegida.set(code);
  }

  protected cancelar(): void {
    this.cerrarFormularios();
  }

  protected confirmarDecision(): void {
    const queueId = this.decidiendo();
    const decision = this.decisionElegida();
    if (queueId === null || decision === null || !this.puedeConfirmar()) {
      return;
    }

    this.guardando.set(true);
    this.error.set('');

    this.community
      .decideModeration(queueId, {
        decision,
        rationaleText: this.motivo().trim(),
      })
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.aviso.set('Decisión registrada.');
          // Se recarga en vez de sacar la fila a mano: decidir cierra también
          // los reportes del contenido, y esa consecuencia la sabe el servidor.
          this.recargar();
        },
        error: () => {
          this.guardando.set(false);
          this.error.set('No pudimos registrar la decisión. Reintentá.');
        },
      });
  }

  /** Abre el formulario de resolución de una apelación. */
  protected resolver(appealId: string): void {
    this.cerrarFormularios();
    this.resolviendo.set(appealId);
  }

  protected elegirResolucion(code: AppealResolution): void {
    this.resolucionElegida.set(code);
  }

  protected confirmarResolucion(): void {
    const appealId = this.resolviendo();
    const resolution = this.resolucionElegida();
    if (appealId === null || resolution === null || this.guardando()) {
      return;
    }

    this.guardando.set(true);
    this.error.set('');

    this.community.resolveAppeal(appealId, { resolution }).subscribe({
      next: () => {
        this.guardando.set(false);
        this.aviso.set('Apelación resuelta.');
        this.recargar();
      },
      error: () => {
        this.guardando.set(false);
        this.error.set('No pudimos resolver la apelación. Reintentá.');
      },
    });
  }

  private cerrarFormularios(): void {
    this.decidiendo.set(null);
    this.decisionElegida.set(null);
    this.motivo.set('');
    this.resolviendo.set(null);
    this.resolucionElegida.set(null);
  }

  private cargar(): void {
    if (this.cargando()) {
      return;
    }
    this.cargando.set(true);
    this.error.set('');

    const cursorActual = this.cursor();
    const paginado = {
      limit: PAGE_SIZE,
      ...(cursorActual === null ? {} : { cursor: cursorActual }),
    };

    if (this.pestania() === 'apelaciones') {
      this.community
        .listModerationAppeals({ ...paginado, status: ['OPEN'] })
        .subscribe({
          next: (pagina) => {
            this.apelaciones.update((previas) => [...previas, ...pagina.items]);
            this.cursor.set(pagina.nextCursor);
            this.cargando.set(false);
            this.cargoAlgunaVez.set(true);
          },
          error: () => this.fallo('No pudimos cargar las apelaciones.'),
        });
      return;
    }

    const horas = this.filtroHoras();
    this.community
      .listModerationQueue({
        ...paginado,
        status: this.filtroEstado(),
        ...(horas === null ? {} : { minAgeHours: horas }),
      })
      .subscribe({
        next: (pagina) => {
          this.entradas.update((previas) => [...previas, ...pagina.items]);
          this.cursor.set(pagina.nextCursor);
          this.cargando.set(false);
          this.cargoAlgunaVez.set(true);
        },
        error: () => this.fallo('No pudimos cargar la cola de moderación.'),
      });
  }

  private fallo(mensaje: string): void {
    this.cargando.set(false);
    this.cargoAlgunaVez.set(true);
    this.error.set(mensaje);
  }
}
