import type { Observable } from 'rxjs';

/**
 * Una cola que deja pasar **a lo sumo N lecturas a la vez**.
 *
 * Varias pantallas piden «quién es este perfil» o «qué reaccioné a esto» para
 * muchas filas al mismo tiempo: un feed de veinte tarjetas son veinte lecturas
 * en el mismo instante. Encolarlas de a pocas no las hace más lentas de forma
 * perceptible y evita que una pantalla sola sature el límite de peticiones por
 * minuto de la API.
 *
 * Cada trabajo es un observable **frío** que se suscribe cuando le toca. Que
 * termine —con valor, con error o sin nada— libera la plaza; un trabajo que
 * falla no frena a los demás.
 */
export class ColaAcotada {
  private readonly pendientes: (() => Observable<unknown>)[] = [];
  private enVuelo = 0;

  constructor(private readonly simultaneas: number) {}

  /** Agrega un trabajo y lo arranca si hay plaza. */
  encolar(trabajo: () => Observable<unknown>): void {
    this.pendientes.push(trabajo);
    this.avanzar();
  }

  /** Descarta lo que todavía no arrancó (cambio de sesión). Lo que ya está en vuelo termina solo. */
  vaciar(): void {
    this.pendientes.length = 0;
  }

  private avanzar(): void {
    while (this.enVuelo < this.simultaneas && this.pendientes.length > 0) {
      const trabajo = this.pendientes.shift()!;
      this.enVuelo += 1;
      let liberado = false;
      const liberar = (): void => {
        if (liberado) return;
        liberado = true;
        this.enVuelo -= 1;
        this.avanzar();
      };
      trabajo().subscribe({ complete: liberar, error: liberar });
    }
  }
}
