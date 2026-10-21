# Bilan technique de Royaumes

- Date : 2026-10-21
- Version examinée : étiquette `td11-fin`
- Auteur : Elie Lajoinie

Ce bilan dresse l'état technique du projet au terme de son développement, à partir de ses
décisions d'architecture, de ses indicateurs de qualité, de sa dette technique et de ses
revues. Il s'adresse à la personne qui reprendrait le projet. Chaque chiffre renvoie à la commande
ou au document qui le produit.

## 1. Le système livré

| Élément | Valeur |
| --- | --- |
| Modules métier | 6 : `realm`, `dungeon`, `market`, `ranking`, `tavern`, `system` |
| Briques de la plateforme | 9 : `auth`, `cron`, `db`, `event-store`, `http`, `outbox`, `privacy`, `projection`, `realtime` |
| Service extrait | 1 : `src/services/village`, non déployé (ADR 0009) |
| Lignes de code, hors tests | 7 888 (`src` et `app`) |
| Fichiers de test, nombre de tests | 33 fichiers, 232 tests |
| Commits | 82 |
| Hébergement | Vercel (Francfort), base Neon (Francfort) |

| Module | Stockage | Lignes, hors tests |
| --- | --- | --- |
| `realm` | Event Sourcing ; version distante pour le service extrait (153 lignes) | 1 032 |
| `dungeon` | Event Sourcing, projection des expéditions ouvertes | 1 939 |
| `market` | Event Sourcing, projection des offres, saga | 1 205 |
| `ranking` | Projection du journal | 445 |
| `tavern` | Tables ordinaires | 664 |
| `system` | Aucun | 73 |

Le service Village compte 76 lignes, et la plateforme 1 546. Ces chiffres s'obtiennent par la boucle
de la sous-partie 2.1 du TD11, étendue à `src/services/`, et par `git ls-files src app`.

## 2. Les décisions d'architecture

Le registre `docs/adr/README.md` compte neuf ADR. L'ADR 0001 est accepté ; les huit autres sont
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
| 0008 | Taverne sans Event Sourcing, réécriture ciblée du journal | Revue de conformité (TD10) | A tenu, avec des réserves : six exigences sur dix sont conformes, et les écarts sont consignés (DT-008, DT-009). |
| 0009 | Extraction du Village, préparée mais non déployée | Six tests de contrat, démonstration à deux processus | A tenu. Reste à rembourser trois dettes avant tout déploiement (DT-010 à DT-012). |

## 3. La qualité

| Caractéristique | Indicateur | Valeur | Appréciation |
| --- | --- | --- | --- |
| Adéquation fonctionnelle | Tests réussis ; couverture des domaines | 232 tests ; 99,7 % des lignes des domaines (`pnpm test:coverage`) | Satisfaisante : les règles du jeu sont testées sans base ni serveur. |
| Efficacité des performances | Débit et p99 des lectures ; respect du budget | `perf/apres.json` : de 68 à 106 requêtes par seconde, p99 de 356 à 488 ms, sans erreur | Acceptable en local, avec peu de marge (488 ms pour le Classement, budget de 500 ms) ; la première série de mesures dépassait le budget de 28 ms pour le Marché. Rien n'est mesuré en production, ni pour les flux temps réel. |
| Fiabilité | Tests de concurrence, de reprise et d'idempotence ; messages abandonnés | Conflits de version, bail et doublons de la boîte d'envoi, reprise de la saga après une panne : tests réussis ; `scripts/dead-letters.ts` : aucun message abandonné en développement | Bonne : chaque mécanisme a son test, et les échecs durables sont désormais signalés et relançables. |
| Sécurité | Exigences des revues de sécurité et de conformité | 50 exigences : 40 conformes, 3 non conformes, 7 en risque accepté | Moyenne : les contrôles d'accès sont éprouvés, mais trois écarts restent ouverts (section 5). |
| Maintenabilité | Règles d'architecture ; fonctions d'aptitude ; couverture | 8 règles de dependency-cruiser, 2 fonctions d'aptitude, aucune violation ; 75,0 % des lignes couvertes | Bonne pour le code serveur (modules 93,6 %, plateforme 92,4 %), mais l'interface (320 lignes, 13 fichiers à 0 %) n'est vérifiée par aucun test automatique : une régression du temps réel ne serait détectée que par un essai à la main. |
| Flexibilité | Extraction d'un module ; changement de base entre local et production | Village extrait, avec retour arrière sans migration ; PGlite et Neon derrière le même type `Db`, mêmes migrations | Bonne : l'extraction est démontrée, non déployée. |

## 4. La dette technique

| Indicateur | Valeur |
| --- | --- |
| Entrées consignées | 14 (DT-001 à DT-014) |
| Entrées remboursées, dont à l'échéance prévue | 7, dont 7 à l'échéance prévue |
| Entrées ouvertes | 7 : DT-008 et DT-009 (revue de conformité), DT-010 à DT-012 (service extrait), DT-013 et DT-014 (revues de sécurité) |

Analyse : les sept premières entrées ont été consignées au moment où le raccourci a été pris, et
remboursées au TD annoncé, y compris au TD11 pour la limitation des tentatives et les messages
abandonnés : c'est le signe d'un pilotage. Les sept entrées ouvertes se répartissent en trois
familles. Les trois dettes de l'extraction attendent un événement, le déploiement du service, qui
n'est pas prévu. Les deux dernières, DT-013 et DT-014, ont été consignées en dressant ce bilan : elles
étaient des actions décidées par des revues, mais ne figuraient pas au registre, et auraient été
oubliées. Enfin, DT-008 et DT-009, issues de la revue de conformité, avaient pour échéance le TD11
et n'ont pas été remboursées : c'est le seul écart entre l'échéance annoncée et la réalité. Elles
touchent des données personnelles (sessions expirées conservées, erreurs journalisées avec leurs
paramètres) et sont les premières à traiter.

## 5. Les revues

| Revue | Exigences | Conformes | Non conformes ou en risque accepté | Actions ouvertes |
| --- | --- | --- | --- | --- |
| Sécurité de l'authentification | 16 | 12 | 4 : S7 non conforme ; S3, S6, S9 en risque accepté | S7 : DT-013 ; S6 : à confirmer sur le déploiement réel ; S3 : DT-004 remboursée, reste l'option `AUTH_RATE_LIMIT=off` |
| Sécurité du Donjon | 14 | 12 | 2 : D7 et D14 en risque accepté | Aucune : réexamen si le jeu conserve des informations plus sensibles |
| Sécurité du Marché | 10 | 10 | 0 | Réserves de M8 : DT-014 ; `CRON_SECRET` à vérifier sur Vercel |
| Conformité au RGPD | 10 | 6 | 4 : R8 et R9 non conformes ; R4 et R10 en risque accepté | R8 : DT-008 ; R9 : DT-009 ; plan de l'hébergeur, accord de traitement et durée des journaux à vérifier |

Toute action qui appelle une modification du code figure au registre de la dette. Les actions qui
demandent une vérification sur le déploiement réel, S6, `CRON_SECRET` et l'offre de l'hébergeur, n'y
figurent pas, puisqu'elles ne sont pas des raccourcis : elles restent à faire avant de s'en remettre
aux revues.

## 6. Risques et recommandations

| N° | Risque | Signe avant-coureur | Recommandation |
| --- | --- | --- | --- |
| 1 | La charge des flux temps réel croît avec le nombre de joueurs connectés : chaque flux relit le journal deux fois par seconde (ADR 0003), et la base de production n'ouvre que cinq connexions par instance | La latence des lectures du test de charge augmente, ou la base refuse des connexions, dès que des flux sont ouverts | Étendre le test de charge à des flux ouverts avant d'accueillir plus de joueurs ; étudier un intervalle de lecture adaptatif ou la notification de la base |
| 2 | La croissance du journal allonge la reconstruction des projections (ADR 0006) et l'effacement d'un compte (ADR 0008), qui le parcourent entièrement, pendant une requête | Une reconstruction ou un effacement approche la durée maximale d'une fonction Vercel | Mesurer ces deux durées sur un journal de taille croissante ; reconstruire hors requête, et rechercher les événements d'un joueur par un index |
| 3 | L'interface, qui représente 320 lignes sans aucun test, peut régresser sans que `pnpm verify` le détecte, alors que le temps réel en dépend | Un défaut de l'interface découvert par un joueur, ou lors d'une vérification à la main | Écrire un test de bout en bout, exécuté séparément de `pnpm verify` en raison de sa durée, qui couvre la connexion, un échange du Marché et la réception en temps réel |

## 7. Conclusion

Le projet peut être repris et peut évoluer sans régression pour tout ce qui relève du serveur : les
frontières des modules sont vérifiées à chaque construction, les règles du jeu sont testées sans
infrastructure, les décisions sont consignées avec leurs conséquences, et l'extraction du Village a
démontré que le monolithe tient sa promesse de modularité. Trois conditions sont à remplir. Il faut
d'abord traiter les dettes qui touchent des données personnelles (DT-008 et DT-009) et confirmer sur
le déploiement réel les points que les revues n'ont pu vérifier. Il faut ensuite mesurer la charge des
flux temps réel et la durée des opérations qui parcourent le journal, seuls risques que le projet
n'a pas quantifiés. Il faut enfin doter l'interface d'un test automatique, faute de quoi ce que
voit le joueur reste sans filet. Le service Village, lui, ne doit pas être déployé avant le
remboursement de ses trois dettes.

## Usage de l'IA générative

Un assistant de programmation fondé sur l'IA générative a contribué à la rédaction de ce bilan, à
partir du dépôt, des mesures du TD11 et des documents de pilotage. Chaque chiffre a été relevé sur
l'état final du projet : `pnpm test:coverage`, `perf/apres.json`, la taille des modules, le nombre de
commits, et le décompte des statuts de chaque revue. L'appréciation, et le choix des trois risques,
doivent être relus et validés par l'auteur du projet.
