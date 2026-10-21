# ADR-0007 - Les opérations entre modules sont des sagas orchestrées, dont les messages transitent par une boîte d'envoi transactionnelle

- Statut : proposé
- Date : 2026-10-21

## Contexte

Un échange du Marché modifie les données du Marché et celles de deux villages, c'est-à-dire trois
flux du journal dont deux appartiennent à un autre module. Il ne doit ni créer ni perdre de
ressources : ce que l'un cède, l'autre le reçoit.

La règle d'encapsulation des modules (TD2) interdit au Marché de connaître les événements et les
règles du Village : seul le Village décide de ce qui arrive à un village. La perspective de
l'extraction d'un module dans un service doté de sa propre base de données (TD11) interdit aussi
qu'une transaction englobe les données de deux modules.

L'hébergement ne permet aucun processus permanent : une fonction Vercel s'arrête après chaque
requête, peut être interrompue lorsqu'elle dépasse sa durée maximale, et l'enregistrement d'un
événement peut échouer sur un simple conflit de version (ADR 0004).

## Décision

Une transaction ne modifie jamais les données que d'un seul module. Une opération qui concerne
plusieurs modules est une saga : une suite de transactions locales, dont les échecs sont neutralisés
par des compensations qui ajoutent des faits sans effacer le passé. Les étapes sont identifiées :
la mise en séquestre des ressources du vendeur est compensable, le paiement de l'acheteur est le
pivot, les versements et les restitutions sont repris jusqu'au succès.

La saga est orchestrée par le module qui porte l'opération, ici le Marché. Le déroulement complet se
lit dans un seul fichier (`saga.ts`). Les participants ne connaissent pas la saga : le Village
prélève et verse des ressources à la demande, et répond à l'adresse de retour (`replyTo`) indiquée
dans chaque demande.

Les messages sont enregistrés dans la boîte d'envoi de la plateforme (`platform.outbox`), dans la
même transaction que les événements qui les déclenchent : il n'y a plus de double écriture.

La distribution est garantie au moins une fois : un bail de trente secondes protège un message en
cours de traitement, un échec est retenté avec un recul exponentiel, et un message est abandonné
après dix tentatives. `FOR UPDATE SKIP LOCKED` empêche deux distributions simultanées de réserver le
même message.

Chaque gestionnaire est idempotent, grâce à une clé d'idempotence choisie par le demandeur : un
identifiant de mouvement déterminé par l'offre et l'étape de la saga, et non l'identifiant du
message. Un refus métier est enregistré comme un fait, afin qu'un même mouvement ait toujours la
même issue.

La distribution a lieu après chaque commande du Marché, à chaque consultation de sa liste, et chaque
jour par une tâche planifiée protégée par un secret (`CRON_SECRET`), dont la route est fermée par
défaut. Un message différé sert de minuterie pour l'échéance des offres.

## Conséquences

### Positives

- Aucun module n'écrit dans les données d'un autre : le Marché n'importe du Village que ses contrats,
  et l'essentiel de leur relation passe par des messages.
- Une panne à n'importe quel moment ne perd ni ne duplique aucune ressource : l'événement et le message
  sont enregistrés ensemble, le message est retenté jusqu'à son traitement, et son effet est unique.
- Le Village peut servir d'autres demandeurs sans modification : un impôt ou une récompense
  demanderaient seulement d'envoyer les mêmes messages.
- La boîte d'envoi sert aussi de minuterie : le retrait des offres échues ne demande aucun mécanisme
  supplémentaire.
- Le déroulement de la saga se lit en un seul endroit, et se teste sans base de données ni boîte
  d'envoi, puisque le domaine produit des demandes et non des messages.
- Les messages traités sont conservés : le déroulement d'une saga se reconstitue après coup.

### Négatives

- Des états intermédiaires sont visibles des joueurs : une offre peut être en réservation ou en
  règlement, avec des ressources en séquestre, détenues par le Marché comme par un tiers de confiance.
- La latence dépend de l'activité : une saga interrompue ne reprend qu'à la consultation suivante du
  Marché, ou au plus tard le lendemain, à l'exécution de la tâche planifiée.
- Il faut écrire des gestionnaires idempotents et tester leurs doublons, puisque la livraison exacte
  une fois est impossible à garantir.
- Des messages abandonnés après dix tentatives restent dans la table sans qu'aucun outil permette
  de les examiner ni de les relancer (dette DT-007) : une offre dont un message est abandonné reste
  bloquée.
- La table de la boîte d'envoi grandit sans limite, les messages traités étant conservés.
- Aucun ordre de remise n'est garanti entre deux messages : toute nouvelle saga doit s'en passer.

## Alternatives écartées

- **Transaction unique englobant les données des deux modules** : le Marché devrait connaître les
  événements et les règles du Village, ce qui rompt l'encapsulation ; l'extraction d'un module
  deviendrait impossible sans réécrire l'échange ; et les verrous des deux villages seraient tenus
  pendant tout l'échange.
- **Transaction distribuée par validation en deux phases** : elle est peu disponible dans les
  services hébergés, rend chaque base dépendante de la disponibilité des autres, et maintient des
  verrous pendant toute la coordination.
- **Appel direct du Village par le Marché, sans boîte d'envoi** : c'est une double écriture. Une
  panne entre l'enregistrement de l'offre et l'appel laisse l'offre en réservation indéfiniment, et
  l'ordre inverse fait disparaître les ressources du vendeur.
- **Saga chorégraphiée** : chaque participant réagirait aux événements des autres. Le déroulement
  serait réparti entre les modules et couplerait le Village aux offres ; elle convient mieux à une
  saga courte dont les participants réagissent naturellement aux faits des autres.
- **Journal d'événements utilisé comme boîte d'envoi** : un message est une commande adressée à un
  destinataire, et non un fait ; et la distribution a besoin de suivre, message par message, le nombre
  de tentatives et la dernière erreur, ce que le point de reprise d'une projection ne permet pas.

## Réexamen

Cette décision devra être réexaminée en cas d'extraction d'un module dans un service distinct, qui
demanderait une boîte d'envoi par base et un transport entre services ; si le volume de messages
justifie un courtier de messages dédié ; ou si un besoin de latence dépasse ce que la distribution
déclenchée par les requêtes peut offrir.

## Usage de l'IA générative

Un assistant de programmation fondé sur l'IA générative a contribué à la rédaction de cet ADR et au
code du TD9 qu'il décrit (boîte d'envoi, mouvements de ressources du Village, module Marché), à
partir du support du TD et du dépôt. Les affirmations sur le code ont été vérifiées en exécutant
`pnpm verify`, dont les tests de doublons, d'interruption et de concurrence, et en rejouant sur un
serveur local un échange complet entre deux joueurs avec ses chemins d'échec : paiement refusé,
retrait de l'offre, route de distribution fermée. Le contenu doit être relu et validé par l'auteur du
projet, qui passe alors le statut à « accepté ».
