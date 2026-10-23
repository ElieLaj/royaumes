# Fiche de cadrage : Notifications

- Auteur : Elie Lajoinie
- Date : 2026-10-23
- Nom technique du module : `notifications` (en anglais, comme `realm`, `dungeon` ou `market`)
- Validée par l'enseignant le :
- Documentation Co-Généré avec Claude

## L'idée

Le joueur dispose d'un fil de notifications, qui lui apprend ce qui s'est passé dans le jeu pendant
qu'il n'était pas devant l'écran : son offre du Marché a été acceptée, son offre a expiré, son
expédition du Donjon est terminée. Il consulte le fil, voit combien de notifications il n'a pas
lues, les marque comme lues, et reçoit les nouvelles en temps réel lorsqu'il est connecté.

C'est un service rendu aux joueurs, qui ne modifie aucun module existant : le module lit ce que le
Marché et le Donjon ont déjà publié dans le journal, comme le Classement.

Périmètre retenu, et ce qui en est exclu :

- Trois sortes de notifications : offre conclue, offre expirée, expédition terminée.
- Les messages de la Taverne ne produisent pas de notification : la Taverne n'enregistre aucun
  événement dans le journal, il n'y a donc rien à lire. En produire demanderait de modifier la
  Taverne pour qu'elle envoie des messages, ce qui déplace l'effort sans rien démontrer de plus.
- Une notification ne contient ni le nom ni l'identifiant d'un autre joueur : elle désigne seulement
  l'offre ou l'expédition concernée. Le fil ne copie donc aucune donnée personnelle d'autrui, et
  l'effacement d'un compte n'oblige pas à réécrire les notifications des autres joueurs.
- Pas de notification par courrier électronique ou par navigateur, pas de préférences : le module
  se limite au fil du jeu.

## Les règles métier

Les règles que le domaine fait respecter, sous la forme de fonctions pures. Chacune est vérifiée
par au moins un test du domaine.

1. Une offre conclue notifie son vendeur, et lui seul : l'acheteur a reçu la réponse de sa propre
   action.
2. Une offre qui expire notifie son vendeur ; une offre que son vendeur retire lui-même ne produit
   aucune notification : un joueur n'est jamais notifié de sa propre action.
3. Une expédition terminée notifie chacun des joueurs de l'expédition, y compris son hôte, avec son
   résultat, victoire ou défaite ; les compagnons pilotés par l'ordinateur ne sont pas notifiés.
4. Le fil d'un joueur présente au plus 50 notifications, les plus récentes d'abord.
5. Une notification est conservée trente jours : au-delà, elle n'est plus présentée, et elle est
   supprimée.
6. Le nombre de notifications non lues d'un joueur est le nombre de ses notifications postérieures
   à sa position de lecture.
7. La position de lecture d'un joueur ne recule jamais : marquer comme lue une notification plus
   ancienne que celles déjà lues est sans effet.
8. Un joueur ne peut marquer comme lues que ses propres notifications : la position qu'il indique
   est ramenée à celle de sa dernière notification, de sorte qu'il ne peut pas marquer d'avance
   celles qui viendront.

Les garanties techniques, vérifiées par des tests d'intégration plutôt que par le domaine :
rejouer un événement ne crée aucun doublon, et reconstruire la projection redonne exactement le
même fil.

## Les commandes et les lectures

| Action du joueur | Commande ou lecture | Route envisagée |
| --- | --- | --- |
| Consulter son fil, avec le nombre de non lues | Lecture : la projection est rattrapée, puis les 50 dernières notifications du joueur sont renvoyées avec sa position de lecture | `GET /api/notifications` |
| Marquer ses notifications comme lues | Commande : avance la position de lecture du joueur jusqu'à la position indiquée | `POST /api/notifications/read` |
| Recevoir les nouveautés en direct | Canal temps réel `notifications`, discret : il annonce qu'un événement notifiable a eu lieu, et le navigateur relit son fil | `GET /api/stream/notifications` |

La page du module, `/notifications`, est ajoutée à la navigation du jeu. Toutes les routes sont
réservées aux joueurs connectés, et le joueur est toujours celui de la session : aucune route
n'accepte un identifiant de joueur.

Le canal est unique et global, comme celui du Classement, et non un canal par joueur : la source
d'un canal de la plateforme ne reçoit pas le nom du canal, et la modifier sortirait du périmètre.
Il ne transmet ni données ni destinataire : chaque navigateur relit son propre fil, que le serveur
filtre.

## Le stockage envisagé

Des tables classiques, rangées dans le schéma `notifications`, créées par une migration, et non le
journal d'événements.

La raison principale est la nature des données : le fil est un modèle de lecture dérivé des
événements des autres modules, et ses lignes sont destinées à disparaître au bout de trente jours,
ce que le journal en ajout seul n'admet pas. Aucune décision ne dépend de son état, personne ne lit
ses événements, et son historique n'a pas de valeur de jeu : c'est le raisonnement de l'ADR 0008.

Les tables sont tenues à jour par une projection, avec son point de reprise et sa version :

- `notifications`, la notification elle-même, identifiée par la position de l'événement et le
  destinataire : la reconstruction redonne les mêmes identifiants, et le fil ne présente aucun
  doublon ;
- `offer_parties` et `game_members`, qui retiennent le vendeur de chaque offre et les joueurs de
  chaque expédition tant qu'elles n'ont pas pris fin, car les événements finaux ne désignent pas
  leurs destinataires, comme le fait la table `game_players` du Classement ;
- `read_marks`, la position de lecture de chaque joueur. Elle n'est pas dérivée du journal : elle est
  tenue à part, que la reconstruction de la projection ne touche pas.

La conservation de trente jours est appliquée à la lecture du fil, et chaque jour par une tâche
quotidienne, comme pour la Taverne. Une reconstruction peut recréer des lignes périmées : elles ne
sont jamais présentées, et sont supprimées aussitôt.

## La communication avec les modules existants

Le module lit le langage publié du Marché et du Donjon, dans le sens Marché et Donjon vers
Notifications, sans aucun message de la boîte d'envoi.

- Marché : `OfferPublished`, `TradeCompleted`, `OfferWithdrawn` et `OfferRejected`, dans les flux
  de préfixe `market-`.
- Donjon : `GameCreated`, `PlayerJoined` et `GameEnded`, dans les flux de préfixe `dungeon-`.

Le module n'importe que les contrats des deux modules, pour les préfixes de leurs flux, comme le
Classement : aucun fichier interne n'est utilisé, et aucun module existant n'est modifié.

La lecture a été préférée aux messages parce que le module ne demande rien à personne : il observe.
Le point de reprise de la projection garantit que chaque événement est appliqué exactement une fois,
ce qui rend inutiles la livraison au moins une fois et l'idempotence des gestionnaires du TD9. La
cohérence est différée : une notification n'apparaît qu'au rattrapage suivant de la projection, au
plus tard à la prochaine consultation du fil.

Les seules modifications de l'existant seront la racine de composition, la navigation et le thème,
le test de charge et la documentation.

## Les données personnelles

Le module conserve, pour chaque joueur :

- ses notifications : identifiant du joueur, type, offre ou expédition concernée, résultat d'une
  expédition, date ;
- sa position de lecture ;
- l'identifiant du vendeur de chaque offre en cours, et celui des membres de chaque expédition en
  cours.

Ce sont des données personnelles, puisqu'elles se rapportent à un joueur identifiable : elles
révèlent son activité dans le jeu. Elles sont limitées à ce qui est nécessaire, et ne contiennent
aucun nom. Le contributeur `personal-data.ts` les exporte, et les efface avec le compte, y compris
les lignes de correspondance. Le module n'enregistre aucun événement : il n'a rien à réécrire dans
le journal. Les notifications sont supprimées après trente jours. Le traitement est ajouté au
registre des traitements.

## Les bonus visés

Par ordre de priorité, une fois le minimum atteint :

1. B4 : le fil est un modèle de lecture tenu par une projection, avec son point de reprise et sa
   version.
2. B1 : le canal temps réel `notifications`, avec sa règle d'accès réservée aux joueurs connectés.
3. B2 : une tâche quotidienne propre au module, qui applique la conservation de trente jours et
   supprime les lignes de correspondance abandonnées.
4. B6 : le module communique avec deux modules existants, le Marché et le Donjon.
5. B7 : un scénario de lecture du fil, ajouté au test de charge, dont les résultats respectent le
   budget de performance.
6. B8, en réserve : une fonction d'aptitude vérifie que chaque type d'événement lu par le module
   existe toujours dans le domaine de son module d'origine, de sorte qu'un événement renommé ne rende
   pas le fil silencieusement muet.

Cette liste n'engage pas : seuls les bonus réalisés et déclarés au rendu sont comptés.
