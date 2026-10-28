import { headers } from 'next/headers'
import { currentUser } from '@/bootstrap/server'
import { AvatarStage } from '@/modules/avatars/ui'
import { TavernScreen } from '@/modules/tavern/ui'

/**
 * Page de la Taverne. Les messages du joueur connecté y sont mis en évidence, et les personnages
 * des joueurs présents sont placés sous le salon.
 */
export default async function TavernPage() {
  const user = await currentUser(await headers())
  return (
    <TavernScreen userId={user?.id ?? ''}>
      <AvatarStage />
    </TavernScreen>
  )
}
