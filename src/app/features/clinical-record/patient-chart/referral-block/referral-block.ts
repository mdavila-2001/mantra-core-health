import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { EMPTY, expand, of, reduce } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { AuthService } from '../../../../core/auth/auth.service';
import { ProfilesClient } from '../../../../core/data-access/profiles/profiles.client';
import type { PractitionerListItem } from '../../../../core/data-access/profiles/profiles.types';
import { ReferralsClient } from '../../../../core/data-access/referrals/referrals.client';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Textarea } from '../../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../shared/components/molecules/card/card';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ReferenceCombobox } from '../../../../shared/components/molecules/reference-combobox/reference-combobox';
import type { ReferenceOption } from '../../../../shared/components/molecules/reference-combobox/reference-combobox.types';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { writeFailureMessage } from '../../write-message';

/** Cuántos profesionales trae cada página del directorio. */
const POR_PAGINA = 50;

/** Tope de páginas: 500 profesionales alcanzan para un buscador local. */
const MAX_PAGINAS = 10;

/** Cuántas coincidencias se ofrecen a la vez en el desplegable. */
const MAX_OPCIONES = 8;

/** El motivo cabe en el aviso de la persona: el servidor lo corta a este largo. */
const TOPE_DEL_MOTIVO = 500;

/** Un profesional recomendable, tal como lo ofrece el buscador. */
export interface RecommendablePractitioner {
  readonly profileId: string;
  readonly name: string;
  readonly title: string | null;
}

/**
 * **Derivar a otro profesional** — el médico recomienda a la persona que
 * consulte con alguien más (pedido del propietario, 24/10/2026).
 *
 * ## Qué hace y qué no
 *
 * Emite la derivación (`POST /referrals`) atada al **encuentro en curso**, y la
 * API le avisa a la persona en su campana con un enlace a la ficha del
 * profesional recomendado. **No reserva nada**: la persona reserva ahí, con la
 * reserva de siempre, y puede elegir a otro de la misma especialidad.
 *
 * ## Sin encuentro no hay derivación con aviso
 *
 * El encuentro es lo que demuestra que quien deriva atendió a esa persona; sin
 * él la API guarda la derivación pero no avisa, y un formulario que parece
 * funcionar y no avisa a nadie es peor que uno que dice qué falta. Por eso, sin
 * encuentro abierto el bloque lo dice y no ofrece el formulario.
 *
 * ## Los profesionales
 *
 * Del mismo directorio que ve el paciente (`GET /profiles/practitioners`),
 * recorrido hasta {@link MAX_PAGINAS} páginas y filtrado acá: el directorio no
 * busca por nombre. Quien deriva no se ofrece a sí mismo.
 */
@Component({
  selector: 'app-referral-block',
  imports: [Alert, AppButton, Card, FormField, ReferenceCombobox, Textarea, ViewStateHost],
  templateUrl: './referral-block.html',
  styleUrl: './referral-block.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReferralBlock {
  private readonly profiles = inject(ProfilesClient);
  private readonly referrals = inject(ReferralsClient);
  private readonly auth = inject(AuthService);

  /** La persona que se deriva. */
  readonly patientProfileId = input.required<string>();

  /** El encuentro en curso, o `null` si no hay uno abierto. */
  readonly encounterId = input<string | null>(null);

  /** Avisa que se emitió una derivación, para que la consulta relea lo suyo. */
  readonly cambio = output<void>();

  protected readonly topeDelMotivo = TOPE_DEL_MOTIVO;

  protected readonly directorio =
    signal<ViewState<readonly RecommendablePractitioner[]>>(loading());
  private readonly intento = signal(0);

  protected readonly consulta = signal('');
  protected readonly elegido = signal<string | null>(null);
  protected readonly motivo = signal('');
  protected readonly enviando = signal(false);
  protected readonly registro = signal<ViewState<null>>(ready(null));
  protected readonly derivadoA = signal<string | null>(null);
  protected readonly yaDerivado = signal(false);

  protected readonly sinEncuentro = computed(() => this.encounterId() === null);

  /** Lo que se ofrece en el desplegable: los que coinciden con lo escrito. */
  protected readonly opciones = computed<readonly ReferenceOption[]>(() => {
    const estado = this.directorio();
    if (estado.status !== 'ready') return [];
    const buscado = normalizar(this.consulta());
    return estado.data
      .filter((p) => buscado === '' || normalizar(`${p.name} ${p.title ?? ''}`).includes(buscado))
      .slice(0, MAX_OPCIONES)
      .map((p) => ({ value: p.profileId, label: etiquetaDe(p) }));
  });

  protected readonly profesionalElegido = computed<ReferenceOption | null>(() => {
    const id = this.elegido();
    const estado = this.directorio();
    if (id === null || estado.status !== 'ready') return null;
    const p = estado.data.find((fila) => fila.profileId === id);
    return p === undefined ? null : { value: p.profileId, label: etiquetaDe(p) };
  });

  protected readonly puedeEnviar = computed(
    () =>
      !this.sinEncuentro() &&
      this.elegido() !== null &&
      !this.enviando() &&
      this.motivo().length <= TOPE_DEL_MOTIVO,
  );

  protected readonly errorDelRegistro = computed<string | null>(() => {
    const estado = this.registro();
    if (estado.status === 'validation') {
      return estado.issues.map((issue) => issue.message).join(' ') || null;
    }
    return writeFailureMessage(estado, {
      accion: 'derivar',
      sinPermiso: 'Sólo puede derivar a quien atiende desde su propia organización.',
      yaNoExiste:
        'No encontramos este encuentro entre los de esta persona. Vuelva a abrirlo y pruebe de nuevo.',
    });
  });

  constructor() {
    this.cargarDirectorio();
  }

  protected recargar(): void {
    this.intento.update((n) => n + 1);
    this.cargarDirectorio();
  }

  protected buscar(texto: string): void {
    this.consulta.set(texto);
  }

  protected elegir(id: string | null): void {
    this.elegido.set(id);
    this.derivadoA.set(null);
    this.yaDerivado.set(false);
  }

  protected escribirMotivo(texto: string): void {
    this.motivo.set(texto);
  }

  protected derivar(): void {
    const encuentro = this.encounterId();
    const destino = this.elegido();
    if (!this.puedeEnviar() || encuentro === null || destino === null) return;

    const nombre = this.profesionalElegido()?.label ?? 'el profesional elegido';
    this.enviando.set(true);
    this.registro.set(loading());
    this.yaDerivado.set(false);

    const motivo = this.motivo().trim();
    this.referrals
      .create({
        patientProfileId: this.patientProfileId(),
        sourceEncounterId: encuentro,
        targetProfileId: destino,
        ...(motivo === '' ? {} : { reasonText: motivo }),
      })
      .subscribe({
        next: () => {
          this.enviando.set(false);
          this.registro.set(ready(null));
          this.derivadoA.set(nombre);
          this.elegido.set(null);
          this.consulta.set('');
          this.motivo.set('');
          this.cambio.emit();
        },
        error: (error: unknown) => {
          this.enviando.set(false);
          const estado = errorToViewState<null>(error);
          // 409: la misma derivación ya existe. No es un error del médico:
          // es un aviso, y se dice con palabras de aviso.
          if (esDuplicado(error)) {
            this.registro.set(ready(null));
            this.yaDerivado.set(true);
            return;
          }
          this.registro.set(estado);
        },
      });
  }

  /** Recorre las páginas del directorio y se queda con quienes se pueden recomendar. */
  private cargarDirectorio(): void {
    this.directorio.set(loading());
    const yo = this.auth.practitionerProfileId();

    this.profiles
      .listPractitioners({ limit: POR_PAGINA })
      .pipe(
        expand((pagina, indice) =>
          pagina.nextCursor === null || indice + 1 >= MAX_PAGINAS
            ? EMPTY
            : this.profiles.listPractitioners({ limit: POR_PAGINA, cursor: pagina.nextCursor }),
        ),
        reduce(
          (todos: readonly PractitionerListItem[], pagina) => [...todos, ...pagina.items],
          [] as readonly PractitionerListItem[],
        ),
        catchError((error: unknown) => {
          this.directorio.set(errorToViewState<readonly RecommendablePractitioner[]>(error));
          return of(null);
        }),
      )
      .subscribe((filas) => {
        if (filas === null) return;
        const vistos = new Set<string>();
        const gente = filas
          .filter(
            (fila) =>
              fila.profileId !== yo && !vistos.has(fila.profileId) && vistos.add(fila.profileId),
          )
          .map<RecommendablePractitioner>((fila) => ({
            profileId: fila.profileId,
            name: fila.displayName?.trim() || fila.practitionerCode,
            title: fila.professionalTitle?.trim() || null,
          }))
          .sort((a, b) => a.name.localeCompare(b.name, 'es'));
        this.directorio.set(ready(gente));
      });
  }
}

function etiquetaDe(p: RecommendablePractitioner): string {
  return p.title === null ? p.name : `${p.name} · ${p.title}`;
}

/** Sin tildes ni mayúsculas: «lucia» encuentra a «Lucía». */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function esDuplicado(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    (error as { status: unknown }).status === 409
  );
}
