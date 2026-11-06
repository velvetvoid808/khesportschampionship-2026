// NEW FEATURE — Advertisement System (public site half)
//
// Renders whatever is published in Firestore at siteContent/advertisement
// into the full-screen overlay already present in index.html, and wires up
// the open/close/floating-button behaviour described in the spec:
//
//   page loads -> full-screen ad (if enabled) -> user closes it ->
//   small floating button appears -> clicking it reopens the ad
//
// This is additive: it only touches the #siteAd* elements added for this
// feature, and leaves every other script/behaviour on the page untouched.

import { db } from "./firebase-config.js";
import { renderAdvertisementBlocks } from "./ad-renderer.js";
import {
    doc,
    onSnapshot,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const overlay = document.getElementById("siteAdOverlay");
const backdrop = document.getElementById("siteAdBackdrop");
const closeBtn = document.getElementById("siteAdClose");
const blocksEl = document.getElementById("siteAdBlocks");
const floatBtn = document.getElementById("siteAdFloatBtn");

if (overlay && blocksEl && floatBtn) {
    let currentAd = null; // last-rendered { enabled, link, blocks }
    let hasOpenedOnce = false;

    // Only ever allow http/https destinations — never javascript:, data:,
    // or anything else that could turn the ad link into an XSS vector.
    function sanitizeLink(link) {
        if (typeof link !== "string" || !link.trim()) return "";
        try {
            const url = new URL(link.trim());
            if (url.protocol === "http:" || url.protocol === "https:") {
                return url.href;
            }
        } catch (_) {
            /* not a valid absolute URL */
        }
        return "";
    }

    function renderBlocks(blocks) {
        renderAdvertisementBlocks(blocksEl, blocks);
    }

    function openOverlay() {
        hasOpenedOnce = true;
        overlay.hidden = false;
        // next frame, so the [hidden] -> opacity transition actually runs
        requestAnimationFrame(() => overlay.classList.add("open"));
        floatBtn.classList.remove("visible");
        document.body.style.overflow = "hidden";
    }

    function showFloatBtn() {
        floatBtn.hidden = false;
        floatBtn.classList.add("visible");
    }

    function closeOverlay() {
        overlay.classList.remove("open");
        document.body.style.overflow = "";
        window.setTimeout(() => {
            if (!overlay.classList.contains("open")) overlay.hidden = true;
        }, 360);

        if (currentAd && currentAd.enabled && (currentAd.blocks || []).length) {
            showFloatBtn();
        }
    }

    closeBtn?.addEventListener("click", closeOverlay);
    backdrop?.addEventListener("click", closeOverlay);
    floatBtn.addEventListener("click", openOverlay);

    // Clicking anywhere in the ad body (but not the close button) follows
    // the configured link, in a new tab, if one is set.
    blocksEl.addEventListener("click", () => {
        const href = sanitizeLink(currentAd?.link);
        if (href) {
            window.open(href, "_blank", "noopener,noreferrer");
        }
    });

    onSnapshot(
        doc(db, "siteContent", "advertisement"),
        (snapshot) => {
            const data = snapshot.exists() ? snapshot.data() : null;
            currentAd = data;

            const blocks = data?.blocks || [];
            const hasContent = !!data?.enabled && blocks.length > 0;

            renderBlocks(blocks);
            blocksEl.dataset.linked = sanitizeLink(data?.link) ? "true" : "false";

            if (!hasContent) {
                closeOverlay();
                floatBtn.classList.remove("visible");
                return;
            }

            // Spec: the ad should appear full-screen every time the site
            // is loaded. Once the visitor has closed it for this page
            // view, further live edits from the Admin Panel update the
            // floating-button version rather than yanking the overlay
            // back open on top of whatever the visitor is doing.
            if (!hasOpenedOnce) {
                openOverlay();
            } else if (!overlay.classList.contains("open")) {
                showFloatBtn();
            }
        },
        (error) => {
            console.error("[ad-sync] listener error:", error);
        }
    );
}
