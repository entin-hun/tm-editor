import { Pokedex, ProductInstance, FoodInstance } from '@trace.market/types';
import { lciFactors } from '../data/lci-factors';
import { llmService } from './ai/LLMService';

export interface EcoImpactResult {
  carbon: number; // Total kg CO2e for the instance quantity
  intensity: number; // kg CO2e per kg of product
  breakdown: Array<{ name: string; impact: number; percentage: number }>;
  source: 'database' | 'calculated' | 'unknown' | 'ai-estimated';
}

// Helper to check if string matches regex key
function matchesKey(text: string, pattern: string): boolean {
  try {
    const regex = new RegExp(pattern, 'i');
    return regex.test(text);
  } catch (e) {
    return false;
  }
}

function findLciFactor(
  type: string,
  extraFactors: Record<string, number> = {}
): number | null {
  if (extraFactors[type] !== undefined) {
    return extraFactors[type];
  }

  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const typeNorm = normalize(type);
  if (!typeNorm) return null;

  for (const key in lciFactors) {
    if (matchesKey(type, key)) {
      return lciFactors[key]['Climate change'] || null;
    }
  }

  for (const key in lciFactors) {
    const keyClean = normalize(key.replace(/[.*]/g, ' '));
    if (keyClean.includes(typeNorm)) {
      return lciFactors[key]['Climate change'] || null;
    }
  }

  for (const key in lciFactors) {
    const keyClean = normalize(key.replace(/[.*]/g, ' '));
    if (keyClean.length > 3 && typeNorm.includes(keyClean)) {
      return lciFactors[key]['Climate change'] || null;
    }
  }

  const words = type
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 3);
  let bestMatchKey = '';
  let maxMatches = 0;

  for (const key in lciFactors) {
    const keyClean = normalize(key.replace(/[.*]/g, ' '));
    let matches = 0;
    for (const w of words) {
      if (keyClean.includes(w)) matches++;
    }
    if (matches > maxMatches) {
      maxMatches = matches;
      bestMatchKey = key;
    }
  }

  if (maxMatches > 0 && bestMatchKey) {
    return lciFactors[bestMatchKey]['Climate change'] || null;
  }

  return null;
}

function isFoodInstance(instance: ProductInstance): instance is FoodInstance {
  return instance.category === 'food' || (instance as any).type !== undefined;
}

export function calculateEcoImpact(
  instance: ProductInstance,
  extraFactors: Record<string, number> = {}
): EcoImpactResult {
  if (!instance) {
    return { carbon: 0, intensity: 0, breakdown: [], source: 'unknown' };
  }

  const quantityKg = (instance.quantity || 0) / 1000;

  const hasInputs =
    isFoodInstance(instance) &&
    instance.process?.inputInstances &&
    instance.process.inputInstances.length > 0;

  if (!hasInputs) {
    const factor = findLciFactor(instance.type, extraFactors);
    if (factor !== null) {
      const total = factor * quantityKg;
      return {
        carbon: total,
        intensity: factor,
        breakdown: [{ name: instance.type, impact: total, percentage: 100 }],
        source:
          extraFactors[instance.type] !== undefined
            ? 'ai-estimated'
            : 'database',
      };
    }
    return { carbon: 0, intensity: 0, breakdown: [], source: 'unknown' };
  }

  let totalCarbon = 0;
  const breakdown: Array<{ name: string; impact: number; percentage: number }> =
    [];

  if (isFoodInstance(instance) && instance.process?.inputInstances) {
    for (const input of instance.process.inputInstances) {
      if (typeof input.instance !== 'object' || !input.instance) {
        continue;
      }

      const subResult = calculateEcoImpact(
        input.instance as ProductInstance,
        extraFactors
      );
      const inputMassKg = (input.quantity || 0) / 1000;
      const impactContribution = subResult.intensity * inputMassKg;

      totalCarbon += impactContribution;

      breakdown.push({
        name: (input.instance as ProductInstance).type || 'Unknown',
        impact: impactContribution,
        percentage: 0,
      });
    }

    if (instance.process.impacts) {
      for (const impact of instance.process.impacts) {
        if (impact.category === 'carbon') {
          totalCarbon += impact.quantity;
          breakdown.push({
            name: 'Direct Process Emissions',
            impact: impact.quantity,
            percentage: 0,
          });
        }
      }
    }
  }

  const finalIntensity = quantityKg > 0 ? totalCarbon / quantityKg : 0;

  breakdown.forEach((b) => {
    b.percentage = totalCarbon > 0 ? (b.impact / totalCarbon) * 100 : 0;
  });
  breakdown.sort((a, b) => b.impact - a.impact);

  return {
    carbon: totalCarbon,
    intensity: finalIntensity,
    breakdown,
    source: 'calculated',
  };
}

function collectUnknownTypes(
  instance: ProductInstance,
  found: Set<string> = new Set()
): Set<string> {
  if (!instance) return found;

  const hasInputs =
    isFoodInstance(instance) &&
    instance.process?.inputInstances &&
    instance.process.inputInstances.length > 0;

  if (!hasInputs) {
    if (findLciFactor(instance.type) === null) {
      found.add(instance.type);
    }
  } else if (isFoodInstance(instance) && instance.process?.inputInstances) {
    for (const input of instance.process.inputInstances) {
      if (typeof input.instance === 'object') {
        collectUnknownTypes(input.instance as ProductInstance, found);
      }
    }
  }
  return found;
}

export function estimateEco(pokedex: Pokedex): EcoImpactResult {
  return calculateEcoImpact(pokedex.instance);
}

export async function estimateEcoWithAI(
  pokedex: Pokedex,
  onStatus?: (msg: string) => void
): Promise<EcoImpactResult> {
  let result = calculateEcoImpact(pokedex.instance);

  const unknowns = Array.from(collectUnknownTypes(pokedex.instance));

  if (unknowns.length === 0) {
    return result;
  }

  if (onStatus)
    onStatus(
      `Found ${unknowns.length} unknown items. querying AI benchmarks...`
    );

  try {
    const prompt = `
I need the Carbon Footprint (Global Warming Potential 100y, cradle-to-gate) for the following food products.
Usage: Eco-design tool.
Sources: Look in openLCA datasets, Agribalyse, CarbonCloud, or reliable scientific literature.
Output: valid JSON object {"productName": number_kg_CO2e_per_kg, ...}.
If you cannot find a specific match, provide a best estimate for a generic versions.
If absolutely unknown, use 0.

Products:
${unknowns.map((u) => `- ${u}`).join('\n')}

JSON Response:
`;
    const responseText = await llmService.complete(prompt);

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const aiFactors = JSON.parse(jsonMatch[0]);

      result = calculateEcoImpact(pokedex.instance, aiFactors);
    }
  } catch (e) {
    console.error('AI Estimation failed', e);
  }

  return result;
}
