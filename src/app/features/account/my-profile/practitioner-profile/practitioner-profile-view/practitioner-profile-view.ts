import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { WorkHistory } from '../../work-history/work-history';
import { Avatar } from '../../../../../shared/components/atoms/avatar/avatar';
import { Badge } from '../../../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../../../shared/components/atoms/button/button-link';
import { Chip } from '../../../../../shared/components/atoms/chip/chip';
import { Card } from '../../../../../shared/components/molecules/card/card';
import { TabHelpBlock } from '../../../../../shared/components/molecules/tab-help-block/tab-help-block';
import { Tabs } from '../../../../../shared/components/molecules/tabs/tabs';
import { Tab } from '../../../../../shared/components/molecules/tabs/tab/tab';
import { StatusSeal } from '../../../../../shared/components/organisms/status-seal/status-seal';
import { TutorialTarget } from '../../../../../shared/components/organisms/tutorial-overlay/tutorial-target.directive';
import type { PerfilProfesionalVisible } from './practitioner-profile-view.types';

/** Índice de cada pestaña superior — nombrado para no repetir números mágicos. */
const TAB = { TRAYECTORIA: 0, CREDENCIALES: 1, PREVIEW: 2 } as const;

/** Una fila de la agrupación declarado/verificado de la pestaña Credenciales. */
interface FilaCredencial {
  readonly id: string;
  readonly categoria: string;
  readonly nombre: string;
  readonly detalle: string;
  readonly fuente?: string;
}

/**
 * **La vista del perfil profesional** — presentacional pura.
 *
 * ## Por qué existe (carriles R2-4 y 05)
 *
 * El perfil del doctor rebotó dos rondas seguidas («está pésimo»), y la guía de
 * profesionales (carril R2-1) necesita pintar el perfil de OTRO doctor. El dato
 * entra por `input()` ya resuelto (ver `practitioner-profile-view.types.ts`) y
 * esta vista no sabe de dónde salió: la usan el contenedor propio, el detalle
 * de la guía, y — carril 05 — ella misma en modo preview.
 *
 * ## La estructura de 3 pestañas superiores (carril 05)
 *
 * 1. **Trayectoria**: formación, experiencia histórica y actividad actual, en
 *    timeline vertical por fases.
 * 2. **Credenciales y verificaciones**: especialidades y matrículas, más una
 *    agrupación explícita declarado/verificado.
 * 3. **Vista previa del perfil público**: sólo cuando `esPropio()` — se
 *    reinstancia a **sí misma** con `esPropio=false`, alimentada por el mismo
 *    `perfil()` ya cargado. No es un mock aparte: es el mismo dibujo, en modo
 *    ajeno, que ve un paciente en `practitioner-detail.ts` — la única forma de
 *    que la vista previa no pueda divergir de lo que un paciente ve de verdad.
 *    `previewMode` corta la recursión: la instancia anidada no vuelve a ofrecer
 *    una pestaña Preview de sí misma.
 *
 * ## `esPropio`
 *
 * Con `true` (Mi perfil) aparecen las acciones de dueño y el formulario de
 * alta de trayectoria. Con `false` (la guía, o el propio Preview) no hay
 * botones ni tuteo: es la ficha de un colega.
 */
@Component({
  selector: 'app-practitioner-profile-view',
  imports: [
    Avatar,
    Badge,
    AppButton,
    AppButtonLink,
    Card,
    Chip,
    DatePipe,
    RouterLink,
    StatusSeal,
    Tabs,
    Tab,
    TabHelpBlock,
    TutorialTarget,
    WorkHistory,
    // Auto-referencia deliberada (carril 05): la pestaña Preview se pinta
    // reinstanciando este mismo componente en modo ajeno — ver `previewMode`.
    PractitionerProfileView,
  ],
  templateUrl: './practitioner-profile-view.html',
  styleUrl: './practitioner-profile-view.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PractitionerProfileView {
  /** El perfil, ya resuelto por el contenedor. */
  readonly perfil = input.required<PerfilProfesionalVisible>();

  /** Si es el perfil de quien mira: habilita las acciones de dueño. */
  readonly esPropio = input(false);

  /**
   * `true` cuando esta instancia ES la vista previa embebida de otra. Corta la
   * recursión: sin esto, la pestaña Preview de la pestaña Preview... — y
   * suprime cualquier acción de escritura, aunque `esPropio` llegara en `true`
   * por error del llamador.
   */
  readonly previewMode = input(false);

  /** Alguien agregó un vínculo laboral desde el formulario embebido: el contenedor debe releer el perfil. */
  readonly trayectoriaCambio = output<void>();

  protected readonly pestanaSeleccionada = signal<number>(TAB.TRAYECTORIA);
  protected readonly TAB = TAB;

  /** Especialidades, formación y matrículas agrupadas en declarado vs. verificado. */
  protected readonly credenciales = computed<{
    readonly declarados: readonly FilaCredencial[];
    readonly verificados: readonly FilaCredencial[];
  }>(() => {
    const perfil = this.perfil();
    const declarados: FilaCredencial[] = [];
    const verificados: FilaCredencial[] = [];

    for (const estudio of perfil.formacion) {
      const fila: FilaCredencial = {
        id: estudio.id,
        categoria: 'Formación',
        nombre: estudio.tipo,
        detalle: estudio.institucion || estudio.estado,
        fuente: estudio.fuenteVerificacion,
      };
      // La fuente de verificación es la señal más directa: el backend la exige
      // sólo al verificar, así que su presencia ES el hecho de haber pasado de
      // declarado a verificado — más confiable que inferirlo del sello, que
      // también puede decir «vencida» sin hablar de si se verificó.
      (estudio.fuenteVerificacion !== undefined ? verificados : declarados).push(fila);
    }
    for (const especialidad of perfil.especialidades) {
      const fila: FilaCredencial = {
        id: especialidad.id,
        categoria: 'Especialidad',
        nombre: especialidad.nombre,
        detalle: especialidad.estado,
      };
      (especialidad.sello === 'approved' ? verificados : declarados).push(fila);
    }
    for (const matricula of perfil.matriculas) {
      const fila: FilaCredencial = {
        id: matricula.id,
        categoria: 'Matrícula',
        nombre: matricula.jurisdiccion,
        detalle: matricula.estado,
      };
      (matricula.sello === 'approved' ? verificados : declarados).push(fila);
    }

    return { declarados, verificados };
  });

  protected verPreview(): void {
    this.pestanaSeleccionada.set(TAB.PREVIEW);
  }
}
