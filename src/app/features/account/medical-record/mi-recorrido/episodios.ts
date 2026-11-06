import type { Tone } from '../../../../shared/components/tone/tone.types';
import type {
  EstadoDelDiagnostico,
  RegistroConVinculos,
} from './registro-con-vinculos';

/* ============================================================================
    (b) La agrupación en episodios y la narración por plantillas.

    Trabaja sólo sobre `RegistroConVinculos`: no conoce endpoints ni tipos del
    portal. Todo es puro y se prueba sin TestBed.

    ## Qué es un episodio

    Un hilo por problema de salud. Lo arma el diagnóstico **final** de una
    cadena de reemplazos (`reemplazadoPorId`): si «Migraña» se descartó y en su
    lugar quedó «Cefalea tensional», las dos son el mismo hilo y el descartado
    va plegado dentro. Al hilo se suman, **sólo por vínculo declarado**:

    - las atenciones en que se registró alguno de sus diagnósticos;
    - los estudios pedidos para él (`diagnosticoId`) o con los que se decidió
      (`evidenciaEstudioId`);
    - las recetas indicadas para él;
    - los controles agendados desde una de esas atenciones.

    Un estudio o una receta **sin** vínculo a un diagnóstico no se asigna a un
    hilo por cercanía: aparece dentro de su atención marcado como «de esta
    consulta», y no entra en la narración del hilo. Las atenciones que no tocan
    ningún diagnóstico van a «Otras consultas».

    // INTEGRACION-FRANJA-2: la agrupación por episodios del expediente
    // (`patient-chart/recorrido-clinico`) resuelve la misma pregunta para el
    // médico. Cuando su modelo sea compartido, `recorridoDelPaciente` debería
    // delegar en él y quedarse sólo con la redacción para el paciente.
    ========================================================================== */

/** Un hecho dentro de una atención del episodio. */
export interface HechoDelEpisodio {
  readonly registro: RegistroConVinculos;
  /**
   * `true` si pertenece al episodio por un vínculo declarado; `false` si sólo
   * comparte la atención (y entonces se muestra marcado como tal).
   */
  readonly directo: boolean;
}

/** Una atención, con lo que pasó en ella dentro de este hilo. */
export interface AtencionDelEpisodio {
  readonly registro: RegistroConVinculos;
  readonly hechos: readonly HechoDelEpisodio[];
}

/** Una frase de la narración, atada al registro del que sale. */
export interface PasoNarrado {
  readonly texto: string;
  readonly registroId: string;
  /** La atención que hay que desplegar para ver el registro, si la tiene. */
  readonly atencionId: string | null;
}

export type ClaseDeEpisodio = 'vigente' | 'cerrado' | 'descartado' | 'otras';

export interface Episodio {
  readonly id: string;
  readonly clase: ClaseDeEpisodio;
  readonly titulo: string;
  readonly estado: EstadoDelDiagnostico | null;
  readonly sello: string;
  readonly tono: Tone;
  readonly desde: Date | null;
  readonly hasta: Date | null;
  readonly atenciones: readonly AtencionDelEpisodio[];
  /** Diagnósticos descartados en el camino hacia el final, plegados. */
  readonly descartados: readonly RegistroConVinculos[];
  /** Hechos del hilo cuya atención no llegó (o que no tienen atención). */
  readonly sueltos: readonly HechoDelEpisodio[];
  readonly pasos: readonly PasoNarrado[];
}

export interface Recorrido {
  /** Los hilos con un diagnóstico vigente o cerrado, del más reciente al más viejo. */
  readonly episodios: readonly Episodio[];
  /** Los hilos que terminaron en un descarte, aparte y plegados. */
  readonly descartados: readonly Episodio[];
  /** Las atenciones que no tocan ningún diagnóstico, o `null` si no hay. */
  readonly otras: Episodio | null;
}

const SELLO: Readonly<Record<EstadoDelDiagnostico, { readonly sello: string; readonly tono: Tone }>> = {
  'en-estudio': { sello: 'En estudio', tono: 'warning' },
  confirmado: { sello: 'Confirmado', tono: 'success' },
  resuelto: { sello: 'Resuelto', tono: 'info' },
  descartado: { sello: 'Descartado', tono: 'secondary' },
};

/** Arma el recorrido entero a partir de los registros neutros. */
export function recorridoDelPaciente(registros: readonly RegistroConVinculos[]): Recorrido {
  const porId = new Map(registros.map((registro) => [registro.id, registro]));
  const atencionesConocidas = new Map(
    registros.filter((r) => r.tipo === 'atencion').map((r) => [r.id, r]),
  );
  const diagnosticos = registros.filter((r) => r.tipo === 'diagnostico');
  const controles = registros.filter((r) => r.tipo === 'control');
  const accesorios = registros.filter((r) => r.tipo === 'estudio' || r.tipo === 'receta');

  // Cada diagnóstico cae en el hilo de su final de cadena.
  const cadenas = new Map<string, RegistroConVinculos[]>();
  for (const diagnostico of diagnosticos) {
    const final = finalDeCadena(diagnostico, porId);
    cadenas.set(final.id, [...(cadenas.get(final.id) ?? []), diagnostico]);
  }

  const atencionesUsadas = new Set<string>();
  const accesoriosUsados = new Set<string>();
  const episodios: Episodio[] = [];

  for (const [finalId, cadena] of cadenas) {
    const final = porId.get(finalId)!;
    const idsDeLaCadena = new Set(cadena.map((d) => d.id));
    const evidencias = new Set(
      cadena.map((d) => d.evidenciaEstudioId).filter((id): id is string => id !== null),
    );
    const vinculados = accesorios.filter(
      (r) => (r.diagnosticoId !== null && idsDeLaCadena.has(r.diagnosticoId)) || evidencias.has(r.id),
    );
    vinculados.forEach((r) => accesoriosUsados.add(r.id));

    const directos = [...cadena, ...vinculados];
    const idsDeAtencion = new Set(
      directos.map((r) => r.atencionId).filter((id): id is string => id !== null && atencionesConocidas.has(id)),
    );
    const controlesDelHilo = controles.filter(
      (c) => c.origenAtencionId !== null && idsDeAtencion.has(c.origenAtencionId),
    );
    idsDeAtencion.forEach((id) => atencionesUsadas.add(id));

    const atenciones = [...idsDeAtencion]
      .map((id) => atencionesConocidas.get(id)!)
      .sort(porFecha)
      .map((atencion) => ({
        registro: atencion,
        hechos: [
          ...directos.filter((r) => r.atencionId === atencion.id && !descartadoEnElCamino(r, final)),
          ...controlesDelHilo.filter((c) => c.origenAtencionId === atencion.id),
        ]
          .map((registro) => ({ registro, directo: true }))
          .concat(
            accesorios
              .filter(
                (r) => r.atencionId === atencion.id && !vinculados.includes(r) && r.diagnosticoId === null,
              )
              .map((registro) => ({ registro, directo: false })),
          )
          .sort((a, b) => porFecha(a.registro, b.registro)),
      }));

    const sueltos = directos
      .filter((r) => r.atencionId === null || !atencionesConocidas.has(r.atencionId))
      .filter((r) => !descartadoEnElCamino(r, final))
      .sort(porFecha)
      .map((registro) => ({ registro, directo: true }));

    const descartados = cadena.filter((d) => descartadoEnElCamino(d, final)).sort(porFecha);
    const estado = final.estado ?? 'en-estudio';
    const fechas = [...directos, ...controlesDelHilo]
      .flatMap((r) => [r.cuando, r.decididoEl, r.resueltoEl])
      .filter((f): f is Date => f !== null)
      .map((f) => f.getTime());

    episodios.push({
      id: final.id,
      clase: estado === 'descartado' ? 'descartado' : estado === 'resuelto' ? 'cerrado' : 'vigente',
      titulo: final.nombre,
      estado,
      ...SELLO[estado],
      desde: fechas.length === 0 ? null : new Date(Math.min(...fechas)),
      hasta: fechas.length === 0 ? null : new Date(Math.max(...fechas)),
      atenciones,
      descartados,
      sueltos,
      pasos: narracion([...atenciones.map((a) => a.registro), ...directos, ...controlesDelHilo], porId),
    });
  }

  const orden = (a: Episodio, b: Episodio): number =>
    (b.hasta?.getTime() ?? 0) - (a.hasta?.getTime() ?? 0);

  return {
    episodios: [
      ...episodios.filter((e) => e.clase === 'vigente').sort(orden),
      ...episodios.filter((e) => e.clase === 'cerrado').sort(orden),
    ],
    descartados: episodios.filter((e) => e.clase === 'descartado').sort(orden),
    otras: otrasConsultas(registros, atencionesConocidas, atencionesUsadas, accesoriosUsados),
  };
}

/** Un descartado que no es el final de su cadena: va plegado en el hilo. */
function descartadoEnElCamino(registro: RegistroConVinculos, final: RegistroConVinculos): boolean {
  return registro.tipo === 'diagnostico' && registro.id !== final.id && registro.estado === 'descartado';
}

/** Sigue `reemplazadoPorId` hasta el último diagnóstico conocido. Corta ciclos. */
function finalDeCadena(
  diagnostico: RegistroConVinculos,
  porId: ReadonlyMap<string, RegistroConVinculos>,
): RegistroConVinculos {
  const vistos = new Set<string>([diagnostico.id]);
  let actual = diagnostico;
  while (actual.reemplazadoPorId !== null) {
    const siguiente = porId.get(actual.reemplazadoPorId);
    if (siguiente === undefined || siguiente.tipo !== 'diagnostico' || vistos.has(siguiente.id)) break;
    vistos.add(siguiente.id);
    actual = siguiente;
  }
  return actual;
}

function otrasConsultas(
  registros: readonly RegistroConVinculos[],
  atencionesConocidas: ReadonlyMap<string, RegistroConVinculos>,
  atencionesUsadas: ReadonlySet<string>,
  accesoriosUsados: ReadonlySet<string>,
): Episodio | null {
  const libres = [...atencionesConocidas.values()].filter((a) => !atencionesUsadas.has(a.id)).sort(porFecha);
  const sinAtencion = registros
    .filter(
      (r) =>
        (r.tipo === 'estudio' || r.tipo === 'receta') &&
        !accesoriosUsados.has(r.id) &&
        (r.atencionId === null || !atencionesConocidas.has(r.atencionId)),
    )
    .sort(porFecha);
  if (libres.length === 0 && sinAtencion.length === 0) return null;

  const atenciones = libres.map((atencion) => ({
    registro: atencion,
    hechos: registros
      .filter(
        (r) =>
          ((r.tipo === 'estudio' || r.tipo === 'receta') && r.atencionId === atencion.id) ||
          (r.tipo === 'control' && r.origenAtencionId === atencion.id),
      )
      .sort(porFecha)
      .map((registro) => ({ registro, directo: true })),
  }));
  const todos = [...libres, ...atenciones.flatMap((a) => a.hechos.map((h) => h.registro)), ...sinAtencion];
  const fechas = todos.map((r) => r.cuando?.getTime()).filter((t): t is number => t !== undefined);
  const porId = new Map(registros.map((r) => [r.id, r]));

  return {
    id: 'otras-consultas',
    clase: 'otras',
    titulo: 'Otras consultas',
    estado: null,
    sello: 'Sin diagnóstico asociado',
    tono: 'info',
    desde: fechas.length === 0 ? null : new Date(Math.min(...fechas)),
    hasta: fechas.length === 0 ? null : new Date(Math.max(...fechas)),
    atenciones,
    descartados: [],
    sueltos: sinAtencion.map((registro) => ({ registro, directo: true })),
    pasos: narracion(todos, porId),
  };
}

/* ---- la narración -------------------------------------------------------- */

/** Un paso con lo que hace falta para ordenarlo. */
interface PasoOrdenable extends PasoNarrado {
  readonly cuando: Date | null;
  readonly peso: number;
}

/**
 * La historia del hilo en frases de plantilla, en orden de fecha.
 *
 * Cada frase sale de **un** registro y lo nombra (`registroId`): así la
 * pantalla puede llevar a quien lee al registro que respalda lo que acaba de
 * leer. No hay frase que no tenga un registro detrás.
 */
export function narracion(
  registros: readonly RegistroConVinculos[],
  porId: ReadonlyMap<string, RegistroConVinculos>,
): readonly PasoNarrado[] {
  const nombre = (id: string | null): string | null => (id === null ? null : (porId.get(id)?.nombre ?? null));
  const atencionDe = (r: RegistroConVinculos): string | null =>
    r.tipo === 'control' ? r.origenAtencionId : r.atencionId;
  const pasos: PasoOrdenable[] = [];
  const paso = (r: RegistroConVinculos, cuando: Date | null, peso: number, texto: string): void => {
    pasos.push({ texto, registroId: r.id, atencionId: atencionDe(r), cuando, peso });
  };

  for (const r of registros) {
    switch (r.tipo) {
      case 'atencion':
        paso(
          r,
          r.cuando,
          0,
          conFecha(r.cuando, `consultó por ${minusculaInicial(r.nombre)}.`) +
            (r.enCurso ? ' La atención sigue abierta.' : ''),
        );
        break;
      case 'diagnostico':
        pasosDelDiagnostico(r, nombre, paso);
        break;
      case 'estudio': {
        const para = nombre(r.diagnosticoId);
        paso(
          r,
          r.cuando,
          2,
          `Le pidieron ${r.nombre}${para === null ? '' : ` por ${para}`}.` +
            (r.conResultado ? ' El resultado ya está disponible.' : ''),
        );
        break;
      }
      case 'receta': {
        const para = nombre(r.diagnosticoId);
        paso(r, r.cuando, 4, `Le recetaron ${r.nombre}${para === null ? '' : ` para ${para}`}.`);
        break;
      }
      case 'control':
        paso(r, r.cuando, 7, fraseDelControl(r));
        break;
    }
  }

  return pasos
    .sort((a, b) => compararInstantes(a.cuando, b.cuando) || a.peso - b.peso)
    .map(({ texto, registroId, atencionId }) => ({ texto, registroId, atencionId }));
}

function pasosDelDiagnostico(
  r: RegistroConVinculos,
  nombre: (id: string | null) => string | null,
  paso: (r: RegistroConVinculos, cuando: Date | null, peso: number, texto: string) => void,
): void {
  const decidido = r.estado === 'confirmado' || r.estado === 'descartado';
  const conDecision = decidido && r.decididoEl !== null;
  const anotadoComoPosible = r.estado === 'en-estudio' || conDecision || r.estado === 'descartado';

  paso(
    r,
    r.cuando,
    1,
    anotadoComoPosible
      ? `Se anotó ${r.nombre} como posible diagnóstico${r.estado === 'en-estudio' ? ', todavía en estudio' : ''}.`
      : `Se registró el diagnóstico ${r.nombre}.`,
  );

  if (r.estado === 'confirmado' && r.decididoEl !== null) {
    const con = nombre(r.evidenciaEstudioId);
    paso(r, r.decididoEl, 5, conFecha(r.decididoEl, `se confirmó ${r.nombre}${con === null ? '' : ` con su estudio de ${con}`}.`));
  }
  if (r.estado === 'descartado') {
    const enSuLugar = nombre(r.reemplazadoPorId);
    paso(
      r,
      r.decididoEl ?? r.cuando,
      5,
      conFecha(r.decididoEl, `se descartó ${r.nombre}${enSuLugar === null ? '' : `; en su lugar quedó ${enSuLugar}`}.`),
    );
  }
  if (r.resueltoEl !== null) {
    paso(r, r.resueltoEl, 6, conFecha(r.resueltoEl, `${r.nombre} se dio por resuelto.`));
  }
}

function fraseDelControl(r: RegistroConVinculos): string {
  const dia = r.cuando === null ? null : DIA_LARGO.format(r.cuando);
  switch (r.estadoDelControl) {
    case 'realizado':
      return conFecha(r.cuando, 'volvió a control.');
    case 'proximo':
      return dia === null ? 'Tiene un control pendiente.' : `Tiene control el ${dia}.`;
    case 'no-realizado':
      return dia === null ? 'Un control agendado no se realizó.' : `El control del ${dia} no se realizó.`;
    default:
      return dia === null ? 'Se agendó un control.' : `Se agendó un control para el ${dia}.`;
  }
}

/* ---- redacción ----------------------------------------------------------- */

/** «3 de febrero de 2026». */
const DIA_LARGO = new Intl.DateTimeFormat('es-BO', { day: 'numeric', month: 'long', year: 'numeric' });

/** «El 3 de febrero de 2026 se confirmó…», o «Se confirmó…» sin fecha. */
export function conFecha(cuando: Date | null, resto: string): string {
  if (cuando === null || Number.isNaN(cuando.getTime())) return mayusculaInicial(resto);
  return `El ${DIA_LARGO.format(cuando)} ${resto}`;
}

function mayusculaInicial(texto: string): string {
  return texto.charAt(0).toLocaleUpperCase('es') + texto.slice(1);
}

/**
 * «Dolor de cabeza» → «dolor de cabeza», para que entre en la frase. Una sigla
 * («HTA», «ECG») se deja como está: la segunda letra en mayúscula lo delata.
 */
function minusculaInicial(texto: string): string {
  const segunda = texto.charAt(1);
  if (segunda !== '' && segunda === segunda.toLocaleUpperCase('es') && segunda !== segunda.toLocaleLowerCase('es')) {
    return texto;
  }
  return texto.charAt(0).toLocaleLowerCase('es') + texto.slice(1);
}

/** Más viejo primero; sin fecha, al final. */
function porFecha(a: RegistroConVinculos, b: RegistroConVinculos): number {
  return compararInstantes(a.cuando, b.cuando);
}

function compararInstantes(a: Date | null, b: Date | null): number {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
  return a.getTime() - b.getTime();
}
