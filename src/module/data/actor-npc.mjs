import DeckOfDestinyActorBase from './base-actor.mjs';

/**
 * The DeckOfDestinyNPC class extends the DeckOfDestinyActorBase class with
 * NPC-specific data and behaviors.
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

    schema.cr = new fields.NumberField({ ...requiredInteger, initial: 1, min: 0 });
    schema.xp = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });

    return schema;
  }

  /**
   * Prepare derived data for the NPC.
   */
  prepareDerivedData() {
    this.xp = this.cr * this.cr * 100;
  }
}
