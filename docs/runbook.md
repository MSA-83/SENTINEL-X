# Sentinel-X End-to-End Demo Runbook

This runbook guides you through verifying the end-to-end demo included in the feature/end-to-end-demo branch.

## Overview

The demo (`demos/demo_end_to_end.py`) showcases a lightweight flow:
1. Fetch synthetic data via public data sources.
2. Register a data product in the Data Mesh Registry.
3. Generate a synthetic training dataset and persist it as Parquet.
4. (Optional) Run a tiny training pass if PyTorch is available.
5. Prepare artifacts for hosting.

All steps use only free-tier tooling and synthetic data—no external API keys required for a basic run.

## Prerequisites

- Python 3.8+ (recommended 3.10+)
- Git
- (Optional) PyTorch with CUDA for the tiny training step; the demo gracefully falls back if PyTorch is not installed.
- Access to the repository (clone or have the working tree).

## Steps

### 1. Clone and Prepare Environment

```bash
# Clone the repository (if you haven't already)
git clone https://github.com/MSA-83/SENTINEL-X.git
cd SENTINEL-X

# Create and activate a virtual environment (recommended)
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Run the Demo

```bash
# From the repository root
python demos/demo_end_to_end.py
```

You should see output similar to:

```
📥 Fetching public/synthetic data...
📊 Data product registered: demo.sentinel.x.training.v1
💾 Saved demo training data: datasets/processed/demo_training.parquet
Demo: prepared demo_training.parquet
Demo complete. Artifacts saved under datasets/processed/
```

If PyTorch is available, you may see an additional line indicating the device used for the tiny training pass.

### 3. Verify Artifacts

Check that the expected files were created:

```bash
ls -l datasets/processed/demo_training.parquet
```

You can inspect the Parquet file with `pandas` or `fastparquet` if desired:

```bash
python -c "import pandas as pd; df = pd.read_parquet('datasets/processed/demo_training.parquet'); print(df.shape); print(df.head())"
```

### 4. Verify Data Mesh Registry

The demo also registers a data product in the in‑memory registry. You can verify this by adding a small check in the demo or by extending the script, but the registry is ephemeral for the demo run.

### 5. Run Unit Tests (Optional)

To ensure the supporting code works, run the unit tests:

```bash
pytest -q
```

You should see passing tests for the new modules (data mesh, privileged escalation, etc.).

### 6. Clean Up (Optional)

Remove the virtual environment or keep it for further experimentation:

```bash
deactivate
# Optionally remove the venv directory
rm -rf .venv
```

## Troubleshooting

- **Missing dependencies**: Ensure you installed `requirements.txt`. If you see import errors for optional packages (e.g., `torch`), the demo will still run; the tiny training step will be skipped.
- **Parquet reading issues**: Install `fastparquet` or `pyarrow` if needed (`pip install fastparquet`).
- **Long runtime**: The demo is designed to finish within a few seconds; if it hangs, interrupt with `Ctrl+C` and check for network calls (the demo uses only synthetic data and local file I/O).

## Extending the Demo

You can extend this runbook to:
- Replace synthetic data with a real fetch from OpenSky (requires network and respects rate limits).
- Swap the tiny training pass for a proper model training step (e.g., using the ML pipeline in `training/production_ml_pipeline.py`).
- Push the resulting model to Hugging Face Hub (requires HF_TOKEN secret).
- Deploy the model to a free service (Railway, Fly.io, or Hugging Face Spaces) and test the inference endpoint.

## Contact

For questions or issues, open an issue in the repository or contact the maintainers.
