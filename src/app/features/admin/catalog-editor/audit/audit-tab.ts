import { ChangeDetectionStrategy, Component, computed, inject, signal, type OnInit } from '@angular/core';

import { AuditClient } from '../../../../core/data-access/audit/audit.client';
import type { AuditLogEntry } from '../../../../core/data-access/audit/audit.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { SegmentedControl } from '../../../../shared/components/molecules/segmented-control/segmented-control';
import { DataTable } from '../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../shared/components/organisms/data-table/data-table.types';
import { PaginadorDeCursor } from '../catalog-editor-pager';

type Catalogo = 'services' | 'glossary';

interface FilaAuditoria {
  readonly id: string;
  readonly when: string;
  readonly action: string;
  readonly record: string;
  readonly result: string;
  readonly actor: string;
}

/** Entidad que sella cada catálogo en `/audit/log` (contrato H3 §2 y §3) y el prefijo de sus acciones. */
const ENTIDAD: Readonly<Record<Catalogo, { readonly entity: string; readonly prefijo: string }>> = {
  services: { entity: 'service_catalog', prefijo: 'ADMIN_SERVICE_CATALOG_' },
  glossary: { entity: 'catalog_concept', prefijo: 'ADMIN_GLOSSARY_TERM_' },
};

const ACCIONES: Readonly<Record<string, string>> = {
  CREATED: 'Alta',
  UPDATED: 'Edición',
  DEACTIVATED: 'Desactivación',
  REACTIVATED: 'Reactivación',
};

const TAMANO_DE_PAGINA = 25;

/** «ADMIN_SERVICE_CATALOG_UPDATED» → «Edición»; lo que no se conoce se muestra con su código. */
export function rotuloDeAccion(accion: string): string {
  const sufijo = accion.slice(accion.lastIndexOf('_') + 1);
  return ACCIONES[sufijo] ?? accion;
}

/**
 * Pestaña «Auditoría»: quién cambió qué en estos catálogos y cuándo. Sólo
 * lectura sobre `/audit/log`. La API es la que registra; esta pestaña no
 * escribe ni deduce nada.
 */
@Component({
  selector: 'app-catalog-audit-tab',
  imports: [SegmentedControl, DataTable],
  templateUrl: './audit-tab.html',
  styleUrl: '../catalog-editor-tab.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditTab implements OnInit {
  private readonly audit = inject(AuditClient);
  protected readonly paginador = new PaginadorDeCursor();

  protected readonly catalogo = signal<Catalogo>('services');
  protected readonly lista = signal<ViewState<readonly FilaAuditoria[]>>(loading());
  protected readonly opciones = [
    { value: 'services' as const, label: 'Servicios' },
    { value: 'glossary' as const, label: 'Glosarios' },
  ];

  protected readonly columnas = computed<readonly ColumnDef<FilaAuditoria>[]>(() => [
    { key: 'when', header: 'Fecha', priority: 1 },
    { key: 'action', header: 'Acción', priority: 1 },
    { key: 'record', header: 'Registro', priority: 2 },
    { key: 'result', header: 'Resultado', priority: 2 },
    { key: 'actor', header: 'Quién', priority: 3 },
  ]);
  protected readonly porId = (fila: FilaAuditoria): string => fila.id;
  protected readonly nombreDeFila = (fila: FilaAuditoria): string => `${fila.action}, ${fila.when}`;

  ngOnInit(): void {
    this.recargar();
  }

  protected elegir(catalogo: Catalogo): void {
    this.catalogo.set(catalogo);
    this.recargar();
  }

  protected recargar(): void {
    this.paginador.reiniciar();
    this.cargar(undefined);
  }

  protected mover(cursor: string): void {
    this.cargar(this.paginador.mover(cursor));
  }

  private cargar(cursor: string | undefined): void {
    const { entity, prefijo } = ENTIDAD[this.catalogo()];
    this.lista.set(loading());
    this.audit
      .log({ entity, limit: TAMANO_DE_PAGINA, ...(cursor === undefined ? {} : { cursor }) })
      .subscribe({
        next: (pagina) => {
          this.paginador.recibir(pagina.nextCursor);
          // `catalog_concept` también lo sellan otros cambios de terminología: aquí sólo los del glosario.
          const filas = pagina.items.filter((e) => e.action.startsWith(prefijo)).map((e) => this.aFila(e));
          this.lista.set(
            filas.length === 0
              ? empty(
                  { label: 'Edite un registro en la pestaña del catálogo y volverá a aparecer acá.' },
                  'Todavía no hay cambios registrados en este catálogo.',
                )
              : ready(filas),
          );
        },
        error: (error: unknown) => this.lista.set(errorToViewState<readonly FilaAuditoria[]>(error)),
      });
  }

  private aFila(e: AuditLogEntry): FilaAuditoria {
    return {
      id: e.id,
      when: e.recordedAt.toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/La_Paz' }),
      action: rotuloDeAccion(e.action),
      record: e.entityId ?? '—',
      result: String(e.result),
      actor: e.userId,
    };
  }
}
