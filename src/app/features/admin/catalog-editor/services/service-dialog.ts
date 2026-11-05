import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal, type OnInit } from '@angular/core';

import { CatalogEditorClient } from '../../../../core/data-access/admin-portal/catalog-editor.client';
import type {
  AdminServiceItem,
  CreateServiceInput,
  ServiceScopes,
  UpdateServiceInput,
} from '../../../../core/data-access/admin-portal/catalog-editor.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Input } from '../../../../shared/components/atoms/input/input';
import { Select } from '../../../../shared/components/atoms/select/select';
import { Switch } from '../../../../shared/components/atoms/switch/switch';
import { Textarea } from '../../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ContentDialog } from '../../../../shared/components/organisms/content-dialog/content-dialog';
import { errorDePrecio, errorDeTexto, fallosDeCatalogo } from '../catalog-editor-support';

/**
 * Alta y edición de un servicio del catálogo, en modal (`composition-rules` §6:
 * una acción que pide escribir no se despliega dentro de la fila).
 *
 * - Edición: manda `expectedRowVersion` (la versión que se leyó). Si otra
 *   persona lo cambió, el 409 deja lo escrito donde está y ofrece recargar.
 * - `code` y la práctica no se editan: son la identidad del servicio.
 * - Sólo viajan los campos que cambiaron; sin cambios no se envía nada.
 * - Mientras guarda, el botón queda bloqueado y el modal no se descarta.
 */
@Component({
  selector: 'app-service-dialog',
  imports: [AppButton, Input, Select, Switch, Textarea, Alert, FormField, ContentDialog],
  templateUrl: './service-dialog.html',
  styleUrl: '../catalog-editor-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceDialog implements OnInit {
  private readonly client = inject(CatalogEditorClient);

  readonly scopes = input.required<ServiceScopes>();
  /** El servicio que se edita; `null` para un alta. */
  readonly servicio = input<AdminServiceItem | null>(null);
  /** Tipo elegido en la lista: preselecciona la práctica del alta. */
  readonly tipoInicial = input<string | null>(null);

  readonly saved = output<AdminServiceItem>();
  readonly closed = output<void>();
  readonly reloadRequested = output<void>();

  protected readonly practiceId = signal('');
  protected readonly code = signal('');
  protected readonly name = signal('');
  protected readonly defaultPrice = signal('');
  protected readonly currencyConceptId = signal('');
  protected readonly descriptionText = signal('');
  protected readonly termsText = signal('');
  protected readonly isActive = signal(true);

  protected readonly guardando = signal(false);
  protected readonly errores = signal<Readonly<Record<string, string>>>({});
  protected readonly aviso = signal<string | null>(null);
  protected readonly conflicto = signal(false);

  protected readonly editando = computed(() => this.servicio() !== null);
  protected readonly titulo = computed(() => {
    const s = this.servicio();
    return s === null ? 'Nuevo servicio' : `Editar «${s.name}»`;
  });

  protected readonly opcionesPractica = computed(() =>
    this.scopes().practices.map((p) => ({ value: p.id, label: p.name })),
  );
  protected readonly opcionesMoneda = computed(() =>
    this.scopes().currencies.map((m) => ({ value: m.conceptId, label: m.code })),
  );

  ngOnInit(): void {
    const s = this.servicio();
    if (s === null) {
      const delTipo = this.scopes().practices.find((p) => p.typeConceptId === this.tipoInicial());
      this.practiceId.set(delTipo?.id ?? '');
      this.currencyConceptId.set(this.scopes().currencies[0]?.conceptId ?? '');
      return;
    }
    this.practiceId.set(s.practiceId);
    this.code.set(s.code);
    this.name.set(s.name);
    this.defaultPrice.set(s.defaultPrice);
    this.currencyConceptId.set(s.currencyConceptId ?? this.scopes().currencies[0]?.conceptId ?? '');
    this.descriptionText.set(s.descriptionText ?? '');
    this.termsText.set(s.termsText ?? '');
    this.isActive.set(s.isActive);
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
    const previo = this.servicio();
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
        const fallo = fallosDeCatalogo(error, previo === null ? 'No se pudo crear el servicio.' : 'No se pudo guardar el servicio.');
        this.guardando.set(false);
        this.errores.set(fallo.campos);
        this.conflicto.set(fallo.conflictoDeVersion);
        this.aviso.set(fallo.general);
      },
    });
  }

  private validarLocal(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!this.editando() && this.practiceId() === '') e['practiceId'] = 'Elija la práctica dueña del servicio.';
    if (!this.editando()) {
      const c = errorDeTexto(this.code(), 'el código', 120);
      if (c !== null) e['code'] = c;
    }
    const n = errorDeTexto(this.name(), 'el nombre', 200);
    if (n !== null) e['name'] = n;
    const p = errorDePrecio(this.defaultPrice());
    if (p !== null) e['defaultPrice'] = p;
    if (this.descriptionText().length > 2000) e['descriptionText'] = 'Use 2000 caracteres como máximo.';
    return e;
  }

  private alta() {
    const entrada: CreateServiceInput = {
      practiceId: this.practiceId(),
      code: this.code().trim(),
      name: this.name().trim(),
      defaultPrice: this.defaultPrice().trim(),
      isActive: this.isActive(),
      ...(this.descriptionText().trim() === '' ? {} : { descriptionText: this.descriptionText().trim() }),
      ...(this.currencyConceptId() === '' ? {} : { currencyConceptId: this.currencyConceptId() }),
    };
    return this.client.createService(entrada);
  }

  private cambios(previo: AdminServiceItem) {
    const textoNuevo = (actual: string, antes: string | null | undefined): string | null | undefined => {
      const a = actual.trim();
      const b = antes ?? '';
      return a === b ? undefined : a === '' ? null : a;
    };
    const descripcion = textoNuevo(this.descriptionText(), previo.descriptionText);
    const condiciones = textoNuevo(this.termsText(), previo.termsText);
    const precioCambio = this.defaultPrice().trim() !== previo.defaultPrice;
    const monedaCambio = this.currencyConceptId() !== (previo.currencyConceptId ?? '');
    const cambios: UpdateServiceInput = {
      expectedRowVersion: previo.rowVersion,
      ...(this.name().trim() === previo.name ? {} : { name: this.name().trim() }),
      ...(descripcion === undefined ? {} : { descriptionText: descripcion }),
      ...(condiciones === undefined ? {} : { termsText: condiciones }),
      // La moneda sólo viaja con el precio (contrato §2).
      ...(precioCambio || monedaCambio
        ? { defaultPrice: this.defaultPrice().trim(), ...(this.currencyConceptId() === '' ? {} : { currencyConceptId: this.currencyConceptId() }) }
        : {}),
    };
    return Object.keys(cambios).length === 1 ? null : this.client.updateService(previo.id, cambios);
  }
}
