import { requireAuth } from '@/lib/auth/session';
import OrderDetailClient from './OrderDetailClient';

type OrderDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function OrderDetailPage({
  params,
}: OrderDetailPageProps) {
  const { id } = await params;
  const auth = await requireAuth();

  return (
    <OrderDetailClient
      orderId={id}
      canAssign={auth.permissions.has('dispatch.assign')}
    />
  );
}
