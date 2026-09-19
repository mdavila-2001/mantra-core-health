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
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';

import { ProfilesClient } from '../../core/data-access/profiles/profiles.client';
import type { PatientListItem } from '../../core/data-access/profiles/profiles.types';
import { BoDepartmentsCatalog } from '../../core/data-access/terminology/bo-departments.service';
import type { ValueSetOption } from '../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../core/http/error-to-view-state';
import { NavigationService } from '../../core/navigation/navigation.service';
import { empty, loading, ready } from '../../core/view-state/view-state';
import type { ViewState } from '../../core/view-state/view-state.types';
import { AppButton } from '../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../shared/components/atoms/button/button-link';
import { Input } from '../../shared/components/atoms/input/input';
import { NavIcon } from '../../shared/components/atoms/nav-icon/nav-icon';
import { Select } from '../../shared/components/atoms/select/select';
import { Tooltip } from '../../shared/components/atoms/tooltip/tooltip';
import type { SelectOption } from '../../shared/components/atoms/select/select.types';
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
    Select,
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

  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  private readonly celdaPaciente =
    viewChild.required<TemplateRef<{ $implicit: PatientListItem }>>('celdaPaciente');
  private readonly celdaAccion =
    viewChild.required<TemplateRef<{ $implicit: PatientListItem }>>('celdaAccion');

  protected readonly resultados = signal<ViewState<readonly PatientListItem[]>>(loading());

  /** El filtro por nombre o código, leído de la URL. Vacío es «sin filtro». */
  protected readonly busqueda = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('q') ?? '')),
    { initialValue: '' },
  );

  /** El documento exacto, leído de la URL (AC-07-1). */
  protected readonly documento = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('nationalId') ?? '')),
    { initialValue: '' },
  );

  /**
   * El departamento que lo expidió, leído de la URL (AC-07-2).
   *
   * Sólo tiene efecto junto al documento: un carnet sin departamento no es
   * único en Bolivia, pero el campo del modelo es nullable, así que se ofrece
   * como filtro opcional, no obligatorio (P-07-3 sigue abierta con el
   * propietario; mientras tanto, se trata como desempate).
   */
  protected readonly departamento = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('issuerAdministrativeAreaConceptId'))),
    { initialValue: null },
  );

  /** Lo tecleado en el campo de documento. No viaja a la URL hasta enviarse. */
  protected readonly documentoTecleado = signal('');

  /** Lo elegido en el desplegable de departamento. Mismo criterio. */
  protected readonly departamentoElegido = signal<string | null>(null);

  private readonly departamentos = inject(BoDepartmentsCatalog);

  /** Los nueve departamentos de Bolivia, para el desplegable del documento. */
  protected readonly opcionesDeDepartamento = signal<readonly SelectOption<string>[]>([]);

  protected readonly cargando = computed(() => this.resultados().status === 'loading');

  protected readonly columnas = computed<readonly ColumnDef<PatientListItem>[]>(() => [
    { key: 'displayName', header: 'Paciente', priority: 1, cell: this.celdaPaciente() },
    { key: 'patientCode', header: 'Código', priority: 2 },
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
      this.departamento();
      untracked(() => this.cargar());
    });

    // El desplegable es opcional y no bloquea la búsqueda por nombre: si el
    // catálogo tarda o falla, el campo de documento sigue usable sin él.
    this.departamentos.listar().subscribe({
      next: (opciones) => this.opcionesDeDepartamento.set(opciones.map(toSelectOption)),
      error: () => this.opcionesDeDepartamento.set([]),
    });
  }

  /**
   * La búsqueda por nombre se publica en la URL; el efecto hace el resto.
   *
   * ## Por qué fusiona en vez de reemplazar el mapa entero
   *
   * Porque si no, **la búsqueda por documento se deshacía sola** cuando antes
   * se había buscado por nombre. La cadena era: el botón publica el documento
   * y limpia `q` → el campo de nombre está atado a `q`, así que se vacía de
   * rebote → al vaciarse avisa con texto vacío → y ese aviso llegaba acá y
   * escribía el mapa de parámetros entero, borrando el `nationalId` recién
   * puesto. Se veía como que el botón no hacía nada: la URL quedaba pelada y
   * la tabla volvía al vacío inicial.
   *
   * Con `merge`, el eco sólo borra `q`, que ya estaba vacío, y el documento
   * sobrevive. Buscar por nombre con texto sí limpia el documento: son dos
   * formas de encontrar a la misma persona, no dos filtros que se suman.
   */
  protected buscar(texto: string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams:
        texto === ''
          ? { q: null }
          : { q: texto, nationalId: null, issuerAdministrativeAreaConceptId: null },
      queryParamsHandling: 'merge',
      // Reemplaza en vez de apilar: cada tecleo no es un paso del historial.
      replaceUrl: true,
    });
  }

  /** El campo admite número por contrato; acá siempre es texto. */
  protected fijarDocumento(valor: string | number | null): void {
    this.documentoTecleado.set(valor === null ? '' : String(valor));
  }

  /**
   * Publica el documento (y su departamento) en la URL. Es un envío explícito
   * y no un filtro en vivo: un carnet a medio teclear no debe buscar.
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
    const area = this.departamentoElegido();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: null,
        nationalId: documento,
        issuerAdministrativeAreaConceptId: area ?? null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
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
    const area = this.departamento();

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

    const criterio =
      documento !== ''
        ? { nationalId: documento, ...(area ? { issuerAdministrativeAreaConceptId: area } : {}) }
        : { query: texto };

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
                `Nadie tiene el documento «${documento}»` +
                  (area ? ' expedido en ese departamento.' : '.'),
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

/** `ValueSetOption` → `SelectOption`, para el desplegable de departamento. */
function toSelectOption(opcion: ValueSetOption): SelectOption<string> {
  return { value: opcion.conceptId, label: opcion.display };
}
