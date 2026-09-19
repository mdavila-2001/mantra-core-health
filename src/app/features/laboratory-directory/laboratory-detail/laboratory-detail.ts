import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';

import { DiagnosticUnitsClient } from '../../../core/data-access/diagnostic-units/diagnostic-units.client';
import type {
  DiagnosticAccreditation,
  DiagnosticEquipment,
  DiagnosticStudy,
  DiagnosticUnitDetail,
} from '../../../core/data-access/diagnostic-units/diagnostic-units.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { dataOf, loading, notFound, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import type { BadgeVariant } from '../../../shared/components/atoms/badge/badge.types';
import { NavIcon } from '../../../shared/components/atoms/nav-icon/nav-icon';
import type { NavIconName } from '../../../shared/components/atoms/nav-icon/nav-icon.types';
import { ServiceIcon } from '../../../shared/components/atoms/service-icon/service-icon';
import { Card } from '../../../shared/components/molecules/card/card';
import { FactList } from '../../../shared/components/molecules/fact-list/fact-list';
import type { Hecho } from '../../../shared/components/molecules/fact-list/fact-list.types';
import { SearchField } from '../../../shared/components/molecules/search-field/search-field';
import { SectionHeading } from '../../../shared/components/molecules/section-heading/section-heading';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { categoryName } from '../laboratory-directory';
import { withDisplayCurrency } from '../../../core/money/display-currency';

/**
 * El código de tarifa con el que el simulador marca una cifra inventada.
 *
 * El corpus de centros es real y no recogió tarifas, así que lo que se ve en
 * esos estudios es una cifra de demostración. Llamarla «precio público» la
 * haría pasar por dato verificado.
 */
const TARIFA_DE_MAQUETA = 'MAQUETA';

/**
 * Desde cuántos estudios aparece el buscador.
 *
 * El mismo siete de `fact-section.types.ts`, y por el mismo motivo: con menos
 * se ven todos a la vez y un buscador sobre lo que ya está entero en pantalla
 * no ahorra nada — peor, sugiere que hay algo escondido.
 */
const MINIMO_PARA_BUSCAR = 7;

/** Baja a minúsculas y quita tildes, para que «Análisis» case con «analisis». */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/gu, '').toLowerCase().trim();
}

/**
 * Perfil navegable de una unidad diagnóstica publicada: un laboratorio clínico
 * o un centro de imagenología.
 *
 * ## Por qué se ve como la ficha de una farmacia
 *
 * Porque es lo mismo: un establecimiento y lo que ofrece. Hasta el 17/09/2026
 * esta pantalla dibujaba sus cuatro colecciones con `app-fact-section` —cuatro
 * cards apiladas, cada bloque una tabla campo → valor— mientras
 * `clinic-detail` y `pharmacy-detail`, que se estrenaron después, las dibujaban
 * con la rejilla de tarjetas del sistema. Dos lenguajes para la misma pregunta,
 * y el cliente lo vio: pidió que el centro de imagen se presentara «igual que
 * en los directorios de farmacia y de clínicas».
 *
 * Además, aquellas cuatro cards apiladas eran justo lo que prohíbe la regla §5
 * de `docs/components/composition-rules.md` desde el 09/09/2026.
 *
 * ## Qué se conservó de `app-fact-section`, y qué no
 *
 * Traía tres cosas: buscador desde siete bloques, chips por etiqueta y
 * paginador de seis.
 *
 * El **buscador se conserva** sobre los estudios, con el mismo umbral. No es
 * adorno: CENETROP, un laboratorio del corpus, publica **106**, y sin él la
 * rejilla los dibuja a los 106 seguidos y no hay manera de encontrar uno. Ese
 * es el único caso donde la colección no la acota la planta física.
 *
 * Los **chips y el paginador no vuelven**. Lo que los chips filtraban ahora se
 * lee en cada tarjeta —el estado del equipo, la orden médica del estudio son
 * distintivos, no una faceta escondida detrás de un control— y el paginador
 * mostraba seis de ocho equipos, que es esconder dos de cada tres para ahorrar
 * un renglón.
 */
@Component({
  selector: 'app-laboratory-detail',
  imports: [
    Badge,
    Card,
    FactList,
    NavIcon,
    PageHeader,
    SearchField,
    SectionHeading,
    ServiceIcon,
    ViewStateHost,
  ],
  templateUrl: './laboratory-detail.html',
  styleUrls: [
    '../../../shared/styles/rejilla-de-tarjetas.css',
    '../../../shared/styles/ficha-publica.css',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LaboratoryDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly units = inject(DiagnosticUnitsClient);

  protected readonly state = signal<ViewState<DiagnosticUnitDetail>>(loading());
  protected readonly detail = computed(() => dataOf(this.state()));
  protected readonly title = computed(() => this.detail()?.name ?? 'Unidad diagnóstica');
  protected readonly category = computed(() => {
    const type = this.detail()?.type;
    return type ? categoryName(type.code, type.display) : '';
  });

  /**
   * El ícono del resumen: el del centro que se está mirando.
   *
   * Un frasco de laboratorio encabezando la ficha de un centro de imagenología
   * dice de qué es la pantalla, no de qué es este centro. `flask` sigue siendo
   * el de un laboratorio y el de cualquier tipo que el catálogo agregue
   * mañana — no se inventa un dibujo para un código que no conocemos.
   */
  protected readonly iconoDelCentro = computed<NavIconName>(() =>
    this.detail()?.type.code === 'DU_TYPE_IMAGING' ? 'scan' : 'flask',
  );

  /** Lo tecleado en el buscador de estudios. */
  protected readonly terminoDeEstudio = signal('');

  /** El umbral, para la plantilla. */
  protected readonly MINIMO_PARA_BUSCAR = MINIMO_PARA_BUSCAR;

  /**
   * Los estudios que quedan tras el buscador.
   *
   * Busca sobre nombre, código, modalidad, descripción y preparación —no sólo
   * sobre el nombre— por lo mismo que buscaba `fact-section` sobre los valores
   * de la tabla: quien teclea «ayuno» busca una preparación y quien teclea
   * «TAC» busca un código. Un buscador que sólo mirara el nombre no
   * encontraría ninguno de los dos y parecería roto.
   */
  protected readonly estudiosVisibles = computed<readonly DiagnosticStudy[]>(() => {
    const estudios = this.detail()?.studies ?? [];
    const termino = normalizar(this.terminoDeEstudio());
    if (termino === '') return estudios;
    return estudios.filter((estudio) =>
      normalizar(
        [
          estudio.name,
          estudio.code,
          estudio.modality?.display ?? '',
          estudio.description ?? '',
          estudio.preparationInstructions ?? '',
        ].join(' '),
      ).includes(termino),
    );
  });

  private unitId: string | null = null;

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.unitId = params.get('unitId');
      this.load();
    });
  }

  protected retry(): void {
    this.load();
  }

  protected siteName(siteId: string | null): string | null {
    if (siteId === null) return null;
    return this.detail()?.sites.find((site) => site.id === siteId)?.name ?? null;
  }

  /**
   * El resumen del centro.
   *
   * Va en columnas y no en filas: son cuatro valores cortos que se leen de una
   * pasada para reconocer el centro, no cuatro campos que alguien viene a
   * buscar uno por uno.
   */
  protected identificacion(unit: DiagnosticUnitDetail): readonly Hecho[] {
    return [
      { etiqueta: 'Código', valor: unit.code, icono: 'tag' },
      { etiqueta: 'Categoría', valor: this.category(), icono: 'labels' },
      { etiqueta: 'Sedes', valor: String(unit.siteCount), icono: 'building' },
      { etiqueta: 'Estudios disponibles', valor: String(unit.studyCount), icono: 'results' },
    ];
  }

  /**
   * Las modalidades de atención, como texto.
   *
   * Son cosas que el centro **hace o no hace**, no campos con valor. Una fila
   * «Atención sin cita → Sí» obligaría a dibujar también los «No», y una ficha
   * llena de noes dice de un centro lo que no ofrece antes que lo que sí.
   */
  protected modalidades(unit: DiagnosticUnitDetail): readonly string[] {
    const modalidades: string[] = [];
    if (unit.walkInAvailable) modalidades.push('Atención sin cita');
    if (unit.homeCollectionAvailable) modalidades.push('Toma de muestras a domicilio');
    if (unit.acceptsExternalOrders) modalidades.push('Recibe órdenes externas');
    return modalidades;
  }

  /* ---- la tarjeta de un estudio ------------------------------------------ */

  /**
   * El renglón que distingue un estudio del de al lado: su código y, cuando la
   * hay, su modalidad. Es el mismo `rejilla__dato` que el catálogo de
   * administración escribe para la misma oferta.
   */
  protected referenciaDeEstudio(study: DiagnosticStudy): string {
    const modalidad = study.modality?.display;
    return modalidad === undefined || modalidad === ''
      ? study.code
      : `${study.code} · ${modalidad}`;
  }

  /** El rótulo del importe: sólo es «público» el que el centro publicó. */
  protected rotuloDelPrecio(study: DiagnosticStudy): string {
    return study.prices[0]?.scheduleCode === TARIFA_DE_MAQUETA
      ? 'Precio de demostración'
      : 'Precio público';
  }

  /**
   * El importe con la coma decimal de es-BO, o `null` cuando no hay tarifa.
   *
   * La API sirve `amount` como cadena con punto (`40.00`) porque es un decimal
   * exacto y un `number` le comería precisión. Se cambia el separador y no se
   * reformatea el número: `toLocaleString` sobre un `parseFloat` volvería a
   * meter el redondeo que la cadena evita.
   */
  protected precioDe(study: DiagnosticStudy): string | null {
    const precio = study.prices[0];
    if (precio === undefined) return null;
    return withDisplayCurrency(precio.amount.replace('.', ','), precio.currency.display);
  }

  /** El plazo de entrega, para el distintivo. `null` si el centro no lo declaró. */
  protected entregaDe(study: DiagnosticStudy): string | null {
    return this.minutos(study.expectedTurnaroundMinutes);
  }

  /* ---- la tarjeta de un equipo ------------------------------------------- */

  /** Fabricante y modelo en un renglón, o `null` si no se declaró ninguno. */
  protected modeloDe(equipment: DiagnosticEquipment): string | null {
    const modelo = [equipment.manufacturer, equipment.model]
      .filter((parte): parte is string => parte !== null && parte !== '')
      .join(' ');
    return modelo === '' ? null : modelo;
  }

  /**
   * El tono del distintivo de estado.
   *
   * Sólo tres casos y el resto en `info`: pintar de un color un estado que el
   * catálogo puede ampliar mañana le daría un significado que nadie decidió.
   */
  protected varianteDeEstado(code: string): BadgeVariant {
    if (code === 'OPERATIONAL' || code === 'ACTIVE') return 'success';
    if (code === 'MAINTENANCE') return 'warning';
    if (code === 'OUT_OF_SERVICE') return 'error';
    return 'info';
  }

  /* ---- la tarjeta de una acreditación ------------------------------------ */

  /** «Vigente del 13/08/2025 al 13/08/2027», con las fechas que haya. */
  protected vigenciaDe(accreditation: DiagnosticAccreditation): string | null {
    const desde = this.fecha(accreditation.validFrom);
    const hasta = this.fecha(accreditation.validTo);
    if (desde !== null && hasta !== null) return `Vigente del ${desde} al ${hasta}`;
    if (hasta !== null) return `Vigente hasta el ${hasta}`;
    if (desde !== null) return `Vigente desde el ${desde}`;
    return null;
  }

  /* ---- las tres ayudas de formato ---------------------------------------- */

  /**
   * El nombre de la sede, **sólo si el centro tiene más de una**.
   *
   * Con una sola sede el dato no distingue nada: es el mismo texto en todas las
   * tarjetas, y encima el más largo de la ficha.
   */
  protected sedeSiHayVarias(siteId: string | null): string | null {
    if ((this.detail()?.sites.length ?? 0) < 2) return null;
    return this.siteName(siteId);
  }

  /**
   * La fecha en `dd/MM/yyyy`, escrita acá y no con `| date` en la plantilla,
   * para que el `@if … as` pueda descartar la que no existe.
   *
   * Se arma con los componentes locales de la fecha —no con `toISOString`—
   * porque eso la pasaría a UTC y en Bolivia (−4) el día 1 se dibujaría como el
   * día anterior. Es el mismo error que ya costó un día en las recetas.
   */
  protected fecha(valor: Date | null): string | null {
    if (valor === null) return null;
    const dia = String(valor.getDate()).padStart(2, '0');
    const mes = String(valor.getMonth() + 1).padStart(2, '0');
    return `${dia}/${mes}/${valor.getFullYear()}`;
  }

  /** Los minutos en la unidad en la que se piensan: horas cuando pasan de 90. */
  private minutos(valor: number | null): string | null {
    if (valor === null) return null;
    if (valor < 90) return `${valor} min`;
    const horas = Math.round(valor / 60);
    return horas < 48 ? `${horas} h` : `${Math.round(horas / 24)} días`;
  }

  private load(): void {
    if (!this.unitId) {
      this.state.set(notFound({ label: 'Volver al directorio', route: '/laboratory-directory' }));
      return;
    }
    this.state.set(loading());
    this.units.getById(this.unitId).subscribe({
      next: (detail) => this.state.set(ready(detail)),
      error: (error: unknown) => this.state.set(errorToViewState<DiagnosticUnitDetail>(error)),
    });
  }
}
