import { describe, it, expect } from 'vitest';
import { MockCard, MockCardsPile } from '../mocks/foundry.mjs';
import {
  SPECIAL_SUIT_PREFIX,
  DEFAULT_SPECIAL_CARD_IMG,
  generateSpecialSuit,
  isSpecialSuit,
  getSpecialCardDefinitions,
  buildSpecialCardData,
  createSpecialCardDefinition,
  updateSpecialCardDefinition,
  adjustSpecialCardCopies,
  deleteSpecialCardDefinition
} from '../../src/module/helpers/special-cards.mjs';

describe('special-cards: generateSpecialSuit', () => {
  it('returns a suit starting with the special prefix', () => {
    expect(generateSpecialSuit().startsWith(SPECIAL_SUIT_PREFIX)).toBe(true);
  });

  it('returns a different value on each call', () => {
    expect(generateSpecialSuit()).not.toBe(generateSpecialSuit());
  });
});

describe('special-cards: isSpecialSuit', () => {
  it('returns true for a special suit', () => {
    expect(isSpecialSuit('special:abc123')).toBe(true);
  });

  it('returns false for a base suit', () => {
    expect(isSpecialSuit('success')).toBe(false);
  });

  it('returns false for null/undefined', () => {
    expect(isSpecialSuit(null)).toBe(false);
    expect(isSpecialSuit(undefined)).toBe(false);
  });
});

describe('special-cards: getSpecialCardDefinitions', () => {
  it('returns an empty array for a deck with no special cards', () => {
    const deck = new MockCardsPile([new MockCard({ id: 'c1', suit: 'success' })]);
    expect(getSpecialCardDefinitions(deck)).toEqual([]);
  });

  it('groups multiple copies of the same special card into one definition', () => {
    const deck = new MockCardsPile([
      new MockCard({
        id: 'c1',
        suit: 'special:vento',
        name: 'Carta del Vento',
        description: 'Il vento cambia direzione.',
        faces: [{ name: 'Carta del Vento', img: 'vento.png', text: '' }]
      }),
      new MockCard({
        id: 'c2',
        suit: 'special:vento',
        name: 'Carta del Vento',
        description: 'Il vento cambia direzione.',
        faces: [{ name: 'Carta del Vento', img: 'vento.png', text: '' }]
      })
    ]);

    const definitions = getSpecialCardDefinitions(deck);
    expect(definitions).toHaveLength(1);
    expect(definitions[0]).toMatchObject({
      suit: 'special:vento',
      name: 'Carta del Vento',
      description: 'Il vento cambia direzione.',
      img: 'vento.png',
      available: 2
    });
  });

  it('excludes drawn copies from the available count', () => {
    const deck = new MockCardsPile([
      new MockCard({ id: 'c1', suit: 'special:vento', name: 'Carta del Vento', drawn: false }),
      new MockCard({ id: 'c2', suit: 'special:vento', name: 'Carta del Vento', drawn: true })
    ]);

    const [definition] = getSpecialCardDefinitions(deck);
    expect(definition.available).toBe(1);
  });

  it('keeps distinct special cards separate', () => {
    const deck = new MockCardsPile([
      new MockCard({ id: 'c1', suit: 'special:vento', name: 'Carta del Vento' }),
      new MockCard({ id: 'c2', suit: 'special:torre', name: 'Carta della Torre' })
    ]);

    const definitions = getSpecialCardDefinitions(deck);
    expect(definitions.map((d) => d.suit).sort()).toEqual(['special:torre', 'special:vento']);
  });
});

describe('special-cards: buildSpecialCardData', () => {
  it('builds card data with the power text in description and face text', () => {
    const data = buildSpecialCardData({
      suit: 'special:vento',
      name: 'Carta del Vento',
      description: 'Il vento cambia direzione.',
      img: 'vento.png'
    });

    expect(data).toMatchObject({
      name: 'Carta del Vento',
      type: 'base',
      description: 'Il vento cambia direzione.',
      suit: 'special:vento',
      value: 0,
      drawn: false
    });
    expect(data.faces[0]).toMatchObject({
      name: 'Carta del Vento',
      img: 'vento.png',
      text: 'Il vento cambia direzione.'
    });
  });

  it('always uses the default card-back image', () => {
    const data = buildSpecialCardData({
      suit: 'special:vento',
      name: 'Carta del Vento',
      description: 'Testo',
      img: 'vento.png'
    });

    expect(data.back.img).toBe('systems/dod/assets/cards/back.png');
  });

  it('falls back to the default card image when none is given', () => {
    const data = buildSpecialCardData({
      suit: 'special:vento',
      name: 'Carta del Vento',
      description: 'Testo',
      img: ''
    });
    expect(data.faces[0].img).toBe(DEFAULT_SPECIAL_CARD_IMG);
  });
});

describe('special-cards: createSpecialCardDefinition', () => {
  it('creates the requested number of copies sharing one suit', async () => {
    const deck = new MockCardsPile();
    const suit = await createSpecialCardDefinition(deck, {
      name: 'Carta del Vento',
      description: 'Testo',
      img: null,
      copies: 3
    });

    expect(suit.startsWith(SPECIAL_SUIT_PREFIX)).toBe(true);
    const created = Array.from(deck.cards.values()).filter((c) => c.suit === suit);
    expect(created).toHaveLength(3);
    created.forEach((c) => expect(c.name).toBe('Carta del Vento'));
  });
});

describe('special-cards: updateSpecialCardDefinition', () => {
  it('updates every matching card across all provided documents', async () => {
    const deck = new MockCardsPile([
      new MockCard({ id: 'c1', suit: 'special:vento', name: 'Carta del Vento' })
    ]);
    const hand = new MockCardsPile([
      new MockCard({ id: 'c2', suit: 'special:vento', name: 'Carta del Vento' })
    ]);

    await updateSpecialCardDefinition([deck, hand], 'special:vento', {
      name: 'Carta della Tempesta',
      description: 'Nuovo testo',
      img: 'tempesta.png'
    });

    expect(deck.cards.get('c1').name).toBe('Carta della Tempesta');
    expect(hand.cards.get('c2').name).toBe('Carta della Tempesta');
    expect(hand.cards.get('c2').faces[0].text).toBe('Nuovo testo');
  });

  it('leaves documents without matching cards untouched', async () => {
    const deck = new MockCardsPile([
      new MockCard({ id: 'c1', suit: 'special:vento', name: 'Carta del Vento' })
    ]);
    const pile = new MockCardsPile([new MockCard({ id: 'c2', suit: 'success' })]);

    await updateSpecialCardDefinition([deck, pile], 'special:vento', {
      name: 'Carta della Tempesta',
      description: 'Nuovo testo',
      img: null
    });

    expect(pile.cards.get('c2').name).toBe('Test Card');
  });
});

describe('special-cards: adjustSpecialCardCopies', () => {
  it('creates additional copies when increasing the desired count', async () => {
    const deck = new MockCardsPile([
      new MockCard({ id: 'c1', suit: 'special:vento', name: 'Carta del Vento' })
    ]);

    const result = await adjustSpecialCardCopies(deck, 'special:vento', 3, {
      name: 'Carta del Vento',
      description: 'Testo',
      img: null
    });

    expect(result).toEqual({ created: 2, deleted: 0, shortfall: 0 });
    expect(
      Array.from(deck.cards.values()).filter((c) => c.suit === 'special:vento')
    ).toHaveLength(3);
  });

  it('deletes un-drawn copies when decreasing the desired count', async () => {
    const deck = new MockCardsPile([
      new MockCard({ id: 'c1', suit: 'special:vento', name: 'Carta del Vento' }),
      new MockCard({ id: 'c2', suit: 'special:vento', name: 'Carta del Vento' }),
      new MockCard({ id: 'c3', suit: 'special:vento', name: 'Carta del Vento' })
    ]);

    const result = await adjustSpecialCardCopies(deck, 'special:vento', 1, {
      name: 'Carta del Vento',
      description: 'Testo',
      img: null
    });

    expect(result).toEqual({ created: 0, deleted: 2, shortfall: 0 });
    expect(
      Array.from(deck.cards.values()).filter((c) => c.suit === 'special:vento')
    ).toHaveLength(1);
  });

  it('reports a shortfall when not enough un-drawn copies exist to delete', async () => {
    const deck = new MockCardsPile([
      new MockCard({ id: 'c1', suit: 'special:vento', name: 'Carta del Vento', drawn: true }),
      new MockCard({ id: 'c2', suit: 'special:vento', name: 'Carta del Vento', drawn: true }),
      new MockCard({ id: 'c3', suit: 'special:vento', name: 'Carta del Vento', drawn: false })
    ]);

    // Wants to go from 3 to 1 (delete 2), but only 1 un-drawn copy exists.
    const result = await adjustSpecialCardCopies(deck, 'special:vento', 1, {
      name: 'Carta del Vento',
      description: 'Testo',
      img: null
    });

    expect(result).toEqual({ created: 0, deleted: 1, shortfall: 1 });
  });

  it('does nothing when the desired count matches the current count', async () => {
    const deck = new MockCardsPile([
      new MockCard({ id: 'c1', suit: 'special:vento', name: 'Carta del Vento' })
    ]);

    const result = await adjustSpecialCardCopies(deck, 'special:vento', 1, {
      name: 'Carta del Vento',
      description: 'Testo',
      img: null
    });

    expect(result).toEqual({ created: 0, deleted: 0, shortfall: 0 });
  });
});

describe('special-cards: deleteSpecialCardDefinition', () => {
  it('removes every copy across all provided documents', async () => {
    const deck = new MockCardsPile([
      new MockCard({ id: 'c1', suit: 'special:vento', name: 'Carta del Vento' })
    ]);
    const hand = new MockCardsPile([
      new MockCard({ id: 'c2', suit: 'special:vento', name: 'Carta del Vento' }),
      new MockCard({ id: 'c3', suit: 'success' })
    ]);

    await deleteSpecialCardDefinition([deck, hand], 'special:vento');

    expect(deck.cards.size).toBe(0);
    expect(hand.cards.has('c2')).toBe(false);
    expect(hand.cards.has('c3')).toBe(true);
  });
});
