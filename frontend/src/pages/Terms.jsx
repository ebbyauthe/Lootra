import React from "react";
import { Link } from "react-router-dom";

const Section = ({ id, title, children }) => (
  <div id={id} className="mb-10">
    <h2 className="text-base font-medium text-white uppercase tracking-widest mb-4 font-mono border-b border-[#2A2A2A] pb-3">{title}</h2>
    <div className="text-sm text-neutral-400 leading-relaxed space-y-3">{children}</div>
  </div>
);

const toc = [
  ["services", "1. Our Services"],
  ["ip", "2. Intellectual Property Rights"],
  ["userreps", "3. User Representations"],
  ["userreg", "4. User Registration"],
  ["purchases", "5. Purchases and Payment"],
  ["refunds", "6. Refunds Policy"],
  ["prohibited", "7. Prohibited Activities"],
  ["ugc", "8. User Generated Contributions"],
  ["reviews-guidelines", "9. Guidelines for Reviews"],
  ["thirdparty", "10. Third-Party Websites"],
  ["sitemanage", "11. Services Management"],
  ["privacy", "12. Privacy Policy"],
  ["terms", "13. Term and Termination"],
  ["modifications", "14. Modifications and Interruptions"],
  ["law", "15. Governing Law"],
  ["disputes", "16. Dispute Resolution"],
  ["disclaimer", "17. Disclaimer"],
  ["liability", "18. Limitations of Liability"],
  ["contact", "19. Contact Us"],
  ["escrow-clause", "20. Escrow and Platform Fee"],
  ["handover-clause", "21. Handover Window and Auto-Dispute"],
  ["complaint-clause", "22. Post-Confirmation Complaint Window"],
  ["seller-clause", "23. Seller Warranty and Account Accuracy"],
  ["digital-clause", "24. Digital Goods and Third-Party Game Publishers"],
  ["ratings-clause", "25. Reviews and Ratings"],
  ["wallet-clause", "26. Wallet and Withdrawal Hold Period"],
];

export default function Terms() {
  return (
    <div className="max-w-3xl mx-auto py-12 animate-fade-in">
      <div className="lootra-badge inline-block mb-4">LEGAL</div>
      <h1 className="text-3xl font-medium tracking-tight mb-1">Terms of Service</h1>
      <p className="text-xs text-neutral-500 font-mono mb-10">Last updated: May 22, 2026</p>

      <div className="lootra-card p-6 mb-10">
        <p className="text-sm text-neutral-400 leading-relaxed">
          We are <span className="text-white font-medium">Lootra</span> ("Company", "we", "us", or "our"), operating the website{" "}
          <a href="https://www.lootra.org" className="text-[#CCFF00] hover:underline">https://www.lootra.org</a>.
          Lootra is a peer-to-peer marketplace where gamers can buy and sell gaming accounts and in-game items with confidence.
          Every transaction is protected by an escrow system — funds are held securely until the buyer confirms successful account access,
          protecting both sides from fraud.
        </p>
        <p className="text-sm text-neutral-400 leading-relaxed mt-3">
          By accessing the Services, you agree to be bound by these Legal Terms. If you do not agree, you must discontinue use immediately.
          <span className="text-white font-medium"> The Services are intended for users who are at least 18 years old.</span>
        </p>
        <p className="text-sm text-neutral-400 leading-relaxed mt-3">
          You can contact us at{" "}
          <a href="mailto:lootra.net@gmail.com" className="text-[#CCFF00] hover:underline">lootra.net@gmail.com</a>.
        </p>
      </div>

      {/* Table of Contents */}
      <div className="lootra-card p-6 mb-10">
        <h2 className="text-xs uppercase tracking-[0.2em] font-mono text-neutral-500 mb-4">Table of Contents</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {toc.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="text-xs text-neutral-500 hover:text-[#CCFF00] transition-colors font-mono">
              {label}
            </a>
          ))}
        </div>
      </div>

      <Section id="services" title="1. Our Services">
        <p>The Services are provided for lawful purposes only. Users accessing the Services from outside our primary jurisdiction do so on their own initiative and are responsible for compliance with local laws.</p>
        <p>The Services are not tailored to comply with industry-specific regulations such as HIPAA or FISMA. Do not use the Services in a manner that would violate such laws.</p>
      </Section>

      <Section id="ip" title="2. Intellectual Property Rights">
        <p>We own or are licensed to use all intellectual property rights in the Services, including source code, databases, software, website designs, text, and graphics (collectively, "Content"), as well as all trademarks and logos ("Marks").</p>
        <p>You may not copy, reproduce, distribute, sell, or otherwise exploit any part of the Services or Content for commercial purposes without our express prior written permission. Requests may be sent to <a href="mailto:lootra.net@gmail.com" className="text-[#CCFF00] hover:underline">lootra.net@gmail.com</a>.</p>
      </Section>

      <Section id="userreps" title="3. User Representations">
        <p>By using the Services, you represent and warrant that: (a) all registration information you submit is truthful and accurate; (b) you will maintain the accuracy of such information; (c) you are at least 18 years of age; (d) you will not access the Services through automated or non-human means; (e) you will not use the Services for any illegal or unauthorized purpose; and (f) your use will not violate any applicable law or regulation.</p>
      </Section>

      <Section id="userreg" title="4. User Registration">
        <p>You may be required to register with the Services. You agree to keep your password confidential and are responsible for all use of your account. We reserve the right to remove, reclaim, or change a username if we determine it is inappropriate, obscene, or otherwise objectionable.</p>
      </Section>

      <Section id="purchases" title="5. Purchases and Payment">
        <p>All purchases are made through the platform's wallet system. Funds must be deposited into your Lootra wallet before completing a purchase. We accept top-ups via fiat payment (processed by Flutterwave) and cryptocurrency (processed by NowPayments).</p>
        <p>A platform fee is added to each purchase at checkout. By completing a purchase you agree to pay the listed price plus the applicable platform fee.</p>
      </Section>

      <Section id="refunds" title="6. Refunds Policy">
        <p>All sales on Lootra are for digital goods. Refunds are only available through the dispute resolution process. If a dispute is resolved in the buyer's favour, the full amount charged — including the platform fee — is returned to the buyer's Lootra wallet.</p>
        <p>Once funds have been released to the seller (either by buyer confirmation or expiry of the complaint window), no refunds can be issued. Wallet balances are non-refundable to external payment methods except through the withdrawal process.</p>
      </Section>

      <Section id="prohibited" title="7. Prohibited Activities">
        <p>You may not access or use the Services for any purpose other than that for which we make the Services available. As a user of the Services, you agree not to:</p>
        <ul className="list-disc list-inside space-y-1.5 ml-2">
          <li>Sell or otherwise transfer your Lootra profile or account to another person</li>
          <li>List accounts that are banned, suspended, or do not match their description</li>
          <li>Provide false or misleading information in a listing</li>
          <li>Impersonate another user or seller</li>
          <li>Create multiple accounts to manipulate ratings or bypass restrictions</li>
          <li>Attempt to complete transactions outside the platform to avoid escrow</li>
          <li>Initiate fraudulent chargebacks or payment disputes after receiving account access</li>
          <li>Top up using stolen payment methods or fraudulent transactions</li>
          <li>List accounts that belong to someone else without full authorization</li>
          <li>Deliberately delay the handover to exploit the escrow window</li>
          <li>Attempt to manipulate or circumvent the escrow or dispute system</li>
          <li>Use automated tools or bots to interact with the platform</li>
          <li>Scrape listings or user data from the platform</li>
          <li>Harass, threaten, or abuse other users through the order chat</li>
        </ul>
      </Section>

      <Section id="ugc" title="8. User Generated Contributions">
        <p>The Services may allow you to submit listing descriptions, order chat messages, and reviews ("Contributions"). You are solely responsible for your Contributions and represent that they are accurate, lawful, and do not infringe any third-party rights.</p>
        <p>We reserve the right to remove or edit any Contribution at any time and may suspend or terminate accounts that post harmful or policy-violating content.</p>
      </Section>

      <Section id="reviews-guidelines" title="9. Guidelines for Reviews">
        <p>Users may leave reviews on completed orders. Reviews must be honest, accurate, and based on a genuine transaction. The following are prohibited:</p>
        <ul className="list-disc list-inside space-y-1.5 ml-2">
          <li>Fake or incentivised reviews</li>
          <li>Retaliatory reviews intended to harm another user</li>
          <li>Reviews that contain false statements of fact</li>
          <li>Reviews that contain discriminatory, hateful, or offensive language</li>
        </ul>
        <p>We reserve the right to remove reviews that violate these guidelines without notice.</p>
      </Section>

      <Section id="thirdparty" title="10. Third-Party Websites and Content">
        <p>The Services may link to third-party websites including Flutterwave, NowPayments, Cloudflare, and Resend. We are not responsible for the content, policies, or practices of any third-party sites. Your use of third-party services is governed by their respective terms and privacy policies.</p>
      </Section>

      <Section id="sitemanage" title="11. Services Management">
        <p>We reserve the right to: monitor the Services for violations of these Terms; take appropriate legal action against violators; restrict or deny access to any user at our discretion; remove or disable content that is excessive in size or burdensome to our systems; and otherwise manage the Services to protect our rights and ensure proper functioning.</p>
      </Section>

      <Section id="privacy" title="12. Privacy Policy">
        <p>We care about data privacy and security. Please review our{" "}
          <Link to="/privacy" className="text-[#CCFF00] hover:underline">Privacy Policy</Link>.
          By using the Services, you agree to be bound by our Privacy Policy, which is incorporated into these Terms.
        </p>
      </Section>

      <Section id="terms" title="13. Term and Termination">
        <p>These Legal Terms remain in full force while you use the Services. We reserve the right to deny access to or use of the Services to any person for any reason at our sole discretion, including for breach of any representation, warranty, or covenant in these Terms.</p>
        <p>If your account is terminated, you may not register a new account. We may also take appropriate legal action, including civil, criminal, or injunctive relief.</p>
      </Section>

      <Section id="modifications" title="14. Modifications and Interruptions">
        <p>We reserve the right to change, modify, or remove the contents of the Services at any time without notice. We will not be liable for any modification, suspension, or discontinuation of the Services.</p>
        <p>We cannot guarantee the Services will be available at all times. We may experience downtime for maintenance, updates, or causes beyond our control. We are not liable for any loss or inconvenience caused by unavailability.</p>
      </Section>

      <Section id="law" title="15. Governing Law">
        <p>These Legal Terms are governed by and construed in accordance with applicable laws, without regard to conflict of law principles. You and Lootra agree to submit to the jurisdiction specified in the Dispute Resolution section below.</p>
      </Section>

      <Section id="disputes" title="16. Dispute Resolution">
        <p><strong className="text-white">Informal Negotiations.</strong> Before initiating formal proceedings, the parties agree to attempt to resolve any dispute informally by contacting us at <a href="mailto:lootra.net@gmail.com" className="text-[#CCFF00] hover:underline">lootra.net@gmail.com</a>. Informal negotiations shall last at least 30 days from the date notice is sent.</p>
        <p><strong className="text-white">Binding Arbitration.</strong> If informal negotiations fail, disputes shall be resolved by binding arbitration. The arbitration shall be conducted in English by a single arbitrator. The decision of the arbitrator shall be final and binding.</p>
        <p><strong className="text-white">Exceptions.</strong> Nothing in this section limits either party's right to seek injunctive relief in a court of competent jurisdiction to prevent irreparable harm.</p>
      </Section>

      <Section id="disclaimer" title="17. Disclaimer">
        <p>THE SERVICES ARE PROVIDED ON AN AS-IS AND AS-AVAILABLE BASIS. TO THE FULLEST EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE MAKE NO REPRESENTATIONS ABOUT THE ACCURACY OR COMPLETENESS OF THE SERVICES' CONTENT.</p>
      </Section>

      <Section id="liability" title="18. Limitations of Liability">
        <p>TO THE FULLEST EXTENT PERMITTED BY LAW, IN NO EVENT SHALL LOOTRA BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES. OUR TOTAL LIABILITY TO YOU FOR ANY CAUSE OF ACTION SHALL NOT EXCEED THE AMOUNT YOU PAID TO LOOTRA IN THE TRANSACTION GIVING RISE TO THE CLAIM.</p>
      </Section>

      <Section id="contact" title="19. Contact Us">
        <p>To resolve a complaint or receive further information regarding use of the Services, please contact us at:</p>
        <div className="lootra-card p-4 font-mono text-xs mt-3 space-y-1">
          <div className="text-white">Lootra</div>
          <div><a href="mailto:lootra.net@gmail.com" className="text-[#CCFF00] hover:underline">lootra.net@gmail.com</a></div>
        </div>
      </Section>

      <div className="border-t border-[#2A2A2A] pt-10 mt-4">
        <p className="text-xs uppercase tracking-[0.2em] font-mono text-[#CCFF00] mb-8">Lootra-Specific Terms</p>

        <Section id="escrow-clause" title="20. Escrow and Platform Fee">
          <p>All purchases on Lootra are processed through an escrow system. Upon payment, funds are held by Lootra and are not released to the seller until the buyer confirms successful account access.</p>
          <p>Lootra charges a platform fee on each transaction, added to the listing price at checkout. This fee is non-refundable once a transaction is marked as completed and funds have been released to the seller.</p>
          <p>In the event of a successful dispute resulting in a refund, the full amount charged to the buyer — including the platform fee — will be returned to the buyer's Lootra wallet.</p>
        </Section>

        <Section id="handover-clause" title="21. Handover Window and Auto-Dispute">
          <p>Upon purchase, the seller is required to assist the buyer with account access within 65 minutes. A reminder is sent at the halfway point. If the seller fails to complete the handover within this window, the order is automatically escalated to a dispute.</p>
          <p>Lootra reserves the right to refund the buyer in full if the seller does not fulfill their obligations within the handover period.</p>
        </Section>

        <Section id="complaint-clause" title="22. Post-Confirmation Complaint Window">
          <p>After a buyer confirms account access, a complaint window remains open for a limited period during which the buyer may raise a dispute if issues arise.</p>
          <p>Once the complaint window closes, funds are automatically and permanently released to the seller. No disputes can be raised after this window expires.</p>
        </Section>

        <Section id="seller-clause" title="23. Seller Warranty and Account Accuracy">
          <p>By listing an item on Lootra, the seller warrants that:</p>
          <ul className="list-disc list-inside space-y-1.5 ml-2">
            <li>The account or item matches the listing description at the time of sale</li>
            <li>The seller has full ownership and right to sell the account</li>
            <li>The account is not banned, suspended, or under any restriction that was not disclosed in the listing</li>
            <li>The credentials provided are valid and grant full access</li>
          </ul>
          <p>Misrepresentation of a listing is grounds for dispute, refund, and permanent account termination.</p>
        </Section>

        <Section id="digital-clause" title="24. Digital Goods and Third-Party Game Publishers">
          <p>Lootra facilitates the sale of digital gaming accounts and items between private parties. Lootra is not affiliated with any game publisher or developer.</p>
          <p>The sale of gaming accounts may violate the Terms of Service of the original game. Lootra is not responsible for any actions taken by a game publisher after a transaction is completed, including account bans, suspensions, or access revocations. Buyers acknowledge this risk before purchase.</p>
        </Section>

        <Section id="ratings-clause" title="25. Reviews and Ratings">
          <p>Users may leave a review on completed orders. Reviews must be honest, accurate, and based on a real transaction. Lootra prohibits fake, incentivised, or retaliatory reviews. Lootra reserves the right to remove reviews that violate these guidelines.</p>
        </Section>

        <Section id="wallet-clause" title="26. Wallet and Withdrawal Hold Period">
          <p>Funds earned from completed sales are credited to the seller's Lootra wallet and are subject to a holding period before they become eligible for withdrawal. This holding period exists to protect against fraudulent chargebacks and disputes.</p>
          <p>Lootra reserves the right to adjust the holding period and will notify users of any changes. Withdrawal requests are subject to review and approval by Lootra.</p>
        </Section>
      </div>

      <div className="text-center mt-12 text-xs text-neutral-600 font-mono">
        © {new Date().getFullYear()} Lootra — All rights reserved.
      </div>
    </div>
  );
}
