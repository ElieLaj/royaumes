'use client'
import { hc } from 'hono/client'
import Image from 'next/image'
import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react'
import { useTavernState } from '@/modules/tavern/ui'
import type { AvatarsApi } from './api'
import {
  defaultSkin,
  LOOKUP_MAX,
  SKIN_LOOKS,
  SKINS,
  SKINS_REFRESH_MS,
  type Skin,
} from './contracts'
import { BUBBLE_MS, type Spoken, visibleBubble } from './domain/bubble'
import { type Facing, planMove, startPosition } from './domain/wander'

/** Client HTTP typé, déduit de la sous-application Hono du module. */
const client = hc<AvatarsApi>('/api/avatars')

/** Vrai si le joueur a demandé au système de réduire les animations. */
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return reduced
}

/** Nombre de rangées de profondeur de la scène : les personnages ne se superposent pas tous. */
const ROWS = 3

/**
 * Délai de grâce, en millisecondes, après la durée prévue d'une marche : si le navigateur ne
 * signale pas la fin du déplacement, le personnage s'arrête de toute façon.
 */
const WALK_GRACE_MS = 500

/** Rangée d'un joueur, stable d'une visite à l'autre : elle se déduit de son identifiant. */
const rowOf = (playerId: string) =>
  [...playerId].reduce((sum, character) => sum + character.charCodeAt(0), 0) % ROWS

interface CharacterProps {
  id: string
  name: string
  skin: Skin
  bubble: string | null
  mine: boolean
  still: boolean
}

/**
 * Personnage d'un joueur : il alterne les pauses, où il est au repos, et les marches, où il
 * est animé. Sa position n'existe que dans ce navigateur : elle n'est partagée avec personne.
 * Les deux images sont affichées en permanence, l'une masquée : le personnage ne se déplace
 * qu'une fois son image de marche chargée, et reprend son image de repos à la fin réelle du
 * déplacement, signalée par le navigateur, et non à une minuterie qui l'anticiperait.
 */
function Character({ id, name, skin, bubble, mine, still }: CharacterProps) {
  const [position, setPosition] = useState(() => startPosition(Math.random))
  const [move, setMove] = useState<{ walking: boolean; facing: Facing; walkMs: number }>({
    walking: false,
    facing: 'right',
    walkMs: 0,
  })
  const [loaded, setLoaded] = useState<Skin | null>(null)
  const here = useRef(position)
  const finish = useRef<(() => void) | null>(null)
  const walkImage = useRef<HTMLImageElement>(null)
  const resting = still || loaded !== skin

  useEffect(() => {
    const image = walkImage.current
    if (image?.complete && image.naturalWidth > 0) setLoaded(skin)
  }, [skin])

  useEffect(() => {
    if (resting) {
      setMove((current) => (current.walking ? { ...current, walking: false } : current))
      return
    }
    let timer: ReturnType<typeof setTimeout>
    const rest = () => {
      finish.current = null
      const plan = planMove(here.current, Math.random)
      timer = setTimeout(() => {
        here.current = plan.to
        setPosition(plan.to)
        setMove({ walking: true, facing: plan.facing, walkMs: plan.walkMs })
        finish.current = () => {
          clearTimeout(timer)
          setMove((current) => ({ ...current, walking: false }))
          rest()
        }
        timer = setTimeout(() => finish.current?.(), plan.walkMs + WALK_GRACE_MS)
      }, plan.pauseMs)
    }
    rest()
    return () => {
      clearTimeout(timer)
      finish.current = null
    }
  }, [resting])

  const look = SKIN_LOOKS[skin]

  return (
    <div
      className="avatar"
      data-mine={mine || undefined}
      data-speaking={bubble !== null || undefined}
      style={
        {
          left: `${position * 100}%`,
          transitionDuration: move.walking ? `${move.walkMs}ms` : '0ms',
          '--row': rowOf(id),
        } as CSSProperties
      }
      onTransitionEnd={(event) => {
        if (event.target === event.currentTarget && event.propertyName === 'left')
          finish.current?.()
      }}
    >
      {bubble !== null && <div className="avatar-bubble">{bubble}</div>}
      <span className="avatar-name">{name}</span>
      <div
        className="avatar-sprites"
        style={{ transform: move.facing === 'left' ? 'scaleX(-1)' : undefined }}
      >
        <Image
          className={move.walking ? 'avatar-sprite avatar-sprite-off' : 'avatar-sprite'}
          src={look.idle.src}
          width={look.idle.width}
          height={look.idle.height}
          alt=""
          unoptimized
          loading="eager"
        />
        <Image
          ref={walkImage}
          className={move.walking ? 'avatar-sprite' : 'avatar-sprite avatar-sprite-off'}
          src={look.walk.src}
          width={look.walk.width}
          height={look.walk.height}
          alt=""
          unoptimized
          loading="eager"
          onLoad={() => setLoaded(skin)}
        />
      </div>
    </div>
  )
}

/**
 * Scène des personnages, au bas de la Taverne : chaque joueur présent y est représenté par le
 * personnage qu'il a choisi, qui se promène au hasard, et qui affiche une bulle lorsque son
 * joueur écrit. Les joueurs présents et les messages viennent de l'écran de la Taverne ; le
 * personnage de chacun est demandé au serveur lorsque la liste des présents change, et toutes les trente secondes.
 */
export function AvatarStage() {
  const { userId, players, messages, arrivals } = useTavernState()
  const [skins, setSkins] = useState<Record<string, Skin>>({})
  const [error, setError] = useState<string | null>(null)
  const [, tick] = useState(0)
  const still = usePrefersReducedMotion()
  const shown = players.slice(0, LOOKUP_MAX)

  const present = shown.map((player) => player.id).join(',')

  useEffect(() => {
    if (present === '') return
    let cancelled = false
    const ask = async () => {
      const res = await client.lookup.$post({ json: { playerIds: present.split(',') } })
      if (!res.ok || cancelled) return
      const body = await res.json()
      if (!cancelled) setSkins((current) => ({ ...current, ...body.skins }))
    }
    ask()
    const timer = setInterval(ask, SKINS_REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [present])

  const spoken: Spoken[] = useMemo(
    () =>
      messages
        .filter((message) => message.id in arrivals)
        .map((message) => ({
          authorId: message.authorId,
          body: message.body,
          receivedAt: arrivals[message.id],
        })),
    [messages, arrivals],
  )

  useEffect(() => {
    const expiries = spoken
      .map((entry) => entry.receivedAt + BUBBLE_MS)
      .filter((at) => at > Date.now())
    if (expiries.length === 0) return
    const timer = setTimeout(() => tick((n) => n + 1), Math.min(...expiries) - Date.now() + 20)
    return () => clearTimeout(timer)
  })

  const skinOfPlayer = (id: string) => skins[id] ?? defaultSkin(id)
  const mySkin = skinOfPlayer(userId)
  const now = Date.now()

  async function choose(skin: Skin) {
    const previous = skins[userId]
    setSkins((current) => ({ ...current, [userId]: skin }))
    const res = await client.me.$put({ json: { skin } })
    if (res.ok) {
      setError(null)
      return
    }
    setSkins((current) => ({ ...current, [userId]: previous ?? defaultSkin(userId) }))
    setError("Le personnage n'a pas pu être enregistré.")
  }

  return (
    <section className="panel stage" aria-label="Personnages de la Taverne">
      <div className="stage-floor" aria-hidden="true">
        {shown.map((player) => (
          <Character
            key={player.id}
            id={player.id}
            name={player.name}
            skin={skinOfPlayer(player.id)}
            bubble={visibleBubble(spoken, player.id, now)}
            mine={player.id === userId}
            still={still}
          />
        ))}
      </div>
      <fieldset className="avatar-picker">
        <legend className="muted">Votre personnage</legend>
        {SKINS.map((skin) => (
          <button
            key={skin}
            type="button"
            aria-pressed={mySkin === skin}
            onClick={() => choose(skin)}
            title={SKIN_LOOKS[skin].label}
          >
            <Image
              src={SKIN_LOOKS[skin].idle.src}
              width={SKIN_LOOKS[skin].idle.width}
              height={SKIN_LOOKS[skin].idle.height}
              alt={SKIN_LOOKS[skin].label}
              unoptimized
            />
          </button>
        ))}
      </fieldset>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
