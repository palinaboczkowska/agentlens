import type { Ticket } from "../orchestration/context.js";

/**
 * Synthetic support tickets for the demo pipeline. Deliberately engineered
 * (not randomly generated) to produce a real spread across every failure
 * category once run against the actual pipeline — see docs/demo-scenario.md
 * for the intended trap/expected-outcome behind each one. Entirely invented;
 * no connection to any real employer's tickets or customers.
 */
export const tickets: Ticket[] = [
  // --- Billing (5) ---
  {
    id: "t-01",
    subject: "Charged twice this month",
    body: "I just noticed two identical charges on my card from you this month, same amount, one day apart. Can you refund the extra one?",
  },
  {
    id: "t-02",
    subject: "Cancelling and want a refund for this month",
    body: "I'm cancelling my subscription today. I've only used it for 3 days this billing period, so I'd like a refund for the rest of the month.",
  },
  {
    id: "t-03",
    subject: "Question about upgrading to Pro",
    body: "If I upgrade from Free to Pro today, will I be charged the full price right away or is it prorated somehow?",
  },
  {
    id: "t-04",
    subject: "Need to update where invoices are sent",
    body: "Our accounting email changed. How do I update the address that gets our invoices? I don't want to change my actual login email.",
  },
  {
    id: "t-05",
    subject: "Charged in a different currency than usual",
    body: "This month's charge showed up in EUR instead of USD like every previous month, and the amount looks slightly different. What happened?",
  },

  // --- Technical bug (5) ---
  {
    id: "t-06",
    subject: "PDF export crashes on my Mac",
    body: "Every time I click 'Export to PDF' the whole app freezes and I have to force quit. I'm on a MacBook, latest macOS.",
  },
  {
    id: "t-07",
    subject: "PDF export crashes on Windows too",
    body: "Same as other people are reporting — PDF export crashes the app. I'm on Windows 11, not Mac.",
  },
  {
    id: "t-08",
    subject: "Dashboard takes forever to load",
    body: "Our main dashboard has gotten really slow over the last few weeks, sometimes 20+ seconds to load. We have a lot of data in there now.",
  },
  {
    id: "t-09",
    subject: "Not getting push notifications on my phone",
    body: "I used to get push notifications for new comments but they just stopped a few days ago. I haven't changed anything in the app.",
  },
  {
    id: "t-10",
    subject: "it dont work since update pls fix asap!!",
    body: "since the update it just dont work anymore. fix pls",
  },

  // --- Account access (5) ---
  {
    id: "t-11",
    subject: "Locked out after wrong password attempts",
    body: "I mistyped my password a bunch of times and now it says my account is locked. How long until I can try again, or is there a faster way in?",
  },
  {
    id: "t-12",
    subject: "Account locked, says suspicious activity",
    body: "I got an email saying my account was locked due to suspicious activity, but it was definitely me logging in from my new laptop. How do I get back in?",
  },
  {
    id: "t-13",
    subject: "Locked out, no email received",
    body: "My account is locked and I haven't gotten any email about why. I need back in as soon as possible.",
  },
  {
    id: "t-14",
    subject: "How do I turn on two-factor authentication",
    body: "I want to add 2FA to my account for security. Where do I set that up?",
  },
  {
    id: "t-15",
    subject: "Need to remove a former employee's access",
    body: "Someone left our team last week and I need to remove their access to our workspace immediately. I'm the account admin.",
  },

  // --- Feature request / other (4) ---
  {
    id: "t-16",
    subject: "Please add dark mode",
    body: "Would love to see a dark mode option in the mobile app, my eyes would thank you. Any plans for this?",
  },
  {
    id: "t-17",
    subject: "Which browsers do you support?",
    body: "Quick question before I roll this out to my team — which browsers are officially supported?",
  },
  {
    id: "t-18",
    subject: "What's the API rate limit on my plan?",
    body: "I'm building an integration and want to make sure I don't get throttled. What's the rate limit on the Pro plan?",
  },
  {
    id: "t-19",
    subject: "How to export all my data",
    body: "For GDPR reasons I'd like a full export of all data associated with my account. What's the process?",
  },

  // --- Ambiguous / adversarial (7) ---
  {
    id: "t-20",
    subject: "Double charge AND PDF export broken",
    body: "Two things: first, I was charged twice this month, please refund one. Second, the Mac PDF export is still crashing for me. Can you help with both?",
  },
  {
    id: "t-21",
    subject: "another bug, great",
    body: "cool, another day another bug, thanks a lot",
  },
  {
    id: "t-22",
    subject: "2fa thing not working",
    body: "trying to log in and it keeps saying my 2fa code is invalid even though I'm typing it right from the app, what's going on",
  },
  {
    id: "t-23",
    subject: "Want a refund, this isn't what I need",
    body: "I've been using this for two weeks and it just doesn't do what I need for my workflow. Can I get a refund?",
  },
  {
    id: "t-24",
    subject: "SSO/SAML support for our team",
    body: "We're a 200-person company and our security team requires SAML-based SSO for any tool we use. Do you support this, or is it on your roadmap? This is a blocker for us upgrading to a team plan.",
  },
  {
    id: "t-25",
    subject: "Billed for Pro but I'm still on Free",
    body: "I got an invoice email for the Pro plan but when I log in it still shows me as being on the Free plan with Free plan limits. What's going on?",
  },
  {
    id: "t-26",
    subject: "How do I add a new team member?",
    body: "Simple one — how do I invite a new person to our team workspace?",
  },
];
