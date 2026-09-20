/**
 * Veridian Corp IT Support Knowledge Base & Policy Repository
 * Grounded strictly in the Assignment 2 Data Pack (Week of 21-25 Sep 2026).
 * No ungrounded policies or facts are added.
 */

export const KNOWLEDGE_BASE = [
  {
    id: "KB-01",
    title: "Password Reset",
    category: "Access & Identity",
    summary: "Self-service password reset; manual IT unlock if locked out after 5 failed attempts. No approval required.",
    fullPolicy: "Employees can reset their own password via the self-service portal at any time. If locked out after 5 failed attempts, contact IT to unlock the account manually. No approval required.",
    rules: [
      "Employees can reset password via self-service portal at any time.",
      "If locked out after 5 failed attempts, contact IT to unlock account manually.",
      "No approval required for password reset or manual unlock."
    ],
    lockoutThreshold: 5,
    requiresApproval: false,
    keywords: ["password", "reset", "locked", "unlock", "attempts", "credentials", "login failed"]
  },
  {
    id: "KB-02",
    title: "VPN Access",
    category: "Network & Remote Access",
    summary: "FTEs get automatic VPN; contractors require manager approval form. Credentials expire every 90 days and must be renewed by employee.",
    fullPolicy: "VPN access is granted automatically to all full-time employees. Contractors require manager approval submitted via the access request form. VPN credentials expire every 90 days and must be renewed by the employee.",
    rules: [
      "VPN access is granted automatically to all full-time employees.",
      "Contractors require manager approval submitted via the access request form.",
      "VPN credentials expire every 90 days and must be renewed by the employee."
    ],
    credentialLifespanDays: 90,
    contractorRequiresManagerApproval: true,
    keywords: ["vpn", "remote access", "credentials expired", "renew", "contractor", "90 days", "cisco", "anyconnect"]
  },
  {
    id: "KB-03",
    title: "Laptop Replacement",
    category: "Hardware & Devices",
    summary: "Eligible after 3 years of service, or earlier for verified hardware failure. 2 weeks advance notice required.",
    fullPolicy: "Laptops are eligible for replacement after 3 years of service, or earlier in case of verified hardware failure. Requests must be raised at least 2 weeks in advance of intended replacement.",
    rules: [
      "Laptops are eligible for replacement after 3 years of service.",
      "Replacement earlier than 3 years is allowed only in case of verified hardware failure.",
      "Requests must be raised at least 2 weeks in advance of intended replacement."
    ],
    eligibilityYears: 3,
    advanceNoticeWeeks: 2,
    crossReference: "ASSET-POLICY-01",
    reconciliationNote: "Subject to Finance Asset Management Policy standard 4-year refresh cycle. Replacements under 4 years require Finance sign-off in addition to IT approval.",
    keywords: ["laptop", "replacement", "refresh", "3 years", "hardware failure", "dead", "broken", "screen", "flicker"]
  },
  {
    id: "KB-04",
    title: "Software Installation Requests",
    category: "Software & Applications",
    summary: "Standard catalog software is self-installed; non-catalog software requires IT Security review (3–5 business days).",
    fullPolicy: "Standard software (listed in the approved catalog) can be self-installed. Non-catalog software requires IT Security review, which takes 3–5 business days.",
    rules: [
      "Standard software (listed in approved catalog) can be self-installed.",
      "Non-catalog software requires IT Security review.",
      "IT Security review SLA takes 3–5 business days."
    ],
    securityReviewSlaDays: "3-5 business days",
    keywords: ["software", "install", "catalog", "non-catalog", "tool", "extension", "browser extension", "security review", "approval"]
  },
  {
    id: "KB-05",
    title: "Printer Troubleshooting",
    category: "Peripherals & Office",
    summary: "Check printer queue and restart print spooler. If issue persists, log ticket with printer asset tag.",
    fullPolicy: "For printer issues, first check the printer queue and restart the print spooler. If the issue persists after restart, log a ticket with the printer’s asset tag.",
    rules: [
      "First step: check printer queue and restart the print spooler.",
      "If issue persists after restart: log a ticket with the printer's asset tag."
    ],
    firstStepAction: "Restart print spooler & check queue",
    escalationAction: "Log ticket with printer asset tag",
    keywords: ["printer", "paper jam", "print spooler", "print queue", "asset tag", "printing", "scanner"]
  },
  {
    id: "KB-06",
    title: "Email Mailbox Quota",
    category: "Email & Collaboration",
    summary: "Default mailbox quota is 25GB. Employees should archive old mail. Quota increases beyond 25GB require manager approval and are capped at 50GB.",
    fullPolicy: "Default mailbox quota is 25GB. Employees nearing quota should archive old mail. Quota increases beyond 25GB require manager approval and are capped at 50GB.",
    rules: [
      "Default mailbox quota is 25GB.",
      "Employees nearing quota should archive old mail first.",
      "Quota increases beyond 25GB require manager approval.",
      "Quota increases are capped at 50GB maximum."
    ],
    defaultQuotaGB: 25,
    maxQuotaGB: 50,
    requiresManagerApprovalForIncrease: true,
    keywords: ["mailbox", "quota", "full", "archive", "25gb", "50gb", "storage", "email", "outlook"]
  },
  {
    id: "KB-07",
    title: "Guest Wi-Fi Access",
    category: "Network & Remote Access",
    summary: "Valid for 24 hours. Can be generated by any employee from the front-desk kiosk. No IT ticket required.",
    fullPolicy: "Guest Wi-Fi credentials are valid for 24 hours and can be generated by any employee from the front-desk kiosk. No IT ticket required.",
    rules: [
      "Guest Wi-Fi credentials are valid for 24 hours.",
      "Can be generated by any employee from the front-desk kiosk.",
      "No IT ticket required (direct self-service)."
    ],
    durationHours: 24,
    noTicketRequired: true,
    generationLocation: "Front-desk kiosk",
    keywords: ["wifi", "wi-fi", "guest", "visitor", "kiosk", "front desk", "24 hours", "wireless"]
  },
  {
    id: "KB-08",
    title: "Expense Software Access",
    category: "Finance & ERP Systems",
    summary: "Access is granted by Finance, not IT. IT can only assist with login/technical issues once an account already exists.",
    fullPolicy: "Access to the expense management tool is granted by Finance, not IT. IT can only assist with login/technical issues once an account already exists.",
    rules: [
      "Access to expense management tool is granted by Finance, not IT.",
      "IT can only assist with login/technical issues once an account already exists."
    ],
    grantingAuthority: "Finance",
    itScope: "Login/technical issues only for existing accounts",
    keywords: ["expense", "expense tool", "concur", "credentials", "invalid credentials", "finance access"]
  },
  {
    id: "KB-09",
    title: "Security Incident Reporting",
    category: "Information Security",
    summary: "Suspected phishing, malware, or unauthorized access must be reported to security@veridian-corp.example immediately and NOT forwarded to other employees.",
    fullPolicy: "Any suspected phishing email, malware, or unauthorized access attempt must be reported to security@veridian-corp.example immediately and should not be forwarded to other employees.",
    rules: [
      "Any suspected phishing email, malware, or unauthorized access attempt must be reported to security@veridian-corp.example immediately.",
      "CRITICAL: Should NOT be forwarded to other employees under any circumstances."
    ],
    incidentEmail: "security@veridian-corp.example",
    prohibitedAction: "Forwarding suspected emails to other employees",
    urgency: "Immediate",
    keywords: ["phishing", "suspicious email", "malware", "virus", "unauthorized access", "forwarding", "security incident"]
  },
  {
    id: "KB-10",
    title: "Work-From-Home Equipment",
    category: "Workplace & Equipment",
    summary: "Remote >3 days/week eligible for one-time allowance (chair, monitor). Requires manager sign-off + Finance processing. IT ships once approved.",
    fullPolicy: "Employees working remotely more than 3 days/week are eligible for a one-time home office equipment allowance (chair, monitor). Requires manager sign-off and Finance processing — IT only handles the equipment shipping request once approved.",
    rules: [
      "Employees working remotely more than 3 days/week are eligible for a one-time allowance.",
      "Allowance covers: chair, monitor.",
      "Prerequisite: Requires manager sign-off and Finance processing.",
      "IT responsibility: IT only handles equipment shipping request once approved."
    ],
    minRemoteDaysPerWeek: 3,
    coveredEquipment: ["chair", "monitor"],
    approvalChain: ["Manager sign-off", "Finance processing", "IT shipping fulfillment"],
    keywords: ["work from home", "wfh", "remote", "monitor", "chair", "home office", "allowance", "equipment allowance"]
  },
  {
    id: "ASSET-POLICY-01",
    title: "Asset Management Policy (Extract)",
    category: "Finance & Assets Policy",
    summary: "Standard 4-year refresh cycle for all company hardware. Early replacement outside this cycle requires Finance sign-off in addition to IT approval.",
    fullPolicy: "Asset Management Policy (Extract) — issued by Finance & Assets, last updated Q2 2026: All company-issued hardware, including laptops and monitors, follows a standard 4-year refresh cycle from date of issue. Early replacement outside this cycle requires Finance sign-off in addition to IT approval.",
    rules: [
      "All company-issued hardware (laptops, monitors) follows a standard 4-year refresh cycle from date of issue.",
      "Early replacement outside this 4-year cycle requires Finance sign-off in addition to IT approval."
    ],
    standardRefreshYears: 4,
    earlyReplacementRequirement: "Finance sign-off + IT approval",
    issuedBy: "Finance & Assets (Updated Q2 2026)",
    keywords: ["asset management", "4-year", "refresh cycle", "finance sign-off", "early replacement", "hardware policy"]
  }
];
