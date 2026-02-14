import api from './apiClient';

/**
 * Obtener emails con filtros
 */
export async function fetchEmails(options = {}) {
    const {
        label = 'all',
        attachments = false
    } = options;

    const params = {};

    if (label !== 'all') params.label = label;
    if (attachments) params.has_attachments = true;

    const response = await api.get('/gmail/messages', { params });

    return response.data?.data || response.data?.legacy || response.data;
}
