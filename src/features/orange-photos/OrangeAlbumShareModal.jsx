import { useCallback, useEffect, useRef, useState } from "react";
import { IonIcon } from "@ionic/react";
import { informationCircleOutline, linkOutline } from "ionicons/icons";
import { createOrangeAlbumPublicLink, revokeOrangeAlbumPublicLink } from "../../shared/api/orangePhotosApi.js";
import { listOrangeAlbumRecipients, revokeOrangeAlbumGuestInvitation, syncOrangeAlbumRecipients } from "./orangeGuestAlbumApi.js";
import OrangeAlbumGuestInviteModal from "./OrangeAlbumGuestInviteModal.jsx";

export default function OrangeAlbumShareModal({ album, busy = false, error = "", onClose, onSave, onPublicLinkChange }) {
  const [recipientData, setRecipientData] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [selectedFamilyIds, setSelectedFamilyIds] = useState([]);
  const [selectedExternalIds, setSelectedExternalIds] = useState([]);
  const [guestInviteOpen, setGuestInviteOpen] = useState(false);
  const [guestInvitationActionBusy, setGuestInvitationActionBusy] = useState("");
  const [publicLink, setPublicLink] = useState(album.public_link || { enabled: false, path: null });
  const [publicError, setPublicError] = useState("");
  const [copyFeedback, setCopyFeedback] = useState("");
  const allFamilyRef = useRef(null);

  const reloadRecipients = useCallback(async ({ preserveSelection = false } = {}) => {
    setLoadError("");
    try {
      const result = await listOrangeAlbumRecipients(album.id);
      setRecipientData(result);
      if (!preserveSelection) {
        setSelectedFamilyIds((result.family || []).filter(item => item.selected).map(item => item.user_id));
        setSelectedExternalIds((result.external || []).filter(item => item.selected).map(item => item.user_id));
      }
    } catch (loadException) {
      setLoadError(loadException.message || "No se pudieron cargar los destinatarios.");
    }
  }, [album.id]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void reloadRecipients(); }, [reloadRecipients]);
  const family = recipientData?.family || [];
  const external = recipientData?.external || [];
  const pending = recipientData?.pending_invitations || [];
  const loading = recipientData === null;
  const allFamilySelected = family.length > 0 && selectedFamilyIds.length === family.length;

  useEffect(() => {
    if (allFamilyRef.current) allFamilyRef.current.indeterminate = selectedFamilyIds.length > 0 && selectedFamilyIds.length < family.length;
  }, [selectedFamilyIds, family.length]);

  const toggleAllFamily = event => setSelectedFamilyIds(event.target.checked ? family.map(item => item.user_id) : []);
  const toggleFamily = userId => setSelectedFamilyIds(current => current.includes(userId) ? current.filter(id => id !== userId) : [...current, userId]);
  const toggleExternal = userId => setSelectedExternalIds(current => current.includes(userId) ? current.filter(id => id !== userId) : [...current, userId]);
  const handleSave = async event => {
    event.preventDefault();
    if (!recipientData) return;
    setSaving(true);
    setSaveError("");
    try {
      const recipients = [
        ...family.filter(item => selectedFamilyIds.includes(item.user_id)).map(item => ({ user_id: item.user_id, subject_type: "family", status: "active", invitation_id: null })),
        ...external.filter(item => selectedExternalIds.includes(item.user_id)).map(item => ({ user_id: item.user_id, subject_type: "external", status: "active", invitation_id: item.invitation_id || null })),
      ];
      const payload = { recipients, allow_contributions: recipientData.album.allow_contributions === true, allow_comments: recipientData.album.allow_comments === true };
      await syncOrangeAlbumRecipients(album.id, payload);
      await onSave?.(payload);
      onClose();
    } catch (saveException) {
      setSaveError(saveException.message || "No se pudo guardar el acceso.");
    } finally { setSaving(false); }
  };
  const revokePending = async invitationId => { if (!window.confirm("¿Revocar esta invitación?")) return; setGuestInvitationActionBusy(invitationId); try { await revokeOrangeAlbumGuestInvitation(album.id, invitationId); await reloadRecipients({ preserveSelection: true }); } catch (revokeError) { setLoadError(revokeError.message || "No se pudo revocar la invitación."); } finally { setGuestInvitationActionBusy(""); } };
  const changePublicLink = async regenerate => { try { const result = await createOrangeAlbumPublicLink(album.id, regenerate); setPublicLink(result.public_link); onPublicLinkChange?.(result.public_link); } catch (linkError) { setPublicError(linkError.message); } };
  const revokePublicLink = async () => { try { const result = await revokeOrangeAlbumPublicLink(album.id); setPublicLink(result.public_link); onPublicLinkChange?.(result.public_link); } catch (linkError) { setPublicError(linkError.message); } };
  if (loading && !loadError) return <div className="od-modal-backdrop"><section className="od-modal od-orange-album-share-modal"><header className="od-modal-header"><h2 className="od-modal-title">Compartir álbum</h2></header><div className="od-modal-body"><p className="od-status-line">Cargando destinatarios…</p></div></section></div>;
  return <><div className="od-modal-backdrop"><section className="od-modal od-orange-album-share-modal" role="dialog" aria-modal="true"><header className="od-modal-header"><h2 className="od-modal-title">Compartir álbum</h2><button className="od-modal-close" type="button" disabled={saving || busy} onClick={onClose}>×</button></header><form className="od-modal-body od-orange-album-share-modal__form" onSubmit={handleSave}>{loadError ? <><p className="od-status-line od-status-line--error">{loadError}</p><button className="od-button-secondary" type="button" onClick={() => reloadRecipients()}>Reintentar</button></> : <div className="od-orange-album-share-modal__content"><section className="od-orange-album-share-section"><h3 className="od-orange-album-share-section__title">FAMILIA</h3><div className="od-orange-album-share-list"><label className="od-orange-album-share-person"><input ref={allFamilyRef} type="checkbox" checked={allFamilySelected} disabled={saving} onChange={toggleAllFamily} /><span className="od-orange-album-share-person__content"><strong>Toda la familia</strong></span></label>{family.map(member => <label key={member.user_id} className="od-orange-album-share-person"><input type="checkbox" checked={selectedFamilyIds.includes(member.user_id)} disabled={saving} onChange={() => toggleFamily(member.user_id)} /><span className="od-orange-album-share-person__content"><strong>{member.display_name}</strong>{member.email ? <small>{member.email}</small> : null}</span></label>)}</div></section><section className="od-orange-album-share-section"><div className="od-orange-album-share-section__header"><div className="od-orange-album-share-section__title-wrap"><h3 className="od-orange-album-share-section__title">INVITADOS</h3><IonIcon icon={informationCircleOutline} className="od-orange-album-share-section__info" title="Personas que no forman parte de la unidad familiar" aria-label="Los invitados no forman parte de la unidad familiar" /></div><button type="button" className="od-btn od-btn-secondary od-orange-album-share__invite" disabled={saving} onClick={() => setGuestInviteOpen(true)}>Invitar</button></div><div className="od-orange-album-share-list">{external.map(person => <label key={person.key} className="od-orange-album-share-person"><input type="checkbox" checked={selectedExternalIds.includes(person.user_id)} disabled={saving} onChange={() => toggleExternal(person.user_id)} /><span className="od-orange-album-share-person__content"><strong>{person.display_name || person.email}</strong>{person.email ? <small>{person.email}</small> : null}{person.status === "pending" ? <small className="od-orange-album-share-pending__status">Pendiente</small> : null}</span></label>)}{pending.map(invitation => <div key={invitation.id} className="od-orange-album-share-pending"><span className="od-orange-album-share-person__content"><strong>{invitation.display_name || invitation.email}</strong>{invitation.display_name && invitation.email ? <small>{invitation.email}</small> : null}<small className="od-orange-album-share-pending__status">Invitación pendiente{invitation.expires_at ? ` · Caduca ${new Date(invitation.expires_at).toLocaleDateString("es-ES")}` : ""}</small></span><button type="button" className="od-button-danger" disabled={guestInvitationActionBusy === invitation.id} onClick={() => revokePending(invitation.id)}>Revocar</button></div>)}{!external.length && !pending.length ? <p className="od-orange-album-share-empty">Todavía no hay invitados.</p> : null}</div></section><div className="od-orange-album-share-divider" /><div className="od-orange-album-share-public-link"><IonIcon icon={linkOutline} className="od-orange-album-share-public-link__icon" aria-hidden="true" />{publicLink.enabled ? <><span className="od-orange-album-share-public-link__url">{`${window.location.origin}${publicLink.path}`}</span><div className="od-orange-album-share-public-link__actions"><button type="button" className="od-button-secondary" onClick={() => navigator.clipboard.writeText(`${window.location.origin}${publicLink.path}`).then(() => setCopyFeedback("Enlace copiado"))}>Copiar</button><button type="button" className="od-button-secondary" onClick={() => changePublicLink(true)}>Regenerar</button><button type="button" className="od-button-danger" onClick={revokePublicLink}>Desactivar</button></div></> : <button type="button" className="od-button-link od-orange-album-share-public-link__create" onClick={() => changePublicLink(false)}>Crear enlace</button>}</div>{copyFeedback ? <p className="od-orangephotos-share-link-feedback">{copyFeedback}</p> : null}{publicError ? <p className="od-status-line od-status-line--error">{publicError}</p> : null}{saveError || error ? <p className="od-status-line od-status-line--error">{saveError || error}</p> : null}<div className="od-modal-actions od-orange-album-share-actions"><button type="button" className="od-btn od-btn-secondary" disabled={saving} onClick={onClose}>Cancelar</button><button type="submit" className="od-btn od-btn-primary" disabled={saving || loading || !recipientData}>{saving ? "Guardando…" : "Guardar"}</button></div></div>}</form></section></div>{guestInviteOpen ? <OrangeAlbumGuestInviteModal album={album} allowContributions={recipientData?.album.allow_contributions === true} allowComments={recipientData?.album.allow_comments === true} onClose={() => setGuestInviteOpen(false)} onChanged={() => reloadRecipients({ preserveSelection: true })} /> : null}</>;
}
