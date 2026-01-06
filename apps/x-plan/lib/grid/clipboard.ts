export async function readClipboardText(): Promise<string | null> {
  if (typeof navigator === 'undefined') return null;
  const reader = navigator.clipboard?.readText;
  if (!reader) return null;
  try {
    return await reader.call(navigator.clipboard);
  } catch {
    return null;
  }
}

