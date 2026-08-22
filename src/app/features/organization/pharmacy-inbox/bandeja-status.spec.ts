import { ESTADOS_DE_PEDIDO } from '../../../core/data-access/pharmacy-orders/pharmacy-orders.types';
import {
  GRUPOS_A_LA_VISTA,
  GRUPOS_DE_BANDEJA,
  etiquetaDeGrupo,
  grupoDeBandeja,
  toBandejaStatusPresentation,
} from './bandeja-status';

/**
 * El catálogo del mostrador (FAR-I3): cada estado del contrato tiene palabra
 * y frase del lado de quien atiende, y cada pedido cae en exactamente un
 * grupo de la bandeja — las cuatro colas a la vista y el resto plegado.
 */
describe('bandeja-status', () => {
  it('cubre el contrato entero, en palabras y sin códigos sueltos', () => {
    for (const estado of ESTADOS_DE_PEDIDO) {
      const presentacion = toBandejaStatusPresentation(estado);
      expect(presentacion.label, estado).not.toContain('_');
      expect(presentacion.descripcion, estado).not.toContain('_');
      expect(presentacion.descripcion.length, estado).toBeGreaterThan(10);
    }
  });

  it('le habla al mostrador, no al paciente', () => {
    // La misma situación, dicha desde el otro lado del mostrador.
    expect(toBandejaStatusPresentation('ENVIADO').label).toBe('Nuevo');
    expect(toBandejaStatusPresentation('ACEPTACION_PENDIENTE').label).toBe(
      'Esperando al paciente',
    );
    expect(toBandejaStatusPresentation('LISTO_PARA_RETIRO').label).toBe('Esperando el retiro');
  });

  it('cada estado cae en un grupo, y los grupos son los de la tarjeta', () => {
    for (const estado of ESTADOS_DE_PEDIDO) {
      expect(GRUPOS_DE_BANDEJA).toContain(grupoDeBandeja(estado));
    }
    expect(grupoDeBandeja('ENVIADO')).toBe('NUEVOS');
    expect(grupoDeBandeja('CONFIRMADO')).toBe('EN_PREPARACION');
    expect(grupoDeBandeja('ACEPTADO')).toBe('EN_PREPARACION');
    expect(grupoDeBandeja('VENCIDO')).toBe('CERRADOS');
  });

  it('las colas con reloj van a la vista; la preparación y lo cerrado, al pliegue', () => {
    const visibles = GRUPOS_DE_BANDEJA.slice(0, GRUPOS_A_LA_VISTA);
    expect(visibles).toEqual(['NUEVOS', 'EN_REVISION', 'ESPERANDO_PACIENTE', 'LISTOS']);
    for (const grupo of GRUPOS_DE_BANDEJA) {
      expect(etiquetaDeGrupo(grupo)).not.toContain('_');
    }
  });
});
