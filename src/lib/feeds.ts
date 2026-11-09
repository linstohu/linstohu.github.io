export function xml(value: unknown): string {
  return String(value).replace(
    /[<>&"']/g,
    (character) =>
      ({
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        '"': '&quot;',
        "'": '&apos;',
      })[character]!,
  );
}
export const xmlResponse = (body: string) =>
  new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
