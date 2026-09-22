import { FileDropTarget } from '../../../../../shared/forms/file-drop-target';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { WorkHistory } from '../../work-history/work-history';
import { PractitionerActivity } from './practitioner-activity/practitioner-activity';
import { PracticeSitesMap } from './practice-sites-map/practice-sites-map';
import { CredentialsPanel } from './credentials-panel/credentials-panel';
import {
  PESTANAS_DEL_EDITOR_MEDICO,
  PESTANAS_DEL_PERFIL_MEDICO,
  PESTANA_EDITOR,
  PESTANA_MEDICO,
} from '../../pestanas-del-perfil-medico';
import { Avatar } from '../../../../../shared/components/atoms/avatar/avatar';
import { Badge } from '../../../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../../../shared/components/atoms/button/button-link';
import { Chip } from '../../../../../shared/components/atoms/chip/chip';
import { NavIcon } from '../../../../../shared/components/atoms/nav-icon/nav-icon';
import { Tooltip } from '../../../../../shared/components/atoms/tooltip/tooltip';
import { Card } from '../../../../../shared/components/molecules/card/card';
import { TabHelpBlock } from '../../../../../shared/components/molecules/tab-help-block/tab-help-block';
import { Tabs } from '../../../../../shared/components/molecules/tabs/tabs';
import { Tab } from '../../../../../shared/components/molecules/tabs/tab/tab';
import { SpecialtyBadge } from '../../../../../shared/components/organisms/specialty-badge/specialty-badge';
import { SpecialtyBadgeGrid } from '../../../../../shared/components/organisms/specialty-badge-grid/specialty-badge-grid';
import { StatusSeal } from '../../../../../shared/components/organisms/status-seal/status-seal';
import { TutorialTarget } from '../../../../../shared/components/organisms/tutorial-overlay/tutorial-target.directive';
import type {
  FormacionVisible,
  PerfilProfesionalVisible,
} from './practitioner-profile-view.types';

/** Índice de cada pestaña superior — nombrado para no repetir números mágicos. */
const TAB = { TRAYECTORIA: 0, CREDENCIALES: 1, PREVIEW: 2 } as const;

/* El hash que repartia un tono por especialidad se retiro con C-09. Dos
   motivos, y ninguno es estetico. Repartia `info` y `success`, que en este
   sistema significan un estado, asi que una especialidad podia leerse como el
   estado de un tramite. Y el color, aun estable, no identificaba nada que el
   nombre no dijera ya: lo que distingue una especialidad de otra ahora es el
   icono de `app-specialty-badge`, que es reconocimiento de verdad.

   La restriccion que este bloque protegia sigue viva, dentro de la insignia:
   ni ambar —el color de la accion unica— ni gris, que es el que el cliente
   pidio dejar de ver el 19/09/2026. */

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
    FileDropTarget,
    Avatar,
    Badge,
    AppButton,
    AppButtonLink,
    Card,
    Chip,
    DatePipe,
    NavIcon,
    Tooltip,
    RouterLink,
    SpecialtyBadge,
    SpecialtyBadgeGrid,
    StatusSeal,
    Tabs,
    Tab,
    TabHelpBlock,
    TutorialTarget,
    WorkHistory,
    PractitionerActivity,
    PracticeSitesMap,
    CredentialsPanel,
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

  /* --- La foto de perfil (P17) ------------------------------------------ */

  /**
   * Mientras la foto viaja. Bloquea el control para no subir dos veces.
   *
   * Lo declara quien ejecuta la subida: el estado de una operación pertenece a
   * quien la hace, y desde este carril la hace el contenedor.
   */
  readonly fotoSubiendo = input(false);

  /**
   * Qué salió mal del otro lado, si salió mal. Vacío es que no pasó nada.
   *
   * Es `string` y no `boolean` porque los dos fallos posibles se explican
   * distinto —una cuenta sin perfil profesional no es una subida fallida— y
   * cuál de los dos ocurrió lo sabe quien llamó al servidor.
   */
  readonly errorDeFoto = input('');

  /**
   * La foto recién subida, servida por la API.
   *
   * El perfil llega por `input()`, así que esta vista no puede refrescarlo por
   * su cuenta: necesita que le digan cuál es la foto nueva.
   *
   * **Tiene que ser una `data:` URL, no un `blob:` ni la firma del backend.**
   * Con `URL.createObjectURL(archivo)` la CSP la bloquea (`img-src` declara
   * `'self' data:`, y `blob:` no entra); con `downloadUrl()` es peor, porque
   * esa firma apunta a `file://local/<sha>` y tampoco carga — ése era el
   * defecto que hacía que la foto se subiera bien y no se viera nunca. El
   * detalle viaja con el contrato, porque ahora el valor lo produce quien llama.
   */
  readonly fotoRecien = input<string | null>(null);

  /** «Quiero esta foto». Subirla, fijarla y propagarla es de quien escucha. */
  readonly fotoElegida = output<File>();

  /**
   * El archivo que el propio control rechazó antes de salir de acá.
   *
   * Es la única clase de error que se queda en la vista: no es un resultado
   * remoto —todavía no se llamó a nadie—, es una entrada que no sirve, y el
   * texto lo escribe el control que la rechazó.
   */
  private readonly rechazoDeArchivo = signal('');

  /** Lo que se lee bajo el retrato: el rechazo local, o el fallo remoto. */
  protected readonly errorVisible = computed(() => this.rechazoDeArchivo() || this.errorDeFoto());

  protected readonly fotoVisible = computed(() => this.fotoRecien() ?? this.perfil().fotoUrl);

  /** El control de archivo rechazó lo que se le soltó encima. */
  protected alRechazarArchivo(motivo: string): void {
    this.rechazoDeArchivo.set(motivo);
  }

  /**
   * Avisa que la persona eligió una foto. **No la sube.**
   *
   * Las dos llamadas que hacen falta —subir los bytes y fijar el id en el
   * perfil— y la propagación a la vitrina pública viven en quien escucha este
   * evento: son escrituras, y esta vista no escribe.
   */
  protected alElegirFoto(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    // El input se limpia siempre: sin esto, elegir el mismo archivo dos veces
    // seguidas no dispara `change` y parece que el botón dejó de andar.
    entrada.value = '';
    if (!archivo || this.fotoSubiendo() || !this.esPropio() || this.previewMode()) {
      return;
    }
    // El rechazo anterior era de OTRO archivo: con uno nuevo en camino, dejar
    // el texto viejo diría que éste también se rechazó.
    this.rechazoDeArchivo.set('');
    this.fotoElegida.emit(archivo);
  }

  /** Alguien agregó un vínculo laboral desde el formulario embebido: el contenedor debe releer el perfil. */
  readonly trayectoriaCambio = output<void>();

  protected readonly pestanaSeleccionada = signal<number>(TAB.TRAYECTORIA);
  protected readonly TAB = TAB;

  /**
   * Las pestañas de la ficha PROPIA, las mismas seis del alta de médico.
   *
   * La ficha ajena —la Guía— conserva sus dos de siempre, declaradas en la
   * plantilla: son otra pregunta, la de quien mira a un colega.
   */
  protected readonly pestanas = PESTANAS_DEL_PERFIL_MEDICO;

  /**
   * Las pestañas que de verdad se dibujan, en el orden en que se dibujan.
   *
   * `pestanas` es la lista completa y sirve para rotular; ésta es la que
   * corresponde con el índice que informa `app-tabs`, porque «Facturación» se
   * suprime cuando el perfil no la tiene (ficha ajena). Sin esta distinción,
   * cualquier lógica que mire el índice seleccionado se corre en uno.
   */
  protected readonly pestanasVisibles = computed<readonly string[]>(() =>
    this.perfil().facturacion
      ? PESTANAS_DEL_PERFIL_MEDICO
      : PESTANAS_DEL_PERFIL_MEDICO.filter(
          (pestana) => pestana !== PESTANAS_DEL_PERFIL_MEDICO[PESTANA_MEDICO.facturacion],
        ),
  );

  /** La etiqueta de la pestaña abierta, o `undefined` si el índice no existe. */
  protected readonly pestanaVisibleSeleccionada = computed<string | undefined>(
    () => this.pestanasVisibles()[this.pestanaSeleccionada()],
  );

  /** «Ahora se mira esta pestaña». Qué hacer con eso es de quien escucha. */
  readonly pestanaVisible = output<string>();

  /**
   * Alguien cambió de pestaña.
   *
   * Se conecta a `(selectedIndexChange)` y no a `[(selectedIndex)]` a
   * propósito: `app-tabs` sólo escribe ese modelo dentro de su `select()`, que
   * es su manejador de clic (`tabs.ts:93`), así que este evento significa
   * exactamente «lo cambió una persona» y **no se dispara en el primer
   * dibujo**. Con un `effect` sobre la señal sí se dispararía, y avisar una
   * pestaña que nadie abrió es lo que el contrato prohíbe.
   *
   * La etiqueta sale de {@link pestanasVisibles}, que es la lista de la ficha
   * PROPIA. La ficha ajena tiene otras tres pestañas, rotuladas en la
   * plantilla; desde ahí no se avisa nada, porque se avisaría un nombre que no
   * está en pantalla. La condición es la misma que decide qué dibujo se pinta.
   */
  protected alCambiarPestana(indice: number): void {
    this.pestanaSeleccionada.set(indice);
    if (!this.esPropio() || this.previewMode()) {
      return;
    }
    const etiqueta = this.pestanasVisibles()[indice];
    if (etiqueta !== undefined) {
      this.pestanaVisible.emit(etiqueta);
    }
  }

  /**
   * La pestaña con la que el lápiz abre el editor.
   *
   * El editor decía en su propio comentario que «el lápiz abre el formulario en
   * la pestaña que se estaba mirando», y **no era cierto**: el enlace iba a
   * `/my-account/edit` a secas, así que desde «Credenciales» se entraba a
   * editar en «Datos personales». Se resuelve acá, que es donde se sabe qué
   * pestaña está abierta.
   *
   * Se traduce por ETIQUETA y no pasando el índice tal cual, por la misma razón
   * que existe {@link pestanasVisibles}: la ficha suprime «Facturación» cuando
   * no la tiene, así que a partir de ahí sus índices y los del editor no son
   * los mismos. Una etiqueta que el editor no tenga cae en la primera, que es
   * el comportamiento de siempre.
   */
  protected readonly pestanaDeEdicion = computed<number>(() => {
    const abierta = this.pestanaVisibleSeleccionada();
    const indice = abierta ? PESTANAS_DEL_EDITOR_MEDICO.findIndex((p) => p === abierta) : -1;
    return indice >= 0 ? indice : PESTANA_EDITOR.personales;
  });

  /**
   * Adónde va «Cambiar contraseña».
   *
   * Al flujo de recuperación por correo, igual que en la ficha del paciente: es
   * el único que puede verificar que quien cambia la clave es la persona.
   */
  protected readonly rutaDeCambioDeContrasena = '/auth/forgot-password';

  /* Las especialidades ya no se preparan aca: `app-specialty-badge-grid`
     recibe `perfil().especialidades` tal cual —`EspecialidadVisible` tiene los
     campos que la insignia pide—, ordena la principal primero y dice en
     palabras lo que antes iba en el `aria-label` del chip. Suben de
     «Credenciales» a la primera pestania por pedido del cliente (19/09/2026);
     en «Credenciales» siguen, con su vigencia y su sello, que es otra
     pregunta. */

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

  /** «Quiero retirar este título». Confirmarlo y retirarlo es de quien escucha. */
  readonly credencialARetirar = output<FormacionVisible>();

  /**
   * Pide retirar un título propio cargado por error (ALV-009/formación).
   *
   * **Emite la intención, no el resultado.** La confirmación sube con la
   * operación: un diálogo es una decisión del flujo, y repartirlo entre quien
   * pregunta y quien persiste dejaría la política de descarte en dos sitios.
   *
   * El botón sólo aparece mientras el título sigue PENDIENTE —`sello ===
   * 'in-review'`, en la plantilla—, así que lo único que puede fallar del otro
   * lado es un estado que cambió justo antes; eso lo avisa quien escucha.
   */
  protected alPedirRetiro(estudio: FormacionVisible): void {
    if (!this.esPropio() || this.previewMode()) {
      return;
    }
    this.credencialARetirar.emit(estudio);
  }
}
