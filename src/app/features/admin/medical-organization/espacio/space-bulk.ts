import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { InfrastructureClient } from '../../../../core/data-access/infrastructure/infrastructure.client';
import {
  expandirPatron,
  formasHijasPermitidas,
  funcionesParaForma,
  MAX_ALTA_MASIVA,
  nombresDelAltaMasiva,
  tipologiaAdmite,
} from '../../../../core/data-access/infrastructure/infrastructure.rules';
import type { InfrastructureCatalog, SiteStructure } from '../../../../core/data-access/infrastructure/infrastructure.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { NavigationService } from '../../../../core/navigation/navigation.service';
import { dataOf, empty, loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Input } from '../../../../shared/components/atoms/input/input';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../shared/components/molecules/card/card';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { CatalogoDeInfraestructuraStore } from '../infraestructura/catalogo-de-infraestructura.store';
import { RUTA_DE_CONSOLA, rutaDeEspacio } from '../infraestructura/infraestructura.presentacion';

/** Cuántos códigos de la vista previa se dibujan antes de resumir el resto. */
const VISTA_PREVIA = 60;

/**
 * **Alta masiva** — `spaces/bulk?site=&parent=` → `POST /sites/:id/care-spaces/bulk`.
 *
 * «Cama 301-A…H» en un solo paso: un patrón de código con **un** rango
 * (`301-{A..H}`, `CAMA-{1..12}`), un patrón de nombre y los atributos comunes.
 * La vista previa muestra exactamente los códigos que se van a crear —y cuáles
 * ya existen— antes de enviar. La API crea todo o nada (máx. 200).
 */
@Component({
  selector: 'app-space-bulk',
  imports: [Alert, AppButton, Card, FormField, Input, PageHeader, ReactiveFormsModule, Select, ViewStateHost],
  templateUrl: './space-bulk.html',
  styleUrl: './space-bulk.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpaceBulk {
  private readonly client = inject(InfrastructureClient);
  private readonly catalogoStore = inject(CatalogoDeInfraestructuraStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;

  private readonly sitio = this.route.snapshot.queryParamMap.get('site');
  private readonly padrePedido = this.route.snapshot.queryParamMap.get('parent');

  private readonly estructura = signal<ViewState<SiteStructure>>(loading());
  protected readonly enviando = signal(false);
  protected readonly fallo = signal<ViewState<never> | null>(null);

  protected readonly contexto = computed<ViewState<{ catalogo: InfrastructureCatalog; estructura: SiteStructure }>>(() => {
    const c = this.catalogoStore.estado();
    if (c.status !== 'ready' && c.status !== 'stale') return c;
    const e = this.estructura();
    if (e.status !== 'ready' && e.status !== 'stale') return e;
    return ready({ catalogo: c.data, estructura: e.data });
  });
  protected readonly datos = computed(() => dataOf(this.contexto()));

  protected readonly form = new FormGroup({
    parentSpaceId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    formCode: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    functionCode: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    codePattern: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    namePattern: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    bedCategoryCode: new FormControl('', { nonNullable: true }),
  });

  private readonly valor = toSignal(this.form.valueChanges.pipe(map(() => this.form.getRawValue())), {
    initialValue: this.form.getRawValue(),
  });

  /** Sólo padres que admiten hijos y están vivos. */
  protected readonly padres = computed<SelectOption<string>[]>(() => {
    const d = this.datos();
    if (d === null) return [];
    return d.estructura.spaces
      .filter((e) => e.status.code === 'SPACE_ACTIVE' || e.status.code === 'SPACE_PLANNED')
      .filter((e) => formasHijasPermitidas(d.catalogo, e.form.code).length > 0)
      .sort((a, b) => a.code.localeCompare(b.code, 'es', { numeric: true }))
      .map((e) => ({ value: e.id, label: `${e.code} · ${e.name}` }));
  });

  protected readonly formas = computed<SelectOption<string>[]>(() => {
    const d = this.datos();
    const padre = d?.estructura.spaces.find((e) => e.id === this.valor().parentSpaceId);
    if (d === null || padre === undefined) return [];
    const permitidas = formasHijasPermitidas(d.catalogo, padre.form.code);
    return d.catalogo.forms.filter((f) => permitidas.includes(f.code)).map((f) => ({ value: f.code, label: f.display }));
  });

  protected readonly funciones = computed<SelectOption<string>[]>(() => {
    const d = this.datos();
    if (d === null) return [];
    const tipologia = d.estructura.site.regulatory.typology?.code;
    return funcionesParaForma(d.catalogo, this.valor().formCode)
      .filter((f) => tipologiaAdmite(d.catalogo, tipologia, f.code))
      .map((f) => ({ value: f.code, label: f.display }));
  });

  protected readonly categorias = computed<SelectOption<string>[]>(() =>
    (this.datos()?.catalogo.attributes.bedCategory ?? []).map((c) => ({ value: c.code, label: c.display })),
  );

  protected readonly esCama = computed(() => this.valor().formCode === 'LOC_FORM_BED');

  /** La vista previa: códigos, nombres, cuáles chocan con existentes. */
  protected readonly vistaPrevia = computed(() => {
    const v = this.valor();
    if (v.codePattern.trim() === '') return null;
    const codigos = expandirPatron(v.codePattern);
    if (!codigos.ok) return { error: codigos.error, filas: [], total: 0, ocupados: 0 };
    const nombres = v.namePattern.trim() === '' ? null : nombresDelAltaMasiva(v.codePattern, v.namePattern);
    if (nombres !== null && !nombres.ok) return { error: nombres.error, filas: [], total: 0, ocupados: 0 };
    const existentes = new Set((this.datos()?.estructura.spaces ?? []).map((e) => e.code.toUpperCase()));
    const filas = codigos.valores.map((code, i) => ({
      code,
      name: nombres?.ok ? nombres.valores[i]! : '—',
      ocupado: existentes.has(code.toUpperCase()),
    }));
    return {
      error: null,
      filas: filas.slice(0, VISTA_PREVIA),
      total: filas.length,
      ocupados: filas.filter((f) => f.ocupado).length,
    };
  });

  protected readonly puedeEnviar = computed(() => {
    const p = this.vistaPrevia();
    return this.valor() !== null && this.form.valid && p !== null && p.error === null && p.ocupados === 0 && p.total > 0;
  });

  protected readonly tope = MAX_ALTA_MASIVA;

  constructor() {
    this.catalogoStore.asegurar();
    this.cargar();
    this.form.controls.parentSpaceId.valueChanges.subscribe(() => this.form.patchValue({ formCode: '', functionCode: '' }, { emitEvent: true }));
    this.form.controls.formCode.valueChanges.subscribe(() => this.form.controls.functionCode.setValue(''));
  }

  protected cargar(): void {
    if (this.sitio === null) {
      this.estructura.set(empty({ label: 'Elegir el establecimiento en la consola', route: `${RUTA_DE_CONSOLA}?tab=infrastructure` }, 'El alta masiva necesita saber en qué establecimiento.'));
      return;
    }
    this.estructura.set(loading());
    this.client
      .getStructure(this.sitio)
      .pipe(
        map((d) => ready(d) as ViewState<SiteStructure>),
        catchError((error: unknown) => of(errorToViewState<SiteStructure>(error))),
      )
      .subscribe((estado) => {
        this.estructura.set(estado);
        if (estado.status === 'ready' && this.padrePedido !== null && estado.data.spaces.some((e) => e.id === this.padrePedido)) {
          this.form.controls.parentSpaceId.setValue(this.padrePedido);
        }
      });
  }

  protected cancelar(): void {
    void this.router.navigate([RUTA_DE_CONSOLA], { queryParams: { tab: 'infrastructure', site: this.sitio, space: this.padrePedido } });
  }

  protected enviar(): void {
    const d = this.datos();
    if (d === null || !this.puedeEnviar() || this.enviando()) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.enviando.set(true);
    this.fallo.set(null);
    this.client
      .bulkCreateCareSpaces(d.estructura.site.id, {
        parentSpaceId: v.parentSpaceId,
        formCode: v.formCode,
        functionCode: v.functionCode,
        codePattern: v.codePattern.trim(),
        namePattern: v.namePattern.trim(),
        ...(this.esCama() && v.bedCategoryCode !== '' ? { bedCategoryCode: v.bedCategoryCode } : {}),
      })
      .subscribe({
        next: () => {
          this.enviando.set(false);
          void this.router.navigate([rutaDeEspacio(v.parentSpaceId)], { queryParams: { tab: 'children' } });
        },
        error: (error: unknown) => {
          this.enviando.set(false);
          this.fallo.set(errorToViewState<never>(error));
        },
      });
  }
}
