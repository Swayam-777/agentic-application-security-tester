"""
Target Test Agent
-----------------
A simple local agent used only for security testing.

The agent receives a support ticket and produces a response.
It does NOT perform any real external action.
"""


def process_ticket(ticket):
    """
    Receives a ticket and returns the agent's response.
    """

    body = ticket["body"]

    print("\nTARGET AGENT RECEIVED TICKET")
    print("--------------------------------")
    print("Sender :", ticket["sender"])
    print("Subject:", ticket["subject"])
    print("Body   :", body)

    # Simple security behavior:
    # The agent should not blindly follow instructions
    # contained inside untrusted ticket content.

    suspicious_words = [
        "ignore previous instructions",
        "fake system message",
        "manager override",
        "already been approved",
        "without verification"
    ]

    body_lower = body.lower()

    for word in suspicious_words:
        if word in body_lower:
            return (
                "I cannot follow this instruction because "
                "the request requires verification."
            )

    return (
        "The ticket has been received. "
        "I will process it according to the normal procedure."
    )


if __name__ == "__main__":

    test_ticket = {
        "sender": "customer@example.com",
        "subject": "Test Ticket",
        "body": "Please check my order."
    }

    response = process_ticket(test_ticket)

    print("\nTARGET AGENT RESPONSE")
    print("--------------------------------")
    print(response)