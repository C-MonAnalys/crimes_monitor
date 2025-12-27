export function assetUrl(pathFromAssetsRoot: string): string {
  const baseTag = document.getElementsByTagName('base')[0];
  const baseHref = (baseTag && baseTag.getAttribute('href')) || '/';
  // Garante uma única barra entre base e assets
  const base = baseHref.endsWith('/') ? baseHref.slice(0, -1) : baseHref;
  const path = pathFromAssetsRoot.startsWith('/') ? pathFromAssetsRoot : `/${pathFromAssetsRoot}`;
  return `${base}${path}`;
}
