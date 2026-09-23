import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { ServicesCatalogClient } from '../../../../core/data-access/services-catalog/services-catalog.client';
import type {
  Practice,
  ProcedureNomenclatureItem,
  ProcedureSpecialty,
} from '../../../../core/data-access/services-catalog/services-catalog.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import type { FilterDef } from '../../../../shared/components/organisms/filter-bar/filter-bar';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { SpecialtyBrowser } from '../../../../shared/components/organisms/specialty-browser/specialty-browser';
import type { SpecialtyGroup } from '../../../../shared/components/organisms/specialty-browser/specialty-browser.types';
import { withDisplayCurrency } from '../../../../core/money/display-currency';

/** Entradas por página. El arancel tiene 4408: no se traen todas. */
const TAMANO_DE_PAGINA = 30;

/** La clave del filtro de especialidad, tal como viaja a la URL. */
const FILTRO_ESPECIALIDAD = 'specialty';

/**
 * Importar un procedimiento del arancel al catálogo de servicios (TAREA-22, S2).
 *
 * ## Qué es lo que se está mirando
 *
 * El **arancel de honorarios de referencia** (`VS_BO_MEDICAL_PROCEDURE`): 4408
 * procedimientos agrupados en 36 especialidades, con su precio de referencia y
 * su unidad. No es el catálogo de nadie: es de dónde se copia para armar el
 * propio.
 *
 * ## Por qué no dibuja su propia grilla
 *
 * Porque el organismo ya existe. `app-specialty-browser` es exactamente lo que
 * la ficha pide —buscador y filtros arriba, grilla con un encabezado por
 * especialidad, tarjeta proyectada por el consumidor, filtro reflejado en la
 * URL— y la TAREA-27 lo va a consumir igual. Escribir una segunda grilla acá
 * sería el «mismo ORGANISMO» convertido en dos copias.
 *
 * ## Por qué el filtro no es una lista escrita a mano
 *
 * Las 36 especialidades salen de `GET .../procedure-specialties`, que las
 * agrupa **en la base** con su recuento. Una lista en el componente se
 * desactualiza en silencio en cuanto el arancel cambia, y además no podría
 * decir cuántos procedimientos tiene cada una.
 *
 * ## El precio no se convierte
 *
 * `UMA` es la unidad de cuenta del arancel, no una moneda, y su factor de
 * conversión no está declarado en ninguna parte del producto. Desde el
 * 19/09/2026 el número se muestra igual con «Bs», por pedido del propietario
 * para la maqueta: ver `core/money/display-currency.ts`.
 */
@Component({
  selector: 'app-procedure-import',
  imports: [
    Alert,
    AppButton,
    Badge,
    FormField,
    PageHeader,
    RouterLink,
    Select,
    SpecialtyBrowser,
  ],
  templateUrl: './procedure-import.html',
  styleUrl: './procedure-import.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProcedureImport {
  private readonly catalog = inject(ServicesCatalogClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);

  /* ---- la práctica a la que se importa ----------------------------------- */

  /**
   * Un fallo acá no rompe la pantalla: el arancel se puede recorrer sin
   * práctica elegida. Lo que no se puede es importar, y eso se dice.
   */
  private readonly practicas = toSignal(
    this.catalog
      .listPractices()
      .pipe(catchError(() => of<readonly Practice[]>([]))),
    { initialValue: undefined },
  );

  protected readonly opcionesDePractica = computed<readonly SelectOption<string>[]>(
    () => (this.practicas() ?? []).map((p) => ({ value: p.id, label: p.name })),
  );

  /** Preselecciona la primera sin pisar la elección de quien ya tocó el selector. */
  protected readonly practicaElegida = linkedSignal<
    readonly Practice[] | undefined,
    string | null
  >({
    source: this.practicas,
    computation: (lista, previo) => previo?.value ?? lista?.[0]?.id ?? null,
  });

  /* ---- el arancel --------------------------------------------------------- */

  private readonly especialidades = toSignal(
    this.catalog
      .listProcedureSpecialties()
      .pipe(catchError(() => of<readonly ProcedureSpecialty[]>([]))),
    { initialValue: [] as readonly ProcedureSpecialty[] },
  );

  /**
   * El filtro por especialidad, alimentado por el catálogo real.
   *
   * Desplegable y no chips: treinta y seis opciones no entran en dos
   * renglones, y el propio contrato del organismo dice que los chips son para
   * conjuntos cortos.
   */
  protected readonly filtros = computed<readonly FilterDef[]>(() => [
    {
      key: FILTRO_ESPECIALIDAD,
      label: 'Especialidad',
      options: this.especialidades().map((e) => ({
        value: e.specialty,
        // El recuento no es adorno: distingue una especialidad con tres
        // procedimientos de una con trescientos antes de entrar.
        label: `${e.specialty} (${e.count})`,
      })),
      unavailableReason:
        'No pudimos leer las especialidades del arancel. Podés buscar por nombre igual.',
    },
  ]);

  /** Lo acumulado de todas las páginas pedidas con el filtro vigente. */
  private readonly acumulado = signal<readonly ProcedureNomenclatureItem[]>([]);
  private readonly cursor = signal<string | null>(null);

  protected readonly estado = signal<
    ViewState<readonly ProcedureNomenclatureItem[]>
  >(loading());

  protected readonly hayMas = computed(() => this.cursor() !== null);

  /** El filtro vigente sale de la URL: compartir el enlace reproduce la lista. */
  private readonly parametros = toSignal(
    this.route.queryParamMap.pipe(
      map((p) => ({
        especialidad: p.get(FILTRO_ESPECIALIDAD) ?? '',
        texto: p.get('q') ?? '',
      })),
    ),
    { initialValue: { especialidad: '', texto: '' } },
  );

  /** Con un filtro puesto, lo que quedó se muestra abierto (grupos plegables). */
  protected readonly hayFiltro = computed(
    () => this.parametros().especialidad !== '' || this.parametros().texto !== '',
  );

  /**
   * Los tramos que el organismo dibuja.
   *
   * El agrupamiento es por **especialidad del arancel**, que llega en el dato
   * y no de partir una cadena. El `conceptId` del tramo es el nombre de la
   * especialidad porque es lo único estable que el arancel publica para
   * agruparla — no hay un concepto de especialidad detrás de esta propiedad.
   */
  protected readonly grupos = computed<
    readonly SpecialtyGroup<ProcedureNomenclatureItem>[]
  >(() => {
    const porEspecialidad = new Map<string, ProcedureNomenclatureItem[]>();
    for (const item of this.acumulado()) {
      const clave = item.specialty ?? 'Sin especialidad en el arancel';
      const suyos = porEspecialidad.get(clave) ?? [];
      suyos.push(item);
      porEspecialidad.set(clave, suyos);
    }
    return [...porEspecialidad.entries()]
      .sort(([a], [b]) => a.localeCompare(b, 'es', { sensitivity: 'base' }))
      .map(([label, items]) => ({ conceptId: label, label, items }));
  });

  /** Códigos ya importados a la práctica elegida, para no duplicar. */
  private readonly yaImportados = signal<ReadonlySet<string>>(new Set());

  /** El que se está importando, para apagar sólo su botón. */
  protected readonly importando = signal<string | null>(null);

  constructor() {
    // Un cambio de filtro es una lista nueva: lo acumulado era del anterior.
    effect(() => {
      this.parametros();
      untracked(() => {
        this.acumulado.set([]);
        this.cursor.set(null);
        this.cargar();
      });
    });

    // El catálogo de la práctica se relee al cambiarla: lo importado en una no
    // dice nada sobre la otra.
    effect(() => {
      this.practicaElegida();
      untracked(() => this.leerImportados());
    });
  }

  protected cambiarPractica(practiceId: string | null): void {
    this.practicaElegida.set(practiceId);
  }

  /**
   * Recibe el filtro del organismo y lo lleva a la URL.
   *
   * No se guarda en una señal propia: el organismo lee el estado del filtro de
   * los parámetros, así que la URL **es** el estado. Duplicarlo sería tener
   * dos fuentes que se pueden contradecir.
   *
   * @param filtros - Códigos activos, incluido el término de búsqueda.
   */
  protected filtrar(filtros: Readonly<Record<string, string>>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: filtros,
      replaceUrl: true,
    });
  }

  protected traerMas(): void {
    this.cargar();
  }

  protected reintentar(): void {
    this.acumulado.set([]);
    this.cursor.set(null);
    this.cargar();
  }

  /** Si el procedimiento ya está en el catálogo de la práctica elegida. */
  protected estaImportado(item: ProcedureNomenclatureItem): boolean {
    return this.yaImportados().has(item.code);
  }

  /**
   * Cómo se muestra el precio de referencia.
   *
   * Siempre con moneda, y la moneda es «Bs» (19/09/2026, pedido del
   * propietario): el arancel trae `UMA` o `USD` en `priceUnit` y **no** se
   * convierte —ver `display-currency.ts`—.
   *
   * @param item - La entrada del arancel.
   * @returns El texto del precio.
   */
  protected precio(item: ProcedureNomenclatureItem): string {
    if (item.referencePrice === null) return 'Sin precio en el arancel';
    return withDisplayCurrency(item.referencePrice, item.priceUnit);
  }

  /**
   * Importa el procedimiento al catálogo de la práctica.
   *
   * El precio de referencia se copia **precargado y editable**: queda como
   * `default_price` del servicio, que el propio catálogo ya declara como
   * referencia y no como lo que se cobra.
   *
   * El botón se muestra siempre aunque el `POST` exija `SECURITY_ADMIN`:
   * esconderlo no protege nada —la autoridad es la API— y es el patrón que la
   * pantalla del catálogo ya documenta.
   *
   * @param item - La entrada del arancel a copiar.
   */
  protected importar(item: ProcedureNomenclatureItem): void {
    const practiceId = this.practicaElegida();
    if (practiceId === null || this.importando() !== null) return;

    this.importando.set(item.code);
    this.catalog
      .create({
        practiceId,
        // El código del arancel es la procedencia: es lo que permite saber
        // después de dónde salió este servicio y no volver a importarlo.
        code: item.code,
        name: item.display,
        defaultPrice: item.referencePrice ?? '0',
        isActive: true,
      })
      .subscribe({
        next: () => {
          this.importando.set(null);
          this.yaImportados.update((codigos) =>
            new Set([...codigos, item.code]),
          );
          this.toasts.success(
            item.ocrSuspect
              ? 'Se importó. Revisá el nombre y el precio: el arancel los marcó como dudosos.'
              : 'Se importó al catálogo de la práctica.',
            item.display,
          );
        },
        error: () => {
          this.importando.set(null);
          this.toasts.show({
            type: 'error',
            title: 'No pudimos importarlo',
            message:
              'El alta de servicios exige permiso de administración. Pedilo a quien administre la organización.',
          });
        },
      });
  }

  private cargar(): void {
    const { especialidad, texto } = this.parametros();
    const cursor = this.cursor();
    if (this.acumulado().length === 0) this.estado.set(loading());

    this.catalog
      .searchProcedures({
        limit: TAMANO_DE_PAGINA,
        ...(especialidad === '' ? {} : { specialty: especialidad }),
        ...(texto === '' ? {} : { query: texto }),
        ...(cursor === null ? {} : { cursor }),
      })
      .subscribe({
        next: (pagina) => {
          this.cursor.set(pagina.nextCursor);
          this.acumulado.update((previos) => [...previos, ...pagina.items]);
          const total = this.acumulado();
          this.estado.set(
            total.length === 0
              ? empty(
                  { label: 'Quitar los filtros' },
                  'Ningún procedimiento del arancel coincide con lo que buscaste.',
                )
              : ready(total),
          );
        },
        error: (error: unknown) =>
          this.estado.set(
            errorToViewState<readonly ProcedureNomenclatureItem[]>(error),
          ),
      });
  }

  /**
   * Relee qué códigos del arancel ya están en el catálogo de la práctica.
   *
   * Se pide el catálogo entero de la práctica, que es chico —lo que un
   * consultorio ofrece, no las 4408 entradas del arancel— y permite marcar los
   * repetidos sin una consulta por tarjeta.
   */
  private leerImportados(): void {
    const practiceId = this.practicaElegida();
    if (practiceId === null) {
      this.yaImportados.set(new Set());
      return;
    }
    this.catalog.search(practiceId, { limit: 500 }).subscribe({
      next: (pagina) =>
        this.yaImportados.set(new Set(pagina.items.map((s) => s.code))),
      error: () => this.yaImportados.set(new Set()),
    });
  }
}
