import { signal } from '@angular/core';
import type { Observable } from 'rxjs';
import { errorToViewState } from '../../core/http/error-to-view-state';
import { loading } from '../../core/view-state/view-state';
import type { ViewState } from '../../core/view-state/view-state.types';

/**
 * El detalle desplegable de un ítem de lista (T26 · criterios 6 y 11): el
 * histórico de depreciación de un activo y el cronograma de un pasivo se abren
 * de a uno, se leen al abrir y se releen cuando cambia el ítem abierto.
 */
export class ExpandableDetail<T> {
  readonly openId = signal<string | null>(null);
  readonly state = signal<ViewState<T>>(loading());

  constructor(
    private readonly request: (id: string) => Observable<T>,
    private readonly toState: (data: T) => ViewState<T>,
  ) {}

  toggle(id: string): void {
    if (this.openId() === id) {
      this.openId.set(null);
      return;
    }
    this.openId.set(id);
    this.load(id);
  }

  /** Relee el detalle si es el del ítem que acaba de cambiar. */
  reloadIfOpen(id: string): void {
    if (this.openId() === id) this.load(id);
  }

  private load(id: string): void {
    this.state.set(loading());
    this.request(id).subscribe({
      next: (data) => this.state.set(this.toState(data)),
      error: (error: unknown) => this.state.set(errorToViewState<T>(error)),
    });
  }
}
