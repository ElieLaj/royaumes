# Bilan technique de Royaumes

- Date : 2026-10-28
- Version examinée : état du dépôt après l'ajout du module Avatars, postérieur à l'étiquette `eval-fin`, comparé aux étiquettes `eval-fin` et `td11-fin`
- Auteur : Elie Lajoinie

Ce bilan dresse l'état technique du projet au terme de son développement, à partir de ses
décisions d'architecture, de ses indicateurs de qualité, de sa dette technique et de ses
revues. Il s'adresse à la personne qui reprendrait le projet. Chaque chiffre renvoie à la commande
ou au document qui le produit.

## 1. Le système livré

| Élément | Valeur |
| --- | --- |
| Modules métier | 8 : `realm`, `dungeon`, `market`, `ranking`, `tavern`, `notifications`, `avatars`, `system` (7 à `eval-fin`, 6 à `td11-fin`) |
| Briques de la plateforme | 9 : `auth`, `cron`, `db`, `event-store`, `http`, `outbox`, `privacy`, `projection`, `realtime` |
| Service extrait | 1 : `src/services/village`, non déployé (ADR 0009) |
| Lignes de code, hors tests | 9 470 (`src` et `app`), contre 8 692 à `eval-fin` et 7 913 à `td11-fin` |
| Fichiers de test, nombre de tests | 43 fichiers, 291 tests, contre 39 fichiers et 265 tests à `eval-fin`, et 36 fichiers et 236 tests à `td11-fin` |
| Commits | 117, dont 14 depuis `eval-fin` (103) et 33 depuis `td11-fin` (84) |
| Hébergement | Vercel (Francfort), base Neon (Francfort) |

| Module | Stockage | Lignes, hors tests |
| --- | --- | --- |
| `realm` | Event Sourcing ; version distante pour le service extrait (145 lignes) | 1 024 |
| `dungeon` | Event Sourcing, projection des expéditions ouvertes | 1 939 |
| `market` | Event Sourcing, projection des offres, saga | 1 205 |
| `ranking` | Projection du journal | 445 |
| `tavern` | Tables ordinaires | 759 |
| `notifications` | Tables ordinaires, tenues par une projection du Marché et du Donjon | 769 |
| `avatars` | Tables ordinaires (un choix par joueur) ; scène placée dans la Taverne | 636 |
| `system` | Aucun | 73 |

Le service Village compte 76 lignes, et la plateforme 1 577. Ces chiffres s'obtiennent par la boucle
de la sous-partie 2.1 du TD11, étendue à `src/services/`, et par `git ls-files src app`.

## 2. Les décisions d'architecture

Le registre `docs/adr/README.md` compte douze ADR. L'ADR 0001 est accepté ; les onze autres sont
au statut « proposé » : ils décrivent des décisions appliquées, que l'auteur n'a pas encore validées.

| ADR | Décision | Mise à l'épreuve | Bilan |
| --- | --- | --- | --- |
| 0001 | Monolithe modulaire | Extraction du Village (TD11) | A tenu. Cinq importations seulement visaient le Village, et le service fonctionne sans qu'une ligne du module change. Le coût de l'extraction est d'environ 470 lignes hors tests. |
| 0002 | Event Sourcing pour le Village | Projections (TD8), évolution des événements (TD7), réécriture ciblée (TD10) | A tenu, au prix de la relecture du flux à chaque commande, et d'une exception à la règle de l'ajout seul, consignée dans l'ADR 0008. |
| 0003 | Server-Sent Events alimentés par le journal | Canaux globaux (TD8), canal à source propre (TD10) | A tenu : trois sortes de canaux ont été ajoutées sans modifier la boucle de diffusion. Sa conséquence négative, la relecture deux fois par seconde par joueur connecté, n'a jamais été mesurée (risque 1). |
| 0004 | Manches simultanées et échéances paresseuses | Compagnons pilotés par l'ordinateur (TD7), tâche quotidienne (TD9, TD10) | A tenu. Une échéance n'est enregistrée qu'à la commande suivante, et les ressources d'une offre échue ne sont restituées qu'à la consultation suivante du Marché. |
| 0005 | Intelligence artificielle déterministe | Simulation d'équilibrage (TD7) | A tenu : la simulation reproduit ses résultats à graine égale. Les expéditions de quatre joueurs restent faciles. |
| 0006 | CQRS et projections rattrapées à la lecture | Test de charge (TD11) | A tenu, après correction : la mesure a désigné le rattrapage comme goulet, et le chemin rapide a apporté 25 à 40 % de débit sur les trois lectures concernées. |
| 0007 | Saga orchestrée et boîte d'envoi | Panne du service extrait (TD11) | A tenu : la saga reprend après la panne sans aucun code supplémentaire. La dette DT-007, l'examen des messages abandonnés, a été remboursée. |
| 0008 | Taverne sans Event Sourcing, réécriture ciblée du journal | Revue de conformité (TD10) | A tenu : huit exigences sur dix sont conformes, et les deux écarts constatés, les sessions expirées et les erreurs journalisées avec leurs paramètres, ont été remboursés au TD11 (DT-008, DT-009). |
| 0009 | Extraction du Village, préparée mais non déployée | Six tests de contrat, démonstration à deux processus | A tenu. Reste à rembourser trois dettes avant tout déploiement (DT-010 à DT-012). |
| 0010 | Tables classiques tenues par une projection pour les Notifications | Reconstruction à l'identique, conservation de trente jours, export et effacement, test de charge | A tenu, avec un coût : la lecture du fil exécute cinq requêtes SQL, et son p99 de 552 ms dépasse le budget de 500 ms (DT-016). La revue de sécurité a montré que l'export omettait les offres et expéditions en cours, corrigé depuis. |
| 0011 | Lecture du langage publié du Marché et du Donjon, canal global discret | Fonction d'aptitude sur les événements lus, tests du canal, revue de sécurité | A tenu : aucun module existant n'a été modifié. Deux limites : le canal global fait relire son fil à chaque joueur connecté (DT-015), et la fonction d'aptitude ne contrôle que les noms des événements, non leurs champs. |
| 0012 | Module Avatars : choix du personnage en base, déplacements locaux, composition par l'écran de la Taverne | Tests du domaine et de l'API, fonction d'aptitude sur les images, revue de sécurité, observation dans un navigateur à deux et trois joueurs | A tenu : la Taverne n'a changé que par l'exposition de son état, et la scène ne coûte qu'une demande des personnages toutes les trente secondes par visiteur (la relecture de la liste des présents, toutes les cinq secondes, est celle de la Taverne). Deux limites : un changement de personnage n'apparaît chez les autres qu'au plus trente secondes plus tard, et la communication avec la Taverne passe par son interface, non par le journal ni la boîte d'envoi (écart à l'exigence E6). |

## 3. La qualité

| Caractéristique | Indicateur | Valeur | Appréciation |
| --- | --- | --- | --- |
| Adéquation fonctionnelle | Tests réussis ; couverture des domaines | 291 tests (265 à `eval-fin`, 236 à `td11-fin`) ; 99,8 % des lignes des domaines (99,7 % à `td11-fin`) (`pnpm test:coverage`) | Satisfaisante : les règles du jeu, dont les huit des Notifications et les huit des Avatars, sont testées sans base ni serveur. |
| Efficacité des performances | Débit et p99 des lectures ; respect du budget | `perf/apres.json` (`td11-fin`) : de 68 à 106 requêtes par seconde, p99 de 356 à 488 ms. `perf/notifications.json` (rendu), jeu de données enrichi d'échanges conclus : de 62 à 112 requêtes par seconde, p99 de 257 à 552 ms, sans erreur | Insuffisante pour deux lectures sur six : le fil des notifications (552 ms) et le Marché (505 ms) dépassent le budget de 500 ms lors de la seconde série du rendu, et le Classement n'a que 63 ms de marge. Les deux séries ne sont pas strictement comparables : le jeu de données a changé. Les routes des Avatars n'ont pas de scénario de charge : la scène ne les appelle qu'une fois toutes les trente secondes par visiteur, et la relecture de la liste des présents, toutes les cinq secondes par visiteur de la Taverne, n'est pas mesurée non plus. Rien n'est mesuré en production, ni pour les flux temps réel. |
| Fiabilité | Tests de concurrence, de reprise et d'idempotence ; messages abandonnés | Conflits de version, bail et doublons de la boîte d'envoi, reprise de la saga après une panne : tests réussis ; `scripts/dead-letters.ts` : aucun message abandonné en développement | Bonne : chaque mécanisme a son test, et les échecs durables sont désormais signalés et relançables. |
| Sécurité | Exigences des revues de sécurité et de conformité | 73 exigences : 63 conformes, 1 non conforme, 9 en risque accepté (62 : 53, 1, 8 à `eval-fin` ; 50 : 42, 1, 7 à `td11-fin`) | Satisfaisante : les contrôles d'accès sont éprouvés, et un seul écart reste ouvert, le secret de signature hors Vercel (section 5). Le risque accepté des Notifications, N11, est celui du canal global ; celui des Avatars, A11, est l'origine non documentée des images. |
| Maintenabilité | Règles d'architecture ; fonctions d'aptitude ; couverture | 8 règles de dependency-cruiser, 4 fonctions d'aptitude (3 à `eval-fin`, 2 à `td11-fin`), aucune violation ; 71,0 % des lignes couvertes (74,9 % à `eval-fin`, 75,3 % à `td11-fin`) | Bonne pour le code serveur (modules 94,0 % contre 93,6 %, plateforme 92,6 % comme à `td11-fin`, qui n'a pas changé), mais l'interface (480 lignes, 15 fichiers à 0 %, contre 359 lignes et 14 fichiers à `eval-fin`, et 320 lignes et 13 fichiers à `td11-fin`) n'est vérifiée par aucun test automatique : une régression du temps réel ne serait détectée que par un essai à la main. La baisse vient des écrans, sans test : celui des Notifications (39 lignes) et la scène des Avatars (95 lignes) ; le reste de ces deux modules est couvert à 96 % et à 100 %. |
| Flexibilité | Extraction d'un module ; changement de base entre local et production | Village extrait, avec retour arrière sans migration ; PGlite et Neon derrière le même type `Db`, mêmes migrations | Bonne : l'extraction est démontrée, non déployée. |

## 4. La dette technique

| Indicateur | Valeur |
| --- | --- |
| Entrées consignées | 18 (DT-001 à DT-018) ; 17 à `eval-fin`, 14 à `td11-fin` |
| Entrées remboursées, dont à l'échéance prévue | 9, dont 9 à l'échéance prévue |
| Entrées ouvertes | 9 : DT-010 à DT-012 (service extrait), DT-013 et DT-014 (revues de sécurité), DT-015 à DT-018 (Notifications, plateforme et Avatars) ; 8 à `eval-fin`, 5 à `td11-fin` |

Analyse : les neuf premières entrées ont été consignées au moment où le raccourci a été pris, et
remboursées au TD annoncé, y compris au TD11 pour la limitation des tentatives, les messages
abandonnés, les sessions expirées et les erreurs journalisées : c'est le signe d'un pilotage. Les cinq
entrées ouvertes se répartissent en deux familles. Les trois dettes de l'extraction attendent un
événement, le déploiement du service, qui n'est pas prévu. DT-013 et DT-014 ont été consignées en
dressant ce bilan : elles étaient des actions décidées par des revues, mais ne figuraient pas au
registre, et auraient été oubliées ; leur échéance est un déploiement hors Vercel, ou celui du
service. Aucune entrée n'a dépassé son échéance.

L'évaluation en a ajouté trois, de natures différentes. DT-015, le canal global des notifications,
était connue dès la fiche de cadrage : la modifier sortait du périmètre. DT-016, la lecture du fil
au-dessus du budget, a été consignée parce que la mesure l'a établie, et que son remède se trouve dans la
plateforme. DT-017, le JSON mal formé qui produit une erreur 500, n'est pas un raccourci délibéré
mais un défaut de la plateforme, découvert en vérifiant les entrées invalides du module : il est
consigné faute de l'avoir corrigé, pour ne pas élargir le périmètre. Leurs échéances sont l'accueil
de plus de joueurs, et le déploiement public.

Le module Avatars en a ajouté une quatrième, DT-018 : les tailles d'affichage de ses images, mesurées à la main, que
seul l'ajout d'un quatrième personnage rendrait coûteuses à déduire.

## 5. Les revues

| Revue | Exigences | Conformes | Non conformes ou en risque accepté | Actions ouvertes |
| --- | --- | --- | --- | --- |
| Sécurité de l'authentification | 16 | 12 | 4 : S7 non conforme ; S3, S6, S9 en risque accepté | S7 : DT-013 ; S6 : à confirmer sur le déploiement réel ; S3 : DT-004 remboursée, reste l'option `AUTH_RATE_LIMIT=off` |
| Sécurité du Donjon | 14 | 12 | 2 : D7 et D14 en risque accepté | Aucune : réexamen si le jeu conserve des informations plus sensibles |
| Sécurité du Marché | 10 | 10 | 0 | Réserves de M8 : DT-014 ; `CRON_SECRET` à vérifier sur Vercel |
| Conformité au RGPD | 10 | 8 | 2 : R4 et R10 en risque accepté | R8 et R9 remboursées (DT-008, DT-009) ; plan de l'hébergeur, accord de traitement et durée des journaux à vérifier. Non rejouée pour les Notifications : leur traitement T8 est au registre, et vérifié par la revue de sécurité du module |
| Sécurité des Notifications | 12 | 11 | 1 : N11 en risque accepté | DT-015 et DT-016 (N11), DT-017 (N3, défaut de la plateforme) ; trois parcours à vérifier sur le déploiement |
| Sécurité des Avatars | 11 | 10 | 1 : A11 en risque accepté | DT-017 (A3, défaut de la plateforme) ; A11 : origine et licence des images à documenter ; trois parcours à vérifier sur le déploiement |

Toute action qui appelle une modification du code figure au registre de la dette. Les actions qui
demandent une vérification sur le déploiement réel, S6, `CRON_SECRET` et l'offre de l'hébergeur, n'y
figurent pas, puisqu'elles ne sont pas des raccourcis : elles restent à faire avant de s'en remettre
aux revues.

## 6. Risques et recommandations

| N° | Risque | Signe avant-coureur | Recommandation |
| --- | --- | --- | --- |
| 1 | La charge des flux temps réel croît avec le nombre de joueurs connectés : chaque flux relit le journal deux fois par seconde (ADR 0003), et la base de production n'ouvre que cinq connexions par instance. Le canal global des notifications y ajoute une relecture du fil, la lecture la plus lente du jeu (552 ms au p99), par joueur connecté et par événement notifiable (DT-015, DT-016). La liste des présents de la Taverne est relue toutes les cinq secondes par chaque visiteur, soit douze requêtes par minute au lieu de deux | La latence des lectures du test de charge augmente, ou la base refuse des connexions, dès que des flux sont ouverts | Étendre le test de charge à des flux ouverts avant d'accueillir plus de joueurs ; réduire à une requête le contrôle de fraîcheur des projections ; donner à la source d'un canal son nom, pour ouvrir un canal par joueur ; étudier un intervalle de lecture adaptatif ou la notification de la base |
| 2 | La croissance du journal allonge la reconstruction des projections (ADR 0006) et l'effacement d'un compte (ADR 0008), qui le parcourent entièrement, pendant une requête | Une reconstruction ou un effacement approche la durée maximale d'une fonction Vercel | Mesurer ces deux durées sur un journal de taille croissante ; reconstruire hors requête, et rechercher les événements d'un joueur par un index |
| 3 | L'interface, qui représente 480 lignes sans aucun test, peut régresser sans que `pnpm verify` le détecte, alors que le temps réel en dépend | Un défaut de l'interface découvert par un joueur, ou lors d'une vérification à la main | Écrire un test de bout en bout, exécuté séparément de `pnpm verify` en raison de sa durée, qui couvre la connexion, un échange du Marché et la réception en temps réel, dont celle d'une notification |
| 4 | Le module Notifications dépend de la forme des événements du Marché et du Donjon, qui n'ont pas de contrat versionné : la fonction d'aptitude ne contrôle que les noms des types, non leurs champs (`sellerId`, `reason`, `hostId`, `playerId`, `result`) | Un champ renommé dans le Marché ou le Donjon, sans que les tests de la projection, qui construisent eux-mêmes ces événements, échouent | Étendre la fonction d'aptitude aux champs lus, ou publier ces événements dans un contrat versionné que les deux côtés valident |

## 7. Conclusion

Le projet peut être repris et peut évoluer sans régression pour tout ce qui relève du serveur : les
frontières des modules sont vérifiées à chaque construction, les règles du jeu sont testées sans
infrastructure, les décisions sont consignées avec leurs conséquences, et l'extraction du Village a
démontré que le monolithe tient sa promesse de modularité. L'ajout du module Notifications l'a
confirmé : aucun module existant n'a été modifié, ni la configuration de dependency-cruiser. Les seuls
fichiers existants touchés sont la racine de composition, la navigation, le thème, la feuille de style,
le journal des migrations, le test de charge et le test des fonctions d'aptitude, que l'on a complété
sans retirer ni affaiblir aucun test. Le module Avatars, ajouté après le rendu, l'a confirmé à son tour : la Taverne n'a changé que par
l'exposition de son état à ses enfants, sans modifier ses tables, ses routes ni ses règles. Trois conditions sont à remplir. Il faut d'abord confirmer sur
le déploiement réel les points que les revues n'ont pu vérifier : la configuration de la tâche
planifiée, le cookie de session et l'offre de l'hébergeur. Il faut ensuite mesurer la charge des
flux temps réel et la durée des opérations qui parcourent le journal, seuls risques que le projet
n'a pas quantifiés. Il faut enfin doter l'interface d'un test automatique, faute de quoi ce que voit
le joueur reste sans filet. Le service Village, lui, ne doit pas être déployé avant le remboursement
de ses trois dettes, ni le projet hors de Vercel avant celui de DT-013. L'accueil de plus de joueurs
demande en outre de rembourser DT-015 et DT-016, qui se règlent ensemble, et le déploiement public,
DT-017.

## Usage de l'IA générative

Un assistant de programmation fondé sur l'IA générative a contribué à la rédaction de ce bilan, à
partir du dépôt, des mesures du TD11 et de l'évaluation, et des documents de pilotage. Chaque chiffre
a été relevé sur l'état final du projet : `pnpm test:coverage` (couverture par ensemble de fichiers,
tirée du rapport JSON), `perf/apres.json` et `perf/notifications.json`, la taille des modules, le
nombre de commits, et le décompte des statuts de chaque revue. L'appréciation, et le choix des
quatre risques, doivent être relus et validés par l'auteur du projet.
