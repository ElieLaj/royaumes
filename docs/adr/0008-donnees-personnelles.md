# ADR-0008 - Un stockage classique pour la Taverne, et la réécriture ciblée des champs personnels du journal pour l'effacement

- Statut : proposé
- Date : 2026-10-21

## Contexte

La Taverne offre une messagerie commune et la liste des joueurs présents. Ses messages et sa présence
sont des données personnelles destinées à disparaître : un message est supprimé trente jours après sa
publication, et la présence d'un joueur n'est conservée que le temps de sa visite. Le jeu doit par
ailleurs permettre à un joueur d'obtenir ses données et d'en demander l'effacement. Ces droits portent
sur le jeu entier : l'identité, la Taverne, mais aussi les trois modules fondés sur le journal
d'événements et les modèles de lecture qui en sont tirés.

Le nom des joueurs a été copié dans les événements du Donjon (`GameCreated`, `PlayerJoined`) et du
Marché (`OfferPublished`, `OfferAccepted`), et le nom du village dans l'événement `VillageFounded`,
afin que chaque module affiche ces noms sans interroger l'identité. Ces événements appartiennent à
des flux parfois partagés avec d'autres joueurs : l'expédition qu'un joueur a ouverte avec un autre,
l'offre qu'un autre a acceptée. Les mêmes noms figurent dans les tables du Classement, des
expéditions ouvertes et des offres. Les sessions conservent en outre l'adresse IP et le navigateur de
chaque connexion, que la bibliothèque d'authentification enregistre par défaut.

Le journal est en ajout seul : aucun événement n'est modifié ni supprimé (ADR 0002), et les
projections se reconstruisent en le rejouant (ADR 0006). L'hébergement ne permet ni connexion
permanente ni tâche de fond : le serveur ne peut pas constater qu'un joueur est parti, et seule une
tâche planifiée quotidienne est disponible (ADR 0004).

## Décision

La Taverne n'utilise pas l'Event Sourcing. Ses messages et sa présence sont conservés dans des tables
ordinaires de son propre schéma PostgreSQL, dont les lignes sont insérées puis supprimées. Son canal
temps réel lit une source fournie par le module, la table des messages, et non le journal.

La présence repose sur un signal envoyé par le navigateur toutes les trente secondes : une ligne par
joueur présent, supprimée à son départ ou deux minutes après son dernier signal, sans historique des
visites.

Les durées de conservation sont appliquées à la lecture, et chaque jour par la route des tâches
quotidiennes (`/api/cron/daily`), qui remplace la route de distribution de la boîte d'envoi et
exécute une liste de tâches fournie par la racine de composition.

Chaque module déclare ses données personnelles par un contributeur (`personal-data.ts`), comme il
déclare ses gestionnaires de messages : il exporte les données du joueur, désigne celles de ses
événements en les réécrivant, et efface celles de ses tables. La plateforme ne connaît aucun module.
L'identité fournit son propre contributeur, sans les secrets (empreinte du mot de passe, jetons de
session).

L'effacement d'un compte réécrit, par une fonction unique de la plateforme, les seuls champs de nom
des événements du joueur, remplacés par une valeur neutre ; le type, la version, la position et les
autres données de chaque événement restent inchangés. Il est consigné dans un registre qui ne
contient que la date et le nombre d'événements réécrits, aucune donnée sur le joueur. L'identité est
effacée en dernier, et chaque étape est idempotente : un effacement interrompu peut être relancé.

L'identifiant du joueur reste dans le journal, où il figure dans les noms de flux. Une fois le compte
supprimé, plus aucune table ne le relie à une personne : ces données sont pseudonymisées, et non
anonymisées.

## Conséquences

### Positives

- Le joueur exerce lui-même ses droits d'accès, de portabilité et d'effacement, depuis la page « Mes
  données » : aucune intervention du responsable du projet n'est nécessaire.
- L'effacement n'altère ni les états reconstruits ni l'historique des autres joueurs : seuls des champs
  de nom sont remplacés, et une projection reconstruite à partir du journal réécrit donne le même
  résultat que les tables corrigées directement.
- La durée de conservation est garantie même sans activité : la tâche quotidienne supprime les messages
  périmés, que la Taverne soit visitée ou non.
- La Taverne est plus simple que si elle avait suivi le modèle des autres modules : elle n'a ni
  événements, ni versions, ni projections, et sa limitation de messages compte des lignes.
- Ajouter un module qui conserve des données personnelles ne modifie pas la plateforme : il déclare
  son contributeur, que la racine de composition confie au service des droits.

### Négatives

- Une exception à la règle de l'ajout seul : un événement enregistré peut être modifié. Toute
  modification future du journal devra respecter strictement les limites de cette exception.
- L'export et l'effacement parcourent le journal entier : leur coût croît avec sa taille.
- Chaque événement futur qui contient une donnée personnelle doit la déclarer dans le contributeur de
  son module, faute de quoi elle échappera à l'effacement.
- L'identifiant conservé dans le journal et dans la boîte d'envoi ne protège la personne que si tout
  lien avec elle a été détruit : les journaux techniques de l'hébergeur, qui associent des adresses
  contenant cet identifiant à une adresse IP, échappent au contrôle du projet.
- Les messages d'un autre joueur qui citent le nom d'un joueur effacé ne sont pas réécrits : c'est un
  texte libre, qui disparaît au bout de trente jours.
- La liste des présents n'est pas diffusée en temps réel : chaque navigateur la relit. À l'origine, il ne
  la recevait qu'avec son propre signal de présence, et une arrivée ou un départ n'apparaissait chez les
  autres joueurs qu'au plus tard trente secondes plus tard ; depuis les personnages de la Taverne
  (ADR 0012), il la relit toutes les cinq secondes.

## Alternatives écartées

- **Event Sourcing pour la Taverne** : l'historique des messages n'a aucune valeur, aucun autre module
  ne lit les événements de la Taverne, et ses données doivent disparaître, ce que le journal en ajout
  seul interdit par principe ; l'utiliser obligerait à lutter en permanence contre lui.
- **Suppression des flux du joueur** : elle est impossible pour les flux partagés, et priverait les
  autres joueurs de leur propre historique, comme l'expédition ouverte avec eux ou l'offre qu'ils ont
  acceptée.
- **Effacement cryptographique** : chiffrer chaque donnée personnelle avec une clé propre au joueur
  demanderait du chiffrement dans chaque module et chaque projection, et ne s'applique pas aux
  événements déjà enregistrés en clair.
- **Références sans copie** : n'enregistrer dans les événements que l'identifiant du joueur est la
  meilleure conception pour l'avenir, mais elle ne règle pas le cas des événements déjà enregistrés,
  qui contiennent les noms en clair. Elle reste la piste privilégiée pour les nouveaux événements.
- **Service externe de présence**, comme une base clé-valeur en mémoire : il ajouterait une dépendance,
  un sous-traitant et une configuration, alors que le besoin tient en une table de trois colonnes.

## Réexamen

Cette décision devra être réexaminée lors de la conception d'un nouveau module, pour lequel les
références sans copie devraient être préférées dès l'origine ; si la taille du journal rend l'effacement
trop long pour une requête ; ou en cas d'évolution de la doctrine sur l'anonymisation des
identifiants pseudonymes.

## Usage de l'IA générative

Un assistant de programmation fondé sur l'IA générative a contribué à la rédaction de cet ADR et au
code du TD10 qu'il décrit (module Taverne, route des tâches quotidiennes, droits des joueurs et
contributeurs de chaque module), à partir du support du TD et du dépôt. Les affirmations sur le code
ont été vérifiées en exécutant `pnpm verify`, dont les tests de la messagerie, de la présence, de la
conservation, de l'export et de l'effacement, et en rejouant sur un serveur local avec deux joueurs le
parcours complet : messages, limitation, présence, export, puis suppression d'un compte. Le contenu
doit être relu et validé par l'auteur du projet, qui passe alors le statut à « accepté ».
