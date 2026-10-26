import { changeStatus } from '@/app/actions';

/** Star / hide / restore. Plain forms with a server action, so they work without client JS. */
export function StatusButtons({ id, status }: { id: number; status: string }) {
  const button = 'rounded-md px-2 py-1 text-xs whitespace-nowrap text-ink-2 hover:bg-wash hover:text-ink';
  const form = (next: string, label: string, title: string) => (
    <form action={changeStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={next} />
      <button type="submit" className={button} title={title}>
        {label}
      </button>
    </form>
  );
  if (status === 'hidden') return form('new', 'Przywróć', 'Pokaż znowu na liście');
  if (status === 'expired') return <span className="px-2 py-1 text-xs text-muted">Wygasła</span>;
  return (
    <div className="flex">
      {status === 'starred' ? form('new', '★ Usuń gwiazdkę', 'Usuń gwiazdkę') : form('starred', '☆ Gwiazdka', 'Oznacz gwiazdką')}
      {form('hidden', 'Ukryj', 'Ukryj tę okazję')}
    </div>
  );
}
