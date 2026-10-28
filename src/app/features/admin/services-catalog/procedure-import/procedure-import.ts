import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, EMPTY, expand, map, of, reduce, type Subscription } from 'rxjs';

import { ServicesCatalogClient } from '../../../../core/data-access/services-catalog/services-catalog.client';
import {
  SPECIALTY_SEPARATOR,
  type ImportProceduresResult,
  type Practice,
  type ProcedureNomenclatureItem,
  type ProcedureSpecialty,
} from '../../../../core/data-access/services-catalog/services-catalog.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { dataOf, empty, loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { Skeleton } from '../../../../shared/components/atoms/skeleton/skeleton';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import type { FilterDef } from '../../../../shared/components/organisms/filter-bar/filter-bar';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { SpecialtyBrowser } from '../../../../shared/components/organisms/specialty-browser/specialty-browser';
import type { SpecialtyGroup } from '../../../../shared/components/organisms/specialty-browser/specialty-browser.types';
import { withDisplayCurrency } from '../../../../core/money/display-currency';
import { describirFallo, type Fallo } from './procedure-import.errors';

/**
 * Entradas por página. El arancel tiene 4408: no se traen todas, pero 30 era
 * poco para una especialidad con cientos (la persona sentía que «faltaban
 * servicios» cuando en realidad había que cargar más veinte veces).
 */
const TAMANO_DE_PAGINA = 60;

/** Servicios por página al releer el catálogo de la práctica. */
const PAGINA_DEL_CATALOGO = 500;

/** Tope de seguridad al paginar el catálogo de la práctica (50 000 servicios). */
const MAX_PAGINAS_DEL_CATALOGO = 100;

/** La clave del filtro de especialidad, tal como viaja a la URL. */
const FILTRO_ESPECIALIDAD = 'specialty';

/** Lo que vale para la consulta del arancel: especialidades y texto. */
interface Consulta {
  /** `true` mientras no se sabe cuál es el filtro por omisión: no se pide nada. */
  readonly pendiente: boolean;
  readonly especialidades: readonly string[];
  readonly texto: string;
}

/** Cuánto quedó hecho en el último import en lote. */
interface ResultadoDeLote extends ImportProceduresResult {
  readonly practica: string;
}

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
 * ## La especialidad por omisión
 *
 * Al entrar **sin** `?specialty=` en la URL se aplican las especialidades del
 * médico (`GET .../procedure-specialties/mine`): todas, unidas con `|`. Se
 * escriben en la URL una sola vez, y desde ahí **la URL manda**:
 *
 * - `specialty=A|B` → ésas.
 * - `specialty=` (vacío, explícito) → «Todas las especialidades». Es lo que
 *   escribe el desplegable al elegir esa opción, y lo que se agrega cuando se
 *   quita el chip del filtro. Sin parámetro **y** ya aplicado el default, también
 *   es «todas»: el default no se reaplica en bucle.
 *
 * Si el médico no tiene especialidades o la lectura falla, se muestra todo el
 * arancel y se dice por qué.
 *
 * ## Respuestas viejas
 *
 * Cada cambio de filtro cancela la petición anterior (`unsubscribe` cancela la
 * HTTP) y el handler comprueba su ficha: una página lenta de «Cardiología» ya
 * no puede pisar la de «Pediatría».
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
    Skeleton,
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
  private readonly dialogs = inject(DialogService);
  private readonly destroyRef = inject(DestroyRef);

  /* ---- la práctica a la que se importa ----------------------------------- */

  /**
   * Cargando, vacía (el médico no tiene ninguna) o fallada son tres cosas
   * distintas, y las tres se dicen: antes un fallo se tragaba y la pantalla
   * mostraba «No hay opciones disponibles», sin explicar nada.
   */
  protected readonly estadoPracticas = signal<ViewState<readonly Practice[]>>(loading());
  protected readonly falloPracticas = signal<Fallo | null>(null);

  private readonly practicas = computed<readonly Practice[] | undefined>(
    () => dataOf(this.estadoPracticas()) ?? undefined,
  );

  protected readonly opcionesDePractica = computed<readonly SelectOption<string>[]>(
    () => (this.practicas() ?? []).map((p) => ({ value: p.id, label: p.name })),
  );

  /** Con una sola práctica no hay nada que elegir: se muestra fija. */
  protected readonly practicaUnica = computed<Practice | null>(() => {
    const lista = this.practicas();
    return lista?.length === 1 ? (lista[0] ?? null) : null;
  });

  /** Preselecciona la primera sin pisar la elección de quien ya tocó el selector. */
  protected readonly practicaElegida = linkedSignal<
    readonly Practice[] | undefined,
    string | null
  >({
    source: this.practicas,
    computation: (lista, previo) => previo?.value ?? lista?.[0]?.id ?? null,
  });

  private readonly nombreDeLaPractica = computed(
    () => this.practicas()?.find((p) => p.id === this.practicaElegida())?.name ?? '',
  );

  /* ---- las especialidades ------------------------------------------------- */

  private readonly especialidades = toSignal(
    this.catalog
      .listProcedureSpecialties()
      // Un fallo no rompe la pantalla: el filtro queda deshabilitado con su
      // motivo y el arancel se puede buscar por texto igual.
      .pipe(catchError(() => of<readonly ProcedureSpecialty[]>([]))),
    { initialValue: [] as readonly ProcedureSpecialty[] },
  );

  /**
   * Las del médico: `undefined` hasta que responde, `[]` si no tiene o falló
   * (ver {@link fallaMias}).
   */
  private readonly mias = signal<readonly ProcedureSpecialty[] | undefined>(undefined);
  protected readonly fallaMias = signal(false);

  private readonly nombresMios = computed(() => (this.mias() ?? []).map((e) => e.specialty));

  /** Cuántos procedimientos tiene cada especialidad, para decirlo antes de importar. */
  private readonly conteos = computed(() => {
    const porNombre = new Map<string, number>();
    for (const e of this.mias() ?? []) porNombre.set(e.specialty, e.count);
    for (const e of this.especialidades()) porNombre.set(e.specialty, e.count);
    return porNombre;
  });

  /**
   * Por qué no se aplicó ninguna especialidad por omisión, si es el caso. Nunca
   * se oculta el arancel: se dice y se muestra todo.
   */
  protected readonly avisoDeEspecialidad = computed<string | null>(() => {
    if (this.fallaMias()) {
      return 'No pudimos leer tus especialidades, así que mostramos todo el arancel. Elegí una en el filtro para acotarlo.';
    }
    if (this.mias()?.length === 0) {
      return 'No encontramos en el arancel una especialidad que corresponda a tu perfil, así que mostramos todo. Elegí una en el filtro para acotarlo.';
    }
    return null;
  });

  /**
   * El filtro por especialidad, alimentado por el catálogo real.
   *
   * Desplegable y no chips: treinta y seis opciones no entran en dos
   * renglones. Arriba van «Todas las especialidades» (valor vacío, que la URL
   * guarda como `specialty=` y no se confunde con «sin parámetro») y, si el
   * médico tiene varias, «Mis especialidades» (`A|B`).
   */
  protected readonly filtros = computed<readonly FilterDef[]>(() => {
    const lista = this.especialidades();
    const mias = this.nombresMios();
    const opciones = lista.map((e) => ({
      value: e.specialty,
      // El recuento no es adorno: distingue una especialidad con tres
      // procedimientos de una con trescientos antes de entrar.
      label: `${e.specialty} (${e.count})`,
    }));

    if (lista.length > 0) {
      if (mias.length > 1) {
        const total = mias.reduce((s, n) => s + (this.conteos().get(n) ?? 0), 0);
        opciones.unshift({
          value: mias.join(SPECIALTY_SEPARATOR),
          label: `Mis especialidades: ${mias.join(', ')} (${total})`,
        });
      }
      opciones.unshift({ value: '', label: 'Todas las especialidades' });
    }

    return [
      {
        key: FILTRO_ESPECIALIDAD,
        label: 'Especialidad',
        options: opciones,
        unavailableReason:
          'No pudimos leer las especialidades del arancel. Podés buscar por nombre igual.',
      },
    ];
  });

  /* ---- el filtro vigente, que sale de la URL ------------------------------ */

  /**
   * `especialidad` es `null` cuando la URL **no trae** el parámetro y `''`
   * cuando lo trae vacío: la diferencia es la que separa «aplicá el default»
   * de «el usuario eligió todas».
   */
  private readonly parametros = toSignal(
    this.route.queryParamMap.pipe(
      map((p) => ({
        especialidad: p.get(FILTRO_ESPECIALIDAD),
        texto: p.get('q') ?? '',
      })),
    ),
    {
      initialValue: {
        especialidad: this.route.snapshot.queryParamMap.get(FILTRO_ESPECIALIDAD),
        texto: this.route.snapshot.queryParamMap.get('q') ?? '',
      },
    },
  );

  /** Si el default ya se escribió en la URL (o no hacía falta). Después, `null` es «todas». */
  private readonly defaultResuelto = signal(false);

  private readonly consulta = computed<Consulta>(
    () => {
      const { especialidad, texto } = this.parametros();
      if (especialidad !== null) {
        return {
          pendiente: false,
          texto,
          especialidades: especialidad.split(SPECIALTY_SEPARATOR).filter((e) => e !== ''),
        };
      }
      if (this.mias() === undefined) {
        return { pendiente: true, texto, especialidades: [] };
      }
      return {
        pendiente: false,
        texto,
        especialidades: this.defaultResuelto() ? [] : this.nombresMios(),
      };
    },
    {
      // Que dos lecturas iguales de la URL no disparen dos pedidos.
      equal: (a, b) =>
        a.pendiente === b.pendiente &&
        a.texto === b.texto &&
        a.especialidades.join(SPECIALTY_SEPARATOR) === b.especialidades.join(SPECIALTY_SEPARATOR),
    },
  );

  /** Con un filtro puesto, lo que quedó se muestra abierto (grupos plegables). */
  protected readonly hayFiltro = computed(
    () => this.consulta().especialidades.length > 0 || this.consulta().texto !== '',
  );

  /* ---- el arancel --------------------------------------------------------- */

  /** Lo acumulado de todas las páginas pedidas con el filtro vigente. */
  private readonly acumulado = signal<readonly ProcedureNomenclatureItem[]>([]);
  private readonly cursor = signal<string | null>(null);
  private readonly cargandoMas = signal(false);

  protected readonly estado = signal<ViewState<readonly ProcedureNomenclatureItem[]>>(loading());

  protected readonly hayMas = computed(() => this.cursor() !== null);

  /** La petición del arancel en vuelo. Una nueva cancela la anterior. */
  private peticionArancel: Subscription | null = null;
  /** Ficha de la última petición: una respuesta con otra ficha es vieja y se descarta. */
  private fichaArancel = 0;

  /**
   * Los tramos que el organismo dibuja.
   *
   * El agrupamiento es por **especialidad del arancel**, que llega en el dato
   * y no de partir una cadena. El `conceptId` del tramo es el nombre de la
   * especialidad porque es lo único estable que el arancel publica para
   * agruparla — no hay un concepto de especialidad detrás de esta propiedad.
   */
  protected readonly grupos = computed<readonly SpecialtyGroup<ProcedureNomenclatureItem>[]>(() => {
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

  /* ---- lo ya importado ---------------------------------------------------- */

  /** Códigos ya importados a la práctica elegida, para no duplicar. */
  private readonly yaImportados = signal<ReadonlySet<string>>(new Set());
  protected readonly fallaLecturaDelCatalogo = signal(false);
  private peticionCatalogo: Subscription | null = null;

  /** El que se está importando, para apagar sólo su botón. */
  protected readonly importando = signal<string | null>(null);

  /* ---- importar todo lo de la especialidad -------------------------------- */

  protected readonly importandoTodo = signal(false);
  protected readonly resultadoDeLote = signal<ResultadoDeLote | null>(null);
  protected readonly falloDeLote = signal<Fallo | null>(null);

  /** Qué abarcaría el import en lote con el filtro vigente. */
  protected readonly alcance = computed(() => {
    const { especialidades, texto } = this.consulta();
    const conteos = this.conteos();
    const conocido = especialidades.length > 0 && especialidades.every((e) => conteos.has(e));
    return {
      especialidades,
      texto,
      hayFiltro: especialidades.length > 0 || texto !== '',
      // Con texto el servidor recorta: el número es un tope, no la cuenta.
      cantidad: conocido ? especialidades.reduce((s, e) => s + (conteos.get(e) ?? 0), 0) : null,
    };
  });

  protected readonly etiquetaDeImportarTodo = computed(() => {
    const { especialidades, texto, cantidad } = this.alcance();
    const mios = this.nombresMios();
    const sufijo = cantidad === null || texto !== '' ? '' : ` (${cantidad})`;
    const sonMias =
      mios.length > 0 &&
      especialidades.length === mios.length &&
      mios.every((m) => especialidades.includes(m));
    if (sonMias && texto === '') return `Importar todo lo de mi especialidad${sufijo}`;
    if (texto !== '') return 'Importar todo lo que coincide';
    return `Importar toda la selección${sufijo}`;
  });

  protected readonly puedeImportarTodo = computed(
    () =>
      this.practicaElegida() !== null &&
      this.alcance().hayFiltro &&
      !this.consulta().pendiente &&
      !this.importandoTodo() &&
      this.importando() === null,
  );

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.peticionArancel?.unsubscribe();
      this.peticionCatalogo?.unsubscribe();
    });

    this.cargarPracticas();
    this.cargarMias();

    // Un cambio de filtro es una lista nueva: lo acumulado era del anterior.
    effect(() => {
      const consulta = this.consulta();
      untracked(() => this.recargar(consulta));
    });

    // Sin `?specialty=` en la URL, las del médico se escriben ahí UNA vez, para
    // que el filtro de la pantalla las muestre y el enlace se pueda compartir.
    effect(() => {
      const mias = this.mias();
      const { especialidad } = this.parametros();
      if (mias === undefined || this.defaultResuelto()) return;
      untracked(() => {
        if (especialidad !== null || mias.length === 0) {
          this.defaultResuelto.set(true);
          return;
        }
        void this.router
          .navigate([], {
            relativeTo: this.route,
            queryParams: {
              [FILTRO_ESPECIALIDAD]: mias.map((e) => e.specialty).join(SPECIALTY_SEPARATOR),
            },
            queryParamsHandling: 'merge',
            replaceUrl: true,
          })
          .finally(() => this.defaultResuelto.set(true));
      });
    });

    // El catálogo de la práctica se relee al cambiarla: lo importado en una no
    // dice nada sobre la otra.
    effect(() => {
      this.practicaElegida();
      untracked(() => this.leerImportados());
    });
  }

  protected cargarPracticas(): void {
    this.estadoPracticas.set(loading());
    this.falloPracticas.set(null);
    this.catalog
      .listPractices()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (lista) =>
          this.estadoPracticas.set(
            lista.length === 0
              ? empty(
                  { label: 'Pedí a quien administre la organización que te vincule a una práctica' },
                  'No tenés ninguna práctica asignada.',
                )
              : ready(lista),
          ),
        error: (error: unknown) => {
          this.falloPracticas.set(describirFallo(error, 'practicas'));
          this.estadoPracticas.set(errorToViewState<readonly Practice[]>(error));
        },
      });
  }

  private cargarMias(): void {
    this.catalog
      .listMyProcedureSpecialties()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (lista) => this.mias.set(lista),
        error: () => {
          // Sin default no hay nada que ocultar: se muestra todo y se avisa.
          this.fallaMias.set(true);
          this.mias.set([]);
        },
      });
  }

  protected cambiarPractica(practiceId: string | null): void {
    this.practicaElegida.set(practiceId);
    this.resultadoDeLote.set(null);
    this.falloDeLote.set(null);
  }

  /**
   * Recibe el filtro del organismo y lo lleva a la URL.
   *
   * No se guarda en una señal propia: el organismo lee el estado del filtro de
   * los parámetros, así que la URL **es** el estado. Duplicarlo sería tener
   * dos fuentes que se pueden contradecir.
   *
   * Si el filtro llega **sin** especialidad, quien lo quitó pidió «todas», y se
   * escribe `specialty=` vacío: sin eso, recargar o compartir el enlace
   * reaplicaría el default y la elección se perdería.
   *
   * @param filtros - Códigos activos, incluido el término de búsqueda.
   */
  protected filtrar(filtros: Readonly<Record<string, string>>): void {
    const queryParams: Record<string, string> = { ...filtros };
    if (!(FILTRO_ESPECIALIDAD in filtros) && this.defaultResuelto()) {
      queryParams[FILTRO_ESPECIALIDAD] = '';
    }
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      replaceUrl: true,
    });
  }

  protected traerMas(): void {
    if (this.cursor() === null || this.cargandoMas()) return;
    this.cargar(false);
  }

  protected reintentar(): void {
    this.recargar(this.consulta());
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
    if (practiceId === null || this.importando() !== null || this.importandoTodo()) return;

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
          this.yaImportados.update((codigos) => new Set([...codigos, item.code]));
          this.toasts.success(
            item.ocrSuspect
              ? 'Se importó. Revisá el nombre y el precio: el arancel los marcó como dudosos.'
              : 'Se importó al catálogo de la práctica.',
            item.display,
          );
        },
        error: (error: unknown) => {
          this.importando.set(null);
          const fallo = describirFallo(error, 'importar-uno');
          this.toasts.show({
            type: 'error',
            title: fallo.titulo,
            message: this.textoDe(fallo),
          });
        },
      });
  }

  /**
   * «Importar todo lo de mi especialidad»: copia al catálogo de la práctica
   * **todo** lo que cumpla el filtro vigente, no sólo lo que ya se cargó en
   * pantalla (que son páginas de a 60).
   *
   * Pide confirmación diciendo cuántos son: es una escritura masiva. El
   * servidor es idempotente, así que repetirlo no duplica; lo que ya estaba se
   * cuenta como omitido.
   */
  protected async importarTodo(): Promise<void> {
    const practiceId = this.practicaElegida();
    if (practiceId === null || !this.puedeImportarTodo()) return;

    const { especialidades, texto, cantidad } = this.alcance();
    const practica = this.nombreDeLaPractica();

    const details = [{ label: 'Práctica', value: practica || 'La elegida' }];
    if (especialidades.length > 0) {
      details.push({ label: 'Especialidades', value: especialidades.join(', ') });
    }
    if (texto !== '') details.push({ label: 'Que coincidan con', value: `«${texto}»` });
    if (cantidad !== null) {
      details.push({
        label: texto === '' ? 'Procedimientos' : 'Como máximo',
        value: String(cantidad),
      });
    }

    const confirmado = await this.dialogs.confirm({
      title: 'Importar al catálogo',
      message:
        (cantidad !== null && texto === ''
          ? `Se van a copiar ${cantidad} procedimientos del arancel al catálogo de la práctica. `
          : 'Se van a copiar al catálogo de la práctica todos los procedimientos del arancel que cumplan el filtro. ') +
        'Los que ya están se omiten, así que repetirlo no duplica. Puede incluir filas que el arancel marca como «Revisar»: revisá después su nombre y su precio.',
      details,
      confirmLabel: 'Importar',
    });
    if (!confirmado) return;

    this.importandoTodo.set(true);
    this.resultadoDeLote.set(null);
    this.falloDeLote.set(null);

    this.catalog
      .importProcedures({
        practiceId,
        ...(especialidades.length > 0 ? { specialties: especialidades } : {}),
        ...(texto === '' ? {} : { q: texto }),
      })
      .subscribe({
        next: (resultado) => {
          this.importandoTodo.set(false);
          this.resultadoDeLote.set({ ...resultado, practica });
          this.toasts.success(
            `Se crearon ${resultado.created} y se omitieron ${resultado.skipped} que ya estaban.`,
            'Importación terminada',
          );
          // Lo importado en lote no pasó por `importar`: se relee la fuente.
          this.leerImportados();
        },
        error: (error: unknown) => {
          this.importandoTodo.set(false);
          this.falloDeLote.set(describirFallo(error, 'importar-lote'));
        },
      });
  }

  protected descartarResultadoDeLote(): void {
    this.resultadoDeLote.set(null);
  }

  /** El texto de un fallo con su identificador, para el toast. */
  private textoDe(fallo: Fallo): string {
    return fallo.idDePeticion === undefined
      ? fallo.mensaje
      : `${fallo.mensaje} Código: ${fallo.idDePeticion}.`;
  }

  /**
   * Arranca el listado desde la primera página, o espera si todavía no se sabe
   * el filtro por omisión.
   */
  private recargar(consulta: Consulta): void {
    this.peticionArancel?.unsubscribe();
    this.peticionArancel = null;
    this.fichaArancel += 1;
    this.cargandoMas.set(false);
    this.acumulado.set([]);
    this.cursor.set(null);
    this.estado.set(loading());
    if (consulta.pendiente) return;
    this.cargar(true);
  }

  /**
   * Pide una página con el filtro vigente.
   *
   * @param desdeElPrincipio - `true` para la primera página; `false` para la
   * siguiente (usa el cursor guardado).
   */
  private cargar(desdeElPrincipio: boolean): void {
    const { especialidades, texto } = this.consulta();
    const cursor = desdeElPrincipio ? null : this.cursor();

    // Una petición nueva cancela la anterior: `unsubscribe` aborta la HTTP.
    this.peticionArancel?.unsubscribe();
    this.fichaArancel += 1;
    const ficha = this.fichaArancel;
    this.cargandoMas.set(!desdeElPrincipio);

    this.peticionArancel = this.catalog
      .searchProcedures({
        limit: TAMANO_DE_PAGINA,
        ...(especialidades.length === 0 ? {} : { specialties: especialidades }),
        ...(texto === '' ? {} : { query: texto }),
        ...(cursor === null ? {} : { cursor }),
      })
      .subscribe({
        next: (pagina) => {
          // Respuesta de un filtro anterior: no se mezcla con el vigente.
          if (ficha !== this.fichaArancel) return;
          this.cargandoMas.set(false);
          this.cursor.set(pagina.nextCursor);
          this.acumulado.update((previos) => [...previos, ...pagina.items]);
          const total = this.acumulado();
          this.estado.set(
            total.length === 0
              ? empty(
                  { label: 'Probá con otra palabra o con «Todas las especialidades»' },
                  'Ningún procedimiento del arancel coincide con lo que buscaste.',
                )
              : ready(total),
          );
        },
        error: (error: unknown) => {
          if (ficha !== this.fichaArancel) return;
          this.cargandoMas.set(false);
          if (desdeElPrincipio || this.acumulado().length === 0) {
            this.estado.set(errorToViewState<readonly ProcedureNomenclatureItem[]>(error));
            return;
          }
          // Falló «Cargar más»: lo ya mostrado sigue ahí y se puede reintentar.
          const fallo = describirFallo(error, 'arancel');
          this.toasts.show({
            type: 'error',
            title: 'No pudimos cargar más procedimientos',
            message: `${fallo.mensaje} Lo que ya viste sigue acá: volvé a tocar «Cargar más».`,
          });
        },
      });
  }

  /**
   * Relee qué códigos del arancel ya están en el catálogo de la práctica.
   *
   * Se recorre el catálogo **entero** por cursor: con un tope fijo, una
   * práctica de más servicios mostraba «Importar» sobre cosas ya importadas.
   * Cambiar de práctica cancela la lectura anterior.
   */
  private leerImportados(): void {
    this.peticionCatalogo?.unsubscribe();
    this.peticionCatalogo = null;
    this.fallaLecturaDelCatalogo.set(false);

    const practiceId = this.practicaElegida();
    if (practiceId === null) {
      this.yaImportados.set(new Set());
      return;
    }

    this.peticionCatalogo = this.catalog
      .search(practiceId, { limit: PAGINA_DEL_CATALOGO })
      .pipe(
        expand((pagina, i) =>
          pagina.nextCursor !== null && i < MAX_PAGINAS_DEL_CATALOGO
            ? this.catalog.search(practiceId, {
                limit: PAGINA_DEL_CATALOGO,
                cursor: pagina.nextCursor,
              })
            : EMPTY,
        ),
        reduce((codigos, pagina) => {
          for (const servicio of pagina.items) codigos.add(servicio.code);
          return codigos;
        }, new Set<string>()),
      )
      .subscribe({
        next: (codigos) => this.yaImportados.set(codigos),
        error: () => {
          this.yaImportados.set(new Set());
          this.fallaLecturaDelCatalogo.set(true);
        },
      });
  }
}
