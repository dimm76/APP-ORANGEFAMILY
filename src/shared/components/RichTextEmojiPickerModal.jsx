import { IonIcon } from "@ionic/react";
import { OD_ICONS } from "../ui/odIcons.js";

const EMOJI_GROUPS = [
  {
    title: "Caras",
    emojis: ["😀", "😃", "😄", "😁", "😊", "🙂", "😉", "😍", "🥰", "😘", "😎", "🤩", "🤔", "😅", "😂", "🤣", "🥲", "😢", "😭", "😡"],
  },
  {
    title: "Gestos",
    emojis: ["👍", "👎", "👏", "🙌", "👌", "✌️", "🤞", "🤝", "🙏", "💪", "👋", "🤙", "☝️", "👇", "👉", "👈"],
  },
  {
    title: "Corazones y símbolos",
    emojis: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💔", "💕", "💯", "✅", "❌", "⚠️", "❓", "❗"],
  },
  {
    title: "Celebración",
    emojis: ["🎉", "🎊", "🥳", "🎂", "🎁", "🏆", "🥇","🥈","🥉", "🏅", "🎖️", "⭐", "🌟", "✨", "🔥", "🚀", "💥", "🎯"],
  },
  {
    title: "Familia y vida",
    emojis: ["👨‍👩‍👧‍👦", "👨", "👩", "👦", "👧", "👶", "🏠", "🚗", "✈️", "📷", "🎬", "📚", "📅", "📝", "💡", "🔔"],
  },
  {
    title: "Naturaleza y comida",
    emojis: ["☀️", "🌤️", "🌧️", "❄️", "🌈", "🌳", "🌸", "🐶", "🐱", "🍎", "🍕", "🍰", "☕", "🍷"],
  },
  {
    title: "Colores y estados",
    emojis: ["🔴", "🟠", "🟡", "🟢", "🔵", "🟣", "🟤", "⚫", "⚪", "🟥", "🟧", "🟨", "🟩", "🟦", "🟪", "🟫", "⬛", "⬜", "✅", "❌", "⚠️", "ℹ️"],
  },
  {
    title: "Indicadores",
    emojis: ["➡️", "⬅️", "⬆️", "⬇️", "↔️", "🔺", "🔻", "🔹", "🔸", "▪️", "▫️", "➕", "➖", "✔️", "❗", "❓", "📌", "🚩" ],
  },
];

export default function RichTextEmojiPickerModal({ open, onClose, onSelect }) {
  if (!open) return null;

  return (
    <div
      className="od-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="od-rich-emoji-picker-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <section className="od-modal od-rich-emoji-modal">
        <header className="od-modal-header">
          <div>
            <h2 id="od-rich-emoji-picker-title" className="od-modal-title">
              Insertar emoji
            </h2>
          </div>
          <button
            type="button"
            className="od-modal-close"
            onClick={onClose}
            aria-label="Cerrar selector de emojis"
          >
            <IonIcon icon={OD_ICONS.bulkExit} aria-hidden="true" />
          </button>
        </header>

        <div className="od-modal-body">
          <div className="od-rich-emoji-groups">
            {EMOJI_GROUPS.map((group) => (
              <section key={group.title} className="od-rich-emoji-group" aria-label={group.title}>
                <h3 className="od-rich-emoji-group__title">{group.title}</h3>
                <div className="od-rich-emoji-grid">
                  {group.emojis.map((emoji) => (
                    <button
                      key={`${group.title}-${emoji}`}
                      type="button"
                      className="od-rich-emoji-button"
                      title={`Insertar ${emoji}`}
                      aria-label={`Insertar ${emoji}`}
                      onClick={() => onSelect?.(emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
