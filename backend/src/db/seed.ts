import dotenv from 'dotenv';
dotenv.config();

import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { query, connectDB } from './connection';

const SALT_ROUNDS = 12;

async function seed() {
  await connectDB();
  console.log('[Seed] Starting seed...');

  // Hash password helper
  const hash = (pw: string) => bcrypt.hash(pw, SALT_ROUNDS);

  // --- Users ---
  const adminId = uuidv4();
  const agentL1aId = uuidv4();
  const agentL1bId = uuidv4();
  const agentL2Id = uuidv4();
  const agentL3Id = uuidv4();
  const customer1Id = uuidv4();
  const customer2Id = uuidv4();

  const users = [
    { id: adminId, email: 'admin@ticketapp.com', password: 'Admin@123', role: 'admin', name: 'Admin User' },
    { id: agentL1aId, email: 'agent.l1a@ticketapp.com', password: 'AgentL1@123', role: 'agent_l1', name: 'Agent L1 Alpha' },
    { id: agentL1bId, email: 'agent.l1b@ticketapp.com', password: 'AgentL1@123', role: 'agent_l1', name: 'Agent L1 Beta' },
    { id: agentL2Id, email: 'agent.l2@ticketapp.com', password: 'AgentL2@123', role: 'agent_l2', name: 'Agent L2 Prime' },
    { id: agentL3Id, email: 'agent.l3@ticketapp.com', password: 'AgentL3@123', role: 'agent_l3', name: 'Agent L3 Senior' },
    { id: customer1Id, email: 'customer1@example.com', password: 'Customer@123', role: 'customer', name: 'Jane Doe' },
    { id: customer2Id, email: 'customer2@example.com', password: 'Customer@123', role: 'customer', name: 'John Smith' },
  ];

  for (const u of users) {
    const passwordHash = await hash(u.password);
    await query(
      `INSERT INTO users (id, email, password_hash, role, name) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO UPDATE SET password_hash = $3, role = $4, name = $5`,
      [u.id, u.email, passwordHash, u.role, u.name]
    );
    console.log(`[Seed] User: ${u.email} (${u.role})`);
  }

  // --- Orders ---
  const order1Id = uuidv4();
  const order2Id = uuidv4();
  const order3Id = uuidv4();

  const ordersData = [
    {
      id: order1Id, userId: customer1Id, amount: 149.99, status: 'delivered',
      items: JSON.stringify([
        { sku: 'PROD001', name: 'Wireless Headphones', quantity: 1, price: 149.99 }
      ]),
    },
    {
      id: order2Id, userId: customer1Id, amount: 59.98, status: 'shipped',
      items: JSON.stringify([
        { sku: 'PROD002', name: 'USB-C Cable', quantity: 2, price: 19.99 },
        { sku: 'PROD003', name: 'Phone Case', quantity: 1, price: 19.99 },
      ]),
    },
    {
      id: order3Id, userId: customer2Id, amount: 299.00, status: 'processing',
      items: JSON.stringify([
        { sku: 'PROD004', name: 'Smart Watch', quantity: 1, price: 299.00 }
      ]),
    },
  ];

  for (const o of ordersData) {
    await query(
      `INSERT INTO orders (id, user_id, total_amount, status, items) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT DO NOTHING`,
      [o.id, o.userId, o.amount, o.status, o.items]
    );
    console.log(`[Seed] Order: ${o.id} for user ${o.userId}`);
  }

  // --- Payments ---
  const paymentsData = [
    { orderId: order1Id, amount: 149.99, status: 'completed', method: 'credit_card', txnId: 'TXN_001_' + Date.now() },
    { orderId: order2Id, amount: 59.98, status: 'completed', method: 'paypal', txnId: 'TXN_002_' + Date.now() },
    { orderId: order3Id, amount: 299.00, status: 'pending', method: 'credit_card', txnId: 'TXN_003_' + Date.now() },
  ];

  for (const p of paymentsData) {
    await query(
      `INSERT INTO payments (id, order_id, amount, status, payment_method, transaction_id) VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT DO NOTHING`,
      [uuidv4(), p.orderId, p.amount, p.status, p.method, p.txnId]
    );
  }
  console.log('[Seed] Payments inserted');

  // --- Sample Tickets ---
  const ticket1Id = uuidv4();
  const ticket2Id = uuidv4();

  await query(
    `INSERT INTO tickets (id, user_id, order_id, subject, issue_type, priority, status, description, assigned_to, escalation_level)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT DO NOTHING`,
    [ticket1Id, customer1Id, order1Id, 'Wrong item received in my order',
     'Delivery', 'High', 'open',
     'I ordered wireless headphones but received a wrong item. Order shows delivered but I got something else.',
     agentL1aId, 1]
  );

  await query(
    `INSERT INTO tickets (id, user_id, order_id, subject, issue_type, priority, status, description, assigned_to, escalation_level)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT DO NOTHING`,
    [ticket2Id, customer2Id, order3Id, 'Payment failed but money deducted',
     'Payment', 'High', 'in_progress',
     'Payment failed but money was deducted from my account. Need urgent refund.',
     agentL2Id, 2]
  );

  // Add some messages to tickets
  await query(
    `INSERT INTO ticket_messages (id, ticket_id, user_id, message, is_internal)
     VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
    [uuidv4(), ticket1Id, customer1Id, 'Please help, I need the correct item urgently.', false]
  );
  await query(
    `INSERT INTO ticket_messages (id, ticket_id, user_id, message, is_internal)
     VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
    [uuidv4(), ticket1Id, agentL1aId, 'I am looking into your order now.', false]
  );
  await query(
    `INSERT INTO ticket_messages (id, ticket_id, user_id, message, is_internal)
     VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
    [uuidv4(), ticket1Id, agentL1aId, 'Internal: Warehouse mis-pick issue. Escalating to L2.', true]
  );

  console.log('[Seed] Tickets and messages inserted');
  console.log('[Seed] ✅ Seed completed successfully!');
  console.log('\n--- TEST CREDENTIALS ---');
  users.forEach(u => console.log(`  ${u.role.padEnd(12)} | ${u.email} | ${u.password}`));
  process.exit(0);
}

seed().catch((err) => {
  console.error('[Seed] Fatal error:', err);
  process.exit(1);
});
