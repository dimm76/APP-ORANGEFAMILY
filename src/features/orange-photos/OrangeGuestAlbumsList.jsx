export default function OrangeGuestAlbumsList({ items = [], loading = false, error = "", emptyMessage = "No tienes álbumes compartidos activos." }) {
  const openAlbum = albumId => { window.history.pushState({}, "", `/guest/orangephotos/albums/${albumId}`); window.dispatchEvent(new Event("od-spa-navigate")); };
  if (error) return <p className="od-status-line od-status-line--error">{error}</p>;
  if (loading) return <p className="od-status-line">Cargando álbumes…</p>;
  if (!items.length) return <p className="od-status-line">{emptyMessage}</p>;
  return <div className="od-orange-albums-view__grid">{items.map(album => <article key={album.id} className="od-orange-album-card" role="button" tabIndex={0} onClick={() => openAlbum(album.id)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") openAlbum(album.id); }}><div className="od-orange-album-card__cover">{album.cover_thumbnail_url ? <img src={album.cover_thumbnail_url} alt="" /> : <span className="od-orange-album-card__placeholder">Álbum</span>}</div><div className="od-orange-album-card__footer"><div className="od-orange-album-card__text"><strong>{album.title}</strong><div className="od-orange-album-card__meta"><small>{album.photo_count} elementos</small><small>{album.owner_display_name}</small></div></div></div></article>)}</div>;
}
