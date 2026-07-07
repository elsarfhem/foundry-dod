import { describe, it, expect, beforeEach } from 'vitest';
import { suitToName, createDrawChat, renderCardThumbnail } from '../../src/module/helpers/chat.mjs';

describe('chat: suitToName', () => {
  beforeEach(() => {
    global.game.i18n.localize = (key) =>
      key === 'DECK_OF_DESTINY.cards.success' ? 'Successo' : key;
  });

  it('localizes a known base suit', () => {
    expect(suitToName('success')).toBe('Successo');
  });

  it('falls back to the raw suit when no localization exists', () => {
    expect(suitToName('white')).toBe('white');
  });

  it('resolves a special suit to the given card name', () => {
    expect(suitToName('special:vento', 'Carta del Vento')).toBe('Carta del Vento');
  });

  it('falls back to the raw suit for a special suit with no card name', () => {
    expect(suitToName('special:vento')).toBe('special:vento');
  });
});

describe('chat: createDrawChat', () => {
  beforeEach(() => {
    global.game.i18n.localize = (key) => key;
  });

  it('does nothing for an empty draw', () => {
    expect(() => createDrawChat([], 1)).not.toThrow();
    expect(() => createDrawChat(null, 1)).not.toThrow();
  });

  it('groups drawn special cards by name in the summary', () => {
    const messages = [];
    global.ChatMessage = { create: (data) => messages.push(data) };

    createDrawChat(
      [
        { suit: 'special:vento', name: 'Carta del Vento', img: 'vento.png' },
        { suit: 'special:vento', name: 'Carta del Vento', img: 'vento.png' },
        { suit: 'success', name: 'Successo', img: 'success.png' }
      ],
      2
    );

    expect(messages).toHaveLength(1);
    expect(messages[0].content).toContain('Carta del Vento: 2');
    expect(messages[0].content).toContain('success: 1');
  });
});

describe('chat: renderCardThumbnail', () => {
  it('renders the image and a visible name caption', () => {
    const html = renderCardThumbnail({ name: 'Carta del Vento', img: 'vento.png' });
    expect(html).toContain('src="vento.png"');
    expect(html).toContain('class="card-thumb-name"');
    expect(html).toContain('>Carta del Vento<');
  });

  it('escapes HTML-sensitive characters in the name', () => {
    const html = renderCardThumbnail({ name: '<b>Evil</b> & "Quoted"', img: 'x.png' });
    expect(html).not.toContain('<b>Evil</b>');
    expect(html).toContain('&lt;b&gt;Evil&lt;/b&gt;');
    expect(html).toContain('&amp;');
  });

  it('escapes double quotes so they cannot break out of the alt/title attributes', () => {
    const html = renderCardThumbnail({ name: 'Evil" onmouseover="x', img: 'x.png' });
    expect(html).toContain('&quot;');
    // A real (unescaped) quote immediately followed by ` onmouseover="` would
    // mean the attacker's quote closed the attribute early, turning
    // onmouseover into a live, executable attribute. With correct escaping
    // this exact substring can never appear (the closing quote is `&quot;`,
    // not a literal `"`).
    expect(html).not.toContain('" onmouseover="');
  });
});
