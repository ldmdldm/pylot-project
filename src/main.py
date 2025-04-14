from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Optional
from intent_processor import IntentProcessor
import uvicorn

app = FastAPI(title="Intent-Based Transaction System")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize intent processor
intent_processor = IntentProcessor()

@app.get("/health")
async def health_check():
    """Health check endpoint to verify the service is running."""
    return {"status": "healthy"}

class Intent(BaseModel):
    user: str
    amount: float
    targetToken: str
    targetChain: str
    minAmountOut: Optional[float]
    deadline: Optional[int]

@app.post("/process-intent")
async def process_intent(intent: Intent):
    try:
        result = await intent_processor.process_intent(intent.dict())
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/transaction/{tx_hash}")
async def get_transaction_status(tx_hash: str):
    try:
        status = await intent_processor.monitor_transaction(tx_hash)
        return status
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
