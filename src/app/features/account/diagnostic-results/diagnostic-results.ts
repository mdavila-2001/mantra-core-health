import { DatePipe, DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { ActivatedRoute } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { DiagnosticsClient } from '../../../core/data-access/diagnostics/diagnostics.client';
import type {
  DiagnosticResultShare,
  PatientDiagnosticResult,
} from '../../../core/data-access/diagnostics/diagnostics.types';
import { FilesClient } from '../../../core/data-access/files/files.client';
import { TerminologyClient } from '../../../core/data-access/terminology/terminology.client';
import type {
  ConceptLabels,
  ValueSetOption,
} from '../../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { Input } from '../../../shared/components/atoms/input/input';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { DatePicker } from '../../../shared/components/organisms/date-picker/date-picker';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';

/** Tope de resultados que se traen. Nadie tiene cien estudios liberados a la vez. */
const TOPE_DE_RESULTADOS = 50;

/** Cuántos días dura un acceso compartido si la persona no cambia la fecha. */
const DIAS_DE_COMPARTIDO = 7;

/** Un resultado ya listo para mostrarse. */
interface ResultadoVisible {
  readonly reportId: string;
  readonly titulo: string;
  readonly categoria: string;
  readonly liberado: Date;
  readonly conclusion: string;
  readonly archivos: readonly ArchivoVisible[];
  /** El uuid del catálogo, para reetiquetar cuando llegue. */
  readonly codeConceptId: string;
  readonly categoryConceptId: string;
}

/** Un archivo descargable del resultado. */
interface ArchivoVisible {
  readonly id: string;
  readonly fileId: string;
  readonly rotulo: string;
}

/**
 * Los resultados de laboratorio, informes e imagen de la persona.
 *
 * ## Por qué es una pantalla aparte de «Laboratorio e imagen»
 *
 * Aquélla es la cola del laboratorio y el circuito de quien atiende: exige rol
 * clínico, se acota a la organización del contexto y muestra órdenes e informes
 * estén liberados o no. Ésta mira los mismos estudios desde el otro lado: son
 * **los propios**, sólo los que un profesional ya validó y liberó, y sin
 * identificador de paciente en ninguna parte — el backend resuelve al titular
 * por el vínculo de su cuenta, así que no hay nada que pedir de otra persona.
 *
 * ## Un informe sin liberar no aparece, y eso no es un vacío
 *
 * La lista puede estar vacía mientras hay estudios en curso. Se dice con esas
 * palabras: mostrar «no tenés resultados» a alguien que se hizo un análisis
 * ayer sería mentirle. Lo que no se hace nunca es mostrar un borrador como si
 * fuera un resultado.
 *
 * ## Compartir es temporal por construcción
 *
 * El formulario pide hasta cuándo y no ofrece «para siempre»: el backend exige
 * `validUntil` y la pantalla no inventa un plazo infinito que el contrato no
 * tiene. Los accesos vencidos se siguen listando, porque quién pudo ver un
 * resultado clínico es exactamente lo que alguien querría revisar después.
 */
@Component({
  selector: 'app-diagnostic-results',
  imports: [Alert, AppButton, Badge, DatePicker, DatePipe, FormField, Input, PageHeader],
  templateUrl: './diagnostic-results.html',
  styleUrl: './diagnostic-results.css',
  providers: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiagnosticResults {
  private readonly diagnostics = inject(DiagnosticsClient);
  private readonly terminology = inject(TerminologyClient);
  private readonly files = inject(FilesClient);
  private readonly auth = inject(AuthService);
  private readonly ruta = inject(ActivatedRoute);
  private readonly documento = inject(DOCUMENT);
  private readonly esNavegador = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);

  /**
   * La cuenta no es de un paciente.
   *
   * No es un error ni una falta de permisos: el personal de salud tiene sesión
   * válida y ninguna razón para tener resultados propios acá.
   */
  protected readonly sinPerfilDePaciente = this.auth.patientProfileId() === null;

  protected readonly resultados = signal<ViewState<readonly ResultadoVisible[]>>(loading());

  /** Etiquetas del catálogo, para no mostrar uuid en pantalla. */
  private readonly etiquetas = signal<ConceptLabels>(new Map());

  /** El resultado cuyo panel de compartidos está abierto. `null` = ninguno. */
  protected readonly abierto = signal<string | null>(null);

  /** Los compartidos del resultado abierto. */
  protected readonly compartidos = signal<readonly DiagnosticResultShare[]>([]);

  /** Con quién se está por compartir: la cuenta del profesional. */
  protected readonly destinatario = signal('');

  /** Hasta cuándo vale el acceso que se está por dar. */
  protected readonly vence = signal<Date | null>(this.porDefectoVence());

  /** La operación en curso, para el `[isLoading]` del botón. */
  protected readonly operando = signal<string | null>(null);

  protected readonly resultadosListos = computed<readonly ResultadoVisible[]>(() => {
    const estado = this.resultados();
    return estado.status === 'ready' ? estado.data : [];
  });

  /** El mensaje del vacío, que la plantilla no puede sacar del estado tipada. */
  protected readonly mensajeDeVacio = computed(() => {
    const estado = this.resultados();
    return estado.status === 'empty' ? (estado.message ?? '') : '';
  });

  /** El informe señalado en la URL, si se llegó desde «Ver resultado» (J1). */
  private readonly senalado = signal<string | null>(null);

  constructor() {
    if (!this.sinPerfilDePaciente) {
      this.cargar();
    }

    this.ruta.fragment.subscribe((f) => this.senalado.set(f));

    // El `anchorScrolling` del router no alcanza acá: salta al terminar la
    // navegación, y para entonces esta lista todavía la está trayendo el
    // servidor, así que el ancla no existe. Se reintenta cuando los datos
    // llegan, que es el único momento en que el elemento ya está en el DOM.
    effect(() => {
      const destino = this.senalado();
      const listos = this.resultadosListos();
      if (destino === null || listos.length === 0 || !this.esNavegador) {
        return;
      }
      queueMicrotask(() => this.saltarA(destino));
    });
  }

  /**
   * Lleva la vista al informe señalado.
   *
   * Vive acá y no en la plantilla porque el enlace entrante viene de otra
   * pantalla («Mis órdenes», J1) y el contrato es la URL: sin esto, tocar «Ver
   * resultado» aterriza arriba de la lista entera y la persona tiene que buscar
   * su informe a mano.
   */
  private saltarA(reportId: string): void {
    const elemento = this.documento.getElementById(reportId);
    elemento?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  /* ---- lectura ------------------------------------------------------------- */

  protected cargar(): void {
    this.resultados.set(loading());
    this.diagnostics.getOwnResults(TOPE_DE_RESULTADOS).subscribe({
      next: (pagina) => {
        if (pagina.items.length === 0) {
          this.resultados.set(
            empty(
              { label: 'Buscar dónde hacerte un estudio', route: '/laboratory-directory' },
              'Todavía no hay resultados liberados. Un estudio en curso aparece acá cuando el profesional lo valida.',
            ),
          );
          return;
        }
        this.traducirConceptos(pagina.items);
        this.resultados.set(ready(pagina.items.map((item) => this.aVisible(item))));
      },
      error: (error: unknown) =>
        this.resultados.set(errorToViewState<readonly ResultadoVisible[]>(error)),
    });
  }

  /* ---- descarga ------------------------------------------------------------ */

  /**
   * Abre un archivo del informe pidiendo su URL firmada en el momento.
   *
   * Es el mismo camino que usan los adjuntos de la ficha clínica, y por la misma
   * razón: la URL vence, y emitir una por archivo al pintar la lista dejaría
   * varios enlaces vivos a datos clínicos que nadie llegó a usar. La
   * autorización de la descarga la sigue decidiendo el backend.
   */
  protected descargar(archivo: ArchivoVisible): void {
    if (this.operando() !== null) {
      return;
    }
    this.operando.set(archivo.id);
    this.files.downloadUrl(archivo.fileId).subscribe({
      next: ({ url }) => {
        this.operando.set(null);
        window.open(url, '_blank', 'noopener');
      },
      error: (error: unknown) => {
        this.operando.set(null);
        const estado = errorToViewState<null>(error);
        if (estado.status === 'forbidden') {
          // Un 403 acá no es un fallo de la aplicación: el archivo puede estar
          // marcado como PHI con una política que esta cuenta no cumple.
          this.toast.info('No tenés permiso para descargar este archivo.', 'Resultado');
          return;
        }
        this.toast.error('No pudimos abrir el archivo. Reintentá en un momento.', 'Resultado');
      },
    });
  }

  /* ---- compartir ----------------------------------------------------------- */

  /** Abre o cierra el panel de compartidos de un resultado. */
  protected alternarCompartidos(resultado: ResultadoVisible): void {
    if (this.abierto() === resultado.reportId) {
      this.abierto.set(null);
      this.compartidos.set([]);
      return;
    }
    this.abierto.set(resultado.reportId);
    this.compartidos.set([]);
    this.destinatario.set('');
    this.vence.set(this.porDefectoVence());
    this.diagnostics.listResultShares(resultado.reportId).subscribe({
      next: (items) => this.compartidos.set(items),
      // Un fallo acá no borra el resultado de la pantalla: la lista que se leyó
      // sigue siendo cierta aunque el panel no haya podido abrirse.
      error: () => this.toast.info('No pudimos leer con quién está compartido.', 'Resultado'),
    });
  }

  /** Si el formulario de compartir está completo. */
  protected readonly puedeCompartir = computed(
    () => this.destinatario().trim() !== '' && this.vence() !== null,
  );

  /** Comparte el resultado abierto con el profesional cargado. */
  protected compartir(reportId: string): void {
    const destinatario = this.destinatario().trim();
    const hasta = finDelDia(this.vence());
    if (destinatario === '' || hasta === null) {
      return;
    }

    this.operando.set(reportId);
    this.diagnostics
      .shareResult(reportId, { practitionerUserId: destinatario, validUntil: hasta })
      .subscribe({
        next: (share) => {
          this.operando.set(null);
          this.destinatario.set('');
          this.compartidos.set([
            share,
            ...this.compartidos().filter((previo) => previo.id !== share.id),
          ]);
          this.toast.success('Compartimos el resultado. El acceso vence solo.', 'Resultado');
        },
        error: (error: unknown) => {
          this.operando.set(null);
          this.avisarFalloDeCompartir(error);
        },
      });
  }

  /** Deja de compartir, con confirmación previa. */
  protected async revocar(reportId: string, share: DiagnosticResultShare): Promise<void> {
    const confirmado = await this.dialogs.confirm({
      title: 'Dejar de compartir',
      message:
        'El profesional deja de ver este resultado desde ahora. El registro de que lo compartiste se conserva.',
      confirmLabel: 'Dejar de compartir',
      cancelLabel: 'Volver',
    });
    if (!confirmado) {
      return;
    }

    this.operando.set(share.id);
    this.diagnostics.revokeResultShare(reportId, share.id).subscribe({
      next: (actualizado) => {
        this.operando.set(null);
        this.compartidos.set(
          this.compartidos().map((previo) => (previo.id === share.id ? actualizado : previo)),
        );
        this.toast.success('Dejamos de compartir el resultado.', 'Resultado');
      },
      error: (error: unknown) => {
        this.operando.set(null);
        this.avisarFalloDeCompartir(error);
      },
    });
  }

  /**
   * Traduce el fallo de compartir a un aviso.
   *
   * Un 409 o un 422 no son errores de la persona: el acceso ya estaba cerrado, o
   * el resultado dejó de poder compartirse mientras la pantalla estaba abierta.
   */
  private avisarFalloDeCompartir(error: unknown): void {
    const estado = errorToViewState<null>(error);
    const codigos = estado.status === 'validation' ? estado.issues.map((issue) => issue.code) : [];

    if (codigos.includes('CONFLICT')) {
      this.toast.info('Ese acceso ya estaba cerrado.', 'Resultado');
      return;
    }
    if (estado.status === 'validation') {
      const primero = estado.issues[0]?.message ?? '';
      this.toast.info(
        primero === '' ? 'No se pudo compartir con esos datos.' : primero,
        'Resultado',
      );
      return;
    }
    const detalle =
      estado.status === 'forbidden' || estado.status === 'error' ? (estado.message ?? '') : '';
    this.toast.error(
      detalle === '' ? 'No pudimos completar la operación. Reintentá en un momento.' : detalle,
      'Resultado',
    );
  }

  /* ---- etiquetas ----------------------------------------------------------- */

  /**
   * Pide las etiquetas de los conceptos que aparecieron.
   *
   * Se traducen los que hay, no un catálogo entero: la lista de códigos posibles
   * es del backend, y escribir un mapa acá sería inventar el catálogo y quedarse
   * desactualizado en silencio el día que cambie.
   */
  private traducirConceptos(items: readonly PatientDiagnosticResult[]): void {
    const ids = [
      ...new Set(
        items.flatMap((item) =>
          item.categoryConceptId === undefined
            ? [item.codeConceptId]
            : [item.codeConceptId, item.categoryConceptId],
        ),
      ),
    ];
    if (ids.length === 0) {
      return;
    }

    this.terminology
      .readConceptLabels(ids)
      // Si el catálogo no responde, los resultados igual se muestran con su
      // texto neutro. Perder la etiqueta no justifica perder la lista.
      .pipe(catchError(() => of(new Map<string, ValueSetOption>())))
      .subscribe((etiquetas) => {
        this.etiquetas.set(new Map([...this.etiquetas(), ...etiquetas]));
        const estado = this.resultados();
        if (estado.status === 'ready') {
          this.resultados.set(ready(estado.data.map((item) => this.reetiquetar(item))));
        }
      });
  }

  /** El nombre legible del concepto, o el texto neutro. Nunca el uuid. */
  private etiqueta(conceptId: string, neutro: string): string {
    if (conceptId === '') {
      return neutro;
    }
    const opcion = this.etiquetas().get(conceptId);
    return opcion?.display ?? opcion?.code ?? neutro;
  }

  /* ---- mapeos -------------------------------------------------------------- */

  private aVisible(item: PatientDiagnosticResult): ResultadoVisible {
    return {
      reportId: item.reportId,
      titulo: this.etiqueta(item.codeConceptId, 'Estudio'),
      categoria: this.etiqueta(item.categoryConceptId ?? '', 'Sin clasificar'),
      liberado: item.releasedAt,
      conclusion: item.conclusionText ?? '',
      codeConceptId: item.codeConceptId,
      categoryConceptId: item.categoryConceptId ?? '',
      archivos: item.files.map((archivo, indice) => ({
        id: archivo.id,
        fileId: archivo.fileId,
        rotulo: `Archivo ${indice + 1}`,
      })),
    };
  }

  /** Rehace un resultado ya pintado con lo que el catálogo trajo desde entonces. */
  private reetiquetar(item: ResultadoVisible): ResultadoVisible {
    return {
      ...item,
      titulo: this.etiqueta(item.codeConceptId, 'Estudio'),
      categoria: this.etiqueta(item.categoryConceptId, 'Sin clasificar'),
    };
  }

  /** El día de hoy más una semana: un plazo corto por defecto, no infinito. */
  private porDefectoVence(): Date {
    return new Date(Date.now() + DIAS_DE_COMPARTIDO * 24 * 60 * 60 * 1000);
  }
}

/**
 * La fecha elegida, movida al **final** de ese día.
 *
 * El selector entrega el día a las 00:00. Dejarlo así haría vencer el acceso
 * antes de que empiece el día que la persona eligió, que no es lo que quiso
 * decir al elegirlo.
 */
function finDelDia(valor: Date | null): Date | null {
  if (valor === null) {
    return null;
  }
  const fecha = new Date(valor);
  fecha.setHours(23, 59, 59, 999);
  return fecha;
}
