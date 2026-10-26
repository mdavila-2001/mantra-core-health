import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
  computed,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import {
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  forkJoin,
  of,
  switchMap,
  tap,
} from 'rxjs';

import { PortalClient } from '../../../core/data-access/admin-portal/portal.client';
import { PORTAL_NAV, portalUrl } from './portal-nav';

export interface SearchHit {
  readonly id: string;
  readonly group: 'Pantallas' | 'Operaciones' | 'Tablas';
  readonly label: string;
  readonly hint: string;
  readonly url: string;
}

const MIN_CHARS = 2;
const PER_GROUP = 5;

/** Los hallazgos del índice local de pantallas que contienen `q`. */
export function screenHits(q: string): readonly SearchHit[] {
  const t = q.trim().toLowerCase();
  if (t.length < MIN_CHARS) return [];
  return PORTAL_NAV.flatMap((g) =>
    g.items
      .filter((i) => `${i.label} ${i.summary} ${g.label}`.toLowerCase().includes(t))
      .map((i) => ({
        id: `p:${i.path}`,
        group: 'Pantallas' as const,
        label: i.label,
        hint: g.label,
        url: portalUrl(i.path),
      })),
  ).slice(0, PER_GROUP);
}

/**
 * Buscador global del portal: pantallas (índice local) más operaciones y tablas
 * (la API, con `q`). Es un combobox: el foco se queda en el campo y las flechas
 * mueven la opción activa.
 */
@Component({
  selector: 'app-portal-search',
  imports: [],
  templateUrl: './portal-search.html',
  styleUrl: './portal-search.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PortalSearch {
  private readonly client = inject(PortalClient);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly entradas = new Subject<string>();

  protected readonly texto = signal('');
  protected readonly abierto = signal(false);
  protected readonly buscando = signal(false);
  protected readonly fallo = signal(false);
  protected readonly hits = signal<readonly SearchHit[]>([]);
  protected readonly activa = signal(-1);
  protected readonly demasiadoCorto = computed(() => this.texto().trim().length < MIN_CHARS);
  protected readonly idDeActiva = computed(() =>
    this.activa() >= 0 ? `portal-search-${this.activa()}` : null,
  );

  constructor() {
    this.entradas
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        tap((q) => {
          this.fallo.set(false);
          this.activa.set(-1);
          this.buscando.set(q.trim().length >= MIN_CHARS);
        }),
        switchMap((q) => {
          const pantallas = screenHits(q);
          if (q.trim().length < MIN_CHARS) return of(pantallas);
          return forkJoin([
            this.client.listOperations({ q: q.trim(), limit: PER_GROUP }),
            this.client.listTables({ q: q.trim(), limit: PER_GROUP }),
          ]).pipe(
            // un fallo de la API no deja sin buscador: quedan las pantallas y se avisa
            catchError(() => {
              this.fallo.set(true);
              return of(null);
            }),
            switchMap((r) =>
              of(
                r === null
                  ? pantallas
                  : [
                      ...pantallas,
                      ...r[0].items.map((o) => ({
                        id: `o:${o.id}`,
                        group: 'Operaciones' as const,
                        label: `${o.metodo} ${o.ruta}`,
                        hint: o.modulo,
                        url: `${portalUrl('systems/operations')}/${encodeURIComponent(o.id)}`,
                      })),
                      ...r[1].items.map((t) => ({
                        id: `t:${t.id}`,
                        group: 'Tablas' as const,
                        label: `${t.schema}.${t.tabla}`,
                        hint: t.dominio ?? 'Sin dominio',
                        url: `${portalUrl('catalog/tables')}/${encodeURIComponent(t.schema)}/${encodeURIComponent(t.tabla)}`,
                      })),
                    ],
              ),
            ),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((hits) => {
        this.hits.set(hits);
        this.buscando.set(false);
      });
  }

  protected escribir(valor: string): void {
    this.texto.set(valor);
    this.abierto.set(true);
    this.entradas.next(valor);
  }

  protected abrirSiHayTexto(): void {
    if (this.texto().trim().length > 0) this.abierto.set(true);
  }

  protected cerrar(): void {
    this.abierto.set(false);
    this.activa.set(-1);
  }

  protected teclado(event: KeyboardEvent): void {
    const n = this.hits().length;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.abierto.set(true);
        if (n > 0) this.activa.update((i) => (i + 1) % n);
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (n > 0) this.activa.update((i) => (i <= 0 ? n - 1 : i - 1));
        break;
      case 'Enter': {
        const hit = this.hits()[this.activa()] ?? (n === 1 ? this.hits()[0] : undefined);
        if (hit) {
          event.preventDefault();
          this.ir(hit);
        }
        break;
      }
      case 'Escape':
        if (this.abierto()) {
          event.preventDefault();
          this.cerrar();
        }
        break;
    }
  }

  protected ir(hit: SearchHit): void {
    this.cerrar();
    this.texto.set('');
    this.hits.set([]);
    void this.router.navigateByUrl(hit.url);
  }

  protected grupos = computed(() => {
    const orden: SearchHit['group'][] = ['Pantallas', 'Operaciones', 'Tablas'];
    const hits = this.hits();
    return orden
      .map((g) => ({
        nombre: g,
        items: hits.map((h, i) => ({ h, i })).filter((x) => x.h.group === g),
      }))
      .filter((g) => g.items.length > 0);
  });
}
