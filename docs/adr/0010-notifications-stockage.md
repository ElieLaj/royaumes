# ADR-0010 - Des tables classiques, tenues par une projection du journal, pour le fil des notifications

- Statut : proposé
- Date : 2026-10-23

## Contexte

Un joueur n'apprend aujourd'hui qu'en ouvrant l'écran du Marché ou du Donjon que son offre a été
acceptée, qu'elle a expiré ou que son expédition est terminée. Le module Notifications lui présente
un fil de ces avertissements, avec le nombre de ceux qu'il n'a pas lus.

Le Marché et le Donjon publient déjà ces faits dans le journal d'événements : `TradeCompleted`,
`OfferWithdrawn` (retiré par le vendeur, ou expiré) et `GameEnded`. Mais ces événements ne désignent pas
leur destinataire. Le flux d'une offre ne nomme son vendeur que dans `OfferPublished`, et les joueurs
d'une expédition ne sont connus que par `GameCreated` et `PlayerJoined`. Un fil par joueur doit donc
retenir, entre ces événements, qui est concerné.

Les notifications ont trois particularités. Elles sont dérivées d'événements d'autres modules, et
aucune décision de jeu ne dépend de leur état. Elles sont destinées à disparaître : une notification
n'a plus d'intérêt après trente jours, et elle révèle l'activité d'un joueur, donc une donnée
personnelle. Enfin, la position jusqu'à laquelle un joueur a lu son fil lui est propre : elle ne
découle d'aucun événement du jeu.

Le journal est en ajout seul (ADR 0002), et les projections se reconstruisent en le rejouant, avec un
point de reprise et une version (ADR 0006). L'hébergement n'offre aucune tâche de fond : seule la
tâche planifiée quotidienne peut appliquer une durée de conservation sans activité (ADR 0008).

## Décision

Le module n'utilise pas l'Event Sourcing et n'enregistre aucun événement. Il conserve ses données
dans des tables ordinaires de son propre schéma PostgreSQL, `notifications`, créées par les migrations
`0013_notifications` et `0014_lecture`. Une projection, nommée `notifications` et versionnée,
les tient à jour en lisant le journal du Marché et du Donjon (ADR 0011).

Quatre tables :

- `notifications` : une ligne par notification. Son identité est le couple formé par la position de
  l'événement qui la produit et le destinataire, de sorte que rejouer un événement n'ajoute aucune
  ligne (insertion ignorée en cas de conflit) et qu'une reconstruction redonne les mêmes identifiants ;
- `offer_parties` et `game_members` : le vendeur de chaque offre, et les joueurs de chaque expédition,
  retenus du premier événement au dernier, puis supprimés ;
- `read_marks` : la position de lecture de chaque joueur. Elle n'est pas dérivée du journal, et la
  reconstruction de la projection n'y touche pas. Elle peut rester valable après une reconstruction,
  parce que les positions des notifications ne changent pas.

Les règles sont des fonctions pures du domaine, qui ne connaît pas le journal : la projection traduit
chaque événement en un fait, que `notificationsFor` examine. Une offre conclue notifie son vendeur seul ;
une offre expirée le notifie aussi, mais un retrait par le vendeur ne notifie personne ; une
expédition terminée notifie chacun de ses joueurs, compagnons exclus. Le fil présente au plus cinquante
notifications, les plus récentes d'abord. Une position de lecture ne recule jamais, et est ramenée à la
dernière notification du joueur.

Une notification ne contient ni nom ni identifiant d'un autre joueur : elle désigne l'offre ou
l'expédition, et, pour une expédition, son résultat.

La durée de conservation de trente jours est appliquée de deux façons. À la lecture, le fil ne présente
et ne compte que les notifications récentes. Chaque jour, la tâche `notifications` de la route
`/api/cron/daily` supprime les notifications périmées, ainsi que les lignes de correspondance
abandonnées depuis plus de trente jours (une offre ne dure que vingt-quatre heures).

Le module déclare ses données personnelles par un contributeur (`personal-data.ts`) : l'export contient
les notifications et la position de lecture du joueur, et l'effacement supprime ses lignes dans les quatre
tables. Le module n'ayant écrit aucun événement, il n'y a rien à réécrire dans le journal.

## Conséquences

### Positives

- Le fil est simple à lire et à borner : une requête sur un index par destinataire, sans rejouer de flux.
- La durée de conservation est garantie même sans consultation, grâce à la tâche quotidienne, ce que le
  journal en ajout seul ne permettrait pas.
- Les règles du jeu de notification sont testables sans base, et la projection l'est par une
  reconstruction qui doit redonner exactement le même fil (test « redonne le même fil lorsque la
  projection est reconstruite »).
- Aucun module existant n'est modifié, et la plateforme ne connaît pas le module : il est ajouté à la
  racine de composition.
- L'effacement d'un compte est une suppression, sans réécriture du journal.
- La position de lecture survit à une reconstruction (test « conserve la position de lecture lorsque la
  projection est reconstruite »).

### Négatives

- La cohérence est différée : une notification n'existe qu'après le prochain rattrapage de la
  projection, déclenché par une consultation du fil ou un export. Une expiration n'est de plus
  consignée dans le journal que lorsque le Marché la constate (ADR 0004), et la notification correspondante
  suit.
- Une lecture du fil exécute cinq requêtes SQL, contre trois ou quatre pour les autres modèles de
  lecture : au test de charge, son p99 atteint 552 ms pour un budget de 500 ms (`perf/notifications.json`).
  La dette est consignée (DT-016) ; son remède, une requête unique pour le contrôle de fraîcheur, se
  trouve dans la plateforme.
- Une reconstruction recrée les notifications de plus de trente jours, qui ne sont jamais présentées et
  que la tâche quotidienne supprime. Elle recrée aussi celles d'un joueur effacé : le journal conserve
  son identifiant, pseudonymisé et relié à aucun nom (ADR 0008).
- Les tables de correspondance copient l'identifiant du vendeur et ceux des joueurs d'une expédition :
  autant de données personnelles de plus à exporter et à effacer.
- Si le Marché ou le Donjon renommait l'un des événements lus, le fil deviendrait silencieusement muet.
  Une fonction d'aptitude, ajoutée à `architecture.test.ts`, vérifie que ces événements existent encore.
- Une notification n'est pas diffusée avec ses données : le navigateur relit son fil (ADR 0011).

## Alternatives écartées

- **Event Sourcing pour le fil** : l'historique des notifications n'a aucune valeur de jeu, personne ne
  lit leurs événements, et leurs données doivent disparaître au bout de trente jours, ce que l'ajout seul
  du journal interdit par principe (même raisonnement que pour la Taverne, ADR 0008).
- **Calculer le fil à chaque lecture, sans table** : il faudrait relire les flux du Marché et du Donjon
  pour chaque consultation, ce qui coûte de plus en plus cher avec la taille du journal, et la position de
  lecture ainsi que la durée de conservation n'auraient aucun support.
- **Une notification enregistrée par le module d'origine**, par un message de la boîte d'envoi : elle
  obligerait à modifier le Marché et le Donjon pour qu'ils connaissent les notifications, alors que le
  module ne demande rien à personne.
- **Un compteur de non lues stocké** : il se désynchroniserait lors d'une reconstruction, alors que le
  nombre de non lues se déduit de la position de lecture et des notifications.
- **Stocker la position de lecture dans la projection** : elle serait effacée par chaque reconstruction,
  et chaque joueur verrait toutes ses notifications redevenir non lues.
- **Conserver le nom des autres joueurs dans la notification** (« Alice a accepté votre offre ») : elle
  copierait une donnée personnelle d'autrui, que l'effacement de son compte devrait ensuite réécrire dans
  le fil de chaque joueur concerné.

## Réexamen

Cette décision devra être réexaminée si les notifications doivent rester consultables au-delà de trente
jours, si le journal devient assez volumineux pour que le rattrapage de la projection ralentisse la
lecture du fil, ou si un module doit produire des notifications sans événement dans le journal : la
Taverne, par exemple, n'en enregistre aucun.

## Usage de l'IA générative

Un assistant de programmation fondé sur l'IA générative a contribué à la rédaction de cet ADR et au
code qu'il décrit (module Notifications, projection, tâche quotidienne, contributeur de données
personnelles), à partir de la fiche de cadrage et du dépôt. Les affirmations sur le code ont été
vérifiées en exécutant `pnpm verify`, dont les tests du domaine, de la projection, de l'API, de la
conservation et de l'effacement, puis en rejouant sur un serveur local avec deux joueurs un échange du
Marché, la réception du fil en temps réel et son marquage comme lu. Le contenu doit être relu et validé
par l'auteur du projet, qui passe alors le statut à « accepté ».
