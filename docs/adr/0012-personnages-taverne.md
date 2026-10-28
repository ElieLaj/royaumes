# ADR-0012 - Un module Avatars pour les personnages de la Taverne : choix conservé en base, déplacements locaux, composition par l'écran de la Taverne

- Statut : proposé
- Date : 2026-10-28

## Contexte

La Taverne présente les joueurs présents par une liste de noms. Le projet veut les représenter par des
personnages, au bas de la page : chacun choisit son apparence parmi trois, ses pas sont animés, son
pseudo s'affiche au-dessus de sa tête, et une bulle reprend ce qu'il écrit dans le salon.

Les besoins n'ont pas la même nature. Le personnage choisi doit être vu par les autres joueurs, et
retrouvé à la visite suivante : c'est une donnée du joueur, qui doit survivre à la déconnexion. La
position d'un personnage, en revanche, n'a aucune valeur de jeu : il n'est pas nécessaire que deux
navigateurs voient le même personnage au même endroit. Une bulle n'a de sens que le temps de la
lire.

La Taverne tient déjà les données utiles. L'écran connaît la liste des joueurs présents, relue à chaque
signal de présence, toutes les trente secondes ; il reçoit les messages en direct par le canal `tavern`
(ADR 0003) et par l'historique. La présence n'est conservée que deux minutes, et les messages trente
jours (ADR 0008) : aucune de ces durées ne convient à un choix d'apparence. Les modules ne s'atteignent
que par leurs entrées publiques, et la plateforme ignore les modules.

Le serveur n'a ni connexion permanente ni tâche de fond (ADR 0004). Chaque flux temps réel relit la base
deux fois par seconde (ADR 0003), si bien que tout nouveau flux a un coût par joueur connecté.

## Décision

Les personnages forment un module à part, `avatars`, qui n'utilise pas l'Event Sourcing et n'enregistre
aucun événement. Il conserve le choix de chaque joueur dans une table ordinaire de son propre schéma
PostgreSQL, `avatars.skins` (migration `0015_avatars`) : une ligne par joueur qui a choisi, avec le nom
du personnage et la date du choix. Un joueur qui n'a rien choisi n'a pas de ligne : son personnage
lui est attribué par une fonction pure du domaine, qui le tire de son identifiant, et reste le même d'une
visite à l'autre.

Trois routes, réservées aux joueurs connectés, dont aucune n'accepte l'identifiant du joueur qui écrit :
`GET /api/avatars/me`, `PUT /api/avatars/me` (le choix, validé contre le catalogue de trois personnages)
et `POST /api/avatars/lookup` (le personnage de cinquante joueurs au plus, sans distinguer ceux qui ont
choisi). Le module déclare son contributeur de données personnelles : l'export contient le choix du
joueur, et l'effacement le supprime avec le compte.

Les déplacements, les images et les bulles ne passent par aucun serveur. Le domaine fournit des fonctions
pures, testées sans navigateur : la prochaine marche d'un personnage, dans la scène, à vitesse constante,
après une pause tirée au hasard, le hasard étant fourni par l'appelant ; le résumé d'un message et sa
durée d'affichage, de six secondes, mesurée sur l'horloge du navigateur qui le reçoit, et non sur celle du
serveur. Le navigateur utilise le GIF de marche pendant une marche, et l'image de repos entre deux
marches. Les animations sont suspendues si le système demande de réduire les mouvements.

Le module ne lit pas la Taverne lui-même. L'écran de la Taverne expose son état (joueurs présents,
messages, instant d'arrivée des messages en direct) par un contexte, et accepte des composants enfants
sous le salon ; la page de la Taverne y place la scène des Avatars. La Taverne ne connaît pas les Avatars,
et les Avatars n'ouvrent ni canal temps réel, ni signal de présence, ni tâche quotidienne : le personnage
des présents est demandé au serveur à chaque mise à jour de leur liste, soit une requête toutes les trente
secondes par visiteur.

Les images (PNG au repos, GIF de marche) et la police 8-bit Operator Plus, sous licence SIL Open Font,
sont des fichiers statiques de `public/`. Une fonction d'aptitude vérifie que chaque personnage du
catalogue a ses deux images.

## Conséquences

### Positives

- Le choix d'un joueur est conservé, vu des autres, et supprimé avec son compte, sans réécriture du
  journal.
- Le coût réseau est négligeable : une requête toutes les trente secondes par visiteur de la Taverne, et
  aucune pour les positions, qui ne sont partagées avec personne.
- Les règles de déplacement et de bulle sont testées sans navigateur, avec un hasard reproductible, et
  la bulle ne dépend pas du décalage entre l'horloge du navigateur et celle du serveur.
- Aucun module existant n'a de dépendance nouvelle : la Taverne n'importe rien des Avatars, qui ne
  modifient aucune de ses tables, et la plateforme est inchangée.
- Ajouter un personnage demande une entrée au catalogue et deux images : le test des images échoue si
  l'une manque.

### Négatives

- Un changement de personnage n'apparaît chez les autres joueurs qu'à leur prochain signal de présence,
  au plus trente secondes plus tard ; seul le joueur le voit aussitôt.
- La communication avec la Taverne passe par l'interface de celle-ci, et non par des messages de la boîte
  d'envoi ni par la lecture d'un journal : la Taverne n'enregistre aucun événement. Les Avatars dépendent du
  contexte `useTavernState` de la Taverne, entrée publique de son interface, et d'elle seule.
- La scène, comme toute l'interface, n'a pas de test automatique : seules ses règles, extraites dans le
  domaine, sont testées. Les tailles d'affichage des images sont mesurées à la main (DT-018).
- Chaque mise à jour de l'écran de la Taverne (message reçu, liste des présents) refait le rendu de la
  scène, puisque le contexte change.
- Un nouveau personnage ajouté au catalogue sera attribué par défaut à des joueurs qui ont déjà un
  personnage par défaut : leur personnage change. Le choix explicite d'un joueur n'est pas touché.
- Au plus cinquante personnages sont présentés ; au-delà, les joueurs supplémentaires ne sont pas
  représentés, mais restent dans la liste des présents.

## Alternatives écartées

- **Étendre le module Taverne** : le choix d'apparence serait rangé dans la table de présence, qui est
  supprimée deux minutes après le dernier signal, ou dans une table à part de la Taverne, qui aurait à
  connaître des personnages qu'aucune de ses règles n'utilise.
- **Conserver le choix dans le navigateur** (stockage local) : les autres joueurs ne le verraient pas, et le
  joueur le perdrait en changeant d'appareil.
- **Ajouter le personnage à la table des comptes** : elle appartient à l'authentification, dont le schéma
  ne peut être modifié par un module.
- **Synchroniser les positions** par un canal temps réel : chaque canal relit la base deux fois par seconde
  pour chaque joueur connecté (ADR 0003), pour un résultat que personne n'exige, et qui ne servirait qu'à
  voir un même personnage au même endroit.
- **Une connexion et un signal de présence propres aux Avatars** : ils doubleraient la relecture de la
  Taverne, et pourraient diverger de la liste qu'elle affiche.
- **Passer une fonction de rendu à l'écran de la Taverne** : la page est un composant serveur, qui ne peut
  pas transmettre de fonction à un composant client. Les composants enfants et un contexte atteignent le
  même but.
- **Horodater les bulles avec l'heure du serveur** : une horloge de navigateur en avance de plus de six
  secondes ne les afficherait jamais.

## Réexamen

Cette décision devra être réexaminée si les positions doivent être partagées, si le catalogue s'étoffe de
personnalisations (accessoires, couleurs) qui ne tiennent plus dans un simple nom, si la Taverne se met à
publier des événements que les Avatars pourraient lire, ou si le nombre de joueurs présents dépasse la
cinquantaine.

## Usage de l'IA générative

Un assistant de programmation fondé sur l'IA générative a contribué à la rédaction de cet ADR et au
code qu'il décrit (module Avatars, scène, contexte de la Taverne, préparation des images), à partir de la
demande de l'auteur et du dépôt. Les affirmations sur le code ont été vérifiées en exécutant `pnpm verify`,
dont les tests du domaine, de l'API et de la fonction d'aptitude, puis en observant dans un navigateur, avec
plusieurs joueurs, les déplacements, les images de marche et de repos, les bulles, le choix d'un personnage et
son maintien après rechargement, sur écran large et sur écran de téléphone. Le contenu doit être relu et
validé par l'auteur du projet, qui passe alors le statut à « accepté ».
