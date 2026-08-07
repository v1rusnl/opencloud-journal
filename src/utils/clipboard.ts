// Clipboard access needs a secure context and a user gesture. Both hold when a
// button in the app is clicked over HTTPS, but neither is guaranteed — a
// self-hosted instance reached over plain HTTP has no navigator.clipboard at
// all. Callers get a boolean so they can fall back to "select the text
// yourself" instead of silently doing nothing.
export async function copyText(text: string): Promise<boolean> {
  try {
    if (!navigator.clipboard?.writeText) return false
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Permission denied, or the document lost focus mid-write.
    return false
  }
}
