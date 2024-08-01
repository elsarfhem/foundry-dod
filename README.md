# Deck of Destiny
![GitHub Release](https://img.shields.io/github/v/release/elsarfhem/foundry-dod)
![Static Badge](https://img.shields.io/badge/license-Commercial-cc?style=flat)

Deck of Destiny is an RPG game that is played with a deck of cards.

This repo contains some of the code for the game. The game is still in development and is not yet playable.
The module is meant to be used in Foundry VTT.

## Development

Run the following command to install the dependencies:
```Bash
nvm use
npm install --include=dev
```

Configure the `fvtt` installation and data folders
```Bash
fvtt configure set installPath /path/to/FoundryVTT/Data
fvtt configure set dataPath /path/to/FoundryVTT/Data
```

Check the configuration
```Bash
fvtt configure
```

### Change packs source files
If you want to make changes to packs, you can use the following command to generate the packs source files:
```Bash
npm run build:packs:src
```
Change source files in `Data/systems/dod/packs_src` and then run the following command to rebuild the packs:
```Bash
npm run build:packs:db
```
and commit the changes to the repo.

### Change packs database
If you want to make changes to packs in foundry, you can use the following command to update sources files:
```Bash
npm run build:packs:src
```
and commit the changes to the repo.
