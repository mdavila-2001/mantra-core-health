import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import {
  PharmacyCampaignsClient,
  ProductoDeCatalogo,
  ahorroDe,
  estadoDe,
  revisar,
} from './pharmacy-campaigns.client';
import { UN_DIA } from './pharmacy-campaigns.fixtures';
import { aCentavos, conDescuento, porcentajeDeAhorro } from './pharmacy-campaigns.money';
import { BorradorDeCampana, CampanaDeFarmacia } from './pharmacy-campaigns.types';

/**
 * Lo que estas pruebas fijan son **las reglas del carril**, no el mock.
 *
 * Una promoción vencida no entrega precios ni por URL directa; el precio
 * promocional es siempre menor que el de lista; el porcentaje que se muestra
 * es el que se deriva de los dos precios y no uno inventado; y los importes
 * sobreviven a la aritmética sin desviarse un centavo. Cuando el backend
 * reemplace este cliente, estas mismas pruebas tienen que seguir pasando.
 *
 * Corren con la demo **encendida**, que es el default de desarrollo: la rama
 * apagada se verifica en runtime, la misma convención que los otros specs de
 * gates del repo.
 */
const FARMACIA = '7f1c9a52-6d3e-4b18-9c47-2a5e8f0b1d63';
const NOMBRE = 'Farmacia del Centro';

const CATALOGO: readonly ProductoDeCatalogo[] = [
  {
    productId: 'p-1',
    nombre: 'Metformina 850 mg',
    presentacion: 'caja x 30',
    precio: '48.00',
    moneda: 'BOB',
  },
  {
    productId: 'p-2',
    nombre: 'Ibuprofeno 400 mg',
    presentacion: 'caja x 20',
    precio: '22.50',
    moneda: 'BOB',
  },
  {
    productId: 'p-3',
    nombre: 'Paracetamol 500 mg',
    presentacion: 'caja x 16',
    precio: '15.00',
    moneda: 'BOB',
  },
];

function borrador(cambios: Partial<BorradorDeCampana> = {}): BorradorDeCampana {
  const ahora = Date.now();
  return {
    titulo: 'Campaña de prueba',
    descripcion: 'Texto de la campaña.',
    desde: new Date(ahora - UN_DIA),
    hasta: new Date(ahora + UN_DIA),
    tipoDeDescuento: 'PORCENTAJE',
    porcentaje: 20,
    renglones: [
      {
        productId: 'p-1',
        nombre: 'Metformina 850 mg',
        presentacion: 'caja x 30',
        precioNormal: '48.00',
        moneda: 'BOB',
        precioPromocional: null,
      },
    ],
    ...cambios,
  };
}

function campana(desdeEnDias: number, hastaEnDias: number): CampanaDeFarmacia {
  const ahora = Date.now();
  return {
    id: 'x',
    pharmacyId: FARMACIA,
    farmacia: NOMBRE,
    titulo: 'x',
    descripcion: 'x',
    desde: new Date(ahora + desdeEnDias * UN_DIA),
    hasta: new Date(ahora + hastaEnDias * UN_DIA),
    productos: [],
    sembrada: true,
  };
}

describe('la aritmética de importes', () => {
  it('rechaza el texto vacío en vez de leerlo como cero', () => {
    // `Number('')` es 0: sin este corte un campo en blanco sería un precio.
    expect(aCentavos('')).toBeNull();
    expect(aCentavos('   ')).toBeNull();
  });

  it('rechaza importes negativos, con letras o con más de dos decimales', () => {
    expect(aCentavos('-5.00')).toBeNull();
    expect(aCentavos('12,50')).toBeNull();
    expect(aCentavos('10.005')).toBeNull();
  });

  it('no pierde centavos en los importes que un float rompería', () => {
    expect(aCentavos('0.10')).toBe(10);
    expect(aCentavos('1.15')).toBe(115);
    expect(conDescuento('0.10', 50)).toBe('0.05');
  });

  it('redondea el descuento hacia abajo, nunca en contra de quien compra', () => {
    // 33 % de 10.01 son 670,67 centavos: hacia abajo 6.70 (33,07 % de ahorro),
    // al más cercano 6.71 (32,97 %) — menos de lo que anuncia el cartel.
    expect(conDescuento('10.01', 33)).toBe('6.70');
    expect(porcentajeDeAhorro('10.01', '6.70')).toBe(33);
  });

  it('no mueve el precio cuando el porcentaje da centavos exactos', () => {
    expect(conDescuento('10.00', 33)).toBe('6.70');
  });

  it('rechaza porcentajes fuera del rango que la farmacia puede escribir', () => {
    expect(conDescuento('10.00', 0)).toBeNull();
    expect(conDescuento('10.00', 100)).toBeNull();
    expect(conDescuento('10.00', 12.5)).toBeNull();
  });

  it('no deriva un ahorro cuando el precio no baja', () => {
    expect(porcentajeDeAhorro('10.00', '10.00')).toBeNull();
    expect(porcentajeDeAhorro('10.00', '12.00')).toBeNull();
  });
});

describe('la vigencia', () => {
  it('cuenta los dos extremos como dentro de la ventana', () => {
    // Una campaña que termina hoy vale hoy: quien la vio a la mañana no
    // descubre a la tarde que ya no valía.
    const abierta = campana(-1, 1);
    expect(estadoDe(abierta, abierta.desde)).toBe('VIGENTE');
    expect(estadoDe(abierta, abierta.hasta)).toBe('VIGENTE');
  });

  it('distingue programada de terminada', () => {
    expect(estadoDe(campana(2, 5))).toBe('PROGRAMADA');
    expect(estadoDe(campana(-10, -2))).toBe('TERMINADA');
  });

  it('el último día vale entero, no hasta la hora que devolvió el calendario', () => {
    // La farmacia elige los días en un calendario, y el calendario devuelve el
    // **mediodía** (`date-picker.ts:38`). Comparando instantes, la campaña
    // «hasta el 30» moría a las 12:00:01 del 30: media tarde con el cartel
    // puesto y el precio ya vencido. El formulario promete lo contrario.
    const desde = new Date(2026, 7, 1, 12, 0, 0, 0);
    const hasta = new Date(2026, 7, 30, 12, 0, 0, 0);
    const delMesEntero = { ...campana(-1, 1), desde, hasta };

    expect(estadoDe(delMesEntero, new Date(2026, 7, 30, 18, 0))).toBe('VIGENTE');
    expect(estadoDe(delMesEntero, new Date(2026, 7, 30, 23, 59, 59, 999))).toBe('VIGENTE');
    // Y el 31 sí terminó: el día siguiente no se regala.
    expect(estadoDe(delMesEntero, new Date(2026, 7, 31, 0, 0, 0, 0))).toBe('TERMINADA');
  });

  it('el primer día vale entero: a la mañana ya está vigente', () => {
    const desde = new Date(2026, 7, 10, 12, 0, 0, 0);
    const hasta = new Date(2026, 7, 30, 12, 0, 0, 0);
    const desdeElDiez = { ...campana(-1, 1), desde, hasta };

    expect(estadoDe(desdeElDiez, new Date(2026, 7, 10, 0, 0, 0, 0))).toBe('VIGENTE');
    expect(estadoDe(desdeElDiez, new Date(2026, 7, 10, 9, 0))).toBe('VIGENTE');
    // La víspera no: la campaña empieza el 10, no el 9.
    expect(estadoDe(desdeElDiez, new Date(2026, 7, 9, 23, 59, 59, 999))).toBe('PROGRAMADA');
  });
});

describe('la revisión del borrador', () => {
  it('acepta un borrador completo', () => {
    expect(revisar(borrador())).toEqual([]);
  });

  it('junta todos los fallos en vez de devolver el primero', () => {
    const fallos = revisar(
      borrador({
        titulo: '   ',
        renglones: [],
        desde: new Date(Date.now() + UN_DIA),
        hasta: new Date(Date.now() - UN_DIA),
      }),
    );
    expect(fallos).toContain('SIN_TITULO');
    expect(fallos).toContain('SIN_PRODUCTOS');
    expect(fallos).toContain('VIGENCIA_INVERTIDA');
  });

  it('una fecha vacía se dice como tal, y no como una vigencia invertida', () => {
    // Son dos problemas distintos y mandan a revisar campos distintos: sin
    // fecha no hay nada invertido, y quien lee «la fecha de fin no puede ser
    // anterior» se pone a mirar un campo que está bien.
    const fallos = revisar(borrador({ titulo: '', desde: null }));

    expect(fallos).toContain('FALTA_FECHA');
    expect(fallos).not.toContain('VIGENCIA_INVERTIDA');
    // Y sigue diciendo todo lo demás: la fecha que falta no tapa al resto.
    expect(fallos).toContain('SIN_TITULO');
  });

  it('rechaza un precio que no es un descuento', () => {
    const fallos = revisar(
      borrador({
        tipoDeDescuento: 'PRECIO',
        porcentaje: null,
        renglones: [
          {
            productId: 'p-1',
            nombre: 'Metformina 850 mg',
            presentacion: null,
            precioNormal: '48.00',
            moneda: 'BOB',
            precioPromocional: '60.00',
          },
        ],
      }),
    );
    expect(fallos).toContain('PRECIO_NO_ES_DESCUENTO');
  });

  it('rechaza mezclar monedas en una misma campaña', () => {
    const fallos = revisar(
      borrador({
        renglones: [
          {
            productId: 'p-1',
            nombre: 'a',
            presentacion: null,
            precioNormal: '10.00',
            moneda: 'BOB',
            precioPromocional: null,
          },
          {
            productId: 'p-2',
            nombre: 'b',
            presentacion: null,
            precioNormal: '10.00',
            moneda: 'USD',
            precioPromocional: null,
          },
        ],
      }),
    );
    expect(fallos).toContain('MONEDAS_MEZCLADAS');
  });
});

describe('PharmacyCampaignsClient', () => {
  let client: PharmacyCampaignsClient;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    client = TestBed.inject(PharmacyCampaignsClient);
  });

  describe('las campañas sembradas', () => {
    beforeEach(() => {
      client.sembrarPara(FARMACIA, NOMBRE, CATALOGO);
    });

    it('siembra sólo las vigentes para el paciente', async () => {
      const vigentes = client.campanasVigentes(FARMACIA);
      const todas = await firstValueFrom(client.campanasDeFarmacia(FARMACIA));

      // Tres en el paquete, una de ellas vencida a propósito.
      expect(todas).toHaveLength(3);
      expect(vigentes).toHaveLength(2);
      expect(todas.filter((c) => estadoDe(c) === 'TERMINADA')).toHaveLength(1);
    });

    it('usa productos y precios reales del catálogo que le pasan', () => {
      const [campana] = client.campanasVigentes(FARMACIA);
      const producto = campana.productos[0];

      expect(producto.productId).toBe(CATALOGO[0].productId);
      expect(producto.precioNormal).toBe(CATALOGO[0].precio);
    });

    it('normaliza a dos decimales el precio que llega sin formato de la API', () => {
      // `GET /pharmacy-inventory/availability` devuelve `"15"` y `"22.5"`, y los
      // dos precios se leen uno al lado del otro: «antes 22.5 · ahora 14.63» es
      // un descuido a la vista.
      client.sembrarPara('otra-farmacia', 'Farmacia sin formato', [
        { productId: 'p-9', nombre: 'Ibuprofeno 400 mg', presentacion: null, precio: '22.5', moneda: 'BOB' },
      ]);
      const [producto] = client.campanasVigentes('otra-farmacia')[0].productos;

      expect(producto.precioNormal).toBe('22.50');
      // 35 % de 2250 centavos son 1462,5: se trunca hacia abajo para que el
      // ahorro nunca quede por debajo del que anuncia la campaña.
      expect(producto.precioPromocional).toBe('14.62');
    });

    it('no duplica al sembrar dos veces la misma farmacia', async () => {
      client.sembrarPara(FARMACIA, NOMBRE, CATALOGO);
      const todas = await firstValueFrom(client.campanasDeFarmacia(FARMACIA));

      expect(todas).toHaveLength(3);
    });

    it('mantiene el id de una campaña sembrada estable entre siembras', () => {
      const antes = client.campanasVigentes(FARMACIA).map((c) => c.id);
      client.sembrarPara(FARMACIA, NOMBRE, CATALOGO);

      expect(client.campanasVigentes(FARMACIA).map((c) => c.id)).toEqual(antes);
    });

    it('no siembra nada sin catálogo, en vez de inventar productos', async () => {
      client.sembrarPara('otra-farmacia', 'Otra', []);

      expect(await firstValueFrom(client.campanasDeFarmacia('otra-farmacia'))).toEqual([]);
    });
  });

  describe('el detalle público', () => {
    beforeEach(() => {
      client.sembrarPara(FARMACIA, NOMBRE, CATALOGO);
    });

    it('entrega la campaña completa mientras está vigente', async () => {
      const [vigente] = client.campanasVigentes(FARMACIA);
      const publica = await firstValueFrom(client.campanaPublica(vigente.id));

      expect(publica?.tipo).toBe('vigente');
    });

    it('no entrega precios de una campaña vencida ni con su URL exacta', async () => {
      const todas = await firstValueFrom(client.campanasDeFarmacia(FARMACIA));
      const vencida = todas.find((c) => estadoDe(c) === 'TERMINADA');

      const publica = await firstValueFrom(client.campanaPublica(vencida!.id));

      expect(publica?.tipo).toBe('terminada');
      // La unión discriminada es la garantía: fuera de `vigente` no hay
      // productos que una plantilla pueda pintar por descuido.
      expect(publica).not.toHaveProperty('campana');
    });

    it('devuelve null para un id que no existe', async () => {
      expect(await firstValueFrom(client.campanaPublica('no-existe'))).toBeNull();
    });
  });

  describe('el precio promocional de un producto', () => {
    beforeEach(() => {
      client.sembrarPara(FARMACIA, NOMBRE, CATALOGO);
    });

    it('aplica el descuento de la campaña vigente', () => {
      const promocional = client.precioPromocional(FARMACIA, 'p-1');

      // 20 % sobre 48.00 en la campaña de cuidado diario.
      expect(promocional?.precioNormal).toBe('48.00');
      expect(ahorroDe(promocional!)).toBeGreaterThan(0);
    });

    it('elige el precio más bajo cuando dos campañas alcanzan al producto', () => {
      // `p-1` y `p-2` están en las dos vigentes (20 % y 35 %): gana la de 35 %.
      const promocional = client.precioPromocional(FARMACIA, 'p-2');

      expect(promocional?.precioPromocional).toBe(conDescuento('22.50', 35));
    });

    it('no inventa precio para un producto que ninguna campaña alcanza', () => {
      expect(client.precioPromocional(FARMACIA, 'p-inexistente')).toBeNull();
    });

    it('no aplica el precio de otra farmacia', () => {
      expect(client.precioPromocional('otra-farmacia', 'p-1')).toBeNull();
    });
  });

  describe('la creación', () => {
    it('publica una campaña válida y la deja visible para el paciente', async () => {
      const resultado = await firstValueFrom(client.crear(borrador(), FARMACIA, NOMBRE));

      expect(Array.isArray(resultado)).toBe(false);
      expect(client.campanasVigentes(FARMACIA)).toHaveLength(1);
    });

    it('devuelve los fallos y no publica nada cuando el borrador no cierra', async () => {
      const resultado = await firstValueFrom(
        client.crear(borrador({ titulo: '' }), FARMACIA, NOMBRE),
      );

      expect(resultado).toEqual(['SIN_TITULO']);
      expect(await firstValueFrom(client.campanasDeFarmacia(FARMACIA))).toEqual([]);
    });

    it('marca como no sembrada la que crea la farmacia', async () => {
      await firstValueFrom(client.crear(borrador(), FARMACIA, NOMBRE));
      const [creada] = client.campanasVigentes(FARMACIA);

      expect(creada.sembrada).toBe(false);
    });

    it('no deja visible una campaña programada para el futuro', async () => {
      const futuro = borrador({
        desde: new Date(Date.now() + 5 * UN_DIA),
        hasta: new Date(Date.now() + 10 * UN_DIA),
      });
      await firstValueFrom(client.crear(futuro, FARMACIA, NOMBRE));

      expect(client.campanasVigentes(FARMACIA)).toEqual([]);
      expect(await firstValueFrom(client.campanasDeFarmacia(FARMACIA))).toHaveLength(1);
    });
  });
});
