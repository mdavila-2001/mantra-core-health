import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild, type OnInit, type TemplateRef } from '@angular/core';

import { CatalogEditorClient } from '../../../../core/data-access/admin-portal/catalog-editor.client';
import type { AdminGlossaryTerm, GlossaryAudience, GlossaryState } from '../../../../core/data-access/admin-portal/catalog-editor.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { RowActions } from '../../../../shared/components/molecules/row-actions/row-actions';
import type { RowAction } from '../../../../shared/components/molecules/row-actions/row-actions.types';
import { SearchField } from '../../../../shared/components/molecules/search-field/search-field';
import { SegmentedControl } from '../../../../shared/components/molecules/segmented-control/segmented-control';
import { DataTable } from '../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../shared/components/organisms/data-table/data-table.types';
import { PaginadorDeCursor } from '../catalog-editor-pager';
import { fallosDeCatalogo, fechaCorta } from '../catalog-editor-support';
import { GlossaryDialog, TEXTO_POR_AUDIENCIA } from './glossary-dialog';

type FiltroEstado = 'todos' | GlossaryState;

interface FilaTermino {
  readonly id: string;
  readonly item: AdminGlossaryTerm;
  readonly slug: string;
  readonly display: string;
  readonly text: string;
  readonly status: string;
  readonly version: string;
  readonly updated: string;
}

const TAMANO_DE_PAGINA = 20;

/**
 * Pestaña «Glosarios»: los términos que explica la app, con un texto distinto
 * según quién lee (la persona atendida o el profesional). Lo que se guarda llega
 * a todas las organizaciones, por eso la API reserva la escritura a la
 * superadministración: un 403 se explica, no se oculta.
 */
@Component({
  selector: 'app-catalog-glossary-tab',
  imports: [AppButton, Badge, Alert, RowActions, SearchField, SegmentedControl, DataTable, GlossaryDialog],
  templateUrl: './glossary-tab.html',
  styleUrl: '../catalog-editor-tab.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GlossaryTab implements OnInit {
  private readonly client = inject(CatalogEditorClient);
  protected readonly paginador = new PaginadorDeCursor();

  protected readonly audiencia = signal<GlossaryAudience>('patient');
  protected readonly filtroEstado = signal<FiltroEstado>('todos');
  protected readonly busqueda = signal('');
  protected readonly lista = signal<ViewState<readonly FilaTermino[]>>(loading());
  protected readonly dialogo = signal<{ readonly termino: AdminGlossaryTerm | null } | null>(null);
  protected readonly enCurso = signal<string | null>(null);
  protected readonly aviso = signal<{ readonly tono: 'success' | 'error' | 'warning'; readonly texto: string } | null>(null);

  protected readonly opcionesAudiencia = [
    { value: 'patient' as const, label: 'Pacientes · lenguaje llano' },
    { value: 'professional' as const, label: 'Profesionales · definición clínica' },
  ];
  protected readonly opcionesEstado = [
    { value: 'todos' as const, label: 'Todos' },
    { value: 'active' as const, label: 'Vigentes' },
    { value: 'retired' as const, label: 'Retirados' },
  ];
  protected readonly textoDeAudiencia = computed(() => TEXTO_POR_AUDIENCIA[this.audiencia()]);

  private readonly celdaEstado = viewChild.required<TemplateRef<{ $implicit: FilaTermino }>>('celdaEstado');
  private readonly celdaAcciones = viewChild.required<TemplateRef<{ $implicit: FilaTermino }>>('celdaAcciones');

  protected readonly columnas = computed<readonly ColumnDef<FilaTermino>[]>(() => [
    { key: 'slug', header: 'Identificador', priority: 1 },
    { key: 'display', header: 'Término', priority: 1 },
    { key: 'text', header: this.textoDeAudiencia().rotulo, priority: 2 },
    { key: 'status', header: 'Estado', priority: 1, cell: this.celdaEstado() },
    { key: 'version', header: 'Versión', priority: 3, align: 'end' },
    { key: 'updated', header: 'Actualizado', priority: 3 },
    { key: 'acciones', header: 'Acciones', priority: 1, accion: true, sticky: 'end', cell: this.celdaAcciones() },
  ]);
  protected readonly porId = (fila: FilaTermino): string => fila.id;
  protected readonly nombreDeFila = (fila: FilaTermino): string => `${fila.slug}, ${fila.display}`;

  ngOnInit(): void {
    this.recargar();
  }

  protected elegirAudiencia(audiencia: GlossaryAudience): void {
    this.audiencia.set(audiencia);
    this.recargar();
  }

  protected elegirEstado(estado: FiltroEstado): void {
    this.filtroEstado.set(estado);
    this.recargar();
  }

  protected buscar(texto: string): void {
    this.busqueda.set(texto);
    this.recargar();
  }

  protected recargar(): void {
    this.paginador.reiniciar();
    this.cargar(undefined);
  }

  protected mover(cursor: string): void {
    this.cargar(this.paginador.mover(cursor));
  }

  protected cargar(cursor: string | undefined): void {
    const estado = this.filtroEstado();
    this.lista.set(loading());
    this.client
      .listGlossary({
        audience: this.audiencia(),
        ...(estado === 'todos' ? {} : { state: estado }),
        q: this.busqueda().trim(),
        limit: TAMANO_DE_PAGINA,
        ...(cursor === undefined ? {} : { cursor }),
      })
      .subscribe({
        next: (pagina) => {
          this.paginador.recibir(pagina.nextCursor);
          this.lista.set(
            pagina.items.length === 0
              ? empty(
                  { label: 'Use «Nuevo término» para cargar el primero, o cambie el filtro.' },
                  'No hay términos con estos filtros.',
                )
              : ready(pagina.items.map((t) => this.aFila(t))),
          );
        },
        error: (error: unknown) => this.lista.set(errorToViewState<readonly FilaTermino[]>(error)),
      });
  }

  protected accionesDe(fila: FilaTermino): readonly RowAction[] {
    const ocupado = this.enCurso() !== null;
    return [
      { code: 'edit', label: 'Editar', icon: 'edit', disabled: ocupado },
      fila.item.state === 'active'
        ? { code: 'deactivate', label: 'Retirar', icon: 'eye-off', disabled: ocupado }
        : { code: 'reactivate', label: 'Reactivar', icon: 'refresh', disabled: ocupado },
    ];
  }

  protected ejecutar(fila: FilaTermino, accion: string): void {
    if (accion === 'edit') {
      this.dialogo.set({ termino: fila.item });
      return;
    }
    if (this.enCurso() !== null) return;
    this.enCurso.set(fila.id);
    this.aviso.set(null);
    const cuerpo = { expectedRowVersion: fila.item.rowVersion, audience: this.audiencia() };
    const peticion =
      accion === 'deactivate'
        ? this.client.deactivateGlossaryTerm(fila.id, cuerpo)
        : this.client.reactivateGlossaryTerm(fila.id, cuerpo);
    peticion.subscribe({
      next: (termino) => {
        this.enCurso.set(null);
        this.aviso.set({
          tono: 'success',
          texto: `«${termino.display}» ${termino.state === 'active' ? 'volvió a estar vigente' : 'quedó retirado'} (versión ${termino.rowVersion}).`,
        });
        this.cargar(this.paginador.actual());
      },
      error: (error: unknown) => {
        const fallo = fallosDeCatalogo(error, 'No se pudo cambiar el estado del término.');
        this.enCurso.set(null);
        this.aviso.set({ tono: fallo.conflictoDeVersion ? 'warning' : 'error', texto: fallo.general ?? 'No se pudo cambiar el estado.' });
        if (fallo.conflictoDeVersion) this.cargar(this.paginador.actual());
      },
    });
  }

  protected abrirAlta(): void {
    this.dialogo.set({ termino: null });
  }

  protected cerrarDialogo(): void {
    this.dialogo.set(null);
  }

  protected guardado(termino: AdminGlossaryTerm): void {
    const alta = this.dialogo()?.termino === null;
    this.dialogo.set(null);
    this.aviso.set({
      tono: 'success',
      texto: alta ? `«${termino.display}» quedó creado.` : `«${termino.display}» quedó guardado (versión ${termino.rowVersion}).`,
    });
    this.cargar(alta ? undefined : this.paginador.actual());
  }

  protected recargarTras409(): void {
    this.dialogo.set(null);
    this.cargar(this.paginador.actual());
  }

  private aFila(t: AdminGlossaryTerm): FilaTermino {
    return {
      id: t.conceptId,
      item: t,
      slug: t.slug,
      display: t.display,
      text: t.text?.es ?? 'Sin texto para esta audiencia todavía',
      status: t.state === 'active' ? 'Vigente' : 'Retirado',
      version: String(t.rowVersion),
      updated: fechaCorta(t.updatedAt),
    };
  }
}
