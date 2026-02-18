import DeckOfDestinyActorBase from './base-actor.mjs';

/**
 * The DeckOfDestinyNPC class extends the DeckOfDestinyActorBase class with
 * NPC-specific data and behaviors for Deck of Destiny enemies.
 */
export default class DeckOfDestinyNPC extends DeckOfDestinyActorBase {
  /**
   * Define the schema for the DeckOfDestinyNPC.
   * @return {Object} The schema definition.
   */
  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    // Depth: number of successes required to defeat the NPC
    schema.depth = new fields.NumberField({
      ...requiredInteger,
      initial: 3,
      min: 1,
      max: 20
    });

    // Current successes accumulated towards defeating the NPC
    schema.currentSuccesses = new fields.NumberField({
      ...requiredInteger,
      initial: 0,
      min: 0
    });

    // Difficulty: number of Failure Cards (Carte Fallimento)
    schema.difficulty = new fields.NumberField({
      ...requiredInteger,
      initial: 5,
      min: 0
    });

    // Dangerousness: number of Mishap Cards (Carte Imprevisto)
    schema.dangerousness = new fields.NumberField({
      ...requiredInteger,
      initial: 3,
      min: 0
    });

    // Special attacks triggered by Mishap Cards
    schema.specialAttacks = new fields.ArrayField(
      new fields.SchemaField({
        name: new fields.StringField({ initial: '', blank: true }),
        description: new fields.StringField({ initial: '', blank: true }),
        effect: new fields.StringField({ initial: '', blank: true }),
        damageBonus: new fields.NumberField({
          initial: 0,
          min: 0,
          integer: true
        })
      })
    );

    // Story, background, and notes
    schema.story = new fields.HTMLField({ initial: '' });

    return schema;
  }

  /**
   * Calculate difficulty label based on numeric value.
   * @param {number} value - The difficulty value
   * @return {string} The localization key for the difficulty label
   */
  static getDifficultyLabel(value) {
    if (value >= 16) return 'DECK_OF_DESTINY.difficulty.estrema';
    if (value >= 9) return 'DECK_OF_DESTINY.difficulty.moltoDifficile';
    if (value >= 6) return 'DECK_OF_DESTINY.difficulty.difficile';
    if (value >= 4) return 'DECK_OF_DESTINY.difficulty.normale';
    if (value >= 1) return 'DECK_OF_DESTINY.difficulty.facile';
    return 'DECK_OF_DESTINY.difficulty.facile';
  }

  /**
   * Calculate dangerousness label based on numeric value.
   * @param {number} value - The dangerousness value
   * @return {string} The localization key for the dangerousness label
   */
  static getDangerousnessLabel(value) {
    if (value >= 11) return 'DECK_OF_DESTINY.dangerousness.estremo';
    if (value >= 6) return 'DECK_OF_DESTINY.dangerousness.grave';
    if (value >= 3) return 'DECK_OF_DESTINY.dangerousness.moderato';
    if (value >= 1) return 'DECK_OF_DESTINY.dangerousness.lieve';
    return 'DECK_OF_DESTINY.dangerousness.nessuno';
  }

  /**
   * Prepare derived data for the NPC.
   */
  prepareDerivedData() {
    // Calculate if NPC is defeated
    this.isDefeated = this.currentSuccesses >= this.depth;

    // Calculate progress percentage for visual display
    this.progressPercent = Math.min(
      100,
      Math.round((this.currentSuccesses / this.depth) * 100)
    );

    // Calculate difficulty and dangerousness labels
    this.difficultyLabel = DeckOfDestinyNPC.getDifficultyLabel(this.difficulty);
    this.dangerousnessLabel = DeckOfDestinyNPC.getDangerousnessLabel(
      this.dangerousness
    );
  }
}
