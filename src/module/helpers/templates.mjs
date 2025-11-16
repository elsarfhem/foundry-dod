/**
 * Define a set of template paths to pre-load
 * Pre-loaded templates are compiled and cached for fast access when rendering
 * @return {Promise}
 */
export const preloadHandlebarsTemplates = async function () {
  return loadTemplates([
    // Actor partials.
    'systems/dod/src/templates/actor/parts/actor-characteristics.hbs',
    'systems/dod/src/templates/actor/parts/actor-abilities.hbs',
    'systems/dod/src/templates/actor/parts/actor-talents.hbs',
    'systems/dod/src/templates/actor/parts/actor-conditions.hbs',
    'systems/dod/src/templates/actor/parts/actor-traumas.hbs',
    'systems/dod/src/templates/actor/parts/actor-items.hbs',
    'systems/dod/src/templates/actor/parts/actor-item-row.hbs',
    'systems/dod/src/templates/actor/parts/actor-powers.hbs',
    'systems/dod/src/templates/actor/parts/actor-header-cards.hbs'
  ]);
};
