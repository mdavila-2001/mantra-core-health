import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import {
  ACCESO_EN_MODAL,
  buildAccessTree,
  type AccessAreaView,
} from '../../../core/navigation/access-tree';
import type { AppSection } from '../../../core/navigation/navigation.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { NavIcon } from '../../../shared/components/atoms/nav-icon/nav-icon';
import { Tooltip } from '../../../shared/components/atoms/tooltip/tooltip';
import { CommunitiesDialog } from '../../communities/communities-dialog';
import { ClinicsDirectory } from '../../public-directories/clinics-directory';
import { PharmaciesDirectory } from '../../public-directories/pharmacies-directory';
import { LaboratoryDirectory } from '../../laboratory-directory/laboratory-directory';
import { ContentDialog } from '../../../shared/components/organisms/content-dialog/content-dialog';

/**
 * «Tus accesos», en dos escalones: primero las zonas, después las secciones.
 *
 * ## Qué era y por qué cambió
 *
 * Era una rejilla plana con **todas** las secciones que la sesión alcanza. Con
 * ocho se leía; con las treinta y dos de quien atiende dejó de ser un panel y
 * pasó a ser un cajón donde encontrar «Evoluciones» costaba más que buscarlo en
 * el menú lateral. El pedido del 28/08/2026 fue explícito: cinco opciones como
 * mucho, y el detalle un escalón adentro.
 *
 * El reparto no se decide acá —lo declara `core/navigation/access-tree.ts`, al
 * lado del registro de secciones— por el mismo motivo por el que el menú
 * tampoco lo decide: dos listas separadas terminan diciendo cosas distintas.
 *
 * ## Por qué la zona abierta es estado y no una ruta
 *
 * Abrir una zona **no cambia de pantalla**: se sigue en el panel, con las
 * cifras y las tarjetas de siempre arriba. Llevarlo a la URL haría que el
 * router desmontara y remontara el panel entero —con sus tres peticiones— para
 * mostrar cinco enlaces distintos. Lo que sí hace falta es poder salir sin
 * mouse, y de eso se ocupan el botón de volver y la tecla Escape.
 *
 * ## El foco se mueve con la vista
 *
 * Sin esto, abrir una zona deja el foco en un botón que ya no existe y el
 * teclado vuelve al principio del documento. Al entrar, el foco va al botón de
 * volver —el primer control de lo nuevo—; al salir, vuelve a la tarjeta de la
 * zona de la que se venía, que es donde la persona lo dejó.
 */
@Component({
  selector: 'app-access-tree',
  imports: [
    Badge,
    ClinicsDirectory,
    CommunitiesDialog,
    ContentDialog,
    LaboratoryDirectory,
    NavIcon,
    PharmaciesDirectory,
    RouterLink,
    Tooltip,
  ],
  templateUrl: './access-tree.html',
  styleUrl: './access-tree.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'arbol',
    // Escape cierra la zona abierta. Los eventos de teclado suben desde el
    // enlace enfocado, así que el host los ve sin ser enfocable él mismo.
    '(keydown.escape)': 'cerrar()',
  },
})
export class AccessTree {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly esNavegador = isPlatformBrowser(inject(PLATFORM_ID));

  /** Las secciones que la sesión puede abrir. Salen de `NavigationService`. */
  readonly sections = input.required<readonly AppSection[]>();

  /** El identificador de la zona abierta, o `null` en la primera pantalla. */
  private readonly zonaId = signal<string | null>(null);

  protected readonly zonas = computed<readonly AccessAreaView[]>(() =>
    buildAccessTree(this.sections()),
  );

  /**
   * La zona abierta como lista de cero o un elemento.
   *
   * Es para el `@for` de la plantilla, y no un capricho: con `@if` el bloque
   * sobrevive al cambio de zona —es el mismo nodo con otro contenido— y la
   * animación de entrada no se repite, así que saltar de una zona a otra desde
   * las pastillas no se ve. Con `@for` seguido por `track`, cambiar de zona
   * destruye y rehace el bloque, y el gesto vuelve a leerse.
   */
  protected readonly zonaAbierta = computed<readonly AccessAreaView[]>(() => {
    const id = this.zonaId();
    if (id === null) return [];
    const zona = this.zonas().find((z) => z.area.id === id);
    return zona === undefined ? [] : [zona];
  });

  /** Las otras zonas, para saltar de una a otra sin volver al principio. */
  protected readonly otrasZonas = computed<readonly AccessAreaView[]>(() => {
    const id = this.zonaId();
    return id === null ? [] : this.zonas().filter((zona) => zona.area.id !== id);
  });

  protected abrir(id: string): void {
    this.zonaId.set(id);
    this.enfocar('[data-arbol-volver]');
  }

  protected cerrar(): void {
    // Con un modal abierto, `Escape` es del modal y no de la zona.
    //
    // El `<dialog>` se declara dentro de esta plantilla, así que su `keydown`
    // burbujea hasta el host y llegaba acá: cerrar el modal con `Escape`
    // cerraba **además** la zona de atrás, y al volver la persona se
    // encontraba en «Todas las zonas» sin haber pedido salir. Lo detectó el
    // recorrido de navegador, no las pruebas unitarias: el `<dialog>` real
    // hace falta para verlo.
    if (this.modalAbierto() !== null) return;

    const veniaDe = this.zonaId();
    // Escape en la primera pantalla no hace nada: no hay de dónde salir, y
    // mover el foco «de vuelta» a la nada sería peor que no reaccionar.
    if (veniaDe === null) return;

    this.zonaId.set(null);
    this.enfocar(`[data-zona="${veniaDe}"]`);
  }

  /** Cuántas secciones abribles hay en total. Es el pie de la primera pantalla. */
  protected readonly totalDisponibles = computed(() =>
    this.zonas().reduce((suma, zona) => suma + zona.disponibles, 0),
  );

  /**
   * Lleva el foco a un control que todavía no existe.
   *
   * `setTimeout` y no una llamada directa: escribir la señal agenda el
   * repintado, y en ese instante el control al que hay que ir todavía no está
   * en el DOM. Una tarea de macrocola corre después, con la vista ya pintada.
   */
  private enfocar(selector: string): void {
    if (!this.esNavegador) return;

    setTimeout(() => {
      this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus();
    });
  }

  /** La ruta absoluta de una sección, que es como la consume el router. */
  protected rutaDe(section: AppSection): string {
    return `/${section.path}`;
  }

  /* -- Los accesos que abren en modal (corrección del 10/09/2026) -----------
     «Grupos y foros» abre Comunidades, y los tres directorios concretos se
     consultan sin salir del panel. Qué abre en modal lo declara
     `core/navigation/access-tree.ts`: acá no hay ni una ruta escrita a mano,
     que es la regla de este componente desde que existe. */

  /** El contenido del modal abierto, o `null`. Es la clave, no un componente. */
  protected readonly modalAbierto = signal<string | null>(null);

  /** La clave de modal de una sección, o `null` si esa sección navega. */
  protected modalDe(section: AppSection): string | null {
    return ACCESO_EN_MODAL[section.path] ?? null;
  }

  protected abrirModal(section: AppSection): void {
    const clave = this.modalDe(section);
    if (clave !== null) {
      this.modalAbierto.set(clave);
    }
  }

  /**
   * Cierra el modal y devuelve el foco al acceso que lo abrió.
   *
   * El `app-content-dialog` ya devuelve el foco a quien lo abrió, pero sólo si
   * ese elemento sigue vivo. Acá lo está —la zona no se desmonta—, así que esto
   * es la red por si el modal se cerró por una vía que perdió el origen.
   */
  protected cerrarModal(): void {
    const clave = this.modalAbierto();
    this.modalAbierto.set(null);
    if (clave !== null) {
      this.enfocar(`[data-modal="${clave}"]`);
    }
  }
}
