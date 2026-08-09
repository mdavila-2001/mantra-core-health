/* ============================================================================
    Referencias tipadas al Sistema de Diseño REDSAT v1.0.

    Fuente normativa: Mantra Core Health Vault/SALUD/Arquitectura/identidad-visual.md
    Fuente física:    src/styles.css — ahí viven los VALORES; acá viven solo los
                      NOMBRES. Este archivo no declara ni un hex ni un píxel:
                      duplicar un valor sería abrir una quinta frontera de deriva.

    Un componente nunca escribe '--bg-surface' a mano: escribe
    cssVar(SURFACE.surface) y el compilador atrapa el typo.
    ========================================================================== */

/* ---- tema y estados ------------------------------------------------------ */

/** Preferencia del usuario. 'system' delega en `@media (prefers-color-scheme)`. */
export type ThemeMode = 'light' | 'dark' | 'system';

/** Tema efectivamente pintado, ya resuelta la preferencia del sistema. */
export type ResolvedTheme = Exclude<ThemeMode, 'system'>;

export const THEME_MODES = ['light', 'dark', 'system'] as const;

/** Semántica de producto de los `--st-*`. NO es severidad clínica (identidad-visual.md Parte 11.3). */
export const STATUS_TYPES = ['success', 'warning', 'error', 'info'] as const;
export type StatusType = (typeof STATUS_TYPES)[number];

/** Fondo, tinta y borde de un estado: el trío que un badge necesita completo. */
export const STATUS_SLOTS = ['bg', 'fg', 'bd'] as const;
export type StatusSlot = (typeof STATUS_SLOTS)[number];

/* ---- rampas 50–900 (no cambian por tema) --------------------------------- */

export const RAMP_FAMILIES = [
  'petrol',
  'aqua',
  'mint',
  'amber',
  'sage',
  'ivory',
  'neutral',
  'success',
  'warning',
  'error',
  'info',
] as const;
export type RampFamily = (typeof RAMP_FAMILIES)[number];

export const RAMP_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;
export type RampStep = (typeof RAMP_STEPS)[number];

export type RampToken = `--c-${RampFamily}-${RampStep}`;

/* ---- tokens semánticos por tema ------------------------------------------ */

export const SURFACE = {
  base: '--bg-base',
  surface: '--bg-surface',
  surfaceAlt: '--bg-surface-alt',
  inset: '--bg-inset',
} as const;
export type SurfaceToken = (typeof SURFACE)[keyof typeof SURFACE];

export const TEXT = {
  primary: '--text-primary',
  secondary: '--text-secondary',
  /** Terciario: excepción WCAG E1 — jamás para información clínica. */
  muted: '--text-muted',
  inverse: '--text-inverse',
} as const;
export type TextToken = (typeof TEXT)[keyof typeof TEXT];

export const BRAND = {
  primary: '--brand-primary',
  primaryHover: '--brand-primary-hover',
  primaryActive: '--brand-primary-active',
  /** Aguamarina: siempre con tinta oscura encima, nunca blanca (2,51). */
  secondary: '--brand-secondary',
  secondaryHover: '--brand-secondary-hover',
  /** Ámbar: ≤ 10 % de la pantalla y UN solo punto de acción cálido. */
  accent: '--brand-accent',
} as const;
export type BrandToken = (typeof BRAND)[keyof typeof BRAND];

export const BORDER = {
  /** Divisor decorativo: no delimita controles. */
  default: '--border-default',
  /** Borde que delimita: el único válido para bordes de control. */
  strong: '--border-strong',
} as const;
export type BorderToken = (typeof BORDER)[keyof typeof BORDER];

export type StatusToken = `--st-${StatusType}-${StatusSlot}`;

/**
 * Chips de marca: la MISMA receta tonal de los `--st-*` aplicada a las rampas
 * de marca. Comparten prefijo porque comparten recipe, pero **no son estados de
 * producto** — por eso viven aparte de `StatusType`.
 */
export const BRAND_TONES = ['primary', 'secondary'] as const;
export type BrandTone = (typeof BRAND_TONES)[number];
export type BrandToneToken = `--st-${BrandTone}-${StatusSlot}`;

export const EFFECT = {
  shadowSm: '--shadow-sm',
  shadowMd: '--shadow-md',
  shadowLg: '--shadow-lg',
  focusRing: '--focus-ring',
} as const;
export type EffectToken = (typeof EFFECT)[keyof typeof EFFECT];

/* ---- geometría: espaciado y radios --------------------------------------- */

/** Grilla estricta de 4 px. Los escalones 7, 9, 11… no existen a propósito. */
export const SPACING_STEPS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20] as const;
export type SpacingStep = (typeof SPACING_STEPS)[number];
export type SpacingToken = `--sp-${SpacingStep}`;

/** `signature` (28px 4px 28px 4px) va en UN elemento por pantalla; nunca en botones ni inputs. */
export const RADIUS_NAMES = ['xs', 'sm', 'md', 'lg', 'xl', '2xl', 'full', 'signature'] as const;
export type RadiusName = (typeof RADIUS_NAMES)[number];
export type RadiusToken = `--r-${RadiusName}`;

/**
 * Puntos de quiebre. Los **valores** viven en `breakpoints.ts` porque CSS no
 * admite variables en la condición de un `@media` y hacen falta como números;
 * acá van solo los nombres, como el resto del catálogo.
 */
export const BREAKPOINT_NAMES = ['sm', 'md', 'lg'] as const;
export type BreakpointTokenName = (typeof BREAKPOINT_NAMES)[number];
export type BreakpointToken = `--bp-${BreakpointTokenName}`;

/* ---- movimiento ----------------------------------------------------------- */

/**
 * `fast` es el eco de un clic; `base`, un cambio de estado que hay que seguir
 * con la vista; `slow`, algo que entra o sale de la pantalla.
 *
 * No hace falta consultar `prefers-reduced-motion` al usarlas: `styles.css`
 * anula globalmente duraciones de transición y animación cuando está activo.
 */
export const DURATION_NAMES = ['fast', 'base', 'slow'] as const;
export type DurationName = (typeof DURATION_NAMES)[number];
export type DurationToken = `--dur-${DurationName}`;

/** `spring` rebota: se reserva para confirmar el gesto, nunca para datos. */
export const EASING_NAMES = ['standard', 'out', 'spring'] as const;
export type EasingName = (typeof EASING_NAMES)[number];
export type EasingToken = `--ease-${EasingName}`;

/* ---- apilamiento ---------------------------------------------------------
   Escala cerrada: un `z-index` suelto en un componente vuelve a abrir el
   problema que estos tokens cierran —dos capas con el mismo valor, y el orden
   decidido por la posición en el DOM—. */

export const LAYER_NAMES = [
  'base',
  'sticky',
  'drawer',
  'overlay',
  'menu',
  'tooltip',
  'toast',
  'dialog',
] as const;
export type LayerName = (typeof LAYER_NAMES)[number];
export type LayerToken = `--z-${LayerName}`;

/* ---- tipografía ----------------------------------------------------------- */

export const FONT_FAMILY = {
  /** Poppins 500/600/700 — display y marca. */
  display: '--font-display',
  /** Inter Variable — UI y datos. */
  body: '--font-body',
} as const;
export type FontFamilyToken = (typeof FONT_FAMILY)[keyof typeof FONT_FAMILY];

/** Los 9 roles de la escala REDSAT. */
export const TYPE_ROLES = [
  'display',
  'h1',
  'h2',
  'h3',
  'body-lg',
  'body',
  'caption',
  'overline',
  'data',
] as const;
export type TypeRole = (typeof TYPE_ROLES)[number];
export type FontSizeToken = `--fs-${TypeRole}`;

/** `overline` y `data` no declaran interlínea propia: heredan la del contenedor. */
export const LINE_HEIGHT_ROLES = [
  'display',
  'h1',
  'h2',
  'h3',
  'body-lg',
  'body',
  'caption',
] as const;
export type LineHeightRole = (typeof LINE_HEIGHT_ROLES)[number];
export type LineHeightToken = `--lh-${LineHeightRole}`;

/* ---- unión total + catálogo en runtime ----------------------------------- */

export type DesignToken =
  | RampToken
  | SurfaceToken
  | TextToken
  | BrandToken
  | BorderToken
  | StatusToken
  | BrandToneToken
  | EffectToken
  | SpacingToken
  | RadiusToken
  | BreakpointToken
  | LayerToken
  | DurationToken
  | EasingToken
  | FontFamilyToken
  | FontSizeToken
  | LineHeightToken;

/** Nombre de la rampa: `rampToken('petrol', 500)` → `--c-petrol-500`. */
export function rampToken<F extends RampFamily, S extends RampStep>(
  family: F,
  step: S,
): `--c-${F}-${S}` {
  return `--c-${family}-${step}`;
}

/** Nombre del token de estado: `statusToken('error', 'fg')` → `--st-error-fg`. */
export function statusToken<T extends StatusType, S extends StatusSlot>(
  status: T,
  slot: S,
): `--st-${T}-${S}` {
  return `--st-${status}-${slot}`;
}

export function spacingToken<S extends SpacingStep>(step: S): `--sp-${S}` {
  return `--sp-${step}`;
}

export function radiusToken<N extends RadiusName>(name: N): `--r-${N}` {
  return `--r-${name}`;
}

/** El único puente a CSS: `cssVar(BRAND.primary)` → `var(--brand-primary)`. */
export function cssVar(token: DesignToken): string {
  return `var(${token})`;
}

/**
 * Catálogo completo en runtime — el contrato que `src/styles.css` debe declarar.
 * Existe para que la deriva CSS ↔ TS sea detectable, no para iterarlo en la UI.
 */
export const DESIGN_TOKENS: readonly DesignToken[] = Object.freeze([
  ...RAMP_FAMILIES.flatMap((family) => RAMP_STEPS.map((step) => rampToken(family, step))),
  ...Object.values(SURFACE),
  ...Object.values(TEXT),
  ...Object.values(BRAND),
  ...Object.values(BORDER),
  ...STATUS_TYPES.flatMap((status) => STATUS_SLOTS.map((slot) => statusToken(status, slot))),
  ...BRAND_TONES.flatMap((tone) =>
    STATUS_SLOTS.map((slot): BrandToneToken => `--st-${tone}-${slot}`),
  ),
  ...Object.values(EFFECT),
  ...SPACING_STEPS.map(spacingToken),
  ...RADIUS_NAMES.map(radiusToken),
  ...BREAKPOINT_NAMES.map((name): BreakpointToken => `--bp-${name}`),
  ...LAYER_NAMES.map((name): LayerToken => `--z-${name}`),
  ...DURATION_NAMES.map((name): DurationToken => `--dur-${name}`),
  ...EASING_NAMES.map((name): EasingToken => `--ease-${name}`),
  ...Object.values(FONT_FAMILY),
  ...TYPE_ROLES.map((role): FontSizeToken => `--fs-${role}`),
  ...LINE_HEIGHT_ROLES.map((role): LineHeightToken => `--lh-${role}`),
]);

/** Guarda de tipo para lo que viene de `localStorage`, que es texto sin contrato. */
export function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === 'string' && (THEME_MODES as readonly string[]).includes(value);
}
