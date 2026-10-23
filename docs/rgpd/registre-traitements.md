# Registre des traitements de données personnelles

Ce registre, prévu par l'article 30 du RGPD, recense les traitements de données personnelles
réalisés par Royaumes. Il est tenu à jour à chaque évolution du jeu qui ajoute, modifie ou
supprime une donnée personnelle, dans le même commit que cette évolution.

- Responsable du traitement : Elie Lajoinie (auteur du projet), contact par le dépôt GitHub
  [ElieLaj/royaumes](https://github.com/ElieLaj/royaumes).
- Date de dernière mise à jour : 2026-10-23.

## Sous-traitants

| Sous-traitant | Rôle | Localisation des données | Garanties à vérifier |
| --- | --- | --- | --- |
| Vercel | Hébergement de l'application, journaux techniques | Région de Francfort (fra1) pour les fonctions ; Vercel indique que ses installations principales de traitement sont aux États-Unis | Vercel publie un accord de traitement des données ([DPA](https://vercel.com/legal/dpa), mis à jour en mars 2026), qui s'applique à ses clients des offres Pro et Enterprise : à confirmer pour l'offre gratuite (Hobby) du projet. Les transferts hors de l'Union européenne sont encadrés par les clauses contractuelles types de 2021 ; la liste des sous-traitants de Vercel est publiée sur security.vercel.com. |
| Neon | Hébergement de la base de données | Région de Francfort (AWS `eu-central-1`) | Neon publie un accord de traitement des données ([DPA](https://neon.com/dpa)), qui fait partie de ses conditions d'utilisation, et se réfère aux clauses contractuelles types de 2021. La liste de ses sous-traitants renvoie à celle de sa société mère, et mentionne un prestataire situé aux États-Unis : elle est à consulter avant toute mise en production réelle. |

## Traitements

| N° | Traitement | Finalité | Données | Personnes concernées | Base légale | Durée de conservation | Emplacement |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T1 | Comptes des joueurs | Permettre l'accès au jeu | Nom, adresse électronique, empreinte du mot de passe, date d'inscription | Joueurs | Exécution du contrat (conditions d'utilisation du jeu) | Jusqu'à la suppression du compte | `identity.user`, `identity.account`, `identity.verification` (jetons temporaires, inutilisée : le jeu ne vérifie aucune adresse) |
| T2 | Sessions | Maintenir la connexion ; limiter les tentatives de connexion | Adresse IP, navigateur, dates de la session | Joueurs | Exécution du contrat ; intérêt légitime (sécurité) | Jusqu'à l'expiration de la session : la tâche quotidienne supprime les sessions expirées, ou la suppression du compte | `identity.session` |
| T3 | Activité de jeu | Faire fonctionner le Village, le Donjon, le Marché et le Classement | Identifiant, nom du joueur, nom du village, actions de jeu | Joueurs | Exécution du contrat | Jusqu'à la suppression du compte ; ensuite, identifiant pseudonymisé et noms remplacés (ADR 0008) | `platform.events`, `platform.outbox`, `ranking`, `dungeon`, `market` |
| T4 | Messagerie de la Taverne | Permettre aux joueurs de discuter | Contenu des messages, auteur, date | Joueurs | Exécution du contrat | Trente jours, ou jusqu'à la suppression du compte | `tavern.messages` |
| T5 | Présence dans la Taverne | Indiquer les joueurs présents | Identifiant, nom, date du dernier signal | Joueurs | Exécution du contrat | Deux minutes après le dernier signal | `tavern.presence` |
| T6 | Registre des effacements | Démontrer la réalisation des effacements | Date de l'effacement, nombre d'événements réécrits ; aucune donnée sur le joueur | Aucune personne identifiable | Obligation légale (responsabilité, article 5) | Illimitée | `platform.erasures` |
| T7 | Journaux techniques | Diagnostiquer les erreurs, assurer la sécurité | Adresse IP, adresses des requêtes, navigateur, erreurs journalisées (nom et première ligne du message, sans paramètres) | Joueurs, visiteurs | Intérêt légitime (sécurité, maintenance) | Une heure sur l'offre gratuite (Hobby) de Vercel ; un jour sur l'offre Pro, trente jours avec Observability Plus | Vercel |
| T8 | Notifications | Informer le joueur de ce qui s'est passé pendant son absence : offre conclue ou expirée, expédition terminée | Identifiant du joueur, sorte de notification, identifiant de l'offre ou de l'expédition, résultat d'une expédition, date ; position de lecture du joueur ; vendeur de chaque offre en cours, joueurs de chaque expédition en cours | Joueurs | Exécution du contrat | Trente jours pour une notification ; au plus trente jours pour les lignes de correspondance (une offre dure vingt-quatre heures) ; position de lecture jusqu'à la suppression du compte | `notifications.notifications`, `notifications.read_marks`, `notifications.offer_parties`, `notifications.game_members` |

### Mesures de sécurité du traitement T8

- Chaque route est réservée au joueur connecté, qui n'accède qu'à son propre fil : aucune route n'accepte
  d'identifiant de joueur (N1, N2 de la revue de sécurité des Notifications).
- Une notification ne contient ni nom ni identifiant d'un autre joueur, et le canal temps réel ne transmet
  aucune donnée (N6, N7).
- La durée de conservation est appliquée à la lecture et par la tâche quotidienne `notifications` (N9).
- Le contributeur du module exporte ces données et les efface avec le compte, sans rien laisser dans les
  quatre tables (N10). Le module n'enregistre aucun événement : il n'y a rien à réécrire dans le journal.

## Droits des personnes

| Droit | Mise en œuvre |
| --- | --- |
| Accès et portabilité (articles 15 et 20) | Page « Mes données » : export JSON de toutes les données du joueur |
| Effacement (article 17) | Page « Mes données » : suppression du compte, effective dans tous les modules |
| Rectification (article 16) | Non mis en œuvre : le nom d'un joueur ne peut pas encore être modifié |
