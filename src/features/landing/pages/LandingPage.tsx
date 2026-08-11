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
 * To'liq mustaqil: ilova mavzusiga bog'lanmagan doimiy tungi palitra,
 * scroll'da asta paydo bo'ladigan bo'limlar, suzuvchi mockup, sanovchi
 * raqamlar va cheksiz modul lentasi. Boshqa sahifalarga ta'sir qilmaydi.
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

const FEATURES = [
  {
    icon: CalendarDays,
    title: "Bron va band qilish",
    text: "Soatlik va kunlik bronlar, jonli bandlov doskasi, surib ko'chirish va xona almashtirish — hammasi bir ekranda.",
    accent: "from-sky-500/20 to-sky-500/0 text-sky-400",
  },
  {
    icon: Wallet,
    title: "Kassa va smenalar",
    text: "Smena topshirish parol tasdig'i bilan, \"ko'r sanash\" kassasi, kamomad nazorati va kunlik avtomatik kesim.",
    accent: "from-emerald-500/20 to-emerald-500/0 text-emerald-400",
  },
  {
    icon: ScanLine,
    title: "Hujjat skaneri",
    text: "Passport va ID kartani kamera orqali soniyalarda o'qiydi — mehmon ma'lumotlari formaga o'zi tushadi.",
    accent: "from-violet-500/20 to-violet-500/0 text-violet-400",
  },
  {
    icon: ScanFace,
    title: "Yuz bilan kirish",
    text: "Xodimlar parol termasdan, kameraga qarashning o'zida tizimga kiradi — tez va xavfsiz.",
    accent: "from-fuchsia-500/20 to-fuchsia-500/0 text-fuchsia-400",
  },
  {
    icon: Package,
    title: "Ombor nazorati",
    text: "FIFO partiyalar, kirim-chiqim, spisaniye va inventarizatsiya — har bir mahsulot tannarxigacha hisobda.",
    accent: "from-amber-500/20 to-amber-500/0 text-amber-400",
  },
  {
    icon: BarChart3,
    title: "Jonli statistika",
    text: "Tushum, bandlik, smenalar va xodimlar samaradorligi — boshqaruv paneli har daqiqada yangilanadi.",
    accent: "from-blue-500/20 to-blue-500/0 text-blue-400",
  },
  {
    icon: Store,
    title: "Mini-do'kon",
    text: "Mehmonlarga savdo — bron hisobiga yoki naqd. Har sotuv moliya hisobotiga o'z-o'zidan tushadi.",
    accent: "from-rose-500/20 to-rose-500/0 text-rose-400",
  },
  {
    icon: Smartphone,
    title: "Har qanday qurilmada",
    text: "O'rnatiladigan ilova (PWA), telefon-planshet-kompyuterga to'liq moslashgan, tun mavzusi bilan.",
    accent: "from-teal-500/20 to-teal-500/0 text-teal-400",
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
    <div className="min-h-screen overflow-x-hidden bg-slate-950 text-slate-100 antialiased">
      {/* ORQA FON: suzuvchi yorug' dog'lar + nuqtali to'r */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-40 -left-40 h-[30rem] w-[30rem] rounded-full bg-primary-500/20 blur-3xl animate-login-blob" />
        <div
          className="absolute top-1/3 -right-48 h-[26rem] w-[26rem] rounded-full bg-indigo-500/15 blur-3xl animate-login-blob"
          style={{ animationDelay: "-7s" }}
        />
        <div
          className="absolute -bottom-48 left-1/4 h-[24rem] w-[24rem] rounded-full bg-cyan-500/10 blur-3xl animate-login-blob"
          style={{ animationDelay: "-12s" }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.05)_1px,transparent_0)] bg-[size:30px_30px]" />
      </div>

      {/* NAVBAR */}
      <header className="relative z-20 mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-indigo-600 shadow-lg shadow-primary-600/40">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight">GoHotel</span>
        </div>
        <nav className="hidden items-center gap-7 text-sm font-medium text-slate-300 md:flex">
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
          className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-white/10 transition-all hover:scale-105 hover:shadow-white/20 active:scale-95"
        >
          Kirish
        </Link>
      </header>

      {/* HERO */}
      <section className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-10 lg:grid-cols-2 lg:pt-16">
        <div>
          <p className="landing-reveal inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-slate-300 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            Zamonaviy mehmonxonalar uchun yagona tizim
          </p>
          <h1
            className="landing-reveal mt-5 text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl"
            style={{ transitionDelay: "80ms" }}
          >
            Mehmonxonangizni{" "}
            <span className="relative whitespace-nowrap">
              <span className="relative z-10 bg-gradient-to-r from-primary-400 via-sky-300 to-indigo-400 bg-clip-text text-transparent">
                bitta tizimda
              </span>
              <span className="absolute inset-x-0 bottom-1 -z-0 h-3 rounded-full bg-primary-500/20" />
            </span>{" "}
            boshqaring
          </h1>
          <p
            className="landing-reveal mt-5 max-w-lg text-base leading-relaxed text-slate-400 sm:text-lg"
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
              className="group flex items-center gap-2 rounded-full bg-gradient-to-r from-primary-600 to-indigo-600 px-7 py-3.5 text-sm font-bold text-white shadow-xl shadow-primary-600/30 transition-all hover:scale-[1.03] hover:shadow-primary-500/40 active:scale-95"
            >
              Tizimga kirish
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href="#features"
              className="rounded-full border border-white/15 bg-white/5 px-7 py-3.5 text-sm font-semibold text-slate-200 backdrop-blur transition-all hover:border-white/30 hover:bg-white/10 active:scale-95"
            >
              Imkoniyatlarni ko'rish
            </a>
          </div>
          <div
            className="landing-reveal mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-400"
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
          <div className="animate-landing-float relative mx-auto max-w-md">
            {/* Asosiy oyna */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/90 p-5 shadow-2xl shadow-black/50 backdrop-blur">
              <div className="mb-4 flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
                <span className="ml-3 text-[11px] text-slate-500">
                  GoHotel · Boshqaruv paneli
                </span>
              </div>
              {/* KPI chiplar */}
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { label: "Tushum", value: "12.4M", color: "text-emerald-400" },
                  { label: "Bandlik", value: "86%", color: "text-sky-400" },
                  { label: "Bronlar", value: "34", color: "text-violet-400" },
                ].map((k) => (
                  <div
                    key={k.label}
                    className="rounded-xl border border-white/5 bg-white/5 p-3"
                  >
                    <p className="text-[10px] text-slate-500">{k.label}</p>
                    <p className={`text-lg font-bold tabular-nums ${k.color}`}>
                      {k.value}
                    </p>
                  </div>
                ))}
              </div>
              {/* Grafik — o'sib chiqadigan ustunlar */}
              <div className="mt-4 flex h-28 items-end gap-2 rounded-xl border border-white/5 bg-white/5 p-3">
                {[35, 55, 42, 70, 58, 85, 64, 92, 76, 100, 68, 88].map((h, i) => (
                  <span
                    key={i}
                    className="landing-bar flex-1 rounded-t-md bg-gradient-to-t from-primary-600 to-sky-400"
                    style={{ height: `${h}%`, animationDelay: `${300 + i * 90}ms` }}
                  />
                ))}
              </div>
              {/* Pastki qator */}
              <div className="mt-4 flex items-center justify-between rounded-xl border border-white/5 bg-white/5 px-3.5 py-2.5">
                <span className="flex items-center gap-2 text-xs text-slate-300">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  Smena faol · kassa nazoratda
                </span>
                <TrendingUp className="h-4 w-4 text-emerald-400" />
              </div>
            </div>

            {/* Suzuvchi yon kartalar */}
            <div
              className="animate-landing-float absolute -left-6 top-16 hidden rounded-xl border border-white/10 bg-slate-900/95 px-3.5 py-2.5 shadow-xl shadow-black/40 backdrop-blur sm:block"
              style={{ animationDelay: "-2.5s" }}
            >
              <p className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                <BedDouble className="h-3.5 w-3.5 text-sky-400" />
                104-xona band qilindi
              </p>
              <p className="mt-0.5 text-[10px] text-slate-500">hozirgina · 2 kecha</p>
            </div>
            <div
              className="animate-landing-float absolute -right-4 bottom-10 hidden rounded-xl border border-white/10 bg-slate-900/95 px-3.5 py-2.5 shadow-xl shadow-black/40 backdrop-blur sm:block"
              style={{ animationDelay: "-4.5s" }}
            >
              <p className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                <ScanLine className="h-3.5 w-3.5 text-violet-400" />
                Passport o'qildi
              </p>
              <p className="mt-0.5 text-[10px] text-slate-500">2 soniyada · avtomatik</p>
            </div>
          </div>
        </div>
      </section>

      {/* MODUL LENTASI — cheksiz marquee */}
      <section className="relative z-10 border-y border-white/5 bg-white/[0.03] py-5">
        <div className="overflow-hidden">
          <div className="flex w-max animate-landing-marquee gap-3">
            {[...MARQUEE, ...MARQUEE].map((m, i) => (
              <span
                key={i}
                className="flex items-center gap-2 whitespace-nowrap rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-300"
              >
                <m.icon className="h-4 w-4 text-primary-400" />
                {m.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* IMKONIYATLAR */}
      <section id="features" className="relative z-10 mx-auto max-w-6xl px-5 py-24">
        <div className="landing-reveal mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary-400">
            Imkoniyatlar
          </p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
            Har bir bo'lim — puxta o'ylangan
          </h2>
          <p className="mt-3 text-slate-400">
            Kichik hosteldan yirik mehmonxonagacha — kundalik ishning har bir
            qadami uchun tayyor vosita.
          </p>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className="landing-reveal group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur transition-all duration-300 hover:-translate-y-1.5 hover:border-white/20 hover:bg-white/[0.07] hover:shadow-2xl hover:shadow-black/40"
              style={{ transitionDelay: `${(i % 4) * 70}ms` }}
            >
              <div
                className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100 ${f.accent.split(" ").slice(0, 2).join(" ")}`}
              />
              <span
                className={`relative flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 ${f.accent.split(" ").pop()}`}
              >
                <f.icon className="h-5 w-5" />
              </span>
              <h3 className="relative mt-4 font-bold text-slate-100">{f.title}</h3>
              <p className="relative mt-1.5 text-sm leading-relaxed text-slate-400">
                {f.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* QANDAY ISHLAYDI */}
      <section id="how" className="relative z-10 border-t border-white/5 bg-white/[0.02]">
        <div className="mx-auto max-w-6xl px-5 py-24">
          <div className="landing-reveal mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary-400">
              Qanday ishlaydi
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
              3 qadamda ishga tushadi
            </h2>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <div
                key={s.n}
                className="landing-reveal relative rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur"
                style={{ transitionDelay: `${i * 120}ms` }}
              >
                <span className="bg-gradient-to-b from-white/25 to-white/0 bg-clip-text text-5xl font-extrabold text-transparent">
                  {s.n}
                </span>
                <h3 className="mt-3 text-lg font-bold">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{s.text}</p>
                {i < STEPS.length - 1 && (
                  <ArrowRight className="absolute -right-4 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-slate-600 md:block" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* RAQAMLAR */}
      <section id="stats" className="relative z-10 mx-auto max-w-6xl px-5 py-24">
        <div className="landing-reveal grid gap-4 rounded-3xl border border-white/10 bg-gradient-to-br from-primary-600/15 via-slate-900/60 to-indigo-600/15 p-8 backdrop-blur sm:grid-cols-2 lg:grid-cols-4 sm:p-10">
          {[
            { to: 15, suffix: "+", label: "Tayyor modul" },
            { to: 2, suffix: " son.", label: "Hujjatni o'qish tezligi" },
            { to: 100, suffix: "%", label: "Mobil moslashuv" },
            { to: 24, suffix: "/7", label: "Doim ishlaydi" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-4xl font-extrabold text-white sm:text-5xl">
                <CountUp to={s.to} suffix={s.suffix} />
              </p>
              <p className="mt-1.5 text-sm text-slate-400">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 mx-auto max-w-3xl px-5 pb-24 text-center">
        <div className="landing-reveal">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Mehmonxonangizni{" "}
            <span className="bg-gradient-to-r from-primary-400 to-indigo-400 bg-clip-text text-transparent">
              bugundan
            </span>{" "}
            zamonaviy boshqaring
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-slate-400">
            Qog'oz daftarlar va tarqoq jadvallar o'rniga — bitta tezkor tizim.
            Kirish bir daqiqa ham olmaydi.
          </p>
          <Link
            to="/login"
            className="group mx-auto mt-8 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary-600 to-indigo-600 px-9 py-4 text-base font-bold text-white shadow-xl shadow-primary-600/30 transition-all hover:scale-[1.03] hover:shadow-primary-500/50 active:scale-95"
          >
            Hoziroq boshlash
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative z-10 border-t border-white/5">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-7 text-sm text-slate-500">
          <span className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary-500 to-indigo-600">
              <Building2 className="h-3.5 w-3.5 text-white" />
            </span>
            <span className="font-semibold text-slate-300">GoHotel</span>
          </span>
          <span>
            © {new Date().getFullYear()} GoHotel — mehmonxona boshqaruv tizimi
          </span>
        </div>
      </footer>
    </div>
  )
}
