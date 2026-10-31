import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked, viewChild, type TemplateRef } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { expand, EMPTY, reduce, type Observable } from 'rxjs';

import { SupportAccessClient } from '../../../core/data-access/support-access/support-access.client';
import type { SupportActivityEntry, SupportActivityPage, SupportActivityQuery } from '../../../core/data-access/support-access/support-access.types';
import { actionOptions, activityActionLabel, audienceOfPath, doctorOptions, personOptions, type ActivityAudience, type ActivityOption } from '../../../core/data-access/support-access/support-activity';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Card } from '../../../shared/components/molecules/card/card';
import { Pagination } from '../../../shared/components/molecules/pagination/pagination';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { FilterBar, type FilterDef } from '../../../shared/components/organisms/filter-bar/filter-bar';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { CsvExportService } from '../../../shared/utils/csv-export/csv-export';
import { formatDateTime } from '../support-labels';
import { ACTIVITY_CSV_COLUMNS, activityFileName } from './activity-csv';

/** Cuántas filas se piden por vez (el tope de la API) y cuántas páginas se juntan al exportar, como máximo. */
const FILAS_POR_PEDIDO = 200;
const MAX_PEDIDOS_AL_EXPORTAR = 50;

const TEXTOS: Readonly<Record<ActivityAudience, { readonly titulo: string; readonly subtitulo: string; readonly resumen: string }>> = {
  org: {
    titulo: 'Actividad del equipo de apoyo',
    subtitulo: 'Qué hizo cada persona de apoyo en la organización. La bitácora no muestra datos clínicos ni nombres de pacientes.',
    resumen: 'acciones del equipo',
  },
  doctor: {
    titulo: 'Actividad de mi equipo',
    subtitulo: 'Lo que las personas de apoyo hicieron sobre su agenda y sus mensajes.',
    resumen: 'acciones sobre mi agenda',
  },
  person: {
    titulo: 'Mi actividad',
    subtitulo: 'Lo que usted hizo como persona de apoyo. Cada acción queda registrada con su nombre, también para la organización y el doctor.',
    resumen: 'acciones suyas',
  },
};

/**
 * **Actividad del equipo de apoyo**, en tres versiones de la misma pantalla:
 * la de la organización, la del doctor y «Mi actividad» de la propia persona.
 * Cuál es lo que decide la ruta con la que se abrió.
 *
 * Los filtros —persona, doctor, acción y fechas— **los resuelve la API**: la pantalla
 * los manda (con `YYYY-MM-DD` para un día completo en la hora de La Paz) y vuelve a
 * pedir. Viven en la URL, así que recargar o compartir el enlace reproduce lo mismo.
 * La API entrega la bitácora por páginas de hasta 200 filas con un cursor; «Cargar más»
 * pide la siguiente. Lo que se ve se exporta a CSV: el archivo trae **todas** las filas
 * que cumplen los filtros (se piden las páginas que faltan), no solo las cargadas.
 *
 * Solo la búsqueda de texto es local: la API no la tiene, así que mira el detalle y el
 * doctor de lo ya cargado.
 *
 * La bitácora la escribe la API y nadie la edita desde acá. Quién ve qué lo decide la
 * API en cada lectura.
 */
@Component({
  selector: 'app-support-activity',
  imports: [AppButton, Badge, Card, DataTable, FilterBar, Input, PageHeader, Pagination],
  templateUrl: './support-activity.html',
  styleUrl: './support-activity.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupportActivity {
  private readonly client = inject(SupportAccessClient);
  private readonly csv = inject(CsvExportService);
  private readonly toasts = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly audiencia: ActivityAudience = audienceOfPath(this.route.snapshot.routeConfig?.path ?? '');
  protected readonly textos = TEXTOS[this.audiencia];

  /** Lo cargado hasta ahora con los filtros vigentes. */
  protected readonly state = signal<ViewState<readonly SupportActivityEntry[]>>(loading());
  protected readonly cursor = signal<string | null>(null);
  protected readonly cargandoMas = signal(false);
  protected readonly exportando = signal(false);
  protected readonly pagina = signal(1);
  protected readonly tamano = signal(10);

  /**
   * Las opciones de los filtros salen de lo que alguna vez se vio, sin encogerse cuando un
   * filtro deja pocas filas: con la API filtrando, las opciones de una lista ya filtrada
   * serían solo la elegida y no se podría cambiar de opinión.
   */
  private readonly vistas = signal<readonly SupportActivityEntry[]>([]);

  private readonly params = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });

  private readonly cuandoCell = viewChild.required<TemplateRef<{ $implicit: SupportActivityEntry }>>('cuandoCell');
  private readonly personaCell = viewChild.required<TemplateRef<{ $implicit: SupportActivityEntry }>>('personaCell');
  private readonly queCell = viewChild.required<TemplateRef<{ $implicit: SupportActivityEntry }>>('queCell');
  private readonly doctorCell = viewChild.required<TemplateRef<{ $implicit: SupportActivityEntry }>>('doctorCell');

  protected readonly persona = computed(() => this.params().get('persona') ?? '');
  protected readonly doctor = computed(() => this.params().get('doctor') ?? '');
  protected readonly accion = computed(() => this.params().get('accion') ?? '');
  protected readonly desde = computed(() => this.params().get('desde') ?? '');
  protected readonly hasta = computed(() => this.params().get('hasta') ?? '');
  protected readonly busqueda = computed(() => (this.params().get('q') ?? '').trim());

  /** Lo que se le pide a la API: persona (por id), doctor, acción y fechas. */
  private readonly consulta = computed<SupportActivityQuery>(() => ({
    ...(this.persona() === '' ? {} : { userId: this.persona() }),
    ...(this.doctor() === '' ? {} : { doctor: this.doctor() }),
    ...(this.accion() === '' ? {} : { action: this.accion() }),
    ...(this.desde() === '' ? {} : { from: this.desde() }),
    ...(this.hasta() === '' ? {} : { to: this.hasta() }),
    limit: FILAS_POR_PEDIDO,
  }));

  protected readonly hayFiltros = computed(() => this.persona() !== '' || this.doctor() !== '' || this.accion() !== '' || this.desde() !== '' || this.hasta() !== '' || this.busqueda() !== '');

  private readonly cargadas = computed<readonly SupportActivityEntry[]>(() => {
    const s = this.state();
    return s.status === 'ready' ? s.data : [];
  });

  /** Lo cargado que cumple la búsqueda de texto (lo único que se filtra acá). */
  protected readonly filtradas = computed<readonly SupportActivityEntry[]>(() => {
    const termino = this.busqueda().toLocaleLowerCase('es');
    if (termino === '') return this.cargadas();
    return this.cargadas().filter((e) => `${e.summary} ${e.practitionerName ?? ''} ${e.personName}`.toLocaleLowerCase('es').includes(termino));
  });

  protected readonly filtros = computed<readonly FilterDef[]>(() => {
    const vistas = this.vistas();
    const opciones = (lista: readonly ActivityOption[], valorActual: string): readonly ActivityOption[] =>
      valorActual === '' || lista.some((o) => o.value === valorActual) ? lista : [...lista, { value: valorActual, label: valorActual }];
    return [
      ...(this.audiencia === 'person' ? [] : [{ key: 'persona', label: 'Persona', placeholder: 'Todas las personas', options: opciones(personOptions(vistas), this.persona()) }]),
      ...(this.audiencia === 'doctor' ? [] : [{ key: 'doctor', label: 'Doctor', placeholder: 'Todos los doctores', options: opciones(doctorOptions(vistas), this.doctor()) }]),
      { key: 'accion', label: 'Acción', placeholder: 'Todas las acciones', options: opciones(actionOptions(vistas), this.accion()) },
    ];
  });

  protected readonly filas = computed<ViewState<readonly SupportActivityEntry[]>>(() => {
    const s = this.state();
    if (s.status !== 'ready') return s;
    const f = this.filtradas();
    if (f.length === 0) return empty({ label: 'Cambie o quite algún filtro' }, 'Ninguna actividad coincide con los filtros.');
    const desde = (this.pagina() - 1) * this.tamano();
    return ready(f.slice(desde, desde + this.tamano()));
  });

  protected readonly columnas = computed<readonly ColumnDef<SupportActivityEntry>[]>(() => [
    { key: 'cuando', header: 'Cuándo', priority: 1, cell: this.cuandoCell() },
    ...(this.audiencia === 'person' ? [] : [{ key: 'persona', header: 'Persona', priority: 1, cell: this.personaCell() }]),
    { key: 'que', header: 'Qué hizo', priority: 1, cell: this.queCell() },
    ...(this.audiencia === 'doctor' ? [] : [{ key: 'doctor', header: 'Doctor', priority: 3, cell: this.doctorCell() }]),
  ]);

  protected readonly entryId = (e: SupportActivityEntry): string => e.id;
  protected readonly entryLabel = (e: SupportActivityEntry): string => `${e.personName}, ${activityActionLabel(e.action)}`;
  protected cuando = formatDateTime;
  protected accionTexto = activityActionLabel;

  constructor() {
    // Cada cambio de filtro (ya está en la URL) vuelve a pedir la primera página.
    effect(() => {
      this.consulta();
      untracked(() => this.cargar());
    });
  }

  private pedir(query: SupportActivityQuery): Observable<SupportActivityPage> {
    return this.audiencia === 'org' ? this.client.getOrganizationActivity(query) : this.audiencia === 'doctor' ? this.client.getMyTeamActivity(query) : this.client.getMyActivity(query);
  }

  /** La primera página con los filtros vigentes. */
  protected cargar(): void {
    this.state.set(loading());
    this.pagina.set(1);
    this.pedir(this.consulta()).subscribe({
      next: ({ items, nextCursor }) => {
        this.cursor.set(nextCursor);
        this.recordar(items);
        this.state.set(items.length === 0 && !this.hayFiltros() ? empty({ label: 'Cuando haya movimiento, aparecerá acá' }, 'Todavía no hay actividad registrada.') : ready(items));
      },
      error: (failure: unknown) => this.state.set(errorToViewState<readonly SupportActivityEntry[]>(failure)),
    });
  }

  /** La página siguiente, a continuación de lo que ya se ve. */
  protected cargarMas(): void {
    const cursor = this.cursor();
    if (cursor === null || this.cargandoMas()) return;
    this.cargandoMas.set(true);
    this.pedir({ ...this.consulta(), cursor }).subscribe({
      next: ({ items, nextCursor }) => {
        this.cargandoMas.set(false);
        this.cursor.set(nextCursor);
        this.recordar(items);
        this.state.update((s) => (s.status === 'ready' ? ready([...s.data, ...items]) : s));
      },
      error: () => {
        this.cargandoMas.set(false);
        this.toasts.error('No pudimos cargar más actividad. Vuelva a intentarlo.');
      },
    });
  }

  private recordar(items: readonly SupportActivityEntry[]): void {
    this.vistas.update((actual) => {
      const conocidas = new Set(actual.map((e) => e.id));
      const nuevas = items.filter((e) => !conocidas.has(e.id));
      return nuevas.length === 0 ? actual : [...actual, ...nuevas];
    });
  }

  /** Cambió un filtro de la barra (ya está en la URL): se vuelve a la primera página. */
  protected filtrosCambiaron(): void {
    this.pagina.set(1);
  }

  protected cambiarFecha(clave: 'desde' | 'hasta', valor: string | number | null): void {
    this.pagina.set(1);
    void this.router.navigate([], { relativeTo: this.route, queryParams: { [clave]: valor === null || valor === '' ? null : String(valor) }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  /** El CSV con **todas** las filas que cumplen los filtros: si faltan páginas, se piden. */
  protected exportar(): void {
    if (this.exportando() || this.filtradas().length === 0) return;
    const entregar = (todas: readonly SupportActivityEntry[], completa: boolean): void => {
      this.exportando.set(false);
      const termino = this.busqueda().toLocaleLowerCase('es');
      const filas = termino === '' ? todas : todas.filter((e) => `${e.summary} ${e.practitionerName ?? ''} ${e.personName}`.toLocaleLowerCase('es').includes(termino));
      if (filas.length === 0) return;
      this.csv.download(filas, ACTIVITY_CSV_COLUMNS, activityFileName(this.audiencia));
      this.toasts.success(filas.length === 1 ? 'Exportamos 1 fila.' : `Exportamos ${filas.length} filas.`, completa ? 'Lo que ve, con los filtros que puso.' : 'Hay más actividad de la que se pudo exportar de una vez: acote las fechas.');
    };
    if (this.cursor() === null) {
      entregar(this.cargadas(), true);
      return;
    }
    this.exportando.set(true);
    let pedidos = 0;
    this.pedir(this.consulta())
      .pipe(
        expand((pagina) => (pagina.nextCursor !== null && ++pedidos < MAX_PEDIDOS_AL_EXPORTAR ? this.pedir({ ...this.consulta(), cursor: pagina.nextCursor }) : EMPTY)),
        reduce<SupportActivityPage, { filas: readonly SupportActivityEntry[]; completa: boolean }>((junto, pagina) => ({ filas: [...junto.filas, ...pagina.items], completa: pagina.nextCursor === null }), { filas: [], completa: true }),
      )
      .subscribe({
        next: ({ filas, completa }) => entregar(filas, completa),
        error: () => {
          this.exportando.set(false);
          this.toasts.error('No pudimos exportar la actividad. Vuelva a intentarlo.');
        },
      });
  }
}
