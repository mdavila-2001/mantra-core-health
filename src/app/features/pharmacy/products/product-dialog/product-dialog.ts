import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
  type OnInit,
} from '@angular/core';
import { concatMap, from, type Observable } from 'rxjs';

import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Input } from '../../../../shared/components/atoms/input/input';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { Textarea } from '../../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import { FileInput } from '../../../../shared/components/molecules/file-input/file-input';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ReferenceCombobox } from '../../../../shared/components/molecules/reference-combobox/reference-combobox';
import type { ReferenceOption } from '../../../../shared/components/molecules/reference-combobox/reference-combobox.types';
import { Tab } from '../../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../../shared/components/molecules/tabs/tabs';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { ContentDialog } from '../../../../shared/components/organisms/content-dialog/content-dialog';

import { FilesClient } from '../../../../core/data-access/files/files.client';
import { PharmacyClient } from '../../../../core/data-access/pharmacy/pharmacy.client';
import {
  MAX_PRODUCT_IMAGES,
  type CatalogProduct,
  type PharmacyProduct,
  type PharmacyProductStatus,
} from '../../../../core/data-access/pharmacy/pharmacy.types';
import {
  CAMPOS_VACIOS,
  LARGO_MAXIMO_DE_LA_DESCRIPCION,
  LARGO_MAXIMO_DEL_CODIGO,
  cambiosDelBorrador,
  revisarProducto,
  type CamposDelProducto,
  type VinculoConElCatalogo,
} from '../../catalog-rules/catalog.rules';
import { pharmacyErrorMessage } from '../../pharmacy-error-message';
import {
  CATALOG_SEARCH_LIMIT,
  catalogOption,
  officialOfCatalog,
  officialOfProduct,
  sellablePresentations,
  type OfficialView,
} from '../catalog-view';
import { productName, productStatus } from '../product-view';

/** Las pestañas del modal, en el orden en que se dibujan. */
export const PRODUCT_DIALOG_TABS = [
  'General',
  'Ficha técnica',
  'Descripción',
  'Imágenes',
  'Publicación',
] as const;

/** Formatos de imagen que el almacenamiento reconoce por firma binaria. */
const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp';
/** Tope por foto: la misma política de subidas del resto del producto, en bytes. */
const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

/**
 * **Un producto del catálogo**, nuevo o para editar, en un modal con cinco
 * pestañas: General · Ficha técnica · Descripción · Imágenes · Publicación.
 *
 * Es el `productEditor` del mockup del cliente traducido a nuestro sistema: la
 * regla §6 de `composition-rules.md` pide que lo que se hace sobre un registro
 * existente se abra en modal, y la §5 que el contenido sea UNA superficie con
 * pestañas. Como `app-tab` no dibuja el panel cerrado, todo lo que se escribe
 * vive en señales de este componente: cambiar de pestaña no pierde nada.
 *
 * ## Qué guarda y qué no
 *
 * `Guardar` es `POST`/`PATCH` y el modal se cierra **sólo** cuando el servidor
 * respondió bien; entonces avisa con `saved` y quien lo abrió relee el listado,
 * porque la prueba es la lista, no el aviso. Si falla, el modal queda abierto
 * con el motivo.
 *
 * ## El producto viene del catálogo oficial
 *
 * Al **dar de alta** no se tipea nada del medicamento: se busca en el catálogo
 * universal (registros sanitarios oficiales) y se elige por su id. Nombre,
 * concentración, forma, presentación y receta los trae el registro y **no se
 * editan**; la farmacia carga lo suyo: SKU, precio, existencias, fotos propias,
 * descripción y publicación. Si el medicamento no está, no hay alta libre: se
 * **pide** que lo incorporen. Un producto cargado a mano antes del catálogo se
 * sigue editando entero.
 *
 * ## Cerrar con cambios
 *
 * Cerrar con algo escrito sin guardar pide confirmación (`closeGuard`).
 */
@Component({
  selector: 'app-product-dialog',
  imports: [
    Alert,
    AppButton,
    ContentDialog,
    FileInput,
    FormField,
    Input,
    ReferenceCombobox,
    Select,
    Tab,
    Tabs,
    Textarea,
  ],
  templateUrl: './product-dialog.html',
  styleUrl: './product-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductDialog implements OnInit {
  readonly pharmacyId = input.required<string>();
  /** El producto a editar, o `null` para dar de alta uno. */
  readonly product = input<PharmacyProduct | null>(null);
  /** Los nombres de las categorías de esta farmacia. */
  readonly categories = input<readonly string[]>([]);

  readonly saved = output<void>();
  readonly closed = output<void>();

  private readonly pharmacy = inject(PharmacyClient);
  private readonly files = inject(FilesClient);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  protected readonly dialog = viewChild.required(ContentDialog);

  protected readonly tabs = PRODUCT_DIALOG_TABS;
  protected readonly codeMaxLength = LARGO_MAXIMO_DEL_CODIGO;
  protected readonly descriptionMaxLength = LARGO_MAXIMO_DE_LA_DESCRIPCION;
  protected readonly maxImages = MAX_PRODUCT_IMAGES;
  protected readonly imageAccept = IMAGE_ACCEPT;
  protected readonly imageMaxBytes = IMAGE_MAX_BYTES;

  protected readonly tab = signal(0);
  protected readonly fields = signal<CamposDelProducto>(CAMPOS_VACIOS);
  protected readonly status = signal<PharmacyProductStatus>('PUBLISHED');
  protected readonly imageIds = signal<readonly string[]>([]);
  /** Miniaturas ya leídas, por id de archivo. */
  protected readonly previews = signal<ReadonlyMap<string, string>>(new Map());
  protected readonly uploading = signal(false);
  protected readonly errors = signal<readonly string[]>([]);
  protected readonly saving = signal(false);

  /* ---- catálogo oficial ------------------------------------------------- */
  protected readonly catalogId = signal<string | null>(null);
  protected readonly catalogOptions = signal<readonly ReferenceOption[]>([]);
  protected readonly catalogLoading = signal(false);
  protected readonly catalogSearchFailed = signal(false);
  protected readonly selectedProduct = signal<CatalogProduct | null>(null);
  protected readonly presentationCode = signal('');
  protected readonly skuTouched = signal(false);
  /** Fotos oficiales que no cargaron: se dibuja el marcador, no un cuadro roto. */
  protected readonly brokenPhotos = signal<ReadonlySet<string>>(new Set());
  protected readonly catalogSearchLimit = CATALOG_SEARCH_LIMIT;
  private readonly catalogResults = new Map<string, CatalogProduct>();
  /** Descarta la respuesta de una búsqueda que ya quedó vieja. */
  private catalogSearchSeq = 0;

  /* ---- «no encuentro mi medicamento» ------------------------------------ */
  protected readonly requestOpen = signal(false);
  protected readonly requestFields = signal<CatalogRequestFields>(REQUEST_VACIA);
  protected readonly requestError = signal<string | null>(null);
  protected readonly sendingRequest = signal(false);

  /** Lo que había al abrir, para saber si hay algo sin guardar. */
  private initialSnapshot = '';

  protected readonly isEditing = computed(() => this.product() !== null);
  /** Un producto ya cargado desde el catálogo: lo oficial se ve y no se edita. */
  protected readonly isLinked = computed(() => {
    const link = this.product()?.catalog;
    return link !== null && link !== undefined;
  });
  /** Alta nueva o producto vinculado: lo oficial sale del registro, no de un formulario. */
  protected readonly usesCatalog = computed(() => !this.isEditing() || this.isLinked());

  /** Lo que el registro oficial dice del producto elegido o ya cargado. */
  protected readonly official = computed<OfficialView | null>(() => {
    const chosen = this.selectedProduct();
    if (chosen !== null) {
      const presentation =
        sellablePresentations(chosen).find((p) => p.code === this.presentationCode()) ?? null;
      return officialOfCatalog(chosen, presentation);
    }
    const product = this.product();
    return product === null ? null : officialOfProduct(product);
  });

  protected readonly selectedOption = computed<ReferenceOption | null>(() => {
    const chosen = this.selectedProduct();
    return chosen === null ? null : catalogOption(chosen);
  });

  protected readonly presentationOptions = computed<readonly SelectOption<string>[]>(() => {
    const chosen = this.selectedProduct();
    if (chosen === null) return [];
    return [
      { value: '', label: 'Elija la presentación que vende' },
      ...sellablePresentations(chosen).map((p) => ({ value: p.code!, label: p.name })),
    ];
  });

  protected readonly heading = computed(() => {
    const product = this.product();
    return product === null ? 'Nuevo producto' : `Editar «${productName(product)}»`;
  });

  protected readonly categoryOptions = computed<readonly SelectOption<string>[]>(() => {
    const names = new Set(this.categories());
    // Un producto con una categoría que ya no está en la lista no la pierde en
    // silencio: sigue ofreciéndose hasta que la persona elija otra.
    const current = this.fields().categoria;
    if (current !== '') {
      names.add(current);
    }
    return [
      { value: '', label: 'Sin categoría' },
      ...[...names].map((name) => ({ value: name, label: name })),
    ];
  });

  protected readonly statusOptions = computed<readonly SelectOption<string>[]>(() => [
    { value: 'PUBLISHED', label: 'Publicado — lo ven los pacientes' },
    { value: 'DRAFT', label: 'Borrador — sólo lo ve usted' },
    ...(this.isEditing() ? [{ value: 'WITHDRAWN', label: 'Retirado — ya no se vende' }] : []),
  ]);

  protected readonly availabilityOptions: readonly SelectOption<string>[] = [
    { value: 'sí', label: 'Lo tengo (disponible)' },
    { value: 'no', label: 'No lo tengo (sin stock)' },
  ];

  protected readonly yesNoOptions: readonly SelectOption<string>[] = [
    { value: '', label: 'Sin declarar' },
    { value: 'sí', label: 'Sí' },
    { value: 'no', label: 'No' },
  ];

  protected readonly canAddImages = computed(() => this.imageIds().length < MAX_PRODUCT_IMAGES);

  /** Se pasa como `closeGuard`: cerrar con cambios sin guardar pide confirmación. */
  protected readonly confirmClose = async (): Promise<boolean> => {
    if (this.saving()) {
      return false;
    }
    if (!this.isDirty()) {
      return true;
    }
    return this.dialogs.confirm({
      title: '¿Descartar los cambios?',
      message: 'Escribió cosas que todavía no guardó. Si cierra ahora se pierden.',
      confirmLabel: 'Descartar',
      destructive: true,
    });
  };

  ngOnInit(): void {
    const product = this.product();
    if (product !== null) {
      this.fields.set(fieldsOf(product));
      this.status.set(productStatus(product));
      this.imageIds.set(product.imageFileIds ?? []);
      for (const id of product.imageFileIds ?? []) {
        this.loadPreview(id);
      }
    }
    this.initialSnapshot = this.snapshot();
  }

  protected setField(field: keyof CamposDelProducto, value: string | number | null): void {
    if (field === 'codigo') {
      this.skuTouched.set(true);
    }
    this.fields.update((current) => ({ ...current, [field]: value === null ? '' : String(value) }));
  }

  /** Busca en el catálogo oficial; la molécula ya esperó y exige el mínimo de letras. */
  protected searchCatalog(text: string): void {
    const sequence = ++this.catalogSearchSeq;
    this.catalogLoading.set(true);
    this.catalogSearchFailed.set(false);
    this.pharmacy.searchCatalog({ search: text, limit: CATALOG_SEARCH_LIMIT }).subscribe({
      next: (page) => {
        if (sequence !== this.catalogSearchSeq) return;
        for (const item of page.items) this.catalogResults.set(item.id, item);
        this.catalogOptions.set(page.items.map(catalogOption));
        this.catalogLoading.set(false);
      },
      error: () => {
        if (sequence !== this.catalogSearchSeq) return;
        this.catalogOptions.set([]);
        this.catalogSearchFailed.set(true);
        this.catalogLoading.set(false);
      },
    });
  }

  /** Eligió (o limpió) un medicamento del catálogo. */
  protected chooseCatalog(option: ReferenceOption | null): void {
    const found = option === null ? undefined : this.catalogResults.get(option.value);
    // Un registro que no está vigente se lista pero no se elige.
    const chosen = found?.selectable === true ? found : undefined;
    this.selectedProduct.set(chosen ?? null);
    this.presentationCode.set('');
    const presentations = chosen === undefined ? [] : sellablePresentations(chosen);
    // Un solo envase posible: no hay nada que elegir.
    if (presentations.length === 1) {
      this.setPresentation(presentations[0]!.code);
    } else if (!this.skuTouched()) {
      this.fields.update((current) => ({ ...current, codigo: '' }));
    }
  }

  protected setPresentation(code: string | null): void {
    this.presentationCode.set(code ?? '');
    // El SKU arranca con el código de la presentación, salvo que ya lo haya escrito la persona.
    if (!this.skuTouched() && code !== null && code !== '') {
      this.fields.update((current) => ({ ...current, codigo: code }));
    }
  }

  protected markPhotoBroken(url: string): void {
    this.brokenPhotos.update((current) => new Set(current).add(url));
  }

  protected toggleRequest(): void {
    this.requestOpen.update((open) => !open);
    this.requestError.set(null);
  }

  protected setRequestField(field: keyof CatalogRequestFields, value: string | number | null): void {
    this.requestFields.update((current) => ({ ...current, [field]: value === null ? '' : String(value) }));
  }

  /** Pide que un administrador incorpore el medicamento; no publica nada. */
  protected sendRequest(): void {
    if (this.sendingRequest()) return;
    const fields = this.requestFields();
    if (fields.name.trim().length < 2) {
      this.requestError.set('Escriba el nombre del medicamento (al menos 2 letras).');
      return;
    }
    this.requestError.set(null);
    this.sendingRequest.set(true);
    this.pharmacy
      .requestCatalogEntry(this.pharmacyId(), {
        name: fields.name.trim(),
        holder: fields.holder.trim(),
        strengthText: fields.strengthText.trim(),
        presentation: fields.presentation.trim(),
        registrationNumber: fields.registrationNumber.trim(),
        notes: fields.notes.trim(),
      })
      .subscribe({
        next: () => {
          this.sendingRequest.set(false);
          this.requestFields.set(REQUEST_VACIA);
          this.requestOpen.set(false);
          this.toasts.success('Pedimos incorporar el medicamento al catálogo. Le avisamos cuando esté.');
        },
        error: (error: unknown) => {
          this.sendingRequest.set(false);
          this.requestError.set(pharmacyErrorMessage(error, 'No se pudo enviar la solicitud.'));
        },
      });
  }

  protected setStatus(value: string | null): void {
    this.status.set((value ?? 'PUBLISHED') as PharmacyProductStatus);
  }

  protected addImages(files: readonly File[]): void {
    const room = MAX_PRODUCT_IMAGES - this.imageIds().length;
    const chosen = files.slice(0, Math.max(room, 0));
    if (chosen.length === 0) {
      return;
    }
    this.uploading.set(true);
    // Una por petición y en serie: el endpoint acepta un archivo por vez.
    from(chosen)
      .pipe(concatMap((file) => this.files.upload(file, 'IMAGE', 'NORMAL')))
      .subscribe({
        next: (uploaded) => {
          this.imageIds.update((ids) => [...ids, uploaded.id]);
          this.loadPreview(uploaded.id);
        },
        error: (error: unknown) => {
          this.uploading.set(false);
          this.errors.set([pharmacyErrorMessage(error, 'No se pudo subir la imagen.')]);
        },
        complete: () => this.uploading.set(false),
      });
  }

  protected removeImage(id: string): void {
    this.imageIds.update((ids) => ids.filter((imageId) => imageId !== id));
  }

  protected save(): void {
    if (this.saving() || this.uploading()) {
      return;
    }
    const editing = this.product();
    const link = this.linkOf(editing);
    if (link === 'missing') {
      return;
    }
    const review = revisarProducto(this.fields(), undefined, link ?? undefined);
    if (!review.valido) {
      this.errors.set(review.errores);
      // Los errores del alta son de los datos generales o de la publicación:
      // llevar a la primera pestaña evita que la persona los busque a ciegas.
      this.tab.set(0);
      return;
    }
    this.errors.set([]);
    this.saving.set(true);
    const extras = { status: this.status(), imageFileIds: [...this.imageIds()] };
    const request: Observable<unknown> =
      editing === null
        ? this.pharmacy.publishProduct(this.pharmacyId(), { ...review.borrador, ...extras })
        : this.pharmacy.updateProduct(this.pharmacyId(), editing.id, {
            ...cambiosDelBorrador(review.borrador, true, this.isLinked()),
            ...extras,
          });
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.toasts.success(
          editing === null
            ? `«${this.selectedProduct()?.display ?? review.borrador.brandName ?? review.borrador.genericName ?? review.borrador.productCode}» ya está en su catálogo.`
            : 'Guardó los cambios del producto.',
        );
        this.saved.emit();
        this.dialog().close(true);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.errors.set([pharmacyErrorMessage(error, 'No se pudo guardar el producto.')]);
      },
    });
  }

  /**
   * El vínculo con el catálogo que lleva el guardado: el producto elegido (alta),
   * el que ya tiene (edición de uno vinculado) o ninguno (uno cargado a mano).
   * `'missing'` = falta elegir y ya se avisó.
   */
  private linkOf(editing: PharmacyProduct | null): VinculoConElCatalogo | 'missing' | null {
    if (editing !== null) {
      return editing.catalog == null ? null : { catalogProductId: editing.catalog.catalogProductId };
    }
    const chosen = this.selectedProduct();
    if (chosen === null) {
      this.errors.set([
        'Elija el medicamento del catálogo oficial. Si no aparece, pida que lo incorporen.',
      ]);
      this.tab.set(0);
      return 'missing';
    }
    const code = this.presentationCode();
    if (code === '' && sellablePresentations(chosen).length > 1) {
      this.errors.set(['Elija la presentación que vende: el catálogo trae más de una.']);
      this.tab.set(0);
      return 'missing';
    }
    return { catalogProductId: chosen.id, ...(code === '' ? {} : { presentationCode: code }) };
  }

  private isDirty(): boolean {
    return this.snapshot() !== this.initialSnapshot;
  }

  private snapshot(): string {
    return JSON.stringify([
      this.fields(),
      this.status(),
      this.imageIds(),
      this.selectedProduct()?.id ?? null,
      this.presentationCode(),
    ]);
  }

  private loadPreview(id: string): void {
    this.files.imageDataUrl(id).subscribe({
      next: (url) => this.previews.update((current) => new Map(current).set(id, url)),
      // Sin miniatura el archivo sigue vinculado: se dibuja el marcador.
      error: () => undefined,
    });
  }
}

/** Lo que se escribe al pedir que incorporen un medicamento al catálogo. */
interface CatalogRequestFields {
  readonly name: string;
  readonly holder: string;
  readonly strengthText: string;
  readonly presentation: string;
  readonly registrationNumber: string;
  readonly notes: string;
}

const REQUEST_VACIA: CatalogRequestFields = {
  name: '',
  holder: '',
  strengthText: '',
  presentation: '',
  registrationNumber: '',
  notes: '',
};

/** Lo que el formulario muestra de un producto que ya existe. */
function fieldsOf(product: PharmacyProduct): CamposDelProducto {
  return {
    ...CAMPOS_VACIOS,
    codigo: product.productCode,
    marca: product.brandName ?? '',
    generico: product.genericName ?? '',
    concentracion: product.strengthText ?? '',
    presentacion: product.packageSizeText ?? '',
    receta:
      product.requiresPrescription === true ? 'sí' : product.requiresPrescription === false ? 'no' : '',
    precio: product.unitPrice ?? '',
    categoria: product.category ?? '',
    descripcion: product.description ?? '',
    disponible: product.inStock === false ? 'no' : 'sí',
  };
}
