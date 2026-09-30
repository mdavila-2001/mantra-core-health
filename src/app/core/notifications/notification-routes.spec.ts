import { rutaDeNotificacion } from './notification-routes';

/**
 * Lo que estas pruebas fijan: que un destino **sin pantalla** devuelve `null`
 * en vez de una ruta inventada. Es la diferencia entre una notificación que se
 * pinta como texto y una que se pinta como enlace y no lleva a ningún lado —
 * lo segundo se lee como producto roto.
 */
describe('rutaDeNotificacion', () => {
  it('lleva la receta y la consulta al expediente propio', () => {
    expect(rutaDeNotificacion({ type: 'PRESCRIPTION', id: 'rx-1' })).toBe(
      '/my-account/medical-record',
    );
    expect(rutaDeNotificacion({ type: 'ENCOUNTER', id: 'e-1' })).toBe(
      '/my-account/medical-record',
    );
  });

  it('lleva el hilo de mensajería a su conversación, listo para responder', () => {
    // `?responder=1` (carril P9): el hilo abre con el foco en el textarea.
    // Llegar desde «te escribieron» y tener que buscar dónde escribir rompe el
    // gesto que la notificación empezó.
    expect(rutaDeNotificacion({ type: 'CONVERSATION', id: 'c-9' })).toBe(
      '/messaging/c-9?responder=1',
    );
  });

  it('lleva el pedido de vínculo de un profesional a la bandeja del paciente (FT-07)', () => {
    expect(rutaDeNotificacion({ type: 'CARE_RELATIONSHIP_REQUEST', id: 'cr-1' })).toBe(
      '/my-account/access-requests',
    );
  });

  it('lleva el pedido de farmacia a su detalle, donde vive la decisión', () => {
    // FAR-I2: «te proponen un genérico» se responde en la ficha del pedido.
    expect(rutaDeNotificacion({ type: 'PHARMACY_ORDER', id: 'ped-1' })).toBe(
      '/my-account/pharmacy-orders/ped-1',
    );
  });

  it('lleva el aviso del pago a su comprobante (FAR-I5)', () => {
    // El id es el del pedido: cuando el backend registre el pago y emita
    // (FAR-E1/E4), su notificación ya abre el papel.
    expect(rutaDeNotificacion({ type: 'PHARMACY_RECEIPT', id: 'ped-1' })).toBe(
      '/my-account/pharmacy-orders/ped-1/receipt',
    );
  });

  it('AG-06/AG-07: lleva el aviso de la agenda (confirmación o cupo liberado) a mis turnos', () => {
    // Lo que scheduling emite de verdad (`RECURSO_CITA`/`RECURSO_CUPO`), no el
    // `APPOINTMENT` que ningún módulo manda hoy.
    expect(
      rutaDeNotificacion({ type: 'scheduling.appointment_bookings', id: 'b-1' }),
    ).toBe('/my-account/appointments');
    expect(
      rutaDeNotificacion({ type: 'scheduling.bookable_slots', id: 'slot-1' }),
    ).toBe('/my-account/appointments');
  });

  it('AG-06: lleva la orden de estudios a la lista de órdenes del paciente (MCH-027)', () => {
    expect(rutaDeNotificacion({ type: 'SERVICE_REQUEST', id: 'sr-1' })).toBe(
      '/my-account/diagnostic-orders',
    );
  });

  it('devuelve null cuando el tipo todavía no tiene pantalla', () => {
    expect(rutaDeNotificacion({ type: 'POST', id: 'p-1' })).toBeNull();
  });

  it('devuelve null cuando el tipo es desconocido o no hay destino', () => {
    expect(rutaDeNotificacion({ type: 'ALGO_NUEVO', id: 'x' })).toBeNull();
    expect(rutaDeNotificacion(undefined)).toBeNull();
  });
});
