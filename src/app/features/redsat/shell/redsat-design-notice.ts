import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  ActivatedRoute,
  NavigationEnd,
  Router,
  RouterLink,
  type ActivatedRouteSnapshot,
} from '@angular/router';
import { filter, map, startWith } from 'rxjs';

/**
 * A qué pantalla real lleva cada módulo de la bóveda.
 *
 * Es el puente que el carril 01 pedía y no existía: la maqueta muestra cómo se
 * ve algo, y este mapa dice **dónde está eso funcionando**. Sólo figuran los
 * módulos cuya pantalla real ya está construida y conectada — inventar un
 * destino para los que no la tienen sería repetir el defecto que este aviso
 * viene a corregir.
 *
 * Sale de `docs/reports/generated/design-view-inventory.md`, que es quien cruza
 * las dos superficies.
 */
const PANTALLA_REAL: Readonly<Record<string, { readonly ruta: string; readonly rotulo: string }>> = {
  buscar: { ruta: '/directory', rotulo: 'Directorio de médicos' },
  directorio: { ruta: '/administration/organizations', rotulo: 'Organizaciones' },
  personas: { ruta: '/administration/patients', rotulo: 'Pacientes' },
  terminologia: { ruta: '/administration/terminology', rotulo: 'Terminología' },
  accesos: { ruta: '/administration/delegated-access', rotulo: 'Acceso delegado' },
};

/**
 * El aviso que declara que una pantalla portada es una **referencia de diseño**
 * y no el producto.
 *
 * ## Por qué existe
 *
 * `features/redsat/` tiene 126 pantallas portadas desde la bóveda con marcado
 * estático: filas escritas a mano, enlaces `data-sin-destino`, y —en el marco
 * de sesión— una identidad de mentira («Rocío Salazar · Administración de
 * seguridad») sobre rutas que **no pasan por `authGuard`**. Renderizan
 * perfectamente y no persisten nada.
 *
 * Eso es exactamente lo que la corrección #7 del 15/08/2026 prohíbe: pantallas
 * que aparentan funcionar. Y el carril 01 pide **marcarlas**, no borrarlas —
 * son el entregable del diseñador y la fuente contra la que se rehidratan las
 * vistas reales (corrección #8).
 *
 * ## Por qué en el marco y no en cada pantalla
 *
 * Son 126. Un aviso por pantalla se olvida en alguna, y el generador
 * (`scripts/port-vistas-redsat.mjs`) volvería a pisarlo en la próxima
 * regeneración. En los dos marcos va una vez, no lo toca el generador, y cubre
 * todo lo que cuelgue de ellos — incluidas las pantallas que se porten después.
 *
 * ## Por qué no se puede cerrar
 *
 * Un aviso descartable se descarta y deja de decir lo que dice. Este no informa
 * de un estado transitorio: dice qué **es** la pantalla, y eso no cambia
 * mientras la pantalla siga siendo una maqueta.
 */
@Component({
  selector: 'app-redsat-design-notice',
  imports: [RouterLink],
  template: `
    @if (esMaqueta()) {
    <div class="app-alert redsat-aviso-diseno" data-tono="aviso" role="note">
      <svg
        class="icono"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
        <path d="M10.3 3.9 2.4 17.5A1.8 1.8 0 0 0 4 20.2h16a1.8 1.8 0 0 0 1.6-2.7L13.7 3.9a1.8 1.8 0 0 0-3.4 0z" />
      </svg>
      <div class="app-alert__cuerpo">
        <strong>Referencia de diseño, no la aplicación.</strong>
        <span>
          Esta pantalla viene de la bóveda con datos de ejemplo: lo que se ve acá
          no se guarda en ningún lado y los filtros y botones no consultan la API.
          @if (destino(); as real) {
            La pantalla que sí funciona es
            <a [routerLink]="real.ruta">{{ real.rotulo }}</a
            >.
          }
        </span>
      </div>
    </div>
    }
  `,
  styles: `
    .redsat-aviso-diseno {
      margin-bottom: var(--e6);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RedsatDesignNotice {
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);

  /** El módulo que se está mirando: el primer segmento de la URL. */
  private readonly segmento = toSignal(
    this.router.events.pipe(
      filter((evento) => evento instanceof NavigationEnd),
      map(() => this.primerSegmento()),
      startWith(this.primerSegmento()),
    ),
    { initialValue: '' },
  );

  /** La pantalla real equivalente, si el módulo tiene una construida. */
  protected readonly destino = computed(() => PANTALLA_REAL[this.segmento()] ?? null);

  /**
   * Si lo que se está mirando es una maqueta y no el producto.
   *
   * ## Por qué hizo falta, y por qué el aviso estaba mintiendo
   *
   * El marco público envuelve **dos cosas distintas**: las pantallas portadas de
   * la bóveda, que siguen siendo marcado estático, y la superficie pública de
   * P4 —`/buscar`, sus verticales y las fichas `/p/:slug`—, que lee la API real
   * sin sesión.
   *
   * Como el aviso se pintaba siempre, la ficha pública de un profesional —con
   * su nombre, su especialidad y su biografía traídos de la API— aparecía
   * coronada por un cartel que decía «los filtros y botones no consultan la
   * API» y ofrecía ir a «la pantalla que sí funciona». Se lo habría dicho a un
   * paciente, sobre datos ciertos.
   *
   * Un aviso que marca lo real como falso es peor que no tenerlo: enseña a
   * ignorarlo, y entonces deja de proteger a las 126 pantallas para las que sí
   * existe.
   *
   * ## Por qué se decide por dato de ruta y no por una lista de URL
   *
   * Porque la lista se desincroniza en la primera pantalla que alguien conecte
   * a la API y no recuerde venir a tacharla acá, y el fallo vuelve en silencio.
   * Con `data.pantallaReal` la declara la propia ruta, junto a su
   * `loadComponent`: quien conecta la pantalla ya está editando esa línea.
   *
   * Por omisión **es maqueta**. La regla se equivoca del lado seguro: una
   * pantalla nueva de la bóveda queda marcada aunque nadie se acuerde del aviso.
   */
  protected readonly esMaqueta = computed(() => !this.pantallaReal());

  private readonly pantallaReal = toSignal(
    this.router.events.pipe(
      filter((evento) => evento instanceof NavigationEnd),
      map(() => this.rutaDeclaraReal()),
      startWith(this.rutaDeclaraReal()),
    ),
    { initialValue: false },
  );

  /** Lee `data.pantallaReal` de la hoja del árbol de rutas activo. */
  private rutaDeclaraReal(): boolean {
    let nodo: ActivatedRouteSnapshot | null = this.ruta.snapshot.root;
    while (nodo !== null) {
      if (nodo.data['pantallaReal'] === true) return true;
      nodo = nodo.firstChild;
    }
    return false;
  }

  private primerSegmento(): string {
    return this.router.url.split('?')[0].split('/').filter(Boolean)[0] ?? '';
  }
}
