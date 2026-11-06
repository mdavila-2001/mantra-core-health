import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';

import {
  CHAT_WALLPAPERS,
  ChatWallpaper,
  wallpaperUrl,
} from '../../../../core/messaging/chat-wallpaper';
import { ContentDialog } from '../../../../shared/components/organisms/content-dialog/content-dialog';

/** «Fondo de pantalla»: pick one of the predefined Full HD wallpapers. */
@Component({
  selector: 'app-wallpaper-dialog',
  imports: [ContentDialog],
  templateUrl: './wallpaper-dialog.html',
  styleUrl: './wallpaper-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WallpaperDialog {
  protected readonly fondo = inject(ChatWallpaper);
  protected readonly opciones = CHAT_WALLPAPERS;
  protected readonly mini = (id: string) => wallpaperUrl(id, true);

  readonly closed = output<void>();
}
