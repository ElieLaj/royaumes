# ADR-0005 - Intelligence artificielle déterministe, exécutée dans le domaine, sans tâche de fond

- Statut : proposé
- Date : 2026-10-20

## Contexte

Le Donjon a besoin de deux sortes de personnages pilotés par l'ordinateur : des monstres dont le
comportement dépend d'un niveau de difficulté, et des compagnons, qui permettent à un joueur sans
partenaire de jouer seul. La règle fixe des monstres du TD6, qui attaquent toujours le héros le plus
faible, ne laisse aucune place à la difficulté.

L'hébergement ne permet aucun processus permanent : une fonction Vercel s'arrête après chaque
requête, et aucune boucle de jeu ne peut s'exécuter entre deux actions des joueurs (ADR 0004).

L'état d'une expédition est reconstruit à partir de ses événements, et une manche échue peut être
calculée lors d'une lecture sans être enregistrée (ADR 0002 et ADR 0004) : tout calcul, y compris
celui d'un personnage piloté par l'ordinateur, doit donner le même résultat à chaque exécution.

## Décision

Les décisions de l'intelligence artificielle sont des fonctions pures du domaine, appelées au
moment de la résolution d'une manche, dans `resolveRound` : elles reçoivent l'état du combat et
renvoient une décision, sans aucune dépendance technique.

Elles ne tirent au sort qu'au moyen du générateur à graine de la manche, qui leur est fourni dans
la situation qu'elles reçoivent.

Leurs résultats, actions des compagnons comprises, sont enregistrés dans l'événement
`RoundResolved` : la relecture d'une expédition n'exécute jamais l'intelligence artificielle.

Le comportement des monstres est isolé derrière un port de stratégie, `MonsterStrategy`, dont
chaque niveau de difficulté fournit une mise en œuvre (`monster-strategies.ts`). Le niveau est
enregistré dans l'événement `GameCreated`, et un niveau par défaut est attribué aux événements
antérieurs au TD7 lors de leur lecture (upcasting).

Un compagnon est un héros sans joueur. Son action est décidée à la résolution de la manche, sur la
situation du début de la manche ; il n'agit que si au moins un joueur a choisi une action pour cette
manche, et ne prend jamais de tour d'exploration.

L'équilibre du jeu est mesuré par simulation d'expéditions complètes, jouées en mémoire par des
joueurs simulés, et protégé par des tests statistiques sur des graines fixées.

## Conséquences

### Positives

- Aucune brique d'architecture nouvelle : ni boucle de jeu, ni tâche de fond, ni processus
  permanent. L'intelligence artificielle s'insère dans le calcul de la résolution d'une manche, déjà
  organisé par l'ADR 0004.
- La reproductibilité est héritée du TD6 : la même manche donne les mêmes décisions, qu'elle soit
  calculée lors d'une lecture ou enregistrée par une commande.
- Les décisions étant enregistrées dans les événements, modifier une stratégie ne change pas les
  parties déjà jouées, et la relecture d'une expédition n'a pas à exécuter l'intelligence
  artificielle.
- Les comportements se testent sans base de données, sans serveur et sans attente, de manière exacte,
  par invariant ou statistique, avec des résultats stables d'une exécution à l'autre.
- Ajouter un niveau de difficulté consiste à écrire une stratégie et une entrée du contenu du jeu :
  les règles du combat ne changent pas, et la vérification des types signale une stratégie
  manquante.
- La simulation de milliers d'expéditions a corrigé une intuition fausse sur le niveau difficile, et
  guide le rééquilibrage à partir de mesures plutôt que d'impressions.

### Négatives

- Un personnage piloté par l'ordinateur ne peut ni réagir entre deux échéances, ni agir de sa propre
  initiative : il n'agit qu'au moment où une manche est résolue.
- La qualité de l'équilibre dépend de la règle suivie par les joueurs simulés, qui ne soignent jamais
  et ne coordonnent rien : elle ne représente pas nécessairement des joueurs réels.
- Les seuils des tests statistiques doivent être révisés à chaque rééquilibrage volontaire du jeu.
- Une intelligence artificielle coûteuse en calcul ralentirait toute lecture d'une expédition, car la
  résolution des manches échues est recalculée lors de chaque lecture.
- Les stratégies des monstres s'appuient sur les actions choisies par les joueurs : elles ne sont
  correctes que parce qu'elles s'exécutent sur le serveur, et leur résultat ne doit jamais être
  transmis avant la résolution de la manche.

## Alternatives écartées

- **Boucle de jeu exécutée par un processus permanent** : elle ne peut pas fonctionner sur Vercel,
  qui n'exécute aucun processus entre deux requêtes ; elle exigerait un serveur dédié, contraire aux
  critères d'hébergement du projet, et ses décisions ne seraient reproductibles ni à la lecture ni à
  la relecture.
- **Décisions prises par le navigateur d'un joueur** : le résultat dépendrait de la présence et de la
  bonne foi d'un client, il faudrait le valider côté serveur, et un compagnon cesserait d'agir dès
  qu'un joueur se déconnecte.
- **Recalcul des décisions lors de la relecture, plutôt que leur enregistrement** : modifier une
  stratégie changerait rétroactivement les parties déjà jouées, et l'historique ne serait plus fidèle
  à ce qui s'est réellement passé.

## Réexamen

Cette décision devra être réexaminée si un personnage doit agir en temps réel, entre deux
échéances ; si l'intelligence artificielle devient trop coûteuse en calcul pour être exécutée lors
d'une lecture ; ou si les joueurs simulés cessent de représenter les joueurs réels, ce que les
actions enregistrées dans le journal de production permettraient de vérifier.

## Usage de l'IA générative

Un assistant de programmation fondé sur l'IA générative a contribué à la rédaction de cet ADR et au
code du TD7 qu'il décrit (stratégies des monstres, compagnons, échéance d'exploration, simulation),
à partir du support du TD et du dépôt. Les affirmations sur le code ont été vérifiées en exécutant
`pnpm verify`, en reproduisant exactement les deux tableaux de mesures du script de simulation, et en
jouant une expédition en solo avec un compagnon sur un serveur local. Le contenu doit être relu et
validé par l'auteur du projet, qui passe alors le statut à « accepté ».
