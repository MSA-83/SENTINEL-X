"""
SENTINEL-X PRODUCTION ML PIPELINE
- DVC for data/ model versioning
- MLflow for experiment tracking
- BiLSTM+Attention for entity classification
- Hyperparameter tuning with Optuna
- ONNX export for cross-platform deployment
- Hugging Face Hub push for model hosting
"""

import os
import mlflow
import mlflow.pytorch
import optuna
import pandas as pd
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.model_selection import train_test_split
from pathlib import Path
import joblib
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration
CONFIG = {
    "data": {
        "path": "datasets/processed/sentinel_training_combined.parquet",
        "test_size": 0.2,
        "val_size": 0.1,
        "features": ["lat", "lon", "baro_altitude_m", "velocity_ms", 
                     "true_track", "vertical_rate_ms", "signal_strength"]
    },
    "model": {
        "input_dim": 7,  # len(features)
        "hidden_dim": 128,
        "num_layers": 2,
        "output_dim": 3,  # normal, suspicious, anomaly
        "epochs": 20,
        "batch_size": 64,
        "learning_rate": 1e-4
    },
    "optuna": {
        "n_trials": 50,
        "timeout": 3600  # 1 hour
    },
    "huggingface": {
        "repo_name": "yourusername/sentinel-x-entity-classifier",
        "model_name": "sentinel-x-v2"
    }
}

mlflow.set_tracking_uri("mlruns")
mlflow.set_experiment("sentinel-x-production")


class EntityDataset(Dataset):
    """Custom dataset for entity classification"""
    def __init__(self, features: np.ndarray, labels: np.ndarray):
        self.features = torch.tensor(features, dtype=torch.float32)
        self.labels = torch.tensor(labels, dtype=torch.long)

    def __len__(self):
        return len(self.features)

    def __getitem__(self, idx):
        return self.features[idx], self.labels[idx]


class BiLSTMAttention(nn.Module):
    """Production BiLSTM with Attention for sequence classification"""
    def __init__(self, input_dim: int, hidden_dim: int, num_layers: int, output_dim: int):
        super().__init__()
        self.lstm = nn.LSTM(input_dim, hidden_dim, num_layers, bidirectional=True, batch_first=True)
        self.attention = nn.Sequential(
            nn.Linear(hidden_dim * 2, hidden_dim),
            nn.Tanh(),
            nn.Linear(hidden_dim, 1)
        )
        self.fc = nn.Linear(hidden_dim * 2, output_dim)
        self.dropout = nn.Dropout(0.3)

    def forward(self, x):
        # x: (batch, input_dim) → (batch, 1, input_dim) for sequence processing
        x = x.unsqueeze(1)
        lstm_out, _ = self.lstm(x)
        attn_weights = torch.softmax(self.attention(lstm_out), dim=1)
        weighted_out = torch.sum(lstm_out * attn_weights, dim=1)
        weighted_out = self.dropout(weighted_out)
        return self.fc(weighted_out)


def preprocess_data():
    """Load and preprocess combined dataset"""
    df = pd.read_parquet(CONFIG["data"]["path"])
    
    # Handle missing values
    features_df = df[CONFIG["data"]["features"]].copy()
    features_df = features_df.fillna(features_df.mean())
    
    # Scale features
    scaler = StandardScaler()
    scaled_features = scaler.fit_transform(features_df)
    
    # Encode labels
    le = LabelEncoder()
    labels = le.fit_transform(df["label"].fillna("unknown"))
    
    # Stratified split
    X_train, X_test, y_train, y_test = train_test_split(
        scaled_features, labels, test_size=CONFIG["data"]["test_size"], stratify=labels
    )
    X_train, X_val, y_train, y_val = train_test_split(
        X_train, y_train, test_size=CONFIG["data"]["val_size"], stratify=y_train
    )
    
    # Save preprocessing artifacts
    Path("models").mkdir(exist_ok=True)
    joblib.dump(scaler, "models/scaler.joblib")
    joblib.dump(le, "models/label_encoder.joblib")
    
    return (X_train, y_train), (X_val, y_val), (X_test, y_test), scaler, le


def train_epoch(model, loader, criterion, optimizer, device):
    model.train()
    total_loss = 0
    correct = 0
    total = 0
    for features, labels in loader:
        features, labels = features.to(device), labels.to(device)
        optimizer.zero_grad()
        outputs = model(features)
        loss = criterion(outputs, labels)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
        optimizer.step()
        total_loss += loss.item()
        _, predicted = torch.max(outputs.data, 1)
        total += labels.size(0)
        correct += (predicted == labels).sum().item()
    return total_loss / len(loader), correct / total


def eval_epoch(model, loader, criterion, device):
    model.eval()
    total_loss = 0
    correct = 0
    total = 0
    with torch.no_grad():
        for features, labels in loader:
            features, labels = features.to(device), labels.to(device)
            outputs = model(features)
            loss = criterion(outputs, labels)
            total_loss += loss.item()
            _, predicted = torch.max(outputs.data, 1)
            total += labels.size(0)
            correct += (predicted == labels).sum().item()
    return total_loss / len(loader), correct / total


def objective(trial):
    """Optuna objective for hyperparameter tuning"""
    with mlflow.start_run():
        # Suggest hyperparameters
        hidden_dim = trial.suggest_int("hidden_dim", 64, 256)
        num_layers = trial.suggest_int("num_layers", 1, 3)
        lr = trial.suggest_float("learning_rate", 1e-5, 1e-3, log=True)
        batch_size = trial.suggest_int("batch_size", 32, 128)
        
        # Log params
        mlflow.log_params({
            "hidden_dim": hidden_dim,
            "num_layers": num_layers,
            "learning_rate": lr,
            "batch_size": batch_size
        })
        
        # Preprocess data
        train_data, val_data, _, _, _ = preprocess_data()
        
        # Create loaders
        train_loader = DataLoader(
            EntityDataset(train_data[0], train_data[1]), batch_size=batch_size, shuffle=True
        )
        val_loader = DataLoader(
            EntityDataset(val_data[0], val_data[1]), batch_size=batch_size
        )
        
        # Initialize model
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        model = BiLSTMAttention(
            CONFIG["model"]["input_dim"], hidden_dim, num_layers, CONFIG["model"]["output_dim"]
        ).to(device)
        criterion = nn.CrossEntropyLoss()
        optimizer = torch.optim.Adam(model.parameters(), lr=lr)
        
        # Train
        best_val_acc = 0
        for epoch in range(CONFIG["model"]["epochs"]):
            train_loss, train_acc = train_epoch(model, train_loader, criterion, optimizer, device)
            val_loss, val_acc = eval_epoch(model, val_loader, criterion, device)
            
            mlflow.log_metrics({
                "train_loss": train_loss,
                "train_acc": train_acc,
                "val_loss": val_loss,
                "val_acc": val_acc
            }, step=epoch)
            
            if val_acc > best_val_acc:
                best_val_acc = val_acc
                torch.save(model.state_dict(), "models/best_model.pth")
        
        return best_val_acc


def main():
    """Run full training pipeline"""
    # Hyperparameter tuning with Optuna
    study = optuna.create_study(direction="maximize")
    study.optimize(objective, n_trials=CONFIG["optuna"]["n_trials"], timeout=CONFIG["optuna"]["timeout"])
    
    # Train final model with best params
    best_params = study.best_params
    logger.info(f"✅ Best hyperparameters: {best_params}")
    
    # Preprocess data
    train_data, val_data, test_data, scaler, le = preprocess_data()
    
    # Create loaders
    train_loader = DataLoader(
        EntityDataset(train_data[0], train_data[1]), batch_size=best_params["batch_size"], shuffle=True
    )
    val_loader = DataLoader(
        EntityDataset(val_data[0], val_data[1]), batch_size=best_params["batch_size"]
    )
    test_loader = DataLoader(
        EntityDataset(test_data[0], test_data[1]), batch_size=best_params["batch_size"]
    )
    
    # Train final model
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = BiLSTMAttention(
        CONFIG["model"]["input_dim"],
        best_params["hidden_dim"],
        best_params["num_layers"],
        CONFIG["model"]["output_dim"]
    ).to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=best_params["learning_rate"])
    
    for epoch in range(CONFIG["model"]["epochs"]):
        train_loss, train_acc = train_epoch(model, train_loader, criterion, optimizer, device)
        val_loss, val_acc = eval_epoch(model, val_loader, criterion, device)
        logger.info(f"Epoch {epoch+1}/{CONFIG['model']['epochs']} | Val Acc: {val_acc:.4f}")
    
    # Evaluate on test set
    test_loss, test_acc = eval_epoch(model, test_loader, criterion, device)
    logger.info(f"✅ Final Test Accuracy: {test_acc:.4f}")
    mlflow.log_metric("test_accuracy", test_acc)
    
    # Export to ONNX
    dummy_input = torch.randn(1, CONFIG["model"]["input_dim"]).to(device)
    onnx_path = Path("models/sentinel_entity_classifier.onnx")
    torch.onnx.export(model, dummy_input, onnx_path, input_names=["input"], output_names=["output"])
    mlflow.log_artifact(onnx_path)
    
    # Push to Hugging Face Hub (optional)
    hf_token = os.getenv("HF_TOKEN")
    if hf_token:
        from huggingface_hub import HfApi
        api = HfApi()
        try:
            api.upload_file(
                path_or_fileobj=str(onnx_path),
                path_in_repo="model.onnx",
                repo_id=CONFIG["huggingface"]["repo_name"],
                repo_type="model",
                token=hf_token
            )
            logger.info(f"✅ Model pushed to Hugging Face Hub: {CONFIG['huggingface']['repo_name']}")
        except Exception as e:
            logger.warning(f"Failed to push to Hugging Face: {e}")
    else:
        logger.info("HF_TOKEN not set, skipping Hugging Face upload")
    
    logger.info("✅ Training pipeline complete")


if __name__ == "__main__":
    main()
