"use client";

import { useEffect } from "react";
import { toggleSidebar } from "@/components/sidebar-toggle";

export const MOBILE_MENU_EVENT = "mulk-mobile-menu";
const SEARCH = 'input[aria-label="Menüde ara"]';
let returnTo: HTMLElement | null = null;

export function takeReturnFocus() {
  const target = returnTo;
  returnTo = null;
  return target;
}

const isDesktop = () => window.matchMedia("(min-width: 1024px)").matches;
const visibleSearch = () => Array.from(document.querySelectorAll<HTMLInputElement>(SEARCH)).find((el) => el.getClientRects().length > 0) ?? null;
const inTextField = (el: Element | null) => !!el && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement || (el as HTMLElement).isContentEditable);
const setMobileMenu = (detail: boolean | "toggle") => document.dispatchEvent(new CustomEvent(MOBILE_MENU_EVENT, { detail }));

function whenSearchReady(callback: (input: HTMLInputElement) => void, tries = 30) {
  const input = visibleSearch();
  if (input) callback(input);
  else if (tries > 0) requestAnimationFrame(() => whenSearchReady(callback, tries - 1));
}

// Kabuk için tek klavye kısayolu dinleyicisi; yalnızca kimliği doğrulanmış sayfalarda bağlanır.
export function ShellShortcuts() {
  useEffect(() => {
    function leaveSearch() {
      if (isDesktop()) takeReturnFocus()?.focus();
      else setMobileMenu(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.isComposing || event.defaultPrevented) return;
      const active = document.activeElement;
      const inSearch = active instanceof HTMLInputElement && active.matches(SEARCH);
      if (event.key === "Escape" && inSearch && returnTo) {
        event.preventDefault();
        leaveSearch();
        return;
      }
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
      const key = event.key.toLowerCase();
      if (key === "b") {
        if (inTextField(active)) return;
        event.preventDefault();
        if (isDesktop()) toggleSidebar();
        else setMobileMenu("toggle");
      } else if (key === "k") {
        event.preventDefault();
        if (inSearch) {
          leaveSearch();
          return;
        }
        returnTo = active instanceof HTMLElement ? active : null;
        if (isDesktop()) {
          if (document.documentElement.dataset.sidebar === "collapsed") toggleSidebar();
        } else setMobileMenu(true);
        whenSearchReady((input) => input.focus());
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
  return null;
}
