import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

import { AuthService } from '../../../../core/auth/auth.service';
import { ProceduresClient } from '../../../../core/data-access/procedures/procedures.client';
import type {
  DentalCatalog,
  DentalCatalogEntry,
  DentalProcedure,
  SurgicalCaseDetail,
} from '../../../../core/data-access/procedures/procedures.types';
import { TerminologyClient } from '../../../../core/data-access/terminology/terminology.client';
import type { ConceptLabels } from '../../../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { dataOf, loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Input as AppInput } from '../../../../shared/components/atoms/input/input';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { Textarea } from '../../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../shared/components/molecules/card/card';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { FormActions } from '../../../../shared/components/organisms/form-actions/form-actions';
import { Odontogram } from '../odontogram/odontogram';

/**
 * Cuántos casos quirúrgicos se traen, y de cuántos se pide el detalle.
 *
 * Es **un** tope y no dos porque el detalle se pide de cada caso que se va a
 * mostrar: son N peticiones, así que el número tiene que ser el que la pantalla
 * dibuja. Lo que quede afuera se dice —ver `recorteQuirurgico`—, no se calla.
 */
const TOPE_CASOS = 10;

/** Tope del histórico odontológico. */
const TOPE_ODONTOLOGICO = 50;

/** Lo que se muestra cuando el registro no trae ese dato. */
const SIN_DATO = 'Sin registrar';

/** Largo máximo de la nota, el mismo que valida el backend. */
const TOPE_DE_NOTA = 4000;

/**
 * Con qué prefija el catálogo los códigos de pieza (`FDI_16`).
 *
 * El odontograma habla en números de pieza a secas porque es lo que se escribe
 * en una ficha; el catálogo los publica prefijados para que no se confundan con
 * cualquier otro código de dos dígitos.
 */
const PREFIJO_FDI = 'FDI_';

/** Largo máximo de la precisión del sitio, el mismo que valida el backend. */
const TOPE_DE_CARA = 200;

/** Un caso quirúrgico ya resuelto para la línea de tiempo. */
export interface CasoEnPantalla {
  readonly id: string;
  readonly numero: string;
  readonly estado: string;
  readonly cuando: Date | null;
  readonly equipo: readonly string[];
  readonly pasos: readonly { readonly id: string; readonly texto: string }[];
  readonly hallazgos: readonly { readonly id: string; readonly texto: string }[];
  readonly implantes: readonly {
    readonly id: string;
    readonly texto: string;
    readonly trazabilidad: string;
  }[];
}

/** Un tratamiento odontológico ya resuelto para la línea de tiempo. */
export interface TratamientoEnPantalla {
  readonly id: string;
  readonly que: string;
  readonly piezas: string;
  readonly nota: string;
  readonly cuando: Date | null;
}

/**
 * **Histórico de procedimientos** de una persona: cirugías y odontología
 * (punto 7 del reclamo).
 *
 * ## Dos historias en un bloque, y por qué no en dos
 *
 * Para quien atiende es una sola pregunta —«¿qué le hicieron a esta persona?»—
 * y la respuesta se lee en orden, no por servicio. Partirlo en dos secciones del
 * menú obligaría a mirar en dos lados para reconstruir un antecedente.
 *
 * ## Las dos lecturas van por separado a propósito
 *
 * Lo quirúrgico exige uno de los cinco roles perioperatorios; lo odontológico,
 * `CLINICIAN` o `PRACTITIONER`. Son permisos distintos, así que cada mitad tiene
 * su propio estado: un odontólogo ve su histórico aunque el quirúrgico le
 * responda `403`, y un cirujano al revés. Un `forkJoin` que exigiera las dos
 * haría que el permiso más estrecho se llevara puesta la mitad que sí se puede
 * ver — que es el defecto que la agenda ya cometió una vez, confundiendo «no
 * hay» con «no podés ver».
 *
 * ## Por qué el detalle se pide caso por caso
 *
 * `GET /procedure-cases` devuelve sólo cabeceras. El equipo, los pasos, los
 * hallazgos y los implantes están en `GET /procedure-cases/:id`, y eso es lo que
 * el punto del reclamo pedía ver. Son N peticiones —una por caso mostrado—, y
 * por eso el tope es bajo y explícito: diez casos, y si hay más se dice.
 *
 * ## La única escritura: el tratamiento odontológico
 *
 * Y está acá por el mismo criterio que el encuentro en la pantalla que lo
 * contiene: es una escritura cuyo resultado **esta misma pantalla vuelve a
 * leer**. Lo quirúrgico no se registra desde el expediente —un caso quirúrgico
 * se programa, se confirma y se opera en su propio flujo, con cinco roles
 * distintos— así que ofrecer acá un formulario para eso sería fingir que un
 * quirófano se agenda desde una ficha clínica.
 */
@Component({
  selector: 'app-procedures-block',
  imports: [
    Alert,
    AppButton,
    AppInput,
    Badge,
    Card,
    DatePipe,
    FormActions,
    FormField,
    Odontogram,
    Select,
    Textarea,
  ],
  templateUrl: './procedures-block.html',
  styleUrl: './procedures-block.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProceduresBlock {
  private readonly procedures = inject(ProceduresClient);
  private readonly terminology = inject(TerminologyClient);
  private readonly auth = inject(AuthService);
  private readonly toasts = inject(ToastService);

  /** La persona cuyo histórico se muestra. Mismo nombre que sus hermanos. */
  readonly patientProfileId = input.required<string>();

  /**
   * El encuentro en curso, o `null` si no hay ninguno abierto.
   *
   * El histórico es de la persona y se lee sin encuentro —por eso este bloque
   * no lo exige, a diferencia del diagnóstico y la receta—, pero lo que SÍ se
   * escribe desde acá, el tratamiento odontológico, es un acto de una consulta.
   * El contrato acepta `encounterId` y hasta ahora se perdía: una vez cerrado
   * el encuentro ya no hay forma de saber en cuál se hizo.
   */
  readonly encounterId = input<string | null>(null);

  /* -- Lo quirúrgico ------------------------------------------------------- */

  protected readonly quirurgico = signal<ViewState<readonly SurgicalCaseDetail[]>>(
    loading(),
  );

  /** Cuántos casos tiene en total, para poder avisar del recorte. */
  private readonly totalDeCasos = signal(0);

  private readonly etiquetas = signal<ConceptLabels>(new Map());

  protected readonly casos = computed<readonly CasoEnPantalla[]>(() =>
    (dataOf(this.quirurgico()) ?? []).map((detalle) => ({
      id: detalle.case.id,
      numero: detalle.case.caseNumber,
      estado: this.label(detalle.case.statusConceptId),
      cuando: detalle.case.scheduledStartAt ?? null,
      equipo: detalle.team.map((integrante) => this.label(integrante.teamRoleConceptId)),
      pasos: detalle.operativeSteps.map((paso) => ({
        id: paso.id,
        texto: `${paso.stepNumber}. ${paso.description}`,
      })),
      hallazgos: detalle.findings.map((hallazgo) => ({
        id: hallazgo.id,
        texto: hallazgo.findingText,
      })),
      implantes: detalle.implants.map((implante) => ({
        id: implante.id,
        texto: this.label(implante.implantRoleConceptId),
        // El lote y la serie van juntos y visibles: es lo que permite responder
        // a una alerta de retiro del mercado sin abrir el quirófano de nuevo.
        trazabilidad: implante.identifiers
          .map((identificador) =>
            [
              identificador.identifierValue,
              identificador.lotNumber === undefined
                ? ''
                : `lote ${identificador.lotNumber}`,
              identificador.serialNumber === undefined
                ? ''
                : `serie ${identificador.serialNumber}`,
            ]
              .filter(Boolean)
              .join(' · '),
          )
          .join(' | '),
      })),
    })),
  );

  /**
   * El aviso de recorte quirúrgico, en palabras.
   *
   * Un histórico clínico al que le faltan cirugías sin avisar se lee como «no
   * tuvo más cirugías», que es la lectura contraria a la verdadera.
   */
  protected readonly recorteQuirurgico = computed(() =>
    this.totalDeCasos() > TOPE_CASOS ? this.totalDeCasos() - TOPE_CASOS : 0,
  );

  protected readonly topeDeCasos = TOPE_CASOS;

  /* -- Lo odontológico ----------------------------------------------------- */

  protected readonly odontologico = signal<ViewState<readonly DentalProcedure[]>>(
    loading(),
  );

  private readonly totalOdontologico = signal(0);

  private readonly catalogo = signal<DentalCatalog | null>(null);

  protected readonly tratamientos = computed<readonly TratamientoEnPantalla[]>(() =>
    (dataOf(this.odontologico()) ?? []).map((tratamiento) => ({
      id: tratamiento.id,
      que: this.delCatalogo(tratamiento.procedureCodeConceptId),
      piezas: tratamiento.sites
        .map((sitio) =>
          [
            this.delCatalogo(sitio.bodySiteConceptId),
            sitio.description === undefined ? '' : `(${sitio.description})`,
          ]
            .filter(Boolean)
            .join(' '),
        )
        .join(', '),
      nota: tratamiento.noteText ?? '',
      cuando: tratamiento.performedAt ?? tratamiento.createdAt,
    })),
  );

  protected readonly recorteOdontologico = computed(() =>
    this.totalOdontologico() > TOPE_ODONTOLOGICO
      ? this.totalOdontologico() - TOPE_ODONTOLOGICO
      : 0,
  );

  /* -- El odontograma ------------------------------------------------------ */

  /**
   * El código FDI de cada concepto de pieza, para poder ir del histórico —que
   * habla en `conceptId`— al dibujo, que habla en números de pieza.
   *
   * El mapeo sale del catálogo del servidor y no de una tabla escrita acá: los
   * uuid de los conceptos son derivados y un re-seed puede moverlos, mientras
   * que el código (`FDI_16`) es estable. Los cuadrantes quedan fuera: el
   * odontograma dibuja piezas, y un tratamiento sobre un cuadrante entero se
   * sigue viendo en la lista de abajo.
   */
  private readonly fdiPorConcepto = computed<ReadonlyMap<string, string>>(() => {
    const dientes = this.catalogo()?.teeth ?? [];
    return new Map(
      dientes.map((diente) => [
        diente.conceptId,
        diente.code.replace(PREFIJO_FDI, ''),
      ]),
    );
  });

  /** Cuántos tratamientos tiene registrada cada pieza, por código FDI. */
  protected readonly marcasPorPieza = computed<Readonly<Record<string, number>>>(
    () => {
      const porConcepto = this.fdiPorConcepto();
      const cuenta: Record<string, number> = {};
      for (const tratamiento of dataOf(this.odontologico()) ?? []) {
        for (const sitio of tratamiento.sites) {
          const fdi = porConcepto.get(sitio.bodySiteConceptId);
          if (fdi === undefined) continue;
          cuenta[fdi] = (cuenta[fdi] ?? 0) + 1;
        }
      }
      return cuenta;
    },
  );

  /** La pieza elegida, en código FDI, para que el dibujo la marque. */
  protected readonly piezaElegidaFdi = computed<string | null>(() => {
    const elegida = this.pieza();
    if (elegida === null) return null;
    return this.fdiPorConcepto().get(elegida) ?? null;
  });

  /**
   * Elegir una pieza en el dibujo la carga en el formulario de alta.
   *
   * El `<select>` de sitio se queda igual y sigue siendo la única forma de
   * elegir un cuadrante: el odontograma es un atajo sobre las piezas, no su
   * reemplazo.
   */
  protected elegirPieza(fdi: string): void {
    const diente = (this.catalogo()?.teeth ?? []).find(
      (pieza) => pieza.code === `${PREFIJO_FDI}${fdi}`,
    );
    if (diente === undefined) return;
    this.pieza.set(diente.conceptId);
  }

  /* -- El alta odontológica ------------------------------------------------ */

  protected readonly codigo = signal<string | null>(null);
  protected readonly pieza = signal<string | null>(null);
  protected readonly cara = signal<string | number | null>('');
  protected readonly nota = signal('');

  protected readonly topeDeNota = TOPE_DE_NOTA;
  protected readonly topeDeCara = TOPE_DE_CARA;

  protected readonly registrando = signal(false);
  protected readonly registro = signal<ViewState<null>>(ready(null));

  /**
   * Si la cara escrita pasa el tope que valida el backend.
   *
   * `app-input` no acota el largo —no tiene `maxLength`, a diferencia de
   * `app-textarea`—, así que la comprobación vive acá. Se avisa antes de enviar
   * en vez de dejar que el `400` explique lo que el campo ya sabía.
   */
  protected readonly caraDemasiadoLarga = computed(
    () => String(this.cara() ?? '').trim().length > TOPE_DE_CARA,
  );

  /** Opciones del selector de tratamiento, del catálogo del backend. */
  protected readonly opcionesDeCodigo = computed<readonly SelectOption<string>[]>(() =>
    (this.catalogo()?.procedureCodes ?? []).map(aOpcion),
  );

  /**
   * Opciones del selector de sitio: primero los cuadrantes, después las piezas.
   *
   * En ese orden porque un tratamiento por cuadrante —un raspaje— se elige de un
   * vistazo, y buscarlo detrás de treinta y dos dientes lo escondería.
   */
  protected readonly opcionesDeSitio = computed<readonly SelectOption<string>[]>(() => [
    ...(this.catalogo()?.quadrants ?? []).map(aOpcion),
    ...(this.catalogo()?.teeth ?? []).map(aOpcion),
  ]);

  /**
   * La organización bajo la que se registra.
   *
   * `X-Tenant-Id` es obligatorio en el alta y no se puede deducir del paciente:
   * una persona puede atenderse en más de una. Sale de la sesión activa, que es
   * donde ya se eligió.
   */
  protected readonly sinOrganizacion = computed(() => this.auth.activeTenantId() === null);

  /**
   * Si el alta se puede ofrecer.
   *
   * Sin catálogo no: los selectores estarían vacíos y el formulario mandaría un
   * código que no existe. Sin código elegido tampoco — es el único campo que el
   * backend exige además del paciente.
   */
  protected readonly puedeRegistrar = computed(
    () =>
      this.catalogo() !== null &&
      this.codigo() !== null &&
      !this.sinOrganizacion() &&
      !this.caraDemasiadoLarga(),
  );

  /**
   * El fallo del alta, en palabras.
   *
   * El `422` se distingue porque acá tiene significado propio: el sitio elegido
   * no es una pieza ni un cuadrante, o se precisó una cara sin decir sobre qué
   * pieza. Las dos son corregibles desde el mismo formulario.
   */
  protected readonly errorDelRegistro = computed<string | null>(() => {
    const state = this.registro();
    if (state.status === 'validation') {
      return state.issues.map((issue) => issue.message).join(' ') || null;
    }
    if (state.status === 'forbidden') {
      return state.message ?? 'Tu rol no permite registrar tratamientos odontológicos.';
    }
    if (state.status === 'offline') {
      return 'No pudimos conectarnos. Revisá tu conexión y reintentá.';
    }
    if (state.status === 'error') {
      return `${state.message || 'Ocurrió un error inesperado.'} (${state.requestId})`;
    }
    return null;
  });

  constructor() {
    // Ir de una ficha a otra reutiliza el componente: sin escuchar el perfil, la
    // segunda seguiría mostrando el histórico de la primera.
    effect(() => {
      this.patientProfileId();
      untracked(() => this.cargar());
    });
  }

  protected recargar(): void {
    this.cargar();
  }

  /* -- Escritura ----------------------------------------------------------- */

  /**
   * Registra el tratamiento odontológico.
   *
   * Sin confirmación previa: registrar no es destructivo —queda como un
   * antecedente más— y el M34 reserva el diálogo para lo que no se puede
   * deshacer. Lo que sí hace falta es **releer**: el tratamiento recién cargado
   * tiene que aparecer en el histórico, o la pantalla estaría afirmando un
   * registro que no muestra.
   */
  protected registrar(): void {
    const patientProfileId = this.patientProfileId();
    const procedureCodeConceptId = this.codigo();
    if (patientProfileId === '' || procedureCodeConceptId === null || this.registrando()) {
      return;
    }

    const pieza = this.pieza();
    const cara = String(this.cara() ?? '').trim();
    const nota = this.nota().trim();
    const encuentro = this.encounterId();

    this.registrando.set(true);
    this.registro.set(loading());

    this.procedures
      .recordDentalProcedure({
        patientProfileId,
        procedureCodeConceptId,
        // Las claves opcionales se omiten en vez de mandarse vacías: el backend
        // valida con `forbidNonWhitelisted` y, además, una cadena vacía sería
        // una nota registrada que no dice nada.
        ...(pieza === null ? {} : { toothSiteConceptId: pieza }),
        ...(cara === '' ? {} : { siteDetail: cara }),
        ...(nota === '' ? {} : { noteText: nota }),
        ...(encuentro === null || encuentro === ''
          ? {}
          : { encounterId: encuentro }),
      })
      .subscribe({
        next: () => {
          this.registrando.set(false);
          this.registro.set(ready(null));
          this.pieza.set(null);
          this.cara.set('');
          this.nota.set('');
          this.toasts.success('Queda en el histórico de la persona.', 'Tratamiento registrado');
          this.cargarOdontologico();
        },
        error: (error: unknown) => {
          this.registrando.set(false);
          this.registro.set(errorToViewState<null>(error));
        },
      });
  }

  /* -- Lectura ------------------------------------------------------------- */

  private cargar(): void {
    this.cargarQuirurgico();
    this.cargarOdontologico();
    this.cargarCatalogo();
  }

  /**
   * Los casos quirúrgicos y su detalle.
   *
   * Se pide la lista y después el detalle de cada caso. Un detalle que falla no
   * tumba el bloque: se descarta ese caso y se muestran los demás, porque media
   * lista de cirugías sigue siendo más útil que un error donde había
   * antecedentes.
   */
  private cargarQuirurgico(): void {
    const profileId = this.patientProfileId();
    this.quirurgico.set(loading());
    this.totalDeCasos.set(0);

    if (profileId === '') {
      this.quirurgico.set(ready([]));
      return;
    }

    this.procedures
      .listCases({ patientProfileId: profileId, limit: TOPE_CASOS })
      .pipe(
        switchMap((pagina) => {
          this.totalDeCasos.set(pagina.total);
          if (pagina.items.length === 0) {
            return of<readonly SurgicalCaseDetail[]>([]);
          }
          return forkJoin(
            pagina.items.map((caso) =>
              this.procedures.getCase(caso.id).pipe(catchError(() => of(null))),
            ),
          );
        }),
      )
      .subscribe({
        next: (detalles) => {
          const vivos = (detalles as readonly (SurgicalCaseDetail | null)[]).filter(
            (detalle): detalle is SurgicalCaseDetail => detalle !== null,
          );
          this.quirurgico.set(ready(vivos));
          this.resolverEtiquetas(conceptosDe(vivos));
        },
        error: (error: unknown) =>
          this.quirurgico.set(errorToViewState<readonly SurgicalCaseDetail[]>(error)),
      });
  }

  private cargarOdontologico(): void {
    const profileId = this.patientProfileId();
    this.odontologico.set(loading());
    this.totalOdontologico.set(0);
    // El aviso del alta anterior no sobrevive a la relectura: tras un alta
    // exitosa seguiría en pantalla un error que ya no describe nada.
    this.registro.set(ready(null));

    if (profileId === '') {
      this.odontologico.set(ready([]));
      return;
    }

    this.procedures
      .listDentalProcedures({
        patientProfileId: profileId,
        limit: TOPE_ODONTOLOGICO,
      })
      .subscribe({
        next: (pagina) => {
          this.totalOdontologico.set(pagina.total);
          this.odontologico.set(ready(pagina.items));
          // También por terminología, y no sólo por el catálogo: si el catálogo
          // no cargó, el histórico seguiría siendo legible. Es lo que hace
          // verdadera la frase «el registro no está disponible, el histórico
          // sí» que la pantalla muestra cuando el catálogo falla.
          this.resolverEtiquetas(conceptosOdontologicosDe(pagina.items));
        },
        error: (error: unknown) =>
          this.odontologico.set(errorToViewState<readonly DentalProcedure[]>(error)),
      });
  }

  /**
   * El catálogo odontológico.
   *
   * Va por su lado y su fallo se traga a propósito: sin catálogo no se puede
   * **registrar**, pero el histórico se sigue leyendo. Atarlo a la lectura haría
   * que un catálogo caído escondiera antecedentes que sí están.
   */
  private cargarCatalogo(): void {
    if (this.catalogo() !== null) {
      // Es el mismo para toda la aplicación: no cambia entre pacientes.
      return;
    }
    this.procedures
      .readDentalCatalog()
      .pipe(catchError(() => of(null)))
      .subscribe((catalogo) => this.catalogo.set(catalogo));
  }

  /**
   * Resuelve uuid de concepto a etiquetas legibles.
   *
   * **Acumula** en vez de reemplazar: las dos mitades del bloque terminan de
   * cargar por separado, y la que llegue segunda borraría las etiquetas de la
   * primera. Su fallo se traga —una etiqueta sin resolver se muestra como
   * ausencia, no tumba el histórico.
   */
  private resolverEtiquetas(ids: readonly string[]): void {
    if (ids.length === 0) {
      return;
    }
    this.terminology
      .readConceptLabels(ids)
      .pipe(catchError(() => of<ConceptLabels>(new Map())))
      .subscribe((nuevas) =>
        this.etiquetas.update((previas) => new Map([...previas, ...nuevas])),
      );
  }

  /** La etiqueta de un concepto quirúrgico, o el texto de ausencia. */
  private label(conceptId: string | undefined): string {
    if (conceptId === undefined) {
      return SIN_DATO;
    }
    return this.etiquetas().get(conceptId)?.display ?? SIN_DATO;
  }

  /**
   * La etiqueta de un concepto odontológico.
   *
   * El catálogo primero porque ya está en la mano —no cuesta una lectura—, y
   * terminología como respaldo por dos motivos: el catálogo puede no haber
   * cargado, y un tratamiento viejo puede tener un código que ya no se ofrece.
   * En los dos casos el antecedente existe y tiene que poder leerse.
   */
  private delCatalogo(conceptId: string): string {
    const catalogo = this.catalogo();
    const entrada =
      catalogo === null
        ? undefined
        : [
            ...catalogo.procedureCodes,
            ...catalogo.teeth,
            ...catalogo.quadrants,
          ].find((opcion) => opcion.conceptId === conceptId);
    return entrada?.display ?? this.label(conceptId);
  }
}

/** Una entrada del catálogo como opción de un `app-select`. */
function aOpcion(entrada: DentalCatalogEntry): SelectOption<string> {
  return { value: entrada.conceptId, label: entrada.display };
}

/**
 * Los identificadores de concepto de los casos, sin los ausentes.
 *
 * Listados a mano —y no recorriendo las claves que terminen en `ConceptId`— por
 * lo mismo que en el resto del expediente: una clave nueva del contrato debe
 * obligar a decidir si se muestra, no colarse en la petición sin que nadie la
 * haya puesto en pantalla.
 */
function conceptosDe(detalles: readonly SurgicalCaseDetail[]): readonly string[] {
  return detalles
    .flatMap((detalle) => [
      detalle.case.statusConceptId,
      ...detalle.team.map((integrante) => integrante.teamRoleConceptId),
      ...detalle.operativeSteps.flatMap((paso) => [
        paso.stepCodeConceptId,
        paso.bodySiteConceptId,
      ]),
      ...detalle.findings.flatMap((hallazgo) => [
        hallazgo.findingCodeConceptId,
        hallazgo.severityConceptId,
        hallazgo.bodySiteConceptId,
      ]),
      ...detalle.implants.flatMap((implante) => [
        implante.implantRoleConceptId,
        implante.bodySiteConceptId,
      ]),
    ])
    .filter((id): id is string => id !== undefined);
}

/**
 * Los identificadores de concepto del histórico odontológico.
 *
 * El código del tratamiento y la pieza: son los dos que la pantalla pinta, y
 * los únicos que hace falta poder resolver sin el catálogo.
 */
function conceptosOdontologicosDe(
  tratamientos: readonly DentalProcedure[],
): readonly string[] {
  return tratamientos.flatMap((tratamiento) => [
    tratamiento.procedureCodeConceptId,
    ...tratamiento.sites.map((sitio) => sitio.bodySiteConceptId),
  ]);
}
