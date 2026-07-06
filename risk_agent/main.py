from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
import base64
import json
import os
from risk_agent.agent import run_pipeline

app = FastAPI()

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.post("/pubsub/push")
async def pubsub_push(request: Request):
    try:
        envelope = await request.json()
        message = envelope.get("message", {})
        data = message.get("data", "")

        # Decode base64 Pub/Sub message
        if data:
            decoded = base64.b64decode(data).decode("utf-8")
            payload = json.loads(decoded)
        else:
            return JSONResponse(
              status_code=400,
              content={"error": "No data in message"}
            )

        # Run the full ADK pipeline
        await run_pipeline(payload)

        # Return 200 to acknowledge the message
        # If we return non-200, Pub/Sub will retry
        return JSONResponse(
          status_code=200,
          content={"status": "processed"}
        )

    except Exception as e:
        # Return 200 anyway to avoid infinite Pub/Sub retries
        # on malformed messages — log the error instead
        print(f"Pipeline error: {e}")
        return JSONResponse(
          status_code=200,
          content={"status": "error", "detail": str(e)}
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0",
      port=int(os.environ.get("PORT", 8080)))
