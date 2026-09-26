import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { catchError, forkJoin, map, of, switchMap, type Observable } from 'rxjs';

import { AuthService } from '../../../../core/auth/auth.service';
import { CommunityClient } from '../../../../core/data-access/community/community.client';
import { FilesClient } from '../../../../core/data-access/files/files.client';
import { PracticeSitesClient } from '../../../../core/data-access/practice-sites/practice-sites.client';
import type { PracticeSite } from '../../../../core/data-access/practice-sites/practice-sites.types';
import { ProfilesClient } from '../../../../core/data-access/profiles/profiles.client';
import type {
  MonthlyCount,
  OwnAddress,
  OwnPractitionerProfile,
  PractitionerQualityMetrics,
  PractitionerAffiliation,
  PractitionerCredential,
  PractitionerLanguage,
  PractitionerLicense,
  PractitionerSpecialty,
} from '../../../../core/data-access/profiles/profiles.types';
import { TerminologyClient } from '../../../../core/data-access/terminology/terminology.client';
import type { ConceptLabels } from '../../../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { HelpBlockDismissalStore } from '../../../../core/tutorials/help-block-dismissal.store';
import { dataOf, loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import type { StatusSealVariant } from '../../../../shared/components/organisms/status-seal/status-seal.types';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { CONTADORES_DE_ACTIVIDAD } from '../contadores-de-actividad';
import { PESTANAS_DEL_PERFIL_MEDICO, PESTANA_MEDICO } from '../pestanas-del-perfil-medico';
import { PractitionerProfileView } from './practitioner-profile-view/practitioner-profile-view';
import type {
  AfiliacionVisible,
  EspecialidadVisible,
  FormacionVisible,
  IdiomaVisible,
  IndicadorDeCalidad,
  MatriculaVisible,
  PerfilProfesionalVisible,
  PuntoDeSerie,
  SedeVisible,
} from './practitioner-profile-view/practitioner-profile-view.types';

/** Lo que se muestra cuando el registro no trae ese dato. */
const SIN_DATO = 'Sin registrar';

/**
 * Códigos de terminología que significan «esto está en orden».
 *
 * Se comparan contra el **código** del concepto y no contra su etiqueta: la
 * etiqueta se traduce y se reescribe, el código es el contrato. Si el catálogo
 * no resuelve el concepto, no se afirma nada — el sello queda neutro, que es lo
 * honesto cuando no se sabe.
 */
const CODIGOS_EN_ORDEN = ['VERIFIED', 'ACTIVE', 'CRED_VERIFIED', 'AUTH_ACTIVE', 'PRACTICE_ACTIVE'];

/** Códigos que significan «todavía no». */
const CODIGOS_PENDIENTES = ['PENDING', 'ONBOARDING', 'CRED_PENDING', 'AUTH_PENDING', 'IN_REVIEW'];

/**
 * La clave con la que se recuerda que ya se explicó «Credenciales».
 *
 * Es la MISMA que usaba el `app-tab-help-block` que estaba ahí: a quien ya
 * había cerrado aquella caja no se le empieza a repetir el aviso ahora que es
 * un toast.
 */
const AYUDA_DE_CREDENCIALES = 'perfil-credenciales-ayuda';

/**
 * La etiqueta de «Credenciales», para reconocer la pestaña por su nombre.
 *
 * **No por su índice.** «Facturación» sólo se dibuja en la ficha propia con
 * datos de facturación, así que el índice de todo lo que va después se corre
 * en uno cuando falta: con el índice fijo, el aviso no salía nunca en una
 * ficha sin facturación y salía en «Actividad» en una con ella. Lo destapó el
 * spec al juntar las dos correcciones del 19/09/2026.
 */
const ETIQUETA_DE_CREDENCIALES = PESTANAS_DEL_PERFIL_MEDICO[PESTANA_MEDICO.credenciales];

/** Lo que dice ese aviso. Es el texto del bloque que reemplaza, sin el ejemplo. */
const AVISO_DE_CREDENCIALES =
  'Acá se separa lo que declaraste de lo que ya fue verificado contra una fuente ' +
  '—el colegio médico, el registro de matrículas—. Declarar no exige verificación previa.';

/**
 * «Trayectoria» también dejó de ser una caja arriba de la pestaña (24/09/2026),
 * pero su aviso sale **cada vez** que se abre y dura 3 s: orienta sin tapar la
 * línea de tiempo. No reusa la clave del bloque cerrado, porque quien lo había
 * cerrado no lo vería nunca.
 */
const ETIQUETA_DE_TRAYECTORIA = PESTANAS_DEL_PERFIL_MEDICO[PESTANA_MEDICO.trayectoria];

const AVISO_DE_TRAYECTORIA =
  'Dónde ejerciste antes y dónde ejercés hoy. Es lo que un paciente ve en el ' +
  'Directorio de médicos antes de pedir una cita. Tus títulos están en «Credenciales».';

/** Lo que se dice cuando la cuenta no tiene dónde guardar la foto. */
const SIN_PERFIL_PARA_LA_FOTO =
  'Tu cuenta todavía no está asociada a un perfil profesional, así que no hay ' +
  'dónde guardar la foto. Escribinos para que la vinculemos.';

/** El perfil crudo junto a lo que se resolvió aparte para pintarlo. */
interface PerfilResuelto {
  readonly perfil: OwnPractitionerProfile;
  readonly etiquetas: ConceptLabels;
  readonly fotoUrl: string | null;
  /** Dónde atiende hoy (ALV-005). Vacío si no tiene sedes o si la lectura falló. */
  readonly sedes: readonly PracticeSite[];
}

/**
 * **Perfil profesional propio** — el contenedor de «Mi perfil».
 *
 * ## Qué quedó acá y qué se fue (carril R2-4)
 *
 * Este componente ya no dibuja nada: pide `me/summary`, resuelve las etiquetas
 * de terminología y la URL de la foto, arma el `PerfilProfesionalVisible` y se
 * lo pasa a `practitioner-profile-view`, que es quien pinta. La separación no
 * es refactor por gusto: la guía de profesionales (carril R2-1) pinta el perfil
 * de OTRO doctor con la misma vista, y sin esto habría dos perfiles de doctor
 * con dos criterios distintos — exactamente lo que generó el reclamo del
 * punto 4.
 *
 * ## Qué problema resolvía ya
 *
 * «Mi perfil» llamaba a `GET /profiles/patients/me/summary` para todo el mundo.
 * A un profesional ese endpoint le responde `404` —no tiene perfil de paciente—
 * o `403` si además no verificó su identidad, así que la pantalla de perfil de
 * un médico no mostraba absolutamente nada. No era un defecto de la pantalla:
 * no existía la lectura que la sirviera. Ahora existe, y esto la muestra.
 *
 * ## Los fallos laterales degradan, no tumban
 *
 * El catálogo caído deja las etiquetas en «sin registrar»; la foto que no se
 * pudo resolver deja el avatar de iniciales. Ninguno de los dos puede tumbar la
 * pantalla que muestra la trayectoria de alguien.
 */

/**
 * La edad, calculada de la fecha de nacimiento.
 *
 * Es derivada: el registro del cliente la pide «de manera automática», así que
 * no se guarda ni se pide al servidor. `null` si no declaró la fecha o si el
 * resultado no es una edad creíble.
 */
function edadDe(nacimiento?: Date): number | null {
  if (!nacimiento) return null;
  const hoy = new Date();
  let anios = hoy.getFullYear() - nacimiento.getFullYear();
  const mes = hoy.getMonth() - nacimiento.getMonth();
  if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) anios -= 1;
  return anios >= 0 && anios < 130 ? anios : null;
}

@Component({
  selector: 'app-practitioner-profile',
  imports: [PractitionerProfileView, ViewStateHost],
  templateUrl: './practitioner-profile.html',
  styleUrl: './practitioner-profile.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PractitionerProfile {
  private readonly profiles = inject(ProfilesClient);
  private readonly terminology = inject(TerminologyClient);
  private readonly files = inject(FilesClient);
  private readonly sites = inject(PracticeSitesClient);
  private readonly auth = inject(AuthService);
  private readonly community = inject(CommunityClient);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly ayudas = inject(HelpBlockDismissalStore);

  protected readonly perfil = signal<ViewState<PerfilResuelto>>(loading());

  /** El perfil ya convertido al contrato de la vista. */
  protected readonly visible = computed<PerfilProfesionalVisible | null>(() => {
    const resuelto = dataOf(this.perfil());
    return resuelto === null ? null : this.convertir(resuelto);
  });

  constructor() {
    this.cargar();
  }

  protected recargar(): void {
    this.cargar();
  }

  /* -- La foto de perfil (P17) -------------------------------------------- */

  /** Mientras la foto viaja. La vista lo usa para bloquear el control. */
  protected readonly fotoSubiendo = signal(false);

  /** Qué salió mal del otro lado. Vacío es que no pasó nada. */
  protected readonly errorDeFoto = signal('');

  /**
   * La foto recién subida, ya en `data:`.
   *
   * La vista recibe el perfil por `input()` y no puede releerlo sola, así que
   * se le dice cuál es la foto nueva. Es una `data:` URL y no un `blob:` ni la
   * firma de descarga: la CSP declara `img-src 'self' data:`, y la firma apunta
   * a `file://local/<sha>`, que ningún `<img>` carga.
   */
  protected readonly fotoRecien = signal<string | null>(null);

  /**
   * Sube la foto que eligió la persona y la fija como foto del perfil.
   *
   * **Son dos llamadas y no una, a propósito.** `POST /common/files/upload`
   * recibe los bytes por `multipart`; `PUT /profiles/practitioners/:id/photo`
   * es un JSON idempotente que recibe el **id** del archivo. Mezclarlos
   * obligaría al perfil a hablar dos idiomas y a reenviar la foto entera cada
   * vez que alguien corrige otro dato.
   *
   * **Una subida pinta ambas.** `health_practitioner_profiles.photo_file_id`
   * (arriba) y `community.public_profiles.avatar_file_id` (la vitrina pública)
   * son columnas independientes que nada sincroniza del lado del servidor. Ver
   * {@link propagarAVitrina}.
   */
  protected subirFoto(archivo: File): void {
    if (this.fotoSubiendo()) {
      return;
    }

    const profileId = this.auth.practitionerProfileId();
    if (profileId === null) {
      // Antes se salía en silencio: se elegía una foto, no pasaba nada, y no
      // había forma de saber que el problema no era la imagen. Pasa de verdad
      // —una cuenta cuya persona no tiene perfil profesional no lleva el claim
      // `hpid`—, así que se dice, y se dice lo que la persona puede hacer.
      this.errorDeFoto.set(SIN_PERFIL_PARA_LA_FOTO);
      return;
    }

    this.fotoSubiendo.set(true);
    this.errorDeFoto.set('');

    this.files
      .upload(archivo, 'IMAGE', 'NORMAL')
      .pipe(
        switchMap((subido) => this.profiles.setPractitionerPhoto(profileId, subido.id)),
        switchMap((guardado) =>
          this.propagarAVitrina(guardado.photoFileId).pipe(map(() => guardado)),
        ),
        switchMap((guardado) => this.files.imageDataUrl(guardado.photoFileId ?? '')),
      )
      .subscribe({
        next: (fotoUrl) => {
          this.fotoSubiendo.set(false);
          this.fotoRecien.set(fotoUrl);
        },
        error: () => {
          this.fotoSubiendo.set(false);
          this.errorDeFoto.set('No pudimos subir la foto. Probá con otra imagen.');
        },
      });
  }

  /**
   * Repite la foto recién fijada en la vitrina pública, si el titular ya tiene
   * una.
   *
   * **Sin vitrina no se crea una implícita.** El `PUT /community/profiles/me`
   * exige `tenantId`, `slug` y `displayName`: adivinarlos acá sería inventarle
   * a alguien una dirección pública que nunca pidió. Quien no tiene vitrina
   * sigue viendo su foto en «Mi perfil» — sólo no se propaga a ningún lado más.
   *
   * **Se manda el objeto completo leído del servidor.** El `PUT` es completo
   * (no un `PATCH`): mandar sólo `{ avatarFileId }` borraría `visibility` y
   * cualquier otro campo que la persona haya declarado en otra pantalla.
   *
   * **Best-effort.** Un fallo acá no debe tumbar la foto profesional, que ya
   * quedó guardada en el paso anterior — se traga el error y se sigue.
   *
   * @param fileId - El id del archivo recién fijado como foto profesional.
   * @returns Un observable que siempre completa, nunca falla.
   */
  private propagarAVitrina(fileId: string | undefined): Observable<unknown> {
    if (!fileId) {
      return of(undefined);
    }
    return this.community.getOwnProfile().pipe(
      switchMap((vitrina) => {
        if (!vitrina) {
          return of(undefined);
        }
        return this.community.upsertOwnProfile({
          tenantId: vitrina.tenantId,
          slug: vitrina.slug,
          displayName: vitrina.displayName,
          headline: vitrina.headline,
          biography: vitrina.biography,
          acceptsReviews: vitrina.acceptsReviews,
          avatarFileId: fileId,
        });
      }),
      catchError(() => of(undefined)),
    );
  }

  /* -- Retirar un título y el aviso de «Credenciales» --------------------- */

  /**
   * Retira un título propio cargado por error (ALV-009/formación).
   *
   * Con confirmación, mismo criterio que retirar una sede: no es un clic sin
   * vuelta atrás. La vista sólo ofrece el botón mientras el título sigue
   * PENDIENTE, así que el `422` por un estado que cambió justo antes es el
   * único camino de error real, y se avisa igual.
   */
  protected async retirarCredencial(estudio: FormacionVisible): Promise<void> {
    const confirmado = await this.dialogs.confirm({
      title: 'Retirar este título',
      message: `¿Retirar «${estudio.tipo}» de tu formación? Todavía está pendiente de verificación.`,
      confirmLabel: 'Retirar',
      cancelLabel: 'Cancelar',
    });
    if (!confirmado) {
      return;
    }
    this.profiles.removeOwnCredential(estudio.id).subscribe({
      next: () => {
        this.toasts.success('Se retiró el título.', 'Formación');
        this.recargar();
      },
      error: () => {
        this.toasts.error('No se pudo retirar el título. Probá de nuevo.', 'Formación');
      },
    });
  }

  /**
   * El aviso de «Credenciales», una sola vez por cuenta y **al abrir esa
   * pestaña**, no al abrir la ficha.
   *
   * Se decide acá y no en el panel porque el contenido proyectado de una
   * pestaña se instancia aunque la pestaña esté cerrada —el `@if` de `app-tab`
   * decide si se INSERTA en el DOM, no si se construye—, así que lanzado desde
   * el panel saltaba estando en «Datos personales».
   *
   * Era un `effect` dentro de la vista y ya no hace falta que lo sea: la vista
   * avisa qué pestaña abrió una persona, y este método sólo corre por esa
   * acción. Con eso se va también la guarda de plataforma que tenía: se leía
   * `localStorage` en cada dibujo, incluido el del servidor, donde no existe y
   * el aviso se habría pintado en el HTML. Sin dibujo que lo dispare, no hay
   * nada que evitar.
   */
  protected alVerPestana(etiqueta: string): void {
    if (etiqueta === ETIQUETA_DE_TRAYECTORIA) {
      this.toasts.show({
        type: 'info',
        title: 'Trayectoria',
        message: AVISO_DE_TRAYECTORIA,
        durationMs: 3000,
      });
      return;
    }
    if (etiqueta !== ETIQUETA_DE_CREDENCIALES) {
      return;
    }
    if (this.ayudas.isDismissed(AYUDA_DE_CREDENCIALES)) {
      return;
    }
    this.ayudas.dismiss(AYUDA_DE_CREDENCIALES);
    this.toasts.info(AVISO_DE_CREDENCIALES, 'Credenciales');
  }

  private cargar(): void {
    this.perfil.set(loading());

    this.profiles
      .getOwnPractitionerProfile()
      .pipe(
        switchMap((perfil) =>
          forkJoin({
            perfil: of(perfil),
            // El fallo del catálogo degrada las etiquetas a «sin registrar»; no
            // puede tumbar la pantalla que muestra la trayectoria de alguien.
            etiquetas: this.terminology
              .readConceptLabels(conceptosDe(perfil))
              .pipe(catchError(() => of<ConceptLabels>(new Map()))),
            // La foto es un adorno con el mismo criterio: si la URL no sale,
            // queda el avatar de iniciales, que es el caso vacío correcto.
            fotoUrl:
              perfil.photoFileId === undefined
                ? of<string | null>(null)
                : // `imageDataUrl` y no `downloadUrl`: la URL firmada apunta a
                  // `file://local/<sha>`, que ningún `<img>` puede cargar. Ver
                  // `FilesClient.imageDataUrl`.
                  this.files
                    .imageDataUrl(perfil.photoFileId)
                    .pipe(catchError(() => of<string | null>(null))),
            // ALV-005: dónde atiende. Mismo criterio que la foto: es una
            // sección más de la ficha, no la ficha; si no se puede leer, la
            // sección no se dibuja y el resto sigue.
            sedes: this.sedesPropias(),
          }),
        ),
      )
      .subscribe({
        next: (resuelto) => this.perfil.set(ready(resuelto)),
        error: (error: unknown) => this.perfil.set(errorToViewState<PerfilResuelto>(error)),
      });
  }

  /* -- Del perfil crudo al contrato de la vista --------------------------- */

  /**
   * Las sedes donde atiende hoy, o vacío si la sesión no tiene perfil
   * profesional o la lectura falló.
   */
  private sedesPropias() {
    const profileId = this.auth.practitionerProfileId();
    if (profileId === null) {
      return of<readonly PracticeSite[]>([]);
    }
    return this.sites.listSitesOfPractitioner(profileId).pipe(
      map((pagina) => pagina.items),
      catchError(() => of<readonly PracticeSite[]>([])),
    );
  }

  private convertir(resuelto: PerfilResuelto): PerfilProfesionalVisible {
    const { perfil, etiquetas, fotoUrl, sedes } = resuelto;
    const especialidades = this.especialidades(perfil, etiquetas);
    const afiliaciones = afiliacionesDe(perfil);
    return {
      sedes: sedes.map(sedeVisible),
      nombre: perfil.displayName || SIN_DATO,
      titulo: perfil.professionalTitle ?? '',
      especialidadPrincipal: especialidadPrincipal(especialidades),
      codigo: perfil.practitionerCode,
      fotoUrl,
      verificacion: {
        label: label(etiquetas, perfil.verificationStatusConceptId),
        variant: sello(etiquetas, perfil.verificationStatusConceptId),
      },
      estadoDePractica: label(etiquetas, perfil.practiceStatusConceptId),
      aceptaPacientesNuevos: perfil.acceptsNewPatients,
      telemedicina: perfil.telehealthAvailable,
      bio: perfil.professionalBio ?? '',
      /* Los rótulos y los pies salen de `CONTADORES_DE_ACTIVIDAD`, que es la
         misma lista que enumera la pestaña «Actividad» del editor para decir
         que ninguno se edita. Estaban escritos acá a mano y eran el único
         lugar que los mostraba; con dos superficies, una lista sola se despega
         en el primer retoque. Acá se le agrega el valor; el editor no lo
         necesita. */
      actividad: CONTADORES_DE_ACTIVIDAD.map(({ clave, rotulo, pie, campo }) => ({
        clave,
        rotulo,
        pie,
        valor: perfil.activity[campo],
      })),
      actividadMensual: serieMensual(perfil.activity.monthlyEncounters),
      calidad: indicadoresDeCalidad(perfil.activity.quality),
      especialidades,
      formacion: this.formacion(perfil, etiquetas),
      matriculas: this.matriculas(perfil, etiquetas),
      idiomas: this.idiomas(perfil, etiquetas),
      // Sólo en la ficha propia: el documento y la fecha de nacimiento de un
      // colega no son de quien mira su ficha. Este componente ES la ficha
      // propia, así que siempre se arman; la del directorio pasa `null`.
      datosPersonales: {
        documento: perfil.nationalId ?? '',
        // Vacío y no «Sin registrar» cuando el catálogo no lo trae: es un
        // SUFIJO del documento, así que sin etiqueta el renglón debe leerse
        // «5414404» y no «5414404 Sin registrar», que dice que falta algo
        // cuando el dato está.
        departamento: etiquetaOpcional(etiquetas, perfil.issuerAdministrativeAreaConceptId),
        fechaNacimiento: perfil.birthDate ?? null,
        edad: edadDe(perfil.birthDate),
        telefono: perfil.phone ?? '',
        correo: perfil.email ?? '',
        domicilio: etiquetaOpcional(etiquetas, perfil.residenceMunicipalityConceptId),
        // Los cuatro contactos del alta y la calle: la API ya los devolvía y la
        // ficha mostraba sólo uno de cada clase.
        celularPersonal: perfil.mobilePhone ?? '',
        correoPersonal: perfil.personalEmail ?? '',
        direccion: perfil.homeAddress?.lines ?? '',
        mapaDomicilio: enlaceAlMapa(perfil.homeAddress),
        ubicacionDomicilio: puntoDelDomicilio(perfil.homeAddress),
        municipioResidenciaId: perfil.residenceMunicipalityConceptId ?? null,
      },
      // A nombre de quién factura. Va sólo en la ficha propia: el contenedor
      // de la guía lo deja en `null` porque el NIT de un colega no es de quien
      // lo mira.
      facturacion: {
        nit: perfil.taxId ?? '',
        razonSocial: perfil.taxHolderName ?? '',
      },
      actividadActual: afiliaciones.actual,
      experienciaHistorica: afiliaciones.historica,
      desde: perfil.createdAt ?? null,
    };
  }

  private especialidades(
    perfil: OwnPractitionerProfile,
    etiquetas: ConceptLabels,
  ): readonly EspecialidadVisible[] {
    return perfil.specialties.map((especialidad: PractitionerSpecialty) => ({
      id: especialidad.id,
      nombre: label(etiquetas, especialidad.specialtyConceptId),
      certificada: especialidad.boardCertified,
      alcance: especialidad.practiceScopeText ?? '',
      desde: especialidad.validFrom ?? null,
      hasta: especialidad.validTo ?? null,
      estado: label(etiquetas, especialidad.verificationStatusConceptId),
      sello: sello(etiquetas, especialidad.verificationStatusConceptId),
    }));
  }

  /**
   * La formación, de la más reciente a la más antigua.
   *
   * El backend ya la ordena, pero el orden es parte de lo que hace legible una
   * línea de tiempo y no puede depender de que la consulta no cambie.
   */
  private formacion(
    perfil: OwnPractitionerProfile,
    etiquetas: ConceptLabels,
  ): readonly FormacionVisible[] {
    const ahora = new Date();
    return [...perfil.credentials]
      .sort((a, b) => fecha(b.issueDate) - fecha(a.issueDate))
      .map((credencial: PractitionerCredential) => {
        const vencida = credencial.expiryDate !== undefined && credencial.expiryDate < ahora;
        return {
          id: credencial.id,
          tipo: label(etiquetas, credencial.credentialTypeConceptId),
          numero: credencial.number,
          institucion: credencial.issuingInstitutionText ?? '',
          desde: credencial.issueDate ?? null,
          hasta: credencial.expiryDate ?? null,
          estado: label(etiquetas, credencial.stateConceptId),
          // El vencimiento manda sobre todo lo demás —una credencial vencida no
          // habilita, por más verificada que esté—; después la verificación
          // manda sobre el estado del catálogo, porque una credencial con fecha
          // de comprobación está verificada aunque el concepto no se resuelva.
          sello: vencida
            ? ('expired' as StatusSealVariant)
            : credencial.verifiedAt !== undefined
              ? ('approved' as StatusSealVariant)
              : sello(etiquetas, credencial.stateConceptId),
          vencida,
          fuenteVerificacion: credencial.verificationSourceUri,
        };
      });
  }

  private matriculas(
    perfil: OwnPractitionerProfile,
    etiquetas: ConceptLabels,
  ): readonly MatriculaVisible[] {
    return perfil.licenses.map((matricula: PractitionerLicense) => ({
      id: matricula.id,
      jurisdiccion: label(etiquetas, matricula.jurisdictionConceptId),
      numero: matricula.licenseNumber,
      autoridad: matricula.regulatoryAuthority ?? '',
      estado: label(etiquetas, matricula.stateConceptId),
      sello: sello(etiquetas, matricula.stateConceptId),
      hasta: matricula.validTo ?? null,
    }));
  }

  private idiomas(
    perfil: OwnPractitionerProfile,
    etiquetas: ConceptLabels,
  ): readonly IdiomaVisible[] {
    return perfil.languages.map((idioma: PractitionerLanguage) => ({
      id: idioma.languageConceptId,
      nombre: label(etiquetas, idioma.languageConceptId),
      nivel:
        idioma.proficiencyConceptId === undefined
          ? ''
          : label(etiquetas, idioma.proficiencyConceptId),
      interpreta: idioma.clinicalInterpretationAllowed,
    }));
  }
}

/**
 * La etiqueta de un concepto, o cadena vacía.
 *
 * Distinta de {@link label}: aquélla devuelve «Sin registrar» porque rellena
 * un campo que debe decir algo. Ésta es para datos que se OMITEN cuando no hay
 * — un sufijo, una fila que no se dibuja—, y ahí «Sin registrar» afirmaría que
 * falta un dato que en realidad está, sólo que sin su etiqueta.
 */
function etiquetaOpcional(etiquetas: ConceptLabels, conceptId: string | undefined): string {
  if (conceptId === undefined) return '';
  return etiquetas.get(conceptId)?.display ?? '';
}

/** La etiqueta de un concepto, o el texto de ausencia. Nunca el uuid. */
function label(etiquetas: ConceptLabels, conceptId: string | undefined): string {
  if (conceptId === undefined) {
    return SIN_DATO;
  }
  return etiquetas.get(conceptId)?.display ?? SIN_DATO;
}

/**
 * El sello de un concepto de estado.
 *
 * Se decide por el **código**, no por la etiqueta: la etiqueta se traduce y se
 * reescribe, el código es el contrato. Lo que el catálogo no resuelve queda en
 * neutro — afirmar «verificado» sobre un concepto que no se pudo leer sería
 * inventar, y acá lo que se afirma es la habilitación de alguien para ejercer.
 */
function sello(etiquetas: ConceptLabels, conceptId: string | undefined): StatusSealVariant {
  const codigo = conceptId === undefined ? undefined : etiquetas.get(conceptId)?.code;
  if (codigo === undefined) {
    return 'unknown';
  }
  if (CODIGOS_EN_ORDEN.some((esperado) => codigo.includes(esperado))) {
    return 'approved';
  }
  if (CODIGOS_PENDIENTES.some((esperado) => codigo.includes(esperado))) {
    return 'in-review';
  }
  return 'unknown';
}

/**
 * La especialidad con la que se presenta.
 *
 * La primera vigente, en el orden en que llegan. Hasta el 23/09/2026 era la
 * marcada como principal; el médico pidió que ninguna se distinguiera (D-01).
 * Sin ninguna vigente no se cae a una pasada: presentar a alguien con una
 * especialidad que dejó de ejercer es decir algo falso.
 */
function especialidadPrincipal(especialidades: readonly EspecialidadVisible[]): string {
  return especialidades.find((especialidad) => especialidad.hasta === null)?.nombre ?? '';
}

/** Milisegundos de una fecha opcional; las ausentes van al fondo del orden. */
function fecha(valor: Date | undefined): number {
  return valor?.getTime() ?? 0;
}

/**
 * El historial laboral (UC-05-16), separado en fase actual e histórica.
 *
 * `current` ya viene derivado del backend por `endDate`: acá sólo se traduce
 * al contrato de la vista y se reparte en los dos grupos que pide la pestaña
 * Trayectoria — «actividad actual» primero, por ser lo más relevante hoy.
 */
function afiliacionesDe(perfil: OwnPractitionerProfile): {
  readonly actual: readonly AfiliacionVisible[];
  readonly historica: readonly AfiliacionVisible[];
} {
  const visibles = [...perfil.affiliations]
    .sort((a, b) => fecha(b.startDate) - fecha(a.startDate))
    .map((afiliacion: PractitionerAffiliation) => ({
      id: afiliacion.id,
      organizacion: afiliacion.organizationName,
      // ALV-007: el cargo es opcional; vacío no dibuja «· undefined».
      cargo: afiliacion.roleTitle ?? '',
      desde: afiliacion.startDate,
      hasta: afiliacion.endDate,
      actual: afiliacion.current,
    }));
  return {
    actual: visibles.filter((afiliacion) => afiliacion.actual),
    historica: visibles.filter((afiliacion) => !afiliacion.actual),
  };
}

/**
 * El enlace al mapa de una dirección, o `null` si no tiene coordenadas.
 *
 * Copia deliberada del criterio de la ficha del paciente (`MyProfile.enlaceAlMapa`),
 * incluido el rechazo del `0,0`: una dirección de Santa Cruz no está en el
 * meridiano de Greenwich, y un enlace al golfo de Guinea es peor que ningún
 * enlace.
 */
/** Las coordenadas del domicilio, con el mismo criterio que {@link enlaceAlMapa}. */
function puntoDelDomicilio(direccion: OwnAddress | undefined): { lat: number; lng: number } | null {
  if (direccion === undefined) return null;
  const { latitude, longitude } = direccion;
  if (latitude == null || longitude == null) return null;
  if (latitude === 0 && longitude === 0) return null;
  return { lat: latitude, lng: longitude };
}

function enlaceAlMapa(direccion: OwnAddress | undefined): string | null {
  if (direccion === undefined) return null;
  const { latitude, longitude } = direccion;
  if (latitude == null || longitude == null) return null;
  if (latitude === 0 && longitude === 0) return null;
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}

/* ============================================================================
    La pestaña «Actividad»

    Cuatro contadores sueltos no contestan nada: no dicen si la práctica crece
    ni cómo se atiende. Estas dos funciones convierten lo que el backend
    manda —una serie mensual y pares «cuántas de cuántas»— en lo que la ficha
    dibuja. Los cocientes se calculan acá, UNA vez, y no en la plantilla.
    ========================================================================== */

/** Cómo se rotula un mes: «sep» bajo la barra, «septiembre de 2026» al oírla. */
const MES_CORTO = new Intl.DateTimeFormat('es-BO', { month: 'short' });
const MES_LARGO = new Intl.DateTimeFormat('es-BO', { month: 'long', year: 'numeric' });

/**
 * La serie mensual, con sus etiquetas resueltas.
 *
 * El mes se arma con `new Date(año, mes - 1, 1)` y no parseando `'2026-09'`
 * como fecha ISO: eso último se interpreta en UTC y en Bolivia (UTC-4)
 * retrocede al mes anterior — septiembre se rotularía «ago».
 */
function serieMensual(serie: readonly MonthlyCount[] | undefined): readonly PuntoDeSerie[] {
  if (serie === undefined) {
    return [];
  }
  return serie.map(({ month, count }) => {
    const [anio, mes] = month.split('-').map(Number);
    const fecha = new Date(anio ?? 1970, (mes ?? 1) - 1, 1);
    return {
      clave: month,
      etiqueta: MES_CORTO.format(fecha).replace('.', ''),
      etiquetaLarga: MES_LARGO.format(fecha),
      valor: count,
    };
  });
}

/** Un porcentaje entero, en palabras. */
function porcentaje(parte: number, total: number): string {
  return `${Math.round((parte / total) * 100)} %`;
}

/**
 * Los indicadores de calidad, ya resueltos.
 *
 * **Un indicador sin denominador no se muestra.** «91 % de asistencia» sobre
 * cero citas no es un 91 %: es una división por cero disfrazada de logro. Cada
 * bloque comprueba su total antes de agregarse.
 */
function indicadoresDeCalidad(
  calidad: PractitionerQualityMetrics | undefined,
): readonly IndicadorDeCalidad[] {
  if (calidad === undefined) {
    return [];
  }
  const indicadores: IndicadorDeCalidad[] = [];

  if (calidad.scheduledAppointments > 0) {
    indicadores.push({
      clave: 'asistencia',
      rotulo: 'Asistencia de pacientes',
      valor: porcentaje(calidad.attendedAppointments, calidad.scheduledAppointments),
      detalle: `${calidad.attendedAppointments} de ${calidad.scheduledAppointments} citas agendadas`,
      proporcion: calidad.attendedAppointments / calidad.scheduledAppointments,
    });
  }

  if (calidad.attendedAppointments > 0) {
    indicadores.push({
      clave: 'puntualidad',
      rotulo: 'Consultas iniciadas a horario',
      valor: porcentaje(calidad.onTimeAppointments, calidad.attendedAppointments),
      detalle: `${calidad.onTimeAppointments} de ${calidad.attendedAppointments}, dentro de los 10 minutos acordados`,
      proporcion: calidad.onTimeAppointments / calidad.attendedAppointments,
    });
  }

  if (calidad.closedEncounters > 0) {
    indicadores.push({
      clave: 'documentacion',
      rotulo: 'Notas clínicas dentro de 24 h',
      valor: porcentaje(calidad.notesWithin24h, calidad.closedEncounters),
      detalle: `${calidad.notesWithin24h} de ${calidad.closedEncounters} encuentros cerrados`,
      proporcion: calidad.notesWithin24h / calidad.closedEncounters,
    });
  }

  if (calidad.uniquePatients > 0) {
    indicadores.push({
      clave: 'retencion',
      rotulo: 'Pacientes que vuelven',
      valor: porcentaje(calidad.returningPatients, calidad.uniquePatients),
      detalle: `${calidad.returningPatients} de ${calidad.uniquePatients} personas atendidas volvieron`,
      proporcion: calidad.returningPatients / calidad.uniquePatients,
    });
  }

  // Los dos últimos NO son proporciones: van con su cifra y sin barra.
  if (calidad.ratingAverage !== null && calidad.ratingCount > 0) {
    indicadores.push({
      clave: 'valoracion',
      rotulo: 'Valoración de pacientes',
      valor: `${calidad.ratingAverage.toLocaleString('es-BO', { minimumFractionDigits: 1 })} / 5`,
      detalle: `${calidad.ratingCount} valoraciones`,
      proporcion: null,
    });
  }

  if (calidad.averageDurationMinutes !== null) {
    indicadores.push({
      clave: 'duracion',
      rotulo: 'Duración media de la consulta',
      valor: `${calidad.averageDurationMinutes} min`,
      detalle: 'Desde que empieza hasta que la cerrás',
      proporcion: null,
    });
  }

  return indicadores;
}

/**
 * Una sede, lista para la ficha (ALV-005/006/010).
 *
 * La dirección se normaliza a MAYÚSCULAS **al mostrar**, no al guardar
 * (ALV-010): persistirla así destruiría el dato original sin vuelta atrás.
 */
function sedeVisible(sede: PracticeSite): SedeVisible {
  return {
    id: sede.id,
    nombre: sede.name,
    direccion: (sede.addressText ?? '').toLocaleUpperCase('es-BO'),
    punto:
      sede.latitude === null || sede.longitude === null
        ? null
        : { lat: sede.latitude, lng: sede.longitude },
  };
}

/**
 * Todos los conceptos del perfil, de una sola pasada.
 *
 * Se juntan para pedir el catálogo **una vez**: son hasta seis colecciones y una
 * lectura por colección multiplicaría por seis las peticiones de una pantalla
 * que ya hizo la suya.
 */
export function conceptosDe(perfil: OwnPractitionerProfile): readonly string[] {
  return [
    perfil.practitionerCategoryConceptId,
    perfil.verificationStatusConceptId,
    perfil.practiceStatusConceptId,
    // Los dos conceptos de la filiación. La ficha los dibuja desde que existe
    // —el departamento como sufijo del documento, «5414404 Santa Cruz», y la
    // localidad de residencia—, pero nadie pedía sus etiquetas: el `Map`
    // llegaba sin ellos, `etiquetaOpcional` devolvía cadena vacía y los dos
    // renglones se veían como si el dato no estuviera. El dato estaba; faltaba
    // pedir cómo se llama.
    perfil.issuerAdministrativeAreaConceptId,
    perfil.residenceMunicipalityConceptId,
    ...perfil.specialties.flatMap((especialidad) => [
      especialidad.specialtyConceptId,
      especialidad.verificationStatusConceptId,
    ]),
    ...perfil.credentials.flatMap((credencial) => [
      credencial.credentialTypeConceptId,
      credencial.stateConceptId,
    ]),
    ...perfil.licenses.flatMap((matricula) => [
      matricula.jurisdictionConceptId,
      matricula.stateConceptId,
    ]),
    ...perfil.languages.flatMap((idioma) =>
      idioma.proficiencyConceptId === undefined
        ? [idioma.languageConceptId]
        : [idioma.languageConceptId, idioma.proficiencyConceptId],
    ),
    // Los opcionales que no vinieron se descartan acá: mandar `undefined` en
    // la lista de ids lo convertiría en la cadena «undefined» dentro del
    // `?ids=` de la petición.
  ].filter((id): id is string => id !== undefined);
}
