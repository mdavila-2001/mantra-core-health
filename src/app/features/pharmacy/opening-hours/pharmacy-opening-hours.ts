import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';

import {
  deHoraLocalDeBolivia,
  momentoDeBolivia,
} from '../../../core/data-access/pharmacy/opening-hours';
import { PharmacyClient } from '../../../core/data-access/pharmacy/pharmacy.client';
import type {
  OnCallShift,
  PharmacyOpeningHours,
  SiteOpeningHours,
} from '../../../core/data-access/pharmacy/opening-hours.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { dataOf, empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';

import { pharmacyErrorMessage } from '../pharmacy-error-message';
import { PharmacyScope } from '../pharmacy-scope';

/** Lo que la sede dice de sus 24 h, como lo elige la persona. */
type Declaracion24h = 'si' | 'no' | 'sin-declarar';

const OPCIONES_24H: readonly SelectOption<Declaracion24h>[] = [
  { value: 'si', label: 'Sí, abre las 24 horas' },
  { value: 'no', label: 'No abre las 24 horas' },
  { value: 'sin-declarar', label: 'Sin declarar' },
];

/** El borrador del turno nuevo de una sede: lo tipeado se conserva ante un fallo. */
interface BorradorDeTurno {
  readonly desdeFecha: string;
  readonly desdeHora: string;
  readonly hastaFecha: string;
  readonly hastaHora: string;
}

const BORRADOR_VACIO: BorradorDeTurno = {
  desdeFecha: '',
  desdeHora: '',
  hastaFecha: '',
  hastaHora: '',
};

/** Los errores del alta, por campo. */
interface ErroresDeTurno {
  readonly desde?: string;
  readonly hasta?: string;
}

function declaracionDe(open24h: boolean | null): Declaracion24h {
  return open24h === true ? 'si' : open24h === false ? 'no' : 'sin-declarar';
}

function open24hDe(declaracion: Declaracion24h): boolean | null {
  return declaracion === 'si' ? true : declaracion === 'no' ? false : null;
}

/** El mensaje que el servidor da a un 409/422 del turno, si lo hay. */
function mensajeDelServidor(error: unknown): string | null {
  if (error instanceof HttpErrorResponse && (error.status === 409 || error.status === 422)) {
    const cuerpo = error.error as { message?: unknown } | null;
    return typeof cuerpo?.message === 'string' ? cuerpo.message : null;
  }
  return null;
}

/**
 * **Horario y turnos** del portal de la farmacia (P34): cada sede declara si
 * abre las 24 horas y carga sus turnos de guardia, con inicio y fin.
 *
 * ## Las reglas que la pantalla repite, y quién manda
 *
 * El turno dura como mucho 72 h, no puede haber terminado, se declara hasta 62
 * días antes y no se solapa con otro de la misma sede. **Las decide la API**
 * (422 `ON_CALL_SHIFT_WINDOW_INVALID`, 409 `ON_CALL_SHIFT_OVERLAP`); la pantalla
 * sólo muestra el motivo junto al campo y conserva lo tipeado.
 *
 * Las horas se tipean en hora de Bolivia y viajan con su desplazamiento
 * (`-04:00`): no depende del huso del equipo de quien carga.
 *
 * Una sede «sin declarar» no es «cerrada de noche»: el paciente no ve nada, en
 * vez de ver una afirmación que la farmacia nunca hizo.
 */
@Component({
  selector: 'app-pharmacy-opening-hours',
  imports: [
    Alert,
    AppButton,
    Badge,
    Card,
    FormField,
    Input,
    PageHeader,
    Select,
    Tab,
    Tabs,
    ViewStateHost,
  ],
  providers: [PharmacyScope],
  templateUrl: './pharmacy-opening-hours.html',
  styleUrl: './pharmacy-opening-hours.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PharmacyOpeningHoursPage {
  protected readonly scope = inject(PharmacyScope);
  private readonly pharmacy = inject(PharmacyClient);
  private readonly toasts = inject(ToastService);

  protected readonly opciones24h = OPCIONES_24H;
  protected readonly momentoDeBolivia = momentoDeBolivia;

  protected readonly horario = signal<ViewState<readonly SiteOpeningHours[]>>(loading());
  protected readonly sedeElegida = signal(0);
  /** La sede cuyo 24 h o turno se está guardando: bloquea el doble envío. */
  protected readonly guardando = signal<string | null>(null);
  protected readonly borradores = signal<Readonly<Record<string, BorradorDeTurno>>>({});
  protected readonly errores = signal<Readonly<Record<string, ErroresDeTurno>>>({});
  /** Un fallo que no es de un campo (red, permiso), por sede. */
  protected readonly falloGeneral = signal<Readonly<Record<string, string>>>({});

  protected readonly sedes = computed(() => dataOf(this.horario()) ?? []);

  constructor() {
    effect(() => {
      if (this.scope.pharmacyId() !== null) {
        untracked(() => this.recargar());
      }
    });
  }

  protected recargar(): void {
    const pharmacyId = this.scope.pharmacyId();
    if (pharmacyId === null) {
      return;
    }
    this.horario.set(loading());
    this.pharmacy.getOpeningHours(pharmacyId).subscribe({
      next: (respuesta: PharmacyOpeningHours) =>
        this.horario.set(
          respuesta.sites.length > 0
            ? ready(respuesta.sites)
            : empty(
                { label: 'Registre una sucursal', route: '/administration/pharmacy-branches' },
                'Su farmacia todavía no tiene sucursales activas a las que cargarles horario.',
              ),
        ),
      error: (error: unknown) =>
        this.horario.set(errorToViewState<readonly SiteOpeningHours[]>(error)),
    });
  }

  protected declaracion(sede: SiteOpeningHours): Declaracion24h {
    return declaracionDe(sede.open24h);
  }

  protected cambiar24h(sede: SiteOpeningHours, valor: Declaracion24h | null): void {
    const pharmacyId = this.scope.pharmacyId();
    if (pharmacyId === null || valor === null || valor === this.declaracion(sede)) {
      return;
    }
    this.guardando.set(sede.siteId);
    this.limpiarFallo(sede.siteId);
    this.pharmacy.setOpen24h(pharmacyId, sede.siteId, open24hDe(valor)).subscribe({
      next: (actualizada) => {
        this.guardando.set(null);
        this.reemplazar(actualizada);
        this.toasts.success(
          valor === 'si'
            ? `${sede.siteName} figura como abierta las 24 h.`
            : `Se guardó el horario de ${sede.siteName}.`,
        );
      },
      error: (error: unknown) => {
        this.guardando.set(null);
        this.fallar(sede.siteId, pharmacyErrorMessage(error, 'No se pudo guardar el horario.'));
      },
    });
  }

  protected borrador(siteId: string): BorradorDeTurno {
    return this.borradores()[siteId] ?? BORRADOR_VACIO;
  }

  protected errorDe(siteId: string, campo: keyof ErroresDeTurno): string {
    return this.errores()[siteId]?.[campo] ?? '';
  }

  protected escribir(
    siteId: string,
    campo: keyof BorradorDeTurno,
    valor: string | number | null,
  ): void {
    this.borradores.update((todos) => ({
      ...todos,
      [siteId]: { ...(todos[siteId] ?? BORRADOR_VACIO), [campo]: String(valor ?? '') },
    }));
  }

  protected agregarTurno(sede: SiteOpeningHours): void {
    const pharmacyId = this.scope.pharmacyId();
    if (pharmacyId === null || this.guardando() !== null) {
      return;
    }
    const b = this.borrador(sede.siteId);
    const startsAt = deHoraLocalDeBolivia(b.desdeFecha, b.desdeHora);
    const endsAt = deHoraLocalDeBolivia(b.hastaFecha, b.hastaHora);
    const faltan: ErroresDeTurno = {
      ...(startsAt === null ? { desde: 'Indique la fecha y la hora de inicio.' } : {}),
      ...(endsAt === null ? { hasta: 'Indique la fecha y la hora de fin.' } : {}),
    };
    this.errores.update((todos) => ({ ...todos, [sede.siteId]: faltan }));
    this.limpiarFallo(sede.siteId);
    if (startsAt === null || endsAt === null) {
      return;
    }
    this.guardando.set(sede.siteId);
    this.pharmacy.createOnCallShift(pharmacyId, sede.siteId, { startsAt, endsAt }).subscribe({
      next: (turno) => {
        this.guardando.set(null);
        this.borradores.update((todos) => ({ ...todos, [sede.siteId]: BORRADOR_VACIO }));
        this.toasts.success(`Turno cargado: hasta el ${momentoDeBolivia(turno.endsAt)}.`);
        // La recarga trae el turno desde el servidor, no desde lo tipeado.
        this.recargar();
      },
      error: (error: unknown) => {
        this.guardando.set(null);
        const motivo = mensajeDelServidor(error);
        if (motivo !== null) {
          // 409 (solape) y 422 (ventana) hablan de las horas: van al campo.
          this.errores.update((todos) => ({ ...todos, [sede.siteId]: { desde: motivo } }));
          return;
        }
        this.fallar(sede.siteId, pharmacyErrorMessage(error, 'No se pudo cargar el turno.'));
      },
    });
  }

  protected cancelarTurno(sede: SiteOpeningHours, turno: OnCallShift): void {
    const pharmacyId = this.scope.pharmacyId();
    if (pharmacyId === null || this.guardando() !== null) {
      return;
    }
    this.guardando.set(sede.siteId);
    this.limpiarFallo(sede.siteId);
    this.pharmacy.cancelOnCallShift(pharmacyId, turno.id).subscribe({
      next: () => {
        this.guardando.set(null);
        this.toasts.success('Turno cancelado: ya no se muestra a los pacientes.');
        this.recargar();
      },
      error: (error: unknown) => {
        this.guardando.set(null);
        this.fallar(
          sede.siteId,
          mensajeDelServidor(error) ?? pharmacyErrorMessage(error, 'No se pudo cancelar el turno.'),
        );
      },
    });
  }

  private reemplazar(actualizada: SiteOpeningHours): void {
    this.horario.update((estado) =>
      estado.status === 'ready'
        ? ready(estado.data.map((s) => (s.siteId === actualizada.siteId ? actualizada : s)))
        : estado,
    );
  }

  private fallar(siteId: string, mensaje: string): void {
    this.falloGeneral.update((todos) => ({ ...todos, [siteId]: mensaje }));
  }

  private limpiarFallo(siteId: string): void {
    this.falloGeneral.update((todos) => {
      const { [siteId]: _quitado, ...resto } = todos;
      return resto;
    });
  }
}
