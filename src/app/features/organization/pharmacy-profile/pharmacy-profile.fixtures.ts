import type {
  ContactoDeLaEmpresa,
  DatosDeLaEmpresa,
  DocumentoLegal,
  RepresentanteYGerentes,
} from './pharmacy-profile.types';

/**
 * **Los datos de ejemplo de la ficha de la farmacia.**
 *
 * Todo lo que esta pantalla muestra —los datos legales, la carpeta de
 * documentos, el representante y los gerentes— describe algo que la API
 * todavía no publica. El contrato de farmacia no tiene ninguno de esos campos,
 * así que **no se inventa un campo en `core/`**: se declara acá, junto a la
 * pantalla que lo dibuja, y la pantalla lo rotula como lo que es.
 *
 * Reglas que este archivo respeta y conviene no perder de vista:
 *
 * - **Nada se persiste.** Ni `localStorage` ni un servicio con estado: lo que
 *   se edite en pantalla vive mientras la pantalla viva, y la propia pantalla
 *   lo dice antes de que nadie escriba nada.
 * - **Los números largos son texto.** El NIT y los celulares son
 *   identificadores, no cifras que se sumen.
 * - **Los días para vencer se declaran, no se calculan del reloj.** Si se
 *   derivaran de `new Date()`, la misma pantalla mostraría estados distintos
 *   hoy y mañana, y dejaría de poder mostrarse dos veces igual.
 * - **Lo que se pinta se rotula.** `NOTA_DE_DATOS_DE_EJEMPLO` es el cartel que
 *   acompaña a todo lo que sale de acá.
 *
 * TODO(T-I1): cuando el backend publique el perfil de la farmacia, estos datos
 * se reemplazan por la respuesta de la API y este archivo se queda sólo con los
 * ejemplos de las pruebas.
 */

/**
 * El cartel único: quien mira la pantalla sabe qué parte es maqueta. Es el
 * mismo texto que usa la bandeja del mostrador, a propósito — dos carteles
 * distintos para la misma advertencia se leen como dos cosas distintas.
 */
export const NOTA_DE_DATOS_DE_EJEMPLO = 'Datos de ejemplo';

/* ─── La empresa ─────────────────────────────────────────────────────────── */

export const EMPRESA_DE_EJEMPLO: DatosDeLaEmpresa = {
  razonSocial: 'Farmacia Andina S.R.L.',
  tipoDeSociedad: 'SRL',
  nit: '1028394027',
  direccionLegal: 'Av. Cañoto 245, entre Ayacucho y Sucre · Santa Cruz de la Sierra',
  // La central, sobre la avenida que declara la dirección de arriba: el punto y
  // el texto tienen que decir el mismo lugar.
  puntoCentral: { lat: -17.7863, lng: -63.1812 },
};

/* ─── Los documentos legales ─────────────────────────────────────────────── */

/**
 * El «hoy» de la maqueta, y **no `new Date()`**.
 *
 * De acá salen las fechas de vencimiento, que se derivan de los días
 * declarados en cada documento. Con el reloj real, «vence en 18 días» y la
 * fecha de al lado se separarían un día por cada día que pase, y la pantalla se
 * contradiría sola.
 */
const HOY_DE_LA_MAQUETA = new Date('2026-09-10T12:00:00.000Z');

const MILISEGUNDOS_POR_DIA = 24 * 60 * 60 * 1000;

/** La fecha que cae a `dias` del «hoy» de la maqueta, en negativo hacia atrás. */
function fechaEnDias(dias: number): Date {
  return new Date(HOY_DE_LA_MAQUETA.getTime() + dias * MILISEGUNDOS_POR_DIA);
}

/**
 * Los seis papeles que el registro del cliente pide, en su orden, y con los
 * tres plazos que la ficha tiene que saber decir: uno vencido, uno dentro del
 * mes de aviso y el resto en orden. La fecha de vencimiento sale de los días,
 * así que las dos cifras no se pueden separar.
 */
export const DOCUMENTOS_DE_EJEMPLO: readonly DocumentoLegal[] = [
  {
    clave: 'constitucion',
    nombre: 'Constitución de la empresa',
    archivo: 'constitucion-farmacia-andina.pdf',
    emitidoEl: new Date('2021-03-04T00:00:00.000Z'),
    venceEl: fechaEnDias(512),
    diasParaVencer: 512,
    verificacion: 'VERIFICADO',
  },
  {
    clave: 'nit',
    nombre: 'NIT',
    archivo: 'nit-1028394027.pdf',
    emitidoEl: new Date('2024-11-18T00:00:00.000Z'),
    venceEl: fechaEnDias(268),
    diasParaVencer: 268,
    verificacion: 'VERIFICADO',
  },
  {
    clave: 'seprec',
    nombre: 'SEPREC',
    archivo: 'seprec-matricula-comercio.pdf',
    emitidoEl: new Date('2025-12-15T00:00:00.000Z'),
    venceEl: fechaEnDias(96),
    diasParaVencer: 96,
    verificacion: 'VERIFICADO',
  },
  {
    clave: 'licencia-de-funcionamiento',
    nombre: 'Licencia de funcionamiento',
    archivo: 'licencia-funcionamiento-2026.pdf',
    emitidoEl: new Date('2025-09-28T00:00:00.000Z'),
    venceEl: fechaEnDias(18),
    diasParaVencer: 18,
    // Ya se cargó la renovación y todavía nadie la miró: es el caso que hace
    // falta ver en pantalla para saber que «pendiente» no es «falta».
    verificacion: 'PENDIENTE',
  },
  {
    clave: 'certificado-sedes',
    nombre: 'Certificado SEDES',
    archivo: 'certificado-sedes-2025.pdf',
    emitidoEl: new Date('2024-08-29T00:00:00.000Z'),
    venceEl: fechaEnDias(-12),
    diasParaVencer: -12,
    verificacion: 'VENCIDO',
  },
  {
    clave: 'poder-del-representante',
    nombre: 'Poder del representante legal',
    archivo: 'poder-representante-legal.pdf',
    emitidoEl: new Date('2023-06-07T00:00:00.000Z'),
    venceEl: fechaEnDias(340),
    diasParaVencer: 340,
    verificacion: 'VERIFICADO',
  },
];

/* ─── La gente de la empresa ─────────────────────────────────────────────── */

/**
 * El representante legal va **sin celular**: el registro del cliente le pide
 * nombre, poder en PDF y correo, y nada más. Un campo vacío de más se lee como
 * un dato que falta.
 */
const REPRESENTANTE_DE_EJEMPLO: ContactoDeLaEmpresa = {
  cargo: 'Representante legal',
  nombre: 'María Elena Ortiz Camacho',
  celular: null,
  correo: 'mortiz@farmaciaandina.bo',
};

const GERENTES_DE_EJEMPLO: readonly ContactoDeLaEmpresa[] = [
  {
    cargo: 'Gerente General',
    nombre: 'Jorge Antonio Vaca Suárez',
    celular: '+591 70011223',
    correo: 'gerencia@farmaciaandina.bo',
  },
  {
    cargo: 'Gerente Comercial',
    nombre: 'Lucía Fernanda Roca Mendoza',
    celular: '+591 70011224',
    correo: 'comercial@farmaciaandina.bo',
  },
  {
    cargo: 'Gerente Marketing',
    nombre: 'Diego Alejandro Peña Rojas',
    celular: '+591 70011225',
    correo: 'marketing@farmaciaandina.bo',
  },
];

export const GENTE_DE_EJEMPLO: RepresentanteYGerentes = {
  representante: REPRESENTANTE_DE_EJEMPLO,
  gerentes: GERENTES_DE_EJEMPLO,
};
