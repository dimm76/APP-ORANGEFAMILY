import { useEffect, useState } from "react";
import OrangeGuestShell from "./OrangeGuestShell.jsx";
import OrangeAlbumsView from "./OrangeAlbumsView.jsx";
import { listOrangeGuestAlbums } from "./orangeGuestAlbumApi.js";

export default function OrangeGuestLandingPage() { const [data, setData] = useState({ loading: true, error: "", items: [] }); useEffect(() => { listOrangeGuestAlbums().then(result => setData({ loading: false, error: "", items: result.items || [] })).catch(error => setData({ loading: false, error: error.message, items: [] })); }, []); return <OrangeGuestShell><div className="od-orangephotos-page">{data.error ? <p className="od-status-line od-status-line--error">{data.error}</p> : data.loading ? <p className="od-status-line">Cargando álbumes…</p> : <OrangeAlbumsView albums={data.items} categories={[]} members={[]} search="" guestMode onOpen={album => { window.history.pushState({}, "", `/guest/orangephotos/albums/${album.id}`); window.dispatchEvent(new Event("od-spa-navigate")); }} />}</div></OrangeGuestShell>; }
