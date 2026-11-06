const tagForType = {
    title: "h2",
    subtitle: "p",
    paragraph: "p",
};

export function renderAdvertisementBlocks(container, blocks) {
    container.replaceChildren();

    (Array.isArray(blocks) ? blocks : []).forEach((block) => {
        if (!block || !block.type) return;

        if (block.type === "image") {
            if (!block.imageUrl) return;
            const img = document.createElement("img");
            img.className = "site-ad-block-image";
            img.src = block.imageUrl;
            img.alt = block.alt || "";
            container.appendChild(img);
            return;
        }

        const tag = tagForType[block.type];
        if (!tag) return;

        const element = document.createElement(tag);
        element.className = `site-ad-block-${block.type}${block.useGradient ? " is-gradient" : ""}`;
        element.textContent = block.text || "";

        if (!block.useGradient && block.color) {
            element.style.color = block.color;
        }
        if (block.fontFamily) {
            element.style.fontFamily = block.fontFamily;
        }
        if (block.fontSize) {
            element.style.fontSize = `${Number(block.fontSize) || 16}px`;
        }
        if (["left", "center", "right"].includes(block.textAlign)) {
            element.style.textAlign = block.textAlign;
        }
        if (Number.isFinite(Number(block.lineHeight)) && Number(block.lineHeight) > 0) {
            element.style.lineHeight = String(Number(block.lineHeight));
        }
        if (block.bold) {
            element.style.fontWeight = "800";
        }
        if (block.italic) {
            element.style.fontStyle = "italic";
        }
        if (block.underline) {
            element.style.textDecoration = "underline";
        }

        container.appendChild(element);
    });
}
