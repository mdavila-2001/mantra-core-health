import type { PickedFile } from './result-upload-queue';

/**
 * Lo que se soltó sobre la zona de subida, carpetas incluidas.
 *
 * `dataTransfer.files` sólo trae los archivos sueltos: una carpeta soltada
 * aparece como una entrada de tamaño cero que no se puede leer. Para entrar a
 * las carpetas hay que recorrer las entradas (`webkitGetAsEntry`), que es lo
 * que hacen Chrome, Edge, Firefox y Safari. Si el navegador no las da, se usa
 * la lista plana.
 */
export async function filesFromDrop(transfer: DataTransfer): Promise<PickedFile[]> {
  const entries = Array.from(transfer.items ?? [])
    .filter((item) => item.kind === 'file')
    .map((item) => (typeof item.webkitGetAsEntry === 'function' ? item.webkitGetAsEntry() : null));
  if (entries.length === 0 || entries.some((entry) => entry === null)) {
    return Array.from(transfer.files).map((file) => ({ file, path: '' }));
  }
  const picked: PickedFile[] = [];
  for (const entry of entries) {
    await walk(entry!, '', picked);
  }
  return picked;
}

/** Lo elegido con el selector, de archivos o de carpeta. */
export function filesFromInput(input: HTMLInputElement): PickedFile[] {
  return Array.from(input.files ?? []).map((file) => ({
    file,
    // Con `webkitdirectory` cada archivo trae su ruta dentro de la carpeta.
    path: file.webkitRelativePath ?? '',
  }));
}

async function walk(entry: FileSystemEntry, prefix: string, out: PickedFile[]): Promise<void> {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) =>
      (entry as FileSystemFileEntry).file(resolve, reject),
    );
    out.push({ file, path: prefix === '' ? '' : `${prefix}${file.name}` });
    return;
  }
  if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    const folder = `${prefix}${entry.name}/`;
    // `readEntries` devuelve de a tandas (100 en Chrome): se lee hasta vacío.
    for (;;) {
      const batch = await new Promise<FileSystemEntry[]>((resolve, reject) =>
        reader.readEntries(resolve, reject),
      );
      if (batch.length === 0) {
        break;
      }
      for (const child of batch) {
        await walk(child, folder, out);
      }
    }
  }
}
