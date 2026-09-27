/**
 * The plan NDA text: one versioned source for the online page, the executed
 * PDF and the document hash. Changing ANY wording means bumping NDA_VERSION;
 * each signed record stores the version it was signed under.
 *
 * One-way (only Oh! discloses) confidential disclosure agreement for plan
 * viewers, drafted from the Common Paper / Bonterms structure plus the
 * restaurant + technology specifics of Oh!. Plain English, "you" is the
 * Recipient. No em dashes (house copy rule). Not legal advice: have a Utah
 * attorney review before relying on it.
 */

export const NDA_VERSION = "2026.09.27";
export const NDA_TITLE = "Confidential Disclosure Agreement";

export const COMPANY = {
  legalName: "Oh! Beef Noodle Soup, LLC",
  shortName: "Oh!",
  entity: "a Utah limited liability company",
  entityNumber: "14642519-0160",
  address: "379 W 3175 N, Lehi, Utah 84043",
  noticeEmail: "service@ohbeefnoodlesoup.com",
} as const;

export type NdaBlock = string | { list: string[] };

export interface NdaClause {
  n: number;
  title: string;
  blocks: NdaBlock[];
}

export const PREAMBLE =
  "This Confidential Disclosure Agreement (this \"Agreement\") is made as of the Effective Date between Oh! Beef Noodle Soup, LLC (\"Oh!\") and the Recipient named in the Key Terms (\"you\"). The Key Terms are part of this Agreement.";

export const CONSENT_ELECTRONIC =
  "I agree to use electronic records and signatures for this Agreement. My signature, typed or drawn, is my legal signature. I can download or print a copy now, and a fully executed copy will be emailed to me.";

export const CONSENT_TERMS = "I have read and agree to the Confidential Disclosure Agreement.";

export const ATTORNEY_NOTE = "Plain-English terms. You are welcome to have your own attorney review this Agreement before you sign.";

export const CLAUSES: readonly NdaClause[] = [
  {
    n: 1,
    title: "Purpose",
    blocks: [
      "Oh! is sharing its confidential business plan and related information so that you can evaluate a possible business relationship with Oh!, such as an investment, partnership, lease, supply, franchise, lending or advisory relationship (the \"Purpose\"). This Agreement covers everything Oh! shares with you for the Purpose, whether before, on or after the Effective Date.",
    ],
  },
  {
    n: 2,
    title: "Your Access",
    blocks: [
      "Oh! gives you access through a personal access code. The code is for you and, as Section 6 allows, your Representatives. You will not share the code, forward the invitation, or let anyone else use your session. Oh! may end your access at any time, and it records access activity (such as pages viewed and time spent) to protect its information.",
    ],
  },
  {
    n: 3,
    title: "Confidential Information",
    blocks: [
      "\"Confidential Information\" means all non-public information that Oh! or its members, managers, employees, agents or advisors disclose or make available to you, in any form (written, electronic, visual or oral), whether or not it is marked confidential, including:",
      {
        list: [
          "recipes, broth, beef and noodle formulations, ingredient specifications, preparation methods, cooking procedures and kitchen workflows;",
          "the pod-based dining format, floor plans, layouts, renderings, design concepts, build-out specifications and guest experience design;",
          "real estate strategy, potential sites, the site pipeline, and lease terms, proposals and negotiations;",
          "financial information, including the financial model and its assumptions, projections, scenarios, unit economics, budgets, pricing and capital needs;",
          "expansion, franchise and master-franchise strategy, market analysis and development schedules;",
          "membership, loyalty, referral and giving programs and their economics;",
          "the identities, terms and relationships of suppliers, vendors, landlords, partners and investors;",
          "technology, including the ordering platform, kiosk and kitchen systems, the Chappy AI assistant and its prompts, software, source code, data, models, algorithms and system designs;",
          "brand assets, names, marks, trade dress and marketing plans that are not yet public; and",
          "this business plan itself, and the existence and content of discussions between you and Oh!.",
        ],
      },
      "Confidential Information also includes all notes, analyses, compilations, summaries, forecasts and other materials that you or your Representatives prepare that contain or reflect any of it. Everything you see through the Oh! business plan portal is Confidential Information unless an exclusion in Section 4 applies.",
    ],
  },
  {
    n: 4,
    title: "What Is Not Confidential",
    blocks: [
      "Confidential Information does not include information that you can show, with written records: (a) is or becomes generally available to the public through no act or omission of you or your Representatives; (b) you lawfully knew, without a duty of confidentiality, before Oh! disclosed it; (c) you lawfully receive from a third party who owes no duty of confidentiality to Oh!; or (d) you independently develop without using or referring to Confidential Information.",
      "Information does not fall within these exclusions merely because parts of it are public or known to you, or because it can be assembled from public sources. You carry the burden of proving that an exclusion applies.",
    ],
  },
  {
    n: 5,
    title: "How You Will Protect It",
    blocks: [
      "You will:",
      {
        list: [
          "use Confidential Information only for the Purpose;",
          "keep it confidential and protect it with at least the care you use for your own most sensitive information, and never less than reasonable care;",
          "not disclose it to anyone except your Representatives as Section 6 allows;",
          "not copy, download, screenshot, photograph, record, scrape or otherwise capture the business plan or other Confidential Information, except as Oh! expressly allows in writing;",
          "not enter, upload or paste Confidential Information into any artificial intelligence, machine learning or large language model tool or service, unless the tool is controlled solely by you, is bound to keep the information confidential, and cannot use it to train models;",
          "not reverse engineer, decompile or try to derive the source code, prompts, models, recipes or formulations behind any Confidential Information;",
          "not use Confidential Information to develop, open, operate, fund, advise or assist any restaurant concept, dining format, product or software that competes with Oh!, or otherwise to compete with Oh!; and",
          "tell Oh! promptly, and in any event within 48 hours, after you learn of any unauthorized use or disclosure, and help Oh! stop it.",
        ],
      },
    ],
  },
  {
    n: 6,
    title: "Your Representatives",
    blocks: [
      "You may share Confidential Information with your directors, officers, employees, attorneys, accountants, financial advisors and potential financing sources (your \"Representatives\") only if they need to know it for the Purpose, you tell them it is confidential, and they are bound by duties of confidentiality at least as protective as this Agreement. You are responsible for any act or omission of a Representative that would breach this Agreement if you had done it.",
    ],
  },
  {
    n: 7,
    title: "Disclosures the Law Requires",
    blocks: [
      "If a law, regulation, court order or legal process requires you to disclose Confidential Information, you will, where legally allowed, give Oh! prompt written notice so that Oh! can seek a protective order or other remedy, reasonably cooperate with Oh! at Oh!'s expense, and disclose only the part you are legally required to disclose. Information disclosed this way remains Confidential Information for every other purpose.",
    ],
  },
  {
    n: 8,
    title: "Reporting to Government Agencies",
    blocks: [
      "Nothing in this Agreement prohibits or restricts you from reporting a possible violation of law to any government agency or regulator (including the Securities and Exchange Commission), cooperating with an investigation, making other disclosures protected by whistleblower laws, or receiving an award for information provided to a government agency.",
      "Notice under the Defend Trade Secrets Act, 18 U.S.C. § 1833(b): An individual will not be held criminally or civilly liable under any federal or state trade secret law for disclosing a trade secret (a) in confidence to a federal, state or local government official, directly or indirectly, or to an attorney, solely for the purpose of reporting or investigating a suspected violation of law; or (b) in a complaint or other document filed in a lawsuit or other proceeding, if the filing is made under seal. An individual who files a lawsuit for retaliation by an employer for reporting a suspected violation of law may disclose the trade secret to the individual's attorney and use it in the court proceeding if the individual files any document containing the trade secret under seal and does not disclose the trade secret except under court order.",
    ],
  },
  {
    n: 9,
    title: "Term",
    blocks: [
      "This Agreement starts on the Effective Date. Your obligations last until three (3) years after the later of the Effective Date and your last access to Confidential Information. For Confidential Information that is a trade secret under applicable law, including recipes, formulations, source code and prompts, your obligations last for as long as it remains a trade secret. Either party may end future disclosures at any time by written notice; ending disclosures does not end your obligations.",
    ],
  },
  {
    n: 10,
    title: "Returning or Destroying Information",
    blocks: [
      "When Oh! asks, or when discussions end, you will promptly stop using Confidential Information, return or destroy it (including notes and analyses that contain it), and confirm in writing that you have done so. You may keep copies that your automatic backup systems create, or that law or a bona fide professional or regulatory retention policy requires, as long as you do not access them for any other purpose. Those copies stay subject to this Agreement for as long as you keep them.",
    ],
  },
  {
    n: 11,
    title: "Oh! Owns Its Information",
    blocks: [
      "All Confidential Information is and remains the property of Oh!. This Agreement does not give you any license or right in Oh!'s Confidential Information, trade secrets, recipes, formulations, trademarks, trade names, trade dress, designs, floor plans, copyrights, software, patents or other intellectual property, except the limited right to review Confidential Information for the Purpose.",
    ],
  },
  {
    n: 12,
    title: "Feedback",
    blocks: [
      "If you give Oh! suggestions, comments or ideas about its business, plan, products or technology (\"Feedback\"), Oh! may use the Feedback freely, without restriction and without any obligation to you. Feedback is provided \"as is.\"",
    ],
  },
  {
    n: 13,
    title: "No Solicitation of the Oh! Team",
    blocks: [
      "For twelve (12) months after the Effective Date, you will not, directly or through others, solicit for employment or engagement any employee, contractor or key member of the Oh! team whom you met or learned about through the Purpose. General job advertisements not aimed at the Oh! team, and hiring someone who responds to them without other solicitation, do not violate this Section.",
    ],
  },
  {
    n: 14,
    title: "No Circumvention",
    blocks: [
      "For eighteen (18) months after the Effective Date, you will not, directly or through others, use Confidential Information to contact, negotiate with, contract with or otherwise deal with any landlord, property owner, site, supplier, vendor, franchise prospect, co-investor or other business relationship identified to you through the Purpose, in order to bypass Oh!, interfere with Oh!'s relationship or opportunity, or pursue for yourself or anyone else an opportunity that Oh! disclosed to you. This Section does not restrict dealings that you can show, with written records, you had with that party before the Effective Date and that do not use Confidential Information.",
    ],
  },
  {
    n: 15,
    title: "No Residuals",
    blocks: [
      "Information that you or your Representatives retain in unaided memory is not excluded from this Agreement. You may not use Confidential Information that you remember for any purpose other than the Purpose.",
    ],
  },
  {
    n: 16,
    title: "No Obligation to Do a Deal",
    blocks: [
      "This Agreement does not obligate either party to enter into any transaction or relationship. No agreement about an investment, lease, partnership, franchise or other transaction will exist unless and until the parties sign a separate, definitive written agreement. Either party may end discussions at any time, for any reason.",
    ],
  },
  {
    n: 17,
    title: "No Warranties; Forward-Looking Statements",
    blocks: [
      "Oh! provides Confidential Information \"as is.\" Oh! makes no representation or warranty, express or implied, about its accuracy or completeness, and has no liability for your use of it, except as a definitive written agreement may provide.",
      "The business plan contains projections, estimates, assumptions and other forward-looking statements. They reflect current expectations, are inherently uncertain and are not guarantees of future results. Actual results may differ materially.",
    ],
  },
  {
    n: 18,
    title: "Not an Offer of Securities",
    blocks: [
      "Nothing Oh! shares with you is an offer to sell, or a solicitation of an offer to buy, any security. Any offering of securities will be made only through definitive offering documents, to persons who qualify, in compliance with applicable securities laws. You acknowledge that you may receive material non-public information and that securities laws may restrict trading in the securities of any public company to which that information relates.",
    ],
  },
  {
    n: 19,
    title: "Remedies",
    blocks: [
      "Unauthorized use or disclosure of Confidential Information would cause Oh! irreparable harm for which money damages would not be an adequate remedy. Oh! may seek an injunction, specific performance and other equitable relief to prevent or stop any breach or threatened breach, without having to prove actual damages and, to the extent the law allows, without posting a bond. These remedies are in addition to any other remedy under this Agreement, the Utah Uniform Trade Secrets Act or other law. In any action to enforce this Agreement, the prevailing party may recover its reasonable attorneys' fees and costs.",
    ],
  },
  {
    n: 20,
    title: "Governing Law and Courts",
    blocks: [
      "Utah law governs this Agreement, without regard to its conflict of laws rules. The state courts located in Utah County, Utah, and the United States District Court for the District of Utah have exclusive jurisdiction over any dispute arising out of or relating to this Agreement, and each party consents to their personal jurisdiction and venue. Oh! may also seek injunctive relief in any court of competent jurisdiction.",
    ],
  },
  {
    n: 21,
    title: "General Terms",
    blocks: [
      "This Agreement is the entire agreement between the parties about its subject and replaces all earlier agreements about it, but not any later definitive agreement. It can be changed or waived only in a writing signed by both parties, and a failure or delay in enforcing any provision is not a waiver. If a court finds any provision unenforceable, that provision will be enforced to the maximum extent allowed and reformed as needed, and the rest of this Agreement stays in effect.",
      "You may not assign this Agreement without Oh!'s written consent; Oh! may assign it to an affiliate or to a successor to its business. Notices to Oh! go by email to service@ohbeefnoodlesoup.com and by mail to the address in the Key Terms; notices to you may go to the email or address you provided. Sections 3 through 22 survive any termination of this Agreement.",
    ],
  },
  {
    n: 22,
    title: "Electronic Signatures and Records",
    blocks: [
      "The parties agree to do business electronically. This Agreement may be signed electronically and in counterparts, and an electronic signature has the same legal effect as a handwritten signature under the federal Electronic Signatures in Global and National Commerce Act (15 U.S.C. § 7001 and following) and the Utah Uniform Electronic Transactions Act (Utah Code Title 46, Chapter 4). Your electronic signature, together with the record of your identity verification, consent and signing, is attributable to you.",
      "You may download or print this Agreement when you sign it, and Oh! will email a fully executed copy to you. You may request a paper copy at no charge by writing to service@ohbeefnoodlesoup.com. If you sign on behalf of an organization, you represent that you are authorized to bind it, and \"you\" includes that organization.",
    ],
  },
];
