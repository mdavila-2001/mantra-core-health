import { ACTORES } from '../contracts/actor.keys';
import { esAsercion } from '../contracts/journey.types';
import { JOURNEYS, journey } from './index';

/**
 * Lo que fija esta prueba.
 *
 * El catálogo de journeys no se ejecuta sin un stack levantado, así que sus
 * errores no aparecen hasta que alguien monta el entorno completo — y ahí
 * aparecen mezclados con fallos reales del producto. Estas comprobaciones son
 * las que **sí** se pueden hacer sin navegador, y atrapan los tres errores que
 * más caro salen después:
 *
 * 1. dos journeys con el mismo id, que rompe la regla de verdad única en
 *    silencio: los dos adaptadores creen estar demostrando lo mismo y no;
 * 2. un actor escrito a mano que no existe en el catálogo de semillas, que en
 *    la corrida se ve como un login que falla;
 * 3. un efecto que el journey debe **producir** declarado como precondición,
 *    que es exactamente lo que el contrato de semillas prohíbe — un journey así
 *    pasa siempre y no prueba nada.
 */
describe('catálogo de journeys', () => {
  it('no tiene dos journeys con el mismo id', () => {
    const ids = JOURNEYS.map((j) => j.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('cubre los cuatro journeys de los carriles de esta máquina', () => {
    expect(JOURNEYS.map((j) => j.id).sort()).toEqual([
      'P3-E2E-001',
      'P3-E2E-002',
      'P6-E2E-001',
      'P6-E2E-002',
    ]);
  });

  it('`journey()` falla fuerte en vez de devolver undefined', () => {
    expect(() => journey('P3-E2E-001')).not.toThrow();
    expect(() => journey('P9-E2E-999' as never)).toThrow(/No existe el journey/);
  });

  /**
   * Un actor con la clave mal escrita no falla al compilar si alguien pone la
   * cadena a mano. Acá sí.
   */
  it('todos los actores declarados existen en el catálogo de semillas', () => {
    const conocidos = new Set<string>([
      ...Object.values(ACTORES),
      // El visitante sin sesión no es una identidad sembrada: es la ausencia de
      // una, y P6-E2E-002 la necesita para mirar el perfil público.
      'anonimo',
    ]);

    for (const j of JOURNEYS) {
      for (const actor of j.actors) {
        expect(conocidos.has(actor)).toBe(true);
      }
      for (const paso of j.steps) {
        if (!esAsercion(paso)) {
          expect(conocidos.has(paso.actor)).toBe(true);
        }
      }
    }
  });

  /**
   * La regla crítica del contrato de semillas: lo que el journey produce no se
   * siembra. Si el post, la decisión, la apelación o la reseña vinieran de la
   * semilla, el journey demostraría que el sistema sabe leer una fila.
   */
  it('ningún journey declara como precondición un efecto que debe producir', () => {
    const prohibidos = [
      'current_notification',
      'current_message',
      'current_post_interaction',
      'current_upload_association',
      'current_report_decision_appeal',
      'current_review',
    ];

    for (const j of JOURNEYS) {
      for (const precondicion of j.preconditions) {
        for (const prohibido of prohibidos) {
          expect(precondicion).not.toContain(prohibido);
        }
      }
    }
  });

  /**
   * Un journey que no declara qué servicios necesita produce fallos que acusan a
   * la interfaz cuando el problema es que un worker no corrió.
   */
  it('todo journey declara los servicios que necesita vivos', () => {
    for (const j of JOURNEYS) {
      expect(j.requiresLive.length).toBeGreaterThan(0);
      expect(j.requiresLive).toContain('api');
    }
  });

  /**
   * El muro del seguidor se llena por el fan-out. Sin ese worker, P3-E2E-001
   * falla por una razón que no es la que está probando.
   */
  it('los journeys de muro exigen el worker de fan-out', () => {
    expect(journey('P3-E2E-001').requiresLive).toContain('worker-community');
    expect(journey('P3-E2E-002').requiresLive).toContain('worker-community');
  });

  it('todo journey tiene al menos una afirmación de negocio', () => {
    for (const j of JOURNEYS) {
      expect(j.steps.some(esAsercion)).toBe(true);
    }
  });

  /**
   * Los negativos viven dentro del journey y no en un archivo aparte: un
   * negativo lejos del positivo es un negativo que alguien deja de correr.
   */
  it('los journeys críticos incluyen su negativo', () => {
    const afirmaciones = (id: Parameters<typeof journey>[0]): string[] =>
      journey(id)
        .steps.filter(esAsercion)
        .map((paso) => paso.assert);

    expect(afirmaciones('P3-E2E-001')).toContain(
      'publicacionNoVisibleParaQuienNoSigue',
    );
    expect(afirmaciones('P6-E2E-002')).toContain(
      'calificarRechazadoSinAtencion',
    );
    expect(afirmaciones('P6-E2E-002')).toContain(
      'calificarRechazadoPorAtencionNoTerminada',
    );
  });

  /**
   * El identificador que ata una reseña a un encuentro clínico no puede salir
   * en la respuesta pública. Que la comprobación esté en el catálogo evita que
   * se caiga de un adaptador sin que nadie lo note.
   */
  it('P6-E2E-002 comprueba que no se filtren identificadores clínicos', () => {
    const asserts = journey('P6-E2E-002')
      .steps.filter(esAsercion)
      .map((paso) => paso.assert);
    expect(asserts).toContain('respuestaPublicaSinIdentificadoresClinicos');
  });
});
