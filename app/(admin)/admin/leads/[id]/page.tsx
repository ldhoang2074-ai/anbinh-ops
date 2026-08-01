import LeadDetailClient from './LeadDetailClient';

type LeadDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function LeadDetailPage({
  params,
}: LeadDetailPageProps) {
  const { id } = await params;

  return <LeadDetailClient leadId={id} />;
}
