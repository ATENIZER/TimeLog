/* Pointeuse — dictionnaire des langues (le français sert de clé)
   Chargé par index.html. Après une modification, changez le ?v=… dans index.html pour forcer la mise à jour. */
/* ===================== Langues =====================
   Dictionnaire unique de l'interface.
   - Les textes sont écrits en français dans le code : le français sert de clé.
   - Pour ajouter une langue : copier le bloc « en », changer _name et _locale, traduire les valeurs.
   - Une clé avec {} est un modèle : chaque {} capte une partie variable, reprise dans l'ordre.
     La valeur peut être une fonction qui reçoit ces parties (utile pour les pluriels).
   - Une clé qui commence par ^ est une expression régulière.
   - Une clé qui commence par ~ est un fragment remplacé à l'intérieur d'un texte plus long.
*/
const I18N={
fr:{_name:"Français",_locale:"fr-CA"},
en:{_name:"English",_locale:"en-CA",
// Refonte : styles, arrière-plan, organigramme, messagerie
"Organigramme":"Org chart","Messages":"Messages","Conversations":"Conversations","Canaux":"Channels","Messages directs":"Direct messages",
"+ Nouveau":"+ New","Nouveau message direct":"New direct message","Créer un canal":"Create a channel","Créer le canal":"Create channel",
"Supprimer le canal":"Delete channel","Retour aux conversations":"Back to conversations","Envoyer":"Send","Écrire un message…":"Write a message…","Écrire un message":"Write a message",
"Entrée pour envoyer · Maj + Entrée pour un saut de ligne. Les messages sont visibles par les membres de la conversation seulement.":"Enter to send · Shift + Enter for a new line. Messages are visible to conversation members only.",
"Membre de l'association":"Association member","Rechercher un nom":"Search a name","Aucun membre ne correspond.":"No member matches.",
"Nom du canal":"Channel name","Sujet":"Topic","Ex. comité-gala":"E.g. gala-committee","Ex. Organisation du gala de fin d'année":"E.g. Planning the year-end gala",
"Tous les membres de l'association voient les canaux et peuvent y écrire.":"Every member of the association can see and post in channels.",
"Donnez un nom au canal.":"Give the channel a name.","Un canal porte déjà ce nom.":"A channel already has this name.","Création refusée : il faut être administrateur.":"Creation refused: administrator access required.",
"Canal # {} créé":"Channel # {} created","Canal supprimé":"Channel deleted","Message supprimé":"Message deleted","Suppression refusée":"Deletion refused",
"Supprimer le message":"Delete message","Supprimer ?":"Delete?","Confirmer : tous les messages seront effacés":"Confirm: all messages will be erased",
"Message non envoyé. Vérifiez votre connexion, puis réessayez.":"Message not sent. Check your connection, then try again.",
"Vous":"You","Hier":"Yesterday","conversation privée":"private conversation","Écrire à {}…":"Write to {}…","Écrire dans # {}…":"Write in # {}…",
"Début de votre conversation avec {}":"Start of your conversation with {}","Bienvenue dans # {}":"Welcome to # {}",
"Seules vous deux pouvez lire ces messages.":"Only the two of you can read these messages.",
"Tous les membres de l'association lisent ce canal. Lancez la discussion !":"Every member of the association reads this channel. Start the conversation!",
"Aucun message pour l'instant":"No messages yet","Annonces et discussions de toute l'association":"Announcements and discussions for the whole association",
"Écrivez à un membre avec « + Nouveau », ou depuis l'organigramme.":"Write to a member with “+ New”, or from the org chart.",
"Messages inaccessibles.":"Messages unavailable.",
"Arbre":"Tree","Liste":"List","Réduire":"Zoom out","Agrandir":"Zoom in","Imprimer":"Print","Zoom":"Zoom","Disposition de l'organigramme":"Org chart layout",
"Modifier l'organigramme":"Edit org chart","Régénérer à partir des rôles":"Regenerate from roles","Confirmer (remplace l'organigramme actuel)":"Confirm (replaces the current chart)",
"Membres sans poste":"Members without a position","Poste à pourvoir":"Open position","Ce poste est à pourvoir.":"This position is open.",
"Ajouter un poste en dessous":"Add a position below","Modifier le poste":"Edit position","Nouveau poste":"New position","Poste ou comité":"Position or committee",
"Responsabilités":"Responsibilities","Relève de":"Reports to","Personnes":"People","Laissez vide pour un poste à pourvoir.":"Leave empty for an open position.",
"Ex. Trésorerie, Comité des événements":"E.g. Treasury, Events committee","Ex. Tient les comptes, prépare le budget annuel":"E.g. Keeps the books, prepares the annual budget",
"— Personne (sommet de l'organigramme)":"— Nobody (top of the chart)","Relève de : {}":"Reports to: {}","Écrire":"Message",
"Donnez un nom au poste ou au comité.":"Give the position or committee a name.","Poste modifié":"Position updated","Poste ajouté":"Position added","Poste supprimé":"Position deleted",
"Confirmer la suppression":"Confirm deletion","Organigramme régénéré":"Org chart regenerated","Organigramme enregistré : vous pouvez maintenant le modifier":"Org chart saved: you can now edit it",
"Cet organigramme est généré à partir des rôles de l'association.":"This org chart is generated from the association's roles.",
"Cet organigramme est généré à partir des rôles. Modifiez-le pour ajouter des comités, des postes à pourvoir et des responsabilités : il sera alors enregistré pour tous les membres.":"This org chart is generated from roles. Edit it to add committees, open positions and responsibilities: it will then be saved for every member.",
"Style de l'interface":"Interface style","Cinq propositions : choisissez celle qui ressemble à votre association.":"Five proposals: pick the one that fits your association.",
"Encre":"Ink","Marine et ambre, la signature de la Pointeuse.":"Navy and amber, the app's signature look.",
"Carton de pointage":"Time card","Papier manille, encre tamponnée et chiffres de pointeuse.":"Manila paper, stamped ink and time-clock digits.",
"Aurore boréale":"Northern lights","Verre dépoli sur un ciel du Nord, pour les soirs de gala.":"Frosted glass over a northern sky, for gala nights.",
"Affiche":"Poster","Contours épais et couleurs franches, comme une affiche de campagne.":"Bold outlines and bright colours, like a campaign poster.",
"Lichen":"Lichen","Clair et posé, sans ombres, pour se concentrer.":"Light and calm, shadow-free, for focus.",
"Style « {} » appliqué":"“{}” style applied",
"Arrière-plan des associations":"Association backgrounds","Afficher l'arrière-plan choisi par chaque association.":"Show the background chosen by each association.",
"Arrière-plan de la page":"Page background","Une image ou un motif propre à l'association, visible par tous ses membres.":"An image or pattern for the association, visible to all its members.",
"Choisir l'arrière-plan":"Choose background","Choisir l'arrière-plan…":"Choose background…","Type":"Type","Aucun":"None","Motif":"Pattern","Image":"Image",
"Couleur du motif":"Pattern colour","Voile de lisibilité":"Readability veil","Flouter l'image":"Blur the image","Type d'arrière-plan":"Background type",
"Choisir une image d'arrière-plan":"Choose a background image",
"Photo du local, d'un événement, d'un paysage… Elle est recadrée et allégée automatiquement.":"A photo of your office, an event, a landscape… It is cropped and compressed automatically.",
"Dégradé":"Gradient","Aurore":"Aurora","Points":"Dots","Carreaux":"Grid","Rayures":"Stripes","Relief":"Contours","Vagues":"Waves","Uni":"Solid",
"Arrière-plan retiré":"Background removed","Arrière-plan enregistré pour tous les membres":"Background saved for all members",
"Seuls les administrateurs peuvent changer l'arrière-plan":"Only administrators can change the background",
"Choisissez une image, ou un autre type d'arrière-plan.":"Choose an image, or another background type.",
"^(\\d+) postes? · (\\d+) membres? sur (\\d+) y figurent? ?(.*)$":(a,b,c,d)=>`${a} position${a>1?"s":""} · ${b} of ${c} member${c>1?"s":""} placed ${d.replace("mis à jour","updated").replace("il y a","").trim()}`,
// Navigation et en-tête
"Pointeuse":"Time clock","Navigation":"Navigation","Accueil":"Home","Aller à l'accueil":"Go to home","Afficher ou réduire le menu":"Expand or collapse the menu",
"Projets":"Projects","Calendrier":"Calendar","Équipe":"Team","Rôles":"Roles","Paramètres":"Settings","Modifier mon nom":"Edit my name","Se déconnecter":"Sign out",
"Ouvrir le menu":"Open the menu","Retour en arrière":"Go back","Retour":"Back","Ouvrir le chronomètre":"Open the timer","Changer de mode":"Change mode",
"Chargement":"Loading","Chargement…":"Loading…","Période du tableau":"Table period","Choisir le jour":"Choose the day","Jour précédent":"Previous day","Date":"Date","Jour suivant":"Next day",
"Nouveau rôle, ex. Superviseur":"New role, e.g. Supervisor","Nom du nouveau rôle":"New role name","Ex. Association étudiante de…":"E.g. Student association of…",
"Filtrer les projets":"Filter projects","Mois précédent":"Previous month","Mois suivant":"Next month","Affichage":"View","Mode":"Mode","Couleur personnalisée":"Custom color",
"Taille du texte":"Text size","Densité":"Density","Premier jour":"First day","Format des durées":"Duration format",
// Accueil personnalisable
"Modifier l'accueil":"Customize home","Mes associations":"My associations","Indicateurs":"Indicators","À venir":"Upcoming","Vue par jour":"Day view",
"Heures par activité":"Hours by activity","Période":"Period","Journal":"Log","Types d'activités":"Activity types",
"Glissez les blocs par la poignée ⠿, ou utilisez les flèches du clavier.":"Drag blocks by the ⠿ handle, or use the arrow keys.",
"Rétablir la disposition par défaut":"Restore default layout","Terminer":"Done","Afficher":"Show","Masquer":"Hide",
"Déplacer le bloc {} (flèches haut et bas)":"Move the {} block (up and down arrows)","Glisser pour déplacer":"Drag to move",
"Modifier la disposition":"Customize layout","Activités":"Activities","Tout valider":"Approve all","Voir le journal":"View log",
"Tout valider ({})":"Approve all ({})","{} · {} en attente":"{} · {} pending","… et {} autre(s) dans son journal.":"… and {} more in their log.","{} entrée(s) validée(s)":"{} entry(ies) approved",
"✅ Tout est validé : aucune activité en attente dans l'association.":"✅ All caught up: no activity waiting in the association.",
"Mon compte":"My account",
"Curieux ? Explorez l'application avec une association fictive, sans créer de compte.":"Curious? Explore the app with a sample association, without creating an account.",
"Voir un aperçu sans compte":"Preview without an account","Aperçu":"Preview","Quitter l'aperçu":"Leave preview","Créer mon compte gratuit":"Create my free account",
"· Données fictives : rien n'est enregistré, tout est effacé en quittant.":"· Sample data: nothing is saved, everything is erased when you leave.",
"Créez un compte gratuit pour utiliser cette fonction.":"Create a free account to use this feature.","Tableau de l'équipe":"Team table","Paramètres de l'organisation":"Organization settings","Calendrier du mois":"Monthly calendar","Journée choisie":"Selected day",
"Votre accueil montre l'essentiel : vos associations, vos indicateurs et ce qui s'en vient. Pointez vos heures avec le chronomètre en haut à droite ; votre journal se trouve dans l'onglet Activités.":"Your home shows the essentials: your associations, indicators and what's coming up. Clock your hours with the timer at the top right; your log is in the Activities tab.",
"D'autres blocs (vue par jour, tableau de bord…) sont disponibles quand vous serez prêt.":"More blocks (day view, dashboard…) are available whenever you're ready.",
"Choisir mes blocs":"Choose my blocks","Tout afficher":"Show all","Compris":"Got it","Tous les blocs sont affichés":"All blocks are shown",
"Supprimer mon compte":"Delete my account","Efface définitivement votre compte et vos données personnelles.":"Permanently erases your account and your personal data.",
"Cette action est définitive. Votre compte, votre journal d'heures et vos préférences seront effacés, et vous quitterez toutes vos associations.":"This cannot be undone. Your account, your time log and your preferences will be erased, and you will leave all your associations.",
"Ce que vous avez partagé avec une association (événements, commentaires, tâches, heures déjà validées) peut y rester. Pensez à télécharger vos données avant, dans Paramètres › Données.":"What you shared with an association (events, comments, tasks, already validated hours) may remain there. Consider downloading your data first, in Settings › Data.",
"Mot de passe actuel":"Current password","Une fenêtre Google s'ouvrira pour confirmer votre identité.":"A Google window will open to confirm your identity.",
"Écrivez SUPPRIMER pour confirmer":"Type DELETE to confirm","Supprimer définitivement":"Delete permanently","Suppression en cours…":"Deleting…",
"Écrivez SUPPRIMER pour confirmer.":"Type DELETE to confirm.","Entrez votre mot de passe actuel.":"Enter your current password.","Mot de passe incorrect.":"Incorrect password.",
"La fenêtre de confirmation a été fermée.":"The confirmation window was closed.","Utilisez le même compte Google que celui de la Pointeuse.":"Use the same Google account as the one used in the app.",
"Suppression impossible pour le moment. Réessayez plus tard.":"Unable to delete right now. Please try again later.","Compte supprimé":"Account deleted",
"Vous êtes propriétaire de : {}. Supprimez d'abord ces associations (Paramètres › Association) : une association ne peut pas rester sans propriétaire.":"You own: {}. Delete these associations first (Settings › Association): an association cannot be left without an owner.",
"Supprimer l'association":"Delete the association","Efface définitivement l'association et toutes ses données, pour tous les membres.":"Permanently erases the association and all its data, for every member.",
"Cette action est définitive et touche tous les membres de":"This cannot be undone and affects every member of",
": heures pointées, validations, projets, tâches, fichiers, événements, notes de réunion et commentaires seront effacés. Le code d'invitation cessera de fonctionner.":": clocked hours, approvals, projects, tasks, files, events, meeting notes and comments will be erased. The invitation code will stop working.",
"Pensez à exporter ce dont vous avez besoin avant : rapports d'activités, journal en CSV, calendrier en .ics.":"Remember to export what you need first: activity reports, log as CSV, calendar as .ics.",
"Écrivez le nom de l'association pour confirmer":"Type the association's name to confirm","Le nom écrit ne correspond pas à celui de l'association.":"The name doesn't match the association's name.",
"Association supprimée":"Association deleted","Suppression refusée. Vérifiez votre connexion, puis réessayez.":"Deletion refused. Check your connection, then try again.",
"Nouveau type, ex. Formation":"New type, e.g. Training","Nom du nouveau type":"New type name","Chronomètre":"Timer","Fermer le chronomètre":"Close the timer",
"Ex. Marie Tremblay, présidente":"E.g. Marie Tremblay, president","Ex. Association étudiante en génie":"E.g. Engineering student association",
"Ex. Comité étudiant de la faculté de génie":"E.g. Engineering faculty student committee","Choisir une icône":"Choose an icon","Choisir une image de bannière":"Choose a banner image",
"Ex. Réunion du conseil":"E.g. Board meeting","Adresse, salle ou lien de visioconférence":"Address, room or video call link","Ordre du jour, consignes…":"Agenda, instructions…",
"Aperçu du visuel":"Image preview","Choisir une affiche ou une bannière":"Choose a poster or banner","Votre commentaire, votre avis ou une question…":"Your comment, feedback or a question…",
"Écrire un commentaire":"Write a comment","Votre note (facultatif)":"Your rating (optional)","Importer un fichier .ics":"Import an .ics file","Facultatif":"Optional",
// Connexion
"Connexion":"Sign in","Continuer avec Google":"Continue with Google","ou avec votre courriel":"or with your email","Nom complet":"Full name","Courriel":"Email","Mot de passe":"Password",
"Se connecter":"Sign in","Créer un compte":"Create an account","Mot de passe oublié":"Forgot password","Configuration manquante":"Missing configuration","Le fichier":"The file",
"ne contient pas encore la configuration de votre projet Firebase. Suivez l'étape 4 du guide d'installation.":"does not contain your Firebase project configuration yet. Follow step 4 of the setup guide.",
"Impossible de charger vos informations.":"Could not load your information.","La connexion est peut-être lente ou interrompue. Vos données ne sont pas perdues.":"Your connection may be slow or down. Your data is not lost.",
"Réessayer":"Try again","Aujourd'hui":"Today","Semaine":"Week","Mois":"Month",
"Courriel ou mot de passe incorrect.":"Incorrect email or password.","Aucun compte avec ce courriel.":"No account with this email.",
"Un compte existe déjà avec ce courriel. Connectez-vous.":"An account already exists with this email. Please sign in.","Le mot de passe doit contenir au moins 6 caractères.":"The password must be at least 6 characters.",
"Ce courriel n'est pas valide.":"This email is not valid.","La fenêtre de connexion a été fermée avant la fin.":"The sign-in window was closed before finishing.",
"Ce site n'est pas autorisé dans Firebase. Ajoutez son adresse aux domaines autorisés (étape 7 du guide).":"This site is not authorized in Firebase. Add its address to the authorized domains (step 7 of the guide).",
"Cette méthode de connexion n'est pas activée dans Firebase (étape 3 du guide).":"This sign-in method is not enabled in Firebase (step 3 of the guide).",
"Trop de tentatives. Réessayez dans quelques minutes.":"Too many attempts. Try again in a few minutes.","Pas de connexion Internet.":"No Internet connection.",
"Connexion impossible ({}).":"Could not sign in ({}).","erreur inconnue":"unknown error","Créer mon compte":"Create my account","J'ai déjà un compte":"I already have an account",
"Entrez votre courriel et votre mot de passe.":"Enter your email and password.","Entrez votre nom complet.":"Enter your full name.","Entrez d'abord votre courriel ci-dessus.":"Enter your email above first.",
"Courriel de réinitialisation envoyé":"Reset email sent",
// Équipe et rôles
"Exporter l'équipe en CSV":"Export team to CSV","Cliquez sur une personne pour voir le détail de ses activités.":"Click a person to see their activity details.",
"Journée de l'équipe":"Team's day","Rôles et accès":"Roles and access","Créer le rôle":"Create role","Nom de l'organisation":"Organization name","Rôle donné aux nouvelles personnes":"Role given to new people",
"Les rôles administrateurs voient toute l'équipe, valident les heures et gèrent les rôles. Les nouvelles personnes qui créent un compte reçoivent le rôle choisi ici.":"Admin roles see the whole team, approve hours and manage roles. New people who create an account get the role chosen here.",
"Personne n'a encore pointé. Partagez la page avec votre équipe pour qu'elle apparaisse ici.":"No one has clocked in yet. Share the page with your team so they show up here.",
"Cette semaine":"This week","Ce mois-ci":"This month","Personne":"Person","Statut":"Status","À valider":"To approve","Activité principale":"Main activity","Dernière mise à jour":"Last update",
"Rôle modifié : {}":"Role changed: {}","Ajouter et modifier des entrées à la main":"Add and edit entries manually","Supprimer des entrées":"Delete entries",
"Accès administrateur":"Admin access","Accès restreint":"Restricted access","Voit toute l'équipe, attribue les rôles et a toutes les permissions dans son espace.":"Sees the whole team, assigns roles and has every permission in their space.",
"Voit uniquement son propre espace.":"Sees only their own space.","Nom du rôle":"Role name",
"{} · {} personne{}":(r,n,s)=>`${r} · ${n} ${s?"people":"person"}`,
"Gardez au moins un rôle à accès restreint":"Keep at least one restricted role","Rôle supprimé":"Role deleted","Ce rôle existe déjà":"This role already exists","Rôle créé : {}":"Role created: {}",
"Nom de l'organisation enregistré":"Organization name saved",
"Votre rôle donne l'accès administrateur. Pour voir l'équipe, demandez au propriétaire de vous donner le rôle Éditeur dans le menu Partager de cette page.":"Your role gives admin access. To see the team, ask the owner to give you the Editor role in this page's Share menu.",
"‹ Équipe":"‹ Team","En cours · {} depuis {}":"Ongoing · {} since {}","Propriétaire":"Owner","Président":"President","Vice-président":"Vice-president","Membre":"Member",
// Projets
"Mes tâches":"My tasks","En cours":"In progress","Terminés":"Completed","Tous":"All","Nouveau projet":"New project","Liste":"List","🔗 Mes calendriers":"🔗 My calendars",
"Nom du projet":"Project name","Description":"Description","Date limite":"Deadline","État":"Status","Terminé":"Completed","Archivé":"Archived","Membres du projet":"Project members",
"Nouvelle tâche":"New task","Tâche":"Task","Consignes":"Instructions","Type de tâche":"Task type","Individuelle (une personne)":"Individual (one person)","Collective (plusieurs personnes)":"Group (several people)",
"Assignée à":"Assigned to","Créer":"Create","Vous n'avez pas le droit de déposer un fichier dans ce projet.":"You are not allowed to upload a file to this project.",
"La limite gratuite du jour est atteinte. Réessayez demain.":"Today's free limit has been reached. Try again tomorrow.","Fichier trop volumineux (5 Mo maximum).":"File too large (5 MB maximum).",
"L'envoi a échoué.":"Upload failed.","À faire":"To do","À vérifier":"To review","Terminée":"Completed","En retard de {} j":"{} d late","Dans {} j":"In {} d","Ko":"KB","Mo":"MB",
"🎉 Aucune tâche en attente pour vous.":"🎉 No pending tasks for you.",
"{}/{} tâche{} terminée{}":(a,b,s)=>`${a}/${b} task${s?"s":""} completed`,
"📁 Aucun projet ici. Créez-en un avec « Nouveau projet ».":"📁 No projects here. Create one with “New project”.","📁 Vous ne faites encore partie d'aucun projet.":"📁 You are not part of any project yet.",
"Confirmer":"Confirm","Retirer":"Remove","Confirmer la suppression du projet":"Confirm project deletion","Modifier le projet":"Edit project","📝 Aucune tâche pour l'instant.":"📝 No tasks yet.",
"📂 Les preuves déposées dans les tâches apparaîtront ici.":"📂 Proof uploaded to tasks will appear here.","‹ Tous les projets":"‹ All projects",
"{} membre{}":(n,s)=>`${n} member${s?"s":""}`,"Tâches":"Tasks","Fichiers du projet":"Project files","{} fichier{}":(n,s)=>`${n} file${s?"s":""}`,
"Commencer":"Start","Soumettre pour vérification":"Submit for review","Valider la tâche":"Approve task","Renvoyer à la personne":"Send back to the person","Rouvrir":"Reopen",
"Collective":"Group","Individuelle":"Individual","Personne n'est assigné":"No one is assigned","Avancement de la tâche":"Task progress","Avancement":"Progress",
"Ajouter une preuve":"Add proof","📎 Ajouter une preuve":"📎 Add proof","Projet supprimé":"Project deleted","Suppression impossible":"Could not delete","Modification refusée":"Change denied",
"Tâche supprimée":"Task deleted","Suppression refusée":"Deletion denied","« {} » dépasse {}":"“{}” exceeds {}","Envoi de « {} »…":"Uploading “{}”…","Preuve ajoutée":"Proof added",
"Impossible d'ouvrir ce fichier":"Could not open this file","Fichier retiré":"File removed","Aucun membre inscrit pour l'instant.":"No members registered yet.","Donnez un nom au projet.":"Give the project a name.",
"Projet modifié":"Project updated","Projet créé":"Project created","Enregistrement refusé : accès administrateur requis.":"Save denied: admin access required.","Modifier la tâche":"Edit task",
"Ajoutez d'abord des membres au projet.":"Add members to the project first.","Donnez un titre à la tâche.":"Give the task a title.","Assignez la tâche à au moins une personne.":"Assign the task to at least one person.",
"Une tâche individuelle n'a qu'une seule personne.":"An individual task has only one person.","Tâche modifiée":"Task updated","Tâche créée":"Task created",
"~a ajouté «":"added «","~a mis l'avancement à":"set progress to","~a rouvert la tâche":"reopened the task","~a renvoyé la tâche":"sent the task back","~a commencé la tâche":"started the task",
"~a soumis la tâche pour vérification":"submitted the task for review","~a validé la tâche":"approved the task","~a changé l'état":"changed the status","~a modifié la tâche":"edited the task","~a créé la tâche":"created the task",
// Calendrier et événements
"Nouvel événement":"New event","Réunion":"Meeting","Événement":"Event","Formation":"Training","Autre":"Other","Échéance":"Deadline","+ Ajouter ce jour-là":"+ Add on this day",
"Titre":"Title","Type":"Type","Toute la journée":"All day","Début":"Start","Fin":"End","Lieu":"Location",
"Les liens, courriels et numéros de téléphone du lieu et de la description deviennent cliquables.":"Links, emails and phone numbers in the location and description become clickable.",
"Icône":"Icon","Affiche ou bannière":"Poster or banner","Affiche (verticale) ou bannière (horizontale) : l'image est allégée automatiquement.":"Poster (vertical) or banner (horizontal): the image is compressed automatically.",
"Ajouter à mon calendrier :":"Add to my calendar:","Google":"Google","Outlook (école/travail)":"Outlook (school/work)","Commentaires et avis":"Comments and feedback","Publier":"Post",
"Supprimer":"Delete","Modifier":"Edit","Fermer":"Close","Relier à mes calendriers":"Connect to my calendars",
"Ajoutez les événements et les échéances de l'association à Google Agenda, Outlook ou Apple Calendrier.":"Add the association's events and deadlines to Google Calendar, Outlook or Apple Calendar.",
"Tout le calendrier d'un coup":"The whole calendar at once","Téléchargez le fichier, puis importez-le dans votre calendrier. Refaites l'opération pour récupérer les nouveautés.":"Download the file, then import it into your calendar. Repeat to get new items.",
"Télécharger le calendrier (.ics)":"Download the calendar (.ics)","Comment l'importer ?":"How to import it?","Google Agenda :":"Google Calendar:",
"Paramètres ⚙️ › Importer et exporter › Importer, puis choisissez le fichier.":"Settings ⚙️ › Import & export › Import, then choose the file.",
"Calendrier › Ajouter un calendrier › Charger à partir d'un fichier.":"Calendar › Add calendar › Upload from file.","Apple Calendrier :":"Apple Calendar:","ouvrez le fichier, ou Fichier › Importer.":"open the file, or File › Import.",
"Un événement à la fois":"One event at a time","Ouvrez un événement du calendrier et choisissez Google, Outlook ou Apple : il s'ajoute en un clic.":"Open a calendar event and choose Google, Outlook or Apple: it's added in one click.",
"Importer des événements":"Import events","Exportez un calendrier depuis Google ou Outlook (.ics) et ajoutez ses événements à celui de l'association.":"Export a calendar from Google or Outlook (.ics) and add its events to the association's.",
"📥 Choisir un fichier .ics":"📥 Choose an .ics file","Calendrier téléchargé":"Calendar downloaded","Échéance : {}":"Deadline: {}","{}, {} élément(s)":"{}, {} item(s)","{} élément(s)":"{} item(s)",
"📅 Rien de prévu en {}.":"📅 Nothing planned in {}.","Échéance du projet":"Project deadline","Échéance de tâche":"Task deadline","Rien de prévu ce jour-là.":"Nothing planned that day.",
"Modifier l'événement":"Edit event","Indiquez au moins un titre et une date.":"Enter at least a title and a date.","Indiquez les heures de début et de fin.":"Enter the start and end times.",
"Événement modifié":"Event updated","Événement ajouté":"Event added","Enregistrement refusé : il faut être administrateur de l'association.":"Save denied: you must be an admin of the association.",
"· toute la journée":"· all day","Événement supprimé":"Event deleted","Sans titre":"Untitled","{} événements importés":"{} events imported","{} événement importé":"{} event imported",
"Aucun nouvel événement dans ce fichier":"No new events in this file","Ce fichier n'a pas pu être importé.":"This file could not be imported.","Google Maps":"Google Maps","Waze":"Waze",
"· échéance de tâche":"· task deadline","· échéance du projet":"· project deadline","Voir le visuel de {}":"View the image for {}","Ouvrir {}":"Open {}",
"Tout ce qui est à venir":"Everything upcoming","+ Ajouter un événement":"+ Add an event","Ajoutez un événement depuis le calendrier.":"Add an event from the calendar.",
"📅 Rien de prévu dans les prochaines semaines.":"📅 Nothing planned in the coming weeks.","Sans icône":"No icon","à l'instant":"just now","il y a {} min":"{} min ago","il y a {} h":"{} h ago",
"{} sur 5":"{} out of 5","Votre note :":"Your rating:","{} étoile{}":(n,s)=>`${n} star${s?"s":""}`,"Organisateur":"Organizer",
"💬 Aucun commentaire pour l'instant. Lancez la discussion !":"💬 No comments yet. Start the discussion!","Votre avis, un retour sur la réunion…":"Your feedback on the meeting…",
"Votre commentaire ou une question avant la réunion…":"Your comment or a question before the meeting…","Impossible de publier le commentaire":"Could not post the comment",
// Paramètres
"Profil":"Profile","Nom affiché":"Display name","Apparaît sur vos attestations et dans les projets.":"Appears on your certificates and in projects.","Rôle":"Role","Attribué par les administrateurs.":"Assigned by admins.",
"Apparence":"Appearance","Jour":"Day","Nuit":"Night","Automatique":"Automatic","Couleur d'accent":"Accent color","Petite":"Small","Normale":"Normal","Grande":"Large",
"Espacement entre les éléments.":"Spacing between items.","Compacte":"Compact","Confortable":"Comfortable","Animations":"Animations","Réduire les mouvements à l'écran.":"Reduce on-screen motion.",
"L'apparence est propre à chaque appareil.":"Appearance is specific to each device.","Langue":"Language","La langue est propre à chaque appareil.":"Language is specific to each device.",
"Pointage":"Clocking","Activité proposée par défaut":"Default activity","Présélectionnée à l'ouverture du chronomètre.":"Preselected when the timer opens.","Premier jour de la semaine":"First day of the week",
"Pour les totaux « Cette semaine ».":"For “This week” totals.","Lundi":"Monday","Dimanche":"Sunday","Rappel de sortie":"Clock-out reminder","Vous avertir si le chronomètre tourne depuis longtemps.":"Warn you if the timer has been running for a long time.",
"Jamais":"Never","Après 4 h":"After 4 h","Après 6 h":"After 6 h","Après 8 h":"After 8 h","Après 10 h":"After 10 h","Après 12 h":"After 12 h","3 h 25":"3h 25","3,42 h":"3.42 h",
"Association":"Association","Nom de l'association":"Association name","Affiché sur les attestations.":"Shown on certificates.","Code d'invitation":"Invitation code",
"À transmettre aux personnes qui veulent rejoindre l'association.":"Share it with people who want to join the association.","Copier":"Copy","Nouveau code":"New code","Gérer les rôles ›":"Manage roles ›",
"Quitter l'association":"Leave the association","Vos heures restent enregistrées, mais vous n'y aurez plus accès.":"Your hours stay saved, but you will no longer have access to them.","Quitter":"Leave",
"Données":"Data","Mon journal":"My log","Toutes vos entrées, lisibles dans Excel.":"All your entries, readable in Excel.","Exporter en CSV":"Export to CSV","Toutes mes données":"All my data",
"Copie complète de votre espace (JSON).":"Full copy of your space (JSON).","Télécharger":"Download","Compte":"Account","Recevez un courriel pour choisir un nouveau mot de passe.":"Get an email to choose a new password.",
"Changer mon mot de passe":"Change my password","Session":"Session","Vous déconnecter de cet appareil.":"Sign out of this device.","Rétablir les paramètres par défaut":"Restore default settings",
"Orange du logo":"Logo orange","Turquoise":"Turquoise","Corail":"Coral","Bleu":"Blue","Violet":"Purple","Framboise":"Raspberry","Vert":"Green","Moutarde":"Mustard",
"Mode jour":"Day mode","Mode nuit":"Night mode","Passer en mode jour":"Switch to day mode","Passer en mode nuit":"Switch to night mode","Dernière utilisée":"Last used",
"Préférence enregistrée":"Preference saved","Fichier téléchargé":"File downloaded","Le téléchargement a échoué":"Download failed","Paramètres rétablis":"Settings restored",
"Courriel envoyé à {}":"Email sent to {}","Envoi impossible pour le moment":"Cannot send right now",
// Associations
"Rejoindre avec un code":"Join with a code","Créer une association":"Create an association","Bienvenue !":"Welcome!",
"Vous ne faites partie d'aucune association pour l'instant. Créez la vôtre, ou rejoignez celle de votre groupe avec le code d'invitation qu'on vous a transmis.":"You are not part of any association yet. Create yours, or join your group's with the invitation code you were given.",
"Rejoindre une association":"Join an association","Vous en deviendrez président·e. Un code d'invitation sera créé pour y ajouter des membres.":"You will become its president. An invitation code will be created to add members.",
"Demandez le code à un·e administrateur·rice de l'association.":"Ask an admin of the association for the code.","Rejoindre":"Join","Connexion en cours, réessayez dans un instant.":"Connecting, try again in a moment.",
"Donnez un nom à l'association.":"Give the association a name.","Ce code ne correspond à aucune association. Vérifiez-le auprès de la personne qui vous l'a transmis.":"This code doesn't match any association. Check it with the person who gave it to you.",
"Opération impossible pour le moment. Réessayez.":"Cannot do this right now. Try again.","Code copié : {}":"Code copied: {}","Code sélectionné : copiez-le avec Ctrl+C":"Code selected: copy it with Ctrl+C",
"Confirmer (l'ancien code ne marchera plus)":"Confirm (the old code will stop working)","Nouveau code : {}":"New code: {}","Impossible de changer le code":"Could not change the code","Confirmer le départ":"Confirm leaving",
"La personne propriétaire ne peut pas quitter son association.":"The owner cannot leave their association.","Impossible de quitter pour le moment":"Cannot leave right now",
"Cette image n'a pas pu être lue. Essayez un fichier PNG ou JPG.":"This image could not be read. Try a PNG or JPG file.","Cette image n'a pas pu être lue. Essayez un fichier JPG ou PNG.":"This image could not be read. Try a JPG or PNG file.",
"Bannière mise à jour":"Banner updated","Enregistrement refusé : il faut être administrateur de cette association.":"Save denied: you must be an admin of this association.",
"Actuelle":"Current","Modifier la bannière":"Edit banner","Modifier la bannière de {}":"Edit {}'s banner","Bannière de l'association":"Association banner","Nom":"Name","Courte description":"Short description",
"Couleur":"Color","Couleur {}":"Color {}","Icône de l'association":"Association icon","🔷 Choisir une icône":"🔷 Choose an icon","Retirer l'icône":"Remove icon",
"Image carrée conseillée (logo). Elle remplace les initiales.":"A square image is recommended (logo). It replaces the initials.","Image de bannière":"Banner image","🖼️ Choisir une image":"🖼️ Choose an image",
"Retirer l'image":"Remove image","Format large conseillé. L'image est recadrée et allégée automatiquement.":"Wide format recommended. The image is cropped and compressed automatically.",
// Pointage, journal, attestation
"Tout":"All","Ajouter une entrée":"Add an entry","Générer une attestation":"Create a certificate","Gérer les types d'activités de l'association":"Manage the association's activity types",
"Ajouter le type":"Add type","Mon nom":"My name","Nom complet, tel qu'il apparaîtra sur les attestations":"Full name, as it will appear on certificates","Annuler":"Cancel","Enregistrer":"Save",
"Attestation d'heures":"Hours certificate","Seules les heures validées par un administrateur figurent sur l'attestation.":"Only hours approved by an admin appear on the certificate.",
"Nom de la personne":"Person's name","Du":"From","Au":"To","Signataire (nom et fonction)":"Signatory (name and title)","Télécharger l'attestation (PDF)":"Download the certificate (PDF)",
"Modifier l'entrée":"Edit entry","Activité":"Activity","Entrée":"In","Sortie":"Out","Note":"Note","Travail":"Work","Réunions":"Meetings","Administratif":"Administrative",
"Type supprimé":"Deleted type","Validée":"Approved","Modifiée après validation":"Edited after approval","Refusée":"Declined","En attente":"Pending",
"Validation refusée : accès administrateur requis":"Approval denied: admin access required","Moi":"Me","Personne sans nom":"Unnamed person","Enregistrement…":"Saving…","Enregistré":"Saved",
"Échec de l'enregistrement. Vérifiez votre connexion.":"Save failed. Check your connection.","✓ Tout est enregistré":"✓ All saved","Erreur de chargement : {}":"Loading error: {}",
"Modification refusée : accès administrateur requis":"Change denied: admin access required","Nom enregistré":"Name saved","Ajoutez d'abord un type d'activité":"Add an activity type first",
"Entrée pointée à {}":"Clocked in at {}","Sortie pointée à {}":"Clocked out at {}","Activité changée : {}":"Activity changed: {}","En cours · {}":"Ongoing · {}","Entrée à {}{}":"In at {}{}",
"Dernière sortie : {} à {}":"Last clock-out: {} at {}","Aucune activité pointée pour l'instant.":"No activity clocked yet.","Hors service":"Off duty",
"Passer à une autre activité sans pointer la sortie :":"Switch to another activity without clocking out:","Pointer la sortie":"Clock out","Aucun type actif. Ajoutez-en un plus bas.":"No active type. Add one below.",
"Choisir l'activité":"Choose the activity","Pointer l'entrée":"Clock in","aujourd'hui":"today","cette semaine":"this week","ce mois-ci":"this month","au total":"in total",
"{}, dont {} validées":"{}, of which {} approved","📊 Aucune heure pointée pour cette période.":"📊 No hours clocked for this period.","Confirmer la suppression":"Confirm deletion",
"Valider":"Approve","Refuser":"Decline","Annuler la validation":"Undo approval","Valider les {} entrée{} en attente":(n,s)=>`Approve ${n} pending entr${s?"ies":"y"}`,
"Aucune entrée pour cette personne.":"No entries for this person.","🕒 Le journal est vide. Pointez votre entrée pour commencer.":"🕒 The log is empty. Clock in to get started.",
"en cours":"ongoing","Afficher plus de jours":"Show more days","Entrée validée":"Entry approved","Entrée refusée":"Entry declined","Validation annulée":"Approval undone","Entrée supprimée":"Entry deleted",
"Remplissez l'activité, la date et les deux heures.":"Fill in the activity, the date and both times.","Une entrée ne peut pas dépasser 24 heures.":"An entry cannot exceed 24 hours.",
"Entrée modifiée":"Entry updated","Entrée ajoutée":"Entry added","Réactiver":"Reactivate","Archiver":"Archive","Nom du type":"Type name",
"Pointez la sortie avant d'archiver l'activité en cours":"Clock out before archiving the current activity","Ce type existe déjà":"This type already exists","Type ajouté : {}":"Type added: {}",
"Rien à exporter pour l'instant":"Nothing to export yet","Durée (h)":"Duration (h)","{} entrée{} validée{}, {} au total.":(n,s,s2,d)=>`${n} approved entr${s?"ies":"y"}, ${d} in total.`,
"Aucune heure validée sur cette période.":"No approved hours in this period.","Indiquez le nom de la personne.":"Enter the person's name.",
"Aucune heure validée sur cette période. Faites d'abord valider les entrées.":"No approved hours in this period. Have the entries approved first.",
"Le générateur de PDF n'a pas pu se charger. Rechargez la page.":"The PDF generator could not load. Reload the page.","l'organisation":"the organization",
"Attestation d'heures d'implication":"Certificate of volunteer hours",
"Nous attestons que {} a consacré {} d'implication au sein de {}, du {} au {}. Ces heures ont été enregistrées au moyen de notre système de pointage et validées par un administrateur de l'organisation.":"We certify that {} contributed {} of volunteer involvement with {}, from {} to {}. These hours were recorded with our time clock system and approved by an administrator of the organization.",
"Répartition par type d'activité":"Breakdown by activity type","Total":"Total","Détail des entrées validées":"Approved entries","Horaire":"Time","Durée":"Duration",
"Heures validées par : {}":"Hours approved by: {}","Document émis le {}":"Document issued on {}","Code de vérification : {}":"Verification code: {}","Signature et fonction du signataire":"Signature and title of signatory",
"Jour d'activité précédent ({})":"Previous active day ({})","Jour d'activité suivant ({})":"Next active day ({})","🌙 Aucune activité ce jour-là.":"🌙 No activity that day.",
"{} personne{} · {}":(n,s,d)=>`${n} ${s?"people":"person"} · ${d}`,"🌙 Personne n'a pointé ce jour-là.":"🌙 No one clocked in that day.",
// Tableau de bord
"Chronomètre en cours : {}":"Timer running: {}","En service":"On duty","{} · depuis {}":"{} · since {}","Toucher pour pointer":"Tap to clock in","Aucune activité en cours":"No current activity",
"{} entrée(s)":"{} entr(y/ies)","Ce mois-ci : {}":"This month: {}","Tout est validé":"All approved","Heures validées":"Approved hours","{} en retard":"{} late","Aucun retard":"Nothing late",
"Équipe en service":"Team on duty","sur {} personne{}":(n,s)=>`out of ${n} ${s?"people":"person"}`,"entrées en attente":"pending entries","Rien à valider":"Nothing to approve","À valider (équipe)":"To approve (team)",
"⏰ Votre chronomètre tourne depuis plus de {} h. Pensez à pointer la sortie.":"⏰ Your timer has been running for over {} h. Remember to clock out.",
"Ouvrir le calendrier ›":"Open calendar ›","{} Ko":"{} KB","{} Mo":"{} MB","Valeur d'une heure de bénévolat":"Value of one volunteer hour","Sert à estimer la valeur des heures validées (attestations, accueil). Laissez vide pour ne pas l'afficher.":"Used to estimate the value of approved hours (certificates, home). Leave empty to hide it.",
"Ex. 25":"E.g. 25","Valeur d'une heure de bénévolat, en dollars":"Value of one volunteer hour, in dollars","Valeur horaire enregistrée":"Hourly value saved",
"Valeur horaire propre à ce rôle ($/h)":"Hourly value for this role ($/h)","Valeur horaire propre à ce rôle":"Hourly value for this role","Valeur du bénévolat":"Volunteer value",
"Heures validées × {}/h":"Approved hours × {}/h","Valeur estimée : {}":"Estimated value: {}","Valeur estimée du bénévolat":"Estimated volunteer value","Calculée à {} de l'heure.":"Calculated at {} per hour.",
"{} entrée{} en attente":(n,s)=>`${n} pending entr${s?"ies":"y"}`,"Projet":"Project","Projet (facultatif)":"Project (optional)","Aucun projet":"No project","Budget d'heures (facultatif)":"Hour budget (optional)","Ex. 40":"E.g. 40",
"Une alerte s'affiche à 80 % puis en cas de dépassement.":"An alert shows at 80% and when the budget is exceeded.","⚠️ Budget dépassé de {}":"⚠️ Budget exceeded by {}","{} % du budget utilisé":"{}% of budget used",
"Mes heures sur ce projet : {}":"My hours on this project: {}","Budget de l'équipe : {} h":"Team budget: {} h","Heures pointées : {}":"Hours logged: {}","Validées : {}":"Approved: {}","Reste : {}":"Remaining: {}",
"Heures par personne":"Hours per person","Notifications":"Notifications","Notifications ({} non lues)":"Notifications ({} unread)","{} entrée{} à valider":(n,s)=>`${n} entr${s?"ies":"y"} to approve`,"^(\\d+) personne(s?)$":(n,s)=>`${n} ${s?"people":"person"}`,
"Tâche à vérifier : {}":"Task to review: {}","Budget dépassé : {}":"Budget exceeded: {}","Budget presque atteint : {}":"Budget almost reached: {}",
"{} entrée{} refusée{}":(n,s)=>`${n} declined entr${s?"ies":"y"}`,"Vérifiez-les dans votre journal.":"Check them in your log.","Tâche renvoyée : {}":"Task sent back: {}","Tâche en retard : {}":"Overdue task: {}",
"Nouvelle tâche : {}":"New task: {}","Rien de pointé depuis {} jours":"Nothing logged for {} days","Ajoutez vos heures pendant que vous vous en souvenez.":"Add your hours while you still remember them.",
"🔔 Rien de nouveau pour l'instant.":"🔔 Nothing new for now.","Rappel de pointage":"Clock-in reminder","Vous le rappeler si vous n'avez rien pointé depuis quelques jours.":"Remind you if you haven't logged anything for a few days.",
"Après 3 jours":"After 3 days","Après 7 jours":"After 7 days","Après 14 jours":"After 14 days","Notifications du navigateur":"Browser notifications",
"Recevoir les alertes même quand l'onglet est en arrière-plan. Propre à chaque appareil.":"Get alerts even when the tab is in the background. Specific to each device.",
"Activer":"Turn on","Désactiver":"Turn off","Bloquées par le navigateur":"Blocked by the browser","Non disponible sur ce navigateur":"Not available in this browser",
"Notifications activées":"Notifications on","Notifications désactivées":"Notifications off","Tableau de bord":"Dashboard","Tableau de bord de l'équipe":"Team dashboard","Période du tableau de bord":"Dashboard period","8 semaines":"8 weeks","12 semaines":"12 weeks","6 mois":"6 months",
"Heures par semaine":"Hours per week","Par projet":"By project","Par personne":"By person","Sans projet":"No project","Validées":"Approved","📊 Aucune heure sur cette période.":"📊 No hours in this period.",
"Semaine du {} : {} (dont {} validées)":"Week of {}: {} ({} approved)","Heures par semaine : {} au total":"Hours per week: {} in total","Affichage des projets":"Project view","Grille":"Grid","Chronologie":"Timeline","Date de début":"Start date","Sans date limite":"No deadline","Jalons":"Milestones",
"🏁 Aucun jalon pour l'instant.":"🏁 No milestones yet.","Ex. Envoi des invitations":"E.g. Send invitations","Nom du jalon":"Milestone name","Date du jalon":"Milestone date","Ajouter le jalon":"Add milestone",
"Indiquez le nom et la date du jalon.":"Enter the milestone name and date.","Jalon ajouté":"Milestone added","Jalon atteint":"Milestone reached","Jalon retiré":"Milestone removed",
"Durée et avancement":"Duration and progress","Jalon":"Milestone","🎥 Ajouter une salle vidéo (Jitsi Meet)":"🎥 Add a video room (Jitsi Meet)","Rejoindre la salle vidéo":"Join the video room","Copier le lien":"Copy link","Lien copié":"Link copied",
"Commence bientôt":"Starting soon","Réunion en cours : {}":"Meeting in progress: {}","Réunion bientôt : {}":"Meeting soon: {}","{} – {} · Rejoindre la salle vidéo":"{} – {} · Join the video room",
"Heures dans votre fuseau horaire : {}":"Times in your time zone: {}","Heures affichées dans votre fuseau horaire : {}":"Times shown in your time zone: {}","Heure de votre fuseau : {}":"Your time zone: {}",
"^Heure de votre fuseau : (.+?) · Heure de l'organisateur : (.+)$":"Your time zone: {} · Organizer's time: {}","Heure de l'organisateur : {} ({})":"Organizer's time: {} ({})","Salle vidéo : {}":"Video room: {}","📝 Notes de réunion":"📝 Meeting notes","Notes de réunion":"Meeting notes","🎥 Rejoindre":"🎥 Join","Exporter en PDF":"Export to PDF","Ordre du jour":"Agenda","Notes":"Notes",
"Discussions, points soulevés…":"Discussions, points raised…","Décisions":"Decisions","Ex. Le budget du gala est adopté":"E.g. The gala budget is adopted","Ajouter":"Add",
"Actions à faire":"Action items","Ex. Réserver la salle":"E.g. Book the room","Responsable":"Owner","Responsable…":"Owner…","Présences":"Attendance","Invités et absents excusés":"Guests and excused absences",
"Aucune décision notée.":"No decisions recorded.","Aucune action notée.":"No action items recorded.","Sans responsable":"No owner","✓ Tâche créée":"✓ Task created","^✓ Tâche créée · (.+)$":"✓ Task created · {}",
"Créer la tâche":"Create task","✍️ {} écrit aussi en ce moment.":"✍️ {} is also writing right now.","Dernière modification : {}, {} à {}.":"Last edited: {}, {} at {}.",
"^✍️ (.+) écrit aussi en ce moment\. Dernière modification : (.+), (.+) à (\d{1,2}:\d{2})\.$":"✍️ {} is also writing right now. Last edited: {}, {} at {}.",
"Ces notes ne peuvent pas être chargées (accès refusé).":"These notes cannot be loaded (access denied).","Enregistrement refusé":"Save denied","Procès-verbal":"Minutes","proces-verbal":"minutes",
"Issue de la réunion « {} » du {}.":"From the meeting “{}” on {}.","Après la réunion, chaque personne cochée reçoit une proposition d'entrée dans ses notifications, à valider ensuite.":"After the meeting, each checked person gets a suggested entry in their notifications, to be approved afterwards.",
"Ajouter mes heures":"Add my hours","Ajoutez vos heures de réunion : {}":"Add your meeting hours: {}","Réunion : {}":"Meeting: {}","Rapport d'activités":"Activity report","Format du rapport":"Report format","Condensé":"Condensed","Détaillé":"Detailed","Personnes":"People","Mois dernier":"Last month","Trimestre":"Quarter","Année":"Year",
"Tous les projets":"All projects","Heures":"Hours","Toutes les heures":"All hours","Heures validées seulement":"Approved hours only","Télécharger le PDF":"Download PDF","Toute l'équipe":"Whole team",
"Une page de synthèse : totaux, graphique, répartition par activité, projet et personne.":"A one-page summary: totals, chart, breakdown by activity, project and person.",
"La synthèse, puis toutes les entrées par personne, les tâches terminées, les jalons atteints et les réunions.":"The summary, then every entry per person, completed tasks, milestones reached and meetings.",
"Aucune heure sur cette période.":"No hours in this period.","Choisissez une période valide.":"Choose a valid period.","{} entrée{} · {} · {} personne{}":(n,s,d,p,s2)=>`${n} entr${s?"ies":"y"} · ${d} · ${p} ${s2?"people":"person"}`,
"Rapport d'activités détaillé":"Detailed activity report","Rapport d'activités condensé":"Condensed activity report","Du {} au {}":"From {} to {}","Personnes : {}":"People: {}","Projet : {}":"Project: {}",
"Entrées":"Entries","Valeur estimée":"Estimated value","Heures par mois":"Hours per month","Par activité":"By activity","Faits marquants":"Highlights","Tâches terminées":"Completed tasks","Jalons atteints":"Milestones reached","Réunions tenues":"Meetings held",
"Page {} sur {}":"Page {} of {}","rapport":"report","detaille":"detailed","condense":"condensed","Rapport téléchargé":"Report downloaded","Bonjour":"Hello","Bonsoir":"Good evening",
"^(.+) à (\\d{1,2}:\\d{2})$":"{} at {}"
}};

/* ---- Moteur de traduction (n'a rien à modifier pour ajouter une langue) ---- */
let LANG=(()=>{try{const l=localStorage.getItem("pointeuse-lang");return I18N[l]?l:"fr";}catch(e){return "fr";}})();
const LOC=()=>I18N[LANG]._locale||"fr-CA";
const DEC=()=>(1.5).toLocaleString(LOC()).charAt(1);
let _I18N_EXACT={},_I18N_PAT=[],_I18N_FRAG=[];
const _norm=s=>s.replace(/\s+/g," ").trim();
function i18nCompile(){
  const d=I18N[LANG]||{};_I18N_EXACT={};_I18N_PAT=[];_I18N_FRAG=[];
  const rx=s=>s.replace(/[.*+?^$()|[\]\\]/g,"\\$&");
  for(const k in d){
    if(k[0]==="_") continue;
    if(k[0]==="~"){_I18N_FRAG.push([_norm(k.slice(1)),d[k]]);continue;}
    if(k[0]==="^"){_I18N_PAT.push([new RegExp(k),d[k]]);continue;}
    const n=_norm(k);
    if(n.includes("{}")) _I18N_PAT.push([new RegExp("^"+n.split("{}").map(p=>rx(p).replace(/[{}]/g,"\\$&")).join("([\\s\\S]*?)")+"$"),d[k]]);
    else _I18N_EXACT[n]=d[k];
  }
  _I18N_FRAG.sort((a,b)=>b[0].length-a[0].length);
}
const _fill=(v,a)=>typeof v==="function"?v(...a):String(v).replace(/\{\}/g,()=>a.length?a.shift():"");
function _trCore(s,depth){
  if(s in _I18N_EXACT) return _I18N_EXACT[s];
  for(const [re,v] of _I18N_PAT){const m=re.exec(s);if(m){const g=m.slice(1).map(x=>depth<2&&x.trim()?_trCore(_norm(x),depth+1)??x:x);return _fill(v,g);}}
  if(depth>0) return null;
  let out=s,hit=false;for(const [f,v] of _I18N_FRAG){if(out.includes(f)){out=out.split(f).join(v);hit=true;}}
  return hit?out:null;
}
/* Traduit un texte affiché (garde les espaces autour) */
function tr(s){
  if(LANG==="fr"||!s||!/[A-Za-zÀ-ÿ]/.test(s)) return s;
  const core=_norm(s);const r=_trCore(core,0);
  if(r==null||r===core) return s;
  const lead=s.match(/^\s*/)[0],trail=s.match(/\s*$/)[0];
  return lead+r+trail;
}
/* Pour le code : tx("Texte {} avec {}", a, b) */
function tx(key,...a){
  if(LANG!=="fr"){const v=I18N[LANG][key];if(v!=null) return _fill(v,a.map(String));}
  return _fill(key,a.map(String));
}
/* Traduction automatique du DOM : textes et attributs, y compris ce qui est affiché plus tard */
const I18N_ATTRS=["title","aria-label","placeholder","alt"];
const _rec=new WeakMap();
const _skip=n=>{const p=n.nodeType===1?n:n.parentElement;return !p||/^(SCRIPT|STYLE|TEXTAREA|CODE)$/.test(p.tagName)||!!p.closest("[translate=no],[contenteditable=true]");};
function _doText(n,force){
  const cur=n.data,r=_rec.get(n);
  if(!force&&r&&cur===r.out) return;
  const fr=(r&&cur===r.out)?r.fr:cur;
  const out=_skip(n)?fr:tr(fr);
  _rec.set(n,{fr,out});if(out!==cur) n.data=out;
}
function _doAttr(el,a,force){
  const cur=el.getAttribute(a);if(cur==null) return;
  let m=_rec.get(el);if(!m){m={};_rec.set(el,m);}
  const r=m[a];if(!force&&r&&cur===r.out) return;
  const fr=(r&&cur===r.out)?r.fr:cur;const out=tr(fr);
  m[a]={fr,out};if(out!==cur) el.setAttribute(a,out);
}
function i18nTree(root,force){
  if(root.nodeType===3){_doText(root,force);return;}
  if(root.nodeType!==1||_skip(root)) return;
  const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT);let n=root;
  do{ if(n.nodeType===3) _doText(n,force); else I18N_ATTRS.forEach(a=>{if(n.hasAttribute(a))_doAttr(n,a,force);}); }while((n=w.nextNode()));
}
const _obs=new MutationObserver(list=>{
  for(const m of list){
    if(m.type==="characterData") _doText(m.target);
    else if(m.type==="attributes") _doAttr(m.target,m.attributeName);
    else m.addedNodes.forEach(n=>i18nTree(n));
  }
});
let _docTitle=null;
function i18nApply(force){
  document.documentElement.lang=LANG;
  if(_docTitle==null) _docTitle=document.title;
  document.title=tr(_docTitle);
  i18nTree(document.body,force);
}
function setLang(l){
  if(!I18N[l]) l="fr";
  LANG=l;try{localStorage.setItem("pointeuse-lang",l);}catch(e){}
  i18nCompile();i18nApply(true);
  if(window.onLangChange) window.onLangChange();
}
i18nCompile();i18nApply(false);
_obs.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:I18N_ATTRS});

