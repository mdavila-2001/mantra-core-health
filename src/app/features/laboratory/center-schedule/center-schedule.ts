import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal, type OnInit } from '@angular/core';

import { CenterScheduleClient } from '../../../core/data-access/diagnostic-units/center-schedule.client';
import {
  capacidadDeModalidad,
  describirHorario,
  equiposDeModalidad,
  nombreDelHorarioGeneral,
  resolverHorario,
  validarHorario,
} from '../../../core/data-access/diagnostic-units/center-schedule.rules';
import type {
  CenterEquipment,
  CenterSchedule,
  CenterScheduleView,
  CenterStudy,
  EquipmentStatus,
  ScheduleBlock,
} from '../../../core/data-access/diagnostic-units/center-schedule.types';
import { MODALIDADES, modalidad, type ModalityCode } from '../../../core/data-access/diagnostic-units/modalidades';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { SegmentedControl } from '../../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../../shared/components/molecules/segmented-control/segmented-control.types';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { GlossaryDataFlow } from '../../glossary/glossary-data-flow';
import { ScheduleBlockEditor } from './schedule-block-editor';

/* ============================================================================
    Horarios y equipos de un centro de diagnóstico.

    El centro arma su agenda de lo general a lo particular:

      1. un horario general, que vale para todos sus servicios;
      2. si una modalidad (Ecografía, Resonancia…) atiende en otro horario, le
         pone horario propio — y el general pasa a ser el «Resto de
         servicios»;
      3. si un estudio puntual de esa modalidad necesita algo distinto (la
         ecografía obstétrica sólo los sábados), le pone una excepción.

    El cupo de cada turno no se escribe: son los equipos operativos de la
    modalidad. Por eso la pestaña «Equipos» está acá mismo: marcar un ecógrafo
    fuera de servicio baja el cupo de todas las ecografías sin tocar el
    horario. El resumen de abajo muestra, con las mismas reglas que usan los
    turnos (`center-schedule.rules.ts`), cómo queda cada cosa.
    ========================================================================== */

interface ModalidadDelCentro {
  readonly code: ModalityCode;
  readonly label: string;
  readonly equipoSingular: string;
  readonly equipoPlural: string;
  readonly operativos: number;
  readonly total: number;
  readonly estudios: readonly CenterStudy[];
  readonly propio: ScheduleBlock | null;
  /** Algún estudio de la modalidad tiene horario aparte. */
  readonly conExcepcion: boolean;
}

interface FilaDelResumen {
  readonly code: ModalityCode;
  readonly label: string;
  readonly origen: string;
  readonly horario: string;
  readonly cupo: string;
  readonly excepciones: readonly { readonly nombre: string; readonly horario: string }[];
}

const ETIQUETA_DE_ESTADO: Readonly<Record<EquipmentStatus, string>> = {
  OPERATIONAL: 'Operativo',
  MAINTENANCE: 'En mantenimiento',
  OUT_OF_SERVICE: 'Fuera de servicio',
};

@Component({
  selector: 'app-center-schedule',
  imports: [PageHeader, ViewStateHost, Card, Tabs, Tab, SegmentedControl, Select, AppButton, Alert, ScheduleBlockEditor, GlossaryDataFlow],
  templateUrl: './center-schedule.html',
  styleUrl: './center-schedule.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CenterSchedulePage implements OnInit {
  private readonly cliente = inject(CenterScheduleClient);
  private readonly navegacion = inject(NavigationService);

  protected readonly estado = signal<ViewState<CenterScheduleView>>(loading());
  protected readonly borrador = signal<CenterSchedule | null>(null);
  protected readonly pestana = signal(0);
  protected readonly guardando = signal(false);
  protected readonly publicado = signal(false);

  /** Los equipos con su mapa de datos desplegado: se lee al abrirlo, no antes. */
  protected readonly mapasAbiertos = signal<ReadonlySet<string>>(new Set());
  /** El Glosario es de quien atiende; sin él, el mapa se lee sin enlaces. */
  protected readonly veGlosario = computed(() => this.navegacion.visibleSections().some((s) => s.path === 'glossary'));
  protected readonly problemas = signal<readonly string[]>([]);
  protected readonly cambiandoEquipo = signal<string | null>(null);
  /** El error del último cambio de estado de un equipo: se muestra en «Equipos», no en «Horarios». */
  protected readonly errorDeEquipo = signal<string | null>(null);

  protected readonly centro = computed<CenterScheduleView | null>(() => {
    const e = this.estado();
    return e.status === 'ready' ? e.data : null;
  });

  protected readonly siNo: readonly SegmentedOption<'si' | 'no'>[] = [
    { value: 'si', label: 'Sí' },
    { value: 'no', label: 'No' },
  ];

  /**
   * Un desplegable y no un segmentado: «Fuera de servicio» y «Mantenimiento»
   * no entran en tres pastillas a 390 px. Mientras un cambio viaja, los
   * desplegables quedan deshabilitados en vez de ignorar la elección.
   */
  protected readonly estados: readonly SelectOption<EquipmentStatus>[] = [
    { value: 'OPERATIONAL', label: 'Operativo' },
    { value: 'MAINTENANCE', label: 'Mantenimiento' },
    { value: 'OUT_OF_SERVICE', label: 'Fuera de servicio' },
  ];

  protected readonly nombreGeneral = computed(() => {
    const b = this.borrador();
    return b === null ? 'Horario general' : nombreDelHorarioGeneral(b);
  });

  /** Las modalidades que el centro atiende (las de sus estudios), en el orden del catálogo. */
  protected readonly modalidades = computed<readonly ModalidadDelCentro[]>(() => {
    const centro = this.centro();
    const borrador = this.borrador();
    if (centro === null || borrador === null) return [];
    return MODALIDADES.filter((m) => centro.studies.some((s) => s.modalityCode === m.code)).map((m) => ({
      code: m.code,
      label: m.label,
      equipoSingular: m.equipmentLabel[0],
      equipoPlural: m.equipmentLabel[1],
      operativos: capacidadDeModalidad(centro.equipment, m.code),
      total: equiposDeModalidad(centro.equipment, m.code),
      estudios: centro.studies.filter((s) => s.modalityCode === m.code),
      propio: borrador.modalities.find((x) => x.modalityCode === m.code)?.schedule ?? null,
      conExcepcion: borrador.studies.some((x) => centro.studies.some((s) => s.code === x.studyCode && s.modalityCode === m.code)),
    }));
  });

  /** Las modalidades que siguen en el horario general: las que no tienen horario propio. */
  protected readonly enElGeneral = computed(() => this.modalidades().filter((m) => m.propio === null));

  protected readonly resumen = computed<readonly FilaDelResumen[]>(() => {
    const centro = this.centro();
    const borrador = this.borrador();
    if (centro === null || borrador === null) return [];
    return this.modalidades().map((m) => {
      // Cualquier estudio de la modalidad que no tenga excepción resuelve igual.
      const comun = m.estudios.find((s) => !borrador.studies.some((x) => x.studyCode === s.code)) ?? m.estudios[0]!;
      const { block, origin } = resolverHorario(borrador, comun.code, m.code);
      return {
        code: m.code,
        label: m.label,
        origen: origin === 'MODALITY' ? 'Horario propio' : this.nombreGeneral(),
        horario: describirHorario(block),
        cupo:
          m.operativos === 0
            ? `Sin ${m.equipoPlural} operativos: no se dan turnos`
            : `${m.operativos} ${m.operativos === 1 ? 'paciente' : 'pacientes'} por turno (${m.operativos} ${m.operativos === 1 ? m.equipoSingular : m.equipoPlural})`,
        excepciones: m.estudios
          .filter((s) => borrador.studies.some((x) => x.studyCode === s.code))
          .map((s) => ({ nombre: s.name, horario: describirHorario(resolverHorario(borrador, s.code, m.code).block) })),
      };
    });
  });

  protected readonly hayCambios = computed(() => {
    const centro = this.centro();
    const borrador = this.borrador();
    return centro !== null && borrador !== null && JSON.stringify(centro.schedule) !== JSON.stringify(borrador);
  });

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    this.estado.set(loading());
    this.cliente.getMySchedule().subscribe({
      next: (vista) => this.aplicar(vista),
      error: (error: unknown) => this.estado.set(errorToViewState(error)),
    });
  }

  private aplicar(vista: CenterScheduleView): void {
    this.estado.set(ready(vista));
    this.borrador.set(vista.schedule);
  }

  /* ---- edición ---------------------------------------------------------- */

  protected fijarGeneral(block: ScheduleBlock): void {
    this.editar((b) => ({ ...b, general: block }));
  }

  protected alternarPropio(code: ModalityCode, valor: 'si' | 'no'): void {
    this.editar((b) => {
      const sin = b.modalities.filter((m) => m.modalityCode !== code);
      return valor === 'si' ? { ...b, modalities: [...sin, { modalityCode: code, schedule: b.general }] } : { ...b, modalities: sin };
    });
  }

  protected fijarModalidad(code: ModalityCode, block: ScheduleBlock): void {
    this.editar((b) => ({
      ...b,
      modalities: b.modalities.map((m) => (m.modalityCode === code ? { ...m, schedule: block } : m)),
    }));
  }

  protected tieneExcepcion(studyCode: string): boolean {
    return this.borrador()?.studies.some((s) => s.studyCode === studyCode) ?? false;
  }

  protected excepcionDe(studyCode: string): ScheduleBlock | null {
    return this.borrador()?.studies.find((s) => s.studyCode === studyCode)?.schedule ?? null;
  }

  protected agregarExcepcion(modalidadDelCentro: ModalidadDelCentro, studyCode: string): void {
    this.editar((b) => ({
      ...b,
      studies: [...b.studies, { studyCode, schedule: modalidadDelCentro.propio ?? b.general }],
    }));
  }

  protected fijarExcepcion(studyCode: string, block: ScheduleBlock): void {
    this.editar((b) => ({
      ...b,
      studies: b.studies.map((s) => (s.studyCode === studyCode ? { ...s, schedule: block } : s)),
    }));
  }

  protected quitarExcepcion(studyCode: string): void {
    this.editar((b) => ({ ...b, studies: b.studies.filter((s) => s.studyCode !== studyCode) }));
  }

  protected descartar(): void {
    const centro = this.centro();
    if (centro === null) return;
    this.borrador.set(centro.schedule);
    this.problemas.set([]);
  }

  private editar(cambio: (b: CenterSchedule) => CenterSchedule): void {
    const actual = this.borrador();
    if (actual === null) return;
    this.borrador.set(cambio(actual));
    this.publicado.set(false);
    this.problemas.set([]);
  }

  /* ---- guardar ---------------------------------------------------------- */

  protected publicar(): void {
    const centro = this.centro();
    const borrador = this.borrador();
    if (centro === null || borrador === null || this.guardando()) return;
    const locales = validarHorario(borrador, (donde) => this.nombreDe(donde, centro)).map((p) => p.mensaje);
    if (locales.length > 0) {
      this.problemas.set(locales);
      return;
    }
    this.guardando.set(true);
    this.cliente.saveSchedule(centro.unitId, borrador).subscribe({
      next: (vista) => {
        this.guardando.set(false);
        this.aplicar(vista);
        this.publicado.set(true);
      },
      error: (error: unknown) => {
        this.guardando.set(false);
        this.problemas.set([mensajeDeError(error)]);
      },
    });
  }

  private nombreDe(donde: string, centro: CenterScheduleView): string {
    if (donde === 'general') return this.nombreGeneral();
    const m = MODALIDADES.find((x) => x.code === donde);
    if (m !== undefined) return m.label;
    return centro.studies.find((s) => s.code === donde)?.name ?? donde;
  }

  /* ---- equipos ---------------------------------------------------------- */

  protected equiposDe(code: ModalityCode): readonly CenterEquipment[] {
    return this.centro()?.equipment.filter((e) => e.modalityCode === code) ?? [];
  }

  /** Los equipos que no limitan turnos (analizadores, centrífugas…). */
  protected readonly otrosEquipos = computed(() => this.centro()?.equipment.filter((e) => e.modalityCode === null) ?? []);

  protected etiquetaDeEstado(status: EquipmentStatus): string {
    return ETIQUETA_DE_ESTADO[status];
  }

  protected cambiarEstado(equipo: CenterEquipment, status: EquipmentStatus): void {
    const centro = this.centro();
    if (centro === null || status === equipo.status || this.cambiandoEquipo() !== null) return;
    this.cambiandoEquipo.set(equipo.id);
    this.errorDeEquipo.set(null);
    const borrador = this.borrador();
    this.cliente.setEquipmentStatus(centro.unitId, equipo.id, status).subscribe({
      next: (vista) => {
        this.cambiandoEquipo.set(null);
        this.estado.set(ready(vista));
        // El horario a medio editar no se pierde por cambiar un equipo.
        this.borrador.set(borrador ?? vista.schedule);
      },
      error: (error: unknown) => {
        this.cambiandoEquipo.set(null);
        this.errorDeEquipo.set(mensajeDeErrorDeEquipo(error));
      },
    });
  }

  protected nombreDeModalidad(code: ModalityCode): string {
    return modalidad(code).label;
  }

  protected alternarMapa(equipoId: string, evento: Event): void {
    const abierto = (evento.target as HTMLDetailsElement).open;
    this.mapasAbiertos.update((actual) => {
      const nuevo = new Set(actual);
      if (abierto) nuevo.add(equipoId);
      else nuevo.delete(equipoId);
      return nuevo;
    });
  }
}

function mensajeDeError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    const cuerpo = error.error as { message?: string } | null;
    if (typeof cuerpo?.message === 'string' && cuerpo.message !== '') return cuerpo.message;
  }
  return 'No pudimos guardar los cambios. Probá de nuevo en un momento.';
}

function mensajeDeErrorDeEquipo(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    const cuerpo = error.error as { message?: string } | null;
    if (typeof cuerpo?.message === 'string' && cuerpo.message !== '') return cuerpo.message;
  }
  return 'No pudimos cambiar el estado del equipo. Probá de nuevo en un momento.';
}
