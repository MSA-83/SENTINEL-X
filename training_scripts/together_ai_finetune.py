"""
Together.ai: Fine-tune LLMs for FREE
No GPU needed - cloud-hosted
"""

from together import Together
import json
import time
import os

client = Together(api_key=os.getenv("TOGETHER_API_KEY"))


# Prepare training data
training_data = [
    {
        "text": "Classify this aircraft: velocity=450knots, altitude=35000ft. Answer: normal"
    },
    {
        "text": "Entity at 100ft moving 50knots. Answer: suspicious"
    },
    # ... 50+ examples
]


# Start fine-tuning
print("🚀 Starting fine-tuning on Together.ai...")

response = client.fine_tuning.create(
    training_data=training_data,
    model="togethercomputer/Llama-2-7b",  # FREE
    epochs=3,
    batch_size=4,
    learning_rate=1e-4,
    max_steps=100
)

job_id = response["job_id"]
print(f"Job ID: {job_id}")

# Poll for completion
while True:
    status = client.fine_tuning.get_status(job_id)
    
    if status["status"] == "completed":
        print("✅ Fine-tuning complete!")
        print(f"Model: {status['model_id']}")
        break
    
    elif status["status"] == "failed":
        print(f"❌ Failed: {status['error']}")
        break
    
    print(f"Status: {status['status']} ({status['progress']}%)")
    time.sleep(30)


# Use fine-tuned model
output = client.complete.create(
    model=status["model_id"],
    prompt="Classify this aircraft: velocity=450knots",
    max_tokens=50
)

print(output)
