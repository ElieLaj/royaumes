import type { Notification } from '../domain/notification'

/**
 * Port de lecture des notifications, défini par la couche application. Les notifications sont un
 * modèle de lecture : le module n'enregistre aucun événement.
 */
export interface NotificationsStore {
  /**
   * Notifications d'un joueur qui ne sont pas antérieures à l'instant since, à jour au moment
   * de l'appel, avec la position de la projection.
   */
  forPlayer(
    playerId: string,
    since: number,
  ): Promise<{ position: number; notifications: Notification[] }>
}
