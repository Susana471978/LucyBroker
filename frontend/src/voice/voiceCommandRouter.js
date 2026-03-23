// src/voice/voiceCommandRouter.js

/**
 * Execute voice assistant actions safely.
 * @param {Array} actions - Actions returned by assistant
 * @param {Object} context - UI functions and state
 */
export function executeVoiceActions(actions = [], context = {}) {
    if (!Array.isArray(actions)) return;

    const {
        navigate,
        currentFilters,
        setFilters,
        openMessageById,
        clearFilters,
    } = context;

    // Limit to maximum 3 actions
    const safeActions = actions.slice(0, 3);

    safeActions.forEach((action) => {
        try {
            if (!action || typeof action !== "object") return;

            const { type, payload } = action;

            switch (type) {
                case "go_to":
                    handleGoTo(payload, navigate);
                    break;

                case "set_filter":
                    handleSetFilter(payload, currentFilters, setFilters);
                    break;

                case "clear_filters":
                    handleClearFilters(clearFilters);
                    break;

                case "open_message":
                    handleOpenMessage(payload, openMessageById);
                    break;

                default:
                    console.warn("Voice action ignored (unknown type):", type);
            }
        } catch (err) {
            console.warn("Voice action failed safely:", err);
        }
    });
}

/* -------------------- HANDLERS -------------------- */

function handleGoTo(payload, navigate) {
    if (!navigate || !payload) return;

    const allowedScreens = ["overview", "messages", "tasks", "habits", "settings", "pricing"];

    const screenMap = { overview: "/app", messages: "/app/messages", tasks: "/app/tasks", habits: "/app/habits", settings: "/app/settings", pricing: "/app/pricing" };

    if (allowedScreens.includes(payload.screen)) {
        navigate(screenMap[payload.screen] || `/app/${payload.screen}`);
    }

    function handleSetFilter(payload, currentFilters, setFilters) {
        if (!payload || !setFilters || !currentFilters) return;

        const allowedKeys = [
            "unread",
            "date",
            "priority",
            "from",
            "has_attachment",
        ];

        const patch = {};

        Object.keys(payload).forEach((key) => {
            if (allowedKeys.includes(key)) {
                patch[key] = payload[key];
            }
        });

        if (Object.keys(patch).length > 0) {
            setFilters({
                ...currentFilters,
                ...patch,
            });
        }
    }

    function handleClearFilters(clearFilters) {
        if (clearFilters) {
            clearFilters();
        }
    }

    function handleOpenMessage(payload, openMessageById) {
        if (!payload || !openMessageById) return;

        if (payload.id && typeof payload.id === "string") {
            openMessageById(payload.id);
        }
    }
}   