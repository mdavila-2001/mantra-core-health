import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EMPTY, expand, map, of, reduce, switchMap, type Observable } from 'rxjs';

import { TerminologyClient } from '../../core/data-access/terminology/terminology.client';
import type { GlossaryRelation, GlossaryTermDetail } from '../../core/data-access/terminology/terminology.types';

/* ============================================================================
    El mapa de conexión de datos de un equipo de diagnóstico.

    Sigue la relación «Envía datos a» desde el término de la ficha hasta el
    último eslabón: Ecógrafo → Imagen DICOM → Archivo de imágenes (PACS/VNA)
    → Informe del estudio → Resultado del paciente. Cada eslabón es un término
    del glosario y enlaza a su ficha.

    La vista de red del glosario muestra los vecinos de a un salto; esta
    cadena es la lectura que hace falta para entender a dónde van los datos,
    así que se arma acá leyendo un término por vez (son pocos: la cadena más
    larga tiene seis eslabones). Un ciclo o una cadena demasiado larga cortan
    el recorrido en vez de colgarlo.

    Se usa en dos lugares: la ficha del término (le pasa `termino`, ya leído)
    y la pestaña «Equipos» del centro (le pasa `conceptoId`). El personal del
    centro no tiene la sección Glosario (es de quien atiende), así que ahí va
    con `enlazar` en falso: la cadena se lee sin ofrecer una puerta cerrada.
    ========================================================================== */

interface Eslabon {
  readonly conceptId: string;
  readonly display: string;
}

const MAXIMO_DE_ESLABONES = 8;

/** La pestaña «Equipos» puede abrir varios mapas a la vez: cada uno, su id. */
let siguienteId = 0;

const siguienteDe = (relaciones: readonly GlossaryRelation[]): GlossaryRelation | undefined =>
  relaciones.find((r) => r.type === 'SENDS_DATA_TO');

@Component({
  selector: 'app-glossary-data-flow',
  imports: [RouterLink],
  template: `
    @if (cadena().length > 1) {
      <section class="flujo" [attr.aria-labelledby]="tituloId" data-testid="glosario-mapa-de-datos">
        <h2 [id]="tituloId" class="flujo__titulo">Mapa de conexión de datos</h2>
        <p class="flujo__ayuda">El camino que recorren los datos desde el equipo hasta el resultado que ve el paciente.</p>
        <ol class="flujo__cadena">
          @for (e of cadena(); track e.conceptId; let primero = $first) {
            <li class="flujo__eslabon" [class.flujo__eslabon--origen]="primero">
              @if (primero || !enlazar()) {
                <span class="flujo__nombre">{{ e.display }}</span>
              } @else {
                <a class="flujo__nombre" [routerLink]="['/glossary', e.conceptId]">{{ e.display }}</a>
              }
            </li>
          }
        </ol>
      </section>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .flujo {
      display: grid;
      gap: var(--sp-3);
      padding: var(--sp-4);
      border: 1px solid var(--st-info-bd);
      border-radius: var(--r-md);
      background: var(--st-info-bg);
    }
    .flujo__titulo {
      margin: 0;
      font-size: var(--fs-h3);
      color: var(--text-primary);
    }
    .flujo__ayuda {
      margin: 0;
      color: var(--text-secondary);
    }
    .flujo__cadena {
      display: flex;
      flex-direction: column;
      gap: var(--sp-2);
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .flujo__eslabon {
      display: flex;
      gap: var(--sp-2);
      align-items: center;
    }
    .flujo__eslabon + .flujo__eslabon::before {
      content: '→';
      color: var(--text-secondary);
    }
    .flujo__nombre {
      padding: var(--sp-2) var(--sp-3);
      border: 1px solid var(--border-default);
      border-radius: var(--r-sm);
      background: var(--bg-surface);
      color: var(--text-primary);
    }
    a.flujo__nombre {
      color: var(--text-link);
    }
    .flujo__eslabon--origen .flujo__nombre {
      border-color: var(--brand-primary);
      font-weight: 600;
    }
    @media (min-width: 780px) {
      .flujo__cadena {
        flex-direction: row;
        flex-wrap: wrap;
        align-items: center;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GlossaryDataFlow {
  private readonly terminology = inject(TerminologyClient);

  /** El término de la ficha, ya leído: el primer eslabón. */
  readonly termino = input<GlossaryTermDetail | null>(null);
  /** O sólo su identificador, cuando quien lo usa no tiene la ficha. */
  readonly conceptoId = input<string | null>(null);
  /** Si cada eslabón enlaza a su ficha del glosario. */
  readonly enlazar = input(true);

  protected readonly cadena = signal<readonly Eslabon[]>([]);
  protected readonly tituloId = `flujo-titulo-${++siguienteId}`;

  constructor() {
    effect((onCleanup) => {
      const ficha = this.termino();
      const id = this.conceptoId();
      const inicio$: Observable<GlossaryTermDetail> | null =
        ficha !== null ? of(ficha) : id !== null ? this.terminology.readGlossaryTerm(id) : null;
      this.cadena.set([]);
      if (inicio$ === null) return;
      const sub = inicio$
        .pipe(
          switchMap((inicio) => {
            const primero: Eslabon = { conceptId: inicio.conceptId, display: inicio.display };
            const siguiente = siguienteDe(inicio.relations);
            if (siguiente === undefined) return of<readonly Eslabon[]>([]);
            return this.recorrer(inicio.conceptId, siguiente).pipe(map((resto) => [primero, ...resto]));
          }),
        )
        .subscribe({
          next: (cadena) => this.cadena.set(cadena),
          error: () => this.cadena.set([]),
        });
      onCleanup(() => sub.unsubscribe());
    });
  }

  /** Lee eslabón por eslabón hasta que no haya «Envía datos a», un ciclo o el tope. */
  private recorrer(origen: string, desde: GlossaryRelation): Observable<readonly Eslabon[]> {
    const vistos = new Set<string>([origen]);
    return this.terminology.readGlossaryTerm(desde.conceptId).pipe(
      expand((t, i) => {
        vistos.add(t.conceptId);
        const proximo = siguienteDe(t.relations);
        if (proximo === undefined || vistos.has(proximo.conceptId) || i + 2 >= MAXIMO_DE_ESLABONES) return EMPTY;
        return this.terminology.readGlossaryTerm(proximo.conceptId);
      }),
      map((t): Eslabon => ({ conceptId: t.conceptId, display: t.display })),
      reduce((acc: readonly Eslabon[], e) => [...acc, e], []),
    );
  }
}
