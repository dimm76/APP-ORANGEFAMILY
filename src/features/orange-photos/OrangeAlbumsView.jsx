/* eslint-disable react-hooks/set-state-in-effect, react-refresh/only-export-components */
import { useEffect, useMemo, useState } from "react";
import { IonIcon } from "@ionic/react";
import { ellipsisVerticalOutline, people as peopleOutline } from "ionicons/icons";
import OrangeAlbumShareModal from "./OrangeAlbumShareModal.jsx";
import OrangeAlbumOptionsModal from "./OrangeAlbumOptionsModal.jsx";
import OrangeAlbumCreateModal from "./OrangeAlbumCreateModal.jsx";
const dateFormatter=new Intl.DateTimeFormat("es-ES",{day:"numeric",month:"short",year:"numeric"});
function parseDate(value){if(!value)return null;const date=new Date(`${String(value).slice(0,10)}T12:00:00`);return Number.isNaN(date.getTime())?null:date;}
function clean(value){return value.replaceAll(".","");}
export function formatAlbumDate(album){const start=parseDate(album.date_start);if(!start||!album.date_mode)return "";if(album.date_mode==="single")return clean(dateFormatter.format(start));const end=parseDate(album.date_end);return end?`${clean(dateFormatter.format(start))}–${clean(dateFormatter.format(end))}`:clean(dateFormatter.format(start));}
function sortAlbums(items,mode){return [...items].sort((a,b)=>{const titleCompare=String(a.title||"").localeCompare(String(b.title||""),"es",{sensitivity:"base"}),idCompare=String(a.id).localeCompare(String(b.id));if(mode==="title_desc")return titleCompare===0?idCompare:-titleCompare;if(mode==="title_asc")return titleCompare===0?idCompare:titleCompare;const aDate=parseDate(a.date_start),bDate=parseDate(b.date_start);if(!aDate&&!bDate)return titleCompare===0?idCompare:titleCompare;if(!aDate)return 1;if(!bDate)return -1;const dateCompare=bDate-aDate;return (mode==="album_date_asc"?-dateCompare:dateCompare)||titleCompare||idCompare;});}
function shareTitle(album){if(!album.is_shared_effectively)return "";if(!album.is_owner)return `Compartido por ${album.shared_by_display_name||album.owner_display_name||"otro miembro"}`;if(album.visibility==="family")return "Compartido con toda la familia";if(album.visibility==="selected"){const names=(album.shared_people||[]).map(person=>typeof person==="string"?person:person.display_name).filter(Boolean);return names.length?`Compartido con ${names.join(", ")}`:"Compartido con miembros concretos";}return "";}
export default function OrangeAlbumsView({albums=[],categories=[],members=[],search="",onOpen,onCreate,onRename,onShare,onDelete,onSetCover,onSaveOptions,createRequestKey=0,onCreateRequestHandled,restrictedRole=false,canCreateAlbums=true,canUseAlbumMenu=true}){
  void onSetCover;const [filter,setFilter]=useState("all"),[creating,setCreating]=useState(false),[title,setTitle]=useState(""),[selectedCategoryIds,setSelectedCategoryIds]=useState([]),[categoriesExpanded,setCategoriesExpanded]=useState(false),[sortMode,setSortMode]=useState("album_date_desc"),[activeMenuAlbum,setActiveMenuAlbum]=useState(null),[renameAlbum,setRenameAlbum]=useState(null),[shareAlbum,setShareAlbum]=useState(null),[deleteAlbum,setDeleteAlbum]=useState(null),[optionsAlbum,setOptionsAlbum]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
  useEffect(()=>{if(createRequestKey&&!restrictedRole){setCreating(true);onCreateRequestHandled?.();}},[createRequestKey,onCreateRequestHandled,restrictedRole]);
  useEffect(() => {
    if (!activeMenuAlbum) {
      return undefined;
    }

    const closeMenu = event => {
      if (event.target.closest(".od-orange-album-card__menu-wrap")) {
        return;
      }
      setActiveMenuAlbum(null);
    };

    const closeOnEscape = event => {
      if (event.key === "Escape") {
        setActiveMenuAlbum(null);
      }
    };

    document.addEventListener("pointerdown", closeMenu);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeMenu);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [activeMenuAlbum]);
  const visible = useMemo(() => {
    const normalizedSearch = search
      .trim()
      .toLocaleLowerCase("es");

    if (restrictedRole) {
      const guestAlbums = albums.filter((album) => {
        if (!normalizedSearch) {
          return true;
        }

        return String(album.title || "")
          .toLocaleLowerCase("es")
          .includes(normalizedSearch);
      });

      return sortAlbums(guestAlbums, "title_asc");
    }

    const filteredAlbums = albums.filter((album) => {
      if (
        normalizedSearch &&
        !String(album.title || "")
          .toLocaleLowerCase("es")
          .includes(normalizedSearch)
      ) {
        return false;
      }

      if (filter === "mine" && !album.is_owner) {
        return false;
      }

      if (filter === "shared" && album.is_owner) {
        return false;
      }

      if (selectedCategoryIds.length) {
        const albumCategoryIds = new Set(
          (album.categories || []).map(
            (category) => category.id,
          ),
        );

        const matchesSelectedCategory =
          selectedCategoryIds.some((categoryId) =>
            albumCategoryIds.has(categoryId),
          );

        if (!matchesSelectedCategory) {
          return false;
        }
      }

      return true;
    });

    return sortAlbums(filteredAlbums, sortMode);
  }, [
    albums,
    search,
    filter,
    selectedCategoryIds,
    sortMode,
    restrictedRole,
  ]);
  const run=async action=>{setBusy(true);setError("");try{return await action();}catch(exception){setError(exception.message);return null;}finally{setBusy(false);}},close=setter=>{if(!busy){setter(null);setError("");}},visibleCategories=categoriesExpanded?categories:categories.slice(0,4);
  return <div className="od-orange-albums-view"><header><div><h1 className="od-page-title">Álbumes</h1><p>{visible.length}{" "}{restrictedRole?(visible.length===1?"álbum compartido":"álbumes compartidos"):"álbumes"}</p></div>{canCreateAlbums?<><select className="od-filter-input od-orange-albums-view__sort" value={sortMode} onChange={event=>setSortMode(event.target.value)} aria-label="Ordenar álbumes"><option value="album_date_desc">Fecha del álbum · más reciente</option><option value="album_date_asc">Fecha del álbum · más antigua</option><option value="title_asc">Título · A–Z</option><option value="title_desc">Título · Z–A</option></select><button className="od-btn od-btn-primary od-orange-albums-view__create" type="button" onClick={()=>setCreating(true)}>Crear álbum</button></>:null}</header>{restrictedRole?null:<div className="od-orange-albums-view__filters">{[...[{id:"all",name:"Todos"},{id:"mine",name:"Mis álbumes"},{id:"shared",name:"Compartidos conmigo"}],...visibleCategories].map(category=><button key={category.id} type="button" className={`od-filter-button${filter===category.id||selectedCategoryIds.includes(category.id)?" od-filter-button--active":""}`} onClick={()=>category.id==="all"||category.id==="mine"||category.id==="shared"?setFilter(category.id):setSelectedCategoryIds(current=>current.includes(category.id)?current.filter(value=>value!==category.id):[...current,category.id])}>{category.name}</button>)}{categories.length>4?<button type="button" className="od-filter-button" onClick={()=>setCategoriesExpanded(value=>!value)}>{categoriesExpanded?"Ver menos":"Ver más"}</button>:null}</div>}<div className="od-orange-albums-view__scroller"><div className="od-orange-albums-view__grid">{visible.map(album=>{const title=shareTitle(album),date=formatAlbumDate(album);return <div className="od-orange-album-card" key={album.id} role="button" tabIndex="0" onClick={()=>onOpen?.(album)} onKeyDown={event=>{if(event.key==="Enter"||event.key===" ")onOpen?.(album);}}><div className="od-orange-album-card__cover">{album.cover_thumbnail_url?<img src={album.cover_thumbnail_url} alt=""/>:<span className="od-orange-album-card__placeholder">Álbum</span>}{!restrictedRole&&title?<span className="od-orange-album-card__share" title={title}><IonIcon icon={peopleOutline}/></span>:null}</div><div className="od-orange-album-card__footer"><div className="od-orange-album-card__text"><strong>{album.title}</strong><div className="od-orange-album-card__meta"><small>{album.photo_count} elementos</small>{restrictedRole&&album.owner_display_name?<small>Compartido por {album.owner_display_name}</small>:!restrictedRole&&date?<small className="od-orange-album-card__date">{date}</small>:null}</div></div>{canUseAlbumMenu?<div className="od-orange-album-card__menu-wrap"><button type="button" className="od-orange-album-card__menu-button" aria-label={`Acciones de ${album.title}`} onClick={event=>{event.stopPropagation();setActiveMenuAlbum(activeMenuAlbum?.id===album.id?null:album);}}><IonIcon icon={ellipsisVerticalOutline}/></button>{activeMenuAlbum?.id===album.id?<div className="od-orange-album-card__menu" onClick={event=>event.stopPropagation()}>{album.is_owner?<><button className="od-action-menu-item" type="button" onClick={()=>{setActiveMenuAlbum(null);setRenameAlbum(album);setTitle(album.title);}}>Cambiar nombre</button><button className="od-action-menu-item" type="button" onClick={()=>{setActiveMenuAlbum(null);setShareAlbum(album);}}>Compartir álbum</button></>:null}<button className="od-action-menu-item" type="button" onClick={()=>{setActiveMenuAlbum(null);setOptionsAlbum(album);}}>Opciones</button>{album.is_owner?<button className="od-action-menu-item od-orange-album-card__menu-danger" type="button" onClick={()=>{setActiveMenuAlbum(null);setDeleteAlbum(album);}}>Eliminar álbum</button>:null}</div>:null}</div>:null}</div></div>})}</div></div>{!restrictedRole&&creating?<OrangeAlbumCreateModal categories={categories} members={members} onClose={()=>setCreating(false)} onCreate={onCreate} onCreated={album=>{setCreating(false);onOpen?.(album);}}/>:null}{!restrictedRole&&renameAlbum?<div className="od-modal-backdrop"><section className="od-modal"><form className="od-modal-body" onSubmit={async event=>{event.preventDefault();if(await run(()=>onRename(renameAlbum.id,{title:title.trim()})))setRenameAlbum(null);}}><h2 className="od-modal-title">Cambiar nombre</h2><input className="od-filter-input" value={title} onChange={event=>setTitle(event.target.value)} required/><div className="od-modal-actions"><button type="button" className="od-btn od-btn-secondary" onClick={()=>close(setRenameAlbum)}>Cancelar</button><button className="od-btn od-btn-primary" disabled={busy}>Guardar</button></div></form></section></div>:null}{!restrictedRole&&shareAlbum?<OrangeAlbumShareModal album={shareAlbum} members={members} busy={busy} error={error} onClose={()=>close(setShareAlbum)} onSave={async body=>{if(await run(()=>onShare(shareAlbum.id,body)))setShareAlbum(null);}}/>:null}{!restrictedRole&&optionsAlbum?<OrangeAlbumOptionsModal album={optionsAlbum} categories={categories} busy={busy} error={error} onClose={()=>close(setOptionsAlbum)} onSave={async payload=>{if(await run(()=>onSaveOptions(optionsAlbum,payload)))setOptionsAlbum(null);}}/>:null}{!restrictedRole&&deleteAlbum?<div className="od-modal-backdrop"><section className="od-modal"><div className="od-modal-body"><h2 className="od-modal-title">Eliminar álbum</h2><p>Se eliminará el álbum, pero sus fotos permanecerán en tu biblioteca.</p><div className="od-modal-actions"><button className="od-btn od-btn-secondary" type="button" onClick={()=>close(setDeleteAlbum)}>Cancelar</button><button className="od-btn od-btn-danger" type="button" disabled={busy} onClick={async()=>{if(await run(()=>onDelete(deleteAlbum.id)))setDeleteAlbum(null);}}>Eliminar álbum</button></div></div></section></div>:null}</div>;
}
