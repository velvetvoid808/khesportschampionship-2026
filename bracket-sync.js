// Live-syncs real team names from Firestore onto the public Tournament
// Brackets section and renders click-to-open match details from the same data.
import { db } from "./firebase-config.js";
import {
    doc,
    onSnapshot,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const GAMES = ["hok", "mlbb"];
const GAME_LABELS = {
    hok: "HONOR OF KINGS",
    mlbb: "MOBILE LEGENDS",
};
const GROUP_MATCHES = [[0, 1], [2, 3], [0, 2], [1, 3], [0, 3], [1, 2]];
const GROUP_LETTERS = ["A", "B", "C", "D"];
const BEST_OF = {
    r16: 3,
    qf1: 3,
    qf2: 3,
    qf3: 3,
    qf4: 3,
    sf1: 5,
    sf2: 5,
    final: 7,
};

const bracketState = Object.fromEntries(
    GAMES.map((game) => [game, { loaded: false, data: null }])
);
const modal = document.getElementById("bracketDetailsModal");
const modalTitle = document.getElementById("bracketDetailsTitle");
const modalEyebrow = document.getElementById("bracketDetailsEyebrow");
const modalContent = document.getElementById("bracketDetailsContent");
const closeButton = modal?.querySelector(".bracket-details-close");
let activeDetail = null;
let opener = null;
let closeTimer = null;

function createElement(tagName, className, text) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
}

function appendNote(text) {
    modalContent.append(createElement("p", "bracket-detail-note", text));
}

function appendDetailRow(label, matchup, result, resultClass) {
    const row = createElement("article", "bracket-detail-row");
    row.append(createElement("h3", "", label));
    if (matchup) row.append(createElement("p", "bracket-detail-matchup", matchup));
    if (result) {
        row.append(createElement(
            "p",
            `bracket-detail-result${resultClass ? ` ${resultClass}` : ""}`,
            result
        ));
    }
    modalContent.append(row);
}

function hasParticipatingTeams(data) {
    return GROUP_LETTERS.some((letter) =>
        [0, 1, 2, 3].some((index) => {
            const value = data[`group${letter}:${index}`];
            return typeof value === "string" && value.trim() !== "" && value.trim() !== "BYE";
        })
    );
}

function getGroupTeam(data, letter, index) {
    const value = data[`group${letter}:${index}`];
    if (typeof value === "string" && value.trim() && value.trim() !== "BYE") {
        return value.trim();
    }

    if (data[`group${letter}:roster-confirmed`] === "1") {
        return hasParticipatingTeams(data) ? "BYE" : "No team entered";
    }
    return "Roster pending";
}

function renderGroupFixture(data, letter, matchIndex) {
    const [indexA, indexB] = GROUP_MATCHES[matchIndex];
    const teamA = getGroupTeam(data, letter, indexA);
    const teamB = getGroupTeam(data, letter, indexB);
    const noTeamsEntered = teamA === "No team entered" && teamB === "No team entered";
    const hasBye = teamA === "BYE" || teamB === "BYE";
    const hasPendingRoster = teamA === "Roster pending" || teamB === "Roster pending";
    const winner = data[`group${letter}:match:${matchIndex}:winner`];
    let result;
    let resultClass = "";

    if (noTeamsEntered) {
        result = "No match played — no teams entered.";
    } else if (hasBye) {
        result = "No match played — BYE.";
    } else if (hasPendingRoster) {
        result = "Awaiting roster confirmation.";
    } else if (winner === "0" || winner === "1") {
        result = `Winner: ${winner === "0" ? teamA : teamB}`;
        resultClass = "is-winner";
    } else {
        result = "Result not recorded yet.";
    }

    appendDetailRow(
        `MATCH ${matchIndex + 1}`,
        `${teamA}  vs  ${teamB}`,
        result,
        resultClass
    );
}

function renderGroupDetails(game, letter) {
    const state = bracketState[game];
    modalEyebrow.textContent = GAME_LABELS[game];
    modalTitle.textContent = `GROUP ${letter} MATCHUPS`;

    if (!state.loaded) {
        appendNote("Bracket data is still loading. Please try again in a moment.");
        return;
    }
    if (!state.data) {
        appendNote("No bracket data has been published yet.");
        return;
    }

    const data = state.data;
    GROUP_MATCHES.forEach((_, matchIndex) => {
        renderGroupFixture(data, letter, matchIndex);
    });
}

function renderTeamDetails(game, letter, teamIndex) {
    const state = bracketState[game];
    modalEyebrow.textContent = `${GAME_LABELS[game]} · GROUP ${letter}`;

    if (!state.loaded) {
        modalTitle.textContent = "TEAM MATCHUPS";
        appendNote("Bracket data is still loading. Please try again in a moment.");
        return;
    }
    if (!state.data) {
        modalTitle.textContent = "TEAM MATCHUPS";
        appendNote("No bracket data has been published yet.");
        return;
    }

    const data = state.data;
    const teamName = getGroupTeam(data, letter, teamIndex);
    modalTitle.textContent = teamName === "Roster pending" ? "TEAM MATCHUPS" : teamName;
    if (teamName === "BYE" || teamName === "No team entered") {
        appendNote("BYE and empty slots are not participating teams, so no team matchups are available.");
        return;
    }
    if (teamName === "Roster pending") {
        appendNote("This team's name is waiting for the group roster to be confirmed.");
        return;
    }

    GROUP_MATCHES.forEach(([indexA, indexB], matchIndex) => {
        if (indexA === teamIndex || indexB === teamIndex) {
            renderGroupFixture(data, letter, matchIndex);
        }
    });
}

function knockoutScoreKey(round, matchIndex) {
    return round === "r16"
        ? `r16:score:${matchIndex}`
        : `${round}:score`;
}

function renderKnockoutDetails(game, round, matchIndex, matchLabel) {
    const state = bracketState[game];
    modalEyebrow.textContent = `${GAME_LABELS[game]} · KNOCKOUT STAGE`;
    modalTitle.textContent = matchLabel;

    if (!state.loaded) {
        appendNote("Bracket data is still loading. Please try again in a moment.");
        return;
    }
    if (!state.data) {
        appendNote("No bracket data has been published yet.");
        return;
    }

    const data = state.data;
    if (data["bracket:ready"] !== "1") {
        appendNote("This matchup is waiting for the group-stage results to be completed.");
        return;
    }

    const slotKey = round === "r16" ? `r16:${matchIndex * 2}` : `${round}:0`;
    const teamA = typeof data[slotKey] === "string" ? data[slotKey].trim() : "";
    const teamBKey = round === "r16" ? `r16:${matchIndex * 2 + 1}` : `${round}:1`;
    const teamB = typeof data[teamBKey] === "string" ? data[teamBKey].trim() : "";

    if (!teamA && !teamB) {
        appendNote("No participating teams are assigned to this matchup.");
        return;
    }
    if (teamA === "BYE" && teamB === "BYE") {
        appendNote("No teams are assigned to this matchup. No games were played.");
        return;
    }
    if (teamA === "BYE" || teamB === "BYE") {
        const advancingTeam = teamA === "BYE" ? teamB : teamA;
        if (advancingTeam) {
            appendNote(`${advancingTeam} advances automatically. No games are played for a BYE.`);
        } else {
            appendNote("This matchup has no participating team. No games were played.");
        }
        return;
    }
    if (!teamA || !teamB) {
        appendNote("One or both teams have not been assigned. No game result is available.");
        return;
    }

    const bestOf = BEST_OF[round];
    modalEyebrow.textContent = `${GAME_LABELS[game]} · BEST OF ${bestOf}`;
    const scoreKey = knockoutScoreKey(round, matchIndex);
    let winsA = 0;
    let winsB = 0;
    let gamesPlayed = 0;
    let previousGamePending = false;
    const winsNeeded = Math.floor(bestOf / 2) + 1;

    for (let gameIndex = 0; gameIndex < bestOf; gameIndex += 1) {
        if (previousGamePending) {
            appendDetailRow(
                `GAME ${gameIndex + 1}`,
                `${teamA}  vs  ${teamB}`,
                "Not played yet — waiting for the previous game result."
            );
            continue;
        }
        if (winsA >= winsNeeded || winsB >= winsNeeded) {
            appendDetailRow(
                `GAME ${gameIndex + 1}`,
                `${teamA}  vs  ${teamB}`,
                "Not played — the series was already decided."
            );
            continue;
        }

        const winner = data[`${scoreKey}:game:${gameIndex}`];
        if (winner === "0" || winner === "1") {
            gamesPlayed += 1;
            previousGamePending = false;
            if (winner === "0") winsA += 1;
            else winsB += 1;
            appendDetailRow(
                `GAME ${gameIndex + 1}`,
                `${teamA}  vs  ${teamB}`,
                `Winner: ${winner === "0" ? teamA : teamB}`,
                "is-winner"
            );
        } else {
            appendDetailRow(
                `GAME ${gameIndex + 1}`,
                `${teamA}  vs  ${teamB}`,
                "Result not recorded yet."
            );
            previousGamePending = true;
        }
    }

    if (gamesPlayed > 0) {
        const seriesWinner = winsA >= winsNeeded ? ` · ${teamA} wins` :
            winsB >= winsNeeded ? ` · ${teamB} wins` : "";
        modalContent.prepend(
            createElement(
                "p",
                "bracket-detail-series",
                `Series score: ${teamA} ${winsA} – ${winsB} ${teamB}${seriesWinner}`
            )
        );
    }
}

function renderActiveDetails() {
    if (!modal || !activeDetail) return;
    modalContent.replaceChildren();

    if (activeDetail.type === "group") {
        renderGroupDetails(activeDetail.game, activeDetail.letter);
    } else if (activeDetail.type === "team") {
        renderTeamDetails(activeDetail.game, activeDetail.letter, activeDetail.teamIndex);
    } else {
        renderKnockoutDetails(
            activeDetail.game,
            activeDetail.round,
            activeDetail.matchIndex,
            activeDetail.matchLabel
        );
    }
}

function openDetails(detail, trigger) {
    if (!modal || !modalTitle || !modalEyebrow || !modalContent) return;
    const wasClosing = Boolean(closeTimer);
    if (closeTimer) {
        window.clearTimeout(closeTimer);
        closeTimer = null;
    }

    if (modal.hidden) {
        opener = trigger;
        modal.hidden = false;
        modal.setAttribute("aria-hidden", "false");
        document.documentElement.classList.add("bracket-details-open");
        document.body.classList.add("bracket-details-open");
    } else if (wasClosing) {
        opener = trigger;
    }

    activeDetail = detail;
    renderActiveDetails();
    modal.classList.add("open");
    closeButton?.focus();
}

function closeDetails() {
    if (!modal || modal.hidden || !modal.classList.contains("open")) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    activeDetail = null;

    closeTimer = window.setTimeout(() => {
        modal.hidden = true;
        document.documentElement.classList.remove("bracket-details-open");
        document.body.classList.remove("bracket-details-open");
        closeTimer = null;
        if (opener && typeof opener.focus === "function") opener.focus();
        opener = null;
    }, 250);
}

function openGroupCard(card) {
    const [game, letter] = card.dataset.groupDetails.split(":");
    openDetails(
        { type: "group", game, letter },
        card.querySelector(".group-details-trigger") || card
    );
}

function openTeamButton(button) {
    const [game, letter, teamIndex] = button.dataset.teamDetails.split(":");
    openDetails({ type: "team", game, letter, teamIndex: Number(teamIndex) }, button);
}

function openKnockoutCard(card) {
    const [game, round, matchIndex] = card.dataset.matchDetails.split(":");
    const matchLabel = card.querySelector("span")?.textContent.trim() || "KNOCKOUT MATCH";
    openDetails(
        { type: "knockout", game, round, matchIndex: Number(matchIndex), matchLabel },
        card
    );
}

document.querySelectorAll("[data-match-details]").forEach((card) => {
    const label = card.querySelector("span")?.textContent.trim() || "knockout match";
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.setAttribute("aria-label", `View ${label} game results`);
});

document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const teamButton = target.closest("[data-team-details]");
    if (teamButton) {
        openTeamButton(teamButton);
        return;
    }

    const groupCard = target.closest("[data-group-details]");
    if (groupCard) {
        openGroupCard(groupCard);
        return;
    }

    const matchCard = target.closest("[data-match-details]");
    if (matchCard) openKnockoutCard(matchCard);

    if (target.closest("[data-close-bracket-details]")) closeDetails();
});

document.addEventListener("keydown", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (
        target &&
        target.matches("[data-match-details]") &&
        (event.key === "Enter" || event.key === " ")
    ) {
        event.preventDefault();
        openKnockoutCard(target);
        return;
    }

    if (!modal || modal.hidden) return;
    if (event.key === "Escape") {
        closeDetails();
        return;
    }
    if (event.key === "Tab") {
        event.preventDefault();
        closeButton?.focus();
    }
});

GAMES.forEach((game) => {
    const ref = doc(db, "brackets", game);
    document.querySelectorAll(`[data-slot^="${game}:"]`).forEach((slot) => {
        slot.dataset.originalSlotText = slot.textContent.trim();
    });

    onSnapshot(
        ref,
        (snapshot) => {
            bracketState[game] = {
                loaded: true,
                data: snapshot.exists() ? snapshot.data() : null,
            };
            if (!snapshot.exists()) {
                if (activeDetail?.game === game) renderActiveDetails();
                return;
            }

            const data = snapshot.data();
            Object.keys(data).forEach((key) => {
                const selector = `[data-slot="${game}:${key}"]`;
                const el = document.querySelector(selector);
                if (!el) return;

                const value = data[key];
                const groupSlot = key.match(/^group([A-D]):[0-3]$/);
                const isKnockoutSlot = /^(r16:|qf[1-4]:|sf[1-2]:|final:|champion$)/.test(key);
                if (isKnockoutSlot && data["bracket:ready"] !== "1") {
                    el.textContent = el.dataset.originalSlotText || "";
                } else if (
                    value === "BYE" &&
                    groupSlot &&
                    data[`group${groupSlot[1]}:roster-confirmed`] !== "1"
                ) {
                    el.textContent = "";
                } else if (typeof value === "string") {
                    el.textContent = value.trim();
                } else if (el.dataset.originalSlotText) {
                    el.textContent = el.dataset.originalSlotText;
                }
            });

            if (activeDetail?.game === game) renderActiveDetails();
        },
        (error) => {
            console.error(`[bracket-sync] ${game} listener error:`, error);
        }
    );
});
