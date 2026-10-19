# ADR-0002 - Event Sourcing comme mode de persistance du Village

- Statut : proposé
- Date : 2026-10-19

## Contexte

L'état d'un village (nom, stock, niveaux des bâtiments) évolue par une suite d'actions du
joueur : fonder le village, améliorer un bâtiment. Sa production de ressources n'est pas
mise à jour en continu : elle est calculée à partir du temps écoulé depuis le dernier
changement, car l'hébergement sans serveur interdit toute tâche de fond.

La suite du projet a besoin de connaître ce qui s'est passé, pas seulement l'état courant :
les changements devront être diffusés en temps réel aux joueurs (TD5), et un classement
devra être construit à partir de l'activité des joueurs (TD8).

L'hébergement sans serveur de Vercel ne garde aucune mémoire entre deux requêtes et peut
confier deux requêtes simultanées pour un même village à deux instances différentes de
l'application (double clic, deux onglets). Chacune charge l'état, décide, puis enregistre :
sans précaution, la seconde peut enregistrer une décision prise sur un état périmé, et une
même ressource serait dépensée deux fois.

## Décision

L'état du village n'est pas stocké : il est reconstruit à la demande en rejouant ses
événements au moyen de la fonction `replay` du domaine.

Les événements sont enregistrés dans un journal générique de la plateforme, la table
`platform.events` (`src/platform/event-store/`), en ajout seul : aucune ligne n'est
modifiée ni supprimée. Chaque village correspond à un flux, nommé `village-<joueur>`,
dont les événements sont numérotés par version à partir de 1. La plateforme conserve le type
et les données de chaque événement sans les interpréter ; le module Village les traduit
dans `src/modules/realm/infrastructure/event-store-village-repository.ts`.

Les écritures concurrentes sont détectées par une contrainte d'unicité de la base sur le
couple (flux, version), et non par une vérification en mémoire. Un conflit lève une
`ConcurrencyError` ; la commande est alors rejouée en entier (chargement, décision,
enregistrement) au plus trois fois, par `withOptimisticRetry`, avant que l'erreur soit
transmise.

Un événement porte toutes les informations nécessaires à son application : par exemple,
`BuildingUpgraded` consigne le coût effectivement payé, au lieu de le recalculer à partir
de la règle de coût.

## Conséquences

### Positives

- L'historique complet de chaque village est conservé et fiable : les événements ne sont
  jamais modifiés, ce qui permet de savoir comment un village a atteint son état et de
  répondre à un joueur qui conteste un résultat.
- L'état peut être reconstruit à tout moment, y compris tel qu'il était à une version
  passée, et une anomalie de règle peut être corrigée puis les événements rejoués.
- Les événements et leur position globale sont un format naturel pour le temps réel (TD5) et
  pour les projections du classement (TD8), sans modifier le module Village.
- La garantie de cohérence est apportée par la base de données, seul point commun à toutes
  les instances de l'application : une seule de deux écritures simultanées réussit.
- Le passage de l'adaptateur en mémoire au journal n'a modifié ni le domaine ni les règles de
  la couche application, ce qui confirme l'inversion des dépendances.

### Négatives

- Un événement enregistré ne peut plus être modifié. Si sa structure doit évoluer, le code
  doit savoir lire à la fois les anciennes et les nouvelles versions de l'événement ; une
  erreur se corrige par un nouvel événement, jamais par une modification.
- Chaque lecture relit et rejoue tous les événements du flux : le coût croît avec la
  longueur du flux. Il est négligeable pour quelques dizaines d'événements, mais exigerait
  des instantanés pour des flux très longs.
- Les questions qui portent sur tous les villages (par exemple les joueurs les plus riches)
  ne se résolvent pas directement : elles exigent des vues de lecture construites à partir
  des événements.
- Un journal dont on ne supprime rien entre en tension avec le droit à l'effacement du RGPD,
  à examiner si des données personnelles y figurent.
- Seul le coût payé est consigné dans les événements : la production par minute des
  bâtiments et le stock de départ sont lus dans le catalogue lors du rejeu. Les modifier
  change rétroactivement l'état rejoué des villages existants.
- Les conversions entre événements génériques du journal et événements typés du domaine sont
  des assertions de type, non vérifiées à l'exécution : elles ne restent exactes que si la
  structure des événements évolue avec précaution.

## Alternatives écartées

- **État stocké dans une table propre au module** (une ligne par village, mise à jour à
  chaque action) : plus simple à écrire et à interroger, mais l'historique est perdu à
  chaque mise à jour. Il faudrait le reconstituer à part pour le temps réel et le
  classement, et prévoir une colonne de version pour la concurrence : le journal en ajout
  seul répond à ces trois besoins avec un seul mécanisme.
- **Verrouillage pessimiste du village pendant le traitement d'une commande** : il
  supprime les conflits mais impose de maintenir un verrou, donc une connexion ouverte, pendant
  toute la durée du traitement. Cela s'accorde mal avec des fonctions à durée plafonnée et
  avec les connexions limitées d'une offre gratuite, et il introduit des attentes entre
  requêtes. Les conflits étant rares, les détecter à l'écriture est moins coûteux.
- **Serveur d'événements dédié** (base spécialisée dans le stockage d'événements) : il
  ajouterait un service à héberger et à surveiller, sans bénéfice à cette échelle, alors que
  PostgreSQL est déjà utilisé et fournit la contrainte d'unicité nécessaire. L'hébergement
  gratuit sans moyen de paiement, sans service à la charge de l'enseignant, écarte cette option.

## Réexamen

Cette décision devra être réexaminée si le nombre d'événements par village rend la
reconstruction de l'état perceptiblement lente (la mesure en est proposée dans les
exercices d'approfondissement du TD3), ce qui conduirait à introduire des instantanés ; si la
structure des événements doit évoluer fréquemment ; ou si des données personnelles doivent
être conservées dans les événements du Village et effacées à la demande.

## Usage de l'IA générative

Un assistant de programmation fondé sur l'IA générative a contribué à la rédaction de cet ADR et
au code du TD3 qu'il décrit (journal d'événements, adaptateur du Village, nouvel essai), à partir
du support du TD et du dépôt. Les affirmations sur le code ont été vérifiées en exécutant
`pnpm verify` (dont le test de deux améliorations simultanées et les tests du journal) et en
redémarrant le serveur de développement pour constater la persistance du village. Le contenu doit
être relu et validé par l'auteur du projet, qui passe alors le statut à « accepté ».
