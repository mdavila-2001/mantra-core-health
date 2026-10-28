import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  model,
  OnInit,
  PLATFORM_ID,
  signal,
} from '@angular/core';

import type { Subscription } from 'rxjs';

import { InsuranceClient } from '../../../../core/data-access/insurance/insurance.client';
import type { CarrierCatalogEntry } from '../../../../core/data-access/insurance/insurance.types';
import { PublicDirectoryClient } from '../../../../core/data-access/public-directory/public-directory.client';
import type { PublicSearchResult } from '../../../../core/data-access/public-directory/public-directory.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { NavIcon } from '../../../../shared/components/atoms/nav-icon/nav-icon';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import {
  CheckboxGroup,
  type OpcionDeCasilla,
} from '../../../../shared/components/molecules/checkbox-group/checkbox-group';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ReferenceCombobox } from '../../../../shared/components/molecules/reference-combobox/reference-combobox';
import type { ReferenceOption } from '../../../../shared/components/molecules/reference-combobox/reference-combobox.types';

/** Cuántas instituciones se pueden elegir; el mismo tope que la API. */
export const MAX_INSTITUTIONS = 10;

/**
 * Una institución elegida, con lo que hace falta para mostrarla sin volver a
 * preguntar: el slug es lo que viaja en el alta.
 */
export interface ChosenInstitution {
  readonly slug: string;
  readonly name: string;
  readonly city: string | null;
  /** Si la institución misma está verificada en AloVida (su sello público). */
  readonly verified: boolean;
}

/** Las tarjetas de ayuda de la página «Dónde trabaja y con qué seguros». */
export const AYUDA_LUGARES = [
  {
    icono: 'shield',
    titulo: 'El sello lo pone la otra parte',
    texto:
      'Elegir una clínica o un seguro no le acredita: cada uno confirma el vínculo con su sello. Una institución sin quién confirme lo deja como declarado por usted.',
  },
  {
    icono: 'building',
    titulo: 'Lo sigue en «Mis verificaciones»',
    texto:
      'Ahí ve cada pedido como una conversación: cuándo lo envió, si lo aprobaron y, si lo rechazaron, por qué.',
  },
] as const;

/** Lo elegido, recuperado del borrador del alta; lo que no tenga forma se ignora. */
export function lugaresDelBorrador(extra: Record<string, unknown>): {
  readonly institutions: readonly ChosenInstitution[];
  readonly insurerIds: readonly string[];
} {
  const instituciones = extra['institucionesElegidas'];
  const aseguradoras = extra['aseguradorasElegidas'];
  return {
    institutions: Array.isArray(instituciones) ? (instituciones as ChosenInstitution[]) : [],
    insurerIds: Array.isArray(aseguradoras) ? (aseguradoras as string[]) : [],
  };
}

/**
 * Lo que viaja en el alta. Cada vínculo nace pendiente de que la otra parte lo
 * confirme; el alta no da por cierto ninguno. Sin elección, no viaja nada.
 */
export function lugaresDelAlta(
  institutions: readonly ChosenInstitution[],
  insurerIds: readonly string[],
): { institutionSlugs?: string[]; insurerCarrierIds?: string[] } {
  return {
    ...(institutions.length === 0 ? {} : { institutionSlugs: institutions.map((i) => i.slug) }),
    ...(insurerIds.length === 0 ? {} : { insurerCarrierIds: [...insurerIds] }),
  };
}

/**
 * Dónde trabaja: las instituciones de la plataforma y las aseguradoras
 * (propietario, 2026-10-28).
 *
 * Es un campo proyectado del alta de médico, no una pantalla: no envía nada.
 * Guarda lo elegido en dos `model` y el alta lo manda junto con todo lo demás.
 *
 * ## Dos sellos distintos por institución, y los dos se dicen
 *
 * - **El de la institución**: si AloVida la verificó. Sale del buscador público
 *   y se muestra al elegirla, porque es lo que distingue a una clínica real de
 *   una ficha cualquiera.
 * - **El del vínculo**: que esa institución confirme que usted trabaja ahí. No
 *   existe todavía —nadie lo confirmó el día del alta—, así que acá sólo se
 *   promete y se explica dónde se va a ver: «Mis verificaciones».
 *
 * Mostrar sólo el primero haría creer que elegir una clínica verificada ya
 * acredita el vínculo, y eso es exactamente lo que no es.
 */
@Component({
  selector: 'app-workplace-picker',
  imports: [Alert, AppButton, Badge, CheckboxGroup, FormField, NavIcon, ReferenceCombobox],
  templateUrl: './workplace-picker.html',
  styleUrl: './workplace-picker.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkplacePicker implements OnInit {
  private readonly directory = inject(PublicDirectoryClient);
  private readonly insurance = inject(InsuranceClient);
  private readonly platformId = inject(PLATFORM_ID);

  /** Las instituciones elegidas, en el orden en que se eligieron. */
  readonly institutions = model<readonly ChosenInstitution[]>([]);

  /** Las aseguradoras elegidas (ids del catálogo público). */
  readonly insurerIds = model<readonly string[]>([]);

  protected readonly maxInstitutions = MAX_INSTITUTIONS;

  /* ---- Instituciones ------------------------------------------------------ */

  /** Los resultados crudos de la última búsqueda, para recuperar el elegido. */
  private readonly resultados = signal<readonly PublicSearchResult[]>([]);
  protected readonly buscando = signal(false);
  protected readonly busquedaFallida = signal(false);

  /**
   * La búsqueda en vuelo. Cada texto nuevo la cancela: con red lenta la
   * respuesta de «Cl» podía llegar después de la de «Clínica Foi» y pisarla.
   */
  private busqueda: Subscription | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.busqueda?.unsubscribe());
  }

  /**
   * El combobox elige de a una y se vacía: lo elegido pasa a la lista de abajo.
   *
   * `app-reference-combobox` guarda su texto por dentro y lo restaura a «lo
   * último elegido» al salir, así que devolver su `value` a `null` no lo
   * vacía. Se lo remonta con una clave nueva tras cada elección: queda vacío y
   * listo para la siguiente, sin tocar la molécula compartida.
   */
  protected readonly comboKey = signal(0);

  /** Lo que ofrece el buscador: sin las ya elegidas, que repetirlas no suma. */
  protected readonly opciones = computed<readonly ReferenceOption[]>(() => {
    const elegidas = new Set(this.institutions().map((i) => i.slug));
    return this.resultados()
      .filter((r) => !elegidas.has(r.slug))
      .map((r) => ({
        value: r.slug,
        label: r.displayName,
        hint: [r.city, r.verified ? 'Institución verificada' : 'Sin verificar']
          .filter((parte): parte is string => parte !== null && parte !== '')
          .join(' · '),
      }));
  });

  protected readonly topeAlcanzado = computed(() => this.institutions().length >= MAX_INSTITUTIONS);

  /** Busca en el directorio público de organizaciones. */
  protected buscar(texto: string): void {
    const q = texto.trim();
    this.busqueda?.unsubscribe();
    if (q === '') {
      this.resultados.set([]);
      this.buscando.set(false);
      return;
    }
    this.buscando.set(true);
    this.busquedaFallida.set(false);
    this.busqueda = this.directory.searchOrganizations({ q, limit: 10 }).subscribe({
      next: (pagina) => {
        this.resultados.set(pagina.items);
        this.buscando.set(false);
      },
      error: () => {
        this.resultados.set([]);
        this.buscando.set(false);
        this.busquedaFallida.set(true);
      },
    });
  }

  /** Pasa la institución elegida a la lista y deja el buscador listo para otra. */
  protected elegir(opcion: ReferenceOption | null): void {
    if (opcion === null || this.topeAlcanzado()) {
      return;
    }
    const resultado = this.resultados().find((r) => r.slug === opcion.value);
    if (resultado === undefined) {
      return;
    }
    this.institutions.update((lista) =>
      lista.some((i) => i.slug === resultado.slug)
        ? lista
        : [
            ...lista,
            {
              slug: resultado.slug,
              name: resultado.displayName,
              city: resultado.city,
              verified: resultado.verified,
            },
          ],
    );
    // En el próximo ciclo: el combobox todavía está emitiendo su elección, y
    // destruirlo en medio de su propio evento lo dejaría a medias.
    this.resultados.set([]);
    queueMicrotask(() => this.comboKey.update((k) => k + 1));
  }

  protected quitar(slug: string): void {
    this.institutions.update((lista) => lista.filter((i) => i.slug !== slug));
  }

  /* ---- Aseguradoras ------------------------------------------------------- */

  private readonly catalogo = signal<readonly CarrierCatalogEntry[] | null>(null);
  protected readonly catalogoFallido = signal(false);
  protected readonly catalogoCargando = computed(
    () => this.catalogo() === null && !this.catalogoFallido(),
  );

  /** Privadas primero y públicas después, cada grupo por nombre. */
  protected readonly opcionesDeSeguro = computed<readonly OpcionDeCasilla[]>(() =>
    [...(this.catalogo() ?? [])]
      .sort((a, b) => Number(a.isPublic) - Number(b.isPublic) || a.name.localeCompare(b.name, 'es'))
      .map((c) => ({
        value: c.id,
        label: c.isPublic ? `${c.name} (seguro público)` : c.name,
      })),
  );

  ngOnInit(): void {
    this.cargarAseguradoras();
  }

  /**
   * Pide el catálogo público de aseguradoras. Bajo SSR no se pide nada: el
   * registro se prerenderiza y durante el prerender no hay API a la que
   * preguntar (mismo criterio que el alta de paciente).
   */
  protected cargarAseguradoras(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    this.catalogoFallido.set(false);
    this.insurance.listCarrierCatalog().subscribe({
      next: (carriers) => this.catalogo.set(carriers),
      error: () => {
        this.catalogo.set(null);
        this.catalogoFallido.set(true);
      },
    });
  }

  protected elegirAseguradoras(ids: readonly string[]): void {
    this.insurerIds.set(ids);
  }
}
