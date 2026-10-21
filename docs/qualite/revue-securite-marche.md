# Revue de sécurité du Marché : intégrité des échanges

- Date : 2026-10-21
- Périmètre : API du module Marché, gestionnaires de messages du Village et du Marché, boîte d'envoi et sa route de distribution, canal temps réel du Marché.
- Références : OWASP Top 10 (A01 Broken Access Control, A04 Insecure Design, A08 Software and Data Integrity Failures).
- Méthode : tests Vitest (194 réussis), lecture du code, puis vérifications sur un serveur local avec
  des comptes jetables et une base jetable supprimée ensuite : un échange complet entre deux joueurs
  par l'API, et un échange par l'interface dans le navigateur. Le déploiement sur Vercel n'a pas
  été vérifié.

| N° | Exigence | Vérification | Constat | Statut |
| --- | --- | --- | --- | --- |
| M1 | Un joueur ne publie, n'accepte et ne retire une offre qu'en son propre nom | Lecture de `api.ts` : aucune route n'accepte d'identifiant de joueur | Dans les cinq routes de `api.ts`, l'identifiant du joueur vient de `c.var.userId`, renseigné par l'intergiciel d'authentification, et son nom de `c.var.userName`. Les seules données fournies par le client sont l'identifiant de l'offre, dans l'adresse, et, pour une publication, les quantités, validées par `PublishOfferInput`, qui ne contient aucun identifiant de joueur. | conforme |
| M2 | Seul le vendeur peut retirer son offre et récupérer les ressources en séquestre | Test « restitue les ressources au vendeur qui retire son offre » | Le test d'API envoie le retrait au nom d'un autre joueur, qui reçoit 403, puis au nom du vendeur, qui obtient le statut « retirée » et retrouve son stock initial. La règle `NOT_SELLER` est testée aussi dans le domaine (« ne laisse retirer une offre que par son vendeur, et lui restitue ses ressources »). Observé sur le serveur local : après le retrait d'une offre de 10 bois, le stock du vendeur est augmenté de 10 bois. La restitution est versée au vendeur de l'offre, jamais à l'auteur de la requête. | conforme |
| M3 | Un joueur ne peut pas accepter sa propre offre | Tests « refuse l'acceptation de sa propre offre... » et « restitue les ressources au vendeur... » | Le test du domaine vérifie l'erreur `OWN_OFFER`, et le test d'API le code 409. Observé sur le serveur local : l'acceptation d'une offre par son vendeur reçoit 409 `OWN_OFFER`, et l'offre reste ouverte. | conforme |
| M4 | Aucun échange ne crée ni ne détruit de ressources, y compris lors d'acceptations simultanées | Test « ne conclut l'échange qu'avec un seul acheteur, lors de deux acceptations simultanées » | Le test envoie deux acceptations au même instant : un seul acheteur l'emporte, le second reçoit `NOT_OPEN`, et les trois villages totalisent toujours 300 bois et 150 pierre. Observé sur le serveur local, pour un échange non simultané : la somme des bois et des pierres des deux villages est identique avant et après (vendeur : -60 bois, +30 pierre ; acheteur : +60 bois, -30 pierre). Le cas simultané n'est vérifié que par le test automatisé. | conforme |
| M5 | Un message remis plusieurs fois n'a d'effet qu'une fois | Test « n'a qu'un effet, et ne répond qu'une fois, lorsqu'un message est remis deux fois » ; test « ignore une réponse en double... » | Côté Village, le test remet deux fois le même message directement au gestionnaire : le stock n'est modifié qu'une fois et une seule réponse est enregistrée, l'idempotence reposant sur l'identifiant du mouvement (test « ignore un mouvement déjà traité, quelle que soit son issue »). Côté Marché, une réponse en double ou tardive ne produit aucun événement. Le test d'interruption de la boîte d'envoi établit que le doublon existe bel et bien : un message est remis une seconde fois à l'expiration du bail. | conforme |
| M6 | Les quantités échangées sont des entiers strictement positifs, à l'entrée de l'API comme à la réception d'un message | Publication d'une offre de -50 bois ; schéma `ResourceAmounts` | Observé sur le serveur local : la publication d'une offre de -5 bois reçoit 400 `INVALID_INPUT`, avant tout appel au service. Le même schéma `ResourceAmounts` valide les messages reçus par le Village (`TransferRequest.parse`) : un message mal formé échoue et est retenté, comme l'établit le test « échoue sur un message mal formé... ». Le schéma impose des entiers strictement positifs, au moins une ressource, et refuse toute autre clé. Le stock du vendeur n'a pas été relu après le refus : la validation précède le service, qui n'est jamais appelé. | conforme |
| M7 | Aucun joueur ne peut provoquer un mouvement de ressources dans un village autrement que par une offre | Lecture des routes de l'API : aucune n'enregistre de message dans la boîte d'envoi | L'API du Village n'a que trois routes (lecture, fondation, amélioration), et aucune ne demande de prélèvement ni de versement. Les seuls enregistrements de messages se trouvent dans `market-service.ts`, qui ne les produit que pour les événements d'une offre, et dans `village-service.ts`, pour répondre à une demande reçue. Aucune route du Marché ne publie directement un message : un joueur n'agit que par des commandes que `decide` valide. | conforme |
| M8 | La route de distribution planifiée n'est accessible qu'avec le secret, absent du dépôt | Test « refuse une requête sans le secret attendu (401) » ; `git grep -n CRON_SECRET` | Le test obtient un code 401 sans secret ; observé sur le serveur local, où la variable n'est pas définie : la route reste fermée (401) pour toute requête. `git grep -n CRON_SECRET` ne trouve que le nom de la variable : `.env.example` (valeur vide), `server.ts`, `testing.ts` et un commentaire, jamais une valeur de production ; la seule valeur présente est celle des tests, nommée comme telle. La route n'est pas derrière `requireUser` : elle s'authentifie par le secret. Deux réserves : la comparaison du secret n'est pas à temps constant (risque pratiquement inexploitable à travers le réseau) ; et la variable n'a pas été vérifiée sur Vercel : sans elle, la tâche planifiée reçoit 401 et le filet quotidien est inactif. | conforme |
| M9 | Le canal du Marché ne transmet aucune donnée d'événement | Route de repli `/api/stream/market/events?after=0` | La règle du canal déclare `redact: true`. Observé sur le serveur local : la route de repli renvoie les événements `OfferPublished`, `OfferOpened`, `OfferAccepted`... avec la position, le flux, la version et le type, et un champ `data` vide pour chacun (9 événements après les échanges de la vérification). Le nom du flux contient l'identifiant de l'offre, comme pour le canal du Classement (voir D14 de la revue du Donjon). | conforme |
| M10 | Les ressources manquantes lors d'un paiement refusé ne sont connues que de l'acheteur concerné | Consultation de l'offre par le vendeur après un paiement refusé | Observé sur le serveur local : après le refus du paiement d'un acheteur, la réponse qu'il reçoit contient `missing: { stone: 480 }`, et la consultation de la même offre par le vendeur renvoie `missing: null`. La vue ne renseigne `missing` que si l'identifiant du joueur est celui de l'acheteur dont le paiement a été refusé ; les événements qui contiennent les quantités ne sont jamais transmis par le canal (M9). | conforme |

## Synthèse

Sur dix exigences, dix sont conformes ; aucune n'est non conforme, et aucun risque n'est accepté.
Par ailleurs, une requête anonyme sur les routes du Marché reçoit un code 401 (observé, et vérifié
par le test « refuse une requête anonyme (401) »), comme l'exige S10 de la revue de l'authentification.

Limites relevées, qui ne relèvent d'aucune exigence de la grille :

- DT-007 : un message abandonné après dix tentatives est seulement compté ; aucun outil ne permet de
  l'examiner ni de le relancer, et une offre dont un message est abandonné reste bloquée avec des
  ressources en séquestre. La dette est consignée avec une échéance au TD11.
- Toute consultation de la liste du Marché déclenche une distribution, jusqu'à cent messages : un
  joueur connecté peut donc provoquer ce travail ; la limite de cent messages en borne le coût.
- Une offre échue reste en séquestre jusqu'à la première distribution qui suit son échéance ; elle n'est
  cependant plus proposée ni acceptable, puisque le domaine compare l'heure à l'échéance.

Actions décidées :

- M8 : définir `CRON_SECRET` dans les variables d'environnement de production du projet Vercel avant le
  déploiement, puis vérifier dans « Settings > Cron Jobs » que la tâche répond 200 ; envisager une
  comparaison du secret à temps constant.
- DT-007 : fournir une fonction pour lister les messages abandonnés et les relancer, réservée à un
  rôle d'administration qui n'existe pas encore.
