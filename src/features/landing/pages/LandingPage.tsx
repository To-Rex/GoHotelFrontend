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
  Sun,
  Moon,
  BedDouble,
  Users,
  ClipboardList,
  ShieldCheck,
  History,
  TrendingUp,
  Briefcase,
  BellRing,
  Sparkles,
  Lock,
  ChevronDown,
  X,
  Check,
} from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * GoHotel landing sahifasi — /landing va /leanding.
 *
 * IKKI TABIAT SAHNASI (mustaqil almashtirgich, ilova mavzusiga tegmaydi):
 *   KUN — yozgi jazirama: iliq osmon, taftli quyosh, suzuvchi bulutlar va
 *         qanot qoqib uchib o'tayotgan qushlar;
 *   TUN — huzurbaxsh yulduzli osmon: kraterli to'lin oy, miltillovchi
 *         yulduzlar va vaqti-vaqti bilan uchar yulduz.
 * Sahna soatga qarab o'zi tanlanadi, tugma bilan almashtiriladi.
 * Fon yaxlit ranglarda — gradientsiz. Boshqa sahifalarga ta'sir yo'q.
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

// Uchib o'tayotgan qush — ikki qanotli silueti qanot qoqadi
function Bird({ style, size = 46 }: { style?: React.CSSProperties; size?: number }) {
  return (
    <svg
      viewBox="0 0 60 26"
      width={size}
      height={(size * 26) / 60}
      fill="none"
      className="landing-bird absolute text-zinc-700/70"
      style={style}
    >
      <path
        className="landing-flap"
        d="M3 16 Q 16 3, 30 15 Q 44 3, 57 16"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
    </svg>
  )
}

// Suzuvchi bulut — yaxlit oq shakllardan yig'ilgan
function Cloud({
  style,
  scale = 1,
  opacity = 0.95,
}: {
  style?: React.CSSProperties
  scale?: number
  opacity?: number
}) {
  return (
    <div className="landing-cloud absolute" style={style}>
      <div className="relative h-12 w-32" style={{ transform: `scale(${scale})`, opacity }}>
        <span className="absolute bottom-0 left-0 h-9 w-32 rounded-full bg-white" />
        <span className="absolute bottom-3 left-5 h-10 w-14 rounded-full bg-white" />
        <span className="absolute bottom-2 left-16 h-8 w-12 rounded-full bg-white" />
      </div>
    </div>
  )
}

const FEATURES = [
  {
    icon: CalendarDays,
    title: "Bron va band qilish",
    text: "Soatlik va kunlik bronlar, jonli bandlov doskasi, surib ko'chirish va xona almashtirish — hammasi bir ekranda.",
    day: "text-orange-600 bg-orange-500/10",
    night: "text-amber-300 bg-amber-400/10",
  },
  {
    icon: Wallet,
    title: "Kassa va smenalar",
    text: "Smena topshirish parol tasdig'i bilan, \"ko'r sanash\" kassasi, kamomad nazorati va kunlik avtomatik kesim.",
    day: "text-emerald-600 bg-emerald-500/10",
    night: "text-emerald-300 bg-emerald-400/10",
  },
  {
    icon: ScanLine,
    title: "Hujjat skaneri",
    text: "Passport va ID kartani kamera orqali soniyalarda o'qiydi — mehmon ma'lumotlari formaga o'zi tushadi.",
    day: "text-violet-600 bg-violet-500/10",
    night: "text-violet-300 bg-violet-400/10",
  },
  {
    icon: ScanFace,
    title: "Yuz bilan kirish",
    text: "Xodimlar parol termasdan, kameraga qarashning o'zida tizimga kiradi — tez va xavfsiz.",
    day: "text-rose-600 bg-rose-500/10",
    night: "text-rose-300 bg-rose-400/10",
  },
  {
    icon: Package,
    title: "Ombor nazorati",
    text: "FIFO partiyalar, kirim-chiqim, spisaniye va inventarizatsiya — har bir mahsulot tannarxigacha hisobda.",
    day: "text-amber-600 bg-amber-500/10",
    night: "text-orange-300 bg-orange-400/10",
  },
  {
    icon: BarChart3,
    title: "Jonli statistika",
    text: "Tushum, bandlik, smenalar va xodimlar samaradorligi — boshqaruv paneli har daqiqada yangilanadi.",
    day: "text-teal-600 bg-teal-500/10",
    night: "text-teal-300 bg-teal-400/10",
  },
  {
    icon: Store,
    title: "Mini-do'kon",
    text: "Mehmonlarga savdo — bron hisobiga yoki naqd. Har sotuv moliya hisobotiga o'z-o'zidan tushadi.",
    day: "text-lime-600 bg-lime-500/10",
    night: "text-lime-300 bg-lime-400/10",
  },
  {
    icon: Smartphone,
    title: "Har qanday qurilmada",
    text: "O'rnatiladigan ilova (PWA), telefon-planshet-kompyuterga to'liq moslashgan, tun mavzusi bilan.",
    day: "text-fuchsia-600 bg-fuchsia-500/10",
    night: "text-fuchsia-300 bg-fuchsia-400/10",
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

// Har bir rol tizimdan nima oladi
const ROLES = [
  {
    icon: Briefcase,
    title: "Direktor",
    points: [
      "Jonli tushum va bandlik statistikasi",
      "Smenalar, kamomadlar va farqlar nazorati",
      "Xodimlar samaradorligi reytingi",
      "Har amal auditda — kim, qachon, nima qildi",
    ],
  },
  {
    icon: ShieldCheck,
    title: "Menejer",
    points: [
      "Bronlarni tahrirlash va xonalar boshqaruvi",
      "Kassani majburiy yopish va tuzatish huquqi",
      "Ombor: kirim, spisaniye, inventarizatsiya",
      "Xodim yaratish va vazifalar taqsimoti",
    ],
  },
  {
    icon: BellRing,
    title: "Resepshn",
    points: [
      "Bir bosishda bron — jonli doskada",
      "Passport/ID skaneri — forma o'zi to'ladi",
      "Kassa-smena: ochish, topshirish, qabul qilish",
      "Do'kon savdosi va shaxsiy hisobot",
    ],
  },
  {
    icon: Sparkles,
    title: "Farrosh",
    points: [
      "O'z vazifalari ro'yxati — telefonida",
      "Boshlash/yakunlash bir tugmada",
      "Fotohisobot yuklash imkoniyati",
      "Tozalash bitishi bilan bron o'zi yopiladi",
    ],
  },
]

// Qog'oz daftar bilan taqqoslash
const COMPARE = [
  { old: "Bronni daftardan qidirish — daqiqalab vaqt", now: "Qidiruv va filtrlar — bir soniyada topiladi" },
  { old: "Kassa hisobi qo'lda, xatolar yashirin qoladi", now: "\"Ko'r sanash\" — har so'm avtomatik solishtiriladi" },
  { old: "Mehmon ma'lumotini qo'lda terish", now: "Skaner passportni 2 soniyada o'qiydi" },
  { old: "Hisobot oy oxirida, taxminiy", now: "Jonli statistika — har daqiqada aniq" },
  { old: "Kim nima qilgani noma'lum", now: "To'liq audit: kim, qachon, qancha" },
]

// Xavfsizlik kafolatlari
const SECURITY = [
  { icon: ShieldCheck, label: "Rollar va aniq ruxsatnomalar" },
  { icon: Lock, label: "Parollar faqat hash ko'rinishida" },
  { icon: History, label: "Har bir amal audit izida" },
  { icon: ScanLine, label: "Skaner ma'lumoti qurilmadan chiqmaydi" },
  { icon: Wallet, label: "Kunlik majburiy kassa kesimi" },
  { icon: Smartphone, label: "HTTPS orqali xavfsiz ulanish" },
]

// Ko'p so'raladigan savollar
const FAQ = [
  {
    q: "Tizimni ishlatish uchun nimadir o'rnatish kerakmi?",
    a: "Yo'q — GoHotel brauzerda ishlaydi. Xohlasangiz, telefon yoki kompyuterga PWA ilova sifatida bir bosishda o'rnatib olasiz: alohida oynada, native ilovadek ochiladi va yangilanishlarni o'zi oladi.",
  },
  {
    q: "Xodimlarim tizimda nimalarni ko'ra oladi?",
    a: "Har xodimga rol va aniq ruxsatlar beriladi: resepshn faqat o'z ishini, farrosh faqat vazifalarini, menejer boshqaruvni ko'radi. Tannarxlar, hisobotlar va sozlamalar faqat rahbariyatga ochiq.",
  },
  {
    q: "Kassa hisobi qanday nazorat qilinadi?",
    a: "Har smena o'z kassasi bilan ochiladi. Topshirishda xodim pulni sanab kiritadi, tizim kutilgan summani hisoblab farqni chiqaradi. Farqlar (kamomad ham, ortiqcha ham) xodim nomiga yozilib, smenalar tarixida saqlanadi.",
  },
  {
    q: "Soatlik ijara ham qo'llab-quvvatlanadimi?",
    a: "Ha — kunlik ham, soatlik ham. Jonli bandlov doskasida har ikkalasi yonma-yon ko'rinadi, soatlik bronlar orasida tozalash tanaffusi ham hisobga olinadi.",
  },
  {
    q: "Internet uzilib qolsa nima bo'ladi?",
    a: "Ma'lumotlar bulutdagi serverda xavfsiz saqlanadi — qurilmangiz almashsa ham hech narsa yo'qolmaydi. Aloqa tiklanishi bilan ish davom etadi, o'rnatilgan PWA esa qayta ochilishda so'nggi holatni ko'rsatadi.",
  },
  {
    q: "Bir nechta filialim bor — hammasini boshqara olamanmi?",
    a: "Ha, tizim ko'p filialli ishlashga mo'ljallangan: xonalar, xodimlar va bronlar filial kesimida yuritiladi, hisobotlar esa umumiy ko'rinishda jamlanadi.",
  },
]

// "Va yana" — tizimdagi mayda-yirik qulayliklar to'plami
const EXTRAS = [
  "Xona turlari va qavatlar",
  "Qulayliklar katalogi",
  "Qo'shimcha xizmatlar",
  "Yagona mehmonlar bazasi",
  "Dublikat mehmonni avto-aniqlash",
  "Chegirmalar — foiz va summa",
  "Qisman (bo'lib) to'lash",
  "Xona almashtirish auditi",
  "Soatlik bronlar orasida tanaffus",
  "Muddati tugaganda avto check-out",
  "Vazifalarni avto-yakunlash",
  "Push bildirishnomalar",
  "Navbarda ish vaqti hisoblagichi",
  "Bir bosishda ma'lumot yangilash",
  "To'liq o'zbek tilida",
  "Ilova ichida tun/kun mavzusi",
]

// Doimiy rivojlanish xronologiyasi (so'nggi yirik yangiliklar)
const TIMELINE = [
  {
    title: "Smena va kassa tizimi",
    text: "\"Ko'r sanash\", parol bilan topshirish, kamomad nazorati va smenalar tarixi.",
  },
  {
    title: "Ombor moduli",
    text: "FIFO partiyalar, kirim, spisaniye, inventarizatsiya va harakatlar jurnali.",
  },
  {
    title: "Tezkor hujjat skaneri",
    text: "Nazorat raqamlari tekshiruvi bilan — endi yanada aniq va bir necha barobar tez.",
  },
  {
    title: "Xonani almashtirish",
    text: "Bo'sh xonalar ro'yxati, narx farqini avto-hisoblash va o'chirilmas audit.",
  },
  {
    title: "Profil va landing sahifalari",
    text: "Har xodim o'z ruxsatlarini ko'radi; tizim bilan tanishuv sahifasi ikki sahnada.",
  },
]

// Tungi osmon yulduzlari (foizli koordinatalar — har ekranga moslashadi)
const STARS = [
  { top: "5%", left: "8%", s: 3, d: "0s" },
  { top: "9%", left: "30%", s: 2, d: "-1.4s" },
  { top: "7%", left: "56%", s: 2, d: "-2.6s" },
  { top: "13%", left: "78%", s: 3, d: "-0.8s" },
  { top: "17%", left: "18%", s: 2, d: "-3.2s" },
  { top: "21%", left: "44%", s: 2, d: "-1.9s" },
  { top: "15%", left: "92%", s: 2, d: "-2.2s" },
  { top: "27%", left: "66%", s: 2, d: "-0.5s" },
  { top: "31%", left: "10%", s: 2, d: "-3.8s" },
  { top: "35%", left: "35%", s: 3, d: "-1.1s" },
  { top: "39%", left: "84%", s: 2, d: "-2.9s" },
  { top: "45%", left: "52%", s: 2, d: "-0.2s" },
  { top: "49%", left: "22%", s: 2, d: "-3.5s" },
  { top: "55%", left: "72%", s: 2, d: "-1.6s" },
  { top: "61%", left: "6%", s: 2, d: "-2.4s" },
  { top: "67%", left: "40%", s: 3, d: "-0.9s" },
  { top: "73%", left: "88%", s: 2, d: "-3.1s" },
  { top: "79%", left: "58%", s: 2, d: "-1.3s" },
  { top: "85%", left: "16%", s: 2, d: "-2.7s" },
  { top: "91%", left: "76%", s: 2, d: "-0.6s" },
  { top: "58%", left: "94%", s: 2, d: "-4.1s" },
  { top: "83%", left: "34%", s: 2, d: "-1.8s" },
]

export const LandingPage = () => {
  useReveal()

  // Sahna soatga qarab tanlanadi (19:00–06:00 — tun), tugma bilan almashtiriladi
  const [night, setNight] = useState(() => {
    const h = new Date().getHours()
    return h >= 19 || h < 6
  })

  // FAQ akkordeoni — bittasi ochiq turadi
  const [faqOpen, setFaqOpen] = useState<number | null>(0)

  useEffect(() => {
    document.title = "GoHotel — Mehmonxona boshqaruv tizimi"
    return () => {
      document.title = "GoHotel"
    }
  }, [])

  const cardCls = cn(
    "border backdrop-blur transition-colors duration-700",
    night ? "border-white/10 bg-white/[0.05]" : "border-orange-900/10 bg-white/75"
  )

  return (
    <div
      className={cn(
        "min-h-screen overflow-x-hidden antialiased transition-colors duration-700",
        night ? "bg-zinc-950 text-zinc-100" : "bg-[#fdf6e3] text-zinc-900"
      )}
    >
      {/* ================= TABIAT SAHNASI (fon) ================= */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        {/* --- TUN: yulduzlar, uchar yulduz, to'lin oy --- */}
        <div
          className={cn(
            "absolute inset-0 transition-opacity duration-1000",
            night ? "opacity-100" : "opacity-0"
          )}
        >
          {STARS.map((s, i) => (
            <span
              key={i}
              className="landing-star bg-white"
              style={{
                top: s.top,
                left: s.left,
                width: s.s,
                height: s.s,
                animationDelay: s.d,
              }}
            />
          ))}
          {/* Uchar yulduz — har 12 soniyada bir chizib o'tadi */}
          <span className="landing-shoot absolute right-[8%] top-[12%] h-0.5 w-24 rounded-full bg-white/80" />
          {/* To'lin oy: kraterlari bilan, atrofida yumshoq halo halqalari */}
          <div className="absolute right-[8%] top-[9%] sm:right-[12%] sm:top-[12%]">
            <span className="landing-sunpulse absolute -inset-5 rounded-full border border-zinc-200/10" />
            <span className="absolute -inset-10 rounded-full border border-zinc-200/5" />
            <div className="relative h-20 w-20 rounded-full bg-zinc-200 shadow-[0_0_50px_rgba(228,228,231,0.25)] sm:h-24 sm:w-24">
              <span className="absolute left-4 top-5 h-4 w-4 rounded-full bg-zinc-400/50" />
              <span className="absolute left-11 top-10 h-2.5 w-2.5 rounded-full bg-zinc-400/40" />
              <span className="absolute left-6 top-13 h-3 w-3 rounded-full bg-zinc-400/45" />
              <span className="absolute left-13 top-4 h-2 w-2 rounded-full bg-zinc-400/40" />
              <span className="absolute right-3 bottom-4 h-3.5 w-3.5 rounded-full bg-zinc-400/35" />
            </div>
          </div>
        </div>

        {/* --- KUN: jazirama quyosh, bulutlar, qushlar --- */}
        <div
          className={cn(
            "absolute inset-0 transition-opacity duration-1000",
            night ? "opacity-0" : "opacity-100"
          )}
        >
          {/* Quyosh: yaxlit sariq doira + nafas oluvchi taft halqalari */}
          <div className="absolute right-[6%] top-[8%] sm:right-[10%] sm:top-[10%]">
            <span className="landing-sunpulse absolute -inset-6 rounded-full border-2 border-amber-400/50" />
            <span
              className="landing-sunpulse absolute -inset-12 rounded-full border border-amber-400/25"
              style={{ animationDelay: "-2.5s" }}
            />
            <div className="relative h-20 w-20 rounded-full bg-amber-400 shadow-[0_0_60px_rgba(251,191,36,0.55)] sm:h-24 sm:w-24" />
          </div>
          {/* Bulutlar — har xil balandlik, o'lcham va tezlikda */}
          <Cloud style={{ top: "14%", animationDuration: "95s" }} scale={1.15} />
          <Cloud
            style={{ top: "26%", animationDuration: "70s", animationDelay: "-30s" }}
            scale={0.8}
            opacity={0.8}
          />
          <Cloud
            style={{ top: "8%", animationDuration: "115s", animationDelay: "-60s" }}
            scale={0.6}
            opacity={0.7}
          />
          <Cloud
            style={{ top: "38%", animationDuration: "85s", animationDelay: "-45s" }}
            scale={0.5}
            opacity={0.55}
          />
          {/* Qushlar galasi — turli balandlik va tezlikda qanot qoqib o'tadi */}
          <Bird style={{ top: "18%", animationDuration: "30s" }} size={44} />
          <Bird
            style={{ top: "22%", animationDuration: "36s", animationDelay: "-6s" }}
            size={30}
          />
          <Bird
            style={{ top: "14%", animationDuration: "42s", animationDelay: "-16s" }}
            size={24}
          />
          <Bird
            style={{ top: "30%", animationDuration: "38s", animationDelay: "-26s" }}
            size={34}
          />
        </div>
      </div>

      {/* ================= NAVBAR ================= */}
      <header className="relative z-20 mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl shadow-lg transition-colors duration-700 sm:h-10 sm:w-10",
              night
                ? "bg-amber-400 shadow-amber-400/25"
                : "bg-orange-500 shadow-orange-500/30"
            )}
          >
            <Building2 className={cn("h-5 w-5", night ? "text-zinc-900" : "text-white")} />
          </div>
          <span className="text-lg font-bold tracking-tight">GoHotel</span>
        </div>

        <nav
          className={cn(
            "hidden items-center gap-7 text-sm font-medium md:flex",
            night ? "text-zinc-400" : "text-zinc-600"
          )}
        >
          <a
            href="#features"
            className={cn("transition-colors", night ? "hover:text-white" : "hover:text-zinc-900")}
          >
            Imkoniyatlar
          </a>
          <a
            href="#how"
            className={cn("transition-colors", night ? "hover:text-white" : "hover:text-zinc-900")}
          >
            Qanday ishlaydi
          </a>
          <a
            href="#stats"
            className={cn("transition-colors", night ? "hover:text-white" : "hover:text-zinc-900")}
          >
            Raqamlar
          </a>
          <a
            href="#faq"
            className={cn("transition-colors", night ? "hover:text-white" : "hover:text-zinc-900")}
          >
            Savollar
          </a>
        </nav>

        <div className="flex items-center gap-2.5">
          {/* Kun/Tun sahnasi almashtirgichi */}
          <button
            type="button"
            onClick={() => setNight((v) => !v)}
            title={night ? "Kun sahnasiga o'tish" : "Tun sahnasiga o'tish"}
            className={cn(
              "relative flex h-9 w-[68px] items-center rounded-full border transition-colors duration-500",
              night ? "border-white/15 bg-white/10" : "border-orange-900/15 bg-white/80"
            )}
          >
            <span
              className={cn(
                "absolute flex h-7 w-7 items-center justify-center rounded-full shadow-md transition-all duration-500",
                night
                  ? "left-[calc(100%-30px)] bg-zinc-200 text-zinc-800"
                  : "left-1 bg-amber-400 text-white"
              )}
            >
              {night ? <Moon size={15} /> : <Sun size={15} />}
            </span>
          </button>
          <Link
            to="/login"
            className={cn(
              "rounded-full px-4 py-2 text-sm font-semibold shadow-lg transition-all hover:scale-105 active:scale-95 sm:px-5",
              night
                ? "bg-white text-zinc-900 shadow-white/10"
                : "bg-zinc-900 text-white shadow-zinc-900/20"
            )}
          >
            Kirish
          </Link>
        </div>
      </header>

      {/* ================= HERO ================= */}
      <section className="relative z-10 mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-8 sm:px-5 sm:pb-20 lg:grid-cols-2 lg:gap-12 lg:pt-14">
        <div>
          <p
            className={cn(
              "landing-reveal inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium backdrop-blur",
              night
                ? "border-white/10 bg-white/5 text-zinc-300"
                : "border-orange-900/10 bg-white/70 text-zinc-600"
            )}
          >
            {night ? (
              <Moon className="h-3.5 w-3.5 text-amber-300" />
            ) : (
              <Sun className="h-3.5 w-3.5 text-orange-500" />
            )}
            Zamonaviy mehmonxonalar uchun yagona tizim
          </p>
          <h1
            className="landing-reveal mt-5 text-3xl font-extrabold leading-[1.12] tracking-tight sm:text-5xl lg:text-6xl"
            style={{ transitionDelay: "80ms" }}
          >
            Mehmonxonangizni{" "}
            <span className="relative whitespace-nowrap">
              <span
                className={cn("relative z-10", night ? "text-amber-300" : "text-orange-600")}
              >
                bitta tizimda
              </span>
              <span
                className={cn(
                  "absolute inset-x-0 bottom-1 -z-0 h-3 rounded-full",
                  night ? "bg-amber-400/20" : "bg-orange-500/20"
                )}
              />
            </span>{" "}
            boshqaring
          </h1>
          <p
            className={cn(
              "landing-reveal mt-5 max-w-lg text-base leading-relaxed sm:text-lg",
              night ? "text-zinc-400" : "text-zinc-600"
            )}
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
              className={cn(
                "group flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-bold shadow-xl transition-all hover:scale-[1.03] active:scale-95 sm:px-7",
                night
                  ? "bg-amber-400 text-zinc-900 shadow-amber-400/25 hover:bg-amber-300"
                  : "bg-orange-600 text-white shadow-orange-600/25 hover:bg-orange-500"
              )}
            >
              Tizimga kirish
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href="#features"
              className={cn(
                "rounded-full border px-6 py-3.5 text-sm font-semibold backdrop-blur transition-all active:scale-95 sm:px-7",
                night
                  ? "border-white/15 bg-white/5 text-zinc-200 hover:border-white/30 hover:bg-white/10"
                  : "border-orange-900/15 bg-white/70 text-zinc-700 hover:border-orange-900/30 hover:bg-white"
              )}
            >
              Imkoniyatlarni ko'rish
            </a>
          </div>
          <div
            className={cn(
              "landing-reveal mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs",
              night ? "text-zinc-400" : "text-zinc-600"
            )}
            style={{ transitionDelay: "320ms" }}
          >
            {["O'rnatiladigan PWA ilova", "Yuz bilan kirish", "Hujjat skaneri"].map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* HERO MOCKUP — suzuvchi mini boshqaruv paneli */}
        <div className="landing-reveal relative" style={{ transitionDelay: "200ms" }}>
          <div className="animate-landing-float relative mx-auto w-full max-w-md">
            {/* HAQIQIY boshqaruv paneli miniaturasi — ilovadagi asl dizayn
                (oq kartalar, raqamlar reykasi, aksent-chiziqli KPI, grafik,
                xonalar holati) xuddi skrinshotdek, o'z ranglarida */}
            <div
              className={cn(
                "rounded-2xl border border-zinc-200 bg-white p-4 text-zinc-900 shadow-2xl",
                night ? "shadow-black/60" : "shadow-orange-900/20"
              )}
            >
              <div className="mb-3 flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
                <span className="ml-3 truncate text-[10px] text-zinc-400">
                  GoHotel · Boshqaruv paneli
                </span>
              </div>

              {/* Tipografik sarlavha + jonli soat */}
              <div className="flex items-end justify-between gap-2">
                <div>
                  <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
                    11-avgust, seshanba
                  </p>
                  <p className="text-sm font-extrabold tracking-tight">
                    Xayrli kun, Jasur!
                  </p>
                </div>
                <p className="text-lg font-bold tabular-nums tracking-tight">14:32</p>
              </div>

              {/* Asosiy raqamlar reykasi */}
              <div className="mt-2.5 grid grid-cols-3 divide-x divide-zinc-100 rounded-xl border border-zinc-200">
                <div className="p-2">
                  <p className="text-[7px] font-semibold uppercase tracking-wider text-zinc-400">
                    Bugungi tushum
                  </p>
                  <p className="text-[11px] font-bold tabular-nums">4 250 000</p>
                  <svg viewBox="0 0 60 18" className="mt-1 h-3.5 w-full">
                    <polyline
                      points="0,13 10,9 20,11 30,5 40,9 50,3 60,6"
                      fill="none"
                      stroke="#2563eb"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div className="p-2">
                  <p className="text-[7px] font-semibold uppercase tracking-wider text-zinc-400">
                    Sof natija
                  </p>
                  <p className="text-[11px] font-bold tabular-nums text-emerald-600">
                    +3 180 000
                  </p>
                  <p className="mt-1 text-[6.5px] leading-tight text-zinc-400">
                    tushum + do'kon − xarajat
                  </p>
                </div>
                <div className="p-2">
                  <p className="text-[7px] font-semibold uppercase tracking-wider text-zinc-400">
                    Bandlik
                  </p>
                  <p className="text-[11px] font-bold tabular-nums">
                    86<span className="text-[8px] text-zinc-400">%</span>
                  </p>
                  <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-zinc-100">
                    <div className="h-full w-[86%] rounded-full bg-[#2563eb]" />
                  </div>
                </div>
              </div>

              {/* KPI kartalari — aksent chiziqlar bilan */}
              <div className="mt-2 grid grid-cols-3 gap-2">
                {[
                  { label: "Bugungi xarajat", value: "620 000", bar: "bg-red-500" },
                  { label: "Do'kon (bugun)", value: "485 000", bar: "bg-violet-500" },
                  { label: "Faol bandlovlar", value: "34", bar: "bg-sky-500" },
                ].map((t) => (
                  <div key={t.label} className="rounded-lg border border-zinc-200 p-1.5">
                    <p className="truncate text-[6.5px] font-medium text-zinc-400">
                      {t.label}
                    </p>
                    <p className="text-[10px] font-bold tabular-nums">{t.value}</p>
                    <span className={cn("mt-1 block h-0.5 w-4 rounded-full", t.bar)} />
                  </div>
                ))}
              </div>

              {/* 7 kunlik tushum grafigi — asl ko'k ustunlar */}
              <div className="mt-2 rounded-xl border border-zinc-200 p-2">
                <div className="flex items-center justify-between">
                  <span className="text-[7.5px] font-bold text-zinc-600">
                    Oxirgi 7 kun tushumi
                  </span>
                  <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[6.5px] font-semibold text-emerald-600">
                    Jami: 28.4M So'm
                  </span>
                </div>
                <div className="mt-1.5 flex h-12 items-end gap-1 sm:h-14">
                  {[45, 65, 38, 78, 56, 96, 72].map((h, i) => (
                    <span
                      key={i}
                      className="landing-bar flex-1 rounded-t-[3px] bg-[#2563eb]"
                      style={{ height: `${h}%`, animationDelay: `${300 + i * 110}ms` }}
                    />
                  ))}
                </div>
              </div>

              {/* Xonalar holati — segmentli chiziq */}
              <div className="mt-2 rounded-xl border border-zinc-200 p-2">
                <p className="text-[7.5px] font-bold text-zinc-600">Xonalar holati</p>
                <div className="mt-1.5 flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full">
                  <span className="w-[42%] bg-emerald-500" />
                  <span className="w-[26%] bg-red-500" />
                  <span className="w-[18%] bg-blue-500" />
                  <span className="w-[14%] bg-amber-500" />
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-2.5 gap-y-0.5">
                  {[
                    ["bg-emerald-500", "Bo'sh 13"],
                    ["bg-red-500", "Band 8"],
                    ["bg-blue-500", "Band qilingan 5"],
                    ["bg-amber-500", "Tozalanmoqda 4"],
                  ].map(([dot, label]) => (
                    <span
                      key={label}
                      className="flex items-center gap-1 text-[6.5px] text-zinc-500"
                    >
                      <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
                      {label}
                    </span>
                  ))}
                </div>
              </div>

              {/* Jonli smena indikatori */}
              <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-zinc-200 px-2.5 py-1.5">
                <span className="flex items-center gap-1.5 text-[8px] text-zinc-600">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  </span>
                  Smena faol · kassa nazoratda
                </span>
                <TrendingUp className="h-3 w-3 flex-shrink-0 text-emerald-500" />
              </div>
            </div>

            {/* Suzuvchi yon kartalar (keng ekranlarda) */}
            <div
              className={cn(
                "animate-landing-float absolute -left-6 top-16 hidden rounded-xl px-3.5 py-2.5 shadow-xl sm:block",
                cardCls,
                night ? "shadow-black/40" : "shadow-orange-900/10"
              )}
              style={{ animationDelay: "-2.5s" }}
            >
              <p
                className={cn(
                  "flex items-center gap-2 text-xs font-semibold",
                  night ? "text-zinc-200" : "text-zinc-700"
                )}
              >
                <BedDouble className="h-3.5 w-3.5 text-emerald-500" />
                104-xona band qilindi
              </p>
              <p className="mt-0.5 text-[10px] text-zinc-500">hozirgina · 2 kecha</p>
            </div>
            <div
              className={cn(
                "animate-landing-float absolute -right-4 bottom-10 hidden rounded-xl px-3.5 py-2.5 shadow-xl sm:block",
                cardCls,
                night ? "shadow-black/40" : "shadow-orange-900/10"
              )}
              style={{ animationDelay: "-4.5s" }}
            >
              <p
                className={cn(
                  "flex items-center gap-2 text-xs font-semibold",
                  night ? "text-zinc-200" : "text-zinc-700"
                )}
              >
                <ScanLine className="h-3.5 w-3.5 text-violet-500" />
                Passport o'qildi
              </p>
              <p className="mt-0.5 text-[10px] text-zinc-500">2 soniyada · avtomatik</p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= MODUL LENTASI ================= */}
      <section
        className={cn(
          "relative z-10 space-y-2.5 border-y py-4 transition-colors duration-700 sm:space-y-3 sm:py-5",
          night ? "border-white/5 bg-white/[0.03]" : "border-orange-900/10 bg-white/50"
        )}
      >
        {[false, true].map((reverse) => (
          <div key={String(reverse)} className="overflow-hidden">
            <div
              className="flex w-max animate-landing-marquee gap-2.5 sm:gap-3"
              style={
                reverse
                  ? { animationDirection: "reverse", animationDuration: "38s" }
                  : undefined
              }
            >
              {(reverse ? [...MARQUEE].reverse() : MARQUEE)
                .concat(reverse ? [...MARQUEE].reverse() : MARQUEE)
                .map((m, i) => (
                  <span
                    key={i}
                    className={cn(
                      "flex items-center gap-2 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-medium sm:px-4 sm:py-2 sm:text-sm",
                      night
                        ? "border-white/10 bg-white/5 text-zinc-300"
                        : "border-orange-900/10 bg-white/80 text-zinc-600"
                    )}
                  >
                    <m.icon
                      className={cn(
                        "h-4 w-4",
                        reverse
                          ? night
                            ? "text-emerald-400"
                            : "text-emerald-600"
                          : night
                            ? "text-amber-300"
                            : "text-orange-500"
                      )}
                    />
                    {m.label}
                  </span>
                ))}
            </div>
          </div>
        ))}
      </section>

      {/* ================= IMKONIYATLAR ================= */}
      <section id="features" className="relative z-10 mx-auto max-w-6xl px-4 py-16 sm:px-5 sm:py-24">
        <div className="landing-reveal mx-auto max-w-2xl text-center">
          <p
            className={cn(
              "text-xs font-bold uppercase tracking-[0.25em]",
              night ? "text-amber-300" : "text-orange-600"
            )}
          >
            Imkoniyatlar
          </p>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-4xl">
            Har bir bo'lim — puxta o'ylangan
          </h2>
          <p
            className={cn(
              "mt-3 text-sm sm:text-base",
              night ? "text-zinc-400" : "text-zinc-600"
            )}
          >
            Kichik hosteldan yirik mehmonxonagacha — kundalik ishning har bir
            qadami uchun tayyor vosita.
          </p>
        </div>
        <div className="mt-10 grid gap-3.5 sm:mt-12 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
          {FEATURES.map((f, i) => {
            const accent = night ? f.night : f.day
            return (
              <div
                key={f.title}
                className={cn(
                  "landing-reveal group rounded-2xl p-5 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl",
                  cardCls,
                  night
                    ? "hover:border-white/20 hover:bg-white/[0.08] hover:shadow-black/40"
                    : "hover:border-orange-900/20 hover:bg-white hover:shadow-orange-900/10"
                )}
                style={{ transitionDelay: `${(i % 4) * 70}ms` }}
              >
                <span
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-xl transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110",
                    accent
                  )}
                >
                  <f.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-bold">{f.title}</h3>
                <p
                  className={cn(
                    "mt-1.5 text-sm leading-relaxed",
                    night ? "text-zinc-400" : "text-zinc-600"
                  )}
                >
                  {f.text}
                </p>
              </div>
            )
          })}
        </div>
      </section>

      {/* ================= QANDAY ISHLAYDI ================= */}
      <section
        id="how"
        className={cn(
          "relative z-10 border-t transition-colors duration-700",
          night ? "border-white/5 bg-white/[0.02]" : "border-orange-900/10 bg-white/40"
        )}
      >
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-5 sm:py-24">
          <div className="landing-reveal mx-auto max-w-2xl text-center">
            <p
              className={cn(
                "text-xs font-bold uppercase tracking-[0.25em]",
                night ? "text-amber-300" : "text-orange-600"
              )}
            >
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
                className={cn("landing-reveal relative rounded-2xl p-6", cardCls)}
                style={{ transitionDelay: `${i * 120}ms` }}
              >
                <span
                  className={cn(
                    "text-5xl font-extrabold",
                    night ? "text-white/10" : "text-zinc-900/10"
                  )}
                >
                  {s.n}
                </span>
                <h3 className="mt-3 text-lg font-bold">{s.title}</h3>
                <p
                  className={cn(
                    "mt-1.5 text-sm leading-relaxed",
                    night ? "text-zinc-400" : "text-zinc-600"
                  )}
                >
                  {s.text}
                </p>
                {i < STEPS.length - 1 && (
                  <ArrowRight
                    className={cn(
                      "absolute -right-4 top-1/2 hidden h-5 w-5 -translate-y-1/2 md:block",
                      night ? "text-zinc-600" : "text-zinc-400"
                    )}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= KIM UCHUN (ROLLAR) ================= */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 py-16 sm:px-5 sm:py-24">
        <div className="landing-reveal mx-auto max-w-2xl text-center">
          <p
            className={cn(
              "text-xs font-bold uppercase tracking-[0.25em]",
              night ? "text-amber-300" : "text-orange-600"
            )}
          >
            Kim uchun
          </p>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-4xl">
            Har bir xodimga — o'z ish stoli
          </h2>
          <p
            className={cn(
              "mt-3 text-sm sm:text-base",
              night ? "text-zinc-400" : "text-zinc-600"
            )}
          >
            Rollar va ruxsatnomalar tizimi tufayli har kim faqat o'ziga
            keraklisini ko'radi — ortiqcha narsa chalg'itmaydi.
          </p>
        </div>
        <div className="mt-10 grid gap-3.5 sm:mt-12 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
          {ROLES.map((r, i) => (
            <div
              key={r.title}
              className={cn(
                "landing-reveal rounded-2xl p-5 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl",
                cardCls,
                night ? "hover:shadow-black/40" : "hover:shadow-orange-900/10"
              )}
              style={{ transitionDelay: `${(i % 4) * 80}ms` }}
            >
              <span
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-xl",
                  night ? "bg-amber-400/10 text-amber-300" : "bg-orange-500/10 text-orange-600"
                )}
              >
                <r.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-lg font-bold">{r.title}</h3>
              <ul className="mt-3 space-y-2">
                {r.points.map((p) => (
                  <li
                    key={p}
                    className={cn(
                      "flex items-start gap-2 text-sm leading-snug",
                      night ? "text-zinc-400" : "text-zinc-600"
                    )}
                  >
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-500" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ================= RAQAMLAR ================= */}
      <section id="stats" className="relative z-10 mx-auto max-w-6xl px-4 py-16 sm:px-5 sm:py-24">
        <div
          className={cn(
            "landing-reveal grid gap-6 rounded-3xl p-7 sm:grid-cols-2 sm:gap-4 sm:p-10 lg:grid-cols-4",
            cardCls,
            night ? "border-amber-400/20" : "border-orange-500/25"
          )}
        >
          {[
            { to: 15, suffix: "+", label: "Tayyor modul" },
            { to: 2, suffix: " son.", label: "Hujjatni o'qish tezligi" },
            { to: 100, suffix: "%", label: "Mobil moslashuv" },
            { to: 24, suffix: "/7", label: "Doim ishlaydi" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p
                className={cn(
                  "text-3xl font-extrabold sm:text-5xl",
                  night ? "text-amber-300" : "text-orange-600"
                )}
              >
                <CountUp to={s.to} suffix={s.suffix} />
              </p>
              <p
                className={cn(
                  "mt-1.5 text-sm",
                  night ? "text-zinc-400" : "text-zinc-600"
                )}
              >
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ================= AVVAL → ENDI ================= */}
      <section
        className={cn(
          "relative z-10 border-t transition-colors duration-700",
          night ? "border-white/5 bg-white/[0.02]" : "border-orange-900/10 bg-white/40"
        )}
      >
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-5 sm:py-24">
          <div className="landing-reveal mx-auto max-w-2xl text-center">
            <p
              className={cn(
                "text-xs font-bold uppercase tracking-[0.25em]",
                night ? "text-amber-300" : "text-orange-600"
              )}
            >
              Nima o'zgaradi
            </p>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-4xl">
              Qog'oz daftardan — jonli tizimga
            </h2>
          </div>
          <div className="mt-10 space-y-3 sm:mt-12">
            {COMPARE.map((row, i) => (
              <div
                key={i}
                className={cn(
                  "landing-reveal grid overflow-hidden rounded-2xl sm:grid-cols-2",
                  cardCls
                )}
                style={{ transitionDelay: `${i * 70}ms` }}
              >
                <div
                  className={cn(
                    "flex items-start gap-2.5 p-4",
                    night ? "bg-white/[0.02]" : "bg-zinc-900/[0.03]"
                  )}
                >
                  <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-red-500/15">
                    <X className="h-3 w-3 text-red-500" />
                  </span>
                  <p
                    className={cn(
                      "text-sm leading-snug line-through decoration-red-500/40",
                      night ? "text-zinc-500" : "text-zinc-500"
                    )}
                  >
                    {row.old}
                  </p>
                </div>
                <div className="flex items-start gap-2.5 p-4">
                  <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
                    <Check className="h-3 w-3 text-emerald-500" />
                  </span>
                  <p className="text-sm font-medium leading-snug">{row.now}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Xavfsizlik kafolatlari */}
          <div className="landing-reveal mt-10 flex flex-wrap justify-center gap-2 sm:mt-12 sm:gap-2.5">
            {SECURITY.map((s) => (
              <span
                key={s.label}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-medium sm:text-sm",
                  night
                    ? "border-white/10 bg-white/5 text-zinc-300"
                    : "border-orange-900/10 bg-white/80 text-zinc-600"
                )}
              >
                <s.icon className="h-4 w-4 text-emerald-500" />
                {s.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ================= VA YANA (qo'shimcha qulayliklar) ================= */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 py-16 sm:px-5 sm:py-24">
        <div className="landing-reveal mx-auto max-w-2xl text-center">
          <p
            className={cn(
              "text-xs font-bold uppercase tracking-[0.25em]",
              night ? "text-amber-300" : "text-orange-600"
            )}
          >
            Va yana
          </p>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-4xl">
            Mayda-chuydasigacha o'ylangan qulayliklar
          </h2>
        </div>
        <div className="mt-10 grid gap-2.5 sm:mt-12 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
          {EXTRAS.map((e, i) => (
            <div
              key={e}
              className={cn(
                "landing-reveal flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium transition-transform duration-300 hover:scale-[1.03]",
                cardCls
              )}
              style={{ transitionDelay: `${(i % 4) * 50}ms` }}
            >
              <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-500" />
              {e}
            </div>
          ))}
        </div>
      </section>

      {/* ================= DOIMIY RIVOJLANISH ================= */}
      <section
        className={cn(
          "relative z-10 border-t transition-colors duration-700",
          night ? "border-white/5 bg-white/[0.02]" : "border-orange-900/10 bg-white/40"
        )}
      >
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-5 sm:py-24 lg:grid-cols-[1fr_1.4fr] lg:gap-14">
          <div className="landing-reveal">
            <p
              className={cn(
                "text-xs font-bold uppercase tracking-[0.25em]",
                night ? "text-amber-300" : "text-orange-600"
              )}
            >
              Doimiy rivojlanish
            </p>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-4xl">
              Tizim har hafta yangilanib boradi
            </h2>
            <p
              className={cn(
                "mt-4 text-sm leading-relaxed sm:text-base",
                night ? "text-zinc-400" : "text-zinc-600"
              )}
            >
              GoHotel — tirik mahsulot: takliflaringiz tez orada tizimda paydo
              bo'ladi. Yangilanishlar avtomatik yetib boradi — hech narsani
              qo'lda o'rnatish shart emas. Mana so'nggi qo'shilganlaridan
              ba'zilari:
            </p>
            <div
              className={cn(
                "mt-6 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold",
                night
                  ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                  : "border-emerald-600/20 bg-emerald-500/10 text-emerald-700"
              )}
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Yangilanishlar avtomatik — PWA o'zi yangilanadi
            </div>
          </div>
          {/* Vertikal xronologiya */}
          <div className="relative">
            <span
              className={cn(
                "absolute bottom-2 left-[9px] top-2 w-px",
                night ? "bg-white/10" : "bg-orange-900/15"
              )}
            />
            <div className="space-y-6">
              {TIMELINE.map((t, i) => (
                <div
                  key={t.title}
                  className="landing-reveal relative pl-9"
                  style={{ transitionDelay: `${i * 90}ms` }}
                >
                  <span
                    className={cn(
                      "absolute left-0 top-1 flex h-[19px] w-[19px] items-center justify-center rounded-full border-2",
                      night
                        ? "border-amber-300 bg-zinc-950"
                        : "border-orange-500 bg-[#fdf6e3]"
                    )}
                  >
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full",
                        night ? "bg-amber-300" : "bg-orange-500"
                      )}
                    />
                  </span>
                  <h3 className="font-bold">{t.title}</h3>
                  <p
                    className={cn(
                      "mt-1 text-sm leading-relaxed",
                      night ? "text-zinc-400" : "text-zinc-600"
                    )}
                  >
                    {t.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ================= FAQ ================= */}
      <section id="faq" className="relative z-10 mx-auto max-w-5xl px-4 py-16 sm:px-5 sm:py-24">
        <div className="landing-reveal mx-auto max-w-2xl text-center">
          <p
            className={cn(
              "text-xs font-bold uppercase tracking-[0.25em]",
              night ? "text-amber-300" : "text-orange-600"
            )}
          >
            Savol-javob
          </p>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-4xl">
            Ko'p so'raladigan savollar
          </h2>
        </div>
        <div className="mt-10 gap-3 space-y-3 sm:mt-12 lg:columns-2 lg:space-y-0 [&>div]:lg:mb-3 [&>div]:lg:break-inside-avoid">
          {FAQ.map((f, i) => {
            const open = faqOpen === i
            return (
              <div
                key={i}
                className={cn("landing-reveal overflow-hidden rounded-2xl", cardCls)}
                style={{ transitionDelay: `${i * 50}ms` }}
              >
                <button
                  type="button"
                  onClick={() => setFaqOpen(open ? null : i)}
                  className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
                >
                  <span className="text-sm font-bold sm:text-base">{f.q}</span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 flex-shrink-0 transition-transform duration-300",
                      open && "rotate-180",
                      night ? "text-amber-300" : "text-orange-600"
                    )}
                  />
                </button>
                <div
                  className="grid transition-[grid-template-rows] duration-300 ease-out"
                  style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
                >
                  <div className="overflow-hidden">
                    <p
                      className={cn(
                        "px-5 pb-4 text-sm leading-relaxed",
                        night ? "text-zinc-400" : "text-zinc-600"
                      )}
                    >
                      {f.a}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ================= CTA — keng yakuniy panel ================= */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 pb-16 sm:px-5 sm:pb-24">
        <div
          className={cn(
            "landing-reveal grid items-center gap-8 rounded-3xl p-8 sm:p-12 lg:grid-cols-[1.4fr_1fr]",
            cardCls,
            night ? "border-amber-400/20" : "border-orange-500/25"
          )}
        >
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight sm:text-4xl">
              Mehmonxonangizni{" "}
              <span className={night ? "text-amber-300" : "text-orange-600"}>
                bugundan
              </span>{" "}
              zamonaviy boshqaring
            </h2>
            <p
              className={cn(
                "mt-4 max-w-xl text-sm sm:text-base",
                night ? "text-zinc-400" : "text-zinc-600"
              )}
            >
              Qog'oz daftarlar va tarqoq jadvallar o'rniga — bitta tezkor tizim.
              Kirish bir daqiqa ham olmaydi.
            </p>
            <ul className="mt-5 space-y-2">
              {[
                "Hech narsa o'rnatilmaydi — brauzerda ochiladi",
                "Xodimlar yarim soatda o'rganib oladi",
                "Ma'lumotlaringiz xavfsiz bulut serverda",
              ].map((t) => (
                <li
                  key={t}
                  className={cn(
                    "flex items-center gap-2 text-sm",
                    night ? "text-zinc-300" : "text-zinc-700"
                  )}
                >
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-500" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col items-center gap-3 lg:items-end">
            <Link
              to="/login"
              className={cn(
                "group inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-bold shadow-xl transition-all hover:scale-[1.03] active:scale-95 sm:px-9",
                night
                  ? "bg-amber-400 text-zinc-900 shadow-amber-400/25 hover:bg-amber-300"
                  : "bg-orange-600 text-white shadow-orange-600/25 hover:bg-orange-500"
              )}
            >
              Hoziroq boshlash
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <p className={cn("text-xs", night ? "text-zinc-500" : "text-zinc-500")}>
              Yuz bilan yoki login-parol orqali kirish
            </p>
          </div>
        </div>
      </section>

      {/* ================= FOOTER — to'laqonli ================= */}
      <footer
        className={cn(
          "relative z-10 border-t transition-colors duration-700",
          night ? "border-white/5 bg-white/[0.02]" : "border-orange-900/10 bg-white/40"
        )}
      >
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 sm:px-5 sm:py-12 lg:grid-cols-4">
          <div>
            <span className="flex items-center gap-2.5">
              <span
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-xl",
                  night ? "bg-amber-400" : "bg-orange-500"
                )}
              >
                <Building2
                  className={cn("h-4.5 w-4.5", night ? "text-zinc-900" : "text-white")}
                />
              </span>
              <span className="text-lg font-bold">GoHotel</span>
            </span>
            <p
              className={cn(
                "mt-3 max-w-xs text-sm leading-relaxed",
                night ? "text-zinc-400" : "text-zinc-600"
              )}
            >
              Mehmonxona, hostel va soatlik ijara uchun zamonaviy boshqaruv
              tizimi — bron qilishdan hisobotgacha.
            </p>
          </div>
          <div>
            <p
              className={cn(
                "text-xs font-bold uppercase tracking-wider",
                night ? "text-zinc-300" : "text-zinc-700"
              )}
            >
              Sahifa
            </p>
            <ul
              className={cn(
                "mt-3 space-y-2 text-sm",
                night ? "text-zinc-400" : "text-zinc-600"
              )}
            >
              {[
                ["#features", "Imkoniyatlar"],
                ["#how", "Qanday ishlaydi"],
                ["#stats", "Raqamlar"],
                ["#faq", "Savol-javob"],
              ].map(([href, label]) => (
                <li key={href}>
                  <a
                    href={href}
                    className={cn(
                      "transition-colors",
                      night ? "hover:text-white" : "hover:text-zinc-900"
                    )}
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p
              className={cn(
                "text-xs font-bold uppercase tracking-wider",
                night ? "text-zinc-300" : "text-zinc-700"
              )}
            >
              Modullar
            </p>
            <ul
              className={cn(
                "mt-3 space-y-2 text-sm",
                night ? "text-zinc-400" : "text-zinc-600"
              )}
            >
              <li>Bandlov doskasi va bronlar</li>
              <li>Kassa, smenalar va moliya</li>
              <li>Ombor va mini-do'kon</li>
              <li>Xo'jalik ishlari va hisobotlar</li>
            </ul>
          </div>
          <div>
            <p
              className={cn(
                "text-xs font-bold uppercase tracking-wider",
                night ? "text-zinc-300" : "text-zinc-700"
              )}
            >
              Boshlash
            </p>
            <ul
              className={cn(
                "mt-3 space-y-2 text-sm",
                night ? "text-zinc-400" : "text-zinc-600"
              )}
            >
              <li>
                <Link
                  to="/login"
                  className={cn(
                    "font-semibold transition-colors",
                    night
                      ? "text-amber-300 hover:text-amber-200"
                      : "text-orange-600 hover:text-orange-500"
                  )}
                >
                  Tizimga kirish →
                </Link>
              </li>
              <li>Telefonga PWA sifatida o'rnatish mumkin</li>
              <li>Yuz bilan kirishni sozlash ilova ichida</li>
            </ul>
          </div>
        </div>
        <div
          className={cn(
            "border-t transition-colors duration-700",
            night ? "border-white/5" : "border-orange-900/10"
          )}
        >
          <div
            className={cn(
              "mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-xs sm:px-5 sm:text-sm",
              "text-zinc-500"
            )}
          >
            <span>© {new Date().getFullYear()} GoHotel — mehmonxona boshqaruv tizimi</span>
            <span className="flex items-center gap-1.5">
              O'zbekistonda ishlab chiqilgan
              <span className={night ? "text-amber-300" : "text-orange-500"}>♥</span>
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}
