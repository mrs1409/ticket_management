import { determinePriority, isHigherThan } from '../utils/priority';

describe('determinePriority()', () => {
  // Critical keyword tests
  test('detects "fraud" as Critical', () => {
    expect(determinePriority('There is fraud on my account', 'Account').priority).toBe('Critical');
  });
  test('detects "unauthorized" as Critical', () => {
    expect(determinePriority('Unauthorized charge on my card', 'Payment').priority).toBe('Critical');
  });
  test('detects "hacked" as Critical', () => {
    expect(determinePriority('I think my account was hacked', 'Account').priority).toBe('Critical');
  });
  test('detects "payment failed" as Critical', () => {
    expect(determinePriority('My payment failed and money was deducted', 'Payment').priority).toBe('Critical');
  });
  test('detects "stolen" as Critical', () => {
    expect(determinePriority('My package was stolen from the mailbox', 'Delivery').priority).toBe('Critical');
  });

  // High keyword tests
  test('detects "not delivered" as High', () => {
    expect(determinePriority('My order was not delivered', 'Delivery').priority).toBe('High');
  });
  test('detects "wrong item" as High', () => {
    expect(determinePriority('I received the wrong item', 'Delivery').priority).toBe('High');
  });
  test('detects "refund" as High', () => {
    expect(determinePriority('I need a refund for this order', 'Other').priority).toBe('High');
  });
  test('detects "damaged" as High', () => {
    expect(determinePriority('My item arrived damaged', 'Delivery').priority).toBe('High');
  });

  // Medium keyword tests
  test('detects "delayed" as Medium', () => {
    expect(determinePriority('My order is delayed by 3 days', 'Delivery').priority).toBe('Medium');
  });
  test('detects "tracking" as Medium', () => {
    expect(determinePriority('I cannot find tracking information', 'Delivery').priority).toBe('Medium');
  });
  test('detects "support" as Medium', () => {
    expect(determinePriority('I need support with my order', 'Other').priority).toBe('Medium');
  });

  // Default (Low)
  test('defaults to Low for generic description', () => {
    expect(determinePriority('I have a question about my order', 'Other').priority).toBe('Low');
  });

  // Payment issue_type always ≥ High
  test('Payment issue_type returns High even for generic description', () => {
    expect(determinePriority('I have a question', 'Payment').priority).toBe('High');
  });
  test('Critical keyword overrides Payment issue_type default', () => {
    expect(determinePriority('unauthorized charge on my payment', 'Payment').priority).toBe('Critical');
  });

  // Case insensitivity
  test('keyword detection is case-insensitive', () => {
    expect(determinePriority('FRAUD detected on my account', 'Account').priority).toBe('Critical');
    expect(determinePriority('Item was DAMAGED in transit', 'Delivery').priority).toBe('High');
  });

  // Returns matched_keyword
  test('returns matched_keyword when pattern found', () => {
    const result = determinePriority('There is fraud happening', 'Other');
    expect(result.matched_keyword).toBe('fraud');
  });
  test('no matched_keyword for Low priority', () => {
    const result = determinePriority('Just a general question', 'Other');
    expect(result.matched_keyword).toBeUndefined();
  });
});

describe('isHigherThan()', () => {
  test('Critical > High', () => expect(isHigherThan('Critical', 'High')).toBe(true));
  test('High > Medium', () => expect(isHigherThan('High', 'Medium')).toBe(true));
  test('Medium > Low', () => expect(isHigherThan('Medium', 'Low')).toBe(true));
  test('Low not > Medium', () => expect(isHigherThan('Low', 'Medium')).toBe(false));
  test('same priority not higher', () => expect(isHigherThan('High', 'High')).toBe(false));
});
