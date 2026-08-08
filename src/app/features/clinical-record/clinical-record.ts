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
import { errorToViewState } from '../../core/http/error-to-view-state';
import { NavigationService } from '../../core/navigation/navigation.service';
import { empty, loading, ready } from '../../core/view-state/view-state';
import type { ViewState } from '../../core/view-state/view-state.types';
import { AppButton } from '../../shared/components/atoms/button/button';
import { Input } from '../../shared/components/atoms/input/input';
import { Link } from '../../shared/components/atoms/link/link';
import { Card } from '../../shared/components/molecules/card/card';
import { FormField } from '../../shared/components/molecules/form-field/form-field';
import { SearchField } from '../../shared/components/molecules/search-field/search-field';
import { DataTable } from '../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../shared/components/organisms/page-header/page-header';

/** Tope de filas del buscador. La API pagina por cursor; acá alcanza una página. */
const TOPE = 25;

/** La ruta base de la sección. */
export const CLINICAL_RECORD_ROUTE = '/clinico';

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
 * ## Dos caminos hacia el mismo expediente, y por qué hacen falta los dos
 *
 * **Buscar por nombre** usa `GET /profiles/patients`, que pide `SECURITY_ADMIN`.
 * **Abrir por identificador** no pide nada: es el camino de quien atiende, que
 * llega con el identificador desde su agenda y a quien el buscador le
 * respondería `403`.
 *
 * Si el buscador queda prohibido, la pantalla **no se cae**: el estado S5 se
 * pinta en su tabla y el campo de identificador sigue ahí. Un archivo clínico
 * que se vuelve inútil para el rol clínico —el único que puede leerlo— sería
 * exactamente el error opuesto al que se quiso evitar.
 */
@Component({
  selector: 'app-clinical-record',
  imports: [
    AppButton,
    Card,
    DataTable,
    FormField,
    Input,
    Link,
    PageHeader,
    RouterLink,
    SearchField,
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

  /** El filtro vigente, leído de la URL. Vacío es «sin filtro», no «buscar nada». */
  protected readonly busqueda = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('q') ?? '')),
    { initialValue: '' },
  );

  /** Lo tecleado en «abrir por identificador». No viaja a la URL: es de un uso. */
  protected readonly identificador = signal('');

  /** El campo admite número por contrato; acá siempre es texto. */
  protected fijarIdentificador(valor: string | number | null): void {
    this.identificador.set(valor === null ? '' : String(valor));
  }

  protected readonly cargando = computed(() => this.resultados().status === 'loading');

  /**
   * Si el buscador quedó prohibido para esta sesión.
   *
   * Se lee del estado y no de los roles: la autoridad sobre qué puede leerse es
   * la respuesta del backend, y duplicar su tabla de roles acá garantizaría que
   * un día digan cosas distintas.
   */
  protected readonly buscadorProhibido = computed(() => this.resultados().status === 'forbidden');

  protected readonly columnas = computed<readonly ColumnDef<PatientListItem>[]>(() => [
    { key: 'displayName', header: 'Paciente', priority: 1, cell: this.celdaPaciente() },
    { key: 'patientCode', header: 'Código', priority: 2 },
    { key: 'accion', header: 'Expediente', priority: 1, cell: this.celdaAccion() },
  ]);

  protected readonly porPaciente = (fila: PatientListItem): string => fila.profileId;

  constructor() {
    effect(() => {
      this.busqueda();
      untracked(() => this.cargar());
    });
  }

  /** La búsqueda se publica en la URL; el efecto hace el resto. */
  protected buscar(texto: string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: texto === '' ? {} : { q: texto },
      // Reemplaza en vez de apilar: cada tecleo no es un paso del historial.
      replaceUrl: true,
    });
  }

  protected recargar(): void {
    this.cargar();
  }

  /** La ruta del expediente de un paciente. */
  protected rutaDe(profileId: string): string {
    return `${CLINICAL_RECORD_ROUTE}/${profileId}`;
  }

  /**
   * Abre el expediente por identificador.
   *
   * Sin validar la forma del uuid a mano: el backend responde `400` a un
   * identificador mal formado y `404` a uno que no existe, y el expediente
   * muestra los dos como corresponde. Repetir la validación acá sólo agregaría
   * un segundo lugar donde equivocarse.
   */
  protected abrirPorIdentificador(): void {
    const id = this.identificador().trim();
    if (id === '') {
      return;
    }
    void this.router.navigateByUrl(this.rutaDe(encodeURIComponent(id)));
  }

  private cargar(): void {
    this.resultados.set(loading());

    const texto = this.busqueda();

    this.profiles
      .searchPatients({ limit: TOPE, ...(texto === '' ? {} : { query: texto }) })
      .subscribe({
        next: (pagina) => {
          if (pagina.items.length > 0) {
            this.resultados.set(ready(pagina.items));
            return;
          }

          this.resultados.set(
            texto === ''
              ? empty(
                  { label: 'Ir a Pacientes', route: '/administracion/pacientes' },
                  'Todavía no hay pacientes registrados en esta organización.',
                )
              : empty(
                  { label: 'Ver todos', route: CLINICAL_RECORD_ROUTE },
                  `Ningún paciente coincide con «${texto}».`,
                ),
          );
        },
        error: (error: unknown) =>
          this.resultados.set(errorToViewState<readonly PatientListItem[]>(error)),
      });
  }
}
