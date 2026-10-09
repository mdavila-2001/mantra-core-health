import { fechaHoraParaCuf, generarCuf } from './cuf';
import { empaquetarXml } from './packaging';
import { ESQUEMA_COMPRA_VENTA } from './siat-schema';
import { construirXmlFactura, type FacturaXml } from './invoice-xml';
import type { ContextoFiscal, RespuestaRecepcion, SolicitudRecepcionFactura } from './fiscal-provider.port';
import { horaDeBolivia, SiatSimuladoAdapter, type ContribuyenteSimulado } from './siat-simulated.adapter';

const CONTRIBUYENTE: ContribuyenteSimulado = {
  nit: '9990000011',
  razonSocial: 'CONTRIBUYENTE DE PRUEBA (SIMULADO)',
  codigoSistema: 'SIM-PRUEBA',
  direccion: 'CALLE FICTICIA 1 (SIMULADO)',
  sucursales: [0],
  puntosDeVenta: [0],
  sectoresHabilitados: [1, 17],
};

const CONTEXTO: ContextoFiscal = {
  nit: CONTRIBUYENTE.nit,
  codigoSistema: CONTRIBUYENTE.codigoSistema,
  codigoSucursal: 0,
  codigoPuntoVenta: 0,
  codigoModalidad: 2,
};

function codigos(respuesta: RespuestaRecepcion): number[] {
  return respuesta.mensajesList.map((m) => m.codigo);
}

describe('SiatSimuladoAdapter', () => {
  let ahora: Date;
  let siat: SiatSimuladoAdapter;
  let cuis: string;
  let cufd: { codigo: string; codigoControl: string };

  beforeEach(() => {
    ahora = new Date('2026-09-15T14:00:00.000Z');
    siat = new SiatSimuladoAdapter({ padron: [CONTRIBUYENTE], reloj: () => ahora });
    cuis = siat.solicitudCuis(CONTEXTO).codigo!;
    const r = siat.solicitudCufd({ ...CONTEXTO, cuis });
    cufd = { codigo: r.codigo!, codigoControl: r.codigoControl! };
  });

  /** Una factura coherente de un renglón: 2 × 50,00 − 0 = 100,00. */
  function factura(numeroFactura: number, cambios: Partial<Record<string, string | number | null>> = {}): FacturaXml {
    const fechaEmision = horaDeBolivia(ahora);
    const cuf = generarCuf(
      {
        nit: CONTRIBUYENTE.nit,
        fechaHora: fechaHoraParaCuf(fechaEmision),
        sucursal: 0,
        modalidad: 2,
        tipoEmision: 1,
        tipoFactura: 1,
        tipoDocumentoSector: 1,
        numeroFactura,
        puntoVenta: 0,
      },
      cufd.codigoControl,
    );
    return {
      cabecera: {
        nitEmisor: CONTRIBUYENTE.nit,
        razonSocialEmisor: CONTRIBUYENTE.razonSocial,
        municipio: 'Santa Cruz',
        telefono: null,
        numeroFactura,
        cuf,
        cufd: cufd.codigo,
        codigoSucursal: 0,
        direccion: CONTRIBUYENTE.direccion,
        codigoPuntoVenta: 0,
        fechaEmision,
        nombreRazonSocial: 'COMPRADOR DE PRUEBA',
        codigoTipoDocumentoIdentidad: 1,
        numeroDocumento: '1234567',
        complemento: null,
        codigoCliente: 'CLI-1',
        codigoMetodoPago: 1,
        numeroTarjeta: null,
        montoTotal: '100.00',
        montoTotalSujetoIva: '100.00',
        codigoMoneda: 1,
        tipoCambio: '1',
        montoTotalMoneda: '100.00',
        montoGiftCard: null,
        descuentoAdicional: null,
        codigoExcepcion: null,
        cafc: null,
        leyenda: 'Leyenda de prueba (simulada)',
        usuario: 'prueba',
        codigoDocumentoSector: 1,
        ...cambios,
      },
      detalle: [
        {
          actividadEconomica: 'SIM0001',
          codigoProductoSin: 99100001,
          codigoProducto: 'P-1',
          descripcion: 'PRODUCTO DE PRUEBA',
          cantidad: '2',
          unidadMedida: 1,
          precioUnitario: '50.00',
          montoDescuento: null,
          subTotal: '100.00',
          numeroSerie: null,
          numeroImei: null,
        },
      ],
    };
  }

  function solicitud(xml: string, cambios: Partial<SolicitudRecepcionFactura> = {}): SolicitudRecepcionFactura {
    const paquete = empaquetarXml(xml);
    return {
      ...CONTEXTO,
      cuis,
      cufd: cufd.codigo,
      codigoDocumentoSector: 1,
      codigoEmision: 1,
      tipoFacturaDocumento: 1,
      archivo: paquete.archivo,
      fechaEnvio: horaDeBolivia(ahora),
      hashArchivo: paquete.hashArchivo,
      ...cambios,
    };
  }

  function enviar(f: FacturaXml, cambios: Partial<SolicitudRecepcionFactura> = {}): RespuestaRecepcion {
    return siat.recepcionFactura(solicitud(construirXmlFactura(ESQUEMA_COMPRA_VENTA, f), cambios));
  }

  describe('CUIS y CUFD', () => {
    it('el CUIS vale 365 días y un segundo pedido vigente responde 980', () => {
      const otro = new SiatSimuladoAdapter({ padron: [CONTRIBUYENTE], reloj: () => ahora });
      const primero = otro.solicitudCuis(CONTEXTO);
      expect(primero.transaccion).toBe(true);
      expect(new Date(primero.fechaVigencia!).getTime() - ahora.getTime()).toBe(365 * 86_400_000);
      const segundo = otro.solicitudCuis(CONTEXTO);
      expect(segundo.transaccion).toBe(false);
      expect(segundo.mensajesList.map((m) => m.codigo)).toEqual([980]);
    });

    it('NIT fuera del padrón → 919; modalidad Electrónica → 917 (CA-2)', () => {
      expect(siat.solicitudCuis({ ...CONTEXTO, nit: '1' }).mensajesList.map((m) => m.codigo)).toEqual([919]);
      expect(siat.solicitudCuis({ ...CONTEXTO, codigoModalidad: 1 }).mensajesList.map((m) => m.codigo)).toContain(917);
    });

    it('el CUFD vale 24 h, trae codigoControl hexadecimal y exige un CUIS válido', () => {
      const r = siat.solicitudCufd({ ...CONTEXTO, cuis });
      expect(new Date(r.fechaVigencia!).getTime() - ahora.getTime()).toBe(86_400_000);
      expect(r.codigoControl).toMatch(/^[0-9A-F]{15}$/);
      expect(r.direccion).toBe(CONTRIBUYENTE.direccion);
      expect(siat.solicitudCufd({ ...CONTEXTO, cuis: 'NOEXISTE' }).mensajesList.map((m) => m.codigo)).toEqual([913]);
    });

    it('sincroniza la hora de Bolivia (UTC−4) con el formato de fechaEmision', () => {
      expect(siat.sincronizarFechaHora().fechaHora).toBe('2026-09-15T10:00:00.000');
    });
  });

  describe('recepcionFactura', () => {
    it('una factura coherente queda VALIDADA (908) con código de recepción simulado', () => {
      const r = enviar(factura(1));
      expect(r.codigoEstado).toBe(908);
      expect(r.codigoDescripcion).toBe('Recepción Validada');
      expect(r.transaccion).toBe(true);
      expect(r.codigoRecepcion).toMatch(/^SIMREC-/);
      expect(r.mensajesList).toEqual([]);
      expect(r.simulated).toBe(true);
    });

    it('un salto en la numeración queda OBSERVADA (904) con la advertencia 2000', () => {
      enviar(factura(1));
      const r = enviar(factura(3));
      expect(r.codigoEstado).toBe(904);
      expect(r.transaccion).toBe(true);
      expect(r.mensajesList).toEqual([expect.objectContaining({ codigo: 2000, advertencia: true })]);
    });

    it('hash que no corresponde al gzip → RECHAZADA (902) con 920', () => {
      const r = siat.recepcionFactura({
        ...solicitud(construirXmlFactura(ESQUEMA_COMPRA_VENTA, factura(1))),
        hashArchivo: 'a'.repeat(64),
      });
      expect(r.codigoEstado).toBe(902);
      expect(r.transaccion).toBe(false);
      expect(codigos(r)).toEqual([920]);
    });

    it('XML que no cumple el esquema → 902 con 939', () => {
      const xml = construirXmlFactura(ESQUEMA_COMPRA_VENTA, factura(1)).replace('<municipio>Santa Cruz</municipio>', '');
      expect(codigos(siat.recepcionFactura(solicitud(xml)))).toEqual([939]);
    });

    it('CUF que no se deriva de la factura → 1002; CUF repetido → 1000', () => {
      const alterada = factura(1, { cuf: 'ABC123' });
      expect(codigos(enviar(alterada))).toContain(1002);
      enviar(factura(1));
      expect(codigos(enviar(factura(1)))).toContain(1000);
    });

    it('montos incoherentes → 1018 (subtotal), 1013 (total), 1058 (sujeto a IVA)', () => {
      const f = factura(1, { montoTotal: '90.00', montoTotalSujetoIva: '80.00', montoTotalMoneda: '90.00' });
      const conSubtotalMalo: FacturaXml = { ...f, detalle: [{ ...f.detalle[0]!, subTotal: '99.00' }] };
      expect(codigos(enviar(conSubtotalMalo))).toEqual(expect.arrayContaining([1018, 1013, 1058]));
    });

    it('descuento adicional coherente se acepta (como el XML de ejemplo oficial: 100 − 1 = 99)', () => {
      const r = enviar(
        factura(1, { descuentoAdicional: '1.00', montoTotal: '99.00', montoTotalSujetoIva: '99.00', montoTotalMoneda: '99.00' }),
      );
      expect(r.codigoEstado).toBe(908);
    });

    it('CUFD vencido (25 h después) → 953', () => {
      const f = factura(1);
      ahora = new Date(ahora.getTime() + 25 * 3_600_000);
      expect(codigos(enviar(f))).toContain(953);
    });

    it('sector 17 (preparado, no activo · CA-1) → 940; sector desconocido → 931', () => {
      expect(codigos(enviar(factura(1), { codigoDocumentoSector: 17 }))).toContain(940);
      expect(codigos(enviar(factura(1), { codigoDocumentoSector: 99 }))).toContain(931);
    });

    it('emisión fuera de línea (contingencia, CA-6) → 916', () => {
      expect(codigos(enviar(factura(1), { codigoEmision: 2 }))).toContain(916);
    });

    it('la directiva de simulación fuerza una rama con un código del catálogo, marcado como forzado', () => {
      const xml = construirXmlFactura(ESQUEMA_COMPRA_VENTA, factura(1));
      const rechazo = siat.recepcionFactura(solicitud(xml), { forzarMensaje: 1013 });
      expect(rechazo.codigoEstado).toBe(902);
      expect(rechazo.mensajesList).toEqual([expect.objectContaining({ codigo: 1013, forzadoPorSimulacion: true })]);
      const observacion = siat.recepcionFactura(solicitud(xml), { forzarMensaje: 2005 });
      expect(observacion.codigoEstado).toBe(904);
    });

    it('un código fuera del catálogo del simulador no se fuerza', () => {
      const r = siat.recepcionFactura(solicitud(construirXmlFactura(ESQUEMA_COMPRA_VENTA, factura(1))), { forzarMensaje: 4242 });
      expect(r.codigoEstado).toBe(908);
    });
  });

  describe('verificación, anulación y reversión', () => {
    function base(cuf: string) {
      return { ...CONTEXTO, cuis, cufd: cufd.codigo, codigoDocumentoSector: 1, codigoEmision: 1, tipoFacturaDocumento: 1, cuf };
    }

    it('verificación devuelve el estado registrado; un CUF desconocido → 924', () => {
      const f = factura(1);
      enviar(f);
      const cuf = String(f.cabecera['cuf']);
      expect(siat.verificacionEstadoFactura(base(cuf)).codigoEstado).toBe(908);
      expect(codigos(siat.verificacionEstadoFactura(base('NOEXISTE')))).toEqual([924]);
    });

    it('anular → 905; anular otra vez → 906 con 936; motivo fuera del catálogo → 925', () => {
      const f = factura(1);
      enviar(f);
      const cuf = String(f.cabecera['cuf']);
      expect(codigos(siat.anulacionFactura({ ...base(cuf), codigoMotivo: 99 }))).toEqual([925]);
      expect(siat.anulacionFactura({ ...base(cuf), codigoMotivo: 1 }).codigoEstado).toBe(905);
      expect(siat.verificacionEstadoFactura(base(cuf)).codigoEstado).toBe(905);
      const otra = siat.anulacionFactura({ ...base(cuf), codigoMotivo: 1 });
      expect(otra.codigoEstado).toBe(906);
      expect(codigos(otra)).toEqual([936]);
    });

    it('la anulación vence el día 9 del mes siguiente (hora de Bolivia) → 934', () => {
      const f = factura(1);
      enviar(f);
      const cuf = String(f.cabecera['cuf']);
      ahora = new Date('2026-10-10T04:00:00.000Z'); // 10/10 00:00 en Bolivia
      expect(codigos(siat.anulacionFactura({ ...base(cuf), codigoMotivo: 1 }))).toEqual([934]);
    });

    it('el día 9 a las 23:59 de Bolivia todavía se puede anular', () => {
      const f = factura(1);
      enviar(f);
      const cuf = String(f.cabecera['cuf']);
      ahora = new Date('2026-10-10T03:59:00.000Z'); // 09/10 23:59 en Bolivia
      expect(siat.anulacionFactura({ ...base(cuf), codigoMotivo: 1 }).codigoEstado).toBe(905);
    });

    it('revertir una sola vez → 907, luego 909; y lo revertido no se vuelve a anular (941)', () => {
      const f = factura(1);
      enviar(f);
      const cuf = String(f.cabecera['cuf']);
      expect(siat.reversionAnulacionFactura(base(cuf)).codigoEstado).toBe(909); // no está anulada
      siat.anulacionFactura({ ...base(cuf), codigoMotivo: 1 });
      expect(siat.reversionAnulacionFactura(base(cuf)).codigoEstado).toBe(907);
      expect(siat.verificacionEstadoFactura(base(cuf)).codigoEstado).toBe(908);
      expect(siat.reversionAnulacionFactura(base(cuf)).codigoEstado).toBe(909);
      expect(codigos(siat.anulacionFactura({ ...base(cuf), codigoMotivo: 1 }))).toEqual([941]);
    });
  });

  it('toda respuesta declara que es simulada', () => {
    const f = factura(1);
    const respuestas = [
      siat.solicitudCuis(CONTEXTO),
      siat.solicitudCufd({ ...CONTEXTO, cuis }),
      siat.sincronizarFechaHora(),
      siat.sincronizarParametricas(),
      enviar(f),
    ];
    for (const r of respuestas) expect(r.simulated).toBe(true);
    expect(siat.ambiente).toBe('SIMULADO');
  });
});
