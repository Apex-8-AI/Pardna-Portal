// api/pardna.js
// Place this file at: api/pardna.js in your GitHub repo root

const BASE = process.env.SUPABASE_URL + '/rest/v1/';
const KEY = process.env.SUPABASE_SERVICE_KEY;

async function q(method, table, queryStr = '', body = null) {
  const url = `${BASE}${table}${queryStr ? '?' + queryStr : ''}`;
  const opts = {
    method,
    headers: {
      'apikey': KEY,
      'Authorization': `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(url, opts);
  const text = await r.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { action, ...p } = req.body;

  try {
    let result;

    switch (action) {

      case 'load': {
        const [members, payments, adminArr, borrows, donations, borrowRequests, extraCapital, lateFees] = await Promise.all([
          q('GET', 'members', 'select=*&order=id'),
          q('GET', 'payments', 'select=*'),
          q('GET', 'admin_settings', 'select=*&id=eq.1'),
          q('GET', 'borrows', 'select=*&order=borrowed_on.desc'),
          q('GET', 'donations', 'select=*'),
          q('GET', 'borrow_requests', 'select=*&order=requested_on.desc'),
          q('GET', 'extra_capital', 'select=*&order=logged_on.desc'),
          q('GET', 'late_fees', 'select=*'),
        ]);
        result = {
          members: members || [],
          payments: payments || [],
          adminSettings: adminArr?.[0] || null,
          borrows: borrows || [],
          donations: donations || [],
          borrowRequests: borrowRequests || [],
          extraCapital: extraCapital || [],
          lateFees: lateFees || [],
        };
        break;
      }

      case 'togglePayment':
        await q('PATCH', 'payments', `member_id=eq.${p.memberId}&week_num=eq.${p.weekNum}`, { paid: p.paid });
        result = { ok: true };
        break;

      case 'insertLateFee': {
        const late = await q('POST', 'late_fees', '', { member_id: p.memberId, week_num: p.weekNum, late_date: p.lateDate });
        const extra = await q('POST', 'extra_capital', '', { member_id: p.memberId, week_num: p.weekNum, amount: 25, note: 'reserve_contribution' });
        result = { lateData: Array.isArray(late) ? late[0] : late, extraData: Array.isArray(extra) ? extra[0] : extra };
        break;
      }

      case 'resolveLateFee':
        await q('PATCH', 'late_fees', `id=eq.${p.feeId}`, { paid: true, paid_on: new Date().toISOString().split('T')[0] });
        result = { ok: true };
        break;

      case 'insertBorrow': {
        const res2 = await q('POST', 'borrows', '', { member_id: p.memberId, amount: p.amount });
        result = { data: Array.isArray(res2) ? res2[0] : res2 };
        break;
      }

      case 'updateBorrow':
        await q('PATCH', 'borrows', `id=eq.${p.id}`, { repaid: p.repaid, repaid_on: p.repaidOn });
        result = { ok: true };
        break;

      case 'insertExtraCapital': {
        const res3 = await q('POST', 'extra_capital', '', { member_id: p.memberId, week_num: p.weekNum, amount: p.amount, note: p.note || '' });
        result = { data: Array.isArray(res3) ? res3[0] : res3 };
        break;
      }

      case 'reviewRequest': {
        const status = p.status;
        await q('PATCH', 'borrow_requests', `id=eq.${p.reqId}`, { status, reviewed_on: new Date().toISOString().split('T')[0] });
        if (status === 'approved') {
          const res4 = await q('POST', 'borrows', '', { member_id: p.memberId, amount: p.amount });
          result = { data: Array.isArray(res4) ? res4[0] : res4 };
        } else {
          result = { ok: true };
        }
        break;
      }

      case 'updateAdminPin':
        await q('PATCH', 'admin_settings', 'id=eq.1', { pin: p.pin });
        result = { ok: true };
        break;

      case 'updateMemberPin':
        await q('PATCH', 'members', `id=eq.${p.id}`, { pin: p.pin });
        result = { ok: true };
        break;

      case 'upsertDonation':
        if (p.existingId) {
          await q('PATCH', 'donations', `id=eq.${p.existingId}`, { amount: p.amount });
          result = { ok: true };
        } else if (p.amount > 0) {
          const res5 = await q('POST', 'donations', '', { member_id: p.memberId, amount: p.amount });
          result = { data: Array.isArray(res5) ? res5[0] : res5 };
        } else {
          result = { ok: true };
        }
        break;

      case 'insertBorrowRequest': {
        const res6 = await q('POST', 'borrow_requests', '', { member_id: p.memberId, amount: p.amount, reason: p.reason || '' });
        result = { data: Array.isArray(res6) ? res6[0] : res6 };
        break;
      }

      default:
        return res.status(400).json({ error: 'Unknown action' });
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
