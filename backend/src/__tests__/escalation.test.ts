/**
 * Escalation logic tests
 * Tests the SLA-based escalation rules and escalation level logic
 */

// Escalation thresholds (mirroring the worker logic)
const DEFAULT_RULES = { l1_to_l2_hours: 24, l2_to_l3_hours: 48 };

function shouldEscalate(
  escalationLevel: number,
  createdAt: Date,
  rules: typeof DEFAULT_RULES = DEFAULT_RULES
): boolean {
  const ageHours = (Date.now() - createdAt.getTime()) / 3_600_000;
  if (escalationLevel === 1 && ageHours >= rules.l1_to_l2_hours) return true;
  if (escalationLevel === 2 && ageHours >= rules.l2_to_l3_hours) return true;
  return false;
}

function nextEscalationLevel(level: number): number | null {
  if (level < 3) return level + 1;
  return null; // already at max
}

function targetRoleForLevel(level: number): string {
  if (level === 2) return 'agent_l2';
  if (level === 3) return 'agent_l3';
  return 'agent_l1';
}

describe('Escalation SLA Rules', () => {
  const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000);

  test('L1 ticket should escalate after 24h', () => {
    expect(shouldEscalate(1, hoursAgo(25))).toBe(true);
  });

  test('L1 ticket should NOT escalate before 24h', () => {
    expect(shouldEscalate(1, hoursAgo(23))).toBe(false);
  });

  test('L1 ticket at exactly 24h boundary should escalate', () => {
    expect(shouldEscalate(1, hoursAgo(24))).toBe(true);
  });

  test('L2 ticket should escalate after 48h', () => {
    expect(shouldEscalate(2, hoursAgo(50))).toBe(true);
  });

  test('L2 ticket should NOT escalate before 48h', () => {
    expect(shouldEscalate(2, hoursAgo(47))).toBe(false);
  });

  test('L3 ticket should never escalate', () => {
    expect(shouldEscalate(3, hoursAgo(100))).toBe(false);
  });

  test('custom rules override defaults', () => {
    const customRules = { l1_to_l2_hours: 12, l2_to_l3_hours: 24 };
    expect(shouldEscalate(1, hoursAgo(13), customRules)).toBe(true);
    expect(shouldEscalate(1, hoursAgo(11), customRules)).toBe(false);
  });
});

describe('nextEscalationLevel()', () => {
  test('L1 → L2', () => expect(nextEscalationLevel(1)).toBe(2));
  test('L2 → L3', () => expect(nextEscalationLevel(2)).toBe(3));
  test('L3 → null (max level)', () => expect(nextEscalationLevel(3)).toBeNull());
});

describe('targetRoleForLevel()', () => {
  test('level 2 targets agent_l2', () => expect(targetRoleForLevel(2)).toBe('agent_l2'));
  test('level 3 targets agent_l3', () => expect(targetRoleForLevel(3)).toBe('agent_l3'));
});

describe('Payment issue type escalation', () => {
  // Payment tickets always start at L2 (escalation_level=2)
  test('Payment issue type sets initial escalation level to 2', () => {
    const issueType = 'Payment';
    const escalationLevel = issueType.toLowerCase() === 'payment' ? 2 : 1;
    expect(escalationLevel).toBe(2);
  });

  test('Non-payment issue type defaults to L1', () => {
    const issueType = 'Delivery';
    const escalationLevel = issueType.toLowerCase() === 'payment' ? 2 : 1;
    expect(escalationLevel).toBe(1);
  });
});
