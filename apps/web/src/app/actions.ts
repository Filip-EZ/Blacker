'use server';

import { revalidatePath } from 'next/cache';
import { setDealStatus } from '@/lib/queries';

const STATUSES = ['new', 'starred', 'hidden'] as const;

/** Star, hide or restore a deal from a card or the product page. */
export async function changeStatus(formData: FormData) {
  const id = Number(formData.get('id'));
  const status = STATUSES.find((s) => s === formData.get('status'));
  if (!Number.isInteger(id) || !status) return;
  await setDealStatus(id, status);
  revalidatePath('/');
  revalidatePath(`/deal/${id}`);
}
