import { formatDate } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  LOCALE_ID,
  signal,
} from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';
import { SchedulingClient } from '../../../core/data-access/scheduling/scheduling.client';
import type {
  AvailabilityExceptionType,
  AvailabilityExceptionTypeOption,
  PublishedException,
} from '../../../core/data-access/scheduling/scheduling.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { Tooltip } from '../../../shared/components/atoms/tooltip/tooltip';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { misRecursosDeAgenda } from '../mi-recurso';
import {
  BlockForm,
  type BloqueoEnEdicion,
  type BloqueoPedido,
} from '../my-agenda/block-form/block-form';

/** Un bloqueo listo para pintar, con su motivo ya en palabras. */
export interface BloqueoVisible {
  readonly id: string;
  readonly desde: Date;
  readonly hasta: Date;
  /** El motivo catalogado. Es lo que también ve el paciente. */
  readonly motivo: string;
  /** La descripción libre, sólo para quien administra la agenda. */
  readonly descripcion: string | null;
  /** La clave del motivo, para poder precargarla al editar. */
  readonly tipo: AvailabilityExceptionType;
  readonly cuando: string;
  /** Ya terminó: va al histórico y no se puede quitar de la agenda futura. */
  readonly pasado: boolean;
}

/** Cuánto se mira hacia atrás y hacia adelante al listar. */
const MESES_ATRAS = 6;
const MESES_ADELANTE = 12;

/**
 * **Bloqueos de agenda** — el flujo propio que pide la bitácora.
 *
 * ## Por qué existe esta pantalla
 *
 * El pedido original del carril 11 dice, en mayúsculas: *«TIENE EL MISMO DISEÑO
 * Y RUTAS QUE TODO EL FLUJO DE HORARIOS. SIN EMBARGO, EN ESTE NO HAY SLOTS.»*
 *
 * Hasta acá bloquear era **un panel dentro de «Mi agenda»**: funcionaba, pero
 * no tenía lista, ni históricos, ni ruta propia. No se podía ver de un vistazo
 * qué bloqueos tenías, ni enlazar a ellos, ni revisar los que ya pasaron.
 *
 * ## Lo que sí se puede borrar acá, y en horarios no
 *
 * Un bloqueo **se borra de verdad**: la API tiene `DELETE` y nada en el modelo
 * lo impide. Los horarios no —`audit.schedule_templates_history` guarda una
 * fila por plantilla publicada y su FK lo prohíbe—, y por eso allá el botón es
 * «retirar». La diferencia es del modelo, no de criterio, y conviene que se
 * note en las palabras de cada pantalla.
 */
@Component({
  selector: 'app-blocks',
  imports: [Alert, AppButton, Badge, BlockForm, PageHeader, Tooltip, ViewStateHost],
  templateUrl: './blocks.html',
  styleUrl: './blocks.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Blocks {
  private readonly scheduling = inject(SchedulingClient);
  private readonly auth = inject(AuthService);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly idioma = inject(LOCALE_ID);

  protected readonly estado = signal<ViewState<readonly BloqueoVisible[]>>(loading());
  protected readonly motivos = signal<readonly AvailabilityExceptionTypeOption[]>([]);
  protected readonly borrando = signal<string | null>(null);
  protected readonly guardando = signal(false);

  /**
   * El bloqueo que se está corrigiendo, o `null` si no hay ninguno.
   *
   * Se edita **con el mismo formulario que se crea**: escribir uno aparte es
   * el camino corto que termina con dos formularios que divergen.
   */
  protected readonly editando = signal<BloqueoEnEdicion | null>(null);

  /**
   * El alta, con el mismo formulario que la corrección.
   *
   * ## Por qué no es una ruta
   *
   * `rutaNuevo` (`/schedule/blocks/new`) era un `routerLink` a una dirección
   * que ningún `Route` declara —`app.routes.ts` sólo registra `schedule/blocks`
   * a secas—, así que el botón «Bloquear días u horarios» caía en el `**`
   * (404). No hay forma de arreglarlo desde esta carpeta: `app.routes.ts` es
   * de otro carril. Mientras esa ruta no exista, el alta se abre **en la misma
   * pantalla**, con el mismo panel que ya usa la corrección — que es
   * exactamente el patrón que pide el punto 2 del pedido («mismo diseño»), y
   * evita mandar a alguien a un enlace roto.
   */
  protected readonly creando = signal(false);

  protected editar(b: BloqueoVisible): void {
    this.creando.set(false);
    this.editando.set({
      id: b.id,
      desde: b.desde,
      hasta: b.hasta,
      exceptionType: b.tipo,
      descripcion: b.descripcion,
    });
  }

  protected abrirNuevo(): void {
    this.editando.set(null);
    this.creando.set(true);
  }

  protected cancelarFormulario(): void {
    this.editando.set(null);
    this.creando.set(false);
  }

  /**
   * Guarda el formulario: crea si no había nada en edición, corrige si había.
   *
   * Manda el rango completo aunque no se haya tocado: el formulario devuelve
   * los dos instantes ya armados, y recalcular acá cuál cambió sería repetir
   * una cuenta que él ya hizo.
   */
  protected guardar(pedido: BloqueoPedido): void {
    if (this.guardando()) return;

    const actual = this.editando();
    if (actual !== null) {
      this.guardarCorreccion(actual.id, pedido);
      return;
    }
    if (this.creando()) {
      this.guardarAlta(pedido);
    }
  }

  private guardarCorreccion(id: string, pedido: BloqueoPedido): void {
    this.guardando.set(true);
    this.scheduling
      .updateException(id, {
        exceptionType: pedido.exceptionType,
        reason: pedido.motivo,
        startAt: pedido.desde.toISOString(),
        endAt: pedido.hasta.toISOString(),
      })
      .subscribe({
        next: (res) => {
          this.guardando.set(false);
          this.editando.set(null);
          this.toast.success(
            res.blockedSlots > 0
              ? `Se cerraron ${res.blockedSlots} ${res.blockedSlots === 1 ? 'turno' : 'turnos'} que quedaron dentro.`
              : 'Los turnos que ya estaban cerrados siguen cerrados.',
            'Bloqueo corregido',
          );
          this.cargar();
        },
        error: (error: unknown) => {
          this.guardando.set(false);
          this.toast.error(
            errorToViewState(error).status === 'forbidden'
              ? 'Esa agenda no es tuya.'
              : 'No se pudo guardar el cambio.',
            'No se guardó',
          );
        },
      });
  }

  private guardarAlta(pedido: BloqueoPedido): void {
    const resourceId = this.recursoId();
    if (resourceId === null) return;

    this.guardando.set(true);
    this.scheduling
      .createException(resourceId, {
        exceptionType: pedido.exceptionType,
        startAt: pedido.desde.toISOString(),
        endAt: pedido.hasta.toISOString(),
        ...(pedido.motivo.trim() === '' ? {} : { reason: pedido.motivo.trim() }),
      })
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.creando.set(false);
          this.toast.success('El rato queda cerrado.', 'Bloqueo creado');
          this.cargar();
        },
        error: (error: unknown) => {
          this.guardando.set(false);
          this.toast.error(
            errorToViewState(error).status === 'forbidden'
              ? 'Esa agenda no es tuya.'
              : 'No se pudo crear el bloqueo.',
            'No se creó',
          );
        },
      });
  }

  private readonly recursoId = signal<string | null>(null);

  /** Los que todavía no terminaron: es lo que se puede levantar. */
  protected readonly vigentes = computed(() => this.filtrar((b) => !b.pasado));

  /** Los que ya pasaron. Se muestran porque explican una agenda de antes. */
  protected readonly historicos = computed(() => this.filtrar((b) => b.pasado));

  protected readonly rutaAgenda = '/schedule/mine';

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    const tenantId = this.auth.activeTenantId();
    const perfil = this.auth.practitionerProfileId();
    if (tenantId === null || perfil === null) {
      this.estado.set(
        empty(
          { label: 'Ir a mi agenda', route: this.rutaAgenda },
          'Esta pantalla es de quien atiende: sin agenda propia no hay bloqueos que mostrar.',
        ),
      );
      return;
    }

    this.estado.set(loading());
    misRecursosDeAgenda(this.scheduling, tenantId, perfil).subscribe({
      next: (recursos) => {
        const recurso = recursos[0];
        if (recurso === undefined) {
          this.estado.set(
            empty(
              { label: 'Publicar mi agenda', route: '/schedule/new' },
              'Todavía no publicaste tu agenda: no hay nada que bloquear.',
            ),
          );
          return;
        }
        this.recursoId.set(recurso.id);
        this.leerBloqueos(recurso.id);
      },
      error: (error: unknown) =>
        this.estado.set(errorToViewState<readonly BloqueoVisible[]>(error)),
    });
  }

  /**
   * Lee el catálogo **y después** los bloqueos, en ese orden.
   *
   * No es cosmético: cada bloqueo resuelve su motivo contra el catálogo para
   * poder precargarlo al editar. Al revés —que es como estaba— la lista se
   * arma con el catálogo vacío y **todos** los motivos caen en el respaldo.
   *
   * Si el catálogo falla se leen igual: la lista se ve, y lo único que se
   * pierde es la precarga del motivo al corregir.
   */
  private leerBloqueos(resourceId: string): void {
    this.scheduling.listExceptionTypes().subscribe({
      next: (catalogo) => {
        this.motivos.set(catalogo.items);
        this.leerLista(resourceId);
      },
      error: () => {
        this.motivos.set([]);
        this.leerLista(resourceId);
      },
    });
  }

  private leerLista(resourceId: string): void {
    const desde = new Date();
    desde.setMonth(desde.getMonth() - MESES_ATRAS);
    const hasta = new Date();
    hasta.setMonth(hasta.getMonth() + MESES_ADELANTE);

    this.scheduling.listExceptions(resourceId, { from: desde, to: hasta }).subscribe({
      next: (pagina) => {
        const filas = pagina.items.map((x) => this.aVisible(x));
        this.estado.set(
          filas.length === 0
            ? empty(
                // Sin `route`: el alta se abre desde el botón de la cabecera,
                // no desde una dirección propia (ver el comentario de
                // `creando`). `ViewStateNextAction` sin ruta se pinta como
                // texto, así que la etiqueta queda en modo indicación.
                { label: 'Usá «Bloquear días u horarios», arriba' },
                'No tenés ningún bloqueo. Cuando cierres un rato, aparece acá.',
              )
            : ready(filas),
        );
      },
      error: (error: unknown) =>
        this.estado.set(errorToViewState<readonly BloqueoVisible[]>(error)),
    });
  }

  private aVisible(x: PublishedException): BloqueoVisible {
    const desde = new Date(x.startAt);
    const hasta = new Date(x.endAt);
    const todoElDia =
      desde.getHours() === 0 && desde.getMinutes() === 0 && hasta.getHours() === 0;

    const dia = (v: Date): string => formatDate(v, "d 'de' MMMM", this.idioma);
    const hora = (v: Date): string => formatDate(v, 'HH:mm', this.idioma);

    return {
      id: x.id,
      desde,
      hasta,
      // La etiqueta la manda el servidor. Si no vino, se dice que no se sabe en
      // vez de inventar un motivo.
      motivo: x.reasonLabel ?? 'Sin motivo registrado',
      // El tipo se resuelve contra el catálogo: la lectura manda el concepto y
      // el formulario necesita la clave. Sin coincidencia cae en `ABSENCE`,
      // que es lo que la pantalla mandaba antes de que hubiera catálogo.
      tipo:
        this.motivos().find((m) => m.conceptId === x.exceptionTypeConceptId)?.type ??
        'ABSENCE',
      descripcion: x.reason ?? null,
      cuando: todoElDia
        ? `${dia(desde)} — días completos`
        : `${dia(desde)}, de ${hora(desde)} a ${hora(hasta)}`,
      pasado: hasta.getTime() < Date.now(),
    };
  }

  private filtrar(predicado: (b: BloqueoVisible) => boolean): readonly BloqueoVisible[] {
    const e = this.estado();
    return e.status === 'ready' ? e.data.filter(predicado) : [];
  }

  /**
   * Quita un bloqueo.
   *
   * **Los cupos no vuelven solos.** Quitar la excepción deja de cerrar el rato,
   * pero los cupos que se cerraron al crearla ya no existen: hay que volver a
   * generarlos. Se dice, porque un horario que reaparece vacío se lee como un
   * fallo.
   */
  protected async quitar(bloqueo: BloqueoVisible): Promise<void> {
    if (this.borrando() !== null) return;

    const seguro = await this.dialogs.confirm({
      title: 'Quitar este bloqueo',
      message:
        'El rato deja de estar cerrado. Los turnos que se cerraron al crearlo no vuelven solos: ' +
        'hay que volver a publicar el horario para abrirlos.',
      details: [
        { label: 'Motivo', value: bloqueo.motivo },
        { label: 'Cuándo', value: bloqueo.cuando },
      ],
      confirmLabel: 'Quitar',
      cancelLabel: 'Volver',
      destructive: true,
    });
    if (!seguro) return;

    this.borrando.set(bloqueo.id);
    this.scheduling.deleteException(bloqueo.id).subscribe({
      next: () => {
        this.borrando.set(null);
        this.toast.success('El rato vuelve a estar libre.', 'Bloqueo quitado');
        this.cargar();
      },
      error: (error: unknown) => {
        this.borrando.set(null);
        this.toast.error(
          errorToViewState(error).status === 'forbidden'
            ? 'Esa agenda no es tuya.'
            : 'No se pudo quitar el bloqueo.',
          'No se quitó',
        );
      },
    });
  }
}
