import { useEffect, useState } from "react";
import { IonBadge } from "@ionic/react";
import { createFamilyMember, listFamilyMembers, resendInvitation, sendMemberPasswordReset, updateFamilyMember } from "./familyMembersApi.js";
import "./familyMembers.css";

const emptyForm = { first_name: "", last_name: "", email: "" };

function readableStatus(item) {
  if (item.role === "owner") return "Activo";
  if (item.membership_status === "inactive") return "Inactivo";
  if (item.auth_status === "pending") return "Pendiente de activación";
  if (item.auth_status === "active") return "Activo";
  if (item.auth_status === "disabled") return "Acceso desactivado";
  return "Sin acceso";
}

export default function FamilyMembersPage() {
  const [items, setItems] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [message, setMessage] = useState("");
  const [editing, setEditing] = useState(null); const [form, setForm] = useState(emptyForm); const [saving, setSaving] = useState(false); const [modalError, setModalError] = useState("");
  async function load() { setLoading(true); setError(""); try { setItems((await listFamilyMembers()).items || []); } catch (e) { setError(e.message); } finally { setLoading(false); } }
  useEffect(() => { void load(); }, []);
  function openCreate() { setEditing("new"); setForm(emptyForm); setModalError(""); setMessage(""); }
  function closeCreate() { setEditing(null); setForm(emptyForm); setModalError(""); }
  function openEdit(item) { setEditing(item.person_id); setForm({ first_name: item.first_name, last_name: item.last_name || "", email: item.email || "", has_access: item.has_access, membership_status: item.membership_status }); setMessage(""); setError(""); }
  async function submitCreate(event) { event.preventDefault(); setSaving(true); setModalError(""); try { const result = await createFamilyMember({ first_name: form.first_name, last_name: form.last_name, email: form.email }); closeCreate(); setMessage(result.invitation_sent === false ? "Familiar guardado, pero la invitación no pudo enviarse." : "Familiar guardado e invitación procesada."); await load(); } catch (e) { setModalError(e.message); } finally { setSaving(false); } }
  async function submitEdit(event) { event.preventDefault(); setSaving(true); setError(""); try { const result = await updateFamilyMember(editing, { first_name: form.first_name, last_name: form.last_name, email: form.email, has_access: form.has_access, membership_status: form.membership_status }); setMessage(result.invitation_sent === false ? "Familiar guardado, pero la invitación no pudo enviarse." : "Familiar guardado."); setEditing(null); setForm(emptyForm); await load(); } catch (e) { setError(e.message); } finally { setSaving(false); } }
  async function action(callback, success) { setError(""); setMessage(""); try { await callback(); setMessage(success); await load(); } catch (e) { setError(e.message); } }
  return <div className="od-page"><div className="od-page-inner od-page-inner--full od-page-inner--align-stretch">
    <div className="od-page-header"><div><h1 className="od-page-title">Ajustes · Familiares</h1><p className="od-page-subtitle">Los familiares con acceso pueden utilizar OrangePhotos.</p></div><button type="button" className="od-modal-primary of-family-add-button" onClick={openCreate}>+ Añadir familiar</button></div>
    {error ? <p className="od-status-line od-status-line--error" role="alert">{error}</p> : null}{message ? <p className="od-status-line">{message}</p> : null}
    {editing && editing !== "new" ? <form className="of-family-form" onSubmit={submitEdit}><div className="of-family-form__grid">
      <label className="od-form-field"><span className="od-form-label">Nombre *</span><input className="od-filter-input" required maxLength="120" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></label>
      <label className="od-form-field"><span className="od-form-label">Apellidos</span><input className="od-filter-input" maxLength="160" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></label>
      <label className="od-form-field"><span className="od-form-label">Email</span><input className="od-filter-input" type="email" required={form.has_access} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
      <label className="od-form-field"><span className="od-form-label">Estado</span><select className="od-filter-select" value={form.membership_status} onChange={(e) => setForm({ ...form, membership_status: e.target.value })}><option value="active">Activo</option><option value="inactive">Inactivo</option></select></label>
    </div><label className="of-family-form__check"><input type="checkbox" checked={form.has_access} onChange={(e) => setForm({ ...form, has_access: e.target.checked })} /> Permitir acceso a OrangeFamily</label><div className="od-modal-actions"><button type="button" className="od-button-secondary" onClick={() => { setEditing(null); setForm(emptyForm); }}>Cancelar</button><button type="submit" className="od-modal-primary" disabled={saving}>{saving ? "Guardando…" : "Guardar"}</button></div></form> : null}
    {loading ? <p className="od-status-line">Cargando familiares…</p> : <div className="od-table-wrap"><table className="od-table od-table--fill"><thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{items.map((item) => <tr key={item.person_id}><td>{[item.first_name,item.last_name].filter(Boolean).join(" ")}</td><td>{item.email || "—"}</td><td><IonBadge className="od-badge od-badge--style-1">{item.role === "owner" ? "Administrador" : "Familiar"}</IonBadge></td><td>{readableStatus(item)}</td><td>{item.role === "owner" ? "—" : <div className="of-family-actions"><button type="button" className="od-button-secondary" onClick={() => openEdit(item)}>Editar</button>{item.auth_status === "pending" ? <button type="button" className="od-button-secondary" onClick={() => void action(() => resendInvitation(item.person_id), "Invitación procesada.")}>Reenviar invitación</button> : null}{item.auth_status === "active" ? <button type="button" className="od-button-secondary" onClick={() => void action(() => sendMemberPasswordReset(item.person_id), "Recuperación solicitada.")}>Recuperar contraseña</button> : null}</div>}</td></tr>)}</tbody></table></div>}
    {editing === "new" ? <div className="od-modal-backdrop" role="presentation"><div className="od-modal of-family-create-modal" role="dialog" aria-modal="true" aria-labelledby="of-family-create-title"><form onSubmit={submitCreate}><div className="od-modal-header"><h2 id="of-family-create-title" className="od-modal-title">Añadir familiar</h2></div><div className="od-modal-body"><div className="of-family-form__grid"><label className="od-form-field"><span className="od-form-label">Nombre *</span><input className="od-filter-input" required maxLength="120" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></label><label className="od-form-field"><span className="od-form-label">Apellidos</span><input className="od-filter-input" maxLength="160" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></label><label className="od-form-field"><span className="od-form-label">Email *</span><input className="od-filter-input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label></div>{modalError ? <p className="od-inline-msg" role="alert">{modalError}</p> : null}</div><div className="od-modal-actions"><button type="button" className="od-button-secondary" onClick={closeCreate}>Cancelar</button><button type="submit" className="od-modal-primary" disabled={saving}>{saving ? "Enviando…" : "Enviar invitación"}</button></div></form></div></div> : null}
  </div></div>;
}
