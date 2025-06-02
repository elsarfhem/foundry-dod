# Contributing

## Table of Contents

- [Contributing to dod](#contributing-to-dod)
- [Development Setup](#development-setup)
- [Packs](#packs)
- [Linting](#linting)

## Contributing to dod

If you want to contribute to dod, be sure to read all the guidelines in this document and set up your development environment as described in the following sections.

## Development Setup

### Download this Repository

First, you need to clone this repository and place it or symlink it to your `Data/systems/dod` user data directory.

### Install `NodeJS` and `npm`

We suggest you install [Node Version Manager](https://github.com/nvm-sh/nvm) and run the following commands:

```bash
nvm install 20
nvm use 20
```

### Install and Build

To set up the development environment with all necessary dependencies, run the following commands:

```bash
cd dod  # Only if you are not already in the project folder
npm install  # Install all dependencies
npm run build  # Compile styles and packs files
```

## Packs

Compendia source JSON files are included under `src/packs`. To apply changes to them, you can proceed in two ways.

### Source Files

If you want to change the source JSON files, modify them under `src/packs` and then run the following command to build the packs:

```bash
npm run build:packs:db
```

### Database Files

If you want to make changes to packs in Foundry, use the following command to update the source files:

```bash
npm run build:packs:src
```

## Linting

To enforce a common code style across the code base we are using both `eslint` and `prettier`.
All warnings presented by the linters should be resolved before pushing changes.

Available commands:

- `npm run lint` - Run both `eslint` and `prettier` to check and display any issues found.
- `npm run lint:fix` - Automatically fix any code style issues that can be fixed.

## Create a RC candiate

Created a new tag
```bash
git tag 0.1.0-rc.x
```
Push the new tag to the remote repository
```bash
git push origin 0.1.0-rc.5
```
The pre-release workflow should now trigger because:
1. The tag matches the required pattern '..-rc.' in the workflow trigger
2. The base version (0.1.0) matches the version in system.json
3. The tag has been properly pushed to the remote repository