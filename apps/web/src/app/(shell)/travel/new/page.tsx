'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { PageHeader } from '@/components/layout/page-header';
import { TravelRequestForm, TravelRequestFormValue, EMPTY_LEG } from '@/components/travel/travel-request-form';

export default function NewTravelRequestPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [value, setValue] = useState<TravelRequestFormValue>({
    purpose: '',
    timing: 'pre_trip',
    fromDate: '',
    toDate: '',
    advanceRequested: 0,
    legs: [{ ...EMPTY_LEG }],
  });

  async function handleSubmit() {
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
      const created = await api.post<{ id: string }>('/travel', {
        purpose: value.purpose,
        timing: value.timing,
        fromDate: value.fromDate,
        toDate: value.toDate,
        advanceRequested: value.timing === 'post_trip' ? undefined : (Number(value.advanceRequested) || undefined),
        items: validLegs.map((l) => ({
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
      router.push(`/travel/${created.id}`);
    } catch (err: unknown) {
      setError((err as ApiError).message ?? 'Failed to submit travel request');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 p-6 max-w-5xl">
      <PageHeader
        breadcrumb={[{ label: 'Travel', href: '/travel' }]}
        title="New Travel Request"
        description="Submit a pre-trip request covering the full journey cost — transport, lodging, meals — for approval"
      />

      <TravelRequestForm
        value={value}
        onChange={setValue}
        submitting={submitting}
        submitLabel="Submit Travel Request"
        error={error}
        onSubmit={handleSubmit}
        onCancel={() => router.back()}
      />
    </div>
  );
}
