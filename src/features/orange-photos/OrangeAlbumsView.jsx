/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from "react";
import { IonIcon } from "@ionic/react";
import { ellipsisVerticalOutline, people as peopleOutline } from "ionicons/icons";
import OrangeAlbumShareModal from "./OrangeAlbumShareModal.jsx";

function albumShareTitle(album) {
  if (!album.is_shared_effectively) return "";
  if (!album.is_owner) return `Compartido por ${album.shared_by_display_name || "otro miembro"}`;
  if (album.visibility === "family") return "Compartido con toda la familia";
  const names = (album.shared_people || []).map(person => person.display_name).filter(Boolean);
  return names.length ? `Compartido con ${names.join(", ")}` : "Compartido con miembros concretos";
}

export default function OrangeAlbumsView({ albums, members, search, onOpen, onCreate, onRename, onShare, onDelete, onSetCover, createRequestKey = 0, onCreateRequestHandled }) {
  const [filter, setFilter] = useState("all");
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [visibility, setVisibility] = useState("private");
  const [activeMenuAlbum, setActiveMenuAlbum] = useState(null);
  const [renameAlbum, setRenameAlbum] = useState(null);
  const [shareAlbum, setShareAlbum] = useState(null);
  const [deleteAlbum, setDeleteAlbum] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!createRequestKey) return;
    setCreating(true);
    onCreateRequestHandled?.();
  }, [createRequestKey, onCreateRequestHandled]);

  const visible = useMemo(() => albums.filter(album => {
    if (search && !String(album.title || "").toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "mine") return album.is_owner;
    if (filter === "shared") return !album.is_owner;
    return true;
  }), [albums, search, filter]);

  const closeModal = setter => { if (!busy) { setter(null); setError(""); } };
  const run = async action => {
    setBusy(true);
    setError("");
    try { return await action(); }
    catch (actionError) { setError(actionError.message); return null; }
    finally { setBusy(false); }
  };
  const openShare = album => {
    setActiveMenuAlbum(null);
    setShareAlbum(album);
    setError("");
  };

  return <div className="od-orange-albums-view">
    <header><div><h1 className="od-page-title">Álbumes</h1><p>{visible.length} álbumes</p></div><button className="od-btn od-btn-primary od-orange-albums-view__create" type="button" onClick={() => { setCreating(true); setError(""); }}>Crear álbum</button></header>
    <div className="od-orange-albums-view__filters"><button className={`od-filter-button${filter === "all" ? " od-filter-button--active" : ""}`} onClick={() => setFilter("all")}>Todos</button><button className={`od-filter-button${filter === "mine" ? " od-filter-button--active" : ""}`} onClick={() => setFilter("mine")}>Mis álbumes</button><button className={`od-filter-button${filter === "shared" ? " od-filter-button--active" : ""}`} onClick={() => setFilter("shared")}>Compartidos conmigo</button></div>
    <div className="od-orange-albums-view__scroller"><div className="od-orange-albums-view__grid">{visible.map(album => { const shareTitle=albumShareTitle(album);return <div className="od-orange-album-card" key={album.id} role="button" tabIndex="0" onClick={() => onOpen(album)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") onOpen(album); }}>
      <div className="od-orange-album-card__cover">{album.cover_thumbnail_url ? <img src={album.cover_thumbnail_url} alt="" /> : <span className="od-orange-album-card__placeholder">Álbum</span>}{shareTitle ? <span className={`od-orange-album-card__share od-orange-album-card__share--${album.is_owner ? "owned" : "received"} od-orange-photo-card__share--${album.is_owner ? "owned" : "received"}`} title={shareTitle} aria-label={shareTitle} onClick={event => event.stopPropagation()}><IonIcon icon={peopleOutline} /></span> : null}</div>
      <div className="od-orange-album-card__footer"><div className="od-orange-album-card__text"><strong>{album.title}</strong><small>{album.photo_count} elementos</small></div>
      {album.is_owner ? <div className="od-orange-album-card__menu-wrap" onKeyDown={event => event.stopPropagation()}><button type="button" className="od-orange-album-card__menu-button" aria-label={`Acciones de ${album.title}`} onClick={event => { event.stopPropagation(); setActiveMenuAlbum(activeMenuAlbum?.id === album.id ? null : album); }}><IonIcon icon={ellipsisVerticalOutline} /></button>{activeMenuAlbum?.id === album.id ? <div className="od-orange-album-card__menu" onClick={event => event.stopPropagation()}><button className="od-action-menu-item" type="button" onClick={() => { setRenameAlbum(album); setTitle(album.title); setActiveMenuAlbum(null); setError(""); }}>Cambiar nombre</button><button className="od-action-menu-item" type="button" onClick={() => openShare(album)}>Compartir álbum</button><button className="od-action-menu-item" type="button" onClick={() => { setActiveMenuAlbum(null); onSetCover(album); }}>Elegir imagen de portada</button><button className="od-action-menu-item od-orange-album-card__menu-danger" type="button" onClick={() => { setDeleteAlbum(album); setActiveMenuAlbum(null); setError(""); }}>Eliminar álbum</button></div> : null}</div> : null}</div>
    </div>})}</div></div>

    {creating ? <div className="od-modal-backdrop"><section className="od-modal" role="dialog" aria-modal="true"><header className="od-modal-header"><h2 className="od-modal-title">Crear álbum</h2><button className="od-modal-close" type="button" onClick={() => { setCreating(false); setError(""); }}>×</button></header><form className="od-modal-body" onSubmit={async event => { event.preventDefault(); const album = await run(() => onCreate({ title, visibility })); if (album) { setCreating(false); setTitle(""); setVisibility("private"); onOpen(album); } }}><label className="od-form-field"><span className="od-form-label">Título</span><input className="od-filter-input" value={title} onChange={event => setTitle(event.target.value)} required /></label><label className="od-form-field"><span className="od-form-label">Visibilidad</span><select className="od-filter-input" value={visibility} onChange={event => setVisibility(event.target.value)}><option value="private">Privado</option><option value="family">Familia</option></select></label>{error ? <p className="od-status-line od-status-line--error">{error}</p> : null}<div className="od-modal-actions"><button className="od-btn od-btn-secondary" type="button" disabled={busy} onClick={() => { setCreating(false); setError(""); }}>Cancelar</button><button className="od-btn od-btn-primary" disabled={busy}>Crear</button></div></form></section></div> : null}

    {renameAlbum ? <div className="od-modal-backdrop"><section className="od-modal" role="dialog" aria-modal="true"><header className="od-modal-header"><h2 className="od-modal-title">Cambiar nombre</h2><button className="od-modal-close" type="button" onClick={() => closeModal(setRenameAlbum)}>×</button></header><form className="od-modal-body" onSubmit={async event => { event.preventDefault(); if (await run(() => onRename(renameAlbum.id, { title }))) setRenameAlbum(null); }}><label className="od-form-field"><span className="od-form-label">Título</span><input className="od-filter-input" value={title} onChange={event => setTitle(event.target.value)} required /></label>{error ? <p className="od-status-line od-status-line--error">{error}</p> : null}<div className="od-modal-actions"><button className="od-btn od-btn-secondary" type="button" disabled={busy} onClick={() => closeModal(setRenameAlbum)}>Cancelar</button><button className="od-btn od-btn-primary" disabled={busy}>Guardar</button></div></form></section></div> : null}

    {shareAlbum ? <OrangeAlbumShareModal album={shareAlbum} members={members} busy={busy} error={error} onClose={() => closeModal(setShareAlbum)} onSave={async body => { if (await run(() => onShare(shareAlbum.id, body))) setShareAlbum(null); }} /> : null}

    {deleteAlbum ? <div className="od-modal-backdrop"><section className="od-modal" role="alertdialog" aria-modal="true"><header className="od-modal-header"><h2 className="od-modal-title">Eliminar álbum</h2></header><div className="od-modal-body"><p>Se eliminará el álbum, pero sus fotos permanecerán en tu biblioteca.</p>{error ? <p className="od-status-line od-status-line--error">{error}</p> : null}<div className="od-modal-actions"><button className="od-btn od-btn-secondary" type="button" disabled={busy} onClick={() => closeModal(setDeleteAlbum)}>Cancelar</button><button className="od-btn od-btn-danger" type="button" disabled={busy} onClick={async () => { if (await run(() => onDelete(deleteAlbum.id))) setDeleteAlbum(null); }}>Eliminar álbum</button></div></div></section></div> : null}
  </div>;
}
