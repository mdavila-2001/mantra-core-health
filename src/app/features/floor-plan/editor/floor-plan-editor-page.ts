import { DatePipe, isPlatformBrowser } from '@angular/common';
import { afterNextRender, ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, PLATFORM_ID, signal, untracked, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

import type { PlacementGeometry } from '../../../core/data-access/floor-plan/floor-plan.types';
import type { PlanLayerId, RevealRequest, ViewInfo } from '../../../core/floor-plan/canvas.types';
import { elementLabel, wallLength } from '../../../core/floor-plan/editor-elements';
import { bboxCenter, type Point } from '../../../core/floor-plan/geometry';
import { forbidden } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Switch } from '../../../shared/components/atoms/switch/switch';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { FloorPlanCanvas } from '../../../shared/components/organisms/floor-plan-canvas/floor-plan-canvas';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { FloorPlanStore } from '../viewer/floor-plan.store';
import { editorKeyCommand } from './editor-keys';
import { FloorPlanEditorStore, type EditTool } from './floor-plan-editor.store';
import { PlanEditorInspector, type ElementFields } from './plan-editor-inspector';
import { PlanEditorIssues } from './plan-editor-issues';
import { PlanEditorPalette } from './plan-editor-palette';

/** El editor dibuja con grilla y sin color de estado: lo que importa es la forma. */
const EDITOR_LAYERS: ReadonlySet<PlanLayerId> = new Set<PlanLayerId>(['grid', 'zones', 'rooms', 'beds', 'walls', 'openings', 'circulation', 'labels']);

const TOOLS: readonly { id: EditTool; label: string; key: string; hint: string }[] = [
  { id: 'select', label: 'Seleccionar', key: 'V', hint: 'Elegir, mover y ajustar una figura' },
  { id: 'hand', label: 'Mano', key: 'H', hint: 'Desplazar el plano sin tocar las figuras' },
  { id: 'rect', label: 'Local rectangular', key: 'R', hint: 'Dibujar un rectángulo' },
  { id: 'polygon', label: 'Local poligonal', key: 'P', hint: 'Dibujar un polígono; doble toque o Entrar para cerrarlo' },
  { id: 'wall', label: 'Muro', key: 'W', hint: 'Dibujar un muro punto a punto; doble toque o Entrar para terminarlo' },
  { id: 'door', label: 'Puerta', key: 'D', hint: 'Ubicar una puerta sobre un muro' },
  { id: 'window', label: 'Ventana', key: 'N', hint: 'Ubicar una ventana sobre un muro' },
];

/**
 * Editor del plano de planta (CONTRATO-PLANO §5.3). Se edita en pantallas de
 * 768 px o más; en una pantalla chica el plano queda en solo lectura.
 */
@Component({
  selector: 'app-floor-plan-editor-page',
  imports: [AppButton, Alert, DatePipe, FloorPlanCanvas, PageHeader, PlanEditorInspector, PlanEditorIssues, PlanEditorPalette, Select, Switch, ViewStateHost],
  providers: [FloorPlanStore, FloorPlanEditorStore],
  templateUrl: './floor-plan-editor-page.html',
  styleUrl: './floor-plan-editor-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'floor-plan-editor', '(document:keydown)': 'onKey($event)' },
})
export class FloorPlanEditorPage {
  protected readonly plan = inject(FloorPlanStore);
  protected readonly ed = inject(FloorPlanEditorStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly dialogs = inject(DialogService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  protected readonly canvas = viewChild(FloorPlanCanvas);

  private readonly query = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  protected readonly narrow = signal(false);
  protected readonly view = signal<ViewInfo | null>(null);
  /** La figura con el foco del teclado en el lienzo (Entrar la elige). */
  protected readonly activeId = signal<string | null>(null);
  protected readonly reveal = signal<RevealRequest | null>(null);
  protected readonly layers = EDITOR_LAYERS;
  protected readonly tools = TOOLS;
  private nonce = 0;
  private lastLoadKey = '';

  protected readonly screenState = computed<ViewState<unknown>>(() => {
    const base = this.plan.viewState();
    const viewer = this.plan.viewer();
    if (base.status === 'ready' && viewer && !viewer.canEditPlan) {
      return forbidden({ message: 'Su rol puede ver este plano pero no modificarlo.', nextAction: { label: 'Volver al plano', route: '/administration/medical-organization/plan' } });
    }
    return base;
  });

  protected readonly figureOptions = computed<SelectOption<string>[]>(() =>
    this.ed.views().filter((v) => v.inScope).map((v) => ({ value: v.id, label: `${v.code} · ${v.name}` })),
  );
  protected readonly changedText = computed(() => {
    const n = this.ed.changeCount();
    return n === 0 ? 'Todo guardado' : `Cambios sin guardar (${n})`;
  });
  protected readonly conflictIds = computed(() => this.ed.reapplied()?.conflicts ?? []);

  constructor() {
    this.plan.start();
    this.plan.colorBy.set('none');
    afterNextRender(() => {
      if (!this.isBrowser) return;
      const media = window.matchMedia('(max-width: 767.98px)');
      const update = (): void => this.narrow.set(media.matches);
      update();
      media.addEventListener('change', update);
      const beforeUnload = (event: BeforeUnloadEvent): void => {
        if (!this.ed.dirty()) return;
        event.preventDefault();
        event.returnValue = '';
      };
      window.addEventListener('beforeunload', beforeUnload);
      this.destroyRef.onDestroy(() => {
        media.removeEventListener('change', update);
        window.removeEventListener('beforeunload', beforeUnload);
        this.plan.stop();
      });
    });

    effect(() => {
      const q = this.query();
      untracked(() => {
        const store = this.plan;
        store.siteId.set(q.get('site') ?? store.siteId());
        store.planId.set(q.get('plan') || null);
        store.focusSpaceId.set(null);
        store.unitId.set(null);
        const key = [store.siteId(), store.planId()].join('|');
        if (key !== this.lastLoadKey) {
          this.lastLoadKey = key;
          void (store.planId() === null || store.plans().length === 0 ? store.bootstrap() : store.load());
        }
      });
    });
  }

  protected onKey(event: KeyboardEvent): void {
    if (this.narrow()) return;
    const target = event.target;
    if (target instanceof HTMLElement && (target.closest('input, select, textarea, [contenteditable="true"]') || target.closest('dialog'))) return;
    const command = editorKeyCommand(event, { pathDraft: this.ed.pathDraft(), canNudge: this.ed.canNudge() });
    if (!command) return;
    event.preventDefault();
    const ed = this.ed;
    switch (command.type) {
      case 'undo': ed.undo(); break;
      case 'redo': ed.redo(); break;
      case 'save': void ed.save(); break;
      case 'escape': ed.escape(); break;
      case 'finish-draft': ed.finishDraft(); break;
      case 'select-active': {
        const id = this.activeId();
        if (id) ed.select(id);
        break;
      }
      case 'back-draft': ed.backDraft(); break;
      case 'delete': void ed.removeSelected(); break;
      case 'tool': ed.setTool(command.tool); break;
      case 'nudge': {
        const step = ed.gridSizeM() * (command.big ? 5 : 1);
        ed.nudge(command.dx * step, command.dy * step);
        break;
      }
    }
  }

  protected onView(info: ViewInfo): void {
    this.view.set(info);
    this.ed.viewScale.set(info.viewport.scale);
  }

  protected setTool(tool: EditTool): void {
    this.ed.setTool(tool);
  }

  protected placeCenter(): void {
    const v = this.view();
    const center: Point = v ? bboxCenter(v.visible) : [0, 0];
    this.ed.placeAtCenter(center);
  }

  protected readonly selectedWallLength = computed(() => {
    const el = this.ed.selectedElement();
    const host = el?.hostElementId ? this.ed.current().elements.get(el.hostElementId) : undefined;
    return host ? wallLength(host) : null;
  });

  protected onElementFields(fields: ElementFields): void {
    const id = this.ed.selectedElementId();
    if (id) this.ed.setElementFields(id, fields);
  }

  protected onGeometry(geometry: PlacementGeometry): void {
    const id = this.ed.selectedId();
    if (id) this.ed.setGeometryOf(id, geometry);
  }

  protected focusIssue(id: string): void {
    this.ed.focusIssue(id);
    this.reveal.set({ spaceId: id, nonce: ++this.nonce });
  }

  protected readonly nameOf = (id: string): string => {
    const cur = this.ed.current();
    const s = cur.spaces.get(id);
    if (s) return `${s.code} · ${s.name}`;
    const el = cur.elements.get(id);
    return el ? elementLabel(el) : id;
  };

  protected nameOfConflicts(ids: readonly string[]): string {
    return ids.map((id) => this.nameOf(id)).join(', ');
  }

  protected setSnap(on: boolean): void {
    this.ed.snapOn.set(on);
  }

  protected async leave(): Promise<void> {
    if (this.ed.dirty() && !(await this.dialogs.confirmarDescarte({ message: 'Tiene cambios sin guardar en el plano. Si sale, quedan solo en el borrador de este navegador.' }))) return;
    void this.router.navigate(['/administration/medical-organization/plan'], { queryParams: { site: this.plan.siteId(), plan: this.plan.planId() } });
  }

  protected async discard(): Promise<void> {
    if (await this.dialogs.confirmarDescarte({ message: 'Se descartan todos los cambios hechos desde la última vez que se guardó.' })) this.ed.discardAll();
  }

  protected retry(): void {
    void this.plan.bootstrap();
  }
}
