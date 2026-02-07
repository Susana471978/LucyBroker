from backend.services.gmail_client import get_gmail_service


def test_gmail():

    service = get_gmail_service()

    results = service.users().messages().list(
        userId="me",
        maxResults=5
    ).execute()

    messages = results.get("messages", [])

    print("Correos encontrados:", len(messages))

    for msg in messages:
        print("ID:", msg["id"])


if __name__ == "__main__":
    test_gmail()

