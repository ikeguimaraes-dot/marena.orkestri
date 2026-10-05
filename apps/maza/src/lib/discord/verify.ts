import { verifyKey } from 'discord-interactions'

export async function verifyDiscordSignature(
  publicKey: string,
  signature: string,
  timestamp: string,
  rawBody: string
): Promise<boolean> {
  return verifyKey(rawBody, signature, timestamp, publicKey)
}
