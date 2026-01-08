const RAW_BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || process.env.BASE_PATH || '';

const NORMALIZED_BASE_PATH = (() => {
  if (!RAW_BASE_PATH || RAW_BASE_PATH === '/') return '';
  const trimmed = RAW_BASE_PATH.replace(/\/+$/g, '');
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
})();

export function withAppBasePath(path: string): string {
  if (!path.startsWith('/')) {
    throw new Error('withAppBasePath expects an absolute path starting with "/"');
  }
  if (!NORMALIZED_BASE_PATH) return path;
  return `${NORMALIZED_BASE_PATH}${path}`;
}
