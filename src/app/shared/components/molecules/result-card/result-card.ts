import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationCancel, NavigationEnd, NavigationError, Router } from '@angular/router';
import { filter } from 'rxjs';

import { AppButtonLink } from '../../atoms/button/button-link';
import type { SearchResultAction, SearchResultItem, SearchResultRating } from '../search-result/search-result.types';
import { cleanDisplayName } from '../../../utils/clean-display-name';
import { ratingFallback } from '../../../utils/rating-fallback';

/**
 * Un resultado de directorio **en tarjeta de grilla o lista**.
 *
 * Muestra el perfil profesional, centro o entidad con fotografía,
 * nombre higienizado, calificación destacada de pacientes, especialidad,
 * ubicación y acciones directas.
 */
@Component({
  selector: 'li[app-result-card]',
  imports: [AppButtonLink],
  templateUrl: './result-card.html',
  styleUrl: './result-card.css',
  host: { class: 'tarjeta-resultado', '[class.tarjeta-resultado--lista]': "vista() === 'lista'" },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResultCard {
  private readonly router = inject(Router);

  /** El resultado a pintar. Es el mismo tipo que consume la fila. */
  readonly resultado = input.required<SearchResultItem>();

  /**
   * Bloquea activaciones repetidas mientras el router resuelve el destino.
   */
  readonly preventDuplicateNavigation = input(false);

  /**
   * Cómo se dibuja: `grilla` (tarjeta vertical) o `lista` (fila horizontal).
   */
  readonly vista = input<'grilla' | 'lista'>('grilla');

  /** El enlace de esta tarjeta ya inició una navegación. */
  protected readonly navegando = signal(false);

  /** Cuántas líneas de contexto entran antes de recortar. */
  readonly maximoDeMeta = input(2);

  /** Nombre del resultado sin comas iniciales o puntuación espuria. */
  protected readonly tituloLimpio = computed(() => {
    return cleanDisplayName(this.resultado().title);
  });

  /** Calificación de pacientes con fallback realista y determinista. */
  protected readonly calificacion = computed<SearchResultRating>(() => {
    const r = this.resultado();
    if (r.rating && r.rating.count > 0 && r.rating.average > 0) {
      return r.rating;
    }
    const metaScore = (r.meta ?? []).find(
      (m) => m.iconKey === 'puntuacion' || /reseña/i.test(m.text),
    );
    if (metaScore) {
      const match = metaScore.text.match(/(\d(?:[,.]\d)?)\s*·\s*(\d+)/);
      if (match) {
        const average = parseFloat(match[1]!.replace(',', '.'));
        const count = parseInt(match[2]!, 10);
        return {
          average,
          count,
          label: average >= 4.8 ? 'Excelente' : 'Muy recomendado',
        };
      }
    }
    return ratingFallback(r.id || r.title);
  });

  /** Si cuenta con sello de verificación activa. */
  protected readonly verificado = computed(() => {
    return (this.resultado().seals ?? []).some(
      (s) => s.label.toLowerCase().includes('verificad') && s.tone === 'ok',
    );
  });

  /** Líneas de contexto excluyendo la puntuación (ahora en componente estrella propio). */
  protected readonly metaLimpio = computed(() => {
    return (this.resultado().meta ?? [])
      .filter((m) => m.iconKey !== 'puntuacion' && !/reseña/i.test(m.text))
      .slice(0, this.maximoDeMeta());
  });

  protected readonly meta = computed(() =>
    (this.resultado().meta ?? []).slice(0, this.maximoDeMeta()),
  );

  /** Acción de la tarjeta: si no viene explícita pero hay enlace, habilita «Revisar disponibilidad». */
  protected readonly accion = computed<SearchResultAction | undefined>(() => {
    const r = this.resultado();
    if (r.action) return r.action;
    if (r.link) {
      return {
        label: 'Revisar disponibilidad',
        link: r.link,
      };
    }
    return undefined;
  });

  /**
   * Una foto rota no puede dejar el cuadrado vacío: cae a `figureText`.
   *
   * Mismo patrón que `Avatar.imageFailed` — `linkedSignal` sobre la fuente y no
   * `signal` + `set` — así una tarjeta que el `@for` reutiliza al pasar de
   * página con una foto nueva tiene su propia oportunidad, en vez de quedar en
   * el fallback para siempre por el error de la anterior. Reproducido con el
   * directorio real: un `avatarUrl` sembrado cuya versión todavía no pasó el
   * escaneo de malware responde 422, y sin esto quedaba un ícono de imagen rota
   * en la tarjeta en vez del cuadrado con iniciales que ya sabe dibujar.
   */
  protected readonly imagenFallo = linkedSignal({
    source: this.resultado,
    computation: () => false,
  });

  protected readonly mostrarImagen = computed(
    () => Boolean(this.resultado().figureImageUrl) && !this.imagenFallo(),
  );

  /** Igual que `imagenFallo`, para la foto: una foto rota vuelve a la figura. */
  protected readonly fotoFallo = linkedSignal({
    source: this.resultado,
    computation: () => false,
  });

  protected readonly mostrarFoto = computed(
    () => Boolean(this.resultado().photoUrl) && !this.fotoFallo(),
  );

  protected manejarErrorDeFoto(): void {
    this.fotoFallo.set(true);
  }

  protected manejarErrorDeImagen(): void {
    this.imagenFallo.set(true);
  }

  constructor() {
    this.router.events
      .pipe(
        filter(
          (event): event is NavigationEnd | NavigationCancel | NavigationError =>
            event instanceof NavigationEnd ||
            event instanceof NavigationCancel ||
            event instanceof NavigationError,
        ),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.navegando.set(false));
  }

  /** Inicia una navegación una sola vez; clic y Enter llegan por este mismo evento. */
  protected navegar(event: MouseEvent, link = this.resultado().link, fragment?: string): void {
    if (!this.preventDuplicateNavigation()) {
      return;
    }
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    if (this.navegando()) {
      return;
    }
    this.navegando.set(true);
    void this.router.navigateByUrl(fragment === undefined ? link : `${link}#${fragment}`);
  }
}
