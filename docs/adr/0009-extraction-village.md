# ADR-0009 - Le Village peut être extrait en service autonome : l'extraction est préparée, mais non déployée

- Statut : proposé
- Date : 2026-10-21

## Contexte

L'ADR 0001 a retenu un monolithe modulaire en promettant que les frontières entre modules seraient
assez strictes pour qu'un module puisse en être extrait. Cette promesse est vérifiée depuis le TD2
par les règles d'importation de dependency-cruiser, mais elle n'avait jamais été éprouvée : une
règle qui n'a jamais eu à servir ne démontre pas que les frontières sont celles que l'on croit.

Les raisons d'extraire un module sont précises : une montée en charge indépendante, l'autonomie de
plusieurs équipes, une cadence de déploiement différente, l'isolation d'une panne ou d'une faille,
une technologie différente. Aucune ne concerne aujourd'hui le jeu, développé par une seule personne
et joué par quelques dizaines de joueurs, dont le test de charge ne fait apparaître aucun module en
difficulté particulière.

Le Village se prête à l'exercice : son domaine ne dépend d'aucun autre module, il ne lit les données
d'aucun autre module, et sa relation principale avec le reste du jeu, la saga du Marché, passe déjà
par des messages (ADR 0007). Son inventaire de dépendances compte cinq importations depuis le reste
du code, dont une seule appelle une fonction, celle de la racine de composition, les autres portant
sur ses contrats. Deux dépendances ne passent pas par le code : le Classement et le canal temps réel
du village lisent ses événements dans le journal commun, ce que le TD8 avait nommé le langage
publié. Les droits des joueurs (ADR 0008) atteignent aussi ses données.

L'hébergement ajoute des contraintes : PGlite n'accepte qu'un seul processus par répertoire, et un
second déploiement sur Vercel aurait un coût d'exploitation que rien ne justifie.

## Décision

Le Village peut s'exécuter dans un service autonome, assemblé par sa propre racine de composition
(`src/services/village`), avec sa propre base, son propre journal et sa propre boîte d'envoi. Le
module n'est pas modifié.

L'application devient alors une passerelle : elle reçoit une version distante du module Village
(`remote.ts`), de même forme que la version exécutée dans le processus, dont chaque élément
s'adresse au service par HTTP. Le reste de l'application ne voit pas la différence. C'est le motif
de l'étrangleur : la façade, l'API `/api/realm`, existe déjà.

Les messages de la saga franchissent la frontière par une boîte de réception, sans modifier les
garanties de la boîte d'envoi : un message n'est marqué comme traité qu'à la réception d'un accusé
de succès, et son traitement par le Village reste idempotent.

Un relais lit le flux d'événements publié par le service (`GET /events`) et en dépose une copie dans
le journal de l'application, où le Classement et le canal temps réel continuent de le lire sans
modification. La copie garde le flux et la version de l'original : relayer deux fois le même
événement est sans effet. Le relais est déclenché après chaque commande et chaque message de la
saga, et chaque jour par la tâche planifiée.

Les échanges entre les deux processus sont authentifiés par un secret partagé, qui n'est jamais
versionné : le service refuse toute requête qui ne le porte pas, et ne lit l'identité du joueur
qu'après cette vérification.

Le service n'est pas déployé. Il n'est utilisé que si `REALM_SERVICE_URL` et `SERVICE_SECRET` sont
définies, ce qui n'est le cas qu'en local : en production, le Village s'exécute dans l'application,
comme avant. L'extraction est réversible sans migration de données.

## Conséquences

### Positives

- Les frontières du Village sont démontrées, et non plus supposées : le service fonctionne sans
  qu'une ligne du module ait changé, et six tests de contrat vérifient à chaque construction
  l'accord entre l'application et le service, y compris la reprise de la saga après une panne.
- Le coût réel d'une extraction est connu : environ 470 lignes ajoutées hors tests, dont 153 pour le
  module distant et 72 pour le service, et le reste dans la plateforme.
- L'extraction est réversible sans migration : le relais dépose dans le journal de l'application une
  copie complète des événements du service, et l'application seule retrouve ses villages.
- La boîte de réception, l'authentification entre services et le relais appartiennent à la
  plateforme ou ne dépendent que d'un contrat : ils serviraient à l'extraction d'un autre module.
- Une panne du service est partielle : Taverne, Marché et Classement continuent de répondre, tandis
  que les requêtes du Village échouent.

### Négatives

- Deux chemins d'exécution du Village sont à maintenir, l'un dans le processus, l'autre distant :
  toute évolution de l'interface du module doit être répercutée dans `remote.ts`.
- Le journal de l'application contient une copie des événements du Village, qui n'est plus leur
  source de vérité, et dont la cohérence est différée : un événement n'y apparaît qu'une fois relayé.
- Trois limites doivent être traitées avant tout déploiement du service, et sont consignées au
  registre de la dette : ses migrations, la pagination de son flux publié, et la distribution de sa
  boîte d'envoi (DT-010 à DT-012).
- Le secret partagé authentifie les deux sens, et sa fuite permettrait de se faire passer pour
  n'importe quel joueur auprès du service.
- Une requête du Village traverse désormais deux processus : elle ajoute une latence réseau, et elle
  échoue lorsque le service est arrêté.

## Alternatives écartées

- **Déployer le service** : aucune raison d'extraire ne s'applique, et un second déploiement
  coûterait un hébergement, une base, des secrets et des journaux de plus, sans aucun bénéfice.
- **Ne pas extraire, et laisser les frontières à l'état d'hypothèse** : la promesse de l'ADR 0001
  resterait invérifiée, et le coût d'une extraction inconnu le jour où le besoin apparaîtrait.
- **Lecture à distance du flux publié par le Classement et le canal temps réel** : le moteur des
  projections et le canal temps réel devraient savoir lire deux sources, ce qui modifierait la
  plateforme et le Classement. Le relais laisse les consommateurs inchangés, au prix d'une copie.
- **Extraire le Marché plutôt que le Village** : la saga lie son sort à celui du Village, dont
  elle dépend pour chacune de ses étapes ; l'extraction du Marché déplacerait la frontière sans la
  démontrer, et le Marché dépend de plus de modules que le Village.
- **Jeton signé (JWT) ou TLS mutuel pour authentifier les échanges** : plus robustes, car l'identité
  ne pourrait pas être fabriquée sans la clé de signature, ou l'authentification porterait sur la
  machine plutôt que sur un secret transmis ; mais plus lourds à mettre en œuvre, alors qu'un secret
  partagé suffit à un service exécuté sur le poste de développement.

## Réexamen

Cette décision devra être réexaminée lorsqu'une raison d'extraire apparaît, traduite en signes
observables : un Village dont le test de charge dépasse le budget alors que les autres modules le
respectent ; l'arrivée d'une seconde équipe chargée du Village ; un besoin de déployer le Village
plus souvent que le reste du jeu ; une faille ou une panne du Village qu'il faudrait isoler. Elle
devra aussi l'être avant tout déploiement du service, pour rembourser les trois dettes qui lui sont
associées et choisir un mécanisme d'authentification plus robuste.

## Usage de l'IA générative

Un assistant de programmation fondé sur l'IA générative a contribué à la rédaction de cet ADR et au
code du TD11 qu'il décrit (service Village, module distant, boîte de réception, relais), à partir du
support du TD et du dépôt. Les affirmations sur le code ont été vérifiées en exécutant `pnpm verify`,
dont les six tests de contrat, et en rejouant en local, avec deux processus réels, un parcours
complet : villages, échange du Marché, classement, panne du service puis rétablissement, et retour à
l'application seule. Le contenu doit être relu et validé par l'auteur du projet, qui passe alors le
statut à « accepté ».
