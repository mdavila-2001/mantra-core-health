import { DatePipe, DecimalPipe, NgTemplateOutlet, UpperCasePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  type OnInit,
  output,
  signal,
} from '@angular/core';

import { PracticeSitesClient } from '../../../../core/data-access/practice-sites/practice-sites.client';
import type {
  NewOwnSite,
  PracticeSite,
} from '../../../../core/data-access/practice-sites/practice-sites.types';
import { ProfilesClient } from '../../../../core/data-access/profiles/profiles.client';
import type {
  LinkableOrganization,
  PractitionerAffiliation,
} from '../../../../core/data-access/profiles/profiles.types';
import { BoMunicipalitiesCatalog } from '../../../../core/data-access/terminology/bo-municipalities.service';
import type { RamaDepartamento } from '../../../../core/data-access/terminology/bo-municipalities.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { LocationPicker } from '../../../auth/registro-compartido/location-picker/location-picker';
import { SiteBankQrDialog } from './site-bank-qr-dialog/site-bank-qr-dialog';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Card } from '../../../../shared/components/molecules/card/card';
import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { Input } from '../../../../shared/components/atoms/input/input';
import { ReferenceCombobox } from '../../../../shared/components/molecules/reference-combobox/reference-combobox';
import { RowActions } from '../../../../shared/components/molecules/row-actions/row-actions';
import type { RowAction } from '../../../../shared/components/molecules/row-actions/row-actions.types';
import type { ReferenceOption } from '../../../../shared/components/molecules/reference-combobox/reference-combobox.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { DatePicker } from '../../../../shared/components/organisms/date-picker/date-picker';
import { FormActions } from '../../../../shared/components/organisms/form-actions/form-actions';
import { AppMap } from '../../../../shared/components/organisms/map/map';
import { ContentDialog } from '../../../../shared/components/organisms/content-dialog/content-dialog';
import type { PinMapa, PuntoGeo } from '../../../../shared/components/organisms/map/pin-mapa.types';

/**
 * **Historial laboral** del profesional — punto 9 del reclamo del cliente —
 * y, desde ALV-005, **dónde atiende hoy**.
 *
 * ## Lo que el perfil no sabía decir
 *
 * El perfil ya mostraba dónde se **formó** alguien (credenciales), qué puede
 * **ejercer** (matrículas) y en qué (especialidades). No tenía **dónde
 * trabajó**, que es lo que el cliente pidió con esas palabras: «hospitales o
 * entidades médicas». No era un campo escondido: no existía ni la tabla.
 *
 * ## La institución se elige del padrón, y si no está, se escribe
 *
 * Durante un tiempo esto fue sólo un campo de texto, con un motivo correcto: el
 * único selector posible eran las organizaciones de la plataforma, y obligar a
 * darlas de alta para poder mencionarlas convertía un dato de currículum en un
 * trámite.
 *
 * El padrón oficial cambia esa premisa. Son 523 establecimientos reales de
 * Santa Cruz —las siete cajas de la seguridad social incluidas— que existen
 * como catálogo **sin ser organizaciones registradas**: elegir uno no da de
 * alta nada. Y elegir en vez de escribir es lo que evita que «CLINICA
 * FOIANINI», «Clínica Ángel Foianini» y «Centro Médico Foianini» sean tres
 * instituciones distintas para el sistema.
 *
 * El texto libre **sigue existiendo**, porque el padrón cubre sólo Santa Cruz y
 * quien trabajó en La Paz no va a encontrarse ahí. Pero es la salida declarada,
 * no el camino por defecto: hay que pedirla.
 *
 * ## El cargo es opcional (ALV-007) y «Servicio o área» ya no existe (ALV-008)
 *
 * Un vínculo de «atiendo en mi propio consultorio» no tiene un cargo dentro de
 * una jerarquía, y exigirlo bloqueaba el guardado. Si viene, se muestra; si
 * no, no dibuja hueco. El área se retiró del formulario y del contrato: la
 * columna sigue en la base hasta que se decida su migración, pero ninguna
 * pantalla la ofrece.
 *
 * ## Dónde atiendo (ALV-005/006)
 *
 * El alta de profesional dejaba un hueco concreto: «atiendo en mi propio
 * consultorio, sin estar afiliado a nadie» no tenía dónde registrarse. Acá el
 * profesional carga sus consultorios propios —nombre, dirección, municipio y,
 * si quiere, el punto en el mapa— y los retira cuando deja de atender ahí.
 * Es la mitad que le faltaba a la agenda: sabía *cuándo* atiende, no *dónde*.
 *
 * ## «Sigue ahí» se dice dejando la fecha vacía
 *
 * Sin fin, el vínculo es vigente. No hay casilla de «actual» porque sería un
 * segundo lugar donde decir lo mismo, y el día que discreparan —fecha de fin
 * cargada y casilla marcada— no habría forma de saber cuál manda.
 *
 * ## Un `403` acá no es un muro, es que la pregunta no aplica
 *
 * `GET /profiles/practitioners/me/affiliations` responde `403` a una cuenta sin
 * perfil profesional. No es un fallo: es que esta persona no es profesional. El
 * bloque se esconde entero en vez de pintar un error rojo en el perfil de un
 * paciente.
 */
@Component({
  selector: 'app-work-history',
  imports: [
    Alert,
    AppButton,
    AppMap,
    Badge,
    Card,
    ContentDialog,
    DatePicker,
    DatePipe,
    DecimalPipe,
    FormActions,
    FormField,
    Input,
    LocationPicker,
    NgTemplateOutlet,
    ReferenceCombobox,
    RowActions,
    Select,
    SiteBankQrDialog,
    UpperCasePipe,
  ],
  templateUrl: './work-history.html',
  styleUrl: './work-history.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkHistory implements OnInit {
  private readonly profiles = inject(ProfilesClient);
  private readonly sites = inject(PracticeSitesClient);
  private readonly municipios = inject(BoMunicipalitiesCatalog);
  private readonly auth = inject(AuthService);
  private readonly toasts = inject(ToastService);
  private readonly dialogs = inject(DialogService);

  /**
   * `'flat'` (por defecto): la lista propia, tal como vive hoy al pie de «Mi
   * perfil». `'timeline'`: la pestaña Trayectoria del perfil ya pinta el
   * mismo historial como línea de tiempo por fases — acá se suprime el
   * listado propio y sólo queda el formulario de alta, para no mostrar el
   * mismo dato dos veces con dos formas distintas.
   */
  readonly layout = input<'flat' | 'timeline'>('flat');

  /**
   * Qué bloques se dibujan: los dos, sólo «Dónde atiendo» o sólo el historial.
   *
   * Es otro eje que `layout`, no otro valor suyo: `layout` dice **cómo** se
   * pinta el historial y esto dice **cuál** de los dos bloques se pinta.
   *
   * Era un `soloConsultorios` booleano. Pasó a tres valores el 13/09/2026,
   * cuando el cliente pidió que «Dónde atiendo» **saliera de Trayectoria**: hizo
   * falta el caso inverso —el historial sin los consultorios— y dos booleanos
   * excluyentes es justo el interruptor que la casa no escribe.
   *
   * Quién usa cada uno:
   *
   * - `'consultorios'` — «Mis organizaciones» (`administration/my-practice`),
   *   la pestaña «Dónde atiendo» del editor del perfil y, desde el
   *   20/09/2026, la pestaña «Dónde atiendo» de la **ficha** (C-02: el
   *   consultorio se administra dentro del perfil y el enlace suelto a
   *   «Mis organizaciones» se retiró). No se copió el formulario a ninguna de
   *   las tres: crear, ubicar en el mapa y retirar un consultorio vive acá
   *   —con su catálogo de municipios, su confirmación y sus pruebas— y
   *   tenerlo tres veces garantiza que el arreglo de una no llegue a las
   *   otras.
   * - `'historial'` — la pestaña «Trayectoria» de la ficha del médico.
   * - `'ambas'` — nadie hoy; queda como el valor neutro del componente.
   */
  readonly secciones = input<'ambas' | 'consultorios' | 'historial'>('ambas');

  /** Si toca dibujar el bloque «Dónde atiendo». */
  protected readonly muestraConsultorios = computed(() => this.secciones() !== 'historial');

  /** Si toca dibujar el historial laboral. */
  protected readonly muestraHistorial = computed(() => this.secciones() !== 'consultorios');

  /**
   * Si lo único que este bloque dibuja es el botón que abre el alta.
   *
   * Pasa en la pestaña «Trayectoria» de la ficha: la línea de tiempo la pinta
   * la ficha y los consultorios viven en otra pestaña, así que acá no queda
   * más que la puerta. Sin esto, el botón aparecía solo dentro de una tarjeta
   * del alto de media pantalla.
   */
  protected readonly soloElAltaDeVinculo = computed(
    () => this.secciones() === 'historial' && this.layout() === 'timeline',
  );

  /** Se emite tras un alta exitosa, para que quien embebe el formulario recargue lo que ya tenía leído. */
  readonly added = output<void>();

  /**
   * Si esta cuenta tiene perfil profesional.
   *
   * `null` mientras se pregunta. Sale del claim de la sesión y no de la
   * respuesta del backend porque decide si el bloque **se dibuja**: preguntarlo
   * a la API significaría pintar y despintar una sección del perfil.
   */
  protected readonly esProfesional = computed(
    () => this.auth.practitionerProfileId() !== null,
  );

  protected readonly historial = signal<ViewState<readonly PractitionerAffiliation[]>>(
    loading(),
  );

  protected readonly afiliaciones = computed<readonly PractitionerAffiliation[]>(() => {
    const state = this.historial();
    return state.status === 'ready' ? state.data : [];
  });

  /**
   * Los consultorios donde atiende hoy.
   *
   * Sirven para dos cosas: la lista «Dónde atiendo» (ALV-005) y atar una
   * afiliación a una sede real cuando corresponde. Si la lectura falla, la
   * lista queda vacía y el campo simplemente no se ofrece.
   */
  protected readonly sedes = signal<readonly PracticeSite[]>([]);

  /**
   * Las mismas sedes como opciones del desplegable.
   *
   * La dirección va en MAYÚSCULAS también acá (ALV-010): es la misma regla de
   * render que la lista de arriba, y un mismo dato con dos formas en la misma
   * tarjeta se leería como dos direcciones.
   */
  protected readonly opcionesDeSede = computed<readonly SelectOption<string>[]>(() =>
    this.sedes().map((sede) => ({
      value: sede.id,
      label:
        sede.addressText === null
          ? sede.name
          : `${sede.name} · ${sede.addressText.toLocaleUpperCase('es-BO')}`,
    })),
  );

  /* -- El formulario de vínculos ------------------------------------------ */

  /**
   * Cómo se está nombrando la institución.
   *
   * `'padron'` es el camino normal: se elige de los 523 establecimientos
   * reales. `'libre'` es la salida para lo que el padrón no cubre —cualquier
   * cosa fuera de Santa Cruz—, y hay que pedirla explícitamente: si estuviera
   * disponible de entrada nadie usaría el catálogo, y volveríamos a tener el
   * mismo hospital escrito de cinco formas.
   */
  protected readonly modoDeInstitucion = signal<'padron' | 'libre'>('padron');

  /** El establecimiento elegido del padrón, con su nombre canónico. */
  protected readonly establecimiento = signal<ReferenceOption | null>(null);

  /** Resultados de la última búsqueda en el padrón. */
  protected readonly resultados = signal<readonly ReferenceOption[]>([]);

  protected readonly buscandoEnPadron = signal(false);

  protected readonly institucion = signal('');
  protected readonly cargo = signal('');
  protected readonly desde = signal<Date | null>(null);
  protected readonly hasta = signal<Date | null>(null);
  protected readonly sede = signal<string | null>(null);

  protected readonly registrando = signal(false);

  /**
   * Si el alta de un vínculo está abierta **como modal**.
   *
   * El formulario vivía desplegado al pie de «Trayectoria»: ocho campos
   * siempre visibles debajo de la línea de tiempo, de modo que la pestaña que
   * contesta «qué hiciste» se leía como un formulario de carga con un resumen
   * arriba. El cliente lo pidió al revés el 19/09/2026 —primero el botón,
   * después el formulario— y es lo correcto: cargar un vínculo es una
   * operación puntual, no el contenido de la pantalla.
   *
   * El modal es {@link ContentDialog} y no un panel plegable: la trampa de
   * foco, el `Escape` y la inertización de lo que queda atrás ya están
   * resueltos ahí por el `<dialog>` nativo.
   */
  protected readonly altaDeVinculoAbierta = signal(false);

  /** El resultado de la última escritura. */
  protected readonly registro = signal<ViewState<null>>(ready(null));

  /**
   * Si el período está invertido.
   *
   * Se comprueba acá y no sólo en el backend porque es lo único que quien
   * escribe puede ver mientras lo escribe: mandar el formulario para que el
   * servidor conteste que las fechas están al revés es hacerle pagar una vuelta
   * completa por un error que ya estaba en pantalla.
   */
  protected readonly periodoInvertido = computed(() => {
    const desde = this.desde();
    const hasta = this.hasta();
    return desde !== null && hasta !== null && hasta < desde;
  });

  /**
   * El nombre que se va a guardar, venga de donde venga.
   *
   * Del padrón sale el nombre canónico —el del listado oficial—, que es todo el
   * punto de haber elegido en vez de escrito.
   */
  protected readonly nombreDeLaInstitucion = computed(() =>
    this.modoDeInstitucion() === 'padron'
      ? (this.establecimiento()?.label ?? '')
      : this.institucion().trim(),
  );

  // ALV-007: el cargo dejó de ser condición para poder registrar.
  protected readonly puedeRegistrar = computed(
    () =>
      this.nombreDeLaInstitucion() !== '' &&
      this.desde() !== null &&
      !this.periodoInvertido() &&
      !this.registrando(),
  );

  /**
   * El aviso del duplicado, en palabras.
   *
   * Separado del error porque **no es un error**: el `409` es el historial
   * negándose a decir dos veces lo mismo. Volver a un hospital años después es
   * cierto y se registra; lo que se rechaza es el doble envío, que se reconoce
   * porque empieza el mismo día.
   */
  protected readonly avisoDeDuplicado = computed<string | null>(() => {
    const state = this.registro();
    if (
      state.status === 'validation' &&
      state.issues.some((issue) => issue.code === 'CONFLICT')
    ) {
      return 'Ese vínculo ya está en tu historial: misma institución, mismo cargo y misma fecha de inicio.';
    }
    return null;
  });

  /** El fallo de la escritura, en palabras. */
  protected readonly errorDelRegistro = computed<string | null>(() => {
    if (this.avisoDeDuplicado() !== null) {
      return null;
    }
    return mensajeDe(this.registro());
  });

  /* -- El formulario de sedes (ALV-005/006) -------------------------------- */

  /** Si el formulario de consultorio propio está desplegado. */
  protected readonly altaDeSedeAbierta = signal(false);

  protected readonly nombreDeSedeNueva = signal('');
  protected readonly direccionDeSede = signal('');
  protected readonly ciudadDeSede = signal('');
  /** Municipio elegido en el mapa de Bolivia (concept id), o `null`. */
  protected readonly municipioDeSede = signal<string | null>(null);
  /** El punto marcado en el mapa, si se marcó. */
  protected readonly puntoDeSede = signal<PuntoGeo | null>(null);
  /** Si el mapa para marcar el punto está desplegado. Cerrado por defecto: es opcional. */
  protected readonly mapaAbierto = signal(false);

  /** El árbol de departamentos y municipios, cuando el formulario lo pidió. */
  protected readonly ramasMunicipios = signal<readonly RamaDepartamento[]>([]);
  protected readonly catalogoMunicipiosCaido = signal(false);

  /* ---- Atiendo en uno que ya existe --------------------------------------

     Crear un consultorio propio y declarar que atendés en la Clínica Foianini
     NO son la misma operación, y hasta hoy la pantalla ofrecía una sola puerta:
     «Agregar un consultorio propio», que crea una práctica **tuya**. Quien
     atiende en un hospital terminaba creándose un consultorio con el nombre del
     hospital.

     El buscador es el mismo padrón oficial de salud que el formulario del
     historial ya usa (`searchLinkableOrganizations`), con sus propias señales:
     los dos bloques pueden estar en pantalla a la vez y compartir señal los
     haría pelearse por lo tecleado.

     Elegir uno registra un vínculo **en curso** —`addAffiliation` sin fecha de
     fin—, que es lo que la ficha lee como «dónde ejerce hoy». No se inventa un
     estado de aprobación: el vínculo queda **declarado por vos**, que es
     exactamente lo que `avisoDelVinculo` ya sabe contar. */

  /** Lo que devolvió el padrón para este buscador. */
  protected readonly lugaresDelPadron = signal<readonly ReferenceOption[]>([]);
  protected readonly buscandoLugar = signal(false);
  protected readonly lugarElegido = signal<ReferenceOption | null>(null);
  protected readonly vinculandoLugar = signal(false);

  protected readonly registrandoSede = signal(false);
  protected readonly registroDeSede = signal<ViewState<null>>(ready(null));
  protected readonly errorDeSede = computed<string | null>(() => mensajeDe(this.registroDeSede()));

  /** El punto marcado, como el único pin del mapa. */
  protected readonly pinesDeSede = computed<readonly PinMapa[]>(() => {
    const punto = this.puntoDeSede();
    if (punto === null) {
      return [];
    }
    return [
      {
        id: 'sede-nueva',
        lat: punto.lat,
        lng: punto.lng,
        titulo: this.nombreDeSedeNueva().trim() || 'Consultorio',
      },
    ];
  });

  /**
   * El departamento del municipio elegido, para que la dirección lo lleve.
   *
   * El picker devuelve sólo el municipio; el departamento se deduce del árbol
   * que ya está cargado, sin otra petición.
   */
  protected readonly departamentoDeSede = computed<string | null>(() => {
    const municipio = this.municipioDeSede();
    if (municipio === null) {
      return null;
    }
    const rama = this.ramasMunicipios().find((r) =>
      r.municipios.some((m) => m.conceptId === municipio),
    );
    return rama?.conceptId ?? null;
  });

  /**
   * El consultorio propio, si ya tiene uno. **Hay uno solo.**
   *
   * No es una regla de pantalla: es lo que el backend modela. `POST
   * /practitioners/me/sites` crea —o **reutiliza**— la práctica personal del
   * profesional, así que la práctica propia es una sola por persona. Lo que
   * faltaba era decirlo en la interfaz: el botón «Agregar un consultorio
   * propio» seguía ahí después de crear el primero, invitando a cargar el
   * segundo.
   *
   * `isOwnSite` lo manda la API desde el cierre del P32-a. Si llegara ausente
   * —un frontend desplegado contra una API anterior— todo se lee como ajeno y
   * el botón de alta sigue disponible: la degradación prudente nunca esconde
   * un camino.
   */
  protected readonly consultorioPropio = computed<PracticeSite | null>(
    () => this.sedes().find((sede) => sede.isOwnSite === true) ?? null,
  );

  /**
   * La sede que se está corrigiendo, o `null` si el formulario da de alta una.
   *
   * Un solo formulario para las dos cosas y no dos: los campos son los mismos
   * —nombre, calle, ciudad, municipio y punto— y duplicarlo garantizaría que
   * el arreglo de uno no llegue al otro.
   */
  protected readonly sedeEnEdicion = signal<PracticeSite | null>(null);

  /** La sede cuyo QR bancario está abierto, o `null` si no hay ninguno. */
  protected readonly sedeConQrAbiertoId = signal<string | null>(null);

  /**
   * La sede del modal de QR, releída de la lista.
   *
   * Se resuelve por id contra `sedes()` y no se guarda la sede entera para que
   * el modal vea el `bankQrFileId` recién guardado sin que haya que pasárselo
   * a mano.
   */
  protected readonly sedeConQrAbierto = computed<PracticeSite | null>(() => {
    const id = this.sedeConQrAbiertoId();
    return id === null ? null : (this.sedes().find((s) => s.id === id) ?? null);
  });

  protected readonly puedeRegistrarSede = computed(
    () => this.nombreDeSedeNueva().trim() !== '' && !this.registrandoSede(),
  );

  /**
   * Las dos lecturas del bloque.
   *
   * En `ngOnInit` y no en el constructor porque **una de las dos depende de un
   * input**: montado como «sólo el historial» —la pestaña Trayectoria— los
   * consultorios no se dibujan y pedirlos es una petición por visita a una
   * pantalla que no los usa. En el constructor `secciones` todavía vale su
   * valor por omisión, así que la pregunta se haría siempre. Lo destapó su
   * propia prueba.
   */
  ngOnInit(): void {
    if (this.esProfesional()) {
      this.cargar();
      this.cargarSedes();
    } else {
      // No hay historial que pedir, y dejarlo en `loading()` haría girar un
      // esqueleto para siempre en el perfil de un paciente.
      this.historial.set(ready([]));
    }
  }

  protected recargar(): void {
    this.cargar();
  }

  /**
   * Registra un vínculo laboral (UC-05-16).
   *
   * Sin confirmación previa: agregar una línea al propio currículum no cierra
   * ni sella nada. Después se relee, porque la lista sale del servidor y no de
   * lo que acabamos de escribir.
   */
  /**
   * Abre el alta de un vínculo, en limpio.
   *
   * Se limpia al ABRIR y no al cerrar: quien cerró sin querer y vuelve a
   * entrar esperaría encontrar lo que estaba escribiendo sólo si el cierre fue
   * accidental, y no hay forma de distinguirlo. Limpiar acá deja una sola
   * regla —el modal siempre empieza vacío— en vez de dos que se contradicen.
   */
  protected abrirAltaDeVinculo(): void {
    this.limpiar();
    this.registro.set(ready(null));
    this.altaDeVinculoAbierta.set(true);
  }

  /** Cierra el alta de un vínculo sin guardar nada. */
  protected cerrarAltaDeVinculo(): void {
    this.altaDeVinculoAbierta.set(false);
  }

  protected registrar(): void {
    const desde = this.desde();
    if (!this.puedeRegistrar() || desde === null) {
      return;
    }

    const hasta = this.hasta();
    const cargo = this.cargo().trim();
    const sede = this.sede();

    this.registrando.set(true);
    this.registro.set(loading());

    this.profiles
      .addAffiliation({
        organizationName: this.nombreDeLaInstitucion(),
        startDate: soloFecha(desde),
        // Los opcionales sin valor se **omiten**: el backend valida con
        // `forbidNonWhitelisted`, y una clave vacía no es «sin especificar».
        ...(cargo === '' ? {} : { roleTitle: cargo }),
        ...(hasta === null ? {} : { endDate: soloFecha(hasta) }),
        ...(sede === null || sede === '' ? {} : { practiceSiteId: sede }),
      })
      .subscribe({
        next: () => {
          this.registrando.set(false);
          this.registro.set(ready(null));
          this.limpiar();
          this.altaDeVinculoAbierta.set(false);
          this.toasts.success('Quedó en tu historial laboral.', 'Vínculo registrado');
          this.cargar();
          this.added.emit();
        },
        error: (error: unknown) => {
          this.registrando.set(false);
          this.registro.set(errorToViewState<null>(error));
        },
      });
  }

  /**
   * Busca en el padrón lo que el profesional está escribiendo.
   *
   * La molécula ya espera antes de emitir, así que acá no se vuelve a esperar.
   * Un fallo deja la lista vacía y no se muestra: el camino de texto libre
   * sigue disponible, y pintar un error rojo sobre un buscador opcional sería
   * anunciar una avería donde hay una alternativa.
   *
   * @param texto - Lo que se escribió en el campo.
   */
  protected buscarEnPadron(texto: string): void {
    if (texto.trim() === '') {
      this.resultados.set([]);
      return;
    }

    this.buscandoEnPadron.set(true);
    this.profiles.searchLinkableOrganizations(texto).subscribe({
      next: (pagina) => {
        this.buscandoEnPadron.set(false);
        this.resultados.set(pagina.items.map(comoOpcion));
      },
      error: () => {
        this.buscandoEnPadron.set(false);
        this.resultados.set([]);
      },
    });
  }

  /**
   * Pasa a escribir el nombre a mano.
   *
   * Se lleva lo elegido: quedarse con un establecimiento del padrón y además un
   * texto libre serían dos respuestas a la misma pregunta.
   */
  protected escribirAMano(): void {
    this.establecimiento.set(null);
    this.resultados.set([]);
    this.modoDeInstitucion.set('libre');
  }

  /** Vuelve a buscar en el padrón, descartando lo escrito a mano. */
  protected buscarEnElPadron(): void {
    this.institucion.set('');
    this.modoDeInstitucion.set('padron');
  }

  /* -- Sedes propias (ALV-005/006) ---------------------------------------- */

  /**
   * Despliega el alta de consultorio propio y, recién ahí, pide el árbol de
   * municipios: es un catálogo grande y la mayoría de las visitas a esta
   * pantalla no lo necesitan.
   */
  protected abrirAltaDeSede(): void {
    this.altaDeSedeAbierta.set(true);
    if (this.ramasMunicipios().length === 0) {
      this.cargarMunicipios();
    }
  }

  protected cerrarAltaDeSede(): void {
    this.altaDeSedeAbierta.set(false);
    this.sedeEnEdicion.set(null);
    this.limpiarSede();
  }

  /**
   * Busca en el padrón mientras se escribe, para «Dónde atiendo».
   *
   * Gemelo de `buscarEnPadron`, con sus propias señales y no las suyas: los dos
   * buscadores pueden convivir en la misma tarjeta. Un fallo deja la lista
   * vacía y no se anuncia: es un buscador, no un trámite.
   */
  protected buscarLugar(texto: string): void {
    if (texto.trim() === '') {
      this.lugaresDelPadron.set([]);
      return;
    }
    this.buscandoLugar.set(true);
    this.profiles.searchLinkableOrganizations(texto).subscribe({
      next: (pagina) => {
        this.buscandoLugar.set(false);
        this.lugaresDelPadron.set(pagina.items.map(comoOpcion));
      },
      error: () => {
        this.buscandoLugar.set(false);
        this.lugaresDelPadron.set([]);
      },
    });
  }

  /**
   * Declara que atiende en el establecimiento elegido.
   *
   * Es un vínculo **sin fecha de fin**: así lo lee la ficha como «dónde ejerce
   * hoy». Sin cargo, porque acá la pregunta es dónde y no como qué —el cargo se
   * agrega desde el historial, que es donde vive esa pregunta—.
   */
  protected atiendoAca(): void {
    const lugar = this.lugarElegido();
    if (lugar === null || this.vinculandoLugar()) {
      return;
    }
    this.vinculandoLugar.set(true);
    this.registroDeSede.set(loading());
    this.profiles
      .addAffiliation({ organizationName: lugar.label, startDate: soloFecha(new Date()) })
      .subscribe({
        next: () => {
          this.vinculandoLugar.set(false);
          this.registroDeSede.set(ready(null));
          this.lugarElegido.set(null);
          this.lugaresDelPadron.set([]);
          this.toasts.success(
            `${lugar.label} ya figura entre los lugares donde atendés.`,
            'Listo',
          );
          this.cargarSedes();
          this.cargar();
          this.added.emit();
        },
        error: (error: unknown) => {
          this.vinculandoLugar.set(false);
          this.registroDeSede.set(errorToViewState<null>(error));
        },
      });
  }

  protected reintentarMunicipios(): void {
    this.municipios.olvidar();
    this.cargarMunicipios();
  }

  /** Despliega o guarda el mapa para marcar el punto. */
  protected alternarMapa(): void {
    this.mapaAbierto.update((abierto) => !abierto);
  }

  /** El punto donde se hizo clic en el mapa. */
  protected marcarPunto(punto: PuntoGeo): void {
    this.puntoDeSede.set(punto);
  }

  protected quitarPunto(): void {
    this.puntoDeSede.set(null);
  }

  /**
   * Registra un consultorio propio (ALV-005/006).
   *
   * La dirección sólo viaja si tiene al menos una línea: una sede sin
   * dirección es válida —se puede cargar después— y mandar una dirección
   * vacía no es «sin dirección», es una fila vacía en `common.addresses`.
   */
  private registrarSede(): void {
    const address = this.direccionDelFormulario();

    const enEdicion = this.sedeEnEdicion();
    const cuerpo = {
      name: this.nombreDeSedeNueva().trim(),
      ...(address === undefined ? {} : { address }),
    };

    this.registrandoSede.set(true);
    this.registroDeSede.set(loading());
    const peticion =
      enEdicion === null
        ? this.sites.createOwnSite(cuerpo)
        : this.sites.updateOwnSite(enEdicion.id, cuerpo);
    peticion.subscribe({
      next: () => {
        this.registrandoSede.set(false);
        this.registroDeSede.set(ready(null));
        const corregido = enEdicion !== null;
        this.cerrarAltaDeSede();
        this.toasts.success(
          corregido ? 'Guardamos los cambios.' : 'Ya figura entre tus consultorios.',
          corregido ? 'Consultorio actualizado' : 'Consultorio registrado',
        );
        this.cargarSedes();
        this.added.emit();
      },
      error: (error: unknown) => {
        this.registrandoSede.set(false);
        this.registroDeSede.set(errorToViewState<null>(error));
      },
    });
  }

  /**
   * Abre el formulario ya cargado con la sede que se va a corregir (P32-b).
   *
   * Prellena el nombre y el punto, y **deja la dirección en blanco a
   * propósito**: la lista trae `addressText` ya compuesta por el backend y
   * descomponerla en calle, ciudad y municipio sería adivinar. Vacía significa
   * «no la toques», que es exactamente lo que el `PATCH` hace con lo que no
   * viaja en el cuerpo — y el formulario lo dice con todas las letras.
   *
   * @param sede - El consultorio propio a corregir.
   */
  protected abrirEdicionDeSede(sede: PracticeSite): void {
    this.limpiarSede();
    this.sedeEnEdicion.set(sede);
    this.nombreDeSedeNueva.set(sede.name);
    // La dirección arranca con la que la sede ya tiene. Abrir el formulario en
    // blanco y pedir «escribila entera de nuevo» era una regresión de la
    // reconciliación del 19/09/2026: corregir el nombre obligaba a retipear la
    // calle, y quien no lo hacía la dejaba como estaba sin saberlo.
    this.direccionDeSede.set(sede.addressText ?? '');
    if (sede.latitude !== null && sede.longitude !== null) {
      this.puntoDeSede.set({ lat: sede.latitude, lng: sede.longitude });
    }
    this.altaDeSedeAbierta.set(true);
    if (this.ramasMunicipios().length === 0) {
      this.cargarMunicipios();
    }
  }

  /**
   * Guarda el formulario: da de alta una sede nueva, o corrige la que se está
   * editando. Son dos escrituras distintas y cada una tiene su método.
   */
  protected guardarSede(): void {
    if (!this.puedeRegistrarSede()) {
      return;
    }
    const enEdicion = this.sedeEnEdicion();
    if (enEdicion === null) {
      this.registrarSede();
    } else {
      this.corregirSede(enEdicion);
    }
  }

  /**
   * Refleja el QR recién guardado sin volver a pedir la lista entera.
   *
   * El modal ya habló con la API y sabe el `fileId` que quedó; recargar sería
   * una petición de más para un dato que ya está en la mano.
   *
   * @param fileId - El archivo que quedó como QR de esa sede.
   */
  protected qrGuardado(fileId: string): void {
    const id = this.sedeConQrAbiertoId();
    if (id === null) {
      return;
    }
    this.sedes.update((sedes) =>
      sedes.map((sede) => (sede.id === id ? { ...sede, bankQrFileId: fileId } : sede)),
    );
  }

  /**
   * Corrige el consultorio propio (P32-b).
   *
   * La dirección sólo viaja si el formulario tiene una calle escrita: vacía
   * significa «conservá la que ya tenía», no «borrala».
   *
   * @param sede - El consultorio que se está corrigiendo.
   */
  private corregirSede(sede: PracticeSite): void {
    const address = this.direccionDelFormulario();
    this.registrandoSede.set(true);
    this.registroDeSede.set(loading());
    this.sites
      .updateOwnSite(sede.id, {
        name: this.nombreDeSedeNueva().trim(),
        ...(address === undefined ? {} : { address }),
      })
      .subscribe({
        next: () => {
          this.registrandoSede.set(false);
          this.registroDeSede.set(ready(null));
          this.cerrarAltaDeSede();
          this.toasts.success('Los cambios ya figuran en tu ficha.', 'Consultorio corregido');
          this.cargarSedes();
          this.added.emit();
        },
        error: (error: unknown) => {
          this.registrandoSede.set(false);
          this.registroDeSede.set(errorToViewState<null>(error));
        },
      });
  }

  /**
   * La dirección tal como la declara el formulario, o `undefined` si no hay
   * calle escrita.
   *
   * Una sede sin dirección es válida —se puede cargar después— y mandar una
   * dirección vacía no es «sin dirección», es una fila vacía en
   * `common.addresses`.
   *
   * @returns La dirección a mandar, o `undefined` para no mandar ninguna.
   */
  private direccionDelFormulario(): NewOwnSite['address'] {
    const direccion = this.direccionDeSede().trim();
    if (direccion === '') {
      return undefined;
    }
    const ciudad = this.ciudadDeSede().trim();
    const municipio = this.municipioDeSede();
    const departamento = this.departamentoDeSede();
    const punto = this.puntoDeSede();
    return {
      lines: [direccion],
      ...(ciudad === '' ? {} : { city: ciudad }),
      ...(municipio === null ? {} : { municipalityConceptId: municipio }),
      ...(departamento === null ? {} : { administrativeAreaConceptId: departamento }),
      ...(punto === null ? {} : { latitude: punto.lat, longitude: punto.lng }),
    };
  }

  /**
   * Deja de atender en una sede (ALV-005).
   *
   * Con confirmación: no se borra nada, pero la agenda deja de ofrecer ese
   * lugar y un clic de más no debería sacar un consultorio de la ficha.
   */
  protected async quitarSede(sede: PracticeSite): Promise<void> {
    const confirmado = await this.dialogs.confirm({
      title: 'Dejar de atender acá',
      message: `¿Retirar «${sede.name}» de tus consultorios? La sede no se borra; deja de figurar como un lugar donde atendés.`,
      confirmLabel: 'Retirar',
      cancelLabel: 'Cancelar',
    });
    if (!confirmado) {
      return;
    }
    this.sites.removeOwnSite(sede.id).subscribe({
      next: () => {
        this.toasts.success('Ya no figura entre tus consultorios.', 'Consultorio retirado');
        this.cargarSedes();
        this.added.emit();
      },
      error: (error: unknown) => {
        this.registroDeSede.set(errorToViewState<null>(error));
      },
    });
  }

  /* -- El QR bancario (una sede, una cuenta) ------------------------------- */

  /** Si la sede ya tiene un QR bancario configurado. */
  protected tieneQrBancario(sede: PracticeSite): boolean {
    return (sede.bankQrFileId ?? null) !== null;
  }

  /**
   * Qué dice la acción del QR de esa sede.
   *
   * Dos textos y no uno porque son dos cosas distintas: mirar el que ya está y
   * cargar el que falta. Antes el botón era sólo un ícono y se pintaba en
   * ámbar cuando faltaba; el color solo no alcanza para decirlo (WCAG 1.4.1),
   * así que el aviso siempre vivió en el texto. Ahora el texto está a la
   * vista, y el aviso además sigue escrito en la fila (`sede-sin-qr`).
   *
   * No lleva ícono: el set cerrado del sistema no tiene uno de QR, y `scan` es
   * imagenología clínica —su propia ficha lo aclara—, no un código de cobro.
   * Una acción sin ícono se dibuja con su texto, que es lo que pide ADR-0012.
   */
  protected etiquetaDelQr(sede: PracticeSite): string {
    return this.tieneQrBancario(sede) ? 'Ver QR bancario' : 'Configurar QR bancario';
  }

  /**
   * Qué dice la acción de retirar, que no es el mismo acto en las dos sedes.
   *
   * En la propia se deja de ofrecer un consultorio que es suyo; en la ajena se
   * corta un vínculo con una organización. Esa distinción es del negocio y se
   * conserva. De qué sede se trata ya no lo repite cada etiqueta: lo pone
   * `app-row-actions` en el nombre accesible, a partir de `fila`.
   */
  protected etiquetaDeRetiro(sede: PracticeSite): string {
    return sede.isOwnSite === true ? 'Retirar' : 'Dejar de atender';
  }

  /**
   * Las acciones de una sede, como datos (ADR-0012).
   *
   * Son dos o tres según de quién sea la sede, y de eso —no de una decisión de
   * esta pantalla— sale la forma: en la propia son tres y se colapsan en un
   * desplegable; en la ajena son dos y quedan en la fila con su texto.
   *
   * El orden no es casual: el QR va primero porque es el único que avisa de
   * algo pendiente, y retirar va último porque es el que no se deshace.
   */
  protected accionesDeSede(sede: PracticeSite): readonly RowAction[] {
    const acciones: RowAction[] = [{ code: 'qr', label: this.etiquetaDelQr(sede) }];
    if (sede.isOwnSite) {
      acciones.push({ code: 'editar', label: 'Editar', icon: 'edit' });
    }
    acciones.push({
      code: 'retirar',
      label: this.etiquetaDeRetiro(sede),
      icon: 'remove',
      destructive: true,
    });
    return acciones;
  }

  /** Despacha el `code` que emitió `app-row-actions` sobre esa sede. */
  protected ejecutarAccionDeSede(code: string, sede: PracticeSite): void {
    if (code === 'qr') {
      this.abrirQrDeSede(sede);
      return;
    }
    if (code === 'editar') {
      this.abrirEdicionDeSede(sede);
      return;
    }
    if (code === 'retirar') {
      void this.quitarSede(sede);
    }
  }

  protected abrirQrDeSede(sede: PracticeSite): void {
    this.sedeConQrAbiertoId.set(sede.id);
  }

  protected cerrarQrDeSede(): void {
    this.sedeConQrAbiertoId.set(null);
  }

  /**
   * Qué contarle al médico sobre el trámite de este vínculo.
   *
   * Devuelve `null` cuando no hay nada que decir —aprobado, o un vínculo que
   * nunca necesitó aprobación— porque un aviso en cada línea del historial
   * convierte la lista en ruido y esconde justamente el que importa.
   *
   * @param afiliacion - El vínculo a describir.
   * @returns El aviso, o `null` si no corresponde ninguno.
   */
  protected avisoDelVinculo(afiliacion: PractitionerAffiliation): string | null {
    if (afiliacion.statusKind === 'pendiente') {
      return afiliacion.practiceSiteId === null
        ? 'Esperando que la institución confirme el vínculo.'
        : 'Esperando que la organización te acepte. Hasta entonces no vas a poder publicar agenda ahí.';
    }
    // El motivo, cuando la organización lo dio, va DENTRO del aviso y no como
    // una línea aparte: leer «no aceptaron tu vínculo» y tener que buscar por
    // qué en otro renglón parte en dos una sola noticia.
    const motivo =
      afiliacion.decisionReasonText === null
        ? ''
        : ` Motivo: ${afiliacion.decisionReasonText}`;

    if (afiliacion.statusKind === 'rechazado') {
      return (
        'La organización no aceptó este vínculo.' +
        (motivo === ''
          ? ' Si creés que es un error, hablá con ellos.'
          : motivo)
      );
    }
    if (afiliacion.statusKind === 'revocado') {
      return (
        'La organización dio de baja este vínculo. Las citas que ya ' +
        'confirmaste siguen en pie.' + motivo
      );
    }
    if (afiliacion.statusKind === 'declarado') {
      // No es un problema y no se pinta como tal: el médico PUEDE publicar acá.
      // Lo que se cuenta es que la institución no lo confirmó —porque no tiene
      // a nadie que pueda hacerlo—, para que sepa por qué su ficha no muestra
      // el sello y no lo lea como un trámite trabado.
      return 'Declarado por vos. Esta institución no tiene quién confirme vínculos, así que no lleva su sello.';
    }
    return null;
  }

  /** El período de una afiliación, en palabras. */
  protected periodo(afiliacion: PractitionerAffiliation): string {
    return afiliacion.current ? 'En curso' : 'Finalizado';
  }

  /** El nombre de la sede atada, si la afiliación ata alguna. */
  protected nombreDeSede(afiliacion: PractitionerAffiliation): string | null {
    if (afiliacion.practiceSiteId === null) {
      return null;
    }
    return (
      this.sedes().find((sede) => sede.id === afiliacion.practiceSiteId)?.name ?? null
    );
  }

  private cargar(): void {
    /* La simétrica de la de `cargarSedes`, y faltaba. Montado como «sólo los
       consultorios» —«Mis organizaciones», la pestaña «Dónde atiendo» del
       editor y ahora también la de la ficha— el historial no se dibuja, así
       que pedirlo es una petición por visita a una pantalla que no lo usa.
       `afiliaciones()` sólo se consume dentro de `@if (muestraHistorial())`
       (`work-history.html:311`), así que no leerlo no deja nada sin dato; se
       deja en `ready([])` por lo mismo que la rama sin perfil de `ngOnInit`:
       un `loading()` eterno haría girar un esqueleto que nadie mira.

       Hasta hoy costaba una petición de más por visita a «Mis
       organizaciones»; con el consultorio dentro del perfil pasaba a costar
       dos por visita al perfil, porque la ficha monta este componente dos
       veces. */
    if (!this.muestraHistorial()) {
      this.historial.set(ready([]));
      return;
    }
    this.historial.set(loading());
    this.profiles.listAffiliations().subscribe({
      next: (pagina) => this.historial.set(ready(pagina.items)),
      error: (error: unknown) =>
        this.historial.set(errorToViewState<readonly PractitionerAffiliation[]>(error)),
    });
  }

  /**
   * Pide los consultorios propios.
   *
   * Va por su lado y su fallo no se muestra: atar la afiliación a una sede es
   * opcional, y perder el formulario entero porque no se pudo leer una lista
   * opcional sería cambiar una comodidad por una funcionalidad.
   */
  private cargarSedes(): void {
    /* Montado como «sólo el historial» —la pestaña Trayectoria— el bloque de
       consultorios no se dibuja, así que pedirlos es una petición por cada
       visita a una pestaña que no los usa. Lo destapó su propia prueba. */
    if (!this.muestraConsultorios()) {
      return;
    }
    const profileId = this.auth.practitionerProfileId();
    if (profileId === null) {
      return;
    }
    this.sites.listSitesOfPractitioner(profileId).subscribe({
      next: (pagina) => this.sedes.set(pagina.items),
      error: () => this.sedes.set([]),
    });
  }

  /**
   * Trae el árbol de municipios, para «en qué municipio queda».
   *
   * Mismo criterio que el alta de profesional ante un fallo: el campo es
   * opcional y el alta de la sede sigue.
   */
  private cargarMunicipios(): void {
    this.municipios.listar().subscribe({
      next: (ramas) => {
        this.catalogoMunicipiosCaido.set(false);
        this.ramasMunicipios.set(ramas);
      },
      error: () => {
        this.ramasMunicipios.set([]);
        this.catalogoMunicipiosCaido.set(true);
      },
    });
  }

  /** Vacía el formulario tras un alta. El siguiente vínculo arranca limpio. */
  private limpiar(): void {
    this.institucion.set('');
    this.establecimiento.set(null);
    this.resultados.set([]);
    this.modoDeInstitucion.set('padron');
    this.cargo.set('');
    this.desde.set(null);
    this.hasta.set(null);
    this.sede.set(null);
  }

  private limpiarSede(): void {
    this.nombreDeSedeNueva.set('');
    this.direccionDeSede.set('');
    this.ciudadDeSede.set('');
    this.municipioDeSede.set(null);
    this.puntoDeSede.set(null);
    this.mapaAbierto.set(false);
    this.registroDeSede.set(ready(null));
  }
}

/** El fallo de una escritura, en palabras, o `null` si no hubo. */
function mensajeDe(state: ViewState<null>): string | null {
  if (state.status === 'validation') {
    return state.issues.map((issue) => issue.message).join(' ') || null;
  }
  if (state.status === 'forbidden') {
    return state.message ?? 'Tu cuenta no tiene un perfil profesional asociado.';
  }
  if (state.status === 'offline') {
    return 'No pudimos conectarnos. Revisá tu conexión y reintentá.';
  }
  if (state.status === 'error') {
    return `${state.message || 'Ocurrió un error inesperado.'} (${state.requestId})`;
  }
  return null;
}

/**
 * La fecha como el `YYYY-MM-DD` que el contrato pide, con los componentes
 * **locales**.
 *
 * `toISOString()` la pasa por UTC y en cualquier huso al oeste de Greenwich
 * devuelve el día anterior: quien declara que entró a un hospital el 1 de marzo
 * lo vería guardado como 28 de febrero. Es el espejo de `maybeDateOnly`, que
 * hace el camino de vuelta.
 */
function soloFecha(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

/**
 * Un establecimiento del padrón, como opción del buscador.
 *
 * El municipio va en el `hint` y no en el rótulo porque el rótulo es lo que se
 * guarda como nombre de la institución: pegarle « · WARNES» dejaría el
 * municipio escrito dentro del nombre. Y va, porque sin él los cuatro «SAN
 * LUIS» del padrón son indistinguibles.
 */
function comoOpcion(establecimiento: LinkableOrganization): ReferenceOption {
  const pistas = [establecimiento.municipality, establecimiento.address].filter(
    (dato): dato is string => dato !== null && dato.trim() !== '',
  );
  return {
    value: establecimiento.facilityConceptId,
    label: establecimiento.name,
    ...(pistas.length === 0 ? {} : { hint: pistas.join(' · ') }),
  };
}
