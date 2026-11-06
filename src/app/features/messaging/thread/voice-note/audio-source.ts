/**
 * The bytes behind an attachment URL, without the network.
 *
 * The chat hands attachments over as `data:` URLs, but the CSP allows media
 * only from `'self'` and `blob:` (`media-src`), and no `data:` connections
 * (`connect-src`). So a `data:` URL is decoded here, in memory, and played
 * through an object URL. Any other URL (`blob:`, same origin) is fetched.
 */
export async function audioBlobOf(src: string): Promise<Blob> {
  // `data:audio/webm;codecs=opus;base64,…`: the type may carry parameters.
  const match = /^data:([^,]*),(.*)$/s.exec(src);
  if (match === null) {
    return (await fetch(src)).blob();
  }
  const [, meta, payload] = match;
  const type = meta!.replace(/;base64$/, '');
  if (!meta!.endsWith(';base64')) {
    return new Blob([decodeURIComponent(payload!)], { type });
  }
  const binary = atob(payload!);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}
