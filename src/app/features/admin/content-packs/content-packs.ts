import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { ContentPacksClient } from '../../../core/data-access/content-packs/content-packs.client';
import type {
  ContentPack,
  ContentPackResult,
} from '../../../core/data-access/content-packs/content-packs.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';

/** Un contador del resultado, ya listo para mostrar. */
interface Contador {
  readonly nombre: string;
  readonly valor: number;
}

/**
 * Los paquetes de contenido de la plataforma — `/administration/content-packs`.
 *
 * ## Qué resuelve
 *
 * Antes, el catálogo boliviano —establecimientos, aseguradoras, nomenclador,
 * vademécum— se sembraba solo en **cada** arranque, tuviera sentido o no para
 * la instalación. Ahora el arranque siembra sólo el núcleo y esto es donde ese
 * contenido se pide, cuando alguien decide que lo quiere.
 *
 * ## Por qué no dice «aplicado» ni «pendiente»
 *
 * Porque no lo sabe, y fingir que sí sería peor. Los paquetes convergen: aplicar
 * uno dos veces devuelve cero filas nuevas la segunda, y **ese cero es la
 * respuesta**. Guardar una marca de «ya se aplicó» daría un estado que puede
 * mentir —alguien borra el contenido y la marca sigue ahí—; el contador no puede.
 */
@Component({
  selector: 'app-content-packs',
  imports: [Alert, AppButton, FormField, Input, PageHeader, ViewStateHost],
  templateUrl: './content-packs.html',
  styleUrl: './content-packs.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContentPacks {
  private readonly packs = inject(ContentPacksClient);
  private readonly toast = inject(ToastService);

  protected readonly estado = signal<ViewState<readonly ContentPack[]>>(loading());

  /** El paquete que se está aplicando, si hay alguno. */
  protected readonly aplicando = signal<string | null>(null);

  /** Lo que dejó la última aplicación, por código de paquete. */
  private readonly resultados = signal<ReadonlyMap<string, ContentPackResult>>(new Map());

  /** La contraseña para las cuentas de demostración. */
  protected readonly demoPassword = signal('');

  protected readonly paquetes = computed<readonly ContentPack[]>(() => {
    const actual = this.estado();
    return actual.status === 'ready' ? actual.data : [];
  });

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.estado.set(loading());
    this.packs.listPacks().subscribe({
      next: (items) => this.estado.set(ready(items)),
      error: (error: unknown) =>
        this.estado.set(errorToViewState<readonly ContentPack[]>(error)),
    });
  }

  /** El resultado de la última aplicación de ese paquete, si hubo alguna. */
  protected resultadoDe(code: string): ContentPackResult | undefined {
    return this.resultados().get(code);
  }

  /**
   * Los contadores del resultado, ya legibles.
   *
   * Cada paquete reporta con su propia forma —`{templates, specialties}`,
   * `{carriers, products, plans}`— y ninguna interfaz común los une. Se muestran
   * tal como vienen porque el detalle es justamente lo que dice **qué** entró.
   *
   * @param code - Paquete cuyo resultado se lee.
   */
  protected contadoresDe(code: string): readonly Contador[] {
    const counters = this.resultadoDe(code)?.counters;
    if (counters === undefined || counters === null) return [];

    return Object.entries(counters)
      .filter((entrada): entrada is [string, number] => typeof entrada[1] === 'number')
      .map(([nombre, valor]) => ({ nombre, valor }));
  }

  /**
   * Recoge lo escrito en el campo de contraseña.
   *
   * El átomo emite `string | number | null` porque sirve a los tres tipos de
   * campo; acá siempre es texto, y normalizarlo en un solo lugar evita repetir
   * la conversión en la plantilla.
   *
   * @param valor - Lo que emitió el campo.
   */
  protected cambiarPassword(valor: string | number | null): void {
    this.demoPassword.set(valor === null ? '' : String(valor));
  }

  /** Si este paquete puede aplicarse ahora. */
  protected puedeAplicar(paquete: ContentPack): boolean {
    if (this.aplicando() !== null) return false;
    return !(paquete.requiresDemoPassword && this.demoPassword().trim() === '');
  }

  /**
   * Aplica el paquete.
   *
   * @param paquete - El paquete elegido.
   */
  protected aplicar(paquete: ContentPack): void {
    if (!this.puedeAplicar(paquete)) return;

    this.aplicando.set(paquete.code);
    const contrasena = this.demoPassword().trim();

    this.packs
      .applyPack(
        paquete.code,
        paquete.requiresDemoPassword && contrasena !== '' ? contrasena : undefined,
      )
      .subscribe({
        next: (resultado) => {
          this.aplicando.set(null);
          this.resultados.update((previos) => new Map(previos).set(paquete.code, resultado));
          this.avisar(paquete, resultado);
        },
        error: (error: unknown) => {
          this.aplicando.set(null);
          const estado = errorToViewState<null>(error);
          this.toast.error(this.mensajeDe(estado), 'No se pudo aplicar');
        },
      });
  }

  /**
   * Avisa qué dejó la aplicación.
   *
   * Cero filas no es un fallo y no se anuncia como tal: es «ya estaba», que es
   * información útil y no un problema que resolver.
   *
   * @param paquete - El paquete aplicado.
   * @param resultado - Lo que dejó.
   */
  private avisar(paquete: ContentPack, resultado: ContentPackResult): void {
    if (resultado.inserted === 0) {
      this.toast.info(
        `«${paquete.name}» ya estaba cargado: no hizo falta agregar nada.`,
        'Sin cambios',
      );
      return;
    }
    this.toast.success(
      `«${paquete.name}» sumó ${resultado.inserted ?? 'sus'} filas en ${resultado.tookMs} ms.`,
      'Paquete aplicado',
    );
  }

  /**
   * Traduce el fallo a una frase.
   *
   * @param estado - El estado de vista que produjo el error.
   */
  private mensajeDe(estado: ViewState<null>): string {
    if (estado.status === 'validation') {
      return estado.issues.map((issue) => issue.message).join(' ');
    }
    if (estado.status === 'forbidden') {
      return estado.message || 'Sólo una cuenta SUPERADMIN puede aplicar paquetes.';
    }
    if (estado.status === 'offline') {
      return 'No pudimos conectarnos. Revisá tu conexión y reintentá.';
    }
    if (estado.status === 'error') {
      return `${estado.message || 'Ocurrió un error inesperado.'} (${estado.requestId})`;
    }
    return 'No se pudo aplicar el paquete.';
  }
}
