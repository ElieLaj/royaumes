'use client'
import { hc } from 'hono/client'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { type ChannelEvent, useChannel } from '@/platform/realtime/use-channel'
import { Entity } from '@/ui/entity'
import type { NotificationsApi } from './api'
import { type Feed, NOTIFICATIONS_CHANNEL, type NotificationView } from './contracts'

/** Client HTTP typé, déduit de la sous-application Hono du module. */
const client = hc<NotificationsApi>('/api/notifications')

/** Libellé affiché pour chaque état de la connexion temps réel. */
const STATUS_LABELS = {
  connecting: 'Connexion...',
  open: 'Temps réel connecté',
  reconnecting: 'Reconnexion...',
} as const

/** Délai entre deux relectures, tant que la projection n'a pas atteint l'événement annoncé. */
const RETRY_MS = 1_000

/** Nombre maximal de relectures pour un même événement annoncé. */
const MAX_READS = 10

/** Texte d'une notification, son symbole, et la page à laquelle elle renvoie. */
function describe(notification: NotificationView) {
  switch (notification.kind) {
    case 'trade-completed':
      return { text: 'Votre offre a été acceptée.', href: '/market', kind: 'market' }
    case 'offer-expired':
      return {
        text: 'Votre offre a expiré, ses ressources vous sont rendues.',
        href: '/market',
        kind: 'market',
      }
    case 'game-ended':
      return {
        text: `Votre expédition est terminée : ${notification.outcome === 'won' ? 'victoire' : 'défaite'}.`,
        href: `/dungeon/${notification.subjectId}`,
        kind: 'dungeon',
      }
  }
}

/** Date et heure d'une notification, au format local. */
const timeOf = (at: number) =>
  new Date(at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })

/** Écran des Notifications : le fil du joueur, ses notifications non lues, et leur marquage. */
export function NotificationsScreen() {
  const [feed, setFeed] = useState<Feed | undefined>(undefined)

  const refresh = useCallback(async () => {
    const res = await client.index.$get()
    if (!res.ok) return 0
    const body = await res.json()
    setFeed(body)
    return body.position
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const wanted = useRef(0)
  const following = useRef(false)

  const follow = useCallback(
    async (event: ChannelEvent) => {
      wanted.current = Math.max(wanted.current, event.position)
      if (following.current) return
      following.current = true
      try {
        for (let read = 0; read < MAX_READS; read++) {
          if ((await refresh()) >= wanted.current) return
          await new Promise((resolve) => setTimeout(resolve, RETRY_MS))
        }
      } finally {
        following.current = false
      }
    },
    [refresh],
  )

  const status = useChannel(NOTIFICATIONS_CHANNEL, follow)

  async function markAllRead() {
    const latest = feed?.notifications[0]?.position
    if (latest === undefined) return
    await client.read.$post({ json: { upTo: latest } })
    await refresh()
  }

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>
          <Entity kind="notifications" /> Notifications
        </h1>
        <span className="status" data-status={status}>
          {STATUS_LABELS[status]}
        </span>
      </div>
      <section className="panel" aria-label="Notifications">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="muted">
            {feed ? `${feed.unread} non lue${feed.unread > 1 ? 's' : ''}` : 'Chargement...'}
          </span>
          <button type="button" disabled={!feed || feed.unread === 0} onClick={markAllRead}>
            Tout marquer comme lu
          </button>
        </div>
        {feed?.notifications.length === 0 && <p className="muted">Aucune notification.</p>}
        <ul className="notifications">
          {feed?.notifications.map((notification) => {
            const { text, href, kind } = describe(notification)
            return (
              <li key={notification.position} data-unread={notification.read ? undefined : true}>
                <span>
                  <Entity kind={kind} /> <Link href={href}>{text}</Link>
                </span>
                <span className="muted">{timeOf(notification.occurredAt)}</span>
              </li>
            )
          })}
        </ul>
      </section>
    </>
  )
}
