// Carga desde Google Fonts la familia de un proyecto para que el lienzo y las vistas previas se vean con ella.

const loaded = new Set<string>();
const LOCAL = /^(system-ui|-apple-system|blinkmacsystemfont|segoe ui|sans-serif|serif|monospace|ui-monospace|georgia|times new roman|arial|helvetica|inter|overpass|jetbrains mono)$/i;

export function loadFont(stack: string) {
  if (typeof document === 'undefined') return;
  const family = stack.split(',')[0]?.trim().replace(/^['"]|['"]$/g, '');
  if (!family || LOCAL.test(family) || loaded.has(family)) return;
  loaded.add(family);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}:wght@400;500;600;700;800&display=swap`;
  document.head.appendChild(link);
}
