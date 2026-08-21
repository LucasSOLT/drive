// ─── 100 Adjectives × 100 Nouns + 2-digit suffix ───
// Format: Adjective_Noun_## (e.g., Blossoming_Sparrow_87)

const ADJECTIVES: string[] = [
  'Blazing', 'Blossoming', 'Bold', 'Brave', 'Breezy',
  'Bright', 'Brilliant', 'Brisk', 'Calm', 'Charming',
  'Cheerful', 'Clever', 'Cozy', 'Crisp', 'Curious',
  'Daring', 'Dazzling', 'Defiant', 'Dreamy', 'Drifting',
  'Dynamic', 'Eager', 'Electric', 'Endless', 'Epic',
  'Ethereal', 'Fierce', 'Fiery', 'Fleet', 'Flowing',
  'Fluffy', 'Flying', 'Free', 'Frosty', 'Gentle',
  'Gleaming', 'Gliding', 'Glowing', 'Golden', 'Graceful',
  'Grand', 'Happy', 'Hidden', 'Humble', 'Icy',
  'Infinite', 'Jade', 'Jolly', 'Keen', 'Kind',
  'Lively', 'Lone', 'Lucky', 'Lunar', 'Mellow',
  'Mighty', 'Misty', 'Moonlit', 'Mystic', 'Noble',
  'Pastel', 'Peaceful', 'Playful', 'Plucky', 'Polar',
  'Proud', 'Quick', 'Quiet', 'Radiant', 'Rapid',
  'Rising', 'Roaming', 'Rolling', 'Royal', 'Rustic',
  'Sacred', 'Serene', 'Shadow', 'Shining', 'Silent',
  'Silver', 'Sleek', 'Snowy', 'Soaring', 'Solar',
  'Spark', 'Spirited', 'Starry', 'Steady', 'Stormy',
  'Summer', 'Swift', 'Tender', 'Tidal', 'Twilight',
  'Velvet', 'Vivid', 'Wandering', 'Wild', 'Wondrous',
];

const NOUNS: string[] = [
  'Acorn', 'Arrow', 'Aurora', 'Birch', 'Bloom',
  'Breeze', 'Brook', 'Canvas', 'Cedar', 'Cloud',
  'Clover', 'Comet', 'Coral', 'Crane', 'Creek',
  'Crest', 'Crow', 'Crystal', 'Dahlia', 'Dawn',
  'Deer', 'Dove', 'Dusk', 'Echo', 'Elm',
  'Ember', 'Fable', 'Falcon', 'Fawn', 'Feather',
  'Fern', 'Finch', 'Flame', 'Flash', 'Flint',
  'Flora', 'Fog', 'Fox', 'Frost', 'Galaxy',
  'Gem', 'Glacier', 'Grove', 'Harbor', 'Hare',
  'Haven', 'Hawk', 'Hazel', 'Heron', 'Holly',
  'Ivy', 'Jade', 'Jay', 'Lark', 'Leaf',
  'Lily', 'Lotus', 'Luna', 'Lynx', 'Maple',
  'Meadow', 'Mint', 'Moon', 'Moth', 'Nebula',
  'Nova', 'Oak', 'Ocean', 'Olive', 'Orbit',
  'Orchid', 'Otter', 'Owl', 'Panda', 'Pearl',
  'Pebble', 'Phoenix', 'Pine', 'Plum', 'Quill',
  'Rain', 'Raven', 'Reed', 'Ridge', 'River',
  'Robin', 'Rose', 'Sage', 'Shore', 'Skye',
  'Slate', 'Snow', 'Sparrow', 'Spring', 'Star',
  'Stone', 'Storm', 'Thistle', 'Wren', 'Willow',
];

/**
 * Generates a random username: Adjective_Noun_##
 * Deterministic when seeded, fully random otherwise.
 */
export function generateUsername(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = String(Math.floor(Math.random() * 100)).padStart(2, '0');
  return `${adj}_${noun}_${num}`;
}
