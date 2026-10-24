import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationCancel, NavigationEnd, NavigationError, Router } from '@angular/router';
import { filter } from 'rxjs';

import { AppButtonLink } from '../../atoms/button/button-link';
import { NavIcon } from '../../atoms/nav-icon/nav-icon';
import type {
  SearchResultAction,
  SearchResultItem,
  SearchResultRating,
} from '../search-result/search-result.types';
import { cleanDisplayName } from '../../../utils/clean-display-name';
import { ratingOf } from './rating-of';

/**
 * Un resultado de directorio **en tarjeta de grilla o lista**.
 *
 * Muestra el perfil profesional, centro o entidad con fotografía,
 * nombre higienizado, calificación de pacientes cuando existe, especialidad,
 * ubicación y acciones directas.
 */
@Component({
  selector: 'li[app-result-card]',
  imports: [AppButtonLink, NavIcon],
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

  /** La calificación real, o `null`. Ver {@link ratingOf}. */
  protected readonly calificacion = computed<SearchResultRating | null>(() =>
    ratingOf(this.resultado()),
  );

  /**
   * Cuánto de las cinco estrellas se rellena, en porcentaje: 3,7 de 5 es el
   * 74 %. Las estrellas parciales son las de cualquier tienda: se leen de un
   * vistazo sin tener que leer el número.
   */
  protected readonly rellenoDeEstrellas = computed(() => {
    const nota = this.calificacion();
    return nota === null ? 0 : Math.min(100, Math.max(0, (nota.average / 5) * 100));
  });

  /**
   * La distinción, **sólo para las notas que la merecen**. Antes toda nota por
   * debajo de 4,8 salía «Muy recomendado», también un 3,7 o un 2,0: un elogio
   * que las reseñas no dicen.
   */
  protected readonly distincion = computed(() => {
    const nota = this.calificacion();
    if (nota === null) return null;
    if (nota.label) return nota.label;
    if (nota.average >= 4.8) return 'Excelente';
    if (nota.average >= 4.5) return 'Muy recomendado';
    return null;
  });

  /** «4,5 de 5 estrellas, 60 opiniones» o «Sin reseñas todavía», para el lector. */
  protected readonly textoDeResenas = computed(() => {
    const nota = this.calificacion();
    if (nota === null) return 'Sin reseñas todavía';
    const media = nota.average.toFixed(1).replace('.', ',');
    return `${media} de 5 estrellas, ${nota.count} ${nota.count === 1 ? 'opinión' : 'opiniones'}`;
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

  /**
   * Acción de la tarjeta: la que trae el resultado o, si sólo hay enlace,
   * «Ver ficha». Antes el respaldo era «Revisar disponibilidad», que sólo
   * tiene sentido en un médico —el directorio de médicos lo declara explícito
   * con el ancla a sus horarios— y salía también en clínicas, farmacias y
   * aseguradoras, que no tienen agenda.
   */
  protected readonly accion = computed<SearchResultAction | undefined>(() => {
    const r = this.resultado();
    if (r.action) return r.action;
    if (r.link) {
      return { label: 'Ver ficha', link: r.link };
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
