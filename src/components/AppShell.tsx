import { useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router";
import { useWhatsNew } from "@/features/release/use-whats-new";
import { APP_VERSION } from "@/features/release/version";
import { DESKTOP_QUERY, useMediaQuery } from "@/lib/use-media-query";
import { BackIcon, CloseIcon, MenuIcon } from "./icons";
import { subPageForPath, titleForPath } from "./nav-items";
import { SideMenu } from "./SideMenu";
import { StatusCard } from "./status/StatusCard";
import {
  STATUS_PRIORITY,
  statusActionClass,
  useClaimSidePlacement,
  useCurrentStatus,
  useStatusCard,
} from "./status/status-context";

const WHATS_NEW_PATH = "/settings/whats-new";

/**
 * Desktop: the permanent side menu, with the current status card at its bottom (P31). Kept apart from
 * AppShell so a changing card re-renders only this part.
 */
function DesktopSideMenu() {
  const status = useCurrentStatus();
  return <SideMenu status={status ? <StatusCard spec={status} placement="side" /> : null} />;
}

/** Location state used to show a one-off confirmation (e.g. "Password changed") at the bottom of the page (P12). */
export interface FlashState {
  flash?: string;
}

export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const title = titleForPath(location.pathname);
  const subPage = subPageForPath(location.pathname);
  const flash = (location.state as FlashState | null)?.flash;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    document.title = `${title} · Cycling Hub`;
  }, [title]);

  const openMenu = () => {
    // A modal <dialog> traps focus, makes the page behind it inert and closes on Esc.
    dialogRef.current?.showModal();
    setMenuOpen(true);
  };
  const closeMenu = () => dialogRef.current?.close();

  // The drawer is phone-only; close it when the window grows into the desktop layout.
  useEffect(() => {
    // jsdom (tests) has no matchMedia, even though the DOM types say it always exists.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!window.matchMedia) return;
    const mql = window.matchMedia(DESKTOP_QUERY);
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) dialogRef.current?.close();
    };
    mql.addEventListener("change", onChange);
    return () => {
      mql.removeEventListener("change", onChange);
    };
  }, []);

  const dismissFlash = () => {
    void navigate(location.pathname, { replace: true, state: null });
  };

  // P31: on desktop the status card moves from the bottom of the page into the side menu.
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  useClaimSidePlacement(isDesktop);

  useStatusCard(
    "flash",
    STATUS_PRIORITY.flash,
    flash ? { tone: "success", message: flash, onDismiss: dismissFlash } : null,
  );

  // B1d: once after an update; not on What's new itself, which marks the version as seen.
  const whatsNew = useWhatsNew();
  useStatusCard(
    "whats-new",
    STATUS_PRIORITY.whatsNew,
    whatsNew.state === "updated" && location.pathname !== WHATS_NEW_PATH
      ? {
          tone: "info",
          message: `Updated to v${APP_VERSION}`,
          action: (
            <Link to={WHATS_NEW_PATH} className={statusActionClass}>
              What&apos;s new
            </Link>
          ),
          onDismiss: whatsNew.markSeen,
        }
      : null,
  );

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-xl focus:bg-surface focus:px-4 focus:py-3"
      >
        Skip to content
      </a>

      {/* Desktop: permanent side menu on the page background (DESIGN.md) */}
      <aside className="fixed inset-y-0 left-0 hidden w-56 px-3 py-6 lg:block">
        {isDesktop ? <DesktopSideMenu /> : <SideMenu />}
      </aside>

      {/* Phone: drawer */}
      {/* Native modal dialog: Esc closes it via the keyboard; the click handler only adds "tap the
          backdrop to close", which has no keyboard equivalent to provide. */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
      <dialog
        ref={dialogRef}
        id="side-menu"
        aria-label="Menu"
        onClose={() => {
          setMenuOpen(false);
          menuButtonRef.current?.focus();
        }}
        onClick={(e) => {
          // A click on the backdrop lands on the <dialog> element itself.
          if (e.target === e.currentTarget) closeMenu();
        }}
        className="drawer m-0 h-dvh max-h-none w-[min(18rem,85vw)] max-w-none bg-surface p-0 text-text lg:hidden"
      >
        <div className="flex h-full flex-col px-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={closeMenu}
              aria-label="Close menu"
              className="flex size-11 items-center justify-center rounded-xl text-text hover:bg-subtle"
            >
              <CloseIcon />
            </button>
          </div>
          <div className="min-h-0 flex-1">
            <SideMenu onNavigate={closeMenu} />
          </div>
        </div>
      </dialog>

      <div className="lg:pl-56">
        {/* Phone: top bar */}
        <header className="sticky top-0 z-10 bg-bg pt-[env(safe-area-inset-top)] lg:hidden">
          <div className="flex h-14 items-center gap-1.5 px-2">
            {subPage ? (
              <Link
                to={subPage.parent}
                aria-label="Back"
                className="flex size-11 items-center justify-center rounded-xl text-text hover:bg-subtle"
              >
                <BackIcon />
              </Link>
            ) : (
              <button
                ref={menuButtonRef}
                type="button"
                onClick={openMenu}
                aria-label="Open menu"
                aria-haspopup="dialog"
                aria-expanded={menuOpen}
                aria-controls="side-menu"
                className="flex size-11 items-center justify-center rounded-xl text-text hover:bg-subtle"
              >
                <MenuIcon />
              </button>
            )}
            <h1 className="min-w-0 flex-1 truncate text-xl font-semibold tracking-tight">
              {title}
            </h1>
            <span className="pr-2 text-[13px] font-semibold tracking-tight text-muted">
              Cycling Hub
            </span>
          </div>
        </header>

        <main
          id="main"
          tabIndex={-1}
          className="mx-auto w-full max-w-5xl px-4 pb-28 pt-2 outline-none lg:px-8 lg:pt-8"
        >
          <h1 className="mb-6 hidden text-2xl font-semibold tracking-tight lg:block">{title}</h1>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
