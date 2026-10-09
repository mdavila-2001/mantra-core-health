import { signal } from '@angular/core';

/* ============================================================================
    El interruptor que deja pasar las peticiones a la API de verdad.

    Existe para una sola cosa: poder comparar, desde el stock de componentes, lo
    que una pantalla pinta con datos simulados y lo que pinta con datos reales.
    Es la mitad de los fallos que se ven en una demostración —«esto no se
    parece a lo que devuelve la API»— y sin poder mirar los dos lados no hay
    forma de saber de qué lado está el error.

    Tres decisiones deliberadas:

      1. **Apagado por omisión.** La rama `mockup` se despliega en sitios donde
         no hay API ninguna; encenderlo por defecto convertiría cada pantalla en
         una ristra de errores de red.
      2. **Se enciende a mano y por sesión.** No se guarda en `localStorage`: al
         recargar vuelve a estar apagado. Un interruptor que sobrevive a la
         recarga es un interruptor que alguien deja encendido sin querer y que
         luego nadie encuentra.
      3. **Sólo lo toca el visor.** El resto de la aplicación no sabe que
         existe: el interceptor lo consulta y nada más.
    ========================================================================== */

export const apiRealForzada = signal(false);
