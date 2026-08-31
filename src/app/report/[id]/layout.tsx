import { Metadata } from 'next';
import { redis } from '@/lib/redis';

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const id = params.id;
  
  try {
    const reportStr = await redis.get(`report:${id}`);
    if (reportStr) {
      const report = JSON.parse(reportStr);
      const companyName = report.company_name || 'Startup';
      const score = report.fdi_overall_score || 0;
      
      const title = `Verdict | ${score}/100 for ${companyName}`;
      const description = `Read the autonomous AI growth audit and intelligence brief for ${companyName} on Verdict.`;

      return {
        title,
        description,
        openGraph: {
          title,
          description,
        },
        twitter: {
          card: 'summary_large_image',
          title,
          description,
        },
      };
    }
  } catch (e) {
    console.error('Metadata generation failed:', e);
  }

  // Fallback metadata if report is not found
  return {
    title: 'Verdict | AI Growth Audit',
    description: 'Read the autonomous AI growth audit and intelligence brief on Verdict.',
  };
}

export default function ReportLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
