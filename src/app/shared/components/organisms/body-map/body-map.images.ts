import { signal, type DestroyRef } from '@angular/core';

const ESPERA_MAXIMA_DE_IMAGEN_MS = 4000;

/** Imágenes decodificadas del mapa, con copias en memoria cuando el navegador las admite. */
export class ImagenesDelCuerpo {
  readonly listas = signal<ReadonlySet<string>>(new Set());
  private readonly copias = signal<ReadonlyMap<string, string>>(new Map());
  private readonly pedidas = new Map<string, Promise<void>>();
  private readonly urls = new Set<string>();
  private readonly descargas = new AbortController();
  private destruida = false;

  constructor(destruccion: DestroyRef) {
    destruccion.onDestroy(() => {
      this.destruida = true;
      this.descargas.abort();
      for (const url of this.urls) URL.revokeObjectURL(url);
      this.urls.clear();
    });
  }

  fuente(ruta: string): string {
    return this.copias().get(ruta) ?? ruta;
  }

  precargar(ruta: string): Promise<void> {
    const pendiente = this.pedidas.get(ruta);
    if (pendiente !== undefined) return pendiente;
    const marcar = (): void => {
      if (!this.destruida) this.listas.update((listas) => new Set(listas).add(ruta));
    };
    let temporizador: ReturnType<typeof setTimeout>;
    const tope = new Promise<void>((resolver) => {
      temporizador = setTimeout(resolver, ESPERA_MAXIMA_DE_IMAGEN_MS);
    });
    // Si falla o demora la descarga, se permite mostrar la ruta original como respaldo.
    const lista = Promise.race([this.preparar(ruta), tope])
      .then(marcar, marcar)
      .finally(() => clearTimeout(temporizador));
    this.pedidas.set(ruta, lista);
    return lista;
  }

  private async preparar(ruta: string): Promise<void> {
    if (typeof fetch !== 'function' || typeof URL.createObjectURL !== 'function') {
      const imagen = new Image();
      imagen.src = ruta;
      await (typeof imagen.decode === 'function'
        ? imagen.decode()
        : new Promise<void>((resolver, rechazar) => {
            imagen.onload = () => resolver();
            imagen.onerror = rechazar;
          }));
      return;
    }

    const respuesta = await fetch(ruta, { signal: this.descargas.signal });
    if (!respuesta.ok) throw new Error(`No se pudo cargar la imagen: HTTP ${respuesta.status}`);
    const contenido = await respuesta.blob();
    if (this.destruida) return;
    const url = URL.createObjectURL(contenido);
    this.urls.add(url);
    try {
      const imagen = new Image();
      imagen.src = url;
      if (typeof imagen.decode === 'function') await imagen.decode();
      if (!this.destruida) this.copias.update((copias) => new Map(copias).set(ruta, url));
    } catch (error) {
      if (this.urls.delete(url)) URL.revokeObjectURL(url);
      throw error;
    }
  }
}
