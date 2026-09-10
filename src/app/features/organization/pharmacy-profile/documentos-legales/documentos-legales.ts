import { DatePipe, NgTemplateOutlet } from '@angular/common';
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
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { Skeleton } from '../../../../shared/components/atoms/skeleton/skeleton';
import { EmptyState } from '../../../../shared/components/molecules/empty-state/empty-state';
import {
  FileInput,
  type RejectedFile,
} from '../../../../shared/components/molecules/file-input/file-input';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { dataOf, mapData, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import {
  varianteDeVencimiento,
  vencimientoEnPalabras,
} from '../../../../shared/utils/vencimiento/vencimiento';
import { NOTA_DE_DATOS_DE_EJEMPLO } from '../pharmacy-profile.fixtures';
import {
  PAPELES_DEL_REGISTRO,
  type DocumentoLegal,
  type EstadoDeVerificacion,
} from '../pharmacy-profile.types';

/** Lo único que el registro acepta en esta carpeta: el papel escaneado en PDF. */
const ACEPTA_PDF = '.pdf,application/pdf';

/** Techo del archivo. Un escaneo de varias hojas entra de sobra en diez megas. */
const MAX_MIB = 10;
const MAX_BYTES = MAX_MIB * 1024 * 1024;

/** Cómo se dice cada estado de revisión. */
const PALABRA_DE_VERIFICACION: Readonly<Record<EstadoDeVerificacion, string>> = {
  PENDIENTE: 'Pendiente de verificación',
  VERIFICADO: 'Verificado',
};

/** Con qué severidad se pinta. Lo pendiente informa; no es un problema todavía. */
const TONO_DE_VERIFICACION: Readonly<Record<EstadoDeVerificacion, BadgeVariant>> = {
  PENDIENTE: 'info',
  VERIFICADO: 'success',
};

/** Una fila de la carpeta, con todo lo que se dibuja ya resuelto. */
interface FilaDeDocumento {
  readonly documento: DocumentoLegal;
  /** El archivo que se ve: el que estaba cargado, o el que se acaba de elegir. */
  readonly archivo: string;
  /** El archivo se eligió en esta pantalla y todavía no está subido. */
  readonly sinSubir: boolean;
  readonly vigencia: string;
  readonly tonoDeVigencia: BadgeVariant;
  readonly verificacion: string;
  readonly tonoDeVerificacion: BadgeVariant;
}

/**
 * **La carpeta legal de la farmacia**: los seis papeles que el registro del
 * cliente pide, cada uno con su archivo, desde cuándo vale, cuánto le queda y
 * en qué anda su revisión.
 *
 * ## Dos distintivos que dicen dos cosas distintas
 *
 * El plazo y la revisión son hechos independientes: un papel verificado que
 * caducó **sigue verificado**, y lo que le pasó es que se le terminó la
 * vigencia. Por eso «vencido» no es un estado de revisión — si lo fuera, ese
 * documento tendría que elegir cuál de los dos hechos contar.
 *
 * ## Lo que esta pantalla no hace, y lo dice
 *
 * Ni el archivo se descarga ni el que se elija se guarda: los documentos no
 * existen todavía en ningún contrato, así que ofrecer una descarga que baja un
 * archivo vacío o un «Guardar» que no guarda sería peor que decirlo. Las
 * acciones existen, hacen lo que se puede hacer hoy —abrir el selector, mostrar
 * el archivo elegido rotulado— y avisan qué falta para que sean de verdad.
 *
 * Un papel agregado acá nace **sin fechas declaradas**: quién las transcribe y
 * quién calcula el plazo es del módulo que todavía no existe, y derivarlas del
 * reloj del navegador daría un plazo distinto en cada pantalla.
 */
@Component({
  selector: 'app-documentos-legales',
  imports: [
    AppButton,
    Badge,
    Chip,
    DatePipe,
    EmptyState,
    FileInput,
    FormField,
    NgTemplateOutlet,
    Select,
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

  /** Si el formulario para agregar un papel que falta está desplegado. */
  protected readonly altaAbierta = signal(false);

  /** Qué papel del registro se está por cargar. */
  protected readonly papelElegido = signal<string | null>(null);

  /**
   * Lo que se eligió en pantalla, por clave del documento.
   *
   * Vive en memoria y **no se persiste en ningún lado**: al recargar vuelve a
   * verse el archivo original, que es la verdad mientras nadie lo haya subido.
   */
  private readonly archivosElegidos = signal<ReadonlyMap<string, string>>(new Map());

  /** Los papeles agregados en esta pantalla. Tampoco se persisten. */
  private readonly agregados = signal<readonly DocumentoLegal[]>([]);

  protected readonly filas = computed<readonly FilaDeDocumento[]>(() => {
    const elegidos = this.archivosElegidos();
    const recibidos = (dataOf(this.state()) ?? []).map((documento) =>
      filaDe(documento, elegidos.get(documento.clave)),
    );
    // Lo agregado va al final, en el orden en que se cargó: es lo último que
    // hizo quien está mirando y ahí es donde lo va a buscar.
    //
    // Un papel agregado también se puede reemplazar, así que su archivo sale
    // del mismo mapa que el de los demás y sólo cae al de la carga cuando
    // nadie lo reemplazó todavía. Sin esto, reemplazarlo avisaba que el
    // archivo quedaba a la vista y la fila seguía mostrando el anterior.
    const agregados = this.agregados().map((documento) =>
      filaDe(documento, elegidos.get(documento.clave) ?? documento.archivo),
    );
    return [...recibidos, ...agregados];
  });

  /**
   * El estado que la pestaña dibuja: el que llegó, con las filas de ahora.
   *
   * Cargar el primer papel saca a la carpeta del vacío sin esperar a nadie: lo
   * que se ve es lo que hay en pantalla, no lo que había al abrirla.
   */
  protected readonly vista = computed<ViewState<readonly FilaDeDocumento[]>>(() => {
    const filas = this.filas();
    const recibido = this.state();
    if (recibido.status === 'empty' && filas.length > 0) {
      return ready(filas);
    }
    return mapData(recibido, () => filas);
  });

  /** El estado vacío ya estrechado, para leerle su próxima acción. */
  protected readonly vacio = computed(() => {
    const vista = this.vista();
    return vista.status === 'empty' ? vista : null;
  });

  /** Los papeles del registro que la carpeta todavía no tiene. */
  protected readonly papelesQueFaltan = computed<readonly SelectOption<string>[]>(() => {
    const cargados = new Set(this.filas().map((fila) => fila.documento.clave));
    return PAPELES_DEL_REGISTRO.filter((papel) => !cargados.has(papel.clave)).map((papel) => ({
      value: papel.clave,
      label: papel.nombre,
    }));
  });

  /** Con los seis papeles cargados no hay nada que agregar, y no se ofrece. */
  protected readonly puedeAgregar = computed(() => this.papelesQueFaltan().length > 0);

  /** Abre el alta con el primer papel que falta ya elegido: casi siempre es ése. */
  protected abrirAlta(): void {
    this.filaEnReemplazo.set(null);
    this.papelElegido.set(this.papelesQueFaltan()[0]?.value ?? null);
    this.altaAbierta.set(true);
  }

  protected cerrarAlta(): void {
    this.altaAbierta.set(false);
    this.papelElegido.set(null);
  }

  protected elegirPapel(clave: string | null): void {
    this.papelElegido.set(clave);
  }

  /** Agrega a la carpeta un papel que faltaba, con el archivo que se eligió. */
  protected agregarPapel(archivos: readonly File[]): void {
    const archivo = archivos[0];
    const clave = this.papelElegido();
    const papel = PAPELES_DEL_REGISTRO.find((candidato) => candidato.clave === clave);
    if (archivo === undefined || papel === undefined) return;

    this.agregados.update((actuales) => [
      ...actuales,
      {
        clave: papel.clave,
        nombre: papel.nombre,
        archivo: archivo.name,
        // Sin fechas: nadie las declaró todavía, y sacarlas del reloj daría un
        // plazo distinto en cada pantalla.
        emitidoEl: null,
        venceEl: null,
        diasParaVencer: null,
        // Recién cargado, nadie lo revisó.
        verificacion: 'PENDIENTE',
      },
    ]);
    this.cerrarAlta();
    this.avisarArchivoDeEjemplo(archivo.name);
  }

  /** Abre o cierra el selector de una fila. Solo una a la vez: se elige uno. */
  protected alternarReemplazo(clave: string): void {
    this.altaAbierta.set(false);
    this.filaEnReemplazo.update((abierta) => (abierta === clave ? null : clave));
  }

  /** Toma el archivo elegido para esa fila y cierra el selector. */
  protected tomarArchivo(clave: string, archivos: readonly File[]): void {
    const elegido = archivos[0];
    if (elegido === undefined) return;

    this.archivosElegidos.update((mapa) => new Map(mapa).set(clave, elegido.name));
    this.filaEnReemplazo.set(null);
    this.avisarArchivoDeEjemplo(elegido.name);
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

  private avisarArchivoDeEjemplo(nombre: string): void {
    this.toasts.info(
      `«${nombre}» queda a la vista mientras dure la pantalla. La carga definitiva llega con el módulo de documentos legales.`,
      'Archivo de ejemplo',
    );
  }

  private motivoDe(reason: RejectedFile['reason']): string {
    if (reason === 'tipo') return 'el registro pide el documento en PDF';
    if (reason === 'tamaño') return `pasa los ${MAX_MIB} MB que acepta la carga`;
    if (reason === 'cupo') return 'se carga de a un archivo por documento';
    return 'ya estaba elegido';
  }
}

/** La fila que se dibuja para un documento, con su archivo a la vista resuelto. */
function filaDe(documento: DocumentoLegal, elegidoEnPantalla: string | undefined): FilaDeDocumento {
  return {
    documento,
    archivo: elegidoEnPantalla ?? documento.archivo,
    sinSubir: elegidoEnPantalla !== undefined,
    vigencia: vencimientoEnPalabras(documento.diasParaVencer),
    tonoDeVigencia: varianteDeVencimiento(documento.diasParaVencer),
    verificacion: PALABRA_DE_VERIFICACION[documento.verificacion],
    tonoDeVerificacion: TONO_DE_VERIFICACION[documento.verificacion],
  };
}
