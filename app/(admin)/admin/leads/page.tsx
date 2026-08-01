import LeadsClient from './LeadsClient';

type LeadsPageProps = {
  searchParams: Promise<{
    new?: string;
  }>;
};

export default async function LeadsPage({
  searchParams,
}: LeadsPageProps) {
  const params = await searchParams;

  return <LeadsClient openCreateOnLoad={params.new === '1'} />;
}