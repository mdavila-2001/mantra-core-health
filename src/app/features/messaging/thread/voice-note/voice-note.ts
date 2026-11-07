import {
  ChangeDetectionStrategy,
  Component,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { audioBlobOf } from './audio-source';
import { BARS, RATES, clock, peaksOf } from './waveform';

/**
 * A chat voice note, drawn like a messaging app: play/pause, the real waveform
 * of the recording with the played part filled, the time and a speed toggle.
 *
 * The waveform and the duration come from decoding the audio itself: a WebM
 * recorded by `MediaRecorder` reports `duration = Infinity` until it has been
 * played through, so the element alone cannot tell how long it is.
 */
@Component({
  selector: 'app-voice-note',
  templateUrl: './voice-note.html',
  styleUrl: './voice-note.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoiceNote {
  readonly src = input.required<string>();

  protected readonly playing = signal(false);
  protected readonly current = signal(0);
  protected readonly duration = signal(0);
  protected readonly rate = signal<(typeof RATES)[number]>(1);
  protected readonly peaks = signal<readonly number[]>(Array(BARS).fill(0.15));
  protected readonly progress = computed(() =>
    this.duration() > 0 ? this.current() / this.duration() : 0,
  );
  protected readonly label = computed(() =>
    clock(this.playing() || this.current() > 0 ? this.current() : this.duration()),
  );

  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  /** What the `<audio>` plays: an object URL, the only kind the CSP lets through. */
  protected readonly playable = signal<string | null>(null);

  constructor() {
    effect((onCleanup) => {
      const src = this.src();
      if (!this.browser) return;
      let objectUrl: string | null = null;
      let alive = true;
      onCleanup(() => {
        alive = false;
        if (objectUrl !== null) URL.revokeObjectURL(objectUrl);
      });
      void audioBlobOf(src).then(
        (blob) => {
          if (!alive) return;
          objectUrl = URL.createObjectURL(blob);
          this.playable.set(objectUrl);
          void this.decode(blob);
        },
        () => undefined, // Unreadable source: the button stays, nothing plays.
      );
    });
  }

  protected toggle(audio: HTMLAudioElement): void {
    if (audio.paused) {
      audio.playbackRate = this.rate();
      void audio.play();
    } else {
      audio.pause();
    }
  }

  protected cycleRate(audio: HTMLAudioElement): void {
    const next = RATES[(RATES.indexOf(this.rate()) + 1) % RATES.length];
    this.rate.set(next);
    audio.playbackRate = next;
  }

  protected seek(audio: HTMLAudioElement, value: string): void {
    audio.currentTime = Number(value);
    this.current.set(audio.currentTime);
  }

  protected onMetadata(audio: HTMLAudioElement): void {
    if (Number.isFinite(audio.duration) && this.duration() === 0) {
      this.duration.set(audio.duration);
    }
  }

  protected onEnded(): void {
    this.playing.set(false);
    this.current.set(0);
  }

  protected readonly rateLabel = computed(() => `${this.rate()}×`);
  protected readonly clock = clock;

  /** Real duration and per-bar peaks; on failure the flat bars and the element's metadata stay. */
  private async decode(blob: Blob): Promise<void> {
    try {
      const bytes = await blob.arrayBuffer();
      const context = new AudioContext();
      const buffer = await context.decodeAudioData(bytes);
      void context.close();
      this.duration.set(buffer.duration);
      this.peaks.set(peaksOf(buffer.getChannelData(0)));
    } catch {
      // Undecodable here (old browser, odd codec): the player still plays.
    }
  }
}
