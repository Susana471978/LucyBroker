import api from './apiClient';

/* ===========================
   FETCH EMAILS
=========================== */
export async function fetchEmails(params = {}) {
    const res = await api.get('/gmail/messages', { params });

    if (res.data?.data && Array.isArray(res.data.data)) {
        return res.data.data;
    }

    if (Array.isArray(res.data)) {
        return res.data;
    }

    return [];
}

/* ===========================
   FETCH SINGLE EMAIL (full body)
=========================== */
export async function fetchMessageDetail(msgId) {
    const res = await api.get(`/gmail/message/${msgId}`);
    return res.data?.data || res.data;
}


/* ===========================
   GMAIL STATUS
=========================== */
export async function getGmailStatus() {
    const res = await api.get('/gmail/status');
    return res.data?.data || res.data;
}

/* ===========================
   GMAIL CONNECT
=========================== */
export async function connectGmail() {
    const res = await api.get('/gmail/auth');
    return res.data?.data?.auth_url || res.data?.auth_url;
}

/* ===========================
   GMAIL DISCONNECT
=========================== */
export async function disconnectGmail() {
    const res = await api.post('/gmail/disconnect');
    return res.data?.data || res.data;
}

