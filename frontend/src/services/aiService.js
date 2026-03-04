import api from './apiClient';

export async function summarizeEmail(emailId) {
    const res = await api.post('/ai/summarize', {
        email_id: emailId,
    });

    // El backend puede devolver { summary: "..." } o { data: { summary: "..." } }
    return (
        res.data?.data?.summary ||
        res.data?.summary ||
        null
    );
}

export async function generateDraft(emailId, instructions) {
    const res = await api.post('/ai/draft-reply', {
        email_id: emailId,
        instructions,
    });

    // El backend puede devolver { drafts: [...] } o { data: { drafts: [...] } }
    return (
        res.data?.data?.drafts ||
        res.data?.drafts ||
        []
    );
}