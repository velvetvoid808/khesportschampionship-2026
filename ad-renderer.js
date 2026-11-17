const tagForType = {
    title: "h2",
    subtitle: "p",
    paragraph: "p",
};

const countdownTimers = new WeakMap();

function sanitizeLink(link) {
    if (typeof link !== "string" || !link.trim()) return "";
    try {
        const url = new URL(link.trim());
        return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
    } catch (_) {
        return "";
    }
}

function appendLinkedText(element, text, links) {
    const validLinks = (Array.isArray(links) ? links : [])
        .map((link) => ({ word: String(link?.text || "").trim(), url: sanitizeLink(link?.url) }))
        .filter((link) => link.word && link.url);
    if (!validLinks.length) {
        element.textContent = text || "";
        return;
    }

    const escapedWords = validLinks.map((link) => link.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const pattern = new RegExp(`(${escapedWords.join("|")})`, "gi");
    const urlByWord = new Map(validLinks.map((link) => [link.word.toLowerCase(), link.url]));
    let lastIndex = 0;

    for (const match of String(text || "").matchAll(pattern)) {
        const index = match.index;
        if (index > lastIndex) element.append(document.createTextNode(text.slice(lastIndex, index)));
        const anchor = document.createElement("a");
        anchor.className = "site-ad-text-link";
        anchor.href = urlByWord.get(match[0].toLowerCase());
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
        anchor.textContent = match[0];
        element.appendChild(anchor);
        lastIndex = index + match[0].length;
    }
    if (lastIndex < text.length) element.append(document.createTextNode(text.slice(lastIndex)));
}

function applyTextStyles(element, block) {
    if (!block.useGradient && block.color) element.style.color = block.color;
    if (block.fontFamily) element.style.fontFamily = block.fontFamily;
    if (block.fontSize) element.style.fontSize = `${Number(block.fontSize) || 16}px`;
    if (["left", "center", "right"].includes(block.textAlign)) element.style.textAlign = block.textAlign;
    if (Number.isFinite(Number(block.lineHeight)) && Number(block.lineHeight) > 0) {
        element.style.lineHeight = String(Number(block.lineHeight));
    }
    if (block.bold) element.style.fontWeight = "800";
    if (block.italic) element.style.fontStyle = "italic";
    if (block.underline) element.style.textDecoration = "underline";
}

export function renderAdvertisementBlocks(container, blocks) {
    const oldTimers = countdownTimers.get(container);
    if (Array.isArray(oldTimers)) oldTimers.forEach((timer) => window.clearInterval(timer));
    countdownTimers.delete(container);
    const timers = [];
    countdownTimers.set(container, timers);
    container.replaceChildren();

    (Array.isArray(blocks) ? blocks : []).forEach((block) => {
        if (!block || !block.type) return;

        if (block.type === "image") {
            if (!block.imageUrl) return;
            const img = document.createElement("img");
            img.className = "site-ad-block-image";
            img.src = block.imageUrl;
            img.alt = block.alt || "";
            const imageLink = sanitizeLink(block.linkUrl);
            if (imageLink) {
                const anchor = document.createElement("a");
                anchor.href = imageLink;
                anchor.target = "_blank";
                anchor.rel = "noopener noreferrer";
                anchor.appendChild(img);
                container.appendChild(anchor);
            } else {
                container.appendChild(img);
            }
            return;
        }

        if (block.type === "countdown") {
            const countdown = document.createElement("div");
            countdown.className = `site-ad-block-countdown${block.useGradient ? " is-gradient" : ""}`;
            applyTextStyles(countdown, block);

            const update = () => {
                const target = new Date(block.targetDate);
                const remaining = Number.isNaN(target.getTime()) ? 0 : target.getTime() - Date.now();
                if (remaining <= 0) {
                    countdown.textContent = block.expiredText || "Registration closed";
                    return;
                }

                const totalSeconds = Math.floor(remaining / 1000);
                const days = Math.floor(totalSeconds / 86400);
                const hours = Math.floor((totalSeconds % 86400) / 3600);
                const minutes = Math.floor((totalSeconds % 3600) / 60);
                const seconds = totalSeconds % 60;
                countdown.textContent = `${days}d ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
            };

            update();
            container.appendChild(countdown);
            timers.push(window.setInterval(update, 1000));
            return;
        }

        const tag = tagForType[block.type];
        if (!tag) return;

        const element = document.createElement(tag);
        element.className = `site-ad-block-${block.type}${block.useGradient ? " is-gradient" : ""}`;
        applyTextStyles(element, block);
        appendLinkedText(element, block.text || "", block.links);
        container.appendChild(element);
    });
}
