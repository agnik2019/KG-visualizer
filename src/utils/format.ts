export function parseStringList(value: string | undefined): string[] {
  if (!value || !value.trim()) return []
  const trimmed = value.trim()
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean)
      }
    } catch {
      return [trimmed]
    }
  }
  return [trimmed]
}

export function present(value: string | undefined | null): boolean {
  return Boolean(value && value.trim())
}

export function formatNumber(value: number, digits = 0): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits })
}

export function formatConfidence(value: number | null): string {
  if (value == null) return ''
  return value.toLocaleString(undefined, { maximumFractionDigits: 3 })
}

export function datasetUrl(fileName: string): string {
  const base = import.meta.env.BASE_URL || '/'
  return `${base.endsWith('/') ? base : `${base}/`}data/${fileName}`
}

export function downloadText(filename: string, contents: string, type = 'text/csv;charset=utf-8'): void {
  const blob = new Blob([contents], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
