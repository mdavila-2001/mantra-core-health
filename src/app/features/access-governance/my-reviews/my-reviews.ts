import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  Injector,
  inject,
  signal,
  type OnInit,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { accessFailureOf } from '../../../core/data-access/access-governance/access-errors';
import { AccessReviewsClient } from '../../../core/data-access/access-governance/access-reviews.client';
import type {
  MyReviewsStatus,
  ReviewDecision,
  ReviewDecisionKind,
  ReviewItem,
} from '../../../core/data-access/access-governance/access-reviews.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import {
  empty,
  hasData,
  loading,
  notFound,
  ready,
  stale,
} from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../shared/components/atoms/button/button-link';
import { Checkbox } from '../../../shared/components/atoms/checkbox/checkbox';
import { Input } from '../../../shared/components/atoms/input/input';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { SegmentedControl } from '../../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../../shared/components/molecules/segmented-control/segmented-control.types';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { formatDay } from '../../support-access/support-labels';
import {
  dueCounter,
  itemStateText,
  itemStateTone,
  reviewerKindText,
  sensitivityRisk,
  sensitivityTone,
} from '../review-labels';
import {
  adjustProblems,
  commentProblem,
  commentRequired,
  lastUsedText,
  MIN_COMMENT,
  unusedAtoms,
} from './review-rules';

/** Un aviso que la pantalla anuncia (`aria-live`) tras una acción. */
interface Aviso {
  readonly tone: 'success' | 'warning' | 'error' | 'info';
  readonly text: string;
}
/** Por qué el lote se rechazó: el texto de la API y los accesos que lo impiden. */
interface ErrorDeLote {
  readonly text: string;
  readonly ids: readonly string[];
}

const BAJO_RIESGO = new Set(['LOW', 'MEDIUM']);
const ACCION_DE_SOD: Readonly<Record<string, string>> = {
  BLOCK: 'bloquea',
  REQUIRE_APPROVAL: 'pide aprobación',
  WARN: 'avisa',
};
const FILTROS: readonly SegmentedOption<MyReviewsStatus>[] = [
  { value: 'PENDING', label: 'Pendientes' },
  { value: 'DECIDED', label: 'Ya revisadas' },
  { value: 'ALL', label: 'Todas' },
];

const accesos = (n: number): string => (n === 1 ? '1 acceso' : `${n} accesos`);

/**
 * **Mis revisiones** (CONTRATO-GOBIERNO §6.2 y §9.3): la bandeja de quien certifica accesos —el doctor, el jefe de
 * servicio, la administración— y el detalle de cada uno con su **evidencia**: qué puede hacer la persona, cuánto lo usó en
 * 90 días, alertas abiertas, conflictos de funciones, si pasa el techo y cuándo se certificó por última vez.
 *
 * Es la misma clase en `/my-reviews` (administración y apoyo) y en `/my-team/reviews` (el doctor); con `:itemId` muestra
 * el detalle. Decisiones: **Mantener**, **Quitar** o **Ajustar** (un ajuste solo reduce: quitar permisos o acortar la
 * vigencia). El comentario es obligatorio al quitar, al ajustar y al mantener lo de riesgo alto o crítico o lo que no se
 * usó. En lote solo se mantiene lo de bajo riesgo, todo o nada: si la API rechaza (`REVIEW_BULK_NOT_ALLOWED`) la pantalla
 * muestra cuáles lo impiden y no se cambió nada. La API decide; ocultar un control no es seguridad.
 */
@Component({
  selector: 'app-my-reviews',
  imports: [
    Alert,
    AppButton,
    AppButtonLink,
    Badge,
    Card,
    Checkbox,
    FormField,
    Input,
    PageHeader,
    RouterLink,
    SegmentedControl,
    Textarea,
    ViewStateHost,
  ],
  templateUrl: './my-reviews.html',
  styleUrl: './my-reviews.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyReviews implements OnInit {
  private readonly client = inject(AccessReviewsClient);
  private readonly dialogs = inject(DialogService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  protected readonly filtros = FILTROS;
  protected readonly minComentario = MIN_COMMENT;
  /** El doctor entra por «Mi equipo»; el resto, por «Mis revisiones». */
  protected readonly base = (this.route.snapshot.routeConfig?.path ?? '').startsWith('my-team')
    ? '/my-team/reviews'
    : '/my-reviews';
  protected readonly itemId = this.route.snapshot.paramMap.get('itemId');

  /* ---- la lista ------------------------------------------------------------------------------------------------------- */
  protected readonly state = signal<ViewState<readonly ReviewItem[]>>(loading());
  protected readonly filtro = signal<MyReviewsStatus>('PENDING');
  protected readonly seleccion = signal<ReadonlySet<string>>(new Set());
  protected readonly errorDeLote = signal<ErrorDeLote | null>(null);
  protected readonly resultadoDeLote = signal<Aviso | null>(null);
  protected readonly trabajandoEnLote = signal(false);
  private cargadoEn = new Date();

  /* ---- el detalle ----------------------------------------------------------------------------------------------------- */
  protected readonly detalle = signal<ViewState<ReviewItem>>(loading());
  protected readonly decision = signal<ReviewDecisionKind | null>(null);
  protected readonly comentario = signal('');
  protected readonly conservados = signal<ReadonlySet<string>>(new Set());
  protected readonly hasta = signal('');
  protected readonly intento = signal(false);
  /**
   * La API pidió comentario aunque la pantalla no lo exigía (`REVIEW_COMMENT_REQUIRED`): también lo pide si el permiso no se usó
   * según su propio registro de uso, y eso la evidencia que recibe la pantalla no siempre lo dice. Desde entonces se exige acá.
   */
  private readonly lApiExigeComentario = signal(false);
  private readonly exige = (i: ReviewItem, d: ReviewDecisionKind): boolean =>
    commentRequired(i, d) || this.lApiExigeComentario();
  protected readonly enviando = signal(false);
  protected readonly errorDeDecision = signal<string | null>(null);
  protected readonly resultado = signal<Aviso | null>(null);
  private detalleCargadoEn = new Date();

  protected readonly items = computed<readonly ReviewItem[]>(() => {
    const s = this.state();
    return hasData(s) ? s.data : [];
  });
  protected readonly hayDatos = computed(() => hasData(this.state()));
  protected readonly item = computed<ReviewItem | null>(() => {
    const s = this.detalle();
    return hasData(s) ? s.data : null;
  });
  protected readonly hayDetalle = computed(() => hasData(this.detalle()));

  protected readonly bajoRiesgo = computed(() =>
    this.items().filter((i) => this.esDeBajoRiesgo(i)),
  );
  protected readonly elegidos = computed(() =>
    this.items().filter((i) => this.seleccion().has(i.id)),
  );
  protected readonly impiden = computed(() => {
    const ids = this.errorDeLote()?.ids ?? [];
    return new Set(ids);
  });
  protected readonly impidenFilas = computed(() =>
    (this.errorDeLote()?.ids ?? []).map((id) => ({
      id,
      item: this.items().find((i) => i.id === id) ?? null,
    })),
  );

  /* ---- lo que se calcula del ítem abierto ---------------------------------------------------------------------------- */
  protected readonly sinUso = computed(() => {
    const i = this.item();
    return i === null ? new Set<string>() : new Set(unusedAtoms(i));
  });
  protected readonly pendiente = computed(() => this.item()?.state === 'PENDING');
  protected readonly requerido = computed(() => {
    const i = this.item();
    const d = this.decision();
    return i !== null && d !== null && this.exige(i, d);
  });
  /** El aviso sobre el comentario: antes de elegir dice qué pasa al mantener; al elegir, lo que corresponde a esa decisión. */
  protected readonly avisoDeComentario = computed<string | null>(() => {
    const i = this.item();
    if (i === null) return null;
    const d = this.decision() ?? 'CERTIFY';
    if (!this.exige(i, d)) return null;
    if (d === 'REVOKE')
      return 'El comentario es obligatorio al quitar un acceso: queda registrado.';
    if (d === 'ADJUST')
      return 'El comentario es obligatorio al ajustar un acceso: diga qué reduce y por qué.';
    const motivos = [
      i.maxSensitivity === 'HIGH' || i.maxSensitivity === 'CRITICAL' ? 'es de riesgo alto' : null,
      this.sinUso().size > 0 ? 'hay permisos que no se usaron en 90 días' : null,
    ].filter((m): m is string => m !== null);
    return `Para mantener este acceso el comentario es obligatorio: ${motivos.join(' y ')}.`;
  });
  protected readonly problemaDeComentario = computed(() => {
    const i = this.item();
    const d = this.decision();
    return this.intento() && i !== null && d !== null
      ? commentProblem(this.comentario(), this.exige(i, d))
      : null;
  });
  protected readonly problemasDeAjuste = computed<readonly string[]>(() => {
    const i = this.item();
    if (!this.intento() || i === null || this.decision() !== 'ADJUST') return [];
    return adjustProblems(i, {
      atoms: [...this.conservados()],
      validTo: this.hasta() === '' ? null : this.hasta(),
    });
  });
  protected readonly textoDelBoton = computed(() =>
    this.decision() === 'REVOKE'
      ? 'Quitar este acceso'
      : this.decision() === 'ADJUST'
        ? 'Aplicar el ajuste'
        : 'Mantener este acceso',
  );

  /* ---- palabras ------------------------------------------------------------------------------------------------------- */
  protected readonly riesgo = (i: ReviewItem): string => sensitivityRisk(i.maxSensitivity);
  protected readonly riesgoTono = (i: ReviewItem) => sensitivityTone(i.maxSensitivity);
  protected readonly estado = (i: ReviewItem): string => itemStateText(i.state);
  protected readonly estadoTono = (i: ReviewItem) => itemStateTone(i.state);
  protected readonly revisor = (i: ReviewItem): string => reviewerKindText(i.reviewerKind);
  protected readonly vence = (i: ReviewItem) => dueCounter(i.dueAt);
  protected readonly dia = formatDay;
  protected readonly lastUsed = lastUsedText;
  protected readonly nombreDe = (i: ReviewItem): string => i.subjectName ?? 'Persona sin nombre';
  protected readonly riesgoDeAtomo = (sensitivity: string): string => sensitivityRisk(sensitivity);
  protected readonly riesgoTonoDeAtomo = (sensitivity: string) => sensitivityTone(sensitivity);
  protected readonly accionDeSod = (accion: string): string =>
    ACCION_DE_SOD[accion] ?? accion.toLowerCase();
  protected readonly usoDe = (
    code: string,
  ): { readonly permit: number; readonly deny: number; readonly lastUsedAt: string | null } =>
    this.item()?.evidence?.usage90d?.find((u) => u.atom === code) ?? {
      permit: 0,
      deny: 0,
      lastUsedAt: null,
    };
  protected readonly atomos = computed(() => this.item()?.evidence?.atoms ?? []);

  ngOnInit(): void {
    if (this.itemId !== null) {
      this.cargarDetalle();
      return;
    }
    // La próxima acción de «sin accesos» cambia `?estado=` en la misma ruta: se lee cada vez que cambia.
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((q) => {
      const pedido = q.get('estado');
      this.filtro.set(pedido === 'DECIDED' || pedido === 'ALL' ? pedido : 'PENDING');
      this.cargar();
    });
  }

  /* ---- la lista ------------------------------------------------------------------------------------------------------- */

  protected esDeBajoRiesgo(i: ReviewItem): boolean {
    return (
      i.state === 'PENDING' &&
      i.grantId !== undefined &&
      i.maxSensitivity !== undefined &&
      BAJO_RIESGO.has(i.maxSensitivity)
    );
  }

  protected cargar(): void {
    const previos = hasData(this.state()) ? this.items() : null;
    if (previos === null) this.state.set(loading());
    this.client.listMyItems(this.filtro()).subscribe({
      next: ({ items }) => {
        this.cargadoEn = new Date();
        this.seleccion.update(
          (s) =>
            new Set([...s].filter((id) => items.some((i) => i.id === id && i.state === 'PENDING'))),
        );
        this.state.set(items.length === 0 ? this.vacio() : ready(items));
      },
      error: (failure: unknown) =>
        this.state.set(
          previos === null
            ? errorToViewState<readonly ReviewItem[]>(failure)
            : stale(previos, this.cargadoEn),
        ),
    });
  }

  private vacio(): ViewState<readonly ReviewItem[]> {
    return this.filtro() === 'PENDING'
      ? empty(
          { label: 'Ver las ya revisadas', route: this.base, queryParams: { estado: 'DECIDED' } },
          'No tiene accesos por revisar. Cuando una campaña le asigne alguno, aparecerá aquí.',
        )
      : empty(
          { label: 'Ver las pendientes', route: this.base, queryParams: { estado: 'PENDING' } },
          'No hay revisiones en esta lista.',
        );
  }

  protected cambiarFiltro(valor: MyReviewsStatus): void {
    this.filtro.set(valor);
    this.errorDeLote.set(null);
    this.cargar();
  }

  protected marcado(id: string): boolean {
    return this.seleccion().has(id);
  }

  protected alternar(id: string, marcar: boolean): void {
    this.seleccion.update((s) => {
      const nuevo = new Set(s);
      if (marcar) nuevo.add(id);
      else nuevo.delete(id);
      return nuevo;
    });
  }

  protected elegirBajoRiesgo(): void {
    this.seleccion.set(new Set(this.bajoRiesgo().map((i) => i.id)));
    this.errorDeLote.set(null);
  }

  protected limpiarSeleccion(): void {
    this.seleccion.set(new Set());
    this.errorDeLote.set(null);
  }

  /** Mantener en bloque: todo o nada. Un rechazo de la API (`REVIEW_BULK_NOT_ALLOWED`) dice cuáles lo impiden y no cambia nada. */
  protected async mantenerLote(): Promise<void> {
    const filas = this.elegidos();
    if (filas.length === 0 || this.trabajandoEnLote()) return;
    const ok = await this.dialogs.confirm({
      title: 'Mantener los accesos elegidos',
      message: `Se mantienen ${accesos(filas.length)} de bajo riesgo con uso reciente. Si alguno no cumple, no se mantiene ninguno.`,
      details: filas.map((i) => ({ label: this.nombreDe(i), value: this.riesgo(i) })),
      confirmLabel: 'Mantener',
    });
    if (!ok) return;
    this.trabajandoEnLote.set(true);
    this.errorDeLote.set(null);
    this.resultadoDeLote.set(null);
    this.client.bulkDecide({ itemIds: filas.map((i) => i.id), decision: 'CERTIFY' }).subscribe({
      next: (r) => {
        this.trabajandoEnLote.set(false);
        this.seleccion.set(new Set());
        this.resultadoDeLote.set({
          tone: 'success',
          text: r.decided === 1 ? 'Se mantuvo 1 acceso.' : `Se mantuvieron ${r.decided} accesos.`,
        });
        this.cargar();
      },
      error: (failure: unknown) => {
        this.trabajandoEnLote.set(false);
        const f = accessFailureOf(failure);
        const ids =
          f?.reason === 'REVIEW_BULK_NOT_ALLOWED' && Array.isArray(f.details?.['itemIds'])
            ? (f.details['itemIds'] as unknown[]).filter((x): x is string => typeof x === 'string')
            : [];
        this.errorDeLote.set({
          text:
            f === null
              ? 'No pudimos completar la operación. Intente de nuevo.'
              : `${f.message}${ids.length > 0 ? ' No se mantuvo ninguno.' : ''}${f.requestId === undefined ? '' : ` Código de soporte: ${f.requestId}.`}`,
          ids,
        });
      },
    });
  }

  /* ---- el detalle ----------------------------------------------------------------------------------------------------- */

  protected cargarDetalle(): void {
    const previo = this.item();
    if (previo === null || previo.id !== this.itemId) this.lApiExigeComentario.set(false);
    if (previo === null) this.detalle.set(loading());
    this.client.getMyItem(this.itemId ?? '').subscribe({
      next: (item) => {
        this.detalleCargadoEn = new Date();
        this.conservados.set(new Set(item.evidence?.atoms?.map((a) => a.code) ?? []));
        this.detalle.set(ready(item));
      },
      error: (failure: unknown) => {
        if (previo !== null) {
          this.detalle.set(stale(previo, this.detalleCargadoEn));
          return;
        }
        const s = errorToViewState<ReviewItem>(failure);
        this.detalle.set(
          s.status === 'not-found'
            ? notFound({ label: 'Volver a mis revisiones', route: this.base })
            : s,
        );
      },
    });
  }

  protected elegir(d: ReviewDecisionKind): void {
    this.decision.set(d);
    this.intento.set(false);
    this.errorDeDecision.set(null);
    this.enfocar(d === 'ADJUST' ? '.ajuste input' : '[data-testid="decision-comentario"]');
  }

  protected cancelarDecision(): void {
    this.decision.set(null);
    this.intento.set(false);
    this.errorDeDecision.set(null);
  }

  protected conserva(code: string): boolean {
    return this.conservados().has(code);
  }

  protected conservar(code: string, marcar: boolean): void {
    this.conservados.update((s) => {
      const nuevo = new Set(s);
      if (marcar) nuevo.add(code);
      else nuevo.delete(code);
      return nuevo;
    });
  }

  protected enviar(): void {
    const item = this.item();
    const d = this.decision();
    if (item === null || d === null || this.enviando()) return;
    this.intento.set(true);
    const comentario = this.comentario().trim();
    if (commentProblem(comentario, this.exige(item, d)) !== null) {
      this.enfocar('[data-testid="decision-comentario"]');
      return;
    }
    const atomosOfrecidos = item.evidence?.atoms?.map((a) => a.code) ?? [];
    const quita = this.conservados().size < atomosOfrecidos.length;
    if (
      d === 'ADJUST' &&
      adjustProblems(item, {
        atoms: [...this.conservados()],
        validTo: this.hasta() === '' ? null : this.hasta(),
      }).length > 0
    )
      return;

    const pedido: ReviewDecision = {
      decision: d,
      ...(comentario === '' ? {} : { comment: comentario }),
      ...(d === 'ADJUST'
        ? {
            adjustment: {
              ...(quita ? { atoms: atomosOfrecidos.filter((c) => this.conservados().has(c)) } : {}),
              ...(this.hasta() === ''
                ? {}
                : { validTo: new Date(`${this.hasta()}T23:59:00`).toISOString() }),
            },
          }
        : {}),
    };
    this.enviando.set(true);
    this.errorDeDecision.set(null);
    this.client.decideItem(item.id, pedido).subscribe({
      next: () => {
        this.enviando.set(false);
        this.resultado.set({
          tone: 'success',
          text:
            d === 'CERTIFY'
              ? 'Mantuvo este acceso. Quedó registrado con su comentario.'
              : d === 'REVOKE'
                ? 'Quitó este acceso. Quedó registrado con su comentario.'
                : 'Aplicó el ajuste: la persona conserva solo lo que usted dejó.',
        });
        this.decision.set(null);
        this.comentario.set('');
        this.intento.set(false);
        this.cargarDetalle();
      },
      error: (failure: unknown) => {
        this.enviando.set(false);
        const f = accessFailureOf(failure);
        if (f?.reason === 'REVIEW_COMMENT_REQUIRED') {
          this.lApiExigeComentario.set(true);
          this.intento.set(true);
          this.enfocar('[data-testid="decision-comentario"]');
        }
        this.errorDeDecision.set(
          f === null
            ? 'No pudimos completar la operación. Intente de nuevo.'
            : `${f.message}${f.requestId === undefined ? '' : ` Código de soporte: ${f.requestId}.`}`,
        );
        // Si ya lo decidió otra persona, lo que queda en pantalla debe ser lo que guardó la API.
        if (f?.status === 409) this.cargarDetalle();
      },
    });
  }

  /** Lleva el foco al control que la persona necesita: el comentario al elegir, o lo que falta al enviar. */
  private enfocar(selector: string): void {
    afterNextRender(
      () => {
        const el = this.host.nativeElement.querySelector<HTMLElement>(selector);
        const control = el?.matches('input,textarea,button')
          ? el
          : el?.querySelector<HTMLElement>('textarea,input,button');
        control?.focus();
      },
      { injector: this.injector },
    );
  }
}
