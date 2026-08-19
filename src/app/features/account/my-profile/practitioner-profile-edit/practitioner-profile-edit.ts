import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ProfilesClient } from '../../../../core/data-access/profiles/profiles.client';
import { MedicalSpecialtiesCatalog } from '../../../../core/data-access/terminology/medical-specialties.service';
import type { OwnPractitionerProfile } from '../../../../core/data-access/profiles/profiles.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { NavigationService } from '../../../../core/navigation/navigation.service';
import { loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Input } from '../../../../shared/components/atoms/input/input';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { Switch } from '../../../../shared/components/atoms/switch/switch';
import { Textarea } from '../../../../shared/components/atoms/textarea/textarea';
import { Card } from '../../../../shared/components/molecules/card/card';
import { ConceptSelect } from '../../../../shared/components/molecules/concept-select/concept-select';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { FormActions } from '../../../../shared/components/organisms/form-actions/form-actions';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';

/** El campo de la jurisdicción, del catálogo dinámico. */
const TARGET_MATRICULA = 'profiles.jurisdiction_authorizations.jurisdiction_concept_id';

/**
 * **Configurar el perfil profesional** — título, biografía, disponibilidad,
 * especialidades y matrículas.
 *
 * ## Por qué es una pantalla aparte y no un modo de edición del perfil
 *
 * El perfil (`practitioner-profile`) es de **lectura**: una trayectoria que se
 * muestra tal como quedó. Editar es otra intención — hay que decidir qué
 * cambiar, ver el resultado antes de guardarlo, y no perder de vista lo que
 * todavía no se guardó. Mezclar las dos en un solo componente con un booleano
 * `editando` es la forma clásica de terminar con un formulario que se dibuja
 * encima de sí mismo.
 *
 * ## Tres formularios independientes, no uno
 *
 * **Presentación** (título, biografía, disponibilidad) se **edita**: es un
 * `PATCH` sobre el mismo registro. **Especialidad** y **matrícula** sólo se
 * **agregan**: no hay edición porque una especialidad verificada es un hecho
 * comprobado contra una credencial, y una matrícula es una autorización de un
 * tercero. Permitir «corregir» cualquiera de las dos sin pasar de nuevo por la
 * verificación vaciaría de sentido el propio verbo «verificar». Por eso son tres
 * envíos separados y no un único `guardar()`: cada uno tiene su propio
 * significado y su propio momento.
 */
@Component({
  selector: 'app-practitioner-profile-edit',
  imports: [
    AppButton,
    Card,
    ConceptSelect,
    FormActions,
    FormField,
    Input,
    PageHeader,
    RouterLink,
    Select,
    Switch,
    Textarea,
    ViewStateHost,
  ],
  templateUrl: './practitioner-profile-edit.html',
  styleUrl: './practitioner-profile-edit.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PractitionerProfileEdit {
  private readonly profiles = inject(ProfilesClient);
  private readonly toasts = inject(ToastService);
  private readonly navigation = inject(NavigationService);
  private readonly catalogo = inject(MedicalSpecialtiesCatalog);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  protected readonly perfil = signal<ViewState<OwnPractitionerProfile>>(loading());

  private readonly datos = computed(() => {
    const estado = this.perfil();
    return estado.status === 'ready' ? estado.data : null;
  });

  protected readonly profileId = computed(() => this.datos()?.profileId ?? null);

  /* -- Presentación: título, biografía, disponibilidad --------------------- */

  protected readonly titulo = signal('');
  protected readonly bio = signal('');
  protected readonly aceptaNuevos = signal(false);
  protected readonly telemedicina = signal(false);
  protected readonly guardandoPresentacion = signal(false);

  protected readonly bioLargoMaximo = 4000;

  /* -- Nueva especialidad ---------------------------------------------------- */

  /**
   * Las especialidades elegibles (TJ-3 · F-19).
   *
   * Salen de `VS_MEDICAL_SPECIALTY` —las 36 del modelo, en castellano— y no del
   * `app-concept-select` por campo destino, que resuelve a un conjunto de la
   * API con una sola opción en inglés. Ver `MedicalSpecialtiesCatalog`.
   */
  protected readonly especialidades = signal<readonly SelectOption<string>[]>([]);

  /** El catálogo no se pudo leer: se lo dice, no se ofrece un desplegable vacío. */
  protected readonly catalogoCaido = signal(false);

  protected readonly nuevaEspecialidad = signal<string | null>(null);
  protected readonly nuevaEspecialidadPrincipal = signal(false);
  protected readonly nuevaEspecialidadCertificada = signal(false);
  protected readonly guardandoEspecialidad = signal(false);

  protected readonly puedeAgregarEspecialidad = computed(() => this.nuevaEspecialidad() !== null);

  /* -- Nueva matrícula --------------------------------------------------------- */

  protected readonly targetMatricula = TARGET_MATRICULA;
  protected readonly nuevaJurisdiccion = signal<string | null>(null);
  protected readonly nuevoNumeroDeMatricula = signal('');
  protected readonly nuevaAutoridad = signal('');
  protected readonly guardandoMatricula = signal(false);

  protected readonly puedeAgregarMatricula = computed(
    () => this.nuevoNumeroDeMatricula().trim() !== '',
  );

  constructor() {
    this.cargar();
    this.cargarEspecialidades();
  }

  /**
   * Trae el catálogo de especialidades.
   *
   * Un fallo no rompe la pantalla: el resto —título, biografía, matrículas—
   * sigue siendo editable, y el bloque de especialidad dice qué pasó y ofrece
   * reintentar. Perder el catálogo no es perder el perfil.
   */
  protected cargarEspecialidades(): void {
    this.catalogo.listar().subscribe({
      next: (opciones) => {
        this.catalogoCaido.set(false);
        this.especialidades.set(
          opciones.map((opcion) => ({ value: opcion.conceptId, label: opcion.display })),
        );
      },
      error: () => {
        this.especialidades.set([]);
        this.catalogoCaido.set(true);
      },
    });
  }

  /**
   * Reintenta la lectura del catálogo.
   *
   * Olvida lo cacheado antes de pedir: `shareReplay` guarda también el error,
   * así que sin esto el botón «Reintentar» repetiría el mismo fallo sin llegar
   * a tocar la red.
   */
  protected reintentarEspecialidades(): void {
    this.catalogo.olvidar();
    this.cargarEspecialidades();
  }

  protected recargar(): void {
    this.cargar();
  }

  private cargar(): void {
    this.perfil.set(loading());
    this.profiles.getOwnPractitionerProfile().subscribe({
      next: (perfil) => {
        this.sembrarFormulario(perfil);
        this.perfil.set(ready(perfil));
      },
      error: (error: unknown) => this.perfil.set(errorToViewState<OwnPractitionerProfile>(error)),
    });
  }

  /**
   * Llena el formulario con lo que ya hay guardado.
   *
   * Sólo al cargar, no en cada cambio del perfil: si un `computed` volviera a
   * sembrar el formulario cada vez que `perfil` cambia, escribir en un campo
   * mientras la pantalla revalida perdería lo que la persona acaba de teclear.
   */
  private sembrarFormulario(perfil: OwnPractitionerProfile): void {
    this.titulo.set(perfil.professionalTitle ?? '');
    this.bio.set(perfil.professionalBio ?? '');
    this.aceptaNuevos.set(perfil.acceptsNewPatients);
    this.telemedicina.set(perfil.telehealthAvailable);
  }

  /**
   * Guarda la presentación.
   *
   * Sólo se manda lo que cambió respecto de lo cargado: mandar los cuatro
   * campos siempre funcionaría igual —es un `PATCH` idempotente— pero mandar
   * sólo el cambio dice, en la petición misma, qué fue lo que la persona quiso
   * tocar, y eso es lo que el registro de auditoría del backend termina
   * mostrando.
   */
  protected guardarPresentacion(): void {
    const original = this.datos();
    if (original === null || this.guardandoPresentacion()) {
      return;
    }

    const cambios: Partial<{
      professionalTitle: string;
      professionalBio: string;
      acceptsNewPatients: boolean;
      telehealthAvailable: boolean;
    }> = {};
    if (this.titulo() !== (original.professionalTitle ?? '')) {
      cambios.professionalTitle = this.titulo();
    }
    if (this.bio() !== (original.professionalBio ?? '')) {
      cambios.professionalBio = this.bio();
    }
    if (this.aceptaNuevos() !== original.acceptsNewPatients) {
      cambios.acceptsNewPatients = this.aceptaNuevos();
    }
    if (this.telemedicina() !== original.telehealthAvailable) {
      cambios.telehealthAvailable = this.telemedicina();
    }

    if (Object.keys(cambios).length === 0) {
      this.toasts.success('No había ningún cambio para guardar.', 'Perfil');
      return;
    }

    this.guardandoPresentacion.set(true);
    this.profiles.updateOwnPractitionerProfile(cambios).subscribe({
      next: (perfil) => {
        this.guardandoPresentacion.set(false);
        this.sembrarFormulario(perfil);
        this.perfil.set(ready(perfil));
        this.toasts.success('Tu perfil quedó actualizado.', 'Perfil');
      },
      error: () => {
        this.guardandoPresentacion.set(false);
        this.toasts.error('No se pudo guardar el cambio. Probá de nuevo.', 'Perfil');
      },
    });
  }

  protected agregarEspecialidad(): void {
    const profileId = this.profileId();
    const especialidad = this.nuevaEspecialidad();
    if (profileId === null || especialidad === null || this.guardandoEspecialidad()) {
      return;
    }

    this.guardandoEspecialidad.set(true);
    this.profiles
      .addSpecialty(profileId, {
        specialtyConceptId: especialidad,
        isPrimary: this.nuevaEspecialidadPrincipal(),
        boardCertified: this.nuevaEspecialidadCertificada(),
      })
      .subscribe({
        next: () => {
          this.guardandoEspecialidad.set(false);
          this.nuevaEspecialidad.set(null);
          this.nuevaEspecialidadPrincipal.set(false);
          this.nuevaEspecialidadCertificada.set(false);
          this.toasts.success(
            'Se agregó la especialidad. Queda pendiente de verificación.',
            'Especialidades',
          );
          this.cargar();
        },
        error: () => {
          this.guardandoEspecialidad.set(false);
          this.toasts.error(
            'No se pudo agregar la especialidad. Probá de nuevo.',
            'Especialidades',
          );
        },
      });
  }

  protected agregarMatricula(): void {
    const profileId = this.profileId();
    const numero = this.nuevoNumeroDeMatricula().trim();
    if (profileId === null || numero === '' || this.guardandoMatricula()) {
      return;
    }

    this.guardandoMatricula.set(true);
    this.profiles
      .addJurisdictionAuthorization(profileId, {
        licenseNumber: numero,
        jurisdictionConceptId: this.nuevaJurisdiccion() ?? undefined,
        regulatoryAuthority: this.nuevaAutoridad().trim() || undefined,
      })
      .subscribe({
        next: () => {
          this.guardandoMatricula.set(false);
          this.nuevaJurisdiccion.set(null);
          this.nuevoNumeroDeMatricula.set('');
          this.nuevaAutoridad.set('');
          this.toasts.success(
            'Se agregó la matrícula. Queda pendiente de verificación.',
            'Matrículas',
          );
          this.cargar();
        },
        error: () => {
          this.guardandoMatricula.set(false);
          this.toasts.error('No se pudo agregar la matrícula. Probá de nuevo.', 'Matrículas');
        },
      });
  }
}
