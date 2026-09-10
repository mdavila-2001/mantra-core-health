import { ChangeDetectionStrategy, Component, effect, input, signal } from '@angular/core';
import { NavIcon } from '../../atoms/nav-icon/nav-icon';
import { AppButton } from '../../atoms/button/button';

/** Vista local: imágenes como data URL y PDF rasterizado, sin iframes ni uploads. */
@Component({
  selector: 'app-file-preview',
  imports: [AppButton, NavIcon],
  templateUrl: './file-preview.html',
  styleUrl: './file-preview.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilePreview {
  readonly file = input.required<File>();
  protected readonly preview = signal('');
  protected readonly error = signal('');
  protected readonly mediaUrl = signal('');
  protected readonly textPreview = signal('');
  protected readonly loading = signal(false);
  protected readonly page = signal(1);
  protected readonly pages = signal(1);

  constructor() {
    effect(() => {
      this.file();
      this.page.set(1);
      this.pages.set(1);
    });
    effect((cleanup) => {
      const file = this.file();
      const page = this.page();
      let active = true;
      let dispose: (() => void) | undefined;
      this.preview.set('');
      this.mediaUrl.set('');
      this.textPreview.set('');
      this.error.set('');
      this.loading.set(true);
      cleanup(() => {
        active = false;
        dispose?.();
      });
      const show = (url: string) => {
        if (active) {
          this.preview.set(url);
          this.loading.set(false);
        }
      };
      const fail = () => {
        if (active) {
          this.error.set('No pudimos mostrar la vista previa. Revisá el archivo o elegí otro.');
          this.loading.set(false);
        }
      };
      if (/^image\/(jpeg|png|webp|gif|avif|bmp)$/.test(file.type)) {
        const reader = new FileReader();
        reader.onload = () => show(String(reader.result));
        reader.onerror = fail;
        reader.readAsDataURL(file);
        dispose = () => {
          if (reader.readyState === FileReader.LOADING) reader.abort();
        };
      } else if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        void (async () => {
          try {
            const pdfjs = await import('pdfjs-dist');
            if (!active) return;
            pdfjs.GlobalWorkerOptions.workerSrc = '/assets/pdfjs/pdf.worker.min.mjs';
            const data = await file.arrayBuffer();
            if (!active) return;
            const task = pdfjs.getDocument({ data });
            dispose = () => {
              void task.destroy();
            };
            const pdf = await task.promise;
            if (!active) return;
            this.pages.set(pdf.numPages);
            const documentPage = await pdf.getPage(Math.min(page, pdf.numPages));
            if (!active) return;
            const natural = documentPage.getViewport({ scale: 1 });
            const viewport = documentPage.getViewport({ scale: 900 / natural.width });
            const canvas = document.createElement('canvas');
            canvas.width = Math.ceil(viewport.width);
            canvas.height = Math.ceil(viewport.height);
            await documentPage.render({ canvas, viewport }).promise;
            show(canvas.toDataURL('image/png'));
            await task.destroy();
            dispose = undefined;
          } catch {
            fail();
          }
        })();
      } else if (/^(audio|video)\//.test(file.type)) {
        const url = URL.createObjectURL(file);
        this.mediaUrl.set(url);
        this.loading.set(false);
        dispose = () => URL.revokeObjectURL(url);
      } else if (
        /^(text\/|application\/(json|x-ndjson))/.test(file.type) ||
        /\.(jsonl?|ndjson|csv|txt)$/i.test(file.name)
      ) {
        const reader = new FileReader();
        reader.onload = () => {
          if (active) {
            this.textPreview.set(String(reader.result));
            this.loading.set(false);
          }
        };
        reader.onerror = fail;
        reader.readAsText(file.slice(0, 64 * 1024));
        dispose = () => {
          if (reader.readyState === FileReader.LOADING) reader.abort();
        };
      } else {
        this.loading.set(false);
        this.error.set(
          'Este formato no tiene vista previa. Podés adjuntarlo y abrirlo con su aplicación.',
        );
      }
    });
  }

  protected imageFailed(): void {
    this.preview.set('');
    this.mediaUrl.set('');
    this.error.set('No pudimos reproducir este archivo. Revisalo o elegí otro.');
  }
}
