# Free AI Agent Training Platforms Guide

## Platform Comparison
| Platform | GPU | Time/Month | Cost | Best For | Rate Limit |
|----------|-----|------------|------|----------|-----------|
| **Kaggle** | T4 | 30h/week | FREE | Long training (6h+) | Groq: 100 req/min |
| **Paperspace** | T4 | 6h sessions | FREE | Quick runs | Groq: 10 req/s |
| **Colab** | T4 | 12h/session | FREE | Quick prototyping | Groq: 100 req/min |
| **GitHub Actions** | CPU | 2000 min/mo | FREE | CI/CD retraining | N/A (no GPU) |
| **HF Spaces** | CPU | Unlimited | FREE | Deployment | Groq: 10 req/s |
| **Modal** | T4/A100 | Unlimited | FREE tier | Production scale | Variable |
| **Together.ai** | A100 | FREE tuning | FREE | Model fine-tuning | 1k req/day |

---

## Kaggle (FREE T4 GPU)
### Specs
- **GPU**: NVIDIA Tesla T4 (16GB VRAM)
- **Duration**: Up to 9 hours per session (extendable by restarting kernel)
- **Disk**: 20GB RAM + 100GB storage (persistent across sessions)
- **Cost**: 100% FREE (no payment required)

### Best Practices
- Persist data in `/kaggle/input/` (read-only) and `/kaggle/working/` (read-write)
- Checkpoint every 2 hours to avoid losing progress on timeout
- Reduce batch size to 2-4 if OOM occurs; enable `gradient_checkpointing`

### Example: Fine-tune SENTINEL-X model
See `training_scripts/kaggle_lora_training.ipynb`

---

## Google Colab (FREE T4 GPU)
### Specs
- **GPU**: NVIDIA Tesla T4 (optional, ~1 hour per session)
- **Duration**: 12 hours per session (auto-save every 5 min)
- **Disk**: 100GB storage + Google Drive integration (15GB free)
- **Cost**: 100% FREE

### Best Practices
- Persist data by saving to `/content/drive/`
- Prevent timeout by adding `%%capture` magic or breaking large loops into smaller chunks
- Leverage free datasets from Kaggle integration: `!kaggle datasets download -d <dataset>`

### Example: Prepare SENTINEL-X dataset
See `training_scripts/colab_dataset_prep.py`

---

## Modal Labs (FREE A100 GPU)
### Specs
- **GPU**: NVIDIA A100 (80GB VRAM) or T4 (free tier)
- **Duration**: Unlimited for free tier (includes $30/mo credits)
- **Storage**: Persistent volumes (up to 10GB free)
- **Cost**: 100% FREE (credits cover small-scale training)

### How to Use
1. Create a free account → obtain API token
2. Upload script (`training_scripts/modal_training.py`)
3. Run via `modal run training_scripts/modal_training.py`
4. Download saved model from mounted volume

---

## Together.ai (FREE Fine-Tuning)
### Specs
- **GPU**: A100 hosted in cloud
- **Duration**: FREE tuning credits
- **Cost**: 100% FREE

### Example: Fine-tune LLMs without GPU
See `training_scripts/together_ai_finetune.py`

---

## GitHub Actions (FREE CI/CD Training)
### Specs
- **GPU**: CPU only
- **Duration**: 2000 min/month free
- **Cost**: 100% FREE

### Best Practices
- Use caching for pip dependencies
- Store secrets (GROQ_API_KEY, HF_TOKEN) in repository settings
- Add Slack notifications for training completion

### Example Workflow
See `.github/workflows/agent-training.yml`

---

## Hugging Face Spaces (FREE Deployment)
### Specs
- **GPU**: CPU only
- **Duration**: Unlimited
- **Storage**: 100GB free
- **Cost**: 100% FREE

### How to Deploy
1. Create HF Spaces repo (spaces.huggingface.co)
2. Select "Streamlit" template
3. Push Streamlit app (see `training_scripts/hf_spaces_app.py`)
4. Auto-deploys FREE with public URL

---

## Choosing the Right Platform
- **Long, uninterrupted GPU sessions** → **Kaggle** or **Modal** (free credits)
- **Notebook-centric workflow** → **Colab** (fast setup, easy sharing)
- **Embed training into CI/CD** → **GitHub Actions** (free minutes, secret management)
- **Public demo UI** → **HF Spaces** (instant web UI, auto-reload on git push)
