import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { FilesClient } from '../../../../core/data-access/files/files.client';
import { ProfilesClient } from '../../../../core/data-access/profiles/profiles.client';
import { BoMunicipalitiesCatalog } from '../../../../core/data-access/terminology/bo-municipalities.service';
import type { RamaDepartamento } from '../../../../core/data-access/terminology/bo-municipalities.service';
import { LocationPicker } from '../../../auth/registro-compartido/location-picker/location-picker';
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
import { FileInput } from '../../../../shared/components/molecules/file-input/file-input';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import {
  OPCIONES_TITULO_PROFESIONAL,
  esTituloDeLaLista,
} from '../../../../core/profesion/titulos-profesionales';
import {
  UbicacionPicker,
  type Coordenadas,
  type IdsDePrueba,
} from '../../../auth/registro-compartido/ubicacion-picker/ubicacion-picker';
import { DatePicker } from '../../../../shared/components/organisms/date-picker/date-picker';
import { FormActions } from '../../../../shared/components/organisms/form-actions/form-actions';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';

/** El campo de la jurisdicción, del catálogo dinámico. */
const TARGET_MATRICULA = 'profiles.jurisdiction_authorizations.jurisdiction_concept_id';

/** El tipo de título (formación), del catálogo dinámico: los cinco `CREDENTIAL_TYPE_*`. */
const TARGET_CREDENCIAL = 'profiles.professional_credentials.credential_type_concept_id';

/** `Date` → ISO `YYYY-MM-DD`, tal como lo esperan los DTO del backend. */
function fechaIso(fecha: Date): string {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

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
/**
 * La fecha como `YYYY-MM-DD` con componentes **locales** — el mismo espejo de
 * `maybeDateOnly` que usa el historial laboral. `toISOString()` pasaría por
 * UTC y en Bolivia devolvería el día anterior.
 */
function soloFecha(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

@Component({
  selector: 'app-practitioner-profile-edit',
  imports: [
    AppButton,
    Card,
    ConceptSelect,
    DatePicker,
    FormActions,
    FileInput,
    FormField,
    Input,
    LocationPicker,
    PageHeader,
    RouterLink,
    Select,
    Switch,
    Textarea,
    UbicacionPicker,
    ViewStateHost,
  ],
  templateUrl: './practitioner-profile-edit.html',
  styleUrl: './practitioner-profile-edit.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PractitionerProfileEdit {
  private readonly profiles = inject(ProfilesClient);
  private readonly files = inject(FilesClient);
  private readonly toasts = inject(ToastService);
  private readonly navigation = inject(NavigationService);
  private readonly catalogo = inject(MedicalSpecialtiesCatalog);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  private readonly municipios = inject(BoMunicipalitiesCatalog);

  /* -- ALV-003: los dos datos del contrato que no tenían control ---------- */

  /** Fecha de nacimiento: se ve en la ficha, ahora también se edita. */
  protected readonly fechaNacimiento = signal<Date | null>(null);
  /** Localidad de residencia (concept id de `VS_BO_MUNICIPALITY`). */
  protected readonly municipioResidencia = signal<string | null>(null);
  /** El árbol de departamentos y municipios, para el picker de residencia. */
  protected readonly ramasMunicipios = signal<readonly RamaDepartamento[]>([]);
  protected readonly catalogoMunicipiosCaido = signal(false);

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

  /* -- Los datos personales, que hasta ahora no se podían corregir ---------
     Se declaran al registrarse y despues no habia forma de tocarlos: quien se
     equivocaba en su apellido lo arrastraba. Mismo alcance que ya tiene el
     paciente. El documento y el correo NO estan: el primero es un identificador
     oficial con su circuito, el segundo es la credencial de acceso. */
  protected readonly nombre = signal('');
  protected readonly segundoNombre = signal('');
  protected readonly apellidoPaterno = signal('');
  protected readonly apellidoMaterno = signal('');
  /* Los cuatro contactos que el alta pide por separado. El de trabajo y el
     privado dejaron de ser el mismo dato, así que el perfil también los
     distingue: cada uno se guarda en su propia fila de puntos de contacto. */
  protected readonly celularPersonal = signal('');
  protected readonly celularTrabajo = signal('');
  protected readonly fijoTrabajo = signal('');
  protected readonly correoPersonal = signal('');
  /**
   * La calle, ALV-009.
   *
   * Va con el resto de «Presentación» y no en un formulario aparte: es el
   * mismo criterio que el municipio de arriba, un dato que se corrige, no
   * que se agrega de nuevo cada vez. Antes pegaba un `POST /common/addresses`
   * suelto con dueño `USER` que ninguna lectura buscaba —«guardar y
   * recargar» seguía sin mostrarla—; ahora es `homeAddressLines` del mismo
   * `PATCH`, y el backend la lee de vuelta en el resumen.
   */
  protected readonly direccion = signal('');

  /**
   * El punto del domicilio en el mapa — lo que el alta ya preguntaba
   * (`gpsDomicilio`) y el editor no dejaba tocar.
   *
   * El contrato de `PATCH /profiles/practitioners/me` **ya aceptaba**
   * `homeLatitude`/`homeLongitude`: lo que faltaba era la pantalla. Mismos tres
   * estados que en el editor del paciente: sin tocar no viaja, quitado viaja
   * como par de `null`, movido viaja como par.
   */
  protected readonly gpsDomicilio = signal<Coordenadas | null | undefined>(undefined);
  protected readonly gpsDomicilioGuardado = signal<Coordenadas | null>(null);

  protected readonly idsGpsDomicilio: IdsDePrueba = {
    mapa: 'edicion-domicilio-mapa',
    confirmada: 'edicion-domicilio-confirmada',
    avisoGeocodificacion: 'edicion-domicilio-aviso-geo',
    quitar: 'edicion-domicilio-quitar-gps',
    sinConfirmar: 'edicion-domicilio-sin-confirmar',
    confirmar: 'edicion-domicilio-confirmar',
    usarUbicacion: 'edicion-domicilio-usar-ubicacion',
    marcarEnMapa: 'edicion-domicilio-marcar',
  };

  /** Las doce opciones del alta, compartidas: ver `titulos-profesionales`. */
  protected readonly titulosProfesionales = OPCIONES_TITULO_PROFESIONAL;

  /**
   * Si el título guardado no está en la lista cerrada.
   *
   * Los perfiles anteriores a la lista tienen textos escritos a mano («Médica
   * cardióloga»). No se borran ni se corrigen solos: se muestran, se avisa, y
   * la persona elige de la lista cuando quiera. Pisar el dato al abrir la
   * pantalla sería cambiar el perfil sin que nadie lo pidiera.
   */
  protected readonly tituloFueraDeLista = computed(
    () => this.titulo() !== '' && !esTituloDeLaLista(this.titulo()),
  );
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
  /**
   * Los dos datos que el alta **no** pregunta.
   *
   * Eran dos interruptores en esta pantalla; el propietario pidió el 2026-09-10
   * que el editor se adapte al formulario del alta de médico, y ahí la
   * especialidad principal se elige en un select al registrarse y la
   * certificación de junta no se pregunta.
   *
   * Se siguen mandando —el contrato los declara— con el único valor que esta
   * pantalla puede afirmar con honestidad: una especialidad agregada después
   * del alta es **adicional**, no la principal, y nadie declaró una
   * certificación de junta.
   */
  private readonly ESPECIALIDAD_ADICIONAL = { isPrimary: false, boardCertified: false } as const;

  /** El diploma del título que se está agregando. Uno, opcional. */
  protected readonly archivoDeCredencial = signal<readonly File[]>([]);

  /** Los mismos formatos y el mismo tope que el alta de médico. */
  protected readonly formatosDeRespaldo = 'application/pdf,image/jpeg,image/png';
  protected readonly maxBytesDeRespaldo = 5 * 1024 * 1024;
  protected readonly guardandoEspecialidad = signal(false);

  protected readonly puedeAgregarEspecialidad = computed(() => this.nuevaEspecialidad() !== null);

  /* -- Nueva matrícula --------------------------------------------------------- */

  protected readonly targetMatricula = TARGET_MATRICULA;
  protected readonly nuevaJurisdiccion = signal<string | null>(null);
  protected readonly nuevoNumeroDeMatricula = signal('');
  protected readonly nuevaAutoridad = signal('');
  protected readonly nuevaFechaInscripcion = signal<Date | null>(null);
  protected readonly guardandoMatricula = signal(false);

  protected readonly puedeAgregarMatricula = computed(
    () => this.nuevoNumeroDeMatricula().trim() !== '',
  );

  /* -- Nueva formación ----------------------------------------------------
     Mismo criterio que especialidad y matrícula: se agrega, no se edita —
     declarar un título no es haberlo acreditado, y quien lo verifica es
     `SECURITY_ADMIN` sobre uno existente. El tipo sale del catálogo dinámico
     (los cinco `CREDENTIAL_TYPE_*`), igual que la jurisdicción de la
     matrícula de acá arriba. */

  protected readonly targetCredencial = TARGET_CREDENCIAL;
  protected readonly nuevoTipoCredencial = signal<string | null>(null);
  protected readonly nuevoNumeroCredencial = signal('');
  protected readonly nuevaInstitucionCredencial = signal('');
  protected readonly nuevaFechaEmisionCredencial = signal<Date | null>(null);
  protected readonly guardandoCredencial = signal(false);

  protected readonly puedeAgregarCredencial = computed(
    () => this.nuevoTipoCredencial() !== null && this.nuevoNumeroCredencial().trim() !== '',
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
    this.nombre.set(perfil.name ?? '');
    this.segundoNombre.set(perfil.middleName ?? '');
    this.apellidoPaterno.set(perfil.lastName ?? '');
    this.apellidoMaterno.set(perfil.motherLastName ?? '');
    this.celularPersonal.set(perfil.mobilePhone ?? '');
    this.celularTrabajo.set(perfil.workMobilePhone ?? '');
    this.fijoTrabajo.set(perfil.workLandline ?? '');
    this.correoPersonal.set(perfil.personalEmail ?? '');
    this.aceptaNuevos.set(perfil.acceptsNewPatients);
    this.telemedicina.set(perfil.telehealthAvailable);
    // ALV-003: los dos campos que el contrato ya aceptaba y el formulario no
    // ofrecía. Se siembran desde el perfil, igual que el resto.
    this.fechaNacimiento.set(perfil.birthDate ?? null);
    this.municipioResidencia.set(perfil.residenceMunicipalityConceptId ?? null);
    // ALV-009: la calle, si la declaró.
    this.direccion.set(perfil.homeAddress?.lines ?? '');
    // Y su punto en el mapa. Las dos mitades tienen que estar: una latitud sin
    // longitud pondría el pin en el meridiano cero.
    const lat = perfil.homeAddress?.latitude;
    const lng = perfil.homeAddress?.longitude;
    this.gpsDomicilioGuardado.set(
      lat === undefined || lng === undefined ? null : { lat, lng },
    );
    this.gpsDomicilio.set(undefined);
    if (this.ramasMunicipios().length === 0 && !this.catalogoMunicipiosCaido()) {
      this.cargarMunicipios();
    }
  }

  /**
   * Trae el árbol de municipios para «dónde vivís». Mismo criterio que el
   * alta ante un fallo: el campo es opcional y el resto del formulario sigue.
   */
  protected cargarMunicipios(): void {
    this.municipios.listar().subscribe({
      next: (ramas) => {
        this.catalogoMunicipiosCaido.set(false);
        this.ramasMunicipios.set(ramas);
      },
      error: () => {
        this.ramasMunicipios.set([]);
        this.catalogoMunicipiosCaido.set(true);
      },
    });
  }

  protected reintentarMunicipios(): void {
    this.municipios.olvidar();
    this.cargarMunicipios();
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
      name: string;
      middleName: string;
      lastName: string;
      motherLastName: string;
      mobilePhone: string;
      workMobilePhone: string;
      workLandline: string;
      personalEmail: string;
      birthDate: string;
      residenceMunicipalityConceptId: string;
      homeAddressLines: string;
      homeLatitude: number | null;
      homeLongitude: number | null;
    }> = {};
    // ALV-003/009: los dos campos nuevos viajan sólo si cambiaron, como el
    // resto. La fecha se compara por día local (`toISOString` la pasaría por
    // UTC y correría un día al oeste de Greenwich).
    const fechaOriginal = original.birthDate ? soloFecha(original.birthDate) : '';
    const fechaEditada = this.fechaNacimiento();
    const fechaNueva = fechaEditada === null ? '' : soloFecha(fechaEditada);
    if (fechaNueva !== '' && fechaNueva !== fechaOriginal) {
      cambios.birthDate = fechaNueva;
    }
    const municipio = this.municipioResidencia();
    if (municipio !== null && municipio !== (original.residenceMunicipalityConceptId ?? null)) {
      cambios.residenceMunicipalityConceptId = municipio;
    }
    if (this.direccion() !== (original.homeAddress?.lines ?? '')) {
      cambios.homeAddressLines = this.direccion();
    }
    // El punto, con los mismos tres estados que en el editor del paciente:
    // `undefined` no viaja, `null` quita y un par mueve. Mandar el punto actual
    // «por las dudas» convertiría cada guardado en una reescritura del mapa.
    const gps = this.gpsDomicilio();
    if (gps === null) {
      cambios.homeLatitude = null;
      cambios.homeLongitude = null;
    } else if (gps !== undefined) {
      cambios.homeLatitude = gps.lat;
      cambios.homeLongitude = gps.lng;
    }
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
    // Los personales viajan igual que los otros: sólo si cambiaron. Una cadena
    // vacía SÍ viaja —es cómo se borra un segundo nombre— y por eso se compara
    // contra el original en vez de descartar los vacíos.
    if (this.nombre() !== (original.name ?? '')) cambios.name = this.nombre();
    if (this.segundoNombre() !== (original.middleName ?? '')) {
      cambios.middleName = this.segundoNombre();
    }
    if (this.apellidoPaterno() !== (original.lastName ?? '')) {
      cambios.lastName = this.apellidoPaterno();
    }
    if (this.apellidoMaterno() !== (original.motherLastName ?? '')) {
      cambios.motherLastName = this.apellidoMaterno();
    }
    if (this.celularPersonal() !== (original.mobilePhone ?? '')) {
      cambios.mobilePhone = this.celularPersonal();
    }
    if (this.celularTrabajo() !== (original.workMobilePhone ?? '')) {
      cambios.workMobilePhone = this.celularTrabajo();
    }
    if (this.fijoTrabajo() !== (original.workLandline ?? '')) {
      cambios.workLandline = this.fijoTrabajo();
    }
    if (this.correoPersonal() !== (original.personalEmail ?? '')) {
      cambios.personalEmail = this.correoPersonal();
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
        isPrimary: this.ESPECIALIDAD_ADICIONAL.isPrimary,
        boardCertified: this.ESPECIALIDAD_ADICIONAL.boardCertified,
      })
      .subscribe({
        next: () => {
          this.guardandoEspecialidad.set(false);
          this.nuevaEspecialidad.set(null);
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
    const fechaInscripcion = this.nuevaFechaInscripcion();
    this.profiles
      .addJurisdictionAuthorization(profileId, {
        licenseNumber: numero,
        jurisdictionConceptId: this.nuevaJurisdiccion() ?? undefined,
        regulatoryAuthority: this.nuevaAutoridad().trim() || undefined,
        validFrom: fechaInscripcion === null ? undefined : fechaIso(fechaInscripcion),
      })
      .subscribe({
        next: () => {
          this.guardandoMatricula.set(false);
          this.nuevaJurisdiccion.set(null);
          this.nuevoNumeroDeMatricula.set('');
          this.nuevaAutoridad.set('');
          this.nuevaFechaInscripcion.set(null);
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

  /**
   * Agrega un título propio, con su diploma si lo hay.
   *
   * Nace pendiente de verificación, como la especialidad y la matrícula:
   * declarar un título no es haberlo acreditado.
   *
   * **Dos pasos, no uno** (propietario, 2026-09-10: «poder agregar las
   * matrículas y adjuntos en base a su módulo de creación de médico»). El
   * archivo se sube primero con `FilesClient.upload` y su identificador viaja
   * como `fileId` del título — la misma cadena que ya usa la verificación de
   * identidad, y el mismo motivo por el que están separados en el backend: el
   * mismo archivo puede colgarse de más de un recurso.
   *
   * Si la subida falla **no se crea el título**: un título sin el diploma que
   * la persona creyó haber adjuntado es peor que un error, porque nadie se
   * entera hasta que lo rechazan.
   */
  protected agregarCredencial(): void {
    const tipo = this.nuevoTipoCredencial();
    const numero = this.nuevoNumeroCredencial().trim();
    if (tipo === null || numero === '' || this.guardandoCredencial()) {
      return;
    }

    this.guardandoCredencial.set(true);
    const archivo = this.archivoDeCredencial()[0];
    if (archivo === undefined) {
      this.crearCredencial(tipo, numero, undefined);
      return;
    }

    // `DOCUMENT`/`PHI`: es documentación de una persona identificable, el mismo
    // par con el que sube su evidencia la verificación de identidad.
    this.files.upload(archivo, 'DOCUMENT', 'PHI').subscribe({
      next: ({ id }) => this.crearCredencial(tipo, numero, id),
      error: () => {
        this.guardandoCredencial.set(false);
        this.toasts.error(
          'No pudimos subir el diploma, así que no se agregó el título. Probá de nuevo.',
          'Formación',
        );
      },
    });
  }

  /** El alta del título en sí, con el diploma ya subido si lo había. */
  private crearCredencial(tipo: string, numero: string, fileId: string | undefined): void {
    const fecha = this.nuevaFechaEmisionCredencial();
    this.profiles
      .addOwnCredential({
        credentialTypeConceptId: tipo,
        number: numero,
        issuingInstitutionText: this.nuevaInstitucionCredencial().trim() || undefined,
        issueDate: fecha === null ? undefined : fechaIso(fecha),
        ...(fileId === undefined ? {} : { fileId }),
      })
      .subscribe({
        next: () => {
          this.guardandoCredencial.set(false);
          this.nuevoTipoCredencial.set(null);
          this.nuevoNumeroCredencial.set('');
          this.nuevaInstitucionCredencial.set('');
          this.nuevaFechaEmisionCredencial.set(null);
          this.archivoDeCredencial.set([]);
          this.toasts.success(
            'Se agregó el título. Queda pendiente de verificación.',
            'Formación',
          );
          this.cargar();
        },
        error: () => {
          this.guardandoCredencial.set(false);
          this.toasts.error('No se pudo agregar el título. Probá de nuevo.', 'Formación');
        },
      });
  }
}
