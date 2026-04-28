"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

const sections = [
  {
    title: "Terms of Service",
    content: `
Restok™ Terms of Service

Last updated: 12/22/2025

Agreement to Terms
These Terms of Service (“Terms”) govern your access to and use of Restok™ (the “Service”). By accessing or using the Service, you
agree to these Terms. If you do not agree, do not use the Service.

Company
Restok™ is owned and operated by Inner Space Systems, Inc. (“Company,” “we,” “us,” or “our”).
Website: getrestok.com
Support: support@getrestok.com
Address: PO Box 9070, Chattanooga, TN 37412

Eligibility & Authority
You must be at least 18 years old and have authority to bind your business. You represent that information you provide is accurate and
that you will keep it updated.

Service Description
Restok™ provides tools for office inventory reminders, usage insights, and reorder workflows. Restok™ does not guarantee inventory
levels, product availability, supplier performance, shipping times, or uninterrupted operation.

Accounts & Security
You are responsible for safeguarding account credentials and for all activity under your account. Notify us promptly of any unauthorized
use.

Subscriptions, Billing, and Changes
Paid features require a subscription. Billing terms and renewal periods are presented at purchase. We may change pricing or features
with notice as required by law; changes typically apply at the next renewal unless stated otherwise.

Acceptable Use
You agree not to:
• Use the Service for unlawful purposes
• Interfere with or disrupt the Service
• Attempt to access accounts or systems without authorization
• Reverse engineer or copy the Service except as permitted by law
• Upload malware or harmful code

Customer Data
You retain ownership of data you submit (“Customer Data”). You grant us a limited right to process Customer Data to provide, maintain,
and improve the Service. You are responsible for the legality of Customer Data and your right to use it.

HIPAA / PHI Disclaimer
Restok™ is not a HIPAA-compliant system and is not intended to store or process Protected Health Information (PHI). You agree not
to input PHI or patient-identifiable information into the Service. You are responsible for compliance with applicable laws and policies.

Intellectual Property
The Service, including software, design, and trademarks, are owned by the Company and its licensors. You receive a limited, non-
exclusive, non-transferable right to use the Service during your subscription, subject to these Terms.

Third-Party Services & Suppliers
The Service may integrate with third-party services or suppliers. We are not responsible for third-party products, services, pricing,
availability, or performance.

Disclaimers
THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE.” WE DISCLAIM ALL WARRANTIES, INCLUDING IMPLIED
WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT, TO THE
MAXIMUM EXTENT PERMITTED BY LAW.

Limitation of Liability
TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE COMPANY WILL NOT BE LIABLE FOR INDIRECT, INCIDENTAL,
SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES. OUR TOTAL LIABILITY FOR ANY CLAIM WILL NOT EXCEED THE
AMOUNTS YOU PAID FOR THE SERVICE IN THE 12 MONTHS BEFORE THE EVENT GIVING RISE TO THE CLAIM.

Termination
You may cancel at any time. We may suspend or terminate access for violations, non-payment, or legal compliance. Upon termination,
your right to use the Service ends.

Governing Law
These Terms are governed by the laws of the state where Inner Space Systems, Inc. is incorporated, without regard to conflict of laws
principles.

Changes to Terms
We may update these Terms from time to time. The “Last updated” date indicates when changes were made. Continued use after
changes become effective constitutes acceptance.

Contact
support@getrestok.com
    `
  },
  {
    title: "Privacy Policy",
    content: `
Restok™ Privacy Policy

Last updated: 12/22/2025

Overview
This Privacy Policy describes how Inner Space Systems, Inc. (“Company,” “we,” “us,” or “our”) collects, uses, shares, and protects
information when you use Restok™ (the “Service”), including the Restok™ website (getrestok.com) and related applications.

Information We Collect
We collect the following categories of information:

1) Information you provide
• Account information (name, business name, email address)
• Login credentials (stored/managed via authentication providers)
• Inventory and workflow data you enter (items, categories, quantities, usage signals, reminders)
• Support communications
2) Information collected automatically
• Device and browser information
• IP address and approximate location derived from IP
• Usage analytics (pages/screens viewed, actions taken, timestamps)
• Logs for security and performance
3) Payment information
Payments are processed by Stripe. We do not store full payment card numbers. Stripe may collect and store your payment information
in accordance with Stripe’s policies.

How We Use Information
We use information to:
• Provide and operate the Service
• Authenticate users and prevent fraud
• Send reminders/notifications you configure
• Provide customer support
• Improve and develop features (including usage insights)
• Comply with legal obligations

Notifications (Email/SMS)
If you enable notifications, we may send emails or messages related to reminders, account alerts, billing, and support. You can adjust
notification preferences in the Service where available. Message and data rates may apply for SMS.

How We Share Information
We do not sell personal information.

We may share information with:
• Service providers and subprocessors that help operate Restok™ (e.g., hosting, analytics, email delivery)
• Stripe for payment processing
• Your designated suppliers only as needed to send reorder communications you initiate or approve
• Law enforcement or regulators if required by law
• In connection with a business transfer (e.g., merger, acquisition), subject to appropriate safeguards

Data Storage & Security
Restok™ may use cloud infrastructure providers (including Firebase) to store and process data. We implement reasonable
administrative, technical, and physical safeguards to protect information. No system can be guaranteed 100% secure.

Data Retention
We retain information as long as needed to provide the Service and for legitimate business purposes, including compliance, dispute
resolution, and enforcement of agreements. You may request deletion of your account, subject to legal and operational requirements.Your Choices & Rights
Depending on your location, you may have rights to access, correct, or delete your personal information, or to object to certain
processing. To request these, contact support@getrestok.com.

Children’s Privacy
Restok™ is intended for business users and is not directed to children under 13. We do not knowingly collect personal information from
children.

International Users
If you access the Service from outside the United States, your information may be processed in the United States and other
jurisdictions where our providers operate.

Changes to This Policy
We may update this Privacy Policy from time to time. The “Last updated” date above indicates when it was last revised. Continued use
of the Service after changes become effective constitutes acceptance of the revised policy.

Contact
Inner Space Systems, Inc.
Email: support@getrestok.com
Address: PO Box 9070, Chattanooga, TN 37412
    `
  },
  {
    title: "Acceptable Use Policy",
    content: `
Restok™ Acceptable Use Policy

Last updated: 12/22/2025

Overview
This Acceptable Use Policy (“AUP”) describes prohibited conduct when using Restok™ . Violations may result in suspension or
termination.

Prohibited Activities
You may not:
• Use the Service for illegal activities
• Attempt unauthorized access to accounts, systems, or networks
• Reverse engineer, decompile, or attempt to extract source code except as allowed by law
• Interfere with the Service (e.g., denial-of-service, scraping beyond reasonable limits)
• Upload malware or harmful code
• Use the Service to transmit spam or unsolicited messages
• Misrepresent your identity or affiliation

Data & Privacy Restrictions
You may not input or store:
• Protected Health Information (PHI) or patient-identifiable information
• Social Security numbers, payment card numbers, or other sensitive regulated identifiers
• Any data you do not have the right to process

Security
You must maintain reasonable security for your account and credentials. Notify us promptly of suspected compromise.

Enforcement
We may investigate violations and take action including removal of content, rate limiting, suspension, termination, and reporting to law
enforcement when appropriate.
    `
  },
  {
    title: "Selling Policy",
    content: `
Restok™ Selling Policy

Last updated: 12/17/2025

Overview
This Selling Policy explains how subscriptions to Restok™ are sold, billed, delivered, and supported. It is
intended for customers purchasing Restok™ subscriptions through Stripe or other authorized payment
methods.

Seller Information
Restok™ is a software product owned and operated by Inner Space Systems, Inc. (“ISSI,” “we,” “us,” or
“our”).
Website: getrestok.com
Support: support@getrestok.com
Business Address: PO Box 9070, Chattanooga, TN 37412

Product Description
Restok™ is a subscription software service that provides office inventory reminders, usage insights, and
reorder workflows. Restok™ does not sell or ship physical goods. Purchases of office supplies are made
directly with your chosen supplier(s).

Pricing & Plans
Subscription pricing and plan features are displayed at checkout and/or on our pricing page. We may offer
introductory pricing or promotions from time to time. Prices exclude applicable taxes unless explicitly stated.

Billing & Renewals
Subscriptions are billed in advance on a recurring basis (monthly or annually, depending on the plan you
choose). Your subscription will automatically renew unless you cancel before the renewal date.
Payment processing is handled by Stripe. Your card may be updated automatically by Stripe’s card network
updater where supported.

Delivery of Service
Access to Restok™ is delivered electronically through your account. After successful purchase, you will be
able to log in at: https://getrestok.com/login (or the current login URL).
You are responsible for maintaining access to the email address used for your account.

Trials & Promotional Periods
If a free trial or discounted period is offered, the duration and conversion terms will be shown at checkout or
in the plan description. Unless otherwise stated, you will be charged automatically when the trial ends.

Cancellations
You may cancel your subscription at any time through the customer portal or by contacting support.
Cancellation stops future renewals. Unless required by law, we do not provide refunds for partial billing
periods.
Customer portal: https://billing.stripe.com/p/login/7sY6oIggpf2EbHn3Sk9MY00

Refund Policy
Unless required by law, subscription fees are non-refundable once charged. If you believe you were charged
in error, contact support within 7 days of the charge and we will review your request.
We may provide refunds or credits at our discretion for extraordinary circumstances. Chargebacks & Payment Disputes
If you initiate a chargeback, we may suspend your access to the Service while we investigate. We
encourage you to contact support first to resolve billing issues quickly.

Taxes
Tax rules for software subscriptions vary by jurisdiction. Where required, we may collect and remit
applicable taxes. You are responsible for any taxes not collected by us that apply to your purchase.

Support & Response Times
We provide support via email at support@getrestok.com. Typical response times are 24-48 hours.
Support does not include supplier fulfillment, shipping, or returns for third-party purchases.

Policy Changes
We may update this Selling Policy from time to time. The “Last updated” date will reflect the latest changes.
    `
  },
  {
    title: "Refund and Cancellation Policy",
    content: `
Restok™ Refund & Cancellation Policy

Last updated: 12/22/2025

Overview
This Refund & Cancellation Policy applies to Restok™ subscriptions purchased from Inner
Space Systems, Inc. through Stripe or other authorized payment methods.

Cancellations
You may cancel your subscription at any time through the customer portal or by contacting
support@getrestok.com. Cancellation prevents future renewals. Access generally continues
until the end of the current paid billing period unless otherwise stated.

Refunds
Unless required by law, subscription fees are non-refundable once charged. We do not
provide prorated refunds for unused time in a billing period.
If you believe you were charged in error, contact support within 7 days of the charge. We
may issue a refund or credit at our discretion.

Exceptional Circumstances
We may consider refunds or credits in limited circumstances, such as:
• Duplicate charges
• Material service outage verified by us
• Other extraordinary cases, at our discretion

Chargebacks
If you file a chargeback, we may suspend access while we investigate. Please contact
support first to resolve issues quickly.

Changes to This Policy
We may update this policy from time to time. The “Last updated” date indicates the most
recent revision.
    `
  },
  {
    title: "Cookie Notice",
    content: `
Restok™  Cookie Notice

Last updated: 12/22/2025

Overview
This Cookie Notice explains how Restok™  uses cookies and similar technologies on getrestok.com and related web experiences.

What Are Cookies
Cookies are small text files stored on your device that help websites function and remember information.

How We Use Cookies
We may use cookies and similar technologies to:
• Keep you signed in
• Remember preferences
• Understand site performance and usage patterns
• Improve reliability and security

Analytics
We may use analytics providers to understand how visitors use our website. Where required by law, we will present consent options for analytics cookies.

Your Choices
You can control cookies through your browser settings. Disabling cookies may affect functionality.

Contact
Questions? Email support@getrestok.com.

    `
  }
];

// simple "is this line a heading?" detector
function isHeading(line: string) {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (trimmed.length > 80) return false;
  if (trimmed.startsWith("•")) return false;
  if (/^\d+\)/.test(trimmed)) return false;
  if (/[.!?]$/.test(trimmed)) return false;
  return true;
}

export default function TermsPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <main className="antialiased bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 min-h-screen flex flex-col">

      {/* HEADER (matches homepage style, with Terms link) */}
      <header className="border-b py-4 sticky top-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur z-50">
        <div className="mx-auto max-w-7xl px-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/logo.svg"
              alt="Restok logo"
              width={40}
              height={40}
              className="shrink-0"
            />
            <div>
              <div className="font-semibold text-slate-900 dark:text-white">
                Restok
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 -mt-1">
                Your office, always stocked.
              </div>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm">
            <Link href="/#features" className="hover:text-slate-900">Features</Link>
            <Link href="/#how" className="hover:text-slate-900">How it works</Link>
            <Link href="/#pricing" className="hover:text-slate-900">Pricing</Link>
            <Link href="/terms" className="hover:text-slate-900">Terms</Link>
            <Link href="/login" className="text-sky-600 font-medium">Log in</Link>
            <Link
              href="/signup"
              className="ml-2 inline-block bg-sky-600 text-white px-4 py-2 rounded-lg shadow"
            >
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      {/* CONTENT */}
      <div className="flex-1 w-full">
        <div className="max-w-3xl mx-auto px-6 py-10">
          <h1 className="text-3xl font-bold">Restok Terms &amp; Policies</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">
            Please review the policies below that govern your use of Restok.
          </p>

          <div className="mt-8 space-y-3">
            {sections.map((section, i) => (
  <motion.div
    key={i}
    className="border rounded-xl bg-white dark:bg-slate-800 dark:border-slate-700"
    initial={{ opacity: 0, y: 10 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-100px" }}
    transition={{ duration: 0.25 }}
  >
                <button
  onClick={() => setOpenIndex(openIndex === i ? null : i)}
  className="w-full flex justify-between items-center p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700 transition rounded-xl"
>
  <span className="font-semibold text-lg">{section.title}</span>

  <motion.span
    className="text-2xl leading-none"
    animate={{ rotate: openIndex === i ? 180 : 0 }}
    transition={{ duration: 0.25 }}
  >
    {openIndex === i ? "−" : "+"}
  </motion.span>
</button>

                <AnimatePresence>
  {openIndex === i && (
    <motion.div
      key="content"
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="overflow-hidden"
    >
      <div className="p-4 pt-0 text-slate-700 dark:text-slate-300 text-sm">
        {section.content
          .split("\n")
          .map((rawLine, idx) => {
            const line = rawLine.trim();
            if (!line) return null;
            const heading = isHeading(line);
            return (
              <motion.p
                key={idx}
                className={`mt-2 ${heading ? "font-semibold" : ""}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: idx * 0.002 }}
              >
                {line}
              </motion.p>
            );
          })}
      </div>
    </motion.div>
  )}
</AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* FOOTER (matches homepage, with Terms link) */}
      <footer className="border-t py-8 mt-4">
        <div className="mx-auto max-w-7xl px-6 grid md:grid-cols-3 gap-6 text-sm text-slate-600">
          <div>
            <div className="font-semibold">Restok</div>
            <div className="mt-2">
              Smart restock reminders for small businesses.
            </div>
          </div>
          <div>
            <div className="font-semibold">Product</div>
            <ul className="mt-2 space-y-2">
              <li><Link href="/#features">Features</Link></li>
              <li><Link href="/#pricing">Pricing</Link></li>
              <li><Link href="/terms">Terms</Link></li>
            </ul>
          </div>
          <div>
            <div className="font-semibold">Company</div>
            <ul className="mt-2 space-y-2">
              <li><Link href="/about">About</Link></li>
              <li><Link href="/contact-us">Contact Us</Link></li>
            </ul>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-6 mt-8 text-center text-xs text-slate-400">
          © 2026 <a href="https://www.issioffice.com">Inner Space Systems Inc.</a> — All rights reserved
        </div>
      </footer>
    </main>
  );
}
