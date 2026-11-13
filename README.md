# Lykos — démonstration 3D

Prototype web autonome d’un compagnon renard 3D, construit procéduralement avec PixiJS 3D. Le modèle est généré directement dans la scène : aucun fichier Blender ni modèle externe n’est nécessaire.

## Fonctionnalités

- Renard orange et crème, yeux bleus, oreilles dressées et queue touffue
- Sacoche de voyage verte avec détails dorés
- Caméra orbitale et contrôles tactiles
- Trois animations procédurales : observer, marcher et courir
- Interface adaptée aux écrans mobiles

## Lancer en local

Prérequis : Node.js 20 ou version ultérieure.

```bash
npm install
npm run dev
```

Pour créer la version de production :

```bash
npm run build
npm run preview
```

## Contrôles

- Glisser pour faire tourner la caméra
- Pincer pour zoomer sur écran tactile
- Utiliser Observer, Marcher et Courir pour changer l’animation

## État du prototype

Il s’agit d’une démonstration technique en évolution. Le rendu et la compatibilité Safari/iPad doivent encore être vérifiés sur appareils réels. Les mouvements sont procéduraux et ne constituent pas encore des animations squelettiques.
