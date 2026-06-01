"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/session";
import { isTourSeen, markTourSeen } from "@/lib/onboarding";

type Step = {
  selector: string;
  title: string;
  body: string;
  placement: "right" | "bottom";
};

const STEPS: Step[] = [
  {
    selector: '[data-tour="nav-/board"]',
    title: "The Board",
    body: "Every story lives here as a card and moves across columns as it progresses — from draft to published.",
    placement: "right",
  },
  {
    selector: '[data-tour="nav-/pitches"]',
    title: "Pitches",
    body: "Got a story idea? Pitch it here and an editor will pick it up or send feedback.",
    placement: "right",
  },
  {
    selector: '[data-tour="nav-/calendar"]',
    title: "Calendar",
    body: "See every deadline at a glance so nothing slips through the cracks.",
    placement: "right",
  },
  {
    selector: '[data-tour="nav-/messages"]',
    title: "Messages",
    body: "Chat with editors and the rest of the newsroom without leaving the portal.",
    placement: "right",
  },
  {
    selector: '[data-tour="topbar"]',
    title: "Notifications & account",
    body: "New assignments and feedback show up here. Open the avatar menu any time to sign out.",
    placement: "bottom",
  },
];

const TIP_W = 320;

type Rect = { top: number; left: number; width: number; height: number };

export function DashboardTour() {
  const router = useRouter();
  const { currentUser } = useSession();

  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  // Activate only when arriving from onboarding (?tour=1) and not seen before.
  useEffect(() => {
    if (!currentUser) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("tour") !== "1") return;
    if (isTourSeen(currentUser.id)) return;
    window.scrollTo({ top: 0 });
    setActive(true);
  }, [currentUser]);

  const measure = useCallback(() => {
    const step = STEPS[index];
    if (!step) return;
    const el = document.querySelector(step.selector);
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) {
      setRect(null);
      return;
    }
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [index]);

  useEffect(() => {
    if (!active) return;
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [active, measure]);

  const close = useCallback(() => {
    if (currentUser) markTourSeen(currentUser.id);
    setActive(false);
    router.replace("/dashboard");
  }, [currentUser, router]);

  if (!active) return null;
  const step = STEPS[index];
  if (!step) return null;

  const isLast = index === STEPS.length - 1;

  let tipTop: number;
  let tipLeft: number;
  if (rect) {
    if (step.placement === "bottom") {
      tipTop = rect.top + rect.height + 12;
      tipLeft = rect.left;
    } else {
      tipTop = rect.top;
      tipLeft = rect.left + rect.width + 12;
    }
  } else {
    tipTop = window.innerHeight / 2 - 120;
    tipLeft = window.innerWidth / 2 - TIP_W / 2;
  }
  tipLeft = Math.min(Math.max(16, tipLeft), window.innerWidth - TIP_W - 16);
  tipTop = Math.min(Math.max(16, tipTop), window.innerHeight - 220);

  return (
    <div className="fixed inset-0 z-[100]">
      {rect ? (
        <div
          className="absolute rounded-lg transition-all duration-200"
          style={{
            top: rect.top - 4,
            left: rect.left - 4,
            width: rect.width + 8,
            height: rect.height + 8,
            boxShadow: "0 0 0 9999px rgba(15,15,20,0.55)",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-foreground/55" />
      )}

      <div
        className="absolute rounded-xl border border-border bg-popover p-4 shadow-elevated"
        style={{ top: tipTop, left: tipLeft, width: TIP_W }}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-semibold">{step.title}</p>
          <button
            type="button"
            onClick={close}
            className="text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Close tour"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-xs leading-snug text-muted-foreground">
          {step.body}
        </p>
        <div className="mt-4 flex items-center justify-between">
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {index + 1} / {STEPS.length}
          </span>
          <div className="flex gap-2">
            {index > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIndex((i) => i - 1)}
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              onClick={() => (isLast ? close() : setIndex((i) => i + 1))}
            >
              {isLast ? "Done" : "Next"}
              {!isLast && <ArrowRight className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
