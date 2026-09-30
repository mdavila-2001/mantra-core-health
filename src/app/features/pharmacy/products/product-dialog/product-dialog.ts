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
import { Tab } from '../../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../../shared/components/molecules/tabs/tabs';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { ContentDialog } from '../../../../shared/components/organisms/content-dialog/content-dialog';

import { FilesClient } from '../../../../core/data-access/files/files.client';
import { PharmacyClient } from '../../../../core/data-access/pharmacy/pharmacy.client';
import {
  MAX_PRODUCT_IMAGES,
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
} from '../../catalog-rules/catalogo.reglas';
import { pharmacyErrorMessage } from '../../pharmacy-error-message';
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
 * El **registro sanitario** del mockup no está: el backend no tiene dónde
 * guardarlo (P47) y este proyecto no dibuja campos que no se guardan.
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

  /** Lo que había al abrir, para saber si hay algo sin guardar. */
  private initialSnapshot = '';

  protected readonly isEditing = computed(() => this.product() !== null);

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
    { value: 'DRAFT', label: 'Borrador — sólo lo ves vos' },
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
      message: 'Escribiste cosas que todavía no guardaste. Si cerrás ahora se pierden.',
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
    this.fields.update((current) => ({ ...current, [field]: value === null ? '' : String(value) }));
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
    const review = revisarProducto(this.fields());
    if (!review.valido) {
      this.errors.set(review.errores);
      // Los errores del alta son de los datos generales o de la publicación:
      // llevar a la primera pestaña evita que la persona los busque a ciegas.
      this.tab.set(0);
      return;
    }
    this.errors.set([]);
    this.saving.set(true);
    const editing = this.product();
    const extras = { status: this.status(), imageFileIds: [...this.imageIds()] };
    const request: Observable<unknown> =
      editing === null
        ? this.pharmacy.publishProduct(this.pharmacyId(), { ...review.borrador, ...extras })
        : this.pharmacy.updateProduct(this.pharmacyId(), editing.id, {
            ...cambiosDelBorrador(review.borrador, true),
            ...extras,
          });
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.toasts.success(
          editing === null
            ? `«${review.borrador.brandName ?? review.borrador.genericName ?? review.borrador.productCode}» ya está en tu catálogo.`
            : 'Guardaste los cambios del producto.',
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

  private isDirty(): boolean {
    return this.snapshot() !== this.initialSnapshot;
  }

  private snapshot(): string {
    return JSON.stringify([this.fields(), this.status(), this.imageIds()]);
  }

  private loadPreview(id: string): void {
    this.files.imageDataUrl(id).subscribe({
      next: (url) => this.previews.update((current) => new Map(current).set(id, url)),
      // Sin miniatura el archivo sigue vinculado: se dibuja el marcador.
      error: () => undefined,
    });
  }
}

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
