import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationSkipped, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';

import { ProfilesClient } from '../../core/data-access/profiles/profiles.client';
import type { PatientListItem } from '../../core/data-access/profiles/profiles.types';
import { errorToViewState } from '../../core/http/error-to-view-state';
import { NavigationService } from '../../core/navigation/navigation.service';
import { SearchMemoryService } from '../../core/navigation/search-memory.service';
import { empty, loading, ready } from '../../core/view-state/view-state';
import type { ViewState } from '../../core/view-state/view-state.types';
import { AppButton } from '../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../shared/components/atoms/button/button-link';
import { Input } from '../../shared/components/atoms/input/input';
import { NavIcon } from '../../shared/components/atoms/nav-icon/nav-icon';
import { Tooltip } from '../../shared/components/atoms/tooltip/tooltip';
import { FormField } from '../../shared/components/molecules/form-field/form-field';
import { SearchField } from '../../shared/components/molecules/search-field/search-field';
import { DataTable } from '../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../shared/components/organisms/page-header/page-header';
import {
  CLINICAL_RECORD_ROUTE,
  patientChartRoute,
  requestAccessRoute,
} from './clinical-record.routes';

/** Tope de filas del buscador. La API pagina por cursor; acá alcanza una página. */
const TOPE = 25;

/** Claves con las que lo buscado **viajaba** en la URL; sólo se leen para migrar. */
const LEGACY_SEARCH_PARAM = 'q';
const LEGACY_DOCUMENT_PARAM = 'nationalId';

/** Entrada de esta pantalla en {@link SearchMemoryService}. */
const SEARCH_MEMORY_SCREEN = 'clinical-record';

/**
 * **Archivo clínico** (M08 + M15) — la puerta al expediente de una persona.
 *
 * ## Por qué esta pantalla elige y no muestra
 *
 * Las dos lecturas del expediente piden el perfil en la ruta
 * (`GET /clinical/patients/:id/summary` y `GET /charts/patients/:id/chart`): no
 * existe «el archivo clínico» como colección, y no es una omisión del backend —
 * la lista de todas las historias de una organización es exactamente el dato que
 * no debe existir como pantalla.
 *
 * ## Quién busca, y qué ve (TAREA-07, P-07-10 — 2026-09-02)
 *
 * `GET /profiles/patients` era exclusivo de `SECURITY_ADMIN`. Ahora también
 * pueden buscar `CLINICIAN` y `PRACTITIONER`, y ven el **padrón entero, sin
 * acotar** — una primera versión de hoy los acotó a la gente con actividad en
 * su organización, revertida porque la búsqueda también sirve para
 * **registrar** a quien nunca se atendió, y acotar por actividad se lo
 * impedía. `resolvePatientSearchScope()`, del lado de la API, documenta la
 * marcha atrás.
 *
 * Sin acotamiento, listar sin ningún criterio sería enumerar el padrón: por
 * eso esta pantalla **no dispara la búsqueda al montar** si no hay texto ni
 * documento en la URL — muestra un vacío inicial que invita a escribir en vez
 * de pedir la primera página. La API además responde `422` a un rol clínico
 * sin criterio (`requiereCriterioDeBusqueda()`); esta pantalla evita llegar
 * a pedirlo.
 *
 * Antes esta pantalla tenía un segundo camino —«Abrir por identificador»— para
 * cuando el buscador respondía `403` a un rol clínico. Ese camino ya no hace
 * falta: la búsqueda es ahora el camino de todos los roles que llegan acá, y
 * mantener el atajo hubiera sido dos formas de hacer lo mismo.
 *
 * Un `403` inesperado (un rol que esta pantalla no anticipa) lo sigue
 * mostrando `app-data-table` con el estado `forbidden` del M34: no hace falta
 * reimplementarlo acá.
 *
 * ## Sin desempate por departamento (P-07-3, cerrada 2026-09-24)
 *
 * AC-07-2 desempataba por departamento de expedición porque el número de
 * carnet podía repetirse entre departamentos. El propietario confirmó que
 * SEGIP no reemite un mismo número: no hay dos personas con el mismo
 * documento, así que el filtro sobraba y se quitó junto con el catálogo de
 * departamentos que lo alimentaba.
 *
 * ## Lo buscado no va en la URL (2026-09-26)
 *
 * El nombre o código (`q`) y el documento (`nationalId`) vivían en la URL de
 * esta pantalla, y con ellos el dato de una persona quedaba en el historial
 * del navegador, en el log del servidor que sirve la aplicación al recargar y
 * en el `Referer`. Ahora viven en dos signals respaldados por
 * `SearchMemoryService` (memoria de la pestaña, atada a la sesión): volver
 * desde el expediente encuentra la búsqueda como estaba, sin escribirla en
 * ningún lado. Un enlace viejo con `?q=`/`?nationalId=` se migra a memoria y
 * se saca de la barra; «Volver a buscar» apunta a esta misma ruta, el router
 * la descarta (`NavigationSkipped`) y la pantalla lo toma como «empezar de
 * nuevo».
 */
@Component({
  selector: 'app-clinical-record',
  imports: [
    AppButton,
    AppButtonLink,
    DataTable,
    FormField,
    Input,
    NavIcon,
    PageHeader,
    RouterLink,
    SearchField,
    Tooltip,
  ],
  templateUrl: './clinical-record.html',
  styleUrl: './clinical-record.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClinicalRecord {
  private readonly profiles = inject(ProfilesClient);
  private readonly navigation = inject(NavigationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly searchMemory = inject(SearchMemoryService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  /** Lo buscado al entrar: la memoria, o un enlace viejo que lo traía en la URL. */
  private readonly inicial = this.initialCriteria();

  private readonly celdaPaciente =
    viewChild.required<TemplateRef<{ $implicit: PatientListItem }>>('celdaPaciente');
  private readonly celdaAccion =
    viewChild.required<TemplateRef<{ $implicit: PatientListItem }>>('celdaAccion');
  private readonly celdaDocumento =
    viewChild.required<TemplateRef<{ $implicit: PatientListItem }>>('celdaDocumento');
  private readonly celdaTelefono =
    viewChild.required<TemplateRef<{ $implicit: PatientListItem }>>('celdaTelefono');

  protected readonly resultados = signal<ViewState<readonly PatientListItem[]>>(loading());

  /** El filtro por nombre o código. Vacío es «sin filtro». */
  protected readonly busqueda = signal(this.inicial.q);

  /** El documento exacto buscado (AC-07-1). */
  protected readonly documento = signal(this.inicial.nationalId);

  /** Lo tecleado en el campo de documento. No busca hasta enviarse. */
  protected readonly documentoTecleado = signal(this.inicial.nationalId);

  protected readonly cargando = computed(() => this.resultados().status === 'loading');

  protected readonly columnas = computed<readonly ColumnDef<PatientListItem>[]>(() => [
    { key: 'displayName', header: 'Paciente', priority: 1, cell: this.celdaPaciente() },
    // Documento y teléfono en lugar del código interno y del identificador del
    // perfil (propietario, 19/09/2026): un uuid no le dice nada a quien
    // atiende, y el carnet y el celular son con lo que reconoce y llama a la
    // persona.
    { key: 'nationalId', header: 'Documento', priority: 1, cell: this.celdaDocumento() },
    { key: 'phone', header: 'Teléfono', priority: 2, cell: this.celdaTelefono() },
    // Contra el final de la fila: son las acciones, y una columna de acciones
    // alineada al principio deja un canalón vacío entre el dato y el botón.
    {
      key: 'accion',
      header: 'Expediente',
      priority: 1,
      align: 'end',
      cell: this.celdaAccion(),
    },
  ]);

  protected readonly porPaciente = (fila: PatientListItem): string => fila.profileId;
  /** Nombre de la fila para el lector de pantalla (`rowLabel` de la tabla). */
  protected readonly nombreDePaciente = (fila: PatientListItem): string => fila.displayName ?? '';

  /**
   * Cómo nombrar a la persona en el nombre accesible de una acción.
   *
   * Los botones de la fila son íconos: sin esto, un lector de pantalla leería
   * «Ver expediente» veinticinco veces seguidas sin decir de quién.
   *
   * Se apoya en `nombreDePaciente` para no tener dos ideas de cómo se llama la
   * misma fila, pero **no** puede quedarse con su vacío: «Ver el expediente
   * de » no nombra a nadie. Cuando no hay nombre cae al código y, si tampoco,
   * al identificador — feo, pero distingue una fila de la siguiente.
   */
  protected nombreDe(paciente: PatientListItem): string {
    return this.nombreDePaciente(paciente) || (paciente.patientCode ?? paciente.profileId);
  }

  constructor() {
    effect(() => {
      this.busqueda();
      this.documento();
      untracked(() => this.cargar());
    });

    // «Volver a buscar» (y cualquier enlace a esta misma ruta) no cambia la
    // URL: el router lo descarta, y es la señal de empezar de nuevo.
    this.router.events
      .pipe(
        filter((event): event is NavigationSkipped => event instanceof NavigationSkipped),
        filter((event) => event.url.split('?')[0] === CLINICAL_RECORD_ROUTE),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.documentoTecleado.set('');
        this.aplicar('', '');
      });
  }

  /**
   * La búsqueda por nombre; el efecto hace el resto.
   *
   * ## Por qué el texto vacío no toca el documento
   *
   * Porque si no, **la búsqueda por documento se deshacía sola** cuando antes
   * se había buscado por nombre: buscar por documento vacía el campo de
   * nombre, el campo al vaciarse avisa con texto vacío, y ese aviso borraba
   * el documento recién puesto. Buscar por nombre con texto sí limpia el
   * documento: son dos formas de encontrar a la misma persona, no dos filtros
   * que se suman.
   */
  protected buscar(texto: string): void {
    this.aplicar(texto, texto === '' ? this.documento() : '');
  }

  /** El campo admite número por contrato; acá siempre es texto. */
  protected fijarDocumento(valor: string | number | null): void {
    this.documentoTecleado.set(valor === null ? '' : String(valor));
  }

  /**
   * Publica el documento en la URL. Es un envío explícito y no un filtro en
   * vivo: un carnet a medio teclear no debe buscar.
   *
   * Limpia `q` a propósito: documento y nombre son dos formas de encontrar a
   * la misma persona, no dos filtros que se combinan — combinarlos AND haría
   * que buscar por documento exigiera además que el nombre coincida.
   */
  protected buscarPorDocumento(): void {
    const documento = this.documentoTecleado().trim();
    if (documento === '') {
      return;
    }
    this.aplicar('', documento);
  }

  /** Fija los dos criterios y los deja en memoria, nunca en la URL. */
  private aplicar(q: string, nationalId: string): void {
    this.searchMemory.write(SEARCH_MEMORY_SCREEN, { q, nationalId });
    this.busqueda.set(q);
    this.documento.set(nationalId);
  }

  /**
   * Los criterios de arranque. Un enlace viejo con `?q=` o `?nationalId=`
   * gana sobre la memoria —es lo que la persona acaba de abrir— y se saca de
   * la URL en el acto, con `replaceUrl` para que tampoco quede en el
   * historial de la pestaña.
   */
  private initialCriteria(): { q: string; nationalId: string } {
    const params = this.route.snapshot.queryParamMap;
    const legacyQ = params.get(LEGACY_SEARCH_PARAM);
    const legacyDocument = params.get(LEGACY_DOCUMENT_PARAM);
    if (legacyQ === null && legacyDocument === null) {
      const saved = this.searchMemory.read(SEARCH_MEMORY_SCREEN);
      return { q: saved['q'] ?? '', nationalId: saved['nationalId'] ?? '' };
    }
    // Como antes en la URL: el documento gana sobre el nombre.
    const criteria =
      legacyDocument !== null && legacyDocument !== ''
        ? { q: '', nationalId: legacyDocument }
        : { q: legacyQ ?? '', nationalId: '' };
    this.searchMemory.write(SEARCH_MEMORY_SCREEN, criteria);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { [LEGACY_SEARCH_PARAM]: null, [LEGACY_DOCUMENT_PARAM]: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    return criteria;
  }

  protected recargar(): void {
    this.cargar();
  }

  /** La ruta del expediente de un paciente. */
  protected rutaDe(profileId: string): string {
    return patientChartRoute(profileId);
  }

  /** FT-07-R05: la ruta para pedirle el vínculo a esta persona. */
  protected rutaSolicitarAcceso(profileId: string): string {
    return requestAccessRoute(profileId);
  }

  private cargar(): void {
    const documento = this.documento();
    const texto = this.busqueda();

    // P-07-10: sin acotamiento por actividad, listar sin criterio sería
    // enumerar el padrón entero. Un rol clínico ya recibe 422 del backend
    // (`requiereCriterioDeBusqueda()`); acá se evita llegar a pedirlo.
    if (documento === '' && texto === '') {
      this.resultados.set(
        empty(
          { label: 'Escribí un nombre, un código o un documento arriba' },
          'Buscá por nombre, código o documento para ver a una persona.',
        ),
      );
      return;
    }

    this.resultados.set(loading());

    const criterio = documento !== '' ? { nationalId: documento } : { query: texto };

    this.profiles.searchPatients({ limit: TOPE, ...criterio }).subscribe({
      next: (pagina) => {
        if (pagina.items.length > 0) {
          this.resultados.set(ready(pagina.items));
          return;
        }

        // P-07-10: el padrón ya no está acotado por actividad, así que un
        // resultado vacío significa que la persona no existe con ese dato
        // exacto — no hace falta la aclaración de alcance que llevaba antes.
        this.resultados.set(
          documento !== ''
            ? empty(
                { label: 'Volver a buscar', route: CLINICAL_RECORD_ROUTE },
                `Nadie tiene el documento «${documento}».`,
              )
            : empty(
                { label: 'Volver a buscar', route: CLINICAL_RECORD_ROUTE },
                `Nadie coincide con «${texto}».`,
              ),
        );
      },
      error: (error: unknown) =>
        this.resultados.set(errorToViewState<readonly PatientListItem[]>(error)),
    });
  }
}
