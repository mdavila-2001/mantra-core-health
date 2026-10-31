import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal, type OnInit } from '@angular/core';

import { CatalogEditorClient } from '../../../../core/data-access/admin-portal/catalog-editor.client';
import type {
  AdminGlossaryTerm,
  CreateGlossaryTermInput,
  GlossaryAudience,
  UpdateGlossaryTermInput,
} from '../../../../core/data-access/admin-portal/catalog-editor.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Input } from '../../../../shared/components/atoms/input/input';
import { Textarea } from '../../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ContentDialog } from '../../../../shared/components/organisms/content-dialog/content-dialog';
import { errorDeIdentificador, errorDeTexto, fallosDeCatalogo } from '../catalog-editor-support';

/** Qué texto se edita según la audiencia: lo dice la pantalla, no se deduce. */
export const TEXTO_POR_AUDIENCIA: Readonly<Record<GlossaryAudience, { readonly rotulo: string; readonly ayuda: string }>> = {
  patient: { rotulo: 'Resumen en lenguaje llano', ayuda: 'Lo que lee la persona atendida. Sin jerga.' },
  professional: { rotulo: 'Definición clínica', ayuda: 'Lo que lee el profesional de salud.' },
};

/**
 * Alta y edición de un término del glosario para una audiencia, en modal.
 *
 * El glosario no tiene organización: lo que se guarda llega a todas. Por eso
 * sólo la superadministración escribe (la API responde 403 a otro rol y este
 * modal lo dice sin perder lo escrito). Edición con `expectedRowVersion`.
 */
@Component({
  selector: 'app-glossary-dialog',
  imports: [AppButton, Input, Textarea, Alert, FormField, ContentDialog],
  templateUrl: './glossary-dialog.html',
  styleUrl: '../catalog-editor-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GlossaryDialog implements OnInit {
  private readonly client = inject(CatalogEditorClient);

  readonly audience = input.required<GlossaryAudience>();
  /** El término que se edita; `null` para un alta. */
  readonly termino = input<AdminGlossaryTerm | null>(null);

  readonly saved = output<AdminGlossaryTerm>();
  readonly closed = output<void>();
  readonly reloadRequested = output<void>();

  protected readonly slug = signal('');
  protected readonly display = signal('');
  protected readonly nameEs = signal('');
  protected readonly textEs = signal('');
  protected readonly textEn = signal('');

  protected readonly guardando = signal(false);
  protected readonly errores = signal<Readonly<Record<string, string>>>({});
  protected readonly aviso = signal<string | null>(null);
  protected readonly conflicto = signal(false);

  protected readonly editando = computed(() => this.termino() !== null);
  protected readonly etiquetaTexto = computed(() => TEXTO_POR_AUDIENCIA[this.audience()]);
  protected readonly titulo = computed(() => {
    const t = this.termino();
    return t === null ? 'Nuevo término' : `Editar «${t.display}»`;
  });

  ngOnInit(): void {
    const t = this.termino();
    if (t === null) return;
    this.slug.set(t.slug);
    this.display.set(t.display);
    this.nameEs.set(t.nameEs);
    this.textEs.set(t.text?.es ?? '');
    this.textEn.set(t.text?.en ?? '');
  }

  protected guardar(): void {
    if (this.guardando()) return;
    const errores = this.validarLocal();
    this.errores.set(errores);
    this.conflicto.set(false);
    if (Object.keys(errores).length > 0) {
      this.aviso.set('Revise los campos marcados.');
      return;
    }
    const previo = this.termino();
    const peticion = previo === null ? this.alta() : this.cambios(previo);
    if (peticion === null) {
      this.aviso.set('No hay cambios para guardar.');
      return;
    }
    this.aviso.set(null);
    this.guardando.set(true);
    peticion.subscribe({
      next: (guardado) => {
        this.guardando.set(false);
        this.saved.emit(guardado);
      },
      error: (error: unknown) => {
        const fallo = fallosDeCatalogo(error, previo === null ? 'No se pudo crear el término.' : 'No se pudo guardar el término.');
        this.guardando.set(false);
        this.errores.set(fallo.campos);
        this.conflicto.set(fallo.conflictoDeVersion);
        this.aviso.set(fallo.general);
      },
    });
  }

  private validarLocal(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!this.editando()) {
      const s = errorDeIdentificador(this.slug());
      if (s !== null) e['slug'] = s;
      const d = errorDeTexto(this.display(), 'el término', 200);
      if (d !== null) e['display'] = d;
    }
    const n = errorDeTexto(this.nameEs(), 'el nombre en español', 200);
    if (n !== null) e['nameEs'] = n;
    const t = errorDeTexto(this.textEs(), 'el texto', 4000);
    if (t !== null) e['text'] = t;
    return e;
  }

  private texto() {
    const en = this.textEn().trim();
    return { es: this.textEs().trim(), ...(en === '' ? {} : { en }) };
  }

  private alta() {
    const entrada: CreateGlossaryTermInput = {
      slug: this.slug().trim(),
      display: this.display().trim(),
      nameEs: this.nameEs().trim(),
      audience: this.audience(),
      text: this.texto(),
    };
    return this.client.createGlossaryTerm(entrada);
  }

  private cambios(previo: AdminGlossaryTerm) {
    const texto = this.texto();
    const textoCambio = texto.es !== (previo.text?.es ?? '') || (texto.en ?? '') !== (previo.text?.en ?? '');
    const cambios: UpdateGlossaryTermInput = {
      expectedRowVersion: previo.rowVersion,
      audience: this.audience(),
      ...(this.nameEs().trim() === previo.nameEs ? {} : { nameEs: this.nameEs().trim() }),
      ...(textoCambio ? { text: texto } : {}),
    };
    return Object.keys(cambios).length === 2 ? null : this.client.updateGlossaryTerm(previo.conceptId, cambios);
  }
}
