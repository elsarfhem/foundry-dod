export const DECK_OF_DESTINY = {};

/**
 * The set of Characteristics Scores used within the system.
 * @type {Object}
 */
DECK_OF_DESTINY.characteristics = {
  bdy: 'DECK_OF_DESTINY.Characteristics.Bdy.long',
  mnd: 'DECK_OF_DESTINY.Characteristics.Mnd.long',
  inu: 'DECK_OF_DESTINY.Characteristics.Inu.long',
  spr: 'DECK_OF_DESTINY.Characteristics.Spr.long',
  emp: 'DECK_OF_DESTINY.Characteristics.Emp.long'
};

DECK_OF_DESTINY.characteristicAbbreviations = {
  bdy: 'DECK_OF_DESTINY.Characteristics.Bdy.abbr',
  mnd: 'DECK_OF_DESTINY.Characteristics.Mnd.abbr',
  inu: 'DECK_OF_DESTINY.Characteristics.Inu.abbr',
  spr: 'DECK_OF_DESTINY.Characteristics.Spr.abbr',
  emp: 'DECK_OF_DESTINY.Characteristics.Emp.abbr'
};

DECK_OF_DESTINY.cards = {
  success: 'DECK_OF_DESTINY.Cards.Success',
  failure: 'DECK_OF_DESTINY.Cards.Failure',
  issue: 'DECK_OF_DESTINY.Cards.Issue',
  fortune: 'DECK_OF_DESTINY.Cards.Fortune',
  destiny: 'DECK_OF_DESTINY.Cards.Destiny'
};

DECK_OF_DESTINY.fixedItems = [
  {
    name: '1',
    type: 'condition',
    'system.value': 2,
    'system.label': 'DECK_OF_DESTINY.Conditions.1.label'
  },
  {
    name: '2',
    type: 'condition',
    'system.value': 2,
    'system.label': 'DECK_OF_DESTINY.Conditions.2.label'
  },
  {
    name: '3',
    type: 'condition',
    'system.value': 0,
    'system.label': 'DECK_OF_DESTINY.Conditions.3.label'
  },
  {
    name: 'a',
    type: 'trauma',
    'system.value': -2,
    'system.label': 'DECK_OF_DESTINY.Traumas.1.label'
  },
  {
    name: 'b',
    type: 'trauma',
    'system.value': -5,
    'system.label': 'DECK_OF_DESTINY.Traumas.2.label'
  },
  {
    name: 'c',
    type: 'trauma',
    'system.value': 0,
    'system.label': 'DECK_OF_DESTINY.Traumas.3.label'
  }
];
