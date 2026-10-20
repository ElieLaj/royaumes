# ADR-0003 - Server-Sent Events, alimentés par le journal, pour le temps réel

- Statut : proposé
- Date : 2026-10-20

## Contexte

Les joueurs doivent être informés des changements sans recharger leur page : d'abord entre les
onglets ou les appareils d'un même joueur (une amélioration faite dans l'un apparaît dans l'autre),
puis entre les participants d'une partie du Donjon (TD6).

Les actions des joueurs passent déjà par l'API, au moyen de requêtes HTTP authentifiées par cookie
(TD4) : seules les notifications ont besoin d'un canal du serveur vers le navigateur.

L'hébergement impose ses contraintes : la durée d'exécution d'une fonction Vercel est plafonnée
(300 secondes dans la configuration retenue), plusieurs instances de l'application fonctionnent
sans mémoire partagée, et l'offre gratuite exclut tout serveur permanent supplémentaire.

Le projet dispose déjà d'un journal d'événements, dont chaque flux porte des versions croissantes
et uniques (ADR 0002).

## Décision

Les changements sont diffusés par des Server-Sent Events, sur la route `/api/stream/<canal>`
(`src/platform/realtime/`).

Un canal correspond exactement à un flux du journal d'événements. L'identifiant de chaque message
est la version de l'événement, ce qui permet la reprise après une interruption par l'en-tête
`Last-Event-ID`, sans perte ni doublon.

Le flux ne conserve aucun état en mémoire : il relit le journal toutes les demi-secondes, et
n'importe quelle instance peut servir n'importe quel joueur. Il se ferme de lui-même au bout de
240 secondes, avant le plafond de la plateforme, et le navigateur s'y reconnecte.

L'accès est réservé aux joueurs connectés, et chaque module déclare la règle d'accès à ses propres
canaux : un canal qu'aucune règle ne couvre est refusé. Le canal d'un village n'est ainsi accessible
qu'à son propriétaire.

L'interface relit sa vue auprès de l'API à chaque notification, plutôt que d'appliquer elle-même le
contenu des événements.

## Conséquences

### Positives

- Les Server-Sent Events reposent sur du HTTP ordinaire : ils traversent les intermédiaires du
  réseau sans configuration, et bénéficient de l'authentification par cookie déjà en place.
- La reprise est native : le navigateur se reconnecte seul et renvoie le dernier identifiant reçu,
  et la version des événements du journal suffit à reprendre exactement où le flux s'était arrêté.
- Le flux n'a aucun état en mémoire : il fonctionne sur plusieurs instances, et la base de données
  reste la source unique de l'état comme des notifications.
- Aucune infrastructure supplémentaire n'est nécessaire : la solution reste dans l'offre gratuite.
- L'accès fermé par défaut rend inaccessible, et non public, le canal d'un module qui aurait oublié
  de déclarer sa règle.
- Un flux peut ne transmettre qu'un signal : chaque joueur relit sa propre vue, filtrée par le
  serveur, ce qui prépare les parties du Donjon où les données ne doivent pas être partagées.

### Négatives

- Chaque joueur connecté produit deux lectures du journal par seconde : la charge de la base croît
  avec le nombre de joueurs connectés simultanément.
- Un événement peut arriver avec un retard allant jusqu'à l'intervalle de lecture, soit une
  demi-seconde : le temps réel est quasi immédiat, pas instantané.
- Chaque flux occupe une exécution de fonction pendant toute sa durée, jusqu'à 240 secondes, et se
  rouvre ensuite : le nombre de connexions longues sur la plateforme croît avec les joueurs.
- La communication est unidirectionnelle : tout envoi du navigateur vers le serveur passe par l'API.
- Les messages transmis sont des événements du journal : tout abonné autorisé à un canal en reçoit
  le contenu, ce qui exige de transmettre de simples signaux lorsque certaines données doivent
  rester privées.

## Alternatives écartées

- **WebSocket** : une connexion permanente et bidirectionnelle suppose un serveur qui la maintient
  ouverte. Une fonction Vercel traite une requête puis s'arrête, sa durée est plafonnée et la prise
  en charge des WebSocket y était encore expérimentale ; un serveur dédié exigerait un hébergement
  permanent, contraire aux critères du projet. La bidirectionnalité n'apporte rien ici, les actions
  passant déjà par l'API.
- **Interrogation périodique par le navigateur** : un intervalle court multiplie les requêtes
  inutiles, un intervalle long retarde l'information, et la reprise après interruption est à
  programmer. Le choix retenu déplace cette interrogation du navigateur vers le serveur, où elle
  ne coûte qu'une lecture indexée.
- **Notification partagée entre instances (`LISTEN/NOTIFY` de PostgreSQL ou service de messagerie
  comme Redis)** : elle supprimerait les lectures périodiques, mais exige soit une connexion
  permanente par instance, mal adaptée aux fonctions de courte durée et à la connexion mutualisée de
  Neon, soit un service supplémentaire à héberger. Ce coût ne se justifie pas à l'échelle du projet.

## Réexamen

Cette décision devra être réexaminée si le nombre de joueurs connectés simultanément est tel que les
lectures du journal pèsent sur la base ; si un besoin de communication du navigateur vers le serveur
à très faible délai apparaît ; ou si l'hébergeur offre une prise en charge stable des WebSocket.

## Usage de l'IA générative

Un assistant de programmation fondé sur l'IA générative a contribué à la rédaction de cet ADR et au
code du TD5 qu'il décrit (flux temps réel, règles d'accès aux canaux, abonnement de l'interface), à
partir du support du TD et du dépôt. Les affirmations sur le code ont été vérifiées en exécutant
`pnpm verify` et en observant, sur un serveur local, l'ouverture d'un flux, sa fermeture à la durée
maximale, la reprise par `Last-Event-ID` et la synchronisation de deux onglets. Le contenu doit être
relu et validé par l'auteur du projet, qui passe alors le statut à « accepté ».
