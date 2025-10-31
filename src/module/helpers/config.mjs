export const DECK_OF_DESTINY = {};

/**
 * The set of Characteristics Scores used within the system.
 * @type {Object}
 */
DECK_OF_DESTINY.characteristics = {
  bdy: 'DECK_OF_DESTINY.characteristics.body',
  mnd: 'DECK_OF_DESTINY.characteristics.mind',
  inu: 'DECK_OF_DESTINY.characteristics.intuition',
  spr: 'DECK_OF_DESTINY.characteristics.spirit',
  emp: 'DECK_OF_DESTINY.characteristics.empathy'
};

DECK_OF_DESTINY.cards = {
  success: 'DECK_OF_DESTINY.cards.success',
  failure: 'DECK_OF_DESTINY.cards.failure',
  issue: 'DECK_OF_DESTINY.cards.issue',
  fortune: 'DECK_OF_DESTINY.cards.fortune',
  destiny: 'DECK_OF_DESTINY.cards.destiny'
};

DECK_OF_DESTINY.conditions = {
  1: {
    value: 2,
    label: 'DECK_OF_DESTINY.conditions.1.label'
  },
  2: {
    value: 2,
    label: 'DECK_OF_DESTINY.conditions.2.label'
  },
  3: {
    value: 0,
    label: 'DECK_OF_DESTINY.conditions.3.label'
  }
};

DECK_OF_DESTINY.traumas = {
  1: {
    value: 0,
    label: 'DECK_OF_DESTINY.traumas.1.label',
    optional: true
  },
  2: {
    value: -2,
    label: 'DECK_OF_DESTINY.traumas.2.label', 
    optional: false
  },
  3: {
    value: -2,
    label: 'DECK_OF_DESTINY.traumas.3.label',
    optional: true
  },
  4: {
    value: -5,
    label: 'DECK_OF_DESTINY.traumas.4.label',
    optional: false
  },
  5: {
    value: -5,
    label: 'DECK_OF_DESTINY.traumas.5.label',
    optional: true
  },
  6: {
    value: 0,
    label: 'DECK_OF_DESTINY.traumas.6.label',
    optional: false
  }
};

DECK_OF_DESTINY.absorption = {
  0: 'DECK_OF_DESTINY.attributes.absorption.0.label',
  1: 'DECK_OF_DESTINY.attributes.absorption.1.label',
  2: 'DECK_OF_DESTINY.attributes.absorption.2.label',
  3: 'DECK_OF_DESTINY.attributes.absorption.3.label'
};

DECK_OF_DESTINY.mitigation = {
  0: 'DECK_OF_DESTINY.attributes.mitigation.0.label',
  1: 'DECK_OF_DESTINY.attributes.mitigation.1.label',
  2: 'DECK_OF_DESTINY.attributes.mitigation.2.label',
  3: 'DECK_OF_DESTINY.attributes.mitigation.3.label'
};
