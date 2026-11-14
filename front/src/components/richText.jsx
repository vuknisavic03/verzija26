// front/src/components/richText.jsx
// Jednostavno formatiranje teksta vesti: **podebljano** i *iskošeno* unutar pasusa.
// Pasusi: "# " naslov I, "## " naslov II, "• " stavka liste (stari tekstovi).

export function renderInline(text) {
  const parts = String(text).split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**") && p.length > 4) return <strong key={i} className="font-semibold">{p.slice(2, -2)}</strong>;
    if (p.startsWith("*") && p.endsWith("*") && p.length > 2) return <em key={i}>{p.slice(1, -1)}</em>;
    return p;
  });
}

/** Vrsta pasusa i tekst bez oznake. */
export function blockOf(p) {
  if (p.startsWith("## ")) return ["h2", p.slice(3)];
  if (p.startsWith("# ")) return ["h1", p.slice(2)];
  if (p.startsWith("• ")) return ["li", p.slice(2)];
  return ["p", p];
}
