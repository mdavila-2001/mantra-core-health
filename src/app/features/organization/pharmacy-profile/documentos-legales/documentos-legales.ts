import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import { Badge } from '../../../../shared/components/atoms/badge/badge';
import type { BadgeVariant } from '../../../../shared/components/atoms/badge/badge.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Chip } from '../../../../shared/components/atoms/chip/chip';
import { Skeleton } from '../../../../shared/components/atoms/skeleton/skeleton';
import {
  FileInput,
  type RejectedFile,
} from '../../../../shared/components/molecules/file-input/file-input';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { dataOf } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import {
  varianteDeVencimiento,
  vencimientoEnPalabras,
} from '../../../../shared/utils/vencimiento/vencimiento';
import { NOTA_DE_DATOS_DE_EJEMPLO } from '../pharmacy-profile.fixtures';
import type { DocumentoLegal, EstadoDeVerificacion } from '../pharmacy-profile.types';

/** Lo único que el registro acepta en esta carpeta: el papel escaneado en PDF. */
const ACEPTA_PDF = '.pdf,application/pdf';

/** Techo del archivo. Un escaneo de varias hojas entra de sobra en diez megas. */
const MAX_MIB = 10;
const MAX_BYTES = MAX_MIB * 1024 * 1024;

/** Cómo se dice cada estado de verificación. */
const PALABRA_DE_VERIFICACION: Readonly<Record<EstadoDeVerificacion, string>> = {
  PENDIENTE: 'Pendiente de verificación',
  VERIFICADO: 'Verificado',
  VENCIDO: 'Vencido',
};

/** Con qué severidad se pinta. Lo pendiente informa; no es un problema todavía. */
const TONO_DE_VERIFICACION: Readonly<Record<EstadoDeVerificacion, BadgeVariant>> = {
  PENDIENTE: 'info',
  VERIFICADO: 'success',
  VENCIDO: 'error',
};

/** Una fila de la carpeta, con todo lo que se dibuja ya resuelto. */
interface FilaDeDocumento {
  readonly documento: DocumentoLegal;
  /** El archivo que se ve: el cargado, o el que se acaba de elegir. */
  readonly archivo: string;
  /** Se eligió uno nuevo en esta pantalla, y por eso se rotula. */
  readonly reemplazadoEnPantalla: boolean;
  readonly vigencia: string;
  readonly tonoDeVigencia: BadgeVariant;
  readonly verificacion: string;
  readonly tonoDeVerificacion: BadgeVariant;
}

/**
 * **La carpeta legal de la farmacia**: los seis papeles que el registro del
 * cliente pide, cada uno con su archivo, desde cuándo vale, cuánto le queda y
 * en qué anda su verificación.
 *
 * ## Lo que esta pantalla no hace, y lo dice
 *
 * Ni el archivo se descarga ni el que se elija se guarda: los documentos no
 * existen todavía en ningún contrato, así que ofrecer una descarga que baja un
 * archivo vacío o un «Guardar» que no guarda sería peor que decirlo. Las dos
 * acciones existen, hacen lo que se puede hacer hoy —abrir el selector, mostrar
 * el nombre elegido— y avisan qué falta para que sean de verdad.
 *
 * El plazo en palabras y su severidad salen del helper compartido, no de acá:
 * es la misma regla que usa la ficha de organización médica y no puede decir
 * dos cosas distintas según la pantalla.
 */
@Component({
  selector: 'app-documentos-legales',
  imports: [
    AppButton,
    Badge,
    Chip,
    DatePipe,
    FileInput,
    FormField,
    Skeleton,
    ViewStateHost,
  ],
  templateUrl: './documentos-legales.html',
  styleUrl: './documentos-legales.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentosLegales {
  private readonly toasts = inject(ToastService);

  readonly state = input.required<ViewState<readonly DocumentoLegal[]>>();

  /** La persona pidió reintentar; el dueño de los datos decide qué hacer. */
  readonly retry = output<void>();

  protected readonly notaDeEjemplo = NOTA_DE_DATOS_DE_EJEMPLO;
  protected readonly aceptaPdf = ACEPTA_PDF;
  protected readonly maxBytes = MAX_BYTES;

  /** Qué fila tiene abierto el selector de archivo, por clave; `null`, ninguna. */
  protected readonly filaEnReemplazo = signal<string | null>(null);

  /**
   * Lo que se eligió en pantalla, por clave del documento.
   *
   * Vive en memoria y **no se persiste en ningún lado**: al recargar vuelve a
   * verse el archivo original, que es la verdad mientras nadie lo haya subido.
   */
  private readonly archivosElegidos = signal<ReadonlyMap<string, string>>(new Map());

  protected readonly filas = computed<readonly FilaDeDocumento[]>(() => {
    const elegidos = this.archivosElegidos();
    return (dataOf(this.state()) ?? []).map((documento) => {
      const elegido = elegidos.get(documento.clave);
      return {
        documento,
        archivo: elegido ?? documento.archivo,
        reemplazadoEnPantalla: elegido !== undefined,
        vigencia: vencimientoEnPalabras(documento.diasParaVencer),
        tonoDeVigencia: varianteDeVencimiento(documento.diasParaVencer),
        verificacion: PALABRA_DE_VERIFICACION[documento.verificacion],
        tonoDeVerificacion: TONO_DE_VERIFICACION[documento.verificacion],
      };
    });
  });

  /** Abre o cierra el selector de una fila. Solo una a la vez: se elige uno. */
  protected alternarReemplazo(clave: string): void {
    this.filaEnReemplazo.update((abierta) => (abierta === clave ? null : clave));
  }

  /** Toma el archivo elegido para esa fila y cierra el selector. */
  protected tomarArchivo(clave: string, archivos: readonly File[]): void {
    const elegido = archivos[0];
    if (elegido === undefined) return;

    this.archivosElegidos.update((mapa) => new Map(mapa).set(clave, elegido.name));
    this.filaEnReemplazo.set(null);
    this.toasts.info(
      `«${elegido.name}» queda a la vista mientras dure la pantalla. La carga definitiva llega con el módulo de documentos legales.`,
      'Archivo de ejemplo',
    );
  }

  /**
   * Dice en voz alta qué archivo no entró y por qué: el control descarta en
   * silencio lo que no cumple, y sin esto arrastrar un archivo equivocado no
   * produce ningún cambio visible y se lee como una pantalla rota.
   */
  protected avisarRechazos(rechazados: readonly RejectedFile[]): void {
    if (rechazados.length === 0) return;

    const detalle = rechazados
      .map((rechazado) => `«${rechazado.file.name}» (${this.motivoDe(rechazado.reason)})`)
      .join('; ');
    this.toasts.warning(`No se pudo tomar ${detalle}.`, 'Archivo no aceptado');
  }

  /** El PDF definitivo lo guarda el módulo de documentos legales, que todavía no existe. */
  protected avisarDescarga(fila: FilaDeDocumento): void {
    this.toasts.info(
      `«${fila.archivo}» no se puede abrir desde acá todavía: los archivos llegan con el módulo de documentos legales. Lo que ves es un ejemplo.`,
      'Documento de ejemplo',
    );
  }

  private motivoDe(reason: RejectedFile['reason']): string {
    if (reason === 'tipo') return 'el registro pide el documento en PDF';
    if (reason === 'tamaño') return `pasa los ${MAX_MIB} MB que acepta la carga`;
    if (reason === 'cupo') return 'se reemplaza de a un archivo por documento';
    return 'ya estaba elegido';
  }
}
