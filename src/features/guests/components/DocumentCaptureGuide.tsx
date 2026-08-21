import {
  AlertCircle,
  BookOpen,
  Check,
  CreditCard,
  RotateCcw,
  ScanLine,
  ShieldCheck,
} from "lucide-react"
import { useId } from "react"
import type { DocumentSide, DocumentType } from "./documentScannerTypes"

/**
 * The small subset of camera-quality data this presentational component needs.
 * `ImageQuality` from documentVision is structurally compatible with this
 * interface, while callers that do not use that pipeline can pass their own.
 */
export interface DocumentCaptureQuality {
  usable: boolean
  hint?: string
}

export interface DocumentCaptureGuideProps {
  /** Passport renders its data page; ID card renders a front/back sequence. */
  documentType: DocumentType
  /** `passport`, `front`, or `back` from the active scanner step. */
  side: DocumentSide
  /** Enables the deliberate scan/flip motion while a camera is live. */
  active?: boolean
  /** Optional live quality state shown below the guidance. */
  quality?: DocumentCaptureQuality | null
  /** Allows the scanner (or another consumer) to place the guide in its layout. */
  className?: string
}

const join = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ")

/**
 * A camera-side visual guide for passports and Uzbekistan-style identity cards.
 *
 * It contains no document data or image asset: the illustration deliberately
 * uses abstract marks so it remains safe to show while helping the user place
 * the physical document. The back state rotates the same card into its MRZ
 * side, making the two-photo sequence understandable before OCR starts.
 */
export function DocumentCaptureGuide({
  documentType,
  side,
  active = false,
  quality,
  className,
}: DocumentCaptureGuideProps) {
  const titleId = useId()
  const isIdCard = documentType === "ID_CARD"
  const isBack = isIdCard && side === "back"
  const isPassport = !isIdCard
  const title = isPassport
    ? "Passportning ma’lumotlar sahifasi"
    : isBack
      ? "2-qadam: ID kartaning orqa tomoni"
      : "1-qadam: ID kartaning old tomoni"
  const instruction = isPassport
    ? "Rasmli sahifani to‘liq ramkaga joylang. Pastdagi ikki MRZ qatori ko‘rinib tursin."
    : isBack
      ? "Kartani ag‘daring. QR va pastdagi uch MRZ qatori to‘liq, yaltirashsiz ko‘rinsin."
      : "Rasmli, yozuvli old tomonni ramkaga tekis joylang. Keyin orqa tomoni olinadi."
  const statusText = quality
    ? quality.usable
      ? "Kadr aniq — o‘qishga tayyor"
      : quality.hint || "Kadr yetarli aniq emas — kartani barqaror tuting"
    : "Kartani ramkaga joylashtiring"

  return (
    <section
      className={join(
        "document-capture-guide rounded-xl border border-primary/15 bg-primary/5 p-3 text-foreground",
        isPassport ? "document-capture-guide--passport" : "document-capture-guide--id",
        isBack && "document-capture-guide--back",
        className
      )}
      data-active={active ? "true" : "false"}
      aria-labelledby={titleId}
    >
      <style>{guideStyles}</style>

      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
          {isPassport ? <BookOpen size={17} aria-hidden="true" /> : <CreditCard size={17} aria-hidden="true" />}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
              {isPassport ? "1 / 1 sahifa" : isBack ? "2 / 2 tomon" : "1 / 2 tomon"}
            </p>
            {isIdCard && isBack && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary">
                <RotateCcw size={12} aria-hidden="true" /> Ag‘darildi
              </span>
            )}
          </div>
          <h3 id={titleId} className="mt-0.5 text-sm font-semibold leading-tight">
            {title}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{instruction}</p>
        </div>
      </div>

      <div className="document-capture-guide__stage mt-3" aria-hidden="true">
        <span className="document-capture-guide__corner document-capture-guide__corner--tl" />
        <span className="document-capture-guide__corner document-capture-guide__corner--tr" />
        <span className="document-capture-guide__corner document-capture-guide__corner--bl" />
        <span className="document-capture-guide__corner document-capture-guide__corner--br" />

        <div className="document-capture-guide__card-motion">
          <div className="document-capture-guide__card">
            <div className="document-capture-guide__face document-capture-guide__front">
              {isPassport ? <PassportDataPage /> : <IdentityCardFront />}
            </div>
            {isIdCard && (
              <div className="document-capture-guide__face document-capture-guide__back-face">
                <IdentityCardBack />
              </div>
            )}
          </div>
        </div>

        <span className="document-capture-guide__scan-beam" />
        <span className="document-capture-guide__scan-label">
          <ScanLine size={13} /> {isBack || isPassport ? "MRZ zonasi" : "Old tomon"}
        </span>
      </div>

      {isIdCard && (
        <ol className="mt-3 grid grid-cols-2 gap-2" aria-label="ID karta suratga olish qadamlari">
          <li
            className={join(
              "flex min-w-0 items-center gap-2 rounded-lg border px-2.5 py-2 text-xs transition-colors",
              !isBack ? "border-primary/30 bg-background text-foreground" : "border-border bg-background/55 text-muted-foreground"
            )}
            aria-current={!isBack ? "step" : undefined}
          >
            <span className={join("flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold", isBack ? "bg-emerald-500 text-white" : "bg-primary text-primary-foreground")}>
              {isBack ? <Check size={12} aria-hidden="true" /> : "1"}
            </span>
            <span className="truncate font-medium">Old tomoni</span>
          </li>
          <li
            className={join(
              "flex min-w-0 items-center gap-2 rounded-lg border px-2.5 py-2 text-xs transition-colors",
              isBack ? "border-primary/30 bg-background text-foreground" : "border-border bg-background/55 text-muted-foreground"
            )}
            aria-current={isBack ? "step" : undefined}
          >
            <span className={join("flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold", isBack ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
              2
            </span>
            <span className="truncate font-medium">Orqa MRZ tomoni</span>
          </li>
        </ol>
      )}

      <p
        className={join(
          "mt-3 flex items-start gap-2 rounded-lg px-2.5 py-2 text-xs leading-relaxed",
          quality?.usable ? "bg-emerald-50 text-emerald-800" : quality ? "bg-amber-50 text-amber-800" : "bg-background/70 text-muted-foreground"
        )}
        role="status"
      >
        {quality?.usable ? <ShieldCheck size={15} className="mt-0.5 shrink-0" aria-hidden="true" /> : <AlertCircle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />}
        <span>{statusText}</span>
      </p>

      <p className="sr-only" aria-live="polite">
        {title}. {instruction}. {statusText}
      </p>
    </section>
  )
}

function IdentityCardFront() {
  return (
    <>
      <div className="document-capture-guide__flag" />
      <div className="document-capture-guide__portrait" />
      <div className="document-capture-guide__front-copy">
        <span className="document-capture-guide__line document-capture-guide__line--wide" />
        <span className="document-capture-guide__line" />
        <span className="document-capture-guide__line document-capture-guide__line--short" />
        <span className="document-capture-guide__line document-capture-guide__line--wide" />
      </div>
      <span className="document-capture-guide__chip" />
      <span className="document-capture-guide__front-number">ID</span>
    </>
  )
}

function IdentityCardBack() {
  return (
    <>
      <div className="document-capture-guide__qr">
        <i />
        <i />
        <i />
        <i />
        <i />
      </div>
      <div className="document-capture-guide__back-copy">
        <span className="document-capture-guide__line document-capture-guide__line--wide" />
        <span className="document-capture-guide__line" />
        <span className="document-capture-guide__line document-capture-guide__line--short" />
      </div>
      <div className="document-capture-guide__mrz-lines">
        <span>‹‹‹‹‹‹‹‹‹‹‹‹‹‹‹‹‹</span>
        <span>UZB  123456789  123</span>
        <span>‹‹‹‹‹‹‹‹‹‹‹‹‹‹‹‹‹</span>
      </div>
    </>
  )
}

function PassportDataPage() {
  return (
    <>
      <div className="document-capture-guide__passport-top">
        <span />
        <span />
      </div>
      <div className="document-capture-guide__passport-portrait" />
      <div className="document-capture-guide__passport-copy">
        <span className="document-capture-guide__line document-capture-guide__line--wide" />
        <span className="document-capture-guide__line" />
        <span className="document-capture-guide__line document-capture-guide__line--short" />
        <span className="document-capture-guide__line document-capture-guide__line--wide" />
      </div>
      <div className="document-capture-guide__passport-mrz">
        <span>P&lt;UZB‹‹‹‹‹‹‹‹‹‹‹‹‹‹‹‹</span>
        <span>AA1234567UZB‹‹‹‹‹‹‹‹‹</span>
      </div>
    </>
  )
}

const guideStyles = `
  .document-capture-guide__stage {
    position: relative;
    display: grid;
    min-height: 132px;
    place-items: center;
    overflow: hidden;
    border: 1px dashed color-mix(in srgb, hsl(var(--primary)) 42%, transparent);
    border-radius: 0.75rem;
    background: hsl(var(--background) / 0.62);
    isolation: isolate;
  }
  .document-capture-guide__stage::before {
    position: absolute;
    inset: 16% 10%;
    z-index: -1;
    border-radius: 0.8rem;
    background: hsl(var(--primary) / 0.06);
    content: "";
  }
  .document-capture-guide__corner {
    position: absolute;
    width: 16px;
    height: 16px;
    border-color: hsl(var(--primary));
    pointer-events: none;
  }
  .document-capture-guide__corner--tl { top: 10px; left: 10px; border-top: 2px solid; border-left: 2px solid; border-radius: 4px 0 0; }
  .document-capture-guide__corner--tr { top: 10px; right: 10px; border-top: 2px solid; border-right: 2px solid; border-radius: 0 4px 0 0; }
  .document-capture-guide__corner--bl { bottom: 10px; left: 10px; border-bottom: 2px solid; border-left: 2px solid; border-radius: 0 0 0 4px; }
  .document-capture-guide__corner--br { right: 10px; bottom: 10px; border-right: 2px solid; border-bottom: 2px solid; border-radius: 0 0 4px; }
  .document-capture-guide__card-motion { width: 184px; height: 116px; perspective: 720px; }
  .document-capture-guide__card {
    position: relative;
    width: 100%;
    height: 100%;
    transform-style: preserve-3d;
    transition: transform 720ms cubic-bezier(.22, 1, .36, 1);
  }
  .document-capture-guide--back .document-capture-guide__card { transform: rotateY(180deg); }
  .document-capture-guide__face {
    position: absolute;
    inset: 0;
    overflow: hidden;
    box-sizing: border-box;
    border: 1px solid rgb(255 255 255 / 0.7);
    border-radius: 8px;
    backface-visibility: hidden;
    box-shadow: 0 12px 24px rgb(15 23 42 / 0.16);
    background: #e6f5ee;
  }
  .document-capture-guide__front {
    background:
      linear-gradient(120deg, rgb(255 255 255 / 0.72), transparent 46%),
      repeating-linear-gradient(135deg, rgb(16 185 129 / 0.06) 0 2px, transparent 2px 9px),
      #e6f5ee;
  }
  .document-capture-guide__back-face {
    transform: rotateY(180deg);
    background:
      linear-gradient(120deg, rgb(255 255 255 / 0.75), transparent 42%),
      repeating-linear-gradient(45deg, rgb(14 165 233 / 0.055) 0 2px, transparent 2px 9px),
      #eaf4f8;
  }
  .document-capture-guide__flag { position: absolute; top: 11px; left: 12px; width: 28px; height: 16px; border-radius: 2px; background: linear-gradient(#1d8bcd 0 30%, #fff 30% 41%, #2c9c57 41% 100%); }
  .document-capture-guide__portrait,
  .document-capture-guide__passport-portrait { position: absolute; overflow: hidden; border: 1px solid rgb(15 23 42 / 0.12); background: #c5d4cf; }
  .document-capture-guide__portrait { top: 37px; left: 12px; width: 42px; height: 57px; border-radius: 3px; }
  .document-capture-guide__portrait::before,
  .document-capture-guide__passport-portrait::before { position: absolute; top: 10%; left: 31%; width: 38%; height: 34%; border-radius: 999px; background: #547367; content: ""; }
  .document-capture-guide__portrait::after,
  .document-capture-guide__passport-portrait::after { position: absolute; bottom: -10%; left: 14%; width: 72%; height: 50%; border-radius: 50% 50% 0 0; background: #547367; content: ""; }
  .document-capture-guide__front-copy { position: absolute; top: 34px; left: 64px; display: grid; gap: 7px; width: 78px; }
  .document-capture-guide__line { display: block; width: 60%; height: 4px; border-radius: 99px; background: rgb(15 23 42 / 0.38); }
  .document-capture-guide__line--wide { width: 100%; }
  .document-capture-guide__line--short { width: 42%; }
  .document-capture-guide__chip { position: absolute; top: 14px; right: 13px; width: 18px; height: 14px; border: 1px solid #b68b37; border-radius: 3px; background: repeating-linear-gradient(90deg, transparent 0 4px, #b68b37 4px 5px); }
  .document-capture-guide__front-number { position: absolute; right: 13px; bottom: 14px; color: rgb(15 23 42 / 0.6); font: 700 9px/1 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .08em; }
  .document-capture-guide__qr { position: absolute; top: 16px; left: 14px; display: grid; grid-template-columns: repeat(5, 6px); gap: 2px; width: 38px; height: 38px; padding: 3px; background: #fff; }
  .document-capture-guide__qr i { display: block; background: #14283b; }
  .document-capture-guide__qr i:nth-child(2n) { background: transparent; }
  .document-capture-guide__qr i:nth-child(3n) { box-shadow: 8px 0 #14283b, 0 8px #14283b; }
  .document-capture-guide__back-copy { position: absolute; top: 18px; right: 14px; display: grid; gap: 7px; width: 102px; }
  .document-capture-guide__mrz-lines,
  .document-capture-guide__passport-mrz { position: absolute; right: 8px; bottom: 7px; left: 8px; display: grid; gap: 2px; padding: 4px 5px; border: 1px dashed rgb(245 158 11 / 0.9); border-radius: 3px; background: rgb(255 250 235 / 0.78); color: #7c4a03; font: 700 6px/1 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .04em; }
  .document-capture-guide__passport-top { position: absolute; top: 10px; right: 10px; left: 10px; display: flex; justify-content: space-between; }
  .document-capture-guide__passport-top span { width: 38%; height: 5px; border-radius: 99px; background: rgb(15 23 42 / 0.42); }
  .document-capture-guide__passport-portrait { top: 26px; left: 12px; width: 40px; height: 57px; border-radius: 2px; }
  .document-capture-guide__passport-copy { position: absolute; top: 30px; left: 61px; display: grid; gap: 7px; width: 92px; }
  .document-capture-guide__passport-mrz { bottom: 7px; }
  .document-capture-guide__scan-beam { position: absolute; right: calc(50% - 92px); bottom: 14px; left: calc(50% - 92px); height: 2px; border-radius: 999px; opacity: 0; box-shadow: 0 0 0 1px rgb(251 191 36 / 0.42), 0 0 15px rgb(251 191 36 / 0.88); background: #fbbf24; }
  .document-capture-guide[data-active="true"] .document-capture-guide__scan-beam { opacity: 1; animation: document-capture-guide-scan 2.2s ease-in-out infinite; }
  .document-capture-guide[data-active="true"] .document-capture-guide__card-motion { animation: document-capture-guide-float 2.6s ease-in-out infinite; }
  .document-capture-guide__scan-label { position: absolute; right: 12px; bottom: 10px; display: inline-flex; align-items: center; gap: 4px; border: 1px solid rgb(251 191 36 / 0.6); border-radius: 999px; background: rgb(15 23 42 / 0.78); padding: 3px 6px; color: #fef3c7; font-size: 10px; font-weight: 700; }
  @keyframes document-capture-guide-scan { 0%, 100% { transform: translateY(-70px); } 50% { transform: translateY(0); } }
  @keyframes document-capture-guide-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
  @media (max-width: 380px) { .document-capture-guide__card-motion { transform: scale(.86); } }
  @media (prefers-reduced-motion: reduce) {
    .document-capture-guide *, .document-capture-guide *::before, .document-capture-guide *::after { animation: none !important; transition: none !important; }
    .document-capture-guide__scan-beam { display: none; }
  }
`
