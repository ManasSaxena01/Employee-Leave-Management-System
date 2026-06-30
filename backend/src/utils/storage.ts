import fs from 'fs/promises'
import path from 'path'

export interface StorageProvider {
  save(buffer: Buffer, filename: string): Promise<string>
  getSignedUrl(filename: string): Promise<string>
}

const localProvider: StorageProvider = {
  async save(buffer, filename) {
    const dest = path.join('uploads', filename)
    await fs.writeFile(dest, buffer)
    return filename
  },
  async getSignedUrl(filename) {
    const appUrl = process.env['APP_URL'] ?? `http://localhost:${process.env['PORT'] ?? 4000}`
    return `${appUrl}/api/files/${encodeURIComponent(filename)}`
  }
}

const r2Provider: StorageProvider = {
  async save(_buffer, _filename) {
    throw new Error('R2 storage not configured')
  },
  async getSignedUrl(_filename) {
    throw new Error('R2 storage not configured')
  }
}

export function getStorageProvider(): StorageProvider {
  return process.env['STORAGE_PROVIDER'] === 'r2' ? r2Provider : localProvider
}
