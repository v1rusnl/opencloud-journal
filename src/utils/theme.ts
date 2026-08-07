// OpenCloud offers no theme class and no media query to hook into — it swaps the
// --oc-role-* custom properties at runtime. Almost everything can simply consume
// those properties, but native form controls (date pickers, selects, scrollbars)
// obey the CSS `color-scheme` property, which takes a keyword rather than a
// colour. `color-scheme: light dark` hands the decision to the operating system,
// which is exactly the mismatch that broke the light theme: OS dark + OpenCloud
// light produced dark pickers inside light dialogs.
//
// So the keyword has to be derived from the theme's own surface colour.

/** Relative luminance per WCAG 2.1, or null if the colour cannot be parsed. */
export function luminance(color: string): number | null {
  const c = color.trim()
  let r: number, g: number, b: number

  const hex = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map(x => x + x).join('') : hex[1]
    ;[r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255)
  } else {
    const rgb = c.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i)
    if (!rgb) return null
    ;[r, g, b] = rgb.slice(1, 4).map(v => Number(v) / 255)
  }

  const f = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

/**
 * The `color-scheme` keyword matching a background colour. Unparseable input
 * falls back to 'light', the CSS default — better a wrong keyword than a
 * thrown error while painting.
 */
export function schemeForBackground(color: string): 'light' | 'dark' {
  const l = luminance(color)
  return l !== null && l < 0.5 ? 'dark' : 'light'
}
