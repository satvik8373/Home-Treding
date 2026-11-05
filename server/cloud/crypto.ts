import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

export interface Sealed { iv: string; data: string; tag: string }
export class CloudCipher {
  private key: Buffer
  constructor(secret: string) {
    if (!/^[a-f0-9]{64}$/i.test(secret)) throw new Error('Cloud encryption key must be 32 random bytes encoded as hex.')
    this.key = Buffer.from(secret, 'hex')
  }
  seal(value: unknown): Sealed {
    const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', this.key, iv)
    cipher.setAAD(Buffer.from('n009-cloud-v1'))
    const data = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()])
    return { iv: iv.toString('base64'), data: data.toString('base64'), tag: cipher.getAuthTag().toString('base64') }
  }
  open<T>(value: Sealed): T {
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(value.iv, 'base64'))
    decipher.setAAD(Buffer.from('n009-cloud-v1')); decipher.setAuthTag(Buffer.from(value.tag, 'base64'))
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(value.data, 'base64')), decipher.final()]).toString('utf8')) as T
  }
}
