import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';

import type { ViewState } from '../../../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../../../shared/components/atoms/button/button';
import { NavIcon } from '../../../../../../shared/components/atoms/nav-icon/nav-icon';
import { Alert } from '../../../../../../shared/components/molecules/alert/alert';
import { RedClinicaInformeEstado } from '../informe-estado/red-clinica-informe-estado';
import {
  leerValor,
  SIMBOLO_DE_LECTURA,
  TEXTO_DE_LECTURA,
  textoDelRango,
  textoDelValor,
  type LecturaDeValor,
} from '../../red-clinica-valores';
import type { ArchivoDeInforme, DetalleDeEstudio, ResultadoDeEstudio, ValorDeResultado } from '../../red-clinica.types';

/** A row of the values table, already read. */
interface FilaDeValor {
  readonly valor: ValorDeResultado;
  readonly texto: string;
  readonly rango: string;
  readonly lectura: LecturaDeValor;
  readonly simbolo: string;
  readonly fuera: boolean;
}

/**
 * A study's sections in the detail panel: the order and its released result
 * (values against their range, conclusion, files). Presentational: the panel
 * owns the report read and the downloads, so they survive a layout change.
 */
@Component({
  selector: 'app-red-panel-estudio',
  imports: [Alert, AppButton, DatePipe, NavIcon, RedClinicaInformeEstado],
  templateUrl: './red-panel-estudio.html',
  styleUrls: ['../red-clinica-panel.secciones.css', './red-panel-estudio.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RedPanelEstudio {
  readonly d = input.required<DetalleDeEstudio>();
  /** The result to show: the one read, if it arrived; otherwise the node's. */
  readonly resultado = input<ResultadoDeEstudio | null>(null);
  /** The full report read, with its M34 states. */
  readonly lectura = input<{ readonly informeId: string; readonly estado: ViewState<ResultadoDeEstudio> } | null>(null);
  /** Files can be downloaded: there is a patient and the report they hang from. */
  readonly descargable = input(false);
  /** The download of a report file, with its states. */
  readonly descarga = input<{ readonly fileId: string; readonly estado: ViewState<null> } | null>(null);
  /** «hace N días» since the order, or `null` without a date. */
  readonly pedidoHace = input<string | null>(null);

  readonly releer = output<void>();
  readonly abrirArchivo = output<ArchivoDeInforme>();

  protected readonly textoDeLectura = TEXTO_DE_LECTURA;

  protected readonly filas = computed<readonly FilaDeValor[]>(() => {
    const r = this.resultado();
    if (r === null) return [];
    return r.valores.map((valor) => {
      const lectura = leerValor(valor);
      return {
        valor,
        texto: textoDelValor(valor),
        rango: textoDelRango(valor.rango, valor.unidad),
        lectura,
        simbolo: SIMBOLO_DE_LECTURA[lectura],
        fuera: lectura !== 'normal' && lectura !== 'sin-referencia',
      };
    });
  });

  protected readonly fueraDeRango = computed(() => this.filas().filter((f) => f.fuera).length);

  protected descargando(fileId: string): boolean {
    const d = this.descarga();
    return d !== null && d.fileId === fileId && d.estado.status === 'loading';
  }

  protected tonoDeLectura(lectura: LecturaDeValor): 'error' | 'warning' | null {
    if (lectura.startsWith('critico')) return 'error';
    if (lectura === 'normal' || lectura === 'sin-referencia') return null;
    return 'warning';
  }
}
