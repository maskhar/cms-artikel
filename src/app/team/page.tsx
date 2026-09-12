"use client";
import { useSidebar } from "@/components/sidebar-context";
import { AppSidebar } from "@/components/app-sidebar";
import { Power, ShieldCheck, Trash2, UserPlus, Users, UserPen, AlertCircle } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
type Site = { id: string; name: string }; 
type Role = { 
  id: string; 
  user_id: string;
  email: string; 
  name: string | null;
  role: "admin" | "editor" | "writer"; 
  site_id: string | null; 
  is_active: boolean; 
  user_exists?: boolean;
  sites: { name: string; domain: string }[] | null 
};

export default function TeamPage() {
  const { collapsed } = useSidebar();
  const [roles, setRoles] = useState<Role[]>([]); 
  const [sites, setSites] = useState<Site[]>([]); 
  const [message, setMessage] = useState("");
  const [selectedSiteIds, setSelectedSiteIds] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role["role"]>("writer");
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  async function load() { 
    const [roleResponse, siteResponse] = await Promise.all([
      fetch("/api/cms/team"), 
      fetch("/api/cms/sites")
    ]); 
    const roleBody = await roleResponse.json().catch(() => null); 
    const siteBody = await siteResponse.json().catch(() => null); 
    if (roleResponse.ok) setRoles(roleBody?.data ?? []); 
    else setMessage(roleBody?.error ?? "Tim tidak dapat dimuat."); 
    if (siteResponse.ok) setSites(siteBody?.data ?? []); 
  }

  useEffect(() => { 
    const timer = setTimeout(() => { void load(); }, 0); 
    return () => clearTimeout(timer); 
  }, []);

  async function assign(event: FormEvent<HTMLFormElement>) { 
    event.preventDefault(); 
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const role = String(form.get("role"));
    const response = await fetch("/api/cms/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.get("email"), role, siteIds: role === "admin" ? [] : selectedSiteIds })
    }); 
    const body = await response.json().catch(() => null); 
    setMessage(response.ok ? "Role berhasil ditambahkan." : body?.error ?? "Role gagal ditambahkan."); 
    if (response.ok) { 
      formElement.reset();
      setSelectedSiteIds([]);
      setSelectedRole("writer");
      void load(); 
    } 
  }

  async function updateRole(item: Role, role: Role["role"], siteId: string | null, isActive = item.is_active) { 
    const response = await fetch(`/api/cms/team/${item.id}`, { 
      method: "PATCH", 
      headers: { "Content-Type": "application/json" }, 
      body: JSON.stringify({ 
        role, 
        siteId: role === "admin" ? null : siteId, 
        isActive 
      }) 
    }); 
    const body = await response.json().catch(() => null); 
    setMessage(response.ok ? "Role diperbarui." : body?.error ?? "Role gagal diperbarui."); 
    if (response.ok) void load(); 
  }

  async function updateProfile(userId: string, fullName: string) {
    const response = await fetch("/api/cms/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, fullName })
    });
    const body = await response.json().catch(() => null);
    setMessage(response.ok ? "Profil diperbarui." : body?.error ?? "Profil gagal diperbarui.");
    if (response.ok) {
      setEditingUserId(null);
      void load();
    }
  }

  async function removeRole(item: Role) { 
    if (!confirm(`Hapus akses ${item.email}?`)) return; 
    const response = await fetch(`/api/cms/team/${item.id}`, { method: "DELETE" }); 
    const body = await response.json().catch(() => null); 
    setMessage(response.ok ? "Role dihapus." : body?.error ?? "Role gagal dihapus."); 
    if (response.ok) void load(); 
  }

  return <main className="min-h-screen bg-[#f5f7fb] p-3 sm:p-5 lg:p-7">
    <div className={`mx-auto grid max-w-[1800px] gap-5 ${collapsed ? "lg:grid-cols-[76px_minmax(0,1fr)]" : "lg:grid-cols-[240px_minmax(0,1fr)]"}`}>
      <AppSidebar/>
      <section className="min-w-0">
        <header className="rounded-3xl border border-slate-200/80 bg-white px-5 py-6 shadow-sm sm:px-7">
          <p className="text-sm font-semibold text-[#CE181E]">Akses</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Tim dan role</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Admin memiliki akses global. Editor dan writer ditetapkan per website.</p>
        </header>
        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
              <span className="rounded-xl bg-red-50 p-2 text-[#CE181E]">
                <Users size={19}/>
              </span>
              <div>
                <h2 className="font-semibold text-slate-900">Role aktif</h2>
                <p className="mt-1 text-sm text-slate-500">{roles.length} penetapan akses.</p>
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {roles.map((item) => <article key={item.id} className={`flex flex-wrap items-center gap-3 px-5 py-5 sm:flex-nowrap sm:px-6 ${item.user_exists === false ? "bg-red-50/30" : ""}`}>
                <span className={`shrink-0 rounded-2xl p-3 ${item.user_exists === false ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-600"}`}>
                    {item.user_exists === false ? <AlertCircle size={19}/> : <ShieldCheck size={19}/>}
                  </span>
                  <div className="min-w-0 flex-1">
                    {item.user_exists === false ? (
                      <>
                        <p className="font-semibold text-red-700 flex items-center gap-2">
                          <AlertCircle size={16}/>
                          Akun tidak ditemukan
                        </p>
                        <p className="mt-1 text-sm text-red-600 font-mono break-all">{item.email}</p>
                        <p className="mt-1 text-xs text-red-500">User sudah dihapus dari Supabase Auth</p>
                      </>
                    ) : editingUserId === item.user_id ? (
                      <input 
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            void updateProfile(item.user_id, editName);
                          } else if (e.key === "Escape") {
                            setEditingUserId(null);
                          }
                        }}
                        className="w-full rounded border border-red-300 px-2 py-1 text-sm font-semibold outline-none focus:border-[#CE181E] focus:ring-2 focus:ring-red-100"
                        placeholder="Nama lengkap"
                        autoFocus
                      />
                    ) : (
                      <p className="font-semibold text-slate-900">
                        {item.name || <span className="text-slate-400 italic">Belum ada nama</span>}
                      </p>
                    )}
                    {item.user_exists !== false && (
                      <>
                        <p className="mt-1 text-sm text-slate-500 break-all">{item.email}</p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {item.sites?.[0]?.name ?? "Semua website"}
                          {item.sites?.[0]?.domain ? ` · ${item.sites[0].domain}` : ""}
                        </p>
                      </>
                    )}
                  </div>
                {item.user_exists === false ? (
                  <div className="mt-3 flex justify-end">
                    <button 
                      type="button" 
                      onClick={() => void removeRole(item)} 
                      className="rounded-xl border border-red-600 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
                    >
                      Hapus role orphan
                    </button>
                  </div>
                ) : editingUserId === item.user_id ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button 
                      type="button" 
                      onClick={() => void updateProfile(item.user_id, editName)}
                      className="flex-1 min-w-[120px] rounded-xl border border-[#CE181E] bg-red-50 px-3 py-2 text-sm font-medium text-[#B01519] hover:bg-red-100"
                    >
                      Simpan
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setEditingUserId(null)}
                      className="flex-1 min-w-[120px] rounded-xl border px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Batal
                    </button>
                  </div>
                ) : (
                  <>
                    <button 
                      type="button" 
                      onClick={() => {
                        setEditingUserId(item.user_id);
                        setEditName(item.name || "");
                      }}
                      className="rounded-xl border p-2 hover:bg-slate-50"
                      title="Edit profil"
                    >
                      <UserPen size={17}/>
                    </button>
                    <select 
                      value={item.role} 
                      onChange={(event) => void updateRole(item, event.target.value as Role["role"], item.site_id)} 
                      className="min-w-[100px] rounded-xl border px-3 py-2 text-sm"
                    >
                      <option value="writer">Writer</option>
                      <option value="editor">Editor</option>
                      <option value="admin">Admin</option>
                    </select>
                    {item.role !== "admin" && <select 
                      value={item.site_id ?? ""} 
                      onChange={(event) => void updateRole(item, item.role, event.target.value)} 
                      className="min-w-[120px] flex-1 rounded-xl border px-3 py-2 text-sm"
                    >
                      {sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
                    </select>}
                    <span className={`whitespace-nowrap rounded-full px-2 py-1 text-xs ${item.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {item.is_active ? "Aktif" : "Nonaktif"}
                    </span>
                    <button 
                      type="button" 
                      onClick={() => void updateRole(item, item.role, item.site_id, !item.is_active)} 
                      className="rounded-xl border p-2 hover:bg-slate-50"
                      title={item.is_active ? "Nonaktifkan" : "Aktifkan"}
                    >
                      <Power size={17}/>
                    </button>
                    <button 
                      type="button" 
                      onClick={() => void removeRole(item)} 
                      className="rounded-xl border p-2 text-red-600 hover:bg-red-50"
                      title="Hapus"
                    >
                      <Trash2 size={17}/>
                    </button>
                  </>
                )}
              </article>)}
              {!roles.length && <div className="py-14 text-center">
                <Users className="mx-auto text-slate-300" size={30}/>
                <p className="mt-3 text-sm font-medium text-slate-700">Belum ada role</p>
              </div>}
            </div>
          </section>
          <form onSubmit={assign} className="h-fit rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="font-semibold text-slate-900">Tambah role</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">Akun harus sudah terdaftar pada Supabase Auth.</p>
            <label className="mt-5 block text-sm font-medium text-slate-700">
              Email akun
              <input 
                required 
                name="email" 
                type="email" 
                placeholder="writer@example.com" 
                className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#CE181E] focus:ring-4 focus:ring-red-100"
              />
            </label>
            <label className="mt-4 block text-sm font-medium text-slate-700">
              Role
              <select 
                name="role"
                value={selectedRole}
                onChange={(event) => { setSelectedRole(event.target.value as Role["role"]); setSelectedSiteIds([]); }}
                className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#CE181E] focus:ring-4 focus:ring-red-100"
              >
                <option value="writer">Writer</option>
                <option value="editor">Editor</option>
                <option value="admin">Admin global</option>
              </select>
            </label>
            <fieldset disabled={selectedRole === "admin"} className="mt-4 disabled:opacity-50"><legend className="text-sm font-medium text-slate-700">Website akses <span className="font-normal text-slate-400">(pilih satu atau beberapa)</span></legend><div className="mt-1.5 max-h-48 space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-3">{sites.map((site) => <label key={site.id} className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={selectedSiteIds.includes(site.id)} onChange={(event) => setSelectedSiteIds((current) => event.target.checked ? [...current, site.id] : current.filter((id) => id !== site.id))}/>{site.name}</label>)}</div>{selectedRole === "admin" && <p className="mt-1 text-xs text-slate-500">Admin global otomatis memiliki akses ke semua website.</p>}</fieldset>
            <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">
              Admin global mengabaikan pilihan website. Editor dan writer memerlukan website.
            </div>
            <button className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#CE181E] px-4 text-sm font-semibold text-white hover:bg-[#B01519]">
              <UserPlus size={18}/> Tambah role
            </button>
          </form>
        </div>
        {message && <p className="mt-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">{message}</p>}
      </section>
    </div>
  </main>;
}






