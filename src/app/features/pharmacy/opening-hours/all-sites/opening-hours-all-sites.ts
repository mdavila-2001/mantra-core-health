import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import { deHoraLocalDeBolivia } from '../../../../core/data-access/pharmacy/opening-hours';
import type { SiteOpeningHours } from '../../../../core/data-access/pharmacy/opening-hours.types';
import { PharmacyClient } from '../../../../core/data-access/pharmacy/pharmacy.client';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Checkbox } from '../../../../shared/components/atoms/checkbox/checkbox';
import { Input } from '../../../../shared/components/atoms/input/input';
import { Select } from '../../../../shared/components/atoms/select/select';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';

import {
  BORRADOR_VACIO,
  OPCIONES_24H,
  open24hDe,
  type BorradorDeTurno,
  type Declaracion24h,
  type ErroresDeTurno,
} from '../opening-hours-options';
import { aplicarASedes, type ResultadoDeSede } from './apply-to-sites';

/** Which bulk operation produced the last result. */
type Operacion = '24h' | 'turno';

interface Resumen {
  readonly operacion: Operacion;
  readonly guardadas: number;
  readonly fallidas: readonly ResultadoDeSede[];
}

/**
 * The **All branches** tab of "Horario y turnos": the same 24 h declaration, or
 * the same on-call shift, for the checked sites (all of them by default).
 *
 * Applied and reported site by site ({@link aplicarASedes}): if one clashes
 * with an existing shift (409) it is named and the rest stay saved. The typed
 * shift is kept while any site is left without it.
 */
@Component({
  selector: 'app-opening-hours-all-sites',
  imports: [Alert, AppButton, Checkbox, FormField, Input, Select],
  templateUrl: './opening-hours-all-sites.html',
  styleUrl: './opening-hours-all-sites.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OpeningHoursAllSites {
  private readonly pharmacy = inject(PharmacyClient);
  private readonly toasts = inject(ToastService);

  readonly pharmacyId = input.required<string>();
  readonly sedes = input.required<readonly SiteOpeningHours[]>();
  /** Something was saved: the host reloads from the server. */
  readonly aplicado = output();

  protected readonly opciones24h = OPCIONES_24H;

  /** Sites that are NOT touched; this way a new site comes in checked. */
  protected readonly excluidas = signal<ReadonlySet<string>>(new Set());
  protected readonly declaracion = signal<Declaracion24h | null>(null);
  protected readonly borrador = signal<BorradorDeTurno>(BORRADOR_VACIO);
  protected readonly errores = signal<ErroresDeTurno>({});
  protected readonly enCurso = signal<Operacion | null>(null);
  protected readonly resumen = signal<Resumen | null>(null);

  protected readonly elegidas = computed(() =>
    this.sedes().filter((sede) => !this.excluidas().has(sede.siteId)),
  );
  protected readonly todasMarcadas = computed(() => this.elegidas().length === this.sedes().length);
  protected readonly ningunaMarcada = computed(() => this.elegidas().length === 0);

  constructor() {
    // A site that no longer exists cannot stay excluded.
    effect(() => {
      const vigentes = new Set(this.sedes().map((s) => s.siteId));
      const actuales = this.excluidas();
      if ([...actuales].some((id) => !vigentes.has(id))) {
        this.excluidas.set(new Set([...actuales].filter((id) => vigentes.has(id))));
      }
    });
  }

  protected marcada(siteId: string): boolean {
    return !this.excluidas().has(siteId);
  }

  protected marcar(siteId: string, marcada: boolean): void {
    this.excluidas.update((actual) => {
      const siguiente = new Set(actual);
      if (marcada) {
        siguiente.delete(siteId);
      } else {
        siguiente.add(siteId);
      }
      return siguiente;
    });
  }

  protected marcarTodas(marcadas: boolean): void {
    this.excluidas.set(marcadas ? new Set() : new Set(this.sedes().map((s) => s.siteId)));
  }

  protected escribir(campo: keyof BorradorDeTurno, valor: string | number | null): void {
    this.borrador.update((b) => ({ ...b, [campo]: String(valor ?? '') }));
  }

  protected aplicar24h(): void {
    const valor = this.declaracion();
    if (valor === null || this.enCurso() !== null || this.ningunaMarcada()) {
      return;
    }
    const open24h = open24hDe(valor);
    this.ejecutar(
      '24h',
      this.elegidas(),
      (sede) => this.pharmacy.setOpen24h(this.pharmacyId(), sede.siteId, open24h),
      'No se pudo guardar el horario.',
    );
  }

  protected cargarTurno(): void {
    if (this.enCurso() !== null || this.ningunaMarcada()) {
      return;
    }
    const b = this.borrador();
    const startsAt = deHoraLocalDeBolivia(b.desdeFecha, b.desdeHora);
    const endsAt = deHoraLocalDeBolivia(b.hastaFecha, b.hastaHora);
    this.errores.set({
      ...(startsAt === null ? { desde: 'Indique la fecha y la hora de inicio.' } : {}),
      ...(endsAt === null ? { hasta: 'Indique la fecha y la hora de fin.' } : {}),
    });
    if (startsAt === null || endsAt === null) {
      return;
    }
    this.ejecutar(
      'turno',
      this.elegidas(),
      (sede) =>
        this.pharmacy.createOnCallShift(this.pharmacyId(), sede.siteId, { startsAt, endsAt }),
      'No se pudo cargar el turno.',
    );
  }

  private ejecutar(
    operacion: Operacion,
    sedes: readonly SiteOpeningHours[],
    paso: Parameters<typeof aplicarASedes>[1],
    porDefecto: string,
  ): void {
    this.enCurso.set(operacion);
    this.resumen.set(null);
    aplicarASedes(sedes, paso, porDefecto).subscribe((resultados) => {
      this.enCurso.set(null);
      const fallidas = resultados.filter((r) => r.motivo !== null);
      const guardadas = resultados.length - fallidas.length;
      this.resumen.set({ operacion, guardadas, fallidas });
      if (operacion === 'turno' && fallidas.length === 0) {
        this.borrador.set(BORRADOR_VACIO);
      }
      if (guardadas > 0) {
        this.toasts.success(
          operacion === '24h'
            ? `Se guardó el horario en ${guardadas} ${guardadas === 1 ? 'sucursal' : 'sucursales'}.`
            : `Turno cargado en ${guardadas} ${guardadas === 1 ? 'sucursal' : 'sucursales'}.`,
        );
        this.aplicado.emit();
      }
    });
  }
}
