import os
import time
import json
import base64
import httpx
import threading
from google.cloud import pubsub_v1
from google.api_core.exceptions import AlreadyExists, NotFound
from dotenv import load_dotenv

load_dotenv()

PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT") or os.getenv("PROJECT_ID", "ringed-tuner-499715-h9")
TOPIC_NAME = os.getenv("PUBSUB_TOPIC_NAME", "supply-chain-news")
SUBSCRIPTION_NAME = f"{TOPIC_NAME}-local-forward"
RISK_AGENT_URL = os.getenv("RISK_AGENT_URL", "http://127.0.0.1:8000/apps/risk_agent/trigger/pubsub")

forward_lock = threading.Lock()

def setup_subscription():
    subscriber = pubsub_v1.SubscriberClient()
    publisher = pubsub_v1.PublisherClient()
    
    topic_path = publisher.topic_path(PROJECT_ID, TOPIC_NAME)
    subscription_path = subscriber.subscription_path(PROJECT_ID, SUBSCRIPTION_NAME)
    
    # Ensure topic exists
    try:
        publisher.get_topic(topic=topic_path)
    except NotFound:
        print(f"Topic {TOPIC_NAME} not found. Creating it...")
        publisher.create_topic(request={"name": topic_path})
        
    # Ensure subscription exists
    try:
        subscriber.get_subscription(subscription=subscription_path)
        print(f"Using existing subscription: {subscription_path}")
    except NotFound:
        print(f"Creating subscription: {subscription_path}...")
        subscriber.create_subscription(
            request={"name": subscription_path, "topic": topic_path}
        )
        print("Subscription created.")
        
    return subscriber, subscription_path

def callback(message):
    with forward_lock:
        data_str = message.data.decode("utf-8")
        print(f"\n[PubSub Receiver] Received message ID: {message.message_id}")
        try:
            payload = json.loads(data_str)
            print(f"  Supplier: {payload.get('supplier_name')}")
        except Exception:
            print(f"  Raw data: {data_str[:100]}...")

        # Build standard push envelope format that the ADK Agent expects
        encoded_data = base64.b64encode(message.data).decode("utf-8")
        envelope = {
            "message": {
                "data": encoded_data,
                "messageId": message.message_id,
                "publishTime": message.publish_time.isoformat() if hasattr(message, 'publish_time') else ""
            }
        }

        # Forward to local Risk Agent trigger endpoint
        try:
            resp = httpx.post(
                RISK_AGENT_URL,
                json=envelope,
                headers={"Content-Type": "application/json"},
                timeout=120.0
            )
            if resp.status_code == 200:
                print(f"  -> Forwarded to Risk Agent: SUCCESS (200)")
            else:
                print(f"  -> Forwarded to Risk Agent: FAILED ({resp.status_code}) - {resp.text}")
            
            # Always acknowledge to clear from local queue and prevent infinite redeliveries
            message.ack()
        except Exception as e:
            print(f"  -> Error forwarding: {e}")
            message.ack()
        
        # Add 1.5 second pause between concurrent local deliveries to let sqlite3 unlock
        time.sleep(1.5)

def main():
    print(f"Project ID: {PROJECT_ID}")
    print(f"Target Topic: {TOPIC_NAME}")
    
    subscriber, subscription_path = setup_subscription()
    
    # ─── Purge old backlog messages ──────────────────────────────────────────
    print("Checking for old backlog messages in Pub/Sub subscription...", end=" ")
    purged_count = 0
    try:
        # Pull up to 200 messages to clear the backlog queue
        pull_response = subscriber.pull(
            request={
                "subscription": subscription_path,
                "max_messages": 200,
                "return_immediately": True
            },
            timeout=5.0
        )
        ack_ids = [msg.ack_id for msg in pull_response.received_messages]
        if ack_ids:
            subscriber.acknowledge(
                request={
                    "subscription": subscription_path,
                    "ack_ids": ack_ids
                }
            )
            purged_count = len(ack_ids)
            print(f"purged {purged_count} old messages.")
        else:
            print("none found.")
    except Exception as e:
        print(f"skipped (could not purge: {e})")
    
    print(f"\nListening for messages on {SUBSCRIPTION_NAME}...")
    print(f"Forwarding messages to local Risk Agent at: {RISK_AGENT_URL}")
    print("Press Ctrl+C to stop.\n")
    
    streaming_pull_future = subscriber.subscribe(subscription_path, callback=callback)
    
    try:
        # Keep main thread alive
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        streaming_pull_future.cancel()
        streaming_pull_future.result()
        print("\nStopped forwarding.")

if __name__ == "__main__":
    main()
