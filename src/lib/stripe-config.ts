// Internal configuration mapping Stripe Product IDs to tier rewards
export const STRIPE_PRODUCT_MAP: Record<string, { tier: string; credits: number; tokens?: number }> = {
  'prod_V39P0bldW5B81K': { tier: 'single', credits: 800, tokens: 1 },
  'prod_V39QUI2q0UksUE': { tier: 'monthly', credits: 4000, tokens: 999 },
  'prod_V39Rk4GFXUQzfr': { tier: 'credits_5', credits: 4000 },
  'prod_V39RrcOuNLHL0k': { tier: 'credits_10', credits: 8000 },
  'prod_V39tRiQNNkEakV': { tier: 'credits_20', credits: 16000 },
  'prod_V3A8hGCwQIErJo': { tier: 'credits_50', credits: 42000 },
  'prod_V3A8yTBkbqjOSy': { tier: 'credits_100', credits: 88000 },
};
