# Rendu de l'évaluation

- Auteur : Elie Lajoinie
- Module : `notifications`
- Adresse du déploiement : À COMPLÉTER avant la pose de l'étiquette, avec l'adresse Vercel de production, identique à celle de la rubrique « About » du dépôt
- Fiche de cadrage : [fiche-cadrage.md](fiche-cadrage.md)

Tous les fichiers cités sont relatifs à la racine du dépôt. Les tests sont désignés par le titre de leur
`it(...)`. Les fichiers du module sont dans `src/modules/notifications/` ; les tests d'intégration de l'API
sont dans `src/bootstrap/notifications-api.test.ts`.

## Exigences minimales

| N° | Fichiers principaux | Tests qui la vérifient |
| --- | --- | --- |
| E1 | `domain/notification.ts`, `application/notifications-service.ts` et `notifications-store.ts`, `infrastructure/` (`schema.ts`, `notifications-projection.ts`, `drizzle-notifications-store.ts`), `api.ts`, `index.ts`, `contracts.ts`, `ui.tsx`, `personal-data.ts` | `pnpm lint:archi` : les règles `module-encapsulation`, `pure-domain`, `application-ignores-infrastructure` et `outside-uses-public-entries` s'appliquent au module, sans violation (157 modules, 513 dépendances) ; fonction d'aptitude « déclare les données personnelles de chaque module qui conserve des données » |
| E2 | `src/bootstrap/create-api.ts` (module, contributeur, règle du canal, route `/notifications`, tâche quotidienne), `app/(jeu)/notifications/page.tsx`, `src/ui/app-shell.tsx` (navigation), `src/ui/theme.ts` | Tous les tests de `notifications-api.test.ts` passent par la racine de composition ; la page et l'entrée de navigation n'ont pas de test automatique (voir la revue N1 : la page sans session reçoit une redirection, observée sur un serveur local) |
| E3 | `domain/notification.ts` : `notificationsFor`, `retained`, `feedOf`, `unreadCount`, `advanceRead` | `domain/notification.test.ts` (9 tests) ; règle `pure-domain` de dependency-cruiser |
| E4 | `infrastructure/schema.ts` (schéma `notifications`, quatre tables), `drizzle/0013_notifications.sql`, `drizzle/0014_lecture.sql`, ADR 0010 | Fonction d'aptitude « range chaque table dans le schéma d'une brique de la plateforme ou d'un module » ; `infrastructure/notifications-projection.test.ts` (6 tests) |
| E5 | `api.ts`, `contracts.ts` (`ReadInput`), `src/bootstrap/create-api.ts` (`requireUser`) | « refuse une requête anonyme (401) » ; « refuse une position invalide (400) et une requête anonyme (401) » ; « ne marque pas comme lues les notifications d'un autre joueur » ; « réserve le canal aux joueurs connectés, et n'en ouvre qu'un » ; revue de sécurité N1 à N4 |
| E6 | `infrastructure/notifications-projection.ts`, `contracts.ts` (`SOURCE_EVENTS`) : lecture des événements du Marché et du Donjon par les contrats de ces modules, ADR 0011 | « notifie le vendeur seul d'une offre conclue, et oublie ensuite son vendeur » ; « notifie les joueurs d'une expédition terminée, compagnons exclus » ; « ne crée aucun doublon lorsque les mêmes événements sont rejoués » ; « redonne le même fil lorsque la projection est reconstruite » ; « notifie le vendeur lorsque son offre est conclue, et non l'acheteur » ; « notifie chaque joueur d'une expédition terminée, avec son résultat » |
| E7 | `personal-data.ts`, enregistré dans `src/bootstrap/create-api.ts` | « exporte les notifications du joueur, puis les efface avec son compte » (export de la position de lecture, des notifications, des offres et des expéditions en cours ; effacement des quatre tables) ; fonction d'aptitude « déclare les données personnelles de chaque module qui conserve des données » ; registre des traitements, T8 |
| E8 | Voir la correspondance ci-dessous | Voir la correspondance ci-dessous : 9 tests du domaine, 6 de la projection, 13 de l'API |
| E9 | Aucun fichier de configuration modifié : `.dependency-cruiser.cjs` est identique à celui de `td11-fin` | `pnpm lint:archi` : aucune violation ; `src/bootstrap/architecture.test.ts` : les trois fonctions d'aptitude passent |
| E10 | Migrations `drizzle/0013_notifications.sql` et `0014_lecture.sql`, appliquées par `pnpm vercel-build` (`db:migrate`) | Non vérifié sur le déploiement au moment de la rédaction : le module a été exercé sur la construction de production, avec PGlite. À vérifier après l'envoi, puis à consigner dans la revue de sécurité des Notifications |

### Correspondance entre les règles de la fiche et les tests (E8)

| Règle de la fiche | Test du domaine | Tests de la projection et de l'API |
| --- | --- | --- |
| 1. Une offre conclue notifie son vendeur, et lui seul | « notifie le vendeur seul d'une offre conclue » | Projection : « notifie le vendeur seul d'une offre conclue, et oublie ensuite son vendeur » ; API : « notifie le vendeur lorsque son offre est conclue, et non l'acheteur » |
| 2. Une offre expirée notifie son vendeur, pas un retrait par lui-même | « notifie le vendeur d'une offre expirée, mais pas lorsqu'il la retire lui-même » | Projection : « notifie le vendeur d'une offre expirée, mais pas de son propre retrait » ; API : « notifie le vendeur d'une offre expirée, mais pas lorsqu'il la retire lui-même » |
| 3. Une expédition terminée notifie ses joueurs, avec son résultat, compagnons exclus | « notifie chaque joueur d'une expédition terminée, une fois, avec son résultat » ; « ne notifie personne d'une expédition sans joueur » | Projection : « notifie les joueurs d'une expédition terminée, compagnons exclus » ; API : « notifie chaque joueur d'une expédition terminée, avec son résultat » |
| 4. Au plus 50 notifications, les plus récentes d'abord | « présente les notifications les plus récentes en premier, au plus cinquante » | |
| 5. Conservation de trente jours | « ne présente plus une notification de plus de trente jours » | API : « ne présente plus une notification de plus de trente jours » ; « applique chaque jour la conservation, même sans consultation du fil » |
| 6. Le nombre de non lues se déduit de la position de lecture | « compte les notifications postérieures à la position de lecture » | API : « compte les non lues, puis marque comme lues sans reculer ni dépasser la dernière » |
| 7. La position de lecture ne recule jamais | « ne recule jamais la position de lecture » | API : « compte les non lues, puis marque comme lues sans reculer ni dépasser la dernière » |
| 8. Un joueur ne marque que ses propres notifications, pas celles à venir | « ramène la position demandée à la dernière notification du joueur » | API : « ne marque pas comme lues les notifications d'un autre joueur » |
| Garantie : rejouer un événement ne crée aucun doublon | | Projection : « ne crée aucun doublon lorsque les mêmes événements sont rejoués » |
| Garantie : reconstruire redonne le même fil | | Projection : « redonne le même fil lorsque la projection est reconstruite » ; API : « conserve la position de lecture lorsque la projection est reconstruite » |

| Route | Test de l'API |
| --- | --- |
| `GET /api/notifications` | « refuse une requête anonyme (401) » ; « notifie le vendeur lorsque son offre est conclue, et non l'acheteur » ; « ne présente plus une notification de plus de trente jours » |
| `POST /api/notifications/read` | « compte les non lues, puis marque comme lues sans reculer ni dépasser la dernière » ; « ne marque pas comme lues les notifications d'un autre joueur » ; « refuse une position invalide (400) et une requête anonyme (401) » |
| `GET /api/stream/notifications` | « annonce sur son canal les événements notifiables, sans leurs données » ; « réserve le canal aux joueurs connectés, et n'en ouvre qu'un » |

## Bonus revendiqués

Cinq bonus sont revendiqués, ce qui atteint le plafond de cinq points.

| N° | Description | Fichiers | Tests | Documentation |
| --- | --- | --- | --- | --- |
| B1 | Canal temps réel `notifications`, avec sa règle d'accès : réservé aux joueurs connectés, un seul nom de canal, données vidées. Il est global (DT-015) | `index.ts` (`channelPolicy`), `contracts.ts` (`NOTIFICATIONS_CHANNEL`), `ui.tsx` | « annonce sur son canal les événements notifiables, sans leurs données » ; « réserve le canal aux joueurs connectés, et n'en ouvre qu'un » | ADR 0011 ; `docs/architecture.md` (composants, parcours) ; README (Temps réel) ; revue N7 et N8 |
| B2 | Tâche quotidienne propre au module, `notifications`, dans `/api/cron/daily` : conservation de trente jours et suppression des lignes de correspondance abandonnées | `application/notifications-service.ts` (`purge`), `infrastructure/drizzle-notifications-store.ts` (`removeOlderThan`), `index.ts` (`dailyTask`), `src/bootstrap/create-api.ts` | « applique chaque jour la conservation, même sans consultation du fil » | ADR 0010 ; `docs/architecture.md` (Déploiement) ; README (Données personnelles) ; registre des traitements, T8 ; revue N9 |
| B4 | Modèle de lecture tenu par une projection, avec son point de reprise et sa version (`notifications`, version 1) | `infrastructure/notifications-projection.ts`, `infrastructure/schema.ts` | « redonne le même fil lorsque la projection est reconstruite » ; « conserve la position de lecture lorsque la projection est reconstruite » ; « ne crée aucun doublon lorsque les mêmes événements sont rejoués » | ADR 0010 ; `docs/architecture.md` (conteneurs) ; README (Base de données) |
| B6 | Communication avec deux modules existants, le Marché et le Donjon, par la lecture de leur langage publié | `infrastructure/notifications-projection.ts`, `contracts.ts` (`SOURCE_EVENTS`) | Projection : « notifie le vendeur seul d'une offre conclue, et oublie ensuite son vendeur », « notifie les joueurs d'une expédition terminée, compagnons exclus » ; API : « notifie le vendeur lorsque son offre est conclue, et non l'acheteur », « notifie chaque joueur d'une expédition terminée, avec son résultat » | ADR 0011 ; `docs/architecture.md` (composants, paragraphe de communication, diagramme de séquence) |
| B8 | Nouvelle fonction d'aptitude : chaque type d'événement lu par le module est encore publié par le domaine du Marché ou du Donjon | `src/bootstrap/architecture.test.ts`, `contracts.ts` (`SOURCE_EVENTS`) | « lit des événements que les modules sources publient encore » : elle a été vue échouer en y ajoutant un type d'événement inexistant | ADR 0011 ; `docs/architecture.md` (trois fonctions d'aptitude) |

### Bonus visé et non revendiqué : B7

Le scénario de lecture du fil figure au test de charge (`scripts/load-test.ts`, résultats dans
`perf/notifications.json`), mais le budget de performance n'est pas respecté : p99 de 565 ms puis de
552 ms pour un budget de 500 ms. La condition du bonus n'est pas remplie, il n'est donc pas
revendiqué. La cause est consignée (DT-016, ADR 0010).

## Écarts avec la fiche de cadrage

- B7 : annoncé, non obtenu, pour la raison ci-dessus.
- La fiche prévoyait de ne modifier de l'existant que la racine de composition, la navigation, le thème,
  le test de charge et la documentation. Ont aussi été complétés : la feuille de style (`app/globals.css`,
  trois règles pour l'écran), le journal des migrations (`drizzle/meta/_journal.json`, produit par
  `drizzle-kit`) et `src/bootstrap/architecture.test.ts`, pour le bonus B8. Aucun test existant n'a été
  modifié, retiré ni affaibli.
- Le contributeur de données personnelles n'exportait d'abord ni les offres ni les expéditions en cours,
  que la fiche annonce ; la revue de sécurité l'a relevé, et l'export les contient désormais.
- Trois dettes ont été consignées, dont une seule était annoncée par la fiche : DT-015, le canal global.
  DT-016, la lecture du fil au-dessus du budget, résulte de la mesure ; DT-017, un JSON mal formé qui
  produit une erreur 500, est un défaut de la plateforme découvert par la revue, qui n'a pas été corrigé
  pour rester dans le périmètre de la fiche.
- Les règles métier, les routes, le stockage, la communication et les données personnelles de la fiche
  sont réalisés tels qu'annoncés.

## Indicateurs au rendu

| Indicateur | À l'étiquette `td11-fin` | Au rendu |
| --- | --- | --- |
| Nombre de tests | 236 | 265 |
| Couverture des lignes | 75,3 % | 74,9 % |
| Violations des règles d'architecture | 0 | 0 |
| Fonctions d'aptitude | 2 | 3 |
| Règles de dependency-cruiser | 8 | 8 |
| Lignes de code, hors tests | 7 913 | 8 692 |

Les mesures sont celles de `pnpm verify` et de `pnpm test:coverage` ; la baisse de la couverture vient de
l'écran des Notifications (39 lignes sans test), le reste du module étant couvert à 96 %. Le détail figure
dans [le bilan technique](../bilan-technique.md).

## Fonctionnalité complémentaire : le module Avatars

Cette fonctionnalité est postérieure à l'étiquette `eval-fin` : seul l'état du dépôt à cette étiquette est celui du
rendu, et le module évalué reste Notifications. Le module Avatars a été réalisé avec les mêmes exigences, pour
qu'il puisse être examiné de la même façon. Sa fiche est [fiche-cadrage-avatars.md](fiche-cadrage-avatars.md) ; elle a
été rédigée après la réalisation, et n'a pas été validée par l'enseignant. Les chemins sont relatifs à
`src/modules/avatars/`, sauf mention contraire.

| N° | Fichiers principaux | Tests qui la vérifient |
| --- | --- | --- |
| E1 | `domain/` (`skin.ts`, `bubble.ts`, `wander.ts`), `application/` (`avatars-service.ts`, `skin-store.ts`), `infrastructure/` (`schema.ts`, `drizzle-skin-store.ts`), `api.ts`, `index.ts`, `contracts.ts`, `ui.tsx`, `personal-data.ts` | `pnpm lint:archi` : aucune violation (170 modules, 550 dépendances) ; fonction d'aptitude « déclare les données personnelles de chaque module qui conserve des données » |
| E2 | `src/bootstrap/create-api.ts`, `app/(jeu)/tavern/page.tsx` (la scène est placée dans la page de la Taverne, accessible depuis la navigation) | Tous les tests de `src/bootstrap/avatars-api.test.ts` passent par la racine de composition ; la page n'a pas de test automatique (observée dans un navigateur) |
| E3 | `domain/skin.ts`, `domain/bubble.ts`, `domain/wander.ts` : fonctions pures, le hasard étant fourni par l'appelant | `domain/skin.test.ts`, `domain/bubble.test.ts` et `domain/wander.test.ts` (14 tests) ; règle `pure-domain` |
| E4 | `infrastructure/schema.ts` (schéma `avatars`, table `skins`), `drizzle/0015_avatars.sql`, ADR 0012 | Fonction d'aptitude « range chaque table dans le schéma d'une brique de la plateforme ou d'un module » ; « enregistre le personnage choisi, et le remplace à chaque nouveau choix » |
| E5 | `api.ts`, `contracts.ts` (`ChooseSkinInput`, `LookupInput`), `src/bootstrap/create-api.ts` (`requireUser`) | « refuse une requête anonyme (401) » ; « ne choisit qu'au nom du joueur connecté, quel que soit le corps envoyé » ; « refuse un personnage hors du catalogue, ou un corps invalide (400) » ; « refuse une demande vide, ou de plus de cinquante joueurs (400) » ; revue de sécurité A1 à A4 |
| E6 | `ui.tsx` (lit l'état de la Taverne par `useTavernState`), `src/modules/tavern/ui.tsx` (contexte et enfants) | Écart : voir ci-dessous. Aucun test automatique de l'interface ; les règles que la scène applique sont testées dans le domaine |
| E7 | `personal-data.ts`, enregistré dans `src/bootstrap/create-api.ts` | « exporte le personnage choisi par le joueur, puis l'efface avec son compte » ; fonction d'aptitude « déclare les données personnelles… » ; registre des traitements, T9 |
| E8 | Voir la correspondance ci-dessous | 14 tests du domaine, 8 de l'API, 1 fonction d'aptitude |
| E9 | Aucun fichier de configuration modifié : `.dependency-cruiser.cjs` est identique à celui de `td11-fin` | `pnpm lint:archi` ; les quatre fonctions d'aptitude de `src/bootstrap/architecture.test.ts` passent |
| E10 | Migration `drizzle/0015_avatars.sql`, appliquée par `pnpm vercel-build` ; images et police dans `public/` | Non vérifié sur le déploiement au moment de la rédaction : le module a été exercé sur un serveur de développement avec PGlite. À vérifier après l'envoi |

### Correspondance entre les règles de la fiche et les tests (E8)

| Règle de la fiche | Test du domaine | Test de l'API |
| --- | --- | --- |
| 1. Trois personnages, aucun autre nom | « ne propose que les trois personnages du catalogue » | « refuse un personnage hors du catalogue, ou un corps invalide (400) » |
| 2. Un personnage attribué par défaut, toujours le même | « attribue à chaque joueur un personnage par défaut, toujours le même, tiré de son identifiant » | « attribue un personnage à un joueur qui n'a rien choisi, toujours le même » |
| 3. Le choix, ou le personnage attribué si le choix a disparu | « garde le personnage choisi, et retombe sur celui par défaut s'il a disparu du catalogue » | « présente le personnage des seuls joueurs demandés, choisi ou attribué » |
| 4. Une bulle d'une ligne de soixante caractères | « résume le message sur une seule ligne » ; « raccourcit un message trop long, sans couper un symbole en deux » | |
| 5. Une bulle visible six secondes, la dernière de chaque joueur | « affiche le dernier message du joueur, et seulement le sien » ; « efface la bulle au bout de six secondes » ; « ne ressuscite pas un message ancien lorsqu'un message plus récent a expiré » | |
| 6. Un personnage reste dans la scène et rebrousse chemin | « ne sort jamais de la scène, quelle que soit la position de départ » ; « rebrousse chemin au bord de la scène, quel que soit le tirage » ; « laisse à la scène la place de rebrousser chemin après la marche la plus longue » | |
| 7. Une marche à vitesse constante, une pause de 1,5 à 6 secondes | « marche à vitesse constante, en regardant du côté où elle va » ; « fait une pause comprise dans les bornes avant de repartir » ; « est reproductible pour une même suite de tirages » | |
| 8. Un joueur ne choisit que son personnage, cinquante joueurs au plus par demande | | « ne choisit qu'au nom du joueur connecté, quel que soit le corps envoyé » ; « refuse une demande vide, ou de plus de cinquante joueurs (400) » |

| Route | Test de l'API |
| --- | --- |
| `GET /api/avatars/me` | « refuse une requête anonyme (401) » ; « attribue un personnage à un joueur qui n'a rien choisi, toujours le même » |
| `PUT /api/avatars/me` | « enregistre le personnage choisi, et le remplace à chaque nouveau choix » ; « refuse un personnage hors du catalogue, ou un corps invalide (400) » ; « ne choisit qu'au nom du joueur connecté, quel que soit le corps envoyé » |
| `POST /api/avatars/lookup` | « présente le personnage des seuls joueurs demandés, choisi ou attribué » ; « refuse une demande vide, ou de plus de cinquante joueurs (400) » |

Écarts du module Avatars :

- **E6** : le module communique avec la Taverne par son interface (contexte et composants enfants), et non par des
  messages de la boîte d'envoi ni par la lecture du langage publié d'un module : la Taverne n'enregistre aucun
  événement et n'envoie aucun message. Le choix est justifié dans l'ADR 0012.
- Aucun bonus n'est revendiqué pour ce module.
- Les tailles d'affichage des images sont écrites à la main (DT-018), un corps JSON mal formé produit une erreur 500
  (DT-017, défaut de la plateforme), et l'origine des images n'est pas documentée (revue de sécurité des Avatars, A11).
- Aucun test existant n'a été modifié, retiré ni affaibli : `src/bootstrap/architecture.test.ts` a été complété, et
  l'interface de la Taverne (`src/modules/tavern/ui.tsx`) expose désormais son état par un contexte.

Indicateurs après l'ajout du module :

| Indicateur | À l'étiquette `td11-fin` | À l'étiquette `eval-fin` | Après les Avatars |
| --- | --- | --- | --- |
| Nombre de tests | 236 | 265 | 291 |
| Couverture des lignes | 75,3 % | 74,9 % | 71,7 % |
| Violations des règles d'architecture | 0 | 0 | 0 |
| Fonctions d'aptitude | 2 | 3 | 4 |

La baisse de la couverture vient de la scène (78 lignes sans test) : le reste du module est couvert à 100 %
(63 lignes sur 63).

## Usage de l'IA générative

Outil utilisé : un assistant de programmation fondé sur l'IA générative, dont le nom figure dans la fiche
de cadrage. Il a contribué à l'ensemble du travail, sous la direction de l'auteur.

- **Code** : le module (domaine, projection, service, API, écran, contributeur de données personnelles,
  migrations), l'extension du test de charge et la fonction d'aptitude.
- **Tests** : ceux du domaine, de la projection, de l'API et de la fonction d'aptitude.
- **Documents** : la fiche de cadrage, les ADR 0010 et 0011, la revue de sécurité, le registre des
  dettes et des traitements, l'architecture, le README, le bilan technique et ce document.

Vérification : `pnpm verify` (analyse statique, types, règles de dépendance, 265 tests) et `pnpm test:coverage` ;
des modifications du code qui doivent faire échouer un test, pour s'assurer qu'il vérifie bien ce qu'il
annonce (type d'événement inexistant pour B8, clause de conflit retirée pour les doublons, effacement
des lignes de correspondance omis) ; des parcours sur un serveur local, sur la construction de production,
avec plusieurs joueurs (échange du Marché, notification reçue sans rechargement, marquage comme lu, export
et suppression d'un compte, canal, requêtes anonymes et malformées, puis examen de la base) ;
la validation des diagrammes Mermaid avec la bibliothèque officielle ; deux séries de mesures de charge.
Pour le module Avatars, l'assistant a aussi préparé les images (nettoyage et recadrage des GIF) et écrit la
scène, et les résultats ont été observés dans un navigateur, avec plusieurs joueurs, sur écran large et sur écran de
téléphone. Le déploiement sur Vercel n'a pas été vérifié par l'assistant. Les statuts « proposé » des ADR et les
appréciations des revues doivent être relus et validés par l'auteur.
