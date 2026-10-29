import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';

import { InfrastructureClient } from '../../../../../core/data-access/infrastructure/infrastructure.client';
import { infrastructureErrorToViewState } from '../../../../../core/data-access/infrastructure/infrastructure.errors';
import { PLANTILLA_CSV, parseSpacesCsv, type ParsedCsv } from '../../../../../core/data-access/infrastructure/infrastructure.csv';
import type { ImportResult, SiteSummary } from '../../../../../core/data-access/infrastructure/infrastructure.types';
import type { ViewState } from '../../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { Badge } from '../../../../../shared/components/atoms/badge/badge';
import { Textarea } from '../../../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../../../shared/components/molecules/form-field/form-field';
import { ContentDialog } from '../../../../../shared/components/organisms/content-dialog/content-dialog';
import { InfraIssueAlert } from '../issue-alert';

/** Una fila de la tabla de errores: línea **del archivo**, campo y motivo. */
interface ErrorDeLinea {
  readonly line: number;
  readonly field: string;
  readonly reason: string;
  readonly origen: 'archivo' | 'servidor';
}

type Fase = 'archivo' | 'revision';

/** Tamaño máximo que se lee: un CSV de estructura son kilobytes; más es otro archivo. */
const MAX_BYTES = 2 * 1024 * 1024;

/**
 * **Importación por CSV con validación previa en seco.**
 *
 * 1. Se elige el archivo (o se pega el texto) y el **cliente lo lee** a filas
 *    (`parseSpacesCsv`): el padre va por **código**, así que un archivo puede
 *    traer un árbol entero.
 * 2. «Validar» manda las filas a `POST …/care-spaces/import?dryRun=true`: la API
 *    juzga todo —formas, funciones, padres, códigos— y **no escribe nada**.
 * 3. La tabla muestra **cada error con su línea del archivo, el campo y el
 *    motivo**. Mientras haya uno, «Importar» no se ofrece: se corrige el
 *    archivo y se repite.
 * 4. Con la validación limpia, «Importar» manda **las mismas filas** con
 *    `dryRun=false`; la API revalida (el estado pudo cambiar entre una llamada y
 *    otra) y crea todo o nada.
 *
 * Los problemas que sólo el cliente puede ver —una celda que no es número, una
 * columna que no existe— salen en la misma tabla, marcados «archivo», y no se
 * manda nada al servidor hasta que se arreglan: mandarlo sin esa fila haría que
 * la API validara un archivo distinto del que la persona tiene en la mano.
 */
@Component({
  selector: 'app-csv-import-dialog',
  imports: [Alert, AppButton, Badge, ContentDialog, FormField, InfraIssueAlert, Textarea],
  templateUrl: './csv-import-dialog.html',
  styleUrl: './csv-import-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CsvImportDialog {
  readonly site = input.required<SiteSummary>();

  readonly imported = output<number>();
  readonly closed = output<void>();

  private readonly client = inject(InfrastructureClient);

  protected readonly fase = signal<Fase>('archivo');
  protected readonly texto = signal('');
  protected readonly nombreDeArchivo = signal('');
  protected readonly lectura = signal<string | null>(null);

  protected readonly leyendo = signal(false);
  protected readonly validando = signal(false);
  protected readonly importando = signal(false);
  protected readonly serverState = signal<ViewState<unknown> | null>(null);

  /** Lo que el cliente entendió del archivo. */
  protected readonly parseado = signal<ParsedCsv | null>(null);
  /** Lo que respondió la API en seco (o al importar, si revalidó y falló). */
  protected readonly resultado = signal<ImportResult | null>(null);

  protected readonly errores = computed<readonly ErrorDeLinea[]>(() => {
    const p = this.parseado();
    if (p === null) return [];
    const locales = p.errors.map((e): ErrorDeLinea => ({ ...e, origen: 'archivo' }));
    const r = this.resultado();
    if (r === null) return locales;
    // La API numera por posición (cabecera = línea 1, primera fila = 2): se
    // traduce a la línea física del archivo, que es la que se ve en la hoja.
    const remotos = r.rows.flatMap((fila) =>
      fila.errors.map((e): ErrorDeLinea => ({
        line: p.rows[fila.line - 2]?.line ?? fila.line,
        field: e.field,
        reason: e.reason,
        origen: 'servidor',
      })),
    );
    return [...locales, ...remotos].sort((a, b) => a.line - b.line);
  });

  protected readonly filas = computed(() => this.parseado()?.rows.length ?? 0);
  protected readonly validado = computed(() => this.resultado() !== null);
  protected readonly limpio = computed(() => this.validado() && this.resultado()!.ok && this.errores().length === 0);
  protected readonly plantillaHref = 'data:text/csv;charset=utf-8,' + encodeURIComponent(PLANTILLA_CSV);

  protected async elegirArchivo(evento: Event): Promise<void> {
    const archivo = (evento.target as HTMLInputElement).files?.[0];
    if (archivo === undefined) return;
    if (archivo.size > MAX_BYTES) {
      this.lectura.set(`«${archivo.name}» pesa más de 2 MB: no parece un CSV de estructura.`);
      return;
    }
    this.leyendo.set(true);
    try {
      this.texto.set(await archivo.text());
      this.nombreDeArchivo.set(archivo.name);
      this.lectura.set(null);
      this.reiniciarValidacion();
    } catch {
      this.lectura.set(`No se pudo leer «${archivo.name}».`);
    } finally {
      this.leyendo.set(false);
    }
  }

  protected alCambiarTexto(valor: string): void {
    this.texto.set(valor);
    this.reiniciarValidacion();
  }

  private reiniciarValidacion(): void {
    this.parseado.set(null);
    this.resultado.set(null);
    this.serverState.set(null);
    this.fase.set('archivo');
  }

  protected validar(): void {
    if (this.validando() || this.texto().trim() === '') return;
    const parseado = parseSpacesCsv(this.texto());
    this.parseado.set(parseado);
    this.resultado.set(null);
    this.serverState.set(null);
    this.fase.set('revision');
    if (parseado.errors.length > 0 || parseado.rows.length === 0) return;

    this.validando.set(true);
    this.client.importSpaces(this.site().id, parseado.rows.map((f) => f.row), true).subscribe({
      next: (r) => {
        this.validando.set(false);
        this.resultado.set(r);
      },
      error: (error: unknown) => {
        this.validando.set(false);
        this.serverState.set(infrastructureErrorToViewState<unknown>(error));
      },
    });
  }

  protected importar(): void {
    const parseado = this.parseado();
    if (!this.limpio() || parseado === null || this.importando()) return;
    this.importando.set(true);
    this.serverState.set(null);
    this.client.importSpaces(this.site().id, parseado.rows.map((f) => f.row), false).subscribe({
      next: (r) => {
        this.importando.set(false);
        if (r.ok) {
          this.imported.emit(r.created ?? parseado.rows.length);
        } else {
          // Al revalidar apareció un problema que en seco no estaba: se muestra y no se crea nada.
          this.resultado.set(r);
        }
      },
      error: (error: unknown) => {
        this.importando.set(false);
        this.serverState.set(infrastructureErrorToViewState<unknown>(error));
      },
    });
  }

  protected cerrar(): void {
    this.closed.emit();
  }
}
