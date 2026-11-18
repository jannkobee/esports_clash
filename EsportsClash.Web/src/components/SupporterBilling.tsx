import {useEffect, useState} from 'react';
import {CreditCard, FlaskConical, Receipt} from 'lucide-react';
import {useAccount} from '../AccountContext';
import {request} from '../cloudPersistence';
import {pediaMoney, pediaTime} from '../hexapedia';

interface Desk {
  provider: string; test_mode: boolean; currency: string; prices: Record<'signal' | 'beacon', number>;
  subscription: {plan: string; status: string; current_period_end: string; cancel_at_period_end: boolean} | null;
  payments: {id: number; plan: string; amount: number; status: string; period_start: string; period_end: string; reference: string; created_at: string}[];
}
interface Checkout {id: string; plan: string; amount: number; currency: string; status: string; expires_at: string; test_mode: boolean}

const checkoutParam = () => new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('checkout');

/**
 * Buying, renewing and cancelling Signal or Beacon. While no payment provider is chosen, payments are test
 * payments (no money moves) and every price says so.
 */
export function SupporterBilling({onChanged}: {onChanged: () => void}) {
  const {session, retry} = useAccount();
  const [desk, setDesk] = useState<Desk | null>(null), [checkout, setCheckout] = useState<Checkout | null>(null);
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!session) return;
    const c = new AbortController();
    void request<{data: Desk}>('/online/billing', session, {signal: c.signal}).then(r => setDesk(r.data)).catch(e => { if (!c.signal.aborted) setError((e as Error).message); });
    const id = checkoutParam();
    if (id) void request<{data: Checkout}>(`/online/billing/checkout/${id}`, session, {signal: c.signal}).then(r => setCheckout(r.data)).catch(() => undefined);
    return () => c.abort();
  }, [session, revision]);
  const done = async (message: string) => { setNotice(message); setRevision(v => v + 1); retry(); onChanged(); };
  async function start(plan: 'signal' | 'beacon') {
    if (!session) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const r = await request<{data: {checkout_id: string; url: string}}>('/online/billing/checkout', session, {method: 'POST', body: JSON.stringify({plan})});
      window.location.assign(r.data.url);
      setRevision(v => v + 1);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function complete(result: 'paid' | 'declined') {
    if (!session || !checkout) return;
    setBusy(true); setError('');
    try {
      const r = await request<{data: {status: string}}>(`/online/billing/checkout/${checkout.id}/mock`, session, {method: 'POST', body: JSON.stringify({result})});
      window.history.replaceState(null, '', '#supporter-studio'); setCheckout(null);
      await done(r.data.status === 'paid' ? 'Thank you. Your membership is active; a receipt is on its way by email.' : 'The test payment was declined. Nothing changed.');
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function cancel(value: boolean) {
    if (!session) return;
    setBusy(true); setError('');
    try { await request('/online/billing/cancel', session, {method: 'POST', body: JSON.stringify({cancel: value})}); await done(value ? 'Your membership will end at the close of the current period.' : 'Your membership will keep renewing.'); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  if (!desk) return error ? <p role="alert" className="studio-feedback">{error}</p> : null;
  const sub = desk.subscription;
  return <section className="studio-section supporter-billing">
    <h3><CreditCard size={17} aria-hidden="true" /> Membership</h3>
    {desk.test_mode && <p className="studio-test-mode"><FlaskConical size={14} aria-hidden="true" /> Test payments: no payment provider is connected yet, so no money is charged.</p>}
    {error && <p className="studio-feedback" role="alert">{error}</p>}{notice && <p className="studio-feedback" role="status">{notice}</p>}
    {checkout && checkout.status === 'pending' && <div className="studio-checkout" role="region" aria-label="Test checkout">
      <h4>Confirm {checkout.plan === 'beacon' ? 'Beacon' : 'Signal'} · {pediaMoney(checkout.amount)} / month</h4>
      <p>This is the test checkout. Choose what the payment provider would answer.</p>
      <button type="button" className="cm-btn cm-btn-primary" disabled={busy} onClick={() => void complete('paid')}>Pay (test)</button>
      <button type="button" className="cm-btn" disabled={busy} onClick={() => void complete('declined')}>Decline (test)</button>
    </div>}
    {sub && sub.status === 'active' ? <p>{sub.plan === 'beacon' ? 'Beacon' : 'Signal'} · {sub.cancel_at_period_end ? 'ends' : 'renews'} on {pediaTime(sub.current_period_end)} Manila.
      {sub.cancel_at_period_end ? <button type="button" className="cm-btn cm-btn-sm" disabled={busy} onClick={() => void cancel(false)}>Keep renewing</button>
        : <button type="button" className="cm-btn cm-btn-sm cm-btn-ghost" disabled={busy} onClick={() => void cancel(true)}>Cancel at period end</button>}</p>
      : <p>{sub?.status === 'past_due' ? 'Your last renewal failed. Start a new membership below.' : 'Choose a membership. It renews monthly and you can cancel any time.'}</p>}
    <div className="studio-prices">{(['signal', 'beacon'] as const).map(plan => <div key={plan}>
      <strong>{plan === 'beacon' ? 'Beacon' : 'Signal'}</strong><span>{pediaMoney(desk.prices[plan])} / month{desk.test_mode ? ' (test)' : ''}</span>
      <button type="button" className={'cm-btn ' + (plan === 'beacon' ? 'cm-btn-primary' : '')} disabled={busy || (sub?.status === 'active' && sub.plan === plan && !sub.cancel_at_period_end)} onClick={() => void start(plan)}>
        {sub?.status === 'active' && sub.plan !== plan ? `Switch to ${plan === 'beacon' ? 'Beacon' : 'Signal'}` : sub?.status === 'active' && sub.plan === plan ? 'Current plan' : `Choose ${plan === 'beacon' ? 'Beacon' : 'Signal'}`}</button>
    </div>)}</div>
    {desk.payments.length > 0 && <details><summary><Receipt size={14} aria-hidden="true" /> Receipts ({desk.payments.length})</summary>
      <div className="cm-table-wrap"><table className="cm-table"><thead><tr><th>Date</th><th>Plan</th><th>Period</th><th>Amount</th><th>Status</th></tr></thead>
        <tbody>{desk.payments.map(p => <tr key={p.id}><td>{pediaTime(p.created_at)}</td><td>{p.plan === 'beacon' ? 'Beacon' : 'Signal'}</td><td>{pediaTime(p.period_start)} – {pediaTime(p.period_end)}</td><td>{pediaMoney(p.amount)}{desk.test_mode ? ' (test)' : ''}</td><td>{p.status}</td></tr>)}</tbody></table></div></details>}
  </section>;
}
