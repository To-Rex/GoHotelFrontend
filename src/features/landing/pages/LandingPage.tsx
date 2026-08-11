import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import {
  Building2,
  CalendarDays,
  Wallet,
  ScanLine,
  ScanFace,
  Package,
  BarChart3,
  Store,
  Smartphone,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Moon,
  BedDouble,
  Users,
  ClipboardList,
  ShieldCheck,
  History,
  TrendingUp,
} from "lucide-react"

/**
 * GoHotel landing (marketing) sahifasi — /landing va /leanding.
 *
 * To'liq mustaqil: ilova mavzusiga bog'lanmagan doimiy qora (zinc) palitra,
 * yashil aksent, GRADIENTSIZ. Scroll'da asta paydo bo'ladigan bo'limlar,
 * suzuvchi mockup, sanovchi raqamlar va cheksiz modul lentasi. Har qanday
 * display o'lchamiga moslashadi. Boshqa sahifalarga ta'sir qilmaydi.
 */

// Scroll'da ko'ringan elementlarga .landing-visible qo'shadi (bir marta)
function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll(".landing-reveal")
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("landing-visible")
            io.unobserve(e.target)
          }
        }
      },
      { threshold: 0.15 }
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])
}

// Ko'ringanda 0 dan sanab chiqadigan raqam
function CountUp({ to, suffix = "" }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement | null>(null)
  const [val, setVal] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let raf = 0
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return
        io.disconnect()
        const start = performance.now()
        const dur = 1200
        const step = (t: number) => {
          const p = Math.min(1, (t - start) / dur)
          setVal(Math.round(to * (1 - Math.pow(1 - p, 3))))
          if (p < 1) raf = requestAnimationFrame(step)
        }
        raf = requestAnimationFrame(step)
      },
      { threshold: 0.5 }
    )
    io.observe(el)
    return () => {
      io.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [to])
  return (
    <span ref={ref} className="tabular-nums">
      {val}
      {suffix}
    </span>
  )
}

// Har karta o'z aksent rangida (ko'k ishlatilmaydi)
const FEATURES = [
  {
    icon: CalendarDays,
    title: "Bron va band qilish",
    text: "Soatlik va kunlik bronlar, jonli bandlov doskasi, surib ko'chirish va xona almashtirish — hammasi bir ekranda.",
    color: "text-emerald-400",
    glow: "bg-emerald-500/15",
  },
  {
    icon: Wallet,
    title: "Kassa va smenalar",
    text: "Smena topshirish parol tasdig'i bilan, \"ko'r sanash\" kassasi, kamomad nazorati va kunlik avtomatik kesim.",
    color: "text-amber-400",
    glow: "bg-amber-500/15",
  },
  {
    icon: ScanLine,
    title: "Hujjat skaneri",
    text: "Passport va ID kartani kamera orqali soniyalarda o'qiydi — mehmon ma'lumotlari formaga o'zi tushadi.",
    color: "text-violet-400",
    glow: "bg-violet-500/15",
  },
  {
    icon: ScanFace,
    title: "Yuz bilan kirish",
    text: "Xodimlar parol termasdan, kameraga qarashning o'zida tizimga kiradi — tez va xavfsiz.",
    color: "text-rose-400",
    glow: "bg-rose-500/15",
  },
  {
    icon: Package,
    title: "Ombor nazorati",
    text: "FIFO partiyalar, kirim-chiqim, spisaniye va inventarizatsiya — har bir mahsulot tannarxigacha hisobda.",
    color: "text-orange-400",
    glow: "bg-orange-500/15",
  },
  {
    icon: BarChart3,
    title: "Jonli statistika",
    text: "Tushum, bandlik, smenalar va xodimlar samaradorligi — boshqaruv paneli har daqiqada yangilanadi.",
    color: "text-teal-400",
    glow: "bg-teal-500/15",
  },
  {
    icon: Store,
    title: "Mini-do'kon",
    text: "Mehmonlarga savdo — bron hisobiga yoki naqd. Har sotuv moliya hisobotiga o'z-o'zidan tushadi.",
    color: "text-lime-400",
    glow: "bg-lime-500/15",
  },
  {
    icon: Smartphone,
    title: "Har qanday qurilmada",
    text: "O'rnatiladigan ilova (PWA), telefon-planshet-kompyuterga to'liq moslashgan, tun mavzusi bilan.",
    color: "text-fuchsia-400",
    glow: "bg-fuchsia-500/15",
  },
]

const MARQUEE = [
  { icon: BedDouble, label: "Xonalar" },
  { icon: CalendarDays, label: "Bandlov doskasi" },
  { icon: Users, label: "Mehmonlar" },
  { icon: Wallet, label: "Moliya" },
  { icon: History, label: "Smenalar" },
  { icon: Package, label: "Ombor" },
  { icon: Store, label: "Do'kon" },
  { icon: ClipboardList, label: "Xo'jalik ishlari" },
  { icon: ScanLine, label: "Hujjat skaneri" },
  { icon: ScanFace, label: "Yuz bilan kirish" },
  { icon: ShieldCheck, label: "Ruxsatnomalar" },
  { icon: BarChart3, label: "Hisobotlar" },
  { icon: Moon, label: "Tun mavzusi" },
  { icon: Smartphone, label: "PWA ilova" },
]

const STEPS = [
  {
    n: "01",
    title: "Kirasiz",
    text: "Login yoki yuz bilan — tizim brauzerda ochiladi, hech narsa o'rnatish shart emas.",
  },
  {
    n: "02",
    title: "Sozlaysiz",
    text: "Xonalar, narxlar, xodimlar va rollar bir necha daqiqada tayyor bo'ladi.",
  },
  {
    n: "03",
    title: "Boshqarasiz",
    text: "Bron, kassa, ombor va hisobotlar — butun mehmonxona bitta ekranda.",
  },
]

export const LandingPage = () => {
  useReveal()

  useEffect(() => {
    document.title = "GoHotel — Mehmonxona boshqaruv tizimi"
    return () => {
      document.title = "GoHotel"
    }
  }, [])

  return (
    <div className="min-h-screen overflow-x-hidden bg-zinc-950 text-zinc-100 antialiased">
      {/* ORQA FON: suzuvchi yorug' dog'lar (yashil/sariq/binafsha) + nuqtali to'r */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-40 -left-40 h-[26rem] w-[26rem] rounded-full bg-emerald-500/12 blur-3xl animate-login-blob sm:h-[30rem] sm:w-[30rem]" />
        <div
          className="absolute top-1/3 -right-48 h-[22rem] w-[22rem] rounded-full bg-amber-500/8 blur-3xl animate-login-blob sm:h-[26rem] sm:w-[26rem]"
          style={{ animationDelay: "-7s" }}
        />
        <div
          className="absolute -bottom-48 left-1/4 h-[20rem] w-[20rem] rounded-full bg-violet-500/8 blur-3xl animate-login-blob sm:h-[24rem] sm:w-[24rem]"
          style={{ animationDelay: "-12s" }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.05)_1px,transparent_0)] bg-[size:30px_30px]" />
      </div>

      {/* NAVBAR */}
      <header className="relative z-20 mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 shadow-lg shadow-emerald-600/30 sm:h-10 sm:w-10">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight">GoHotel</span>
        </div>
        <nav className="hidden items-center gap-7 text-sm font-medium text-zinc-400 md:flex">
          <a href="#features" className="transition-colors hover:text-white">
            Imkoniyatlar
          </a>
          <a href="#how" className="transition-colors hover:text-white">
            Qanday ishlaydi
          </a>
          <a href="#stats" className="transition-colors hover:text-white">
            Raqamlar
          </a>
        </nav>
        <Link
          to="/login"
          className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-zinc-900 shadow-lg shadow-white/10 transition-all hover:scale-105 hover:shadow-white/20 active:scale-95 sm:px-5"
        >
          Kirish
        </Link>
      </header>

      {/* HERO */}
      <section className="relative z-10 mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-8 sm:px-5 sm:pb-20 lg:grid-cols-2 lg:gap-12 lg:pt-16">
        <div>
          <p className="landing-reveal inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-zinc-300 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            Zamonaviy mehmonxonalar uchun yagona tizim
          </p>
          <h1
            className="landing-reveal mt-5 text-3xl font-extrabold leading-[1.12] tracking-tight sm:text-5xl lg:text-6xl"
            style={{ transitionDelay: "80ms" }}
          >
            Mehmonxonangizni{" "}
            <span className="relative whitespace-nowrap">
              <span className="relative z-10 text-emerald-400">bitta tizimda</span>
              <span className="absolute inset-x-0 bottom-1 -z-0 h-3 rounded-full bg-emerald-500/20" />
            </span>{" "}
            boshqaring
          </h1>
          <p
            className="landing-reveal mt-5 max-w-lg text-base leading-relaxed text-zinc-400 sm:text-lg"
            style={{ transitionDelay: "160ms" }}
          >
            Bron, kassa-smena, ombor, do'kon va jonli hisobotlar — resepsiyadan
            direktorgacha butun jamoa bitta oynada ishlaydi. Telefonda ham,
            kompyuterda ham.
          </p>
          <div
            className="landing-reveal mt-8 flex flex-wrap items-center gap-3"
            style={{ transitionDelay: "240ms" }}
          >
            <Link
              to="/login"
              className="group flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-3.5 text-sm font-bold text-white shadow-xl shadow-emerald-600/25 transition-all hover:scale-[1.03] hover:bg-emerald-500 active:scale-95 sm:px-7"
            >
              Tizimga kirish
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href="#features"
              className="rounded-full border border-white/15 bg-white/5 px-6 py-3.5 text-sm font-semibold text-zinc-200 backdrop-blur transition-all hover:border-white/30 hover:bg-white/10 active:scale-95 sm:px-7"
            >
              Imkoniyatlarni ko'rish
            </a>
          </div>
          <div
            className="landing-reveal mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs text-zinc-400"
            style={{ transitionDelay: "320ms" }}
          >
            {["O'rnatiladigan PWA ilova", "Yuz bilan kirish", "Hujjat skaneri"].map(
              (t) => (
                <span key={t} className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  {t}
                </span>
              )
            )}
          </div>
        </div>

        {/* HERO MOCKUP — suzuvchi mini boshqaruv paneli */}
        <div className="landing-reveal relative" style={{ transitionDelay: "200ms" }}>
          <div className="animate-landing-float relative mx-auto w-full max-w-md">
            {/* Asosiy oyna */}
            <div className="rounded-2xl border border-white/10 bg-zinc-900/90 p-4 shadow-2xl shadow-black/50 backdrop-blur sm:p-5">
              <div className="mb-4 flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
                <span className="ml-3 truncate text-[11px] text-zinc-500">
                  GoHotel · Boshqaruv paneli
                </span>
              </div>
              {/* KPI chiplar */}
              <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                {[
                  { label: "Tushum", value: "12.4M", color: "text-emerald-400" },
                  { label: "Bandlik", value: "86%", color: "text-amber-400" },
                  { label: "Bronlar", value: "34", color: "text-violet-400" },
                ].map((k) => (
                  <div
                    key={k.label}
                    className="rounded-xl border border-white/5 bg-white/5 p-2.5 sm:p-3"
                  >
                    <p className="text-[10px] text-zinc-500">{k.label}</p>
                    <p
                      className={`text-base font-bold tabular-nums sm:text-lg ${k.color}`}
                    >
                      {k.value}
                    </p>
                  </div>
                ))}
              </div>
              {/* Grafik — o'sib chiqadigan yashil ustunlar */}
              <div className="mt-4 flex h-24 items-end gap-1.5 rounded-xl border border-white/5 bg-white/5 p-3 sm:h-28 sm:gap-2">
                {[35, 55, 42, 70, 58, 85, 64, 92, 76, 100, 68, 88].map((h, i) => (
                  <span
                    key={i}
                    className="landing-bar flex-1 rounded-t-md bg-emerald-500"
                    style={{
                      height: `${h}%`,
                      animationDelay: `${300 + i * 90}ms`,
                      opacity: 0.55 + (h / 100) * 0.45,
                    }}
                  />
                ))}
              </div>
              {/* Pastki qator */}
              <div className="mt-4 flex items-center justify-between gap-2 rounded-xl border border-white/5 bg-white/5 px-3.5 py-2.5">
                <span className="flex items-center gap-2 text-xs text-zinc-300">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  Smena faol · kassa nazoratda
                </span>
                <TrendingUp className="h-4 w-4 flex-shrink-0 text-emerald-400" />
              </div>
            </div>

            {/* Suzuvchi yon kartalar (faqat keng ekranlarda) */}
            <div
              className="animate-landing-float absolute -left-6 top-16 hidden rounded-xl border border-white/10 bg-zinc-900/95 px-3.5 py-2.5 shadow-xl shadow-black/40 backdrop-blur sm:block"
              style={{ animationDelay: "-2.5s" }}
            >
              <p className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
                <BedDouble className="h-3.5 w-3.5 text-emerald-400" />
                104-xona band qilindi
              </p>
              <p className="mt-0.5 text-[10px] text-zinc-500">hozirgina · 2 kecha</p>
            </div>
            <div
              className="animate-landing-float absolute -right-4 bottom-10 hidden rounded-xl border border-white/10 bg-zinc-900/95 px-3.5 py-2.5 shadow-xl shadow-black/40 backdrop-blur sm:block"
              style={{ animationDelay: "-4.5s" }}
            >
              <p className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
                <ScanLine className="h-3.5 w-3.5 text-violet-400" />
                Passport o'qildi
              </p>
              <p className="mt-0.5 text-[10px] text-zinc-500">2 soniyada · avtomatik</p>
            </div>
          </div>
        </div>
      </section>

      {/* MODUL LENTASI — cheksiz marquee */}
      <section className="relative z-10 border-y border-white/5 bg-white/[0.03] py-4 sm:py-5">
        <div className="overflow-hidden">
          <div className="flex w-max animate-landing-marquee gap-2.5 sm:gap-3">
            {[...MARQUEE, ...MARQUEE].map((m, i) => (
              <span
                key={i}
                className="flex items-center gap-2 whitespace-nowrap rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-zinc-300 sm:px-4 sm:py-2 sm:text-sm"
              >
                <m.icon className="h-4 w-4 text-emerald-400" />
                {m.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* IMKONIYATLAR */}
      <section
        id="features"
        className="relative z-10 mx-auto max-w-6xl px-4 py-16 sm:px-5 sm:py-24"
      >
        <div className="landing-reveal mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-400">
            Imkoniyatlar
          </p>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-4xl">
            Har bir bo'lim — puxta o'ylangan
          </h2>
          <p className="mt-3 text-sm text-zinc-400 sm:text-base">
            Kichik hosteldan yirik mehmonxonagacha — kundalik ishning har bir
            qadami uchun tayyor vosita.
          </p>
        </div>
        <div className="mt-10 grid gap-3.5 sm:mt-12 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className="landing-reveal group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur transition-all duration-300 hover:-translate-y-1.5 hover:border-white/20 hover:bg-white/[0.07] hover:shadow-2xl hover:shadow-black/40"
              style={{ transitionDelay: `${(i % 4) * 70}ms` }}
            >
              <div
                className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100 ${f.glow}`}
              />
              <span
                className={`relative flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 ${f.color}`}
              >
                <f.icon className="h-5 w-5" />
              </span>
              <h3 className="relative mt-4 font-bold text-zinc-100">{f.title}</h3>
              <p className="relative mt-1.5 text-sm leading-relaxed text-zinc-400">
                {f.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* QANDAY ISHLAYDI */}
      <section
        id="how"
        className="relative z-10 border-t border-white/5 bg-white/[0.02]"
      >
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-5 sm:py-24">
          <div className="landing-reveal mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-400">
              Qanday ishlaydi
            </p>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-4xl">
              3 qadamda ishga tushadi
            </h2>
          </div>
          <div className="mt-10 grid gap-4 sm:mt-12 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <div
                key={s.n}
                className="landing-reveal relative rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur"
                style={{ transitionDelay: `${i * 120}ms` }}
              >
                <span className="text-5xl font-extrabold text-white/10">{s.n}</span>
                <h3 className="mt-3 text-lg font-bold">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
                  {s.text}
                </p>
                {i < STEPS.length - 1 && (
                  <ArrowRight className="absolute -right-4 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-zinc-600 md:block" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* RAQAMLAR */}
      <section
        id="stats"
        className="relative z-10 mx-auto max-w-6xl px-4 py-16 sm:px-5 sm:py-24"
      >
        <div className="landing-reveal grid gap-6 rounded-3xl border border-emerald-500/20 bg-white/[0.04] p-7 backdrop-blur sm:grid-cols-2 sm:gap-4 sm:p-10 lg:grid-cols-4">
          {[
            { to: 15, suffix: "+", label: "Tayyor modul" },
            { to: 2, suffix: " son.", label: "Hujjatni o'qish tezligi" },
            { to: 100, suffix: "%", label: "Mobil moslashuv" },
            { to: 24, suffix: "/7", label: "Doim ishlaydi" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-3xl font-extrabold text-emerald-400 sm:text-5xl">
                <CountUp to={s.to} suffix={s.suffix} />
              </p>
              <p className="mt-1.5 text-sm text-zinc-400">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 mx-auto max-w-3xl px-4 pb-16 text-center sm:px-5 sm:pb-24">
        <div className="landing-reveal">
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-4xl">
            Mehmonxonangizni <span className="text-emerald-400">bugundan</span>{" "}
            zamonaviy boshqaring
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm text-zinc-400 sm:text-base">
            Qog'oz daftarlar va tarqoq jadvallar o'rniga — bitta tezkor tizim.
            Kirish bir daqiqa ham olmaydi.
          </p>
          <Link
            to="/login"
            className="group mx-auto mt-8 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-8 py-4 text-base font-bold text-white shadow-xl shadow-emerald-600/25 transition-all hover:scale-[1.03] hover:bg-emerald-500 active:scale-95 sm:px-9"
          >
            Hoziroq boshlash
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative z-10 border-t border-white/5">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-zinc-500 sm:px-5 sm:py-7 sm:text-sm">
          <span className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600">
              <Building2 className="h-3.5 w-3.5 text-white" />
            </span>
            <span className="font-semibold text-zinc-300">GoHotel</span>
          </span>
          <span>
            © {new Date().getFullYear()} GoHotel — mehmonxona boshqaruv tizimi
          </span>
        </div>
      </footer>
    </div>
  )
}
