'use client'
import { useEffect, useRef, useState } from 'react'

/** État de la connexion à un canal, affiché par l'interface. */
export type ChannelStatus = 'connecting' | 'open' | 'reconnecting'

/** Événement reçu sur un canal : un événement du journal, sous sa forme générique. */
export interface ChannelEvent {
  /** Position dans le journal, tous flux confondus. */
  position: number
  stream: string
  version: number
  type: string
  data: Record<string, unknown>
}

/**
 * Hook React d'abonnement à un canal temps réel.
 * EventSource se reconnecte d'elle-même après une interruption et renvoie l'en-tête
 * Last-Event-ID : la reprise ne demande aucun code ici. Le cookie de session est joint
 * automatiquement. La fonction de rappel est conservée dans une référence : la changer
 * à chaque rendu ne doit pas fermer et rouvrir la connexion.
 */
export function useChannel(channel: string | null, onEvent: (event: ChannelEvent) => void) {
  const [status, setStatus] = useState<ChannelStatus>('connecting')

  const handler = useRef(onEvent)
  handler.current = onEvent

  useEffect(() => {
    if (!channel) return
    const source = new EventSource(`/api/stream/${encodeURIComponent(channel)}`)

    source.addEventListener('ready', () => setStatus('open'))
    source.addEventListener('domain-event', (message) => {
      handler.current(JSON.parse((message as MessageEvent<string>).data))
    })
    source.onerror = () => setStatus('reconnecting')

    return () => source.close()
  }, [channel])

  return status
}
