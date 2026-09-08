import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';

import { DiagnosticUnitsClient } from '../../../core/data-access/diagnostic-units/diagnostic-units.client';
import type {
  DiagnosticAccreditation,
  DiagnosticEquipment,
  DiagnosticStudy,
  DiagnosticUnitDetail,
  DiagnosticUnitSite,
} from '../../../core/data-access/diagnostic-units/diagnostic-units.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { dataOf, loading, notFound, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Card } from '../../../shared/components/molecules/card/card';
import { FactList } from '../../../shared/components/molecules/fact-list/fact-list';
import type { Hecho } from '../../../shared/components/molecules/fact-list/fact-list.types';
import { SectionHeading } from '../../../shared/components/molecules/section-heading/section-heading';
import { FactSection } from '../../../shared/components/organisms/fact-section/fact-section';
import type { BloqueDeFicha } from '../../../shared/components/organisms/fact-section/fact-section.types';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { categoryName } from '../laboratory-directory';

/** Perfil navegable de una unidad diagnóstica publicada. */
@Component({
  selector: 'app-laboratory-detail',
  imports: [Card, FactList, FactSection, PageHeader, SectionHeading, ViewStateHost],
  templateUrl: './laboratory-detail.html',
  styleUrl: './laboratory-detail.css',
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
   * El importe con la coma decimal de es-BO.
   *
   * La API sirve `amount` como cadena con punto (`40.00`) porque es un decimal
   * exacto y un `number` le comería precisión. Pintarlo tal cual dejaba
   * «40.00 Boliviano» en una pantalla donde la puntuación de al lado dice
   * «4,5»: dos separadores decimales distintos en la misma ficha.
   *
   * Se cambia el separador y no se reformatea el número: `toLocaleString` sobre
   * un `parseFloat` volvería a meter el redondeo que la cadena evita.
   */
  protected priceLabel(amount: string, currencyDisplay: string): string {
    return `${amount.replace('.', ',')} ${currencyDisplay}`;
  }

  /* ---- los datos de cada card, como pares campo → valor ------------------- */

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
   * Siguen siendo chips y no filas de la tabla: no son campos con valor, son
   * cosas que el centro **hace o no hace**. Una fila «Atención sin cita → Sí»
   * obligaría a dibujar también los «No», y una ficha llena de noes dice de un
   * centro lo que no ofrece antes que lo que sí.
   */
  protected modalidades(unit: DiagnosticUnitDetail): readonly string[] {
    const modalidades: string[] = [];
    if (unit.walkInAvailable) modalidades.push('Atención sin cita');
    if (unit.homeCollectionAvailable) modalidades.push('Toma de muestras a domicilio');
    if (unit.acceptsExternalOrders) modalidades.push('Recibe órdenes externas');
    return modalidades;
  }

  protected datosDeSede(site: DiagnosticUnitSite): readonly Hecho[] {
    return [
      { etiqueta: 'Código', valor: site.code, icono: 'tag' },
      { etiqueta: 'Rol', valor: site.role.display, icono: 'flag' },
      {
        etiqueta: 'Toma de muestras',
        valor: site.sampleCollectionAvailable === true ? 'Disponible' : null,
        icono: 'flask',
        tono: 'ok',
      },
      {
        etiqueta: 'Servicios de imagen',
        valor: site.imagingAvailable === true ? 'Disponible' : null,
        icono: 'scan',
        tono: 'ok',
      },
    ];
  }

  /**
   * Los datos de un equipo.
   *
   * La sede sólo aparece cuando el centro tiene **más de una**: la ficha que
   * motivó este rediseño repetía «Laboratorio Clínica Los Olivos · Sede
   * principal» en sus cuatro equipos —la línea más larga de la card, idéntica
   * cuatro veces— para un centro con una sola sede. Ver `sedeSiHayVarias`.
   */
  protected datosDeEquipo(equipment: DiagnosticEquipment): readonly Hecho[] {
    const modelo = [equipment.manufacturer, equipment.model]
      .filter((parte): parte is string => parte !== null && parte !== '')
      .join(' ');
    return [
      { etiqueta: 'Modelo', valor: modelo === '' ? null : modelo, icono: 'package' },
      {
        etiqueta: 'Estado',
        valor: equipment.operationalStatus.display,
        icono: 'shield',
        tono: this.tonoOperativo(equipment.operationalStatus.code),
      },
      {
        etiqueta: 'Próxima calibración',
        valor: this.fecha(equipment.nextCalibrationDueAt),
        icono: 'calendar',
      },
      { etiqueta: 'Sede', valor: this.sedeSiHayVarias(equipment.siteId), icono: 'pin' },
    ];
  }

  protected datosDeEstudio(study: DiagnosticStudy): readonly Hecho[] {
    const precio = study.prices[0];
    return [
      { etiqueta: 'Código', valor: study.code, icono: 'tag' },
      {
        etiqueta: 'Precio público',
        valor:
          precio === undefined ? null : this.priceLabel(precio.amount, precio.currency.display),
        icono: 'billing',
      },
      {
        etiqueta: 'Entrega estimada',
        valor: this.minutos(study.expectedTurnaroundMinutes),
        icono: 'history',
      },
      {
        etiqueta: 'Orden médica',
        valor: study.requiresMedicalOrder === true ? 'Requerida' : null,
        icono: 'clipboard',
        tono: 'aviso',
      },
      { etiqueta: 'Preparación', valor: study.preparationInstructions, icono: 'note' },
      { etiqueta: 'Sede', valor: this.sedeSiHayVarias(study.siteId), icono: 'pin' },
    ];
  }

  protected datosDeAcreditacion(accreditation: DiagnosticAccreditation): readonly Hecho[] {
    return [
      { etiqueta: 'Número', valor: accreditation.number, icono: 'tag' },
      { etiqueta: 'Vigente desde', valor: this.fecha(accreditation.validFrom), icono: 'calendar' },
      { etiqueta: 'Vigente hasta', valor: this.fecha(accreditation.validTo), icono: 'calendar' },
      { etiqueta: 'Sede', valor: this.sedeSiHayVarias(accreditation.siteId), icono: 'pin' },
    ];
  }

  /* ---- las cuatro secciones, como bloques de ficha ------------------------ */

  /*
     Cada `computed` traduce su lista del dominio a `BloqueDeFicha`, que es la
     forma que `app-fact-section` sabe buscar, acotar y paginar. La sección no
     sabe qué es un equipo ni un estudio: sabe que hay bloques con un nombre,
     una nota y una tabla — y eso es justo lo que la hace servir para las cuatro.
  */

  protected readonly sedes = computed<readonly BloqueDeFicha[]>(
    () =>
      this.detail()?.sites.map((site) => ({
        id: site.id,
        titulo: site.name,
        hechos: this.datosDeSede(site),
        etiquetas: site.role.display === '' ? [] : [site.role.display],
      })) ?? [],
  );

  protected readonly equipos = computed<readonly BloqueDeFicha[]>(
    () =>
      this.detail()?.equipment.map((equipment) => ({
        id: equipment.id,
        titulo: equipment.type.display,
        hechos: this.datosDeEquipo(equipment),
        // El estado es la etiqueta por la que se acota: «cuáles están en
        // mantenimiento» es la pregunta que trae a alguien a esta card.
        etiquetas: [equipment.operationalStatus.display],
      })) ?? [],
  );

  protected readonly estudios = computed<readonly BloqueDeFicha[]>(
    () =>
      this.detail()?.studies.map((study) => ({
        id: study.id,
        titulo: study.name,
        nota: study.description,
        hechos: this.datosDeEstudio(study),
        etiquetas: study.requiresMedicalOrder === true ? ['Requiere orden médica'] : ['Sin orden'],
      })) ?? [],
  );

  protected readonly acreditaciones = computed<readonly BloqueDeFicha[]>(
    () =>
      this.detail()?.accreditations.map((accreditation) => ({
        id: accreditation.id,
        titulo: accreditation.type.display,
        hechos: this.datosDeAcreditacion(accreditation),
      })) ?? [],
  );

  /* ---- las tres ayudas de formato ---------------------------------------- */

  /**
   * El nombre de la sede, **sólo si el centro tiene más de una**.
   *
   * Con una sola sede el dato no distingue nada: es el mismo texto en todas las
   * filas de todas las cards, y encima el más largo de la ficha.
   */
  private sedeSiHayVarias(siteId: string | null): string | null {
    if ((this.detail()?.sites.length ?? 0) < 2) return null;
    return this.siteName(siteId);
  }

  /**
   * La fecha en `dd/MM/yyyy`, escrita acá y no con `| date` en la plantilla.
   *
   * Porque la fila es un dato de la lista y no un trozo de marcado: para que
   * `FactList` pueda descartar los valores vacíos, tiene que recibir la fecha ya
   * escrita o `null`, no una `Date` que sólo la plantilla sabe formatear.
   *
   * Se arma con los componentes locales de la fecha —no con `toISOString`—
   * porque eso la pasaría a UTC y en Bolivia (−4) el día 1 se dibujaría como el
   * día anterior. Es el mismo error que ya costó un día en las recetas.
   */
  private fecha(valor: Date | null): string | null {
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

  /**
   * El tono de un estado operativo.
   *
   * Sólo tres casos y el resto sin tono: pintar de un color un estado que el
   * catálogo puede ampliar mañana le daría un significado que nadie decidió.
   */
  private tonoOperativo(code: string): Hecho['tono'] {
    if (code === 'OPERATIONAL' || code === 'ACTIVE') return 'ok';
    if (code === 'MAINTENANCE') return 'aviso';
    if (code === 'OUT_OF_SERVICE') return 'error';
    return undefined;
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
