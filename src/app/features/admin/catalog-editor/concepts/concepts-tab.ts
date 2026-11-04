import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild, type OnInit, type TemplateRef } from '@angular/core';
import { expand, map, reduce } from 'rxjs';
import { EMPTY } from 'rxjs';

import { ConceptAdminClient, type ConceptWithProperties } from '../../../../core/data-access/terminology/concept-admin.client';
import { TerminologyClient } from '../../../../core/data-access/terminology/terminology.client';
import type { GlossaryTag } from '../../../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { RowActions } from '../../../../shared/components/molecules/row-actions/row-actions';
import type { RowAction } from '../../../../shared/components/molecules/row-actions/row-actions.types';
import { Select } from '../../../../shared/components/atoms/select/select';
import { DataTable } from '../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../shared/components/organisms/data-table/data-table.types';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import {
  IMAGE_PROPERTY,
  SPECIALTY_VALUE_SET,
  defaultSpecialtyImage,
  safeImageValue,
} from '../../../../shared/specialties/specialty-images';
import { ConceptImageDialog } from './concept-image-dialog';

/**
 * Pestaña «Conceptos»: los miembros de un catálogo de terminología (por defecto
 * las especialidades médicas) con su imagen. Se cambia la imagen o se retira el
 * concepto (reversible por la API: se excluye de las expansiones, no se borra).
 * Escribe sólo `SECURITY_ADMIN`; la API responde 403 a otro rol.
 */
@Component({
  selector: 'app-catalog-concepts-tab',
  imports: [Alert, RowActions, Select, DataTable, ViewStateHost, ConceptImageDialog],
  templateUrl: './concepts-tab.html',
  styleUrl: '../catalog-editor-tab.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConceptsTab implements OnInit {
  private readonly terminology = inject(TerminologyClient);
  private readonly admin = inject(ConceptAdminClient);

  protected readonly catalogos = signal<ViewState<readonly GlossaryTag[]>>(loading());
  protected readonly catalogo = signal<string | null>(null);
  protected readonly lista = signal<ViewState<readonly ConceptWithProperties[]>>(loading());
  protected readonly dialogo = signal<ConceptWithProperties | null>(null);
  protected readonly aviso = signal<{ readonly tono: 'success' | 'error'; readonly texto: string } | null>(null);

  protected readonly opciones = computed(() => {
    const estado = this.catalogos();
    return estado.status === 'ready' ? estado.data.map((c) => ({ value: c.id, label: `${c.name} (${c.internalCode})` })) : [];
  });

  private readonly celdaImagen = viewChild.required<TemplateRef<{ $implicit: ConceptWithProperties }>>('celdaImagen');
  private readonly celdaAcciones = viewChild.required<TemplateRef<{ $implicit: ConceptWithProperties }>>('celdaAcciones');

  protected readonly columnas = computed<readonly ColumnDef<ConceptWithProperties>[]>(() => [
    { key: 'imagen', header: 'Imagen', priority: 1, cell: this.celdaImagen() },
    { key: 'display', header: 'Denominación', priority: 1 },
    { key: 'code', header: 'Código', priority: 2 },
    { key: 'acciones', header: 'Acciones', priority: 1, accion: true, sticky: 'end', cell: this.celdaAcciones() },
  ]);
  protected readonly porId = (c: ConceptWithProperties): string => c.conceptId;
  protected readonly nombreDeFila = (c: ConceptWithProperties): string => c.display;
  protected readonly acciones: readonly RowAction[] = [
    { code: 'image', label: 'Cambiar imagen', icon: 'edit' },
    { code: 'retire', label: 'Retirar del catálogo', icon: 'eye-off' },
  ];

  protected imagenDe(c: ConceptWithProperties): string {
    return safeImageValue(c.properties?.[IMAGE_PROPERTY]) ?? defaultSpecialtyImage(c.display);
  }

  ngOnInit(): void {
    this.terminology.listValueSets({ limit: 100 }).subscribe({
      next: (pagina) => {
        const items = pagina.items.filter((c) => c.internalCode.startsWith('VS_'));
        const inicial = items.find((c) => c.internalCode === SPECIALTY_VALUE_SET) ?? items[0];
        this.catalogos.set(items.length === 0 ? empty({ label: 'Importe un catálogo de terminología.' }, 'No hay catálogos.') : ready(items));
        if (inicial !== undefined) this.elegir(inicial.id);
      },
      error: (e: unknown) => this.catalogos.set(errorToViewState<readonly GlossaryTag[]>(e)),
    });
  }

  protected elegir(id: string | null): void {
    if (id === null) return;
    this.catalogo.set(id);
    this.recargar();
  }

  protected recargar(): void {
    const id = this.catalogo();
    if (id === null) return;
    this.lista.set(loading());
    this.admin
      .readExpansion(id)
      .pipe(
        expand((p) => (p.nextCursor === null ? EMPTY : this.admin.readExpansion(id, p.nextCursor))),
        map((p) => p.items),
        reduce((todas, items) => [...todas, ...items], [] as readonly ConceptWithProperties[]),
      )
      .subscribe({
        next: (items) => this.lista.set(items.length === 0 ? empty({ label: 'Elija otro catálogo.' }, 'Este catálogo no tiene conceptos vigentes.') : ready(items)),
        error: (e: unknown) => this.lista.set(errorToViewState<readonly ConceptWithProperties[]>(e)),
      });
  }

  protected ejecutar(c: ConceptWithProperties, accion: string): void {
    if (accion === 'image') {
      this.dialogo.set(c);
      return;
    }
    this.aviso.set(null);
    this.admin.deprecate(c.conceptId).subscribe({
      next: () => {
        this.aviso.set({ tono: 'success', texto: `«${c.display}» quedó retirado del catálogo.` });
        this.recargar();
      },
      error: () => this.aviso.set({ tono: 'error', texto: `No se pudo retirar «${c.display}». Requiere permiso de administración de seguridad.` }),
    });
  }

  protected guardada(): void {
    const c = this.dialogo();
    this.dialogo.set(null);
    this.aviso.set({ tono: 'success', texto: `La imagen de «${c?.display ?? ''}» quedó guardada.` });
    this.recargar();
  }
}
