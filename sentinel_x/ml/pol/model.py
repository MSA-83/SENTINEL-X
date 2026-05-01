"""
SENTINEL-X PoL Anomaly Detector — Production Model
─────────────────────────────────────────────
Architecture: Dual-branch (Trajectory LSTM + Behavioral MLP) with attention fusion.
Designed for A40-8Q inference (8GB vRAM) and A40-16Q training.
Target: p99 inference latency < 50ms on A40-4Q (production serving profile).


Training path:
  T4 (free tier): dataset exploration, hyperparameter search (< 4GB VRAM)
  A40-8Q (eval): full training run, NLP concurrent
  A40-16Q (eval): large batch training, LoRA fine-tune variant
  A100-40C (Phase 4+): production MLOps, continuous retraining
"""
from __future__ import annotations


from dataclasses import dataclass
from pathlib import Path
from typing import Optional


import torch
import torch.nn as nn
import torch.nn.functional as F




@dataclass
class PoLModelConfig:
    # Sequence branch
    seq_len: int = 256
    seq_input_dim: int = 6          # lat, lon, speed, heading, alt_norm, ts_norm
    lstm_hidden_dim: int = 128
    lstm_num_layers: int = 3
    lstm_dropout: float = 0.3


    # Behavioral branch (tabular)
    behavioral_dim: int = 8          # Mean speed, std speed, heading changes, etc.
    mlp_hidden_dims: list[int] = None


    # Geographic + graph branch
    geo_graph_dim: int = 10
    geo_graph_hidden: int = 32


    # Fusion
    attention_heads: int = 4
    fusion_dim: int = 128
    dropout: float = 0.2


    # Output
    num_classes: int = 4            # NORMAL, LOITERING, SUSPICIOUS, ANOMALOUS


    # Training
    label_smoothing: float = 0.1    # Prevents overconfident predictions
    class_weights: list[float] = None  # For imbalanced dataset


    def __post_init__(self) -> None:
        if self.mlp_hidden_dims is None:
            self.mlp_hidden_dims = [64, 64]
        if self.class_weights is None:
            # Expected ~70% NORMAL, 20% LOITERING, 7% SUSPICIOUS, 3% ANOMALOUS
            self.class_weights = [1.0, 3.5, 10.0, 25.0]




class TrajectoryEncoder(nn.Module):
    """
    Bidirectional LSTM encoder for position sequence data.
    Input: (batch, seq_len, input_dim)
    Output: (batch, lstm_hidden_dim * 2) — bidirectional concat
    """


    def __init__(self, cfg: PoLModelConfig) -> None:
        super().__init__()
        self.lstm = nn.LSTM(
            input_size=cfg.seq_input_dim,
            hidden_size=cfg.lstm_hidden_dim,
            num_layers=cfg.lstm_num_layers,
            batch_first=True,
            bidirectional=True,
            dropout=cfg.lstm_dropout if cfg.lstm_num_layers > 1 else 0.0,
        )
        # Temporal attention over LSTM outputs
        self.attention = nn.MultiheadAttention(
            embed_dim=cfg.lstm_hidden_dim * 2,
            num_heads=cfg.attention_heads,
            dropout=cfg.dropout,
            batch_first=True,
        )
        self.layer_norm = nn.LayerNorm(cfg.lstm_hidden_dim * 2)
        self.output_dim = cfg.lstm_hidden_dim * 2


    def forward(self, x: torch.Tensor, mask: Optional[torch.Tensor] = None) -> torch.Tensor:
        """
        Args:
            x: (batch, seq_len, input_dim) — padded sequences
            mask: (batch, seq_len) — True for padding positions


        Returns:
            (batch, lstm_hidden_dim * 2)
        """
        lstm_out, _ = self.lstm(x)  # (batch, seq_len, hidden*2)


        # Self-attention for temporal context
        attn_out, _ = self.attention(lstm_out, lstm_out, lstm_out, key_padding_mask=mask)
        attn_out = self.layer_norm(lstm_out + attn_out)  # Residual


        # Global average pooling (masked)
        if mask is not None:
            # Zero out padding positions before averaging
            attn_out = attn_out * (~mask).unsqueeze(-1).float()
            valid_counts = (~mask).sum(dim=1, keepdim=True).float().clamp(min=1)
            pooled = attn_out.sum(dim=1) / valid_counts
        else:
            pooled = attn_out.mean(dim=1)


        return pooled




class BehavioralEncoder(nn.Module):
    """MLP encoder for engineered behavioral features."""


    def __init__(self, cfg: PoLModelConfig) -> None:
        super().__init__()
        dims = [cfg.behavioral_dim] + cfg.mlp_hidden_dims
        layers: list[nn.Module] = []
        for i in range(len(dims) - 1):
            layers.extend([
                nn.Linear(dims[i], dims[i + 1]),
                nn.LayerNorm(dims[i + 1]),
                nn.GELU(),
                nn.Dropout(cfg.dropout),
            ])
        self.net = nn.Sequential(*layers)
        self.output_dim = cfg.mlp_hidden_dims[-1]


    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)




class GeoGraphEncoder(nn.Module):
    """Encoder for geographic context and graph entity features."""


    def __init__(self, cfg: PoLModelConfig) -> None:
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(cfg.geo_graph_dim, cfg.geo_graph_hidden),
            nn.LayerNorm(cfg.geo_graph_hidden),
            nn.GELU(),
            nn.Dropout(cfg.dropout),
            nn.Linear(cfg.geo_graph_hidden, cfg.geo_graph_hidden),
        )
        self.output_dim = cfg.geo_graph_hidden


    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)




class PoLAnomalyDetector(nn.Module):
    """
    Production PoL anomaly detection model.


    Architecture:
        TrajectoryEncoder (BiLSTM + attention) ──┐
        BehavioralEncoder (MLP)                  ├── Concat → Fusion MLP → Classifier
        GeoGraphEncoder (MLP)                    ┘


    ONNX-exportable for production serving.
    Designed to fit A40-8Q inference (8GB) with batch_size=512.
    """


    def __init__(self, cfg: PoLModelConfig) -> None:
        super().__init__()
        self.cfg = cfg


        self.traj_enc = TrajectoryEncoder(cfg)
        self.beh_enc = BehavioralEncoder(cfg)
        self.geo_enc = GeoGraphEncoder(cfg)


        fusion_input_dim = (
            self.traj_enc.output_dim
            + self.beh_enc.output_dim
            + self.geo_enc.output_dim
        )


        self.fusion = nn.Sequential(
            nn.Linear(fusion_input_dim, cfg.fusion_dim),
            nn.LayerNorm(cfg.fusion_dim),
            nn.GELU(),
            nn.Dropout(cfg.dropout),
            nn.Linear(cfg.fusion_dim, cfg.fusion_dim // 2),
            nn.LayerNorm(cfg.fusion_dim // 2),
            nn.GELU(),
        )
        self.classifier = nn.Linear(cfg.fusion_dim // 2, cfg.num_classes)


        # Calibration layer (Platt scaling post-training)
        self.temperature = nn.Parameter(torch.ones(1))


        self._init_weights()


    def _init_weights(self) -> None:
        for module in self.modules():
            if isinstance(module, nn.Linear):
                nn.init.kaiming_normal_(module.weight, nonlinearity="relu")
                if module.bias is not None:
                    nn.init.zeros_(module.bias)


    def forward(
        self,
        trajectory: torch.Tensor,
        behavioral: torch.Tensor,
        geo_graph: torch.Tensor,
        traj_mask: Optional[torch.Tensor] = None,
    ) -> dict[str, torch.Tensor]:
        """
        Args:
            trajectory: (batch, seq_len, 6)
            behavioral: (batch, 8)
            geo_graph: (batch, 10)
            traj_mask: (batch, seq_len) — True for padding


        Returns:
            {
                "logits": (batch, 4),
                "probabilities": (batch, 4),
                "anomaly_score": (batch,),  # 0-100, broadcast for API
                "predicted_class": (batch,),
            }
        """
        traj_features = self.traj_enc(trajectory, mask=traj_mask)
        beh_features = self.beh_enc(behavioral)
        geo_features = self.geo_enc(geo_graph)


        fused = torch.cat([traj_features, beh_features, geo_features], dim=-1)
        hidden = self.fusion(fused)
        logits = self.classifier(hidden)


        # Temperature scaling for calibration
        calibrated_logits = logits / self.temperature.clamp(min=0.1)
        probs = F.softmax(calibrated_logits, dim=-1)


        # Anomaly score: weighted combination of non-NORMAL probabilities
        # Weights: LOITERING=40, SUSPICIOUS=70, ANOMALOUS=100
        anomaly_score = (
            probs[:, 1] * 40.0
            + probs[:, 2] * 70.0
            + probs[:, 3] * 100.0
        ).clamp(0.0, 100.0)


        return {
            "logits": logits,
            "probabilities": probs,
            "anomaly_score": anomaly_score,
            "predicted_class": probs.argmax(dim=-1),
        }


    @torch.no_grad()
    def export_onnx(self, output_path: Path, batch_size: int = 1) -> None:
        """
        Export model to ONNX for production serving with ONNX Runtime.
        ONNX Runtime on vGPU (A40-4Q) achieves <15ms p99 for batch_size=32.
        """
        self.eval()
        dummy_traj = torch.zeros(batch_size, self.cfg.seq_len, self.cfg.seq_input_dim)
        dummy_beh = torch.zeros(batch_size, self.cfg.behavioral_dim)
        dummy_geo = torch.zeros(batch_size, self.cfg.geo_graph_dim)


        torch.onnx.export(
            self,
            (dummy_traj, dummy_beh, dummy_geo),
            str(output_path),
            input_names=["trajectory", "behavioral", "geo_graph"],
            output_names=["logits", "probabilities", "anomaly_score", "predicted_class"],
            dynamic_axes={
                "trajectory": {0: "batch_size"},
                "behavioral": {0: "batch_size"},
                "geo_graph": {0: "batch_size"},
            },
            opset_version=17,
            do_constant_folding=True,
        )
