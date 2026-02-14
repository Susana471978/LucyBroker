import api from './apiClient';

export async function callAssistant(text, token) {
    try {
        console.log("Calling assistant endpoint:", `${API}/assistant`);
        console.log("Payload:", { text });
        console.log("Auth header:", `Bearer ${token}`);
        const response = await axios.post(
            `${API}/assistant`,
            { text },
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );
        return response.data;
    } catch (error) {
        console.error("Assistant error FULL:", error);
        if (error.response) {
            console.error("Response data:", error.response.data);
            console.error("Status:", error.response.status);
        }
        throw error;
    }
}
