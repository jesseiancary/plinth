import { describe, expect, it } from 'vitest'

import { getAvatarInitial, sanitizeDisplayText, sanitizeText } from './sanitize'

describe('sanitizeText', () => {
  it('should remove null bytes', () => {
    expect(sanitizeText('Hello\x00World')).toBe('HelloWorld')
  })

  it('should remove control characters', () => {
    expect(sanitizeText('Hello\x01\x02\x03World')).toBe('HelloWorld')
  })

  it('should preserve common whitespace', () => {
    expect(sanitizeText('Hello World\nNew Line\tTab')).toBe('Hello World\nNew Line\tTab')
  })

  it('should trim leading and trailing whitespace', () => {
    expect(sanitizeText('  Hello World  ')).toBe('Hello World')
  })

  it('should handle empty strings', () => {
    expect(sanitizeText('')).toBe('')
  })

  it('should handle strings with only control characters', () => {
    expect(sanitizeText('\x00\x01\x02')).toBe('')
  })
})

describe('sanitizeDisplayText', () => {
  it('should sanitize text', () => {
    expect(sanitizeDisplayText('Hello\x00World')).toBe('HelloWorld')
  })

  it('should truncate long text with ellipsis', () => {
    const longText = 'a'.repeat(150)
    const result = sanitizeDisplayText(longText, 100)
    expect(result).toBe('a'.repeat(97) + '...')
    expect(result.length).toBe(100)
  })

  it('should not truncate text shorter than max length', () => {
    expect(sanitizeDisplayText('Short text', 100)).toBe('Short text')
  })

  it('should use default max length of 100', () => {
    const longText = 'a'.repeat(150)
    const result = sanitizeDisplayText(longText)
    expect(result.length).toBe(100)
  })

  it('should handle custom max length', () => {
    const text = 'Hello World'
    expect(sanitizeDisplayText(text, 5)).toBe('He...')
  })
})

describe('getAvatarInitial', () => {
  it('should return first letter in uppercase', () => {
    expect(getAvatarInitial('Alice')).toBe('A')
    expect(getAvatarInitial('bob')).toBe('B')
  })

  it('should return first alphanumeric character', () => {
    expect(getAvatarInitial('!@#Alice')).toBe('A')
    expect(getAvatarInitial('123Bob')).toBe('1')
  })

  it('should handle names with control characters', () => {
    expect(getAvatarInitial('\x00\x01Alice')).toBe('A')
  })

  it('should return ? for empty strings', () => {
    expect(getAvatarInitial('')).toBe('?')
  })

  it('should return ? for strings with only special characters', () => {
    expect(getAvatarInitial('!@#$%^&*()')).toBe('?')
  })

  it('should return ? for strings with only control characters', () => {
    expect(getAvatarInitial('\x00\x01\x02')).toBe('?')
  })

  it('should handle unicode characters by finding first ASCII alphanumeric', () => {
    expect(getAvatarInitial('Émilie')).toBe('M') // Finds first ASCII alphanumeric after É
    expect(getAvatarInitial('Übung')).toBe('B') // Finds first ASCII alphanumeric after Ü
  })

  it('should handle numbers', () => {
    expect(getAvatarInitial('42 Organization')).toBe('4')
  })
})
