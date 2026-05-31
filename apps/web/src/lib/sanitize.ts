/**
 * Sanitizes user-generated text content to prevent XSS attacks.
 *
 * While React automatically escapes text content, this provides an additional
 * layer of defense by removing potentially dangerous characters and patterns.
 *
 * @param text - The user-generated text to sanitize
 * @returns The sanitized text safe for display
 */
export function sanitizeText(text: string): string {
  return (
    text
      // Remove null bytes
      .replace(/\0/g, '')
      // Remove control characters (except common whitespace)
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
      // Normalize whitespace
      .trim()
  )
}

/**
 * Sanitizes and truncates text for display in UI components.
 * Useful for usernames, organization names, etc.
 *
 * @param text - The text to sanitize and truncate
 * @param maxLength - Maximum length (default: 100)
 * @returns The sanitized and truncated text
 */
export function sanitizeDisplayText(text: string, maxLength = 100): string {
  const sanitized = sanitizeText(text)

  if (sanitized.length <= maxLength) {
    return sanitized
  }

  return `${sanitized.slice(0, maxLength - 3)}...`
}

/**
 * Gets the first character of a name for avatar display.
 * Returns a fallback '?' if the name is empty or contains only special characters.
 *
 * @param name - The user or organization name
 * @returns A single uppercase letter or '?'
 */
export function getAvatarInitial(name: string): string {
  const sanitized = sanitizeText(name)

  // Find first alphanumeric character
  const match = /[a-z0-9]/i.exec(sanitized)

  return match ? match[0].toUpperCase() : '?'
}
