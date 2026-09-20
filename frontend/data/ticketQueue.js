/**
 * Veridian Corp Ticket Queue (Section 3 of Data Pack)
 * Contains all 10 tickets:
 * - 6 Closed historical precedent tickets
 * - 4 Active open cases needing agent resolution or routing
 */

export const TICKET_QUEUE = [
  {
    ticketId: "TK-1042",
    employee: "R. Verma",
    issueSummary: "VPN credential expired",
    status: "Resolved (closed)",
    isActive: false,
    category: "Network & Remote Access",
    policyRef: "KB-02",
    resolutionNotes: "Provided employee with self-service 90-day VPN credential renewal portal link. Employee successfully renewed credentials.",
    precedentFor: ["REQ-05"]
  },
  {
    ticketId: "TK-1043",
    employee: "S. Iyer",
    issueSummary: "Laptop replacement (3.2 yrs old)",
    status: "Approved — pending fulfillment (active)",
    isActive: true,
    category: "Hardware & Devices",
    policyRef: "KB-03 & ASSET-POLICY-01",
    resolutionNotes: "Laptop is 3.2 yrs old (> 3 yrs per KB-03). Early replacement under 4-year Finance refresh cycle has received Finance sign-off. Awaiting IT hardware depot fulfillment.",
    precedentFor: ["REQ-01"],
    recommendedNextStep: "Route to IT Hardware Logistics Depot to dispatch standard replacement laptop and issue tracking number."
  },
  {
    ticketId: "TK-1044",
    employee: "A. Khan",
    issueSummary: "Non-catalog software request",
    status: "Pending Security review (active)",
    isActive: true,
    category: "Software & Applications",
    policyRef: "KB-04",
    resolutionNotes: "Software is not in standard approved catalog. Submitted for IT Security review under KB-04 (3-5 business days SLA).",
    precedentFor: ["REQ-04", "REQ-14"],
    recommendedNextStep: "Check IT Security review SLA queue; ping Security reviewer if >3 business days, notify employee of current review status."
  },
  {
    ticketId: "TK-1045",
    employee: "P. Joshi",
    issueSummary: "Mailbox quota increase",
    status: "Approved at 35GB (closed)",
    isActive: false,
    category: "Email & Collaboration",
    policyRef: "KB-06",
    resolutionNotes: "Manager approval received for quota expansion beyond 25GB default. Quota set to 35GB (within 50GB max cap).",
    precedentFor: ["REQ-09"]
  },
  {
    ticketId: "TK-1046",
    employee: "M. Das",
    issueSummary: "Printer paper jam, floor 2",
    status: "Resolved (closed)",
    isActive: false,
    category: "Peripherals & Office",
    policyRef: "KB-05",
    resolutionNotes: "Technician cleared stuck sensor flag after print spooler restart and physical paper clearance on Floor 2 multifunction printer.",
    precedentFor: ["REQ-06"]
  },
  {
    ticketId: "TK-1047",
    employee: "K. Singh",
    issueSummary: "Home office equipment request",
    status: "Pending Finance (active)",
    isActive: true,
    category: "Workplace & Equipment",
    policyRef: "KB-10",
    resolutionNotes: "Employee works remotely 4 days/week. Manager sign-off submitted. Currently awaiting Finance processing.",
    precedentFor: ["REQ-07"],
    recommendedNextStep: "Monitor Finance processing sign-off; pre-stage warehouse shipping requisition so monitor ships immediately upon Finance sign-off."
  },
  {
    ticketId: "TK-1048",
    employee: "T. Rao",
    issueSummary: "Phishing email reported",
    status: "Escalated to Security — under investigation (active)",
    isActive: true,
    category: "Information Security",
    policyRef: "KB-09",
    resolutionNotes: "Suspected phishing email reported to security@veridian-corp.example immediately without forwarding. Security team analyzing payload and quarantining sender domain.",
    precedentFor: ["REQ-08"],
    recommendedNextStep: "Maintain incident active state; verify sender domain and malicious URL block on enterprise email gateway."
  },
  {
    ticketId: "TK-1049",
    employee: "V. Nambiar",
    issueSummary: "Password reset",
    status: "Resolved (closed)",
    isActive: false,
    category: "Access & Identity",
    policyRef: "KB-01",
    resolutionNotes: "Account locked after 5 failed attempts. IT agent executed manual unlock per KB-01. User set new password.",
    precedentFor: ["REQ-03"]
  },
  {
    ticketId: "TK-1050",
    employee: "J. Fernandes",
    issueSummary: "Admin access request",
    status: "Rejected — no business justification provided (closed)",
    isActive: false,
    category: "Access & Identity",
    policyRef: "Access Control Governance",
    resolutionNotes: "Privileged admin access to production servers requires formal business justification and department owner sign-off. Rejected due to absence of justification.",
    precedentFor: ["REQ-10"]
  },
  {
    ticketId: "TK-1051",
    employee: "L. Menon",
    issueSummary: "Guest Wi-Fi issued",
    status: "Resolved (closed)",
    isActive: false,
    category: "Network & Remote Access",
    policyRef: "KB-07",
    resolutionNotes: "Employee generated 24-hour guest Wi-Fi credentials directly at the front-desk kiosk without requiring IT intervention.",
    precedentFor: ["REQ-02"]
  }
];
