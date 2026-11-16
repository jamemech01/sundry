function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[char];
  });
}

export function createShopIcon(name: string, isOwner: boolean) {
  const color = isOwner
    ? {
        border: "#DDD6FE",
        background: "#F5F3FF",
        text: "#5B21B6",
        accent: "#8B5CF6",
      }
    : {
        border: "#BFDBFE",
        background: "#EFF6FF",
        text: "#1D4ED8",
        accent: "#3B82F6",
      };

  const element = document.createElement("div");

  element.style.cssText = `
        width:176px;
        height:62px;
        box-sizing:border-box;
        font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
        cursor:pointer;
    `;

  element.innerHTML = `
        <div style="
            position:absolute;
            top:0;
            left:0;
            display:flex;
            flex-direction:column;
            width:176px;
            height:44px;
            box-sizing:border-box;
            overflow:hidden;
            background:${color.background};
            border:1px solid ${color.border};
            border-radius:12px;
            box-shadow:0 2px 8px rgba(15,23,42,.10);
        ">
            <div style="height:5px;flex:none;background:${color.accent}"></div>
            <div style="
                display:flex;
                flex:1;
                min-height:0;
                align-items:center;
                gap:10px;
                padding:0 12px;
            ">
                <span style="display:flex;flex:none;color:${color.text}">
                    <svg width="18" height="18" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" stroke-width="2"
                        stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 10l2-6h14l2 6"/>
                        <path d="M4 10v10h16V10"/>
                        <path d="M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/>
                        <path d="M9 20v-5h6v5"/>
                    </svg>
                </span>
                <span style="
                    display:block;
                    flex:1;
                    min-width:0;
                    overflow:hidden;
                    text-overflow:ellipsis;
                    white-space:nowrap;
                    color:${color.text};
                    font-size:12px;
                    font-weight:600;
                    line-height:1.25;
                ">${escapeHtml(name)}</span>
            </div>
        </div>
        <div style="
            position:absolute;
            left:87px;
            top:44px;
            width:2px;
            height:8px;
            background:${color.accent};
        "></div>
        <div style="
            position:absolute;
            left:83px;
            top:50px;
            width:10px;
            height:10px;
            box-sizing:border-box;
            background:${color.accent};
            border:2px solid white;
            border-radius:50%;
            box-shadow:0 1px 3px rgba(15,23,42,.25);
        "></div>
    `;

  return element;
}

export function createDeliveryMarker() {
  const element = document.createElement("div");

  element.style.cssText = `
        width:44px;
        height:54px;
        filter:drop-shadow(0 3px 5px rgba(15,23,42,.28));
    `;

  element.innerHTML = `
        <svg width="44" height="54" viewBox="0 0 44 54"
            fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
                d="M22 2C10.95 2 2 10.95 2 22c0 13 20 30 20 30s20-17 20-30C42 10.95 33.05 2 22 2Z"
                fill="#2563EB"
                stroke="white"
                stroke-width="3"
                stroke-linejoin="round"
            />
            <circle cx="22" cy="22" r="8" fill="white"/>
            <circle cx="22" cy="22" r="3.5" fill="#2563EB"/>
        </svg>
    `;

  return element;
}
