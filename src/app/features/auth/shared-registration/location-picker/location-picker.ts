import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';

import type { RamaDepartamento } from '../../../../core/data-access/terminology/bo-municipalities.service';
import { Select as AppSelect } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { DepartmentMap, type DepartamentoElegible } from '@shared/components/organisms/department-map/department-map';
import type { PuntoGeo } from '@shared/components/organisms/map/map-pin.types';
import { CARGADOR_DE_PROVINCIAS } from '@shared/components/organisms/map/provinces';
import { Input as AppInput } from '../../../../shared/components/atoms/input/input';
import { provinceFromCatalog } from '@shared/geo/bo-provinces';
import { provinceIn } from '@shared/components/organisms/map/provinces';
import {
  findOutline,
  municipalityAt,
  provinceOfMunicipality,
  type LocalityDetail,
} from '@shared/geo/locality-detail';

/**
 * «¿En qué localidad?»: el mapa de departamentos y el select de municipio.
 *
 * ## Qué cierra
 *
 * AC-03-6 y AC-03-7 de la TAREA 03: un mapa de Bolivia donde el departamento se
 * elige con un clic **y con el teclado**, y un select de ciudad que muestra
 * **sólo** los municipios de ese departamento, alimentado de
 * `VS_BO_MUNICIPALITY` (~340, catálogo real) y nunca de una lista escrita acá.
 * Lo monta el alta de paciente dos veces —residencia y trabajo— y el alta de
 * profesional una.
 *
 * ## Por qué reemplaza al árbol de municipios, y qué se perdió
 *
 * El alta usaba `app-tree-select`: un diálogo con buscador donde se escribe el
 * nombre del municipio sin saber su departamento. Eso es P-03-9 de la ficha
 * —«¿el mapa reemplaza al árbol o conviven?»— y **no está resuelto con el
 * propietario**. Se resolvió así, y se deja escrito para poder revertirlo:
 *
 * - **El pedido es explícito**: «un mapa de Bolivia para elegir el
 *   departamento, y un select para la ciudad específica». Un árbol con buscador
 *   no es ni una cosa ni la otra.
 * - **Lo que se pierde es la búsqueda por nombre suelto.** Quien sabe que vive
 *   en «Warnes» y no recuerda que Warnes es Santa Cruz tiene que elegir primero
 *   el departamento. En Bolivia eso es un supuesto razonable —el departamento
 *   propio se sabe— y es el precio de que el municipio quede inequívoco: siete
 *   nombres se repiten entre departamentos.
 * - **Lo que NO se perdió**: el catálogo es el mismo, el `conceptId` que viaja
 *   es el mismo, y el árbol sigue existiendo para las pantallas que lo usan.
 *   Volver atrás es cambiar el componente proyectado, no rehacer el dato.
 *
 * ## Por qué el departamento no viaja al backend
 *
 * Porque el código INE del municipio (`DDPPMM`) ya lo lleva adentro, y el
 * backend lo deriva. Mandar el par abriría la puerta a que llegara incoherente
 * —el municipio de uno con el departamento de otro— y no habría criterio para
 * decidir cuál gana. Acá el departamento es **cómo se llega** al municipio, no
 * un dato aparte.
 */
@Component({
  selector: 'app-location-picker',
  imports: [DepartmentMap, AppSelect, AppInput, FormField],
  templateUrl: './location-picker.html',
  styleUrl: './location-picker.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LocationPicker {
  /** El árbol del catálogo: cada departamento con sus municipios. */
  readonly ramas = input.required<readonly RamaDepartamento[]>();

  /** El `conceptId` del municipio elegido, que es lo único que viaja. */
  readonly value = model<string | null>(null);

  /** Rótulo del select de municipio. La prosa la pone quien lo monta. */
  readonly municipalityLabel = input('Ciudad o municipio');

  readonly municipalityHint = input('');

  /**
   * La explicación del municipio, la que el campo muestra al apuntarlo o al
   * enfocarlo. Vacía —lo normal— no dibuja nada.
   *
   * Va aparte del `hint` por la misma razón que en el motor de formularios: el
   * `hint` se lee sin hacer nada y existe en el teléfono, donde no hay puntero;
   * la explicación es la que no cabe siempre a la vista. Ver `description` en
   * `app-form-field`.
   */
  readonly municipalityDescription = input('');

  /** Si el municipio lleva asterisco. La validación vive en el `FormControl`. */
  readonly required = input(false);

  /** El error del municipio, cuando quien lo monta lo tiene. */
  readonly errorMessage = input('');

  readonly mapLabel = input('Mapa de Bolivia: elija su departamento');

  /**
   * Sólo para mirar: el mapa marca el departamento y el select muestra el
   * municipio, pero ninguno de los dos se puede cambiar. Lo usa la ficha del
   * médico para mostrar su residencia con los mismos controles del editor.
   */
  readonly readonly = input(false);

  /** Prefijo de los `data-testid` de las dos partes. */
  readonly testId = input('location');

  /**
   * Si al elegir la localidad se dibuja la ficha con lo que se deduce de ella:
   * departamento, provincia y municipio, ya llenos.
   *
   * Es de las altas —donde el mapa va primero y el resto del domicilio se
   * escribe **después** de ubicarse—. La ficha del médico monta este mismo
   * control sólo para mirar y no la pide.
   */
  readonly ficha = input(false);

  /** Rótulo de la ficha, para que cada alta diga de qué lugar habla. */
  readonly fichaTitulo = input('Su ubicación');

  /**
   * El lugar exacto, si quien monta el control lo tiene (el punto que se
   * marcó en el mapa de la dirección). El mapa lo dibuja como un punto rojo;
   * sin él, el punto cae en el centro del municipio.
   */
  readonly punto = input<PuntoGeo | null>(null);

  /**
   * Si la localidad SALE del punto y de nada más (pedido del cliente del
   * 26/10/2026): el punto con el que nace también elige, y el mapa y el select
   * quedan en sólo lectura aunque `readonly` no lo diga. Lo usa
   * `app-map-location-picker`, que monta este control recién cuando hay punto.
   */
  readonly desdePunto = input(false);

  /**
   * El distrito o la zona que devolvió el geocodificador, para la ficha. Vacío
   * no se dibuja: no se inventa un barrio.
   */
  readonly zona = input<string | null>(null);

  /** Sólo lectura de verdad: pedida, o porque la localidad la decide el punto. */
  protected readonly bloqueado = computed(() => this.readonly() || this.desdePunto());

  /**
   * El departamento elegido a mano, cuando todavía no hay municipio.
   *
   * Es un estado propio y no derivado porque hay un momento —entre pulsar el
   * departamento y elegir la ciudad— en el que el municipio es `null` y el
   * departamento no: sin esto, el mapa se apagaría solo en cuanto se lo pulsa y
   * el select de ciudad no llegaría a aparecer nunca.
   */
  private readonly departmentManual = signal<string | null>(null);

  /**
   * El departamento vigente: el del municipio elegido, si lo hay; el pulsado en
   * el mapa, si no.
   *
   * El municipio manda sobre el mapa a propósito: al volver a esta página con
   * un municipio ya elegido, el mapa tiene que mostrarlo marcado aunque nadie
   * haya vuelto a tocarlo.
   */
  protected readonly chosenDepartment = computed<string | null>(() => {
    const municipio = this.value();
    if (municipio !== null) {
      const rama = this.ramas().find((r) =>
        r.municipios.some((m) => m.conceptId === municipio),
      );
      if (rama !== undefined) return rama.conceptId;
    }
    return this.departmentManual();
  });

  /** Los departamentos, tal como los quiere el mapa. */
  protected readonly departments = computed<readonly DepartamentoElegible[]>(() =>
    this.ramas().map((rama) => ({
      conceptId: rama.conceptId,
      sigla: rama.sigla,
      nombre: rama.nombre,
    })),
  );

  /**
   * El municipio elegido, como lo quiere el mapa para sombrearlo: el código
   * del INE si el catálogo lo trae (`030101`), y si no —la maqueta siembra
   * códigos legados como `SC-SCZ`— el nombre, que el mapa busca dentro del
   * departamento.
   */
  protected readonly municipalityInMap = computed<string | null>(() => {
    const elegido = this.value();
    if (elegido === null) return null;
    for (const rama of this.ramas()) {
      const municipio = rama.municipios.find((m) => m.conceptId === elegido);
      if (municipio !== undefined) {
        return /^\d{6}$/.test(municipio.ine) ? municipio.ine : municipio.nombre;
      }
    }
    return null;
  });

  /**
   * Los municipios **del departamento elegido**, y ninguno más (AC-03-7).
   *
   * Sin departamento la lista es vacía y el select no se dibuja: 340 opciones
   * planas es exactamente lo que este control existe para evitar.
   */
  protected readonly municipalities = computed<readonly SelectOption<string>[]>(() => {
    const departamento = this.chosenDepartment();
    if (departamento === null) return [];
    const rama = this.ramas().find((r) => r.conceptId === departamento);
    if (rama === undefined) return [];
    return rama.municipios.map((m) => ({ value: m.conceptId, label: m.nombre }));
  });

  private readonly cargadorDeProvincias = inject(CARGADOR_DE_PROVINCIAS);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** La provincia ya deducida, por municipio. `undefined` es «todavía no». */
  private readonly provincias = signal<ReadonlyMap<string, string | null>>(new Map());

  constructor() {
    // La provincia no está en el catálogo: se deduce del dibujo, que se baja
    // la primera vez que hace falta (los contornos pesan ~107 kB y el mapa ya
    // los pide por su cuenta, así que el módulo se comparte).
    effect(() => {
      const punto = this.punto();
      // El punto con el que el selector NACE no elige nada: viene de un
      // borrador, de volver a la página o de editar una dirección guardada, y
      // ahí la localidad ya la eligió la persona. Sólo un punto NUEVO elige.
      if (this.puntoTraducido === undefined && !this.desdePunto()) {
        this.puntoTraducido = punto;
        return;
      }
      if (!this.isBrowser || punto === null) return;
      if (this.readonly() && !this.desdePunto()) return;
      if (this.ramas().length === 0 || punto === this.puntoTraducido) return;
      this.puntoTraducido = punto;
      void this.elegirPorPunto(punto);
    });
    effect(() => {
      const elegido = this.value();
      const sigla = this.rama()?.sigla;
      const municipio = this.municipio();
      if (!this.ficha() || !this.isBrowser) return;
      if (elegido === null || sigla === undefined || municipio === null) return;
      if (this.provincias().has(elegido)) return;
      void this.deducirProvincia(elegido, sigla, municipio.ine, municipio.nombre);
    });
  }

  /**
   * El último punto GPS que ya se tradujo a municipio.
   *
   * El efecto reacciona al **punto**, no a la lista de ramas: si la persona
   * corrige el municipio a mano después de compartir su ubicación, que vuelva a
   * llegar el catálogo no le pisa la corrección.
   */
  private puntoTraducido: PuntoGeo | null | undefined = undefined;

  /** Si el último punto traducido no cayó dentro de ningún municipio. */
  protected readonly fueraDeMunicipio = signal(false);

  /**
   * El municipio que eligió el PUNTO, justo antes de elegirlo. Sirve para que
   * quien monta el selector distinga esa elección de una hecha a mano (el alta
   * no reemplaza la calle del punto por el nombre del municipio que el mismo
   * punto eligió).
   */
  readonly municipioPorPunto = output<string>();

  /**
   * Del punto GPS al municipio, sin salir a la red (pedido del cliente del
   * 26/10/2026: «cuando se dé click en la ubicación GPS, lo resalte en el
   * mapa»). Busca el contorno que contiene el punto y elige ese municipio —y
   * con él su departamento—; el mapa lo pinta y lo acerca. Si el punto cae
   * fuera de todo contorno conocido no se toca nada: no se adivina.
   */
  private async elegirPorPunto(punto: PuntoGeo): Promise<void> {
    const geometria = await import(
      '@shared/components/organisms/department-map/bolivia-municipalities.geometry'
    );
    if (this.punto() !== punto) return;
    const contorno = municipalityAt(
      geometria.CONTORNOS_DE_MUNICIPIOS,
      punto,
      geometria.PROYECCION_DE_BOLIVIA,
    );
    this.fueraDeMunicipio.set(contorno === null);
    if (contorno === null) return;
    for (const rama of this.ramas()) {
      if (rama.sigla !== contorno.sigla) continue;
      const municipio =
        rama.municipios.find((m) => m.ine === contorno.ine) ??
        rama.municipios.find(
          (m) => findOutline([contorno], rama.sigla, m.ine, m.nombre) !== null,
        );
      if (municipio !== undefined && municipio.conceptId !== this.value()) {
        this.departmentManual.set(rama.conceptId);
        this.municipioPorPunto.emit(municipio.conceptId);
        this.value.set(municipio.conceptId);
      }
      return;
    }
  }

  /**
   * La provincia del municipio, en este orden:
   *
   * 1. **El catálogo** (el código del INE la lleva adentro): sin red, al
   *    instante, y es el dato oficial. Cubre los 340 municipios.
   * 2. **El punto del mapa** dentro de las 112 provincias dibujadas, si hay
   *    punto (sólo para un municipio que el catálogo no conoce).
   * 3. **El punto interior del contorno** del municipio, como antes.
   *
   * Antes sólo existía el 3, y cuando el archivo de provincias no bajaba la
   * ficha decía «No disponible» aunque el municipio fuera Santa Cruz de la
   * Sierra.
   */
  private async deducirProvincia(
    conceptId: string,
    sigla: string,
    ine: string,
    nombre: string,
  ): Promise<void> {
    const delCatalogo = provinceFromCatalog(sigla, ine, nombre);
    if (delCatalogo !== null) {
      this.provincias.update((previas) => new Map(previas).set(conceptId, delCatalogo));
      return;
    }
    let provincia: string | null = null;
    try {
      const [geometria, provincias] = await Promise.all([
        import('@shared/components/organisms/department-map/bolivia-municipalities.geometry'),
        this.cargadorDeProvincias(),
      ]);
      const punto = this.punto();
      if (provincias !== null && punto !== null) {
        provincia = provinceIn(provincias, punto)?.properties.nombre ?? null;
      }
      if (provincia === null) {
        const contorno = findOutline(geometria.CONTORNOS_DE_MUNICIPIOS, sigla, ine, nombre);
        provincia = provinceOfMunicipality(provincias, contorno, geometria.PROYECCION_DE_BOLIVIA);
      }
    } catch {
      provincia = null;
    }
    this.provincias.update((previas) => new Map(previas).set(conceptId, provincia));
  }

  /** La rama (departamento) del municipio elegido, o `null`. */
  private readonly rama = computed<RamaDepartamento | null>(() => {
    const elegido = this.value();
    if (elegido === null) return null;
    return this.ramas().find((r) => r.municipios.some((m) => m.conceptId === elegido)) ?? null;
  });

  private readonly municipio = computed(() => {
    const elegido = this.value();
    return this.rama()?.municipios.find((m) => m.conceptId === elegido) ?? null;
  });

  /**
   * Lo que la ficha muestra: departamento y municipio salen del catálogo y la
   * provincia, del dibujo. `null` mientras no hay localidad.
   *
   * `provincia: undefined` no existe en el tipo: mientras se deduce, la ficha
   * muestra «Buscando…» (ver {@link provinciaPendiente}) y no un hueco.
   */
  protected readonly detalle = computed<LocalityDetail | null>(() => {
    const rama = this.rama();
    const municipio = this.municipio();
    if (rama === null || municipio === null) return null;
    return {
      departamento: rama.nombre,
      provincia: this.provincias().get(municipio.conceptId) ?? null,
      municipio: municipio.nombre,
    };
  });

  /** Si la provincia todavía se está deduciendo. */
  protected readonly provinciaPendiente = computed(() => {
    const elegido = this.value();
    return elegido !== null && this.detalle() !== null && !this.provincias().has(elegido);
  });

  /**
   * Cambia el departamento, y suelta el municipio que dejó de pertenecerle.
   *
   * Un select con un valor que no está entre sus opciones muestra un hueco que
   * miente: parece que no se eligió nada cuando en realidad hay un municipio de
   * otro departamento a punto de viajar.
   */
  protected chooseDepartment(conceptId: string | null): void {
    if (this.readonly()) return;
    this.departmentManual.set(conceptId);
    const municipio = this.value();
    if (municipio === null) return;
    const rama = this.ramas().find((r) => r.conceptId === conceptId);
    const sigue = rama?.municipios.some((m) => m.conceptId === municipio) ?? false;
    if (!sigue) this.value.set(null);
  }

  protected chooseMunicipality(conceptId: string | null): void {
    if (this.readonly()) return;
    this.value.set(conceptId);
  }
}
