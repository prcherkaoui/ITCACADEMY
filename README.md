# ITCACADEMY — www.itcacademy.online

Site web officiel du centre de formation à distance **ITCACADEMY** (Informatique et Communication).

## Fichiers principaux
- `index.html` : page d'accueil (carrousel, vidéo, formations, devis PDF + WhatsApp, contact, traduction Darija Marocaine 3D)
- `inscription.html` : page dédiée au formulaire d'inscription (base JSON chiffrée AES-256-GCM + espace administrateur + export Excel `.xlsx`)
- `style.css` : styles, thème clair/sombre, RTL Darija et bouton 3D
- `script.js`, `i18n-darija.js`, `inscriptions-ui.js` : logique interactive
- `CNAME`, `.nojekyll`, `robots.txt`, `sitemap.xml` : configuration GitHub Pages pour `www.itcacademy.online`
- `.github/workflows/deploy-pages.yml` : publication automatique sur GitHub Pages (fichiers statiques uniquement)

## Publication directe sur GitHub Pages (`www.itcacademy.online`)

### 1. Envoyer le code sur GitHub
Poussez ce dépôt sur la branche `main` de votre dépôt GitHub. Le fichier `CNAME` (`www.itcacademy.online`) et le workflow `.github/workflows/deploy-pages.yml` sont déjà configurés.

### 2. Activer GitHub Pages
1. Dans votre dépôt GitHub, ouvrez **Settings → Pages**.
2. Dans **Build and deployment → Source**, choisissez **GitHub Actions** (recommandé, utilise `.github/workflows/deploy-pages.yml`) ou **Deploy from a branch** (`main` / `/ (root)`).
3. Dans **Custom domain**, vérifiez que `www.itcacademy.online` est renseigné puis cochez **Enforce HTTPS** dès que le certificat SSL est généré.

### 3. Configurer les DNS de `itcacademy.online`
Chez votre registraire de nom de domaine (Namecheap, OVH, Cloudflare, GoDaddy, etc.) :

- **Pour `www.itcacademy.online` (CNAME)** :
  - Type : `CNAME` | Nom / Host : `www` | Valeur : `<VOTRE-NOM-GITHUB>.github.io`
- **Pour `itcacademy.online` (redirection vers `www.itcacademy.online`, enregistrements A)** :
  - `185.199.108.153`
  - `185.199.109.153`
  - `185.199.110.153`
  - `185.199.111.153`

Une fois la propagation DNS terminée (quelques minutes à quelques heures), votre site sera directement accessible sur **https://www.itcacademy.online**.
