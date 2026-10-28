# Revue de sécurité des Avatars : contrôle d'accès, validation et affichage

- Date : 2026-10-28
- Périmètre : API du module Avatars (`GET` et `PUT /api/avatars/me`, `POST /api/avatars/lookup`), scène des personnages de la Taverne (interface), contributeur de données personnelles, fichiers statiques de `public/`.
- Références : OWASP Top 10 (A01 Broken Access Control, A03 Injection, A04 Insecure Design), RGPD (article 5, minimisation).
- Méthode : tests Vitest (288 réussis), lecture du code, puis vérifications sur un serveur local de développement, avec des comptes jetables et une base jetable supprimée ensuite : requêtes anonymes, corps malformés, tentative d'écrire pour un autre joueur, demandes de personnages hors limites, message contenant des balises HTML affiché par la scène, export et suppression d'un compte suivie d'un examen de la base, requêtes émises par la page pendant plus d'une minute. Le déploiement sur Vercel n'a pas été vérifié.

| N° | Exigence | Vérification | Constat | Statut |
| --- | --- | --- | --- | --- |
| A1 | Toutes les routes du module sont réservées aux joueurs connectés | Test « refuse une requête anonyme (401) » ; trois requêtes anonymes sur le serveur local | Dans `create-api.ts`, `/avatars/*` passe par `requireUser`, avant le montage de l'API. Observé : `GET /api/avatars/me`, `PUT /api/avatars/me` et `POST /api/avatars/lookup` sans session reçoivent tous 401. | conforme |
| A2 | Un joueur ne choisit que son propre personnage : aucune route n'accepte l'identifiant du joueur qui écrit | Test « ne choisit qu'au nom du joueur connecté, quel que soit le corps envoyé » ; manipulation sur le serveur local | Les routes tirent le joueur de `c.var.userId` ; la seule donnée du client est le nom du personnage. Observé : Frank envoie `skin: "elf"` avec, en plus, le champ `playerId` contenant l'identifiant d'Erin : la réponse est `elf` pour Frank, et Erin conserve le personnage qui lui est attribué (`dwarf`, non choisi). Le champ en trop est ignoré par le schéma. | conforme |
| A3 | Le personnage envoyé est validé contre le catalogue avant d'atteindre le service | Test « refuse un personnage hors du catalogue, ou un corps invalide (400) » ; sept corps sur le serveur local | `ChooseSkinInput` n'accepte que les trois noms du catalogue (`z.enum`). Le test (cinq corps) et le serveur local (six corps) donnent 400 pour un nom inconnu, un corps vide, un nombre, `null`, un tableau et, sur le serveur seulement, une chaîne vide, sans modifier le personnage de Frank. Réserve : un JSON syntaxiquement invalide est refusé avant le service, mais la réponse est 500 et non 400 (observé) : le gestionnaire d'erreurs global traite l'exception du validateur comme une erreur interne (DT-017, défaut de la plateforme). | conforme |
| A4 | La demande de personnages est bornée, et ne renvoie que les joueurs demandés | Tests « refuse une demande vide, ou de plus de cinquante joueurs (400) » et « présente le personnage des seuls joueurs demandés, choisi ou attribué » ; six demandes sur le serveur local | `LookupInput` exige de 1 à 50 identifiants de 1 à 100 caractères. Observé : une liste vide, 51 identifiants, un identifiant vide et un identifiant de 101 caractères reçoivent 400 ; 50 identifiants reçoivent 200. Une demande de quatre identifiants, dont un doublon et un inconnu, renvoie exactement trois clés, celles des identifiants demandés. Aucune route ne liste les joueurs qui ont choisi. | conforme |
| A5 | L'API ne révèle pas si un joueur a choisi son personnage, ni ne permet de les énumérer | Test « présente le personnage des seuls joueurs demandés, choisi ou attribué » ; comparaison des réponses sur le serveur local | `lookup` renvoie le même type de valeur, un nom du catalogue, pour un joueur qui a choisi, un joueur qui n'a rien choisi et un identifiant inconnu : le personnage attribué est tiré de l'identifiant. Le champ `chosen` n'est renvoyé que par `GET /api/avatars/me`, au joueur lui-même. Les identifiants des joueurs sont aléatoires : demander un identifiant n'apprend rien. | conforme |
| A6 | Le texte d'un pseudo ou d'une bulle n'est jamais interprété comme du HTML | Message contenant des balises, publié par un joueur et affiché par la scène d'un autre | Observé : le message `<img src=x onerror=alert(1)> <b>gras</b>` est affiché dans la bulle sous forme de texte (le code HTML de la bulle contient `&lt;img ...&gt;`), sans aucun élément `img` ni `b` dans la bulle ni dans le salon. Le pseudo et le texte sont rendus par React comme des nœuds de texte, jamais par `dangerouslySetInnerHTML`. Aucun test automatique ne couvre l'interface. | conforme |
| A7 | Aucune requête SQL n'est construite par concaténation | ``git grep -n "sql`" src/modules/avatars`` ; lecture de `drizzle-skin-store.ts` | Aucune expression SQL brute : le module n'emploie que le constructeur de requêtes de Drizzle (`inArray`, insertion avec résolution de conflit), qui lie toutes les valeurs. | conforme |
| A8 | L'export et l'effacement d'un compte couvrent le choix du joueur, et lui seul | Test « exporte le personnage choisi par le joueur, puis l'efface avec son compte » ; export et suppression d'un compte sur le serveur local, puis examen de la base | Le contributeur exporte le personnage et la date du choix, et supprime la ligne du joueur. Le test vérifie que l'export ne contient pas le personnage d'un autre joueur, que la suppression retire la ligne du joueur et laisse celle des autres ; il a été vu échouer lorsque l'effacement est omis. Observé : l'export de Frank est `{"skins":[{"skin":"elf","chosenAt":…}]}`, sans identifiant d'Erin ; après la suppression de son compte, la base compte 5 comptes et 3 personnages, aucune ligne orpheline. | conforme |
| A9 | Le module ne transmet ni ne conserve aucune position ni activité, et ne crée aucune charge continue | Lecture du code ; requêtes de la page pendant 48 secondes ; examen de la table | Les positions, les marches et les bulles n'existent que dans le navigateur qui les affiche. La table `avatars.skins` n'a que trois colonnes (`player_id`, `skin`, `chosen_at`) et le schéma une seule table. Le module n'ouvre aucun canal temps réel, aucun signal de présence et aucune tâche quotidienne (`git grep` de `channelPolicy`, `dailyTask` et `setInterval` : aucune occurrence). Observé : la page n'envoie à `/api/avatars` qu'une requête `lookup` à chaque mise à jour des présents, soit une toutes les trente secondes (deux à l'ouverture en développement, à cause du mode strict de React), et une requête `PUT` par choix de personnage. | conforme |
| A10 | Les fichiers statiques ne contiennent aucune donnée personnelle, et la licence de la police est jointe | Requêtes sans session ; lecture de `public/fonts/OFL.txt` ; fonction d'aptitude des images | Les images et la police sont servies sans session (200) : ce sont des ressources publiques par nature, sans donnée de joueur. La licence SIL Open Font de la police 8-bit Operator Plus est jointe (`public/fonts/OFL.txt`), et la police n'a pas été modifiée. La fonction d'aptitude « fournit les deux images de chaque personnage du catalogue » a été vue échouer en retirant un GIF. | conforme |
| A11 | Les images des personnages sont réutilisées avec le droit de les diffuser | Recherche de leur origine et de leur licence dans le dépôt et dans la demande | Les trois personnages ont été fournis par l'auteur du projet, sans mention de leur origine ni de leur licence. Les GIF ont de plus été nettoyés et recadrés. L'origine et la licence n'ont pas été vérifiées. | risque accepté |

## Synthèse

Sur onze exigences, dix sont conformes ; aucune n'est non conforme, et un risque est accepté (A11). Par
ailleurs, une requête anonyme sur les routes du module reçoit un code 401 (A1), comme l'exige S10 de la
revue de l'authentification.

Limites relevées, qui ne relèvent d'aucune autre exigence de la grille :

- DT-017 : un corps JSON mal formé produit une erreur 500 au lieu de 400, comme sur toutes les routes qui
  valident un corps (A3) ; le défaut est celui de la plateforme.
- DT-018 : les tailles d'affichage des images sont écrites à la main ; une erreur déformerait un
  personnage sans qu'aucun contrôle l'établisse.
- La scène n'a pas de test automatique : l'affichage non interprété du texte (A6) et la fréquence des
  requêtes (A9) ont été vérifiés à la main, et le seraient par le test de bout en bout du risque 3 du
  bilan technique.
- Un changement de personnage n'apparaît chez les autres joueurs qu'au plus trente secondes plus tard.
- Le personnage de chacun est public pour tout joueur connecté : c'est son objet, et il ne contient
  aucune donnée sensible.

Actions décidées :

- A11 : retrouver l'origine et la licence des trois images, les consigner dans un fichier joint à
  `public/avatars`, et les remplacer si elles ne permettent pas leur diffusion.
- A3 et DT-017 : renvoyer le statut des exceptions HTTP de classe 4xx dans le gestionnaire d'erreurs global.
- Vérifier sur le déploiement de production le choix d'un personnage, son maintien après rechargement et
  l'export d'un compte jetable.
