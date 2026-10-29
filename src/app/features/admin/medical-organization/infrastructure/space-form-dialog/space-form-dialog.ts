import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnInit,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { startWith } from 'rxjs';

import { InfrastructureClient } from '../../../../../core/data-access/infrastructure/infrastructure.client';
import { infrastructureErrorToViewState } from '../../../../../core/data-access/infrastructure/infrastructure.errors';
import {
  allowedChildForms,
  attributeNeeds,
  functionsFor,
} from '../../../../../core/data-access/infrastructure/infrastructure.logic';
import type {
  CareSpaceDetail,
  CareSpaceNode,
  ClinicalUnitNode,
  CreateCareSpaceRequest,
  InfrastructureCatalog,
  SiteSummary,
  SpaceAttributesInput,
  UpdateCareSpaceRequest,
} from '../../../../../core/data-access/infrastructure/infrastructure.types';
import type { ViewState } from '../../../../../core/view-state/view-state.types';
import type { SelectOption } from '../../../../../shared/components/atoms/select/select.types';
import { ContentDialog } from '../../../../../shared/components/organisms/content-dialog/content-dialog';
import { PaginatedForm } from '../../../../../shared/components/organisms/paginated-form/paginated-form';
import type { CampoDeFormulario, PaginaDeFormulario } from '../../../../../shared/forms/paginated/paginated-form.types';
import { InfraIssueAlert } from '../issue-alert';

const SIN_DEFINIR: SelectOption<string> = { value: '', label: 'Sin definir' };

/** Letras, números y los separadores corrientes de un rótulo de local: «HAB-301», «ED-A/P3». */
const FORMATO_DE_CODIGO = /^[A-Za-z0-9][A-Za-z0-9._/\- ]*$/;

/** Un día calendario como `YYYY-MM-DD`, sin pasar por UTC (el día que se eligió es el que se manda). */
function aDia(fecha: Date | null): string | undefined {
  if (fecha === null) return undefined;
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

function deDia(valor: string | null): Date | null {
  if (valor === null || valor === '') return null;
  const [y, m, d] = valor.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

const numero = (v: number | null): number | undefined => (v === null || Number.isNaN(v) ? undefined : v);
const texto = (v: string): string | undefined => (v.trim() === '' ? undefined : v.trim());

/**
 * **Alta y edición de un espacio** — un modal con el formulario por partes
 * (`app-paginated-form`, cuatro campos por página como máximo).
 *
 * ## Qué ofrece y qué deja a la API
 *
 * Sólo las formas que el catálogo deja bajo el padre elegido y, para la forma,
 * sólo las funciones cuyo perfil la admite y que la tipología del
 * establecimiento permite. Es ayuda: la API vuelve a validar (INV-04…06) y su
 * rechazo se muestra arriba sin perder lo escrito. Las páginas de atributos
 * aparecen según el perfil de la función —`requiresArea`, `requiresHvac`—, que
 * viene del catálogo, no de un `if` por nombre de función.
 *
 * ## Edición
 *
 * `code` y la forma sólo se cambian mientras el espacio está planificado
 * (INV-09); la función no se edita (el contrato no lo ofrece). La unidad
 * propietaria se cambia en la pestaña «Unidades» de la ficha. El `PATCH` lleva
 * `If-Match` con el `rowVersion` con el que se abrió: si otra persona cambió el
 * espacio, la API responde 412 y el aviso pide recargar.
 */
@Component({
  selector: 'app-space-form-dialog',
  imports: [ContentDialog, InfraIssueAlert, PaginatedForm],
  templateUrl: './space-form-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpaceFormDialog implements OnInit {
  readonly mode = input<'create' | 'edit'>('create');
  readonly site = input.required<SiteSummary>();
  readonly catalog = input.required<InfrastructureCatalog>();
  readonly units = input<readonly ClinicalUnitNode[]>([]);
  /** Alta: el padre elegido en el árbol, o `null` para la raíz. */
  readonly parent = input<CareSpaceNode | null>(null);
  /** Edición: el espacio con el `rowVersion` vigente. */
  readonly space = input<CareSpaceDetail | null>(null);
  /** Edición: la página con la que se abre (el lápiz abre donde se estaba mirando). */
  readonly initialStep = input(0);

  readonly saved = output<CareSpaceDetail>();
  readonly closed = output<void>();

  private readonly client = inject(InfrastructureClient);

  protected readonly pending = signal(false);
  protected readonly serverState = signal<ViewState<unknown> | null>(null);

  protected readonly form = new FormGroup({
    code: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(40), Validators.pattern(FORMATO_DE_CODIGO)] }),
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(120)] }),
    formCode: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    functionCode: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    clinicalUnitId: new FormControl('', { nonNullable: true }),
    description: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
    activate: new FormControl(false, { nonNullable: true }),
    areaM2: new FormControl<number | null>(null, { validators: [Validators.min(0.1)] }),
    floorNumber: new FormControl<number | null>(null),
    capacity: new FormControl<number | null>(null, { validators: [Validators.min(0)] }),
    gln: new FormControl('', { nonNullable: true, validators: [Validators.pattern(/^(\d{13})?$/)] }),
    asepsisCode: new FormControl('', { nonNullable: true }),
    pressureCode: new FormControl('', { nonNullable: true }),
    airChangesPerHour: new FormControl<number | null>(null, { validators: [Validators.min(0)] }),
    hvacValidatedOn: new FormControl<Date | null>(null),
    bedCategoryCode: new FormControl('', { nonNullable: true }),
    censable: new FormControl(true, { nonNullable: true }),
    sexRestrictionCode: new FormControl('', { nonNullable: true }),
    ageGroupCode: new FormControl('', { nonNullable: true }),
    prepMinutes: new FormControl<number | null>(null, { validators: [Validators.min(0)] }),
    cleanupMinutes: new FormControl<number | null>(null, { validators: [Validators.min(0)] }),
  });

  /** Los valores como señal: de ellos dependen las opciones y las páginas. */
  private readonly valores = toSignal(this.form.valueChanges.pipe(startWith(null)), { initialValue: null });

  private readonly formCode = computed(() => {
    this.valores();
    return this.form.controls.formCode.value;
  });
  private readonly functionCode = computed(() => {
    this.valores();
    return this.form.controls.functionCode.value;
  });

  private readonly formularioRef = viewChild(PaginatedForm);

  protected readonly esEdicion = computed(() => this.mode() === 'edit');
  protected readonly titulo = computed(() => (this.esEdicion() ? `Editar ${this.space()?.name ?? 'espacio'}` : 'Agregar espacio'));

  protected readonly descripcion = computed(() => {
    if (this.esEdicion()) return `Código ${this.space()?.code ?? ''} · versión ${this.space()?.rowVersion ?? ''}`;
    const padre = this.parent();
    return padre === null ? `En la raíz de ${this.site().name}` : `Dentro de «${padre.name}» (${padre.code})`;
  });

  /** Se puede editar código y forma: nace planificado y todavía no estuvo activo. */
  private readonly estructuraAbierta = computed(() => !this.esEdicion() || this.space()?.status.code === 'SPACE_PLANNED');

  private readonly tipologia = computed(() => this.site().regulatory.typology?.code ?? null);

  private readonly formasPermitidas = computed<readonly string[]>(() => {
    if (this.esEdicion()) return [this.space()!.form.code];
    return allowedChildForms(this.catalog(), this.parent()?.form.code ?? null);
  });

  private readonly opcionesDeForma = computed<readonly SelectOption<string>[]>(() => {
    const permitidas = new Set(this.formasPermitidas());
    return this.catalog().forms.filter((f) => permitidas.has(f.code)).map((f) => ({ value: f.code, label: f.display }));
  });

  private readonly funcionesDeLaForma = computed(() => {
    const forma = this.formCode();
    return forma === '' ? [] : functionsFor(this.catalog(), forma, this.tipologia());
  });

  protected readonly perfil = computed(() => this.catalog().functions.find((f) => f.code === this.functionCode()) ?? null);
  private readonly necesidades = computed(() => attributeNeeds(this.perfil(), this.formCode()));

  private readonly opcionesDeUnidad = computed<readonly SelectOption<string>[]>(() => [
    SIN_DEFINIR,
    ...this.units().filter((u) => u.status.code !== 'UNIT_RETIRED').map((u) => ({ value: u.id, label: `${u.name} (${u.code})` })),
  ]);

  private opciones(lista: readonly { code: string; display: string }[]): readonly SelectOption<string>[] {
    return [SIN_DEFINIR, ...lista.map((c) => ({ value: c.code, label: c.display }))];
  }

  /** Puede nacer activo sólo si el padre lo está (o no hay padre): lo demás lo rechazaría la API. */
  private readonly puedeNacerActivo = computed(() => this.parent() === null || this.parent()!.status.code === 'SPACE_ACTIVE');

  protected readonly paginas = computed<readonly PaginaDeFormulario[]>(() => {
    const cat = this.catalog();
    const necesidades = this.necesidades();
    const abierta = this.estructuraAbierta();
    const edicion = this.esEdicion();
    const funciones = this.funcionesDeLaForma();

    const identificacion: CampoDeFormulario[] = [
      { key: 'code', label: 'Código', control: 'text', required: true, hint: abierta ? 'Único en el establecimiento y no se reutiliza, ni el de un espacio clausurado.' : 'Inmutable: el espacio ya estuvo activo.', placeholder: 'HAB-301', testId: 'espacio-codigo', mensajeDeError: 'Use letras, números y . _ / - (máximo 40).' },
      { key: 'name', label: 'Nombre', control: 'text', required: true, placeholder: 'Habitación 301', testId: 'espacio-nombre' },
      { key: 'formCode', label: 'Forma', control: 'select', required: true, options: this.opcionesDeForma(), hint: 'Dónde va en el árbol. Sólo se ofrecen las formas que caben bajo ese padre.', testId: 'espacio-forma' },
    ];
    const funcion: CampoDeFormulario[] = [
      { key: 'functionCode', label: 'Función', control: 'select', required: true, searchable: true, options: funciones.map((f) => ({ value: f.code, label: f.display })), hint: 'Para qué se usa; decide su comportamiento.', testId: 'espacio-funcion' },
      ...(edicion ? [] : [{ key: 'clinicalUnitId', label: 'Unidad propietaria', control: 'select', options: this.opcionesDeUnidad(), hint: 'Opcional; se puede vincular después.', testId: 'espacio-unidad' } satisfies CampoDeFormulario]),
      { key: 'description', label: 'Descripción', control: 'textarea' },
      ...(edicion || !this.puedeNacerActivo() ? [] : [{ key: 'activate', label: 'Activar al crear', control: 'switch', hint: 'Si no, nace planificado y se activa desde la ficha.', testId: 'espacio-activar' } satisfies CampoDeFormulario]),
    ];
    const medidas: CampoDeFormulario[] = [
      { key: 'areaM2', label: 'Superficie útil (m²)', control: 'number', required: necesidades.area, hint: necesidades.area ? 'Esta función exige la superficie.' : undefined, testId: 'espacio-area' },
      { key: 'floorNumber', label: 'Número de piso', control: 'number' },
      { key: 'capacity', label: 'Capacidad (personas)', control: 'number' },
      { key: 'gln', label: 'GLN (13 dígitos)', control: 'text', mensajeDeError: 'El GLN son 13 dígitos, o déjelo vacío.' },
    ];
    const paginas: PaginaDeFormulario[] = [
      { titulo: 'Identificación', clave: 'identificacion', hint: 'Cómo se llama y qué forma tiene.', campos: identificacion },
      { titulo: 'Función y servicio', clave: 'funcion', campos: funcion },
      { titulo: 'Medidas', clave: 'medidas', campos: medidas, disposicion: 'dos-columnas' },
    ];
    if (necesidades.hvac) {
      paginas.push({
        titulo: 'Ambiente y climatización',
        clave: 'ambiente',
        hint: 'Los umbrales de cada valor son datos del catálogo, no de la pantalla.',
        campos: [
          { key: 'asepsisCode', label: 'Asepsia', control: 'select', options: this.opciones(cat.attributes.asepsis) },
          { key: 'pressureCode', label: 'Presión', control: 'select', options: this.opciones(cat.attributes.pressure) },
          { key: 'airChangesPerHour', label: 'Renovaciones de aire por hora', control: 'number', required: true },
          { key: 'hvacValidatedOn', label: 'Validación de climatización', control: 'date', hint: 'Un local de aislamiento sin validación queda no apto.' },
        ],
        disposicion: 'dos-columnas',
      });
    }
    if (necesidades.bed) {
      paginas.push({
        titulo: 'Cama',
        clave: 'cama',
        campos: [
          { key: 'bedCategoryCode', label: 'Categoría de cama', control: 'select', options: this.opciones(cat.attributes.bedCategory), testId: 'espacio-categoria' },
          { key: 'censable', label: 'Censable', control: 'switch', hint: 'Cuenta para la capacidad real y el censo.' },
          { key: 'sexRestrictionCode', label: 'Restricción de sexo', control: 'select', options: this.opciones(cat.attributes.sex) },
          { key: 'ageGroupCode', label: 'Grupo de edad', control: 'select', options: this.opciones(cat.attributes.ageGroup) },
        ],
        disposicion: 'dos-columnas',
      });
    }
    if (necesidades.operatingRoom) {
      paginas.push({
        titulo: 'Tiempos de quirófano',
        clave: 'tiempos',
        hint: 'Se descuentan de la agenda alrededor de cada cirugía.',
        campos: [
          { key: 'prepMinutes', label: 'Preparación (min)', control: 'number' },
          { key: 'cleanupMinutes', label: 'Limpieza (min)', control: 'number' },
        ],
        disposicion: 'dos-columnas',
      });
    }
    return paginas;
  });

  constructor() {
    // La función elegida deja de valer si la forma cambia y ya no la admite.
    this.form.controls.formCode.valueChanges.subscribe(() => {
      const actual = this.form.controls.functionCode.value;
      if (actual !== '' && !this.funcionesDeLaForma().some((f) => f.code === actual)) {
        this.form.controls.functionCode.setValue('');
      }
    });
    // `required` de lo que el perfil exige: se enciende o apaga con la función.
    this.form.controls.functionCode.valueChanges.subscribe(() => {
      const n = this.necesidades();
      this.conRequerido(this.form.controls.areaM2, n.area, [Validators.min(0.1)]);
      this.conRequerido(this.form.controls.airChangesPerHour, n.hvac, [Validators.min(0)]);
    });
  }

  ngOnInit(): void {
    const e = this.space();
    if (this.esEdicion() && e !== null) {
      this.form.patchValue({
        code: e.code,
        name: e.name,
        formCode: e.form.code,
        functionCode: e.function.code,
        description: e.description ?? '',
        areaM2: e.areaM2,
        floorNumber: e.floorNumber,
        capacity: e.capacity,
        gln: e.gln ?? '',
        asepsisCode: e.asepsis?.code ?? '',
        pressureCode: e.pressure?.code ?? '',
        airChangesPerHour: e.airChangesPerHour,
        hvacValidatedOn: deDia(e.hvacValidatedOn),
        bedCategoryCode: e.bedCategory?.code ?? '',
        censable: e.censable ?? true,
        sexRestrictionCode: e.sexRestriction?.code ?? '',
        ageGroupCode: e.ageGroup?.code ?? '',
        prepMinutes: e.prepMinutes,
        cleanupMinutes: e.cleanupMinutes,
      });
      if (!this.estructuraAbierta()) {
        this.form.controls.code.disable();
        this.form.controls.formCode.disable();
      }
      this.form.controls.functionCode.disable();
    } else {
      // Con una sola forma posible no hay nada que elegir: se deja puesta.
      const formas = this.opcionesDeForma();
      if (formas.length === 1) this.form.controls.formCode.setValue(formas[0].value);
    }
  }

  private conRequerido(control: FormControl<number | null>, requerido: boolean, base: readonly ((c: FormControl<number | null>) => unknown)[]): void {
    control.setValidators(requerido ? [Validators.required, ...(base as never[])] : (base as never[]));
    control.updateValueAndValidity({ emitEvent: false });
  }

  /** Lo que se manda: sólo lo que la persona completó (las cadenas vacías no viajan). */
  private atributos(): SpaceAttributesInput {
    const v = this.form.getRawValue();
    const necesidades = this.necesidades();
    return {
      description: texto(v.description),
      areaM2: numero(v.areaM2),
      floorNumber: numero(v.floorNumber),
      capacity: numero(v.capacity),
      gln: texto(v.gln),
      ...(necesidades.hvac
        ? {
            asepsisCode: texto(v.asepsisCode),
            pressureCode: texto(v.pressureCode),
            airChangesPerHour: numero(v.airChangesPerHour),
            hvacValidatedOn: aDia(v.hvacValidatedOn),
          }
        : {}),
      ...(necesidades.bed
        ? {
            bedCategoryCode: texto(v.bedCategoryCode),
            censable: v.censable,
            sexRestrictionCode: texto(v.sexRestrictionCode),
            ageGroupCode: texto(v.ageGroupCode),
          }
        : {}),
      ...(necesidades.operatingRoom ? { prepMinutes: numero(v.prepMinutes), cleanupMinutes: numero(v.cleanupMinutes) } : {}),
    };
  }

  protected submit(): void {
    if (this.pending()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.pending.set(true);
    this.serverState.set(null);
    const v = this.form.getRawValue();
    const atributos = this.atributos();
    const alTerminar = {
      next: (detalle: CareSpaceDetail): void => {
        this.pending.set(false);
        this.saved.emit(detalle);
      },
      error: (error: unknown): void => {
        this.pending.set(false);
        this.serverState.set(infrastructureErrorToViewState<unknown>(error));
      },
    };

    if (this.esEdicion()) {
      const e = this.space()!;
      const cambios: UpdateCareSpaceRequest = {
        name: v.name.trim(),
        ...(this.estructuraAbierta() ? { code: v.code.trim(), formCode: v.formCode } : {}),
        ...atributos,
      };
      this.client.updateCareSpace(e.id, e.rowVersion, cambios).subscribe(alTerminar);
      return;
    }

    const cuerpo: CreateCareSpaceRequest = {
      code: v.code.trim(),
      name: v.name.trim(),
      formCode: v.formCode,
      functionCode: v.functionCode,
      ...(this.parent() === null ? {} : { parentSpaceId: this.parent()!.id }),
      ...(v.clinicalUnitId === '' ? {} : { clinicalUnitId: v.clinicalUnitId }),
      ...(v.activate ? { activate: true } : {}),
      ...atributos,
    };
    this.client.createCareSpace(this.site().id, cuerpo).subscribe(alTerminar);
  }

  protected cerrar(): void {
    this.closed.emit();
  }
}
