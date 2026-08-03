import { useEffect, useState } from "react";
import OrangeGuestShell from "./OrangeGuestShell.jsx";
import OrangeGuestAlbumsList from "./OrangeGuestAlbumsList.jsx";
import { listOrangeGuestAlbums } from "./orangeGuestAlbumApi.js";

export default function OrangeGuestLandingPage() { const [data, setData] = useState({ loading: true, error: "", items: [] }); useEffect(() => { listOrangeGuestAlbums().then(result => setData({ loading: false, error: "", items: result.items || [] })).catch(error => setData({ loading: false, error: error.message, items: [] })); }, []); return <OrangeGuestShell><div className="od-orangephotos-page"><section className="od-orange-albums-view"><header><div><h1 className="od-page-title">Álbumes</h1><p>{data.items.length} álbumes compartidos</p></div></header><div className="od-orange-albums-view__scroller"><OrangeGuestAlbumsList items={data.items} loading={data.loading} error={data.error} /></div></section></div></OrangeGuestShell>; }
