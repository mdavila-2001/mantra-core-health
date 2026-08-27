import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { BIRTH_SEX_OPTIONS } from '../../../../core/data-access/iam/birth-sex.options';
import type { BirthSexCode } from '../../../../core/data-access/iam/iam.types';
import { ProfilesClient } from '../../../../core/data-access/profiles/profiles.client';
import type {
  OwnPatientProfile,
  OwnPatientProfileChanges,
} from '../../../../core/data-access/profiles/profiles.types';
import {
  BoMunicipalitiesCatalog,
  type RamaDepartamento,
} from '../../../../core/data-access/terminology/bo-municipalities.service';
import { BoOccupationsCatalog } from '../../../../core/data-access/terminology/bo-occupations.service';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { NavigationService } from '../../../../core/navigation/navigation.service';
import { loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Input } from '../../../../shared/components/atoms/input/input';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { Card } from '../../../../shared/components/molecules/card/card';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import {
  PhoneInput,
  telefonoCompleto,
} from '../../../../shared/components/molecules/phone-input/phone-input';
import {
  nacionalDelNumero,
  paisDelNumero,
} from '../../../../shared/components/molecules/phone-input/phone-input.paises';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { DatePicker } from '../../../../shared/components/organisms/date-picker/date-picker';
import { FormActions } from '../../../../shared/components/organisms/form-actions/form-actions';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { TreeSelect } from '../../../../shared/components/organisms/tree-select/tree-select';
import type { TreeSelectGroup } from '../../../../shared/components/organisms/tree-select/tree-select.types';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';

/** A dónde se vuelve al cancelar o al terminar. */
const MI_PERFIL = '/my-account';

/** El rótulo con el que se agrupan los avisos de esta pantalla. */
const AMBITO = 'Mi perfil';

/** Nadie nació antes de 1900 y sigue usando la plataforma. El mismo tope del alta. */
const NACIMIENTO_MAS_ANTIGUO = new Date(1900, 0, 1);

/**
 * La ayuda del campo de ocupación, **la misma palabra por palabra que el alta**.
 *
 * No es celo de copista: el editor corrige lo que el alta declaró, y dos textos
 * distintos para el mismo dato hacen dudar de si se trata del mismo campo.
 */
const HINT_OCUPACION = 'En qué trabajás. Ayuda a tu médico con los riesgos propios de cada oficio.';

/** Lo que se muestra cuando la ocupación guardada es texto de antes del catálogo. */
function hintDeOcupacionHeredada(texto: string): string {
  return `Registrada como «${texto}». Elegí una opción del catálogo para reemplazarla.`;
}

/** Los cambios mientras se arman: el contrato que sale es de solo lectura. */
type CambiosEnCurso = {
  -readonly [K in keyof OwnPatientProfileChanges]: OwnPatientProfileChanges[K];
};

/** Si dos fechas son el mismo día, mirando los componentes locales. */
function mismoDia(una: Date, otra: Date): boolean {
  return (
    una.getFullYear() === otra.getFullYear() &&
    una.getMonth() === otra.getMonth() &&
    una.getDate() === otra.getDate()
  );
}

/**
 * **Editar tus datos** — lo que la persona declaró de sí misma al registrarse.
 *
 * ## Por qué existe
 *
 * El auto-registro escribía nombre, nacimiento, teléfono y domicilio una sola
 * vez y no había forma de volver a tocarlos: quien tipeó mal su apellido,
 * cambió de número o se mudó quedaba con el dato viejo para siempre. «Mi
 * perfil» sólo lo mostraba.
 *
 * ## Por qué es una pantalla aparte
 *
 * Mismo criterio que el editor del profesional: «Mi perfil» es de **lectura**
 * —lo que hay, con su estado de verificación—, y editar es otra intención.
 * Mezclarlas con un booleano `editando` termina en un formulario dibujado
 * encima de una ficha.
 *
 * ## El nombre va en cuatro partes
 *
 * `displayName` lo **compone el backend** y no es separable: para corregir un
 * apellido materno hay que tener el apellido materno. Por eso esta pantalla lee
 * `GET /profiles/patients/me` y no el resumen.
 *
 * ## Qué no se edita acá
 *
 * Documento, correo, contraseña, género administrativo, código de paciente y
 * estados. No es una omisión de la pantalla: el backend tampoco los acepta en
 * este `PATCH`, porque cada uno tiene su propio circuito o lo decide el
 * sistema.
 */
@Component({
  selector: 'app-patient-profile-edit',
  imports: [
    AppButton,
    Card,
    DatePicker,
    FormActions,
    FormField,
    Input,
    PageHeader,
    PhoneInput,
    ReactiveFormsModule,
    Select,
    TreeSelect,
    ViewStateHost,
  ],
  templateUrl: './patient-profile-edit.html',
  styleUrl: './patient-profile-edit.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientProfileEdit {
  private readonly profiles = inject(ProfilesClient);
  private readonly municipios = inject(BoMunicipalitiesCatalog);
  private readonly ocupaciones = inject(BoOccupationsCatalog);
  private readonly toasts = inject(ToastService);
  private readonly navigation = inject(NavigationService);
  private readonly router = inject(Router);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  protected readonly perfil = signal<ViewState<OwnPatientProfile>>(loading());

  private readonly datos = computed(() => {
    const estado = this.perfil();
    return estado.status === 'ready' ? estado.data : null;
  });

  /* -- Un signal por campo, sembrado desde la respuesta -------------------- */

  protected readonly nombre = signal('');
  protected readonly segundoNombre = signal('');
  protected readonly apellidoPaterno = signal('');
  protected readonly apellidoMaterno = signal('');
  protected readonly fechaNacimiento = signal<Date | null>(null);
  protected readonly sexoAlNacer = signal<BirthSexCode | null>(null);

  /** La ocupación es un concepto de `VS_BO_OCCUPATION`, no un texto: ver `cargarOcupaciones`. */
  protected readonly ocupacionConceptId = signal<string | null>(null);

  protected readonly municipio = signal<string | null>(null);

  /**
   * El teléfono va en un control reactivo y no en una señal como el resto.
   *
   * No es una inconsistencia: `app-phone-input` es un `ControlValueAccessor`
   * —compone el prefijo del país con el número nacional— y sólo habla ese
   * idioma. El validador es el suyo, el mismo que usa el alta, porque el largo
   * del número lo sabe el país y eso vive dentro del campo.
   */
  protected readonly telefonoControl = new FormControl('', {
    nonNullable: true,
    validators: [telefonoCompleto],
  });

  /** Espejo del control, para el diff y para el resto de la pantalla. */
  protected readonly telefono = signal('');

  protected readonly guardando = signal(false);

  /* -- Catálogo de municipios ---------------------------------------------- */

  protected readonly arbolMunicipios = signal<readonly TreeSelectGroup<string>[]>([]);

  /** El catálogo no se pudo leer: se lo dice, no se deja un selector mudo. */
  protected readonly catalogoMunicipiosCaido = signal(false);

  /* -- Catálogo de ocupaciones --------------------------------------------- */

  protected readonly opcionesOcupacion = signal<readonly SelectOption<string>[]>([]);

  /** Ver `catalogoMunicipiosCaido`: mismo criterio y mismo aviso con reintento. */
  protected readonly catalogoOcupacionesCaido = signal(false);

  /**
   * La ayuda del campo de ocupación.
   *
   * Cuando el perfil trae texto libre y ningún concepto —lo escribió un alta
   * anterior al catálogo— la ayuda lo dice: si no, el desplegable aparecería
   * vacío y la persona leería que no declaró ocupación cuando sí lo hizo. El
   * texto heredado **reemplaza** a la ayuda de siempre en vez de sumarse: dos
   * párrafos debajo de un desplegable compiten entre sí.
   */
  protected readonly hintOcupacion = computed(() => {
    const heredada = this.ocupacionHeredada();
    return heredada === null ? HINT_OCUPACION : hintDeOcupacionHeredada(heredada);
  });

  /** El texto libre que sigue guardado porque nadie eligió un concepto todavía. */
  private readonly ocupacionHeredada = computed(() => {
    const perfil = this.datos();
    if (perfil === null || perfil.occupationConceptId !== undefined) {
      return null;
    }
    const texto = perfil.occupationFreeText?.trim() ?? '';
    return texto === '' ? null : texto;
  });

  /* -- Validación mínima, la misma que admite el backend ------------------- */

  protected readonly nombreVacio = computed(() => this.nombre().trim() === '');
  protected readonly apellidoVacio = computed(() => this.apellidoPaterno().trim() === '');

  /**
   * El teléfono sólo se valida cuando hay algo escrito: vaciarlo es quedarse
   * sin teléfono, y el backend lo admite explícitamente. Lo decide el validador
   * del propio campo —`telefonoCompleto`, que ya deja pasar la cadena vacía—,
   * así que acá sólo se espeja su veredicto en una señal para que la plantilla
   * y `puedeGuardar` reaccionen.
   */
  protected readonly telefonoMalEscrito = signal(false);

  protected readonly puedeGuardar = computed(
    () => !this.nombreVacio() && !this.apellidoVacio() && !this.telefonoMalEscrito(),
  );

  /* -- Constantes de la plantilla ------------------------------------------ */

  protected readonly opcionesSexoAlNacer = BIRTH_SEX_OPTIONS;
  protected readonly nacimientoMasAntiguo = NACIMIENTO_MAS_ANTIGUO;

  constructor() {
    // El control es la fuente del teléfono; la señal es su espejo. Se suscribe
    // antes de cargar para que la siembra y lo que se teclee después pasen por
    // el mismo sitio.
    this.telefonoControl.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((valor) => this.espejarTelefono(valor));

    this.cargar();
    this.cargarMunicipios();
    this.cargarOcupaciones();
  }

  /** Lleva a las señales lo que el control tiene y lo que su validador dice. */
  private espejarTelefono(valor: string): void {
    this.telefono.set(valor);
    this.telefonoMalEscrito.set(this.telefonoControl.invalid);
  }

  protected recargar(): void {
    this.cargar();
  }

  private cargar(): void {
    this.perfil.set(loading());
    this.profiles.getOwnPatientProfile().subscribe({
      next: (perfil) => {
        this.sembrarFormulario(perfil);
        this.perfil.set(ready(perfil));
      },
      error: (error: unknown) => this.perfil.set(errorToViewState<OwnPatientProfile>(error)),
    });
  }

  /**
   * Llena el formulario con lo que ya hay guardado.
   *
   * Sólo al cargar y al guardar, nunca en un `computed`: sembrar en cada cambio
   * del perfil borraría lo que la persona acaba de teclear si la pantalla
   * revalida mientras escribe.
   */
  private sembrarFormulario(perfil: OwnPatientProfile): void {
    this.nombre.set(perfil.name ?? '');
    this.segundoNombre.set(perfil.middleName ?? '');
    this.apellidoPaterno.set(perfil.lastName ?? '');
    this.apellidoMaterno.set(perfil.motherLastName ?? '');
    this.fechaNacimiento.set(perfil.birthDate ?? null);
    this.sexoAlNacer.set(perfil.sexAtBirth ?? null);
    this.ocupacionConceptId.set(perfil.occupationConceptId ?? null);
    this.municipio.set(perfil.residenceMunicipalityConceptId ?? null);

    // Sin `emitEvent`: sembrar no es teclear, y el control ya queda validado.
    // El espejo se actualiza a mano, que es lo que ese evento haría. Se siembra
    // la forma canónica y no el dato crudo: ver `telefonoCanonico`.
    const telefono = telefonoCanonico(perfil.phone);
    this.telefonoControl.setValue(telefono, { emitEvent: false });
    this.espejarTelefono(telefono);
  }

  /**
   * Trae el árbol de municipios, para «dónde vivís».
   *
   * Un fallo no rompe la pantalla: el domicilio es un campo opcional y el resto
   * de los datos se sigue pudiendo corregir. El bloque dice qué pasó y ofrece
   * reintentar, que es lo que el alta ya hacía.
   */
  protected cargarMunicipios(): void {
    this.municipios.listar().subscribe({
      next: (ramas) => {
        this.catalogoMunicipiosCaido.set(false);
        this.arbolMunicipios.set(ramas.map((rama) => this.aGrupo(rama)));
      },
      error: () => {
        this.arbolMunicipios.set([]);
        this.catalogoMunicipiosCaido.set(true);
      },
    });
  }

  /**
   * Reintenta la lectura del catálogo.
   *
   * Olvida lo cacheado antes de pedir: la lectura se comparte con
   * `shareReplay`, que guarda también el error, así que sin esto «Reintentar»
   * repetiría el mismo fallo sin llegar a tocar la red.
   */
  protected reintentarMunicipios(): void {
    this.municipios.olvidar();
    this.cargarMunicipios();
  }

  /**
   * Trae el catálogo de ocupaciones, para «¿en qué trabajás?».
   *
   * Mismo criterio que los municipios ante un fallo: el campo es opcional, así
   * que la pantalla sigue en pie y el bloque dice qué pasó con su «Reintentar».
   *
   * Bajo SSR el catálogo devuelve la lista vacía sin tocar la red —no hay API a
   * la que preguntar durante el prerender— y eso **no es un fallo**: el
   * desplegable se dibuja con su marcador y se llena al hidratar.
   */
  protected cargarOcupaciones(): void {
    this.ocupaciones.listar().subscribe({
      next: (opciones) => {
        this.catalogoOcupacionesCaido.set(false);
        this.opcionesOcupacion.set(
          opciones.map((opcion) => ({ value: opcion.conceptId, label: opcion.display })),
        );
      },
      error: () => {
        this.opcionesOcupacion.set([]);
        this.catalogoOcupacionesCaido.set(true);
      },
    });
  }

  /** Reintenta la lectura del catálogo de ocupaciones. Ver `reintentarMunicipios`. */
  protected reintentarOcupaciones(): void {
    this.ocupaciones.olvidar();
    this.cargarOcupaciones();
  }

  private aGrupo(rama: RamaDepartamento): TreeSelectGroup<string> {
    return {
      label: rama.nombre,
      items: rama.municipios.map((municipio) => ({
        value: municipio.conceptId,
        label: municipio.nombre,
      })),
    };
  }

  /**
   * Guarda lo que cambió.
   *
   * Sólo viaja el cambio, campo por campo contra lo que se cargó: mandar todo
   * siempre funcionaría —es un `PATCH` idempotente— pero entonces el registro
   * de auditoría del backend diría que la persona reescribió su ficha entera
   * cada vez que corrigió una letra.
   */
  protected guardar(): void {
    const original = this.datos();
    if (original === null || this.guardando() || !this.puedeGuardar()) {
      return;
    }

    const cambios = this.cambiosContra(original);
    if (Object.keys(cambios).length === 0) {
      this.toasts.info('No había ningún cambio para guardar.', AMBITO);
      return;
    }

    this.guardando.set(true);
    this.profiles.updateOwnPatientProfile(cambios).subscribe({
      next: (perfil) => {
        this.guardando.set(false);
        this.sembrarFormulario(perfil);
        this.perfil.set(ready(perfil));
        this.toasts.success('Tus datos quedaron actualizados.', AMBITO);
      },
      error: () => {
        this.guardando.set(false);
        this.toasts.error('No pudimos guardar los cambios. Probá de nuevo.', AMBITO);
      },
    });
  }

  protected cancelar(): void {
    void this.router.navigate([MI_PERFIL]);
  }

  /**
   * El cambio de cada campo respecto de lo cargado.
   *
   * **Vaciar un texto es un cambio, no un campo sin tocar.** El segundo nombre
   * y el apellido materno se vacían cuando la persona descubre que no lleva
   * ninguno, el teléfono cuando deja de tenerlo y la ocupación cuando vuelve a
   * «Sin especificar»: el backend los borra con `''` y lo declara en su
   * contrato.
   *
   * TODO(API): la fecha de nacimiento, el sexo al nacer y el municipio **no se
   * pueden borrar**. Sus validadores son `@IsISO8601`, `@IsIn` y `@IsUUID`, y
   * ninguno admite la cadena vacía: un valor declarado se puede cambiar por
   * otro, no quitar. Mientras siga así, dejarlos en blanco no manda nada en vez
   * de provocar un `400` que la persona leería como un fallo del producto.
   */
  private cambiosContra(original: OwnPatientProfile): OwnPatientProfileChanges {
    const cambios: CambiosEnCurso = {};

    const nombre = textoCambiado(this.nombre(), original.name);
    if (nombre !== undefined) {
      cambios.name = nombre;
    }
    const segundoNombre = textoCambiado(this.segundoNombre(), original.middleName);
    if (segundoNombre !== undefined) {
      cambios.middleName = segundoNombre;
    }
    const apellidoPaterno = textoCambiado(this.apellidoPaterno(), original.lastName);
    if (apellidoPaterno !== undefined) {
      cambios.lastName = apellidoPaterno;
    }
    const apellidoMaterno = textoCambiado(this.apellidoMaterno(), original.motherLastName);
    if (apellidoMaterno !== undefined) {
      cambios.motherLastName = apellidoMaterno;
    }
    // Se compara contra la forma canónica de lo guardado, no contra el dato
    // crudo: si no, un teléfono heredado en otro formato viajaría «cambiado»
    // sin que nadie lo tocara. Ver `telefonoCanonico`.
    const telefono = textoCambiado(this.telefono(), telefonoCanonico(original.phone));
    if (telefono !== undefined) {
      cambios.phone = telefono;
    }

    const fecha = this.fechaNacimiento();
    const fechaGuardada = original.birthDate;
    if (fecha !== null && (fechaGuardada === undefined || !mismoDia(fecha, fechaGuardada))) {
      cambios.birthDate = fecha;
    }

    const sexo = this.sexoAlNacer();
    if (sexo !== null && sexo !== original.sexAtBirth) {
      cambios.sexAtBirth = sexo;
    }

    const municipio = this.municipio();
    if (municipio !== null && municipio !== original.residenceMunicipalityConceptId) {
      cambios.residenceMunicipalityConceptId = municipio;
    }

    // La ocupación **sí se puede borrar**: es el único concepto de esta pantalla
    // cuyo validador admite la cadena vacía, así que volver a «Sin especificar»
    // la vacía en vez de no mandar nada. El texto libre de las altas viejas no
    // viaja: quien no toca el desplegable lo conserva tal cual.
    const ocupacion = this.ocupacionConceptId();
    if (ocupacion !== (original.occupationConceptId ?? null)) {
      cambios.occupationConceptId = ocupacion ?? '';
    }

    return cambios;
  }
}

/**
 * Un teléfono guardado, en la forma que `app-phone-input` compone.
 *
 * ## Qué problema resuelve
 *
 * En la base conviven al menos tres formas del mismo número, porque el
 * `@Matches` del backend las acepta todas y el alta anterior a este campo dejaba
 * escribir a mano: `+591 70012345` (la que compone el campo hoy),
 * `+591 700 22222` y `70012345` a secas. El campo las pinta todas igual —deriva
 * el país y el número nacional— pero `telefonoCompleto` sólo acepta la primera,
 * así que sembrar el control con el dato crudo dejaba el editor **abierto en
 * inválido**: mensaje de número incompleto, `aria-invalid` y «Guardar cambios»
 * deshabilitado, con lo cual no se podía corregir ni el nombre. Observado con
 * un perfil cuyo teléfono estaba guardado como `70012345`.
 *
 * Sembrar la forma canónica hace que el control tenga **exactamente el valor que
 * la persona ve**, que es la única manera de que su validez signifique algo.
 *
 * ## Lo que no hace
 *
 * No normaliza el dato guardado por su cuenta: un teléfono heredado que nadie
 * toca **no viaja** en el `PATCH` (ver `cambiosContra`). Reescribirlo en
 * silencio cerraría el contacto vigente y abriría otro sin que la persona
 * hiciera nada, que es una decisión suya y no de una pantalla que se abrió.
 *
 * El precio: un número heredado con más dígitos de los que su país admite se ve
 * recortado en el campo, igual que se vería al teclearlo. Sigue guardado entero
 * mientras no se toque, y se pierde sólo si la persona escribe encima — que es
 * cuando decidió cambiarlo.
 *
 * @param guardado - El teléfono tal como vino de la API.
 * @returns `''` si no hay dígitos; si no, `+<prefijo> <número nacional>`.
 */
function telefonoCanonico(guardado: string | undefined): string {
  const crudo = guardado ?? '';
  if (!/[0-9]/.test(crudo)) {
    return '';
  }
  const pais = paisDelNumero(crudo);
  return `${pais.prefijo} ${nacionalDelNumero(crudo, pais)}`;
}

/**
 * El valor a mandar de un campo de texto, o `undefined` si no cambió.
 *
 * Devuelve `''` cuando la persona lo vació teniendo algo: es el cambio que
 * borra el dato, y confundirlo con «no lo tocó» dejaría el apellido materno de
 * quien no lleva ninguno pegado para siempre.
 */
function textoCambiado(actual: string, guardado: string | undefined): string | undefined {
  const limpio = actual.trim();
  return limpio === (guardado ?? '') ? undefined : limpio;
}
