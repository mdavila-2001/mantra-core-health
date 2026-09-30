/* ============================================================================
    Los esquemas de los documentos sector que conoce el simulador.

    Transcritos **a mano y en orden** de los XSD oficiales del SIN, modalidad
    Computarizada en Línea (D-FACT-SIAT, CA-2):

    - Compra y Venta (sector 1): `CompraVentaXML.zip`
      sha256 bd64249dd0e6a6527dc44c06e785888c20287df8948a65c1ad7093d3c9d99867
    - Hospitales/Clínicas (sector 17): `HospitalClinicaXML.zip`
      sha256 2b4596d0c6637157e8ea5f5b388f2e77818b0008aba2d07b2d36ce71ddc667a6

    ambos de https://siatinfo.impuestos.gob.bo/images/archivos_tecnicos/archivos_apoyo/
    (descargados el 2026-09-26). El orden importa: el XSD usa `xs:sequence`.

    El simulador **no** ejecuta el XSD —no hay validador de esquemas en el
    navegador—: comprueba lo que estas tablas declaran (orden, obligatoriedad,
    tipo, rango y longitud). El SIN real aplica el XSD completo.
    ========================================================================== */

export type TipoCampoXsd = 'integer' | 'string' | 'decimal' | 'dateTime';

export interface CampoXsd {
  readonly nombre: string;
  readonly tipo: TipoCampoXsd;
  /** `nillable="true"`: puede ir como `<campo xsi:nil="true"/>`. */
  readonly nillable: boolean;
  /** Enteros con `bigint` cuando el XSD supera `Number.MAX_SAFE_INTEGER`. */
  readonly min?: number | bigint;
  readonly max?: number | bigint;
  readonly minLength?: number;
  readonly maxLength?: number;
  /** `fixed="…"`: el único valor admitido. */
  readonly fijo?: string;
}

export interface EsquemaDocumentoSector {
  readonly codigoDocumentoSector: number;
  readonly nombre: string;
  /** Elemento raíz en Computarizada en Línea (modalidad 2). */
  readonly raizComputarizada: string;
  /** Elemento raíz en Electrónica en Línea (modalidad 1): lleva firma, no se simula. */
  readonly raizElectronica: string;
  readonly cabecera: readonly CampoXsd[];
  readonly detalle: readonly CampoXsd[];
  readonly detalleMaximo: number;
  /**
   * `false` = transcrito y documentado, pero el simulador no emite en este
   * sector (ver {@link motivoInactivo}).
   */
  readonly activo: boolean;
  readonly motivoInactivo: string | null;
}

// ---- tipos repetidos del XSD ---------------------------------------------

const MONTO = { tipo: 'decimal' } as const;
const MONTO_NO_NEGATIVO = { tipo: 'decimal', min: 0 } as const;
const texto = (minLength: number, maxLength: number) => ({ tipo: 'string', minLength, maxLength }) as const;
const entero = (min: number | bigint, max: number | bigint) => ({ tipo: 'integer', min, max }) as const;

function campo(nombre: string, forma: Omit<CampoXsd, 'nombre' | 'nillable'>, nillable = false): CampoXsd {
  return { nombre, nillable, ...forma };
}

/** La cabecera común, con el hueco donde el sector 17 inserta `modalidadServicio`. */
function cabecera(codigoDocumentoSector: number, extrasAntesDelMetodoDePago: readonly CampoXsd[]): readonly CampoXsd[] {
  return [
    campo('nitEmisor', entero(1, 9_999_999_999_999)),
    campo('razonSocialEmisor', texto(1, 200)),
    campo('municipio', texto(1, 25)),
    campo('telefono', texto(1, 25), true),
    campo('numeroFactura', entero(1, 9_999_999_999)),
    campo('cuf', texto(1, 100)),
    campo('cufd', texto(1, 100)),
    campo('codigoSucursal', entero(0, 9999)),
    campo('direccion', texto(1, 500)),
    campo('codigoPuntoVenta', entero(0, 9999), true),
    campo('fechaEmision', { tipo: 'dateTime' }),
    campo('nombreRazonSocial', texto(1, 500), true),
    campo('codigoTipoDocumentoIdentidad', entero(1, 5)),
    campo('numeroDocumento', texto(1, 20)),
    campo('complemento', texto(0, 5), true),
    campo('codigoCliente', texto(1, 100)),
    ...extrasAntesDelMetodoDePago,
    campo('codigoMetodoPago', entero(1, 308)),
    campo('numeroTarjeta', entero(0, 9_999_999_999_999_999n), true),
    campo('montoTotal', MONTO),
    campo('montoTotalSujetoIva', MONTO_NO_NEGATIVO),
    campo('codigoMoneda', entero(1, 154)),
    campo('tipoCambio', MONTO),
    campo('montoTotalMoneda', MONTO),
    campo('montoGiftCard', MONTO_NO_NEGATIVO, true),
    campo('descuentoAdicional', MONTO_NO_NEGATIVO, true),
    campo('codigoExcepcion', entero(0, 1), true),
    campo('cafc', texto(1, 50), true),
    campo('leyenda', texto(1, 200)),
    campo('usuario', texto(1, 100)),
    campo('codigoDocumentoSector', { tipo: 'integer', fijo: String(codigoDocumentoSector) }),
  ];
}

/** Sector 1 · Factura de Compra y Venta — la de farmacia y la de la consulta ambulatoria (CA-1). */
export const ESQUEMA_COMPRA_VENTA: EsquemaDocumentoSector = {
  codigoDocumentoSector: 1,
  nombre: 'Factura de Compra y Venta',
  raizComputarizada: 'facturaComputarizadaCompraVenta',
  raizElectronica: 'facturaElectronicaCompraVenta',
  cabecera: cabecera(1, []),
  detalle: [
    campo('actividadEconomica', texto(1, 10)),
    campo('codigoProductoSin', entero(1, 99_999_999)),
    campo('codigoProducto', texto(1, 50)),
    campo('descripcion', texto(1, 500)),
    campo('cantidad', MONTO),
    campo('unidadMedida', entero(1, 200)),
    campo('precioUnitario', MONTO),
    campo('montoDescuento', MONTO_NO_NEGATIVO, true),
    campo('subTotal', MONTO),
    campo('numeroSerie', texto(0, 1500), true),
    campo('numeroImei', texto(0, 1500), true),
  ],
  detalleMaximo: 500,
  activo: true,
  motivoInactivo: null,
};

/**
 * Sector 17 · Factura de Hospitales/Clínicas — **preparado, no activo** (CA-1).
 *
 * El XSD exige en cada renglón `nroQuirofanoSalaOperaciones` (1–9999),
 * `nombreApellidoMedico` y `nitDocumentoMedico`, y la fuente oficial no dice
 * qué corresponde para una consulta ambulatoria. Hasta que un contador o
 * producto lo confirme, el simulador no emite en este sector ni inventa esos
 * valores.
 */
export const ESQUEMA_HOSPITAL_CLINICA: EsquemaDocumentoSector = {
  codigoDocumentoSector: 17,
  nombre: 'Factura de Hospitales/Clínicas',
  raizComputarizada: 'facturaComputarizadaHospitalClinica',
  raizElectronica: 'facturaElectronicaHospitalClinica',
  cabecera: cabecera(17, [campo('modalidadServicio', texto(0, 100), true)]),
  detalle: [
    campo('actividadEconomica', texto(1, 10)),
    campo('codigoProductoSin', entero(1, 99_999_999)),
    campo('codigoProducto', texto(1, 50)),
    campo('descripcion', texto(1, 500)),
    campo('especialidad', texto(0, 500), true),
    campo('especialidadDetalle', texto(0, 500), true),
    campo('nroQuirofanoSalaOperaciones', entero(1, 9999)),
    campo('especialidadMedico', texto(0, 500), true),
    campo('nombreApellidoMedico', texto(1, 500)),
    campo('nitDocumentoMedico', entero(1, 9_999_999_999_999)),
    campo('nroMatriculaMedico', texto(0, 50), true),
    campo('nroFacturaMedico', entero(0, 99_999_999), true),
    campo('cantidad', MONTO),
    campo('unidadMedida', entero(1, 200)),
    campo('precioUnitario', MONTO),
    campo('montoDescuento', MONTO_NO_NEGATIVO, true),
    campo('subTotal', MONTO),
  ],
  detalleMaximo: 500,
  activo: false,
  motivoInactivo:
    'Sector 17 preparado pero no activo: faltan confirmar quirófano/sala y NIT del médico para consulta ambulatoria (CA-1).',
};

const ESQUEMAS: readonly EsquemaDocumentoSector[] = [ESQUEMA_COMPRA_VENTA, ESQUEMA_HOSPITAL_CLINICA];

export function esquemaDeSector(codigoDocumentoSector: number): EsquemaDocumentoSector | null {
  return ESQUEMAS.find((e) => e.codigoDocumentoSector === codigoDocumentoSector) ?? null;
}

export function esquemaPorRaiz(raiz: string): EsquemaDocumentoSector | null {
  return ESQUEMAS.find((e) => e.raizComputarizada === raiz) ?? null;
}
