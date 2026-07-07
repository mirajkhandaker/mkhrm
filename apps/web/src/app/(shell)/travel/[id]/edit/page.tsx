'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/page-header';
import { TravelRequestForm, TravelRequestFormValue } from '@/components/travel/travel-request-form';

interface TravelRequestItem {
  id: string;
  description: string;
  category: string;
  transportMode: string | null;
  fromLocation: string | null;
  toLocation: string | null;
  isRoundTrip: boolean;
  fromDate: string;
  toDate: string;
  estimatedCost: number;
  note: string | null;
}

interface TravelRequest {
  id: string;
  purpose: string;
  timing: 'pre_trip' | 'post_trip';
  fromDate: string;
  toDate: string;
  advanceRequested: number;
  status: string;
  settlementStatus: string;
  items: TravelRequestItem[];
}

export default function EditTravelRequestPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [value, setValue] = useState<TravelRequestFormValue | null>(null);

  useEffect(() => {
    api.get<TravelRequest>(`/travel/${id}`)
      .then((trip) => {
        if (!['draft', 'pending', 'approved'].includes(trip.status) || trip.settlementStatus !== 'none') {
          setError('This trip can no longer be edited directly.');
          return;
        }
        setValue({
          purpose: trip.purpose,
          timing: trip.timing,
          fromDate: trip.fromDate,
          toDate: trip.toDate,
          advanceRequested: Number(trip.advanceRequested),
          legs: trip.items.map((item) => ({
            id: item.id,
            description: item.description,
            category: item.category,
            transportMode: item.transportMode ?? '',
            fromLocation: item.fromLocation ?? '',
            toLocation: item.toLocation ?? '',
            isRoundTrip: item.isRoundTrip,
            fromDate: item.fromDate,
            toDate: item.toDate,
            estimatedCost: Number(item.estimatedCost),
            note: item.note ?? '',
            attachments: [],
          })),
        });
      })
      .catch((e: ApiError) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSubmit() {
    if (!value) return;
    if (!value.purpose.trim() || !value.fromDate || !value.toDate) {
      setError('Please fill in all required fields');
      return;
    }
    const validLegs = value.legs.filter((l) => l.description.trim() && l.fromDate);
    if (validLegs.length === 0) {
      setError('Add at least one journey cost with a description and date');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.patch(`/travel/${id}`, {
        purpose: value.purpose,
        fromDate: value.fromDate,
        toDate: value.toDate,
        advanceRequested: value.timing === 'post_trip' ? undefined : (Number(value.advanceRequested) || undefined),
        items: validLegs.map((l) => ({
          id: l.id,
          description: l.description,
          category: l.category,
          transportMode: l.category === 'travel' ? (l.transportMode || undefined) : undefined,
          fromLocation: l.category === 'travel' ? (l.fromLocation || undefined) : undefined,
          toLocation: l.category === 'travel' ? (l.toLocation || undefined) : undefined,
          isRoundTrip: l.category === 'travel' ? l.isRoundTrip : undefined,
          fromDate: l.fromDate,
          toDate: l.toDate || l.fromDate,
          estimatedCost: Number(l.estimatedCost) || 0,
          note: l.note || undefined,
          attachments: l.attachments.length ? l.attachments : undefined,
        })),
      });
      router.push(`/travel/${id}`);
    } catch (err: unknown) {
      setError((err as ApiError).message ?? 'Failed to save changes');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-5xl">
      <PageHeader
        breadcrumb={[{ label: 'Travel', href: '/travel' }, { label: 'Trip', href: `/travel/${id}` }]}
        title="Edit Travel Request"
        description="Saving changes restarts approval from the first step"
      />

      {!value ? (
        <Card className="border-danger/30 bg-danger/5">
          <CardContent className="pt-4 text-sm text-danger">{error ?? 'Unable to load this travel request'}</CardContent>
        </Card>
      ) : (
        <TravelRequestForm
          value={value}
          onChange={setValue}
          submitting={submitting}
          submitLabel="Save & Resubmit for Approval"
          error={error}
          onSubmit={handleSubmit}
          onCancel={() => router.back()}
          lockTiming
        />
      )}
    </div>
  );
}
