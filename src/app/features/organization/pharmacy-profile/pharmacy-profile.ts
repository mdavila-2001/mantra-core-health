import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AppButton } from '../../../shared/components/atoms/button/button';
import { Chip } from '../../../shared/components/atoms/chip/chip';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import type { AlertTone } from '../../../shared/components/molecules/alert/alert.types';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { PharmacyClient } from '../../../core/data-access/pharmacy/pharmacy.client';
import type {
  PharmacyContactPerson,
  PharmacyContacts,
  PharmacyDetail,
  PharmacyLicense,
} from '../../../core/data-access/pharmacy/pharmacy.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { SAMPLE_DATA_ENABLED } from '../../../core/mock/sample-data';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { dataOf, empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AVISO_DE_VENCIMIENTO_DIAS } from '../../../shared/utils/expiry/expiry';
import { DatosDeLaEmpresa } from './company-data/company-data';
import { DocumentosLegales } from './legal-documents/legal-documents';
import { RepresentanteYGerentes } from './representative-and-managers/representative-and-managers';
import {
  DOCUMENTOS_DE_EJEMPLO,
  EMPRESA_DE_EJEMPLO,
  GENTE_DE_EJEMPLO,
  NOTA_DE_DATOS_DE_EJEMPLO,
} from './pharmacy-profile.fixtures';
import type {
  ContactoDeLaEmpresa,
  DatosLegalesDeLaEmpresa,
  DocumentoLegal,
  EstadoDeVerificacion,
  GenteDeLaEmpresa,
  TipoDeSociedad,
} from './pharmacy-profile.types';

/** Dónde está «Documentos» entre las pestañas: el aviso y el poder llevan ahí. */
const PESTANA_DE_DOCUMENTOS = 1;

/** La salida de cualquier parte de la ficha que no tiene datos que mostrar. */
const ORGANIZATION_PANEL_ROUTE = '/administration/my-organization';

/**
 * La forma societaria del contrato (`companyType.code`, el diccionario de
 * `directory`) en las palabras de la lista cerrada del registro.
 *
 * Una figura de otra jurisdicción (`US_LLC`, `BR_LTDA`…) no tiene lugar entre
 * los ocho: queda `null` antes que forzarla a una que no es.
 */
const COMPANY_TYPE_BY_CODE: Readonly<Record<string, TipoDeSociedad>> = {
  UNIPERSONAL: 'UNIPERSONAL',
  SRL: 'SRL',
  LTDA: 'LTDA',
  SA: 'S.A.',
  SOCIEDAD_COLECTIVA: 'SOCIEDAD COLECTIVA',
  COMANDITA_SIMPLE: 'SOCIEDAD EN COMANDITA SIMPLE',
  COMANDITA_ACCIONES: 'SOCIEDAD EN COMANDITA POR ACCIONES',
  SUCURSAL_EXTRANJERA: 'SUCURSAL DE SOCIEDAD EXTRANJERA',
};

/**
 * La empresa, desde `GET /pharmacy/pharmacies/:id`: razón social, forma
 * societaria, NIT, dirección legal y punto de la central.
 *
 * El `type` del DTO es el tipo de farmacia, no la forma societaria: la forma
 * viene aparte (`companyType`). Lo que la organización no registró llega
 * `null` y la pestaña lo dice; las sedes no se usan como «la central».
 */
export function companyFromPharmacyDetail(detail: PharmacyDetail): DatosLegalesDeLaEmpresa {
  return {
    razonSocial: detail.legalName,
    tipoDeSociedad:
      detail.companyType === null
        ? null
        : (COMPANY_TYPE_BY_CODE[detail.companyType.code] ?? null),
    nit: detail.taxId,
    direccionLegal: detail.legalAddressText,
    puntoCentral:
      detail.headquarters === null
        ? null
        : { lat: detail.headquarters.latitude, lng: detail.headquarters.longitude },
  };
}

/** El nombre del tipo de licencia, en castellano cuando se lo conoce. */
const LICENSE_NAME_BY_CODE: Readonly<Record<string, string>> = {
  PHARM_LICENSE_TYPE_OPERATING: 'Licencia de funcionamiento',
};

/** La revisión de la licencia, desde `PHARM_VERIFICATION_*`. */
const VERIFICATION_BY_CODE: Readonly<Record<string, EstadoDeVerificacion>> = {
  PHARM_VERIFICATION_VERIFIED: 'VERIFICADO',
  PHARM_VERIFICATION_REJECTED: 'RECHAZADO',
};

/** `AAAA-MM-DD` a fecha local, por componentes: no se corre de día por huso. */
function parseDateOnly(value: string | null): Date | null {
  if (value === null) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (year === undefined || month === undefined || day === undefined) return null;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Las licencias de la farmacia como papeles de la carpeta.
 *
 * El número va en el nombre —es lo que se busca en el cajón—, y la sede
 * cuando la licencia es de una sola. La clave es la posición: nada de esta
 * pantalla filtra el identificador técnico de la licencia. Los días hasta el
 * vencimiento los declara el servidor.
 */
export function documentsFromLicenses(
  licenses: readonly PharmacyLicense[],
): readonly DocumentoLegal[] {
  return licenses.map((licencia, index) => {
    const typeName = licencia.type
      ? (LICENSE_NAME_BY_CODE[licencia.type.code] ?? licencia.type.display)
      : 'Licencia';
    const site = licencia.siteName === null ? '' : ` · ${licencia.siteName}`;
    return {
      clave: `licencia-${index + 1}`,
      nombre: `${typeName} N.º ${licencia.number}${site}`,
      archivo: licencia.evidenceFileId === null ? 'Sin respaldo cargado' : 'Respaldo cargado',
      emitidoEl: parseDateOnly(licencia.validFrom),
      venceEl: parseDateOnly(licencia.validTo),
      diasParaVencer: licencia.daysToExpiry,
      verificacion:
        (licencia.verificationStatus &&
          VERIFICATION_BY_CODE[licencia.verificationStatus.code]) ??
        'PENDIENTE',
    };
  });
}

/** El cargo, en palabras, desde el rol canónico del contrato. */
const POSITION_BY_ROLE: Readonly<Record<string, string>> = {
  LEGAL_REPRESENTATIVE: 'Representante legal',
  GENERAL_MANAGER: 'Gerente General',
  COMMERCIAL_MANAGER: 'Gerente Comercial',
  MARKETING_MANAGER: 'Gerente Marketing',
};

function contactFromPerson(person: PharmacyContactPerson): ContactoDeLaEmpresa {
  return {
    cargo: POSITION_BY_ROLE[person.role] ?? person.role,
    nombre: person.fullName,
    celular: person.phone,
    correo: person.email,
  };
}

/**
 * Quién responde por la farmacia, desde `GET /pharmacy/pharmacies/:id/contacts`.
 *
 * Sin representante legal registrado no hay ficha que dibujar: eso es un
 * vacío (la pestaña lo dice), no una ficha con el primer lugar en blanco.
 */
export function peopleFromContacts(
  contacts: PharmacyContacts,
): ViewState<GenteDeLaEmpresa> {
  if (contacts.legalRepresentative === null) {
    return empty(
      { label: 'Ver su organización', route: ORGANIZATION_PANEL_ROUTE },
      'Su organización todavía no registró a su representante legal.',
    );
  }
  return ready({
    representante: contactFromPerson(contacts.legalRepresentative),
    gerentes: contacts.executives.map(contactFromPerson),
  });
}

/** Lo que el aviso de la carpeta dice, cuando hay algo que avisar. */
export interface AvisoDeLaCarpeta {
  readonly tono: AlertTone;
  readonly titulo: string;
  readonly mensaje: string;
}

/**
 * El estado de la carpeta legal.
 *
 * Una farmacia recién registrada no tiene ningún papel cargado, y ese vacío
 * **exige una próxima acción**: un cartel sin salida deja a alguien mirando una
 * carpeta que no sabe cómo empezar.
 */
export function estadoDeLaCarpeta(
  documentos: readonly DocumentoLegal[],
): ViewState<readonly DocumentoLegal[]> {
  return documentos.length === 0
    ? empty(
        { label: 'Cargar el primer documento' },
        'Todavía no hay ningún papel en la carpeta legal de su farmacia.',
      )
    : ready(documentos);
}

/**
 * Qué hay que avisar de la carpeta: lo vencido interrumpe, lo que está por
 * vencer espera su turno, y si no hay ni una cosa ni la otra no se dibuja nada.
 *
 * El aviso nombra los documentos, no cuenta cifras a secas: «2 por vencer» no
 * dice cuál hay que ir a renovar.
 */
export function avisoDeLaCarpeta(
  documentos: readonly DocumentoLegal[],
): AvisoDeLaCarpeta | null {
  // Un papel sin vencimiento declarado no entra al aviso: no hay plazo del que
  // avisar. Es el caso del que se acaba de cargar y todavía nadie transcribió.
  const vencidos = documentos.filter(
    (documento) => documento.diasParaVencer !== null && documento.diasParaVencer < 0,
  );
  const porVencer = documentos.filter(
    (documento) =>
      documento.diasParaVencer !== null &&
      documento.diasParaVencer >= 0 &&
      documento.diasParaVencer <= AVISO_DE_VENCIMIENTO_DIAS,
  );

  if (vencidos.length === 0 && porVencer.length === 0) {
    return null;
  }

  const partes: string[] = [];
  if (vencidos.length > 0) {
    partes.push(`${vencidos.length} ${vencidos.length === 1 ? 'vencido' : 'vencidos'}`);
  }
  if (porVencer.length > 0) {
    partes.push(`${porVencer.length} por vencer dentro de los ${AVISO_DE_VENCIMIENTO_DIAS} días`);
  }

  const nombres = [...vencidos, ...porVencer].map((documento) => documento.nombre).join(', ');

  return {
    tono: vencidos.length > 0 ? 'error' : 'warning',
    titulo: vencidos.length > 0 ? 'Hay documentos vencidos' : 'Hay documentos por vencer',
    mensaje: `Tiene ${partes.join(' y ')}: ${nombres}.`,
  };
}

/**
 * **La ficha legal de la farmacia**: lo que la empresa es en los papeles.
 *
 * Tres pestañas —la empresa, su carpeta de documentos y quién responde por
 * ella— sobre los veintidós datos que el registro del cliente pide para dar de
 * alta una farmacia. Es una ruta hermana de la bandeja del mostrador y de las
 * promociones, por el mismo motivo que aquéllas: el panel de organización es de
 * otro carril y así no se le toca una línea.
 *
 * ## La pestaña activa se controla desde acá
 *
 * Dos caminos llevan a «Documentos» desde afuera de esa pestaña: el aviso de
 * papeles vencidos, que se ve desde cualquiera de las tres, y el poder del
 * representante legal, que no se copia en su ficha porque el papel vive en la
 * carpeta. Sin la pestaña gobernada desde la página, los dos serían texto que
 * dice «andá a Documentos» sin llevar a nadie.
 *
 * ## De dónde sale cada pestaña
 *
 * Contra la API real (`SAMPLE_DATA_ENABLED` apagado) las tres pestañas leen el
 * contrato: la empresa de `GET /pharmacy/pharmacies/:id`, la carpeta de
 * `…/licenses` y la gente de `…/contacts` —estas dos, sólo para el personal de
 * la farmacia—. Son de lectura: todavía no hay dónde guardar una edición ni
 * subir un papel, así que no se ofrece. Sobre la maqueta los datos son de
 * ejemplo, la pantalla lo rotula, y ni lo que se edite ni lo que se cargue se
 * guarda en ningún lado.
 */
@Component({
  selector: 'app-pharmacy-profile',
  imports: [
    Alert,
    AppButton,
    Chip,
    DatosDeLaEmpresa,
    DocumentosLegales,
    PageHeader,
    RepresentanteYGerentes,
    Tab,
    Tabs,
  ],
  templateUrl: './pharmacy-profile.html',
  styleUrl: './pharmacy-profile.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PharmacyProfile {
  private readonly navigation = inject(NavigationService);
  private readonly injector = inject(Injector);
  private readonly pharmacy = inject(PharmacyClient);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * Maqueta (`true`) o API real (`false`). Sobre la maqueta la ficha entera es
   * de ejemplo y se rotula; contra la API real cada pestaña lee su parte del
   * contrato, en modo lectura. Ver `core/mock/sample-data.ts`.
   */
  protected readonly sampleData = inject(SAMPLE_DATA_ENABLED);

  /** El panel de «Documentos», para llevarle el foco cuando se salta hasta él. */
  private readonly panelDeDocumentos = viewChild.required<Tab, ElementRef<HTMLElement>>(
    'panelDeDocumentos',
    { read: ElementRef },
  );

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly notaDeEjemplo = NOTA_DE_DATOS_DE_EJEMPLO;

  /** Qué pestaña se ve. Gobernada desde acá: ver la nota de la clase. */
  protected readonly pestana = signal(0);

  /** Ya se está mirando la carpeta: no hay adónde llevar a nadie. */
  protected readonly enDocumentos = computed(() => this.pestana() === PESTANA_DE_DOCUMENTOS);

  protected readonly empresa = signal<ViewState<DatosLegalesDeLaEmpresa>>(
    this.sampleData ? ready(EMPRESA_DE_EJEMPLO) : loading(),
  );
  protected readonly documentos = signal<ViewState<readonly DocumentoLegal[]>>(
    this.sampleData ? estadoDeLaCarpeta(DOCUMENTOS_DE_EJEMPLO) : loading(),
  );
  protected readonly gente = signal<ViewState<GenteDeLaEmpresa>>(
    this.sampleData ? ready(GENTE_DE_EJEMPLO) : loading(),
  );

  protected readonly aviso = computed(() => avisoDeLaCarpeta(dataOf(this.documentos()) ?? []));

  constructor() {
    if (!this.sampleData) {
      this.loadProfile();
    }
  }

  /**
   * Vuelve a tomar la ficha. Sobre la maqueta el dato es local y llega
   * resuelto, así que esto repone las tres señales; contra la API real vuelve
   * a pedir las tres partes.
   */
  protected recargar(): void {
    if (!this.sampleData) {
      this.loadProfile();
      return;
    }
    this.empresa.set(ready(EMPRESA_DE_EJEMPLO));
    this.documentos.set(estadoDeLaCarpeta(DOCUMENTOS_DE_EJEMPLO));
    this.gente.set(ready(GENTE_DE_EJEMPLO));
  }

  /**
   * La ficha, desde el contrato: `GET /pharmacy/pharmacies` dice cuál es la
   * farmacia del tenant activo, y con ella se piden su perfil, su carpeta de
   * licencias y su gente.
   *
   * El directorio lista **sólo lo publicado** (activa y verificada), así que
   * una farmacia recién registrada no aparece: eso es un vacío con salida, no
   * un error, y vale para las tres pestañas. Si el tenant tuviera más de una,
   * se muestra la primera que el directorio devuelve: la ficha es de una sola
   * empresa. Cada parte falla por su cuenta: que la carpeta no cargue no
   * esconde la empresa.
   */
  private loadProfile(): void {
    this.empresa.set(loading());
    this.documentos.set(loading());
    this.gente.set(loading());
    this.pharmacy
      .listPharmacies()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          const first = page.items[0];
          if (first === undefined) {
            const unpublished = empty(
              { label: 'Ver su organización', route: ORGANIZATION_PANEL_ROUTE },
              'Su farmacia todavía no figura en el directorio publicado. Cuando se verifique, sus datos van a aparecer acá.',
            );
            this.empresa.set(unpublished);
            this.documentos.set(unpublished);
            this.gente.set(unpublished);
            return;
          }
          this.loadParts(first.id);
        },
        error: (error: unknown) => {
          this.empresa.set(errorToViewState<DatosLegalesDeLaEmpresa>(error));
          this.documentos.set(errorToViewState<readonly DocumentoLegal[]>(error));
          this.gente.set(errorToViewState<GenteDeLaEmpresa>(error));
        },
      });
  }

  /** Las tres partes de la ficha de una farmacia, cada una por su lado. */
  private loadParts(pharmacyId: string): void {
    this.pharmacy
      .getPharmacy(pharmacyId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detail) => this.empresa.set(ready(companyFromPharmacyDetail(detail))),
        error: (error: unknown) =>
          this.empresa.set(errorToViewState<DatosLegalesDeLaEmpresa>(error)),
      });
    this.pharmacy
      .listLicenses(pharmacyId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) =>
          this.documentos.set(
            page.items.length === 0
              ? empty(
                  { label: 'Ver su organización', route: ORGANIZATION_PANEL_ROUTE },
                  'Su farmacia todavía no tiene licencias registradas.',
                )
              : ready(documentsFromLicenses(page.items)),
          ),
        error: (error: unknown) =>
          this.documentos.set(errorToViewState<readonly DocumentoLegal[]>(error)),
      });
    this.pharmacy
      .getContacts(pharmacyId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (contacts) => this.gente.set(peopleFromContacts(contacts)),
        error: (error: unknown) => this.gente.set(errorToViewState<GenteDeLaEmpresa>(error)),
      });
  }

  /**
   * Lleva a la carpeta legal, y **lleva también el foco**.
   *
   * El panel de una pestaña que no se ve no se oculta: se destruye. Así que el
   * botón que acaba de pulsarse desaparece del documento y el foco cae al
   * `<body>`: quien navega con el teclado vuelve al principio de la página, y
   * quien usa un lector de pantalla no se entera de que la vista cambió. Por
   * eso el foco se muda al panel de destino, que ya es enfocable cuando está
   * activo.
   *
   * Se espera al dibujado siguiente porque el panel todavía no existe en el
   * momento de cambiar la pestaña: recién nace cuando Angular vuelve a pintar.
   */
  protected verDocumentos(): void {
    this.pestana.set(PESTANA_DE_DOCUMENTOS);
    afterNextRender(() => this.panelDeDocumentos().nativeElement.focus(), {
      injector: this.injector,
    });
  }
}
