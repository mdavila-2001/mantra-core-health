import { allPosts, MIN_POSTS, performanceBy, performanceByHour, selectPosts, topByEngagement, TOPICS } from './social-posts';
import { PLATFORMS } from './social';

describe('publicaciones de redes', () => {
  const range = { from: '2026-09-01', to: '2026-10-29' };

  it('son deterministas y cubren las cuatro plataformas', () => {
    expect(allPosts()).toBe(allPosts());
    expect(new Set(allPosts().map((p) => p.platform)).size).toBe(PLATFORMS.length);
    expect(allPosts().every((p) => p.impressions > 0 && p.er > 0 && p.er < 1)).toBe(true);
  });

  it('el ranking es por tasa de interacción y trae seis', () => {
    const top = topByEngagement(selectPosts(range, PLATFORMS).posts);
    expect(top).toHaveLength(6);
    expect(top[0]!.er).toBeGreaterThanOrEqual(top[5]!.er);
  });

  it('la tasa de un grupo es interacciones ÷ impresiones, no el promedio de tasas', () => {
    const posts = selectPosts(range, ['instagram']).posts;
    const row = performanceBy(posts, 'format')[0]!;
    const group = posts.filter((p) => p.format === row.label);
    const expected = group.reduce((s, p) => s + p.engagements, 0) / group.reduce((s, p) => s + p.impressions, 0);
    expect(row.er).toBeCloseTo(expected, 10);
    expect(row.n).toBe(group.length);
  });

  it('el análisis encuentra el patrón plantado: el vídeo corto supera a la imagen y las historias a las promociones', () => {
    const all = selectPosts(range, PLATFORMS).posts;
    const fmt = new Map(performanceBy(all, 'format').map((r) => [r.label, r.er]));
    expect(fmt.get('Video corto')!).toBeGreaterThan(fmt.get('Imagen')!);
    const topic = new Map(performanceBy(all, 'topic').map((r) => [r.label, r.er]));
    expect(topic.get('Historias de pacientes')!).toBeGreaterThan(topic.get('Promociones')!);
    expect(TOPICS).toHaveLength(8);
  });

  it('el mejor horario es nocturno y una hora con pocas publicaciones se marca frágil, no se elige', () => {
    const { rows, average, best } = performanceByHour(selectPosts(range, PLATFORMS).posts);
    expect(average).not.toBeNull();
    expect([19, 20, 21]).toContain(best);
    const few = performanceByHour(allPosts().filter((p) => p.hour === 8).slice(0, 2));
    expect(few.rows[0]?.fragile).toBe(true);
    expect(few.best).toBeNull();
    expect(rows.length).toBeGreaterThan(3);
  });

  it('con pocas publicaciones en el periodo se amplía a 30 días y se avisa', () => {
    const narrow = selectPosts({ from: '2026-10-28', to: '2026-10-29' }, ['youtube']);
    expect(narrow.widened).toBe(true);
    expect(narrow.range).toEqual({ from: '2026-09-30', to: '2026-10-29' });
    expect(MIN_POSTS).toBe(8);
    expect(selectPosts(range, PLATFORMS).widened).toBe(false);
  });
});
