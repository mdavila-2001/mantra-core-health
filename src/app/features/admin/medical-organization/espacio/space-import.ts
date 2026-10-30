import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { InfrastructureClient } from '../../../../core/data-access/infrastructure/infrastructure.client';
import { parsearCsv, type ResultadoDeParseo } from '../../../../core/data-access/infrastructure/infrastructure.rules';
import type { ImportResult, SiteStructure } from '../../../../core/data-access/infrastructure/infrastructure.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { NavigationService } from '../../../../core/navigation/navigation.service';
import { empty, loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../../shared/components/atoms/button/button-link';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../shared/components/molecules/card/card';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { RUTA_DE_CONSOLA } from '../infraestructura/infraestructura.presentacion';

/** La planilla de ejemplo que se ofrece para descargar. */
export const PLANTILLA_CSV = [
  'code,name,form,function,parent,areaM2,bedCategory,censable',
  '401,Habitación 401,ROOM,INPATIENT_ROOM,A-PN-P3-SI,18.5,,',
  '401-A,Cama 401-A,BED,BED_STANDARD,401,,SHARED,si',
  '401-B,Cama 401-B,BED,BED_STANDARD,401,,SHARED,si',
].join('\n');

/** Una fila de la tabla de resultado: lo del archivo y lo que dijo la API. */
export interface FilaDeResultado {
  readonly line: number;
  readonly code: string;
  readonly status: 'ok' | 'error';
  readonly errores: readonly string[];
}

/**
 * **Importación CSV** — `spaces/import?site=`.
 *
 * El contrato manda que **el cliente parsee** el CSV (§3), así que el flujo es:
 *
 * 1. pegar o elegir el archivo → `parsearCsv` dice en el acto lo que está mal
 *    de forma (columnas, obligatorios, números), por línea del archivo;
 * 2. «Validar» → `dryRun=true`: la API aplica reglas de negocio —padre, forma,
 *    tipología, código único— sin escribir nada;
 * 3. sólo si todo dio `ok`, «Confirmar» → `dryRun=false`, todo o nada.
 *
 * Cambiar el texto después de validar invalida la validación: se confirma
 * exactamente lo que se validó.
 */
@Component({
  selector: 'app-space-import',
  imports: [Alert, AppButton, AppButtonLink, Badge, Card, PageHeader, RouterLink, ViewStateHost],
  templateUrl: './space-import.html',
  styleUrl: './space-import.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpaceImport {
  private readonly client = inject(InfrastructureClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;

  protected readonly sitio = this.route.snapshot.queryParamMap.get('site');
  protected readonly rutaDeConsola = RUTA_DE_CONSOLA;
  protected readonly plantilla = `data:text/csv;charset=utf-8,${encodeURIComponent(PLANTILLA_CSV)}`;

  protected readonly estructura = signal<ViewState<SiteStructure>>(loading());
  protected readonly texto = signal('');
  protected readonly nombreDeArchivo = signal<string | null>(null);
  protected readonly enviando = signal(false);
  protected readonly fallo = signal<ViewState<never> | null>(null);
  /** El dry-run del texto actual; `null` si no se validó o el texto cambió. */
  protected readonly validacion = signal<ImportResult | null>(null);
  protected readonly creados = signal<number | null>(null);

  protected readonly parseo = computed<ResultadoDeParseo | null>(() => (this.texto().trim() === '' ? null : parsearCsv(this.texto())));

  /** Errores de forma del archivo (antes de la API). */
  protected readonly erroresDeForma = computed(() => this.parseo()?.errors ?? []);
  /** Columnas desconocidas avisan pero no impiden. */
  protected readonly erroresQueImpiden = computed(() =>
    this.erroresDeForma().filter((e) => e.reason !== 'Columna desconocida: se ignora.'),
  );

  protected readonly filasDeResultado = computed<readonly FilaDeResultado[]>(() => {
    const v = this.validacion();
    const filas = this.parseo()?.rows ?? [];
    if (v === null) return [];
    return v.rows.map((r) => ({
      line: r.line,
      code: filas.find((f) => f.line === r.line)?.code ?? '—',
      status: r.status,
      errores: r.errors.map((e) => `${e.field}: ${e.reason}`),
    }));
  });

  protected readonly puedeValidar = computed(
    () => (this.parseo()?.rows.length ?? 0) > 0 && this.erroresQueImpiden().length === 0 && !this.enviando(),
  );
  protected readonly puedeConfirmar = computed(() => this.validacion()?.ok === true && !this.enviando());

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    if (this.sitio === null) {
      this.estructura.set(empty({ label: 'Elegir el establecimiento en la consola', route: `${RUTA_DE_CONSOLA}?tab=infrastructure` }, 'La importación necesita saber en qué establecimiento.'));
      return;
    }
    this.estructura.set(loading());
    this.client
      .getStructure(this.sitio)
      .pipe(
        map((d) => ready(d) as ViewState<SiteStructure>),
        catchError((error: unknown) => of(errorToViewState<SiteStructure>(error))),
      )
      .subscribe((estado) => this.estructura.set(estado));
  }

  protected escribir(valor: string): void {
    this.texto.set(valor);
    this.validacion.set(null);
    this.creados.set(null);
    this.fallo.set(null);
  }

  protected async elegirArchivo(evento: Event): Promise<void> {
    const archivo = (evento.target as HTMLInputElement).files?.[0];
    if (archivo === undefined) return;
    this.nombreDeArchivo.set(archivo.name);
    this.escribir(await archivo.text());
  }

  protected validar(): void {
    this.enviar(true);
  }

  protected confirmar(): void {
    this.enviar(false);
  }

  protected irAlArbol(): void {
    void this.router.navigate([RUTA_DE_CONSOLA], { queryParams: { tab: 'infrastructure', site: this.sitio } });
  }

  private enviar(dryRun: boolean): void {
    const filas = this.parseo()?.rows ?? [];
    if (this.sitio === null || filas.length === 0) return;
    this.enviando.set(true);
    this.fallo.set(null);
    this.client.importCareSpaces(this.sitio, filas, dryRun).subscribe({
      next: (resultado) => {
        this.enviando.set(false);
        if (dryRun) {
          this.validacion.set(resultado);
          return;
        }
        this.validacion.set(resultado);
        this.creados.set(resultado.created ?? 0);
      },
      error: (error: unknown) => {
        this.enviando.set(false);
        this.fallo.set(errorToViewState<never>(error));
      },
    });
  }
}
