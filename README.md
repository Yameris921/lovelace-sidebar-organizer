# Lovelace Sidebar Organizer

Regroupez les éléments de la sidebar Home Assistant en **menus dépliables**  
avec contrôle d'accès par rôle (Administrateur / Utilisateur / Visiteur).

---

## Fonctionnalités

- ✅ Groupes dépliables / repliables avec animation fluide
- ✅ Éléments ajoutés à un groupe → **disparaissent du menu principal**
- ✅ Éléments retirés d'un groupe → **réapparaissent dans le menu principal**
- ✅ 3 niveaux de rôle : Administrateur, Utilisateur, Visiteur
- ✅ Panel de configuration dédié (admins uniquement)
- ✅ Export / Import JSON
- ✅ État ouvert/fermé mémorisé par navigateur

---

## Installation

### 1. Fichier JS

**Via HACS** (recommandé) :
- HACS → ⋮ → Dépôts personnalisés → Ajouter l'URL GitHub → Catégorie : Frontend
- Installer "Lovelace Sidebar Organizer"

**Manuellement** :
- Copier `lovelace-sidebar-organizer.js` dans `/config/www/`

### 2. Ressource Lovelace

Paramètres → Tableau de bord → Resources → Ajouter :
```
URL  : /local/lovelace-sidebar-organizer.js
Type : Module JavaScript
```
*(Si HACS : l'URL sera `/hacsfiles/lovelace-sidebar-organizer/lovelace-sidebar-organizer.js`)*

### 3. Panel de configuration (configuration.yaml)

```yaml
panel_custom:
  - name: lovelace-sidebar-organizer
    sidebar_title: "Sidebar Organizer"
    sidebar_icon: mdi:layers-edit
    url_path: sidebar-organizer
    require_admin: true
```

Redémarrer Home Assistant après cette modification.

---

## Utilisation

Le panel **Sidebar Organizer** apparaît dans votre sidebar (admins uniquement).

### Onglet Groupes

| Action | Résultat |
|--------|----------|
| Cliquer un élément libre (＋) | L'ajoute au groupe, disparaît du menu principal |
| Cliquer un élément dans le groupe (✕) | Le retire du groupe, réapparaît dans le menu |
| Modifier le nom / l'icône | Mise à jour immédiate |
| Supprimer un groupe | Tous ses éléments retournent dans le menu principal |

### Onglet Visiteurs

Assignez le rôle **Visiteur** à des utilisateurs HA standards.  
Un simple bouton bascule entre `Utilisateur ↔ Visiteur`.

---

## Rôles et accès

| Accès du groupe | Admin | Utilisateur | Visiteur |
|-----------------|:-----:|:-----------:|:--------:|
| Tous | ✓ | ✓ | ✓ |
| Admin + Utilisateur | ✓ | ✓ | ✗ |
| Administrateurs uniquement | ✓ | ✗ | ✗ |
| Visiteurs uniquement | ✗ | ✗ | ✓ |
| Personnalisé | selon liste | selon liste | selon liste |

> **Note** : HA ne propose que deux rôles natifs (Admin / Utilisateur).  
> Le rôle Visiteur est géré par ce plugin via l'onglet Visiteurs.

---

## Configuration JSON (exemple)

```json
{
  "version": 1,
  "visitor_users": ["invite", "enfant"],
  "groups": [
    {
      "id": "suivi",
      "name": "Suivi",
      "icon": "mdi:chart-line",
      "items": ["logbook", "history"],
      "access": "all"
    },
    {
      "id": "outils",
      "name": "Outils",
      "icon": "mdi:tools",
      "items": ["hacs", "hassio"],
      "access": "admin"
    },
    {
      "id": "medias",
      "name": "Médias",
      "icon": "mdi:music",
      "items": ["media-browser"],
      "access": "user"
    },
    {
      "id": "famille",
      "name": "Famille",
      "icon": "mdi:home-heart",
      "items": ["lovelace"],
      "access": "custom",
      "access_users": ["marie", "thomas"]
    }
  ],
  "hidden_items": ["developer-tools", "map"]
}
```

---

## Noms des panneaux HA courants

| Affiché | `data-panel` |
|---------|-------------|
| Aperçu | `lovelace` |
| Journal | `logbook` |
| Historique | `history` |
| Carte | `map` |
| Énergie | `energy` |
| HACS | `hacs` |
| Média | `media-browser` |
| Studio Code Server | `hassio` |
| Automatisations | `config/automation` |
| Outils développeur | `developer-tools` |

---

## API JavaScript (console)

```javascript
// Accéder à la config actuelle
SidebarOrganizerAPI.getConfig()

// Sauvegarder une config manuellement
SidebarOrganizerAPI.saveConfig({ ...config })

// Forcer le rafraîchissement de la sidebar
SidebarOrganizerAPI.refresh()

// Connaître le rôle de l'utilisateur courant
SidebarOrganizerAPI.getUserRole()  // → 'admin' | 'user' | 'visitor'
```

---

## Licence

MIT — Contributions bienvenues.
