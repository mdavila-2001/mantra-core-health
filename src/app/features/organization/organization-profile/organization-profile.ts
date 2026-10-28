import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { AuthService } from '../../../core/auth/auth.service';
import { DirectoryClient } from '../../../core/data-access/directory/directory.client';
import type {
  MyOrganization,
  OrganizationContactPerson,
  OrganizationLegalDocument,
} from '../../../core/data-access/directory/directory.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import {
  LEGAL_DOCUMENT_ROLES,
  legalDocumentText,
  type LegalDocumentRole,
} from '../../../core/i18n/legal-documents.dictionary';
import {
  COUNTRY_NAMES,
  LEGAL_ENTITY_TYPES_DICTIONARY,
  legalEntityTypeLabel,
} from '../../../core/i18n/legal-entity-types.dictionary';
import { uiLanguage } from '../../../core/i18n/ui-language';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { Card } from '../../../shared/components/molecules/card/card';
import { EmptyState } from '../../../shared/components/molecules/empty-state/empty-state';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { InsurerProfileCard } from '../../insurance/insurer-profile-card/insurer-profile-card';
import { OrganizationLogo } from '../organization-logo/organization-logo';
import { LegalDocuments } from '../pharmacy-profile/legal-documents/legal-documents';
import { PharmacyProfile, POSITION_BY_ROLE } from '../pharmacy-profile/pharmacy-profile';
import type {
  ContactoDeLaEmpresa,
  DocumentoLegal,
  EstadoDeVerificacion,
  GenteDeLaEmpresa,
} from '../pharmacy-profile/pharmacy-profile.types';
import { RepresentativeAndManagers } from '../pharmacy-profile/representative-and-managers/representative-and-managers';

/** Tipo de organización con ficha propia en «Mi perfil». */
const PHARMACY_TENANT_TYPE = 'PHARMACY';

/** Cómo se nombra, en el título, cada tipo de organización con cuenta propia. */
const PROFILE_TITLE_BY_TENANT_TYPE: Readonly<Record<string, string>> = {
  PHARMACY: 'Perfil de la farmacia',
  DIAGNOSTIC_CENTER: 'Perfil del laboratorio',
  PAYER: 'Perfil de la aseguradora',
};

/** Lo que la ficha dice cuando el dato no se registró: el renglón no se esconde. */
const SIN_REGISTRAR = 'Sin registrar';

/** Un día, para contar cuánto le falta a un papel para vencer. */
const UN_DIA_MS = 24 * 60 * 60 * 1000;

/** La revisión de un papel, desde el código del catálogo de verificación. */
const VERIFICACION_POR_CODIGO: Readonly<Record<string, EstadoDeVerificacion>> = {
  VERIFICADO: 'VERIFICADO',
  RECHAZADO: 'RECHAZADO',
};

/** Un dato de la ficha: rótulo y valor, ya en palabras. */
export interface DatoDeLaFicha {
  readonly etiqueta: string;
  readonly valor: string;
  /** Cifras (NIT, código, coordenadas): van con números tabulares. */
  readonly cifra?: boolean;
}

/** Forma societaria y país de constitución, en palabras. `null` si no se sabe. */
function formaSocietaria(
  code: string | undefined,
): { readonly forma: string; readonly pais: string } | null {
  if (code === undefined) return null;
  const lang = uiLanguage();
  const entrada = LEGAL_ENTITY_TYPES_DICTIONARY[code];
  return {
    forma: legalEntityTypeLabel(code, lang, code),
    pais: entrada ? COUNTRY_NAMES[entrada.countryIso][lang] : SIN_REGISTRAR,
  };
}

/**
 * Todo lo que la organización declaró al registrarse, y también lo que NO
 * declaró: en la ficha propia quien mira es el dueño del dato, y esconderle el
 * renglón le impide distinguir «no lo cargué» de «la app no me lo muestra».
 */
export function datosDeLaOrganizacion(org: MyOrganization): readonly DatoDeLaFicha[] {
  const forma = formaSocietaria(org.legalEntityType);
  const nit = org.payer?.regulatorIdentifier || org.taxIdentifier;
  const datos: DatoDeLaFicha[] = [
    { etiqueta: 'Razón social', valor: org.legalName },
    { etiqueta: 'Nombre comercial', valor: org.tradeName || SIN_REGISTRAR },
    { etiqueta: 'Código', valor: org.code, cifra: true },
    { etiqueta: 'Forma societaria', valor: forma?.forma ?? SIN_REGISTRAR },
    { etiqueta: 'País de constitución', valor: forma?.pais ?? SIN_REGISTRAR },
    { etiqueta: 'NIT', valor: nit || SIN_REGISTRAR, cifra: true },
    { etiqueta: 'Zona horaria', valor: org.timeZone || SIN_REGISTRAR },
  ];
  if (org.payer) {
    const { sigla, address, latitude, longitude } = org.payer;
    datos.push(
      { etiqueta: 'Sigla', valor: sigla || SIN_REGISTRAR },
      { etiqueta: 'Dirección', valor: address || SIN_REGISTRAR },
      {
        etiqueta: 'Casa matriz (latitud, longitud)',
        valor:
          latitude === undefined || longitude === undefined
            ? SIN_REGISTRAR
            : `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
        cifra: true,
      },
    );
  }
  return datos;
}

function contacto(persona: OrganizationContactPerson): ContactoDeLaEmpresa {
  return {
    cargo: POSITION_BY_ROLE[persona.role] ?? persona.role,
    nombre: persona.fullName,
    celular: persona.phone ?? null,
    correo: persona.email ?? null,
    documento: persona.idNumber ?? null,
  };
}

/**
 * Quién responde por la organización. Sin representante legal registrado no
 * hay ficha que dibujar: es un vacío que se dice, no un primer lugar en blanco.
 */
export function genteDeLaOrganizacion(org: MyOrganization): ViewState<GenteDeLaEmpresa> {
  if (org.legalRepresentative === undefined) {
    return empty(
      { label: 'Ver su organización', route: '/administration/my-organization' },
      'Su organización todavía no registró a su representante legal.',
    );
  }
  return ready({
    representante: contacto(org.legalRepresentative),
    gerentes: (org.executives ?? []).map(contacto),
  });
}

function esRolConocido(role: string): role is LegalDocumentRole {
  return (LEGAL_DOCUMENT_ROLES as readonly string[]).includes(role);
}

/**
 * Los papeles de la carpeta legal, con el nombre que la persona conoce en su
 * país (`legalDocumentText`) y el número cuando se declaró.
 *
 * «Emitido el» queda sin declarar: el alta no lo pide, y la fecha en que se
 * registró en la plataforma no es la de emisión.
 */
export function papelesDeLaOrganizacion(
  org: MyOrganization,
  hoy: Date = new Date(),
): readonly DocumentoLegal[] {
  const pais = paisDeConstitucion(org.legalEntityType);
  return (org.legalDocuments ?? []).map((papel: OrganizationLegalDocument) => {
    const base = esRolConocido(papel.role)
      ? legalDocumentText(papel.role, pais, uiLanguage()).label
      : papel.role;
    const numero = papel.documentNumber ? ` N.º ${papel.documentNumber}` : '';
    return {
      clave: papel.role,
      nombre: `${base}${numero}`,
      archivo: 'Respaldo cargado',
      emitidoEl: null,
      venceEl: papel.validTo ?? null,
      diasParaVencer:
        papel.validTo === undefined
          ? null
          : Math.ceil((papel.validTo.getTime() - hoy.getTime()) / UN_DIA_MS),
      verificacion: VERIFICACION_POR_CODIGO[papel.verificationStatus] ?? 'PENDIENTE',
    };
  });
}

/** País de constitución en ISO, para nombrar cada papel como en ese país. */
function paisDeConstitucion(legalEntityType: string | undefined): string {
  return (legalEntityType && LEGAL_ENTITY_TYPES_DICTIONARY[legalEntityType]?.countryIso) || 'BO';
}

/**
 * «Mi perfil» de una cuenta de organización: su ficha.
 *
 * La cuenta **es** la organización (ver `SessionStore.isOrganizationAccount`),
 * así que su perfil no es el de una persona sino lo que la empresa es en los
 * papeles. Un solo punto de entrada para todos los tipos:
 *
 * - **Farmacia:** la ficha completa (`PharmacyProfile`: empresa, documentos,
 *   representante y gerentes).
 * - **Los demás tipos:** UNA tarjeta con pestañas (`composition-rules.md` §5)
 *   con todo lo que la organización registró en su alta, desde
 *   `GET /tenants/me`: sus datos, quién la representa y sus gerencias, su
 *   carpeta legal y su logo; la aseguradora suma la ficha de su regulador
 *   (`InsurerProfileCard`). Representante y carpeta se dibujan con las mismas
 *   piezas que la ficha de la farmacia, de lectura.
 */
@Component({
  selector: 'app-organization-profile',
  imports: [
    Badge,
    Card,
    DatePipe,
    EmptyState,
    InsurerProfileCard,
    LegalDocuments,
    OrganizationLogo,
    PageHeader,
    PharmacyProfile,
    RepresentativeAndManagers,
    Tab,
    Tabs,
    ViewStateHost,
  ],
  templateUrl: './organization-profile.html',
  styleUrl: './organization-profile.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationProfile {
  private readonly auth = inject(AuthService);
  private readonly directory = inject(DirectoryClient);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  protected readonly esFarmacia = computed(
    () => this.auth.activeTenantType() === PHARMACY_TENANT_TYPE,
  );

  protected readonly titulo = computed(
    () =>
      PROFILE_TITLE_BY_TENANT_TYPE[this.auth.activeTenantType() ?? ''] ??
      'Perfil de la organización',
  );

  protected readonly organizaciones = signal<ViewState<readonly MyOrganization[]>>(loading());

  /** La organización activa de la sesión, que es la de esta cuenta. */
  protected readonly organizacion = computed<MyOrganization | null>(() => {
    const estado = this.organizaciones();
    if (estado.status !== 'ready') {
      return null;
    }
    const id = this.auth.activeTenantId();
    return estado.data.find((org) => org.id === id) ?? estado.data[0] ?? null;
  });

  /** Qué pestaña se está mirando. */
  protected readonly pestana = signal(0);

  protected readonly datos = computed(() => {
    const org = this.organizacion();
    return org ? datosDeLaOrganizacion(org) : [];
  });

  protected readonly gente = computed<ViewState<GenteDeLaEmpresa>>(() => {
    const org = this.organizacion();
    return org ? genteDeLaOrganizacion(org) : loading();
  });

  protected readonly papeles = computed<ViewState<readonly DocumentoLegal[]>>(() => {
    const org = this.organizacion();
    return org ? ready(papelesDeLaOrganizacion(org)) : loading();
  });

  protected readonly sinPapeles = computed(() => {
    const estado = this.papeles();
    return estado.status === 'ready' && estado.data.length === 0;
  });

  constructor() {
    // La ficha de la farmacia trae su propia carga, pero su logo, como el de todos los tipos,
    // sale de la organización que devuelve el directorio.
    this.cargar();
  }

  protected cargar(): void {
    this.organizaciones.set(loading());
    this.directory.listMyOrganizations().subscribe({
      next: (items) => this.organizaciones.set(ready(items)),
      error: (error: unknown) =>
        this.organizaciones.set(errorToViewState<readonly MyOrganization[]>(error)),
    });
  }
}
