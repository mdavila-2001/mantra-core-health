import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, map, of, type Observable } from 'rxjs';

import { InfrastructureClient } from '../../../../core/data-access/infrastructure/infrastructure.client';
import {
  formasHijasPermitidas,
  funcionesParaForma,
  perfilDe,
  tipologiaAdmite,
} from '../../../../core/data-access/infrastructure/infrastructure.rules';
import type {
  CareSpaceAttributesInput,
  CareSpaceDetail,
  FunctionProfile,
  InfraConcept,
  InfrastructureCatalog,
  SiteStructure,
} from '../../../../core/data-access/infrastructure/infrastructure.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { NavigationService } from '../../../../core/navigation/navigation.service';
import { dataOf, empty, loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { Card } from '../../../../shared/components/molecules/card/card';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { PaginatedForm } from '../../../../shared/components/organisms/paginated-form/paginated-form';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import type { CampoDeFormulario, PaginaDeFormulario } from '../../../../shared/forms/paginated/paginated-form.types';
import { CatalogoDeInfraestructuraStore } from '../infraestructura/catalogo-de-infraestructura.store';
import { RUTA_DE_CONSOLA, rutaDeEspacio } from '../infraestructura/infraestructura.presentacion';
import { RAIZ } from './mover-dialog';

/** Lo que el formulario necesita antes de dibujarse. */
interface Contexto {
  readonly catalogo: InfrastructureCatalog;
  readonly estructura: SiteStructure;
  readonly espacio: CareSpaceDetail | null;
}

const opciones = (conceptos: readonly InfraConcept[]): SelectOption<string>[] =>
  conceptos.map((c) => ({ value: c.code, label: c.display }));

/** Un número del formulario, o `null` si quedó vacío (el input devuelve texto). */
function numero(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === '') return null;
  const n = Number(String(valor).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Una fecha del selector como `YYYY-MM-DD` local, que es lo que guarda la API. */
function fechaIso(fecha: Date | null): string | null {
  if (fecha === null) return null;
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`;
}

const texto = (valor: unknown): string | null => {
  const t = typeof valor === 'string' ? valor.trim() : '';
  return t === '' ? null : t;
};

/**
 * **Alta y edición de un espacio** — `spaces/new` y `spaces/:id/edit`.
 *
 * Servido con `PaginatedForm`, de a cuatro campos, y **las páginas dependen
 * del perfil de la función** (§2): superficie sólo si la función la exige
 * (`requiresArea`), climatización sólo si exige HVAC, categoría de cama y
 * «censable» sólo si es una cama, tiempos de preparación sólo si es agendable.
 * Lo que no aplica no se pregunta, y lo que no se pregunta no se manda.
 *
 * El padre se elige en el alta; para cambiarlo después está «Mover», que
 * valida ciclos. El código y la forma se bloquean una vez que el espacio
 * estuvo activo (422 `SPACE_IMMUTABLE_FIELD`).
 */
@Component({
  selector: 'app-space-form',
  imports: [Card, PageHeader, PaginatedForm, ViewStateHost],
  template: `
    <app-page-header [title]="titulo()" [subtitle]="subtitulo()" [breadcrumbs]="breadcrumbs()" />

    <app-view-state-host [state]="contexto()" (retry)="cargar()">
      @if (fallo(); as estado) {
        <app-view-state-host class="formulario-espacio__fallo" data-testid="formulario-fallo" [state]="estado" (retry)="enviar()" />
      }
      @if (datos()) {
        <app-card class="formulario-espacio" padding="lg" data-testid="formulario-espacio">
          <app-paginated-form
            [paginas]="paginas()"
            [form]="form"
            [label]="titulo()"
            [submitLabel]="esEdicion() ? 'Guardar cambios' : 'Registrar espacio'"
            cancelLabel="Cancelar"
            [pending]="enviando()"
            (enviado)="enviar()"
            (cancelado)="cancelar()"
          />
        </app-card>
      }
    </app-view-state-host>
  `,
  styles: `
    :host { display: block; }
    .formulario-espacio { display: block; inline-size: 100%; margin-inline: auto; }
    .formulario-espacio__fallo { display: block; margin-block-end: var(--sp-4); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpaceForm {
  private readonly client = inject(InfrastructureClient);
  private readonly catalogoStore = inject(CatalogoDeInfraestructuraStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;

  private readonly id = this.route.snapshot.paramMap.get('id');
  private readonly sitioPedido = this.route.snapshot.queryParamMap.get('site');
  private readonly padrePedido = this.route.snapshot.queryParamMap.get('parent');

  protected readonly esEdicion = signal(this.id !== null);
  protected readonly enviando = signal(false);
  protected readonly fallo = signal<ViewState<never> | null>(null);

  private readonly cargado = signal<ViewState<Omit<Contexto, 'catalogo'>>>(loading());

  /** Catálogo y estructura juntos: el formulario no se dibuja con uno solo. */
  protected readonly contexto = computed<ViewState<Contexto>>(() => {
    const catalogo = this.catalogoStore.estado();
    if (catalogo.status !== 'ready' && catalogo.status !== 'stale') return catalogo;
    const resto = this.cargado();
    if (resto.status !== 'ready' && resto.status !== 'stale') return resto;
    return ready({ catalogo: catalogo.data, ...resto.data });
  });

  protected readonly datos = computed(() => dataOf(this.contexto()));

  protected readonly titulo = computed(() =>
    this.esEdicion() ? `Editar ${this.datos()?.espacio?.name ?? 'espacio'}` : 'Registrar un espacio',
  );
  protected readonly subtitulo = computed(() => {
    const d = this.datos();
    return d === null ? 'Infraestructura del establecimiento' : `${d.estructura.site.name} · los campos dependen de la función del espacio`;
  });

  protected readonly form = new FormGroup({
    parentSpaceId: new FormControl<string>(RAIZ, { nonNullable: true }),
    formCode: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    functionCode: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    code: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(40), Validators.pattern(/^[A-Za-z0-9][A-Za-z0-9._-]*$/)] }),
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(120)] }),
    description: new FormControl('', { nonNullable: true }),
    clinicalUnitId: new FormControl<string>('', { nonNullable: true }),
    capacity: new FormControl<string>('', { nonNullable: true, validators: [Validators.pattern(/^\d*$/)] }),
    areaM2: new FormControl<string>('', { nonNullable: true, validators: [Validators.pattern(/^\d*([.,]\d{1,2})?$/)] }),
    floorNumber: new FormControl<string>('', { nonNullable: true, validators: [Validators.pattern(/^-?\d*$/)] }),
    asepsisCode: new FormControl('', { nonNullable: true }),
    pressureCode: new FormControl('', { nonNullable: true }),
    airChangesPerHour: new FormControl<string>('', { nonNullable: true, validators: [Validators.pattern(/^\d*([.,]\d{1,2})?$/)] }),
    hvacValidatedOn: new FormControl<Date | null>(null),
    sexRestrictionCode: new FormControl('', { nonNullable: true }),
    ageGroupCode: new FormControl('', { nonNullable: true }),
    bedCategoryCode: new FormControl('', { nonNullable: true }),
    censable: new FormControl<boolean | null>(null),
    prepMinutes: new FormControl<string>('', { nonNullable: true, validators: [Validators.pattern(/^\d*$/)] }),
    cleanupMinutes: new FormControl<string>('', { nonNullable: true, validators: [Validators.pattern(/^\d*$/)] }),
    gln: new FormControl('', { nonNullable: true, validators: [Validators.pattern(/^(\d{13})?$/)] }),
    activate: new FormControl(false, { nonNullable: true }),
  });

  private readonly valor = toSignal(this.form.valueChanges.pipe(map(() => this.form.getRawValue())), {
    initialValue: this.form.getRawValue(),
  });

  private readonly perfil = computed<FunctionProfile | null>(() => {
    const d = this.datos();
    return d === null ? null : perfilDe(d.catalogo, this.valor().functionCode);
  });

  /** La forma del padre elegido; `null` es la raíz. */
  private readonly formaDelPadre = computed(() => {
    const d = this.datos();
    const padre = this.valor().parentSpaceId;
    if (d === null || padre === RAIZ) return null;
    return d.estructura.spaces.find((e) => e.id === padre)?.form.code ?? null;
  });

  protected readonly paginas = computed<readonly PaginaDeFormulario[]>(() => {
    const d = this.datos();
    if (d === null) return [];
    const v = this.valor();
    const cat = d.catalogo;
    const perfil = this.perfil();
    const tipologia = d.estructura.site.regulatory.typology?.code;
    const formas = this.esEdicion()
      ? cat.forms.filter((f) => f.code === v.formCode || (d.espacio?.status.code === 'SPACE_PLANNED' && formasHijasPermitidas(cat, this.formaDelPadreEnEdicion(d)).includes(f.code)))
      : cat.forms.filter((f) => formasHijasPermitidas(cat, this.formaDelPadre()).includes(f.code));
    const funciones = funcionesParaForma(cat, v.formCode).filter((f) => tipologiaAdmite(cat, tipologia, f.code));
    const esCama = v.formCode === 'LOC_FORM_BED';

    const ubicacion: CampoDeFormulario[] = [
      ...(this.esEdicion()
        ? []
        : [{ key: 'parentSpaceId', label: 'Dentro de', control: 'select' as const, required: true, options: this.opcionesDePadre(d), hint: 'Sólo aparecen los lugares que admiten espacios adentro.', testId: 'campo-padre' }]),
      { key: 'formCode', label: 'Forma', control: 'select', required: true, options: opciones(formas), hint: 'Qué es físicamente: edificio, piso, local, cama…', testId: 'campo-forma' },
      { key: 'functionCode', label: 'Función', control: 'select', required: true, options: funciones.map((f) => ({ value: f.code, label: f.display })), hint: v.formCode === '' ? 'Elegí primero la forma.' : 'Para qué se usa. Define qué más se pregunta.', testId: 'campo-funcion' },
      { key: 'code', label: 'Código', control: 'text', required: true, hint: 'Único en el establecimiento. No se cambia una vez activo.', mensajeDeError: 'Letras, números, punto, guion o guion bajo.', testId: 'campo-codigo' },
    ];

    const paginas: PaginaDeFormulario[] = [
      { titulo: 'Ubicación y tipo', clave: 'ubicacion', campos: ubicacion },
      {
        titulo: 'Identificación',
        clave: 'identificacion',
        campos: [
          { key: 'name', label: 'Nombre', control: 'text', required: true, testId: 'campo-nombre' },
          { key: 'clinicalUnitId', label: 'Unidad propietaria', control: 'select', options: d.estructura.units.map((u) => ({ value: u.id, label: u.name })), placeholder: 'Sin unidad', hint: 'Quién tiene el espacio a cargo.' },
          ...(esCama ? [] : [{ key: 'capacity', label: 'Capacidad', control: 'number' as const, hint: 'Personas o puestos, si aplica.', mensajeDeError: 'Un número entero.' }]),
          { key: 'description', label: 'Descripción', control: 'textarea' },
        ],
      },
    ];

    if (perfil?.requiresArea) {
      paginas.push({
        titulo: 'Superficie',
        clave: 'superficie',
        campos: [
          { key: 'areaM2', label: 'Superficie útil (m²)', control: 'number', hint: 'La exige la norma de caracterización para esta función.', mensajeDeError: 'Un número, hasta dos decimales.', testId: 'campo-area' },
          { key: 'floorNumber', label: 'Piso', control: 'number', hint: '0 es planta baja; negativo, subsuelo.', mensajeDeError: 'Un número entero.' },
        ],
      });
    }
    if (perfil?.requiresHvac) {
      paginas.push({
        titulo: 'Climatización y asepsia',
        clave: 'climatizacion',
        campos: [
          { key: 'asepsisCode', label: 'Zona de asepsia', control: 'select', options: opciones(cat.attributes.asepsis), placeholder: 'Sin declarar', testId: 'campo-asepsia' },
          { key: 'pressureCode', label: 'Presión', control: 'select', options: opciones(cat.attributes.pressure), placeholder: 'Sin declarar' },
          { key: 'airChangesPerHour', label: 'Renovaciones de aire por hora', control: 'number', mensajeDeError: 'Un número, hasta dos decimales.' },
          { key: 'hvacValidatedOn', label: 'Validación de climatización', control: 'date', hint: 'Sin validación, un local de aislamiento no es apto.' },
        ],
      });
    }
    if (esCama || perfil?.inpatient) {
      paginas.push({
        titulo: esCama ? 'Cama' : 'Uso',
        clave: 'uso',
        campos: [
          ...(esCama
            ? [
                { key: 'bedCategoryCode', label: 'Categoría de cama', control: 'select' as const, options: opciones(cat.attributes.bedCategory), placeholder: 'Sin declarar', testId: 'campo-categoria-cama' },
                { key: 'censable', label: '¿Es censable?', control: 'yes-no' as const, hint: 'Las censables cuentan como capacidad de internación.' },
              ]
            : []),
          { key: 'sexRestrictionCode', label: 'Restricción por sexo', control: 'select', options: opciones(cat.attributes.sex), placeholder: 'Sin declarar' },
          { key: 'ageGroupCode', label: 'Grupo de edad', control: 'select', options: opciones(cat.attributes.ageGroup), placeholder: 'Sin declarar' },
        ],
      });
    }
    paginas.push({
      titulo: 'Operación',
      clave: 'operacion',
      campos: [
        ...(perfil?.schedulable
          ? [
              { key: 'prepMinutes', label: 'Preparación (minutos)', control: 'number' as const, mensajeDeError: 'Un número entero.' },
              { key: 'cleanupMinutes', label: 'Limpieza (minutos)', control: 'number' as const, mensajeDeError: 'Un número entero.' },
            ]
          : []),
        { key: 'gln', label: 'GLN (GS1)', control: 'text', hint: 'Opcional. 13 dígitos.', mensajeDeError: 'Deben ser 13 dígitos.' },
        ...(this.esEdicion() ? [] : [{ key: 'activate', label: 'Activarlo ya', control: 'switch' as const, hint: 'Si no, nace planificado y se activa desde su ficha.' }]),
      ],
    });
    return paginas;
  });

  constructor() {
    this.catalogoStore.asegurar();
    this.cargar();
    // Si cambia el padre o la forma, lo que dependía de ellos puede dejar de
    // valer: se vacía en vez de mandar una combinación que la API rechaza.
    this.form.controls.parentSpaceId.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.depurar());
    this.form.controls.formCode.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.depurar());
  }

  cargar(): void {
    this.cargado.set(loading());
    const fallar = <T>(error: unknown): Observable<ViewState<T>> => of(errorToViewState<T>(error));
    if (this.id !== null) {
      this.client
        .getCareSpace(this.id)
        .pipe(catchError((error: unknown) => of({ error })))
        .subscribe((espacio) => {
          if ('error' in espacio) {
            fallar<Omit<Contexto, 'catalogo'>>(espacio.error).subscribe((e) => this.cargado.set(e));
            return;
          }
          this.cargarEstructura(espacio.siteId, espacio);
        });
      return;
    }
    if (this.sitioPedido === null) {
      this.cargado.set(empty({ label: 'Elegir el establecimiento en la consola', route: `${RUTA_DE_CONSOLA}?tab=infrastructure` }, 'Para registrar un espacio primero hay que saber en qué establecimiento.'));
      return;
    }
    this.cargarEstructura(this.sitioPedido, null);
  }

  protected cancelar(): void {
    const d = this.datos();
    if (this.id !== null) {
      void this.router.navigateByUrl(rutaDeEspacio(this.id));
      return;
    }
    void this.router.navigate([RUTA_DE_CONSOLA], {
      queryParams: { tab: 'infrastructure', site: d?.estructura.site.id ?? this.sitioPedido, space: this.padrePedido },
    });
  }

  protected enviar(): void {
    const d = this.datos();
    if (d === null || this.enviando()) return;
    const v = this.form.getRawValue();
    const perfil = this.perfil();
    const esCama = v.formCode === 'LOC_FORM_BED';
    // Sólo viaja lo que se preguntó: un campo que el perfil no pide no se
    // manda, ni siquiera vacío, para no borrar lo que ya tenía el espacio.
    const atributos: CareSpaceAttributesInput = {
      description: texto(v.description),
      clinicalUnitId: v.clinicalUnitId === '' ? null : v.clinicalUnitId,
      ...(esCama ? {} : { capacity: numero(v.capacity) }),
      ...(perfil?.requiresArea ? { areaM2: numero(v.areaM2), floorNumber: numero(v.floorNumber) } : {}),
      ...(perfil?.requiresHvac
        ? { asepsisCode: texto(v.asepsisCode), pressureCode: texto(v.pressureCode), airChangesPerHour: numero(v.airChangesPerHour), hvacValidatedOn: fechaIso(v.hvacValidatedOn) }
        : {}),
      ...(esCama || perfil?.inpatient ? { sexRestrictionCode: texto(v.sexRestrictionCode), ageGroupCode: texto(v.ageGroupCode) } : {}),
      ...(esCama ? { bedCategoryCode: texto(v.bedCategoryCode), censable: v.censable } : {}),
      ...(perfil?.schedulable ? { prepMinutes: numero(v.prepMinutes), cleanupMinutes: numero(v.cleanupMinutes) } : {}),
      gln: texto(v.gln),
    };
    this.enviando.set(true);
    this.fallo.set(null);
    const peticion =
      d.espacio === null
        ? this.client.createCareSpace(d.estructura.site.id, {
            ...atributos,
            code: v.code.trim(),
            name: v.name.trim(),
            formCode: v.formCode,
            functionCode: v.functionCode,
            parentSpaceId: v.parentSpaceId === RAIZ ? null : v.parentSpaceId,
            activate: v.activate,
          })
        : this.client.updateCareSpace(d.espacio.id, d.espacio.rowVersion, {
            ...atributos,
            name: v.name.trim(),
            functionCode: v.functionCode,
            ...(d.espacio.status.code === 'SPACE_PLANNED' ? { code: v.code.trim(), formCode: v.formCode } : {}),
          });
    peticion.subscribe({
      next: (espacio) => {
        this.enviando.set(false);
        void this.router.navigateByUrl(rutaDeEspacio(espacio.id));
      },
      error: (error: unknown) => {
        this.enviando.set(false);
        this.fallo.set(errorToViewState<never>(error));
      },
    });
  }

  private cargarEstructura(siteId: string, espacio: CareSpaceDetail | null): void {
    this.client
      .getStructure(siteId)
      .pipe(
        map((estructura) => ready({ estructura, espacio }) as ViewState<Omit<Contexto, 'catalogo'>>),
        catchError((error: unknown) => of(errorToViewState<Omit<Contexto, 'catalogo'>>(error))),
      )
      .subscribe((estado) => {
        if (estado.status === 'ready') this.precargar(estado.data.estructura, estado.data.espacio);
        this.cargado.set(estado);
      });
  }

  private precargar(estructura: SiteStructure, espacio: CareSpaceDetail | null): void {
    if (espacio === null) {
      const padre = estructura.spaces.find((e) => e.id === this.padrePedido);
      this.form.patchValue({ parentSpaceId: padre?.id ?? RAIZ, clinicalUnitId: padre?.clinicalUnitId ?? '' });
      return;
    }
    const c = (k: InfraConcept | null) => k?.code ?? '';
    const n = (x: number | null) => (x === null ? '' : String(x));
    this.form.patchValue({
      parentSpaceId: espacio.parentId ?? RAIZ,
      formCode: espacio.form.code,
      functionCode: espacio.function.code,
      code: espacio.code,
      name: espacio.name,
      description: espacio.description ?? '',
      clinicalUnitId: espacio.clinicalUnitId ?? '',
      capacity: n(espacio.capacity),
      areaM2: n(espacio.areaM2),
      floorNumber: n(espacio.floorNumber),
      asepsisCode: c(espacio.asepsis),
      pressureCode: c(espacio.pressure),
      airChangesPerHour: n(espacio.airChangesPerHour),
      hvacValidatedOn: espacio.hvacValidatedOn === null ? null : new Date(`${espacio.hvacValidatedOn}T12:00:00`),
      sexRestrictionCode: c(espacio.sexRestriction),
      ageGroupCode: c(espacio.ageGroup),
      bedCategoryCode: c(espacio.bedCategory),
      censable: espacio.censable,
      prepMinutes: n(espacio.prepMinutes),
      cleanupMinutes: n(espacio.cleanupMinutes),
      gln: espacio.gln ?? '',
    });
    if (espacio.status.code !== 'SPACE_PLANNED') {
      // Inmutables una vez activo (§3). Se muestran, no se editan.
      this.form.controls.code.disable();
      this.form.controls.formCode.disable();
    }
  }

  /** Vacía forma y función si el padre o la forma nuevos ya no las admiten. */
  private depurar(): void {
    const d = this.datos();
    if (d === null || this.esEdicion()) return;
    const formas = formasHijasPermitidas(d.catalogo, this.formaDelPadreActual(d));
    const forma = this.form.controls.formCode.value;
    if (forma !== '' && !formas.includes(forma)) {
      this.form.controls.formCode.setValue('', { emitEvent: false });
    }
    const funcion = this.form.controls.functionCode.value;
    const funciones = funcionesParaForma(d.catalogo, this.form.controls.formCode.value).map((f) => f.code);
    if (funcion !== '' && !funciones.includes(funcion)) {
      this.form.controls.functionCode.setValue('', { emitEvent: false });
    }
    this.form.updateValueAndValidity();
  }

  private formaDelPadreActual(d: Contexto): string | null {
    const padre = this.form.controls.parentSpaceId.value;
    return padre === RAIZ ? null : (d.estructura.spaces.find((e) => e.id === padre)?.form.code ?? null);
  }

  private formaDelPadreEnEdicion(d: Contexto): string | null {
    const padre = d.espacio?.parentId ?? null;
    return padre === null ? null : (d.estructura.spaces.find((e) => e.id === padre)?.form.code ?? null);
  }

  private opcionesDePadre(d: Contexto): SelectOption<string>[] {
    const raizAdmite = formasHijasPermitidas(d.catalogo, null).length > 0;
    return [
      ...(raizAdmite ? [{ value: RAIZ, label: `${d.estructura.site.name} (raíz)` }] : []),
      ...d.estructura.spaces
        .filter((e) => e.status.code === 'SPACE_ACTIVE' || e.status.code === 'SPACE_PLANNED')
        .filter((e) => formasHijasPermitidas(d.catalogo, e.form.code).length > 0)
        .sort((a, b) => a.code.localeCompare(b.code, 'es', { numeric: true }))
        .map((e) => ({ value: e.id, label: `${e.code} · ${e.name} (${e.form.display})` })),
    ];
  }
}
