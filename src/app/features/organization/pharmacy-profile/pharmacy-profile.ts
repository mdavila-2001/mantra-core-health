import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { AppButton } from '../../../shared/components/atoms/button/button';
import { Chip } from '../../../shared/components/atoms/chip/chip';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import type { AlertTone } from '../../../shared/components/molecules/alert/alert.types';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { dataOf, empty, ready } from '../../../core/view-state/view-state';
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
 * ## Todavía no hay contrato detrás
 *
 * Nada de esta ficha existe en la API: no hay dato legal de la farmacia, ni
 * documento con vigencia, ni representante, ni gerentes. Los datos son de
 * ejemplo, la pantalla lo rotula, y ni lo que se edite ni lo que se cargue se
 * guarda en ningún lado. Cuando el backend publique el perfil, lo que cambia es
 * de dónde salen estas tres señales.
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

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly notaDeEjemplo = NOTA_DE_DATOS_DE_EJEMPLO;

  /** Qué pestaña se ve. Gobernada desde acá: ver la nota de la clase. */
  protected readonly pestana = signal(0);

  protected readonly empresa = signal<ViewState<DatosLegalesDeLaEmpresa>>(
    ready(EMPRESA_DE_EJEMPLO),
  );
  protected readonly documentos = signal<ViewState<readonly DocumentoLegal[]>>(
    estadoDeLaCarpeta(DOCUMENTOS_DE_EJEMPLO),
  );
  protected readonly gente = signal<ViewState<GenteDeLaEmpresa>>(ready(GENTE_DE_EJEMPLO));

  protected readonly aviso = computed(() => avisoDeLaCarpeta(dataOf(this.documentos()) ?? []));

  /**
   * Vuelve a tomar la ficha. Hoy el dato es local y llega resuelto, así que
   * esto repone las tres señales; el organismo de estados ya está cableado para
   * cuando la ficha la traiga la API y haya algo que reintentar de verdad.
   */
  protected recargar(): void {
    this.empresa.set(ready(EMPRESA_DE_EJEMPLO));
    this.documentos.set(estadoDeLaCarpeta(DOCUMENTOS_DE_EJEMPLO));
    this.gente.set(ready(GENTE_DE_EJEMPLO));
  }

  protected verDocumentos(): void {
    this.pestana.set(PESTANA_DE_DOCUMENTOS);
  }
}
