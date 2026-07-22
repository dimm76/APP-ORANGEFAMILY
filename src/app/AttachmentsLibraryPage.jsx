import { useCallback, useEffect, useState } from "react";
import { IonButton, IonContent, IonIcon, IonItem, IonList, IonPopover } from "@ionic/react";
import { ellipsisVerticalOutline } from "ionicons/icons";
import { deleteAttachment, fetchAttachments, fetchAttachmentSignedUrl, uploadAttachment } from "../shared/api/attachmentsApi.js";
import AttachmentsImageLightbox from "../shared/components/AttachmentsImageLightbox.jsx";

const formatBytes = (n) => n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`;
const formatDate = (value) => value ? new Date(value).toLocaleString() : "—";

export default function AttachmentsLibraryPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [thumbs, setThumbs] = useState({});
  const [viewer, setViewer] = useState(null);
  const [uploading, setUploading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const data = await fetchAttachments({ page: "1", per_page: "100" });
      const list = Array.isArray(data.items) ? data.items : [];
      setItems(list);
      const urls = {};
      await Promise.all(list.filter((item) => item.mime_type?.startsWith("image/")).map(async (item) => { try { urls[item.id] = await fetchAttachmentSignedUrl(item.id); } catch { /* miniatura omitida */ } }));
      setThumbs(urls);
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo cargar."); setItems([]); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  async function open(item) { try { setViewer({ url: thumbs[item.id] || await fetchAttachmentSignedUrl(item.id), title: item.original_filename || "Imagen" }); } catch (e) { window.alert(e.message); } }
  async function remove(item) { if (Number(item.usage_count) || !window.confirm("¿Eliminar este archivo de forma definitiva?")) return; try { await deleteAttachment(item.id); await load(); } catch (e) { window.alert(e.message); } }
  async function upload(event) { const file = event.target.files?.[0]; event.target.value = ""; if (!file) return; setUploading(true); try { await uploadAttachment(file); await load(); } catch (e) { window.alert(e.message); } finally { setUploading(false); } }
  return <>
    <div className="od-page od-attachments-library"><div className="od-page-inner od-page-inner--full">
      <header className="od-page-header"><h1 className="od-page-title">Attachments</h1><p className="od-page-subtitle">Biblioteca privada de imágenes de la familia.</p></header>
      <div className="od-attachments-library__toolbar"><label className="od-button-secondary od-attachments-library__upload">{uploading ? "Subiendo…" : "Subir imagen"}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={uploading} onChange={(e) => void upload(e)} /></label></div>
      {loading ? <p className="od-status-line">Cargando…</p> : null}{error ? <p className="od-status-line od-status-line--error">{error}</p> : null}
      {!loading && !error ? <div className="od-table-wrap od-attachments-library__table-wrap"><table className="od-table od-table--fill od-attachments-table"><thead><tr><th aria-label="Acciones" /><th>Miniatura</th><th>Nombre</th><th>Tipo</th><th>Tamaño</th><th>Dimensiones</th><th>Fecha</th><th>Usos</th></tr></thead><tbody>
        {!items.length ? <tr><td colSpan="8"><div className="od-empty-state">No hay attachments.</div></td></tr> : items.map((item) => { const trigger = `attachment-${item.id}`; return <tr key={item.id}><td className="od-table-col--actions"><IonButton id={trigger} fill="clear" size="small" className="od-icon-button od-action-ion" aria-label="Acciones"><IonIcon icon={ellipsisVerticalOutline} /></IonButton><IonPopover trigger={trigger} dismissOnSelect><IonContent className="od-action-popover-content"><IonList lines="none"><IonItem button detail={false} onClick={() => void open(item)}>Visualizar</IonItem><IonItem button detail={false} onClick={() => void navigator.clipboard?.writeText(item.id)}>Copiar ID</IonItem><IonItem button detail={false} disabled={Number(item.usage_count) > 0} onClick={() => void remove(item)}>Borrar</IonItem></IonList></IonContent></IonPopover></td><td>{thumbs[item.id] ? <button type="button" className="od-attachments-library__thumb-btn" onClick={() => void open(item)}><img className="od-attachments-thumb od-attachments-library__thumb" src={thumbs[item.id]} alt="" width="48" height="48" /></button> : "—"}</td><td><span className="od-attachments-library__name">{item.original_filename || "—"}</span><span className="od-attachments-library__id-hint" title={item.id}>{item.id.slice(0, 8)}…</span></td><td>{item.mime_type}</td><td>{formatBytes(Number(item.size_bytes))}</td><td>{item.width && item.height ? `${item.width} × ${item.height}` : "—"}</td><td>{formatDate(item.created_at)}</td><td>{Number(item.usage_count) || 0}</td></tr>; })}
      </tbody></table></div> : null}</div></div>
    <AttachmentsImageLightbox viewer={viewer} onClose={() => setViewer(null)} />
  </>;
}
