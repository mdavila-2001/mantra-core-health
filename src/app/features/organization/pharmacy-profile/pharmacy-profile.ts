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
import { of, switchMap } from 'rxjs';

import { AppButton } from '../../../shared/components/atoms/button/button';
import { Chip } from '../../../shared/components/atoms/chip/chip';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import type { AlertTone } from '../../../shared/components/molecules/alert/alert.types';
import { EmptyState } from '../../../shared/components/molecules/empty-state/empty-state';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { PharmacyClient } from '../../../core/data-access/pharmacy/pharmacy.client';
import type { PharmacyDetail } from '../../../core/data-access/pharmacy/pharmacy.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { SAMPLE_DATA_ENABLED } from '../../../core/mock/sample-data';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { dataOf, empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AVISO_DE_VENCIMIENTO_DIAS } from '../../../shared/utils/vencimiento/vencimiento';
import { DatosDeLaEmpresa } from './datos-de-la-empresa/datos-de-la-empresa';
import { DocumentosLegales } from './documentos-legales/documentos-legales';
import { RepresentanteYGerentes } from './representante-y-gerentes/representante-y-gerentes';
import {
  DOCUMENTOS_DE_EJEMPLO,
  EMPRESA_DE_EJEMPLO,
  GENTE_DE_EJEMPLO,
  NOTA_DE_DATOS_DE_EJEMPLO,
} from './pharmacy-profile.fixtures';
import type {
  DatosLegalesDeLaEmpresa,
  DocumentoLegal,
  GenteDeLaEmpresa,
} from './pharmacy-profile.types';

/** Dónde está «Documentos» entre las pestañas: el aviso y el poder llevan ahí. */
const PESTANA_DE_DOCUMENTOS = 1;

/** La salida de cualquier parte de la ficha que no tiene datos que mostrar. */
const ORGANIZATION_PANEL_ROUTE = '/administration/my-organization';

/**
 * La parte de la ficha que el directorio de farmacias sí publica.
 *
 * `GET /pharmacy/pharmacies/:id` trae la razón social (`legalName`) y nada
 * más de lo que esta pestaña pide: ni el tipo de sociedad —el `type` del DTO
 * es el tipo de farmacia, no la forma societaria—, ni el NIT, ni la dirección
 * legal de la central. Las sedes sí traen dirección y punto, pero una sede no
 * es «la central»: elegir una por su cuenta sería afirmar algo que el
 * contrato no dice. Lo que falta llega `null` y la pestaña lo dice.
 */
export function companyFromPharmacyDetail(detail: PharmacyDetail): DatosLegalesDeLaEmpresa {
  return {
    razonSocial: detail.legalName,
    tipoDeSociedad: null,
    nit: null,
    direccionLegal: null,
    puntoCentral: null,
  };
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
        'Todavía no hay ningún papel en la carpeta legal de tu farmacia.',
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
    mensaje: `Tenés ${partes.join(' y ')}: ${nombres}.`,
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
 * ## Casi todo sigue sin contrato detrás
 *
 * De esta ficha la API sólo publica la razón social (el directorio de
 * farmacias); no hay NIT, ni tipo de sociedad, ni documento con vigencia, ni
 * representante, ni gerentes. Sobre la maqueta los datos son de ejemplo, la
 * pantalla lo rotula, y ni lo que se edite ni lo que se cargue se guarda en
 * ningún lado. Contra la API real (`SAMPLE_DATA_ENABLED` apagado) la empresa
 * sale del directorio y el resto se dice no disponible: nada inventado.
 */
@Component({
  selector: 'app-pharmacy-profile',
  imports: [
    Alert,
    AppButton,
    Chip,
    DatosDeLaEmpresa,
    DocumentosLegales,
    EmptyState,
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
   * de ejemplo y se rotula; contra la API real la empresa sale del directorio
   * de farmacias, y la carpeta legal y la gente —que la API no publica— se
   * dicen no disponibles. Ver `core/mock/sample-data.ts`.
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
  /** Contra la API real queda vacía: no hay papeles que avisar ni que listar. */
  protected readonly documentos = signal<ViewState<readonly DocumentoLegal[]>>(
    this.sampleData ? estadoDeLaCarpeta(DOCUMENTOS_DE_EJEMPLO) : ready([]),
  );
  /** Contra la API real no se dibuja: la pestaña dice que no está disponible. */
  protected readonly gente = signal<ViewState<GenteDeLaEmpresa>>(
    this.sampleData ? ready(GENTE_DE_EJEMPLO) : loading(),
  );

  protected readonly aviso = computed(() => avisoDeLaCarpeta(dataOf(this.documentos()) ?? []));

  constructor() {
    if (!this.sampleData) {
      this.cargarEmpresa();
    }
  }

  /**
   * Vuelve a tomar la ficha. Sobre la maqueta el dato es local y llega
   * resuelto, así que esto repone las tres señales; contra la API real vuelve
   * a pedir la empresa, que es lo único de la ficha que la API publica.
   */
  protected recargar(): void {
    if (!this.sampleData) {
      this.cargarEmpresa();
      return;
    }
    this.empresa.set(ready(EMPRESA_DE_EJEMPLO));
    this.documentos.set(estadoDeLaCarpeta(DOCUMENTOS_DE_EJEMPLO));
    this.gente.set(ready(GENTE_DE_EJEMPLO));
  }

  /**
   * La empresa, desde el directorio de farmacias: `GET /pharmacy/pharmacies`
   * dice cuál es la farmacia del tenant activo y `GET /pharmacy/pharmacies/:id`
   * trae su perfil.
   *
   * El directorio lista **sólo lo publicado** (activa y verificada), así que
   * una farmacia recién registrada no aparece: eso es un vacío con salida, no
   * un error. Si el tenant tuviera más de una, se muestra la primera que el
   * directorio devuelve: la ficha es de una sola empresa.
   */
  private cargarEmpresa(): void {
    this.empresa.set(loading());
    this.pharmacy
      .listPharmacies()
      .pipe(
        switchMap((page) => {
          const first = page.items[0];
          return first === undefined ? of(null) : this.pharmacy.getPharmacy(first.id);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (detail) =>
          this.empresa.set(
            detail === null
              ? empty(
                  { label: 'Ver tu organización', route: ORGANIZATION_PANEL_ROUTE },
                  'Tu farmacia todavía no figura en el directorio publicado. Cuando se verifique, sus datos van a aparecer acá.',
                )
              : ready(companyFromPharmacyDetail(detail)),
          ),
        error: (error: unknown) =>
          this.empresa.set(errorToViewState<DatosLegalesDeLaEmpresa>(error)),
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
