# ADR-0004 - Manches simultanées et échéances paresseuses pour les combats du Donjon

- Statut : proposé
- Date : 2026-10-20

## Contexte

Les combats du Donjon réunissent jusqu'à quatre joueurs humains, qui ne doivent ni s'attendre
indéfiniment ni être avantagés par l'ordre de jeu. Les choix de chacun doivent rester secrets
jusqu'à la résolution de la manche.

L'hébergement ne permet ni minuteur en mémoire, ni tâche de fond : une fonction Vercel s'arrête
après chaque requête, plusieurs instances fonctionnent sans mémoire partagée, et les tâches
planifiées de l'offre gratuite ne s'exécutent qu'une fois par jour.

L'état d'une expédition est reconstruit à partir de ses événements (ADR 0002) : tout calcul doit
être reproductible, c'est-à-dire donner le même résultat chaque fois qu'on rejoue l'historique.

## Décision

Les héros choisissent simultanément. La manche est résolue lorsque tous ont choisi, ou lorsque son
échéance de trente secondes est atteinte ; un héros sans choix se défend.

L'échéance est une donnée enregistrée dans les événements, et non un minuteur. Une manche échue est
résolue à l'instant de son échéance, et non à celui du calcul.

Une lecture calcule la résolution des manches échues sans rien enregistrer. Toute commande commence
par enregistrer les manches échues, puis traite l'intention du joueur. Le navigateur envoie une
commande d'échéance lorsque son compte à rebours atteint zéro ; elle peut être répétée sans effet.

Le hasard est tiré dans `decide`, avec un générateur à graine dérivée du numéro de manche, et ses
résultats sont enregistrés dans les événements : `evolve` ne fait qu'appliquer les valeurs
enregistrées.

Une action porte le numéro de la manche visée, tel que le joueur l'a vu à l'écran, et est refusée
si cette manche est déjà résolue.

## Conséquences

### Positives

- Aucun joueur n'attend indéfiniment un autre : l'échéance borne chaque manche, et un héros sans
  choix se défend.
- L'ordre d'arrivée des actions n'avantage personne : les choix sont résolus ensemble, après avoir
  été tous enregistrés.
- Aucune infrastructure supplémentaire : ni minuteur, ni tâche planifiée, ni service de messagerie.
  Tout repose sur le journal d'événements et sur l'horloge du serveur.
- La résolution est reproductible : la graine dérivée du numéro de manche donne le même résultat
  quel que soit l'instant où on la calcule, et une lecture affiche exactement ce que la commande
  suivante enregistrera.
- Les choix restent secrets jusqu'à la résolution : la vue de chaque joueur est filtrée par le
  serveur, et le canal temps réel ne transmet aucune donnée.
- La commande d'échéance est idempotente, et les commandes simultanées sont départagées par la
  concurrence optimiste de l'ADR 0002 : plusieurs navigateurs peuvent la déclencher sans danger.

### Négatives

- Le journal peut retarder sur ce qu'affichent les lectures : tant qu'aucun joueur ne se manifeste,
  une manche échue n'est enregistrée nulle part, alors que toute lecture l'affiche comme résolue.
- Les notifications dépendent des navigateurs : sans commande ni compte à rebours qui arrive à zéro,
  aucun événement n'est enregistré, donc aucun message n'est diffusé.
- Une expédition abandonnée n'enregistre jamais son événement `GameEnded` : le classement du TD8, qui
  s'appuiera sur cet événement, ne la verra jamais.
- Chaque lecture recalcule la résolution des manches échues : le coût d'une lecture croît avec le
  nombre de manches non enregistrées.
- L'exploration n'a pas d'échéance : un joueur absent lorsque vient son tour bloque l'expédition.
- Les commandes simultanées de quatre héros peuvent entrer en conflit : le nombre de tentatives doit
  suivre le nombre maximal de héros.

## Alternatives écartées

- **Tour par tour strict** : chaque héros agirait à son tour. Un joueur absent bloquerait les trois
  autres, et l'ordre de jeu favoriserait ceux qui agissent en premier ; l'attente cumulée de quatre
  joueurs rendrait les combats longs.
- **Minuteur en mémoire ou tâche planifiée** : une fonction Vercel ne conserve aucune mémoire entre
  deux requêtes, et une tâche planifiée de l'offre gratuite ne s'exécute qu'une fois par jour, très
  loin de l'échéance de trente secondes.
- **Lecture qui enregistre elle-même la résolution** : une requête de lecture écrirait dans le
  journal, ce qui mêlerait lecture et écriture, multiplierait les conflits entre lecteurs
  simultanés et rendrait la consultation d'une expédition non répétable à l'identique.
- **Tirage par `Math.random`, dont seul le résultat serait enregistré** : la lecture et la commande
  ne tireraient pas les mêmes valeurs ; la vue calculée à la lecture pourrait différer de ce que la
  commande enregistre ensuite, et l'historique ne permettrait pas de recalculer une manche.

## Réexamen

Cette décision devra être réexaminée si une expédition abandonnée doit être enregistrée comme
terminée, par exemple pour le classement ; si l'hébergeur offre un service de planification de
tâches compatible avec une échéance de quelques secondes ; si le nombre de héros par expédition
augmente, accroissant la contention sur le flux ; ou si l'exploration reçoit une échéance, ce qui
supprimerait le blocage par un joueur absent.

## Usage de l'IA générative

Un assistant de programmation fondé sur l'IA générative a contribué à la rédaction de cet ADR et au
code du TD6 qu'il décrit (domaine du Donjon, service, API, canal discret, écran), à partir du
support du TD et du dépôt. Les affirmations sur le code ont été vérifiées en exécutant `pnpm verify`
et en jouant des expéditions à deux et trois comptes sur un serveur local : résolution à
l'échéance, secret des actions, refus des non-membres. Le contenu doit être relu et validé par
l'auteur du projet, qui passe alors le statut à « accepté ».
