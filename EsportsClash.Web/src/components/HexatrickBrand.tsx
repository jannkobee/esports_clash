/**
 * The Hexatrick mark: a faceted hexagon holding an italic H whose crossbar is a rising slash, the "trick".
 * Drawn in currentColor so it takes the theme accent; the facets are tints of the same colour.
 */
export function HexatrickMark({className=''}: {className?:string}) {
  return <svg className={className} width="26" height="28" viewBox="0 0 40 44" aria-hidden="true">
    <path d="M20 1.6 37.6 11.8v20.4L20 42.4 2.4 32.2V11.8Z" fill="currentColor" opacity=".12"/>
    <path d="M20 1.6 37.6 11.8 20 22Z" fill="currentColor" opacity=".14"/>
    <path d="M2.4 32.2 20 22v20.4Z" fill="currentColor" opacity=".08"/>
    <path d="M20 1.6 37.6 11.8v20.4L20 42.4 2.4 32.2V11.8Z" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round"/>
    <path d="M15.2 11h5.1l-5.6 22H9.6Zm11.2 0h5.1l-5.6 22h-5.1Z" fill="currentColor"/>
    <path d="M11.4 25.9 29.6 17l-1.2 4.8-18.2 8.9Z" fill="currentColor"/>
  </svg>;
}
