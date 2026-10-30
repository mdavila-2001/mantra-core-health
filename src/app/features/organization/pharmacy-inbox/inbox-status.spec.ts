import {
  ESTADOS_DE_PEDIDO,
  MODALIDADES_DE_ENTREGA,
} from '../../../core/data-access/pharmacy-orders/pharmacy-orders.types';
import {
  INBOX_GROUPS,
  groupLabel,
  inboxGroup,
  toInboxStatusPresentation,
} from './inbox-status';

/**
 * El catálogo del mostrador (FAR-I3): cada estado del contrato tiene palabra
 * y frase del lado de quien atiende, y cada pedido cae en exactamente un
 * grupo de la bandeja — las seis colas del tablero.
 */
describe('bandeja-status', () => {
  it('cubre el contrato entero, en palabras y sin códigos sueltos', () => {
    for (const estado of ESTADOS_DE_PEDIDO) {
      const presentacion = toInboxStatusPresentation(estado);
      expect(presentacion.label, estado).not.toContain('_');
      expect(presentacion.descripcion, estado).not.toContain('_');
      expect(presentacion.descripcion.length, estado).toBeGreaterThan(10);
    }
  });

  it('le habla al mostrador, no al paciente', () => {
    // La misma situación, dicha desde el otro lado del mostrador.
    expect(toInboxStatusPresentation('ENVIADO').label).toBe('Pendiente');
    expect(toInboxStatusPresentation('ACEPTACION_PENDIENTE').label).toBe(
      'Esperando al paciente',
    );
    expect(toInboxStatusPresentation('LISTO_PARA_RETIRO').label).toBe('Listo para retiro');
  });

  it('cada estado cae en un grupo, y los grupos son los de la tarjeta', () => {
    for (const estado of ESTADOS_DE_PEDIDO) {
      expect(INBOX_GROUPS).toContain(inboxGroup(estado));
    }
    expect(inboxGroup('ENVIADO')).toBe('NUEVOS');
    expect(inboxGroup('CONFIRMADO')).toBe('EN_PREPARACION');
    expect(inboxGroup('ACEPTADO')).toBe('EN_PREPARACION');
    expect(inboxGroup('VENCIDO')).toBe('CERRADOS');
  });

  it('la modalidad no cambia el tono ni la palabra: sólo puede cambiar la frase', () => {
    for (const estado of ESTADOS_DE_PEDIDO) {
      const retiro = toInboxStatusPresentation(estado, 'RETIRO');
      for (const modalidad of MODALIDADES_DE_ENTREGA) {
        const presentacion = toInboxStatusPresentation(estado, modalidad);
        expect(presentacion.tone, `${estado}/${modalidad}`).toBe(retiro.tone);
        expect(presentacion.label, `${estado}/${modalidad}`).toBe(retiro.label);
        expect(presentacion.descripcion.length, `${estado}/${modalidad}`).toBeGreaterThan(10);
        expect(presentacion.descripcion, `${estado}/${modalidad}`).not.toContain('_');
      }
    }
  });

  it('el texto de los pedidos de retiro no cambia, con modalidad o sin ella', () => {
    for (const estado of ESTADOS_DE_PEDIDO) {
      const deSiempre = toInboxStatusPresentation(estado);
      expect(toInboxStatusPresentation(estado, null), estado).toEqual(deSiempre);
      expect(toInboxStatusPresentation(estado, 'RETIRO'), estado).toEqual(deSiempre);
    }
    // La frase que la pantalla venía mostrando, literal.
    expect(toInboxStatusPresentation('CONFIRMADO').descripcion).toBe(
      'Confirmado. Cuando esté armado, márquelo como listo.',
    );
  });

  it('lo que sale por reparto no pide marcarlo listo, porque nadie lo va a retirar', () => {
    for (const modalidad of ['DOMICILIO', 'TRABAJO'] as const) {
      const confirmado = toInboxStatusPresentation('CONFIRMADO', modalidad);
      expect(confirmado.descripcion, modalidad).not.toContain('márquelo como listo');
      expect(confirmado.descripcion, modalidad).toContain('reparto');
    }
  });

  it('el tablero tiene las seis colas, de lo que corre contra el reloj a lo cerrado', () => {
    expect(INBOX_GROUPS).toEqual([
      'NUEVOS',
      'EN_REVISION',
      'ESPERANDO_PACIENTE',
      'LISTOS',
      'EN_PREPARACION',
      'CERRADOS',
    ]);
    for (const grupo of INBOX_GROUPS) {
      expect(groupLabel(grupo)).not.toContain('_');
    }
  });
});
