'use client'
import { hc } from 'hono/client'
import {
  createContext,
  type FormEvent,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useChannel } from '@/platform/realtime/use-channel'
import { Entity } from '@/ui/entity'
import type { TavernApi } from './api'
import {
  HEARTBEAT_MS,
  MESSAGE_MAX_LENGTH,
  type MessageError,
  type PresentPlayer,
  REFRESH_MS,
  samePlayers,
  TAVERN_CHANNEL,
  type TavernMessage,
} from './contracts'

/** Client HTTP typé, déduit de la sous-application Hono du module. */
const client = hc<TavernApi>('/api/tavern')

/** Libellé affiché pour chaque état de la connexion temps réel. */
const STATUS_LABELS = {
  connecting: 'Connexion...',
  open: 'Temps réel connecté',
  reconnecting: 'Reconnexion...',
} as const

/** Message affiché au joueur pour chaque erreur. */
function errorText(error: MessageError | { code: 'INVALID_INPUT' }): string {
  switch (error.code) {
    case 'EMPTY_MESSAGE':
      return 'Le message est vide.'
    case 'MESSAGE_TOO_LONG':
      return `Le message dépasse ${error.max} caractères.`
    case 'TOO_MANY_MESSAGES':
      return `Trop de messages : patientez ${Math.ceil(error.retryAfterMs / 1000)} secondes.`
    case 'INVALID_INPUT':
      return 'Saisie invalide.'
  }
}

/** Ajoute des messages à la liste, sans doublon, dans l'ordre de leurs identifiants. */
function merge(current: TavernMessage[], added: TavernMessage[]): TavernMessage[] {
  const byId = new Map(current.map((message) => [message.id, message]))
  for (const message of added) byId.set(message.id, message)
  return [...byId.values()].sort((a, b) => a.id - b.id)
}

/**
 * Départ en cours de transmission. Un signal de présence attend qu'il soit reçu : sans cela,
 * un joueur qui quitte la Taverne puis y revient aussitôt pourrait voir son départ arriver
 * au serveur après son nouveau signal, et disparaître de la liste des présents.
 */
let leaving: Promise<unknown> = Promise.resolve()

/** Signale le départ du joueur ; keepalive maintient la requête pendant la fermeture de l'onglet. */
function leave() {
  leaving = fetch('/api/tavern/presence/leave', { method: 'POST', keepalive: true }).catch(() => {})
}

/** Heure d'un message, au format local. */
const timeOf = (at: number) =>
  new Date(at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

/**
 * État de la Taverne, partagé avec les composants qu'un autre module place dans son écran : les
 * joueurs présents, les messages, et l'instant où chaque message reçu en direct est arrivé, sur
 * l'horloge du navigateur. Les messages de l'historique n'ont pas d'instant d'arrivée.
 */
export interface TavernState {
  userId: string
  players: PresentPlayer[]
  messages: TavernMessage[]
  arrivals: Record<number, number>
}

const TavernContext = createContext<TavernState>({
  userId: '',
  players: [],
  messages: [],
  arrivals: {},
})

/** État de la Taverne, lu depuis un composant placé dans son écran. */
export const useTavernState = () => useContext(TavernContext)

/**
 * Écran de la Taverne : salon de discussion et joueurs présents. Les messages arrivent par
 * l'historique, relu à chaque ouverture du canal, et par le canal temps réel, qui ne diffuse
 * que les messages à venir. La présence repose sur un signal régulier, un départ étant
 * signalé lorsque le joueur quitte la page ; la liste des présents est relue toutes les cinq
 * secondes, et aussitôt lorsqu'un message arrive d'un joueur qu'elle ne contient pas. Les
 * composants passés en enfants, placés sous le salon, lisent son état par useTavernState.
 */
export function TavernScreen({ userId, children }: { userId: string; children?: ReactNode }) {
  const [messages, setMessages] = useState<TavernMessage[]>([])
  const [players, setPlayers] = useState<PresentPlayer[]>([])
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [arrivals, setArrivals] = useState<Record<number, number>>({})

  const arrived = useCallback((id: number) => {
    setArrivals((current) => (id in current ? current : { ...current, [id]: Date.now() }))
  }, [])

  const refresh = useCallback(async () => {
    const res = await client.messages.$get()
    if (!res.ok) return
    const latest = (await res.json()).messages
    setMessages((current) => merge(current, latest))
  }, [])

  const updatePlayers = useCallback((next: PresentPlayer[]) => {
    setPlayers((current) => (samePlayers(current, next) ? current : next))
  }, [])

  const refreshPresence = useCallback(async () => {
    const res = await client.presence.$get()
    if (res.ok) updatePlayers((await res.json()).players)
  }, [updatePlayers])

  const known = useRef<PresentPlayer[]>([])

  const status = useChannel(TAVERN_CHANNEL, (event) => {
    const message = event.data as unknown as TavernMessage
    setMessages((current) => merge(current, [message]))
    arrived(message.id)
    if (!known.current.some((player) => player.id === message.authorId)) refreshPresence()
  })

  useEffect(() => {
    if (status === 'open') refresh()
  }, [status, refresh])

  useEffect(() => {
    const beat = async () => {
      await leaving
      const res = await client.presence.$post()
      if (res.ok) updatePlayers((await res.json()).players)
    }
    beat()
    const timer = setInterval(beat, HEARTBEAT_MS)
    window.addEventListener('pagehide', leave)
    return () => {
      clearInterval(timer)
      window.removeEventListener('pagehide', leave)
      leave()
    }
  }, [updatePlayers])

  useEffect(() => {
    known.current = players
  }, [players])

  useEffect(() => {
    const reread = () => {
      if (!document.hidden) refreshPresence()
    }
    const timer = setInterval(reread, REFRESH_MS)
    document.addEventListener('visibilitychange', reread)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', reread)
    }
  }, [refreshPresence])

  async function send(event: FormEvent) {
    event.preventDefault()
    const res = await client.messages.$post({ json: { body: draft } })
    const body = await res.json()
    if ('error' in body) {
      setError(errorText(body.error as MessageError))
    } else {
      setError(null)
      setDraft('')
      setMessages((current) => merge(current, [body.message]))
      arrived(body.message.id)
    }
  }

  const state = useMemo(
    () => ({ userId, players, messages, arrivals }),
    [userId, players, messages, arrivals],
  )

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>
          <Entity kind="tavern" /> Taverne
        </h1>
        <span className="status" data-status={status}>
          {STATUS_LABELS[status]}
        </span>
      </div>

      <div className="tavern">
        <section className="panel" aria-label="Messages">
          {messages.length === 0 && <p className="muted">Aucun message pour le moment.</p>}
          <ul className="messages">
            {messages.map((message) => (
              <li key={message.id} data-mine={message.authorId === userId || undefined}>
                <span className="muted">{timeOf(message.postedAt)}</span>{' '}
                <strong>{message.authorName}</strong> {message.body}
              </li>
            ))}
          </ul>
          <form className="row" onSubmit={send}>
            <input
              aria-label="Votre message"
              value={draft}
              maxLength={MESSAGE_MAX_LENGTH * 2}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Votre message"
              style={{ flex: 1 }}
            />
            <button type="submit">Envoyer</button>
          </form>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </section>

        <section className="panel" aria-label="Joueurs présents">
          <h2>Présents</h2>
          <ul className="presence">
            {players.map((player) => (
              <li key={player.id}>{player.name}</li>
            ))}
          </ul>
        </section>
      </div>

      <TavernContext.Provider value={state}>{children}</TavernContext.Provider>
    </>
  )
}
