import { useEffect, useMemo, useRef, useState, createContext, useContext } from "react";
import { motion, AnimatePresence } from "framer-motion";

// -----------------------------
// Utility: classnames
// -----------------------------
function cn(...args: (string | false | null | undefined)[]) {
  return args.filter(Boolean).join(" ");
}

// -----------------------------
// Types
// -----------------------------
type Role = "admin" | "manager" | "employee" | null;

type User = {
  id: string;
  name: string;
  email: string;
  role: Exclude<Role, null>;
  managerId?: string | null;
  createdAt: string;
};

type Company = {
  name: string;
  baseCurrency: CurrencyCode;
  country: string;
};

type CurrencyCode = "USD" | "EUR" | "GBP" | "INR" | "JPY" | "CAD" | "AUD";

const CURRENCIES: CurrencyCode[] = ["USD", "EUR", "GBP", "INR", "JPY", "CAD", "AUD"];

type Category = "Travel" | "Food" | "Office" | "Software" | "Other";

type ExpenseStatus = "draft" | "waiting_approval" | "approved" | "rejected";

type ApprovalDecision = "approved" | "rejected" | "pending";

type ApprovalItem = {
  approverId: string;
  decision: ApprovalDecision;
  comment?: string;
  at?: string;
};

type Expense = {
  id: string;
  ownerId: string;
  employeeName: string;
  title: string;
  description?: string;
  category: Category;
  date: string; // ISO
  amount: number;
  currency: CurrencyCode;
  convertedAmount: number; // to base currency
  receiptUrl?: string;
  status: ExpenseStatus;
  approvals: ApprovalItem[];
  history: { at: string; by: string; action: string; note?: string }[];
  createdAt: string;
};

type ApprovalRule = {
  id: string;
  name: string;
  sequence: string[]; // userIds in order
  minApprovalPct: number; // 0-100
  managerIsApprover: boolean;
  appliesTo: "all" | "category";
  category?: Category;
};

type Toast = { id: string; title: string; description?: string; type?: "success" | "error" | "info" };

// -----------------------------
// Mock exchange rates
// -----------------------------
const EXCHANGE: Record<CurrencyCode, number> = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.27,
  INR: 0.012,
  JPY: 0.0067,
  CAD: 0.74,
  AUD: 0.66,
};

function toBase(amount: number, currency: CurrencyCode) {
  const rate = EXCHANGE[currency];
  return Math.round(amount * rate * 100) / 100;
}

function formatCurrency(amount: number, code: CurrencyCode) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: code }).format(amount);
}

// -----------------------------
// Seed data
// -----------------------------
const seedCompany: Company = { name: "Acme Corp", baseCurrency: "USD", country: "United States" };

const seedUsers: User[] = [
  { id: "u1", name: "Ava Patel", email: "admin@acme.test", role: "admin", createdAt: new Date().toISOString() },
  { id: "u2", name: "Noah Kim", email: "manager@acme.test", role: "manager", createdAt: new Date().toISOString() },
  { id: "u3", name: "Maya Singh", email: "employee@acme.test", role: "employee", managerId: "u2", createdAt: new Date().toISOString() },
  { id: "u4", name: "Lucas Brooks", email: "lucas@acme.test", role: "employee", managerId: "u2", createdAt: new Date().toISOString() },
];

const seedRules: ApprovalRule[] = [
  { id: "r1", name: "Default Flow", sequence: ["u2"], minApprovalPct: 100, managerIsApprover: true, appliesTo: "all" },
];

function seedExpenses(users: User[]): Expense[] {
  const maya = users.find((u) => u.name.includes("Maya"))!;
  const lucas = users.find((u) => u.name.includes("Lucas"))!;
  return [
    {
      id: "e1",
      ownerId: maya.id,
      employeeName: maya.name,
      title: "Flight to NYC",
      description: "Client visit",
      category: "Travel",
      date: new Date(Date.now() - 86400000 * 3).toISOString(),
      amount: 420,
      currency: "USD",
      convertedAmount: toBase(420, "USD"),
      receiptUrl: "https://images.unsplash.com/photo-1505765050516-f72dcac9c60e?q=80&w=1200&auto=format",
      status: "waiting_approval",
      approvals: [{ approverId: "u2", decision: "pending" }],
      history: [{ at: new Date().toISOString(), by: maya.name, action: "Submitted" }],
      createdAt: new Date().toISOString(),
    },
    {
      id: "e2",
      ownerId: lucas.id,
      employeeName: lucas.name,
      title: "Team lunch",
      description: "Sprint celebration",
      category: "Food",
      date: new Date(Date.now() - 86400000 * 6).toISOString(),
      amount: 120,
      currency: "EUR",
      convertedAmount: toBase(120, "EUR"),
      receiptUrl: "https://images.unsplash.com/photo-1499028344343-cd173ffc68a9?q=80&w=1200&auto=format",
      status: "approved",
      approvals: [{ approverId: "u2", decision: "approved", at: new Date().toISOString(), comment: "Looks good" }],
      history: [
        { at: new Date().toISOString(), by: lucas.name, action: "Submitted" },
        { at: new Date().toISOString(), by: "Noah Kim", action: "Approved", note: "Within policy" },
      ],
      createdAt: new Date().toISOString(),
    },
    {
      id: "e3",
      ownerId: maya.id,
      employeeName: maya.name,
      title: "Design software license",
      description: "Figma seat",
      category: "Software",
      date: new Date().toISOString(),
      amount: 8000,
      currency: "INR",
      convertedAmount: toBase(8000, "INR"),
      receiptUrl: "https://images.unsplash.com/photo-1517430816045-d437b9c1a08b?q=80&w=1200&auto=format",
      status: "rejected",
      approvals: [{ approverId: "u2", decision: "rejected", at: new Date().toISOString(), comment: "Need annual plan" }],
      history: [
        { at: new Date().toISOString(), by: maya.name, action: "Submitted" },
        { at: new Date().toISOString(), by: "Noah Kim", action: "Rejected", note: "Please switch to annual" },
      ],
      createdAt: new Date().toISOString(),
    },
  ];
}

// -----------------------------
// Store (lightweight)
// -----------------------------
type StoreState = {
  authUserId: string | null;
  company: Company;
  users: User[];
  expenses: Expense[];
  rules: ApprovalRule[];
  toasts: Toast[];
};

const StoreContext = createContext<{
  state: StoreState;
  setAuthUserId: (id: string | null) => void;
  addToast: (t: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
  createUser: (u: Omit<User, "id" | "createdAt">) => void;
  updateUser: (id: string, patch: Partial<User>) => void;
  createExpense: (e: Omit<Expense, "id" | "createdAt" | "history" | "convertedAmount">) => string;
  updateExpense: (id: string, patch: Partial<Expense>) => void;
  approveExpense: (id: string, approverId: string, comment?: string) => void;
  rejectExpense: (id: string, approverId: string, comment?: string) => void;
  updateRule: (id: string, patch: Partial<ApprovalRule>) => void;
  updateCompany: (patch: Partial<Company>) => void;
} | null>(null);

function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("Store missing");
  return ctx;
}

  function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<StoreState>(() => {
    const company = seedCompany;
    const users = seedUsers;
    return {
      authUserId: null,
      company,
      users,
      expenses: seedExpenses(users),
      rules: seedRules,
      toasts: [],
    };
  });

  function setAuthUserId(id: string | null) {
    setState((s) => ({ ...s, authUserId: id }));
  }

  function addToast(t: Omit<Toast, "id">) {
    const id = Math.random().toString(36).slice(2);
    setState((s) => ({ ...s, toasts: [...s.toasts, { id, ...t }] }));
    setTimeout(() => removeToast(id), 2400);
  }

  function removeToast(id: string) {
    setState((s) => ({ ...s, toasts: s.toasts.filter((t) => t.id !== id) }));
  }

  function createUser(u: Omit<User, "id" | "createdAt">) {
    setState((s) => {
      const id = "u" + (s.users.length + 1 + Math.floor(Math.random() * 1000));
      const nu: User = { id, createdAt: new Date().toISOString(), ...u };
      return { ...s, users: [nu, ...s.users] };
    });
  }

  function updateUser(id: string, patch: Partial<User>) {
    setState((s) => ({ ...s, users: s.users.map((u) => (u.id === id ? { ...u, ...patch } : u)) }));
  }

  function createExpense(e: Omit<Expense, "id" | "createdAt" | "history" | "convertedAmount">) {
    let newId = "";
    setState((s) => {
      const id = "e" + (s.expenses.length + 1 + Math.floor(Math.random() * 1000));
      newId = id;
      const convertedAmount = toBase(e.amount, e.currency);
      const ne: Expense = {
        id,
        createdAt: new Date().toISOString(),
        history: [{ at: new Date().toISOString(), by: e.employeeName, action: "Submitted" }],
        convertedAmount,
        ...e,
      };
      return { ...s, expenses: [ne, ...s.expenses] };
    });
    return newId;
  }

  function updateExpense(id: string, patch: Partial<Expense>) {
    setState((s) => ({ ...s, expenses: s.expenses.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
  }

  function approveExpense(id: string, approverId: string, comment?: string) {
    setState((s) => {
      const expenses = s.expenses.map((e) => {
        if (e.id !== id) return e;
        const approvals = e.approvals.map((a) => (a.approverId === approverId ? { ...a, decision: "approved" as const, comment, at: new Date().toISOString() } : a));
        const history = [...e.history, { at: new Date().toISOString(), by: s.users.find((u) => u.id === approverId)?.name ?? "Approver", action: "Approved", note: comment }];
        return { ...e, approvals, status: "approved" as ExpenseStatus, history };
      });
      return { ...s, expenses };
    });
  }

  function rejectExpense(id: string, approverId: string, comment?: string) {
    setState((s) => {
      const expenses = s.expenses.map((e) => {
        if (e.id !== id) return e;
        const approvals = e.approvals.map((a) => (a.approverId === approverId ? { ...a, decision: "rejected" as const, comment, at: new Date().toISOString() } : a));
        const history = [...e.history, { at: new Date().toISOString(), by: s.users.find((u) => u.id === approverId)?.name ?? "Approver", action: "Rejected", note: comment }];
        return { ...e, approvals, status: "rejected" as ExpenseStatus, history };
      });
      return { ...s, expenses };
    });
  }

  function updateRule(id: string, patch: Partial<ApprovalRule>) {
    setState((s) => ({ ...s, rules: s.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
  }

  function updateCompany(patch: Partial<Company>) {
    setState((s) => ({ ...s, company: { ...s.company, ...patch } }));
  }

  const value = { state, setAuthUserId, addToast, removeToast, createUser, updateUser, createExpense, updateExpense, approveExpense, rejectExpense, updateRule, updateCompany };
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

// -----------------------------
// Router (hash-based, no deps)
// -----------------------------
type Route = { path: string; component: React.ComponentType<any> };

function useHashRoute(routes: Route[]) {
  const [hash, setHash] = useState(() => window.location.hash || "#/");
  useEffect(() => {
    const onHash = () => setHash(window.location.hash || "#/");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const match = useMemo(() => {
    const [rawPath] = hash.slice(1).split("?");
    const segments = rawPath.split("/").filter(Boolean);

    for (const r of routes) {
      const parts = r.path.split("/").filter(Boolean);
      if (parts.length !== segments.length && !r.path.includes(":")) continue;
      const params: Record<string, string> = {};
      let ok = true;
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        const s = segments[i];
        if (!s && !p.startsWith(":")) {
          ok = false;
          break;
        }
        if (p.startsWith(":")) params[p.slice(1)] = decodeURIComponent(s || "");
        else if (p !== s) {
          ok = false;
          break;
        }
      }
      if (ok) return { component: r.component, params } as { component: React.ComponentType<any>; params: Record<string, string> };
    }

    // catch-all
    const home = routes.find((r) => r.path === "/");
    return { component: home?.component ?? routes[0].component, params: {} };
  }, [hash, routes]);

  function navigate(to: string) {
    if (!to.startsWith("#")) window.location.hash = "#" + to;
    else window.location.hash = to;
  }

  return { ...match, navigate };
}

// -----------------------------
// UI primitives
// -----------------------------
function ToastHost() {
  const { state, removeToast } = useStore();
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[360px] max-w-[90vw] flex-col gap-2">
      <AnimatePresence>
        {state.toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={cn("pointer-events-auto rounded-2xl border bg-white/90 p-4 shadow-lg backdrop-blur dark:bg-zinc-900/90", "border-zinc-200 dark:border-zinc-800")}
          >
            <div className="flex items-start gap-3">
              <div className={cn("mt-0.5 h-2.5 w-2.5 rounded-full", t.type === "error" ? "bg-rose-500" : t.type === "success" ? "bg-emerald-500" : "bg-sky-500")} />
              <div className="flex-1">
                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{t.title}</div>
                {t.description && <div className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">{t.description}</div>}
              </div>
              <button className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200" onClick={() => removeToast(t.id)} aria-label="Close">
                ✕
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function Modal({
  open,
  onClose,
  title,
  children,
  width = "max-w-xl",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: string;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-40 bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
          >
            <div className={cn("w-full rounded-3xl bg-white p-6 shadow-2xl dark:bg-zinc-900", width)}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold">{title}</h3>
                <button onClick={onClose} className="rounded-xl p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                  ✕
                </button>
              </div>
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function Drawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-40 bg-black/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside
            className="fixed right-0 top-0 z-50 h-full w-full max-w-md overflow-y-auto bg-white shadow-2xl dark:bg-zinc-900"
            initial={{ x: 420 }}
            animate={{ x: 0 }}
            exit={{ x: 420 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-zinc-200 bg-white/90 p-5 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90">
              <h3 className="text-lg font-semibold">{title}</h3>
              <button onClick={onClose} className="rounded-xl p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                ✕
              </button>
            </div>
            <div className="p-5">{children}</div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="grid place-items-center rounded-3xl border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
      <div className="mb-3 text-4xl">🫧</div>
      <div className="text-base font-semibold">{title}</div>
      {description && <div className="mt-1 max-w-md text-sm text-zinc-600 dark:text-zinc-400">{description}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function RoleBadge({ role }: { role: Role }) {
  const map: Record<string, string> = {
    admin: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300",
    manager: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300",
    employee: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  };
  return <span className={cn("rounded-xl px-2.5 py-1 text-xs font-medium", role ? map[role] : "bg-zinc-100 text-zinc-700")}>{role ?? "guest"}</span>;
}

function StatusBadge({ status }: { status: ExpenseStatus }) {
  const map: Record<ExpenseStatus, string> = {
    draft: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    waiting_approval: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200",
    approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200",
    rejected: "bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200",
  };
  const label: Record<ExpenseStatus, string> = {
    draft: "Draft",
    waiting_approval: "Waiting Approval",
    approved: "Approved",
    rejected: "Rejected",
  };
  return <span className={cn("rounded-xl px-2.5 py-1 text-xs font-medium", map[status])}>{label[status]}</span>;
}

function CurrencyBadge({ original, converted, base }: { original: { amount: number; code: CurrencyCode }; converted: number; base: CurrencyCode }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-2xl bg-zinc-100 px-3 py-1.5 text-xs dark:bg-zinc-800">
      <span className="font-medium">{formatCurrency(original.amount, original.code)}</span>
      <span className="text-zinc-400">→</span>
      <span className="font-semibold">{formatCurrency(converted, base)}</span>
    </div>
  );
}

function Topbar({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="sticky top-0 z-30 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-2xl bg-gradient-to-br from-sky-600 to-indigo-600 text-white shadow-md">₿</div>
          <div>
            <div className="text-[11px] uppercase tracking-widest text-zinc-500">ExpenseFlow</div>
            <div className="text-base font-semibold">{title}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">{right}</div>
      </div>
    </div>
  );
}

function Sidebar({
  items,
  footer,
}: {
  items: { label: string; icon: string; to: string; active?: boolean }[];
  footer?: React.ReactNode;
}) {
  return (
    <aside className="sticky top-0 flex h-screen w-[260px] shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex h-16 items-center gap-3 border-b border-zinc-200 px-5 dark:border-zinc-800">
        <div className="grid h-9 w-9 place-items-center rounded-2xl bg-gradient-to-br from-sky-600 to-indigo-600 text-white shadow-md">₿</div>
        <div className="text-sm font-semibold">ExpenseFlow</div>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {items.map((it) => (
          <a
            key={it.to}
            href={`#${it.to}`}
            className={cn(
              "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition",
              it.active ? "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200" : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
            )}
          >
            <span className="text-lg">{it.icon}</span>
            <span className="font-medium">{it.label}</span>
          </a>
        ))}
      </nav>
      <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">{footer}</div>
    </aside>
  );
}

function StatusTabs({ value, onChange }: { value: ExpenseStatus | "all" | "to_submit"; onChange: (v: any) => void }) {
  const tabs: { key: any; label: string }[] = [
    { key: "to_submit", label: "To Submit" },
    { key: "waiting_approval", label: "Waiting Approval" },
    { key: "approved", label: "Approved" },
    { key: "rejected", label: "Rejected" },
    { key: "all", label: "All" },
  ];
  return (
    <div className="inline-flex rounded-2xl bg-zinc-100 p-1 dark:bg-zinc-800">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            "rounded-xl px-3 py-1.5 text-sm font-medium transition",
            value === t.key ? "bg-white shadow-sm text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100" : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// -----------------------------
// Receipt uploader + OCR mock
// -----------------------------
function ReceiptUploader({
  onResult,
}: {
  onResult: (data: { fileUrl: string; fields: Partial<Pick<Expense, "amount" | "date" | "currency" | "title" | "description" | "category">> }) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  function handleFile(f: File) {
    const fileUrl = URL.createObjectURL(f);
    setPreview(fileUrl);
    setScanning(true);
    // Mock OCR after 1.2s
    setTimeout(() => {
      setScanning(false);
      const categories: Category[] = ["Travel", "Food", "Office", "Software", "Other"];
      const cat = categories[Math.floor(Math.random() * categories.length)];
      const amounts = [42.5, 89.99, 120, 320, 15.75];
      const amount = amounts[Math.floor(Math.random() * amounts.length)];
      const currencies: CurrencyCode[] = ["USD", "EUR", "GBP", "INR"];
      const currency = currencies[Math.floor(Math.random() * currencies.length)];
      const titles = ["Lunch with client", "Flight ticket", "SaaS subscription", "Office supplies"];
      const title = titles[Math.floor(Math.random() * titles.length)];
      onResult({
        fileUrl,
        fields: {
          title,
          description: "Auto-filled from receipt",
          category: cat,
          amount,
          currency,
          date: new Date().toISOString(),
        },
      });
    }, 1200);
  }

  return (
    <div className="space-y-3">
      <div
        onClick={() => inputRef.current?.click()}
        className="group grid cursor-pointer place-items-center rounded-3xl border-2 border-dashed border-zinc-300 bg-zinc-50/60 p-8 text-center transition hover:border-sky-400 hover:bg-sky-50/40 dark:border-zinc-700 dark:bg-zinc-900/50"
      >
        <div className="text-4xl">🧾</div>
        <div className="mt-2 text-sm font-medium">Drop or click to upload receipt</div>
        <div className="text-xs text-zinc-500">PNG, JPG up to 5MB</div>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files && handleFile(e.target.files[0])} />
      </div>
      {preview && (
        <div className="relative overflow-hidden rounded-3xl">
          <img src={preview} alt="Receipt preview" className="h-48 w-full object-cover" />
          <AnimatePresence>
            {scanning && (
              <motion.div className="absolute inset-0 grid place-items-center bg-black/40 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="flex items-center gap-3 rounded-2xl bg-white/90 px-4 py-2 text-sm font-medium text-zinc-900 shadow-lg dark:bg-zinc-900/90 dark:text-zinc-100">
                  <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-sky-500" />
                  Scanning receipt with OCR…
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function OCRPreview({ data }: { data: Partial<Expense> | null }) {
  if (!data) return null;
  return (
    <div className="rounded-3xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="mb-2 text-sm font-semibold">OCR Preview</div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-zinc-500">Title</div>
          <div className="font-medium">{data.title ?? "—"}</div>
        </div>
        <div>
          <div className="text-zinc-500">Category</div>
          <div className="font-medium">{data.category ?? "—"}</div>
        </div>
        <div>
          <div className="text-zinc-500">Date</div>
          <div className="font-medium">{data.date ? new Date(data.date).toLocaleDateString() : "—"}</div>
        </div>
        <div>
          <div className="text-zinc-500">Amount</div>
          <div className="font-medium">{data.amount && data.currency ? formatCurrency(data.amount, data.currency) : "—"}</div>
        </div>
      </div>
      <div className="mt-2 text-xs text-zinc-500">You can edit any field before submitting.</div>
    </div>
  );
}

// -----------------------------
// Cards
// -----------------------------
function ExpenseCard({ e, onOpen, compact }: { e: Expense; onOpen?: () => void; compact?: boolean }) {
  return (
    <motion.div layout className="group relative overflow-hidden rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex gap-4">
        <div className="h-20 w-28 overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-800">
          {e.receiptUrl && <img src={e.receiptUrl} className="h-full w-full object-cover transition group-hover:scale-105" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="truncate text-base font-semibold">{e.title}</div>
              <div className="line-clamp-1 text-sm text-zinc-600 dark:text-zinc-400">{e.description}</div>
            </div>
            <StatusBadge status={e.status} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-xl bg-zinc-100 px-2 py-1 dark:bg-zinc-800">{e.category}</span>
            <span className="rounded-xl bg-zinc-100 px-2 py-1 dark:bg-zinc-800">{new Date(e.date).toLocaleDateString()}</span>
            <CurrencyBadge original={{ amount: e.amount, code: e.currency }} converted={e.convertedAmount} base="USD" />
          </div>
          {!compact && (
            <div className="mt-3 flex items-center justify-between">
              <div className="text-sm text-zinc-600 dark:text-zinc-400">Owner: {e.employeeName}</div>
              <button onClick={onOpen} className="rounded-xl bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200">
                View
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function ApprovalCard({
  e,
  onApprove,
  onReject,
  onOpen,
  disabled,
}: {
  e: Expense;
  onApprove: () => void;
  onReject: () => void;
  onOpen?: () => void;
  disabled?: boolean;
}) {
  const pending = e.approvals.some((a) => a.decision === "pending");
  return (
    <motion.div layout className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start gap-4">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-800">
          {e.receiptUrl && <img src={e.receiptUrl} className="h-full w-full object-cover" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-semibold">{e.title}</div>
              <div className="text-sm text-zinc-600 dark:text-zinc-400">
                {e.employeeName} • {new Date(e.date).toLocaleDateString()}
              </div>
            </div>
            <StatusBadge status={e.status} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-xl bg-zinc-100 px-2 py-1 dark:bg-zinc-800">{e.category}</span>
            <CurrencyBadge original={{ amount: e.amount, code: e.currency }} converted={e.convertedAmount} base="USD" />
          </div>
          <div className="mt-3 flex items-center gap-2">
            {!disabled && pending && e.status === "waiting_approval" ? (
              <>
                <button onClick={onApprove} className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500">
                  Approve
                </button>
                <button onClick={onReject} className="rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-500">
                  Reject
                </button>
              </>
            ) : (
              <div className="text-xs text-zinc-500">No actions available</div>
            )}
            <button onClick={onOpen} className="ml-auto rounded-xl bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200">
              Open
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// -----------------------------
// Layouts
// -----------------------------
function PublicLayout({ children, title, subtitle }: { children: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-white to-sky-50 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-900">
      <div className="mx-auto grid min-h-screen w-full max-w-6xl grid-cols-1 gap-0 md:grid-cols-[420px_1fr]">
        <div className="relative hidden overflow-hidden border-r border-zinc-200 bg-white p-10 dark:border-zinc-800 dark:bg-zinc-950 md:block">
          <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-sky-500/10 blur-2xl" />
          <div className="absolute -bottom-16 -left-16 h-72 w-72 rounded-full bg-indigo-500/10 blur-2xl" />
          <div className="relative z-10">
            <div className="mb-10 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-sky-600 to-indigo-600 text-white shadow-md">₿</div>
              <div className="text-lg font-semibold">ExpenseFlow</div>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
            <p className="mt-2 max-w-sm text-sm text-zinc-600 dark:text-zinc-400">{subtitle}</p>
            <div className="mt-10 space-y-4 text-sm">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300">✓</div>
                Role-based access with clean separation
              </div>
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300">✓</div>
                OCR receipt scanning and currency conversion
              </div>
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300">✓</div>
                Approval rules with sequenced approvers
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center p-6">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </div>
    </div>
  );
}

function AuthCard({ children, title, subtitle }: { children: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function RoleShell({
  role,
  children,
  activePath,
  title,
}: {
  role: Role;
  children: React.ReactNode;
  activePath: string;
  title: string;
}) {
  const { state, setAuthUserId } = useStore();
  const me = state.users.find((u) => u.id === state.authUserId) || null;

  const adminItems = [
    { label: "Dashboard", icon: "📊", to: "/admin/dashboard", active: activePath.startsWith("/admin/dashboard") },
    { label: "Users", icon: "👥", to: "/admin/users", active: activePath.startsWith("/admin/users") },
    { label: "Approval Rules", icon: "🧩", to: "/admin/approval-rules", active: activePath.startsWith("/admin/approval-rules") },
    { label: "Approvers", icon: "🧑‍⚖️", to: "/admin/approvers", active: activePath.startsWith("/admin/approvers") },
    { label: "Expenses", icon: "🧾", to: "/admin/expenses", active: activePath.startsWith("/admin/expenses") },
    { label: "Settings", icon: "⚙️", to: "/admin/settings", active: activePath.startsWith("/admin/settings") },
  ];
  const managerItems = [
    { label: "Dashboard", icon: "📊", to: "/manager/dashboard", active: activePath.startsWith("/manager/dashboard") },
    { label: "Approvals", icon: "📝", to: "/manager/approvals", active: activePath.startsWith("/manager/approvals") },
  ];
  const employeeItems = [
    { label: "Dashboard", icon: "📊", to: "/employee/dashboard", active: activePath.startsWith("/employee/dashboard") },
    { label: "Submit", icon: "➕", to: "/employee/submit-expense", active: activePath.startsWith("/employee/submit-expense") },
    { label: "My Expenses", icon: "🧾", to: "/employee/my-expenses", active: activePath.startsWith("/employee/my-expenses") },
  ];

  const items = role === "admin" ? adminItems : role === "manager" ? managerItems : employeeItems;

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Sidebar
        items={items}
        footer={
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-2xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900">{me?.name?.[0] ?? "?"}</div>
              <div>
                <div className="text-sm font-semibold leading-4">{me?.name ?? "Guest"}</div>
                <div className="text-xs text-zinc-500">{me?.email}</div>
              </div>
            </div>
            <button
              onClick={() => {
                setAuthUserId(null);
                window.location.hash = "#/signin";
              }}
              className="rounded-xl bg-zinc-100 px-3 py-1.5 text-xs font-medium dark:bg-zinc-800"
            >
              Sign out
            </button>
          </div>
        }
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          title={title}
          right={
            <div className="flex items-center gap-2">
              <RoleBadge role={role} />
              <div className="hidden text-sm text-zinc-600 dark:text-zinc-400 md:block">{state.company.name}</div>
            </div>
          }
        />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
      </div>
    </div>
  );
}

// -----------------------------
// Approver sequence editor
// -----------------------------
function ApproverSequenceEditor({ value, users, onChange }: { value: string[]; users: User[]; onChange: (v: string[]) => void }) {
  const pool = users.filter((u) => u.role !== "employee" || u.id);
  function add(id: string) {
    if (!value.includes(id)) onChange([...value, id]);
  }
  function remove(id: string) {
    onChange(value.filter((v) => v !== id));
  }
  function move(idx: number, dir: -1 | 1) {
    const arr = [...value];
    const ni = idx + dir;
    if (ni < 0 || ni >= arr.length) return;
    const tmp = arr[idx];
    arr[idx] = arr[ni];
    arr[ni] = tmp;
    onChange(arr);
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {value.map((id, idx) => {
          const u = users.find((x) => x.id === id);
          return (
            <div key={id} className="flex items-center gap-2 rounded-2xl bg-zinc-100 px-3 py-2 dark:bg-zinc-800">
              <span className="text-xs text-zinc-500">#{idx + 1}</span>
              <span className="text-sm font-medium">{u?.name ?? id}</span>
              <div className="flex items-center gap-1">
                <button className="rounded-lg px-2 py-1 text-xs hover:bg-zinc-200 dark:hover:bg-zinc-700" onClick={() => move(idx, -1)}>
                  ↑
                </button>
                <button className="rounded-lg px-2 py-1 text-xs hover:bg-zinc-200 dark:hover:bg-zinc-700" onClick={() => move(idx, 1)}>
                  ↓
                </button>
                <button className="rounded-lg px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10" onClick={() => remove(id)}>
                  ✕
                </button>
              </div>
            </div>
          );
        })}
        {value.length === 0 && <div className="text-sm text-zinc-500">No approvers yet. Add from the list below.</div>}
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        {pool.map((u) => (
          <button
            key={u.id}
            onClick={() => add(u.id)}
            className="flex items-center justify-between rounded-2xl border border-zinc-200 px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
          >
            <div>
              <div className="font-medium">{u.name}</div>
              <div className="text-xs text-zinc-500">{u.role}</div>
            </div>
            <div className="text-sky-600">＋</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// -----------------------------
// Rule builder
// -----------------------------
function RuleBuilder({ rule, users, onSave }: { rule: ApprovalRule; users: User[]; onSave: (r: ApprovalRule) => void }) {
  const [draft, setDraft] = useState<ApprovalRule>(rule);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">Rule name</div>
          <input className="w-full rounded-2xl border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </div>
        <div>
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">Applies to</div>
          <select
            className="w-full rounded-2xl border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            value={draft.appliesTo}
            onChange={(e) => setDraft({ ...draft, appliesTo: e.target.value as any })}
          >
            <option value="all">All categories</option>
            <option value="category">Specific category</option>
          </select>
        </div>
        {draft.appliesTo === "category" && (
          <div>
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">Category</div>
            <select
              className="w-full rounded-2xl border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
              value={draft.category ?? "Travel"}
              onChange={(e) => setDraft({ ...draft, category: e.target.value as Category })}
            >
              {["Travel", "Food", "Office", "Software", "Other"].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">Minimum approval %</div>
          <input
            type="number"
            min={0}
            max={100}
            className="w-full rounded-2xl border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            value={draft.minApprovalPct}
            onChange={(e) => setDraft({ ...draft, minApprovalPct: Number(e.target.value) })}
          />
        </div>
        <div className="flex items-center gap-3">
          <input id="mgr" type="checkbox" checked={draft.managerIsApprover} onChange={(e) => setDraft({ ...draft, managerIsApprover: e.target.checked })} />
          <label htmlFor="mgr" className="text-sm">
            Manager is approver
          </label>
        </div>
      </div>
      <div>
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">Approver sequence</div>
        <ApproverSequenceEditor value={draft.sequence} users={users} onChange={(v) => setDraft({ ...draft, sequence: v })} />
      </div>
      <div className="flex justify-end gap-2">
        <button className="rounded-2xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900" onClick={() => onSave(draft)}>
          Save rule
        </button>
      </div>
    </div>
  );
}

// -----------------------------
// Pages — Public
// -----------------------------
type ThemeMode = "light" | "dark";

type Feature = {
  title: string;
  description: string;
  icon: React.ReactNode;
};

type Testimonial = {
  quote: string;
  name: string;
  role: string;
};



function useStickyHeader() {
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return stuck;
}

function Section({ id, children, className }: { id?: string; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} className={cn("relative px-4 py-20 sm:px-6 lg:px-8 lg:py-28", className)}>
      {children}
    </section>
  );
}

function Reveal({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5, ease: "easeOut", delay }}
    >
      {children}
    </motion.div>
  );
}

function LogoMark() {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[1.8]">
          <path d="M4 16.5V7.5L12 3l8 4.5v9L12 21l-8-4.5Z" />
          <path d="M9 9h6a2 2 0 1 1 0 4H9h7a2 2 0 1 1 0 4H9" />
          <path d="M12 7v10" />
        </svg>
      </div>
      <div>
        <div className="text-xl font-semibold tracking-tight text-slate-950 dark:text-white">AeroFinance</div>
        <div className="text-xs text-slate-500 dark:text-slate-400">Smart Reimbursements. Seamless Approvals.</div>
      </div>
    </div>
  );
}

function IconShell({ children }: { children: React.ReactNode }) {
  return <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-blue-700 ring-1 ring-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/20">{children}</div>;
}

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <div className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-600 dark:text-blue-400">{eyebrow}</div>
      <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl dark:text-white">{title}</h2>
      <p className="mt-4 text-base leading-7 text-slate-600 dark:text-slate-300">{description}</p>
    </div>
  );
}

function FeatureCard({ feature }: { feature: Feature }) {
  return (
    <motion.div whileHover={{ y: -6, scale: 1.01 }} transition={{ duration: 0.2 }} className="group h-full rounded-3xl border border-slate-200/80 bg-white/80 p-6 shadow-[0_18px_60px_-40px_rgba(15,23,42,0.35)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/75">
      <div className="flex items-start gap-4">
        <div className="transition-transform duration-300 group-hover:scale-105">{feature.icon}</div>
        <div>
          <h3 className="text-lg font-semibold text-slate-950 dark:text-white">{feature.title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{feature.description}</p>
        </div>
      </div>
    </motion.div>
  );
}

function RoleCard({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  return (
    <motion.div whileHover={{ y: -6 }} transition={{ duration: 0.2 }} className={cn("rounded-3xl border bg-white/80 p-6 backdrop-blur-xl dark:bg-slate-900/75", tone)}>
      <div className="text-lg font-semibold text-slate-950 dark:text-white">{title}</div>
      <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-3">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

function MockDashboard() {
  const approvals = [
    { name: "Nina Patel", amount: "$328.40", status: "Pending" },
    { name: "Jordan Lee", amount: "$84.12", status: "Approved" },
    { name: "Olivia Chen", amount: "$1,246.00", status: "Review" },
  ];

  return (
    <motion.div
      className="relative mx-auto w-full max-w-[560px] rounded-[32px] border border-white/20 bg-white/15 p-4 shadow-[0_25px_100px_-35px_rgba(37,99,235,0.55)] backdrop-blur-2xl"
      animate={{ y: [0, -6, 0] }}
      transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
    >
      <div className="rounded-[28px] border border-white/20 bg-slate-950/85 p-5 text-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-sky-300/80">Live approvals</div>
            <div className="mt-1 text-lg font-semibold">Workflow Overview</div>
          </div>
          <div className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-300">+12% faster</div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-[1.25fr_0.75fr]">
          <div className="rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
            <div className="flex items-center justify-between text-sm text-slate-300">
              <span>Monthly reimbursements</span>
              <span>$48.2k</span>
            </div>
            <div className="mt-5 flex h-36 items-end gap-2">
              {[42, 58, 35, 78, 64, 92, 84].map((h, i) => (
                <motion.div
                  key={i}
                  className="flex-1 rounded-t-2xl bg-gradient-to-t from-blue-500 via-sky-400 to-cyan-300 shadow-[0_0_30px_rgba(56,189,248,0.2)]"
                  initial={{ height: 0 }}
                  animate={{ height: `${h}%` }}
                  transition={{ duration: 0.7, delay: i * 0.05 }}
                />
              ))}
            </div>
          </div>
          <div className="space-y-3 rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
            {approvals.map((item, index) => (
              <motion.div
                key={item.name}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.1 + index * 0.08 }}
                className="rounded-2xl border border-white/10 bg-slate-900/75 p-3"
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-white">{item.name}</span>
                  <span className="text-slate-300">{item.amount}</span>
                </div>
                <div className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-400">{item.status}</div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            ["OCR", "Scanning receipt"],
            ["FX", "Converted to USD"],
            ["Rules", "2-step approval"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
              <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">{label}</div>
              <div className="mt-1 text-sm font-medium text-white">{value}</div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function WorkflowTimeline() {
  const steps = [
    { title: "Employee", description: "Submit receipt, amount, and category in seconds.", tone: "from-blue-500 to-sky-500" },
    { title: "Manager", description: "Review policy, receipts, and converted amounts.", tone: "from-cyan-500 to-blue-500" },
    { title: "Finance", description: "Validate rules and ensure clean records.", tone: "from-indigo-500 to-blue-500" },
    { title: "Approved", description: "Push the expense to payroll or reimbursement.", tone: "from-emerald-500 to-green-500" },
  ];

  return (
    <div className="relative mx-auto max-w-6xl">
      <div className="absolute left-4 right-4 top-12 h-px bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400 opacity-60 sm:left-8 sm:right-8" />
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {steps.map((step, index) => (
          <Reveal key={step.title} className="relative">
            <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-6 shadow-[0_18px_60px_-40px_rgba(15,23,42,0.35)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/75">
              <div className="flex items-center gap-3">
                <div className={cn("grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-lg", step.tone)}>{index + 1}</div>
                <div className="text-lg font-semibold text-slate-950 dark:text-white">{step.title}</div>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">{step.description}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  );
}

function TrustCard({ testimonial }: { testimonial: Testimonial }) {
  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-6 backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/75">
      <p className="text-sm leading-7 text-slate-700 dark:text-slate-200">{testimonial.quote}</p>
      <div className="mt-5 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 text-sm font-semibold text-white">{testimonial.name[0]}</div>
        <div>
          <div className="text-sm font-semibold text-slate-950 dark:text-white">{testimonial.name}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{testimonial.role}</div>
        </div>
      </div>
    </div>
  );
}

function Navbar({ theme, toggleTheme }: { theme: ThemeMode; toggleTheme: () => void }) {
  const stuck = useStickyHeader();
  const [open, setOpen] = useState(false);

  const links = [
    ["Features", "#features"],
    ["Workflow", "#workflow"],
    ["Pricing", "#pricing"],
    ["Contact", "#contact"],
  ] as const;

  return (
    <motion.header
      className={cn(
        "sticky top-0 z-50 border-b transition-colors",
        stuck ? "border-slate-200/70 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/75" : "border-transparent bg-transparent"
      )}
      initial={{ y: -18, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.45 }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <a href="#top" className="shrink-0">
          <LogoMark />
        </a>

        <nav className="hidden items-center gap-8 text-sm text-slate-600 dark:text-slate-300 md:flex">
          {links.map(([label, href]) => (
            <a key={label} href={href} className="transition hover:text-slate-950 dark:hover:text-white">
              {label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <button
            onClick={toggleTheme}
            className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-slate-900/80 dark:text-slate-200"
          >
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
          <motion.a whileTap={{ scale: 0.97 }} href="#/signin" className="rounded-2xl px-4 py-2 text-sm font-medium text-slate-700 transition hover:text-slate-950 dark:text-slate-200 dark:hover:text-white">
            Login
          </motion.a>
          <motion.a whileTap={{ scale: 0.97 }} href="#/signup" className="rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:-translate-y-0.5 hover:bg-blue-500 hover:shadow-blue-600/35">
            Get Started
          </motion.a>
        </div>

        <button
          className="rounded-2xl border border-slate-200 bg-white/80 p-3 text-slate-700 dark:border-white/10 dark:bg-slate-900/80 dark:text-slate-200 md:hidden"
          onClick={() => setOpen((current) => !current)}
          aria-label="Toggle navigation"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[1.8]">
            <path d={open ? "M6 6l12 12M18 6L6 18" : "M4 7h16M4 12h16M4 17h16"} strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="border-t border-slate-200 bg-white px-4 py-4 dark:border-white/10 dark:bg-slate-950 md:hidden"
          >
            <div className="space-y-3">
              {links.map(([label, href]) => (
                <a key={label} href={href} onClick={() => setOpen(false)} className="block rounded-2xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/5">
                  {label}
                </a>
              ))}
              <button onClick={toggleTheme} className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-left text-sm font-medium text-slate-700 dark:border-white/10 dark:text-slate-200">
                {theme === "dark" ? "Light mode" : "Dark mode"}
              </button>
              <a href="#/signin" onClick={() => setOpen(false)} className="block rounded-2xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/5">
                Login
              </a>
              <a href="#/signup" onClick={() => setOpen(false)} className="block rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white">
                Get Started
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-slate-200/80 bg-white/70 px-4 py-10 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/70 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <LogoMark />
        <div className="flex flex-wrap gap-5 text-sm text-slate-600 dark:text-slate-300">
          <a href="#features">Features</a>
          <a href="#workflow">Workflow</a>
          <a href="#pricing">Pricing</a>
          <a href="#/signup">Contact</a>
        </div>
        <div className="text-sm text-slate-500 dark:text-slate-400">Copyright {new Date().getFullYear()} AeroFinance</div>
      </div>
    </footer>
  );
}

const features: Feature[] = [
  {
    title: "Smart Expense Tracking",
    description: "Capture expenses, classify them automatically, and keep every reimbursement traceable from the first submission.",
    icon: (
      <IconShell>
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[1.8]">
          <path d="M5 7h14M5 12h9M5 17h6" strokeLinecap="round" />
          <path d="M17 15l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </IconShell>
    ),
  },
  {
    title: "OCR Receipt Scanning",
    description: "Turn receipts into structured data with automated extraction of amount, vendor, date, and category fields.",
    icon: (
      <IconShell>
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[1.8]">
          <path d="M4 4h7l9 9v7H4z" />
          <path d="M9 9h3" strokeLinecap="round" />
        </svg>
      </IconShell>
    ),
  },
  {
    title: "Multi-Level Approval Workflow",
    description: "Route expenses through the right approvers with configurable sequences, percentages, and manager involvement.",
    icon: (
      <IconShell>
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[1.8]">
          <path d="M7 7h10v10H7z" />
          <path d="M12 3v4M12 17v4M3 12h4M17 12h4" strokeLinecap="round" />
        </svg>
      </IconShell>
    ),
  },
  {
    title: "Real-Time Status Updates",
    description: "Employees, managers, and admins stay aligned with instant state changes and clear visibility into progress.",
    icon: (
      <IconShell>
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[1.8]">
          <path d="M12 3v18" strokeLinecap="round" />
          <path d="M6 8l6-5 6 5" strokeLinejoin="round" />
        </svg>
      </IconShell>
    ),
  },
  {
    title: "Currency Conversion",
    description: "Accept any local currency and normalize everything into your company base currency for consistent review.",
    icon: (
      <IconShell>
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[1.8]">
          <path d="M7 7h10M7 17h10M9 7c0 2.2 1.8 4 4 4s4 1.8 4 4-1.8 4-4 4-4-1.8-4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </IconShell>
    ),
  },
  {
    title: "Role-Based Access",
    description: "Keep employee, manager, and admin experiences separated so every team member sees only what matters.",
    icon: (
      <IconShell>
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[1.8]">
          <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" />
          <path d="M5 20a7 7 0 0 1 14 0" strokeLinecap="round" />
        </svg>
      </IconShell>
    ),
  },
];

const testimonials: Testimonial[] = [
  {
    quote: "AeroFinance makes reimbursement flow feel immediate and polished. Our team finally has one clean place to submit, review, and approve.",
    name: "Mina Rodriguez",
    role: "Finance Ops, Northstar",
  },
  {
    quote: "The product feels premium from the first screen. OCR, approvals, and currency handling are all easy to understand at a glance.",
    name: "Ethan Brooks",
    role: "Head of Operations, Nova Labs",
  },
  {
    quote: "It looks like a real fintech tool, not a demo. The workflow is simple, visual, and scalable for growing teams.",
    name: "Sara Ahmed",
    role: "COO, Meridian Studio",
  },
];

function HomePage() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "light";
    const stored = window.localStorage.getItem("aerofinance-theme");
    if (stored === "dark" || stored === "light") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem("aerofinance-theme", theme);
  }, [theme]);

  useEffect(() => {
    document.title = "AeroFinance - Smart Reimbursements. Seamless Approvals.";
  }, []);

  const toggleTheme = () => setTheme((current) => (current === "dark" ? "light" : "dark"));

  const previewStats = useMemo(
    () => [
      ["Approved", "124"],
      ["Pending", "18"],
      ["OCR accuracy", "98.4%"],
      ["FX coverage", "7 currencies"],
    ],
    []
  );

  return (
    <div id="top" className="relative min-h-screen overflow-hidden bg-gradient-to-b from-sky-50 via-white to-white text-slate-900 dark:from-slate-950 dark:via-slate-950 dark:to-slate-950 dark:text-white">
      <div className="pointer-events-none absolute inset-0 opacity-70 dark:opacity-100">
        <div className="absolute left-[-8rem] top-[-6rem] h-80 w-80 rounded-full bg-blue-400/20 blur-3xl motion-safe:animate-[pulse_12s_ease-in-out_infinite] dark:bg-blue-600/20" />
        <div className="absolute right-[-5rem] top-[14rem] h-72 w-72 rounded-full bg-cyan-300/25 blur-3xl motion-safe:animate-[pulse_14s_ease-in-out_infinite] dark:bg-cyan-500/15" />
        <div className="absolute bottom-[-8rem] left-[35%] h-96 w-96 rounded-full bg-indigo-300/20 blur-3xl motion-safe:animate-[pulse_16s_ease-in-out_infinite] dark:bg-indigo-500/15" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.08),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.08),transparent_28%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.18),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.16),transparent_28%)]" />
        <div className="absolute inset-0 opacity-[0.16] [background-image:linear-gradient(rgba(15,23,42,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.08)_1px,transparent_1px)] [background-size:72px_72px] dark:opacity-[0.18] dark:[background-image:linear-gradient(rgba(255,255,255,0.09)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.09)_1px,transparent_1px)]" />
      </div>

      <Navbar theme={theme} toggleTheme={toggleTheme} />

      <main className="relative">
        <Section className="pt-14 lg:pt-20">
          <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[0.95fr_1.05fr] lg:gap-12">
            <Reveal>
              <div className="max-w-2xl">
                <div className="inline-flex items-center rounded-full border border-blue-200 bg-white/80 px-4 py-2 text-xs font-medium text-blue-700 shadow-sm backdrop-blur dark:border-blue-500/20 dark:bg-white/5 dark:text-blue-300">
                  Premium reimbursement automation for modern teams
                </div>
                <h1 className="mt-7 text-5xl font-semibold tracking-tight text-slate-950 sm:text-6xl lg:text-7xl dark:text-white">
                  Automate Your Reimbursements with Intelligence
                </h1>
                <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600 dark:text-slate-300">
                  From submission to approval, AeroFinance simplifies every step of your financial workflow with OCR, currency conversion, and role-based approvals.
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <motion.a whileTap={{ scale: 0.97 }} href="#/signup" className="rounded-2xl bg-blue-600 px-6 py-3.5 text-center text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:-translate-y-0.5 hover:bg-blue-500 hover:shadow-blue-600/35">
                    Get Started
                  </motion.a>
                  <motion.a whileTap={{ scale: 0.97 }} href="#workflow" className="rounded-2xl border border-slate-200 bg-white/80 px-6 py-3.5 text-center text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:border-white/20">
                    Watch Demo
                  </motion.a>
                </div>

                <div className="mt-8 flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                  <div className="flex -space-x-2">
                    {["A", "N", "S"].map((initial) => (
                      <div key={initial} className="grid h-9 w-9 place-items-center rounded-full border border-white bg-slate-900 text-xs font-semibold text-white shadow-sm dark:border-slate-950">
                        {initial}
                      </div>
                    ))}
                  </div>
                  Trusted by finance teams that value speed and clarity.
                </div>
              </div>
            </Reveal>

            <Reveal className="relative">
              <div className="absolute -left-8 top-10 h-28 w-28 rounded-full bg-blue-500/20 blur-2xl" />
              <div className="absolute -right-8 bottom-0 h-36 w-36 rounded-full bg-cyan-400/20 blur-2xl" />
              <MockDashboard />
            </Reveal>
          </div>
        </Section>

        <Section id="features">
          <SectionHeading
            eyebrow="Features"
            title="Everything a premium reimbursement platform needs"
            description="AeroFinance combines clarity, automation, and visual polish so each role gets a focused experience without clutter."
          />
          <div className="mx-auto mt-12 grid max-w-7xl gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {features.map((feature, index) => (
              <Reveal key={feature.title} className="h-full" delay={index * 0.05}>
                <FeatureCard feature={feature} />
              </Reveal>
            ))}
          </div>
        </Section>

        <Section id="workflow" className="bg-white/40 dark:bg-white/[0.02]">
          <SectionHeading
            eyebrow="Workflow"
            title="A simple flow that makes approvals feel effortless"
            description="Employee submits, manager reviews, finance validates, and the expense reaches approved status with full transparency."
          />
          <div className="mt-12">
            <WorkflowTimeline />
          </div>
        </Section>

        <Section>
          <SectionHeading
            eyebrow="Role-Based"
            title="Focused experiences for every user type"
            description="Each role gets exactly the tools it needs, which keeps the interface clear and the workflow easy to understand."
          />
          <div className="mx-auto mt-12 grid max-w-7xl gap-4 lg:grid-cols-3">
            <RoleCard title="Employee" tone="border-blue-200/80 dark:border-blue-500/20" items={["Submit expenses quickly", "Upload receipts and use OCR", "Track approval status in one place"]} />
            <RoleCard title="Manager" tone="border-cyan-200/80 dark:border-cyan-500/20" items={["Approve or reject requests", "View converted amounts clearly", "Add comments for context"]} />
            <RoleCard title="Admin" tone="border-emerald-200/80 dark:border-emerald-500/20" items={["Manage users and roles", "Configure approval rules", "Control company settings and thresholds"]} />
          </div>
        </Section>

        <Section className="bg-white/40 dark:bg-white/[0.02]">
          <SectionHeading
            eyebrow="Live Preview"
            title="A polished interface that feels real"
            description="Glass panels, subtle motion, and clean hierarchy create a premium product preview without visual noise."
          />
          <div className="mx-auto mt-12 grid max-w-7xl gap-4 lg:grid-cols-3">
            <Reveal>
              <div className="rounded-[28px] border border-slate-200/80 bg-white/75 p-5 shadow-[0_18px_60px_-40px_rgba(15,23,42,0.35)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/70">
                <div className="text-sm font-semibold text-slate-900 dark:text-white">Expense form</div>
                <div className="mt-4 space-y-3">
                  <div className="h-11 rounded-2xl bg-slate-100 dark:bg-slate-800" />
                  <div className="h-11 rounded-2xl bg-slate-100 dark:bg-slate-800" />
                  <div className="h-24 rounded-2xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 ring-1 ring-blue-100 dark:from-blue-500/10 dark:to-cyan-500/10 dark:ring-white/10" />
                </div>
              </div>
            </Reveal>
            <Reveal delay={0.06}>
              <div className="rounded-[28px] border border-slate-200/80 bg-white/75 p-5 shadow-[0_18px_60px_-40px_rgba(15,23,42,0.35)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/70">
                <div className="text-sm font-semibold text-slate-900 dark:text-white">Approval cards</div>
                <div className="mt-4 space-y-3">
                  {[1, 2, 3].map((item) => (
                    <div key={item} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
                      <div className="flex items-center justify-between text-sm font-medium">
                        <span>Receipt {item}</span>
                        <span className="text-emerald-500">Pending</span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                        <div className="h-2 w-[68%] rounded-full bg-gradient-to-r from-blue-500 to-cyan-400" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
            <Reveal delay={0.12}>
              <div className="rounded-[28px] border border-slate-200/80 bg-white/75 p-5 shadow-[0_18px_60px_-40px_rgba(15,23,42,0.35)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/70">
                <div className="text-sm font-semibold text-slate-900 dark:text-white">Dashboard stats</div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {previewStats.map(([label, value]) => (
                    <div key={label} className="rounded-2xl bg-slate-100 p-4 dark:bg-slate-800">
                      <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">{label}</div>
                      <div className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </Section>

        <Section>
          <SectionHeading
            eyebrow="Trusted"
            title="Used by teams that want speed without losing control"
            description="Modern teams need a product that feels reliable, structured, and easy to adopt."
          />
          <div className="mx-auto mt-12 grid max-w-7xl gap-4 lg:grid-cols-3">
            {testimonials.map((testimonial, index) => (
              <Reveal key={testimonial.name} className="h-full" delay={index * 0.06}>
                <TrustCard testimonial={testimonial} />
              </Reveal>
            ))}
          </div>
        </Section>

        <Section id="pricing" className="bg-white/40 dark:bg-white/[0.02]">
          <div className="mx-auto grid max-w-7xl gap-6 rounded-[36px] border border-slate-200/80 bg-white/80 p-8 shadow-[0_18px_70px_-48px_rgba(15,23,42,0.45)] backdrop-blur-xl lg:grid-cols-[1.1fr_0.9fr] lg:p-12 dark:border-white/10 dark:bg-slate-900/75">
            <Reveal>
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-600 dark:text-blue-400">CTA</div>
                <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">Start Managing Expenses Smarter Today</h2>
                <p className="mt-4 max-w-xl text-base leading-7 text-slate-600 dark:text-slate-300">Give your team a premium workflow for reimbursements, approvals, and reporting with AeroFinance.</p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <motion.a whileTap={{ scale: 0.97 }} href="#/signup" className="rounded-2xl bg-blue-600 px-6 py-3.5 text-center text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:-translate-y-0.5 hover:bg-blue-500">
                    Get Started
                  </motion.a>
                  <button onClick={toggleTheme} className="rounded-2xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-semibold text-slate-700 dark:border-white/10 dark:bg-slate-950 dark:text-slate-200">
                    Switch to {theme === "dark" ? "light" : "dark"} mode
                  </button>
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.06}>
              <div className="rounded-[28px] bg-slate-950 p-6 text-white shadow-2xl">
                <div className="text-sm uppercase tracking-[0.22em] text-slate-400">Live readout</div>
                <div className="mt-4 space-y-4">
                  {[
                    ["OCR extraction", "Receipt fields automatically detected"],
                    ["Currency flow", "Original and converted values shown"],
                    ["Approvals", "Buttons disappear after action"],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="text-sm font-semibold">{label}</div>
                      <div className="mt-1 text-sm text-slate-300">{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </Section>

        <Section id="contact">
          <div className="mx-auto max-w-3xl text-center">
            <div className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-600 dark:text-blue-400">Contact</div>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">Ready to launch your finance workflow?</h2>
            <p className="mt-4 text-base leading-7 text-slate-600 dark:text-slate-300">Use AeroFinance to present a polished reimbursement experience from day one.</p>
            <div id="login" className="mt-8 grid gap-3 rounded-[28px] border border-slate-200/80 bg-white/80 p-6 text-left shadow-[0_18px_60px_-40px_rgba(15,23,42,0.35)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/75 sm:grid-cols-2">
              <input className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-0 placeholder:text-slate-400 dark:border-white/10 dark:bg-slate-950 dark:text-white" placeholder="Work email" />
              <input className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-0 placeholder:text-slate-400 dark:border-white/10 dark:bg-slate-950 dark:text-white" placeholder="Company name" />
              <textarea className="min-h-28 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-0 placeholder:text-slate-400 sm:col-span-2 dark:border-white/10 dark:bg-slate-950 dark:text-white" placeholder="Tell us about your workflow" />
              <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:justify-end">
                <a href="#/signin" className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 dark:border-white/10 dark:text-slate-200">Login</a>
                <a href="#/signup" className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-500">Get Started</a>
              </div>
            </div>
          </div>
        </Section>
      </main>

      <Footer />
    </div>
  );
}

function AboutPage() {
  return (
    <PublicLayout title="About ExpenseFlow" subtitle="Built for finance teams that need speed and control.">
      <div className="prose prose-zinc max-w-none dark:prose-invert">
        <p>ExpenseFlow separates employee, manager, and admin experiences into dedicated layouts and pages. Each role sees only what it needs.</p>
        <ul>
          <li>Employees submit receipts, OCR auto-fills fields, and track approvals.</li>
          <li>Managers get an approval queue with converted currency and quick actions.</li>
          <li>Admins configure users, managers, and approval rules with sequenced approvers.</li>
        </ul>
      </div>
    </PublicLayout>
  );
}

function SignUpPage() {
  const { createUser, setAuthUserId, addToast, state } = useStore();
  const [name, setName] = useState("Ava Patel");
  const [email, setEmail] = useState("admin@acme.test");
  const [companyName, setCompanyName] = useState("Acme Corp");
  function submit(e: React.FormEvent) {
    e.preventDefault();
    createUser({ name, email, role: "admin" });
    // simulate auto login as the first admin found
    const admin = state.users.find((u) => u.role === "admin") ?? { id: "u1" } as User;
    setAuthUserId(admin.id);
    addToast({ title: "Company created", description: `${companyName} is ready`, type: "success" });
    window.location.hash = "#/admin/dashboard";
  }
  return (
    <PublicLayout title="Create your company" subtitle="Start as Company Admin and invite your team.">
      <AuthCard title="Company Admin Sign Up" subtitle="You'll be the initial admin">
        <form onSubmit={submit} className="space-y-3">
          <div>
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">Company name</div>
            <input className="w-full rounded-2xl border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
          </div>
          <div>
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">Your name</div>
            <input className="w-full rounded-2xl border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">Work email</div>
            <input type="email" className="w-full rounded-2xl border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <button className="w-full rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-500">Create company</button>
          <div className="text-center text-xs text-zinc-500">Already have an account? <a className="underline" href="#/signin">Sign in</a></div>
        </form>
      </AuthCard>
    </PublicLayout>
  );
}

function SignInPage() {
  const { state, setAuthUserId, addToast } = useStore();
  const [email, setEmail] = useState("employee@acme.test");
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const user = state.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      addToast({ title: "No user found", description: "Try one of the demo emails", type: "error" });
      return;
    }
    setAuthUserId(user.id);
    addToast({ title: `Welcome ${user.name.split(" ")[0]}`, type: "success" });
    const dest = user.role === "admin" ? "/admin/dashboard" : user.role === "manager" ? "/manager/dashboard" : "/employee/dashboard";
    window.location.hash = "#" + dest;
  }
  return (
    <PublicLayout title="Sign in" subtitle="Use demo accounts to explore each role.">
      <AuthCard title="Sign in" subtitle="admin@acme.test • manager@acme.test • employee@acme.test">
        <form onSubmit={submit} className="space-y-3">
          <div>
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">Email</div>
            <input className="w-full rounded-2xl border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">Password</div>
            <input type="password" className="w-full rounded-2xl border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" placeholder="Anything" />
          </div>
          <button className="w-full rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-500">Continue</button>
          <div className="flex items-center justify-between text-xs">
            <a className="underline" href="#/forgot">Forgot password?</a>
            <a className="underline" href="#/signup">Create company</a>
          </div>
        </form>
      </AuthCard>
    </PublicLayout>
  );
}

function ForgotPage() {
  const { addToast } = useStore();
  const [email, setEmail] = useState("");
  function submit(e: React.FormEvent) {
    e.preventDefault();
    addToast({ title: "Reset link sent", description: "Check your inbox", type: "info" });
  }
  return (
    <PublicLayout title="Reset password" subtitle="We'll email you a link to reset your password.">
      <AuthCard title="Forgot password">
        <form onSubmit={submit} className="space-y-3">
          <input className="w-full rounded-2xl border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="w-full rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-500">Send reset link</button>
        </form>
      </AuthCard>
    </PublicLayout>
  );
}

function ResetPage() {
  const { addToast } = useStore();
  function submit(e: React.FormEvent) {
    e.preventDefault();
    addToast({ title: "Password updated", type: "success" });
    window.location.hash = "#/signin";
  }
  return (
    <PublicLayout title="Set new password" subtitle="Choose a strong password you haven't used before.">
      <AuthCard title="Reset password">
        <form onSubmit={submit} className="space-y-3">
          <input type="password" className="w-full rounded-2xl border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" placeholder="New password" />
          <input type="password" className="w-full rounded-2xl border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" placeholder="Confirm password" />
          <button className="w-full rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-500">Update password</button>
        </form>
      </AuthCard>
    </PublicLayout>
  );
}

// -----------------------------
// Pages — Employee
// -----------------------------
function EmployeeDashboard() {
  const { state } = useStore();
  const me = state.users.find((u) => u.id === state.authUserId)!;
  const myExpenses = state.expenses.filter((e) => e.ownerId === me.id);
  const waiting = myExpenses.filter((e) => e.status === "waiting_approval").length;
  const approved = myExpenses.filter((e) => e.status === "approved").length;
  const rejected = myExpenses.filter((e) => e.status === "rejected").length;
  return (
    <RoleShell role="employee" activePath="/employee/dashboard" title="Employee Dashboard">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-sm text-zinc-500">Waiting Approval</div>
          <div className="mt-1 text-3xl font-semibold">{waiting}</div>
        </div>
        <div className="rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-sm text-zinc-500">Approved</div>
          <div className="mt-1 text-3xl font-semibold">{approved}</div>
        </div>
        <div className="rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-sm text-zinc-500">Rejected</div>
          <div className="mt-1 text-3xl font-semibold">{rejected}</div>
        </div>
      </div>
      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold">Recent expenses</h3>
          <a href="#/employee/my-expenses" className="text-sm text-sky-600 hover:underline">View all</a>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {myExpenses.slice(0, 4).map((e) => (
            <ExpenseCard key={e.id} e={e} onOpen={() => (window.location.hash = `#/employee/expense/${e.id}`)} />
          ))}
          {myExpenses.length === 0 && <EmptyState title="No expenses yet" description="Create your first expense to see it here." action={<a className="rounded-2xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white" href="#/employee/submit-expense">Submit expense</a>} />}
        </div>
      </div>
    </RoleShell>
  );
}

function SubmitExpensePage() {
  const { state, createExpense, addToast } = useStore();
  const me = state.users.find((u) => u.id === state.authUserId)!;
  const [form, setForm] = useState<Partial<Expense>>({
    title: "",
    description: "",
    category: "Travel",
    date: new Date().toISOString().slice(0, 10),
    amount: 0,
    currency: state.company.baseCurrency,
  });
  const [receiptUrl, setReceiptUrl] = useState<string | undefined>(undefined);
  const [ocr, setOcr] = useState<Partial<Expense> | null>(null);

  function applyOCR(data: { fileUrl: string; fields: Partial<Expense> }) {
    setReceiptUrl(data.fileUrl);
    setOcr(data.fields);
    setForm((f) => ({ ...f, ...data.fields }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title || !form.amount) {
      addToast({ title: "Missing fields", description: "Please fill title and amount.", type: "error" });
      return;
    }
    const ownerId = me.id;
    const employeeName = me.name;
    const dateISO = new Date(form.date ?? new Date()).toISOString();
    const id = createExpense({
      ownerId,
      employeeName,
      title: form.title!,
      description: form.description,
      category: (form.category as Category) ?? "Other",
      date: dateISO,
      amount: Number(form.amount),
      currency: (form.currency as CurrencyCode) ?? state.company.baseCurrency,
      receiptUrl,
      status: "waiting_approval",
      approvals: state.rules[0].sequence.map((aid) => ({ approverId: aid, decision: "pending" })),
    });
    addToast({ title: "Expense submitted", description: "Waiting for approval", type: "success" });
    window.location.hash = `#/employee/expense/${id}`;
  }

  return (
    <RoleShell role="employee" activePath="/employee/submit-expense" title="Submit Expense">
      <form onSubmit={submit} className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <div className="rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-3 text-sm font-semibold">Receipt</div>
            <ReceiptUploader onResult={applyOCR} />
          </div>
          <div className="rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-3 text-sm font-semibold">Details</div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <div className="mb-1 text-xs text-zinc-500">Title</div>
                <input className="w-full rounded-2xl border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <div className="mb-1 text-xs text-zinc-500">Category</div>
                <select className="w-full rounded-2xl border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" value={form.category ?? "Other"} onChange={(e) => setForm({ ...form, category: e.target.value as Category })}>
                  {["Travel", "Food", "Office", "Software", "Other"].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div className="mb-1 text-xs text-zinc-500">Date</div>
                <input type="date" className="w-full rounded-2xl border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div>
                <div className="mb-1 text-xs text-zinc-500">Amount</div>
                <div className="flex gap-2">
                  <input type="number" step="0.01" className="w-full rounded-2xl border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" value={form.amount ?? 0} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
                  <select className="rounded-2xl border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" value={form.currency as any} onChange={(e) => setForm({ ...form, currency: e.target.value as CurrencyCode })}>
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="md:col-span-2">
                <div className="mb-1 text-xs text-zinc-500">Description</div>
                <textarea className="min-h-[96px] w-full rounded-2xl border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <button className="rounded-2xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white hover:bg-sky-500">Submit for approval</button>
          </div>
        </div>
        <div className="space-y-4">
          <OCRPreview data={ocr} />
          <div className="rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-2 text-sm font-semibold">Conversion preview</div>
            <div className="text-sm text-zinc-600 dark:text-zinc-400">
              Amount in base currency ({state.company.baseCurrency}) will be calculated on submission.
            </div>
            {form.amount && form.currency && (
              <div className="mt-3">
                <CurrencyBadge original={{ amount: Number(form.amount), code: form.currency as CurrencyCode }} converted={toBase(Number(form.amount), form.currency as CurrencyCode)} base={state.company.baseCurrency} />
              </div>
            )}
          </div>
        </div>
      </form>
    </RoleShell>
  );
}

function MyExpensesPage() {
  const { state } = useStore();
  const me = state.users.find((u) => u.id === state.authUserId)!;
  const myExpenses = state.expenses.filter((e) => e.ownerId === me.id);
  const [tab, setTab] = useState<ExpenseStatus | "all" | "to_submit">("all");

  const filtered = useMemo(() => {
    if (tab === "all") return myExpenses;
    if (tab === "to_submit") return myExpenses.filter((e) => e.status === "draft");
    return myExpenses.filter((e) => e.status === tab);
  }, [tab, myExpenses]);

  return (
    <RoleShell role="employee" activePath="/employee/my-expenses" title="My Expenses">
      <div className="mb-4 flex items-center justify-between">
        <StatusTabs value={tab} onChange={setTab} />
        <a href="#/employee/submit-expense" className="rounded-2xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500">
          New expense
        </a>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {filtered.map((e) => (
          <ExpenseCard key={e.id} e={e} onOpen={() => (window.location.hash = `#/employee/expense/${e.id}`)} />
        ))}
        {filtered.length === 0 && <div className="md:col-span-2"><EmptyState title="Nothing here" description="Try another filter or create an expense." /></div>}
      </div>
    </RoleShell>
  );
}

function EmployeeExpenseDetail({ params }: { params: { id: string } }) {
  const { state } = useStore();
  const e = state.expenses.find((x) => x.id === params.id);
  if (!e) return <div className="p-8">Not found</div>;
  return (
    <RoleShell role="employee" activePath="/employee/my-expenses" title="Expense Detail">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <div className="overflow-hidden rounded-3xl border border-zinc-200 dark:border-zinc-800">
            {e.receiptUrl && <img src={e.receiptUrl} className="h-72 w-full object-cover" />}
          </div>
          <div className="rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xl font-semibold">{e.title}</div>
                <div className="text-sm text-zinc-600 dark:text-zinc-400">{e.description}</div>
              </div>
              <StatusBadge status={e.status} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-xl bg-zinc-100 px-2 py-1 dark:bg-zinc-800">{e.category}</span>
              <span className="rounded-xl bg-zinc-100 px-2 py-1 dark:bg-zinc-800">{new Date(e.date).toLocaleString()}</span>
              <CurrencyBadge original={{ amount: e.amount, code: e.currency }} converted={e.convertedAmount} base="USD" />
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-2 text-sm font-semibold">Approval history</div>
            <div className="space-y-3 text-sm">
              {e.history.map((h, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="mt-1 h-2 w-2 rounded-full bg-sky-500" />
                  <div>
                    <div className="font-medium">{h.action} <span className="text-zinc-500">by {h.by}</span></div>
                    <div className="text-xs text-zinc-500">{new Date(h.at).toLocaleString()}</div>
                    {h.note && <div className="text-xs text-zinc-600 dark:text-zinc-400">“{h.note}”</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </RoleShell>
  );
}

// -----------------------------
// Pages — Manager
// -----------------------------
function ManagerDashboard() {
  const { state } = useStore();
  const queue = state.expenses.filter((e) => e.status === "waiting_approval");
  const approved = state.expenses.filter((e) => e.status === "approved").length;
  const rejected = state.expenses.filter((e) => e.status === "rejected").length;
  return (
    <RoleShell role="manager" activePath="/manager/dashboard" title="Manager Dashboard">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-sm text-zinc-500">In queue</div>
          <div className="mt-1 text-3xl font-semibold">{queue.length}</div>
        </div>
        <div className="rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-sm text-zinc-500">Approved</div>
          <div className="mt-1 text-3xl font-semibold">{approved}</div>
        </div>
        <div className="rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-sm text-zinc-500">Rejected</div>
          <div className="mt-1 text-3xl font-semibold">{rejected}</div>
        </div>
      </div>
      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold">Queue</h3>
          <a href="#/manager/approvals" className="text-sm text-sky-600 hover:underline">Open full queue</a>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {queue.slice(0, 6).map((e) => (
            <ApprovalCard key={e.id} e={e} onApprove={() => {}} onReject={() => {}} onOpen={() => (window.location.hash = `#/manager/approvals/${e.id}`)} />
          ))}
          {queue.length === 0 && <EmptyState title="No approvals" description="You're all caught up." />}
        </div>
      </div>
    </RoleShell>
  );
}

function ApprovalsPage() {
  const { state, approveExpense, rejectExpense, addToast } = useStore();
  const me = state.users.find((u) => u.id === state.authUserId)!;
  const queue = state.expenses.filter((e) => e.status === "waiting_approval" && e.approvals.some((a) => a.approverId === me.id && a.decision === "pending"));
  const [active, setActive] = useState<Expense | null>(null);
  const [comment, setComment] = useState("");

  function doApprove(e: Expense) {
    approveExpense(e.id, me.id, comment || undefined);
    addToast({ title: "Approved", type: "success" });
    setActive(null);
    setComment("");
  }
  function doReject(e: Expense) {
    rejectExpense(e.id, me.id, comment || undefined);
    addToast({ title: "Rejected", type: "error" });
    setActive(null);
    setComment("");
  }

  return (
    <RoleShell role="manager" activePath="/manager/approvals" title="Approval Queue">
      <div className="grid gap-3 md:grid-cols-2">
        {queue.map((e) => (
          <ApprovalCard key={e.id} e={e} onApprove={() => doApprove(e)} onReject={() => doReject(e)} onOpen={() => setActive(e)} />
        ))}
        {queue.length === 0 && <div className="md:col-span-2"><EmptyState title="No pending approvals" description="New requests will appear here." /></div>}
      </div>

      <Drawer open={!!active} onClose={() => setActive(null)} title={active ? active.title : ""}>
        {active && (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-3xl">{active.receiptUrl && <img src={active.receiptUrl} className="h-56 w-full object-cover" />}</div>
            <div className="text-sm">
              <div className="text-zinc-500">Employee</div>
              <div className="font-medium">{active.employeeName}</div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-xl bg-zinc-100 px-2 py-1 dark:bg-zinc-800">{active.category}</span>
              <span className="rounded-xl bg-zinc-100 px-2 py-1 dark:bg-zinc-800">{new Date(active.date).toLocaleString()}</span>
              <CurrencyBadge original={{ amount: active.amount, code: active.currency }} converted={active.convertedAmount} base="USD" />
            </div>
            <div>
              <div className="mb-1 text-xs text-zinc-500">Comment (optional)</div>
              <textarea className="min-h-[96px] w-full rounded-2xl border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" value={comment} onChange={(e) => setComment(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <button onClick={() => doApprove(active)} className="flex-1 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500">
                Approve
              </button>
              <button onClick={() => doReject(active)} className="flex-1 rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white hover:bg-rose-500">
                Reject
              </button>
            </div>
          </div>
        )}
      </Drawer>
    </RoleShell>
  );
}

function ManagerApprovalDetail({ params }: { params: { id: string } }) {
  const { state, approveExpense, rejectExpense, addToast } = useStore();
  const me = state.users.find((u) => u.id === state.authUserId)!;
  const e = state.expenses.find((x) => x.id === params.id);
  const [comment, setComment] = useState("");
  if (!e) return <div className="p-8">Not found</div>;
  const canAct = e.status === "waiting_approval" && e.approvals.some((a) => a.approverId === me.id && a.decision === "pending");
  return (
    <RoleShell role="manager" activePath="/manager/approvals" title="Approval Detail">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <div className="overflow-hidden rounded-3xl border border-zinc-200 dark:border-zinc-800">{e.receiptUrl && <img src={e.receiptUrl} className="h-80 w-full object-cover" />}</div>
          <div className="rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xl font-semibold">{e.title}</div>
                <div className="text-sm text-zinc-600 dark:text-zinc-400">{e.description}</div>
              </div>
              <StatusBadge status={e.status} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-xl bg-zinc-100 px-2 py-1 dark:bg-zinc-800">{e.category}</span>
              <span className="rounded-xl bg-zinc-100 px-2 py-1 dark:bg-zinc-800">{new Date(e.date).toLocaleString()}</span>
              <CurrencyBadge original={{ amount: e.amount, code: e.currency }} converted={e.convertedAmount} base="USD" />
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-2 text-sm font-semibold">Decision</div>
            {canAct ? (
              <>
                <textarea className="min-h-[96px] w-full rounded-2xl border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" placeholder="Add a note..." value={comment} onChange={(ev) => setComment(ev.target.value)} />
                <div className="mt-3 flex gap-2">
                  <button
                    className="flex-1 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500"
                    onClick={() => {
                      approveExpense(e.id, me.id, comment || undefined);
                      addToast({ title: "Approved", type: "success" });
                      window.location.hash = "#/manager/approvals";
                    }}
                  >
                    Approve
                  </button>
                  <button
                    className="flex-1 rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white hover:bg-rose-500"
                    onClick={() => {
                      rejectExpense(e.id, me.id, comment || undefined);
                      addToast({ title: "Rejected", type: "error" });
                      window.location.hash = "#/manager/approvals";
                    }}
                  >
                    Reject
                  </button>
                </div>
              </>
            ) : (
              <div className="text-sm text-zinc-600 dark:text-zinc-400">No actions available for this request.</div>
            )}
          </div>
          <div className="rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-2 text-sm font-semibold">Approvers</div>
            <div className="space-y-2 text-sm">
              {e.approvals.map((a, i) => {
                const u = state.users.find((us) => us.id === a.approverId);
                return (
                  <div key={i} className="flex items-center justify-between rounded-2xl bg-zinc-50 px-3 py-2 dark:bg-zinc-800/60">
                    <div>
                      <div className="font-medium">{u?.name ?? a.approverId}</div>
                      <div className="text-xs text-zinc-500">{a.decision}</div>
                    </div>
                    {a.at && <div className="text-xs text-zinc-500">{new Date(a.at).toLocaleString()}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </RoleShell>
  );
}

// -----------------------------
// Pages — Admin
// -----------------------------
function AdminDashboard() {
  const { state } = useStore();
  const total = state.expenses.length;
  const waiting = state.expenses.filter((e) => e.status === "waiting_approval").length;
  const approved = state.expenses.filter((e) => e.status === "approved").length;
  const rejected = state.expenses.filter((e) => e.status === "rejected").length;
  return (
    <RoleShell role="admin" activePath="/admin/dashboard" title="Admin Dashboard">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {[
          { label: "Total", value: total },
          { label: "Waiting", value: waiting },
          { label: "Approved", value: approved },
          { label: "Rejected", value: rejected },
        ].map((k) => (
          <div key={k.label} className="rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="text-sm text-zinc-500">{k.label}</div>
            <div className="mt-1 text-3xl font-semibold">{k.value}</div>
          </div>
        ))}
      </div>
      <div className="mt-6">
        <h3 className="mb-3 text-base font-semibold">Recent expenses</h3>
        <div className="grid gap-3 md:grid-cols-2">
          {state.expenses.slice(0, 6).map((e) => (
            <ExpenseCard key={e.id} e={e} onOpen={() => (window.location.hash = `#/admin/expenses`)} />
          ))}
        </div>
      </div>
    </RoleShell>
  );
}

function AdminUsersPage() {
  const { state, createUser, updateUser, addToast } = useStore();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Exclude<Role, null>>("employee");
  const [managerId, setManagerId] = useState<string | "">("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    createUser({ name, email, role, managerId: managerId || null });
    addToast({ title: "User created", type: "success" });
    setOpen(false);
    setName("");
    setEmail("");
    setRole("employee");
    setManagerId("");
  }

  const managers = state.users.filter((u) => u.role === "manager" || u.role === "admin");

  return (
    <RoleShell role="admin" activePath="/admin/users" title="User Management">
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm text-zinc-600 dark:text-zinc-400">Create users, assign roles, map to managers.</div>
        <button onClick={() => setOpen(true)} className="rounded-2xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500">
          New user
        </button>
      </div>
      <div className="overflow-hidden rounded-3xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-900">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Manager</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {state.users.map((u) => (
              <tr key={u.id} className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="px-4 py-3 font-medium">{u.name}</td>
                <td className="px-4 py-3">{u.email}</td>
                <td className="px-4 py-3">
                  <select
                    className="rounded-xl border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
                    value={u.role}
                    onChange={(e) => updateUser(u.id, { role: e.target.value as any })}
                  >
                    <option value="admin">admin</option>
                    <option value="manager">manager</option>
                    <option value="employee">employee</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  <select
                    className="rounded-xl border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
                    value={u.managerId ?? ""}
                    onChange={(e) => updateUser(u.id, { managerId: e.target.value || null })}
                  >
                    <option value="">—</option>
                    {managers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3 text-right">
                  <RoleBadge role={u.role} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Create user">
        <form onSubmit={submit} className="space-y-3">
          <div>
            <div className="mb-1 text-xs text-zinc-500">Name</div>
            <input className="w-full rounded-2xl border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <div className="mb-1 text-xs text-zinc-500">Email</div>
            <input className="w-full rounded-2xl border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="mb-1 text-xs text-zinc-500">Role</div>
              <select className="w-full rounded-2xl border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" value={role} onChange={(e) => setRole(e.target.value as any)}>
                <option value="employee">employee</option>
                <option value="manager">manager</option>
                <option value="admin">admin</option>
              </select>
            </div>
            <div>
              <div className="mb-1 text-xs text-zinc-500">Manager</div>
              <select className="w-full rounded-2xl border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" value={managerId} onChange={(e) => setManagerId(e.target.value)}>
                <option value="">—</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end">
            <button className="rounded-2xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500">Create</button>
          </div>
        </form>
      </Modal>
    </RoleShell>
  );
}

function AdminRulesPage() {
  const { state, updateRule, addToast } = useStore();
  const rule = state.rules[0];
  return (
    <RoleShell role="admin" activePath="/admin/approval-rules" title="Approval Rules Builder">
      <div className="rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <RuleBuilder
          rule={rule}
          users={state.users}
          onSave={(r) => {
            updateRule(r.id, r);
            addToast({ title: "Rule saved", type: "success" });
          }}
        />
      </div>
    </RoleShell>
  );
}

function AdminApproversPage() {
  const { state } = useStore();
  const approvers = state.users.filter((u) => u.role !== "employee");
  return (
    <RoleShell role="admin" activePath="/admin/approvers" title="Approvers List">
      <div className="grid gap-3 md:grid-cols-2">
        {approvers.map((u) => (
          <div key={u.id} className="flex items-center justify-between rounded-3xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900">{u.name[0]}</div>
              <div>
                <div className="font-semibold">{u.name}</div>
                <div className="text-xs text-zinc-500">{u.email}</div>
              </div>
            </div>
            <RoleBadge role={u.role} />
          </div>
        ))}
      </div>
    </RoleShell>
  );
}

function AdminExpensesPage() {
  const { state } = useStore();
  const [q, setQ] = useState("");
  const filtered = state.expenses.filter((e) => e.title.toLowerCase().includes(q.toLowerCase()) || e.employeeName.toLowerCase().includes(q.toLowerCase()));
  return (
    <RoleShell role="admin" activePath="/admin/expenses" title="All Expenses">
      <div className="mb-4 flex items-center gap-2">
        <input placeholder="Search by title or employee" className="w-full rounded-2xl border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {filtered.map((e) => (
          <ExpenseCard key={e.id} e={e} />
        ))}
        {filtered.length === 0 && <div className="md:col-span-2"><EmptyState title="No results" /></div>}
      </div>
    </RoleShell>
  );
}

function AdminSettingsPage() {
  const { state, updateCompany, addToast } = useStore();
  const [name, setName] = useState(state.company.name);
  const [base, setBase] = useState(state.company.baseCurrency);
  const [country, setCountry] = useState(state.company.country);
  function save() {
    updateCompany({ name, baseCurrency: base, country });
    addToast({ title: "Settings saved", type: "success" });
  }
  return (
    <RoleShell role="admin" activePath="/admin/settings" title="Company Settings">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-3 text-sm font-semibold">Company</div>
          <div className="space-y-3">
            <div>
              <div className="mb-1 text-xs text-zinc-500">Name</div>
              <input className="w-full rounded-2xl border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <div className="mb-1 text-xs text-zinc-500">Country</div>
              <input className="w-full rounded-2xl border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" value={country} onChange={(e) => setCountry(e.target.value)} />
            </div>
            <div>
              <div className="mb-1 text-xs text-zinc-500">Base currency</div>
              <select className="w-full rounded-2xl border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" value={base} onChange={(e) => setBase(e.target.value as CurrencyCode)}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end">
              <button onClick={save} className="rounded-2xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500">Save</button>
            </div>
          </div>
        </div>
        <div className="rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-3 text-sm font-semibold">Notes</div>
          <div className="text-sm text-zinc-600 dark:text-zinc-400">Base currency is used for manager views and approvals. Original currency is always preserved.</div>
        </div>
      </div>
    </RoleShell>
  );
}

// -----------------------------
// Router container
// -----------------------------
function Router() {
  const routes: Route[] = [
    { path: "/", component: HomePage },
    { path: "/about", component: AboutPage },
    { path: "/signup", component: SignUpPage },
    { path: "/signin", component: SignInPage },
    { path: "/forgot", component: ForgotPage },
    { path: "/reset", component: ResetPage },
    { path: "/employee/dashboard", component: EmployeeDashboard },
    { path: "/employee/submit-expense", component: SubmitExpensePage },
    { path: "/employee/my-expenses", component: MyExpensesPage },
    { path: "/employee/expense/:id", component: EmployeeExpenseDetail },
    { path: "/manager/dashboard", component: ManagerDashboard },
    { path: "/manager/approvals", component: ApprovalsPage },
    { path: "/manager/approvals/:id", component: ManagerApprovalDetail },
    { path: "/admin/dashboard", component: AdminDashboard },
    { path: "/admin/users", component: AdminUsersPage },
    { path: "/admin/approval-rules", component: AdminRulesPage },
    { path: "/admin/approvers", component: AdminApproversPage },
    { path: "/admin/expenses", component: AdminExpensesPage },
    { path: "/admin/settings", component: AdminSettingsPage },
  ];

  const { component: Cmp, params } = useHashRoute(routes);

  // Simple guard: require auth for role pages
  const { state } = useStore();
  const hash = (typeof window !== "undefined" && window.location.hash.slice(1)) || "/";
  const needsAuth = hash.startsWith("/admin") || hash.startsWith("/manager") || hash.startsWith("/employee");
  const me = state.users.find((u) => u.id === state.authUserId) || null;
  if (needsAuth && !me) {
    // redirect to signin
    setTimeout(() => (window.location.hash = "#/signin"), 0);
    return (
      <div className="grid min-h-screen place-items-center bg-zinc-50 dark:bg-zinc-950">
        <div className="text-sm text-zinc-600">Redirecting to sign in…</div>
      </div>
    );
  }

  // Role guard
  if (me) {
    if (hash.startsWith("/admin") && me.role !== "admin") {
      setTimeout(() => (window.location.hash = "#/signin"), 0);
    }
    if (hash.startsWith("/manager") && me.role !== "manager") {
      setTimeout(() => (window.location.hash = "#/signin"), 0);
    }
    if (hash.startsWith("/employee") && me.role !== "employee") {
      setTimeout(() => (window.location.hash = "#/signin"), 0);
    }
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div key={hash} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}>
        {/* @ts-ignore */}
        <Cmp params={params} />
      </motion.div>
    </AnimatePresence>
  );
}

// -----------------------------
// App
// -----------------------------
export default function App() {
  // dark mode based on system preference
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      if (mq.matches) document.documentElement.classList.add("dark");
      else document.documentElement.classList.remove("dark");
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // ensure default route
  useEffect(() => {
    if (!window.location.hash) window.location.hash = "#/";
  }, []);

  return (
    <StoreProvider>
      <div className="min-h-screen bg-white text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-100">
        <Router />
        <ToastHost />
      </div>
    </StoreProvider>
  );
}
