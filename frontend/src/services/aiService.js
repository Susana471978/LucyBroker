import api from './apiClient';

export async function summarizeEmail(emailId) {
    const res = await api.post('/ai/summarize', {
        email_id: emailId,
    });

    return res.data?.data?.summary || res.data?.summary;
}

export async function generateDraft(emailId, instructions) {
    const res = await api.post('/ai/draft-reply', {
        email_id: emailId,
        instructions,
    });

    return res.data?.data?.drafts || res.data?.drafts;
}
