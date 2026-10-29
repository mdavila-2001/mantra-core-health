import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { startWith } from 'rxjs';

import { InfrastructureClient } from '../../../../../core/data-access/infrastructure/infrastructure.client';
import { infrastructureErrorToViewState } from '../../../../../core/data-access/infrastructure/infrastructure.errors';
import {
  allowedChildForms,
  expandPattern,
  functionsFor,
  MAX_ALTA_MASIVA,
} from '../../../../../core/data-access/infrastructure/infrastructure.logic';
import type {
  BulkCreateRequest,
  CareSpaceDetail,
  CareSpaceNode,
  InfrastructureCatalog,
  SiteSummary,
} from '../../../../../core/data-access/infrastructure/infrastructure.types';
import { validation } from '../../../../../core/view-state/view-state';
import type { ViewState } from '../../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { Badge } from '../../../../../shared/components/atoms/badge/badge';
import type { SelectOption } from '../../../../../shared/components/atoms/select/select.types';
import { ContentDialog } from '../../../../../shared/components/organisms/content-dialog/content-dialog';
import { PaginatedForm } from '../../../../../shared/components/organisms/paginated-form/paginated-form';
import type { PaginaDeFormulario } from '../../../../../shared/forms/paginated/paginated-form.types';
import { InfraIssueAlert } from '../issue-alert';

const SIN_DEFINIR: SelectOption<string> = { value: '', label: 'Sin definir' };

/**
 * **Alta masiva por patrón** — «Cama 301-A…H» en un solo paso, con vista previa.
 *
 * Primero se completa el patrón (`301-{A..H}`, `CAMA-{1..12}`) y los atributos
 * comunes; luego se **ve la lista exacta** de códigos y nombres que se van a
 * crear, con una marca en los que ya existen en el establecimiento. Recién
 * entonces «Crear» manda `POST …/care-spaces/bulk`, que es todo o nada: si un
 * código choca, la API no crea ninguno y la vista previa sigue ahí para
 * corregir. El tope es de 200 (INV-17).
 *
 * La vista previa la arma `expandPattern`, la misma función que usa el
 * simulador; la API real expande por su cuenta y manda: si discrepara, lo que
 * vuelve en `created` es lo que vale.
 */
@Component({
  selector: 'app-bulk-create-dialog',
  imports: [AppButton, Badge, ContentDialog, InfraIssueAlert, PaginatedForm],
  templateUrl: './bulk-create-dialog.html',
  styleUrl: './bulk-create-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BulkCreateDialog implements OnInit {
  readonly site = input.required<SiteSummary>();
  readonly catalog = input.required<InfrastructureCatalog>();
  readonly parent = input.required<CareSpaceNode>();
  /** Códigos ya usados en el establecimiento (incluidos los clausurados). */
  readonly takenCodes = input<ReadonlySet<string>>(new Set());

  readonly created = output<readonly CareSpaceDetail[]>();
  readonly closed = output<void>();

  private readonly client = inject(InfrastructureClient);

  protected readonly fase = signal<'datos' | 'vista-previa'>('datos');
  protected readonly pending = signal(false);
  protected readonly serverState = signal<ViewState<unknown> | null>(null);

  protected readonly form = new FormGroup({
    formCode: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    functionCode: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    codePattern: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    namePattern: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    bedCategoryCode: new FormControl('', { nonNullable: true }),
    censable: new FormControl(true, { nonNullable: true }),
    sexRestrictionCode: new FormControl('', { nonNullable: true }),
    ageGroupCode: new FormControl('', { nonNullable: true }),
    areaM2: new FormControl<number | null>(null, { validators: [Validators.min(0.1)] }),
    capacity: new FormControl<number | null>(null, { validators: [Validators.min(0)] }),
  });

  private readonly valores = toSignal(this.form.valueChanges.pipe(startWith(null)), { initialValue: null });
  private readonly formCode = computed(() => (this.valores(), this.form.controls.formCode.value));

  private readonly formasPermitidas = computed(() => allowedChildForms(this.catalog(), this.parent().form.code));

  private readonly opcionesDeForma = computed<readonly SelectOption<string>[]>(() => {
    const ok = new Set(this.formasPermitidas());
    return this.catalog().forms.filter((f) => ok.has(f.code)).map((f) => ({ value: f.code, label: f.display }));
  });

  private readonly opcionesDeFuncion = computed<readonly SelectOption<string>[]>(() => {
    const forma = this.formCode();
    return forma === '' ? [] : functionsFor(this.catalog(), forma, this.site().regulatory.typology?.code ?? null).map((f) => ({ value: f.code, label: f.display }));
  });

  protected readonly esCama = computed(() => this.formCode() === 'LOC_FORM_BED');

  protected readonly paginas = computed<readonly PaginaDeFormulario[]>(() => {
    const cat = this.catalog();
    const opc = (l: readonly { code: string; display: string }[]): readonly SelectOption<string>[] => [SIN_DEFINIR, ...l.map((c) => ({ value: c.code, label: c.display }))];
    return [
      {
        titulo: 'Qué crear',
        clave: 'patron',
        hint: `Un rango entre llaves: {A..H} o {1..12}. Máximo ${MAX_ALTA_MASIVA} espacios.`,
        campos: [
          { key: 'formCode', label: 'Forma', control: 'select', required: true, options: this.opcionesDeForma(), testId: 'masiva-forma' },
          { key: 'functionCode', label: 'Función', control: 'select', required: true, searchable: true, options: this.opcionesDeFuncion(), testId: 'masiva-funcion' },
          { key: 'codePattern', label: 'Patrón del código', control: 'text', required: true, placeholder: '301-{A..H}', testId: 'masiva-codigo' },
          { key: 'namePattern', label: 'Patrón del nombre', control: 'text', required: true, placeholder: 'Cama 301-{A..H}', testId: 'masiva-nombre' },
        ],
        disposicion: 'dos-columnas',
      },
      {
        titulo: 'Atributos comunes',
        clave: 'comunes',
        hint: 'Se aplican a todos los espacios del lote.',
        campos: this.esCama()
          ? [
              { key: 'bedCategoryCode', label: 'Categoría de cama', control: 'select', options: opc(cat.attributes.bedCategory) },
              { key: 'censable', label: 'Censable', control: 'switch' },
              { key: 'sexRestrictionCode', label: 'Restricción de sexo', control: 'select', options: opc(cat.attributes.sex) },
              { key: 'ageGroupCode', label: 'Grupo de edad', control: 'select', options: opc(cat.attributes.ageGroup) },
            ]
          : [
              { key: 'areaM2', label: 'Superficie útil (m²)', control: 'number' },
              { key: 'capacity', label: 'Capacidad (personas)', control: 'number' },
            ],
        disposicion: 'dos-columnas',
      },
    ];
  });

  /** La lista que se va a crear, con las filas que chocan marcadas. */
  protected readonly filas = signal<readonly { code: string; name: string; existe: boolean }[]>([]);
  protected readonly choques = computed(() => this.filas().filter((f) => f.existe).length);

  constructor() {
    this.form.controls.formCode.valueChanges.subscribe(() => {
      const actual = this.form.controls.functionCode.value;
      if (actual !== '' && !this.opcionesDeFuncion().some((o) => o.value === actual)) {
        this.form.controls.functionCode.setValue('');
      }
    });
  }

  ngOnInit(): void {
    const formas = this.opcionesDeForma();
    if (formas.length === 1) this.form.controls.formCode.setValue(formas[0].value);
  }

  protected verVistaPrevia(): void {
    const v = this.form.getRawValue();
    const expansion = expandPattern(v.codePattern, v.namePattern);
    if (!expansion.ok) {
      this.serverState.set(validation([{ field: 'codePattern', message: expansion.reason }]));
      return;
    }
    this.serverState.set(null);
    this.filas.set(expansion.items.map((i) => ({ ...i, existe: this.takenCodes().has(i.code) })));
    this.fase.set('vista-previa');
  }

  protected volver(): void {
    this.serverState.set(null);
    this.fase.set('datos');
  }

  protected crear(): void {
    if (this.pending() || this.choques() > 0) return;
    const v = this.form.getRawValue();
    const num = (n: number | null): number | undefined => (n === null ? undefined : n);
    const txt = (s: string): string | undefined => (s.trim() === '' ? undefined : s.trim());
    const cuerpo: BulkCreateRequest = {
      parentSpaceId: this.parent().id,
      formCode: v.formCode,
      functionCode: v.functionCode,
      codePattern: v.codePattern.trim(),
      namePattern: v.namePattern.trim(),
      ...(this.esCama()
        ? { bedCategoryCode: txt(v.bedCategoryCode), censable: v.censable, sexRestrictionCode: txt(v.sexRestrictionCode), ageGroupCode: txt(v.ageGroupCode) }
        : { areaM2: num(v.areaM2), capacity: num(v.capacity) }),
    };
    this.pending.set(true);
    this.serverState.set(null);
    this.client.createBulk(this.site().id, cuerpo).subscribe({
      next: (r) => {
        this.pending.set(false);
        this.created.emit(r.created);
      },
      error: (error: unknown) => {
        this.pending.set(false);
        this.serverState.set(infrastructureErrorToViewState<unknown>(error));
      },
    });
  }

  protected cerrar(): void {
    this.closed.emit();
  }
}
