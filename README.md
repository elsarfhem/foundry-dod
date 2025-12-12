# Foundry DoD

## Development Setup

### Prerequisites
- Node.js
- npm

### Installation
1. Clone the repository
2. Run `npm install` to install dependencies
3. Git hooks for linting will be automatically installed

### Available Scripts
- `npm run build` - Build all assets
- `npm run lint` - Check code formatting and lint issues
- `npm run lint:fix` - Fix code formatting and lint issues
- `npm run watch` - Watch for changes to SCSS files

### Git Hooks
This project uses husky to manage git hooks:

- **pre-push**: Runs linting checks before allowing a push to the repository
  - If linting fails, the push will be blocked
  - Run `npm run lint:fix` to fix issues

To bypass hooks if necessary (not recommended):
```
git push --no-verify
```

# Deck of Destiny

![GitHub Release](https://img.shields.io/github/v/release/elsarfhem/foundry-dod)
![Static Badge](https://img.shields.io/badge/license-Commercial-cc?style=flat)

Deck of Destiny is an RPG game that is played with a deck of cards. This system is designed to be used with Foundry Virtual Tabletop (Foundry VTT).

> [!CAUTION]
> This repo contains the code for the game. The game is still in development and is not yet fully playable.
> The system is meant to be used in Foundry VTT.

## Features

- Basic character sheet with attributes, skills, talents, inventory, traumas and conditions tracking
- Localization support with initial translations for English and Italian
- Compendium packs for cards, macros, and journals
- Basic styling and layout for character sheets and item sheets

## Installation

### Installing via Foundry VTT Package Installation System

To install the Deck of Destiny system using the Foundry VTT package installation system, follow these steps:

1. From the Setup screen, navigate to the **Game Systems** tab.
2. Click the **Install System** button at the bottom of the menu.
3. A package installation browser will appear, allowing you to see all of the Game Systems currently available for Foundry VTT.
4. Search for "Deck of Destiny" using the search field or filter the listing using package categories.
5. Once you have found the Deck of Destiny system, click the **Install** button to the right of the system's name. Foundry VTT will download and install it for you.

### Manual Installation

If the Deck of Destiny system has not yet been officially released, you can install it manually using the manifest URL:

1. From the Setup screen, navigate to the **Game Systems** tab.
2. Click the **Install System** button at the bottom of the menu.
3. In the **Manifest URL** field, paste the following URL:
   `https://github.com/elsarfhem/foundry-dod/releases/latest/download/system.json`
4. Click the **Install** button to download and install the system.

### Updating Game Systems

To keep your game systems up to date, periodically check for updates from the **Game Systems** tab of the main Foundry VTT menus:

1. Navigate to the **Game Systems** tab.
2. Click the **Check Update** button next to the Deck of Destiny system entry to check for updates.
3. Alternatively, use the **Update All** button at the bottom of the tab to check all of your installed systems for updates. Updates will be automatically applied if available.

## Usage

Once the system is installed, you can create a new world in Foundry VTT and select Deck of Destiny as the game system. You can then create characters, manage items, and use the compendium packs provided with the system.

## Patch Notes

Check the [CHANGELOG.md](./CHANGELOG.md) for detailed patch notes and updates.

## Contributing

We welcome contributions to the Deck of Destiny system. Check the [CONTRIBUTING](CONTRIBUTING.md) file for guidelines on how to contribute.

## License

This project is licensed under a Commercial license. See the [LICENSE](./LICENSE) file for details.
