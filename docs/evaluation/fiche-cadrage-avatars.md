# Fiche de cadrage : Avatars

- Auteur : Elie Lajoinie
- Date : 2026-10-28
- Nom technique du module : `avatars`
- Validée par l'enseignant le :
- Nature : fonctionnalité complémentaire, postérieure à l'étiquette `eval-fin`, qui s'ajoute au module Notifications de la [première fiche](fiche-cadrage.md). Cette fiche a été rédigée après la réalisation.

## L'idée

Dans la Taverne, chaque joueur présent est représenté, au bas de la page, par un personnage qu'il choisit
parmi trois : un nain, un elfe et un chevalier. Les personnages se promènent au hasard : ils marchent, avec
leur image animée, puis se reposent, avec leur image immobile. Le pseudo du joueur est écrit au-dessus de sa
tête, et lorsqu'il écrit dans le salon, une bulle reprend son message pendant quelques secondes.

Les positions ne sont pas synchronisées : chaque navigateur anime ses propres personnages, et deux joueurs ne
voient pas un personnage au même endroit.

## Les règles métier

1. Le catalogue compte trois personnages, `dwarf`, `elf` et `knight` : aucun autre nom n'est accepté.
2. Un joueur qui n'a rien choisi a un personnage attribué par une fonction de son identifiant, toujours le même.
3. Le personnage d'un joueur est celui qu'il a choisi, ou celui qui lui est attribué si son choix a disparu du
   catalogue.
4. Une bulle affiche le message du joueur sur une seule ligne, de soixante caractères au plus, points de
   suspension compris, sans couper un symbole en deux.
5. Une bulle est visible six secondes après la réception du message, mesurées sur l'horloge du navigateur ; seule
   la dernière bulle d'un joueur est affichée, et celles des autres joueurs ne le concernent pas.
6. Un personnage reste dans la scène, à distance du bord pour qu'une bulle ne déborde pas, et rebrousse chemin
   lorsque sa marche l'en ferait sortir.
7. Un personnage marche à vitesse constante, en regardant du côté où il va, et se repose entre une seconde et demie
   et six secondes avant de repartir.
8. Un joueur ne choisit que son propre personnage, et on ne peut demander le personnage que de cinquante joueurs à
   la fois.

## Les commandes et les lectures

| Action du joueur | Commande ou lecture | Route |
| --- | --- | --- |
| Connaître son personnage | Lecture : le choix du joueur, ou le personnage attribué, et s'il l'a choisi | `GET /api/avatars/me` |
| Choisir son personnage | Commande : enregistre le choix du joueur de la session | `PUT /api/avatars/me` |
| Voir les personnages des joueurs présents | Lecture : le personnage de cinquante joueurs au plus | `POST /api/avatars/lookup` |

La scène est placée dans la page de la Taverne, accessible depuis la navigation du jeu. Toutes les routes sont
réservées aux joueurs connectés, et aucune n'accepte l'identifiant du joueur qui écrit.

## Le stockage envisagé

Une table classique, `avatars.skins`, dans le schéma `avatars` créé par la migration `0015_avatars` : une ligne par
joueur qui a choisi, avec le personnage et la date du choix. Le choix d'un joueur n'a pas d'historique de jeu, et
doit survivre à la déconnexion : le journal d'événements n'apporterait rien (ADR 0012).

## La communication avec les modules existants

Le module communique avec la Taverne par son interface. L'écran de la Taverne expose les joueurs présents, les
messages et l'instant d'arrivée des messages en direct par un contexte, et accepte des composants enfants ; la
page de la Taverne y place la scène. La Taverne n'importe rien des Avatars. La Taverne n'enregistrant aucun
événement et n'envoyant aucun message, ni la boîte d'envoi ni la lecture du journal ne sont utilisées : c'est
l'écart avec l'exigence E6, consigné dans le document de rendu.

## Les données personnelles

Le module conserve l'identifiant du joueur, son personnage et la date de son choix, jusqu'à la suppression de son
compte. Le contributeur `personal-data.ts` les exporte et les supprime. Le traitement est ajouté au registre des
traitements (T9).

## Les bonus visés

Aucun : le module est une fonctionnalité complémentaire. Il comporte néanmoins une fonction d'aptitude, qui vérifie
que chaque personnage du catalogue a ses deux images.
