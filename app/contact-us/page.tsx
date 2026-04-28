"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

export default function ContactPage() {
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState("");
  const [err, setErr] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [business, setBusiness] = useState("");
  const [topic, setTopic] = useState("");
  const [message, setMessage] = useState("");
  const [company, setCompany] = useState(""); // honeypot

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setOk("");
    setErr("");

    if (company.trim() !== "") {
      setOk("Thanks! Your message has been sent.");
      return;
    }

    if (!name) return setErr("Please enter your name.");
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return setErr("Please enter a valid email.");
    if (!topic) return setErr("Please select a topic.");
    if (!message) return setErr("Please enter a message.");

    setLoading(true);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        body: JSON.stringify({ name, email, business, topic, message }),
      });

      if (!res.ok) throw new Error();

      setOk("Thanks! Your message has been sent.");
      setName("");
      setEmail("");
      setMessage("");
      setBusiness("");
      setTopic("");
    } catch {
      setErr("Failed to send message. Please try again.");
    }

    setLoading(false);
  }

  return (
    <main className="antialiased bg-white text-slate-800">

      {/* ---------- HEADER (same as landing) ---------- */}
      <header className="border-b py-4 sticky top-0 bg-white/90 z-50 dark:bg-slate-900/90 backdrop-blur">
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

      {/* ---------- CONTACT CONTENT ---------- */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div>
          <p className="text-slate-500">Restok Support</p>
          <h1 className="text-4xl font-bold mt-1">Contact Us</h1>
          <p className="text-slate-600 max-w-2xl mt-2">
            Have a question, feedback, or need help? Send us a message and we’ll get back to you.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mt-10">

          {/* FORM */}
          <div className="bg-white dark:bg-slate-800 border rounded-2xl p-6 shadow">
            <form onSubmit={submit}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-medium text-sm">Your name</label>
                  <input
                    className="input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="font-medium text-sm">Email</label>
                  <input
                    className="input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="font-medium text-sm">
                    Business (optional)
                  </label>
                  <input
                    className="input"
                    value={business}
                    onChange={(e) => setBusiness(e.target.value)}
                  />
                </div>

                <div>
                  <label className="font-medium text-sm">Topic</label>
                  <select
                    className="input"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                  >
                    <option value="">Select one…</option>
                    <option>General question</option>
                    <option>Billing / subscription</option>
                    <option>Technical issue</option>
                    <option>Feedback / feature request</option>
                    <option>Partnership / vendor</option>
                  </select>
                </div>
              </div>

              <label className="font-medium text-sm block mt-4">
                Message
              </label>
              <textarea
                className="input min-h-[140px]"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />

              {/* Honeypot */}
              <input
                className="hidden"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />

              <p className="text-xs text-slate-500 mt-2">
                Please don’t include sensitive information.
              </p>

              <div className="flex gap-3 mt-4">
                <button
                  disabled={loading}
                  className="bg-sky-600 text-white px-5 py-2 rounded-lg"
                >
                  {loading ? "Sending…" : "Send message"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setName("");
                    setEmail("");
                    setMessage("");
                    setBusiness("");
                    setTopic("");
                    setErr("");
                    setOk("");
                  }}
                  className="border px-5 py-2 rounded-lg"
                >
                  Clear
                </button>
              </div>

              {ok && (
                <div className="mt-3 text-green-600 text-sm bg-green-50 border border-green-300 p-3 rounded">
                  {ok}
                </div>
              )}

              {err && (
                <div className="mt-3 text-red-600 text-sm bg-red-50 border border-red-300 p-3 rounded">
                  {err}
                </div>
              )}
            </form>
          </div>

          {/* SIDEBAR */}
          <aside className="bg-white dark:bg-slate-800 border rounded-2xl p-6 shadow">
            <h2 className="font-semibold text-lg">Other ways to reach us</h2>

            <p className="mt-2 text-slate-600 dark:text-slate-300">
              Email:{" "}
              <a
                className="text-sky-600"
                href="mailto:support@getrestok.com"
              >
                support@getrestok.com
              </a>
            </p>

            <ul className="mt-4 space-y-4 text-sm">
              <li>
                <strong>Billing</strong>
                <p className="text-slate-500">
                  Include the email used at checkout.
                </p>
              </li>

              <li>
                <strong>Bug reports</strong>
                <p className="text-slate-500">
                  Tell us what you clicked & what happened.
                </p>
              </li>

              <li>
                <strong>Feature Requests</strong>
                <p className="text-slate-500">
                  Tell us the problem you want solved.
                </p>
              </li>
            </ul>
          </aside>
        </div>
      </section>

      {/* ---------- FOOTER (same as landing) ---------- */}
      <footer className="border-t py-8 mt-16">
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
              <li><Link href="/terms">Terms and Policies</Link></li>
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
