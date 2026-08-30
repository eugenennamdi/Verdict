export const maxDuration = 300;
import { NextResponse } from 'next/dist/server/web/spec-extension/response';
import { extractContext, generateAudit } from '@/lib/engine';
import { redis } from '@/lib/redis';
import {
  isSanitizedModelAvailabilityError,
  publicInvestigationErrorMessage,
} from '@/lib/audit/publicError';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const url = body.url;

    if (!url) {
      return NextResponse.json({ error: 'URL is required in the JSON body.' }, { status: 400 });
    }

    // SSRF Protection: Prevent scanning localhost or internal IP ranges
    try {
      const targetUrl = new URL(url);
      const hostname = targetUrl.hostname.toLowerCase();
      
      const isLocalhost = hostname === 'localhost' || 
                          hostname === '127.0.0.1' || 
                          hostname === '::1' || 
                          hostname.endsWith('.local');
                          
      if (isLocalhost) {
        return NextResponse.json({ error: 'Invalid URL: Localhost or internal IPs are not allowed' }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    // Rate Limiting (1 API call per 12 hours for demo purposes)
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const rateLimitKey = `api_v1_rate_limit:${ip}`;
    
    const lastAudit = await redis.get(rateLimitKey);
    const isLocalhost = ip === '127.0.0.1' || ip === '::1' || ip === 'localhost';
    
    if (lastAudit && !isLocalhost) {
      return NextResponse.json(
        { error: 'RATE_LIMIT_EXCEEDED', message: 'API rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }

    // Execute full pipeline
    const extractedData = await extractContext(url);
    const auditData = await generateAudit(url, extractedData as Record<string, unknown>);
    
    // Set rate limit for 12 hours (43200 seconds)
    await redis.set(rateLimitKey, Date.now(), 'EX', 43200);

    // Return the combined response
    return NextResponse.json({
      success: true,
      meta: {
        url,
        timestamp: new Date().toISOString(),
        engine: "OKX.AI",
        version: "v1"
      },
      data: auditData
    });

  } catch (error: unknown) {
    const errorMessage = publicInvestigationErrorMessage(error);
    const availabilityFailure = isSanitizedModelAvailabilityError(error);
    if (availabilityFailure) {
      console.error('[API v1] Analysis service temporarily unavailable');
    } else {
      console.error('[API v1] Audit Error:', error);
    }
    const statusCode = availabilityFailure ? 503 : 500;
    
    return NextResponse.json({ 
      success: false,
      error: errorMessage 
    }, { status: statusCode });
  }
}
