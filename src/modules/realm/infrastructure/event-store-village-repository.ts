import type { EventStore, NewEvent } from '@/platform/event-store/event-store'
import type { VillageRepository } from '../application/village-repository'
import { villageChannel } from '../contracts'
import { replay, type VillageEvent } from '../domain/village'

/** Nom du flux qui contient les événements du village d'un joueur : celui de son canal. */
const villageStream = villageChannel

/**
 * Adaptateur du port VillageRepository fondé sur le journal d'événements.
 * Il traduit entre les événements typés du domaine et les événements génériques
 * de la plateforme, qui n'en connaît ni les types ni la structure.
 * La version du flux est celle de son dernier événement, ou 0 si le flux est vide.
 */
export function createEventStoreVillageRepository(store: EventStore): VillageRepository {
  return {
    async load(userId) {
      const stored = await store.read(villageStream(userId))
      const events = stored.map((e) => ({ type: e.type, data: e.data }) as VillageEvent)
      return { state: replay(events), version: stored.at(-1)?.version ?? 0 }
    },

    async save(userId, expectedVersion, events, messages) {
      await store.append(
        villageStream(userId),
        expectedVersion,
        events as unknown as NewEvent[],
        messages,
      )
    },
  }
}
