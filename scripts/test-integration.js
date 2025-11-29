#!/usr/bin/env node
// scripts/test-integration.js
// Simulate create-checkout -> mp-webhook -> check-download flow using mocks (no external network calls)

const crypto = require('crypto');

// Simple in-memory DB to simulate 'ebook_order'
const db = {
  'ebook_order': {},
};
let idCounter = 1;

function genId() {
  return String(idCounter++);
}

// Mock supabaseAdmin methods used by our APIs
const supabaseAdminMock = {
  from(table) {
    return {
      insert: async (obj) => {
        const id = genId();
        const now = new Date().toISOString();
        const row = {
          id,
          ...obj,
          created_at: now,
          updated_at: now,
        };
        db[table][id] = row;
        return { data: row, error: null };
      },
      update: async (updateObj) => {
        // update is followed by .eq('id', orderId), so we'll assume .eq called
        let boundId = null;
        const result = {
          eq(name, value) {
            boundId = value;
            if (!db[table] || !db[table][boundId]) {
              return { data: null, error: { message: 'not_found' } };
            }
            const row = db[table][boundId];
            for (const k of Object.keys(updateObj)) row[k] = updateObj[k];
            row.updated_at = new Date().toISOString();
            return { data: row, error: null };
          },
        };
        return result;
      },
      select: function (selection) {
        // returns builder with .eq(email).eq(download_allowed).order().limit().maybeSingle()
        const parts = {
          eq: (col, val) => {
            this.filter = this.filter || {};
            this.filter[col] = val;
            return this;
          },
          order: (col, args) => {
            this.order = { col, args };
            return this;
          },
          limit: (n) => { this.limit = n; return this; },
          maybeSingle: async () => {
            const tableRows = Object.values(db[table] || {});
            let rows = tableRows;
            if (this.filter) {
              rows = rows.filter((r) => {
                return Object.entries(this.filter).every(([k, v]) => r[k] === v);
              });
            }
            if (rows.length === 0) return { data: null, error: null };
            // sort
            if (this.order) {
              rows = rows.sort((a, b) => (new Date(b.created_at) - new Date(a.created_at)));
            }
            return { data: rows[0], error: null };
          },
        };
        return parts;
      },
    };
  },
};

// Fake mercadopago.preferences.create
const mercadopagoMock = {
  preferences: {
    async create(opts) {
      const id = crypto.randomBytes(4).toString('hex');
      return {
        body: {
          id,
          init_point: `https://mockmp.com/checkout/${id}`,
        },
      };
    },
  },
  payment: {
    async findById(id) {
      // We'll not actually call this in test; webhook will provide a payment object
      return { body: { id, status: 'approved' } };
    },
  },
};

// Reuse logic from handlers (simpler versions) using mocks
async function createCheckout({ name, email, paymentMethod }) {
  // 1) Insert into supabase
  const { data: order, error: supaError } = await supabaseAdminMock
    .from('ebook_order')
    .insert({ name, email, status: 'pending', download_allowed: false });
  if (supaError) throw new Error('Supabase insert error');
  const orderId = order.id;

  // 2) Create Mercado Pago preference
  const preference = await mercadopagoMock.preferences.create({
    items: [ { title: 'E-book Música & Ansiedade', quantity: 1, unit_price: 129, currency_id: 'BRL' } ],
    external_reference: orderId,
  });
  const initPoint = preference.body.init_point;
  const prefId = preference.body.id;

  // 3) update order with mp data
  await supabaseAdminMock.from('ebook_order').update({ mp_external_reference: orderId, mp_raw: { preference_id: prefId } }).eq('id', orderId);

  return { orderId, initPoint: initPoint, preferenceId: prefId };
}

async function simulateWebhook({ paymentId, external_reference, status }) {
  // Create payment object
  const payment = {
    id: paymentId,
    external_reference,
    status,
  };

  const orderId = payment.external_reference;
  const mpStatus = payment.status;
  const update = {
    mp_payment_id: String(payment.id),
    mp_status: mpStatus,
    mp_raw: payment,
  };

  if (mpStatus === 'approved') {
    update.status = 'paid';
    update.download_allowed = true;
  } else if (mpStatus === 'rejected' || mpStatus === 'cancelled') {
    update.status = 'failed';
    update.download_allowed = false;
  }

  const result = supabaseAdminMock.from('ebook_order').update(update).eq('id', orderId);
  if (result.error) throw new Error('Supabase update error');
  return result;
}

async function checkDownload(email) {
  const { data } = await supabaseAdminMock
    .from('ebook_order')
    .select('id, status, download_allowed, created_at')
    .eq('email', email)
    .eq('download_allowed', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

// Runner
(async () => {
  try {
    console.log('Starting local integration test (simulation)...');

    const name = 'Test User';
    const email = 'test@example.com';

    const checkout = await createCheckout({ name, email, paymentMethod: 'pix' });
    console.log('checkout created:', checkout);

    // Initially, allowed should be null
    let check1 = await checkDownload(email);
    console.log('checkDownload before payment (should be null):', check1);

    // Simulate payment approved
    const paymentId = 'pay_' + crypto.randomBytes(4).toString('hex');
    await simulateWebhook({ paymentId, external_reference: checkout.orderId, status: 'approved' });

    const orderAfter = db['ebook_order'][checkout.orderId];
    console.log('Order after webhook:', orderAfter);

    // Check download again
    let check2 = await checkDownload(email);
    console.log('checkDownload after payment (should be allowed):', check2);

    if (check2 && check2.download_allowed) {
      console.log('\x1b[32m%s\x1b[0m', 'Integration simulation succeeded: download allowed flag is true.');
      process.exit(0);
    } else {
      console.error('\x1b[31m%s\x1b[0m', 'Integration simulation failed: download_allowed not set');
      process.exit(2);
    }

  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  }
})();
