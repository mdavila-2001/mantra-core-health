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

/** Bars drawn for the waveform: enough to read the shape, few enough to fit 15rem. */
const BARS = 36;
/** Speeds offered, in the order the button cycles through them. */
const RATES = [1, 1.5, 2] as const;

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

  constructor() {
    effect(() => {
      const src = this.src();
      if (this.browser) void this.decode(src);
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
  private async decode(src: string): Promise<void> {
    try {
      const bytes = await (await fetch(src)).arrayBuffer();
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

/** Peak of each slice, scaled so the loudest bar fills the height. */
function peaksOf(samples: Float32Array): number[] {
  const size = Math.max(1, Math.floor(samples.length / BARS));
  const raw = Array.from({ length: BARS }, (_, bar) => {
    let peak = 0;
    for (let i = bar * size; i < (bar + 1) * size && i < samples.length; i++) {
      peak = Math.max(peak, Math.abs(samples[i]!));
    }
    return peak;
  });
  const loudest = Math.max(...raw, 0.0001);
  return raw.map((peak) => Math.max(0.15, peak / loudest));
}

function clock(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
