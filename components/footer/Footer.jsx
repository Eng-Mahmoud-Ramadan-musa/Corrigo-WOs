"use client";

import { useEffect, useState } from "react";
import {
  IconBrandFacebook,
  IconBrandLinkedin,
  IconBrandTelegram,
  IconBrandWhatsapp,
  IconCopyright,
  IconArrowUp,
} from "@tabler/icons-react";

export default function Footer() {
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => setShowBackToTop(window.scrollY > 360);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="site-footer bg-gray-400!">
      <p className="footer-credit">
        <span>Copyright</span>
        <IconCopyright aria-hidden="true" />
        <strong className="text-red-500!">Mahmoud Ramadan</strong>
      </p>
      <nav className="footer-links" aria-label="Social links">
        <a
          className="footer-social-link"
          href="https://www.facebook.com/profile.php?id=100007283614477"
          aria-label="Facebook"
          title="Facebook"
          target="_blank"
          rel="noopener noreferrer"
        >
          <IconBrandFacebook aria-hidden="true" />
        </a>
        <a
          className="footer-social-link"
          href="https://wa.me/+201016625130"
          aria-label="WhatsApp"
          title="WhatsApp"
          target="_blank"
          rel="noopener noreferrer"
        >
          <IconBrandWhatsapp aria-hidden="true" />
        </a>
        <a
          className="footer-social-link"
          href="https://t.me/MahmoudRamadan11"
          aria-label="Telegram"
          title="Telegram"
          target="_blank"
          rel="noopener noreferrer"
        >
          <IconBrandTelegram aria-hidden="true" />
        </a>
        <a
          className="footer-social-link"
          href="https://www.linkedin.com/in/%D9%85%D8%AD%D9%85%D9%88%D8%AF-%D8%B1%D9%85%D8%B6%D8%A7%D9%86-177102312"
          aria-label="LinkedIn"
          title="LinkedIn"
          target="_blank"
          rel="noopener noreferrer"
        >
          <IconBrandLinkedin aria-hidden="true" />
        </a>
      </nav>
      <button
        type="button"
        className={`footer-top-link${showBackToTop ? " is-visible" : ""}`}
        aria-label="Back to top"
        title="Back to top"
        onClick={scrollToTop}
      >
        <IconArrowUp aria-hidden="true" />
        <span>Back to top</span>
      </button>
    </footer>
  );
}
