export const DECK_OF_DESTINY = {};

/**
 * The set of Characteristic Scores used within the system.
 * @type {Object}
 */
DECK_OF_DESTINY.characteristics = {
  bdy: 'DECK_OF_DESTINY.Characteristic.Bdy.long',
  mnd: 'DECK_OF_DESTINY.Characteristic.Mnd.long',
  inu: 'DECK_OF_DESTINY.Characteristic.Inu.long',
  spr: 'DECK_OF_DESTINY.Characteristic.Spr.long',
  emp: 'DECK_OF_DESTINY.Characteristic.Emp.long'
};

DECK_OF_DESTINY.characteristicAbbreviations = {
  bdy: 'DECK_OF_DESTINY.Characteristic.Bdy.abbr',
  mnd: 'DECK_OF_DESTINY.Characteristic.Mnd.abbr',
  inu: 'DECK_OF_DESTINY.Characteristic.Inu.abbr',
  spr: 'DECK_OF_DESTINY.Characteristic.Spr.abbr',
  emp: 'DECK_OF_DESTINY.Characteristic.Emp.abbr'
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
    'system.label': '+2 FAILURES'
  },
  {
    name: '2',
    type: 'condition',
    'system.value': 2,
    'system.label': '+2 FAILURES'
  },
  {
    name: '3',
    type: 'condition',
    'system.value': 0,
    'system.label': 'DEAD/UNCONSCIOUS'
  },
  {
    name: 'a',
    type: 'trauma',
    'system.value': -2,
    'system.label': '-2 Successes'
  },
  {
    name: 'b',
    type: 'trauma',
    'system.value': -5,
    'system.label': '-5 Successes'
  },
  {
    name: 'c',
    type: 'trauma',
    'system.value': 0,
    'system.label': 'Dying'
  }
];
