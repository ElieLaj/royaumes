# ADR-0006 - CQRS : modèles de lecture tenus par des projections rattrapées à la lecture

- Statut : proposé
- Date : 2026-10-21

## Contexte

Le Classement et la liste des expéditions ouvertes portent sur tous les flux du journal à la fois.
Les calculer par rejeu à chaque consultation, comme le faisait la liste des expéditions ouvertes
depuis le TD6, relit l'essentiel du journal : le coût d'une consultation croît avec l'historique du
jeu, alors que le résultat ne change qu'à la fin d'une expédition ou à l'amélioration d'un bâtiment
(dette DT-005).

L'hébergement ne permet aucun processus permanent : une fonction Vercel s'arrête après chaque
requête, et les tâches planifiées de l'offre gratuite ne s'exécutent qu'une fois par jour (ADR 0004).

Le journal attribue à chaque événement une position globale, croissante mais non continue : un
compteur automatique ne revient jamais en arrière après une insertion refusée, et deux insertions
simultanées ne sont pas nécessairement validées dans l'ordre de leurs positions (ADR 0002).

## Décision

Les lectures qui traversent les flux s'appuient sur des modèles de lecture, tables dérivées du
journal et placées dans le schéma PostgreSQL de leur module (`ranking`, `dungeon`). Les décisions
s'appuient toujours sur le modèle d'écriture, jamais sur un modèle de lecture.

Chaque modèle de lecture est tenu à jour par une projection : une fonction qui reçoit un événement
et met à jour des tables. Son point de reprise, la position du dernier événement appliqué, est
enregistré dans la table `platform.projections`.

Une projection est rattrapée au moment de sa consultation, par le moteur de la plateforme
(`src/platform/projection/`), dans une seule transaction : les tables et le point de reprise sont
mis à jour ensemble, et la ligne du point de reprise est verrouillée, de sorte que deux rattrapages
simultanés n'appliquent jamais deux fois le même événement.

Le rattrapage s'arrête devant une position manquante tant que l'événement qui la suit a moins de
cinq secondes : l'insertion manquante est peut-être encore en cours. Au-delà, elle est considérée
comme refusée, et franchie.

Chaque projection porte une version, enregistrée avec son point de reprise. Une version du code
plus élevée que celle des tables provoque leur reconstruction à partir du journal, dans la même
transaction ; une version moins élevée interdit toute écriture, pour que l'ancienne et la nouvelle
version de l'application ne se disputent pas les tables pendant un déploiement. Toute modification
qui change le contenu des tables d'une projection augmente donc sa version.

Le classement est annoncé aux navigateurs par un canal global et discret, qui suit les événements
de certains types dans tout le journal. L'interface relit le classement auprès de l'API, qui renvoie
la position jusqu'à laquelle il est à jour, jusqu'à ce que celle-ci atteigne la position annoncée.

## Conséquences

### Positives

- Le coût d'une consultation ne dépend plus de l'historique du jeu : le rattrapage ne traite que
  les événements postérieurs au point de reprise, et la lecture porte sur une table indexée.
- Les modules qui écrivent ignorent les projections qui les lisent : le Village et le Donjon n'ont
  rien à savoir du Classement, ce qui respecte la règle d'encapsulation des modules.
- Une nouvelle information est calculée pour tout le passé sans migration de données : le meilleur
  butin des joueurs a été obtenu pour des expéditions enregistrées avant qu'il soit imaginé.
- Aucune tâche de fond ni opération manuelle n'est nécessaire après un déploiement : un changement
  de version suffit à provoquer la reconstruction, au premier rattrapage qui suit.
- Le moteur est écrit une fois dans la plateforme et sert à tous les modèles de lecture : le
  remboursement de la dette DT-005 a demandé moins de code que le Classement.
- Une erreur dans une projection se corrige en corrigeant le code puis en rejouant le journal, sans
  jamais corriger de données.

### Négatives

- La cohérence est différée : un modèle de lecture peut avoir quelques secondes de retard sur le
  journal, notamment devant une position manquante récente.
- La reconstruction a lieu pendant une consultation, dont la durée est limitée sur Vercel : elle
  deviendra impossible au-delà d'une certaine taille du journal.
- Après un retour à une version précédente de l'application, une projection dont la version a été
  augmentée cesse d'avancer jusqu'au déploiement suivant, puisque le code ancien s'interdit d'écrire.
- Le Classement dépend du langage publié des autres modules : un événement modifié ou ajouté sans
  réexamen de ses lecteurs passe inaperçu, comme l'a montré la liste des expéditions ouvertes, qui
  ignorait les compagnons depuis le TD7.
- Une consultation écrit dans la base, dans les tables dérivées, ce qui la rend plus coûteuse
  qu'une simple lecture et fait attendre les consultations simultanées derrière le verrou du point de
  reprise.

## Alternatives écartées

- **Mise à jour des modèles de lecture dans la commande, par le module qui écrit** : le Village et le
  Donjon devraient connaître toutes les projections qui dépendent d'eux, ce qui rompt l'encapsulation
  des modules, et une panne entre l'écriture du journal et celle de la table les rendrait
  incohérents.
- **Tâche planifiée** : les tâches de l'offre gratuite ne s'exécutent qu'une fois par jour, ce qui
  laisserait le classement en retard jusqu'à une journée.
- **Processus de fond abonné au journal** : aucun processus ne s'exécute entre deux requêtes sur
  Vercel, et un serveur dédié serait contraire aux critères d'hébergement du projet.
- **Vue matérialisée de PostgreSQL** : elle est entièrement recalculée à chaque rafraîchissement, ce
  qui reproduit le coût du rejeu, et son contenu ne peut pas être construit à partir des événements
  par une logique du domaine.
- **Maintien du calcul par rejeu** : le coût de chaque consultation croît sans limite avec
  l'historique du jeu, comme le consignait la dette DT-005.

## Réexamen

Cette décision devra être réexaminée si une reconstruction approche la durée maximale d'une fonction
Vercel, ce qui imposerait de la mener hors consultation ; si le nombre de consultations simultanées
rend le verrou du point de reprise goulet d'étranglement ; ou si un besoin de lecture strictement à
jour apparaît, que la cohérence différée ne peut pas satisfaire.

## Usage de l'IA générative

Un assistant de programmation fondé sur l'IA générative a contribué à la rédaction de cet ADR et au
code du TD8 qu'il décrit (moteur des projections, module Classement, projection des expéditions
ouvertes, canal global), à partir du support du TD et du dépôt. Les affirmations sur le code ont été
vérifiées en exécutant `pnpm verify`, dont les tests du moteur (rattrapages simultanés, positions
manquantes, reconstruction), et en observant sur un serveur local la mise à jour en direct du
classement entre deux joueurs. Le contenu doit être relu et validé par l'auteur du projet, qui passe
alors le statut à « accepté ».
