"""
Modal Labs: Train SENTINEL-X model on A100
Deploy as serverless function with automatic scaling
"""

import modal, torch, json, os
from pathlib import Path
from transformers import AutoModelForCausalLM, AutoTokenizer, TrainingArguments, Trainer
from datasets import Dataset


app = modal.App("sentinel-x-training")


# Define GPU requirement (A100 for large batches, T4 for cost saving)
gpu_config = modal.gpu.A100(count=1)  # Remove count=1 for T4


# Create persistent volume for dataset storage
volume = modal.Volume.from_name("sentinel-x-data", create_if_missing=True)


@app.function(
    gpu=gpu_config,
    timeout=3600,  # 1-hour timeout
    volumes={"/data": volume}  # Mount persistent volume
)
def train_sentinel_x_model(epochs: int = 10, batch_size: int = 8):
    """Train SENTINEL-X on A100 GPU with persistent data"""
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer, TrainingArguments, Trainer
    from datasets import Dataset
    
    print("🚀 Training on A100 GPU")
    print(f"CUDA available: {torch.cuda.is_available()}")
    print(f"GPU: {torch.cuda.get_device_name(0)}")
    
    # Load data from persistent volume
    data_path = Path("/data/sentinel_x_processed_v2.json")
    if not data_path.exists():
        raise RuntimeError("Training data not found in /data")
    with open(data_path) as f:
        training_data = json.load(f)
    
    # Convert to Hugging Face Dataset
    dataset = Dataset.from_list(training_data)
    
    # Load model
    model = AutoModelForCausalLM.from_pretrained(
        "meta-llama/Llama-2-13b-hf",
        torch_dtype=torch.float16,
        device_map="auto",
    )
    tokenizer = AutoTokenizer.from_pretrained("meta-llama/Llama-2-13b-hf")
    
    # Training arguments (optimized for A100)
    training_args = TrainingArguments(
        output_dir="/data/sentinel-x-a100-v1",
        num_train_epochs=epochs,
        per_device_train_batch_size=batch_size,
        learning_rate=2e-4,
        fp16=True,
        logging_steps=10,
        save_steps=100,
        evaluation_strategy="steps",
        eval_steps=50,
        load_best_model_at_end=True,
        gradient_checkpointing=True,
        report_to="none"
    )
    
    trainer = Trainer(model=model, args=training_args, train_dataset=dataset)
    trainer.train()
    
    # Save model to persistent volume
    model.save_pretrained("/data/sentinel-x-a100-v1")
    tokenizer.save_pretrained("/data/sentinel-x-a100-v1")
    print("✅ Model saved to /data")
    
    return {
        "status": "completed",
        "model_path": "/data/sentinel-x-a100-v1",
        "epochs": epochs,
        "batch_size": batch_size
    }


@app.local_entrypoint()
def main():
    """Run training with default parameters"""
    result = train_sentinel_x_model.remote(
        epochs=10,
        batch_size=8
    )
    print(f"✅ Training result: {result}")
