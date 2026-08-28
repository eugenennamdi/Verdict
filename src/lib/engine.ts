import { GoogleGenAI, Type } from '@google/genai';
import { computeOverallScore } from '@/lib/audit/score';
import { safeNativeFetch, UnsafeUrlError } from '@/lib/security/url';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || ''
});

// We temporarily use flash-lite as primary since 3.5-flash is timing out
const PRIMARY_MODEL = 'gemini-3.1-flash-lite';
const FALLBACK_MODEL = 'gemini-3.1-flash-lite';

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT_ERROR')), ms))
  ]);
};

export class ScrapingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScrapingError';
  }
}

async function generateWithFallback(prompt: string, schema: unknown) {
  try {
    return await withTimeout(ai.models.generateContent({
      model: PRIMARY_MODEL,
      contents: prompt,
      config: {
        temperature: 0.0,
        responseMimeType: 'application/json',
        responseSchema: schema,
      }
    }), 20000);
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    const isHighDemand = errorMsg.includes('503') || errorMsg.includes('high demand') || errorMsg.includes('UNAVAILABLE') || errorMsg.includes('429') || errorMsg.includes('TIMEOUT_ERROR');
    
    if (isHighDemand) {
      console.warn(`[Engine] Primary model ${PRIMARY_MODEL} unavailable/timed out, falling back to ${FALLBACK_MODEL}...`);
      try {
        return await withTimeout(ai.models.generateContent({
          model: FALLBACK_MODEL,
          contents: prompt,
          config: {
            temperature: 0.0,
            responseMimeType: 'application/json',
            responseSchema: schema,
          }
        }), 20000);
      } catch (fallbackError: unknown) {
        const fallbackMsg = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
        if (fallbackMsg.includes('503') || fallbackMsg.includes('high demand') || fallbackMsg.includes('UNAVAILABLE') || fallbackMsg.includes('429') || fallbackMsg.includes('TIMEOUT_ERROR')) {
          throw new Error("MODEL_HIGH_DEMAND");
        }
        throw fallbackError;
      }
    }
    throw e;
  }
}

// Define explicit schemas for the structured outputs
const extractSchema = {
  type: Type.OBJECT,
  properties: {
    is_valid_startup: { type: Type.BOOLEAN },
    invalid_reason: { type: Type.STRING },
    company_name: { type: Type.STRING },
    inferred_description: { type: Type.STRING },
    target_audience: { type: Type.STRING },
    primary_cta: { type: Type.STRING }
  },
  required: ["is_valid_startup", "invalid_reason", "company_name", "inferred_description", "target_audience", "primary_cta"]
};

const pillarSchema = {
  type: Type.OBJECT,
  properties: {
    score: { type: Type.INTEGER },
    confidence: { type: Type.STRING },
    reason: { type: Type.STRING },
    strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
    weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } }
  },
  required: ["score", "confidence", "reason", "strengths", "weaknesses"]
};

const priorityMatrixItemSchema = {
  type: Type.OBJECT,
  properties: {
    task: { type: Type.STRING },
    impact: { type: Type.STRING },
    effort: { type: Type.STRING },
    why: { type: Type.STRING }
  },
  required: ["task", "impact", "effort", "why"]
};

const auditProperties = {
  company_name: { type: Type.STRING },
  score_interpretation: { type: Type.STRING },
  pillars: {
    type: Type.OBJECT,
    properties: {
      positioning: pillarSchema,
      messaging: pillarSchema,
      website_ux: pillarSchema,
      conversion: pillarSchema,
      trust: pillarSchema,
      competition: pillarSchema,
      growth_foundation: pillarSchema
    },
    required: ["positioning", "messaging", "website_ux", "conversion", "trust", "competition", "growth_foundation"]
  },
  the_verdict: {
    type: Type.OBJECT,
    properties: {
      status: { type: Type.STRING },
      primary_constraint: { type: Type.STRING },
      highest_opportunity: { type: Type.STRING },
      estimated_impact: { type: Type.STRING }
    },
    required: ["status", "primary_constraint", "highest_opportunity", "estimated_impact"]
  },
  priority_matrix: {
    type: Type.ARRAY,
    items: priorityMatrixItemSchema
  }
};

const auditSchema = {
  type: Type.OBJECT,
  properties: auditProperties,
  required: ["company_name", "score_interpretation", "pillars", "the_verdict", "priority_matrix"]
};

const fullAuditSchema = {
  type: Type.OBJECT,
  properties: {
    is_valid_startup: { type: Type.BOOLEAN },
    invalid_reason: { type: Type.STRING },
    ...auditProperties
  },
  required: ["is_valid_startup", "invalid_reason", "company_name", "score_interpretation", "pillars", "the_verdict", "priority_matrix"]
};

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
];

export async function fetchContext(url: string, fallback_text?: string): Promise<string> {
  if (fallback_text && fallback_text.trim().length > 10) {
    return fallback_text;
  }

  let markdownContext = '';

  // 1. Scrape with Firecrawl
  const firecrawlKey = process.env.FIRECRAWL_API_KEY;
  if (firecrawlKey) {
    try {
      const firecrawlRes = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${firecrawlKey}`,
        },
        body: JSON.stringify({ 
          url, 
          formats: ['markdown'],
          timeout: 25000 // Increased timeout for heavy JS/Cloudflare sites
        }),
        signal: AbortSignal.timeout(25000)
      });

      if (firecrawlRes.ok) {
        const scrapedData = await firecrawlRes.json();
        markdownContext = scrapedData.data?.markdown || '';
      }
    } catch (e) {
      console.warn("Firecrawl scraping failed or timed out:", e);
    }
  }

  // 2. Fallback to Jina AI if Firecrawl fails or gets blocked
  if (!markdownContext || markdownContext.length < 50) {
    try {
      const jinaRes = await fetch(`https://r.jina.ai/${url}`, {
        headers: { 'Accept': 'text/plain' },
        signal: AbortSignal.timeout(15000)
      });
      if (jinaRes.ok) {
        markdownContext = await jinaRes.text();
      }
    } catch (e) {
      console.warn("Jina AI fallback failed or timed out:", e);
    }
  }

  // 3. Last Resort Fallback to Native Fetch with Retry and UA Rotation
  if (!markdownContext || markdownContext.length < 50) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const nativeRes = await safeNativeFetch(url, {
          headers: {
            'User-Agent': USER_AGENTS[attempt % USER_AGENTS.length],
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
          },
          signal: AbortSignal.timeout(10000)
        });
        
        if (nativeRes.ok) {
          const html = await nativeRes.text();
          // Extremely crude strip of scripts and styles to avoid massive token count
          markdownContext = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                                .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
                                .replace(/<[^>]+>/g, ' ')
                                .replace(/\s+/g, ' ').trim();
          if (markdownContext.length > 50) break;
        } else if (nativeRes.status === 403 || nativeRes.status === 429 || nativeRes.status === 401 || nativeRes.status === 503) {
          // Add brief backoff if blocked
          await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
        }
      } catch (e) {
        if (e instanceof UnsafeUrlError) {
          console.warn("Native fetch blocked unsafe URL:", e.message);
          break;
        }
        console.warn(`Native fetch fallback failed on attempt ${attempt + 1}:`, e);
      }
    }
  }

  if (!markdownContext || markdownContext.length < 50) {
    console.error(`[UNREACHABLE_URL]: ${url}`);
    throw new ScrapingError('This website took too long to load or is actively blocking our scraper. Please provide the raw website text manually.');
  }

  return markdownContext;
}

export async function identifyFromMarkdown(markdownContext: string) {
  const prompt = `
You are a ruthless, cynical startup auditor.
Based on the following markdown scraped from a landing page, your first task is to determine if this is a valid SaaS, B2B, or B2C startup/company. 
If it is a personal portfolio, blog, github repository, or agency, set "is_valid_startup" to false and provide a professional, elegant rejection message in "invalid_reason" (e.g., "This appears to be a personal portfolio. Verdict is designed specifically for SaaS and startup landing pages. Please provide a valid company URL.").
If it is a valid startup, extract the exact company name, a brutally honest inferred description of what they actually do (cut through the marketing fluff), and who their real target audience is.

Markdown Content:
${markdownContext}
  `;

  const aiResponse = await generateWithFallback(prompt, extractSchema);

  const resultText = aiResponse.text;
  if (!resultText) {
    throw new Error('No response from AI engine');
  }

  let extractedData;
  try {
    extractedData = JSON.parse(resultText);
  } catch (e) {
    console.warn("[extractContext] JSON parsing failed:", e);
    throw new Error("The AI failed to generate a valid analysis for this website. Please try again.");
  }

  if (extractedData?.is_valid_startup === false) {
    throw new Error(extractedData.invalid_reason || 'This URL is not a valid startup or company website.');
  }

  return extractedData;
}

export async function extractContext(url: string, fallback_text?: string) {
  const markdownContext = await fetchContext(url, fallback_text);
  return identifyFromMarkdown(markdownContext);
}

export async function generateAudit(url: string, extractedContext: Record<string, unknown>) {
  const company_name = extractedContext.company_name as string;
  const inferred_description = extractedContext.inferred_description as string;
  const target_audience = extractedContext.target_audience as string;

  const prompt = `
# ROLE & PERSONA
You are an elite Silicon Valley Growth Consultant, a seasoned YC Partner, and a completely fair, objective Judge. You are the core intelligence engine for Verdict. Your purpose is to provide a highly accurate, dynamic diagnostic assessment of a startup's growth readiness based on web-scraped data. You do not sugarcoat reality, but you are never rude or mocking. You speak with analytical precision and calm, professional authority.

# THE GROWTH READINESS FRAMEWORK (GRF) & SCORING RUBRIC
Evaluate the provided website data across 7 pillars. For each pillar, assign a precise score from 0 to 100.
100 means absolutely flawless execution (rare). 50 means average/mediocre. 0 means complete failure.

CRITICAL INSTRUCTION FOR SCORING:
You must be a completely FAIR and OBJECTIVE judge. Evaluate strictly on merit. If a startup is executing exceptionally well and deserves a 90 or 100, award it that score without hesitation. If a startup is doing poorly and deserves a 20 or 30, score it exactly that. DO NOT default to 100/100 just to be polite, but DO NOT artificially skew low either. Assess the actual evidence on the page and score the reality. Use the full spectrum from 0 to 100 based purely on the quality of execution.

1. Positioning (Weight: 20%) - Is the ICP obvious? Is the value prop specific?
2. Messaging (Weight: 15%) - Is it free of buzzwords? Are there clear outcomes?
3. Website & UX (Weight: 15%) - Is the information hierarchy logical and readable?
4. Conversion (Weight: 15%) - Is the CTA clear? Is pricing transparent?
5. Trust & Credibility (Weight: 10%) - Are there real testimonials, metrics, and team presence?
6. Market & Competition (Weight: 10%) - Do they differentiate from the status quo?
7. Growth Foundation (Weight: 15%) - Is there a scalable acquisition loop visible?

# CONFIDENCE SCORES
For each pillar, assign a Confidence Level (High, Medium, Low). 
- High: The page provided extensive data to make this judgment.
- Low: The judgment is an inference due to missing data on the website.

---
EVALUATE THIS STARTUP:
Company Name: ${company_name}
URL: ${url}
Description: ${inferred_description}
Target Audience: ${target_audience}
---
  `;

  const aiResponse = await generateWithFallback(prompt, auditSchema);

  const resultText = aiResponse.text;
  if (!resultText) {
    throw new Error('No response from AI engine');
  }

  let auditData;
  try {
    auditData = JSON.parse(resultText);
  } catch (e) {
    console.warn("[generateAudit] JSON parsing failed:", e);
    throw new Error("The AI failed to generate a valid audit for this website. Please try again.");
  }

  const overallScore = computeOverallScore(auditData.pillars || {});

  return {
    ...auditData,
    overallScore
  };
}

export async function gradeFromMarkdown(url: string, markdownContext: string) {
  const prompt = `
# ROLE & PERSONA
You are an elite Silicon Valley Growth Consultant, a seasoned YC Partner, and a ruthless, cynical, yet completely fair Judge. Your purpose is to provide a highly accurate diagnostic assessment of a startup based on web-scraped data.

# INSTRUCTIONS
Based on the following markdown scraped from a landing page, your first task is to determine if this is a valid SaaS, B2B, or B2C startup/company. 
If it is a personal portfolio, blog, github repository, or agency, set "is_valid_startup" to false and provide a professional rejection message in "invalid_reason".
If it is a valid startup, set "is_valid_startup" to true, and evaluate it strictly on merit across 7 pillars. For each pillar, assign a precise score from 0 to 100. DO NOT sugarcoat, DO NOT default to 100.

# PILLARS
1. Positioning (20%) - Is the ICP obvious? Is the value prop specific?
2. Messaging (15%) - Is it free of buzzwords? Clear outcomes?
3. Website & UX (15%) - Logical information hierarchy?
4. Conversion (15%) - Clear CTA? Transparent pricing?
5. Trust & Credibility (10%) - Testimonials, metrics, team?
6. Market & Competition (10%) - Differentiated?
7. Growth Foundation (15%) - Scalable acquisition loop visible?

# CONFIDENCE
For each pillar, assign Confidence (High, Medium, Low). High = lots of data; Low = inferred.

Markdown Content:
${markdownContext}
  `;

  const aiResponse = await generateWithFallback(prompt, fullAuditSchema);

  const resultText = aiResponse.text;
  if (!resultText) {
    throw new Error('No response from AI engine');
  }

  let extractedData;
  try {
    extractedData = JSON.parse(resultText);
  } catch (e) {
    console.warn("[performFullAudit] JSON parsing failed:", e);
    throw new Error("The AI failed to generate a valid analysis for this website. Please try again.");
  }

  if (extractedData?.is_valid_startup === false) {
    throw new Error(extractedData.invalid_reason || 'This URL is not a valid startup or company website.');
  }

  const overallScore = computeOverallScore(extractedData.pillars || {});

  return {
    ...extractedData,
    overallScore
  };
}

export async function performFullAudit(url: string, fallback_text?: string) {
  const markdownContext = await fetchContext(url, fallback_text);
  return gradeFromMarkdown(url, markdownContext);
}
