# ADR-0011 - Les notifications lisent le langage publié du Marché et du Donjon, et l'annoncent par un canal global discret

- Statut : proposé
- Date : 2026-10-23

## Contexte

Le module Notifications doit savoir quand une offre est conclue ou expire, et quand une expédition
se termine : ce qui se passe dans le Marché et le Donjon. Ces deux modules enregistrent leurs faits dans
le journal d'événements, dans des flux dont le nom commence par `market-` et `dungeon-`, et exposent ces
préfixes dans leurs contrats.

Deux moyens de communiquer entre modules existent déjà. La boîte d'envoi (ADR 0007) transmet un message
de manière fiable à un gestionnaire qui l'exécute, au moins une fois, d'où l'idempotence obligatoire de
chaque gestionnaire : le Marché l'utilise pour demander au Village de prélever des ressources. La lecture
du journal (ADR 0006) permet à un module de tenir un modèle de lecture sur les événements d'un autre, avec
un point de reprise : le Classement en tire les victoires des expéditions.

Le module ne demande rien au Marché ni au Donjon, et ne leur répond pas : il observe ce qu'ils ont déjà
publié. Les règles du projet interdisent d'importer autre chose que les entrées publiques d'un module
(`contracts.ts`, `index.ts`, `ui.tsx`).

Le module doit aussi prévenir le navigateur d'un joueur connecté qu'une notification est apparue. Le temps
réel du projet repose sur des canaux alimentés par le journal (ADR 0003). La source d'un canal ne reçoit
pas le nom du canal : un canal propre à chaque joueur exigerait de modifier la plateforme. Un canal global
n'a pas de destinataire, et ne doit révéler à personne l'activité d'un autre joueur.

## Décision

Le module communique avec le Marché et le Donjon par la lecture de leur langage publié, et non par
des messages. Sa projection (ADR 0010) lit les événements `OfferPublished`, `TradeCompleted`,
`OfferWithdrawn` et `OfferRejected` du Marché, et `GameCreated`, `PlayerJoined` et `GameEnded` du Donjon.
Elle n'importe de ces deux modules que leurs contrats, pour les préfixes de leurs flux : aucun fichier
interne n'est utilisé, et aucun module existant n'est modifié.

Les types d'événements lus sont déclarés une fois, dans le contrat du module (`SOURCE_EVENTS`), et
servent à la fois à la projection et à une fonction d'aptitude. Celle-ci, ajoutée à `architecture.test.ts`,
vérifie que chaque type est encore publié par le domaine de son module d'origine : un événement renommé
fait échouer `pnpm verify`, au lieu de rendre le fil silencieusement muet.

Les garanties sont celles de la projection, non celles de la boîte d'envoi :

- chaque événement est appliqué exactement une fois, parce que les tables et le point de reprise sont
  mis à jour dans une même transaction ;
- l'idempotence reste assurée en profondeur : une notification a pour identité sa position et son
  destinataire, et sa réinsertion est ignorée ;
- la cohérence est différée : un événement n'a d'effet qu'au rattrapage suivant de la projection, au plus
  tard à la consultation suivante du fil.

Le module ouvre un canal temps réel, `notifications`, accessible à tout joueur connecté et à lui seul
(`GET /api/stream/notifications`, 401 sans session, 403 pour tout autre nom de canal). Il est global et
discret, comme celui du Classement : il annonce les événements qui produisent une notification, sans
données ni destinataire (`redact`), et chaque navigateur relit son propre fil, que le serveur filtre par
le joueur de la session. L'interface relit le fil, avec quelques reprises, jusqu'à ce que sa position atteigne
celle de l'événement annoncé.

Une tâche quotidienne propre au module, `notifications`, s'ajoute à celles de la route
`/api/cron/daily` : elle applique la durée de conservation (ADR 0010).

## Conséquences

### Positives

- Le Marché et le Donjon ne savent pas que le fil existe : aucune de leurs règles, ni de leurs messages,
  n'a changé, et le module se retire sans qu'ils le remarquent.
- Le module n'a aucune boîte d'envoi à surveiller : pas de message abandonné, pas de saga, pas d'idempotence
  à écrire dans un gestionnaire.
- Un événement renommé est détecté à la construction, et non par un joueur qui ne reçoit plus rien.
- Le canal ne transmet rien d'utile à un tiers : un joueur qui l'écoute n'apprend que le type, la position
  et le nom du flux d'un événement, qui contient l'identifiant opaque d'une offre ou d'une expédition,
  comme pour le canal du Classement.
- La règle d'accès du canal est testée : anonyme refusé, autre nom de canal refusé, données vidées.

### Négatives

- Le module dépend de la forme des événements du Marché et du Donjon, qui n'ont pas de contrat versionné.
  La fonction d'aptitude ne contrôle que les types d'événements : un champ renommé (`sellerId`, `reason`,
  `hostId`, `playerId`, `result`) ne serait détecté que par les tests de la projection, qui construisent
  eux-mêmes ces événements.
- Le canal est global (DT-015) : chaque joueur connecté relit son fil à chaque événement notifiable,
  quel que soit le destinataire, et le coût croît avec le nombre de joueurs connectés. Le retrait d'une
  offre par son vendeur est annoncé, bien qu'il ne produise aucune notification : le canal discret ne peut
  pas trancher.
- Une expiration n'est annoncée que lorsque le Marché la consigne au journal, c'est-à-dire à la
  consultation ou à la distribution qui suit son échéance, et non à l'instant où l'offre échoit.
- Le rattrapage s'exécute pendant la requête du joueur, qui supporte son coût quand des événements se sont
  accumulés.

## Alternatives écartées

- **Messages de la boîte d'envoi, envoyés par le Marché et le Donjon** : il faudrait modifier ces deux
  modules pour qu'ils connaissent les notifications, sans rien y gagner, puisque le module ne demande rien
  à personne. La livraison au moins une fois imposerait un gestionnaire idempotent, que le point de reprise
  de la projection rend inutile.
- **Appel direct des services du Marché et du Donjon** : il traverserait la frontière des modules, que
  `dependency-cruiser` interdit, et créerait une dépendance dans l'autre sens, cyclique dès que ces
  modules voudraient notifier.
- **Un canal par joueur** (`notifications-<joueur>`) : c'est le bon modèle pour le coût, mais la source d'un
  canal ne reçoit pas son nom, et la modifier sort du périmètre du module. C'est la dette DT-015.
- **Un canal qui transporte la notification** : il révélerait au tiers qui l'écoute l'activité d'un
  autre joueur, alors que le canal est global.
- **Une interrogation périodique par le navigateur**, sans canal : elle multiplierait les lectures du fil,
  qui dépassent déjà le budget de performance (DT-016), et retarderait l'apparition des nouveautés.

## Réexamen

Cette décision devra être réexaminée si le Marché ou le Donjon publient leurs événements dans un contrat
versionné, si la plateforme fournit à la source d'un canal le nom du canal (le canal par joueur devient
alors possible), ou si le nombre de joueurs connectés rend le canal global trop coûteux.

## Usage de l'IA générative

Un assistant de programmation fondé sur l'IA générative a contribué à la rédaction de cet ADR et au
code qu'il décrit (lecture des événements, fonction d'aptitude, canal temps réel), à partir de la fiche
de cadrage et du dépôt. Les affirmations sur le code ont été vérifiées en exécutant `pnpm verify`, dont
les tests de la projection, du canal et de la fonction d'aptitude, qui a été vue échouer en y introduisant
un type d'événement inexistant, puis en observant sur un serveur local avec deux joueurs l'apparition d'une
notification sans rechargement de la page. Le contenu doit être relu et validé par l'auteur du projet, qui
passe alors le statut à « accepté ».
