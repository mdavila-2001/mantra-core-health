import { ChangeDetectionStrategy, Component, computed, inject, signal, type OnInit } from '@angular/core';

import { SupportAccessClient } from '../../../core/data-access/support-access/support-access.client';
import {
  REPLY_TEMPLATE_CATEGORIES,
  REPLY_TEMPLATE_CATEGORY_LABELS,
  type ReplyTemplate,
  type ReplyTemplateCategory,
} from '../../../core/data-access/support-access/support-inbox.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { ContentDialog } from '../../../shared/components/organisms/content-dialog/content-dialog';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { replyTemplateFailureOf, type ReplyTemplateFailure } from './reply-template-failure';

const MAX_TITULO = 120;
const MAX_TEXTO = 2000;

const CATEGORIAS: readonly SelectOption<ReplyTemplateCategory>[] = REPLY_TEMPLATE_CATEGORIES.map((value) => ({ value, label: REPLY_TEMPLATE_CATEGORY_LABELS[value] }));

/** Lo que se está escribiendo en el diálogo: una respuesta nueva (`id` ausente) o la edición de una. */
interface Borrador {
  readonly id?: string;
  readonly category: ReplyTemplateCategory;
  readonly title: string;
  readonly bodyText: string;
  /** La versión que se vio al abrir: se manda como `expectedVersion`. */
  readonly version?: number;
}

/**
 * **Respuestas preparadas**: los textos que el personal de apoyo usa al responder
 * mensajes administrativos de los pacientes en nombre del doctor.
 *
 * Simple a propósito: listar, crear, editar, retirar y reactivar. Tres reglas que la
 * pantalla dice a la vista:
 *
 * - **Nada clínico.** Son respuestas administrativas (horarios, certificados, costos);
 *   un diagnóstico o un resultado no va acá. La API lo rechaza si el texto lo parece.
 * - **Se completan solas.** `{paciente}` y `{doctor}` se reemplazan al usarla.
 * - **No se pisa a nadie.** Al editar se manda la versión que se vio (`expectedVersion`):
 *   si otra persona la cambió antes, la API responde 409 y acá se explica y se ofrece
 *   cargar la versión de hoy, en vez de borrar su cambio en silencio.
 *
 * Retirar una respuesta no la borra: deja de ofrecerse a quien responde y se puede reactivar.
 */
@Component({
  selector: 'app-reply-templates',
  imports: [Alert, AppButton, Badge, Card, ContentDialog, FormField, Input, PageHeader, Select, Textarea, ViewStateHost],
  templateUrl: './reply-templates.html',
  styleUrl: './reply-templates.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReplyTemplates implements OnInit {
  private readonly client = inject(SupportAccessClient);
  private readonly toasts = inject(ToastService);

  protected readonly categorias = CATEGORIAS;
  protected readonly maxTitulo = MAX_TITULO;
  protected readonly maxTexto = MAX_TEXTO;
  protected readonly etiquetaDeCategoria = (c: ReplyTemplateCategory): string => REPLY_TEMPLATE_CATEGORY_LABELS[c];

  protected readonly state = signal<ViewState<readonly ReplyTemplate[]>>(loading());
  protected readonly borrador = signal<Borrador | null>(null);
  protected readonly intento = signal(false);
  protected readonly guardando = signal(false);
  protected readonly fallo = signal<ReplyTemplateFailure | null>(null);
  /** Quién está cambiando de estado (retirar o reactivar) ahora. */
  protected readonly ocupada = signal<string | null>(null);

  protected readonly respuestas = computed<readonly ReplyTemplate[]>(() => {
    const s = this.state();
    return s.status === 'ready' ? s.data : [];
  });

  protected readonly faltaTitulo = computed(() => this.intento() && (this.borrador()?.title.trim() ?? '') === '');
  protected readonly faltaTexto = computed(() => this.intento() && (this.borrador()?.bodyText.trim() ?? '') === '');
  protected readonly esEdicion = computed(() => this.borrador()?.id !== undefined);

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    this.state.set(loading());
    this.client.listOrgReplyTemplates().subscribe({
      next: ({ items }) =>
        this.state.set(items.length === 0 ? empty({ label: 'Cree la primera respuesta con «Nueva respuesta»' }, 'Todavía no hay respuestas preparadas.') : ready(items)),
      error: (failure: unknown) => this.state.set(errorToViewState<readonly ReplyTemplate[]>(failure)),
    });
  }

  /* ---- el diálogo ----------------------------------------------------------- */

  protected nueva(): void {
    this.abrir({ category: 'GENERAL', title: '', bodyText: '' });
  }

  protected editar(r: ReplyTemplate): void {
    this.abrir({ id: r.id, category: r.category, title: r.title, bodyText: r.bodyText, ...(r.version === undefined ? {} : { version: r.version }) });
  }

  private abrir(b: Borrador): void {
    this.fallo.set(null);
    this.intento.set(false);
    this.borrador.set(b);
  }

  protected cerrar(): void {
    this.borrador.set(null);
    this.fallo.set(null);
  }

  private cambiar(cambios: Partial<Borrador>): void {
    this.borrador.update((b) => (b === null ? b : { ...b, ...cambios }));
  }

  protected cambiarCategoria(valor: ReplyTemplateCategory | null): void {
    if (valor !== null) this.cambiar({ category: valor });
  }
  protected cambiarTitulo(valor: string | number | null): void {
    this.cambiar({ title: `${valor ?? ''}` });
  }
  protected cambiarTexto(valor: string): void {
    this.cambiar({ bodyText: valor });
  }

  /** Tras un 409: se deja la versión que la API tiene hoy, con su texto, para volver a editar sobre ella. */
  protected cargarVersionActual(): void {
    const b = this.borrador();
    if (b?.id === undefined) return;
    this.client.listOrgReplyTemplates().subscribe({
      next: ({ items }) => {
        const actual = items.find((r) => r.id === b.id);
        if (actual === undefined) {
          this.fallo.set({ kind: 'NOT_FOUND', message: 'Esa respuesta ya no existe. Vuelva a leer la lista.' });
          return;
        }
        this.state.set(ready(items));
        this.abrir({ id: actual.id, category: actual.category, title: actual.title, bodyText: actual.bodyText, ...(actual.version === undefined ? {} : { version: actual.version }) });
      },
      error: () => this.fallo.set({ kind: 'OTHER', message: 'No pudimos leer la versión actual. Vuelva a intentarlo.' }),
    });
  }

  /* ---- guardar --------------------------------------------------------------- */

  protected guardar(): void {
    this.intento.set(true);
    const b = this.borrador();
    if (b === null || this.guardando()) return;
    const title = b.title.trim();
    const bodyText = b.bodyText.trim();
    if (title === '' || bodyText === '' || title.length > MAX_TITULO || bodyText.length > MAX_TEXTO) return;
    this.guardando.set(true);
    this.fallo.set(null);
    const peticion =
      b.id === undefined
        ? this.client.createReplyTemplate({ category: b.category, title, bodyText })
        : this.client.updateReplyTemplate(b.id, { category: b.category, title, bodyText, ...(b.version === undefined ? {} : { expectedVersion: b.version }) });
    peticion.subscribe({
      next: () => {
        this.guardando.set(false);
        this.toasts.success(b.id === undefined ? 'Creamos la respuesta.' : 'Guardamos la respuesta.');
        this.borrador.set(null);
        this.cargar();
      },
      error: (failure: unknown) => {
        this.guardando.set(false);
        this.fallo.set(replyTemplateFailureOf(failure));
      },
    });
  }

  /** Retirarla o reactivarla. También manda la versión que se vio. */
  protected cambiarEstado(r: ReplyTemplate): void {
    if (this.ocupada() !== null) return;
    const retirar = r.retired !== true;
    this.ocupada.set(r.id);
    this.client.updateReplyTemplate(r.id, { retired: retirar, ...(r.version === undefined ? {} : { expectedVersion: r.version }) }).subscribe({
      next: () => {
        this.ocupada.set(null);
        this.toasts.success(retirar ? 'Retiramos la respuesta: ya no se ofrece al responder.' : 'Reactivamos la respuesta.');
        this.cargar();
      },
      error: (failure: unknown) => {
        this.ocupada.set(null);
        const f = replyTemplateFailureOf(failure);
        this.toasts.error(f.kind === 'STALE' ? 'Otra persona cambió esta respuesta: se volvió a leer la lista.' : f.message);
        this.cargar();
      },
    });
  }
}
