import { TicketPriority } from '../types';

/**
 * Result returned by the priority engine.
 * Contains the resolved priority and optionally the keyword that triggered it.
 */
interface PriorityResult {
  priority: TicketPriority;
  matched_keyword?: string;
}

const CRITICAL_KEYWORDS = ['fraud', 'unauthorized', 'hacked', 'payment failed', 'stolen'];
const HIGH_KEYWORDS = ['not delivered', 'wrong item', 'refund', 'damaged'];
const MEDIUM_KEYWORDS = ['delayed', 'tracking', 'support'];

/**
 * Determine ticket priority from description text and issue type.
 * Uses keyword matching in this order: Critical → High → payment type → Medium → Low.
 * This result is also confirmed asynchronously by the BullMQ classification worker.
 *
 * @param description - Ticket description text entered by the customer
 * @param issue_type  - Ticket category (e.g. 'shipping', 'payment', 'refund')
 * @returns Priority level and optionally the matching keyword
 */
export function determinePriority(description: string, issue_type: string): PriorityResult {
  const text = description.toLowerCase();

  for (const kw of CRITICAL_KEYWORDS) {
    if (text.includes(kw)) return { priority: 'Critical', matched_keyword: kw };
  }

  for (const kw of HIGH_KEYWORDS) {
    if (text.includes(kw)) return { priority: 'High', matched_keyword: kw };
  }

  // Payment issue type always gets at least High
  if (issue_type.toLowerCase() === 'payment') {
    return { priority: 'High', matched_keyword: 'payment issue_type' };
  }

  for (const kw of MEDIUM_KEYWORDS) {
    if (text.includes(kw)) return { priority: 'Medium', matched_keyword: kw };
  }

  return { priority: 'Low' };
}

/**
 * Compare two priority levels. Returns true if `a` is strictly higher than `b`.
 * Useful for escalation decisions and priority upgrade checks.
 */
export function isHigherThan(a: TicketPriority, b: TicketPriority): boolean {
  const order: Record<TicketPriority, number> = { Low: 0, Medium: 1, High: 2, Critical: 3 };
  return order[a] > order[b];
}
