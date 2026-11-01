import { inject, Injectable, signal } from '@angular/core';

import { IamClient, type IdentifierKind } from '../../../../core/data-access/iam/iam.client';

/**
 * ¿Ya existe una cuenta con este documento, correo o nombre de institución?
 *
 * Se llama cuando la persona **sale** del campo (ver `FieldDef.alSalir`): si la
 * API dice que sí, `encontrado` guarda el tipo y {@link AccountExistsDialog}
 * abre el aviso con el botón de iniciar sesión.
 *
 * Es una ayuda y no una barrera. Si la consulta falla (sin red, 5xx) no se
 * avisa nada y se deja seguir: el alta sigue respondiendo 409 `CONFLICT` si el
 * dato está repetido, y ese camino no cambia.
 */
@Injectable({ providedIn: 'root' })
export class AccountExistsCheck {
  private readonly iam = inject(IamClient);

  /** El tipo de dato repetido mientras el aviso está abierto; `null` si no hay nada que avisar. */
  readonly encontrado = signal<IdentifierKind | null>(null);

  /** Lo último que se preguntó: salir del mismo campo sin cambiarlo no repite la consulta. */
  private ultimo = '';

  verificar(kind: IdentifierKind, value: string): void {
    const limpio = value.trim();
    if (limpio === '') {
      return;
    }
    const clave = `${kind}:${limpio.toLowerCase()}`;
    if (clave === this.ultimo) {
      return;
    }
    this.ultimo = clave;
    this.iam.identifierExists(kind, limpio).subscribe({
      next: (existe) => {
        if (existe) {
          this.encontrado.set(kind);
        }
      },
      // Ver el comentario de la clase: el 409 del alta es la red de seguridad.
      error: () => {
        this.ultimo = '';
      },
    });
  }

  cerrar(): void {
    this.encontrado.set(null);
  }
}
