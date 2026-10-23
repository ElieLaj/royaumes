import type { Notification } from '../domain/notification'

/**
 * Port de lecture des notifications, défini par la couche application. Les notifications sont un
 * modèle de lecture : le module n'enregistre aucun événement.
 */
export interface NotificationsStore {
  /**
   * Notifications d'un joueur qui ne sont pas antérieures à l'instant since, à jour au moment
   * de l'appel, avec la position de la projection et la position de lecture du joueur.
   */
  forPlayer(
    playerId: string,
    since: number,
  ): Promise<{ position: number; notifications: Notification[]; readUntil: number }>
  /** Avance la position de lecture d'un joueur ; elle ne recule jamais, même en cas d'accès simultanés. */
  saveReadUntil(playerId: string, readUntil: number): Promise<void>
  /**
   * Supprime les notifications, et les lignes de correspondance, antérieures à l'instant before ;
   * renvoie leur nombre.
   */
  removeOlderThan(before: number): Promise<{ notifications: number; parties: number }>
}
