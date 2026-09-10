import type { PuntoGeo } from '../../../shared/components/organisms/map/pin-mapa.types';

/**
 * **La ficha legal de la farmacia** — las formas que la pantalla dibuja.
 *
 * Ninguna sale del contrato de farmacia: `core/data-access/pharmacy` describe
 * una farmacia con cinco campos —identificador, código, nombre, cuántas
 * sucursales y cuántos productos— y su propio comentario dice que el resto «se
 * agrega cuando alguien lo pida». No hay dato legal, ni documento con vigencia,
 * ni representante, ni gerentes. Así que se declaran **acá, junto a la pantalla
 * que los dibuja**, y no en `core/`: escribir el DTO allá sería declarar un
 * contrato que el backend no publica.
 *
 * TODO(T-I1): cuando la API publique el perfil de la farmacia, estos tipos se
 * mudan al contrato y `pharmacy-profile.fixtures.ts` se queda sólo con los
 * ejemplos de las pruebas.
 */

/* ─── La empresa ─────────────────────────────────────────────────────────── */

/**
 * Los ocho tipos de sociedad, **literales del registro del cliente y en su
 * orden**.
 *
 * La lista es cerrada y sin texto libre porque el valor no es un rótulo: la
 * plataforma cuenta cuántos proveedores hay de cada tipo, y una empresa que
 * escriba «S.R.L.» a mano deja de sumar con las que escribieron «SRL». La razón
 * la dio el propio cliente al pedir el campo.
 *
 * Cuando el backend publique el value set, esto pasa a ser un `*_concept_id` y
 * las opciones salen del catálogo de terminología, no de acá.
 */
export const TIPOS_DE_SOCIEDAD = [
  'UNIPERSONAL',
  'SRL',
  'LTDA',
  'S.A.',
  'SOCIEDAD COLECTIVA',
  'SOCIEDAD EN COMANDITA SIMPLE',
  'SOCIEDAD EN COMANDITA POR ACCIONES',
  'SUCURSAL DE SOCIEDAD EXTRANJERA',
] as const;

/** Uno de los ocho de arriba: el tipo sale de la lista, no al revés. */
export type TipoDeSociedad = (typeof TIPOS_DE_SOCIEDAD)[number];

/**
 * Los datos legales de la empresa: razón social, tipo, NIT, dirección y punto.
 *
 * El nombre lleva «legales» y no es adorno: lo distingue del componente que los
 * dibuja, que se llama por la pestaña donde vive.
 */
export interface DatosLegalesDeLaEmpresa {
  readonly razonSocial: string;
  /** `null` mientras nadie haya elegido uno de los ocho. */
  readonly tipoDeSociedad: TipoDeSociedad | null;
  /** Texto y no número: un NIT es un identificador, no una cifra que se sume. */
  readonly nit: string;
  /** La dirección legal de la central, tal como figura en el registro. */
  readonly direccionLegal: string;
  /** El punto de la central en el mapa; `null` mientras no se haya marcado. */
  readonly puntoCentral: PuntoGeo | null;
}

/* ─── Los documentos legales ─────────────────────────────────────────────── */

/**
 * Los seis papeles que el registro del cliente pide, en su orden.
 *
 * La lista existe aparte de los documentos cargados porque son dos cosas
 * distintas: esto es **lo que hay que presentar**, y un documento es uno de
 * estos ya presentado. De acá sale lo que se puede agregar a una carpeta:
 * agregar un papel es cargar uno de los seis que todavía falta, nunca inventar
 * un trámite nuevo.
 */
export const PAPELES_DEL_REGISTRO = [
  { clave: 'constitucion', nombre: 'Constitución de la empresa' },
  { clave: 'nit', nombre: 'NIT' },
  { clave: 'seprec', nombre: 'SEPREC' },
  { clave: 'licencia-de-funcionamiento', nombre: 'Licencia de funcionamiento' },
  { clave: 'certificado-sedes', nombre: 'Certificado SEDES' },
  { clave: 'poder-del-representante', nombre: 'Poder del representante legal' },
] as const;

/**
 * En qué anda la revisión de un documento.
 *
 * **Son dos, y «vencido» no es uno de ellos.** La vigencia y la revisión son
 * hechos distintos: un papel verificado que caducó sigue estando verificado
 * —alguien lo miró y dijo que era el papel que decía ser—, y lo que le pasó es
 * que se le terminó el plazo. Con «vencido» dentro de esta lista, ese documento
 * tenía que elegir cuál de los dos hechos contar, y el otro se perdía. Cada
 * distintivo dice uno solo: el plazo lo dice el de al lado.
 *
 * Los dos son **provisionales**: la API todavía no publica este estado, así que
 * quién revisa y con qué criterio está sin definir. La pantalla lo dice en vez
 * de disimularlo.
 */
export type EstadoDeVerificacion = 'PENDIENTE' | 'VERIFICADO';

/** Un papel de la carpeta legal: el archivo, desde cuándo vale y hasta cuándo. */
export interface DocumentoLegal {
  /**
   * Con qué se identifica la fila. Es una clave corta y legible —nunca un
   * identificador técnico—: nada de esta pantalla debe poder filtrar un uuid.
   * Es la misma clave con la que el papel figura en {@link PAPELES_DEL_REGISTRO}.
   */
  readonly clave: string;
  /** Cómo se llama el documento para quien lo busca en un cajón. */
  readonly nombre: string;
  /** El nombre del PDF cargado, tal como se muestra y como se descargaría. */
  readonly archivo: string;
  /**
   * Las fechas del papel, o `null` cuando todavía nadie las declaró — el caso
   * de un documento recién cargado, que ya existe antes de que alguien
   * transcriba su emisión y su vencimiento.
   */
  readonly emitidoEl: Date | null;
  readonly venceEl: Date | null;
  /**
   * Cuántos días faltan para que caduque, en negativo si ya caducó, y `null`
   * mientras el papel no tenga vencimiento declarado.
   *
   * **Se declara, no se calcula del reloj de quien mira.** Es la misma decisión
   * que la ficha de organización médica dejó escrita para su API: el reloj del
   * navegador daría un resultado distinto por pantalla, y el aviso de
   * vencimiento tiene que ser el mismo para todos.
   */
  readonly diasParaVencer: number | null;
  readonly verificacion: EstadoDeVerificacion;
}

/* ─── La gente de la empresa ─────────────────────────────────────────────── */

/**
 * Una persona de la empresa y cómo se la ubica.
 *
 * Es la misma forma para el representante legal y para los tres gerentes: lo
 * único que cambia entre ellos es el cargo y qué datos trae cada uno.
 */
export interface ContactoDeLaEmpresa {
  /** «Gerente Comercial», «Representante legal». Cargo, nunca un rol técnico. */
  readonly cargo: string;
  readonly nombre: string;
  /** Texto, y `null` cuando el cargo no declara celular. */
  readonly celular: string | null;
  readonly correo: string;
}

/** La gente de la ficha: quien firma por la empresa y quienes la gestionan. */
export interface GenteDeLaEmpresa {
  readonly representante: ContactoDeLaEmpresa;
  readonly gerentes: readonly ContactoDeLaEmpresa[];
}
