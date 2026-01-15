// Placeholder life cycle inventory factors (kg CO2e per kg) used for rough eco estimates.
// Replace with vetted dataset (e.g., Agribalyse, ecoinvent) for production use.
export const lciFactors: Record<string, { 'Climate change': number }> = {
  // Common staples (illustrative values only)
  'beef|cattle': { 'Climate change': 60 },
  milk: { 'Climate change': 1.3 },
  bread: { 'Climate change': 1.0 },
  'wheat flour': { 'Climate change': 0.8 },
  rice: { 'Climate change': 2.7 },
  potato: { 'Climate change': 0.4 },
};
