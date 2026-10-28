import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import type { ValidationErrors, ValidatorFn } from '@angular/forms';

import { MAX_MEDICAL_FACILITY_BRANCHES } from '../../../../core/data-access/iam/medical-facility.rules';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Input as AppInput } from '../../../../shared/components/atoms/input/input';
import { NavIcon } from '../../../../shared/components/atoms/nav-icon/nav-icon';
import { Tooltip } from '../../../../shared/components/atoms/tooltip/tooltip';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { BranchBulkImport } from '../../../../shared/components/organisms/branch-bulk-import/branch-bulk-import';
import type { BranchDraft } from '../../../../shared/utils/branch-import/branch-import';
import { addressFromPoint, pointLabel } from '../address-from-point';
import {
  MapLocationPicker,
  type Coordinates,
  type LocalityFromPoint,
  type TestIds,
} from '../map-location-picker/map-location-picker';

/** Una sucursal declarada en un alta: cómo se llama y dónde está. */
export interface SucursalDeclarada {
  readonly id: string;
  readonly nombre: string;
  /** Sale del punto del mapa; la persona no la escribe. */
  readonly direccion: string;
  readonly gps: Coordinates | null;
}

/** Cuántas sucursales admite un alta por omisión: el tope del contrato médico, que se declara una sola vez. */
export const MAX_SUCURSALES_POR_DEFECTO = MAX_MEDICAL_FACILITY_BRANCHES;

/** Qué se toma del archivo: la dirección no, porque la deduce el punto del mapa y pisa la del archivo. */
const AVISO_DEL_ARCHIVO =
  'Del archivo se toman el nombre y el punto; la dirección se deduce del punto en el mapa.';

const MAX_NOMBRE = 300;
const MAX_DIRECCION = 300;

/**
 * Qué le falta a una sucursal para poder viajar, o `null` si está completa.
 *
 * Una sucursal sin nombre no se puede reconocer, y sin punto no tiene
 * dirección (sale del punto) ni se puede ordenar por cercanía.
 */
export function faltaDeSucursal(sucursal: SucursalDeclarada): string | null {
  return faltaDeNombre(sucursal) ?? faltaDePunto(sucursal);
}

/** Lo que dice el campo del nombre cuando está vacío. */
export function faltaDeNombre(sucursal: SucursalDeclarada): string | null {
  return sucursal.nombre.trim() === '' ? 'Escriba el nombre de la sucursal.' : null;
}

/** Lo que dice el mapa cuando no tiene un punto confirmado. */
export function faltaDePunto(sucursal: SucursalDeclarada): string | null {
  return sucursal.gps === null ? 'Marque la sucursal en el mapa y confirme la dirección.' : null;
}

/**
 * El validador del control que guarda la lista: todas las sucursales agregadas
 * tienen que estar completas. Una lista vacía es válida —las sucursales son
 * opcionales—; lo que no se admite es una a medias, que la persona agregó y
 * olvidó llenar.
 */
export function sucursalesCompletas(maximo = MAX_SUCURSALES_POR_DEFECTO): ValidatorFn {
  return (control): ValidationErrors | null => {
    const lista = (control.value ?? []) as readonly SucursalDeclarada[];
    if (lista.length > maximo) return { demasiadasSucursales: { maximo } };
    return lista.some((s) => faltaDeSucursal(s) !== null) ? { sucursalIncompleta: true } : null;
  };
}

/**
 * **La lista de sucursales de un alta**: una tarjeta por local, cada una con su
 * propio mapa, su pin y su confirmación (confirmar una no confirma otra), más la
 * carga en lote desde un CSV.
 *
 * Es la misma pregunta que las altas de laboratorio, imagenología y farmacia
 * resuelven cada una por su lado (1.18 del registro de procesos); acá está una
 * vez, con dos diferencias deliberadas:
 *
 * - **Sólo lo que el contrato de la organización médica declara**: nombre y
 *   dirección con su punto. La descripción y el enlace de ubicación que sí
 *   guardan las otras no existen en `medicalFacility.branches`, así que no se
 *   piden (el archivo en lote los puede traer; se ignoran).
 * - **Tope**: el contrato admite hasta 50. El lote que lo pase se corta y la
 *   pantalla lo dice.
 *
 * El componente no conoce el formulario: lee y escribe la lista por `sucursales`
 * (dos vías) y la pantalla la guarda en su control con {@link sucursalesCompletas}.
 */
@Component({
  selector: 'app-branches-editor',
  imports: [AppButton, AppInput, NavIcon, Tooltip, FormField, MapLocationPicker, BranchBulkImport],
  templateUrl: './branches-editor.html',
  styleUrl: './branches-editor.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BranchesEditor {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  /** La lista de sucursales, en dos vías. */
  readonly sucursales = model<readonly SucursalDeclarada[]>([]);

  /** Prefijo de los `data-testid`: `<prefijo>-agregar-sucursal`, `<prefijo>-sucursal-1-nombre`… */
  readonly prefijoTestId = input.required<string>();

  readonly maximo = input(MAX_SUCURSALES_POR_DEFECTO);

  /** Si mostrar los errores de las que están a medias (cuando la persona intentó avanzar). */
  readonly mostrarFaltantes = input(false);

  /** El próximo número que este editor no repartió todavía (ver {@link idsSiguientes}). */
  private proximo = 1;

  protected readonly cargaEnLoteAbierta = signal(false);
  protected readonly avisoDeLote = signal<string | null>(null);

  protected readonly lleno = computed(() => this.sucursales().length >= this.maximo());

  protected readonly nombresEscritos = computed(() =>
    this.sucursales()
      .map((s) => s.nombre)
      .filter((nombre) => nombre.trim() !== ''),
  );

  /** El error del nombre, sólo cuando la persona ya intentó avanzar. */
  protected errorDeNombre(sucursal: SucursalDeclarada): string {
    return this.mostrarFaltantes() ? (faltaDeNombre(sucursal) ?? '') : '';
  }

  /** El error del mapa, sólo cuando la persona ya intentó avanzar. */
  protected errorDePunto(sucursal: SucursalDeclarada): string {
    return this.mostrarFaltantes() ? (faltaDePunto(sucursal) ?? '') : '';
  }

  protected idsDe(id: string): TestIds {
    const p = `${this.prefijoTestId()}-${id}`;
    return {
      mapa: `${p}-map`,
      confirmada: `${p}-location-confirmed`,
      avisoGeocodificacion: `${p}-geocoding-notice`,
      quitar: `${p}-location-remove`,
      confirmar: `${p}-location-confirm`,
      usarUbicacion: `${p}-location-use`,
      marcarEnMapa: `${p}-location-pick`,
    };
  }

  /**
   * Los `cantidad` ids siguientes: nunca uno que la lista ya tenga ni uno que
   * este editor haya repartido antes (quitar la última y agregar otra no reusa
   * el número).
   *
   * El contador solo no alcanza: el formulario paginado destruye el editor al
   * cambiar de página y lo recrea con la lista que guardó la pantalla (también
   * al restaurar un borrador), y un contador por instancia volvía a empezar en 1
   * y repetía `sucursal-1`. Con ids repetidos, editar o quitar una afectaba a
   * dos y el cuerpo salía mezclado. Por eso se parte también del mayor id de la
   * lista. `crypto.randomUUID` no está en todos los entornos de render.
   */
  private idsSiguientes(cantidad: number): string[] {
    const mayor = this.sucursales().reduce((max, s) => {
      const numero = /^sucursal-(\d+)$/.exec(s.id);
      return numero === null ? max : Math.max(max, Number(numero[1]));
    }, 0);
    const primero = Math.max(this.proximo, mayor + 1);
    this.proximo = primero + cantidad;
    return Array.from({ length: cantidad }, (_, i) => `sucursal-${primero + i}`);
  }

  protected agregar(): void {
    if (this.lleno()) return;
    this.sucursales.update((lista) => [
      ...lista,
      { id: this.idsSiguientes(1)[0]!, nombre: '', direccion: '', gps: null },
    ]);
  }

  protected quitar(id: string): void {
    const antes = this.sucursales();
    const posicion = antes.findIndex((s) => s.id === id);
    const quedan = antes.filter((s) => s.id !== id);
    this.sucursales.set(quedan);
    // El botón que tenía el foco desaparece con su tarjeta: sin esto el foco
    // cae al `<body>` y quien navega con teclado o lector pierde el lugar. Pasa
    // al «Quitar» de la que ocupa su lugar (o de la anterior) y, si no queda
    // ninguna, a «Agregar sucursal».
    const vecina = quedan[Math.min(posicion, quedan.length - 1)];
    const destino =
      vecina === undefined
        ? `${this.prefijoTestId()}-agregar-sucursal`
        : `${this.prefijoTestId()}-quitar-${vecina.id}`;
    afterNextRender(
      () => this.host.nativeElement.querySelector<HTMLElement>(`[data-testid="${destino}"]`)?.focus(),
      { injector: this.injector },
    );
  }

  /** `app-input` emite `string | number | null`: el `null` de un campo vaciado es la cadena vacía. */
  protected escribirNombre(id: string, nombre: string | number | null): void {
    this.actualizar(id, { nombre: nombre === null ? '' : String(nombre).slice(0, MAX_NOMBRE) });
  }

  protected fijarGps(id: string, gps: Coordinates | null): void {
    // Con punto, la dirección nunca queda vacía: la API la exige y la persona no la ve.
    const actual = this.sucursales().find((s) => s.id === id);
    const direccion = gps !== null && (actual?.direccion ?? '').trim() === '' ? pointLabel(gps) : actual?.direccion;
    this.actualizar(id, { gps, ...(direccion === undefined ? {} : { direccion }) });
  }

  protected escribirLocalidad(id: string, localidad: LocalityFromPoint | null): void {
    if (localidad === null) return;
    this.actualizar(id, { direccion: addressFromPoint(localidad, null, MAX_DIRECCION) });
  }

  /** Suma al final las del archivo, hasta el tope; cada una nace con su pin si el enlace traía el punto. */
  protected agregarEnLote(lote: readonly BranchDraft[]): void {
    const lugar = Math.max(0, this.maximo() - this.sucursales().length);
    const entran = lote.slice(0, lugar);
    const ids = this.idsSiguientes(entran.length);
    const nuevas = entran.map(
      (b, i): SucursalDeclarada => ({
        id: ids[i]!,
        nombre: b.name.slice(0, MAX_NOMBRE),
        direccion: b.address.slice(0, MAX_DIRECCION),
        gps: b.coordinates === null ? null : { lat: b.coordinates.latitude, lng: b.coordinates.longitude },
      }),
    );
    this.sucursales.update((lista) => [...lista, ...nuevas]);
    this.avisoDeLote.set(
      entran.length < lote.length
        ? `Se agregaron ${entran.length} de ${lote.length}: el máximo es de ${this.maximo()} sucursales. ${AVISO_DEL_ARCHIVO}`
        : AVISO_DEL_ARCHIVO,
    );
  }

  private actualizar(id: string, cambio: Partial<SucursalDeclarada>): void {
    this.sucursales.update((lista) => lista.map((s) => (s.id === id ? { ...s, ...cambio } : s)));
  }
}
